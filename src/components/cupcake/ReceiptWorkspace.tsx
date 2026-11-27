import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Banknote, CheckCircle2, Package, ShoppingBasket } from 'lucide-react';
import { libraryRequest } from './library';
import { ACCOUNT_SESSIONS } from './accountMode';
import { AccountReceiptPhoto } from './AccountReceiptPhoto';
import { ManualPurchasePicker } from './ManualPurchasePicker';
import { ReceiptMealLink } from './ReceiptMealLink';
import { BankPurchaseBrowser } from './BankPurchaseBrowser';
import { currentReceiptRoute, purchaseLinkClick, receiptWorkspaceUrl, type ReceiptRoute } from './receiptNavigation';
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
  matchRevision?: number; expectedTotal?: number | null; amountBasis?: string; amountWarning?: string | null; alternativeTotalWithTip?: number | null;
  printedPaymentMethod?: 'card' | 'cash' | 'mixed' | 'other' | null; matchMethod?: 'automatic' | 'confirmed' | null; paymentMethod?: string | null; paidWithCash?: boolean | null;
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
function receiptState(receipt: Receipt, matched: boolean, cash: boolean) {
  if (matched) return 'Matched';
  if (cash) return 'Cash';
  if (receipt.status === 'saved_unread') return 'Awaiting reading';
  if (receipt.status === 'extraction_failed') return 'Needs another read';
  if (receipt.status === 'extracting') return 'Reading';
  return 'Unmatched';
}
const expectedTotal = (receipt: Receipt) => receipt.expectedTotal ?? receipt.grandTotal ?? receipt.total;
const exact = (item: Candidate, receipt: Receipt) => item.exactAmount === true && item.exactCurrency === true || item.exactAmount == null && item.amount === expectedTotal(receipt) && item.currency === receipt.currency;
const needsReview = (item: Candidate, receipt: Receipt, coverage?: Coverage | null) => item.requiresAcknowledgment === true || !exact(item, receipt) || coverage?.complete !== true;
const receiptLink = (id: string) => receiptWorkspaceUrl({ receipt: id });

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
  const panelId = useId();
  const [reconciling, setReconciling] = useState(false);
  const [manual, setManual] = useState(false);
  const [choice, setChoice] = useState(''), [acknowledged, setAcknowledged] = useState(false), [searchedAt, setSearchedAt] = useState(0);
  const [preview, setPreview] = useState(''), [original, setOriginal] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [cashIds, setCashIds] = useState<Set<string>>(() => readIdSet(CASH_RECEIPTS_KEY));
  const [pantryRoutedIds, setPantryRoutedIds] = useState<Set<string>>(() => readIdSet(PANTRY_ROUTED_KEY));
  const [pantryNotice, setPantryNotice] = useState('');
  const [filterChoice, setFilterChoice] = useState<ReceiptFilter | null>(null);
  const [route, setRoute] = useState(currentReceiptRoute);
  const [bankListOpened, setBankListOpened] = useState(false);
  const loadedReceiptId = useRef<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptRetry, setReceiptRetry] = useState(0);
  const lastComparison = useRef<string | null>(null);
  const [unlinkPrompt, setUnlinkPrompt] = useState(false);
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
      setStatus('Marked as paid with cash.');
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
  const clearResults = useCallback(() => {
    setCandidates([]); setCoverage(null); setSummary(null); setChoice(''); setAcknowledged(false); setSearchedAt(0);
  }, []);
  const resetMatches = useCallback(() => {
    clearResults(); setUnlinkPrompt(false); setReconciling(false); setManual(false);
  }, [clearResults]);
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
    void refresh().catch(e => setError((e as Error).message));
    const restore = () => setRoute(currentReceiptRoute());
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [active, refresh]);
  useEffect(() => {
    if (!active || loadedReceiptId.current === route.receipt && route.receipt) return;
    const id = route.receipt, version = ++selectionVersion.current;
    const abort = new AbortController();
    loadedReceiptId.current = null; setSelected(null); setOriginal(''); setPreview(''); setAutoReadId('');
    resetMatches(); setStatus(''); setError(''); setPantryNotice(''); setReceiptLoading(!!id);
    if (id) void libraryRequest<{ receipt: Receipt }>({ action: 'receipt_get', receiptId: id })
      .then(data => {
        if (abort.signal.aborted || selectionVersion.current !== version) return;
        if (data.receipt?.id !== id) throw Error('The saved receipt could not be verified.');
        loadedReceiptId.current = id; setSelected(data.receipt);
      }).catch(e => { if (!abort.signal.aborted && selectionVersion.current === version) setError((e as Error).message); })
      .finally(() => { if (!abort.signal.aborted && selectionVersion.current === version) setReceiptLoading(false); });
    return () => abort.abort();
  }, [active, route.receipt, receiptRetry, resetMatches]);
  const navigate = (next: ReceiptRoute, replace = false) => {
    const href = receiptWorkspaceUrl(next);
    if (location.pathname + location.search !== href) {
      if (replace) history.replaceState({ ...history.state, ccReceiptParent: null }, '', href);
      else {
        history.replaceState({ ...history.state, scroll: window.scrollY }, '');
        history.pushState({ scroll: 0, ccReceiptParent: location.pathname + location.search, ccReceiptPage: href }, '', href);
      }
    }
    setRoute(currentReceiptRoute());
  };
  const goBack = () => {
    if (history.state?.ccReceiptPage === location.pathname + location.search && history.state?.ccReceiptParent) history.back();
    else navigate(route.receipt && route.transaction ? { transaction: route.transaction } : route.transaction ? { bank: true } : {}, true);
  };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const openReceipt = (receipt: Receipt) => {
    selectionVersion.current++;
    loadedReceiptId.current = receipt.id; setReceiptLoading(false);
    setSelected(receipt); setPreview(''); setOriginal(''); resetMatches(); setStatus(''); setError(''); setPantryNotice('');
    navigate({ receipt: receipt.id });
    requestAnimationFrame(() => selectedCard.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const photoSaved = async (receiptId: string) => {
    const version = ++selectionVersion.current;
    try {
      const data = await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_get', receiptId });
      if (selectionVersion.current !== version) return;
      loadedReceiptId.current = receiptId; setReceiptLoading(false);
      setSelected(data.receipt); setAutoReadId(receiptId); setOriginal(''); resetMatches(); setStatus(''); setError('');
      navigate({ receipt: receiptId });
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
      setSelected(data.receipt); setAutoReadId('');
      const receipt = data.receipt;
      const ready = !receipt.matchedTransactionId && !isCash(receipt) && expectedTotal(receipt) != null && receipt.date && receipt.currency;
      await Promise.all([refresh(), ready ? findMatches(receipt) : undefined]);
    } catch (cause) {
      if (selectionVersion.current === version) setError((cause as Error).message);
    }
  };

  async function choose(file?: File) {
    if (ACCOUNT_SESSIONS || !file || busy) return;
    selectionVersion.current++;
    loadedReceiptId.current = null;
    work(true); setError(''); setSelected(null); setPreview(''); setOriginal(''); resetMatches(); setStatus('Preparing image…');
    try {
      const ready = await imageData(file); setPreview(ready.preview); setStatus('Reading the receipt, including any entered tip and final total…');
      const data = await libraryRequest<{ receipt: Receipt; duplicate: boolean }>({ action: 'receipt_extract', image: ready.url, filename: file.name });
      loadedReceiptId.current = data.receipt.id; setSelected(data.receipt); navigate({ receipt: data.receipt.id });
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
    const version = selectionVersion.current;
    work(true); setError('');
    try {
      const data = await libraryRequest<{ image: string }>({ action: 'receipt_get', receiptId: selected.id, includeImage: true });
      if (selectionVersion.current === version) setOriginal(data.image);
    } catch (e) { if (selectionVersion.current === version) setError((e as Error).message); }
    finally { work(false); }
  }
  async function findMatches(receipt: Receipt) {
    const version = selectionVersion.current;
    const context = currentReceiptRoute();
    const stillHere = () => {
      const current = currentReceiptRoute();
      return version === selectionVersion.current && current.transaction === context.transaction && current.manual === context.manual;
    };
    work(true); setError(''); clearResults(); setStatus('');
    try {
      const warning = await refreshBank();
      const data = await libraryRequest<MatchResponse>({ action: 'receipt_match_candidates', receiptId: receipt.id });
      if (!stillHere()) return;
      if (data.receipt?.id !== receipt.id) throw Error('The receipt comparison could not be verified.');
      if (data.receipt.matchedTransactionId) { setSelected(data.receipt); resetMatches(); setStatus(''); return; }
      const target = ACCOUNT_SESSIONS && !route.manual && route.receipt === receipt.id ? route.transaction : undefined;
      const options = target ? data.candidates.filter(item => item.transactionId === target) : data.candidates;
      setSelected(data.receipt); setCandidates(options);
      setCoverage(warning ? { ...data.coverage, complete: false, warnings: [...(data.coverage?.warnings || []), warning] } : data.coverage || { complete: false, warnings: ['Search coverage was not provided. Refresh before choosing a different amount.'] });
      setSummary(target ? null : data.matchSummary || null); setSearchedAt(Date.now());
      if (target) {
        setChoice(options.length === 1 && !options[0].pending ? target : '');
        setStatus(options.length ? 'Compare this receipt with the selected bank purchase before confirming.' : 'This purchase is unavailable for matching with this receipt.');
      }
    } catch (e) { if (stillHere()) setError((e as Error).message); } finally { work(false); }
  }
  async function confirm() {
    if (!selected || !choice || busy) return;
    const version = selectionVersion.current;
    work(true); setError(''); setStatus('Saving the transaction you selected…');
    try {
      const data = await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_confirm_match', receiptId: selected.id, transactionId: choice, acknowledgeDifferences: acknowledged });
      if (data.receipt.id !== selected.id || data.receipt.matchedTransactionId !== choice) throw Error('The selected receipt and purchase were not confirmed. Refresh before trying again.');
      if (version === selectionVersion.current) {
        setSelected({ ...data.receipt, matchMethod: data.receipt.matchMethod || 'confirmed' });
        resetMatches(); setStatus('Receipt matched to your selected transaction.');
      }
      notifyDataChanged('purchase'); await refresh();
    } catch (e) { if (version === selectionVersion.current) setError((e as Error).message); }
    finally { work(false); }
  }

  async function manualMatchSaved(receiptId: string) {
    notifyDataChanged('purchase');
    try {
      const result = await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_get', receiptId });
      if (result.receipt.id !== receiptId || !result.receipt.matchedTransactionId) throw Error('Refresh to check this receipt’s saved match.');
      if (loadedReceiptId.current === receiptId) {
        setSelected(result.receipt); resetMatches(); setStatus(''); setError('');
      }
      await refresh();
    } catch (cause) {
      if (loadedReceiptId.current === receiptId) setError((cause as Error).message);
    }
  }

  async function unlink() {
    if (!ACCOUNT_SESSIONS || !selected?.matchedTransactionId || !unlinkPrompt || busy) return;
    const version = selectionVersion.current;
    work(true); setError('');
    try {
      const { receipt } = await libraryRequest<{ receipt: Receipt }>({
        action: 'receipt_unlink_match', receiptId: selected.id, transactionId: selected.matchedTransactionId,
      });
      if (receipt?.id !== selected.id || receipt.matchedTransactionId !== null || receipt.status === 'matched') throw Error('The saved unlink could not be verified. Reopen this receipt to check.');
      if (version === selectionVersion.current) {
        setSelected(receipt); resetMatches();
        // Leave a comparison reached through the former bank charge before searching for a new match.
        if (route.transaction) navigate({ receipt: receipt.id }, true);
        setStatus('Bank link removed. You can choose another purchase.');
      }
      notifyDataChanged('purchase'); await refresh();
    } catch (e) { if (version === selectionVersion.current) setError((e as Error).message); }
    finally { work(false); }
  }

  const reverseId = ACCOUNT_SESSIONS && selected?.id === route.receipt && !selected?.matchedTransactionId && selected && !isCash(selected) ? route.transaction : undefined;
  useEffect(() => {
    if (!active) return;
    if (!reverseId || !route.receipt) {
      if (lastComparison.current) { lastComparison.current = null; resetMatches(); }
      return;
    }
    lastComparison.current = route.receipt;
    let current = true;
    const receiptId = route.receipt, version = selectionVersion.current;
    setReconciling(true); setManual(!!route.manual);
    if (route.manual) {
      clearResults(); setStatus('');
      return;
    }
    void libraryRequest<MatchResponse>({ action: 'receipt_match_candidates', receiptId }).then(data => {
      if (!current || version !== selectionVersion.current) return;
      if (data.receipt?.id !== receiptId) throw Error('The receipt comparison could not be verified.');
      const matching = (data.candidates || []).filter(item => item.transactionId === reverseId);
      setSelected(data.receipt); setCandidates(matching); setCoverage(data.coverage || { complete: false });
      setSummary(null); setSearchedAt(Date.now()); setChoice(matching.length === 1 && !matching[0].pending ? reverseId : ''); setAcknowledged(false);
      setStatus(matching.length ? 'Compare this receipt with the selected bank purchase before confirming.' : 'This purchase is unavailable for matching with this receipt.');
    }).catch(cause => { if (current) setError((cause as Error).message); });
    return () => { current = false; };
  }, [active, reverseId, route.receipt, route.manual, clearResults, resetMatches]);
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
        <span className="cc-receipt-merchant"><strong>{item.merchant || 'Merchant unavailable'}</strong><small>{dateLabel(item.authorizedDate || item.date)} · {item.pending ? 'Pending' : 'Posted'}{ACCOUNT_SESSIONS && <> · Ref {item.transactionId.slice(-8)}</>}</small></span>
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

  const searched = searchedAt > 0;
  const canSearch = !!selected?.currency && !!selected.date && expectedTotal(selected) != null;
  const bankView = ACCOUNT_SESSIONS && !route.receipt && (!!route.transaction || !!route.bank);
  const receiptDetail = !!route.receipt && ACCOUNT_SESSIONS;
  const bankListVisible = active && bankView && !route.transaction;
  useEffect(() => { if (bankListVisible) setBankListOpened(true); }, [bankListVisible]);
  return <section className="cc-studio cc-library-workspace cc-receipts" aria-busy={busy}>
    <div className="cc-receipt-top-row">
      <div>
        <h2>Receipts</h2>
        {!ACCOUNT_SESSIONS && <p className="cc-muted">Save a receipt photo and match it to a bank purchase.</p>}
      </div>
      {ACCOUNT_SESSIONS && !route.receipt && !route.transaction && <a className="cc-receipt-pantry-jump" href={groceriesHref()}><ShoppingBasket size={14} aria-hidden="true" />Groceries &amp; pantry</a>}
    </div>
    {ACCOUNT_SESSIONS && !route.receipt && !route.transaction && <div className="cc-receipt-views" role="group" aria-label="Receipt workspace">
      <button type="button" aria-pressed={!bankView} onClick={() => navigate({})}>Receipts</button>
      <button type="button" aria-pressed={!!bankView} onClick={() => navigate({ bank: true })}>Bank purchases</button>
    </div>}
    {(bankListOpened || bankListVisible) && <div hidden={!bankListVisible}><BankPurchaseBrowser onNavigate={navigate} onBack={goBack} /></div>}
    {active && bankView && route.transaction && <BankPurchaseBrowser key={route.transaction} transaction={route.transaction} cashReceiptIds={cashIds} onNavigate={navigate} onBack={goBack} />}
    {!bankView && <>
    {error && <div className="cc-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    <div hidden={receiptDetail}>
    <div className="cc-card cc-import-card cc-receipt-import">
      {ACCOUNT_SESSIONS ? <AccountReceiptPhoto onSaved={receiptId => void photoSaved(receiptId)}/> : <>
      <div><strong>Add a receipt</strong><p className="cc-muted">Include the entered tip and final total in the photo.</p></div>
      <div className="cc-action-row"><label className="cc-primary cc-file">Choose image<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void choose(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label><label className="cc-secondary cc-file">Take photo<input disabled={busy} type="file" accept="image/*" capture="environment" onChange={e => { void choose(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label></div>
      {preview && !selected && <img className="cc-receipt-photo" src={preview} alt="Receipt being read" />}
      </>}
    </div>
    <div className="cc-receipt-saved-heading">
      <h3>Saved receipts</h3>
      {!listLoading && !listFailed && <span className="cc-muted">{receipts.length} total</span>}
    </div>
    {!listLoading && !listFailed && receipts.length > 0 && (
      <div className="cc-receipt-status-bar">
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
      const badgeLabel = receiptState(receipt, matched, cash);
      return <button disabled={busy} className={`cc-library-item ${selected?.id === receipt.id ? 'is-current' : ''}`} key={receipt.id} onClick={() => openReceipt(receipt)}>
        <span>
          <strong>{receipt.merchant || (receipt.status === 'saved_unread' ? 'Receipt photo' : 'Merchant uncertain')}</strong>
          <small>{dateLabel(receipt.date)} · <em className={`cc-receipt-pill is-${matched ? 'matched' : cash ? 'cash' : 'unmatched'}`}>{badgeLabel}</em></small>
        </span>
        <span>{money(expectedTotal(receipt), receipt.currency)}</span>
      </button>;
    })}</div>}
    </div>
    {receiptDetail && !selected && <div className="cc-card"><button className="cc-text-button" onClick={goBack}>Back</button>{receiptLoading ? <p role="status">Loading receipt…</p> : <button className="cc-secondary" onClick={() => setReceiptRetry(n => n + 1)}>Retry receipt</button>}</div>}
    {status && <p className={busy ? 'cc-thinking' : 'cc-notice'} role="status" aria-live="polite">{status}</p>}
    {selected && <div key={selected.id} className="cc-card cc-receipt-selected" ref={selectedCard}>
      <button type="button" className="cc-text-button cc-receipt-close" onClick={goBack}>{route.transaction ? 'Back to bank purchase' : 'Close receipt'}</button>
      <div className="cc-receipt-heading"><div><span className="cc-kind">Saved receipt · {searched && !reconciling && !candidates.length && !isMatched(selected) && !selectedIsCash ? 'No bank match yet' : receiptState(selected, isMatched(selected), selectedIsCash)}</span><h3>{selected.merchant || 'Merchant uncertain'}</h3><p className="cc-muted">{dateLabel(selected.date)}</p></div><div className="cc-receipt-total"><small>Expected charge</small><strong>{money(expectedTotal(selected), selected.currency)}</strong></div></div>
      {ACCOUNT_SESSIONS && ['saved_unread', 'extracting', 'extraction_failed'].includes(selected.status) ? <AccountReceiptReader key={selected.id} receiptId={selected.id} autoStart={autoReadId === selected.id} canStart={selected.status !== 'extracting'} onFinished={() => void readingFinished(selected.id)}/> : selected.status === 'extraction_failed' ? <><p className="cc-notice">The photo is saved. Reading it needs another try.</p><button className="cc-primary" disabled={busy} onClick={() => void retry()}>Retry saved receipt</button></> : selected.matchedTransactionId ? <div className="cc-receipt-confirmed"><strong>{selected.matchMethod === 'automatic' ? 'Automatically matched to a bank purchase.' : selected.matchMethod === 'confirmed' ? 'Matched to the transaction you confirmed.' : 'Matched to a bank purchase.'}</strong>
        {ACCOUNT_SESSIONS && <a className="cc-secondary" href={receiptWorkspaceUrl({transaction:selected.matchedTransactionId})} onClick={e => purchaseLinkClick(e, () => navigate({ transaction: selected.matchedTransactionId! }))}>Open matched bank purchase</a>}<details className="cc-receipt-evidence cc-receipt-source"><summary>Bank reference</summary><code>{selected.matchedTransactionId}</code></details>
        {ACCOUNT_SESSIONS && (unlinkPrompt ? <div className="cc-receipt-unlink" role="group" aria-label="Unlink this bank purchase?">
          <strong>Unlink this bank purchase?</strong><p>The receipt and purchase will both stay saved.</p>
          <div className="cc-action-row"><button type="button" className="cc-secondary" disabled={busy} onClick={() => void unlink()}>Unlink purchase</button><button type="button" className="cc-text-button" disabled={busy} onClick={() => setUnlinkPrompt(false)}>Cancel</button></div>
        </div> : <button type="button" className="cc-text-button" disabled={busy} onClick={() => setUnlinkPrompt(true)}>Change match</button>)}
      </div> : selectedIsCash ? <div className="cc-receipt-cash-confirmed"><div><strong><CheckCircle2 size={16} aria-hidden="true" />Paid with Cash</strong><p className="cc-muted">Excluded from the bank-match queue. {selected.paymentMethod === 'cash' || selected.paidWithCash ? 'Saved to your account.' : 'Saved on this device.'}</p></div><button type="button" className="cc-secondary" disabled={busy} onClick={() => toggleCash(selected)}>Undo — needs bank match</button></div> : <>
        {ACCOUNT_SESSIONS && <button type="button" className={reconciling ? 'cc-text-button' : 'cc-primary'} aria-expanded={reconciling} aria-controls={panelId}
          onClick={() => {
            setManual(false); setReconciling(!reconciling);
            // Saved candidate sets expire on the server after 15 minutes.
            if (!reconciling && !busy && canSearch && Date.now() - searchedAt >= 15 * 60_000) void findMatches(selected);
          }}>
          {reconciling ? 'Close reconciliation' : 'Reconcile'}
        </button>}
        {(!ACCOUNT_SESSIONS || reconciling) && <section id={panelId} className="cc-receipt-reconcile" aria-label="Reconcile receipt">
          {!manual && <>
            {busy && !searched && <p className="cc-muted" role="status">Looking for the bank purchase…</p>}
            {!canSearch && <p className="cc-muted">The receipt is missing a date, total, or currency for an automatic search.</p>}
            {selected.amountWarning && <p className="cc-receipt-caution">{selected.amountWarning}</p>}
            {searched && <div className="cc-receipt-results">
              <h4 className="cc-receipt-result-heading" aria-live="polite">{exactCount ? `${exactCount} exact amount ${exactCount === 1 ? 'match' : 'matches'}` : candidates.length ? 'Possible purchases' : 'No matching purchase found'}</h4>
              {!!exactCandidates.length && <fieldset className="cc-receipt-options"><legend>Exact amount transactions</legend>{candidateList(exactCandidates)}</fieldset>}
              {!!otherCandidates.length && <details className="cc-receipt-alternatives" open={!exactCandidates.length}><summary>Other transactions to review ({otherCandidates.length})</summary><p className="cc-muted">These amounts or currencies differ. Review the receipt’s final total and the bank’s settled charge before linking.</p><fieldset className="cc-receipt-options"><legend className="cc-receipt-sr-only">Other transactions to review</legend>{candidateList(otherCandidates)}</fieldset></details>}

              {selectedCandidate && <div className="cc-receipt-confirm"><p>Selected <strong>{selectedCandidate.merchant || 'unknown merchant'}</strong> · {money(selectedCandidate.amount, selectedCandidate.currency)} · {dateLabel(selectedCandidate.authorizedDate || selectedCandidate.date)}</p>{needsReview(selectedCandidate, selected, coverage) && <label className="cc-receipt-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} /><span>I reviewed the amount, tip, date, merchant and search coverage. This is the purchase on my receipt.</span></label>}<button className="cc-primary" disabled={busy || selectedCandidate.pending || needsReview(selectedCandidate, selected, coverage) && !acknowledged} onClick={() => void confirm()}>Confirm selected match</button></div>}
              <details className="cc-receipt-evidence cc-receipt-search-info">
                <summary>{coverage?.complete ? 'Search details' : 'Search details · partial bank history'}</summary>
                {coverage?.startDate && coverage.endDate && <p>{dateLabel(coverage.startDate)} – {dateLabel(coverage.endDate)}{coverage.fetchedTransactions != null && ` · ${coverage.fetchedTransactions} transactions checked`}</p>}
                {coverage?.checkedAt && <p>Checked {new Date(coverage.checkedAt).toLocaleString()}</p>}
                {coverage?.warnings?.map((warning, i) => <p key={i}>{warning}</p>)}
              </details>
            </div>}
            <div className="cc-receipt-more-actions">
              {ACCOUNT_SESSIONS && <button type="button" className="cc-secondary" disabled={busy} onClick={() => { setManual(true); setChoice(''); setAcknowledged(false); setStatus(''); }}>Find a purchase manually</button>}
              {canSearch && <button type="button" className={ACCOUNT_SESSIONS ? 'cc-text-button' : 'cc-primary'} disabled={busy} onClick={() => void findMatches(selected)}>{searched ? 'Refresh matches' : ACCOUNT_SESSIONS ? 'Retry bank search' : 'Find transaction matches'}</button>}
              <button type="button" className="cc-text-button cc-receipt-cash-btn" disabled={busy} onClick={() => toggleCash(selected)}><Banknote size={16} aria-hidden="true" />Paid with Cash</button>
            </div>
          </>}
          {manual && <>
            <button type="button" className="cc-text-button" onClick={() => {
              setManual(false);
              if (!searched && !busy && canSearch) void findMatches(selected);
            }}>Back to suggestions</button>
            <ManualPurchasePicker receipt={selected} initialTransaction={route.manual ? route.transaction : undefined} onMatched={() => void manualMatchSaved(selected.id)} />
          </>}
        </section>}
      </>}
      <details className="cc-receipt-extra" open={ACCOUNT_SESSIONS ? undefined : true}>
        <summary>Receipt details</summary>
        <dl className="cc-receipt-breakdown"><div><dt>Printed total</dt><dd>{money(selected.total, selected.currency)}</dd></div><div><dt>Tip</dt><dd>{selected.tip == null ? 'Not read' : money(selected.tip, selected.currency)}</dd></div>{selected.tax != null && <div><dt>Tax</dt><dd>{money(selected.tax, selected.currency)}</dd></div>}{selected.grandTotal != null && <div><dt>Final total</dt><dd>{money(selected.grandTotal, selected.currency)}</dd></div>}</dl>
        {selected.printedPaymentMethod && <p className="cc-receipt-hint">Printed payment method · {selected.printedPaymentMethod}</p>}
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
        {ACCOUNT_SESSIONS && ['extracted', 'matched'].includes(selected.status) && <ReceiptMealLink receiptId={selected.id}/>}
      </details>
    </div>}
    </>}
  </section>;
}
