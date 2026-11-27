import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Banknote, CheckCircle2, Package, ShoppingBasket, X } from 'lucide-react';
import { libraryRequest } from './library';
import { ACCOUNT_SESSIONS } from './accountMode';
import { AccountReceiptPhoto } from './AccountReceiptPhoto';
import { dateText, purchaseMoney, type Purchase } from './bankPurchaseModel';
import { amountText, dayText, linkedTo, lookAlikes, LOOK_ALIKE_NOTE, receiptAmountFact, receiptBreakdown, receiptDateFact, type Fact, type LinkedPurchase } from './receiptFacts';
import { ManualPurchasePicker } from './ManualPurchasePicker';
import { ReceiptMealLink } from './ReceiptMealLink';
import { FactText } from './ReceiptFact';
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
type BankRefresh = { notice: string; incomplete: boolean };
type MatchSummary = { exactCount?: number; exactPostedCount?: number; pendingCount?: number; candidateCount?: number };
type MatchResponse = { receipt: Receipt; candidates: Candidate[]; suggestedPurchases?: Purchase[]; coverage?: Coverage; matchSummary?: MatchSummary };
type Props = { active?: boolean; onWork?: (busy: boolean) => void };
/** A saved purchase the automatic search did not suggest but that shares the receipt's merchant name or amount. */
type Nearby = { purchase: Purchase; sameMerchant: boolean; sameAmount: boolean };

// A value the photo did not show reads "not read"; the gap or the source of a fact is a small tag beside it.
const money = (amount: number | null | undefined, currency: string | null) => amountText(amount, currency) || 'Not read';
const dateLabel = (value: string | null | undefined) => dayText(value) || 'Date not read';
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

// When the automatic search suggests nothing, look in the saved purchases for the receipt's own merchant name and amount,
// so the screen never says "nothing found" while a plain search would find the purchase.
async function nearbyPurchases(receipt: Receipt): Promise<Nearby[]> {
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
  const [leads, setLeads] = useState<Purchase[]>([]);
  const [leadId, setLeadId] = useState<string>();
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [bankSide, setBankSide] = useState<LinkedPurchase | null>(null), [bankSideLoading, setBankSideLoading] = useState(false);
  const [bankNotice, setBankNotice] = useState('');
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
  const bankRefresh = useRef<Promise<BankRefresh> | null>(null);
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
    setCandidates([]); setLeads([]); setNearby([]); setLeadId(undefined); setBankNotice(''); setCoverage(null); setSummary(null); setChoice(''); setAcknowledged(false); setSearchedAt(0);
  }, []);
  const resetMatches = useCallback(() => {
    clearResults(); setUnlinkPrompt(false); setReconciling(false); setManual(false);
  }, [clearResults]);
  const refreshBank = useCallback(() => {
    if (!ACCOUNT_SESSIONS) return Promise.resolve({ notice: '', incomplete: false });
    if (bankRefresh.current) return bankRefresh.current;
    const pending = (async () => {
      try {
        const status = await accountData<{ configured: boolean; connections: {connectionId: string; status: string}[] }>({ action: 'bank_connection_status' });
        if (!status.configured || !Array.isArray(status.connections)) return { notice: 'Searching saved purchases. Bank refresh is unavailable for this account.', incomplete: false };
        const connected = status.connections.filter(connection => connection.status === 'connected');
        const needsAttention = status.connections.some(connection => ['reconnect_required', 'disconnecting', 'disconnect_uncertain'].includes(connection.status));
        const results = await Promise.allSettled(connected.map(connection => accountData({ action: 'bank_sync', connectionId: connection.connectionId })));
        if (results.some(result => result.status === 'rejected')) return { notice: 'Some bank transactions could not be refreshed. Matching uses previously saved transactions.', incomplete: true };
        if (connected.length) notifyDataChanged('purchase');
        if (needsAttention) return { notice: 'A bank connection needs attention. Check Settings → Connections. Saved purchases are still available.', incomplete: true };
        if (!connected.length) return { notice: 'Searched your saved purchases. To refresh directly from a bank, open Settings → Connections and connect it.', incomplete: false };
        return { notice: '', incomplete: false };
      } catch { return { notice: 'Bank transactions could not be refreshed. Matching uses previously saved transactions.', incomplete: true }; }
    })();
    bankRefresh.current = pending;
    void pending.finally(() => { if (bankRefresh.current === pending) bankRefresh.current = null; });
    return pending;
  }, []);
  useEffect(() => { if (active && ACCOUNT_SESSIONS && route.bank && !route.transaction) void refreshBank(); }, [active, route.bank, route.transaction, refreshBank]);
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
      const ready = receipt.status === 'extracted' && !receipt.matchedTransactionId && !isCash(receipt) && expectedTotal(receipt) != null;
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
      const { notice, incomplete } = await refreshBank();
      const data = await libraryRequest<MatchResponse>({ action: 'receipt_match_candidates', receiptId: receipt.id });
      if (!stillHere()) return;
      if (data.receipt?.id !== receipt.id) throw Error('The receipt comparison could not be verified.');
      if (data.receipt.matchedTransactionId) { setSelected(data.receipt); resetMatches(); setStatus(''); return; }
      const target = ACCOUNT_SESSIONS && !route.manual && route.receipt === receipt.id ? route.transaction : undefined;
      const options = target ? data.candidates.filter(item => item.transactionId === target) : data.candidates;
      const others = ACCOUNT_SESSIONS && !target && !options.length && !data.suggestedPurchases?.length ? await nearbyPurchases(data.receipt) : [];
      if (!stillHere()) return;
      setNearby(others);
      setSelected(data.receipt); setCandidates(options); setLeads(data.suggestedPurchases || []); setBankNotice(notice);
      setCoverage(incomplete ? { ...data.coverage, complete: false } : data.coverage || { complete: false, warnings: ['Search coverage was not provided. Refresh before choosing a different amount.'] });
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

  // The bank's own record of the linked purchase: it settles a date or currency the photo did not show.
  const matchedId = ACCOUNT_SESSIONS ? selected?.matchedTransactionId || null : null, matchedFor = selected?.id;
  useEffect(() => {
    setBankSide(null);
    if (!active || !matchedId || !matchedFor) { setBankSideLoading(false); return; }
    const abort = new AbortController(); setBankSideLoading(true);
    accountData<{ purchase: LinkedPurchase }>({ action: 'bank_purchase_get', transactionId: matchedId }, abort.signal)
      .then(data => { if (!abort.signal.aborted) setBankSide(linkedTo(matchedFor, matchedId, data.purchase)); })
      .catch(() => undefined)
      .finally(() => { if (!abort.signal.aborted) setBankSideLoading(false); });
    return () => abort.abort();
  }, [active, matchedId, matchedFor]);

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
  const candidateTwins = lookAlikes(candidates);
  const candidateList = (items: Candidate[]) => items.map(item => {
    if (!selected) return null;
    const isExact = exact(item, selected), difference = item.amountDifference ?? (item.currency === selected.currency && expectedTotal(selected) != null ? Math.round((item.amount - expectedTotal(selected)!) * 100) / 100 : null);
    return <div key={item.transactionId} className={`cc-receipt-candidate ${choice === item.transactionId ? 'is-selected' : ''}`}>
      <label className="cc-receipt-choice">
        <input disabled={item.pending || busy} type="radio" name="receipt-match" checked={choice === item.transactionId} onChange={() => { setChoice(item.transactionId); setAcknowledged(false); }} />
        <span className="cc-receipt-merchant"><strong>{item.merchant || 'Merchant unavailable'}</strong><small>{dateLabel(item.authorizedDate || item.date)} · {item.pending ? 'Pending' : 'Posted'}{ACCOUNT_SESSIONS && <> · <span className="cc-receipt-nowrap">Ref {item.transactionId.slice(-8)}</span></>}{item.authorizedDate && item.authorizedDate !== item.date && <> · Posted {dateText(item.date)}</>}</small></span>
        <span className="cc-receipt-amount"><strong>{money(item.amount, item.currency)}</strong><small className={isExact ? 'cc-receipt-exact' : 'cc-receipt-difference'}>{isExact ? 'Exact amount' : item.currency !== selected.currency ? 'Different currency' : difference == null ? 'Check amount' : `${money(Math.abs(difference), item.currency)} ${difference > 0 ? 'higher' : 'lower'}`}</small></span>
      </label>
      {item.pending && <p className="cc-receipt-hint">Available to confirm after it posts. The final amount and transaction ID may change.</p>}
      {!isExact && <p className="cc-receipt-hint">{item.reasons?.find(reason => /Bank amount|Currency differs/.test(reason)) || 'The receipt and bank amount differ. Check the total, tip, merchant and date.'}</p>}
      <details className="cc-receipt-evidence"><summary>Compare receipt & bank details</summary><ul>{(item.reasons?.length ? item.reasons : ['Check the bank amount, receipt date and full merchant name before confirming.']).map((reason, index) => <li key={index}>{reason}</li>)}</ul><p>Receipt: {selected.merchant || 'merchant not read'} · {dateLabel(selected.date)} · {money(expectedTotal(selected), selected.currency)}</p><p>Bank posting date: {dateLabel(item.date)}</p><p className="cc-receipt-source">Transaction ID <code>{item.transactionId}</code></p></details>
    </div>;
  });

  const selectedIsCash = selected ? isCash(selected) : false;
  const selectedIsGrocery = selected ? isGroceryReceipt(selected) : false;
  const selectedInPantry = selected ? pantryRoutedIds.has(selected.id) : false;

  const searched = searchedAt > 0;
  const completeDetails = !!selected?.currency && !!selected.date && expectedTotal(selected) != null;
  const canSearch = completeDetails || !!(ACCOUNT_SESSIONS && selected?.merchant && expectedTotal(selected) != null);
  const bankView = ACCOUNT_SESSIONS && !route.receipt && (!!route.transaction || !!route.bank);
  const receiptDetail = !!route.receipt && ACCOUNT_SESSIONS;
  const bankListVisible = active && bankView && !route.transaction;
  // One back control: it always goes to the step before this one.
  const panelOpen = !!selected && ACCOUNT_SESSIONS && reconciling && !selected.matchedTransactionId && !selectedIsCash && !['saved_unread', 'extracting', 'extraction_failed'].includes(selected.status);
  const step = panelOpen && manual ? 'manual' : panelOpen ? 'reconcile' : 'receipt';
  const hasSuggestions = searched && (candidates.length + leads.length + nearby.length > 0);
  const backLabel = step === 'manual' ? (hasSuggestions ? 'Back to suggestions' : 'Back to reconcile') : step === 'reconcile' ? 'Back to receipt' : route.transaction ? 'Back to bank purchase' : 'Close receipt';
  const stepBack = () => {
    if (!selected || step === 'receipt') { goBack(); return; }
    if (step === 'manual') { setManual(false); if (!searched && !busy && canSearch) void findMatches(selected); return; }
    setManual(false); setLeadId(undefined); setReconciling(false);
  };
  const bank = selected ? linkedTo(selected.id, selected.matchedTransactionId, bankSide) : null;
  const checkingBank = bankSideLoading && !!selected?.matchedTransactionId;
  const dateFact: Fact = selected ? receiptDateFact(selected.date, bank) : { text: '', settled: false };
  const amountFact: Fact = selected ? receiptAmountFact(expectedTotal(selected), selected.currency, bank) : { text: '', settled: false };
  const whileChecking = (fact: Fact): Fact => checkingBank && !fact.settled ? { text: fact.tag ? fact.text : 'Checking the bank record…', settled: false } : fact;
  // The bank's currency applies to the receipt's figures only when the bank charged the receipt's own amount.
  const shownCurrency = selected ? selected.currency || (bank && bank.amount === expectedTotal(selected) ? bank.currency : null) : null;
  const nearbyTwins = lookAlikes([...leads, ...nearby.map(row => row.purchase)]);
  const allSameMerchant = nearby.length > 0 && nearby.every(row => row.sameMerchant);
  useEffect(() => { if (bankListVisible) setBankListOpened(true); }, [bankListVisible]);
  return <section className="cc-studio cc-library-workspace cc-receipts" aria-busy={busy}>
    <div className="cc-receipt-top-row">
      <div>
        <h2>{ACCOUNT_SESSIONS ? 'Receipts & bank purchases' : 'Receipts'}</h2>
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
      {ACCOUNT_SESSIONS ? <AccountReceiptPhoto onSaved={receiptId => void photoSaved(receiptId)} compact={receipts.length > 0}/> : <>
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
          <strong>{receipt.merchant || (receipt.status === 'saved_unread' ? 'Receipt photo' : 'Merchant not read')}</strong>
          <small>{dateLabel(receipt.date)} · <em className={`cc-receipt-pill is-${matched ? 'matched' : cash ? 'cash' : 'unmatched'}`}>{badgeLabel}</em></small>
        </span>
        <span className="cc-receipt-row-amount"><FactText fact={receiptAmountFact(expectedTotal(receipt), receipt.currency)} /></span>
      </button>;
    })}</div>}
    </div>
    {receiptDetail && !selected && <div className="cc-card"><button className="cc-text-button" onClick={goBack}>Back</button>{receiptLoading ? <p role="status">Loading receipt…</p> : <button className="cc-secondary" onClick={() => setReceiptRetry(n => n + 1)}>Retry receipt</button>}</div>}
    {status && <p className={busy ? 'cc-thinking' : 'cc-notice'} role="status" aria-live="polite">{status}</p>}
    {selected && <div key={selected.id} className="cc-card cc-receipt-selected" ref={selectedCard}>
      <div className="cc-receipt-nav">
        <button type="button" className="cc-text-button cc-receipt-back" onClick={stepBack}>{step === 'receipt' && !route.transaction ? <X size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}{backLabel}</button>
        {step !== 'receipt' && <button type="button" className="cc-receipt-x" aria-label="Close receipt" title="Close receipt" onClick={goBack}><X size={18} aria-hidden="true" /></button>}
      </div>
      <div className="cc-receipt-heading"><div><span className="cc-kind">Saved receipt · {searched && !reconciling && !candidates.length && !isMatched(selected) && !selectedIsCash ? 'No bank match yet' : receiptState(selected, isMatched(selected), selectedIsCash)}</span><h3>{selected.merchant || 'Merchant not read'}</h3><p className="cc-muted cc-receipt-fact"><FactText fact={whileChecking(dateFact)} /></p></div><div className="cc-receipt-total"><small>Expected charge</small><strong>{amountFact.text}</strong>{whileChecking(amountFact).tag && <span className="cc-receipt-tag">{amountFact.tag}</span>}</div></div>
      {ACCOUNT_SESSIONS && ['saved_unread', 'extracting', 'extraction_failed'].includes(selected.status) ? <AccountReceiptReader key={selected.id} receiptId={selected.id} autoStart={autoReadId === selected.id} canStart={selected.status !== 'extracting'} onFinished={() => void readingFinished(selected.id)}/> : selected.status === 'extraction_failed' ? <><p className="cc-notice">The photo is saved. Reading it needs another try.</p><button className="cc-primary" disabled={busy} onClick={() => void retry()}>Retry saved receipt</button></> : selected.matchedTransactionId ? <div className="cc-receipt-confirmed"><strong>{selected.matchMethod === 'automatic' ? 'Automatically matched to a bank purchase.' : selected.matchMethod === 'confirmed' ? 'Matched to the transaction you confirmed.' : 'Matched to a bank purchase.'}</strong>
        {bank && <p className="cc-receipt-bank-line">Bank purchase: {bank.merchant || 'Merchant unavailable'} · {bank.authorizedDate && bank.authorizedDate !== bank.date && <>Bought {dateText(bank.authorizedDate)} · </>}{bank.pending ? 'Pending' : 'Posted'} {dateText(bank.date)} · <span className="cc-receipt-nowrap">{purchaseMoney(bank.amount, bank.currency)}</span> · <span className="cc-receipt-nowrap">Ref {bank.transactionId.slice(-8)}</span></p>}
        {ACCOUNT_SESSIONS && <a className="cc-secondary" href={receiptWorkspaceUrl({transaction:selected.matchedTransactionId})} onClick={e => purchaseLinkClick(e, () => navigate({ transaction: selected.matchedTransactionId! }))}>Open matched bank purchase</a>}<details className="cc-receipt-evidence cc-receipt-source"><summary>Bank reference</summary><code>{selected.matchedTransactionId}</code></details>
        {ACCOUNT_SESSIONS && (unlinkPrompt ? <div className="cc-receipt-unlink" role="group" aria-label="Unlink this bank purchase?">
          <strong>Unlink this bank purchase?</strong><p>The receipt and purchase will both stay saved.</p>
          <div className="cc-action-row"><button type="button" className="cc-secondary" disabled={busy} onClick={() => void unlink()}>Unlink purchase</button><button type="button" className="cc-text-button" disabled={busy} onClick={() => setUnlinkPrompt(false)}>Cancel</button></div>
        </div> : <button type="button" className="cc-text-button" disabled={busy} onClick={() => setUnlinkPrompt(true)}>Change match</button>)}
      </div> : selectedIsCash ? <div className="cc-receipt-cash-confirmed"><div><strong><CheckCircle2 size={16} aria-hidden="true" />Paid with Cash</strong><p className="cc-muted">Excluded from the bank-match queue. {selected.paymentMethod === 'cash' || selected.paidWithCash ? 'Saved to your account.' : 'Saved on this device.'}</p></div><button type="button" className="cc-secondary" disabled={busy} onClick={() => toggleCash(selected)}>Undo — needs bank match</button></div> : <>
        {ACCOUNT_SESSIONS && !reconciling && <button type="button" className="cc-primary" aria-expanded={false} aria-controls={panelId}
          onClick={() => {
            setManual(false); setLeadId(undefined); setReconciling(!reconciling);
            // Saved candidate sets expire on the server after 15 minutes.
            if (!reconciling && !busy && canSearch && Date.now() - searchedAt >= 15 * 60_000) void findMatches(selected);
          }}>
          Reconcile
        </button>}
        {(!ACCOUNT_SESSIONS || reconciling) && <section id={panelId} className="cc-receipt-reconcile" aria-label={manual ? 'Find a purchase manually' : 'Reconcile receipt'}>
          {!manual && <>
            {busy && !searched && <p className="cc-muted" role="status">Looking for the bank purchase…</p>}
            {!completeDetails && <p className="cc-muted">{canSearch ? 'Checking the merchant and printed amount. Review the bank date and currency before linking.' : 'Choose a saved purchase manually. This receipt needs more detail for a suggested match.'}</p>}
            {selected.amountWarning && <p className="cc-receipt-caution">{selected.amountWarning}</p>}
            {searched && <div className="cc-receipt-results">
              <h4 className="cc-receipt-result-heading" aria-live="polite">{leads.length ? 'Suggested purchases' : exactCount ? `${exactCount} exact amount ${exactCount === 1 ? 'match' : 'matches'}` : candidates.length ? 'Possible purchases' : nearby.length ? (allSameMerchant && selected.merchant ? `${nearby.length} saved ${nearby.length === 1 ? 'purchase' : 'purchases'} from ${selected.merchant}` : `${nearby.length} saved ${nearby.length === 1 ? 'purchase' : 'purchases'} to check`) : 'No matching purchase found'}</h4>
              {leads.map(p => <button key={p.transactionId} type="button" className="cc-bank-purchase-row" onClick={() => { setLeadId(p.transactionId); setManual(true); }}>
                <span><strong>{p.merchant}</strong><small>{dateLabel(p.date)} · Posted · <span className="cc-receipt-nowrap">Ref {p.transactionId.slice(-8)}</span> · Similar merchant and same printed amount</small></span>
                <strong>{purchaseMoney(p.amount, p.currency)}</strong>
              </button>)}
              {!!nearby.length && <p className="cc-muted">The automatic search did not suggest {nearby.length === 1 ? 'this purchase' : 'these purchases'}. Pick {nearby.length === 1 ? 'it' : 'the one that is yours'} to compare with the receipt before linking.</p>}
              {nearby.map(({ purchase: p, sameMerchant, sameAmount }) => <button key={p.transactionId} type="button" className="cc-bank-purchase-row" onClick={() => { setLeadId(p.transactionId); setManual(true); }}>
                <span><strong>{p.merchant || 'Merchant unavailable'}</strong><small>{dateText(p.date)} · Posted · <span className="cc-receipt-nowrap">Ref {p.transactionId.slice(-8)}</span> · {sameMerchant && sameAmount ? 'Same merchant name and amount' : sameMerchant ? 'Same merchant name' : 'Same amount'}</small></span>
                <strong>{purchaseMoney(p.amount, p.currency)}</strong>
              </button>)}
              {nearbyTwins.size > 0 && <p className="cc-receipt-hint cc-receipt-twins">{LOOK_ALIKE_NOTE}</p>}
              {ACCOUNT_SESSIONS && !leads.length && !candidates.length && !nearby.length && <p className="cc-muted">No saved bank purchase has this receipt’s merchant name or amount. Search for another detail, or check again after the charge posts.</p>}
              {bankNotice && <p className="cc-muted">{bankNotice}</p>}
              {!!exactCandidates.length && <fieldset className="cc-receipt-options"><legend>Exact amount transactions</legend>{candidateList(exactCandidates)}</fieldset>}
              {ACCOUNT_SESSIONS && candidateTwins.size > 0 && <p className="cc-receipt-hint cc-receipt-twins">{LOOK_ALIKE_NOTE}</p>}
              {!!otherCandidates.length && <details className="cc-receipt-alternatives" open={!exactCandidates.length}><summary>Other transactions to review ({otherCandidates.length})</summary><p className="cc-muted">These amounts or currencies differ. Review the receipt’s final total and the bank’s settled charge before linking.</p><fieldset className="cc-receipt-options"><legend className="cc-receipt-sr-only">Other transactions to review</legend>{candidateList(otherCandidates)}</fieldset></details>}

              {selectedCandidate && <div className="cc-receipt-confirm"><p>Selected <strong>{selectedCandidate.merchant || 'Merchant unavailable'}</strong> · {money(selectedCandidate.amount, selectedCandidate.currency)} · {dateLabel(selectedCandidate.authorizedDate || selectedCandidate.date)}</p>{needsReview(selectedCandidate, selected, coverage) && <label className="cc-receipt-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} /><span>I reviewed the amount, tip, date, merchant and search coverage. This is the purchase on my receipt.</span></label>}<button className="cc-primary" disabled={busy || selectedCandidate.pending || needsReview(selectedCandidate, selected, coverage) && !acknowledged} onClick={() => void confirm()}>Confirm selected match</button></div>}
              <details className="cc-receipt-evidence cc-receipt-search-info">
                <summary>{coverage?.complete ? 'Search details' : 'Search details · partial bank history'}</summary>
                {coverage?.startDate && coverage.endDate && <p>{dateLabel(coverage.startDate)} – {dateLabel(coverage.endDate)}{coverage.fetchedTransactions != null && ` · ${coverage.fetchedTransactions} transactions checked`}</p>}
                {coverage?.checkedAt && <p>Checked {new Date(coverage.checkedAt).toLocaleString()}</p>}
                {coverage?.warnings?.filter(warning => warning !== bankNotice).map((warning, i) => <p key={i}>{warning}</p>)}
              </details>
            </div>}
            <div className="cc-receipt-more-actions">
              {ACCOUNT_SESSIONS && <button type="button" className="cc-secondary" disabled={busy} onClick={() => { setLeadId(undefined); setManual(true); setChoice(''); setAcknowledged(false); setStatus(''); }}>Find a purchase manually</button>}
              {canSearch && <button type="button" className={ACCOUNT_SESSIONS ? 'cc-text-button' : 'cc-primary'} disabled={busy} onClick={() => void findMatches(selected)}>{searched ? 'Refresh matches' : ACCOUNT_SESSIONS ? 'Retry bank search' : 'Find transaction matches'}</button>}
              <button type="button" className="cc-text-button cc-receipt-cash-btn" disabled={busy} onClick={() => toggleCash(selected)}><Banknote size={16} aria-hidden="true" />Paid with Cash</button>
            </div>
          </>}
          {manual && <>
            <ManualPurchasePicker receipt={selected} initialTransaction={leadId || (route.manual ? route.transaction : undefined)} onMatched={() => void manualMatchSaved(selected.id)} />
          </>}
        </section>}
      </>}
      <details className="cc-receipt-extra" open={ACCOUNT_SESSIONS ? undefined : true}>
        <summary>Receipt details</summary>
        <dl className="cc-receipt-breakdown">{receiptBreakdown(selected).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{money(row.amount, shownCurrency)}</dd></div>)}</dl>
        {selected.printedPaymentMethod && <p className="cc-receipt-hint">Printed payment method · {selected.printedPaymentMethod}</p>}
        {selected.amountBasis === 'total_plus_visible_tip' && <p className="cc-receipt-hint">Expected charge = printed total {money(selected.total, selected.currency)} + entered tip {money(selected.tip, selected.currency)}.</p>}
        {selected.amountWarning && <p className="cc-receipt-caution">{selected.amountWarning}{selected.alternativeTotalWithTip != null ? ` Total plus tip would be ${money(selected.alternativeTotalWithTip, selected.currency)}.` : ''}</p>}
        <div className="cc-action-row cc-receipt-sources"><button className="cc-secondary" disabled={busy} onClick={() => void showOriginal()}>{original ? 'Hide receipt photo' : 'View saved receipt photo'}</button><a href={receiptLink(selected.id)}>Link to this receipt</a></div>
        {original && <figure className="cc-receipt-original"><img className="cc-receipt-photo" src={original} alt={`Saved receipt from ${selected.merchant || 'merchant not read'}`} /><figcaption>Saved privately with this receipt.</figcaption></figure>}
        {!!selected.lineItems?.length && <details className="cc-receipt-evidence"><summary>Receipt line items ({selected.lineItems.length})</summary><ul>{selected.lineItems.map((item, index) => <li key={index}>{item.description}{item.quantity != null && item.quantity !== 1 ? ` × ${item.quantity}` : ''}{item.amount != null ? ` — ${money(item.amount, selected.currency)}` : ''}</li>)}</ul></details>}
        {ACCOUNT_SESSIONS && !!selected.lineItems?.length && (selectedIsGrocery || selected.matchedTransactionId || selectedIsCash) && (
          <div className="cc-receipt-pantry-box">
            <div>
              <strong><Package size={14} aria-hidden="true" />{selectedIsGrocery ? 'Grocery receipt → Household pantry' : 'Stock Household pantry'}</strong>
              <small>{selectedInPantry ? 'Items from this receipt were added to your estimated local pantry.' : `Route ${selected.lineItems.length} line ${selected.lineItems.length === 1 ? 'item' : 'items'} into your estimated local pantry.`}</small>
            </div>
            <div className="cc-receipt-pantry-actions">
              <button type="button" className="cc-secondary" disabled={busy} onClick={() => sendToPantry(selected)}>
                {selectedInPantry ? 'Restock pantry again' : `Send ${selected.lineItems.length} ${selected.lineItems.length === 1 ? 'item' : 'items'} to pantry`}
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
