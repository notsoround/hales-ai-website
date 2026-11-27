// What a receipt can truthfully say about its date and amount, and where each fact came from.
// A receipt keeps only what was read from its photo. After it is linked to a bank purchase the
// bank's own record can settle a fact the photo did not show; that fact is then labelled as the bank's.

export type LinkedPurchase = {
  transactionId: string; merchant: string | null; date: string; authorizedDate?: string | null;
  amount: number | null; currency: string | null; pending?: boolean; matchedReceiptId?: string | null; matchConflict?: boolean;
};
/** `tag` is a short source or gap label shown beside the value, never inside it. */
export type Fact = { text: string; tag?: string; settled: boolean };

export const NOT_READ = 'not read';

const validDay = (value: string | null | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validCurrency = (value: string | null | undefined): value is string => !!value && /^[A-Z]{3}$/.test(value);

export function dayText(value: string | null | undefined) {
  if (!validDay(value)) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

export function amountText(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '';
  if (validCurrency(currency)) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); } catch { /* fall through */ }
  }
  return amount.toFixed(2);
}

/** Only a purchase the server reports as linked to this very receipt may settle its facts. */
export function linkedTo(receiptId: string, matchedTransactionId: string | null | undefined, purchase: LinkedPurchase | null | undefined): LinkedPurchase | null {
  return !!purchase && !!matchedTransactionId && purchase.transactionId === matchedTransactionId
    && purchase.matchedReceiptId === receiptId && purchase.matchConflict !== true ? purchase : null;
}

export function receiptDateFact(receiptDate: string | null | undefined, linked?: LinkedPurchase | null): Fact {
  if (validDay(receiptDate)) return { text: dayText(receiptDate), settled: true };
  // The bank's authorized date is the day of purchase; its posting date can be days later, so say which one this is.
  if (linked && validDay(linked.authorizedDate)) return { text: dayText(linked.authorizedDate), tag: 'from bank', settled: true };
  if (linked && validDay(linked.date)) return { text: `Posted ${dayText(linked.date)}`, tag: 'from bank', settled: true };
  return { text: `Date ${NOT_READ}`, settled: false };
}

export function receiptAmountFact(amount: number | null | undefined, currency: string | null | undefined, linked?: LinkedPurchase | null): Fact {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return { text: `Amount ${NOT_READ}`, settled: false };
  if (validCurrency(currency)) return { text: amountText(amount, currency), settled: true };
  // The bank currency applies to the receipt's number only when the bank charged that same number.
  if (linked && validCurrency(linked.currency) && linked.amount === amount)
    return { text: amountText(amount, linked.currency), tag: 'currency from bank', settled: true };
  return { text: amount.toFixed(2), tag: `currency ${NOT_READ}`, settled: false };
}

/** Purchases that the saved bank data cannot tell apart except by reference. */
export function lookAlikes<T extends { transactionId: string; merchant: string | null; date: string; amount: number | null; currency: string | null }>(rows: readonly T[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const key = [(row.merchant || '').trim().toLowerCase(), row.date, row.amount, row.currency].join('|');
    groups.set(key, [...(groups.get(key) || []), row.transactionId]);
  }
  return new Set([...groups.values()].filter(ids => ids.length > 1).flat());
}
export const LOOK_ALIKE_NOTE = 'These purchases share a merchant, date and amount. The bank reference (Ref) is the only saved detail that tells them apart.';

/** Order and names follow the receipt's own arithmetic: subtotal + tax = printed total; printed total + tip = final total. */
export function receiptBreakdown(receipt: { subtotal?: number | null; tax: number | null; total: number | null; tip: number | null; grandTotal?: number | null; totalIncludesTip?: boolean | null }) {
  const rows: { label: string; amount: number | null }[] = [];
  if (receipt.subtotal != null) rows.push({ label: 'Subtotal', amount: receipt.subtotal });
  if (receipt.tax != null) rows.push({ label: 'Tax', amount: receipt.tax });
  const hasTip = receipt.tip != null && receipt.tip !== 0;
  rows.push({ label: !hasTip || receipt.totalIncludesTip == null ? 'Printed total' : receipt.totalIncludesTip ? 'Printed total (tip included)' : 'Printed total (before tip)', amount: receipt.total });
  rows.push({ label: 'Tip', amount: receipt.tip });
  if (receipt.grandTotal != null) rows.push({ label: 'Final total', amount: receipt.grandTotal });
  return rows;
}

export type BankSide = { transactionId: string; merchant: string | null; date: string; authorizedDate?: string | null; amount: number | null; currency: string | null; pending: boolean };
export type Check = { state: 'yes' | 'no' | 'gap'; text: string };
const day = (value: string | null | undefined) => value && /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(value.slice(0, 10) + 'T12:00:00Z') : NaN;

/** What the two sides agree on, in words. Nothing here is inferred beyond the saved fields. */
export function agreement(receipt: { merchant: string | null; date: string | null; currency: string | null; total: number | null; grandTotal?: number | null; expectedTotal?: number | null }, purchase: BankSide): Check[] {
  const amount = receipt.expectedTotal ?? receipt.grandTotal ?? receipt.total, name = receipt.merchant?.trim().toLowerCase() || '', bankName = purchase.merchant?.trim().toLowerCase() || '';
  const gap = Math.round(Math.abs(day(purchase.authorizedDate || purchase.date) - day(receipt.date)) / 86_400_000);
  return [
    amount == null || purchase.amount == null ? { state: 'gap', text: 'Amount not read' }
      : amount !== purchase.amount ? { state: 'no', text: 'Amount differs' }
      : receipt.currency && receipt.currency !== purchase.currency ? { state: 'no', text: 'Currency differs' }
      : { state: 'yes', text: 'Same amount' },
    !name || !bankName ? { state: 'gap', text: 'Merchant not read' }
      : name.includes(bankName) || bankName.includes(name) ? { state: 'yes', text: 'Same merchant' } : { state: 'no', text: 'Merchant name differs' },
    !Number.isFinite(gap) ? { state: 'gap', text: 'Receipt date not read' }
      : gap === 0 ? { state: 'yes', text: 'Same day' } : { state: gap <= 3 ? 'yes' : 'no', text: `${gap} ${gap === 1 ? 'day' : 'days'} apart` },
  ];
}

