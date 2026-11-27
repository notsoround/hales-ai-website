// Shared receipt-to-bank matching types and rules, used by the receipt workspace and the match deck.
import { accountData } from './accountSession';
import type { Purchase } from './bankPurchaseModel';

export type LineItem = { description: string; quantity: number | null; amount: number | null };
export type Receipt = {
  id: string; status: 'saved_unread' | 'extracting' | 'extraction_failed' | 'extracted' | 'matched'; createdAt: string;
  merchant: string | null; date: string | null; currency: string | null; total: number | null;
  grandTotal?: number | null; subtotal?: number | null; totalIncludesTip?: boolean | null;
  tax: number | null; tip: number | null; lineItems: LineItem[]; matchedTransactionId: string | null;
  matchRevision?: number; expectedTotal?: number | null; amountBasis?: string; amountWarning?: string | null; alternativeTotalWithTip?: number | null;
  printedPaymentMethod?: 'card' | 'cash' | 'mixed' | 'other' | null; matchMethod?: 'automatic' | 'confirmed' | null; paymentMethod?: string | null; paidWithCash?: boolean | null;
};
export type Candidate = {
  transactionId: string; merchant: string | null; date: string; authorizedDate?: string | null;
  amount: number; currency: string | null; pending: boolean; exactAmount?: boolean; exactCurrency?: boolean;
  amountDifference?: number | null; dateDifferenceDays?: number; merchantMatch?: string;
  reasons?: string[]; requiresAcknowledgment?: boolean;
};
export type Coverage = { startDate?: string; endDate?: string; checkedAt?: string; complete: boolean; fetchedTransactions?: number | null; reportedTransactions?: number | null; pages?: number | null; warnings?: string[] };
export type MatchSummary = { exactCount?: number; exactPostedCount?: number; pendingCount?: number; candidateCount?: number };
export type MatchResponse = { receipt: Receipt; candidates: Candidate[]; suggestedPurchases?: Purchase[]; coverage?: Coverage; matchSummary?: MatchSummary };
/** A saved purchase the automatic search did not suggest but that shares the receipt's merchant name or amount. */
export type Nearby = { purchase: Purchase; sameMerchant: boolean; sameAmount: boolean };

export const expectedTotal = (receipt: Receipt) => receipt.expectedTotal ?? receipt.grandTotal ?? receipt.total;
export const exact = (item: Candidate, receipt: Receipt) => item.exactAmount === true && item.exactCurrency === true || item.exactAmount == null && item.amount === expectedTotal(receipt) && item.currency === receipt.currency;
export const needsReview = (item: Candidate, receipt: Receipt, coverage?: Coverage | null) => item.requiresAcknowledgment === true || !exact(item, receipt) || coverage?.complete !== true;
// When the automatic search suggests nothing, look in the saved purchases for the receipt's own merchant name and amount,
// so the screen never says "nothing found" while a plain search would find the purchase.
export async function nearbyPurchases(receipt: Receipt): Promise<Nearby[]> {
  const amount = expectedTotal(receipt), merchant = receipt.merchant?.trim().toLowerCase() || '';
  const terms = [merchant.slice(0, 160), amount != null ? amount.toFixed(2) : ''].filter(Boolean);
  const pages = await Promise.all(terms.map(query => accountData<{ purchases: Purchase[] }>({ action: 'bank_purchase_list', query, limit: 12 })
    .then(page => Array.isArray(page.purchases) ? page.purchases : []).catch(() => [] as Purchase[])));
  const rows = new Map<string, Nearby>();
  for (const purchase of pages.flat()) {
    if (purchase.pending || purchase.removed || purchase.matchedReceiptId || purchase.matchConflict) continue;
    const sameMerchant = !!merchant && !!purchase.merchant?.toLowerCase().includes(merchant);
    const sameAmount = amount != null && purchase.amount === amount && (!receipt.currency || receipt.currency === purchase.currency);
    if (sameMerchant || sameAmount) rows.set(purchase.transactionId, { purchase, sameMerchant, sameAmount });
  }
  return [...rows.values()].sort((a, b) => Number(b.sameMerchant && b.sameAmount) - Number(a.sameMerchant && a.sameAmount)).slice(0, 12);
}
