import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountData } from './accountSession';
import { dateText, purchaseMoney, type Purchase } from './bankPurchaseModel';
import { lookAlikes, LOOK_ALIKE_NOTE, receiptAmountFact, receiptDateFact } from './receiptFacts';
import { FactText } from './ReceiptFact';
import './manual-purchase-picker.css';

type ReceiptSummary = {
  id: string; merchant: string | null; date: string | null; total: number | null; currency: string | null;
  expectedTotal?: number | null; grandTotal?: number | null; matchRevision?: number;
};

function unavailable(purchase: Purchase) {
  if (purchase.pending) return 'Pending';
  if (purchase.removed) return 'Removed by bank';
  if (purchase.matchConflict || purchase.matchedReceiptId) return 'Already linked';
  return '';
}

export function ManualPurchasePicker({ receipt, initialTransaction, onMatched }: { receipt: ReceiptSummary; initialTransaction?: string; onMatched: () => void }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Purchase[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const savingNow = useRef(false);
  useEffect(() => {
    if (!initialTransaction) return;
    const controller = new AbortController();
    request.current = controller;
    setSelected(null); setLoading(true); setError('');
    accountData<{purchase: Purchase}>({ action: 'bank_purchase_get', transactionId: initialTransaction }, controller.signal)
      .then(({purchase}) => {
        if (controller.signal.aborted) return;
        if (purchase.transactionId !== initialTransaction || unavailable(purchase)) throw Error('Purchase unavailable');
        setSelected(purchase);
      })
      .catch(() => { if (!controller.signal.aborted) setError('This bank purchase is unavailable to match. You can search for another.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialTransaction]);
  useEffect(() => () => request.current?.abort(), []);

  async function search(term: string, next?: string) {
    if (!term || savingNow.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError(''); setLoading(true); setSelected(null); setQuery(term);
    if (!next) { setRows(null); setCursor(null); }
    try {
      const page = await accountData<{ purchases: Purchase[]; nextCursor?: string | null }>({
        action: 'bank_purchase_list', query: term, limit: 12, ...(next && { cursor: next }),
      }, controller.signal);
      if (controller.signal.aborted) return;
      setRows(prev => next ? [...new Map([...(prev || []), ...page.purchases].map(row => [row.transactionId, row])).values()] : page.purchases);
      setCursor(page.nextCursor || null);
    } catch {
      if (!controller.signal.aborted) setError('Couldn’t search your saved bank purchases. Try again.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  async function confirm() {
    if (!selected || savingNow.current || unavailable(selected)) return;
    savingNow.current = true; setSaving(true); setError('');
    try {
      const { merchant, date, authorizedDate, amount, currency, transactionId } = selected;
      const response = await accountData<{receipt: {id: string; matchedTransactionId: string | null}}>({
        action: 'receipt_manual_match', receiptId: receipt.id, transactionId,
        expectedRevision: receipt.matchRevision ?? 0, acknowledgeDifferences: true,
        expectedPurchase: { merchant, date, authorizedDate: authorizedDate ?? null, amount, currency },
      });
      if (response.receipt?.id !== receipt.id || response.receipt.matchedTransactionId !== transactionId)
        throw Error('Unconfirmed link');
      onMatched();
    } catch {
      setSelected(null); setRows(null); setCursor(null);
      setError('Couldn’t confirm this link. Reopen the receipt and search again to see its latest status.');
    } finally { savingNow.current = false; setSaving(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void search(input.trim()); }
  return <div className="cc-manual-purchase">
    {!selected && <form role="search" aria-label="Find a bank purchase" onSubmit={submit}>
      <label>Merchant, amount, date or bank reference
        <input type="search" placeholder="e.g. Harbor Cafe or 24.80" maxLength={160} value={input}
          disabled={saving} onChange={e => { setInput(e.target.value); setSelected(null); }}/>
      </label>
      <button type="submit" className="cc-secondary" disabled={!input.trim() || loading || saving}>Search purchases</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Searching saved purchases…</p>}
    {rows && !loading && !rows.length && <p role="status">No saved purchase matches “{query}”. Try a different detail, or check after the charge posts.</p>}
    {!!rows?.length && !selected && <div aria-label="Matching bank purchases">
      {rows.map(p => <button type="button" key={p.transactionId} className="cc-bank-purchase-row"
        disabled={!!unavailable(p) || loading || saving || input.trim() !== query} onClick={() => setSelected(p)}>
        <span><strong>{p.merchant || 'Merchant unavailable'}</strong><small>{dateText(p.date)} · {unavailable(p) || 'Posted'} · <span className="cc-receipt-nowrap">Ref {p.transactionId.slice(-8)}</span></small></span>
        <strong>{purchaseMoney(p.amount, p.currency)}</strong>
      </button>)}
      {lookAlikes(rows).size > 0 && <p className="cc-receipt-hint cc-receipt-twins">{LOOK_ALIKE_NOTE}</p>}
      {cursor && <button type="button" className="cc-text-button" disabled={loading || saving || input.trim() !== query} onClick={() => void search(query, cursor)}>Show more results</button>}
    </div>}
    {selected && <section aria-label="Confirm a manual match">
      <dl>
        <div><dt>Receipt</dt><dd>{receipt.merchant || 'Merchant not read'} · {receiptDateFact(receipt.date).text} · <FactText fact={receiptAmountFact(receipt.expectedTotal ?? receipt.grandTotal ?? receipt.total, receipt.currency)} /></dd></div>
        <div><dt>Bank purchase</dt><dd>{selected.merchant || 'Merchant unavailable'} · {selected.authorizedDate && selected.authorizedDate !== selected.date && <>Bought {dateText(selected.authorizedDate)} · </>}Posted {dateText(selected.date)} · <span className="cc-receipt-nowrap">{purchaseMoney(selected.amount, selected.currency)}</span> · <span className="cc-receipt-nowrap">Ref {selected.transactionId.slice(-8)}</span></dd></div>
      </dl>
      <p>Link these only if they’re the same purchase, including any tip.</p>
      <div className="cc-action-row">
        <button type="button" className="cc-primary" disabled={saving} onClick={() => void confirm()}>{saving ? 'Linking…' : 'Confirm this match'}</button>
        <button type="button" className="cc-text-button" disabled={saving} onClick={() => setSelected(null)}>{rows ? 'Back to results' : 'Choose another purchase'}</button>
      </div>
    </section>}
  </div>;
}
