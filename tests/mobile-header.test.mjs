// Card 12 (Nov 27 review): the phone header shows the assistant name uncut, and the build string lives in Settings.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-mobile-header-'));
const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'synthetic-mobile-header', configureServer(s) {
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
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.goto(base + '/cupcake/account?tab=feed&rich=1');
    const identity = page.locator('.cc-top .cc-account-identity');
    await identity.filter({ hasText: 'Synthetic A' }).waitFor();
    assert.equal((await identity.textContent()).trim(), 'MyCupcake — Synthetic A', 'the full label stays in the accessible name');
    assert.deepEqual(await identity.evaluate(el => [el.scrollWidth <= el.clientWidth, el.firstElementChild.getBoundingClientRect().right <= el.getBoundingClientRect().right]), [true, true], `no ellipsis at ${width} px`);
    assert.equal(await page.locator('.cc-top .cc-version').count(), 0, 'no build string in the header');
    // Card 15: Spent today reads as tappable like Steps and Weight (chevron inside its open button), refresh kept.
    const spend = page.getByRole('group', { name: 'Spent today', exact: true });
    assert.equal(await spend.getByRole('button', { name: /Open history$/ }).locator('svg.nx-spend-chevron').count(), 1);
    assert.equal(await spend.getByRole('button', { name: /^Refresh spending/ }).count(), 1);
    assert.equal(await spend.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await page.locator('summary[aria-label="Settings"]').click();
    const group = page.locator('.cc-settings-group').filter({ hasText: 'App & updates' });
    await group.locator('summary').click();
    assert.match(await group.locator('.cc-app-version').innerText(), /^Version v\d{4}\.\d{2}\.\d{2}-\d+$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: at 320 and 390 px the header reads "MyCupcake" uncut (owner kept in the accessible name), the version sits in Settings → App & updates, and Spent today carries a chevron beside refresh.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
