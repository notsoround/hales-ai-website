import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Droplet, Mic, Moon, Square } from 'lucide-react';
import { libraryRequest } from './library';
import { addDays, nutritionDay, nutritionDayStart, signedCalories, type NutritionHistory, type NutritionSettings } from './nutritionModel';
import { buildMetabolicSeries, monotonePath, sampleNetAt, type BoughtEvent, type MetabolicSeries } from './metabolicSeries';
import { preparedPurchases } from './purchases';
import { SIX_PM_WINDOW_MS, chicagoHourOnDay, closestReading, loadGlucoseReadings, type GlucoseReading, type LibraryRequest } from './glucoseApi';
import { ExerciseUnavailableError, deleteExercise, listExercises, logExercise, type ExerciseEntry } from './exerciseApi';
import { StepsUnavailableError, latestSteps, stepsDayLabel, type StepsDay } from './stepsApi';
import { RingconnUnavailableError, hoursMinutes, latestRingconnNight, nightSummary, type RingconnNight } from './ringconnApi';
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
  const steps = useLatestSteps(day);
  const bought = useMemo<BoughtEvent[]>(() => preparedPurchases(items, dayStart, now.getTime()).map(p => ({ id: p.id, at: p.at, label: p.merchant, amount: p.amount, currency: p.currency })), [items, dayStart, now]);
  const series = useMemo(() => nutrition.history ? buildMetabolicSeries({ meals: nutrition.history.meals, settings: nutrition.settings, exercise: exercise.entries.map(e => ({ id: e.id, at: e.at, kcal: e.kcal, description: e.description })), bought, steps: steps.day?.count ?? null, now }) : null, [nutrition.history, nutrition.settings, exercise.entries, bought, steps.day, now]);
  const comparisonReady = !!nutrition.history?.complete && !nutrition.history.pendingCount && !nutrition.history.undatedLoggedCount;
  return <section className="cc-energy" aria-label="Energy today">
    <SugarCard day={day} dayStart={dayStart} dayEnd={dayEnd} now={now.getTime()}/>
    <LastNightCard day={day}/>
    <div className="cc-card cc-energy-curve">
      <div className="cc-heading-row"><h3>Energy balance today</h3></div>
      {!nutrition.history ? <p className="cc-muted">{nutrition.loading ? 'Loading food log…' : 'The curve needs your food log, which is not loaded.'}</p>
        : !series ? <p className="cc-muted">Add a daily expenditure estimate in Food settings to draw today’s curve.</p>
          : <EnergyCurve series={series} comparisonReady={comparisonReady} steps={steps}/>}
      <ExerciseQuickLog state={exercise}/>
    </div>
  </section>;
}

function LastNightCard({ day }: { day: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'unavailable' | 'error'; night: RingconnNight | null }>({ status: 'loading', night: null });
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', night: null });
    latestRingconnNight(request, addDays(day, -1), day).then(night => { if (live) setState({ status: 'ready', night }); })
      .catch(error => { if (live) setState({ status: error instanceof RingconnUnavailableError ? 'unavailable' : 'error', night: null }); });
    return () => { live = false; };
  }, [day]);
  const n = state.night;
  return <div className="cc-card cc-last-night" aria-live="polite">
    <span className="cc-eyebrow"><Moon size={14}/> Last night</span>
    {state.status === 'loading' ? <p className="cc-muted">Loading…</p>
      : state.status === 'unavailable' ? <p className="cc-muted">RingConn nights are not available from the library yet.</p>
        : state.status === 'error' ? <p className="cc-muted">RingConn night could not load.</p>
          : !n ? <p className="cc-muted">No RingConn night uploaded yet today.</p>
            : <><SleepSummary n={n}/><p className="cc-muted cc-last-night-src">RingConn via Health Connect{n.nightId !== day ? ` · ${stepsDayLabel(n.nightId)}` : ''} · snapshot {clock(Date.parse(n.capturedAt))}{n.complete ? '' : ` · partial${n.failed.length ? `: ${n.failed.join(', ')} unavailable` : ''}`} · provider estimates; HRV not exported</p></>}
  </div>;
}

function SugarCard({ day, dayStart, dayEnd, now }: { day: string; dayStart: number; dayEnd: number; now: number }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: GlucoseReading[] }>({ status: 'loading', rows: [] });
  const target = chicagoHourOnDay(day, 18);
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', rows: [] });
    loadGlucoseReadings(request, dayStart, dayEnd).then(rows => { if (live) setState({ status: 'ready', rows }); }).catch(() => { if (live) setState({ status: 'error', rows: [] }); });
    return () => { live = false; };
  }, [dayStart, dayEnd, target]);
  // Only a reading within ±90 min of 6 PM counts as the 6 PM sugar; earlier readings are not relabelled.
  const r = closestReading(state.rows, target, SIX_PM_WINDOW_MS), offMinutes = r ? Math.round(Math.abs(r.at - target) / 60000) : 0;
  const latest = state.rows.length ? state.rows[state.rows.length - 1] : null;
  const windowOpen = now < target + SIX_PM_WINDOW_MS;
  return <div className="cc-card cc-sugar" aria-live="polite">
    <span className="cc-eyebrow"><Droplet size={14}/> 6 PM blood sugar</span>
    {state.status === 'loading' ? <p className="cc-muted">Loading…</p>
      : state.status === 'error' ? <p className="cc-muted">Manual glucose readings could not load.</p>
        : r ? <><b>{r.valueMgDl} <small>mg/dL</small></b><p className="cc-muted">Manual reading at {clock(r.at)}{offMinutes ? ` · ${offMinutes} min from 6 PM` : ' · right at 6 PM'}</p></>
          : <><b className="cc-sugar-none">{windowOpen && now < target - SIX_PM_WINDOW_MS ? 'Not yet' : 'No 6 PM reading'}</b>
            <p className="cc-muted">{windowOpen ? 'Log a reading between 4:30 and 7:30 PM and it shows here.' : 'No reading was logged between 4:30 and 7:30 PM today.'}{latest ? ` Latest today: ${latest.valueMgDl} mg/dL at ${clock(latest.at)}.` : ''}</p></>}
  </div>;
}

/** Big asleep time, an asleep / in-bed bar and small stat chips instead of one dense sentence. */
function SleepSummary({ n }: { n: RingconnNight }) {
  const chips = [n.restingHeartRate !== null && `Resting HR ${Math.round(n.restingHeartRate)}`, n.avgHeartRate !== null && `Avg HR ${Math.round(n.avgHeartRate)}`,
    n.spo2Mean !== null && `SpO₂ ${Math.round(n.spo2Mean)}%${n.spo2Min !== null ? ` · min ${Math.round(n.spo2Min)}` : ''}`].filter(Boolean) as string[];
  const main = n.asleepMinutes ?? n.sessionMinutes;
  const share = n.asleepMinutes !== null && n.sessionMinutes ? Math.min(1, n.asleepMinutes / n.sessionMinutes) : null;
  return <div className="cc-sleep" aria-label={nightSummary(n)}>
    <b>{main !== null ? hoursMinutes(main) : 'No sleep session'}{main !== null && <small> {n.asleepMinutes !== null ? 'asleep' : 'in bed (no stages)'}</small>}</b>
    {share !== null && <><div className="cc-sleep-bar" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }}/></div>
      <span className="cc-sleep-of">of {hoursMinutes(n.sessionMinutes!)} in bed · {Math.round(share * 100)}% asleep</span></>}
    {chips.length > 0 && <div className="cc-sleep-chips">{chips.map(c => <span key={c}>{c}</span>)}</div>}
  </div>;
}

const H = 210, PAD = { l: 44, r: 12, t: 12, b: 34 };
/** Draw at the rendered width so axis labels keep their real size on phones instead of shrinking with the viewBox. */
function useWidth(fallback: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => { const w = Math.round(el.clientWidth); if (w > 0) setWidth(Math.max(300, w)); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
function EnergyCurve({ series, comparisonReady, steps }: { series: MetabolicSeries; comparisonReady: boolean; steps: StepsState }) {
  const [svgRef, W] = useWidth(640);
  const span = series.dayEnd - series.dayStart;
  const values = [0, ...series.samples.map(s => s.net), series.projectedEndOfDay];
  const lo = Math.min(...values), hi = Math.max(...values), range = Math.max(200, hi - lo), pad = range * 0.08;
  const x = (t: number) => PAD.l + ((t - series.dayStart) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi + pad - v) / (range + 2 * pad)) * (H - PAD.t - PAD.b);
  const line = monotonePath(series.samples.map(s => ({ x: x(s.t), y: y(s.net) })));
  const lane = H - PAD.b + 12;
  const step = range + 2 * pad > 3000 ? 1000 : 500;   // labelled gridlines either side of zero
  const levels: number[] = [];
  for (let v = Math.ceil((lo - pad) / step) * step; v <= hi + pad; v += step) if (v !== 0) levels.push(v);
  const ticks = [0, 6, 12, 18, 24].map(h => ({ h, at: series.dayStart + (span * h) / 24 }));
  const meals = series.events.filter(e => e.kind === 'meal'), workouts = series.events.filter(e => e.kind === 'exercise');
  const untimed = meals.filter(m => m.untimed).length, unknown = meals.filter(m => m.kcal === null).length;
  const known = meals.some(m => m.kcal !== null);   // no logged calories yet: net and projection would only show burn
  const agrees = series.foodBalance !== null && Math.abs(series.foodBalance - (series.net + series.exercise)) < 0.5;
  return <>
    <svg ref={svgRef} className="cc-energy-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Net energy now ${signedCalories(series.net)} kcal`}>
      {ticks.map(t => <g key={t.h}><line x1={x(t.at)} x2={x(t.at)} y1={PAD.t} y2={H - PAD.b} className="cc-energy-grid"/><text x={x(t.at)} y={H - 4} textAnchor="middle" className="cc-energy-tick">{t.h === 0 || t.h === 24 ? '12a' : t.h === 12 ? '12p' : t.h < 12 ? `${t.h}a` : `${t.h - 12}p`}</text></g>)}
      {levels.map(v => <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="cc-energy-grid"/><text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="cc-energy-tick">{v > 0 ? '+' : v < 0 ? '−' : ''}{kcal(Math.abs(v))}</text></g>)}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="cc-energy-zero"/>
      <text x={PAD.l - 6} y={y(0) + 4} textAnchor="end" className="cc-energy-tick">0</text>
      <text x={PAD.l - 6} y={PAD.t - 2} textAnchor="end" className="cc-energy-tick cc-energy-unit">kcal</text>
      {known && <line x1={x(series.now)} x2={x(series.dayEnd)} y1={y(series.net)} y2={y(series.projectedEndOfDay)} className="cc-energy-projection"/>}
      <path d={line} className="cc-energy-line"/>
      {meals.map(m => <circle key={m.id} cx={x(m.at)} cy={y(sampleNetAt(series.samples, m.at))} r={4.5} className="cc-energy-meal"><title>{`${m.label} · ${m.kcal === null ? 'calories unknown' : `${kcal(m.kcal)} kcal`}${m.untimed ? ' · no time logged' : ` · ${clock(m.at)}`}`}</title></circle>)}
      {workouts.map(e => <path key={e.id} d={`M${x(e.at) - 5},${y(sampleNetAt(series.samples, e.at)) - 4}h10l-5,8z`} className="cc-energy-exercise"><title>{`${e.label} · −${kcal(e.kcal || 0)} kcal · ${clock(e.at)}`}</title></path>)}
      {series.bought.map(b => <g key={b.id} transform={`translate(${x(b.at)},${lane})`}><path d="M0,-5L5,0L0,5L-5,0Z" className="cc-energy-bought"/><title>{`Bought at ${b.label} · ${b.amount.toLocaleString('en-US', { style: 'currency', currency: b.currency })} · ${clock(b.at)} · context only, not counted as eaten`}</title></g>)}
      <circle cx={x(series.now)} cy={y(series.net)} r={5} className="cc-energy-now"/>
    </svg>
    <dl className="cc-energy-stats">
      <div><dt>Eaten (logged)</dt><dd>{known ? kcal(series.eaten) : <span className="cc-na">Not available</span>}</dd></div>
      <div><dt>Burned so far</dt><dd>−{kcal(series.living)}</dd></div>
      <div><dt>Exercise</dt><dd>{series.exercise ? `−${kcal(series.exercise)}` : <span className="cc-na">None logged</span>}</dd></div>
      <div><dt>Steps{steps.day ? ` · ${stepsDayLabel(steps.day.date)}` : ''}</dt><dd>{steps.day ? steps.day.count.toLocaleString('en-US') : steps.status === 'loading' ? '…' : <span className="cc-na">Not available</span>}</dd></div>
      <div><dt>Net now</dt><dd>{known ? signedCalories(series.net) : <span className="cc-na">Not available</span>}</dd></div>
      <div><dt>Projected midnight</dt><dd>{known ? signedCalories(series.projectedEndOfDay) : <span className="cc-na">Not available</span>}</dd></div>
    </dl>
    <p className="cc-muted cc-energy-note">
      {!known ? 'No meals with calories are logged yet today, so net and the midnight projection are not shown. ' : comparisonReady && agrees ? 'Before exercise, this matches the Food today balance. ' : 'The Food today balance is not available yet, so this line uses known calories only. '}
      {series.bought.length ? `${series.bought.length === 1 ? '1 café/takeout purchase is' : `${series.bought.length} café/takeout purchases are`} marked ◆ as context; only logged meals count as eaten. ` : ''}
      {untimed ? `${untimed === 1 ? '1 meal has' : `${untimed} meals have`} no time and ${untimed === 1 ? 'is' : 'are'} counted from midnight. ` : ''}
      {unknown ? `${unknown === 1 ? '1 meal has' : `${unknown} meals have`} unknown calories. ` : ''}
      {stepsNote(steps)}
    </p>
  </>;
}

type StepsState = { status: 'loading' | 'ready' | 'unavailable' | 'error'; day: StepsDay | null };
function stepsNote(steps: StepsState): string {
  if (steps.day) return `Steps: ${steps.day.count.toLocaleString('en-US')} on ${stepsDayLabel(steps.day.date)}, the latest daily Health Connect upload (shown only; not counted as burn).`;
  if (steps.status === 'loading') return 'Loading steps…';
  if (steps.status === 'unavailable') return 'Steps are not available from the library yet.';
  if (steps.status === 'error') return 'Steps could not load.';
  return 'No Health Connect steps uploaded in the last 14 days.';
}
function useLatestSteps(day: string): StepsState {
  const [state, setState] = useState<StepsState>({ status: 'loading', day: null });
  useEffect(() => {
    let live = true;
    setState(s => ({ ...s, status: 'loading' }));
    latestSteps(request, addDays(day, -13), day).then(found => { if (live) setState({ status: 'ready', day: found }); })
      .catch(error => { if (live) setState({ status: error instanceof StepsUnavailableError ? 'unavailable' : 'error', day: null }); });
    return () => { live = false; };
  }, [day]);
  return state;
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
