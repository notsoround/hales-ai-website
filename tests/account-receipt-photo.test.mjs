import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'receipt-photo-fixture-'));
const server = await createServer({ cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'receipt-fixture', configureServer(vite) { vite.middlewares.use((req, _res, next) => {
    if (req.url === '/cupcake/account') req.url = '/tests/account-receipt-photo-preview.html';
    next();
  }); } }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const outside = [], errors = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === new URL(base).origin) return route.continue();
    outside.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + 'cupcake/account');
  await page.getByText('Add a receipt photo').waitFor();
  assert.equal(await page.evaluate(() => window.receiptFixture.requests.length), 0, 'opening the screen never starts an upload');
  await page.evaluate(() => { window.receiptFixture.off = true; });
  await page.getByLabel('Choose receipt image').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /isn’t available yet/);
  const first = await page.evaluate(() => window.receiptFixture.requests[0]);
  await page.reload();
  await page.getByAltText('Receipt photo waiting to save').waitFor();
  await page.evaluate(() => { window.receiptFixture.off = false; window.receiptFixture.failAfterCommit = true; });
  await page.getByRole('button', { name: 'Retry this photo' }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /Synthetic response lost/);
  assert.equal(await page.getByAltText('Receipt photo waiting to save').count(), 1);
  assert.equal(first.owner, 'acc_receipt_a');
  await page.getByRole('button', { name: 'Retry this photo' }).click();
  await page.getByText('Receipt photo saved. It is waiting to be read.').waitFor();
  const outcome = await page.evaluate(() => window.receiptFixture);
  assert.equal(outcome.requests.length, 2);
  assert.deepEqual(outcome.requests[0], first, 'retry after reload uses the same account, request ID and image');
  assert.deepEqual(outcome.requests[1], first);
  assert.deepEqual(outcome.saved, [first.id]);
  const store = await page.evaluate(async () => (await import('/src/components/cupcake/accountReceiptDraft.ts')).receiptDraftStore().list());
  assert.deepEqual(store, [], 'draft removed after receipt_get confirms save');

  await page.evaluate(() => { window.receiptFixture.failAfterCommit = true; });
  await page.getByLabel('Take receipt photo').setInputFiles({ name: 'synthetic2.png', mimeType: 'image/png', buffer: png });
  await page.getByText('Synthetic response lost').waitFor();
  await page.evaluate(() => window.switchOwner('B'));
  const otherDrafts = await page.evaluate(async () => (await import('/src/components/cupcake/accountReceiptDraft.ts')).receiptDraftStore().list());
  assert.deepEqual(otherDrafts, [], 'another account cannot access the pending photo');
  await page.getByRole('button', { name: 'Retry this photo' }).click();
  assert.equal(await page.evaluate(() => window.receiptFixture.requests.length), 3, 'stale component cannot upload under another account');
  assert.deepEqual(outside, []); assert.deepEqual(errors, []);
  console.log('PASS: receipt camera and picker save an owned photo, exact retry survives a lost response, and account switching fences drafts');
  await context.close();
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
