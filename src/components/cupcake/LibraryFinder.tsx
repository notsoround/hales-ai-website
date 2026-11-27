import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { accountData } from './accountSession';
import { useDataChanged } from './dataChanges';
import { libraryRequest, openLibraryReceipts, type Conversation } from './library';
import { dateText, purchaseMoney, type Purchase } from './bankPurchaseModel';
import { callDisposition } from './phoneCallHistory';
import { personalStorage } from './personalStorage';

// Receipts, bank purchases and phone calls live in their own stores, so the
// Library source list and its search never returned them. This lists them in
// All Content and searches them beside the saved sources. Account sign-in only.
type FinderReceipt = {
  id: string; status?: string; merchant?: string | null; date?: string | null; currency?: string | null;
  total?: number | null; grandTotal?: number | null; expectedTotal?: number | null;
  lineItems?: { description?: string }[]; matchedTransactionId?: string | null; paymentMethod?: string | null; paidWithCash?: boolean | null;
};
type Loaded<T> = { rows: T[]; failed: boolean; more: boolean; total: number };
const empty = <T,>(failed = false): Loaded<T> => ({ rows: [], failed, more: false, total: 0 });
const PREVIEW = 3;
const central = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function cashReceiptIds(): Set<string> {
  try {
    const parsed = JSON.parse(personalStorage('localStorage').getItem('cupcake-receipt-cash-v1') || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch { return new Set(); }
}
/** Same labels as the Receipts list. */
function receiptLabel(r: FinderReceipt, cashIds: Set<string>) {
  if (r.status === 'matched' || r.matchedTransactionId) return 'Matched';
  if (r.paymentMethod === 'cash' || r.paidWithCash === true || cashIds.has(r.id)) return 'Cash';
  if (r.status === 'saved_unread') return 'Awaiting reading';
  if (r.status === 'extraction_failed') return 'Needs another read';
  if (r.status === 'extracting') return 'Reading';
  return 'Unmatched';
}
const receiptTotal = (r: FinderReceipt) => r.expectedTotal ?? r.grandTotal ?? r.total ?? null;
const receiptMoney = (r: FinderReceipt) => receiptTotal(r) == null ? 'Total uncertain' : purchaseMoney(receiptTotal(r), r.currency || null);
const receiptDate = (r: FinderReceipt) => r.date ? dateText(r.date) : 'Date uncertain';
function callWhen(call: Conversation) {
  const time = Date.parse(call.provenance?.occurredAt || call.createdAt);
  return Number.isFinite(time) ? central.format(time) : 'Date unavailable';
}
const has = (term: string, values: unknown[]) => values.some(value => value != null && String(value).toLocaleLowerCase().includes(term));
const purchaseState = (p: Purchase) => p.matchConflict ? 'Receipt link needs review' : p.pending ? 'Pending' : p.matchedReceiptId ? 'Receipt matched' : 'No receipt matched';
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function LibraryFinder({ active, term, excludeDocumentIds, onMatches, onOpenDocument, onShowReceipts, onShowCalls }: {
  active: boolean;
  /** Submitted search text, or null while browsing All Content. */
  term: string | null;
  /** Sources the Library search already returned, so a call transcript is not listed twice. */
  excludeDocumentIds?: readonly string[];
  /** Number of extra matches for the current term; null while they are still being read. */
  onMatches?: (matches: number | null) => void;
  onOpenDocument: (id: string) => void;
  onShowReceipts: () => void;
  onShowCalls: () => void;
}) {
  const [receipts, setReceipts] = useState<Loaded<FinderReceipt> | null>(null);
  const [calls, setCalls] = useState<Loaded<Conversation> | null>(null);
  const [purchases, setPurchases] = useState<Loaded<Purchase> | null>(null);
  const [version, setVersion] = useState(0);
  const [cashIds] = useState(cashReceiptIds);
  useDataChanged(['purchase'], () => setVersion(value => value + 1));

  useEffect(() => {
    if (!active) return;
    let current = true;
    void libraryRequest<{ receipts?: FinderReceipt[] }>({ action: 'receipt_list' })
      .then(data => { if (current) setReceipts(Array.isArray(data.receipts) ? { rows: data.receipts, failed: false, more: false, total: data.receipts.length } : empty(true)); })
      .catch(() => { if (current) setReceipts(empty(true)); });
    void libraryRequest<{ documents?: Conversation[]; browseTotal?: number; nextCursor?: string | null }>({ action: 'list', sourceFilter: 'phone-calls' })
      .then(data => {
        if (!current) return;
        const rows = Array.isArray(data.documents) ? data.documents : [];
        setCalls({ rows, failed: !Array.isArray(data.documents), more: !!data.nextCursor, total: typeof data.browseTotal === 'number' ? data.browseTotal : rows.length });
      })
      .catch(() => { if (current) setCalls(empty(true)); });
    return () => { current = false; };
  }, [active, version]);

  // Bank purchases are searched by the account service (the same lookup "Find a purchase manually" uses).
  const query = term?.trim() || '';
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    setPurchases(null);
    accountData<{ purchases?: Purchase[]; hasMore?: boolean; nextCursor?: string | null }>(
      { action: 'bank_purchase_list', limit: 12, ...(query ? { query } : {}) }, abort.signal)
      .then(data => { if (!abort.signal.aborted) setPurchases(Array.isArray(data.purchases) ? { rows: data.purchases, failed: false, more: !!data.hasMore, total: data.purchases.length } : empty(true)); })
      .catch(() => { if (!abort.signal.aborted) setPurchases(empty(true)); });
    return () => abort.abort();
  }, [active, query, version]);

  const needle = query.toLocaleLowerCase();
  const receiptRows = useMemo(() => !receipts ? [] : !needle ? receipts.rows
    : receipts.rows.filter(r => has(needle, [r.merchant, r.date, receiptDate(r), receiptTotal(r), ...(r.lineItems || []).map(item => item.description)])), [receipts, needle]);
  const callRows = useMemo(() => {
    if (!calls) return [];
    const skip = new Set(needle ? excludeDocumentIds || [] : []);
    return calls.rows.filter(call => !skip.has(call.id) && (!needle || has(needle, [call.title, call.excerpt, callDisposition(call)])));
  }, [calls, needle, excludeDocumentIds]);
  const purchaseRows = purchases?.rows || [];
  const ready = !!receipts && !!calls && !!purchases;
  const matches = receiptRows.length + purchaseRows.length + callRows.length;
  useEffect(() => { if (term !== null) onMatches?.(ready ? matches : null); }, [term, ready, matches, onMatches]);

  if (!active) return null;
  const searching = term !== null;
  const limit = searching ? Number.POSITIVE_INFINITY : PREVIEW;
  const heading = (label: string, shown: number, total: number, more: boolean, all: string, open: () => void) => <div className="cc-heading-row">
    <h3>{label} · {searching ? count(shown, 'match', 'matches') : `${total}${more ? '+' : ''}`}</h3>
    <button type="button" className="cc-text-button" onClick={open}>{all} <ArrowUpRight size={15} aria-hidden="true" /></button>
  </div>;
  const callCoverage = !calls || calls.failed ? '' : calls.more || calls.total > calls.rows.length
    ? `the latest ${calls.rows.length} of ${calls.total} phone calls (title and preview text)` : 'saved phone calls (title and preview text)';
  const covered = [
    receipts && !receipts.failed ? `${count(receipts.total, 'saved receipt', 'saved receipts')} (store, date, items and total)` : '',
    purchases && !purchases.failed ? 'bank purchases' : '', callCoverage,
  ].filter(Boolean);
  const missed = [receipts?.failed ? 'receipts' : '', purchases?.failed ? 'bank purchases' : '', calls?.failed ? 'phone calls' : ''].filter(Boolean);

  return <section className="cc-library-finder" aria-label={searching ? 'Matching receipts, purchases and calls' : 'Receipts, purchases and calls'}>
    {!ready && <p className="cc-muted cc-small" role="status">{searching ? 'Searching receipts, purchases and calls…' : 'Loading receipts, purchases and calls…'}</p>}
    {receipts && (receiptRows.length > 0 || (!searching && receipts.failed)) && <>
      {heading('Receipts', receiptRows.length, receipts.total, false, 'All receipts', onShowReceipts)}
      {receipts.failed && <p className="cc-muted cc-small">Receipts could not load here. Open All receipts to retry.</p>}
      {receiptRows.slice(0, limit).map(r => <button type="button" className="cc-library-item" key={r.id} onClick={() => openLibraryReceipts({ receipt: r.id })}>
        <span><span className="cc-kind">Receipt</span><strong>{r.merchant || (r.status === 'saved_unread' ? 'Receipt photo' : 'Merchant uncertain')}</strong><small>{receiptDate(r)} · {receiptLabel(r, cashIds)}</small></span>
        <span>{receiptMoney(r)} <ArrowUpRight size={14} aria-hidden="true" /></span>
      </button>)}
    </>}
    {purchases && (purchaseRows.length > 0 || (!searching && purchases.failed)) && <>
      {heading('Bank purchases', purchaseRows.length, purchases.total, purchases.more, 'All bank purchases', () => openLibraryReceipts({ bank: true }))}
      {purchases.failed && <p className="cc-muted cc-small">Bank purchases could not load here. Open All bank purchases to retry.</p>}
      {purchaseRows.slice(0, limit).map(p => <button type="button" className="cc-library-item" key={p.transactionId} onClick={() => openLibraryReceipts({ transaction: p.transactionId })}>
        <span><span className="cc-kind">Bank purchase</span><strong>{p.merchant || 'Merchant unavailable'}</strong><small>{dateText(p.date)} · {purchaseState(p)} · Ref {p.transactionId.slice(-8)}</small></span>
        <span>{purchaseMoney(p.amount, p.currency)} <ArrowUpRight size={14} aria-hidden="true" /></span>
      </button>)}
      {searching && purchases.more && <p className="cc-muted cc-small">Showing the first {purchaseRows.length} matching purchases. Open All bank purchases for the rest.</p>}
    </>}
    {calls && (callRows.length > 0 || (!searching && calls.failed)) && <>
      {heading('Phone calls', callRows.length, calls.total, false, 'All phone calls', onShowCalls)}
      {calls.failed && <p className="cc-muted cc-small">Phone calls could not load here. Open All phone calls to retry.</p>}
      {callRows.slice(0, limit).map(call => <button type="button" className="cc-library-item" key={call.id} onClick={() => onOpenDocument(call.id)}>
        <span><span className="cc-kind">Phone call</span><strong>{call.title || 'Phone call'}</strong><small>{callWhen(call)} · {callDisposition(call)}</small></span>
        <span>Open <ArrowUpRight size={14} aria-hidden="true" /></span>
      </button>)}
    </>}
    {searching && ready && <p className="cc-muted cc-small cc-library-finder-coverage">
      Search covers saved sources{covered.length ? `, ${covered.join(', ')}` : ''}.{missed.length ? ` Not searched this time: ${missed.join(', ')}.` : ''}
    </p>}
  </section>;
}
