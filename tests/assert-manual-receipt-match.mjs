import assert from 'node:assert/strict';

export async function checkManualReceiptMatch(page, listUrl) {
  const receiptId = 'receipt_' + 'c'.repeat(32);
  await page.evaluate(() => sessionStorage.removeItem('synthetic-receipt-match'));
  await page.goto(listUrl + '&receipt=' + receiptId);
  const receipt = page.locator('.cc-receipts:visible');
  const reconcile = receipt.getByRole('button', { name: 'Reconcile', exact: true });
  await reconcile.waitFor();
  const writes = () => page.evaluate(() => window.accountFixture.requests.filter(r => r.body?.action === 'receipt_manual_match').length);
  assert.equal(await receipt.getByRole('search').count(), 0);
  await reconcile.click();
  await receipt.getByText('No matching purchase found', { exact: true }).waitFor();
  await receipt.getByRole('button', { name: 'Find a purchase manually' }).click();
  const form = receipt.getByRole('search', { name: 'Find a bank purchase' });
  await form.getByRole('searchbox').fill('nothing-like-this');
  await form.getByRole('button', { name: 'Search purchases' }).click();
  await receipt.getByText(/No saved purchase matches/).waitFor();
  await form.getByRole('searchbox').fill('marina');
  await form.getByRole('button', { name: 'Search purchases' }).click();
  const alternatives = receipt.locator('button.cc-bank-purchase-row').filter({hasText:'Marina Market'});
  await alternatives.first().waitFor();
  assert.equal(await alternatives.count(), 2);
  await alternatives.filter({hasText:'1042'}).click();
  const review=receipt.getByRole('region', { name: 'Confirm a manual match' });
  await review.waitFor();
  assert.equal(await writes(), 0);
  await review.getByRole('button', { name: 'Back to results' }).click();
  await alternatives.filter({hasText:'1041'}).click();
  await review.getByRole('button', { name: 'Confirm this match' }).click();
  const bank=receipt.getByRole('link', {name:'Open matched bank purchase',exact:true});await bank.waitFor();
  assert.equal(await writes(), 1);
  await bank.click();
  assert.equal(new URL(page.url()).searchParams.get('transaction'),'synthetic-a-1041');
  await receipt.getByRole('link',{name:'Open matched receipt',exact:true}).click();
  await bank.waitFor();assert.equal(new URL(page.url()).searchParams.get('receipt'),receiptId);
}
