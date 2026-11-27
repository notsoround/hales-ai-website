import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, HelpCircle, Link2, Minus, PartyPopper } from 'lucide-react';
import { libraryRequest } from './library';
import { accountData } from './accountSession';
import { notifyDataChanged } from './dataChanges';
import { dateText, purchaseMoney } from './bankPurchaseModel';
import { agreement, lookAlikes, receiptAmountFact, receiptDateFact, type BankSide } from './receiptFacts';
import { FactText } from './ReceiptFact';
import { exact, expectedTotal, nearbyPurchases, needsReview, type MatchResponse, type Receipt } from './receiptMatching';
import './receipt-deck.css';

// One receipt at a time, with the purchase Cupcake found for it right beside it.
// The simple default: confirm, try the next possible match, or move to the next receipt.
// Everything else (manual search, other candidates, details, photo) stays one tap away in the full receipt.

/** `exact`: the server's own exact candidate, safe to confirm in one tap. `review`: a candidate the server wants reviewed first.
 *  `lead`: a saved purchase with a similar merchant or the same amount, linked the same way a manual pick is. */
type Option = { purchase: BankSide; kind: 'exact' | 'review' | 'lead'; why: string; caution?: string };
type Loaded = { at: number; options: Option[]; alreadyMatched?: boolean; error?: string };

export type DeckOpen = 'receipt' | 'reconcile' | 'manual';
type Props = {
  /** False while the deck is off screen, so it does not search the bank for a receipt nobody is looking at. */
  active: boolean; receipts: Receipt[]; matchedCount: number; busy?: boolean;
  prepare: () => Promise<{ notice: string; incomplete: boolean }>;
  onOpen: (receipt: Receipt, where: DeckOpen) => void;
  onCash: (receipt: Receipt) => void;
  onChanged: () => Promise<unknown>;
};

const STALE_MS = 10 * 60_000; // the server keeps a candidate set for 15 minutes

async function findOptions(receipt: Receipt, prepare: Props['prepare']): Promise<Loaded> {
  const { incomplete } = await prepare();
  const data = await libraryRequest<MatchResponse>({ action: 'receipt_match_candidates', receiptId: receipt.id });
  if (data.receipt?.id !== receipt.id) throw Error('This receipt could not be checked. Open it to try again.');
  if (data.receipt.matchedTransactionId) return { at: Date.now(), options: [], alreadyMatched: true };
  const coverage = incomplete ? { ...data.coverage, complete: false } : data.coverage || { complete: false };
  const fresh = data.receipt;
  const options: Option[] = [...(data.candidates || [])]
    .sort((a, b) => Number(exact(b, fresh)) - Number(exact(a, fresh)))
    .map(item => {
      const review = item.pending || needsReview(item, fresh, coverage);
      return {
        purchase: item, kind: review ? 'review' as const : 'exact' as const,
        why: exact(item, fresh) ? 'Exact amount' : 'Close, but not exact',
        caution: item.pending ? 'Still pending at the bank. It can be linked after it posts.'
          : !exact(item, fresh) ? (item.reasons?.find(reason => /Bank amount|Currency differs/.test(reason)) || 'The receipt and the bank amount differ.')
          : review ? 'Your bank history is only partly checked, so look this one over first.' : undefined,
      };
    });
  for (const lead of data.suggestedPurchases || []) if (!lead.pending) options.push({ purchase: lead, kind: 'lead', why: 'Similar merchant, same amount' });
  if (!options.length) for (const { purchase, sameMerchant, sameAmount } of await nearbyPurchases(fresh))
    options.push({ purchase, kind: 'lead', why: sameMerchant && sameAmount ? 'Same merchant name and amount' : sameMerchant ? 'Same merchant name' : 'Same amount' });
  return { at: Date.now(), options };
}

export function ReceiptMatchDeck({ active, receipts, matchedCount, busy, prepare, onOpen, onCash, onChanged }: Props) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [pick, setPick] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [done, setDone] = useState(0), [lastMatched, setLastMatched] = useState('');
  const loading = useRef(new Set<string>());
  const drag = useRef<{ x: number; y: number } | null>(null);
  const index = Math.max(0, receipts.findIndex(receipt => receipt.id === currentId));
  const receipt = receipts[index] as Receipt | undefined;
  const state = receipt ? loaded[receipt.id] : undefined;

  const load = useCallback((target: Receipt, force = false) => {
    if (loading.current.has(target.id)) return;
    loading.current.add(target.id);
    if (force) setLoaded(all => { const next = { ...all }; delete next[target.id]; return next; });
    findOptions(target, prepare)
      .then(result => setLoaded(all => ({ ...all, [target.id]: result })))
      .catch(cause => setLoaded(all => ({ ...all, [target.id]: { at: Date.now(), options: [], error: cause instanceof Error ? cause.message : 'This receipt could not be checked.' } })))
      .finally(() => loading.current.delete(target.id));
  }, [prepare]);
  // Look for the match as soon as a receipt comes up, and again if what was found has gone stale.
  useEffect(() => {
    if (active && receipt && (!state || Date.now() - state.at > STALE_MS)) load(receipt);
  }, [active, receipt, state, load]);
  // A receipt the server already matched elsewhere leaves the deck.
  useEffect(() => { if (state?.alreadyMatched) void onChanged(); }, [state?.alreadyMatched, onChanged]);

  const go = (step: number) => {
    if (!receipts.length || saving) return;
    setError(''); setLastMatched('');
    setCurrentId(receipts[(index + step + receipts.length) % receipts.length].id);
  };
  const options = useMemo(() => state?.options || [], [state]);
  const optionIndex = receipt ? pick[receipt.id] ?? 0 : 0;
  const option = options[optionIndex] as Option | undefined;
  const twins = useMemo(() => lookAlikes(options.map(item => ({ ...item.purchase }))), [options]);

  async function confirm() {
    if (!receipt || !option || saving || busy || option.kind === 'review') return;
    setSaving(true); setError('');
    try {
      const { purchase } = option;
      const result = option.kind === 'exact'
        ? await libraryRequest<{ receipt: Receipt }>({ action: 'receipt_confirm_match', receiptId: receipt.id, transactionId: purchase.transactionId, acknowledgeDifferences: false })
        : await accountData<{ receipt: Receipt }>({
            action: 'receipt_manual_match', receiptId: receipt.id, transactionId: purchase.transactionId,
            expectedRevision: receipt.matchRevision ?? 0, acknowledgeDifferences: true,
            expectedPurchase: { merchant: purchase.merchant, date: purchase.date, authorizedDate: purchase.authorizedDate ?? null, amount: purchase.amount, currency: purchase.currency },
          });
      if (result.receipt?.id !== receipt.id || result.receipt.matchedTransactionId !== purchase.transactionId) throw Error('unconfirmed');
      setDone(count => count + 1); setLastMatched(receipt.merchant || 'Receipt');
      // Stay in place: the next unmatched receipt slides into this position once the list refreshes.
      const after = receipts[index + 1] || receipts[index - 1];
      setCurrentId(after ? after.id : null);
      notifyDataChanged('purchase');
      await onChanged();
    } catch {
      setError('That link was not saved. Checking this receipt again.');
      load(receipt, true);
    } finally { setSaving(false); }
  }

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('input, textarea, select')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
  };
  const down = (event: PointerEvent<HTMLElement>) => { drag.current = (event.target as HTMLElement).closest('button, a') ? null : { x: event.clientX, y: event.clientY }; };
  const up = (event: PointerEvent<HTMLElement>) => {
    const start = drag.current; drag.current = null;
    if (!start || receipts.length < 2) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  const total = matchedCount + receipts.length;
  const progress = total ? Math.round(matchedCount / total * 100) : 0;
  const status = lastMatched ? `${lastMatched} matched. ${receipts.length ? `${receipts.length} to go.` : 'All caught up.'}` : '';

  if (!active) return null; // off screen: keep the session's progress, draw nothing
  if (!receipts.length) return done > 0 ? <section className="cc-deck cc-deck-clear" aria-label="Match receipts">
    <p className="cc-deck-done" role="status"><PartyPopper size={22} aria-hidden="true" /><strong>All caught up.</strong><span>{done === 1 ? 'That receipt is matched.' : `${done} receipts matched just now.`} Every saved receipt has its bank purchase or is marked cash.</span></p>
  </section> : null;
  if (!receipt) return null;

  const checks = option ? agreement(receipt, option.purchase) : [];
  const several = receipts.length > 1;
  return <section className="cc-deck" aria-label="Match receipts" aria-roledescription="carousel" onKeyDown={onKey}>
    <header className="cc-deck-head">
      <div>
        <h3>Match receipts</h3>
        <p className="cc-deck-count">{receipts.length} to match{done > 0 && <> · <span className="cc-deck-streak">{done} matched just now</span></>}</p>
      </div>
      {several && <div className="cc-deck-pager">
        <button type="button" aria-label="Previous receipt" disabled={saving} onClick={() => go(-1)}><ArrowLeft size={18} aria-hidden="true" /></button>
        <span aria-hidden="true">{index + 1} / {receipts.length}</span>
        <button type="button" aria-label="Next receipt" disabled={saving} onClick={() => go(1)}><ArrowRight size={18} aria-hidden="true" /></button>
      </div>}
    </header>
    <div className="cc-deck-meter" role="img" aria-label={`${matchedCount} of ${total} receipts matched`}><span style={{ width: `${progress}%` }} /></div>
    <p className="cc-deck-status" role="status" aria-live="polite">{status}</p>

    <div className="cc-deck-card" key={receipt.id} role="group" aria-roledescription="slide" aria-label={`Receipt ${index + 1} of ${receipts.length}: ${receipt.merchant || 'merchant not read'}`}
      onPointerDown={down} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
      <div className="cc-deck-pair">
        <div className="cc-deck-side">
          <span className="cc-deck-label">Your receipt</span>
          <strong className="cc-deck-name">{receipt.merchant || 'Merchant not read'}</strong>
          <span className="cc-deck-amount"><FactText fact={receiptAmountFact(expectedTotal(receipt), receipt.currency)} /></span>
          <small><FactText fact={receiptDateFact(receipt.date)} /></small>
        </div>
        <div className="cc-deck-link" aria-hidden="true">{option ? <Link2 size={18} /> : <HelpCircle size={18} />}</div>
        {!state ? <div className="cc-deck-side is-bank is-waiting" role="status"><span className="cc-deck-label">Possible match</span><span className="cc-deck-looking">Looking through your bank purchases…</span></div>
          : option ? <div className="cc-deck-side is-bank">
            <span className="cc-deck-label">Possible match{options.length > 1 && ` · ${optionIndex + 1} of ${options.length}`}</span>
            <strong className="cc-deck-name">{option.purchase.merchant || 'Merchant unavailable'}</strong>
            <span className="cc-deck-amount"><span className="cc-receipt-nowrap">{purchaseMoney(option.purchase.amount, option.purchase.currency)}</span></span>
            <small>{option.purchase.pending ? 'Pending' : 'Posted'} {dateText(option.purchase.date)} · <span className="cc-receipt-nowrap">Ref {option.purchase.transactionId.slice(-8)}</span></small>
          </div>
          : <div className="cc-deck-side is-bank is-empty">
            <span className="cc-deck-label">Possible match</span>
            <strong className="cc-deck-name">{state.error ? 'Couldn’t check this one' : options.length ? 'None of those' : 'Nothing yet'}</strong>
            <small>{state.error || (options.length ? 'Search your bank purchases for it, or mark the receipt as cash.' : 'No saved bank purchase has this merchant or amount. It may not have posted yet.')}</small>
          </div>}
      </div>

      {option && <ul className="cc-deck-checks" aria-label="How they compare">
        {checks.map(check => <li key={check.text} data-state={check.state}>
          {check.state === 'yes' ? <Check size={14} aria-hidden="true" /> : check.state === 'no' ? <Minus size={14} aria-hidden="true" /> : <HelpCircle size={14} aria-hidden="true" />}{check.text}
        </li>)}
      </ul>}
      {option && <p className="cc-deck-why">{option.why}{twins.has(option.purchase.transactionId) && ' · identical to another purchase, told apart only by the Ref'}</p>}
      {option?.caution && <p className="cc-deck-caution">{option.caution}</p>}
      {error && <p className="cc-deck-caution" role="alert">{error}</p>}

      <div className="cc-deck-actions">
        {option?.kind === 'review' ? <button type="button" className="cc-primary" disabled={saving || busy} onClick={() => onOpen(receipt, 'reconcile')}>Review this match</button>
          : option ? <button type="button" className="cc-primary" disabled={saving || busy} onClick={() => void confirm()}>{saving ? 'Linking…' : 'Yes, it’s a match'}</button>
          : state && !state.error ? <button type="button" className="cc-primary" disabled={busy} onClick={() => onOpen(receipt, 'manual')}>Search bank purchases</button>
          : state?.error ? <button type="button" className="cc-primary" onClick={() => load(receipt, true)}>Check again</button> : null}
        {option && <button type="button" className="cc-secondary" disabled={saving} onClick={() => { setError(''); setPick(all => ({ ...all, [receipt.id]: optionIndex + 1 })); }}>{optionIndex + 1 < options.length ? 'Not this one' : 'Not a match'}</button>}
        {!option && options.length > 0 && <button type="button" className="cc-secondary" onClick={() => setPick(all => ({ ...all, [receipt.id]: 0 }))}>Show them again</button>}
        {several && !option && <button type="button" className="cc-secondary" onClick={() => go(1)}>Next receipt</button>}
      </div>
      <div className="cc-deck-more">
        <button type="button" className="cc-text-button" onClick={() => onOpen(receipt, 'receipt')}>Open receipt</button>
        <button type="button" className="cc-text-button" onClick={() => onOpen(receipt, 'manual')}>Search myself</button>
        <button type="button" className="cc-text-button" disabled={saving || busy} onClick={() => { setLastMatched(''); onCash(receipt); }}>Paid with cash</button>
      </div>
    </div>
    {several && <p className="cc-deck-hint">Swipe or use the arrows to move between receipts.</p>}
  </section>;
}
