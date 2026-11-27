import { useEffect, useState } from 'react';
import { accountData } from './accountSession';
import { SavedMealDialog } from './SavedMealDialog';
import { mealTimeLabel, type FoodHistoryMeal } from './nutritionModel';
import './receipt-meal-link.css';

type Links = { linkedMealId: string | null; meals: FoodHistoryMeal[]; truncated: boolean };

export function ReceiptMealLink({ receiptId }: { receiptId: string }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<Links | null>(null);
  const [choice, setChoice] = useState('');
  const [meal, setMeal] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError(''); setLinks(null);
    accountData<Links>({ action: 'receipt_meal_choices', receiptId }, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) { setLinks(result); setChoice(result.linkedMealId || ''); }
      })
      .catch(() => { if (!controller.signal.aborted) setError('Couldn’t load your meal links.'); });
    return () => controller.abort();
  }, [open, receiptId, retry]);

  async function save(mealId: string | null) {
    if (busy || !links) return;
    setBusy(true); setError('');
    try {
      const updated = await accountData<Links>({
        action: 'receipt_meal_set', receiptId, mealId, previousMealId: links.linkedMealId,
      });
      setLinks(updated); setChoice(updated.linkedMealId || '');
    } catch {
      setError('Couldn’t confirm the link. Reload the meal list before trying again.');
    } finally { setBusy(false); }
  }

  const linked = links?.meals.find(item => item.id === links.linkedMealId);
  return <details className="cc-receipt-meal-link" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Related meal</summary>
    {open && <>
      {error && <p role="alert">{error} <button type="button" className="cc-text-button" onClick={() => setRetry(n => n + 1)}>Reload meals</button></p>}
      {!error && !links && <p role="status">Loading meals…</p>}
      {links && <>
        {links.linkedMealId ? <div className="cc-action-row">
          {linked ? <button type="button" className="cc-secondary" onClick={() => setMeal(linked.id)}>View meal · {linked.description}</button> : <span>Previously linked meal</span>}
          <button type="button" className="cc-text-button" disabled={busy} onClick={() => void save(null)}>Unlink meal</button>
        </div> : links.meals.length ? <>
          <label>Meals logged on the receipt date
            <select value={choice} disabled={busy} onChange={event => setChoice(event.target.value)}>
              <option value="">Choose a meal…</option>
              {links.meals.map(item => <option key={item.id} value={item.id}>{item.description} · {mealTimeLabel(item.consumedAt)}</option>)}
            </select>
          </label>
          <button type="button" className="cc-secondary" disabled={!choice || busy} onClick={() => void save(choice)}>Link existing meal</button>
        </> : <p className="cc-muted">No logged meals for the receipt date.</p>}
        {links.truncated && <p className="cc-muted">Showing the latest 200 meals for this date.</p>}
        {meal && <SavedMealDialog mealId={meal} meals={links.meals} onSelect={setMeal} onClose={() => setMeal(null)} />}
      </>}
    </>}
  </details>;
}
