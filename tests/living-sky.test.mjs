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
      configureServer(srv) {
        srv.middlewares.use((req, _res, next) => {
          const route = req.url?.split('?')[0];
          if (route === '/cupcake/account' || route === '/cupcake/account/') req.url = '/tests/account-browser-preview.html';
          if (route === '/cupcake' || route === '/cupcake/') req.url = '/tests/assistant-integration-preview.html';
          next();
        });
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

  const radiantState = skyMod.resolveLivingSky({
    hour: 22, mealsToday: 0, stepsToday: 0, weighedToday: false,
    missedCallsCount: 0, hasCommitment: true, commitmentDone: true, caloriesLeft: null, persona: 'cupcake',
  });
  assert.equal(radiantState.mood, 'radiant');
  assert.equal(radiantState.tier, 4);
  assert.equal(radiantState.label, 'Calm night glow');

  const suggestions = skyMod.commitmentSuggestions({
    hour: 9, mealsToday: 0, stepsToday: 0, weighedToday: false, missedCallsCount: 1, assistantName: 'Cupcake',
  });
  assert.equal(suggestions.length, 4);
  assert.equal(suggestions[0], 'Catch up with Cupcake');

  // 2. Playwright browser workflows across Dark/Light, Caribbean/Rose, 320/390/1280 + owner isolation
  const health = { ok: true, devices: [], last_received_at: null, last_observed_at: null, metrics: [], coverage_note: 'Synthetic only.' };

  async function openSignedIn(width, appearance, scheme, email = 'a@example.invalid') {
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
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow before commit');

      // Open commitment tray and choose first suggestion
      await page.getByRole('button', { name: 'Set today’s commitment', exact: true }).click();
      await page.locator('.nx-commit-tray').waitFor();
      await page.locator('.nx-commit-chip').first().click();

      // Mood upgrades immediately mist -> sunbreak + burst renders
      await page.waitForFunction(() => document.querySelector('.nx-sky-stage')?.getAttribute('data-mood') === 'sunbreak');
      assert.equal(await page.locator('.nx-sky-burst').count(), 1, 'sunbreak burst triggers on upward mood jump');
      assert.equal(await page.locator('.nx-commit-check').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no overflow after commit');

      // Persist across reload
      await page.reload();
      await page.locator('.nx-sky-stage').waitFor();
      assert.equal(await page.locator('.nx-sky-stage').getAttribute('data-mood'), 'sunbreak');

      // Mark commitment done -> immediate shift to radiant
      await page.locator('.nx-commit-check').click();
      await page.waitForFunction(() => document.querySelector('.nx-sky-stage')?.getAttribute('data-mood') === 'radiant');
      assert.equal(await page.locator('.nx-commit').getAttribute('data-done'), 'true');

      // Toggle Sky atmosphere in Settings -> Appearance
      await page.locator('.cc-settings > summary').click();
      const appearanceGroup = page.locator('.cc-settings-group').filter({ has: page.locator('summary', { hasText: /^Appearance$/ }) });
      await appearanceGroup.locator(':scope > summary').click();
      const skyGroup = page.getByRole('group', { name: 'Sky atmosphere', exact: true });
      await skyGroup.getByRole('button', { name: 'Static', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-cc-sky')), 'static');
      assert.equal(await stage.getAttribute('data-sky'), 'static');
      assert.equal(await page.locator('.nx-sky-sunbeam').count(), 0);

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
