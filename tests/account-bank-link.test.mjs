import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'bank-link-fixture-'));
const server = await createServer({ cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'bank-link-fixture', configureServer(vite) { vite.middlewares.use((req, _res, next) => {
    if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-bank-link-preview.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
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
    if (url.origin === 'https://secure.plaid.com' && url.pathname === '/hl/synthetic') return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Synthetic Plaid page</p>' });
    outside.push(url.origin); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + 'cupcake/account');
  assert.equal(await page.evaluate(() => window.bankFixture.load().calls.length), 0);
  await page.getByRole('button', { name: 'Check bank connections' }).click();
  await page.getByText('No bank is connected to this account.').waitFor();
  await page.evaluate(() => window.bankFixture.mode('pending'));
  await page.getByRole('button', { name: 'Connect a bank' }).click();
  await page.getByText('Synthetic Plaid page').waitFor();
  await page.goto(base + 'cupcake/account?bankLink=complete');
  await page.getByText('Waiting for Plaid to finish confirming your connection…').waitFor();
  await page.evaluate(() => window.bankFixture.mode('success'));
  await page.getByText('Bank connected and transactions refreshed.').waitFor();
  const calls = await page.evaluate(() => window.bankFixture.load().calls);
  const create = calls.find(call => call.action === 'bank_link_create');
  const complete = calls.filter(call => call.action === 'bank_link_complete');
  assert.equal(create.owner, 'acc_bank_a'); assert.ok(complete.length >= 2);
  assert.ok(complete.every(call => call.body.request_id === create.body.request_id && !('public_token' in call.body)));
  assert.equal(new URL(page.url()).searchParams.has('bankLink'), false);
  await page.getByRole('button', { name: 'Refresh transactions' }).click();
  await page.getByText('Transaction refresh completed.').waitFor();

  await page.evaluate(() => window.bankFixture.setReconnect());
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await page.getByRole('button', { name: 'Reconnect bank' }).click();
  await page.getByText('Synthetic Plaid page').waitFor();
  await page.goto(base + 'cupcake/account?bankLink=complete');
  await page.getByText('Bank reconnected and transactions refreshed.').waitFor();
  assert.equal(await page.evaluate(() => window.bankFixture.load().calls.filter(call => call.action === 'bank_link_update_complete').length), 1);

  await page.getByRole('button', { name: 'Disconnect bank' }).click();
  await page.getByRole('alertdialog', { name: 'Disconnect bank?' }).getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await page.evaluate(() => window.bankFixture.load().calls.filter(call => call.action === 'bank_disconnect').length), 0);
  await page.getByRole('button', { name: 'Disconnect bank' }).click();
  await page.getByRole('alertdialog', { name: 'Disconnect bank?' }).getByRole('button', { name: 'Disconnect' }).click();
  await page.getByText('Bank disconnected.').waitFor();

  await page.evaluate(() => window.bankFixture.mode('lost'));
  await page.getByRole('button', { name: 'Connect a bank' }).click();
  await page.getByText('Synthetic Plaid page').waitFor();
  await page.goto(base + 'cupcake/account?bankLink=complete');
  await page.getByText('The connection could not be confirmed. Check status before starting another connection.').waitFor();
  const attemptsBeforeReload = await page.evaluate(() => window.bankFixture.load().calls.filter(call => call.action === 'bank_link_complete').length);
  await page.reload();
  await page.getByText('The connection could not be confirmed. Check status before starting another connection.').waitFor();
  assert.equal(await page.evaluate(() => window.bankFixture.load().calls.filter(call => call.action === 'bank_link_complete').length), attemptsBeforeReload, 'an uncertain exchange is not retried after reload');
  await page.getByRole('button', { name: 'Check bank connections' }).click();
  await page.getByText('Bank connection confirmed. Refresh transactions to use it for receipt matching.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Connect a bank' }).isEnabled(), true);
  const beforeSwitch = await page.evaluate(() => window.bankFixture.load().calls.length);
  await page.evaluate(() => window.switchOwner('B'));
  await page.getByRole('button', { name: 'Connect a bank' }).click();
  assert.equal(await page.evaluate(() => window.bankFixture.load().calls.length), beforeSwitch, 'a stale component cannot link another account');
  assert.deepEqual(outside, []); assert.deepEqual(errors, []);
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await otherContext.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || url.protocol === 'data:') return route.continue();
    if (url.origin === 'https://secure.plaid.com' && url.pathname === '/hl/synthetic') return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Synthetic Plaid page</p>' });
    return route.abort();
  });
  await otherContext.addInitScript(() => {
    if (new URL(location.href).searchParams.get('bankLink') !== 'complete') return;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.endsWith('cupcake-bank-hosted-session-v1')) sessionStorage.removeItem(key);
    }
  });
  const otherPage = await otherContext.newPage(); otherPage.setDefaultTimeout(12000);
  await otherPage.goto(base + 'cupcake/account');
  await otherPage.getByRole('button', { name: 'Check bank connections' }).click();
  await otherPage.getByRole('button', { name: 'Connect a bank' }).click();
  await otherPage.getByText('Synthetic Plaid page').waitFor();
  await otherPage.goto(base + 'cupcake/account?bankLink=complete');
  await otherPage.getByText('Your bank session could not be restored. Check bank connections for pending requests.').waitFor();
  await otherPage.getByRole('button', { name: 'Check bank connections' }).click();
  await otherPage.getByRole('button', { name: 'Check pending bank connection' }).click();
  await otherPage.getByText('Bank connected and transactions refreshed.').waitFor();
  await otherContext.close();
  console.log('PASS: synthetic hosted bank link, pending resume, owner isolation, reconnect, disconnect and lost-response recovery');
  await context.close();
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
