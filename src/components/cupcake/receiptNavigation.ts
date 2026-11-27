import type { MouseEvent } from 'react';
export type ReceiptRoute = { receipt?: string; transaction?: string; bank?: boolean };

export function currentReceiptRoute(): ReceiptRoute {
  const params = new URLSearchParams(location.search);
  return { receipt: params.get('receipt') || undefined, transaction: params.get('transaction') || undefined, bank: params.get('receiptTab') === 'bank' };
}

export function receiptWorkspaceUrl(route: ReceiptRoute, from = location.href) {
  const url = new URL(from);
  url.searchParams.set('tab', url.searchParams.get('tab') === 'snap' ? 'snap' : 'library');
  url.searchParams.set('view', 'receipts');
  for (const key of ['receipt', 'transaction', 'receiptTab']) url.searchParams.delete(key);
  if (route.receipt) url.searchParams.set('receipt', route.receipt);
  if (route.transaction) url.searchParams.set('transaction', route.transaction);
  if (route.bank && !route.transaction && !route.receipt) url.searchParams.set('receiptTab', 'bank');
  return url.pathname + url.search;
}

export function purchaseLinkClick(event: MouseEvent<HTMLAnchorElement>, navigate: () => void) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); navigate();
}
