// Card 18 (Nov 27 review): failed requests show one friendly line and Retry, with the raw text behind a toggle.
// The synthetic preview fails recordings/list and health/sync the way a broken network would.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-friendly-errors-'));
const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'synthetic-friendly-errors', configureServer(s) {
    s.middlewares.use((req, _res, next) => {
      if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html';
      next();
    });
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
  await page.goto(base + '/cupcake/account?tab=library&view=audio');
  await page.getByLabel('Email', { exact: true }).fill('a@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const archive = page.locator('section[aria-label="Account audio archive"]:visible');
  await archive.getByText('Saved audio couldn’t load right now.').waitFor();
  const visibleText = locator => locator.evaluate(el => el.innerText);
  assert.doesNotMatch(await visibleText(archive), /recordings\/list|synthetic/i, 'no raw route text on screen');
  await archive.getByRole('button', { name: 'Retry', exact: true }).click();
  await archive.getByText('Saved audio couldn’t load right now.').waitFor();
  await archive.getByText('Technical details').click();
  assert.match(await archive.locator('.cc-friendly-error code').innerText(), /recordings\/list/, 'the raw text is still available');

  await page.locator('summary[aria-label="Settings"]').click();
  await page.locator('.cc-settings-group > summary').filter({ hasText: 'Connections' }).click();
  const health = page.getByRole('region', { name: 'Apple Health connection', exact: true });
  await health.getByRole('button', { name: 'Check connection', exact: true }).click();
  await health.getByText('Apple Health connection status couldn’t load right now.').waitFor();
  assert.doesNotMatch(await visibleText(health), /health\/sync|devices\/list|synthetic health server/i);
  await health.getByRole('button', { name: 'Retry', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: Saved audio and Apple Health failures show a friendly line, Retry and the raw text behind Technical details.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
