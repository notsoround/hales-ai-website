import { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, CalendarDays, Camera, ChevronLeft, ChevronRight, Clock3, Loader2, PenLine, Settings2, Utensils } from 'lucide-react';
import { dayLabel, elapsedLabel, lastLoggedMeal, loggedMeals, mealTimeLabel, moveNutritionPeriod, nutritionDay, nutritionDays, nutritionPeriod, periodNutrition, signedCalories, EMPTY_NUTRITION_SETTINGS, type FoodHistoryMeal, type NutritionDay, type NutritionHistory, type NutritionScale, type NutritionSettings, type NutritionSettingVersion } from './nutritionModel';
import { ACCOUNT_SESSIONS } from './accountMode';
import { requestFoodCamera } from './accountMealPhotoHandoff';
import { OPEN_MANUAL_MEAL_EVENT } from './AccountManualMeal';
import './nutrition.css';
import { ProgressRing } from './design/Visuals';

type CommonProps = { history?: NutritionHistory | null; settings?: NutritionSettings; loading?: boolean; error?: string; onRetry?: () => void; onOpenMeal: (mealId: string) => void; now?: Date };
export type NutritionWorkspaceProps = CommonProps & { onBack?: () => void; onOpenCapture?: () => void; onSaveSettings?: (settings: NutritionSettingVersion) => Promise<void> };

function useNutritionClock(fixed?: Date) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { if (fixed) return; const timer = window.setInterval(() => setClock(new Date()), 60000); return () => window.clearInterval(timer); }, [fixed]);
  return fixed || clock;
}
function Coverage({ history }: { history: NutritionHistory }) {
  const body = <div className="cc-nutrition-coverage">
    {!history.complete && <p role="status">Some saved meals are still loading. Totals are partial; comparisons are unavailable.</p>}
    {!!history.pendingCount && <p>{history.pendingCount} saved photo{history.pendingCount === 1 ? '' : 's'} still need{history.pendingCount === 1 ? 's' : ''} logging or review and {history.pendingCount === 1 ? 'is' : 'are'} excluded.</p>}
    {!!history.undatedLoggedCount && <p>{history.undatedLoggedCount} logged meal{history.undatedLoggedCount === 1 ? ' has' : 's have'} no saved eaten time and {history.undatedLoggedCount === 1 ? 'is' : 'are'} excluded from the calendar.</p>}
    {!!history.unknownTimeCount && <p>{history.unknownTimeCount} meal{history.unknownTimeCount === 1 ? ' has' : 's have'} a saved date without a reliable clock time. Calories count on that date; meal timers and gaps exclude {history.unknownTimeCount === 1 ? 'it' : 'them'}.</p>}
    <p>{history.coverageNote || 'Saved food photos only. Meals not photographed or logged elsewhere may be missing.'} All dates and times use Chicago time.</p>
  </div>;
  if (!ACCOUNT_SESSIONS) return body;
  return <>
    {!history.complete && <p role="status" className="cc-nutrition-warning">Some saved meals are still loading. Totals are partial; comparisons are unavailable.</p>}
    <details className="cc-nutrition-method cc-nutrition-coverage-fold"><summary>Coverage &amp; data notes</summary>{body}</details>
  </>;
}
function LoadState({ loading, error, onRetry }: Pick<CommonProps, 'loading' | 'error' | 'onRetry'>) {
  return <div className="cc-nutrition-empty" role="status">{loading ? <><Loader2 size={20} className="cc-spin"/> Loading saved meals…</> : <>{error || 'Food history has not loaded.'}{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</>}</div>;
}
function LastMeal({ meals, now, onOpenMeal }: { meals: FoodHistoryMeal[]; now: Date; onOpenMeal: CommonProps['onOpenMeal'] }) {
  const last = lastLoggedMeal(meals, now);
  return last ? <button type="button" className="cc-nutrition-last" onClick={() => onOpenMeal(last.id)}>
    <Clock3 size={18}/><span><small>Last logged meal with a saved time · {elapsedLabel(now.getTime() - Date.parse(last.consumedAt!))} ago</small><strong>{last.description}</strong><small>{mealTimeLabel(last.consumedAt)}</small></span><ChevronRight size={18}/>
  </button> : <p className="cc-nutrition-note cc-nutrition-no-timed">No meal with a saved eaten time is available. This does not mean you have not eaten.</p>;
}

const DIAL_START = 225, DIAL_SWEEP = 270;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function NoirFoodHero({ daySummary, isToday, history, loading, now, onOpenMeal }: {
  daySummary: NutritionDay | null;
  isToday: boolean;
  history: NutritionHistory | null | undefined;
  loading?: boolean;
  now: Date;
  onOpenMeal: CommonProps['onOpenMeal'];
}) {
  const id = 'nxfd';
  const size = 244, R = size * 0.39, cx = size / 2, cy = size / 2, strokeW = size * 0.036;
  const pt = (deg: number, r = R) => { const rad = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const; };
  const [x0, y0] = pt(DIAL_START), [x1, y1] = pt(DIAL_START + DIAL_SWEEP);
  const arc = `M${x0.toFixed(2)},${y0.toFixed(2)}A${R},${R} 0 1 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  const ticks = Array.from({ length: 49 }, (_, i) => {
    const a = DIAL_START + DIAL_SWEEP * i / 48;
    const major = i % 16 === 0, mid = i % 4 === 0;
    const r0 = R + size * 0.035;
    const [tx0, ty0] = pt(a, r0), [tx1, ty1] = pt(a, r0 + size * (major ? 0.022 : mid ? 0.014 : 0.008));
    return <line key={i} x1={tx0} y1={ty0} x2={tx1} y2={ty1} className={`nx-food-tick${major ? ' is-major' : mid ? ' is-mid' : ''}`} />;
  });

  const eaten = daySummary?.calories ?? 0;
  const target = daySummary?.target ?? null;
  const hasKnown = !!daySummary?.knownCalorieCount;
  const left = target !== null ? target - eaten : null;
  const fraction = target && target > 0 ? clamp01(eaten / target) : hasKnown ? Math.min(1, eaten / 2000) : null;
  const over = target && target > 0 && eaten > target ? clamp01((eaten - target) / target) : 0;
  const [hx, hy] = pt(DIAL_START + DIAL_SWEEP * (fraction ?? 0));

  const list = daySummary?.meals || [];
  const sumMacro = (k: 'protein_g' | 'carbs_g' | 'fat_g') => {
    let total = 0, count = 0;
    for (const m of list) {
      const val = m.total?.[k];
      if (typeof val === 'number' && Number.isFinite(val)) { total += val; count++; }
    }
    return { total, count };
  };
  const macros = { protein: sumMacro('protein_g'), carbs: sumMacro('carbs_g'), fat: sumMacro('fat_g') };

  const last = history ? lastLoggedMeal(history.meals, now) : null;
  const pendingCount = history?.pendingCount || 0;
  const eyebrow = isToday
    ? (target !== null ? (left! >= 0 ? 'Left today' : 'Over today') : 'Eaten today')
    : (target !== null ? (left! >= 0 ? 'Left on day' : 'Over target') : 'Logged on day');
  const heroNumber = loading && !history
    ? '—'
    : target !== null
      ? Math.round(Math.abs(left!)).toLocaleString('en-US')
      : hasKnown
        ? Math.round(eaten).toLocaleString('en-US')
        : '—';
  const heroSub = !history
    ? (loading ? 'Loading food log…' : 'Food log unavailable')
    : target !== null
      ? `${Math.round(eaten).toLocaleString('en-US')} of ${Math.round(target).toLocaleString('en-US')} kcal eaten${daySummary?.partial ? ' · partial' : ''}`
      : daySummary?.meals.length
        ? `${daySummary.meals.length} ${daySummary.meals.length === 1 ? 'meal' : 'meals'} logged${daySummary.partial ? ' · partial' : ''}`
        : isToday ? 'No meals logged yet today' : 'No meals logged on this date';

  const scrollToPending = () => {
    document.querySelector('.cc-snap-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <section className="nx-food-hero" aria-label="Food summary">
    <div className="nx-food-hero-ring">
      <div className="nx-food-dial" role="img" aria-label={`${eyebrow}: ${heroNumber} kilocalories. ${heroSub}`}>
        <svg viewBox={`0 0 ${size} ${size * 0.84}`} aria-hidden="true">
          <defs>
            <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1={size * 0.12} y1={size * 0.82} x2={size * 0.88} y2={size * 0.12}>
              <stop offset="0" stopColor="var(--nx-a2)" /><stop offset="1" stopColor="var(--nx-a)" />
            </linearGradient>
            <filter id={`${id}b`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={size * 0.025} /></filter>
          </defs>
          {ticks}
          <path d={arc} className={`nx-food-track${fraction === null ? ' is-empty' : ''}`} strokeWidth={strokeW} />
          {fraction !== null && fraction > 0.004 && <>
            <path d={arc} pathLength={1} stroke={`url(#${id}g)`} strokeWidth={strokeW} strokeDasharray={`${fraction} 1`} className="nx-food-glow" filter={`url(#${id}b)`} />
            <path d={arc} pathLength={1} stroke={`url(#${id}g)`} strokeWidth={strokeW} strokeDasharray={`${fraction} 1`} className="nx-food-fill" />
          </>}
          {over > 0.004 && <path d={arc} pathLength={1} strokeWidth={strokeW} strokeDasharray={`${over} 1`} className="nx-food-over" />}
          {fraction !== null && <g><circle cx={hx} cy={hy} r={size * 0.028} className="nx-food-head-ring" /><circle cx={hx} cy={hy} r={size * 0.015} className="nx-food-head" /></g>}
        </svg>
        <div className="nx-food-dial-centre">
          <small>{eyebrow}</small>
          <strong className="nx-food-hero-num">{heroNumber}</strong>
          <span className="nx-food-hero-sub">{heroSub}</span>
        </div>
      </div>

      <div className="nx-food-hero-macros" aria-label="Daily nutrients">
        {([
          ['Protein', macros.protein, 150],
          ['Carbs', macros.carbs, 220],
          ['Fat', macros.fat, 70],
        ] as const).map(([label, stat, refGoal]) => <div key={label}>
          <b>{stat.count ? Math.round(stat.total) : '—'}{stat.count ? <small>g</small> : null}</b>
          <span>{label}</span>
          <i><u style={{ width: `${stat.count ? Math.min(100, (stat.total / refGoal) * 100) : 0}%` }} /></i>
        </div>)}
      </div>
    </div>

    <div className="nx-food-hero-actions" role="group" aria-label="Quick log">
      <button type="button" className="nx-food-snap-btn" onClick={() => requestFoodCamera()}><Camera size={17} aria-hidden="true" />Snap photo</button>
      <button type="button" className="nx-food-manual-btn" onClick={() => window.dispatchEvent(new Event(OPEN_MANUAL_MEAL_EVENT))}><PenLine size={16} aria-hidden="true" />Manual entry</button>
    </div>

    <div className="nx-food-hero-meta">
      {last ? <button type="button" className="nx-food-last-pill" onClick={() => onOpenMeal(last.id)}>
        <Clock3 size={14} aria-hidden="true" />
        <span><strong>Last meal</strong> · {elapsedLabel(now.getTime() - Date.parse(last.consumedAt!))} ago · <em>{last.description}</em></span>
        <ChevronRight size={15} aria-hidden="true" />
      </button> : <p className="nx-food-last-empty"><Clock3 size={14} aria-hidden="true" /> No timed meal logged yet</p>}
      {pendingCount > 0 && <button type="button" className="nx-food-pending-pill" onClick={scrollToPending}>
        <AlertCircle size={14} aria-hidden="true" />
        <span>{pendingCount} {pendingCount === 1 ? 'photo' : 'photos'} to check</span>
      </button>}
    </div>
  </section>;
}

export function NutritionTodayCard({ history, settings = EMPTY_NUTRITION_SETTINGS, loading, error, onRetry, onOpenMeal, onOpenCalendar, now: fixedNow, compact = false }: CommonProps & { onOpenCalendar: () => void; compact?: boolean }) {
  const now = useNutritionClock(fixedNow), day = nutritionDay(now);
  const summary = history ? nutritionDays(history.meals, [day], settings, now)[0] : null;
  const comparisonReady = !!history?.complete && !history.pendingCount && !history.undatedLoggedCount;
  // One primary number: calories logged today (the same figure as "Eaten" in the energy chart). Balance lives in the chart.
  const targetReady = !!summary && summary.target !== null && summary.meals.length > 0 && comparisonReady && !summary.partial;
  const left = targetReady ? summary!.target! - summary!.calories : null;
  return <section className="cc-nutrition-today" aria-label="Food today" data-quiet={summary && !summary.meals.length ? '' : undefined}>
    <div className="cc-nutrition-heading"><span className="cc-nutrition-eyebrow" role="heading" aria-level={3}><Utensils size={16} aria-hidden="true"/> Food today</span><button type="button" className="cc-nutrition-link" onClick={onOpenCalendar}>Open calendar <ArrowUpRight size={16}/></button></div>
    {!history || !summary ? <LoadState loading={loading} error={error} onRetry={onRetry}/> : <>
      {error && <p role="alert" className="cc-nutrition-warning">{error} {onRetry && <button type="button" onClick={onRetry}>Try again</button>}</p>}
      {compact ? <>
        {summary.meals.length ? <ul className="nx-today-meals">{summary.meals.map(meal => <li key={meal.id}><button type="button" onClick={() => onOpenMeal(meal.id)}><span><strong>{meal.description || 'Logged meal'}</strong><small>{mealTimeLabel(meal.consumedAt, false)}</small></span><b>{meal.total?.calories != null ? `${Math.round(meal.total.calories).toLocaleString()} kcal` : '—'}</b></button></li>)}</ul>
          : <p className="cc-nutrition-note">No meals logged yet today.</p>}
      </> : <>
      <div className="cc-nutrition-today-values"><div><strong>{summary.knownCalorieCount ? Math.round(summary.calories).toLocaleString() : '—'}</strong><span>{summary.partial ? 'known kcal · partial estimate' : 'kcal logged today'}</span><small>{summary.meals.length ? `${summary.meals.length} logged meal${summary.meals.length === 1 ? '' : 's'}` : 'No meals logged today'}</small>
        {summary.meals.length > 0 && (() => {
          const totals = { protein: { sum: 0, count: 0 }, carbs: { sum: 0, count: 0 }, fat: { sum: 0, count: 0 } };
          summary.meals.forEach(m => {
            const protein = m.total?.protein_g; const carbs = m.total?.carbs_g; const fat = m.total?.fat_g;
            if (typeof protein === 'number' && Number.isFinite(protein)) { totals.protein.sum += protein; totals.protein.count++; }
            if (typeof carbs === 'number' && Number.isFinite(carbs)) { totals.carbs.sum += carbs; totals.carbs.count++; }
            if (typeof fat === 'number' && Number.isFinite(fat)) { totals.fat.sum += fat; totals.fat.count++; }
          });
          return <div className="cc-nutrition-macros" aria-label="Logged nutrients">
            {([{ key: 'protein', label: 'Protein' }, { key: 'carbs', label: 'Carbs' }, { key: 'fat', label: 'Fat' }] as const).map(({ key, label }) => {
              const total = totals[key], partial = total.count > 0 && total.count < summary.meals.length;
              return <span key={key}><b>{label}</b><span>{total.count ? `${Math.round(total.sum)} g${partial ? ' · partial' : ''}` : 'Unknown'}</span>{partial && <small>Known for {total.count} of {summary.meals.length} meals</small>}</span>;
            })}
          </div>;
        })()}
      </div>
        <div className="cc-nutrition-today-balance">{targetReady && <ProgressRing value={summary.calories / summary.target!} label={`${Math.round(summary.calories / summary.target! * 100)}% of the daily intake target`}/>}<div><small>Daily intake target</small><b>{targetReady ? (left! >= 0 ? `${Math.round(left!).toLocaleString()} kcal left` : `${Math.round(-left!).toLocaleString()} kcal over`) : 'Not available'}</b><span>{targetReady ? `of ${Math.round(summary.target!).toLocaleString()} kcal target` : summary.target === null ? 'Set a daily intake target in the calendar' : !summary.meals.length ? 'Log a meal to see what’s left today' : 'Some meals still need calories or a time. Review them in the calendar'}</span></div></div></div>
      <LastMeal meals={history.meals} now={now} onOpenMeal={onOpenMeal}/>
      </>}
      {(!history.complete || history.pendingCount > 0 || history.undatedLoggedCount > 0) && <p className="cc-nutrition-note">{!history.complete ? 'Partial history. ' : ''}{history.pendingCount ? `${history.pendingCount} photos not logged. ` : ''}{history.undatedLoggedCount ? `${history.undatedLoggedCount} meals without eaten times. ` : ''}<button type="button" className="cc-nutrition-inline" onClick={onOpenCalendar}>Review coverage</button></p>}
    </>}
  </section>;
}

function NutritionSettingsForm({ settings, onSave }: { settings: NutritionSettings; onSave: NonNullable<NutritionWorkspaceProps['onSaveSettings']> }) {
  const [target, setTarget] = useState(settings.calorieTarget?.toString() || ''), [expenditure, setExpenditure] = useState(settings.expenditureEstimate?.toString() || ''), [effective, setEffective] = useState(nutritionDay()), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { setTarget(settings.calorieTarget?.toString() || ''); setExpenditure(settings.expenditureEstimate?.toString() || ''); }, [settings.calorieTarget, settings.expenditureEstimate]);
  const save = async () => {
    const number = (value: string) => value.trim() === '' ? null : Number(value);
    const calorieTarget = number(target), expenditureEstimate = number(expenditure);
    if ([calorieTarget, expenditureEstimate].some(v => v !== null && (!Number.isFinite(v) || v <= 0 || v > 100000))) { setMessage('Use a positive kcal value, or leave it blank.'); return; }
    setBusy(true); setMessage('');
    try { await onSave({ calorieTarget, expenditureEstimate, effectiveFrom: effective }); setMessage('Nutrition settings saved. Earlier settings are preserved.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save nutrition settings.'); }
    finally { setBusy(false); }
  };
  return <details className="cc-nutrition-settings"><summary><Settings2 size={17}/> Targets & estimates</summary><p>Both are optional. Your intake target is a food goal. Energy balance needs a separate estimate of calories your body uses per day.</p><form onSubmit={e => { e.preventDefault(); void save(); }}><label>Daily intake target · kcal<input inputMode="decimal" type="number" min="1" max="100000" step="any" value={target} onChange={e => setTarget(e.target.value)} placeholder="Not set"/></label><label>Estimated daily expenditure · kcal<input inputMode="decimal" type="number" min="1" max="100000" step="any" value={expenditure} onChange={e => setExpenditure(e.target.value)} placeholder="Not set"/></label><label>Apply from<input type="date" required min="2000-01-01" max={nutritionDay()} value={effective} onChange={e => setEffective(e.target.value)}/></label><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></form><p role="status">{message}</p><small>Leave a value blank to clear it from the chosen date. Earlier calendar dates keep their saved settings.</small></details>;
}

export function NutritionWorkspace({ history, settings = EMPTY_NUTRITION_SETTINGS, loading, error, onRetry, onOpenMeal, onBack, onOpenCapture, onSaveSettings, now: fixedNow }: NutritionWorkspaceProps) {
  const now = useNutritionClock(fixedNow), today = nutritionDay(now);
  const [anchor, setAnchor] = useState(today), [scale, setScale] = useState<NutritionScale>('day');
  const [rangeView, setRangeView] = useState<'list' | 'calendar'>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches ? 'list' : 'calendar');
  const period = nutritionPeriod(anchor, scale), days = nutritionDays(history?.meals || [], period.days, settings, now), summary = periodNutrition(days, today);
  const comparisonReady = !!history?.complete && !history.pendingCount && !history.undatedLoggedCount;
  const chooseDay = (day: string) => { setAnchor(day); setScale('day'); };
  const ordered = loggedMeals(history?.meals || []), chosenMeals = scale === 'day' ? days[0].meals : [];
  const maxCalories = Math.max(1, ...days.map(d => d.calories));
  const months = Array.from({ length: 12 }, (_, i) => `${anchor.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);
  const heroDay = scale === 'day' ? days[0] : nutritionDays(history?.meals || [], [today], settings, now)[0];
  const heroIsToday = scale !== 'day' || anchor === today;
  return <section className="cc-nutrition-workspace" aria-label="Food calendar">
    {onBack && <button type="button" className="cc-nutrition-link cc-nutrition-back" onClick={onBack}><ChevronLeft size={17}/> Back to Today</button>}
    {ACCOUNT_SESSIONS ? (
      <NoirFoodHero daySummary={history ? heroDay : null} isToday={heroIsToday} history={history} loading={loading} now={now} onOpenMeal={onOpenMeal} />
    ) : (
      <div className="cc-nutrition-heading"><div><span className="cc-nutrition-eyebrow">Your food log</span><h2>Food calendar</h2><p>Meals, timing, and the bigger picture.</p></div>{onOpenCapture && <button type="button" className="cc-nutrition-primary" onClick={onOpenCapture}>Add food photo</button>}</div>
    )}
    <div className="cc-nutrition-controls"><div className="cc-nutrition-scale" role="group" aria-label="Calendar scale">{(['day', 'week', 'month', 'year'] as const).map(s => <button key={s} type="button" aria-pressed={scale === s} onClick={() => setScale(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div><div className="cc-nutrition-arrows"><button type="button" aria-label={`Previous ${scale}`} onClick={() => setAnchor(moveNutritionPeriod(anchor, scale, -1))}><ChevronLeft size={20}/></button><button type="button" onClick={() => { setAnchor(today); setScale('day'); }}>Today</button><button type="button" aria-label={`Next ${scale}`} onClick={() => setAnchor(moveNutritionPeriod(anchor, scale, 1))} disabled={period.end >= today}><ChevronRight size={20}/></button></div></div>
    <h3 className="cc-nutrition-period">{period.label}</h3>
    {!history ? <LoadState loading={loading} error={error} onRetry={onRetry}/> : <>
      {error && <p role="alert" className="cc-nutrition-warning">{error} {onRetry && <button type="button" onClick={onRetry}>Try again</button>}</p>}
      {scale === 'day' && ACCOUNT_SESSIONS && <div className="cc-nutrition-timeline"><div className="cc-nutrition-heading"><h3>Meals & timing</h3><span>{chosenMeals.length} logged</span></div>{chosenMeals.length === 0 ? <div className="cc-nutrition-empty"><CalendarDays size={22}/><p>No saved meals on this date.</p><small>Food eaten without a log will not appear here.</small></div> : chosenMeals.map(meal => { const prior = ordered[ordered.findIndex(m => m.id === meal.id) - 1]; const gap = prior?.consumedAt && meal.consumedAt ? Date.parse(meal.consumedAt) - Date.parse(prior.consumedAt) : null; return <div key={meal.id} className="cc-nutrition-timeline-item">{gap !== null && gap > 0 && <div className="cc-nutrition-gap"><Clock3 size={13}/>{elapsedLabel(gap)} between logged meals{nutritionDay(prior.consumedAt!) !== anchor ? ` · previous ${mealTimeLabel(prior.consumedAt)}` : ''}</div>}<button type="button" onClick={() => onOpenMeal(meal.id)}><span className="cc-nutrition-meal-time">{mealTimeLabel(meal.consumedAt, false)}</span><span className="cc-nutrition-meal-name"><strong>{meal.description}</strong><small>{meal.imageStored ? 'Saved photo · ' : ''}Logged{meal.totalIsPartial ? ' · partial estimate' : ''}</small></span><span className="cc-nutrition-meal-kcal">{typeof meal.total?.calories === 'number' ? Math.round(meal.total.calories).toLocaleString() : '—'}<small>est. kcal</small></span><ChevronRight size={18}/></button></div>; })}</div>}
      <div className="cc-nutrition-overview"><div className="cc-nutrition-intake"><span>{summary.partial ? 'Known calories · partial estimate' : 'Estimated calories logged'}</span><strong>{summary.knownCalorieCount ? Math.round(summary.calories).toLocaleString() : '—'}<small> kcal</small></strong><p>{summary.mealCount ? `${summary.mealCount} logged meal${summary.mealCount === 1 ? '' : 's'}${scale !== 'day' ? ` across ${summary.daysWithLogs} of ${summary.elapsedDays} elapsed days` : ''}` : 'No meals logged for this period. Intake is unknown.'}</p>{summary.target !== null && summary.mealCount > 0 && summary.daysWithLogs === summary.elapsedDays && !summary.partial && comparisonReady && <><div className="cc-nutrition-target-track" aria-hidden="true"><span style={{ width: `${Math.min(100, summary.calories / summary.target * 100)}%` }}/></div><small>{signedCalories(summary.calories - summary.target)} kcal vs {Math.round(summary.target).toLocaleString()} kcal intake target{scale !== 'day' ? ' for elapsed days' : ''}</small></>}</div>
        <div className="cc-nutrition-balance"><span>Estimated energy balance</span><strong>{comparisonReady && summary.balance !== null ? `${signedCalories(summary.balance)}` : '—'}<small>{comparisonReady && summary.balance !== null ? ' kcal' : ''}</small></strong><p>{!comparisonReady ? 'Resolve incomplete history, pending photos, or meals without dates before comparing.' : summary.expenditure === null ? 'Daily expenditure estimate not set for every date in this period.' : !summary.mealCount || summary.daysWithLogs < summary.elapsedDays ? 'Some dates have no logged meals. Intake is unknown.' : summary.partial ? 'Some meal calories are unresolved.' : 'Logged intake − estimated energy use.'}</p></div></div>
      <details className="cc-nutrition-method"><summary>How these numbers work</summary><p>Calories come from saved, confirmed parent meals, counted once on the date you ate them. Photo estimates can be inaccurate; meals you did not log are not included. An empty date means no saved log, never zero food eaten.</p><p>Your intake target is separate from expenditure. Estimated energy balance subtracts your configured daily expenditure estimate from logged intake. For today, expenditure is spread evenly across the elapsed Chicago day; previous days use the full daily estimate. This is a modelling assumption, not a measurement of energy use or fat loss. Comparisons are hidden when dates have no logs, estimates are unresolved, or loaded history is incomplete.</p><p>Settings apply from their saved start dates. Meal gaps measure time between logs. Elapsed time alone does not establish fasting, an empty stomach, or fat burning.</p></details>
      {(scale === 'week' || scale === 'month') && <>
        <div className="cc-nutrition-view-options" role="group" aria-label="Calendar display"><button type="button" aria-pressed={rangeView === 'list'} onClick={() => setRangeView('list')}>Readable list</button><button type="button" aria-pressed={rangeView === 'calendar'} onClick={() => setRangeView('calendar')}>{scale === 'week' ? 'Chart' : 'Calendar'}</button></div>
        {rangeView === 'list' && <div className="cc-nutrition-day-list" role="region" aria-label={`${scale === 'week' ? 'Weekly' : 'Monthly'} food list`}>{days.map(d => <button key={d.day} type="button" className={d.day === today ? 'is-today' : ''} onClick={() => chooseDay(d.day)} disabled={d.day > today} aria-label={`${dayLabel(d.day)}: ${d.meals.length ? `${d.knownCalorieCount ? Math.round(d.calories) + ' known kcal' : 'calories unknown'}${d.partial ? ', partial estimate' : ''}, ${d.meals.length} meals` : 'no meals logged'}`}><span><strong>{dayLabel(d.day, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><small>{d.day === today ? 'Today · ' : ''}{d.meals.length ? `${d.meals.length} logged meal${d.meals.length === 1 ? '' : 's'}` : d.day > today ? 'Upcoming' : 'No meals logged'}</small></span><span><strong>{d.knownCalorieCount ? Math.round(d.calories).toLocaleString() : '—'}</strong><small>{d.partial ? 'Known kcal · partial' : d.knownCalorieCount ? 'Estimated kcal' : 'Calories unknown'}</small></span><ChevronRight size={18} aria-hidden="true"/></button>)}</div>}
        {rangeView === 'calendar' && scale === 'week' && <div className="cc-nutrition-week" aria-label="Weekly calories">{days.map(d => <button key={d.day} type="button" onClick={() => chooseDay(d.day)} disabled={d.day > today} aria-label={`${dayLabel(d.day)}: ${d.meals.length ? `${d.knownCalorieCount ? Math.round(d.calories) + ' known kcal' : 'calories unknown'}${d.partial ? ', partial estimate' : ''}, ${d.meals.length} meals` : 'no meals logged'}`}><small>{dayLabel(d.day, { weekday: 'short' })}</small><div className="cc-nutrition-bar-space"><span style={{ height: `${d.knownCalorieCount ? Math.max(4, d.calories / maxCalories * 100) : 0}%` }}/>{!d.knownCalorieCount && <i>—</i>}</div><strong>{d.knownCalorieCount ? Math.round(d.calories).toLocaleString() : '—'}</strong><small>{d.partial ? 'Partial kcal' : d.meals.length ? `${d.meals.length} meal${d.meals.length === 1 ? '' : 's'}` : d.day > today ? 'Upcoming' : 'No log'}</small></button>)}</div>}
        {rangeView === 'calendar' && scale === 'month' && <div className="cc-nutrition-month" aria-label="Monthly food calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d} className="cc-nutrition-weekday">{d}</span>)}{Array.from({ length: (new Date(`${period.start}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => <span key={`blank-${i}`}/>)}{days.map(d => <button key={d.day} type="button" className={d.day === today ? 'is-today' : ''} onClick={() => chooseDay(d.day)} disabled={d.day > today} aria-label={`${dayLabel(d.day)}: ${d.meals.length ? `${d.knownCalorieCount ? Math.round(d.calories) + ' known kcal' : 'calories unknown'}${d.partial ? ', partial estimate' : ''}, ${d.meals.length} meals` : 'no meals logged'}`}><span>{Number(d.day.slice(-2))}</span><strong>{d.knownCalorieCount ? Math.round(d.calories).toLocaleString() : '—'}</strong><small>{d.partial ? 'Partial kcal' : d.meals.length ? `${d.meals.length} meal${d.meals.length === 1 ? '' : 's'}` : d.day > today ? '' : 'No log'}</small></button>)}</div>}
      </>}
      {scale === 'year' && <div className="cc-nutrition-year" aria-label="Monthly totals">{months.map(month => { const selected = days.filter(d => d.day.startsWith(month)), total = periodNutrition(selected, today); return <button key={month} type="button" disabled={`${month}-01` > today} onClick={() => { setAnchor(`${month}-01`); setScale('month'); }}><span>{dayLabel(`${month}-01`, { month: 'long' })}<ChevronRight size={16}/></span><strong>{total.knownCalorieCount ? Math.round(total.calories).toLocaleString() : '—'}<small>{total.partial ? ' known kcal · partial' : total.knownCalorieCount ? ' kcal' : ''}</small></strong><div className="cc-nutrition-month-dots" aria-hidden="true">{selected.map(d => <i key={d.day} className={d.meals.length ? 'has-log' : ''}/>)}</div><small>{total.mealCount ? `${total.daysWithLogs} days with logs · ${total.mealCount} meals` : `${month}-01` > today ? 'Upcoming' : 'No meals logged'}</small></button>; })}</div>}
      {scale === 'day' && !ACCOUNT_SESSIONS && <div className="cc-nutrition-timeline"><div className="cc-nutrition-heading"><h3>Meals & timing</h3><span>{chosenMeals.length} logged</span></div>{chosenMeals.length === 0 ? <div className="cc-nutrition-empty"><CalendarDays size={22}/><p>No saved meals on this date.</p><small>Food eaten without a log will not appear here.</small></div> : chosenMeals.map(meal => { const prior = ordered[ordered.findIndex(m => m.id === meal.id) - 1]; const gap = prior?.consumedAt && meal.consumedAt ? Date.parse(meal.consumedAt) - Date.parse(prior.consumedAt) : null; return <div key={meal.id} className="cc-nutrition-timeline-item">{gap !== null && gap > 0 && <div className="cc-nutrition-gap"><Clock3 size={13}/>{elapsedLabel(gap)} between logged meals{nutritionDay(prior.consumedAt!) !== anchor ? ` · previous ${mealTimeLabel(prior.consumedAt)}` : ''}</div>}<button type="button" onClick={() => onOpenMeal(meal.id)}><span className="cc-nutrition-meal-time">{mealTimeLabel(meal.consumedAt, false)}</span><span className="cc-nutrition-meal-name"><strong>{meal.description}</strong><small>{meal.imageStored ? 'Saved photo · ' : ''}Logged{meal.totalIsPartial ? ' · partial estimate' : ''}</small></span><span className="cc-nutrition-meal-kcal">{typeof meal.total?.calories === 'number' ? Math.round(meal.total.calories).toLocaleString() : '—'}<small>est. kcal</small></span><ChevronRight size={18}/></button></div>; })}</div>}
      {!ACCOUNT_SESSIONS && <LastMeal meals={history.meals} now={now} onOpenMeal={onOpenMeal}/>}
      <Coverage history={history}/>
    </>}
    {onSaveSettings && <NutritionSettingsForm settings={settings} onSave={onSaveSettings}/>}
  </section>;
}
