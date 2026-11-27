// Review item 1 (Nov 27): the receipt learns what a confirmed match settled, amounts never wrap,
// one back control per step, and "nothing found" is not shown while saved purchases carry the receipt's merchant.
// Runs the regular account app against the synthetic receipt and bank ledger. Fictional data only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-receipt-truth-'));
const server = await createServer({ cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"' },
  plugins: [{ name:'synthetic-bank-workspace', configureServer(s) { s.middlewares.use((req,_res,next) => {
    if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-receipt-navigation-preview.html';
    next();
  }); } }], server: { host:'127.0.0.1', port:0, hmr:false, fs:{ allow:[process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const receiptId = 'receipt_' + 'c'.repeat(32);
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch();
const shots = process.env.RECEIPT_TRUTH_SHOTS;
try {
  for (const width of [320, 390]) {
    const open = async (mode, extra = '') => {
      const context = await browser.newContext({ viewport: { width, height: 845 }, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(9000);
      const failures = []; page.on('pageerror', e => failures.push(e.message));
      await page.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === base || u.protocol === 'data:' || u.protocol === 'blob:' ? r.continue() : r.abort(); });
      await page.goto(`${base}/cupcake/account?tab=library&view=receipts${mode ? '&reconcile=' + mode : ''}&receipt=${receiptId}${extra}`);
      const workspace = page.locator('.cc-receipts:visible'), card = workspace.locator('.cc-receipt-selected');
      await card.waitFor();
      return { context, page, workspace, card, failures };
    };
    // Every amount sits on one line and the page never scrolls sideways.
    const layout = async (page, label) => {
      const wrapped = await page.evaluate(() => [...document.querySelectorAll('.cc-receipts .cc-receipt-total strong, .cc-receipts .cc-receipt-amount strong, .cc-receipts .cc-bank-purchase-row > :last-child, .cc-receipts .cc-receipt-nowrap, .cc-receipts .cc-receipt-tag, .cc-receipts .cc-receipt-breakdown dd')]
        .filter(node => node.getClientRects().length && node.checkVisibility())
        .filter(node => node.getBoundingClientRect().height > parseFloat(getComputedStyle(node).fontSize) * 1.9)
        .map(node => node.textContent));
      assert.deepEqual(wrapped, [], `${label} at ${width}px: amounts wrap`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${label} at ${width}px: sideways scroll`);
      if (shots) await page.screenshot({ path: path.join(shots, `${label.replace(/\W+/g, '-')}-${width}.png`), fullPage: true });
    };
    // Controls that take the person backwards: one worded control for the previous step, plus the close X on deeper steps.
    const backControls = card => card.getByRole('button').evaluateAll(nodes => nodes.filter(node => node.checkVisibility())
      .map(node => (node.textContent || '').trim() || node.getAttribute('aria-label')).filter(name => /^(Back|Close)\b/.test(name)));

    // 1. A receipt whose photo showed no date and no currency, matched to the bank purchase that settles both.
    {
      const { context, page, workspace, card, failures } = await open('partial');
      await card.getByText('Date not read', { exact: true }).waitFor();
      await card.getByText('currency not read', { exact: true }).waitFor();
      assert.doesNotMatch(await card.innerText(), /uncertain|unknown/i, 'one word for a gap');
      assert.deepEqual(await backControls(card), ['Close receipt']);
      await layout(page, 'partial receipt');
      await card.getByRole('button', { name: 'Reconcile', exact: true }).click();
      await card.getByRole('heading', { name: 'Suggested purchases' }).waitFor();
      assert.deepEqual(await backControls(card), ['Back to receipt', 'Close receipt']);
      assert.equal(await card.getByRole('button', { name: 'Reconcile', exact: true }).count(), 0);
      await layout(page, 'partial suggestions');
      await card.getByRole('button', { name: /Similar merchant and same printed amount/ }).click();
      const review = card.getByRole('region', { name: 'Confirm a manual match' }); await review.waitFor();
      assert.deepEqual(await backControls(card), ['Back to suggestions', 'Close receipt', 'Choose another purchase'].filter(name => /^(Back|Close)/.test(name)));
      await layout(page, 'partial compare');
      await card.getByRole('button', { name: 'Back to suggestions', exact: true }).click();
      await card.getByRole('heading', { name: 'Suggested purchases' }).waitFor();
      await card.getByRole('button', { name: 'Back to receipt', exact: true }).click();
      await card.getByRole('button', { name: 'Reconcile', exact: true }).click();
      await card.getByRole('button', { name: /Similar merchant and same printed amount/ }).click();
      await review.getByRole('button', { name: 'Confirm this match' }).click();
      const toBank = card.getByRole('link', { name: 'Open matched bank purchase', exact: true }); await toBank.waitFor();
      // The confirmed match settles the date and currency, and says the bank is the source.
      await card.getByText('from bank', { exact: true }).waitFor();
      await card.getByText('currency from bank', { exact: true }).waitFor();
      const settled = await card.innerText();
      assert.doesNotMatch(settled, /uncertain|unknown|not read/i, 'no gap is left on a matched receipt the bank settled');
      assert.match(settled, /Posted \w{3} \d{1,2}, \d{4}/); assert.match(settled, /\$24\.00/);
      assert.match(settled, /Bank purchase: Marina Market · Posted .* · \$24\.00 · Ref c-a-1041/);
      assert.deepEqual(await backControls(card), ['Close receipt']);
      await layout(page, 'partial matched');
      // The link reads the same from both sides.
      await toBank.click();
      await workspace.getByText(/Matched receipt: Marina Market/).waitFor();
      assert.doesNotMatch(await workspace.locator('.cc-bank-purchases').innerText(), /uncertain|unknown|not read/i, 'the bank side shows the same settled facts');
      await layout(page, 'matched bank purchase');
      await workspace.getByRole('link', { name: 'Open matched receipt', exact: true }).click();
      await toBank.waitFor();
      await card.getByText('currency from bank', { exact: true }).waitFor();
      assert.deepEqual(await backControls(card), ['Back to bank purchase']);
      assert.deepEqual(failures, []); await context.close();
    }

    // 2. The automatic search suggests nothing, yet two saved purchases carry the receipt's merchant and amount.
    {
      const { context, page, card, failures } = await open('empty');
      await card.getByRole('button', { name: 'Reconcile', exact: true }).click();
      await card.getByRole('heading', { name: '2 saved purchases from Marina Market', exact: true }).waitFor();
      assert.equal(await card.getByText('No matching purchase found').count(), 0);
      const rows = card.locator('button.cc-bank-purchase-row');
      assert.equal(await rows.count(), 2);
      for (const ref of ['c-a-1041', 'c-b-1042']) assert.equal(await rows.filter({ hasText: 'Ref ' + ref }).filter({ hasText: 'Same merchant name and amount' }).count(), 1);
      await card.getByText(/The bank reference \(Ref\) is the only saved detail that tells them apart/).waitFor();
      await layout(page, 'empty suggestions');
      await rows.filter({ hasText: 'c-b-1042' }).click();
      const review = card.getByRole('region', { name: 'Confirm a manual match' }); await review.waitFor();
      assert.match(await review.innerText(), /Ref c-b-1042/);
      assert.deepEqual(await backControls(card), ['Back to suggestions', 'Close receipt']);
      await layout(page, 'empty compare');
      await card.getByRole('button', { name: 'Back to suggestions', exact: true }).click();
      await card.getByRole('button', { name: 'Find a purchase manually' }).click();
      await card.getByRole('search', { name: 'Find a bank purchase' }).waitFor();
      assert.deepEqual(await backControls(card), ['Back to suggestions', 'Close receipt']);
      await card.getByRole('button', { name: 'Close receipt' }).click();
      await page.locator('.cc-receipts:visible').getByRole('heading', { name: 'Saved receipts' }).waitFor();
      assert.deepEqual(failures, []); await context.close();
    }

    // 3. Two exact candidates that the bank data cannot tell apart: amounts stay whole and the difference is named.
    {
      const { context, page, card, failures } = await open('');
      await card.getByRole('button', { name: 'Reconcile', exact: true }).click();
      await card.getByRole('radio').first().waitFor();
      assert.equal(await card.getByRole('radio').count(), 2);
      await card.getByText(/The bank reference \(Ref\) is the only saved detail that tells them apart/).waitFor();
      await layout(page, 'two candidates');
      await card.getByText('Receipt details', { exact: true }).click();
      const labels = await card.locator('.cc-receipt-breakdown dt').allInnerTexts();
      assert.deepEqual(labels, ['Subtotal', 'Tax', 'Printed total (before tip)', 'Tip', 'Final total']);
      await layout(page, 'receipt details');
      // Disclosures keep <details> semantics but drop the browser triangle.
      assert.equal(await card.locator('details > summary').first().evaluate(node => getComputedStyle(node).listStyleType), 'none');
      assert.deepEqual(failures, []); await context.close();
    }
  }
  console.log('PASS: a confirmed match settles the receipt date and currency with their source, amounts stay on one line at 320 and 390 px, each step has one back control, saved purchases with the receipt merchant replace "no match", look-alike purchases are named, receipt and bank purchase link both ways. Synthetic only.');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
