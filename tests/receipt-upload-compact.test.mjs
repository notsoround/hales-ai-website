// Card 11 (Nov 27 review): with saved receipts, the upload card collapses to one button so the list is above the fold.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-receipt-compact-'));
const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'synthetic-receipt-compact', configureServer(s) {
    s.middlewares.use((req, _res, next) => {
      if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html';
      next();
    });
  }, transformIndexHtml(html, context) {
    // The review's fictional account (receipts, purchases), as served by tests/account-design/preview-experience.mjs.
    return context.filename.endsWith('/tests/account-browser-preview.html') ? html.replace('/tests/account-browser-preview.tsx', '/tests/experience-review-preview.ts') : html;
  } }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account?tab=library&view=receipts&rich=1');
  const first = page.locator('.cc-receipt-saved .cc-library-item').first();
  const email = page.getByLabel('Email', { exact: true });
  await Promise.race([first.waitFor(), email.waitFor()]);
  if (await email.isVisible()) {
    await email.fill('a@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  await first.waitFor();
  const add = page.getByRole('button', { name: 'Add receipt', exact: true });
  await add.waitFor();
  assert.equal(await add.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Take receipt photo' }).count(), 0);
  const navTop = await page.locator('nav.cc-nav').evaluate(nav => nav.getBoundingClientRect().top);
  // With the match deck, the first unmatched receipt is the deck's own card at the top of the view.
  const deckReceipt = page.locator('.cc-deck .cc-deck-side').first();
  const box = await (await deckReceipt.count() ? deckReceipt : first).boundingBox();
  assert.ok(box && box.y + box.height <= navTop, `first saved receipt is visible without scrolling (bottom ${box?.y + box?.height}, nav ${navTop})`);
  await add.click();
  const take = page.getByRole('button', { name: 'Take receipt photo' });
  await take.waitFor();
  assert.equal(await take.evaluate(el => el === document.activeElement), true, 'focus moves to Take photo');
  await page.getByLabel('Choose receipt image').waitFor({ state: 'attached' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: with saved receipts the upload card is one "Add receipt" button, the first receipt is above the fold at 390x844, and Add receipt reveals Take photo / Choose image.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
