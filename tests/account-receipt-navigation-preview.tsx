// Load the regular account app against an isolated synthetic bank and receipt ledger.
if (!import.meta.env.DEV) throw Error('Development fixture only');
const today = new Date().toISOString().slice(0, 10);
const receiptId = 'receipt_' + 'c'.repeat(32);
const matchedAtStart = 'receipt_' + 'd'.repeat(32);
const transactions = ['synthetic-a-1041', 'synthetic-b-1042', 'synthetic-c-1043'];
const original = { id: receiptId, merchant: 'Marina Market', date: today, createdAt: today + 'T11:00:00Z', total: 24, grandTotal: 24, currency: 'USD', tip: 2, tax: 1, lineItems: [{ description:'Lunch',quantity:1,amount:24 }], status: 'extracted' };
const standard = { id: matchedAtStart, merchant: 'Harbor Bakery', date: today, createdAt: today + 'T08:00:00Z', total: 8, currency:'USD',tax:null,tip:null,lineItems:[],status:'matched',matchedTransactionId:transactions[2],matchMethod:'automatic' };
const chosen = () => sessionStorage.getItem('synthetic-receipt-match');
const receipts = () => [{ ...original, status: chosen() ? 'matched' : 'extracted', matchedTransactionId: chosen(), matchMethod: chosen() ? 'confirmed' : null },standard];
const purchases = () => transactions.map((transactionId, index) => ({ transactionId, merchant: index < 2 ? 'Marina Market' : 'Harbor Bakery', date: today, amount:index < 2 ? 24 : 8,currency:'USD',pending:false,matchedReceiptId:index === 2 ? matchedAtStart : chosen() === transactionId ? receiptId : null }));
const confirms: string[] = [];
const noSuggestedMatch = new URLSearchParams(location.search).get('reconcile') === 'empty';
const scope = 'acc_synthetic_a';
function respond(owner: string, body: Record<string, unknown>): object | undefined {
  if (owner !== scope) return;
  if (body.action === 'bank_connection_status') return { configured:true,connections:[] };
  if (body.action === 'receipt_list') {
    const list = receipts();
    if (!noSuggestedMatch) return {receipts:list};
    const cash = {...original, id:'receipt_'+'e'.repeat(32), merchant:'Cash only fixture', printedPaymentMethod:'cash'};
    const unread = {...original, id:'receipt_'+'f'.repeat(32), merchant:'Unread fixture', status:'saved_unread'};
    return {receipts:[...list,cash,unread]};
  }
  if (body.action === 'bank_purchase_list') {
    const term = String(body.query || '').trim().toLowerCase();
    return {purchases:purchases().filter(p=>[p.merchant,p.amount,p.transactionId,p.date].some(value=>String(value).toLowerCase().includes(term))),hasMore:false,nextCursor:null};
  }
  if (body.action === 'receipt_manual_match') {
    const row=purchases().find(p=>p.transactionId===body.transactionId);
    const expected=body.expectedPurchase as Record<string,unknown> | null;
    if (!row || row.matchedReceiptId || body.receiptId!==receiptId || body.acknowledgeDifferences!==true || body.expectedRevision!==0 ||
        !expected || expected.merchant!==row.merchant || expected.amount!==row.amount || expected.currency!==row.currency || expected.date!==row.date || expected.authorizedDate!==null)
      throw Error('Unexpected synthetic manual match');
    confirms.push(row.transactionId);sessionStorage.setItem('synthetic-receipt-match',row.transactionId);return {receipt:receipts()[0]};
  }
  if (body.action === 'bank_purchase_get') {
    const purchase=purchases().find(p=>p.transactionId===body.transactionId);
    if (!purchase) throw Error('Unknown synthetic purchase');
    return {purchase,receiptCandidates: noSuggestedMatch || purchase.matchedReceiptId || chosen() ? [] : [{receiptId,merchant:original.merchant,date:today,total:24,currency:'USD',exactAmount:true,exactCurrency:true,dateDifferenceDays:0}]};
  }
  if(body.action==='receipt_get') return {receipt:receipts().find(r=>r.id===body.receiptId)};
  if(body.action==='receipt_match_candidates') return {receipt:receipts()[0], candidates:noSuggestedMatch ? [] : purchases().slice(0,2).map(p=>({...p,exactAmount:true,exactCurrency:true})),coverage:{complete:true,startDate:today,endDate:today}};
  if(body.action==='receipt_confirm_match') {
    if(body.receiptId!==receiptId||!transactions.slice(0,2).includes(String(body.transactionId))) throw Error('Unexpected synthetic match');
    confirms.push(String(body.transactionId));sessionStorage.setItem('synthetic-receipt-match',String(body.transactionId));return {receipt:receipts()[0]};
  }
  if(body.action==='receipt_unlink_match') {
    if(body.receiptId!==receiptId||body.transactionId!==chosen()) throw Error('Wrong synthetic link');
    sessionStorage.removeItem('synthetic-receipt-match');
    return {receipt:receipts()[0]};
  }
  if(body.action==='receipt_meal_choices') return {linkedMealId:null,meals:[],truncated:false};
}
localStorage.setItem('synthetic-account-server',scope);
Object.assign(window,{syntheticReceiptNavigation:respond,receiptNavFixture:{receiptId,matchedAtStart,transactions,confirms}});
await import('./account-browser-preview');
export {};
