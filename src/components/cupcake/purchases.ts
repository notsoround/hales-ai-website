// Café / takeout purchases from the cupcake-feed transactions, shown on the
// energy curve as BOUGHT markers. Context only: a purchase is never counted as
// food eaten; only logged meals count. Classification mirrors the regexes used
// by the cupcake-nutrition Gateway plugin (cupcake-opolis extensions/cupcake-nutrition/src/sources.ts).
export const PREPARED = /fast[- ]?food|restaurant|coffee|caf[eé]|bakery|candy|confection|dessert/i;
export const FOOD = /food|grocer|restaurant|coffee|caf[eé]|bakery|candy|confection|dessert/i;

export type BoughtMarker = { id: string; at: number; merchant: string; amount: number; currency: string; category: string };
type FeedLike = { id?: string; type?: string; title?: string; ts?: number; date?: string; time?: string; amount?: number | null; currency?: string | null; category?: unknown; details?: Record<string, unknown> | null };

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Prepared-food purchases (café, restaurant, bakery, candy…) at or after `since`, oldest first. Groceries are excluded. */
export function preparedPurchases(items: readonly FeedLike[] | null | undefined, since: number, until = Number.POSITIVE_INFINITY): BoughtMarker[] {
  if (!items) return [];
  return items.flatMap((item, index): BoughtMarker[] => {
    if (item.type !== 'transaction') return [];
    const details = item.details || {};
    const category = text(item.category) || text(details.category);
    const merchant = text(details.merchant) || text(item.title) || 'Purchase';
    const amount = typeof item.amount === 'number' ? item.amount : Number(details.amount);
    const at = typeof item.ts === 'number' && Number.isFinite(item.ts) ? item.ts : NaN;
    if (!Number.isFinite(at) || at < since || at > until || !Number.isFinite(amount) || amount <= 0) return [];
    if (!(FOOD.test(category) || PREPARED.test(merchant))) return [];
    if (!(PREPARED.test(category) || PREPARED.test(merchant))) return [];
    return [{ id: item.id || `purchase-${index}-${at}`, at, merchant: merchant.slice(0, 80), amount: Math.round(amount * 100) / 100, currency: text(item.currency) || 'USD', category: category.toLowerCase() }];
  }).sort((a, b) => a.at - b.at);
}
