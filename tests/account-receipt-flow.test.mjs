import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'receipt-flow-fixture-'));
const server = await createServer({ cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'receipt-flow-fixture', configureServer(vite) { vite.middlewares.use((req, _res, next) => {
    if (req.url === '/cupcake/account') req.url = '/tests/account-receipt-flow-preview.html';
    next();
  }); } }], server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const outside = [], errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || url.protocol === 'data:') return route.continue();
    outside.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + 'cupcake/account');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Take receipt photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('heading', { name: '1 exact amount match', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => window.receiptFlowFixture.actions.includes('bank_sync')), 'connected bank refreshed before receipt matching');
  assert.deepEqual(await page.evaluate(() => ({ starts: window.receiptFlowFixture.startCount, matches: window.receiptFlowFixture.matchCount, confirmations: window.receiptFlowFixture.confirmCount })), { starts: 1, matches: 1, confirmations: 0 });
  await page.getByRole('radio', { name: /Synthetic Market/ }).check();
  await page.getByRole('button', { name: 'Confirm selected match', exact: true }).click();
  await page.getByText('Matched to the transaction you confirmed.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.receiptFlowFixture.confirmCount), 1);
  assert.deepEqual(outside, []); assert.deepEqual(errors, []);
  await page.goto(base + 'cupcake/account');
  await page.getByLabel('Take receipt photo').waitFor({ state: 'attached' });
  await page.evaluate(() => { window.receiptFlowFixture.noBank = true; });
  await page.getByLabel('Take receipt photo').setInputFiles({ name: 'synthetic2.png', mimeType: 'image/png', buffer: png });
  await page.getByText('No bank coverage has been saved for this account.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Confirm selected match', exact: true }).count(), 0);
  console.log('PASS: synthetic photo saves, reads once, finds account transaction and requires explicit confirmation');
  await context.close();
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
