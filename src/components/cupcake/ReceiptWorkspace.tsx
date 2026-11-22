import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CheckCircle2, Package, ShoppingBasket } from 'lucide-react';
import { libraryRequest } from './library';
import { ACCOUNT_SESSIONS } from './accountMode';
import { AccountReceiptPhoto } from './AccountReceiptPhoto';
import { AccountReceiptReader } from './AccountReceiptReader';
import { accountData } from './accountSession';
import { notifyDataChanged } from './dataChanges';
import { personalStorage } from './personalStorage';
import { isGroceryReceipt, registerPantryStorage, routeReceiptToPantry } from './groceryChecklist';
import './receipts.css';

registerPantryStorage(personalStorage);

type LineItem = { description: string; quantity: number | null; amount: number | null };
type Receipt = {
  id: string; status: 'saved_unread' | 'extracting' | 'extraction_failed' | 'extracted' | 'matched'; createdAt: string;
  merchant: string | null; date: string | null; currency: string | null; total: number | null;
  grandTotal?: number | null; subtotal?: number | null; totalIncludesTip?: boolean | null;
  tax: number | null; tip: number | null; lineItems: LineItem[]; matchedTransactionId: string | null;
  expectedTotal?: number | null; amountBasis?: string; amountWarning?: string | null; alternativeTotalWithTip?: number | null;
  paymentMethod?: string | null; paidWithCash?: boolean | null;
};
type ReceiptFilter = 'unmatched' | 'matched' | 'cash' | 'all';
const CASH_RECEIPTS_KEY = 'cupcake-receipt-cash-v1';
const PANTRY_ROUTED_KEY = 'cupcake-receipt-pantry-routed-v1';

function readIdSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = personalStorage('localStorage').getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch { return new Set(); }
}

function writeIdSet(key: string, values: Set<string>) {
  if (typeof window === 'undefined') return;
  try { personalStorage('localStorage').setItem(key, JSON.stringify([...values].slice(-400))); } catch { /* ignore storage unavailable */ }
}

function groceriesHref() {
  if (typeof location === 'undefined') return '?tab=snap';
  const url = new URL(location.href);
  url.search = new URLSearchParams({ tab: 'snap' }).toString();
  url.hash = '';
  return url.pathname + url.search;
}
type Candidate = {
  transactionId: string; merchant: string | null; date: string; authorizedDate?: string | null;
  amount: number; currency: string | null; pending: boolean; exactAmount?: boolean; exactCurrency?: boolean;
  amountDifference?: number | null; dateDifferenceDays?: number; merchantMatch?: string;
  reasons?: string[]; requiresAcknowledgment?: boolean;
};
type Coverage = { startDate?: string; endDate?: string; checkedAt?: string; complete: boolean; fetchedTransactions?: number | null; reportedTransactions?: number | null; pages?: number | null; warnings?: string[] };
type MatchSummary = { exactCount?: number; exactPostedCount?: number; pendingCount?: number; candidateCount?: number };
type MatchResponse = { receipt: Receipt; candidates: Candidate[]; coverage?: Coverage; matchSummary?: MatchSummary };
type Props = { active?: boolean; onWork?: (busy: boolean) => void };

const money = (amount: number | null | undefined, currency: string | null) => {
  if (amount == null) return 'Uncertain';
  try { return currency ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) : `${amount.toFixed(2)} · currency uncertain`; }
  catch { return `${amount.toFixed(2)} ${currency || ''}`.trim(); }
};
const dateLabel = (value: string | null | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date uncertain';
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Date uncertain';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
};
const expectedTotal = (receipt: Receipt) => receipt.expectedTotal ?? receipt.grandTotal ?? receipt.total;
const exact = (item: Candidate, receipt: Receipt) => item.exactAmount === true && item.exactCurrency === true || item.exactAmount == null && item.amount === expectedTotal(receipt) && item.currency === receipt.currency;
const needsReview = (item: Candidate, receipt: Receipt, coverage?: Coverage | null) => item.requiresAcknowledgment === true || !exact(item, receipt) || coverage?.complete !== true;
const receiptLink = (id: string) => { const url = new URL(location.href); url.search = new URLSearchParams({ tab: 'library', view: 'receipts', receipt: id }).toString(); url.hash = ''; return url.pathname + url.search; };

async function imageData(file: File): Promise<{ url: string; preview: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = source; await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('This browser could not prepare the image.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = .86, url = canvas.toDataURL('image/jpeg', quality);
    while (url.length > 1_700_000 && quality > .45) { quality -= .08; url = canvas.toDataURL('image/jpeg', quality); }
    if (url.length > 1_700_000) throw new Error('This image is still too large. Crop the receipt and try again.');
    return { url, preview: URL.createObjectURL(await (await fetch(url)).blob()) };
  } finally { URL.revokeObjectURL(source); }
}

export default function ReceiptWorkspace({ active = true, onWork }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>([]), [selected, setSelected] = useState<Receipt | null>(null);
  const [listLoading, setListLoading] = useState(true), [listFailed, setListFailed] = useState(false);
  const [autoReadId, setAutoReadId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]), [coverage, setCoverage] = useState<Coverage | null>(null), [summary, setSummary] = useState<MatchSummary | null>(null);
  const [choice, setChoice] = useState(''), [acknowledged, setAcknowledged] = useState(false), [searched, setSearched] = useState(false);
  const [preview, setPreview] = useState(''), [original, setOriginal] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [cashIds, setCashIds] = useState<Set<string>>(() => readIdSet(CASH_RECEIPTS_KEY));
  const [pantryRoutedIds, setPantryRoutedIds] = useState<Set<string>>(() => readIdSet(PANTRY_ROUTED_KEY));
  const [pantryNotice, setPantryNotice] = useState('');
  const [filterChoice, setFilterChoice] = useState<ReceiptFilter | null>(null);
  const initialId = useRef(new URLSearchParams(location.search).get('receipt'));
  const selectionVersion = useRef(0);
  const selectedCard = useRef<HTMLDivElement>(null);
  const bankRefresh = useRef<Promise<string> | null>(null);
  const work = useCallback((value: boolean) => { setBusy(value); onWork?.(value); }, [onWork]);

  const isMatched = useCallback((r: Receipt) => r.status === 'matched' || !!r.matchedTransactionId, []);
  const isCash = useCallback((r: Receipt) => !isMatched(r) && (r.paymentMethod === 'cash' || r.paidWithCash === true || cashIds.has(r.id)), [cashIds, isMatched]);
  const counts = useMemo(() => {
    let unmatched = 0, matched = 0, cash = 0;
    for (const r of receipts) {
      if (isMatched(r)) matched++;
      else if (isCash(r)) cash++;
      else unmatched++;
    }
    return { unmatched, matched, cash, all: receipts.length };
  }, [receipts, isMatched, isCash]);
  const activeFilter: ReceiptFilter = filterChoice ?? (counts.unmatched > 0 ? 'unmatched' : 'all');
  const visibleReceipts = useMemo(() => receipts.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'matched') return isMatched(r);
    if (activeFilter === 'cash') return isCash(r);
    return !isMatched(r) && !isCash(r);
  }), [receipts, activeFilter, isMatched, isCash]);

  const toggleCash = (receipt: Receipt) => {
    if (isMatched(receipt)) return;
    const next = new Set(cashIds);
    const markingCash = !isCash(receipt);
    if (markingCash) next.add(receipt.id); else next.delete(receipt.id);
    setCashIds(next);
    writeIdSet(CASH_RECEIPTS_KEY, next);
    if (markingCash) {
      resetMatches();
      setStatus('Marked as Paid with Cash (saved on this device) — removed from the bank-match queue.');
    } else {
      setStatus('Returned to the unmatched bank-match queue.');
    }
    if (ACCOUNT_SESSIONS) {
      void libraryRequest<{ receipt?: Receipt }>({
        action: 'receipt_set_payment_method',
        receiptId: receipt.id,
        paymentMethod: markingCash ? 'cash' : null,
      }).then(data => {
        if (!data.receipt) return;
        setReceipts(curr => curr.map(r => r.id === data.receipt!.id ? data.receipt! : r));
        setSelected(curr => curr?.id === data.receipt!.id ? data.receipt! : curr);
      }).catch(() => { /* Keep local cash status when offline or pre-Tier-3 server. */ });
    }
  };

  const sendToPantry = (receipt: Receipt) => {
    const result = routeReceiptToPantry(receipt);
    if (!result.added) { setPantryNotice('No food or household items were found on this receipt.'); return; }
    const next = new Set(pantryRoutedIds);
    next.add(receipt.id);
    setPantryRoutedIds(next);
    writeIdSet(PANTRY_ROUTED_KEY, next);
    setPantryNotice(`Stocked ${result.added} ${result.added === 1 ? 'item' : 'items'} into Household Pantry (estimated local inventory).`);
  };
  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await libraryRequest<{ receipts: Receipt[] }>({ action: 'receipt_list' });
      setReceipts(data.receipts || []); setListFailed(false);
    } catch (cause) { setListFailed(true); throw cause; }
    finally { setListLoading(false); }
  }, []);
  const resetMatches = () => { setCandidates([]); setCoverage(null); setSummary(null); setChoice(''); setAcknowledged(false); setSearched(false); };
  const refreshBank = useCallback(() => {
    if (!ACCOUNT_SESSIONS) return Promise.resolve('');
    if (bankRefresh.current) return bankRefresh.current;
    const pending = (async () => {
      try {
        const status = await accountData<{ configured: boolean; connections: {connectionId: string; status: string}[] }>({ action: 'bank_connection_status' });
        if (!status.configured || !Array.isArray(status.connections)) return '';
        const connected = status.connections.filter(connection => connection.status === 'connected');
        const needsAttention = status.connections.some(connection => ['reconnect_required', 'disconnecting', 'disconnect_uncertain'].includes(connection.status));
        const results = await Promise.allSettled(connected.map(connection => accountData({ action: 'bank_sync', connectionId: connection.connectionId })));
        if (results.some(result => result.status === 'rejected')) return 'Some bank transactions could not be refreshed. Matching uses previously saved transactions.';
        if (connected.length) notifyDataChanged('purchase');
        if (needsAttention) return 'A bank connection needs attention. Matching uses its previously saved transactions.';
        return '';
      } catch { return 'Bank transactions could not be refreshed. Matching uses previously saved transactions.'; }
    })();
    bankRefresh.current = pending;
    void pending.finally(() => { if (bankRefresh.current === pending) bankRefresh.current = null; });
    return pending;
  }, []);
  useEffect(() => { if (active && ACCOUNT_SESSIONS) void refreshBank(); }, [active, refreshBank]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void refresh().catch(e => setError((e as Error).message));
    if (initialId.current) {
      const id = initialId.current;
      const version = ++selectionVersion.current;
      void libraryRequest<{ receipt: Receipt }>({ action: 'receipt_get', receiptId: id }).then(data => {
        if (!cancelled && selectionVersion.current === version) { initialId.current = null; setSelected(data.receipt); }
      }).catch(e => { if (!cancelled && selectionVersion.current === version) { initialId.current = null; setError((e as Error).message); } });
    }
    return () => { cancelled = true; };
  }, [active, refresh]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const openReceipt = (receipt: Receipt) => {
    selectionVersion.current++;
    initialId.current = null;
    setSelected(receipt); setPreview(''); setOriginal(''); resetMatches(); setStatus(''); setError(''); setPantryNotice('');
    history.replaceState(history.state, '', receiptLink(receipt.id));
    requestAnimationFrame(() => selectedCard.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const photoSaved = async (receiptId: string) => {
    const version = ++selectionVersion.current;
    try {
      const data = await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_get', receiptId });
      if (selectionVersion.current !== version) return;
      setSelected(data.receipt); setAutoReadId(receiptId); setOriginal(''); resetMatches(); setStatus(''); setError('');
      history.replaceState(history.state, '', receiptLink(receiptId));
      await refresh();
    } catch (cause) {
      if (selectionVersion.current === version) setError((cause as Error).message);
    }
  };
  const readingFinished = async (receiptId: string) => {
    const version = selectionVersion.current;
    try {
      const data = await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_get', receiptId });
      if (selectionVersion.current !== version) return;
      setSelected(data.receipt); setAutoReadId(''); await refresh();
      if (selectionVersion.current !== version || data.receipt.matchedTransactionId || expectedTotal(data.receipt) == null || !data.receipt.date || !data.receipt.currency) return;
      const warning = await refreshBank();
      const matches = await libraryRequest<MatchResponse>({ action: 'receipt_match_candidates', receiptId });
      if (selectionVersion.current !== version) return;
      setSelected(matches.receipt);
      setCandidates(matches.candidates || []);
      setCoverage(warning ? { ...matches.coverage, complete: false, warnings: [...(matches.coverage?.warnings || []), warning] } : matches.coverage || { complete: false, warnings: ['Transaction coverage was not provided.'] });
      setSummary(matches.matchSummary || null); setSearched(true);
      setStatus(matches.coverage?.complete && !warning ? 'Check the suggested transactions before confirming a match.' : 'Your receipt was read. Check transaction coverage before confirming a match.');
    } catch (cause) {
      if (selectionVersion.current === version) setError((cause as Error).message);
    }
  };

  async function choose(file?: File) {
    if (ACCOUNT_SESSIONS || !file || busy) return;
    selectionVersion.current++;
    initialId.current = null;
    work(true); setError(''); setSelected(null); setPreview(''); setOriginal(''); resetMatches(); setStatus('Preparing image…');
    try {
      const ready = await imageData(file); setPreview(ready.preview); setStatus('Reading the receipt, including any entered tip and final total…');
      const data = await libraryRequest<{ receipt: Receipt; duplicate: boolean }>({ action: 'receipt_extract', image: ready.url, filename: file.name });
      setSelected(data.receipt); history.replaceState(history.state, '', receiptLink(data.receipt.id));
      setStatus(data.duplicate ? 'This receipt was already saved.' : 'Receipt saved privately. Review the total, then find its bank charge.'); await refresh();
    } catch (e) {
      const message = (e as Error).message; setError(message); setStatus(/Receipt saved as receipt_[a-f0-9]{32}/.test(message) ? 'The photo is saved privately. Retry from Saved receipts below.' : 'Check Saved receipts below before trying again.'); await refresh().catch(() => undefined);
    } finally { work(false); }
  }
  async function retry() {
    if (ACCOUNT_SESSIONS || !selected || busy) return;
    work(true); setError(''); resetMatches(); setStatus('Reading the saved photo again…');
    try { const data = await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_retry', receiptId: selected.id }); setSelected(data.receipt); setStatus('Receipt extraction completed.'); await refresh(); }
    catch (e) { setError((e as Error).message); setStatus('The saved photo is still private. You can retry later.'); } finally { work(false); }
  }
  async function showOriginal() {
    if (!selected || busy) return;
    if (original) { setOriginal(''); return; }
    work(true); setError('');
    try { const data = await libraryRequest<{ image: string }>({ action: 'receipt_get', receiptId: selected.id, includeImage: true }); setOriginal(data.image); }
    catch (e) { setError((e as Error).message); } finally { work(false); }
  }
  async function findMatches() {
    if (!selected || busy) return;
    work(true); setError(''); resetMatches(); setStatus(ACCOUNT_SESSIONS ? 'Checking your saved bank transactions…' : 'Searching posted and pending bank transactions…');
    try {
      const warning = await refreshBank();
      const data = await libraryRequest<MatchResponse>({ action: 'receipt_match_candidates', receiptId: selected.id });
      setSelected(data.receipt); setCandidates(data.candidates || []); setCoverage(warning ? { ...data.coverage, complete: false, warnings: [...(data.coverage?.warnings || []), warning] } : data.coverage || { complete: false, warnings: ['Search coverage was not provided. Refresh before choosing a different amount.'] }); setSummary(data.matchSummary || null); setSearched(true); setStatus(data.coverage?.complete && !warning ? 'Search complete. Choose a transaction only after checking its details.' : 'Transaction coverage is incomplete. Review the coverage details before choosing a charge.');
    } catch (e) { setError((e as Error).message); setStatus('Receipt is saved. You can retry the bank search.'); } finally { work(false); }
  }
  async function confirm() {
    if (!selected || !choice || busy) return;
    work(true); setError(''); setStatus('Saving the transaction you selected…');
    try {
      const data = await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_confirm_match', receiptId: selected.id, transactionId: choice, acknowledgeDifferences: acknowledged });
      setSelected(data.receipt); resetMatches(); setStatus('Receipt matched to your selected transaction.'); await refresh();
    } catch (e) { setError((e as Error).message); } finally { work(false); }
  }

  const selectedCandidate = candidates.find(item => item.transactionId === choice);
  const exactCandidates = selected ? candidates.filter(item => exact(item, selected)) : [];
  const otherCandidates = selected ? candidates.filter(item => !exact(item, selected)) : [];
  const exactCount = summary?.exactCount ?? exactCandidates.length;
  const candidateList = (items: Candidate[]) => items.map(item => {
    if (!selected) return null;
    const isExact = exact(item, selected), difference = item.amountDifference ?? (item.currency === selected.currency && expectedTotal(selected) != null ? Math.round((item.amount - expectedTotal(selected)!) * 100) / 100 : null);
    return <div key={item.transactionId} className={`cc-receipt-candidate ${choice === item.transactionId ? 'is-selected' : ''}`}>
      <label className="cc-receipt-choice">
        <input disabled={item.pending || busy} type="radio" name="receipt-match" checked={choice === item.transactionId} onChange={() => { setChoice(item.transactionId); setAcknowledged(false); }} />
        <span className="cc-receipt-merchant"><strong>{item.merchant || 'Merchant unavailable'}</strong><small>{dateLabel(item.authorizedDate || item.date)} · {item.pending ? 'Pending' : 'Posted'}</small></span>
        <span className="cc-receipt-amount"><strong>{money(item.amount, item.currency)}</strong><small className={isExact ? 'cc-receipt-exact' : 'cc-receipt-difference'}>{isExact ? 'Exact amount' : item.currency !== selected.currency ? 'Different currency' : difference == null ? 'Check amount' : `${money(Math.abs(difference), item.currency)} ${difference > 0 ? 'higher' : 'lower'}`}</small></span>
      </label>
      {item.pending && <p className="cc-receipt-hint">Available to confirm after it posts. The final amount and transaction ID may change.</p>}
      {!isExact && <p className="cc-receipt-hint">{item.reasons?.find(reason => /Bank amount|Currency differs/.test(reason)) || 'The receipt and bank amount differ. Check the total, tip, merchant and date.'}</p>}
      <details className="cc-receipt-evidence"><summary>Compare receipt & bank details</summary><ul>{(item.reasons?.length ? item.reasons : ['Check the bank amount, receipt date and full merchant name before confirming.']).map((reason, index) => <li key={index}>{reason}</li>)}</ul><p>Receipt: {selected.merchant || 'unknown merchant'} · {dateLabel(selected.date)} · {money(expectedTotal(selected), selected.currency)}</p><p>Bank posting date: {dateLabel(item.date)}</p><p className="cc-receipt-source">Transaction ID <code>{item.transactionId}</code></p></details>
    </div>;
  });

  const selectedIsCash = selected ? isCash(selected) : false;
  const selectedIsGrocery = selected ? isGroceryReceipt(selected) : false;
  const selectedInPantry = selected ? pantryRoutedIds.has(selected.id) : false;

  return <section className="cc-studio cc-library-workspace cc-receipts" aria-busy={busy}>
    <div className="cc-receipt-top-row">
      <div>
        <h2>Receipts</h2>
        <p className="cc-muted">{ACCOUNT_SESSIONS ? 'Match saved receipts to bank charges, mark cash purchases, or stock your pantry.' : 'Save a receipt photo, compare its final total with your bank charges, and choose the match.'}</p>
      </div>
      {ACCOUNT_SESSIONS && <a className="cc-receipt-pantry-jump" href={groceriesHref()}><ShoppingBasket size={14} aria-hidden="true" />Groceries &amp; pantry</a>}
    </div>
    {error && <div className="cc-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    <div className="cc-card cc-import-card cc-receipt-import">
      {ACCOUNT_SESSIONS ? <AccountReceiptPhoto onSaved={receiptId => void photoSaved(receiptId)}/> : <>
      <div><strong>Add a receipt</strong><p className="cc-muted">Include the entered tip and final total in the photo.</p></div>
      <div className="cc-action-row"><label className="cc-primary cc-file">Choose image<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void choose(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label><label className="cc-secondary cc-file">Take photo<input disabled={busy} type="file" accept="image/*" capture="environment" onChange={e => { void choose(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label></div>
      {preview && !selected && <img className="cc-receipt-photo" src={preview} alt="Receipt being read" />}
      </>}
    </div>
    {status && <p className={busy ? 'cc-thinking' : 'cc-notice'} role="status" aria-live="polite">{status}</p>}
    <div className="cc-receipt-saved-heading">
      <h3>Saved receipts</h3>
      {!listLoading && !listFailed && <span className="cc-muted">{receipts.length} total</span>}
    </div>
    {!listLoading && !listFailed && receipts.length > 0 && (
      <div className="cc-receipt-status-bar">
        <div className="cc-receipt-counters" aria-label="Receipt matching summary">
          <div className={`cc-receipt-stat${counts.unmatched > 0 ? ' is-attention' : ''}`}><strong>{counts.unmatched}</strong><span>Unmatched</span></div>
          <div className="cc-receipt-stat is-matched"><strong>{counts.matched}</strong><span>Matched</span></div>
          <div className="cc-receipt-stat is-cash"><strong>{counts.cash}</strong><span>Cash</span></div>
        </div>
        <div className="cc-receipt-filters" role="group" aria-label="Filter saved receipts">
          {([
            ['unmatched', 'Unmatched', counts.unmatched],
            ['matched', 'Matched', counts.matched],
            ['cash', 'Cash', counts.cash],
            ['all', 'All', counts.all],
          ] as const).map(([key, label, count]) => (
            <button key={key} type="button" aria-pressed={activeFilter === key} onClick={() => setFilterChoice(key)}>
              {label}<span>{count}</span>
            </button>
          ))}
        </div>
      </div>
    )}
    {listLoading && !receipts.length ? <p className="cc-muted" role="status">Loading receipts…</p> : listFailed && !receipts.length ? <div><p className="cc-muted">Receipts could not load.</p><button className="cc-secondary" onClick={() => void refresh().catch(e => setError((e as Error).message))}>Retry</button></div> : !receipts.length ? <p className="cc-muted">Your saved receipts will appear here.</p> : !visibleReceipts.length ? <div className="cc-receipt-filter-empty"><p className="cc-muted">{activeFilter === 'unmatched' ? 'All saved receipts are matched or marked cash.' : activeFilter === 'cash' ? 'No receipts marked as paid with cash.' : 'No matched receipts yet.'}</p><button type="button" className="cc-secondary" onClick={() => setFilterChoice('all')}>Show all receipts ({counts.all})</button></div> : <div className="cc-receipt-saved">{visibleReceipts.map(receipt => {
      const cash = isCash(receipt), matched = isMatched(receipt);
      const badgeLabel = matched ? 'Matched' : cash ? 'Cash' : receipt.status === 'saved_unread' ? 'Awaiting reading' : receipt.status === 'extraction_failed' ? 'Needs another read' : receipt.status === 'extracting' ? 'Reading' : 'Unmatched';
      return <button disabled={busy} className={`cc-library-item ${selected?.id === receipt.id ? 'is-current' : ''}`} key={receipt.id} onClick={() => openReceipt(receipt)}>
        <span>
          <strong>{receipt.merchant || (receipt.status === 'saved_unread' ? 'Receipt photo' : 'Merchant uncertain')}</strong>
          <small>{dateLabel(receipt.date)} · <em className={`cc-receipt-pill is-${matched ? 'matched' : cash ? 'cash' : 'unmatched'}`}>{badgeLabel}</em></small>
        </span>
        <span>{money(expectedTotal(receipt), receipt.currency)}</span>
      </button>;
    })}</div>}
    {selected && <div className="cc-card cc-receipt-selected" ref={selectedCard}>
      <button className="cc-text-button cc-receipt-close" onClick={() => { selectionVersion.current++; setSelected(null); setOriginal(''); resetMatches(); setPantryNotice(''); const url = new URL(location.href); url.searchParams.delete('receipt'); history.replaceState(history.state, '', url); }}>Close receipt</button>
      <div className="cc-receipt-heading"><div><span className="cc-kind">Saved receipt · {selected.matchedTransactionId ? 'Matched' : selectedIsCash ? 'Paid with cash' : 'Unmatched'}</span><h3>{selected.merchant || 'Merchant uncertain'}</h3><p className="cc-muted">{dateLabel(selected.date)}</p></div><div className="cc-receipt-total"><small>Expected charge</small><strong>{money(expectedTotal(selected), selected.currency)}</strong></div></div>
      <dl className="cc-receipt-breakdown"><div><dt>Printed total</dt><dd>{money(selected.total, selected.currency)}</dd></div><div><dt>Tip</dt><dd>{selected.tip == null ? 'Not read' : money(selected.tip, selected.currency)}</dd></div>{selected.tax != null && <div><dt>Tax</dt><dd>{money(selected.tax, selected.currency)}</dd></div>}{selected.grandTotal != null && <div><dt>Final total</dt><dd>{money(selected.grandTotal, selected.currency)}</dd></div>}</dl>
      {selected.amountBasis === 'total_plus_visible_tip' && <p className="cc-receipt-hint">Expected charge = printed total {money(selected.total, selected.currency)} + entered tip {money(selected.tip, selected.currency)}.</p>}
      {selected.amountWarning && <p className="cc-receipt-caution">{selected.amountWarning}{selected.alternativeTotalWithTip != null ? ` Total plus tip would be ${money(selected.alternativeTotalWithTip, selected.currency)}.` : ''}</p>}
      <div className="cc-action-row cc-receipt-sources"><button className="cc-secondary" disabled={busy} onClick={() => void showOriginal()}>{original ? 'Hide receipt photo' : 'View saved receipt photo'}</button><a href={receiptLink(selected.id)}>Link to this receipt</a></div>
      {original && <figure className="cc-receipt-original"><img className="cc-receipt-photo" src={original} alt={`Saved receipt from ${selected.merchant || 'unknown merchant'}`} /><figcaption>Saved privately with this receipt.</figcaption></figure>}
      {!!selected.lineItems?.length && <details className="cc-receipt-evidence"><summary>Receipt line items ({selected.lineItems.length})</summary><ul>{selected.lineItems.map((item, index) => <li key={index}>{item.description}{item.quantity != null && item.quantity !== 1 ? ` × ${item.quantity}` : ''}{item.amount != null ? ` — ${money(item.amount, selected.currency)}` : ''}</li>)}</ul></details>}
      {ACCOUNT_SESSIONS && !!selected.lineItems?.length && (selectedIsGrocery || selected.matchedTransactionId || selectedIsCash) && (
        <div className="cc-receipt-pantry-box">
          <div>
            <strong><Package size={14} aria-hidden="true" />{selectedIsGrocery ? 'Grocery receipt → Household pantry' : 'Stock Household pantry'}</strong>
            <small>{selectedInPantry ? 'Items from this receipt were added to your estimated local pantry.' : `Route ${selected.lineItems.length} line items into your estimated local pantry.`}</small>
          </div>
          <div className="cc-receipt-pantry-actions">
            <button type="button" className="cc-secondary" disabled={busy} onClick={() => sendToPantry(selected)}>
              {selectedInPantry ? 'Restock pantry again' : `Send ${selected.lineItems.length} items to pantry`}
            </button>
            <a className="cc-text-button" href={groceriesHref()}>Open groceries →</a>
          </div>
          {pantryNotice && <p role="status" className="cc-receipt-pantry-status">{pantryNotice}</p>}
        </div>
      )}
      {ACCOUNT_SESSIONS && ['saved_unread', 'extracting', 'extraction_failed'].includes(selected.status) ? <AccountReceiptReader key={selected.id} receiptId={selected.id} autoStart={autoReadId === selected.id} canStart={selected.status !== 'extracting'} onFinished={() => void readingFinished(selected.id)}/> : selected.status === 'extraction_failed' ? <><p className="cc-notice">The photo is saved. Reading it needs another try.</p><button className="cc-primary" disabled={busy} onClick={() => void retry()}>Retry saved receipt</button></> : selected.matchedTransactionId ? <div className="cc-receipt-confirmed"><strong>Matched to the transaction you confirmed.</strong><p className="cc-receipt-source">Transaction ID <code>{selected.matchedTransactionId}</code></p></div> : selectedIsCash ? <div className="cc-receipt-cash-confirmed"><div><strong><CheckCircle2 size={16} aria-hidden="true" />Paid with Cash</strong><p className="cc-muted">Excluded from the bank-match queue. Stored on this device.</p></div><button type="button" className="cc-secondary" disabled={busy} onClick={() => toggleCash(selected)}>Undo — needs bank match</button></div> : <><div className="cc-action-row cc-receipt-match-actions"><button className="cc-primary" disabled={busy || expectedTotal(selected) == null || !selected.date || !selected.currency} onClick={() => void findMatches()}>{searched ? 'Refresh matches' : 'Find transaction matches'}</button><button type="button" className="cc-secondary cc-receipt-cash-btn" disabled={busy} onClick={() => toggleCash(selected)}><Banknote size={16} aria-hidden="true" />Paid with Cash</button></div>{ACCOUNT_SESSIONS && <p className="cc-muted">Matches use transactions saved to your account. Connect a bank in Settings → Connections.</p>}{(!selected.currency || !selected.date || expectedTotal(selected) == null) && <p className="cc-muted">A readable date, total and currency are required. Check the saved photo; an uncertain extraction cannot be matched yet.</p>}</>}
    </div>}
    {selected && searched && <div className="cc-card cc-receipt-results">
      <div className="cc-receipt-result-heading"><span className="cc-kind">Bank comparison</span><h3>{exactCount ? `${exactCount} exact amount ${exactCount === 1 ? 'match' : 'matches'}` : coverage?.complete ? 'No exact amount match yet' : 'Search coverage needs attention'}</h3><p className="cc-muted">{choice ? 'Review the selected charge and any differences before confirming.' : exactCount ? 'Compare merchant and purchase date, then select the right charge.' : 'No transaction is selected. Check the tip and final total, or wait for the purchase to post.'}</p></div>
      <div className={`cc-receipt-coverage ${coverage?.complete ? '' : 'is-incomplete'}`}><strong>{coverage?.complete ? (ACCOUNT_SESSIONS ? 'Saved transactions in this window checked' : 'All available transactions in this window checked') : 'Transaction coverage is incomplete'}</strong>{coverage?.startDate && coverage.endDate && <p>{dateLabel(coverage.startDate)} – {dateLabel(coverage.endDate)}{coverage.fetchedTransactions != null ? ` · ${coverage.fetchedTransactions} transactions checked` : ''}</p>}{coverage?.checkedAt && <small>Checked {new Date(coverage.checkedAt).toLocaleString()}</small>}{coverage?.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}</div>
      {!!exactCandidates.length && <fieldset className="cc-receipt-options"><legend>Exact amount transactions</legend>{candidateList(exactCandidates)}</fieldset>}
      {!!otherCandidates.length && <details className="cc-receipt-alternatives" open={!exactCandidates.length}><summary>Other transactions to review ({otherCandidates.length})</summary><p className="cc-muted">These amounts or currencies differ. Review the receipt’s final total and the bank’s settled charge before linking.</p><fieldset className="cc-receipt-options"><legend className="cc-receipt-sr-only">Other transactions to review</legend>{candidateList(otherCandidates)}</fieldset></details>}
      {!candidates.length && <p className="cc-muted">No relevant charge found in this window. The receipt photo is saved; refresh after your bank updates.</p>}
      {selectedCandidate && <div className="cc-receipt-confirm"><p>Selected <strong>{selectedCandidate.merchant || 'unknown merchant'}</strong> · {money(selectedCandidate.amount, selectedCandidate.currency)} · {dateLabel(selectedCandidate.authorizedDate || selectedCandidate.date)}</p>{needsReview(selectedCandidate, selected, coverage) && <label className="cc-receipt-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} /><span>I reviewed the amount, tip, date, merchant and search coverage. This is the purchase on my receipt.</span></label>}<button className="cc-primary" disabled={busy || selectedCandidate.pending || needsReview(selectedCandidate, selected, coverage) && !acknowledged} onClick={() => void confirm()}>Confirm selected match</button></div>}
    </div>}
  </section>;
}
