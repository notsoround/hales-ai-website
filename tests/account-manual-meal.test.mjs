import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-manual-meal-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-manual-meal', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-manual-meal-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/cupcake/account'); await page.getByRole('button', { name: 'Add meal', exact: true }).waitFor();
  return { page, context, errors };
}
const dialog = page => page.getByRole('dialog', { name: 'Log a meal manually', exact: true });
async function draft(page, description, nutrients = {}) {
  await page.getByRole('button', { name: 'Add meal', exact: true }).click();
  const form = dialog(page);
  await form.getByLabel('What did you eat?').fill(description);
  assert.equal(await form.getByRole('button', { name: 'Save meal', exact: true }).isDisabled(), true);
  await form.getByRole('button', { name: 'Ate just now', exact: true }).click();
  for (const [label, value] of Object.entries(nutrients)) await form.getByLabel(label, { exact: true }).fill(String(value));
  await form.getByRole('checkbox', { name: 'I ate this meal at the time shown above.' }).check();
  assert.equal(await form.evaluate(element => element.scrollWidth <= element.clientWidth && element.getBoundingClientRect().width <= innerWidth), true);
  assert.ok(await form.getByLabel('What did you eat?').evaluate(element => parseFloat(getComputedStyle(element).fontSize)) >= 16);
  return form;
}
const requests = page => page.evaluate(() => window.manualFixture.requests.filter(row => row.body.action === 'food_manual_log'));
const mode = (page, value) => page.evaluate(value => { window.manualFixture.mode = value; }, value);
async function saved(page) { await dialog(page).getByRole('heading', { name: 'Meal saved to your food log', exact: true }).waitFor(); }
try {
  const partial = await open(), page = partial.page;
  let form = await draft(page, 'Synthetic partial meal', { 'Calories (kcal)': 300 });
  await mode(page, 'holdGet'); await form.getByRole('button', { name: 'Save meal', exact: true }).click();
  await page.waitForFunction(() => window.manualFixture.requests.some(row => row.body.action === 'food_get'));
  assert.equal(await form.getByRole('heading', { name: 'Meal saved to your food log' }).count(), 0);
  assert.equal(await page.locator('.cc-nutrition-timeline-item').count(), 0);
  await page.evaluate(() => window.manualFixture.release()); await saved(page);
  const first = (await requests(page))[0].body;
  assert.deepEqual(first.total, { calories: 300 }); assert.equal(first.source, 'manual-entry'); assert.equal(first.confirmConsumed, true);
  assert.match(first.dedupeKey, /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
  assert.match(first.consumedAt, /Z$/);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Add meal', exact: true }).evaluate(button => document.activeElement === button), true);
  await page.locator('.cc-nutrition-timeline-item button').filter({ hasText: 'Synthetic partial meal' }).click();
  const details = page.getByRole('dialog', { name: 'Meal details', exact: true });
  await details.getByText('Manually entered meal · no photo.', { exact: false }).waitFor();
  assert.equal(await details.getByText('Unknown', { exact: true }).count(), 5);
  assert.equal(await details.getByText('300 kcal', { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => window.manualFixture.requests.some(row => row.body.action === 'food_photo')), false);
  assert.equal(await page.locator('.cc-nutrition-overview').getByText(/deficit/i).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add meal', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Add another meal', exact: true }).click();
  // A new meal requires a new time and fresh explicit confirmation, including zero.
  form = dialog(page); await form.getByLabel('What did you eat?').fill('Synthetic full meal');
  await form.getByRole('button', { name: 'Ate just now', exact: true }).click();
  for (const [label, value] of Object.entries({ 'Calories (kcal)': 500, 'Protein (g)': 20, 'Total carbs (g)': 60, 'Fat (g)': 15, 'Fiber (g)': 6, 'Sugar (g)': 0 })) await form.getByLabel(label, { exact: true }).fill(String(value));
  await form.getByRole('checkbox').check(); await form.getByRole('button', { name: 'Save meal', exact: true }).click(); await saved(page);
  const second = (await requests(page))[1].body;
  assert.deepEqual(second.total, { calories: 500, protein_g: 20, carbs_g: 60, fat_g: 15, fiber_g: 6, sugar_g: 0 }); assert.notEqual(second.dedupeKey, first.dedupeKey);
  await page.keyboard.press('Escape'); await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('.cc-nutrition-timeline-item button').filter({ hasText: 'Synthetic full meal' }).click();
  await details.getByText('0 g', { exact: true }).waitFor(); assert.equal(await details.getByText('Unknown', { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(partial.errors, []); await partial.context.close();
  console.log('PASS: partial/full/explicit-zero payloads, confirmed readback before receipt/history, unknown nutrition, no photo request, mobile/desktop dialog and keyboard close');

  for (const failure of ['lost', 'readbackFail', 'conflict']) {
    const test = await open(), p = test.page;
    const f = await draft(p, 'Synthetic ' + failure, {}); await mode(p, failure);
    await f.getByRole('button', { name: 'Save meal', exact: true }).click(); await f.getByRole('alert').waitFor();
    assert.equal(await f.getByRole('heading', { name: 'Meal saved to your food log' }).count(), 0);
    assert.equal(await f.getByLabel('What did you eat?').isDisabled(), true);
    const original = (await requests(p))[0];
    // Closing and leaving Food retains the immutable account-scoped retry.
    await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Leave Food preview', exact: true }).click(); await p.getByRole('button', { name: 'Return to Food preview', exact: true }).click();
    await p.getByRole('button', { name: 'Resume meal save', exact: true }).click();
    await dialog(p).getByRole('button', { name: 'Retry same meal', exact: true }).click(); await saved(p);
    assert.deepEqual((await requests(p))[1], original);
    assert.equal(await p.evaluate(() => window.manualFixture.requests.filter(row => row.body.action === 'food_get').length), failure === 'readbackFail' ? 2 : 1);
    assert.deepEqual(test.errors, []); await test.context.close();
  }
  console.log('PASS: lost write response, failed readback and matchesRequest conflict never show optimistic success; exact retry survives closing/navigation');

  const reload = await open(), r = reload.page;
  form = await draft(r, 'Synthetic unknown nutrition after reload'); await mode(r, 'lost');
  await form.getByRole('button', { name: 'Save meal', exact: true }).click(); await form.getByRole('alert').waitFor();
  const beforeReload = (await requests(r))[0]; await r.reload();
  await r.getByRole('button', { name: 'Resume meal save', exact: true }).click();
  await dialog(r).getByRole('button', { name: 'Retry same meal', exact: true }).click(); await saved(r);
  assert.deepEqual((await requests(r))[0], beforeReload); assert.deepEqual(beforeReload.body.total, {});
  await r.keyboard.press('Escape');
  await r.locator('.cc-nutrition-timeline-item button').filter({ hasText: 'Synthetic unknown nutrition after reload' }).click();
  await r.getByRole('dialog', { name: 'Meal details', exact: true }).getByRole('heading', { name: 'Synthetic unknown nutrition after reload' }).waitFor();
  assert.equal(await r.getByRole('dialog', { name: 'Meal details', exact: true }).getByText('Unknown', { exact: true }).count(), 6);
  assert.equal(await r.locator('.cc-nutrition-overview').getByText(/deficit/i).count(), 0);
  assert.deepEqual(reload.errors, []); await reload.context.close();
  console.log('PASS: uncertain exact intent survives reload; all blank nutrients stay unknown with no invented deficit');

  const isolation = await open(), p = isolation.page;
  form = await draft(p, 'Synthetic owner A uncertain meal', { 'Protein (g)': 12 }); await mode(p, 'lost');
  await form.getByRole('button', { name: 'Save meal', exact: true }).click(); await form.getByRole('alert').waitFor();
  const originalA = (await requests(p))[0].body;
  await p.evaluate(() => window.manualFixture.switchOwner('B'));
  await p.getByRole('button', { name: 'Add meal', exact: true }).waitFor();
  assert.equal(await p.getByText('Synthetic owner A uncertain meal', { exact: true }).count(), 0);
  assert.equal(await p.getByRole('button', { name: 'Resume meal save', exact: true }).count(), 0);
  form = await draft(p, 'Synthetic owner B meal');
  await mode(p, 'holdWrite'); await form.getByRole('button', { name: 'Save meal', exact: true }).click();
  await p.waitForFunction(() => window.manualFixture.requests.some(row => row.owner === 'B' && row.body.action === 'food_manual_log'));
  await p.evaluate(() => window.manualFixture.switchOwner('A')); await p.evaluate(() => window.manualFixture.release());
  await p.getByRole('button', { name: 'Resume meal save', exact: true }).click();
  assert.equal(await dialog(p).getByLabel('What did you eat?').inputValue(), 'Synthetic owner A uncertain meal');
  assert.equal(await dialog(p).getByText('Synthetic owner B meal', { exact: true }).count(), 0);
  await dialog(p).getByRole('button', { name: 'Edit as a new meal', exact: true }).click();
  assert.equal(await dialog(p).getByRole('checkbox').isChecked(), false);
  await dialog(p).getByLabel('What did you eat?').fill('Synthetic owner A deliberate new meal');
  await dialog(p).getByRole('checkbox').check(); await dialog(p).getByRole('button', { name: 'Save meal', exact: true }).click(); await saved(p);
  const aRequests = (await requests(p)).filter(row => row.owner === 'A'); assert.notEqual(aRequests[1].body.dedupeKey, originalA.dedupeKey);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.cc-nutrition-timeline-item').filter({ hasText: 'Synthetic owner B meal' }).count(), 0);
  assert.deepEqual(await p.evaluate(() => window.manualFixture.blocked), []); assert.deepEqual(isolation.errors, []); await isolation.context.close();
  console.log('PASS: owner-specific pending recovery/history, late owner B response discarded, and explicit edited intent gets fresh confirmation/UUID');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
