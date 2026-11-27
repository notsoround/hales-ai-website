import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { accountData } from './accountSession';
import { useDataChanged } from './dataChanges';
import { purchaseLinkClick, receiptWorkspaceUrl, type ReceiptRoute } from './receiptNavigation';
import { purchaseMoney, dateText, type Purchase } from './bankPurchaseModel';
import { SavedReceiptPicker } from './SavedReceiptPicker';

type PossibleReceipt = { receiptId: string; manualOnly?: boolean; merchant: string | null; date: string | null; total: number | null; currency: string | null; exactAmount: boolean; exactCurrency: boolean };
type PurchaseDetail = { purchase: Purchase; receiptCandidates: PossibleReceipt[]; candidatesComplete?: boolean };
type PurchasePage = { purchases: Purchase[]; hasMore: boolean; nextCursor?: string | null };

export function BankPurchaseBrowser({ transaction, cashReceiptIds, onNavigate, onBack }: { transaction?: string; cashReceiptIds?: ReadonlySet<string>; onNavigate: (route: ReceiptRoute) => void; onBack: () => void }) {
  const [detail, setDetail] = useState<PurchaseDetail | null>(null), [list, setList] = useState<Purchase[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null), [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0), [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false), [finding, setFinding] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useDataChanged(['purchase'], () => { setCursor(null); setRetry(value => value + 1); });
  useEffect(() => {
    const abort = new AbortController(); setError(''); setLoading(true); setDetail(null);
    const load = async () => {
      if (transaction) {
        const data = await accountData<PurchaseDetail>({ action: 'bank_purchase_get', transactionId: transaction }, abort.signal);
        if (data.purchase?.transactionId !== transaction || !Array.isArray(data.receiptCandidates)) throw Error('This saved purchase could not be verified.');
        if (!abort.signal.aborted) setDetail(data);
      } else {
        const data = await accountData<PurchasePage>({ action: 'bank_purchase_list', limit: 30, ...(cursor ? { cursor } : {}) }, abort.signal);
        if (!Array.isArray(data.purchases)) throw Error('The saved purchases could not be loaded.');
        if (data.hasMore && (!data.nextCursor || data.nextCursor === cursor)) throw Error('The purchase list could not load its next page.');
        if (!abort.signal.aborted) {
          setList(previous => cursor ? [...new Map([...(previous || []), ...data.purchases].map(p => [p.transactionId, p])).values()] : data.purchases);
          setNextCursor(data.hasMore ? data.nextCursor! : null);
        }
      }
    };
    void load().catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Saved purchases are unavailable.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [transaction, cursor, retry]);
  useEffect(() => { if (transaction) heading.current?.focus(); }, [transaction]);
  const linked = (route: ReceiptRoute, text: string, cls = 'cc-secondary') =>
    <a className={cls} href={receiptWorkspaceUrl(route)} onClick={event => purchaseLinkClick(event, () => onNavigate(route))}>{text}</a>;
  const purchase = detail?.purchase;
  return <section className="cc-card cc-bank-purchases" aria-label={transaction ? 'Bank purchase' : 'Bank purchases'}>
    {transaction && <button type="button" className="cc-text-button" onClick={onBack}>Back</button>}
    <h3 ref={heading} tabIndex={-1}>{transaction ? 'Bank purchase' : 'Saved bank purchases'}</h3>
    {loading && <p role="status">Loading saved {transaction ? 'purchase' : 'purchases'}…</p>}
    {error && <p role="alert">{error} <button type="button" className="cc-text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
    {!transaction && !error && list && <>
      {list.length === 0 && !loading && <p>No saved bank purchases yet.</p>}
      {list.map(p => <a key={p.transactionId} className="cc-bank-purchase-row" href={receiptWorkspaceUrl({ transaction: p.transactionId })} onClick={e => purchaseLinkClick(e, () => onNavigate({ transaction: p.transactionId }))}>
        <span><strong>{p.merchant || 'Merchant unavailable'}</strong><small>{dateText(p.date)} · {p.matchConflict ? 'Receipt link needs review' : p.pending ? 'Pending' : p.matchedReceiptId ? 'Receipt matched' : 'No receipt matched'} · Ref {p.transactionId.slice(-8)}</small></span>
        <span>{purchaseMoney(p.amount,p.currency)} <ChevronRight size={15} aria-hidden="true" /></span>
      </a>)}
      {nextCursor && <button className="cc-secondary" type="button" disabled={loading} onClick={() => setCursor(nextCursor)}>Show more purchases</button>}
    </>}
    {transaction && purchase && <>
      <div className="cc-receipt-heading"><div><h4>{purchase.merchant || 'Merchant unavailable'}</h4><p>{purchase.removed ? 'Removed by bank' : purchase.pending ? 'Pending' : 'Posted'} · {dateText(purchase.date)}</p></div><strong>{purchaseMoney(purchase.amount,purchase.currency)}</strong></div>
      {purchase.authorizedDate && purchase.authorizedDate !== purchase.date && <p>Authorized {dateText(purchase.authorizedDate)}</p>}
      <details className="cc-receipt-evidence"><summary>Bank reference</summary><code>{purchase.transactionId}</code></details>
      {purchase.matchConflict ? <p role="status">The saved receipt links disagree. Review the original receipts before changing a match.</p> : purchase.matchedReceiptId ? linked({ receipt: purchase.matchedReceiptId, transaction }, 'Open matched receipt') : purchase.removed ? <p>The bank removed this purchase. It is unavailable for new matches.</p> : purchase.pending ? <p>Match a receipt once this purchase posts.</p> : <>
        <button type="button" className={reconciling ? 'cc-text-button' : 'cc-primary'} aria-expanded={reconciling}
          onClick={() => { setReconciling(value => !value); setFinding(false); }}>{reconciling ? 'Close reconciliation' : 'Reconcile'}</button>
        {reconciling && <>
        {detail.receiptCandidates.length === 0 ? <p role="status">{detail.candidatesComplete === false ? 'No match found among the receipts checked.' : 'No matching saved receipt found for this purchase.'}</p> : <h4>Suggested receipts</h4>}
        {detail.candidatesComplete === false && !!detail.receiptCandidates.length && <p className="cc-muted">Suggestions cover part of your receipt history.</p>}
        {detail.receiptCandidates.map(r => <a key={r.receiptId} className="cc-bank-purchase-row" href={receiptWorkspaceUrl({receipt:r.receiptId,transaction,manual:r.manualOnly})} onClick={e => purchaseLinkClick(e, () => onNavigate({receipt:r.receiptId,transaction,manual:r.manualOnly}))}>
          <span><strong>{r.merchant || 'Merchant unavailable'}</strong><small>{dateText(r.date)} · {r.manualOnly ? 'Check receipt details' : r.exactCurrency && r.exactAmount ? 'Exact amount' : 'Check amount and currency'}</small></span>
          <span>{purchaseMoney(r.total,r.currency)} <ChevronRight size={15} aria-hidden="true" /></span>
        </a>)}
        <button type="button" className="cc-secondary" aria-expanded={finding} onClick={() => setFinding(value => !value)}>Find a saved receipt</button>
        {finding && <SavedReceiptPicker transaction={transaction} cashReceiptIds={cashReceiptIds} onNavigate={onNavigate}/>}
        {linked({}, 'Add a receipt in Receipts', 'cc-text-button')}
        </>}
      </>}
    </>}
  </section>;
}
