export type Purchase = {
  transactionId: string; merchant: string | null; date: string; authorizedDate?: string | null;
  amount: number | null; currency: string | null; pending: boolean; removed?: boolean; matchedReceiptId: string | null; matchConflict?: boolean;
};

export const purchaseMoney = (amount: number | null, currency: string | null) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Amount unavailable';
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return amount.toFixed(2) + ' · currency unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};
export function dateText(raw: string | null | undefined) {
  if (!raw) return 'Date unavailable';
  const date = new Date(raw.slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : raw;
}
