// Match deck: one receipt at a time with the possible bank match beside it, one confirm, arrows/swipe/keys to move,
// and every other route (other candidates, manual search, cash, the full receipt) still one tap away. Fictional data only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { agreement } from '../src/components/cupcake/receiptFacts.ts';

// What the two sides agree on is stated from saved fields only.
const r = { id: 'receipt_x', status: 'extracted', merchant: 'Marina Market', date: '2026-11-27', currency: 'USD', total: 24, tax: null, tip: null, lineItems: [], matchedTransactionId: null, createdAt: '' };
const p = { transactionId: 'synthetic-a-1041', merchant: 'MARINA MARKET #12', date: '2026-11-29', authorizedDate: '2026-11-27', amount: 24, currency: 'USD', pending: false };
assert.deepEqual(agreement(r, p).map(c => [c.state, c.text]), [['yes', 'Same amount'], ['yes', 'Same merchant'], ['yes', 'Same day']]);
assert.deepEqual(agreement({ ...r, date: null, currency: null }, { ...p, authorizedDate: null, amount: 26, merchant: 'Harbor Bakery' }).map(c => [c.state, c.text]),
  [['no', 'Amount differs'], ['no', 'Merchant name differs'], ['gap', 'Receipt date not read']]);
assert.deepEqual(agreement({ ...r, date: '2026-11-20' }, { ...p, authorizedDate: null, currency: 'CAD' }).map(c => c.text), ['Currency differs', 'Same merchant', '9 days apart']);

const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-receipt-deck-'));
const server = await createServer({ cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"' },
  plugins: [{ name:'synthetic-bank-workspace', configureServer(s) { s.middlewares.use((req,_res,next) => {
    if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-receipt-navigation-preview.html';
    next();
  }); } }], server: { host:'127.0.0.1', port:0, hmr:false, fs:{ allow:[process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch();
const shots = process.env.RECEIPT_DECK_SHOTS;
try {
  for (const width of [320, 390, 1280]) {
    const open = async mode => {
      const context = await browser.newContext({ viewport: { width, height: 845 }, serviceWorkers: 'block', hasTouch: width < 500 });
      const page = await context.newPage(); page.setDefaultTimeout(9000);
      const failures = []; page.on('pageerror', e => failures.push(e.message));
      await page.route('**/*', q => { const u = new URL(q.request().url()); return u.origin === base || u.protocol === 'data:' || u.protocol === 'blob:' ? q.continue() : q.abort(); });
      await page.goto(`${base}/cupcake/account?tab=library&view=receipts${mode ? '&reconcile=' + mode : ''}`);
      const workspace = page.locator('.cc-receipts:visible'), deck = workspace.getByRole('region', { name: 'Match receipts' });
      await deck.waitFor();
      return { context, page, workspace, deck, failures };
    };
    const tidy = async (page, label) => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${label} at ${width}px scrolls sideways`);
      const small = await page.evaluate(() => [...document.querySelectorAll('.cc-deck button')].filter(b => b.checkVisibility() && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map(b => b.textContent || b.getAttribute('aria-label')));
      assert.deepEqual(small, [], `${label} at ${width}px has small touch targets`);
      if (shots) await page.screenshot({ path: path.join(shots, `${label.replace(/\W+/g, '-')}-${width}.png`), fullPage: true });
    };

    // 1. The deck finds the purchase itself; one tap confirms an exact match; the deck then says it is all caught up.
    {
      const { context, page, workspace, deck, failures } = await open('');
      const bank = deck.locator('.cc-deck-side.is-bank');
      await bank.getByText('Possible match · 1 of 2').waitFor();
      assert.match(await bank.innerText(), /Marina Market[\s\S]*\$24\.00[\s\S]*Posted .* · Ref c-a-1041/);
      assert.deepEqual(await deck.getByRole('list', { name: 'How they compare' }).getByRole('listitem').allInnerTexts(), ['Same amount', 'Same merchant', 'Same day']);
      await deck.getByText(/identical to another purchase, told apart only by the Ref/).waitFor();
      assert.equal(await deck.getByRole('button', { name: 'Next receipt' }).count(), 0, 'one receipt needs no pager');
      await tidy(page, 'deck exact');
      // "Not this one" shows the other candidate without leaving the card.
      await deck.getByRole('button', { name: 'Not this one' }).click();
      await bank.getByText('Possible match · 2 of 2').waitFor();
      assert.match(await bank.innerText(), /Ref c-b-1042/);
      assert.deepEqual(await page.evaluate(() => window.receiptNavFixture.confirms), []);
      await deck.getByRole('button', { name: 'Yes, it’s a match' }).click();
      await deck.getByText('All caught up.').waitFor();
      assert.deepEqual(await page.evaluate(() => window.receiptNavFixture.confirms), ['synthetic-b-1042']);
      await tidy(page, 'deck done');
      // The matched receipt links to that purchase, as before.
      await workspace.getByRole('button', { name: /Marina Market/ }).first().click();
      await workspace.getByText(/Bank purchase: Marina Market .* Ref c-b-1042/).waitFor();
      assert.deepEqual(failures, []); await context.close();
    }

    // 2. Several receipts: arrows, keys and swipe move between them; a receipt with nothing to offer says so and routes to search.
    {
      const { context, page, workspace, deck, failures } = await open('empty');
      await deck.getByText('2 to match').waitFor();
      const card = deck.getByRole('group');
      assert.match(await card.getAttribute('aria-label'), /Receipt 1 of 2: Marina Market/);
      const bank = deck.locator('.cc-deck-side.is-bank');
      await bank.getByText('Possible match · 1 of 2').waitFor();   // found by merchant and amount although the automatic search suggested nothing
      await deck.getByText('Same merchant name and amount', { exact: false }).first().waitFor();
      await tidy(page, 'deck leads');
      await deck.getByRole('button', { name: 'Next receipt' }).click();
      await card.getByText('Cash only fixture').waitFor();
      await bank.getByText('Nothing yet').waitFor();
      await tidy(page, 'deck nothing');
      await deck.getByRole('button', { name: 'Previous receipt' }).focus();
      await page.keyboard.press('ArrowLeft');
      await card.getByText('Marina Market').first().waitFor();
      await page.keyboard.press('ArrowRight');
      await card.getByText('Cash only fixture').waitFor();
      // Swipe back with a finger or a mouse drag.
      const box = await deck.locator('.cc-deck-pair').boundingBox();
      await page.mouse.move(box.x + 40, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 180, box.y + 24, { steps: 4 }); await page.mouse.up();
      await card.getByText('Marina Market').first().waitFor();
      // Both tries exhausted: the card offers search instead of a dead end.
      await deck.getByRole('button', { name: 'Not this one' }).click();
      await deck.getByRole('button', { name: 'Not a match' }).click();
      await bank.getByText('None of those').waitFor();
      await deck.getByRole('button', { name: 'Search bank purchases' }).click();
      await workspace.getByRole('search', { name: 'Find a bank purchase' }).waitFor();
      await workspace.getByRole('button', { name: 'Close receipt' }).click();
      // A lead is linked with one tap and the deck moves on to what is left.
      await deck.getByRole('button', { name: 'Show them again' }).click();
      await deck.getByRole('button', { name: 'Yes, it’s a match' }).click();
      await deck.getByText('Marina Market matched. 1 to go.').waitFor();
      assert.deepEqual(await page.evaluate(() => window.receiptNavFixture.confirms), ['synthetic-a-1041']);
      await card.getByText('Cash only fixture').waitFor();
      // Cash and the full receipt stay one tap away.
      await deck.getByRole('button', { name: 'Open receipt' }).click();
      await workspace.locator('.cc-receipt-selected').getByRole('heading', { name: 'Cash only fixture' }).waitFor();
      await workspace.getByRole('button', { name: 'Close receipt' }).click();
      await deck.getByRole('button', { name: 'Paid with cash' }).click();
      await deck.getByText('All caught up.').waitFor();
      assert.deepEqual(failures, []); await context.close();
    }

    // 3. A receipt with gaps shows them as gaps on the card, beside the lead the server offered.
    {
      const { context, page, workspace, deck, failures } = await open('partial');
      await deck.locator('.cc-deck-side.is-bank').getByText('Possible match').waitFor();
      await deck.getByText('Date not read', { exact: true }).waitFor();
      await deck.getByText('Receipt date not read').waitFor();
      await tidy(page, 'deck partial');
      assert.deepEqual(failures, []); await context.close();
      void workspace;
    }
  }
  console.log('PASS: match deck shows one receipt with its possible bank match, confirms in one tap, cycles candidates, moves by arrows, keys and swipe, routes to search, cash and the full receipt, at 320, 390 and 1280 px. Synthetic only.');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
