// Card 10 (Nov 27 review): saved audio has its own Library view instead of trailing every view. Synthetic account only.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-saved-audio-'));
const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'synthetic-saved-audio', configureServer(s) {
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
  await page.goto(base + '/cupcake/account?tab=library');
  await page.getByLabel('Email', { exact: true }).fill('a@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const tab = name => page.getByRole('tab', { name, exact: true });
  const archive = page.locator('section[aria-label="Account audio archive"]:visible');
  await tab('All Content').waitFor();
  for (const view of ['All Content', 'Receipts', 'Phone calls', 'Messages']) {
    await tab(view).click();
    await page.waitForTimeout(150);
    assert.equal(await archive.count(), 0, `${view} no longer ends with Saved audio`);
    assert.equal(await page.getByText('Your saved originals', { exact: false }).filter({ visible: true }).count(), 0);
  }
  await tab('Saved audio').click();
  await archive.getByRole('heading', { name: 'Saved audio', exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('view'), 'audio');
  await page.reload();
  await page.locator('section[aria-label="Account audio archive"]:visible').getByRole('heading', { name: 'Saved audio', exact: true }).waitFor();
  assert.equal(await tab('Saved audio').getAttribute('aria-selected'), 'true', 'view=audio opens the Saved audio view directly');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // Card 17: the view strip scrolls at 390 px, so the clipped edge fades instead of cutting "Phone calls" off at the border.
  const strip = page.getByRole('tablist', { name: 'Library views' });
  await tab('All Content').click();
  await page.waitForFunction(() => document.querySelector('[role=tablist][aria-label="Library views"]')?.scrollLeft === 0);
  assert.equal(await strip.getAttribute('data-more-after'), 'true');
  assert.equal(await strip.getAttribute('data-more-before'), null);
  await tab('Saved audio').click();
  await page.waitForFunction(() => document.querySelector('[role=tablist][aria-label="Library views"]')?.hasAttribute('data-more-before'));
  assert.match(await strip.evaluate(el => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage), /linear-gradient/);
  // Card 17: Food's target inputs stay at 16 px so iOS does not zoom when they take focus.
  await page.goto(base + '/cupcake/account?tab=snap');
  const settings = page.locator('details.cc-nutrition-settings');
  await settings.locator('summary').click();
  assert.deepEqual(await settings.locator('input').evaluateAll(inputs => inputs.map(input => getComputedStyle(input).fontSize)), ['16px', '16px', '16px']);
  assert.deepEqual(errors, []);
  console.log('PASS: Saved audio is its own Library view (one tap, deep-linkable) and no longer trails All Content, Receipts, Calls or Messages; the view strip fades its scrolled edge; Food target inputs are 16 px.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
