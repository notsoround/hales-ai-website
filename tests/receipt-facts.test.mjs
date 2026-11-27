// What a receipt may say about its date and amount, before and after it is linked to a bank purchase. Fictional data only.
import assert from 'node:assert/strict';
import { linkedTo, lookAlikes, receiptAmountFact, receiptBreakdown, receiptDateFact } from '../src/components/cupcake/receiptFacts.ts';

const receiptId = 'receipt_' + 'c'.repeat(32);
const bank = { transactionId: 'synthetic-a-1041', merchant: 'Marina Market', date: '2026-11-27', authorizedDate: null, amount: 24, currency: 'USD', matchedReceiptId: receiptId };

// Before a match, a gap is a small tag beside the value and one word is used for it.
assert.deepEqual(receiptDateFact(null), { text: 'Date not read', settled: false });
assert.deepEqual(receiptAmountFact(24, null), { text: '24.00', tag: 'currency not read', settled: false });
assert.deepEqual(receiptAmountFact(null, 'USD'), { text: 'Amount not read', settled: false });
for (const fact of [receiptDateFact(null), receiptAmountFact(24, null), receiptDateFact('2026-02-30')])
  assert.doesNotMatch(fact.text + (fact.tag || ''), /uncertain|unknown/i);

// What the photo showed always wins and carries no tag.
assert.deepEqual(receiptDateFact('2026-11-26', bank), { text: 'Nov 26, 2026', settled: true });
assert.deepEqual(receiptAmountFact(24, 'USD', bank), { text: '$24.00', settled: true });

// After a match the bank settles the gaps, and each settled fact says it came from the bank.
assert.deepEqual(receiptDateFact(null, bank), { text: 'Posted Nov 27, 2026', tag: 'from bank', settled: true });
assert.deepEqual(receiptDateFact(null, { ...bank, authorizedDate: '2026-11-26' }), { text: 'Nov 26, 2026', tag: 'from bank', settled: true });
assert.deepEqual(receiptAmountFact(24, null, bank), { text: '$24.00', tag: 'currency from bank', settled: true });

// The bank's currency is not put on a receipt figure the bank did not charge (a foreign receipt, a later tip).
assert.deepEqual(receiptAmountFact(22, null, bank), { text: '22.00', tag: 'currency not read', settled: false });
assert.deepEqual(receiptAmountFact(24, null, { ...bank, currency: null }), { text: '24.00', tag: 'currency not read', settled: false });

// Only the purchase the server reports as linked to this receipt may settle anything.
assert.equal(linkedTo(receiptId, bank.transactionId, bank), bank);
assert.equal(linkedTo(receiptId, bank.transactionId, { ...bank, matchedReceiptId: null }), null);
assert.equal(linkedTo(receiptId, bank.transactionId, { ...bank, matchedReceiptId: 'receipt_other' }), null);
assert.equal(linkedTo(receiptId, 'synthetic-b-1042', bank), null);
assert.equal(linkedTo(receiptId, bank.transactionId, { ...bank, matchConflict: true }), null);
assert.equal(linkedTo(receiptId, null, bank), null);

// Two purchases the saved bank data cannot tell apart are flagged; different ones are not.
const twin = { ...bank, transactionId: 'synthetic-b-1042' }, other = { ...bank, transactionId: 'synthetic-c-1043', merchant: 'Harbor Bakery', amount: 8 };
assert.deepEqual([...lookAlikes([bank, twin, other])].sort(), ['synthetic-a-1041', 'synthetic-b-1042']);
assert.equal(lookAlikes([bank, other, { ...twin, date: '2026-11-26' }]).size, 0);

// The breakdown is listed in the order of its arithmetic and says whether the printed total includes the tip.
assert.deepEqual(receiptBreakdown({ subtotal: 21, tax: 1, total: 22, tip: 2, totalIncludesTip: false, grandTotal: 24 }),
  [{ label: 'Subtotal', amount: 21 }, { label: 'Tax', amount: 1 }, { label: 'Printed total (before tip)', amount: 22 }, { label: 'Tip', amount: 2 }, { label: 'Final total', amount: 24 }]);
assert.deepEqual(receiptBreakdown({ tax: null, total: 24, tip: 2, totalIncludesTip: true }).map(row => row.label), ['Printed total (tip included)', 'Tip']);
assert.deepEqual(receiptBreakdown({ tax: null, total: 24, tip: 2, totalIncludesTip: null }).map(row => row.label), ['Printed total', 'Tip']);
assert.deepEqual(receiptBreakdown({ tax: null, total: 8, tip: null }).map(row => row.label), ['Printed total', 'Tip']);
console.log('PASS: receipt facts keep photo values, label bank-settled facts, never borrow a currency for a different amount, flag look-alike purchases. Synthetic only.');
