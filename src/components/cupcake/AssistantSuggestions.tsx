import { useEffect, useRef, useState } from 'react';
import { libraryRequest } from './library';
import { AccountRequestError } from './accountSession';
import { personalStorage } from './personalStorage';
import { parseMealPlan, samePlan } from './foodPlanModel';
import { notifyDataChanged } from './dataChanges';
import { PORTION_LABEL, PURCHASE_LABEL, EDITS, changedArea, describe, groceriesWith, mealPlanWith, requestFor, stableHex, suggestionsFrom, type Proposal, type PurchaseStatus, type Suggestion } from './assistantActionsModel';
import './account-labs.css';

type State = 'new' | 'saving' | 'saved' | 'dismissed';
type Row = Record<string, unknown>;
const stateKey = (hex: string) => `cupcake-assistant-suggestion-${hex.slice(0, 32)}`;
const readState = (hex: string): State => { try { const v = personalStorage('localStorage').getItem(stateKey(hex)); return v === 'saved' || v === 'dismissed' ? v : 'new'; } catch { return 'new'; } };
const writeState = (hex: string, state: 'saved' | 'dismissed') => { try { personalStorage('localStorage').setItem(stateKey(hex), state); } catch { /* The server still replays a repeated save. */ } };
const when = (iso: unknown) => typeof iso === 'string' && Number.isFinite(Date.parse(iso)) ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '';
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value) : 'amount unknown';
const dayKey = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(Date.now() + offset * 86400000));
const STATUS_OF: Record<string, PurchaseStatus> = { committed: 'confirmed', ignored: 'not_spending', pending: 'undecided' };

function failure(cause: unknown): string {
  if (cause instanceof AccountRequestError && cause.code === 'plan_conflict') return 'Your meal plan changed on another screen at the same moment. Nothing was changed; tap again to use the latest plan.';
  if (cause instanceof AccountRequestError && /not_ready|disabled|unavailable|unknown|forbidden/.test(cause.code)) return 'This kind of change is not available for your account yet. Nothing was changed.';
  const text = cause instanceof Error ? cause.message.replace(/^Error: /, '') : '';
  return `Not saved${text ? `: ${text}` : '.'} You can tap again; it will not create a duplicate.`;
}

/** Edit cards first show the exact record they change, read from the owner's own account. */
async function lookup(p: Proposal): Promise<{ target: string; blocked: string }> {
  if (p.type === 'set_portion') {
    const meal = (await libraryRequest<{ meal?: Row & { portion?: Row; total?: Row } }>({ action: 'food_get', mealId: p.mealId })).meal;
    if (!meal) return { target: '', blocked: 'That meal was not found in your food log. Nothing will change.' };
    const kcal = typeof meal.total?.calories === 'number' ? ` · ${Math.round(meal.total.calories)} kcal now` : '';
    const target = `${String(meal.description || 'Meal')}${when(meal.consumedAt) ? ` · ${when(meal.consumedAt)}` : ''}${kcal}`;
    if (meal.portion && meal.portion.editable === false) return { target, blocked: 'This meal’s portion cannot be changed here (it was logged through the older food sheet). Nothing will change.' };
    if (meal.portion && meal.portion.fraction === p.fraction) return { target, blocked: `This meal is already at ${PORTION_LABEL[p.fraction]}. Nothing to change.` };
    return { target, blocked: '' };
  }
  if (p.type === 'set_calorie_target') {
    const current = (await libraryRequest<{ settings?: Row }>({ action: 'food_settings_get' })).settings;
    const target = typeof current?.calorieTarget === 'number' ? `Current target: ${Math.round(current.calorieTarget)} kcal a day` : 'No calorie target is set yet';
    return { target, blocked: current?.calorieTarget === p.calories ? 'That is already your target. Nothing to change.' : '' };
  }
  if (p.type === 'remove_workout') {
    const now = Date.now(), data = await libraryRequest<{ entries?: Row[] }>({ action: 'exercise_list', start: new Date(now - 31 * 86400000).toISOString(), end: new Date(now + 600000).toISOString(), limit: 100 });
    const entry = (data.entries || []).find(e => e.id === p.workoutId);
    return entry ? { target: `${String(entry.description)} · ${when(entry.performedAt)} · ${entry.minutes} min · ${entry.kcal} kcal`, blocked: '' }
      : { target: '', blocked: 'That workout was not found in the last 31 days (it may already be removed). Nothing will change.' };
  }
  if (p.type === 'review_purchase') {
    const data = await libraryRequest<{ links?: Row[] }>({ action: 'reconcile_list', start: dayKey(-60), end: dayKey(0) });
    const link = (data.links || []).find(l => l.id === p.purchaseId);
    if (!link) return { target: '', blocked: 'That purchase was not found in the last 60 days. Nothing will change.' };
    const target = `${String(link.merchant || 'Purchase')} · ${String(link.day || '')} · ${money(link.amount)} · now: ${({ confirmed: 'confirmed', not_spending: 'not spending', undecided: 'not reviewed yet' } as const)[STATUS_OF[String(link.status)]] || String(link.status)}`;
    return { target, blocked: STATUS_OF[String(link.status)] === p.status ? 'It is already marked that way. Nothing to change.' : '' };
  }
  return { target: '', blocked: '' };
}

/** Saves one confirmed suggestion through the existing account data actions. */
async function save(p: Proposal, hex: string): Promise<string> {
  if (p.type === 'add_groceries' || p.type === 'save_meal_plan') {
    const latest = parseMealPlan((await libraryRequest<{ plan: { meal_plan?: unknown } }>({ action: 'coach_plan_get' })).plan.meal_plan);
    if (p.type === 'add_groceries') {
      if (!latest) throw Error('your groceries live with your meal plan, and there is no saved meal plan yet. Ask for a meal plan first, or make one in Food → Meal plan.');
      const next = groceriesWith(latest.groceries || '', p.items);
      if (!next) return 'Already on your grocery list. Nothing changed.';
      if (next.text.length > 10000) throw Error('your grocery notes would be too long. Tidy the list in Food first.');
      await libraryRequest({ action: 'coach_plan_set', kind: 'meal_plan', value: { ...latest, groceries: next.text }, expected_value: latest });
      return `Added ${next.added.length} to your grocery list${next.added.length < p.items.length ? ' (the rest were already there)' : ''}.`;
    }
    const value = mealPlanWith(latest, p);
    if (latest && samePlan(latest, value)) return 'Your meal plan already matches. Nothing changed.';
    await libraryRequest({ action: 'coach_plan_set', kind: 'meal_plan', value, expected_value: latest });
    return `Meal plan saved with ${p.meals.length} ${p.meals.length === 1 ? 'meal' : 'meals'}${latest?.groceries ? '; your grocery list is unchanged' : ''}.`;
  }
  if (p.type === 'set_calorie_target') {
    const current = (await libraryRequest<{ settings?: Row }>({ action: 'food_settings_get' })).settings;
    const expenditure = typeof current?.expenditureEstimate === 'number' ? current.expenditureEstimate : null;
    await libraryRequest({ action: 'food_settings_save', calorieTarget: p.calories, expenditureEstimate: expenditure, effectiveFrom: dayKey(0) }, { foodGesture: true });
    return `Daily target set to ${p.calories} kcal from today.`;
  }
  const result = await libraryRequest<{ matchesRequest?: boolean; replayed?: boolean; deleted?: boolean; unchanged?: boolean; meal?: Row & { total?: Row } }>(requestFor(p, hex));
  switch (p.type) {
    case 'log_meal': if (result.matchesRequest !== true) throw Error('the saved meal did not match this suggestion. Check your food log before trying again'); return result.replayed ? 'Already saved to your food log.' : 'Saved to your food log.';
    case 'log_workout': return result.replayed ? 'Already saved to today’s workouts.' : 'Saved to today’s workouts.';
    case 'log_glucose': return result.replayed ? 'Already saved as a manual glucose reading.' : 'Saved as a manual glucose reading.';
    case 'log_weight': return result.replayed ? 'Already saved to your weight history.' : 'Saved to your weight history.';
    case 'record_outcome': return 'Saved to your wins and setbacks.';
    case 'save_workout_plan': return 'Weekly workout plan saved.';
    case 'set_portion': { const kcal = result.meal?.total?.calories; return `Portion set to ${PORTION_LABEL[p.fraction]}${typeof kcal === 'number' ? `; this meal now counts ${Math.round(kcal)} kcal` : ''}.`; }
    case 'remove_workout': return result.deleted === false ? 'That workout was already removed.' : 'Workout removed from your log.';
    case 'review_purchase': return `Purchase marked: ${PURCHASE_LABEL[p.status]}.`;
  }
}

function Card({ suggestion, seed, reply }: { suggestion: Suggestion; seed: string; reply: string }) {
  const [hex, setHex] = useState(''), [state, setState] = useState<State>('new'), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [target, setTarget] = useState(''), [blocked, setBlocked] = useState(''), [checked, setChecked] = useState(false);
  const busy = useRef(false), proposal = suggestion.proposal;
  useEffect(() => { let live = true; void stableHex(`${seed}:${suggestion.index}:${reply}`).then(value => { if (live) { setHex(value); setState(readState(value)); } }); return () => { live = false; }; }, [seed, suggestion.index, reply]);
  const needsLookup = !!proposal && ['set_portion', 'remove_workout', 'review_purchase', 'set_calorie_target'].includes(proposal.type);
  const waiting = state === 'new';
  useEffect(() => {
    if (!proposal || !needsLookup || !waiting) { setChecked(true); return; }
    let live = true; setChecked(false);
    lookup(proposal).then(found => { if (live) { setTarget(found.target); setBlocked(found.blocked); setChecked(true); } })
      .catch(cause => { if (live) { setBlocked(failure(cause).replace(/^Not saved/, 'Could not check this record')); setChecked(true); } });
    return () => { live = false; };
  }, [proposal, needsLookup, waiting]);
  if (!proposal) return <li className="cc-suggestion" data-state="problem"><strong>Suggestion not shown</strong><p className="cc-muted cc-small">{suggestion.problem} Nothing was saved. Ask the assistant again with the details.</p></li>;
  const text = describe(proposal, target || (checked && blocked ? 'Record not found' : '')), edit = EDITS.has(proposal.type);
  const confirm = async () => {
    if (busy.current || !hex || blocked || !checked) return;
    busy.current = true; setState('saving'); setError(''); setMessage('');
    try { const done = await save(proposal, hex); writeState(hex, 'saved'); setState('saved'); setMessage(done); notifyDataChanged(changedArea(proposal)); }
    catch (cause) { setState('new'); setError(failure(cause)); }
    finally { busy.current = false; }
  };
  return <li className="cc-suggestion" data-state={state} data-edit={edit ? '' : undefined}>
    <strong>{text.heading}</strong>
    {edit && <span className="cc-suggestion-edit">Changes something already saved</span>}
    <ul className="cc-suggestion-details">{text.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
    {state === 'saved' ? <p role="status" className="cc-small">{message || 'Done.'}</p>
      : state === 'dismissed' ? <p className="cc-muted cc-small">Not saved. <button type="button" className="cc-text-button" onClick={() => setState('new')}>Show Save again</button></p>
        : blocked ? <p className="cc-muted cc-small">{blocked}</p>
          : <div className="cc-suggestion-actions">
            <button type="button" className="cc-secondary" disabled={!hex || !checked || state === 'saving'} onClick={() => void confirm()}>{state === 'saving' ? 'Saving…' : !checked ? 'Checking…' : text.save}</button>
            <button type="button" className="cc-text-button" disabled={state === 'saving'} onClick={() => { if (hex) writeState(hex, 'dismissed'); setState('dismissed'); }}>Not now</button>
          </div>}
    {error && <p role="alert" className="cc-error cc-small">{error}</p>}
  </li>;
}

/** Suggestion cards under one assistant reply. `seed` is the turn (and answer) they belong to. */
export function AssistantSuggestions({ reply, seed, enabled }: { reply: string; seed: string; enabled: boolean }) {
  const [found] = useState(() => suggestionsFrom(reply, Date.now()));
  if (!found.length) return null;
  if (!enabled) return <p className="cc-muted cc-small">This reply included {found.length === 1 ? 'a suggested change' : `${found.length} suggested changes`}. Turn on Settings → Labs → “Let the assistant suggest changes” to review {found.length === 1 ? 'it' : 'them'}.</p>;
  return <section className="cc-suggestions" aria-label="Suggested changes">
    <p className="cc-small"><span className="cc-labs-badge">Labs</span> Check each change. Nothing changes until you tap.</p>
    <ul>{found.map(suggestion => <Card key={suggestion.index} suggestion={suggestion} seed={seed} reply={reply}/>)}</ul>
  </section>;
}
