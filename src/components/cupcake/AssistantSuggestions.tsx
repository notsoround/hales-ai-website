import { useEffect, useRef, useState } from 'react';
import { libraryRequest } from './library';
import { AccountRequestError } from './accountSession';
import { personalStorage } from './personalStorage';
import { parseMealPlan } from './foodPlanModel';
import { notifyDataChanged } from './dataChanges';
import { changedArea, describe, groceriesWith, requestFor, stableHex, suggestionsFrom, type Proposal, type Suggestion } from './assistantActionsModel';
import './account-labs.css';

type State = 'new' | 'saving' | 'saved' | 'dismissed';
const stateKey = (hex: string) => `cupcake-assistant-suggestion-${hex.slice(0, 32)}`;
const readState = (hex: string): State => { try { const v = personalStorage('localStorage').getItem(stateKey(hex)); return v === 'saved' || v === 'dismissed' ? v : 'new'; } catch { return 'new'; } };
const writeState = (hex: string, state: 'saved' | 'dismissed') => { try { personalStorage('localStorage').setItem(stateKey(hex), state); } catch { /* The server still replays a repeated save. */ } };

function failure(cause: unknown): string {
  if (cause instanceof AccountRequestError && cause.code === 'plan_conflict') return 'Your meal plan changed on another screen at the same moment. Nothing was added; tap again to add to the latest list.';
  if (cause instanceof AccountRequestError && /not_ready|disabled|unavailable|unknown/.test(cause.code)) return 'This kind of change is not available for your account yet. Nothing was saved.';
  const text = cause instanceof Error ? cause.message.replace(/^Error: /, '') : '';
  return `Not saved${text ? `: ${text}` : '.'} You can tap Save again; it will not create a duplicate.`;
}

/** Saves one confirmed suggestion through the existing account data actions. */
async function save(p: Proposal, hex: string): Promise<string> {
  if (p.type === 'add_groceries') {
    const latest = parseMealPlan((await libraryRequest<{ plan: { meal_plan?: unknown } }>({ action: 'coach_plan_get' })).plan.meal_plan);
    if (!latest) throw Error('your groceries live with your meal plan, and there is no saved meal plan yet. Make one in Food → Meal plan first.');
    const next = groceriesWith(latest.groceries || '', p.items);
    if (!next) return 'Already on your grocery list. Nothing changed.';
    if (next.text.length > 10000) throw Error('your grocery notes would be too long. Tidy the list in Food first.');
    await libraryRequest({ action: 'coach_plan_set', kind: 'meal_plan', value: { ...latest, groceries: next.text }, expected_value: latest });
    return `Added ${next.added.length} to your grocery list${next.added.length < p.items.length ? ' (the rest were already there)' : ''}.`;
  }
  const result = await libraryRequest<{ matchesRequest?: boolean; replayed?: boolean }>(requestFor(p, hex));
  if (p.type === 'log_meal' && result.matchesRequest !== true) throw Error('the saved meal did not match this suggestion. Check your food log before trying again');
  const where = { log_meal: 'your food log', log_workout: 'today’s workouts', log_weight: 'your weight history', record_outcome: 'your wins and setbacks' }[p.type];
  return result.replayed ? `Already saved to ${where}.` : `Saved to ${where}.`;
}

function Card({ suggestion, seed, reply }: { suggestion: Suggestion; seed: string; reply: string }) {
  const [hex, setHex] = useState(''), [state, setState] = useState<State>('new'), [message, setMessage] = useState(''), [error, setError] = useState('');
  const busy = useRef(false);
  useEffect(() => { let live = true; void stableHex(`${seed}:${suggestion.index}:${reply}`).then(value => { if (live) { setHex(value); setState(readState(value)); } }); return () => { live = false; }; }, [seed, suggestion.index, reply]);
  if (!suggestion.proposal) return <li className="cc-suggestion" data-state="problem"><strong>Suggestion not shown</strong><p className="cc-muted cc-small">{suggestion.problem} Nothing was saved. Ask the assistant again with the details.</p></li>;
  const proposal = suggestion.proposal, text = describe(proposal);
  const confirm = async () => {
    if (busy.current || !hex) return;
    busy.current = true; setState('saving'); setError(''); setMessage('');
    try { const done = await save(proposal, hex); writeState(hex, 'saved'); setState('saved'); setMessage(done); notifyDataChanged(changedArea(proposal)); }
    catch (cause) { setState('new'); setError(failure(cause)); }
    finally { busy.current = false; }
  };
  return <li className="cc-suggestion" data-state={state}>
    <strong>{text.heading}</strong>
    <ul className="cc-suggestion-details">{text.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
    {state === 'saved' ? <p role="status" className="cc-small">{message || 'Saved.'}</p>
      : state === 'dismissed' ? <p className="cc-muted cc-small">Not saved. <button type="button" className="cc-text-button" onClick={() => setState('new')}>Show Save again</button></p>
        : <div className="cc-suggestion-actions">
          <button type="button" className="cc-secondary" disabled={!hex || state === 'saving'} onClick={() => void confirm()}>{state === 'saving' ? 'Saving…' : text.save}</button>
          <button type="button" className="cc-text-button" disabled={state === 'saving'} onClick={() => { if (hex) writeState(hex, 'dismissed'); setState('dismissed'); }}>Not now</button>
        </div>}
    {error && <p role="alert" className="cc-error cc-small">{error}</p>}
  </li>;
}

/** Suggestion cards under one assistant reply. `seed` is the turn (and answer) they belong to. */
export function AssistantSuggestions({ reply, seed, enabled }: { reply: string; seed: string; enabled: boolean }) {
  const [now] = useState(() => Date.now());
  const found = suggestionsFrom(reply, now);
  if (!found.length) return null;
  if (!enabled) return <p className="cc-muted cc-small">This reply included {found.length === 1 ? 'a suggested change' : `${found.length} suggested changes`}. Turn on Settings → Labs → “Let the assistant suggest changes” to review {found.length === 1 ? 'it' : 'them'}.</p>;
  return <section className="cc-suggestions" aria-label="Suggested changes">
    <p className="cc-small"><span className="cc-labs-badge">Labs</span> Check each change. Nothing is saved until you tap Save.</p>
    <ul>{found.map(suggestion => <Card key={suggestion.index} suggestion={suggestion} seed={seed} reply={reply}/>)}</ul>
  </section>;
}
