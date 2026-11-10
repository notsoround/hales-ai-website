// Portion chips in Meal details (account app), synthetic meals only: the chips reach the server
// through the account client's action list, rescale one meal, restore it with Full, and stay
// visible but disabled with a reason when the server does not describe the meal's portion.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-meal-portion-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-photo-account', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-photo-meal-preview.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''); next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const shots = process.env.SHOTS;
async function open(query, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.route('**/*', route => new URL(route.request().url()).origin === base || route.request().url().startsWith('data:') ? route.continue() : route.abort());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/cupcake/account?layout&${query}`);
  const dialog = page.getByRole('dialog', { name: 'Meal details' });
  await dialog.getByRole('group', { name: 'Portion you ate' }).waitFor();
  return { page, context, errors, dialog };
}
const calories = dialog => dialog.locator('.cc-meal-macros > div').first().locator('strong').textContent();
try {
  {
    const { page, context, errors, dialog } = await open('status=logged&portion=served');
    for (const name of ['A quarter', 'Half', 'Three quarters', 'The full plate']) assert.equal(await dialog.getByRole('button', { name }).isEnabled(), true, name);
    assert.equal(await dialog.getByRole('button', { name: 'The full plate' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await calories(dialog), '800 kcal');
    await dialog.getByRole('button', { name: 'Half' }).click();
    await dialog.getByText('Original estimate: 800 kcal').waitFor();
    assert.equal(await calories(dialog), '400 kcal');
    assert.equal(await dialog.getByRole('button', { name: 'Half' }).getAttribute('aria-pressed'), 'true');
    if (shots) await page.screenshot({ path: `${shots}/portion-half-390.png` });
    const sent = await page.evaluate(() => window.photoFixture.requests.filter(row => row.body.action === 'food_portion_set').map(row => row.body));
    assert.deepEqual(sent, [{ action: 'food_portion_set', mealId: 'meal_synthetic_label', fraction: 0.5 }]);
    await dialog.getByRole('button', { name: 'The full plate' }).click();
    await dialog.getByText('Original estimate: 800 kcal').waitFor({ state: 'detached' });
    assert.equal(await calories(dialog), '800 kcal');
    assert.equal(await dialog.locator('[role=alert]').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: Half reaches food_portion_set, halves the one meal and shows the original; Full restores it exactly');
  }
  for (const [query, note] of [['status=logged', 'Portion changes aren’t available for this meal yet.'], ['status=legacy', 'This older meal lives in the original app’s food log'], ['status=unlogged', 'Log this meal first']]) {
    const { page, context, errors, dialog } = await open(query);
    const group = dialog.getByRole('group', { name: 'Portion you ate' });
    for (const name of ['A quarter', 'Half', 'Three quarters', 'The full plate']) assert.equal(await group.getByRole('button', { name }).isDisabled(), true, `${query} ${name}`);
    await group.getByText(note).waitFor();
    assert.equal(await group.getAttribute('aria-describedby'), 'cc-portion-note');
    if (shots && query === 'status=legacy') await page.screenshot({ path: `${shots}/portion-disabled-390.png` });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: meals the server does not describe show the chips disabled with a short reason');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
