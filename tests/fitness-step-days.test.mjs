// Exercise the actual Today → Fitness journey with a local, synthetic account.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-step-days-'));
const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'synthetic-step-history', configureServer(s) {
    s.middlewares.use((req, _res, next) => {
      if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html';
      next();
    });
  } }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(10000);
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.clock.setFixedTime(new Date('2026-03-18T16:00:00Z'));
  await page.goto(base + '/cupcake/account?tab=feed');
  await page.getByLabel('Email', { exact: true }).fill('a@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
  await page.evaluate(() => {
    const fallback = window.fetch;
    let empty = false;
    window.clearSyntheticStepReadings = () => { empty = true; };
    window.fetch = (input, init) => {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      if (body.action !== 'steps_list') return fallback(input, init);
      return Promise.resolve(Response.json({ ok: true, identity: {
        account_id: 'acc_synthetic_a', email: 'a@example.invalid', name: 'Synthetic A',
      }, averageSource: 'galaxy_a55', entries: empty ? [] : [
        { date: '2026-03-18', count: 8000, source: 'galaxy_a55', windowBasis: 'calendar_day' },
        { date: '2026-03-17', count: 7999, source: 'health_connect', windowBasis: 'trailing_24h_previous_day',
          windowStart: '2026-03-17T12:00:00Z', windowEnd: '2026-03-18T12:00:00Z' },
        { date: '2026-03-15', count: 0, source: 'galaxy_a55', windowBasis: 'calendar_day', windowStart: '2026-03-15T05:00:00Z', windowEnd: '2026-03-16T05:00:00Z' },
        { date: '2026-03-14', count: 1900, source: 'galaxy_a55', windowBasis: 'calendar_day', windowStart: '2026-03-14T05:00:00Z', windowEnd: '2026-03-15T04:45:00Z' },
        { date: '2026-03-12', count: 8000, source: 'native_health:com.ringconn' },
        { date: '2026-03-08', count: 3200, source: 'galaxy_a55', windowBasis: 'calendar_day', windowStart: '2026-03-08T06:00:00Z', windowEnd: '2026-03-09T05:00:00Z' },
        { date: '2026-02-16', count: 2201, source: 'apple_health', windowBasis: 'calendar_day' },
        { date: '2026-02-15', count: 4800, source: 'health_connect', windowBasis: 'calendar_day' },
      ].filter(day => day.date >= body.start && day.date <= body.end) }));
    };
  });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const tile = page.getByRole('button', { name: /Steps today 8,000, Goal reached/ });
  await tile.click();
  const card = page.getByRole('article', { name: 'Steps', exact: true });
  await card.getByText('8,000 goal reached', { exact: true }).waitFor();
  assert.match(await card.getByRole('group', { name: /last seven days/ }).getByRole('button', { pressed: true }).textContent(), /^Today18$/);
  const days = card.getByRole('group', { name: /last seven days/ }).getByRole('button');
  assert.equal(await days.count(), 7);
  const yesterday = card.getByRole('button', { name: /Tue, Mar 17, 7,999 steps/ });
  await yesterday.focus();
  await yesterday.press('Enter');
  assert.equal(await card.locator('.nx-steps-big').innerText(), '7,999');
  assert.match(await card.textContent(), /8,000 goal \(99%\)/);
  assert.match(await card.textContent(), /Rolling 24 hours.*7:00 AM.*7:00 AM CT/);
  assert.equal(await card.getAttribute('data-goal-met'), 'false');
  await card.getByRole('button', { name: /Mon, Mar 16, no reading/ }).click();
  await card.getByText('No step reading for Mon, Mar 16.').waitFor();
  assert.equal(await card.getByRole('progressbar').count(), 0);
  await card.getByRole('button', { name: /Sun, Mar 15, 0 steps/ }).click();
  assert.equal(await card.locator('.nx-steps-big').innerText(), '0');
  assert.equal(await card.getByRole('progressbar').getAttribute('aria-valuenow'), '0');
  await card.getByRole('button', { name: /Today, 8,000 steps, goal reached/ }).click();
  assert.match(await card.textContent(), /Galaxy A55/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const history = card.locator('details.nx-step-history');
  const toggle = history.locator('summary');
  assert.match(await toggle.innerText(), /0 avg · 1 of 7 days/);
  await toggle.click();
  await history.getByText('1 of 7 complete phone days · Through yesterday').waitFor();
  assert.equal(await history.getByRole('listitem').count(), 4);
  assert.match(await history.innerText(), /Only midnight-to-midnight A55 readings/);
  // Midnight Chicago boundaries, including the oldest completed day. Today's live 8,000 is excluded.
  await history.getByRole('button', { name: '30 days', exact: true }).click();
  await history.getByText('2 of 30 complete phone days · Through yesterday').waitFor();
  assert.equal(await history.locator('.nx-step-history-stat strong').innerText(), '1,600 steps');
  assert.equal(await history.getByRole('listitem').count(), 6);
  await history.getByRole('button', { name: /View Mon, Feb 16/ }).click();
  const heading = card.getByRole('heading', { name: 'Steps · Mon, Feb 16' });
  await heading.waitFor();
  assert.equal(await heading.evaluate(el => el === document.activeElement), true);
  await card.getByText('Apple Health', { exact: true }).waitFor();
  await days.getByText('Today', { exact: true }).click();
  await card.getByRole('heading', { name: 'Steps today' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await history.getByRole('button', { name: 'Earlier days' }).click();
  await history.getByRole('button', { name: /View Sun, Feb 15/ }).click();
  await card.getByRole('heading', { name: 'Steps · Sun, Feb 15' }).waitFor();
  assert.equal(await card.locator('.nx-steps-big').innerText(), '4,800');
  assert.equal(await history.locator('.nx-step-history-stat strong').innerText(), '1,600 steps');
  await history.getByRole('button', { name: 'Earlier days' }).click();
  await history.getByText('No step readings in this period.').waitFor();
  await history.getByRole('button', { name: 'Newer days' }).click();
  await history.getByRole('button', { name: /View Sun, Feb 15/ }).waitFor();
  await history.getByRole('button', { name: 'Newer days' }).click();
  await page.evaluate(() => window.clearSyntheticStepReadings());
  await card.getByRole('button', { name: 'Refresh steps' }).click();
  await history.getByText('0 of 30 complete phone days · Through yesterday').waitFor();
  assert.equal(await history.locator('.nx-step-history-stat strong').innerText(), '—');
  assert.equal(await history.getByRole('listitem').count(), 0);
  console.log('Passed: mobile step goals, dated drill-down, 7/30-day logged averages, sparse/zero/absent data, rolling sources and 30-day boundary.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
