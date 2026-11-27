// Review item 2: every shortcut lands on the thing it names, and Library finds receipts, purchases and calls.
// Fictional "Synthetic A" account only (the experience-review fixture); no external requests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-findability-'));
const server = await createServer({
  cacheDir, envDir: cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  optimizeDeps: { entries: ['tests/experience-review-preview.ts'] },
  plugins: [{
    name: 'synthetic-findability',
    configureServer(s) { s.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; next(); }); },
    transformIndexHtml(html, context) {
      return context.filename.endsWith('/tests/account-browser-preview.html') ? html.replace('/tests/account-browser-preview.tsx', '/tests/experience-review-preview.ts') : html;
    },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output = process.env.FINDABILITY_OUTPUT;
if (output) mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
let checks = 0;
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin === base || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue(); external.push(u.href); return route.abort(); });
    const query = () => new URL(page.url()).searchParams;
    const noOverflow = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow: ${label} at ${width}`);
    const shot = async name => { if (output) await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true }); };
    const receipts = page.locator('.cc-receipts:visible');
    const fixture = () => page.evaluate(() => window.receiptNavFixture);

    // 1. Today → "Spent today" opens Library → Receipts & bank purchases → Bank purchases, not the Wins & Losses dashboard.
    await page.goto(base + '/cupcake/account?tab=feed&rich=1');
    const spent = page.getByRole('button', { name: /^Spent today .*Open bank purchases$/ });
    await spent.click();
    await receipts.getByRole('heading', { name: 'Saved bank purchases', exact: true }).waitFor();
    assert.equal(query().get('tab'), 'library'); assert.equal(query().get('view'), 'receipts'); assert.equal(query().get('receiptTab'), 'bank');
    assert.equal(await receipts.getByRole('button', { name: 'Bank purchases', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('tab', { name: 'Receipts', exact: true }).getAttribute('aria-selected'), 'true');
    await receipts.locator('.cc-bank-purchase-row').filter({ hasText: 'Marina Market' }).first().waitFor();
    await noOverflow('bank purchases'); await shot('spent-today-lands-on-bank-purchases');
    await page.goBack(); await spent.waitFor();
    assert.equal(query().get('tab'), 'feed', 'Back returns to Today');

    // 2. Bell → "1 unmatched receipt" opens that receipt in Library → Receipts, not the Food page.
    const { receiptId } = await fixture();
    await page.locator('.nx-notif-btn').click();
    await page.getByRole('button', { name: /1 unmatched receipt/ }).click();
    await receipts.locator('.cc-receipt-selected').getByRole('heading', { name: 'Marina Market', exact: true }).waitFor();
    assert.equal(query().get('tab'), 'library'); assert.equal(query().get('view'), 'receipts'); assert.equal(query().get('receipt'), receiptId);
    await noOverflow('unmatched receipt'); await shot('bell-opens-the-unmatched-receipt');
    await receipts.getByRole('button', { name: 'Close receipt', exact: true }).click();
    assert.equal(await receipts.getByRole('button', { name: /^Unmatched/ }).getAttribute('aria-pressed'), 'true', 'Closing the receipt shows the Unmatched list');
    assert.equal(query().has('receipt'), false);

    // 2b. When the saved list holds more than one unmatched receipt, the bell lands on the Unmatched list and opens none.
    await page.goto(base + '/cupcake/account?tab=feed&rich=1&reconcile=empty');
    await page.locator('.nx-notif-btn').click();
    await page.getByRole('button', { name: /1 unmatched receipt/ }).click();
    await receipts.getByRole('button', { name: /^Unmatched/ }).waitFor();
    assert.equal(await receipts.getByRole('button', { name: /^Unmatched/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(query().get('tab'), 'library'); assert.equal(query().get('view'), 'receipts'); assert.equal(query().has('receipt'), false);
    assert.equal(await receipts.locator('.cc-receipt-selected').count(), 0);

    // 3. Library → All Content lists receipts, bank purchases and the saved call beside the saved sources.
    await page.goto(base + '/cupcake/account?tab=library&view=context&rich=1');
    const finder = page.locator('.cc-library-finder:visible');
    await finder.getByRole('heading', { name: 'Receipts · 2', exact: true }).waitFor();
    await finder.getByRole('heading', { name: 'Bank purchases · 3', exact: true }).waitFor();
    await finder.getByRole('heading', { name: 'Phone calls · 1', exact: true }).waitFor();
    await finder.getByRole('button', { name: /Phone call.*Grocery check-in/ }).waitFor();
    for (const name of ['All receipts', 'All bank purchases', 'All phone calls']) {
      assert.ok(await finder.getByRole('button', { name, exact: true }).evaluate(el => el.getBoundingClientRect().height >= 44), name + ' is a 44 px target');
    }
    await noOverflow('All Content'); await shot('all-content-lists-receipts-purchases-calls');

    // 4. Searching "Marina" returns the Marina Market receipt (and its bank purchases), and says what the search covers.
    await page.getByLabel('Search library', { exact: true }).fill('Marina');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: '3 matches', exact: true }).waitFor();
    await finder.getByRole('heading', { name: 'Receipts · 1 match', exact: true }).waitFor();
    await finder.getByRole('heading', { name: 'Bank purchases · 2 matches', exact: true }).waitFor();
    assert.equal(await finder.getByRole('heading', { name: /^Phone calls/ }).count(), 0, 'The grocery call does not mention Marina');
    const coverage = await finder.locator('.cc-library-finder-coverage').innerText();
    assert.match(coverage, /Search covers saved sources, 2 saved receipts \(store, date, items and total\), bank purchases, saved phone calls \(title and preview text\)\./);
    await noOverflow('search results'); await shot('search-marina-returns-the-receipt');
    await finder.getByRole('button', { name: /Receipt.*Marina Market/ }).click();
    await receipts.locator('.cc-receipt-selected').getByRole('heading', { name: 'Marina Market', exact: true }).waitFor();
    assert.equal(query().get('view'), 'receipts'); assert.equal(query().get('receipt'), receiptId);
    await page.goBack();
    await page.getByRole('heading', { name: '3 matches', exact: true }).waitFor();

    // A term nothing holds reports zero, and clearing the search restores the browse lists.
    await page.getByLabel('Search library', { exact: true }).fill('zzz-no-such-store');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: '0 matches', exact: true }).waitFor();
    await page.getByText('Try a store name, a distinctive phrase or a broader project name.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await finder.getByRole('heading', { name: 'Receipts · 2', exact: true }).waitFor();

    // 5. "All bank purchases" and the call row land where they say.
    await finder.getByRole('button', { name: /Phone call.*Grocery check-in/ }).click();
    await page.getByRole('dialog', { name: 'Phone call details' }).waitFor();
    await page.goto(base + '/cupcake/account?tab=library&view=context&rich=1');
    await finder.getByRole('button', { name: 'All bank purchases', exact: true }).click();
    await receipts.getByRole('heading', { name: 'Saved bank purchases', exact: true }).waitFor();
    assert.equal(query().get('receiptTab'), 'bank');

    // 6. Library has an Archived entry; this fictional account has archived nothing and the entry says so.
    await page.goto(base + '/cupcake/account?tab=library&view=context&rich=1');
    const archived = page.locator('details.cc-library-archived:visible');
    await archived.locator('summary').filter({ hasText: 'Archived conversations (0)' }).first().click();
    await archived.getByText('Nothing is archived on this device.', { exact: false }).waitFor();
    assert.ok(await archived.locator('summary').first().evaluate(el => el.getBoundingClientRect().height >= 44), 'Archived entry is a 44 px target');
    await noOverflow('archived entry'); await shot('library-archived-entry');

    // Nothing in these journeys matched, unlinked or wrote anything.
    assert.deepEqual((await fixture()).confirms, []);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    checks++; await context.close();
  }
  console.log(`PASS ${checks} widths: Spent today → Bank purchases; bell → the unmatched receipt (or the Unmatched list); All Content and search include receipts, purchases and calls ("Marina" returns the receipt); Archived entry present.`);
} finally {
  await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true });
}
