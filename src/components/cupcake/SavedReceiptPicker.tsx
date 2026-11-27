import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { accountData } from './accountSession';
import { dateText, purchaseMoney } from './bankPurchaseModel';
import { purchaseLinkClick, receiptWorkspaceUrl, type ReceiptRoute } from './receiptNavigation';
import './manual-purchase-picker.css';

type SavedReceipt = {
  id: string; merchant: string | null; date: string | null; total: number | null;
  expectedTotal?: number | null; grandTotal?: number | null; currency: string | null; status: string;
  matchedTransactionId?: string | null; paidWithCash?: boolean; paymentMethod?: string | null;
  printedPaymentMethod?: string | null; duplicateOf?: string | null; excludeFromTotals?: boolean;
};
const pageSize = 12;
const receiptAmount = (receipt: SavedReceipt) => receipt.expectedTotal ?? receipt.grandTotal ?? receipt.total;

export function SavedReceiptPicker({ transaction, cashReceiptIds, onNavigate }: {
  transaction: string; cashReceiptIds?: ReadonlySet<string>; onNavigate: (route: ReceiptRoute) => void;
}) {
  const [receipts, setReceipts] = useState<SavedReceipt[] | null>(null);
  const [term, setTerm] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    accountData<{receipts: SavedReceipt[]}>({action:'receipt_list'}, controller.signal).then(result => {
      if (!Array.isArray(result.receipts)) throw Error('Receipt list unavailable');
      if (!controller.signal.aborted) setReceipts(result.receipts);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [retry]);
  const query = term.trim().toLocaleLowerCase();
  const matches = (receipts || []).filter(receipt => {
    if (receipt.status !== 'extracted' || receipt.matchedTransactionId || receipt.paidWithCash ||
        cashReceiptIds?.has(receipt.id) || receipt.duplicateOf || receipt.excludeFromTotals ||
        ['cash','mixed','other'].includes(receipt.paymentMethod || receipt.printedPaymentMethod || '')) return false;
    const amount = receiptAmount(receipt);
    const [year, month, day] = (receipt.date || '').slice(0,10).split('-');
    const numericDates = day ? [month+'/'+day+'/'+year, Number(month)+'/'+Number(day)+'/'+year] : [];
    return [receipt.merchant, receipt.date, dateText(receipt.date), ...numericDates, amount?.toFixed(2), purchaseMoney(amount, receipt.currency)]
      .some(value => value?.toLocaleLowerCase().includes(query));
  });
  return <div className="cc-manual-purchase">
    <form role="search" aria-label="Find a saved receipt" onSubmit={event => event.preventDefault()}>
      <label>Merchant, date or amount
        <input type="search" value={term} autoComplete="off" maxLength={160} onChange={event => { setTerm(event.target.value); setLimit(pageSize); }}/>
      </label>
    </form>
    {failed ? <p role="alert">Couldn’t load saved receipts. <button type="button" className="cc-text-button" onClick={() => setRetry(value => value+1)}>Try again</button></p> :
      !receipts ? <p role="status">Loading saved receipts…</p> : <>
        {receipts.length >= 200 && <p className="cc-muted cc-small">Search covers your latest 200 saved receipts.</p>}
        {!matches.length && <p role="status">{query ? 'No available saved receipts match your search.' : 'No read receipts are available to match.'}</p>}
        {matches.slice(0, limit).map(receipt => {
          const route = {receipt:receipt.id, transaction, manual:true};
          return <a key={receipt.id} className="cc-bank-purchase-row" href={receiptWorkspaceUrl(route)}
            onClick={event => purchaseLinkClick(event, () => onNavigate(route))}>
            <span><strong>{receipt.merchant || 'Merchant unavailable'}</strong><small>{dateText(receipt.date)}</small></span>
            <span>{purchaseMoney(receiptAmount(receipt),receipt.currency)} <ChevronRight size={15} aria-hidden="true"/></span>
          </a>;
        })}
        {matches.length > limit && <button type="button" className="cc-secondary" onClick={() => setLimit(value=>value+pageSize)}>Show more receipts</button>}
      </>}
  </div>;
}
