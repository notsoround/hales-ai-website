import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'receipt-reading-fixture-'));
const server = await createServer({ cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'receipt-reader-fixture', configureServer(vite) { vite.middlewares.use((req, _res, next) => {
    if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-receipt-reader-preview.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    next();
  }); } }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0];
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
  try { await page.getByText('Receipt saved. Waiting to read the photo…').waitFor(); }
  catch (error) { console.log('fixture:', await page.locator('body').innerText(), await page.evaluate(() => window.readerFixture), errors); throw error; }
  assert.equal(await page.evaluate(() => window.readerFixture.starts), 1, 'one automatic read for the saved photo');
  await page.evaluate(() => { window.readerFixture.mode = 'uncertain'; });
  try { await page.getByText('The reading result could not be confirmed. Check its status before trying again.').waitFor({ timeout: 20000 }); }
  catch (error) { console.log('fixture:', await page.locator('body').innerText(), await page.evaluate(() => window.readerFixture), errors); throw error; }
  assert.equal(await page.getByRole('button', { name: 'Retry reading' }).count(), 0, 'uncertain dispatch cannot be retried');
  await page.evaluate(() => { window.readerFixture.mode = 'completed'; });
  await page.getByRole('button', { name: 'Check reading status' }).click();
  await page.getByText('Receipt reading complete.').waitFor();
  assert.equal(await page.evaluate(() => window.readerFixture.finished), 1);
  assert.equal(await page.evaluate(() => window.readerFixture.starts), 1);
  assert.equal(await page.evaluate(() => window.readerFixture.retries), 0);
  await page.goto(base + 'cupcake/account?manual=1');
  await page.getByRole('button', { name: 'Read receipt photo', exact: true }).click();
  await page.getByText('Receipt saved. Waiting to read the photo…').waitFor();
  assert.equal(await page.evaluate(() => window.readerFixture.starts), 1, 'previously saved unread photo can be read explicitly');
  assert.deepEqual(outside, []); assert.deepEqual(errors, []);
  console.log('PASS: automatic owned read, uncertain status fence, explicit status check and single completion; synthetic only');
  await context.close();
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
