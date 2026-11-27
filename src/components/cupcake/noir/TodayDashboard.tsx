/** Today's instrument panel for the account app: the calorie dial, one camera button with voice beside it,
 *  a strip of three key readings, and touchable charts for intake, glucose and weight. Everything below it is drill-down. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronRight, Dumbbell, Footprints, Lightbulb, Mic, PhoneMissed, Radio, RotateCw, X } from 'lucide-react';
import { spendSourceLabel } from '../savesModel';
import { BarChart, TrendChart, type ChartScrub } from './NoirCharts';
import { libraryRequest } from '../library';
import { loadWeightPage, normalizeWeightMeasurements, recordQuickWeight, resolveHeadlineWeight, type BodyWeightSummary, type WeightPage } from '../weightApi';
import { parseGlucoseEntries, type GlucoseReading } from '../glucoseApi';
import { parseRingconnNight, type RingconnNight } from '../ringconnApi';
import { DAILY_STEP_GOAL, stepsSourceSummary, stepsUpdatedLabel, type StepsDay } from '../stepsApi';
import { addDays, lastLoggedMeal, nutritionDay, nutritionDays, type FoodHistoryMeal, type NutritionHistory, type NutritionSettings } from '../nutritionModel';
import { useStepsHistory } from './useStepsHistory';
import { useDataChanged } from '../dataChanges';
import { useBackClose } from '../nativeFeel';
import { PullRefresh } from '../PullRefresh';
import { Sparkline } from '../design/Visuals';
import { todayLine } from './voice';
import './noir-today.css';
import { WelcomeBack, type RecapFacts } from './WelcomeBack';
import type { CSSProperties, ReactNode } from 'react';
import { calorieState, stepInk } from './metricProgress';
import { MultiDial, type DialMetric } from './MultiDial';
import { DialScene } from './DialScene';
import { useDialMealPhotos } from './useDialMealPhotos';
import { LivingSkyCanvas } from './LivingSkyCanvas';
import { TodayCommitmentBar } from './TodayCommitmentBar';
import { commitmentActionKind, commitmentSuggestions, isCommitmentSatisfied, resolveLivingSky } from './livingSky';
import { useTodayCommitment } from './todayCommitment';
import { useAccountSky } from '../accountSkyPreference';
import './noir-elevate.css';
import './noir-recap.css';
import './living-sky.css';

const TZ = 'America/Chicago';
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const shortDay = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`));
const shortDate = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(new Date(ms));
const clock = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms)).replace(' AM', 'a').replace(' PM', 'p');
const hm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;

/** Money spent today, as the account feed reports it. `amount` null means nothing has been reported. */
export type TodaySpend = { amount: number | null; count: number; lastTime: string | null; lastTitle: string | null; source: string; checkedAt: number | null; loading: boolean; failed: boolean; onRefresh: () => void; onOpen: () => void };
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
/** "14:05" from the feed becomes "2:05p". Anything else is shown as given. */
const feedClock = (t: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t); if (!m) return t; const h = Number(m[1]); return `${h % 12 || 12}:${m[2]}${h < 12 ? 'a' : 'p'}`; };

type Nutrition = { history: NutritionHistory | null; settings: NutritionSettings; loading: boolean; error?: string; reload?: () => void };
type SignalErrors = { weight: boolean; steps: boolean; glucose: boolean; nights: boolean };
type SignalsState = { weightPage: WeightPage | null; body: BodyWeightSummary | null; loaded: boolean; glucose: GlucoseReading[] | null; nights: RingconnNight[] | null; steps: StepsDay | null; errors: SignalErrors };
type Signals = SignalsState & { retrySignals: () => void; retrySteps: () => void };

/** Latest counted meal up to now (+5 min tolerance for device clock skew), including manual-entry meals. */
function latestConsumedMeal(meals: FoodHistoryMeal[] | undefined, nowMs: number): { meal: FoodHistoryMeal; at: number } | null {
  if (!meals?.length) return null;
  const cutoff = nowMs + 5 * 60000;
  const canonical = lastLoggedMeal(meals, new Date(cutoff));
  let best: { meal: FoodHistoryMeal; at: number } | null = null;
  if (canonical?.consumedAt) {
    const ms = Date.parse(canonical.consumedAt);
    if (Number.isFinite(ms) && ms <= cutoff) best = { meal: canonical, at: ms };
  }
  for (const m of meals) {
    if (m.countedInTotals === false || !m.consumedAt) continue;
    const counted = Boolean(m.sheetLoggedAt || m.accountLoggedAt || m.logState === 'logged' || m.source === 'manual-entry');
    if (!counted) continue;
    const ms = Date.parse(m.consumedAt);
    if (Number.isFinite(ms) && ms <= cutoff && (!best || ms > best.at)) best = { meal: m, at: ms };
  }
  return best;
}

function useNowMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return now;
}

function useSignals(): Signals {
  const steps = useStepsHistory(nutritionDay(), 6);
  const [signals, setSignals] = useState<Omit<SignalsState, 'steps' | 'errors'> & { errors: Omit<SignalErrors, 'steps'> }>({
    weightPage: null,
    body: null,
    loaded: false,
    glucose: null,
    nights: null,
    errors: { weight: false, glucose: false, nights: false },
  });
  const [version, setVersion] = useState(0);
  const retrySignals = useCallback(() => setVersion(v => v + 1), []);
  useDataChanged(['weight', 'glucose', 'exercise'], retrySignals);
  useEffect(() => {
    let live = true;
    const today = nutritionDay(), start = addDays(today, -13);
    void Promise.allSettled([
      loadWeightPage(),
      libraryRequest<{ body?: BodyWeightSummary }>({ action: 'body_headline_get' }),
      libraryRequest<{ entries?: unknown }>({ action: 'glucose_manual_list', start: new Date(Date.now() - 14 * 864e5).toISOString(), limit: 50 }),
      libraryRequest<{ entries?: unknown }>({ action: 'ringconn_night_list', start, end: today }),
    ]).then(([w, b, g, n]) => {
      if (!live) return;
      setSignals({
        weightPage: w.status === 'fulfilled' ? w.value : null,
        body: b.status === 'fulfilled' ? b.value.body ?? null : null,
        loaded: true,
        glucose: g.status === 'fulfilled' ? parseGlucoseEntries(g.value.entries) : [],
        nights: n.status === 'fulfilled' && Array.isArray(n.value.entries) ? n.value.entries.map(parseRingconnNight).filter((x): x is RingconnNight => !!x && x.asleepMinutes !== null).sort((a, b) => a.nightId.localeCompare(b.nightId)) : [],
        errors: {
          weight: w.status === 'rejected' || b.status === 'rejected',
          glucose: g.status === 'rejected',
          nights: n.status === 'rejected',
        },
      });
    });
    return () => { live = false; };
  }, [version]);
  return { ...signals, steps: steps.days[0] ?? null, errors: { ...signals.errors, steps: steps.status === 'error' }, retrySteps: steps.reload, retrySignals };
}

function useScrollAtmosphere() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const opacity = Math.max(0.12, Math.min(1, 1 - (y / 260) * 0.88));
      document.documentElement.style.setProperty('--nx-atmo-opacity', opacity.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      document.documentElement.style.removeProperty('--nx-atmo-opacity');
    };
  }, []);
}

function QuickWeighSheet({ open, latestLb, deltaLb, subtitle, trend, onClose, onOpenHistory }: {
  open: boolean; latestLb: number | null; deltaLb: number | null; subtitle: string; trend: number[]; onClose: () => void; onOpenHistory: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useBackClose(open && !busy, onClose);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    setError('');
    setRaw('');
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    const prev = document.body?.style.overflow ?? '';
    if (document.body) document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      if (dialog.open) dialog.close();
      if (document.body) document.body.style.overflow = prev;
    };
  }, [open]);
  const parsed = Number(raw.trim());
  const valid = raw.trim().length > 0 && Number.isFinite(parsed) && parsed >= 40 && parsed <= 999;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      await recordQuickWeight(parsed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save weight right now.');
    } finally {
      setBusy(false);
    }
  };
  return <dialog ref={ref} className="nx-weigh-sheet" aria-label="Log a weigh-in"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (!busy && event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    {open && <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <header>
        <div><small>Weight</small><h3>Log a weigh-in</h3></div>
        <button type="button" className="nx-recap-close" aria-label="Close weigh-in" disabled={busy} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      {(latestLb !== null || trend.length >= 2) && <div className="nx-weigh-summary">
        <div>
          <strong>{latestLb !== null ? latestLb.toFixed(1) : '—'}{latestLb !== null && <small> lb</small>}</strong>
          <span>{subtitle}</span>
          {deltaLb !== null && <em className={deltaLb <= 0 ? 'is-good' : 'is-warn'}>{deltaLb <= 0 ? '▼ −' : '▲ +'}{Math.abs(deltaLb).toFixed(1)} lb this week</em>}
        </div>
        {trend.length >= 2 && <div className="nx-weigh-spark" aria-hidden="true"><Sparkline values={trend} width={140} height={36} /><small>Scale · 30 days</small></div>}
      </div>}
      <label className="nx-weigh-field">
        <span>Current weight (lb)</span>
        <input ref={inputRef} type="number" inputMode="decimal" step="0.1" min="40" max="999" disabled={busy}
          value={raw} placeholder={latestLb !== null ? latestLb.toFixed(1) : 'e.g. 198.4'} onChange={e => { setRaw(e.target.value); setError(''); }} />
      </label>
      {error && <p className="cc-error" role="alert">{error}</p>}
      <div className="nx-weigh-actions">
        <button type="submit" className="is-primary" disabled={!valid || busy}>{busy ? 'Saving…' : 'Save weight'}</button>
        <button type="button" disabled={busy} onClick={() => { onClose(); onOpenHistory(); }}>Full history →</button>
      </div>
    </form>}
  </dialog>;
}

export function TodayDashboard({ spend, name, assistantName, portrait, sassy, nutrition, mealHint, missedCallsCount = 0, onCamera, onTalk, onRecord, onExercise, onTip, onOpenFood, onOpenHistory, onOpenWeight, onOpenFitness }: {
  spend?: TodaySpend; name: string; assistantName: string; portrait: ReactNode; sassy: boolean; nutrition: Nutrition; mealHint: string | null; missedCallsCount?: number;
  onCamera: () => void; onTalk: () => void; onRecord: () => void; onExercise: () => void; onTip: () => void; onOpenFood: () => void; onOpenHistory: () => void; onOpenWeight?: () => void; onOpenFitness?: () => void;
}) {
  useScrollAtmosphere();
  const nowMs = useNowMinute();
  const signals = useSignals();
  const [weighOpen, setWeighOpen] = useState(false);
  const [skyPref, setSkyPref] = useAccountSky();
  const openWeightHistory = onOpenWeight ?? onOpenHistory;
  const today = nutritionDay();
  const { commitment, commit, toggleDone, clear } = useTodayCommitment(today);
  const days14 = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)), [today]);
  const intake = useMemo(() => nutrition.history ? nutritionDays(nutrition.history.meals, days14, nutrition.settings) : null, [nutrition.history, nutrition.settings, days14]);
  const day = intake?.[intake.length - 1] || null;
  const macros = useMemo(() => {
    const sum = (k: 'protein_g' | 'carbs_g' | 'fat_g') => day?.meals.reduce((s, m) => s + (typeof m.total?.[k] === 'number' ? m.total[k]! : 0), 0) ?? 0;
    return { protein: sum('protein_g'), carbs: sum('carbs_g'), fat: sum('fat_g') };
  }, [day]);
  const target = day?.target ?? null, eaten = day?.calories ?? 0, left = target !== null ? target - eaten : null;
  const pace = target && day ? eaten / target - Math.min(1, Math.max(0, (day.elapsedFraction - 0.25) / 0.65)) : null;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(nowMs)));
  const say = todayLine({ persona: sassy ? 'cupcake' : 'matthieu', name, hour, meals: day?.meals.length ?? 0, left, pace, mealHint });
  const expected = target && day ? Math.min(1, Math.max(0, (day.elapsedFraction - 0.25) / 0.65)) : null;
  const scale = target ? [0, 1, 2, 3].map(i => fmtInt(target * i / 3 / 10) === '0' ? '0' : fmtInt(Math.round(target * i / 3 / 10) * 10)) : [];
  const dateLine = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(nowMs));

  const weight = useMemo(() => normalizeWeightMeasurements(signals.weightPage), [signals.weightPage]);
  const headlineW = useMemo(() => resolveHeadlineWeight(signals.weightPage, signals.body), [signals.weightPage, signals.body]);
  const latestScaleW = headlineW?.latestScale ?? (weight.length ? weight[weight.length - 1] : null);
  const wDelta = headlineW?.deltaLb ?? null;
  const w30 = useMemo(() => weight.filter(m => nowMs - Date.parse(m.measuredAt) <= 30 * 864e5).map(m => m.weightLb), [weight, nowMs]);
  const w90 = weight.filter(m => nowMs - Date.parse(m.measuredAt) <= 90 * 864e5);
  const glucose = signals.glucose || [], latestG = glucose[glucose.length - 1];
  const nights = signals.nights || [], lastNight = nights[nights.length - 1];
  const avgSleep = nights.length > 1 ? nights.slice(0, -1).reduce((s, n) => s + n.asleepMinutes!, 0) / (nights.length - 1) : null;
  const inRange = glucose.length ? Math.round(glucose.filter(g => g.valueMgDl >= 70 && g.valueMgDl <= 140).length / glucose.length * 100) : null;

  const nutritionError = Boolean(nutrition.error && (!day || !day.meals.length));
  const dialLabel = nutritionError
    ? 'Calories could not load today'
    : target !== null
      ? `${fmtInt(Math.abs(left!))} calories ${left! >= 0 ? 'left' : 'over'} today, ${fmtInt(eaten)} of ${fmtInt(target)} eaten`
      : `${fmtInt(eaten)} calories eaten today`;
  const status = nutritionError
    ? 'Couldn’t load food log'
    : !day || !day.meals.length
      ? (mealHint ? `${mealHint} time` : 'Nothing logged yet')
      : pace === null
        ? `${day.meals.length} ${day.meals.length === 1 ? 'meal' : 'meals'} logged`
        : pace > 0.12 ? 'Ahead of pace' : pace < -0.2 ? 'Room to eat' : 'On pace';

  const latestMeal = useMemo(() => latestConsumedMeal(nutrition.history?.meals, nowMs), [nutrition.history?.meals, nowMs]);
  const lastMealAt = latestMeal?.at ?? null;
  const recapFacts: RecapFacts | null = nutrition.history || signals.loaded ? {
    lastMealAt,
    caloriesLeft: left, target, eatenToday: day?.meals.length ? eaten : 0,
    weightAt: headlineW?.measuredAtMs ?? (latestScaleW ? Date.parse(latestScaleW.measuredAt) : null),
    weightDeltaWeek: wDelta, glucoseAt: latestG ? latestG.at : null,
    sleepLastNight: !!lastNight && lastNight.nightId >= addDays(today, -1),
  } : null;
  const [metric, setMetric] = useState<DialMetric['tone']>('cal');
  const mealPhotos = useDialMealPhotos(nutrition.history, today, metric === 'cal');
  const pullArea = useRef<HTMLElement>(null);
  const [intakeScrub, setIntakeScrub] = useState<ChartScrub | null>(null);
  const [glucoseScrub, setGlucoseScrub] = useState<ChartScrub | null>(null);
  const [weightScrub, setWeightScrub] = useState<ChartScrub | null>(null);
  const fastMin = lastMealAt !== null ? Math.max(0, (nowMs - lastMealAt) / 60000) : null, FAST_GOAL = 16 * 60;
  const fastStale = fastMin !== null && fastMin > 24 * 60;
  const activeFastMin = fastStale ? null : fastMin;
  const freshG = latestG && latestG.at <= nowMs && nowMs - latestG.at < 864e5 ? latestG : null;
  const sleepNight = lastNight && lastNight.nightId >= addDays(today, -1) ? lastNight : null, SLEEP_GOAL = 8 * 60;
  const calorieUnavailable = nutritionError || !day || (day.meals.length > 0 && !day.knownCalorieCount);
  const sleepMinutes = sleepNight?.asleepMinutes ?? null;
  const sleepInBand = sleepMinutes !== null && sleepMinutes >= 7 * 60 && sleepMinutes <= 9 * 60;
  const metrics: DialMetric[] = [
    { key: 'cal', label: 'Calories', tone: 'cal', fraction: !calorieUnavailable && target ? Math.min(1, eaten / target) : null, state: calorieUnavailable ? 'empty' : calorieState(eaten, target), over: !calorieUnavailable && target ? Math.max(0, eaten / target - 1) : 0, notch: calorieUnavailable ? null : expected, scale,
      eyebrow: target === null ? 'Eaten today' : left! >= 0 ? 'Left today' : 'Over today', value: calorieUnavailable ? '—' : fmtInt(target === null ? eaten : Math.abs(left!)),
      detail: nutritionError ? <em>{status}</em> : calorieUnavailable ? 'No calorie total yet' : target !== null ? <>{fmtInt(eaten)} of {fmtInt(target)} kcal · <em>{left === 0 ? 'Target reached' : status}</em></> : <em>{status}</em>, chip: calorieUnavailable ? '—' : target === null ? fmtInt(eaten) : fmtInt(Math.abs(left!)), spoken: calorieUnavailable && !nutritionError ? 'Calories, no total yet' : dialLabel, drill: { label: 'Food log', run: onOpenFood },
      facts: [{ k: 'Eaten', v: `${fmtInt(eaten)} kcal` }, ...(target !== null ? [{ k: 'Target', v: `${fmtInt(target)} kcal` }] : []), ...(target && expected !== null ? [{ k: 'An even day would be at', v: `${fmtInt(target * expected)} kcal` }] : []), { k: 'Meals logged', v: String(day?.meals.length ?? 0) }] },
    { key: 'fast', label: 'Fasting', tone: 'fast', state: activeFastMin === null ? 'empty' : activeFastMin >= FAST_GOAL ? 'milestone' : 'normal', fraction: activeFastMin === null ? null : Math.min(1, activeFastMin / FAST_GOAL), scale: ['0', '4h', '8h', '12h', '16h'],
      eyebrow: 'Fasting', value: activeFastMin === null ? '—' : hm(activeFastMin), unit: activeFastMin === null ? undefined : 'h',
      detail: fastStale ? <>Last logged meal {shortDate(lastMealAt!)} · {clock(lastMealAt!)}</> : activeFastMin === null ? 'No meal logged yet' : <>Since your last logged meal · <em>{activeFastMin >= FAST_GOAL ? '16 h window reached' : `${Math.floor((FAST_GOAL - activeFastMin) / 60)} h ${Math.round((FAST_GOAL - activeFastMin) % 60)} m to go`}</em></>,
      chip: activeFastMin === null ? '—' : hm(activeFastMin), spoken: fastStale ? `Fasting paused, last logged meal ${shortDate(lastMealAt!)} at ${clock(lastMealAt!)}` : activeFastMin === null ? 'Fasting, no meal logged yet' : `Fasting ${Math.floor(activeFastMin / 60)} hours ${Math.round(activeFastMin % 60)} minutes since your last logged meal`, drill: { label: 'Meals', run: onOpenFood },
      facts: lastMealAt !== null ? [{ k: 'Last logged meal', v: `${latestMeal?.meal.description ? `${latestMeal.meal.description.slice(0, 32)} · ` : ''}${shortDate(lastMealAt)} · ${clock(lastMealAt)}` }, ...(fastStale ? [{ k: 'Fasting timer', v: 'Paused after 24 h without a logged meal' }] : [{ k: activeFastMin! >= FAST_GOAL ? '16 hours reached' : '16 hours lands at', v: `${shortDate(lastMealAt + FAST_GOAL * 60000)} · ${clock(lastMealAt + FAST_GOAL * 60000)}` }]), { k: 'Measured from', v: 'Your food log' }] : [{ k: 'Last logged meal', v: 'None yet' }] },
    { key: 'glucose', label: 'Glucose', tone: 'glucose', state: freshG ? 'normal' : 'empty', fraction: freshG && inRange !== null ? inRange / 100 : null, scale: ['0', '25%', '50%', '75%', '100%'],
      eyebrow: 'Glucose', value: freshG ? String(freshG.valueMgDl) : '—', unit: freshG ? 'mg/dL' : undefined,
      detail: freshG ? <><em>{inRange}% in range</em> over 14 days · read {clock(freshG.at)}</> : latestG ? `No reading since ${shortDate(latestG.at)}` : signals.errors.glucose ? 'Couldn’t load readings' : 'No readings yet',
      chip: freshG ? String(freshG.valueMgDl) : '—', spoken: freshG ? `Glucose ${freshG.valueMgDl} milligrams per deciliter, ${inRange} percent of readings in range over 14 days` : 'Glucose, no recent reading', drill: { label: 'Readings', run: onOpenHistory },
      facts: glucose.length ? [{ k: 'Latest', v: `${latestG!.valueMgDl} mg/dL · ${shortDate(latestG!.at)} ${clock(latestG!.at)}` }, { k: 'In range, 14 days', v: `${inRange}%` }, { k: 'Lowest to highest', v: `${Math.min(...glucose.map(g => g.valueMgDl))} to ${Math.max(...glucose.map(g => g.valueMgDl))} mg/dL` }, { k: 'Readings', v: String(glucose.length) }] : [{ k: 'Readings', v: 'None in 14 days' }] },
    { key: 'sleep', label: 'Sleep', tone: 'sleep', state: sleepMinutes === null ? 'empty' : sleepInBand ? 'milestone' : 'normal', fraction: sleepNight ? Math.min(1, sleepNight.asleepMinutes! / SLEEP_GOAL) : null, scale: ['0', '2h', '4h', '6h', '8h'],
      eyebrow: 'Slept last night', value: sleepNight ? hm(sleepNight.asleepMinutes!) : '—', unit: sleepNight ? 'h' : undefined,
      detail: sleepNight ? <>Ring estimate · <em>{sleepInBand ? 'In 7–9 h band' : sleepNight.asleepMinutes! < 7 * 60 ? 'Under 7 h' : 'Above 9 h'}</em></> : signals.errors.nights ? 'Couldn’t load sleep' : 'No night uploaded',
      chip: sleepNight ? hm(sleepNight.asleepMinutes!) : '—', spoken: sleepNight ? `Slept ${Math.floor(sleepNight.asleepMinutes! / 60)} hours ${Math.round(sleepNight.asleepMinutes! % 60)} minutes last night, an estimate from your ring` : 'Sleep, no night uploaded', drill: { label: 'History', run: onOpenHistory },
      facts: sleepNight ? [{ k: 'Asleep', v: `${hm(sleepNight.asleepMinutes!)} h` }, ...(avgSleep !== null ? [{ k: 'Your average', v: `${hm(avgSleep)} h` }] : []), { k: 'Against 8 hours', v: sleepNight.asleepMinutes! >= SLEEP_GOAL ? 'Reached' : `${hm(SLEEP_GOAL - sleepNight.asleepMinutes!)} short` }, { k: 'Source', v: 'Ring estimate' }] : [{ k: 'Last night', v: 'Not uploaded' }] },
  ];
  const weightError = signals.errors.weight && !headlineW;
  const weightSub = weightError
    ? "Couldn't load — Retry"
    : headlineW
      ? headlineW.isScale
        ? wDelta !== null
          ? `${wDelta <= 0 ? '−' : '+'}${Math.abs(wDelta).toFixed(1)} this week · ${shortDate(headlineW.measuredAtMs!)}`
          : `Weighed ${shortDate(headlineW.measuredAtMs!)}`
        : `${headlineW.label} · ${shortDay(headlineW.dateIso)}${headlineW.latestScale ? ` · Scale ${headlineW.latestScale.weightLb.toFixed(1)} lb` : ''}`
      : 'No weigh-in yet';
  const stepsDay = signals.steps;
  const stepsToday = stepsDay && stepsDay.date === today ? stepsDay : null;
  const stepsShown = stepsToday ?? stepsDay;
  const stepsError = signals.errors.steps && !stepsShown;
  const stepsStale = Boolean(stepsShown && nowMs - Date.parse(`${stepsShown.date}T23:59:59Z`) > 36 * 3600000);
  const stepGoalMet = Boolean(stepsToday && stepsToday.count >= DAILY_STEP_GOAL);
  const stepFraction = stepsShown ? Math.min(1, stepsShown.count / DAILY_STEP_GOAL) : 0;
  const stepRingR = 13;
  const stepRingC = 2 * Math.PI * stepRingR;
  const stepProvenance = stepsError
    ? "Couldn't load · Retry"
    : stepsShown
      ? stepsStale
        ? `${stepsSourceSummary(stepsShown)} · Last synced ${shortDay(stepsShown.date)} · Open Fitness`
        : `${stepsSourceSummary(stepsShown)} · ${stepsUpdatedLabel(stepsShown, nowMs)}`
      : 'Open Fitness to see synced steps';
  const stepSub = stepGoalMet ? `Goal reached · ${stepProvenance}` : stepProvenance;
  const localHour = new Date(nowMs).getHours();
  const mealsTodayCount = day?.meals.length ?? 0;
  const stepsTodayCount = stepsToday?.count ?? 0;
  const weighedToday = Boolean(headlineW?.measuredAtMs && shortDate(headlineW.measuredAtMs) === shortDate(nowMs));
  const autoSatisfied = Boolean(
    commitment && isCommitmentSatisfied(commitment.text, {
      mealsToday: mealsTodayCount,
      stepsToday: stepsTodayCount,
      weighedToday,
    }),
  );
  const effectiveDone = Boolean(commitment?.done || autoSatisfied);
  const actionKind = commitment && !effectiveDone ? commitmentActionKind(commitment.text) : null;
  const commitAction = actionKind === 'camera'
    ? { label: 'Snap →', run: onCamera }
    : actionKind === 'weigh'
      ? { label: 'Weigh →', run: () => setWeighOpen(true) }
      : actionKind === 'fitness'
        ? { label: 'Fitness →', run: onOpenFitness ?? onExercise }
        : actionKind === 'talk'
          ? { label: 'Talk →', run: onTalk }
          : null;
  const sky = useMemo(
    () => resolveLivingSky({
      hour: localHour,
      mealsToday: mealsTodayCount,
      stepsToday: stepsTodayCount,
      weighedToday,
      missedCallsCount,
      hasCommitment: Boolean(commitment),
      commitmentDone: effectiveDone,
      caloriesLeft: left,
      persona: sassy ? 'cupcake' : 'matthieu',
    }),
    [localHour, mealsTodayCount, stepsTodayCount, weighedToday, missedCallsCount, commitment, effectiveDone, left, sassy],
  );
  const skySuggestions = useMemo(
    () => commitmentSuggestions({
      hour: localHour,
      mealsToday: mealsTodayCount,
      stepsToday: stepsTodayCount,
      weighedToday,
      missedCallsCount,
      assistantName,
    }),
    [localHour, mealsTodayCount, stepsTodayCount, weighedToday, missedCallsCount, assistantName],
  );
  const prevTierRef = useRef<number | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    if (prevTierRef.current !== null && sky.tier > prevTierRef.current && sky.tier >= 2) {
      setBurstKey(k => k + 1);
    }
    prevTierRef.current = sky.tier;
  }, [sky.tier]);
  return <section ref={pullArea} className="nx-today" aria-label="Today at a glance">
    <LivingSkyCanvas phase={sky.phase} mood={sky.mood} skyPref={skyPref} burstKey={burstKey} />
    <PullRefresh target={pullArea} />
    <header className="nx-today-head"><div><span>{dateLine}</span><h2 className="nx-say">{nutrition.loading && !day ? <>&nbsp;</> : <>{say.before}<em>{say.accent}</em>{say.after}</>}</h2></div>
      <WelcomeBack assistantName={assistantName} sassy={sassy} portrait={portrait} mood={sky.mood} moodLabel={sky.label} moodCue={sky.orbCue} facts={recapFacts} onCamera={onCamera} onTalk={onTalk} onWeigh={() => setWeighOpen(true)} /></header>
    <TodayCommitmentBar
      sky={sky}
      commitment={commitment ? { ...commitment, done: effectiveDone } : null}
      suggestions={skySuggestions}
      skyPref={skyPref}
      actionLabel={commitAction?.label}
      onAction={commitAction?.run}
      onToggleSkyPref={() => setSkyPref(skyPref === 'living' ? 'static' : 'living')}
      onCommit={commit}
      onToggleDone={toggleDone}
      onClear={clear}
    />
    {missedCallsCount > 0 && (
      <button type="button" className="nx-missed-calls" onClick={onTalk}>
        <PhoneMissed size={14} aria-hidden="true" />
        <span>Missed {missedCallsCount} {missedCallsCount === 1 ? 'call' : 'calls'} · Catch up by voice →</span>
      </button>
    )}
    <QuickWeighSheet open={weighOpen} latestLb={headlineW?.valueLb ?? latestScaleW?.weightLb ?? null} deltaLb={wDelta} subtitle={weightSub} trend={w30} onClose={() => setWeighOpen(false)} onOpenHistory={openWeightHistory} />
    <div className="nx-today-top">
      <div className="nx-today-dial">
        <DialScene tone={metric} photos={mealPhotos} />
        <MultiDial metrics={metrics} selected={metric} onSelect={setMetric} />
        {onOpenFitness && (
          <button
            type="button"
            className="nx-steps-mini"
            data-goal-met={stepGoalMet}
            style={{ '--step-ink': stepInk(stepsToday ? stepFraction : null) } as CSSProperties}
            onClick={stepsError ? signals.retrySteps : onOpenFitness}
            aria-label={
              stepsError
                ? "Steps · Couldn't load · Retry"
                : stepsShown
                  ? stepsToday
                    ? `Steps today ${fmtInt(stepsShown.count)}, ${stepSub}. Open Fitness`
                    : `Steps ${shortDay(stepsShown.date)} ${fmtInt(stepsShown.count)}, ${stepSub}. Open Fitness`
                  : 'Steps not synced yet. Open Fitness'
            }
          >
            <span className="nx-steps-mini-gauge" aria-hidden="true">
              <svg viewBox="0 0 34 34" width="34" height="34">
                <circle className="nx-steps-mini-track" cx="17" cy="17" r={stepRingR} />
                <circle
                  className="nx-steps-mini-arc"
                  cx="17"
                  cy="17"
                  r={stepRingR}
                  strokeDasharray={stepRingC}
                  strokeDashoffset={stepRingC * (1 - stepFraction)}
                  transform="rotate(-90 17 17)"
                />
              </svg>
              {stepGoalMet ? <Check size={14} /> : <Footprints size={13} />}
            </span>
            <span className="nx-steps-mini-copy">
              <small>{stepsToday ? 'Steps today' : stepsShown ? `Steps · ${shortDay(stepsShown.date)}` : 'Steps'}</small>
              <b>{stepsShown ? fmtInt(stepsShown.count) : '—'}</b>
              <span>{stepSub}</span>
            </span>
            {stepsError ? <RotateCw size={15} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
        )}
        {spend && <div className="nx-spend" role="group" aria-label="Spent today">
          <button type="button" className="nx-spend-main" onClick={spend.onOpen} aria-label={`Spent today ${spend.amount !== null ? money(spend.amount) : 'not reported'}. ${spend.source ? spendSourceLabel(spend.source) : ''} Open history`}>
            <small>Spent today</small>
            <b>{spend.loading && spend.amount === null ? '—' : spend.amount !== null ? money(spend.amount) : '—'}</b>
            <span>{spend.failed ? 'Could not check. Try refresh.' : spend.loading ? 'Checking…' : spend.lastTime ? <>{spend.lastTitle ? `${spend.lastTitle} · ` : 'Last '}{feedClock(spend.lastTime)}{spend.count > 1 ? ` · ${spend.count} purchases` : ''}</> : spend.amount !== null ? 'Day total so far' : 'Nothing reported today'}</span>
          </button>
          <button type="button" className="nx-spend-refresh" onClick={spend.onRefresh} disabled={spend.loading} aria-label={`Refresh spending${spend.checkedAt ? `, checked ${clock(spend.checkedAt)}` : ''}`}>
            {spend.checkedAt && !spend.loading ? <span>Checked {clock(spend.checkedAt)}</span> : null}<RotateCw size={15} aria-hidden="true" className={spend.loading ? 'is-spinning' : undefined} />
          </button>
        </div>}
        <button type="button" className="nx-spend nx-weightline" onClick={weightError ? signals.retrySignals : () => setWeighOpen(true)} aria-label={weightError ? "Weight · Couldn't load — Retry" : headlineW ? `Weight ${headlineW.valueLb.toFixed(1)} pounds, ${weightSub}. Log weigh-in or open history` : 'Weight, no weigh-in. Log weigh-in or open history'}>
          <span className="nx-spend-main"><small>Weight</small><b>{headlineW ? headlineW.valueLb.toFixed(1) : '—'}{headlineW ? <i> lb</i> : null}</b>
            <span>{weightSub}</span></span>
          {weightError ? <RotateCw size={15} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
        {day && day.meals.length > 0 && (
          <div className="nx-macros" aria-label="Macros today">
            {([['Protein', macros.protein, 150], ['Carbs', macros.carbs, 220], ['Fat', macros.fat, 70]] as const).map(([label, value, goal]) =>
              <div key={label}><b>{Math.round(value)}<small>g</small></b><span>{label}</span><i><u style={{ width: `${Math.min(100, value / goal * 100)}%` }} /></i></div>)}
          </div>
        )}
        <div className="nx-dock">
          <button type="button" className="nx-cam" onClick={onCamera}><Camera size={20} aria-hidden="true" />Log a meal</button>
          <button type="button" className="nx-mic" onClick={onTalk} aria-label={`Talk to ${assistantName}`}><Mic size={22} aria-hidden="true" /><span>Talk to {assistantName}</span></button>
        </div>
        <div className="nx-minor" role="group" aria-label="More ways to log">
          <button type="button" onClick={onExercise}><Dumbbell size={14} aria-hidden="true" />Exercise</button>
          <button type="button" onClick={onRecord}><Radio size={14} aria-hidden="true" />Record</button>
          <button type="button" onClick={onTip}><Lightbulb size={14} aria-hidden="true" />Quick tip</button>
        </div>
      </div>

      <div className="nx-today-side">
        {intake && intake.some(d => d.meals.length) && <article className="nx-panel">
          <header><div><h3>Intake</h3><p>{intakeScrub ? `${intakeScrub.title} · ${intakeScrub.value}${intakeScrub.unit ? ` ${intakeScrub.unit}` : ''}` : (() => { const logged = intake.filter(d => d.meals.length && d.day !== today); const avg = logged.length ? logged.reduce((s, d) => s + d.calories, 0) / logged.length : null; return avg === null ? 'Last 14 days' : `Average ${fmtInt(avg)} kcal on ${logged.length} logged days`; })()}</p></div>
            <button type="button" className="nx-link" onClick={onOpenFood}>Food log<ChevronRight size={14} aria-hidden="true" /></button></header>
          <BarChart bars={intake.map(d => ({ key: d.day, label: shortDay(d.day), value: d.meals.length ? d.calories : null, title: d.day === today ? 'Today so far' : shortDay(d.day) }))}
            target={target} unit="kcal" axis={[{ index: 0, label: shortDay(days14[0]!) }, { index: 7, label: shortDay(days14[7]!) }, { index: 13, label: 'Today' }]}
            label={`Calories per day for the last 14 days${target ? `, target ${fmtInt(target)}` : ''}`} onScrub={setIntakeScrub} />
        </article>}
      </div>
    </div>

    <div className="nx-charts">
      {glucose.length > 1 && <article className="nx-panel">
        <header><div><h3>Glucose</h3><p>{glucoseScrub?.title ?? (inRange !== null ? `${inRange}% of readings in range · 14 days` : '14 days')}</p></div><span className="nx-kpi">{glucoseScrub?.value ?? latestG!.valueMgDl}<small>mg/dL</small></span></header>
        <TrendChart points={glucose.map(g => ({ t: g.at, v: g.valueMgDl, label: `${shortDate(g.at)} · ${clock(g.at)}` }))} band={[70, 140]} scatter unit="mg/dL" formatValue={v => String(Math.round(v))}
          formatTime={t => `${shortDate(t)} · ${clock(t)}`} axisTimes={[{ t: Date.now() - 13 * 864e5, label: shortDate(Date.now() - 13 * 864e5) }, { t: Date.now(), label: 'Today' }]}
          label={`Manual glucose readings for 14 days, latest ${latestG!.valueMgDl}`} onScrub={setGlucoseScrub} live />
        <p className="nx-legend"><i className="nx-dot-a" />Your readings<i className="nx-dot-band" />Target 70–140</p>
      </article>}
      {w90.length > 2 && latestScaleW && <article className="nx-panel">
        <header><div><h3>Weight</h3><p>{weightScrub ? `${weightScrub.title} · 7-day average` : (() => { const d = w90[w90.length - 1]!.weightLb - w90[0]!.weightLb; return <><span className={d <= 0 ? 'nx-good' : 'nx-warn'}>{d <= 0 ? '−' : '+'}{Math.abs(d).toFixed(1)} lb</span> since {shortDate(Date.parse(w90[0]!.measuredAt))} · 7-day average</>; })()}</p></div>
          <span className="nx-kpi">{weightScrub?.value ?? latestScaleW.weightLb.toFixed(1)}<small>lb</small></span></header>
        <TrendChart points={w90.map(m => ({ t: Date.parse(m.measuredAt), v: m.weightLb }))} average={7} unit="lb" tone="a2"
          formatTime={t => shortDate(t)} axisTimes={[0, 1, 2].map(i => { const t = Date.parse(w90[0]!.measuredAt) + (nowMs - Date.parse(w90[0]!.measuredAt)) * i / 2; return { t, label: i === 2 ? 'Today' : shortDate(t) }; })}
          label={`Weight over ${Math.round((nowMs - Date.parse(w90[0]!.measuredAt)) / 864e5)} days, latest ${latestScaleW.weightLb.toFixed(1)} pounds`} onScrub={setWeightScrub} />
      </article>}
    </div>
  </section>;
}
