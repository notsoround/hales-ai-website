import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-media-capabilities-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-media-root', configureServer(server) { server.middlewares.use((req, _res, next) => { if (['/cupcake/account', '/cupcake'].includes(req.url?.split('?')[0])) req.url = '/tests/account-media-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const unsupported = new Set(['food_analyze', 'food_refine', 'food_retry', 'food_log', 'receipt_extract', 'receipt_retry', 'receipt_match_candidates']);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=', 'base64');
async function open(entry) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + entry); await page.getByRole('heading', { name: 'Food', exact: true }).waitFor();
  return { context, page };
}
async function snapshot(page) { return page.evaluate(() => ({ requests: window.mediaFixture.requests, blocked: window.mediaFixture.blocked, mediaRequests: window.mediaFixture.mediaRequests, inputClicks: window.mediaFixture.inputClicks })); }
try {
  const { context, page } = await open('/cupcake/account');
  await page.getByText('Food photo analysis unavailable', { exact: true }).waitFor();
  assert.equal(await page.locator('input[type=file]').count(), 0);
  assert.equal(await page.getByRole('button', { name: /Take photo|Choose existing photo|Add food photo/ }).count(), 0);
  await page.locator('.cc-nutrition-timeline-item button').filter({ hasText: 'Synthetic saved lunch' }).click();
  const saved = page.getByRole('dialog');
  await saved.getByRole('heading', { name: 'Synthetic saved lunch' }).waitFor();
  await saved.getByAltText('Saved photo: Synthetic saved lunch').waitFor();
  assert.equal(await saved.getByAltText('Saved photo: Synthetic saved lunch').evaluate(image => image.complete && image.naturalWidth > 0), true);
  await page.keyboard.press('Escape');
  for (const description of ['Synthetic pending lunch', 'Synthetic failed photo']) {
    await page.locator('.cc-snap-recent-item').filter({ hasText: description }).first().click();
    await page.getByText('This saved photo is not in your calorie totals.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Retry analysis|Apply correction|Add to food log/ }).count(), 0);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Receipts preview', exact: true }).click();
  await page.getByText('Receipt capture and bank search unavailable', { exact: true }).waitFor();
  assert.equal(await page.locator('input[type=file]').count(), 0);
  await page.getByRole('button').filter({ hasText: 'Synthetic unmatched receipt' }).click();
  await page.getByRole('button', { name: 'View saved receipt photo', exact: true }).click();
  await page.getByAltText('Saved receipt from Synthetic unmatched receipt').waitFor();
  assert.equal(await page.getByRole('button', { name: /Find transaction matches|Refresh bank search/ }).count(), 0);
  await page.getByRole('button').filter({ hasText: 'Synthetic failed receipt' }).click();
  assert.equal(await page.getByRole('button', { name: 'Retry saved receipt', exact: true }).count(), 0);
  await page.getByRole('button').filter({ hasText: 'Synthetic matched receipt' }).click();
  await page.getByText('Matched to the transaction you confirmed.', { exact: true }).waitFor();
  // Preserve the existing supported confirmation transport; no live bank search or record write.
  await page.evaluate(async () => window.mediaFixture.request({ action: 'receipt_confirm_match', receiptId: 'receipt_' + 'a'.repeat(32), transactionId: 'synthetic-saved-candidate', acknowledgeDifferences: true }));
  const account = await snapshot(page);
  assert.deepEqual(account.blocked, []); assert.equal(account.mediaRequests, 0); assert.equal(account.inputClicks, 0);
  assert.equal(account.requests.some(request => unsupported.has(request.action)), false);
  assert.ok(account.requests.some(request => request.action === 'food_photo'));
  assert.ok(account.requests.some(request => request.action === 'receipt_get' && request.includeImage));
  assert.ok(account.requests.some(request => request.action === 'receipt_confirm_match'));
  await context.close();
  console.log('PASS: account Food/Receipts show limits before capture; saved meals/photos/receipts and confirmation transport remain available');

  const legacy = await open('/cupcake');
  await legacy.page.getByText('Log a food photo', { exact: true }).click();
  assert.equal(await legacy.page.getByRole('button', { name: 'Take photo', exact: true }).isEnabled(), true);
  assert.equal(await legacy.page.getByRole('button', { name: 'Choose existing photo', exact: true }).isEnabled(), true);
  await legacy.page.locator('input[type=file]').last().setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  await legacy.page.waitForFunction(() => window.mediaFixture.requests.some(request => request.action === 'food_analyze'));
  await legacy.page.keyboard.press('Escape');
  await legacy.page.getByRole('button', { name: 'Receipts preview', exact: true }).click();
  assert.equal(await legacy.page.getByLabel('Choose image', { exact: true }).isEnabled(), true);
  assert.equal(await legacy.page.getByLabel('Take photo', { exact: true }).isEnabled(), true);
  await legacy.page.getByRole('button').filter({ hasText: 'Synthetic failed receipt' }).click();
  assert.equal(await legacy.page.getByRole('button', { name: 'Retry saved receipt', exact: true }).isEnabled(), true);
  await legacy.page.getByRole('button').filter({ hasText: 'Synthetic unmatched receipt' }).click();
  await legacy.page.getByRole('button', { name: 'Find transaction matches', exact: true }).click();
  await legacy.page.getByRole('radio').check();
  await legacy.page.getByRole('button', { name: 'Confirm selected match', exact: true }).click();
  await legacy.page.getByText('Matched to the transaction you confirmed.', { exact: true }).waitFor();
  const legacyState = await snapshot(legacy.page); assert.deepEqual(legacyState.blocked, []);
  assert.ok(legacyState.requests.some(request => request.action === 'food_analyze'));
  assert.ok(legacyState.requests.some(request => request.action === 'receipt_match_candidates'));
  assert.ok(legacyState.requests.some(request => request.action === 'receipt_confirm_match'));
  await legacy.context.close();
  console.log('PASS: legacy photo analysis, receipt capture controls, extraction retry and match confirmation remain enabled with synthetic transport only');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
