/** Today's instrument panel for the account app: the calorie dial, one camera button with voice beside it,
 *  a strip of three key readings, and touchable charts for intake, glucose and weight. Everything below it is drill-down. */
import { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronRight, Dumbbell, Lightbulb, Mic, Radio } from 'lucide-react';
import { BarChart, Dial, Spark, TrendChart } from './NoirCharts';
import { libraryRequest } from '../library';
import { loadWeightPage, type WeightRecord } from '../weightApi';
import { parseGlucoseEntries, type GlucoseReading } from '../glucoseApi';
import { parseRingconnNight, type RingconnNight } from '../ringconnApi';
import { addDays, nutritionDay, nutritionDays, type NutritionHistory, type NutritionSettings } from '../nutritionModel';
import { useDataChanged } from '../dataChanges';
import './noir-today.css';

const TZ = 'America/Chicago';
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const shortDay = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`));
const shortDate = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(new Date(ms));
const clock = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms)).replace(' AM', 'a').replace(' PM', 'p');
const hm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;

type Nutrition = { history: NutritionHistory | null; settings: NutritionSettings; loading: boolean };
type Signals = { weight: WeightRecord[] | null; glucose: GlucoseReading[] | null; nights: RingconnNight[] | null };

function useSignals(): Signals {
  const [signals, setSignals] = useState<Signals>({ weight: null, glucose: null, nights: null });
  const [version, setVersion] = useState(0);
  useDataChanged(['weight', 'glucose'], () => setVersion(v => v + 1));
  useEffect(() => {
    let live = true;
    const today = nutritionDay(), start = addDays(today, -13);
    void Promise.allSettled([
      loadWeightPage(),
      libraryRequest<{ entries?: unknown }>({ action: 'glucose_manual_list', start: new Date(Date.now() - 14 * 864e5).toISOString(), limit: 50 }),
      libraryRequest<{ entries?: unknown }>({ action: 'ringconn_night_list', start, end: today }),
    ]).then(([w, g, n]) => {
      if (!live) return;
      setSignals({
        weight: w.status === 'fulfilled' ? [...w.value.measurements].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt)) : [],
        glucose: g.status === 'fulfilled' ? parseGlucoseEntries(g.value.entries) : [],
        nights: n.status === 'fulfilled' && Array.isArray(n.value.entries) ? n.value.entries.map(parseRingconnNight).filter((x): x is RingconnNight => !!x && x.asleepMinutes !== null).sort((a, b) => a.nightId.localeCompare(b.nightId)) : [],
      });
    });
    return () => { live = false; };
  }, [version]);
  return signals;
}

export function TodayDashboard({ name, nutrition, mealHint, onCamera, onTalk, onRecord, onExercise, onTip, onOpenFood, onOpenHistory }: {
  name: string; nutrition: Nutrition; mealHint: string | null;
  onCamera: () => void; onTalk: () => void; onRecord: () => void; onExercise: () => void; onTip: () => void; onOpenFood: () => void; onOpenHistory: () => void;
}) {
  const signals = useSignals();
  const today = nutritionDay();
  const days14 = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)), [today]);
  const intake = useMemo(() => nutrition.history ? nutritionDays(nutrition.history.meals, days14, nutrition.settings) : null, [nutrition.history, nutrition.settings, days14]);
  const day = intake?.[intake.length - 1] || null;
  const macros = useMemo(() => {
    const sum = (k: 'protein_g' | 'carbs_g' | 'fat_g') => day?.meals.reduce((s, m) => s + (typeof m.total?.[k] === 'number' ? m.total[k]! : 0), 0) ?? 0;
    return { protein: sum('protein_g'), carbs: sum('carbs_g'), fat: sum('fat_g') };
  }, [day]);
  const target = day?.target ?? null, eaten = day?.calories ?? 0, left = target !== null ? target - eaten : null;
  const pace = target && day ? eaten / target - Math.min(1, Math.max(0, (day.elapsedFraction - 0.25) / 0.65)) : null;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());

  const weight = signals.weight, latestW = weight?.[weight.length - 1];
  const weekAgoW = latestW && weight ? [...weight].reverse().find(m => Date.parse(latestW.measuredAt) - Date.parse(m.measuredAt) >= 6.5 * 864e5) : undefined;
  const wDelta = latestW && weekAgoW ? latestW.weightLb - weekAgoW.weightLb : null;
  const w90 = weight?.filter(m => Date.now() - Date.parse(m.measuredAt) <= 90 * 864e5) || [];
  const glucose = signals.glucose || [], latestG = glucose[glucose.length - 1];
  const nights = signals.nights || [], lastNight = nights[nights.length - 1];
  const avgSleep = nights.length > 1 ? nights.slice(0, -1).reduce((s, n) => s + n.asleepMinutes!, 0) / (nights.length - 1) : null;
  const inRange = glucose.length ? Math.round(glucose.filter(g => g.valueMgDl >= 70 && g.valueMgDl <= 140).length / glucose.length * 100) : null;

  const dialLabel = target !== null ? `${fmtInt(Math.abs(left!))} calories ${left! >= 0 ? 'left' : 'over'} today, ${fmtInt(eaten)} of ${fmtInt(target)} eaten` : `${fmtInt(eaten)} calories eaten today`;
  const status = !day || !day.meals.length ? (mealHint ? `${mealHint} time` : 'Nothing logged yet') : pace === null ? `${day.meals.length} ${day.meals.length === 1 ? 'meal' : 'meals'} logged` : pace > 0.12 ? 'Ahead of pace' : pace < -0.2 ? 'Room to eat' : 'On pace';

  return <section className="nx-today" aria-label="Today at a glance">
    <header className="nx-today-head"><span>{dateLine}</span><h2>{greeting}, {name}.</h2></header>
    <div className="nx-today-top">
      <div className="nx-today-dial">
        <button type="button" className="nx-dial-button" onClick={onOpenFood} aria-label={`${dialLabel}. Open food log`}>
          <Dial value={eaten} target={target || 0} label={dialLabel}>
            <small>{target === null ? 'Eaten today' : left! >= 0 ? 'Left today' : 'Over today'}</small>
            <strong className="nx-big">{nutrition.loading && !day ? '—' : fmtInt(target === null ? eaten : Math.abs(left!))}<sup>kcal</sup></strong>
            <p>{target !== null ? <>{fmtInt(eaten)} of {fmtInt(target)} · <em>{status}</em></> : <em>{status}</em>}</p>
          </Dial>
        </button>
        <div className="nx-macros" aria-label="Macros today">
          {([['Protein', macros.protein, 150], ['Carbs', macros.carbs, 220], ['Fat', macros.fat, 70]] as const).map(([label, value, goal]) =>
            <div key={label}><b>{Math.round(value)}<small>g</small></b><span>{label}</span><i><u style={{ width: `${Math.min(100, value / goal * 100)}%` }} /></i></div>)}
        </div>
        <div className="nx-dock">
          <button type="button" className="nx-cam" onClick={onCamera}><Camera size={20} aria-hidden="true" />Log a meal</button>
          <button type="button" className="nx-mic" onClick={onTalk} aria-label="Talk"><Mic size={22} aria-hidden="true" /></button>
        </div>
        <div className="nx-minor" role="group" aria-label="More ways to log">
          <button type="button" onClick={onExercise}><Dumbbell size={14} aria-hidden="true" />Exercise</button>
          <button type="button" onClick={onRecord}><Radio size={14} aria-hidden="true" />Record</button>
          <button type="button" onClick={onTip}><Lightbulb size={14} aria-hidden="true" />Quick tip</button>
        </div>
      </div>

      <div className="nx-today-side">
        <div className="nx-tiles">
          <button type="button" className="nx-tile" onClick={onOpenHistory} aria-label={latestG ? `Glucose ${latestG.valueMgDl} milligrams per deciliter at ${clock(latestG.at)}` : 'Glucose, no recent reading'}>
            <small>Glucose</small>
            <b>{latestG ? latestG.valueMgDl : '—'}<sub>mg/dL</sub></b>
            <span className={latestG ? latestG.valueMgDl > 180 ? 'nx-bad' : latestG.valueMgDl > 140 || latestG.valueMgDl < 70 ? 'nx-warn' : 'nx-good' : 'nx-dim'}>{latestG ? `${latestG.valueMgDl >= 70 && latestG.valueMgDl <= 140 ? 'In range' : 'Out of range'} · ${clock(latestG.at)}` : 'No reading'}</span>
            <Spark values={glucose.slice(-12).map(g => g.valueMgDl)} className="nx-c-a" />
          </button>
          <button type="button" className="nx-tile" onClick={onOpenHistory} aria-label={latestW ? `Weight ${latestW.weightLb.toFixed(1)} pounds` : 'Weight, no weigh-in'}>
            <small>Weight</small>
            <b>{latestW ? latestW.weightLb.toFixed(1) : '—'}<sub>lb</sub></b>
            <span className={wDelta === null ? 'nx-dim' : wDelta <= 0 ? 'nx-good' : 'nx-warn'}>{wDelta === null ? latestW ? shortDate(Date.parse(latestW.measuredAt)) : 'No weigh-in' : `${wDelta <= 0 ? '−' : '+'}${Math.abs(wDelta).toFixed(1)} this week`}</span>
            <Spark values={(weight || []).slice(-30).map(m => m.weightLb)} className="nx-c-a2" />
          </button>
          <button type="button" className="nx-tile" onClick={onOpenHistory} aria-label={lastNight ? `Slept ${hm(lastNight.asleepMinutes!)}` : 'Sleep, no night uploaded'}>
            <small>Sleep</small>
            <b>{lastNight ? hm(lastNight.asleepMinutes!) : '—'}</b>
            <span className={lastNight && avgSleep !== null ? lastNight.asleepMinutes! >= avgSleep ? 'nx-good' : 'nx-warn' : 'nx-dim'}>{lastNight && avgSleep !== null ? `${lastNight.asleepMinutes! >= avgSleep ? '+' : '−'}${Math.round(Math.abs(lastNight.asleepMinutes! - avgSleep))}m vs avg` : lastNight ? 'Last night' : 'No night yet'}</span>
            <Spark values={nights.map(n => n.asleepMinutes!)} className="nx-c-sleep" />
          </button>
        </div>

        {intake && intake.some(d => d.meals.length) && <article className="nx-panel">
          <header><div><h3>Intake</h3><p>{(() => { const logged = intake.filter(d => d.meals.length && d.day !== today); const avg = logged.length ? logged.reduce((s, d) => s + d.calories, 0) / logged.length : null; return avg === null ? 'Last 14 days' : `Average ${fmtInt(avg)} kcal on ${logged.length} logged days`; })()}</p></div>
            <button type="button" className="nx-link" onClick={onOpenFood}>Food log<ChevronRight size={14} aria-hidden="true" /></button></header>
          <BarChart bars={intake.map(d => ({ key: d.day, label: shortDay(d.day), value: d.meals.length ? d.calories : null, title: d.day === today ? 'Today so far' : shortDay(d.day) }))}
            target={target} unit="kcal" axis={[{ index: 0, label: shortDay(days14[0]!) }, { index: 7, label: shortDay(days14[7]!) }, { index: 13, label: 'Today' }]}
            label={`Calories per day for the last 14 days${target ? `, target ${fmtInt(target)}` : ''}`} />
        </article>}
      </div>
    </div>

    <div className="nx-charts">
      {glucose.length > 1 && <article className="nx-panel">
        <header><div><h3>Glucose</h3><p>{inRange !== null ? `${inRange}% of readings in range · 14 days` : '14 days'}</p></div><span className="nx-kpi">{latestG!.valueMgDl}<small>mg/dL</small></span></header>
        <TrendChart points={glucose.map(g => ({ t: g.at, v: g.valueMgDl, label: `${shortDate(g.at)} · ${clock(g.at)}` }))} band={[70, 140]} scatter unit="mg/dL" formatValue={v => String(Math.round(v))}
          formatTime={t => `${shortDate(t)} · ${clock(t)}`} axisTimes={[{ t: Date.now() - 13 * 864e5, label: shortDate(Date.now() - 13 * 864e5) }, { t: Date.now(), label: 'Today' }]}
          label={`Manual glucose readings for 14 days, latest ${latestG!.valueMgDl}`} live />
        <p className="nx-legend"><i className="nx-dot-a" />Your readings<i className="nx-dot-band" />Target 70–140</p>
      </article>}
      {w90.length > 2 && <article className="nx-panel">
        <header><div><h3>Weight</h3><p>{(() => { const d = w90[w90.length - 1]!.weightLb - w90[0]!.weightLb; return <><span className={d <= 0 ? 'nx-good' : 'nx-warn'}>{d <= 0 ? '−' : '+'}{Math.abs(d).toFixed(1)} lb</span> since {shortDate(Date.parse(w90[0]!.measuredAt))} · 7-day average</>; })()}</p></div>
          <span className="nx-kpi">{latestW!.weightLb.toFixed(1)}<small>lb</small></span></header>
        <TrendChart points={w90.map(m => ({ t: Date.parse(m.measuredAt), v: m.weightLb }))} average={7} unit="lb" tone="a2"
          formatTime={t => shortDate(t)} axisTimes={[0, 1, 2].map(i => { const t = Date.parse(w90[0]!.measuredAt) + (Date.now() - Date.parse(w90[0]!.measuredAt)) * i / 2; return { t, label: i === 2 ? 'Today' : shortDate(t) }; })}
          label={`Weight over ${Math.round((Date.now() - Date.parse(w90[0]!.measuredAt)) / 864e5)} days, latest ${latestW!.weightLb.toFixed(1)} pounds`} />
      </article>}
    </div>
  </section>;
}
