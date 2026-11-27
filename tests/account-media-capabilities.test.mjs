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
const unsupported = new Set(['food_analyze', 'food_refine', 'food_retry', 'food_log', 'receipt_extract', 'receipt_retry']);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=', 'base64');
async function open(entry) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('dialog', dialog => dialog.accept());void page.addLocatorHandler(page.locator('dialog.nx-confirm'),async()=>{await page.locator('dialog.nx-confirm [data-answer=yes]').click();});
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + entry); await page.getByRole('heading', { name: 'Food', exact: true }).waitFor();
  return { context, page };
}
async function snapshot(page) { return page.evaluate(() => ({ requests: window.mediaFixture.requests, blocked: window.mediaFixture.blocked, mediaRequests: window.mediaFixture.mediaRequests, inputClicks: window.mediaFixture.inputClicks, photoUploads: window.mediaFixture.photoUploads })); }
try {
  const { context, page } = await open('/cupcake/account');
  await page.getByRole('heading', { name: 'Log a food photo', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Choose meal photo file', { exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Choose meal photo', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^(Take photo|Choose existing photo|Add food photo)$/ }).count(), 0);
  const initial = await snapshot(page);
  assert.equal(initial.mediaRequests, 0); assert.equal(initial.inputClicks, 0); assert.deepEqual(initial.photoUploads, []);
  await page.locator('.cc-nutrition-timeline-item button').filter({ hasText: 'Synthetic saved lunch' }).click();
  const saved = page.getByRole('dialog');
  await saved.getByRole('heading', { name: 'Synthetic saved lunch' }).waitFor();
  await saved.getByAltText('Saved photo: Synthetic saved lunch').waitFor();
  await page.waitForFunction(() => { const image = document.querySelector('img[alt="Saved photo: Synthetic saved lunch"]'); return image?.complete && image.naturalWidth > 0; });
  await page.keyboard.press('Escape');
  const hero = page.getByRole('region', { name: 'Food summary' });
  const foodCapture = page.getByRole('region', { name: 'Photo meal logging' });
  assert.ok((await hero.boundingBox()).y < (await foodCapture.boundingBox()).y, 'Food opens with the daily summary above capture');
  await page.getByRole('button', { name: 'View meals', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('cc-nutrition-timeline'));
  const review = page.getByText('Photos to check', { exact: true });
  await review.click();
  for (const description of ['Synthetic pending lunch', 'Synthetic failed photo']) {
    await page.locator('.cc-snap-recent-item').filter({ hasText: description }).first().click();
    await page.getByText('This saved photo is not in your calorie totals.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Retry analysis|Apply correction|Add to food log/ }).count(), 0);
    await page.keyboard.press('Escape');
  }
  const beforeChoice = await snapshot(page);
  assert.equal(beforeChoice.mediaRequests, 0); assert.equal(beforeChoice.inputClicks, 0); assert.deepEqual(beforeChoice.photoUploads, []);
  const [picker] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose meal photo', exact: true }).click()]);
  assert.deepEqual((await snapshot(page)).photoUploads, [], 'opening the picker alone does not upload');
  await picker.setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('heading', { name: 'Meal saved to your food log', exact: true }).waitFor();
  const afterChoice = await snapshot(page);
  assert.equal(afterChoice.photoUploads.length, 1);
  const { body: upload, durable } = afterChoice.photoUploads[0];
  assert.equal(durable, true); assert.equal(upload.confirm_consumed, true); assert.equal(upload.estimate_visible_portion, true);
  assert.equal(upload.photo_time_basis, 'file_last_modified'); assert.equal(upload.consumed_at, upload.photo_taken_at);
  assert.ok(afterChoice.requests.some(request => request.action === 'food_get' && request.mealId === 'meal_' + upload.request_id.replaceAll('-', '')));

  await page.waitForFunction(() => window.mediaFixture.foodListReadsAfterUpload > 0);
  const queue = page.getByRole('region', { name: 'Photos to check', exact: true });
  assert.equal(await queue.getByText('Synthetic newly logged photo', { exact: true }).count(), 0, 'a confirmed account photo leaves the review queue');
  assert.equal(await queue.getByRole('heading', { name: '2 photos to check', exact: true }).count(), 1);
  for (const pending of ['Synthetic pending lunch', 'Synthetic failed photo']) {
    assert.equal(await queue.getByRole('button', { name: new RegExp(pending) }).count(), 1);
  }
  const mealRows = page.locator('.cc-nutrition-timeline').getByRole('button', { name: /Synthetic newly logged photo/ });
  const dailyTotal = page.locator('.cc-nutrition-intake');
  async function assertCountedOnce() {
    await dailyTotal.getByText('825 kcal', { exact: true }).waitFor();
    assert.equal(await dailyTotal.getByText('2 logged meals', { exact: true }).count(), 1);
    assert.equal(await mealRows.count(), 1, 'same meal ID appears once even if history repeats it');
  }
  await assertCountedOnce();
  await mealRows.click();
  await saved.getByRole('heading', { name: 'Synthetic newly logged photo', exact: true }).waitFor();
  await saved.getByText(/In your food log/).waitFor();
  assert.equal(await saved.getByText(/not in (?:your )?calorie totals/i).count(), 0);
  await page.keyboard.press('Escape');
  const reads = await page.evaluate(() => window.mediaFixture.foodListReadsAfterUpload);
  await queue.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.waitForFunction(before => window.mediaFixture.foodListReadsAfterUpload > before, reads);
  await assertCountedOnce();
  console.log('PASS: confirmed account photo appears once in Food history and adds 325 kcal once, with only unfinished photos in the review queue');

  // An older queue row can become confirmed before the user opens its details.
  await page.evaluate(() => { window.mediaFixture.commitPendingOnRead = true; });
  const outdated = queue.getByRole('button', { name: /Synthetic pending lunch/ });
  await outdated.click();
  await saved.getByText(/included in that day’s calories/).waitFor();
  assert.equal(await saved.getByText(/not in (?:your )?calorie totals/i).count(), 0);
  await page.keyboard.press('Escape');
  await outdated.waitFor({ state: 'detached' });
  await dailyTotal.getByText('1,000 kcal', { exact: true }).waitFor();
  assert.equal(await dailyTotal.getByText('3 logged meals', { exact: true }).count(), 1);
  assert.equal(await page.locator('.cc-nutrition-timeline').getByRole('button', { name: /Synthetic pending lunch/ }).count(), 1);
  assert.equal(await queue.getByRole('heading', { name: '1 photo to check', exact: true }).count(), 1);
  assert.equal(await queue.getByRole('button', { name: /Synthetic failed photo/ }).count(), 1);
  console.log('PASS: stale pending row shows newly confirmed status and then leaves the queue, with the updated 175 kcal counted once');

  await page.getByRole('button', { name: 'Receipts preview', exact: true }).click();
  await page.getByText('Your photo will be saved to your account and sent to an AI provider to read the receipt. Compare it with your saved transactions afterward.', { exact: true }).waitFor();
  await page.getByLabel('Take receipt photo', { exact: true }).waitFor({state:'attached'});
  await page.getByLabel('Choose receipt image', { exact: true }).waitFor({state:'attached'});
  const unmatched = page.getByRole('button').filter({ hasText: 'Synthetic unmatched receipt' });
  assert.match(await unmatched.innerText(), /Saved/);
  assert.doesNotMatch(await unmatched.innerText(), /Ready to match/);
  assert.equal(await page.getByRole('heading', { name: 'Saved receipts', exact: true }).count(), 1);
  await unmatched.click();
  await page.getByRole('button', { name: 'Close receipt', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'View saved receipt photo', exact: true }).count(), 0);
  assert.equal(new URL(page.url()).searchParams.has('receipt'), false);
  await page.getByRole('button').filter({ hasText: 'Synthetic unmatched receipt' }).click();
  await page.getByRole('button', { name: 'View saved receipt photo', exact: true }).click();
  await page.getByAltText('Saved receipt from Synthetic unmatched receipt').waitFor();
  const findMatches = page.getByRole('button', { name: 'Find transaction matches', exact: true });
  assert.equal(await findMatches.isEnabled(), true);
  await findMatches.click();
  await page.getByText('Synthetic bank charge', { exact: true }).waitFor();
  await page.getByRole('radio', { name: /Synthetic bank charge/ }).check();
  await page.getByRole('button', { name: 'Confirm selected match', exact: true }).click();
  await page.getByText('Matched to the transaction you confirmed.', { exact: true }).waitFor();
  await page.getByRole('button').filter({ hasText: 'Synthetic failed receipt' }).click();
  assert.equal(await page.getByRole('button', { name: 'Retry saved receipt', exact: true }).count(), 0);
  await page.getByRole('button').filter({ hasText: 'Synthetic matched receipt' }).click();
  await page.getByText('Matched to the transaction you confirmed.', { exact: true }).waitFor();
  // Preserve the existing supported confirmation transport; no live bank search or record write.
  await page.evaluate(async () => window.mediaFixture.request({ action: 'receipt_confirm_match', receiptId: 'receipt_' + 'a'.repeat(32), transactionId: 'synthetic-saved-candidate', acknowledgeDifferences: true }));
  const account = await snapshot(page);
  assert.deepEqual(account.blocked, []); assert.equal(account.mediaRequests, 0); assert.equal(account.inputClicks, 1); assert.equal(account.photoUploads.length, 1);
  assert.equal(account.requests.some(request => unsupported.has(request.action)), false);
  assert.ok(account.requests.some(request => request.action === 'food_photo'));
  assert.ok(account.requests.some(request => request.action === 'receipt_get' && request.includeImage));
  assert.ok(account.requests.some(request => request.action === 'receipt_confirm_match'));
  await context.close();
  console.log('PASS: account photo capture is explicit and does not use legacy paid actions; receipt limits, saved originals and confirmation transport remain available');

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
