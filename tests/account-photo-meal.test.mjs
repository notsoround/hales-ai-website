import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-photo-meal-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-photo-account', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-photo-meal-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.route('**/*', route => new URL(route.request().url()).origin === base || route.request().url().startsWith('data:') ? route.continue() : route.abort());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/cupcake/account'); await page.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button')?.disabled);
  return { page, context, errors };
}
const mode = (page, value) => page.evaluate(value => { window.photoFixture.mode = value; }, value);
const uploads = page => page.evaluate(() => window.photoFixture.requests.filter(row => row.route.endsWith('/food/photo/analyze')));
async function choose(page) { const data = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; const context = canvas.getContext('2d'); context.fillStyle = '#4db6ac'; context.fillRect(0, 0, 16, 16); return canvas.toDataURL('image/png').split(',')[1]; }); await page.getByLabel('Choose meal photo file').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }); }
async function saved(page) { await page.getByRole('heading', { name: 'Meal saved to your food log', exact: true }).waitFor(); }
try {
  const normal = await open(), page = normal.page;
  await page.getByText('Portions, meal time & how it works', { exact: true }).click();
  await page.getByLabel('Portion or meal note (optional)').fill('Half the rice');
  await mode(page, 'holdGet'); await choose(page);
  await page.waitForFunction(() => window.photoFixture.requests.some(row => row.body.action === 'food_get'));
  assert.equal(await page.getByRole('heading', { name: 'Meal saved to your food log', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.photoFixture.savedCallbacks), 0);
  await page.evaluate(() => window.photoFixture.release()); await saved(page);
  const first = (await uploads(page))[0].body;
  assert.equal(first.confirm_consumed, true); assert.equal(first.estimate_visible_portion, true); assert.equal(first.note, 'Half the rice');
  assert.equal(first.photo_time_basis, 'file_last_modified'); assert.equal(first.consumed_at, first.photo_taken_at);
  assert.equal(await page.evaluate(() => window.photoFixture.persistedBeforeUpload), true);
  assert.equal((await page.evaluate(() => window.photoFixture.drafts())).length, 0);
  await page.getByText('Calories unknown', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1280, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(normal.errors, []); await normal.context.close();
  console.log('PASS: auto full-portion logging, immutable durable request before upload, true file-time basis, note, readback-before-success and unknown nutrition at phone/desktop widths');

  for (const failure of ['lost', 'beforeUpload']) {
    const test = await open(), p = test.page; await mode(p, failure); await choose(p); await p.getByRole('alert').waitFor();
    const original = (await uploads(p))[0].body;
    await p.reload();
    if (failure === 'beforeUpload') { await p.getByRole('button', { name: 'Retry same upload', exact: true }).click(); }
    await saved(p);
    const requests = await uploads(p); // Reload clears mock history, but IndexedDB retains immutable intent.
    if (failure === 'beforeUpload') { assert.deepEqual(requests[0].body, original); }
    else assert.equal(requests.length, 0);
    assert.deepEqual(test.errors, []); await test.context.close();
  }
  console.log('PASS: reload polls first; lost accepted upload is not resubmitted; absent request retries the exact durable payload');

  const uncertain = await open(), u = uncertain.page; await mode(u, 'uncertain'); await choose(u);
  await u.getByText('The estimate outcome is uncertain.', { exact: false }).waitFor();
  await u.getByRole('button', { name: 'Check saved photo', exact: true }).click();
  assert.equal((await uploads(u)).length, 1); assert.equal(await u.getByRole('button', { name: 'Retry unsent estimate', exact: true }).count(), 0);
  await u.evaluate(() => window.photoFixture.switchOwner('B'));
  await u.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor();
  assert.equal(await u.getByAltText('Selected meal photo').count(), 0);
  assert.equal((await u.evaluate(() => window.photoFixture.drafts())).length, 0);
  await u.evaluate(() => window.photoFixture.switchOwner('A'));
  await u.getByText('The estimate outcome is uncertain.', { exact: false }).waitFor();
  assert.equal((await uploads(u)).length, 1); assert.deepEqual(uncertain.errors, []); await uncertain.context.close();
  console.log('PASS: uncertain attempts are poll-only and account switches isolate local originals and recovery');

  const retry = await open(), r = retry.page; await mode(r, 'failed'); await choose(r);
  await r.getByRole('button', { name: 'Retry unsent estimate', exact: true }).click(); await saved(r);
  assert.equal((await uploads(r)).length, 1);
  const state = await r.evaluate(() => window.photoFixture.requests);
  assert.equal(state.find(row => row.body.action === 'food_photo_retry').body.request_id, state.find(row => row.route.endsWith('/food/photo/analyze')).body.request_id);
  assert.deepEqual(retry.errors, []); await retry.context.close();
  console.log('PASS: explicit retry uses the same existing request and never uploads a fresh paid intent');

  const wrong = await open(), w = wrong.page; await mode(w, 'wrongReceipt'); await choose(w); await w.getByRole('alert').waitFor();
  assert.equal(await w.getByRole('heading', { name: 'Meal saved to your food log', exact: true }).count(), 0);
  assert.equal(await w.evaluate(() => window.photoFixture.savedCallbacks), 0);
  await w.getByRole('button', { name: 'Check saved photo', exact: true }).click(); await saved(w);
  assert.equal((await uploads(w)).length, 1); assert.deepEqual(wrong.errors, []); await wrong.context.close();

  const late = await open(), l = late.page; await mode(l, 'holdUpload'); await choose(l);
  await l.waitForFunction(() => window.photoFixture.requests.some(row => row.route.endsWith('/food/photo/analyze')));
  await l.evaluate(() => window.photoFixture.switchOwner('B'));
  await l.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor();
  await l.evaluate(() => window.photoFixture.release());
  assert.equal(await l.getByAltText('Selected meal photo').count(), 0);
  assert.equal(await l.evaluate(() => window.photoFixture.savedCallbacks), 0);
  await l.evaluate(() => window.photoFixture.switchOwner('A')); await saved(l);
  assert.equal((await uploads(l)).length, 1); assert.deepEqual(late.errors, []); await late.context.close();
  console.log('PASS: mismatched receipts never confirm a meal; late upload responses are discarded after an account switch');

  const background = await open(), b = background.page; await choose(b);
  await b.getByRole('button', { name: 'Keep this request and log another photo', exact: true }).click();
  await b.waitForFunction(() => window.photoFixture.savedCallbacks === 1);
  assert.equal((await b.evaluate(() => window.photoFixture.drafts())).length, 0);
  assert.equal((await uploads(b)).length, 1);
  assert.equal(await b.getByRole('heading', { name: 'Meal saved to your food log', exact: true }).count(), 0);
  assert.deepEqual(background.errors, []); await background.context.close();
  console.log('PASS: starting the next photo does not strand earlier completed saves or trigger another estimate');


} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
