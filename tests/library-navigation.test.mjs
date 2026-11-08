// Real Library component and both production transports; local fixture data only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-library-navigation-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'local-library-route', configureServer(server) { server.middlewares.use((req, _res, next) => { const [route, query = ''] = (req.url || '').split('?'); if (['/cupcake', '/cupcake/account'].includes(route)) req.url = '/tests/library-navigation-preview.html?' + query; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = server.resolvedUrls.local[0];
const tabs = ['All context', 'Channel messages', 'Projects', 'Review your day', 'Receipts', 'Saved thinking', 'Connections'];
const keys = ['context', 'messages', 'projects', 'planning', 'receipts', 'thinking', 'connections'];
const countRequests = page => page.evaluate(() => window.libraryNavigationFixture.requests.length);
async function relationships(page) {
  assert.deepEqual(await page.getByRole('tab').allTextContents(), tabs);
  const links = await page.getByRole('tab').evaluateAll(elements => elements.map(tab => {
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    return { panel: panel?.getAttribute('role'), label: panel?.getAttribute('aria-labelledby') === tab.id, hidden: panel?.hidden, selected: tab.getAttribute('aria-selected') === 'true' };
  }));
  for (const link of links) { assert.equal(link.panel, 'tabpanel'); assert.equal(link.label, true); assert.equal(link.hidden, !link.selected); }
  assert.equal(await page.locator('[role=tab][tabindex="0"]').count(), 1);
  assert.equal(await page.getByRole('tabpanel').count(), 1);
  const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, files: [...document.querySelectorAll('input[type=file]')].map(el => ({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right, parent:el.parentElement.getBoundingClientRect().right})), scrolling: [...document.querySelectorAll('body *')].filter(el=>el.scrollWidth>el.clientWidth+1).slice(0,12).map(el=>({className:el.className,client:el.clientWidth,scroll:el.scrollWidth})), outside: [...document.querySelectorAll('.cc-library-workspace *')].filter(el => { const r = el.getBoundingClientRect(); return !el.closest('.cc-library-tabs') && r.width && r.right > innerWidth + 1; }).map(el => ({ tag: el.tagName, className: el.className, right: el.getBoundingClientRect().right })) }));
  assert.ok(geometry.scroll <= geometry.width, 'No horizontal page overflow: ' + JSON.stringify(geometry));
}
let cases = 0, instanceCases = 0; const results = [], output = process.env.LIBRARY_NAVIGATION_OUTPUT;
if (output) mkdirSync(output, { recursive: true });
try {
  for (const browserName of (process.env.LIBRARY_BROWSER ? [process.env.LIBRARY_BROWSER] : ['chromium', 'webkit'])) {
    const browser = await playwright[browserName].launch({ headless: true });
    try {
      for (const entry of (process.env.LIBRARY_ENTRY ? [process.env.LIBRARY_ENTRY] : ['/cupcake', '/cupcake/account'])) for (const theme of (process.env.LIBRARY_THEME ? [process.env.LIBRARY_THEME] : ['caribbean', 'rose'])) for (const width of (process.env.LIBRARY_WIDTH ? [Number(process.env.LIBRARY_WIDTH)] : [320, 390, 1280])) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
        const remote = [], errors = [];
        await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : (remote.push(route.request().url()), route.abort()));
        const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(`${base}${entry.slice(1)}?theme=${theme}&view=context`);
          await page.locator('.cc-library-item').first().waitFor();
          await relationships(page);
          const tab = name => page.getByRole('tab', { name, exact: true });
          await tab('All context').focus(); const before = await countRequests(page);
          await page.keyboard.press('End'); await tab('Connections').waitFor({ state: 'visible' });
          assert.equal(await tab('Connections').evaluate(el => document.activeElement === el), true);
          assert.equal(await tab('All context').getAttribute('aria-selected'), 'true', 'Arrow focus must not trigger panel requests');
          await page.keyboard.press('ArrowRight'); assert.equal(await tab('All context').evaluate(el => document.activeElement === el), true);
          await page.keyboard.press('ArrowLeft'); assert.equal(await tab('Connections').evaluate(el => document.activeElement === el), true);
          await page.keyboard.press('Home'); assert.equal(await tab('All context').evaluate(el => document.activeElement === el), true);
          await page.keyboard.press('ArrowRight'); assert.equal(await tab('Channel messages').evaluate(el => document.activeElement === el), true);
          assert.equal(await countRequests(page), before, 'Keyboard discovery made a request');
          await page.keyboard.press('Enter'); await page.getByText('Synthetic captured message.', { exact: true }).waitFor(); await relationships(page);
          assert.equal(new URL(page.url()).searchParams.get('view'), 'messages');
          await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
          await page.getByRole('button', { name: 'Add project', exact: true }).waitFor();
          assert.equal(new URL(page.url()).searchParams.get('view'), 'projects');
          await page.getByRole('button', { name: 'Edit project', exact: true }).click();
          assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Synthetic project');
          await page.getByRole('button', { name: 'Explore context', exact: false }).click();
          await relationships(page); assert.equal(await tab('All context').getAttribute('aria-selected'), 'true'); assert.equal(new URL(page.url()).searchParams.get('view'), 'context');
          // Clear the project filter, retaining the full existing artifact list.
          await page.getByRole('combobox', { name: 'Context', exact: true }).selectOption('');
          assert.equal(await page.locator('.cc-library-item').count(), 30);
          await page.getByRole('button', { name: 'Load more', exact: true }).click(); assert.equal(await page.locator('.cc-library-item').count(), 34);
          await page.getByRole('button', { name: 'Bring a conversation', exact: true }).click(); await page.getByLabel('Title', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Close import', exact: true }).click();
          await page.getByLabel('Search library', { exact: true }).fill('Synthetic'); await page.getByRole('button', { name: 'Search', exact: true }).click();
          await page.getByRole('button', { name: 'Clear search', exact: true }).waitFor(); await page.getByRole('button', { name: 'Clear search', exact: true }).click();
          for (const [index, name] of tabs.entries()) {
            await tab(name).click(); await relationships(page); assert.equal(new URL(page.url()).searchParams.get('view'), keys[index]);
            const panel = page.getByRole('tabpanel', { name, exact: true });
            if (name === 'Review your day') await panel.getByRole('heading', { name: 'Review your day.', exact: true }).waitFor();
            if (name === 'Receipts') {
              await panel.getByRole('heading', { name: 'Every receipt, the right purchase', exact: true }).waitFor();
              if (entry === '/cupcake') { const chosen = page.waitForEvent('filechooser'); await panel.getByText('Choose image', { exact: true }).click(); const chooser = await chosen; assert.equal(chooser.isMultiple(), false); await chooser.setFiles([]); }
              else await panel.getByText('Receipt capture and bank search unavailable', { exact: true }).waitFor();
            }
            if (name === 'Saved thinking') await panel.getByText('Synthetic saved analysis.', { exact: true }).waitFor();
            if (name === 'Connections') { await panel.getByRole('button', { name: 'Create 90-day access', exact: true }).waitFor(); await panel.getByRole('button', { name: 'Check access', exact: true }).waitFor(); }
          }
          if (width < 600) {
            await page.getByText('7 views · swipe or use the arrows', { exact: true }).waitFor();
            const earlier = page.getByRole('button', { name: 'Earlier Library views', exact: true }); await earlier.waitFor({ state: 'visible' });
            const left = await page.locator('.cc-library-tabs').evaluate(el => el.scrollLeft); await earlier.click();
            await page.waitForFunction(previous => document.querySelector('.cc-library-tabs').scrollLeft < previous, left);
            const more = page.getByRole('button', { name: 'More Library views', exact: true }); await more.click();
            assert.equal(await tab('Connections').getAttribute('aria-selected'), 'true', 'Overflow arrows must preserve selection');
            assert.ok(await more.evaluate(el => el.getBoundingClientRect().width >= 44 && el.getBoundingClientRect().height >= 44));
          }
          const requests = await page.evaluate(() => window.libraryNavigationFixture.requests);
          if (entry.endsWith('/account')) assert.ok(requests.filter(row => row.action !== 'session').every(row => row.route === '/api/account/data' && row.context === 'acc_navigation_fixture'));
          else assert.ok(requests.every(row => row.route === '/cupcake-library'));
          assert.deepEqual(await page.evaluate(() => window.libraryNavigationFixture.blocked), []); assert.deepEqual(remote, []); assert.deepEqual(errors, []);
          if (output && browserName === 'chromium' && entry.endsWith('/account') && width !== 390) await page.screenshot({ path: path.join(output, `library-${theme}-${width}.png`), fullPage: true });
          results.push({ browser: browserName, entry, theme, width, views: 7, remoteRequests: remote.length, blockedActions: 0, pass: true });
          cases++; console.log(`PASS ${browserName} ${entry} ${theme} ${width}: keyboard/panels/discovery, seven views and retained controls; no writes/providers`);
        } catch (error) { console.error({ errors, body: (await page.locator('body').innerText()).slice(0, 1800), requests: await page.evaluate(() => window.libraryNavigationFixture?.requests) }); throw error; } finally { await context.close(); }
      }
      const context = await browser.newContext(); const page = await context.newPage();
      await page.goto(`${base}cupcake?two=1`); await page.getByRole('tablist').first().waitFor();
      const ids = await page.locator('[role=tab],[role=tabpanel]').evaluateAll(elements => elements.map(el => el.id)); assert.equal(new Set(ids).size, 28, 'Multiple workspace IDs must remain unique');
      instanceCases++; await context.close();
    } finally { await browser.close(); }
  }
  if (output) writeFileSync(path.join(output, 'validation.json'), JSON.stringify({ cases, instanceCases, results, syntheticOnly: true, deployment: false }, null, 2));
  console.log(`PASS ${cases} real component/browser/transport/theme/width cases, plus ${instanceCases} multi-instance ID cases.`);
} finally { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
