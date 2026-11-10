import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryRequest } from './library';
import { AccountRequestError } from './accountSession';
import { personalStorage } from './personalStorage';
import { builderMessage, builderTitle, plainReply, planFromReply, spokenText, type BuilderKind } from './planBuilderModel';
import { DAY_NAMES, parseRoutine, routineFromReply, WEEKDAYS } from './workoutPlanModel';
import type { ImportedMeal } from './planImport';
import './account-labs.css';

type Turn = { id: string; text: string; status: string; error?: string; response?: { reply: string; model?: string } };
type Thread = { id: string; title: string; turns: Turn[] };
const working = (turn?: Turn) => !!turn && !turn.response && (turn.status === 'queued' || turn.status === 'running');
function problem(cause: unknown): string {
  if (cause instanceof AccountRequestError && /not_ready|disabled|unavailable/.test(cause.code)) return 'The assistant is not available for your account yet. Paste or upload a plan instead.';
  return cause instanceof Error ? cause.message.replace(/^Error: /, '') : 'The assistant could not be reached. Your message was not lost; try again.';
}
function turnProblem(turn: Turn): string {
  if (turn.error?.startsWith('account_budget')) return 'There is no reply allowance for this right now. Your message is saved in your chat history.';
  if (turn.status === 'cancelled') return 'This reply was cancelled.';
  return 'The assistant did not answer this one. Your message is saved in your chat history; send it again to retry.';
}

/** Labs: talk with the assistant to draft planned meals (onAdd) or a weekly workout routine
 *  (onUse). Replies only ever become an unsaved draft; the owner still reviews and presses Save. */
export function AccountPlanBuilder({ kind = 'meal', room = 0, disabled, onAdd, onUse }: { kind?: BuilderKind; room?: number; disabled: boolean; onAdd?: (meals: ImportedMeal[]) => void; onUse?: (routine: string) => void }) {
  const THREAD_KEY = kind === 'workout' ? 'cupcake-workout-builder-thread' : 'cupcake-plan-builder-thread', workout = kind === 'workout';
  const [storage] = useState(() => personalStorage('sessionStorage'));
  const [thread, setThread] = useState<Thread | null>(null);
  const [input, setInput] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [added, setAdded] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (id: string) => {
    try { const data = await libraryRequest<{ thread: Thread }>({ action: 'quick_chat_get', threadId: id }); if (mounted.current) { setThread(data.thread); setError(''); } }
    catch (cause) { if (mounted.current) setError(problem(cause)); }
  }, []);
  useEffect(() => { let id: string | null = null; try { id = storage.getItem(THREAD_KEY); } catch { /* No saved conversation on this tab. */ } if (id) void load(id); }, [storage, load, THREAD_KEY]);
  const last = thread?.turns[thread.turns.length - 1];
  useEffect(() => {
    if (!thread || !working(last)) return;
    let cancelled = false, timer = 0, delay = 3000;
    const poll = async () => {
      try { const data = await libraryRequest<{ thread: Thread }>({ action: 'quick_chat_get', threadId: thread.id }); if (!cancelled && mounted.current) setThread(data.thread); }
      catch { delay = Math.min(delay * 2, 20000); }
      finally { if (!cancelled) timer = window.setTimeout(poll, delay); }
    };
    timer = window.setTimeout(poll, delay);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [thread, last]);
  const send = async () => {
    const text = input.trim(); if (!text || busy || working(last)) return;
    setBusy(true); setError(''); setAdded('');
    try {
      let current = thread;
      if (!current) {
        const id = crypto.randomUUID();
        current = (await libraryRequest<{ thread: Thread }>({ action: 'quick_chat_create', threadId: id, title: builderTitle(text, kind) })).thread;
        try { storage.setItem(THREAD_KEY, current.id); } catch { /* The conversation stays in chat history. */ }
      }
      const begun = await libraryRequest<{ thread: Thread }>({ action: 'quick_chat_begin', threadId: current.id, turnId: crypto.randomUUID(), text: builderMessage(text, !current.turns.length, kind), parentTurnId: current.turns[current.turns.length - 1]?.id || null });
      if (mounted.current) { setThread(begun.thread); setInput(''); }
    } catch (cause) { if (mounted.current) setError(problem(cause)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const restart = () => { try { storage.removeItem(THREAD_KEY); } catch { /* Nothing kept. */ } setThread(null); setInput(''); setError(''); setAdded(''); };
  const reply = [...(thread?.turns || [])].reverse().find(turn => turn.response)?.response?.reply || '';
  const found = workout ? [] : planFromReply(reply), usable = found.slice(0, room);
  const routine = workout ? routineFromReply(reply) : '', parsed = routine ? parseRoutine(routine) : null;
  return <section className="cc-plan-builder" aria-label={workout ? 'Build a workout plan with the assistant' : 'Build a plan with the assistant'}>
    <h4>Build it with the assistant <span className="cc-labs-badge">Labs</span></h4>
    <p className="cc-muted cc-small">{workout ? 'Describe the routine you want, such as “3 days a week, 45 minutes, dumbbells only, easy on my knees”.' : 'Describe the plan you want, such as “5 high-protein lunches under 600 kcal, no pork”.'} The assistant drafts it from what you say and your recent logs. It cannot search the web yet, so paste anything you found online above. The conversation is kept in your chat history; nothing changes your plan until you {workout ? 'use it, review it and save' : 'add it to the draft and save'}.</p>
    {thread?.turns.map(turn => <div key={turn.id} className="cc-plan-builder-turn">
      <p className="cc-plan-builder-you"><span className="cc-sr-only">You: </span>{spokenText(turn.text)}</p>
      {turn.response ? <p className="cc-plan-builder-reply"><span className="cc-sr-only">Assistant: </span>{plainReply(turn.response.reply)}</p>
        : working(turn) ? <p role="status" className="cc-muted cc-small">The assistant is writing a draft. You can keep editing; it will appear here.</p>
          : <p role="alert" className="cc-error cc-small">{turnProblem(turn)}</p>}
    </div>)}
    {reply && workout && <div className="cc-plan-builder-found" role="status">
      {parsed && (parsed.workouts || parsed.rest.length) ? <><strong>{parsed.workouts} {parsed.workouts === 1 ? 'workout' : 'workouts'} found in the latest reply</strong><ul>{WEEKDAYS.filter(day => parsed.plan.days[day] || parsed.rest.includes(day)).map(day => <li key={day}>{DAY_NAMES[day]}: {parsed.plan.days[day]?.map(w => `${w.name} (${w.minutes} min)`).join(' · ') || 'Rest'}</li>)}</ul>{parsed.problems.length > 0 && <span className="cc-muted cc-small">{parsed.problems.length === 1 ? 'One thing needs' : `${parsed.problems.length} things need`} fixing before you can save. You can edit it after you use it.</span>}</>
        : <span className="cc-muted cc-small">No weekly routine found in the latest reply yet. Ask the assistant to write it out by weekday.</span>}
    </div>}
    {workout && routine && <button type="button" className="cc-secondary" disabled={disabled} onClick={() => { onUse?.(routine); setAdded('The routine is in the editor below. Review it, then Save workout plan.'); }}>Use this routine</button>}
    {reply && !workout && <div className="cc-plan-builder-found" role="status">
      {found.length ? <><strong>{found.length} planned {found.length === 1 ? 'meal' : 'meals'} found in the latest reply</strong><ul>{found.map((meal, index) => <li key={index}>{meal.name}{meal.kcal ? ` · ~${meal.kcal} kcal (estimate)` : ''}: {meal.items.join(' · ')}</li>)}</ul></>
        : <span className="cc-muted cc-small">No meal list found in the latest reply yet. Ask the assistant to write the plan out.</span>}
    </div>}
    {usable.length > 0 && <button type="button" className="cc-secondary" disabled={disabled} onClick={() => { onAdd?.(usable); setAdded(`Added ${usable.length} planned ${usable.length === 1 ? 'meal' : 'meals'} to your draft. Review them below, then Save plan & groceries.`); }}>Add {usable.length} planned {usable.length === 1 ? 'meal' : 'meals'} to draft{usable.length < found.length ? ` (room for ${room})` : ''}</button>}
    {!workout && found.length > 0 && !room && <p className="cc-muted cc-small">Your plan is full (10 meals). Remove a meal to add more.</p>}
    {added && <p role="status" className="cc-muted cc-small">{added}</p>}
    {error && <p role="alert" className="cc-error cc-small">{error}</p>}
    <form className="cc-plan-builder-ask" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label>{thread?.turns.length ? 'Ask for a change' : workout ? 'What routine do you want?' : 'What plan do you want?'}<textarea rows={3} maxLength={4000} value={input} disabled={busy} placeholder={thread?.turns.length ? (workout ? 'e.g. Swap Friday for a swim' : 'e.g. Make Tuesday vegetarian') : workout ? 'e.g. 3 strength days and 2 walks, 45 minutes each' : 'e.g. A week of simple dinners, about 600 kcal each'} onChange={event => setInput(event.target.value)}/></label>
      <div className="cc-plan-actions"><button type="submit" className="cc-secondary" disabled={busy || !input.trim() || working(last)}>{busy ? 'Sending…' : working(last) ? 'Waiting for the reply…' : 'Send to the assistant'}</button>{thread && <button type="button" className="cc-text-button" disabled={busy} onClick={restart}>Start over</button>}</div>
    </form>
  </section>;
}
