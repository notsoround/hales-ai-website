import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { existsSync, readFileSync, mkdtempSync, realpathSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url), { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = process.env.CGM_UI_OUTPUT || path.resolve('output/account-cgm'); mkdirSync(out, { recursive: true });
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-cgm-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-cgm-account', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-cgm-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const fixtureFile = process.env.CGM_HTTP_FIXTURE;
if (!fixtureFile || !existsSync(fixtureFile)) throw Error('Set CGM_HTTP_FIXTURE to the actual synthetic AccountHTTP retained response.');
const saved = JSON.parse(readFileSync(fixtureFile, 'utf8'));
const actual = saved.cgm || saved.response?.cgm || saved.body?.cgm;
assert.ok(actual, 'Actual HTTP cgm object is required; no handwritten substitute.');
const checked = '2026-11-08T16:00:00.000000Z';
function cgm(mode = 'stale') {
  if (mode === 'actual') return structuredClone(actual);
  const value = { available: true, reason: null, source: 'libre-cgm', basis: 'stored_sensor_observation', timestampBasis: 'saved_libre_log', originalProviderTimestampVerified: false,
    latest: { value: 123.5, unit: 'mg/dL', observedAt: mode === 'future' ? '2026-11-08T16:01:00.000000Z' : mode === 'recent' ? '2026-11-08T15:55:00.000000Z' : '2026-10-09T10:00:00.000000Z', trend: 'unknown' },
    freshness: mode === 'future' ? 'future' : mode === 'recent' ? 'current' : 'stale', ageMinutes: mode === 'future' ? -1 : mode === 'recent' ? 5 : (Date.parse(checked) - Date.parse('2026-10-09T10:00:00Z')) / 60000,
    checkedAt: checked, providerCheckedAt: null, sourceStatus: 'ok', connected: true, manualReadingsIncluded: false, readOnly: true, coverage: 'Latest saved Libre observation only; not complete CGM history' };
  if (mode === 'unknown') { value.latest.observedAt = null; value.freshness = 'unknown'; value.ageMinutes = null; }
  if (mode === 'disconnected') { value.reason = 'not_connected'; value.connected = false; }
  if (['unsupported_account', 'credential_unavailable', 'source_offline', 'invalid_source_response', 'not_connected', 'no_saved_reading'].includes(mode)) { value.available = false; value.reason = mode; value.latest = null; value.freshness = 'unknown'; value.ageMinutes = null; value.connected = mode === 'not_connected' ? false : null; value.sourceStatus = null; }
  return value;
}
let mode, calls, release, held, malformed;
function reset(next = 'stale') { mode = next; calls = []; release = () => {}; held = false; malformed = null; }
async function remote(owner, route, body) {
  calls.push({ owner, route, body }); assert.equal(route, 'health/cgm/latest'); assert.deepEqual(body, {});
  const startedMode = mode;
  if (mode === 'hold') { held = true; await new Promise(resolve => { release = resolve; }); }
  if (startedMode === 'network') throw Error('Synthetic connection lost');
  if (startedMode === 'context') return { status: 409, value: { ok: false, error: 'account_context_changed' } };
  if (startedMode === 'error') return { status: 503, value: { ok: false, error: 'cgm_unavailable' } };
  const data = cgm(owner === 'B' ? 'unsupported_account' : startedMode === 'hold' ? 'stale' : startedMode);
  if (malformed) malformed(data);
  return { status: 200, value: { ok: true, cgm: data } };
}
const region = page => page.getByRole('region', { name: 'Saved CGM source', exact: true });
async function open(browser, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } }); await context.exposeFunction('syntheticCGMServer', remote);
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); return { context, page, errors };
}
async function safe(test) {
  assert.deepEqual(test.errors, []);
  const state = await test.page.evaluate(() => ({ requests: window.cgmFixture.requests, blocked: window.cgmFixture.blocked })); assert.deepEqual(state.blocked, []);
  for (const r of state.requests) { assert.equal(r.credentials, 'include'); assert.equal(r.headers['x-cupcake-request'], 'account'); assert.equal(r.headers['x-cupcake-account-context'], r.owner === 'A' ? 'acc_cgm_a' : 'acc_cgm_b'); assert.equal(r.headers.authorization, undefined); assert.equal(r.headers['x-cupcake-key'], undefined); if (r.route === 'health/cgm/latest') assert.deepEqual(r.body, {}); }
  return state;
}
const evidence = { semantics: [], layouts: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true });
  reset('actual'); let test = await open(browser), p = test.page;
  await region(p).getByText(/not live|not a live stream|timing unverified|freshness unverified/).waitFor();
  await region(p).getByText('Source & timing', { exact: true }).click();
  await region(p).getByText('Provider last checked', { exact: true }).waitFor();
  await region(p).getByText('Original provider timestamp is not retained in this view.', { exact: false }).waitFor();
  assert.equal(await region(p).getByText('Unknown', { exact: true }).count() >= 1, true);
  await p.getByText('6 PM blood sugar', { exact: true }).waitFor(); await p.getByText('Manual reading at', { exact: false }).waitFor();
  const added = await p.evaluate(() => window.cgmFixture.manualWrite()); assert.equal(added.entry.glucoseMgDl, 117);
  const requestState = await safe(test); assert.equal(requestState.requests.filter(r => r.body.action === 'glucose_add').length, 1);
  evidence.semantics.push('Actual retained AccountHTTP response renders; saved versus provider timestamps distinguished; manual list/add and energy/exercise controls preserved.');
  await p.getByRole('button', { name: 'Log exercise', exact: true }).waitFor();
  const parsed = await p.evaluate(async value => { const m = await import('/src/components/cupcake/accountCGM.ts'); const d = m.parseCGMStatus(value); return { initial: m.visibleCGMFreshness(d, 0), aged: m.visibleCGMFreshness(d, 10 * 60000) }; }, cgm('recent'));
  assert.deepEqual(parsed, { initial: 'current', aged: 'stale' });
  await test.context.close();
  for (const scenario of ['recent', 'future', 'unknown', 'disconnected', 'credential_unavailable', 'source_offline', 'invalid_source_response', 'not_connected', 'no_saved_reading', 'unsupported_account']) {
    reset(scenario); test = await open(browser); p = test.page;
    await p.getByText('Manual reading at', { exact: false }).waitFor();
    if (scenario === 'unsupported_account') { await p.waitForFunction(() => window.cgmFixture.completed.some(r => r.route === 'health/cgm/latest')); assert.equal(await region(p).count(), 0); }
    else { await region(p).waitFor(); await region(p).getByRole('button', { name: 'Check saved CGM source' }).waitFor();
      const text = await region(p).innerText();
      assert.equal(/\bhealthy\b|\bnormal\b|live CGM verified|fully synced/i.test(text), false);
      if (scenario === 'recent') assert.match(text, /Recent saved reading · not a live stream/);
      if (scenario === 'future') assert.match(text, /Source time is ahead · timing unverified/);
      if (scenario === 'unknown') assert.match(text, /Reading time unknown · freshness unverified/);
      if (scenario === 'disconnected') { assert.match(text, /Stale reading · not live/); assert.match(text, /123.5/); }
      if (['credential_unavailable', 'source_offline', 'invalid_source_response', 'not_connected', 'no_saved_reading'].includes(scenario)) assert.equal(await region(p).locator('.cc-cgm-value').count(), 0);
    }
    await safe(test); await test.context.close();
  }
  evidence.semantics.push('Recent/stale/future/unknown/disconnected and all unavailable states stay distinct; unsupported account hides CGM while manual stays. Recent snapshot ages out.');
  reset('stale'); test = await open(browser); p = test.page; await region(p).getByText('Stale reading · not live', { exact: true }).waitFor();
  const invalidCases = await p.evaluate(async baseValue => {
    const { parseCGMStatus } = await import('/src/components/cupcake/accountCGM.ts');
    const changes = [v => { v.latest.unit = 'mmol/L'; }, v => { v.latest.value = Number.NaN; }, v => { v.latest.value = 0; }, v => { v.latest.value = 1000; }, v => { v.source = 'other'; }, v => { v.basis = 'manual'; }, v => { v.timestampBasis = 'provider'; }, v => { v.originalProviderTimestampVerified = true; }, v => { v.providerCheckedAt = v.checkedAt; }, v => { v.freshness = 'current'; }, v => { v.latest.observedAt = 'bad'; }, v => { v.latest.trend = '\u0000'; }, v => { delete v.readOnly; }, v => { v.available = false; }, v => { v.reason = 'unknown_reason'; }];
    return changes.map(change => { const value = structuredClone(baseValue); change(value); try { parseCGMStatus(value); return false; } catch { return true; } });
  }, cgm('stale')); assert.equal(invalidCases.length, 15); assert.ok(invalidCases.every(Boolean));
  malformed = d => { d.latest.unit = 'mmol/L'; }; await region(p).getByRole('button', { name: 'Check saved CGM source' }).click(); await region(p).getByRole('alert').waitFor(); assert.equal(await region(p).locator('.cc-cgm-value').count(), 0);
  malformed = null; mode = 'network'; await region(p).getByRole('button', { name: 'Check saved CGM source' }).click(); await region(p).getByRole('alert').waitFor();
  mode = 'recent'; await region(p).getByRole('button', { name: 'Check saved CGM source' }).click(); await region(p).getByText('Recent saved reading · not a live stream', { exact: true }).waitFor(); await safe(test); await test.context.close();
  evidence.semantics.push('15 malformed source/unit/value/time/flags cases fail closed; malformed and network reads clear old value and allow explicit retry.');
  reset('hold'); test = await open(browser); p = test.page; await p.waitForFunction(() => window.cgmFixture.requests.some(r => r.route === 'health/cgm/latest')); assert.ok(held); mode = 'stale';
  await p.evaluate(() => window.cgmFixture.switchOwner('B')); release(); await p.waitForFunction(() => window.cgmFixture.completed.some(r => r.owner === 'B' && r.route === 'health/cgm/latest'));
  await p.getByText('Manual reading at', { exact: false }).waitFor(); assert.equal(await region(p).count(), 0); await safe(test); await test.context.close();
  for (const scenario of ['context', 'wrongEcho']) { reset(scenario === 'context' ? 'context' : 'stale'); test = await open(browser); p = test.page;
    if (scenario === 'wrongEcho') { await region(p).getByText('Stale reading · not live', { exact: true }).waitFor(); await p.evaluate(() => { window.cgmFixture.wrongEcho = true; }); await region(p).getByRole('button', { name: 'Check saved CGM source' }).click(); }
    await p.getByText('Signed out', { exact: true }).waitFor(); assert.equal(await region(p).count(), 0); await safe(test); await test.context.close();
  }
  evidence.semantics.push('Late A reply is discarded after B switch; context409 and wrong identity echo lock the account view.');
  await browser.close(); browser = null;
  for (const [engine, launcher] of [['Chromium', chromium], ['WebKit', webkit]]) {
    browser = await launcher.launch({ headless: true });
    for (const width of [320, 1280]) for (const theme of ['caribbean', 'rose']) {
      reset('stale'); test = await open(browser, width); p = test.page; await p.evaluate(value => window.cgmFixture.theme(value), theme); await region(p).getByText('Stale reading · not live', { exact: true }).waitFor();
      assert.equal(await region(p).locator('details').evaluate(el => el.open), false);
      await region(p).screenshot({ path: path.join(out, `${engine}-${width}-${theme}-collapsed.png`) });
      await region(p).getByText('Source & timing', { exact: true }).click();
      await region(p).getByText('Saved source checked', { exact: true }).waitFor(); await region(p).getByText('Provider last checked', { exact: true }).waitFor();
      const metrics = await p.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, cardWidth: document.querySelector('.cc-cgm').getBoundingClientRect().width, expandedHeight: document.querySelector('.cc-cgm').getBoundingClientRect().height })); assert.ok(metrics.scroll <= metrics.viewport, JSON.stringify(metrics));
      await region(p).screenshot({ path: path.join(out, `${engine}-${width}-${theme}-expanded.png`) });
      await p.getByText('6 PM blood sugar', { exact: true }).waitFor(); await p.getByText('Energy balance today', { exact: true }).waitFor(); await p.getByRole('button', { name: 'Log exercise', exact: true }).waitFor();
      await safe(test); evidence.layouts.push({ engine, width, theme, ...metrics }); await test.context.close();
    }
    await browser.close(); browser = null;
  }
  console.log('PASS CGM: exact AccountHTTP fixture; 10 status cases; 15 malformed cases; retries, manual actions and account fences; 8 Chromium/WebKit responsive theme cases.');
  writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ result: 'PASS', syntheticOnly: true, actualHTTPFixture: fixtureFile, ...evidence }, null, 2) + '\n');
} finally { if (browser) await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
