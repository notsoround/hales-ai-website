import { useRef, useState } from 'react';
import { libraryRequest } from './library';
import { personalStorage } from './personalStorage';
import { MealDialog } from './MealDialog';
import { MealTimeInput } from './MealTimeInput';
import type { FoodMeal } from './DashboardView';
import './account-manual-meal.css';

const nutrients = [
  ['calories', 'Calories', 'kcal', 20000], ['protein_g', 'Protein', 'g', 2000],
  ['carbs_g', 'Total carbs', 'g', 3000], ['fat_g', 'Fat', 'g', 2000],
  ['fiber_g', 'Fiber', 'g', 2000], ['sugar_g', 'Sugar', 'g', 2000],
] as const;
type Nutrient = typeof nutrients[number][0];
type Intent = { action: 'food_manual_log'; dedupeKey: string; confirmConsumed: true; description: string; consumedAt: string; source: 'manual-entry'; total: Partial<Record<Nutrient, number>> };
const recoveryKey = 'cupcake-manual-meal-intent-v1';
function restoreIntent(): Intent | null {
  try {
    const intent = JSON.parse(personalStorage('sessionStorage').getItem(recoveryKey) || 'null') as Intent | null;
    if (!intent || intent.action !== 'food_manual_log' || intent.source !== 'manual-entry' || intent.confirmConsumed !== true || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(intent.dedupeKey) || typeof intent.description !== 'string' || !intent.description.trim() || intent.description.length > 300 || typeof intent.consumedAt !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(intent.consumedAt) || !Number.isFinite(Date.parse(intent.consumedAt)) || !intent.total || typeof intent.total !== 'object' || Array.isArray(intent.total)) return null;
    if (Object.entries(intent.total).some(([key, value]) => !nutrients.some(([name, , , max]) => key === name && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max))) return null;
    return { action: 'food_manual_log', source: 'manual-entry', dedupeKey: intent.dedupeKey, confirmConsumed: true, description: intent.description, consumedAt: intent.consumedAt, total: intent.total };
  } catch { return null; }
}

/** Account-only entry. Pending requests remain immutable until explicitly replaced. */
export function AccountManualMeal({ onSaved }: { onSaved: () => void }) {
  const [store] = useState(() => personalStorage('sessionStorage'));
  const [intent, setIntent] = useState<Intent | null>(restoreIntent);
  const [description, setDescription] = useState(intent?.description || '');
  const [consumedAt, setConsumedAt] = useState(intent?.consumedAt || '');
  const [values, setValues] = useState<Partial<Record<Nutrient, string>>>(() => Object.fromEntries(Object.entries(intent?.total || {}).map(([key, value]) => [key, String(value)])));
  const [confirmed, setConfirmed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<FoodMeal | null>(null);
  const [notice, setNotice] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const time = Date.parse(consumedAt), now = Date.now();
  const validTime = Number.isFinite(time) && time <= now + 300000 && time >= now - 400 * 86400000;
  const validNumbers = nutrients.every(([key, , , max]) => !values[key]?.trim() || (Number.isFinite(Number(values[key])) && Number(values[key]) >= 0 && Number(values[key]) <= max));
  const valid = description.trim().length > 0 && description.trim().length <= 300 && validTime && validNumbers && confirmed;

  const save = async () => {
    if (sending.current || (!intent && !valid)) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    const request: Intent = intent || { action: 'food_manual_log', dedupeKey: crypto.randomUUID(), confirmConsumed: true, description: description.trim(), consumedAt, source: 'manual-entry', total: Object.fromEntries(nutrients.filter(([key]) => values[key]?.trim()).map(([key]) => [key, Number(values[key])])) };
    try {
      // Save before sending: navigation or a lost response must not create a new intent.
      store.setItem(recoveryKey, JSON.stringify(request)); setIntent(request);
      const result = await libraryRequest<{ meal: FoodMeal; matchesRequest: boolean }>({ ...request });
      if (result.matchesRequest !== true) throw Error('This request key belongs to different meal details. No edited meal was confirmed. Check your food history before starting a new meal.');
      if (!result.meal?.id) throw Error('The save returned no meal receipt. Retry the same meal to check it.');
      const saved = await libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId: result.meal.id });
      if (saved.meal?.id !== result.meal.id || saved.meal.source !== 'manual-entry' || saved.meal.description !== request.description || Date.parse(saved.meal.consumedAt || '') !== Date.parse(request.consumedAt) || !saved.meal.manualLoggedAt || !saved.meal.sheetLoggedAt || saved.meal.countedInTotals !== true || saved.meal.logState !== 'logged') throw Error('The saved meal could not be confirmed in your food log. Retry the same meal to check it.');
      store.removeItem(recoveryKey); setIntent(null); setReceipt(saved.meal); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Save not confirmed. Retry the same meal.'); }
    finally { sending.current = false; setBusy(false); }
  };
  const startNew = (uncertain: boolean) => {
    try { store.removeItem(recoveryKey); } catch { setError('Browser storage is unavailable. Retry the same meal before starting another.'); return; }
    setIntent(null); setReceipt(null); setConfirmed(false); setError('');
    setNotice(uncertain ? 'The previous save is unconfirmed. Check your food history first to avoid logging it twice. Your next save will be a separate meal.' : '');
    if (!uncertain) { setDescription(''); setConsumedAt(''); setValues({}); }
  };
  return <section className="cc-card cc-manual-entry" aria-label="Manual meal entry">
    <div><strong role="heading" aria-level={3}>Add a meal</strong><p className="cc-muted cc-small">Log what you ate. Enter nutrition only when you know it.</p></div>
    <button ref={trigger} type="button" className="cc-primary" onClick={() => setOpen(true)}>{intent ? 'Resume meal save' : 'Add meal'}</button>
    <MealDialog open={open} onClose={() => setOpen(false)} returnFocus={trigger} heading="Log a meal manually" closeLabel="Close manual meal">
      {receipt ? <div className="cc-manual-receipt" role="status"><h3>Meal saved to your food log</h3><strong>{receipt.description}</strong><p>Eaten {new Date(receipt.consumedAt!).toLocaleString()}</p><p>Owner-entered nutrition. Blank values remain unknown.</p><small>Receipt: {receipt.id}</small><button type="button" className="cc-secondary" onClick={() => startNew(false)}>Add another meal</button></div> : <form className="cc-manual-form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <p className="cc-muted">Your entry, with no photo estimate. Leave any nutrition you don’t know blank; unknown values are not zero.</p>
        {notice && <p role="status" className="cc-muted">{notice}</p>}
        <fieldset disabled={busy || !!intent} className="cc-manual-fields">
          <label>What did you eat?<textarea value={description} onChange={event => setDescription(event.target.value)} required maxLength={300} rows={2} placeholder="Meal and portions, in your own words"/></label>
          <MealTimeInput value={consumedAt} onChange={setConsumedAt}/>
          {consumedAt && !validTime && <p className="cc-error">Choose the actual meal time within the last 400 days, no later than five minutes from now.</p>}
          <div className="cc-manual-nutrients">{nutrients.map(([key, label, unit, max]) => <label key={key}>{label} ({unit})<input type="number" inputMode="decimal" min={0} max={max} step="any" value={values[key] || ''} placeholder="Unknown" onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}/></label>)}</div>
          <label className="cc-manual-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>I ate this meal at the time shown above.</label>
        </fieldset>
        {intent && <p className="cc-muted" role="status">Save not yet confirmed. Retry sends the original meal details once, using the same request key.</p>}
        {error && <p role="alert" className="cc-error">{error}</p>}
        <div className="cc-manual-actions"><button type="submit" className="cc-primary" disabled={busy || (!intent && !valid)}>{busy ? 'Confirming saved meal…' : intent ? 'Retry same meal' : 'Save meal'}</button>{intent && <button type="button" className="cc-secondary" disabled={busy} onClick={() => startNew(true)}>Edit as a new meal</button>}</div>
      </form>}
    </MealDialog>
  </section>;
}
