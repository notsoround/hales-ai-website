// Tier 7 reliability & transport verification: queue cap, priority, read dedupe,
// AbortSignal isolation, transient retry, persona cache/auto-retry, deferred AI allowance,
// NotificationsPopover fallback/badge/seen persistence, focus hygiene, and Living Sky header glass.
// All accounts and responses are synthetic local fixtures only.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

let checks = 0;

// ---------- Part 1: accountSession.ts transport invariants (Node VM) ----------
{
  const source = readFileSync('src/components/cupcake/accountSession.ts', 'utf8');
  const identity = { account_id: 'acc_synthetic_tier7', email: 'tier7@example.invalid', name: 'Synthetic Tier7' };
  const okJson = body => ({ status: 200, ok: true, json: async () => ({ ok: true, identity, ...body }) });
  const errJson = (status, body) => ({ status, ok: false, json: async () => ({ ok: false, ...body }) });
  const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

  let handler = async () => okJson({});
  const storage = new Map();
  const context = {
    exports: {},
    fetch: (url, init) => handler(url.replace('https://automate.hales.ai/api/account/', ''), init?.body ? JSON.parse(init.body) : undefined, init?.signal),
    setTimeout, clearTimeout, AbortController, DOMException, JSON, Math, Error, Set, Map, Promise, URL,
    window: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    Event: class { constructor(type) { this.type = type; } },
    crypto: { randomUUID: () => 'synthetic-tier7-uuid' },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    require: name => name.startsWith('./accountMode') ? { ACCOUNT_SESSIONS: true, ACCOUNT_UNAVAILABLE: 'unavailable' } : {},
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
  const session = context.exports;

  // Restore session first.
  handler = async route => { assert.equal(route, 'session'); return okJson({}); };
  await session.restoreSession();
  assert.equal(session.sessionSnapshot().identity.account_id, identity.account_id);

  // 1a. Concurrency cap MAX_IN_FLIGHT = 6 across 12 distinct data + health/* requests.
  {
    let active = 0, maxActive = 0;
    const holds = [];
    handler = async (route, body) => {
      active++;
      maxActive = Math.max(maxActive, active);
      const gate = deferred();
      holds.push(gate);
      try {
        await gate.promise;
        return okJson({ route, action: body?.action || null });
      } finally {
        active--;
      }
    };
    const promises = [
      ...Array.from({ length: 10 }, (_, i) => session.accountData({ action: 'feed_get', start: `2026-11-${String(i + 1).padStart(2, '0')}`, end: `2026-11-${String(i + 1).padStart(2, '0')}` })),
      session.accountHealth('sync', {}),
      session.accountHealth('cgm/latest', {}),
    ];
    await new Promise(r => setTimeout(r, 15));
    assert.equal(active, 6, 'exactly 6 concurrent requests should be in flight');
    assert.equal(maxActive, 6, 'concurrency must never exceed MAX_IN_FLIGHT = 6');
    while (holds.length < 12) {
      const batch = holds.splice(0, holds.length);
      for (const h of batch) h.resolve();
      await new Promise(r => setTimeout(r, 5));
      if (active === 0 && holds.length === 0) break;
    }
    for (const h of holds.splice(0)) h.resolve();
    const results = await Promise.all(promises);
    assert.equal(results.length, 12);
    assert.equal(maxActive, 6, 'peak concurrency stayed capped at 6 across all 12 requests');
    checks++;
  }

  // 1b. Priority ordering: persona_get before normal reads before notifications_summary / ai_budget_status.
  {
    const blockers = [];
    const dispatchOrder = [];
    handler = async (_route, body) => {
      dispatchOrder.push(body?.action);
      if (body?.action === 'feed_get') {
        const g = deferred();
        blockers.push(g);
        await g.promise;
      }
      return okJson({ action: body?.action });
    };
    const initial = Array.from({ length: 6 }, (_, i) => session.accountData({ action: 'feed_get', start: `2026-10-0${i + 1}`, end: `2026-10-0${i + 1}` }));
    await new Promise(r => setTimeout(r, 10));
    assert.equal(blockers.length, 6);
    const queued = Promise.all([
      session.accountData({ action: 'notifications_summary' }),
      session.accountData({ action: 'ai_budget_status' }),
      session.accountData({ action: 'weight_list' }),
      session.accountData({ action: 'persona_get' }),
    ]);
    for (const g of blockers) g.resolve();
    await Promise.all([...initial, queued]);
    const afterInitial = dispatchOrder.slice(6);
    assert.equal(afterInitial[0], 'persona_get', 'persona_get must run first from queue');
    assert.equal(afterInitial[1], 'weight_list', 'normal read runs before low-priority reads');
    assert.deepEqual(afterInitial.slice(2).sort(), ['ai_budget_status', 'notifications_summary'], 'low-priority actions run last');
    checks++;
  }

  // 1c. Read-only in-flight deduplication (canonical key order) + cleanup after completion.
  {
    let fetchCount = 0;
    let hold = deferred();
    handler = async (_route, body) => {
      fetchCount++;
      await hold.promise;
      return okJson({ meals: [{ id: `m-${fetchCount}`, days: body.days }] });
    };
    const p1 = session.accountData({ action: 'food_history', days: 7, limit: 50 });
    const p2 = session.accountData({ limit: 50, days: 7, action: 'food_history' });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(fetchCount, 1, 'identical simultaneous read requests must deduplicate to 1 fetch');
    hold.resolve();
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.meals[0].id, 'm-1');
    assert.equal(r2.meals[0].id, 'm-1');

    // Subsequent call after completion must issue a fresh fetch.
    hold = deferred();
    const p3 = session.accountData({ action: 'food_history', days: 7, limit: 50 });
    hold.resolve();
    const r3 = await p3;
    assert.equal(fetchCount, 2, 'completed in-flight entry must be cleaned up');
    assert.equal(r3.meals[0].id, 'm-2');
    checks++;
  }

  // 1d. Per-caller AbortSignal isolation on deduped reads (partial abort keeps survivor; full abort cancels fetch).
  {
    let sharedAborted = false;
    let hold = deferred();
    handler = async (_route, _body, signal) => {
      signal?.addEventListener('abort', () => { sharedAborted = true; });
      await hold.promise;
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return okJson({ survived: true });
    };
    const c1 = new AbortController();
    const c2 = new AbortController();
    const p1 = session.accountData({ action: 'steps_list', days: 7 }, c1.signal);
    const p2 = session.accountData({ action: 'steps_list', days: 7 }, c2.signal);
    await new Promise(r => setTimeout(r, 10));
    c1.abort();
    await assert.rejects(p1, { name: 'AbortError' });
    assert.equal(sharedAborted, false, 'aborting one waiter must not abort another active waiter');
    hold.resolve();
    const survivor = await p2;
    assert.equal(survivor.survived, true);

    // When all waiters abort, the shared fetch is aborted too.
    sharedAborted = false;
    hold = deferred();
    const c3 = new AbortController();
    const p3 = session.accountData({ action: 'steps_list', days: 14 }, c3.signal);
    await new Promise(r => setTimeout(r, 10));
    c3.abort();
    await assert.rejects(p3, { name: 'AbortError' });
    assert.equal(sharedAborted, true, 'aborting the sole waiter must abort the underlying fetch');
    hold.resolve();
    checks++;
  }

  // 1e. Mutations are NEVER deduplicated.
  {
    let mutationFetches = 0;
    const gates = [];
    handler = async () => {
      mutationFetches++;
      const g = deferred();
      gates.push(g);
      await g.promise;
      return okJson({ saved: true });
    };
    const m1 = session.accountData({ action: 'weight_add', value: 180 });
    const m2 = session.accountData({ action: 'weight_add', value: 180 });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(mutationFetches, 2, 'simultaneous identical mutations must never deduplicate');
    for (const g of gates) g.resolve();
    await Promise.all([m1, m2]);
    checks++;
  }

  // 1f. Transient network error retries 1x on idempotent read, 0x on mutation.
  {
    let attempts = 0;
    handler = async () => {
      attempts++;
      if (attempts === 1) throw new TypeError('Synthetic network hiccup');
      return okJson({ preferences: { appearance: 'rose', persona: 'matthieu', name: 'Matthieu' }, revision: 1, updated: 1, saved: true });
    };
    const persona = await session.accountData({ action: 'persona_get' });
    assert.equal(attempts, 2, 'persona_get retries once on transient network error');
    assert.equal(persona.preferences.name, 'Matthieu');

    let mutAttempts = 0;
    handler = async () => { mutAttempts++; throw new TypeError('Synthetic write disconnect'); };
    await assert.rejects(session.accountData({ action: 'weight_add', value: 181 }), TypeError);
    assert.equal(mutAttempts, 1, 'mutations never auto-retry on network error');
    checks++;
  }

  // 1g. Explicit unknown_action / account_action_not_ready throw AccountRequestError with .code.
  {
    handler = async () => errJson(400, { error: 'unknown_action' });
    await assert.rejects(
      session.accountData({ action: 'notifications_summary' }),
      err => err instanceof session.AccountRequestError && err.code === 'unknown_action',
    );
    handler = async () => errJson(503, { error: 'account_action_not_ready' });
    await assert.rejects(
      session.accountData({ action: 'notifications_summary' }),
      err => err instanceof session.AccountRequestError && err.code === 'account_action_not_ready',
    );
    handler = async () => errJson(503, { error: 'service_overloaded' });
    await assert.rejects(
      session.accountData({ action: 'notifications_summary' }),
      err => !(err instanceof session.AccountRequestError),
    );
    checks++;
  }
}
console.log(`PASS Part 1 (${checks} transport VM checks): MAX_IN_FLIGHT=6, priority queue, read dedupe, AbortSignal isolation, no mutation dedupe, 1x read network retry, explicit unsupported-action codes.`);

// ---------- Part 2: Real-browser Playwright reliability checks ----------
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-tier7-reliability-'));
const server = await createServer({
  cacheDir,
  plugins: [{
    name: 'tier7-reliability-root',
    configureServer(srv) {
      srv.middlewares.use((req, _res, next) => {
        if (['/cupcake/account', '/cupcake/account/'].includes(req.url?.split('?')[0])) req.url = '/tests/account-browser-preview.html';
        next();
      });
    },
  }],
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());

  let personaFailCount = 0;
  let personaMode = 'ok';
  const personaRecord = { preferences: { appearance: 'rose', persona: 'matthieu', name: 'Tier7 Rose' }, revision: 1, updated: 1, saved: true };
  await context.exposeFunction('syntheticPersonaServer', async (_owner, body) => {
    if (body.action !== 'persona_get') return { status: 200, value: { ok: true, ...personaRecord } };
    if (personaMode === 'fail-always') return { status: 503, value: { ok: false } };
    if (personaFailCount > 0) {
      personaFailCount--;
      return { status: 503, value: { ok: false } };
    }
    return { status: 200, value: { ok: true, ...personaRecord } };
  });
  await context.exposeFunction('syntheticCoachServer', async () => ({ status: 200, value: { ok: true, grants: [] } }));
  await context.exposeFunction('syntheticHealthServer', async () => ({ status: 200, value: { ok: true, devices: [], last_received_at: null, last_observed_at: null, metrics: [], coverage_note: 'Synthetic' } }));

  // Intercept ai_budget_status, notifications_summary, and receipt_list inside the page before React mounts.
  await context.addInitScript(() => {
    localStorage.setItem('synthetic-account-server', 'acc_synthetic_a');
    window.__tier7 = {
      notifMode: 'summary',
      notifItems: [
        { id: 'r1', kind: 'unmatched_receipts', count: 29, title: '29 unmatched receipts', detail: 'Review →', targetTab: 'receipts' },
        { id: 'c1', kind: 'missed_calls', count: 2, title: 'Missed 2 calls', detail: 'Catch up by voice →', targetTab: 'talk' },
      ],
      notifUnreadCount: 31,
      budgetCalls: 0,
      notifCalls: [],
      receiptFallbackCalls: 0,
      mountTime: performance.now(),
    };
    const origFetch = window.fetch.bind(window);
    // Patch fetch after account-browser-preview sets window.fetch by wrapping via microtask/descriptor trap.
    let currentFetch = origFetch;
    const wrappedFetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === 'https://automate.hales.ai/api/account/data' && init?.body) {
        const body = JSON.parse(String(init.body));
        const identity = { account_id: 'acc_synthetic_a', email: 'a@example.invalid', name: 'Synthetic A' };
        if (body.action === 'ai_budget_status') {
          window.__tier7.budgetCalls++;
          return Response.json({
            ok: true, identity, enabled: true, limitMicros: 5_000_000, usedMicros: 1_250_000, remainingMicros: 3_750_000, periodSeconds: 86400, periodStart: Math.floor(Date.now() / 1000),
          }, { status: 200 });
        }
        if (body.action === 'notifications_summary') {
          window.__tier7.notifCalls.push(performance.now() - window.__tier7.mountTime);
          const mode = window.__tier7.notifMode;
          if (mode === '503') return Response.json({ ok: false, error: 'service_overloaded' }, { status: 503 });
          if (mode === '429-cupcake') return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 });
          if (mode === 'unknown_action') return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
          return Response.json({
            ok: true, identity,
            unreadCount: window.__tier7.notifUnreadCount,
            missedCalls7d: 2,
            unmatchedReceipts: 29,
            lowAllowance: false,
            staleSyncs: 0,
            items: window.__tier7.notifItems,
          }, { status: 200 });
        }
        if (body.action === 'receipt_list') {
          window.__tier7.receiptFallbackCalls++;
          return Response.json({ ok: true, identity, receipts: [{ id: 'rec_1', status: 'unmatched' }] }, { status: 200 });
        }
      }
      return currentFetch(input, init);
    };
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      get: () => wrappedFetch,
      set: fn => { currentFetch = fn; },
    });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // 2a. Initial load: persona caches under cupcake-account-persona-cache-v1; AiAllowanceBar does NOT fetch while Settings is closed; Notifications defers 600ms & shows distinct count 2 (not 31).
  await page.goto(base + '/cupcake/account');
  await page.locator('.cc-top .cc-account-identity').filter({ hasText: 'Tier7 Rose — Synthetic A' }).waitFor();
  assert.equal(await page.evaluate(() => window.__tier7.budgetCalls), 0, 'AiAllowanceBar must NOT fetch ai_budget_status while Settings is closed');

  const cachedPersona = await page.evaluate(() => JSON.parse(localStorage.getItem('cupcake-account-v1:acc_synthetic_a:cupcake-account-persona-cache-v1') || 'null'));
  assert.deepEqual(cachedPersona, { appearance: 'rose', persona: 'matthieu', name: 'Tier7 Rose' }, 'confirmed persona is cached per owner');

  // Wait for deferred notifications_summary (~600ms) and verify badge is 2 (distinct items), not 31.
  await page.locator('.nx-notif-badge').waitFor();
  assert.equal(await page.locator('.nx-notif-badge').innerText(), '2', 'badge must reflect distinct actionable items (2), not raw summed count (31)');
  const firstNotifAt = await page.evaluate(() => window.__tier7.notifCalls[0]);
  assert.ok(firstNotifAt >= 450, `initial notifications_summary fetch should be deferred (~600ms), got ${Math.round(firstNotifAt)}ms`);
  checks++;

  // 2b. Opening Notifications clears badge via owner-scoped cc-notif-seen-v1 and closing via pointer leaves no focus-visible ring.
  await page.locator('.nx-notif-btn').click();
  await page.getByRole('dialog', { name: 'Notifications' }).waitFor();
  assert.equal(await page.locator('.nx-notif-badge').count(), 0, 'opening Notifications clears badge immediately');
  const seenFp = await page.evaluate(() => localStorage.getItem('cupcake-account-v1:acc_synthetic_a:cc-notif-seen-v1'));
  assert.ok(seenFp && seenFp.includes('r1:unmatched_receipts:29'), 'seen fingerprint persisted in owner-scoped storage');

  await page.getByRole('button', { name: 'Close notifications' }).click();
  const notifFocusAfterPointer = await page.evaluate(() => {
    const btn = document.querySelector('.nx-notif-btn');
    return { active: document.activeElement === btn, focusVisible: btn.matches(':focus-visible'), outline: getComputedStyle(btn).outlineStyle };
  });
  assert.equal(notifFocusAfterPointer.active, true, 'focus returns to bell button');
  assert.equal(notifFocusAfterPointer.outline, 'none', 'pointer close leaves no lingering focus ring on bell');

  // Escape close on Notifications also returns focus cleanly.
  await page.locator('.nx-notif-btn').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Notifications' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.nx-notif-btn')), true);
  checks++;

  // 2c. Opening Settings fetches ai_budget_status; pointer close returns activeElement without lingering outline.
  assert.equal(await page.evaluate(() => window.__tier7.budgetCalls), 0, 'still 0 ai_budget_status calls before opening Settings');
  await page.locator('.cc-settings > summary').click();
  await page.waitForFunction(() => window.__tier7.budgetCalls >= 1);
  await page.locator('.cc-settings-group > summary').filter({ hasText: /^Account & security$/ }).click();
  await page.locator('.nx-allowance').waitFor();
  assert.match(await page.locator('.nx-allowance').innerText(), /\$3\.75 left/);

  // Close Settings via mouse click on Close settings button: activeElement === summary, no lingering focus ring.
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  const settingsFocusAfterPointer = await page.evaluate(() => {
    const summary = document.querySelector('.cc-settings > summary');
    return { active: document.activeElement === summary, focusVisible: summary.matches(':focus-visible'), outline: getComputedStyle(summary).outlineStyle };
  });
  assert.equal(settingsFocusAfterPointer.active, true, 'pointer close keeps document.activeElement on Settings summary');
  assert.equal(settingsFocusAfterPointer.outline, 'none', 'pointer close leaves no stuck focus ring on Settings gear');

  // Close Settings via scrim click too.
  await page.locator('.cc-settings > summary').click();
  await page.locator('.cc-settings-scrim').click({ position: { x: 2, y: 2 } });
  const settingsFocusAfterScrim = await page.evaluate(() => {
    const summary = document.querySelector('.cc-settings > summary');
    return { active: document.activeElement === summary, outline: getComputedStyle(summary).outlineStyle };
  });
  assert.equal(settingsFocusAfterScrim.active, true);
  assert.equal(settingsFocusAfterScrim.outline, 'none');
  checks++;

  // 2d. NotificationsPopover never invokes deriveClientFallback on 503/429, ONLY on unknown_action / account_action_not_ready.
  await page.evaluate(() => { window.__tier7.notifMode = '503'; window.__tier7.receiptFallbackCalls = 0; });
  await page.locator('.nx-notif-btn').click();
  await page.getByRole('button', { name: 'Refresh notifications' }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__tier7.receiptFallbackCalls), 0, '503 must NEVER trigger deriveClientFallback');

  await page.evaluate(() => { window.__tier7.notifMode = '429-cupcake'; });
  await page.getByRole('button', { name: 'Refresh notifications' }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__tier7.receiptFallbackCalls), 0, '429 must NEVER trigger deriveClientFallback');

  await page.evaluate(() => { window.__tier7.notifMode = 'unknown_action'; });
  await page.getByRole('button', { name: 'Refresh notifications' }).click();
  await page.waitForFunction(() => window.__tier7.receiptFallbackCalls >= 1);
  assert.equal(await page.evaluate(() => window.__tier7.receiptFallbackCalls), 1, 'explicit unknown_action invokes deriveClientFallback');
  // Restore server summary while popover is open so cc-notif-seen-v1 records the server summary fingerprint before reload.
  await page.evaluate(() => { window.__tier7.notifMode = 'summary'; });
  await page.getByRole('button', { name: 'Refresh notifications' }).click();
  await page.getByText('29 unmatched receipts', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close notifications' }).click();
  checks++;

  // 2e. Living Sky frosted glass header on Today + opaque header when Settings / Notifications is open.
  const headerGlass = await page.evaluate(() => {
    const app = document.querySelector('.cc-app');
    const top = document.querySelector('.cc-top');
    const stage = document.createElement('div');
    stage.className = 'nx-sky-stage';
    app.appendChild(stage);
    const roseSkyBg = getComputedStyle(top).backgroundColor;
    app.setAttribute('data-appearance', 'caribbean');
    const caribbeanSkyBg = getComputedStyle(top).backgroundColor;
    const settings = document.querySelector('.cc-settings');
    settings.open = true;
    const openSettingsBg = getComputedStyle(top).backgroundColor;
    const openSettingsBlur = getComputedStyle(top).backdropFilter;
    settings.open = false;
    stage.remove();
    return { roseSkyBg, caribbeanSkyBg, openSettingsBg, openSettingsBlur };
  });
  assert.equal(headerGlass.caribbeanSkyBg, 'rgba(4, 7, 10, 0.46)', 'caribbean Today header with Living Sky uses translucent glass');
  assert.equal(headerGlass.roseSkyBg, 'rgba(7, 6, 11, 0.46)', 'rose Today header with Living Sky uses translucent glass');
  assert.equal(headerGlass.openSettingsBg, 'rgb(4, 7, 10)', 'open Settings drawer restores solid opaque header');
  assert.equal(headerGlass.openSettingsBlur, 'none', 'open Settings drawer clears backdrop-filter');
  checks++;

  // 2f. Reload with 2 transient persona_get failures: cached prefs show immediately, auto-retry unlocks Appearance without clicking Retry;
  // also seen notifications stay cleared across reload until summary changes!
  personaFailCount = 2;
  await page.reload();
  await page.locator('.cc-top .cc-account-identity').filter({ hasText: 'Tier7 Rose — Synthetic A' }).waitFor();
  assert.equal(await page.locator('.cc-app').getAttribute('data-appearance'), 'rose', 'cached appearance renders immediately on reload');
  // Wait for auto-retry (600ms + 1500ms) to unlock Appearance automatically.
  await page.locator('.cc-settings > summary').click();
  await page.locator('.cc-settings-group > summary').filter({ hasText: /^Appearance$/ }).click();
  await page.getByText('Saved to your account.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Assistant name', { exact: true }).isDisabled(), false, 'auto-retry unlocked Appearance');
  assert.equal(await page.locator('.nx-notif-badge').count(), 0, 'seen badge remains cleared after reload when summary is unchanged');

  // Now mutate notification summary and dispatch data-changed -> badge reappears!
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.evaluate(() => {
    window.__tier7.notifItems = [
      ...window.__tier7.notifItems,
      { id: 's1', kind: 'stale_sync', count: 1, title: 'Health sync needs a check', detail: 'Check steps & weight →', targetTab: 'fitness' },
    ];
    window.dispatchEvent(new CustomEvent('cupcake-account-data-changed', { detail: 'purchase' }));
  });
  await page.locator('.nx-notif-badge').waitFor();
  assert.equal(await page.locator('.nx-notif-badge').innerText(), '3', 'badge reappears with distinct count 3 when summary changes');
  checks++;

  // 2g. Persistent persona failure while closed, then server recovers before Settings opens -> cc-settings-opened unlocks Appearance!
  personaMode = 'fail-always';
  await page.reload();
  await page.locator('.cc-top .cc-account-identity').filter({ hasText: 'Tier7 Rose — Synthetic A' }).waitFor();
  await page.waitForTimeout(150);
  personaMode = 'ok';
  await page.locator('.cc-settings > summary').click();
  await page.locator('.cc-settings-group > summary').filter({ hasText: /^Appearance$/ }).click();
  await page.getByText('Saved to your account.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Assistant name', { exact: true }).isDisabled(), false, 'opening Settings unlocks Appearance via cc-settings-opened');
  checks++;

  assert.deepEqual(errors, [], 'no uncaught page errors');
  await context.close();
} finally {
  await browser.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}

console.log(`PASS tier7-reliability (${checks} checks): transport queue/priority/dedupe/AbortSignal/retry, persona cache/auto-retry/Settings unlock, deferred AI allowance, Notifications fallback/badge/seen persistence, focus ring hygiene, and Living Sky header glass.`);
