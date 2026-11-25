import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),
);
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-living-sky-'));
const server = await createServer({
  cacheDir,
  plugins: [
    {
      name: 'living-sky-root',
      enforce: 'pre',
      configureServer(srv) {
        srv.middlewares.use((req, _res, next) => {
          const route = req.url?.split('?')[0];
          if (route === '/cupcake/account' || route === '/cupcake/account/') req.url = '/tests/account-browser-preview.html';
          if (route === '/cupcake' || route === '/cupcake/') req.url = '/tests/assistant-integration-preview.html';
          next();
        });
      },
      transform(code, id) {
        if (id.endsWith('/tests/account-browser-preview.tsx')) {
          return code.replace(
            "if(body.action==='list')",
            "if((window as unknown as {syntheticDataOverride?:(action:string,body:Record<string,unknown>)=>Promise<{status:number;value:Record<string,unknown>}|null>}).syntheticDataOverride){const ov=await (window as unknown as {syntheticDataOverride:(action:string,body:Record<string,unknown>)=>Promise<{status:number;value:Record<string,unknown>}|null>}).syntheticDataOverride(String(body.action),body);if(ov)return response(ov.status,{...ov.value,identity});}\n  if(body.action==='list')",
          );
        }
      },
    },
  ],
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });

try {
  // 1. Pure livingSky module assertions
  const skyMod = await server.ssrLoadModule('/src/components/cupcake/noir/livingSky.ts');
  assert.equal(skyMod.resolveDayPhase(2), 'night');
  assert.equal(skyMod.resolveDayPhase(6), 'dawn');
  assert.equal(skyMod.resolveDayPhase(10), 'morning');
  assert.equal(skyMod.resolveDayPhase(14), 'afternoon');
  assert.equal(skyMod.resolveDayPhase(18), 'golden');
  assert.equal(skyMod.resolveDayPhase(22), 'night');

  const rainState = skyMod.resolveLivingSky({
    hour: 10, mealsToday: 0, stepsToday: 0, weighedToday: false,
    missedCallsCount: 2, hasCommitment: false, commitmentDone: false, caloriesLeft: null, persona: 'cupcake',
  });
  assert.equal(rainState.mood, 'rain');
  assert.equal(rainState.tier, 0);

  const mistState = skyMod.resolveLivingSky({
    hour: 9, mealsToday: 0, stepsToday: 0, weighedToday: false,
    missedCallsCount: 0, hasCommitment: false, commitmentDone: false, caloriesLeft: null, persona: 'matthieu',
  });
  assert.equal(mistState.mood, 'mist');
  assert.equal(mistState.tier, 1);

  const sunbreakState = skyMod.resolveLivingSky({
    hour: 10, mealsToday: 0, stepsToday: 0, weighedToday: false,
    missedCallsCount: 2, hasCommitment: true, commitmentDone: false, caloriesLeft: null, persona: 'cupcake',
  });
  assert.equal(sunbreakState.mood, 'sunbreak');
  assert.equal(sunbreakState.tier, 2);

  const clearState = skyMod.resolveLivingSky({
    hour: 18, mealsToday: 1, stepsToday: 2000, weighedToday: false,
    missedCallsCount: 0, hasCommitment: true, commitmentDone: false, caloriesLeft: 800, persona: 'matthieu',
  });
  assert.equal(clearState.mood, 'clear');
  assert.equal(clearState.tier, 3);
  assert.equal(clearState.label, 'Golden hour');

  // Earned sky: manually checking commitment with 0 real pillars stays sunbreak (never falsely jumps to radiant)
  const unearnedDoneState = skyMod.resolveLivingSky({
    hour: 22, mealsToday: 0, stepsToday: 0, weighedToday: false,
    missedCallsCount: 0, hasCommitment: true, commitmentDone: true, caloriesLeft: null, persona: 'cupcake',
  });
  assert.equal(unearnedDoneState.mood, 'sunbreak');
  assert.equal(unearnedDoneState.tier, 2);

  // Earned sky: commitment done + >= 1 real pillar -> radiant
  const radiantState = skyMod.resolveLivingSky({
    hour: 22, mealsToday: 1, stepsToday: 0, weighedToday: false,
    missedCallsCount: 0, hasCommitment: true, commitmentDone: true, caloriesLeft: null, persona: 'cupcake',
  });
  assert.equal(radiantState.mood, 'radiant');
  assert.equal(radiantState.tier, 4);
  assert.equal(radiantState.label, 'Calm night glow');

  // Auto-satisfaction & action kind helpers
  assert.equal(skyMod.isCommitmentSatisfied('Log breakfast', { mealsToday: 0, stepsToday: 0, weighedToday: false }), false);
  assert.equal(skyMod.isCommitmentSatisfied('Log breakfast', { mealsToday: 1, stepsToday: 0, weighedToday: false }), true);
  assert.equal(skyMod.isCommitmentSatisfied('Log dinner', { mealsToday: 1, stepsToday: 0, weighedToday: false }), true);
  assert.equal(skyMod.isCommitmentSatisfied('Walk 6,000 steps', { mealsToday: 0, stepsToday: 5999, weighedToday: false }), false);
  assert.equal(skyMod.isCommitmentSatisfied('Walk 6,000 steps', { mealsToday: 0, stepsToday: 6000, weighedToday: false }), true);
  assert.equal(skyMod.isCommitmentSatisfied('Quick weigh-in', { mealsToday: 0, stepsToday: 0, weighedToday: false }), false);
  assert.equal(skyMod.isCommitmentSatisfied('Quick weigh-in', { mealsToday: 0, stepsToday: 0, weighedToday: true }), true);
  assert.equal(skyMod.isCommitmentSatisfied('10-minute reset', { mealsToday: 3, stepsToday: 10000, weighedToday: true }), false);

  assert.equal(skyMod.commitmentActionKind('Log breakfast'), 'camera');
  assert.equal(skyMod.commitmentActionKind('Log next meal cleanly'), 'camera');
  assert.equal(skyMod.commitmentActionKind('Quick weigh-in'), 'weigh');
  assert.equal(skyMod.commitmentActionKind('Walk 6,000 steps'), 'fitness');
  assert.equal(skyMod.commitmentActionKind('Exercise 20 min'), 'fitness');
  assert.equal(skyMod.commitmentActionKind('Catch up with Cupcake'), 'talk');
  assert.equal(skyMod.commitmentActionKind('10-minute reset'), null);

  const suggestions = skyMod.commitmentSuggestions({
    hour: 9, mealsToday: 0, stepsToday: 0, weighedToday: false, missedCallsCount: 1, assistantName: 'Cupcake',
  });
  assert.equal(suggestions.length, 4);
  assert.equal(suggestions[0], 'Catch up with Cupcake');

  // 2. Playwright browser workflows across Dark/Light, Caribbean/Rose, 320/390/1280 + owner isolation
  const health = { ok: true, devices: [], last_received_at: null, last_observed_at: null, metrics: [], coverage_note: 'Synthetic only.' };

  async function openSignedIn(width, appearance, scheme, email = 'a@example.invalid', dataOverride = null) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 900 },
      colorScheme: scheme,
      serviceWorkers: 'block',
    });
    const remote = [];
    const errors = [];
    await context.route('**/*', route =>
      new URL(route.request().url()).origin === base ? route.continue() : (remote.push(route.request().url()), route.abort()),
    );
    if (scheme === 'light') {
      await context.addInitScript(() => localStorage.setItem('cupcake-account-scheme-v1', 'light'));
    }
    if (dataOverride) {
      await context.exposeFunction('syntheticDataOverride', dataOverride);
    }
    await context.exposeFunction('syntheticPersonaServer', async () => ({
      status: 200,
      value: {
        ok: true,
        preferences: { appearance, persona: appearance === 'rose' ? 'matthieu' : 'cupcake', name: appearance === 'rose' ? 'Matthieu' : 'Cupcake' },
        revision: 1, updated: 1, saved: true,
      },
    }));
    await context.exposeFunction('syntheticHealthServer', async () => ({ status: 200, value: health }));
    await context.exposeFunction('syntheticCoachServer', async (_o, route) => ({
      status: 200,
      value: { ok: true, grants: [], relationships: [], coach_enabled: true, invitations_supported: false, invitations: [], limits: { max_clients: 10, max_pending_invitations: 10 }, route },
    }));
    await context.exposeFunction('syntheticInvitationServer', async () => ({ status: 200, value: { ok: true, relationships: [] } }));
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/cupcake/account');
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.locator('.nx-sky-stage').waitFor();
    return { context, page, remote, errors };
  }

  for (const cfg of [
    { width: 320, appearance: 'caribbean', scheme: 'dark' },
    { width: 390, appearance: 'caribbean', scheme: 'light' },
    { width: 1280, appearance: 'rose', scheme: 'dark' },
  ]) {
    const { context, page, remote, errors } = await openSignedIn(cfg.width, cfg.appearance, cfg.scheme, 'a@example.invalid');
    try {
      const stage = page.locator('.nx-sky-stage');
      assert.equal(await stage.getAttribute('data-mood'), 'mist', `${cfg.width} ${cfg.appearance} starts in mist`);
      assert.equal(await page.locator('.nx-sky-orb').count(), 1, 'sky orb renders when mood !== rain');
      assert.equal(await page.locator('.nx-macros').count(), 0, 'empty Today fold hides 0g macros');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow before commit');

      // Open commitment tray and choose first suggestion (meal -> Snap -> quick action)
      await page.getByRole('button', { name: 'Set today’s commitment', exact: true }).click();
      await page.locator('.nx-commit-tray').waitFor();
      await page.locator('.nx-commit-chip').first().click();

      // Mood upgrades immediately mist -> sunbreak + burst renders + quick-action pill renders
      await page.waitForFunction(() => document.querySelector('.nx-sky-stage')?.getAttribute('data-mood') === 'sunbreak');
      await page.locator('.nx-sky-burst').waitFor({ state: 'attached' });
      assert.equal(await page.locator('.nx-sky-burst').count(), 1, 'sunbreak burst triggers on upward mood jump');
      assert.equal(await page.locator('.nx-commit-check').count(), 1);
      assert.equal(await page.locator('.nx-commit-action').count(), 1, 'quick-action button renders for meal commitment');
      assert.equal(await page.locator('.nx-commit-action').innerText(), 'Snap →');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no overflow after commit');

      // Persist across reload
      await page.reload();
      await page.locator('.nx-sky-stage').waitFor();
      assert.equal(await page.locator('.nx-sky-stage').getAttribute('data-mood'), 'sunbreak');

      // Earned sky: marking commitment done with 0 logged pillars stays sunbreak (not radiant)
      await page.locator('.nx-commit-check').click();
      await page.waitForFunction(() => document.querySelector('.nx-commit')?.getAttribute('data-done') === 'true');
      assert.equal(await page.locator('.nx-sky-stage').getAttribute('data-mood'), 'sunbreak', '0 real pillars stays sunbreak');
      assert.equal(await page.locator('.nx-commit-action').count(), 0, 'quick-action button hides when done');

      // Toggle Sky atmosphere in Settings -> Appearance
      await page.locator('.cc-settings > summary').click();
      const appearanceGroup = page.locator('.cc-settings-group').filter({ has: page.locator('summary', { hasText: /^Appearance$/ }) });
      await appearanceGroup.locator(':scope > summary').click();
      const skyGroup = page.getByRole('group', { name: 'Sky atmosphere', exact: true });
      await skyGroup.getByRole('button', { name: 'Static', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-cc-sky')), 'static');
      assert.equal(await stage.getAttribute('data-sky'), 'static');
      assert.equal(await page.locator('.nx-sky-sunbeam').count(), 0);
      assert.equal(await page.locator('.nx-sky-orb').count(), 1, 'static sky keeps subtle static orb');

      // Reload keeps Static; inline Resume switches back to Living
      await page.reload();
      await page.locator('.nx-sky-stage').waitFor();
      assert.equal(await stage.getAttribute('data-sky'), 'static');
      await page.getByRole('button', { name: 'Edit today’s commitment', exact: true }).click();
      await page.getByRole('button', { name: 'Resume sky motion', exact: true }).click();
      assert.equal(await stage.getAttribute('data-sky'), 'living');
      await page.getByRole('button', { name: 'Pause sky motion', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Pause sky motion', exact: true }).getAttribute('aria-pressed'), null);

      assert.deepEqual(remote, []);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }

  // 2b. Dawn & Night washes must differ across all 5 moods (no phase clobber bug)
  {
    const { context, page } = await openSignedIn(390, 'caribbean', 'dark', 'a@example.invalid');
    try {
      for (const phase of ['dawn', 'night']) {
        const backgrounds = await page.evaluate(ph => {
          const stage = document.querySelector('.nx-sky-stage');
          const wash = stage.querySelector('.nx-sky-wash');
          stage.setAttribute('data-phase', ph);
          return ['rain', 'mist', 'sunbreak', 'clear', 'radiant'].map(m => {
            stage.setAttribute('data-mood', m);
            return getComputedStyle(wash).backgroundImage;
          });
        }, phase);
        assert.equal(new Set(backgrounds).size, 5, `${phase} must produce 5 distinct washes across moods`);
      }
    } finally {
      await context.close();
    }
  }

  // 2c. > 24h stale fasting -> '—' + failed weight_list -> retry (never 'No weigh-in yet')
  {
    let failWeight = true;
    let weightCalls = 0;
    const staleMealIso = new Date(Date.now() - 48 * 3600000).toISOString();
    const { context, page, errors } = await openSignedIn(390, 'caribbean', 'dark', 'a@example.invalid', async action => {
      if (action === 'weight_list') {
        weightCalls++;
        if (failWeight) return { status: 503, value: { ok: false, error: 'temporary_unavailable' } };
        return {
          status: 200,
          value: {
            ok: true,
            measurements: [{ id: 'w1', kind: 'measurement', weightLb: 194.2, measuredAt: new Date().toISOString(), source: 'owner-reported-weight', recordId: 'r1', basis: 'owner_reported' }],
            latestMeasurement: { id: 'w1', kind: 'measurement', weightLb: 194.2, measuredAt: new Date().toISOString(), source: 'owner-reported-weight', recordId: 'r1', basis: 'owner_reported' },
            total: 1, nextCursor: null, coverage: {},
          },
        };
      }
      if (action === 'food_history') {
        return {
          status: 200,
          value: {
            ok: true,
            meals: [{ id: 'stale_1', description: 'Old dinner', consumedAt: staleMealIso, source: 'manual-entry', logState: 'logged', countedInTotals: true, total: { calories: 640 } }],
            total: 1, nextCursor: null, pendingCount: 0, undatedLoggedCount: 0,
          },
        };
      }
      return null;
    });
    try {
      // Failed weight_list shows retry, not "No weigh-in yet"
      const weightBtn = page.locator('.nx-weightline');
      await page.waitForFunction(() => document.querySelector('.nx-weightline')?.textContent?.includes("Couldn't load — Retry"));
      assert.equal((await weightBtn.innerText()).includes('No weigh-in yet'), false);
      const beforeRetry = weightCalls;
      failWeight = false;
      await weightBtn.click();
      await page.waitForFunction(() => document.querySelector('.nx-weightline')?.textContent?.includes('194.2'));
      assert.ok(weightCalls > beforeRetry, 'tapping failed weight row retries weight_list');

      // > 24h stale fasting shows '—' and Last logged meal
      const fastingTab = page.getByRole('tab', { name: /Fasting/ });
      assert.match(await fastingTab.innerText(), /—/, 'stale >24h fasting chip shows em-dash');
      await fastingTab.click();
      assert.equal(await page.locator('.nx-md-centre .nx-big').innerText(), '—');
      assert.match(await page.locator('.nx-md-detail').innerText(), /Last logged meal/);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }

  // 2d. Real meal today auto-satisfies meal commitment -> radiant + shows .nx-macros
  {
    const todayMealIso = new Date(Date.now() - 20 * 60000).toISOString();
    const { context, page, errors } = await openSignedIn(390, 'caribbean', 'dark', 'a@example.invalid', async action => {
      if (action === 'food_history') {
        return {
          status: 200,
          value: {
            ok: true,
            meals: [{ id: 'today_1', description: 'Eggs & avocado', consumedAt: todayMealIso, source: 'manual-entry', logState: 'logged', countedInTotals: true, total: { calories: 480, protein_g: 28, carbs_g: 14, fat_g: 32 } }],
            total: 1, nextCursor: null, pendingCount: 0, undatedLoggedCount: 0,
          },
        };
      }
      return null;
    });
    try {
      await page.locator('.nx-macros').waitFor();
      await page.getByRole('button', { name: 'Set today’s commitment', exact: true }).click();
      await page.getByLabel('Custom commitment for today', { exact: true }).fill('Log breakfast');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.nx-sky-stage')?.getAttribute('data-mood') === 'radiant');
      assert.equal(await page.locator('.nx-commit').getAttribute('data-done'), 'true');
      assert.equal(await page.locator('.nx-commit-action').count(), 0);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }

  // 3. Owner isolation (A commitment never leaks to B) + legacy /cupcake stays untouched
  {
    const { context, page } = await openSignedIn(390, 'caribbean', 'dark', 'a@example.invalid');
    try {
      await page.getByRole('button', { name: 'Set today’s commitment', exact: true }).click();
      await page.getByLabel('Custom commitment for today', { exact: true }).fill('Owner A private focus');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('button', { name: /Owner A private focus/ }).waitFor();

      // Switch to owner B via Settings sign-out -> sign in as B
      await page.locator('.cc-settings > summary').click();
      await page.getByRole('button', { name: /Sign out/ }).click();
      const confirmSignOut = page.locator('dialog.nx-confirm button[data-answer="yes"]');
      if (await confirmSignOut.count()) await confirmSignOut.click();
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      await page.getByLabel('Email', { exact: true }).fill('b@example.invalid');
      await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.locator('.nx-sky-stage').waitFor();
      assert.equal(await page.getByText('Owner A private focus').count(), 0);
      assert.equal(await page.locator('.nx-sky-stage').getAttribute('data-mood'), 'mist');
    } finally {
      await context.close();
    }
  }

  // Legacy /cupcake route isolation
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
      await page.goto(base + '/cupcake');
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.nx-sky-stage').count(), 0);
    } finally {
      await context.close();
    }
  }

  console.log('PASS living-sky: 5 phases, 5 moods, commitment burst, Settings Living/Static, owner isolation, 320/390/1280 Dark/Light, legacy untouched.');
} finally {
  await browser.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
