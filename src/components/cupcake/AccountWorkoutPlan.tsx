import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryRequest } from './library';
import { useLab } from './labsFlags';
import { useDataChanged } from './dataChanges';
import { AccountPlanBuilder } from './AccountPlanBuilder';
import { DAY_NAMES, WEEKDAYS, countWorkouts, parseRoutine, parseWorkoutPlan, routineText, sameWorkoutPlan, type WorkoutPlan } from './workoutPlanModel';
import './account-food-plan.css';
import './account-labs.css';

const getPlan = async () => parseWorkoutPlan((await libraryRequest<{ plan: { workout_template?: unknown } }>({ action: 'coach_plan_get' })).plan.workout_template);
const PLACEHOLDER = 'Monday: Upper body 45 min:\n- Bench press 3×8\n- Rows 3×10\nWednesday: Rest\nThursday:\n- Easy run 30 min';

function WeekList({ plan, rest = [] }: { plan: WorkoutPlan; rest?: readonly string[] }) {
  return <ul className="cc-workout-week">{WEEKDAYS.filter(day => plan.days[day] || rest.includes(day)).map(day => <li key={day}>
    <strong>{DAY_NAMES[day]}</strong>
    {plan.days[day] ? <ul>{plan.days[day]!.map((w, index) => <li key={index}>{w.name} <span className="cc-muted">· {w.minutes} min</span></li>)}</ul> : <span className="cc-muted"> Rest</span>}
  </li>)}</ul>;
}

/** Labs: one weekly workout plan per account, stored as the existing `workout_template` plan.
 *  Paste, upload or build with the assistant; nothing is written until Save workout plan. */
function WorkoutPlanCard() {
  const [base, setBase] = useState<WorkoutPlan | null>(null), [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false), [text, setText] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [changed, setChanged] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null), focusEditor = useRef(false);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setBase(await getPlan()); setLoaded(true); setChanged(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your workout plan could not be loaded.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // A plan saved from the assistant chat shows straight away (an open editor is left alone).
  useDataChanged(['workout-plan'], () => { if (!editing) void load(); });
  useEffect(() => { if (editing && focusEditor.current) { focusEditor.current = false; editor.current?.focus(); } }, [editing, text]);
  const open = (value: string) => { setText(value); setEditing(true); setNotice(''); focusEditor.current = true; };
  const parsed = parseRoutine(text), saved = countWorkouts(base);
  const save = async () => {
    if (busy || !parsed.workouts || parsed.problems.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      // The server keeps the last save for this plan, so check nothing changed it since it was loaded.
      if (!sameWorkoutPlan(await getPlan(), base)) { setChanged(true); setError('Your workout plan was changed somewhere else since you opened it. Your text is kept here. Load the latest, then save again.'); return; }
      const response = await libraryRequest<{ workout_template?: unknown }>({ action: 'coach_plan_set', kind: 'workout_template', value: parsed.plan });
      setBase(parseWorkoutPlan(response.workout_template) || parsed.plan); setEditing(false); setText('');
      setNotice('Workout plan saved to your account. It has not logged any workouts.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The workout plan was not saved. Try again.'); }
    finally { setBusy(false); }
  };
  return <section className="cc-card cc-workout-plan" aria-labelledby="cc-workout-plan-title">
    <div className="cc-heading-row"><h3 className="cc-card-title" id="cc-workout-plan-title">Workout plan <span className="cc-labs-badge">Labs</span></h3>
      {loaded && !editing && <button type="button" className="cc-text-button" onClick={() => open(routineText(base))}>{saved ? 'Edit' : 'Add a plan'}</button>}</div>
    {!loaded && !error && <p role="status" className="cc-muted cc-small">Loading your weekly workout plan…</p>}
    {loaded && !editing && (saved ? <WeekList plan={base!}/> : <p className="cc-muted cc-small">No weekly workout plan yet. Paste or upload a routine, or build one with the assistant.</p>)}
    {notice && <p role="status" className="cc-muted cc-small">{notice}</p>}
    {error && <div className="cc-workout-problem"><p role="alert" className="cc-error cc-small">{error}</p>{(changed || !loaded) && <button type="button" className="cc-secondary" disabled={busy} onClick={() => void load()}>{changed ? 'Load the latest plan' : 'Try again'}</button>}</div>}
    {editing && <div className="cc-workout-editor">
      <label>Routine, one weekday per heading<textarea ref={editor} rows={8} maxLength={20000} value={text} placeholder={PLACEHOLDER} onChange={event => setText(event.target.value)}/></label>
      <label className="cc-plan-import-file">Or choose a text file<input type="file" accept=".txt,.md,.markdown,.csv,text/plain,text/markdown" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (!file) return; if (file.size > 200000) { setError('That file is too large. Paste the part you want instead.'); return; } void file.text().then(value => { setText(value.slice(0, 20000)); setError(''); }).catch(() => setError('That file could not be read. Paste its text instead.')); }}/></label>
      {text.trim() && <div className="cc-plan-builder-found" role="status" aria-live="polite">
        <strong>Preview: {parsed.workouts} {parsed.workouts === 1 ? 'workout' : 'workouts'}{parsed.rest.length ? `, ${parsed.rest.length} rest ${parsed.rest.length === 1 ? 'day' : 'days'}` : ''}</strong>
        {(parsed.workouts > 0 || parsed.rest.length > 0) && <WeekList plan={parsed.plan} rest={parsed.rest}/>}
        {parsed.problems.length > 0 && <ul className="cc-workout-issues">{parsed.problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
        {parsed.notes.map((note, index) => <p key={index} className="cc-muted cc-small">{note}</p>)}
      </div>}
      <p className="cc-muted cc-small">Saving replaces your weekly workout plan{saved ? ` (${saved} ${saved === 1 ? 'workout' : 'workouts'} now)` : ''}. Your assistant and your coach views read it. It does not log workouts.</p>
      <div className="cc-plan-actions"><button type="button" className="cc-primary" disabled={busy || !parsed.workouts || parsed.problems.length > 0} onClick={() => void save()}>{busy ? 'Saving…' : 'Save workout plan'}</button><button type="button" className="cc-text-button" disabled={busy} onClick={() => { setEditing(false); setText(''); setError(''); }}>Cancel</button></div>
      <AccountPlanBuilder kind="workout" disabled={busy} onUse={routine => open(routine)}/>
    </div>}
  </section>;
}

export function AccountWorkoutPlan() { return useLab('workout-plan') ? <WorkoutPlanCard/> : null; }
