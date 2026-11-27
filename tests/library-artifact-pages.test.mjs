// Real Library component. The fixture intercepts every account request with fictional data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-artifact-pages-'));
const server = await createServer({
  cacheDir,
  plugins: [{ name: 'library-pagination-fixture', configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      req.url = req.url?.replace(/^\/cupcake\/account\?/, '/tests/library-navigation-preview.html?');
      next();
    });
  } }],
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
await server.listen();
const browser = await playwright.chromium.launch();
try {
  const page = await browser.newPage({ viewport: {width: 390, height: 844} });
  page.setDefaultTimeout(6000);
  const external = [];
  const base = new URL(server.resolvedUrls.local[0]);
  await page.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : (external.push(route.request().url()), route.abort()));
  const url = new URL('cupcake/account?artifactPages=1', base).href;
  const button = name => page.getByRole('button', { name, exact: true });
  await page.goto(url);
  await page.getByRole('heading', { name: '30 of 502 items' }).waitFor();
  const requests = () => page.evaluate(() => window.libraryNavigationFixture.requests.filter(row => row.action === 'list').length);
  const initial = await requests();
  for (let i = 0; i < 16; i++) await button('Load more').click();
  await page.getByRole('heading', {name: '500 of 502 items'}).waitFor();
  assert.equal(await requests(), initial, 'Use locally available pages first');
  await button('Load older items').click();
  await page.getByRole('heading', {name: '502 items'}).waitFor();
  await page.getByText('Synthetic paged item 501', {exact: true}).waitFor();
  assert.equal(await requests(), initial + 1);
  assert.equal(await button('Load older items').count(), 0);

  await page.goto(url + '&failOlderOnce=1');
  await page.getByRole('combobox', {name: 'Context', exact: true}).selectOption('Synthetic project');
  await page.getByText('No items for this project in the loaded history.', {exact: true}).waitFor();
  await button('Load older items').click();
  await page.getByRole('alert').waitFor();
  await button('Load older items').click();
  await page.getByRole('heading', {name: '2 items'}).waitFor();
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.equal(await page.locator('.cc-library-item').count(), 2);
  await page.getByLabel('Search library').fill('Synthetic');
  await button('Search').click();
  await button('Clear search').waitFor();
  assert.equal(await button('Load older items').count(), 0);
  assert.deepEqual(external, []);
  assert.deepEqual(await page.evaluate(() => window.libraryNavigationFixture.blocked), []);
  console.log('PASS account Library advanced past 500, preserved project and search scope, and made no external requests.');
} finally {
  await browser.close();
  await server.close();
  rmSync(cacheDir, {recursive: true, force: true});
}
