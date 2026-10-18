import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Droplet, Mic, Square } from 'lucide-react';
import { libraryRequest } from './library';
import { addDays, nutritionDay, nutritionDayStart, signedCalories, type NutritionHistory, type NutritionSettings } from './nutritionModel';
import { buildMetabolicSeries, monotonePath, sampleNetAt, type BoughtEvent, type MetabolicSeries } from './metabolicSeries';
import { preparedPurchases } from './purchases';
import { chicagoHourOnDay, closestReading, loadGlucoseReadings, type GlucoseReading, type LibraryRequest } from './glucoseApi';
import { ExerciseUnavailableError, deleteExercise, listExercises, logExercise, type ExerciseEntry } from './exerciseApi';
import { estimateExerciseBurn, type ExerciseEstimateItem } from './exerciseEstimate';
import { speechDictationSupported, startDictation, type DictationSession } from './speechDictation';
import './energy.css';

type FeedLike = Parameters<typeof preparedPurchases>[0];
type NutritionState = { history: NutritionHistory | null; settings: NutritionSettings; loading: boolean };
const request: LibraryRequest = body => libraryRequest(body);
const kcal = (n: number) => Math.round(n).toLocaleString('en-US');
const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });

function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  return now;
}

/** Today: 6 PM sugar, energy-balance curve and exercise quick-log. */
export function TodayEnergy({ items, nutrition }: { items: FeedLike; nutrition: NutritionState }) {
  const now = useMinuteClock(), day = nutritionDay(now), dayStart = nutritionDayStart(day), dayEnd = nutritionDayStart(addDays(day, 1));
  const exercise = useExercise(dayStart, dayEnd);
  const bought = useMemo<BoughtEvent[]>(() => preparedPurchases(items, dayStart, now.getTime()).map(p => ({ id: p.id, at: p.at, label: p.merchant, amount: p.amount, currency: p.currency })), [items, dayStart, now]);
  const series = useMemo(() => nutrition.history ? buildMetabolicSeries({ meals: nutrition.history.meals, settings: nutrition.settings, exercise: exercise.entries.map(e => ({ id: e.id, at: e.at, kcal: e.kcal, description: e.description })), bought, now }) : null, [nutrition.history, nutrition.settings, exercise.entries, bought, now]);
  const comparisonReady = !!nutrition.history?.complete && !nutrition.history.pendingCount && !nutrition.history.undatedLoggedCount;
  return <section className="cc-energy" aria-label="Energy today">
    <SugarCard day={day} dayStart={dayStart} dayEnd={dayEnd}/>
    <div className="cc-card cc-energy-curve">
      <div className="cc-heading-row"><h3>Energy balance today</h3></div>
      {!nutrition.history ? <p className="cc-muted">{nutrition.loading ? 'Loading food log…' : 'The curve needs your food log, which is not loaded.'}</p>
        : !series ? <p className="cc-muted">Add a daily expenditure estimate in Food settings to draw today’s curve.</p>
          : <EnergyCurve series={series} comparisonReady={comparisonReady}/>}
      <ExerciseQuickLog state={exercise}/>
    </div>
  </section>;
}

function SugarCard({ day, dayStart, dayEnd }: { day: string; dayStart: number; dayEnd: number }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; reading: GlucoseReading | null }>({ status: 'loading', reading: null });
  const target = chicagoHourOnDay(day, 18);
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', reading: null });
    loadGlucoseReadings(request, dayStart, dayEnd).then(rows => { if (live) setState({ status: 'ready', reading: closestReading(rows, target) }); }).catch(() => { if (live) setState({ status: 'error', reading: null }); });
    return () => { live = false; };
  }, [dayStart, dayEnd, target]);
  const r = state.reading, offMinutes = r ? Math.round(Math.abs(r.at - target) / 60000) : 0;
  return <div className="cc-card cc-sugar" aria-live="polite">
    <span className="cc-eyebrow"><Droplet size={14}/> 6 PM sugar</span>
    {state.status === 'loading' ? <p className="cc-muted">Loading…</p>
      : state.status === 'error' ? <p className="cc-muted">Manual glucose readings could not load.</p>
        : !r ? <p className="cc-muted">No manual reading logged today.</p>
          : <><b>{r.valueMgDl} <small>mg/dL</small></b><p className="cc-muted">Manual reading at {clock(r.at)}{offMinutes ? ` · ${offMinutes < 60 ? `${offMinutes} min` : `${(offMinutes / 60).toFixed(1)} h`} from 6 PM` : ' · right at 6 PM'}</p></>}
  </div>;
}

const W = 640, H = 210, PAD = { l: 44, r: 12, t: 12, b: 34 };
function EnergyCurve({ series, comparisonReady }: { series: MetabolicSeries; comparisonReady: boolean }) {
  const span = series.dayEnd - series.dayStart;
  const values = [0, ...series.samples.map(s => s.net), series.projectedEndOfDay];
  const lo = Math.min(...values), hi = Math.max(...values), range = Math.max(200, hi - lo), pad = range * 0.08;
  const x = (t: number) => PAD.l + ((t - series.dayStart) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi + pad - v) / (range + 2 * pad)) * (H - PAD.t - PAD.b);
  const line = monotonePath(series.samples.map(s => ({ x: x(s.t), y: y(s.net) })));
  const lane = H - PAD.b + 12;
  const ticks = [0, 6, 12, 18, 24].map(h => ({ h, at: series.dayStart + (span * h) / 24 }));
  const meals = series.events.filter(e => e.kind === 'meal'), workouts = series.events.filter(e => e.kind === 'exercise');
  const untimed = meals.filter(m => m.untimed).length, unknown = meals.filter(m => m.kcal === null).length;
  const agrees = series.foodBalance !== null && Math.abs(series.foodBalance - (series.net + series.exercise)) < 0.5;
  return <>
    <svg className="cc-energy-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Net energy now ${signedCalories(series.net)} kcal`}>
      {ticks.map(t => <g key={t.h}><line x1={x(t.at)} x2={x(t.at)} y1={PAD.t} y2={H - PAD.b} className="cc-energy-grid"/><text x={x(t.at)} y={H - 4} textAnchor="middle" className="cc-energy-tick">{t.h === 0 || t.h === 24 ? '12a' : t.h === 12 ? '12p' : t.h < 12 ? `${t.h}a` : `${t.h - 12}p`}</text></g>)}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="cc-energy-zero"/>
      <text x={PAD.l - 6} y={y(0) + 4} textAnchor="end" className="cc-energy-tick">0</text>
      <line x1={x(series.now)} x2={x(series.dayEnd)} y1={y(series.net)} y2={y(series.projectedEndOfDay)} className="cc-energy-projection"/>
      <path d={line} className="cc-energy-line"/>
      {meals.map(m => <circle key={m.id} cx={x(m.at)} cy={y(sampleNetAt(series.samples, m.at))} r={4.5} className="cc-energy-meal"><title>{`${m.label} · ${m.kcal === null ? 'calories unknown' : `${kcal(m.kcal)} kcal`}${m.untimed ? ' · no time logged' : ` · ${clock(m.at)}`}`}</title></circle>)}
      {workouts.map(e => <path key={e.id} d={`M${x(e.at) - 5},${y(sampleNetAt(series.samples, e.at)) - 4}h10l-5,8z`} className="cc-energy-exercise"><title>{`${e.label} · −${kcal(e.kcal || 0)} kcal · ${clock(e.at)}`}</title></path>)}
      {series.bought.map(b => <g key={b.id} transform={`translate(${x(b.at)},${lane})`}><path d="M0,-5L5,0L0,5L-5,0Z" className="cc-energy-bought"/><title>{`Bought at ${b.label} · ${b.amount.toLocaleString('en-US', { style: 'currency', currency: b.currency })} · ${clock(b.at)} · context only, not counted as eaten`}</title></g>)}
      <circle cx={x(series.now)} cy={y(series.net)} r={5} className="cc-energy-now"/>
    </svg>
    <dl className="cc-energy-stats">
      <div><dt>Eaten (logged)</dt><dd>{kcal(series.eaten)}</dd></div>
      <div><dt>Living burn so far</dt><dd>−{kcal(series.living)}</dd></div>
      <div><dt>Exercise</dt><dd>{series.exercise ? `−${kcal(series.exercise)}` : '0'}</dd></div>
      <div><dt>Steps</dt><dd>none</dd></div>
      <div><dt>Net now</dt><dd>{signedCalories(series.net)}</dd></div>
      <div><dt>Projected midnight</dt><dd>{signedCalories(series.projectedEndOfDay)}</dd></div>
    </dl>
    <p className="cc-muted cc-energy-note">
      {comparisonReady && agrees ? 'Before exercise, this matches the Food today balance. ' : 'The Food today balance is not available yet, so this line uses known calories only. '}
      {series.bought.length ? `${series.bought.length === 1 ? '1 café/takeout purchase is' : `${series.bought.length} café/takeout purchases are`} marked ◆ as context; only logged meals count as eaten. ` : ''}
      {untimed ? `${untimed === 1 ? '1 meal has' : `${untimed} meals have`} no time and ${untimed === 1 ? 'is' : 'are'} counted from midnight. ` : ''}
      {unknown ? `${unknown === 1 ? '1 meal has' : `${unknown} meals have`} unknown calories. ` : ''}
      No step source is connected.
    </p>
  </>;
}

type ExerciseState = { status: 'loading' | 'ready' | 'unavailable' | 'error'; entries: ExerciseEntry[]; reload: () => void; add: (entry: ExerciseEntry) => void; remove: (id: string) => void };
function useExercise(dayStart: number, dayEnd: number): ExerciseState {
  const [status, setStatus] = useState<ExerciseState['status']>('loading'), [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const generation = useRef(0);
  const reload = useCallback(() => {
    const current = ++generation.current; setStatus('loading');
    listExercises(request, dayStart, dayEnd).then(rows => { if (current === generation.current) { setEntries(rows); setStatus('ready'); } })
      .catch(error => { if (current === generation.current) { setEntries([]); setStatus(error instanceof ExerciseUnavailableError ? 'unavailable' : 'error'); } });
  }, [dayStart, dayEnd]);
  useEffect(() => { reload(); }, [reload]);
  return { status, entries, reload, add: entry => setEntries(rows => [...rows.filter(r => r.id !== entry.id), entry].sort((a, b) => a.at - b.at)), remove: id => setEntries(rows => rows.filter(r => r.id !== id)) };
}

const itemSummary = (item: ExerciseEstimateItem) => `${item.activity} ${item.sets && item.reps ? `${item.sets}×${Math.round(item.reps / item.sets)}` : item.reps ? `×${item.reps}` : `${item.minutes < 1 ? item.minutes : Math.round(item.minutes)} min`}`;
const requestId = () => `ex_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`}`;

/** Talk-or-type exercise log (cupcake-opolis exercise-quick-log). Saves only to the library. */
function ExerciseQuickLog({ state }: { state: ExerciseState }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(''), [busy, setBusy] = useState(false), [listening, setListening] = useState(false), [message, setMessage] = useState('');
  const dictation = useRef<DictationSession | null>(null);
  useEffect(() => () => dictation.current?.abort(), []);
  const estimate = text.trim() ? estimateExerciseBurn(text) : null;
  if (state.status === 'unavailable') return <p className="cc-energy-unavailable" role="status"><Activity size={16}/> Exercise storage is not available yet. Nothing is saved or shown until the library supports it.</p>;
  const save = async () => {
    if (!estimate || estimate.kcal <= 0 || busy) { setMessage(estimate ? 'Cupcake could not recognise that activity. Try “30 min walk” or “20 push-ups”.' : ''); return; }
    setBusy(true); setMessage('');
    try {
      const entry = await logExercise(request, { requestId: requestId(), description: text.trim().slice(0, 300), performedAt: new Date().toISOString(), minutes: Math.round(estimate.minutes * 10) / 10, kcal: estimate.kcal, basis: estimate.source });
      state.add(entry); setText(''); setOpen(false); setMessage(`Logged −${kcal(entry.kcal)} kcal.`);
    } catch (error) {
      if (error instanceof ExerciseUnavailableError) state.reload();
      setMessage(error instanceof Error ? error.message : 'Exercise could not be saved.');
    } finally { setBusy(false); }
  };
  const undo = async (entry: ExerciseEntry) => {
    setBusy(true); setMessage('');
    try { if (await deleteExercise(request, entry.id)) { state.remove(entry.id); setMessage(`Removed ${entry.description}.`); } else setMessage('Cupcake did not confirm the removal.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Exercise could not be removed.'); }
    finally { setBusy(false); }
  };
  const listen = () => {
    if (listening) { dictation.current?.stop(); return; }
    const session = startDictation({ onTranscript: setText, onEnd: final => { setListening(false); dictation.current = null; if (final) setText(final); }, onError: () => { setListening(false); setMessage('Dictation stopped. You can type instead.'); } }, 'en-US');
    if (session) { dictation.current = session; setListening(true); }
  };
  return <div className="cc-exercise">
    {!open ? <button type="button" className="cc-secondary" disabled={state.status === 'loading'} onClick={() => setOpen(true)}><Activity size={18}/>Log exercise</button>
      : <form className="cc-exercise-form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="cc-label" htmlFor="cc-exercise-text">What did you do?</label>
        <div className="cc-exercise-row">
          <input id="cc-exercise-text" value={text} maxLength={300} placeholder="30 min walk, 20 push-ups" onChange={event => setText(event.target.value)} autoFocus/>
          {speechDictationSupported() && <button type="button" className="cc-secondary" aria-pressed={listening} aria-label={listening ? 'Stop dictation' : 'Dictate'} onClick={listen}>{listening ? <Square size={16}/> : <Mic size={16}/>}</button>}
        </div>
        {estimate && <p className="cc-muted">{estimate.kcal > 0 ? `About −${kcal(estimate.kcal)} kcal net · ${estimate.items.map(itemSummary).join(', ')}` : 'No activity recognised yet.'}{estimate.unrecognized.length ? ` · not counted: ${estimate.unrecognized.join(', ')}` : ''}</p>}
        <div className="cc-exercise-row"><button type="submit" className="cc-primary" disabled={busy || !estimate || estimate.kcal <= 0}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="cc-text-button" onClick={() => { dictation.current?.abort(); setOpen(false); setText(''); }}>Cancel</button></div>
      </form>}
    {state.status === 'error' && <p className="cc-muted" role="alert">Exercise could not load. <button type="button" className="cc-text-button" onClick={state.reload}>Retry</button></p>}
    {message && <p className="cc-muted" role="status">{message}</p>}
    {state.entries.length > 0 && <ul className="cc-exercise-list">{state.entries.map(e => <li key={e.id}><span>{e.description}</span><span>−{kcal(e.kcal)} kcal · {clock(e.at)}</span><button type="button" className="cc-text-button" disabled={busy} onClick={() => void undo(e)}>Undo</button></li>)}</ul>}
  </div>;
}
