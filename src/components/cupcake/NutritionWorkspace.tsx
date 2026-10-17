import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2, Settings2 } from 'lucide-react';
import { dayLabel, elapsedLabel, lastLoggedMeal, loggedMeals, mealTimeLabel, moveNutritionPeriod, nutritionDay, nutritionDays, nutritionPeriod, periodNutrition, signedCalories, EMPTY_NUTRITION_SETTINGS, type FoodHistoryMeal, type NutritionHistory, type NutritionScale, type NutritionSettings, type NutritionSettingVersion } from './nutritionModel';
import './nutrition.css';

type CommonProps = { history?: NutritionHistory | null; settings?: NutritionSettings; loading?: boolean; error?: string; onRetry?: () => void; onOpenMeal: (mealId: string) => void; now?: Date };
export type NutritionWorkspaceProps = CommonProps & { onBack?: () => void; onOpenCapture?: () => void; onSaveSettings?: (settings: NutritionSettingVersion) => Promise<void> };

function useNutritionClock(fixed?: Date) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { if (fixed) return; const timer = window.setInterval(() => setClock(new Date()), 60000); return () => window.clearInterval(timer); }, [fixed]);
  return fixed || clock;
}
function Coverage({ history }: { history: NutritionHistory }) {
  return <div className="cc-nutrition-coverage">
    {!history.complete && <p role="status">Some saved meals are still loading. Totals are partial; comparisons are unavailable.</p>}
    {!!history.pendingCount && <p>{history.pendingCount} saved photo{history.pendingCount === 1 ? '' : 's'} still need{history.pendingCount === 1 ? 's' : ''} logging or review and {history.pendingCount === 1 ? 'is' : 'are'} excluded.</p>}
    {!!history.undatedLoggedCount && <p>{history.undatedLoggedCount} logged meal{history.undatedLoggedCount === 1 ? ' has' : 's have'} no saved eaten time and {history.undatedLoggedCount === 1 ? 'is' : 'are'} excluded from the calendar.</p>}
    {!!history.unknownTimeCount && <p>{history.unknownTimeCount} meal{history.unknownTimeCount === 1 ? ' has' : 's have'} a saved date without a reliable clock time. Calories count on that date; meal timers and gaps exclude {history.unknownTimeCount === 1 ? 'it' : 'them'}.</p>}
    <p>{history.coverageNote || 'Saved food photos only. Meals not photographed or logged elsewhere may be missing.'} All dates and times use Chicago time.</p>
  </div>;
}
function LoadState({ loading, error, onRetry }: Pick<CommonProps, 'loading' | 'error' | 'onRetry'>) {
  return <div className="cc-nutrition-empty" role="status">{loading ? <><Loader2 size={20} className="cc-spin"/> Loading saved meals…</> : <>{error || 'Food history has not loaded.'}{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</>}</div>;
}
function LastMeal({ meals, now, onOpenMeal }: { meals: FoodHistoryMeal[]; now: Date; onOpenMeal: CommonProps['onOpenMeal'] }) {
  const last = lastLoggedMeal(meals, now);
  return last ? <button type="button" className="cc-nutrition-last" onClick={() => onOpenMeal(last.id)}>
    <Clock3 size={18}/><span><small>Last logged meal with a saved time · {elapsedLabel(now.getTime() - Date.parse(last.consumedAt!))} ago</small><strong>{last.description}</strong><small>{mealTimeLabel(last.consumedAt)}</small></span><ChevronRight size={18}/>
  </button> : <p className="cc-nutrition-note">No meal with a saved eaten time is available. This does not mean you have not eaten.</p>;
}

export function NutritionTodayCard({ history, settings = EMPTY_NUTRITION_SETTINGS, loading, error, onRetry, onOpenMeal, onOpenCalendar, now: fixedNow }: CommonProps & { onOpenCalendar: () => void }) {
  const now = useNutritionClock(fixedNow), day = nutritionDay(now);
  const summary = history ? nutritionDays(history.meals, [day], settings, now)[0] : null;
  const comparisonReady = !!history?.complete && !history.pendingCount && !history.undatedLoggedCount;
  return <section className="cc-nutrition-today" aria-label="Food today">
    <div className="cc-nutrition-heading"><span className="cc-nutrition-eyebrow"><CalendarDays size={16}/> Food today</span><button type="button" className="cc-nutrition-link" onClick={onOpenCalendar}>Open calendar <ArrowUpRight size={16}/></button></div>
    {!history || !summary ? <LoadState loading={loading} error={error} onRetry={onRetry}/> : <>
      {error && <p role="alert" className="cc-nutrition-warning">{error} {onRetry && <button type="button" onClick={onRetry}>Try again</button>}</p>}
      <div className="cc-nutrition-today-values"><div><strong>{summary.knownCalorieCount ? Math.round(summary.calories).toLocaleString() : '—'}</strong><span>{summary.partial ? 'known kcal · partial estimate' : 'estimated kcal logged'}</span><small>{summary.meals.length ? `${summary.meals.length} logged meal${summary.meals.length === 1 ? '' : 's'}` : 'No meals logged today'}</small></div>
        <div className="cc-nutrition-today-balance"><small>Estimated energy balance</small><b>{comparisonReady && summary.balance !== null ? `${signedCalories(summary.balance)} kcal` : 'Not available'}</b><span>{comparisonReady && summary.balance !== null ? 'Logged intake − estimated use so far' : summary.expenditure === null ? 'Set your daily expenditure estimate in the calendar' : 'Needs complete loaded estimates and no unassigned meals'}</span></div></div>
      {summary.target !== null && summary.meals.length > 0 && !summary.partial && comparisonReady && <p className="cc-nutrition-note">{signedCalories(summary.calories - summary.target)} kcal vs your {Math.round(summary.target).toLocaleString()} kcal daily intake target.</p>}
      {summary.balance !== null && comparisonReady && <p className="cc-nutrition-note">Estimated use is spread evenly across today. Missing meals change this comparison.</p>}
      <LastMeal meals={history.meals} now={now} onOpenMeal={onOpenMeal}/>
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
  const period = nutritionPeriod(anchor, scale), days = nutritionDays(history?.meals || [], period.days, settings, now), summary = periodNutrition(days, today);
  const comparisonReady = !!history?.complete && !history.pendingCount && !history.undatedLoggedCount;
  const chooseDay = (day: string) => { setAnchor(day); setScale('day'); };
  const ordered = loggedMeals(history?.meals || []), chosenMeals = scale === 'day' ? days[0].meals : [];
  const maxCalories = Math.max(1, ...days.map(d => d.calories));
  const months = Array.from({ length: 12 }, (_, i) => `${anchor.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);
  return <section className="cc-nutrition-workspace" aria-label="Food calendar">
    {onBack && <button type="button" className="cc-nutrition-link cc-nutrition-back" onClick={onBack}><ChevronLeft size={17}/> Back to Today</button>}
    <div className="cc-nutrition-heading"><div><span className="cc-nutrition-eyebrow">Your food log</span><h2>Food calendar</h2><p>Meals, timing, and the bigger picture.</p></div>{onOpenCapture && <button type="button" className="cc-nutrition-primary" onClick={onOpenCapture}>Add food photo</button>}</div>
    <div className="cc-nutrition-controls"><div className="cc-nutrition-scale" role="group" aria-label="Calendar scale">{(['day', 'week', 'month', 'year'] as const).map(s => <button key={s} type="button" aria-pressed={scale === s} onClick={() => setScale(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div><div className="cc-nutrition-arrows"><button type="button" aria-label={`Previous ${scale}`} onClick={() => setAnchor(moveNutritionPeriod(anchor, scale, -1))}><ChevronLeft size={20}/></button><button type="button" onClick={() => { setAnchor(today); setScale('day'); }}>Today</button><button type="button" aria-label={`Next ${scale}`} onClick={() => setAnchor(moveNutritionPeriod(anchor, scale, 1))} disabled={period.end >= today}><ChevronRight size={20}/></button></div></div>
    <h3 className="cc-nutrition-period">{period.label}</h3>
    {!history ? <LoadState loading={loading} error={error} onRetry={onRetry}/> : <>
      {error && <p role="alert" className="cc-nutrition-warning">{error} {onRetry && <button type="button" onClick={onRetry}>Try again</button>}</p>}
      <div className="cc-nutrition-overview"><div className="cc-nutrition-intake"><span>{summary.partial ? 'Known calories · partial estimate' : 'Estimated calories logged'}</span><strong>{summary.knownCalorieCount ? Math.round(summary.calories).toLocaleString() : '—'}<small> kcal</small></strong><p>{summary.mealCount ? `${summary.mealCount} logged meal${summary.mealCount === 1 ? '' : 's'}${scale !== 'day' ? ` across ${summary.daysWithLogs} of ${summary.elapsedDays} elapsed days` : ''}` : 'No meals logged for this period. Intake is unknown.'}</p>{summary.target !== null && summary.mealCount > 0 && summary.daysWithLogs === summary.elapsedDays && !summary.partial && comparisonReady && <><div className="cc-nutrition-target-track" aria-hidden="true"><span style={{ width: `${Math.min(100, summary.calories / summary.target * 100)}%` }}/></div><small>{signedCalories(summary.calories - summary.target)} kcal vs {Math.round(summary.target).toLocaleString()} kcal intake target{scale !== 'day' ? ' for elapsed days' : ''}</small></>}</div>
        <div className="cc-nutrition-balance"><span>Estimated energy balance</span><strong>{comparisonReady && summary.balance !== null ? `${signedCalories(summary.balance)}` : '—'}<small>{comparisonReady && summary.balance !== null ? ' kcal' : ''}</small></strong><p>{!comparisonReady ? 'Resolve incomplete history, pending photos, or meals without dates before comparing.' : summary.expenditure === null ? 'Daily expenditure estimate not set for every date in this period.' : !summary.mealCount || summary.daysWithLogs < summary.elapsedDays ? 'Some dates have no logged meals. Intake is unknown.' : summary.partial ? 'Some meal calories are unresolved.' : 'Logged intake − estimated energy use.'}</p></div></div>
      <details className="cc-nutrition-method"><summary>How these numbers work</summary><p>Calories come from saved, confirmed parent meals, counted once on the date you ate them. Photo estimates can be inaccurate; meals you did not log are not included. An empty date means no saved log, never zero food eaten.</p><p>Your intake target is separate from expenditure. Estimated energy balance subtracts your configured daily expenditure estimate from logged intake. For today, expenditure is spread evenly across the elapsed Chicago day; previous days use the full daily estimate. This is a modelling assumption, not a measurement of energy use or fat loss. Comparisons are hidden when dates have no logs, estimates are unresolved, or loaded history is incomplete.</p><p>Settings apply from their saved start dates. Meal gaps measure time between logs. Elapsed time alone does not establish fasting, an empty stomach, or fat burning.</p></details>
      {scale === 'week' && <div className="cc-nutrition-week" aria-label="Weekly calories">{days.map(d => <button key={d.day} type="button" onClick={() => chooseDay(d.day)} disabled={d.day > today} aria-label={`${dayLabel(d.day)}: ${d.meals.length ? `${d.knownCalorieCount ? Math.round(d.calories) + ' known kcal' : 'calories unknown'}${d.partial ? ', partial estimate' : ''}, ${d.meals.length} meals` : 'no meals logged'}`}><small>{dayLabel(d.day, { weekday: 'short' })}</small><div className="cc-nutrition-bar-space"><span style={{ height: `${d.knownCalorieCount ? Math.max(4, d.calories / maxCalories * 100) : 0}%` }}/>{!d.knownCalorieCount && <i>—</i>}</div><strong>{d.knownCalorieCount ? Math.round(d.calories).toLocaleString() : '—'}</strong><small>{d.partial ? 'Partial kcal' : d.meals.length ? `${d.meals.length} meal${d.meals.length === 1 ? '' : 's'}` : d.day > today ? 'Upcoming' : 'No log'}</small></button>)}</div>}
      {scale === 'month' && <div className="cc-nutrition-month" aria-label="Monthly food calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d} className="cc-nutrition-weekday">{d}</span>)}{Array.from({ length: (new Date(`${period.start}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => <span key={`blank-${i}`}/>)}{days.map(d => <button key={d.day} type="button" className={d.day === today ? 'is-today' : ''} onClick={() => chooseDay(d.day)} disabled={d.day > today} aria-label={`${dayLabel(d.day)}: ${d.meals.length ? `${d.knownCalorieCount ? Math.round(d.calories) + ' known kcal' : 'calories unknown'}${d.partial ? ', partial estimate' : ''}, ${d.meals.length} meals` : 'no meals logged'}`}><span>{Number(d.day.slice(-2))}</span><strong>{d.knownCalorieCount ? Math.round(d.calories).toLocaleString() : '—'}</strong><small>{d.partial ? 'Partial kcal' : d.meals.length ? `${d.meals.length} meal${d.meals.length === 1 ? '' : 's'}` : d.day > today ? '' : 'No log'}</small></button>)}</div>}
      {scale === 'year' && <div className="cc-nutrition-year" aria-label="Monthly totals">{months.map(month => { const selected = days.filter(d => d.day.startsWith(month)), total = periodNutrition(selected, today); return <button key={month} type="button" disabled={`${month}-01` > today} onClick={() => { setAnchor(`${month}-01`); setScale('month'); }}><span>{dayLabel(`${month}-01`, { month: 'long' })}<ChevronRight size={16}/></span><strong>{total.knownCalorieCount ? Math.round(total.calories).toLocaleString() : '—'}<small>{total.partial ? ' known kcal · partial' : total.knownCalorieCount ? ' kcal' : ''}</small></strong><div className="cc-nutrition-month-dots" aria-hidden="true">{selected.map(d => <i key={d.day} className={d.meals.length ? 'has-log' : ''}/>)}</div><small>{total.mealCount ? `${total.daysWithLogs} days with logs · ${total.mealCount} meals` : `${month}-01` > today ? 'Upcoming' : 'No meals logged'}</small></button>; })}</div>}
      {scale === 'day' && <div className="cc-nutrition-timeline"><div className="cc-nutrition-heading"><h3>Meals & timing</h3><span>{chosenMeals.length} logged</span></div>{chosenMeals.length === 0 ? <div className="cc-nutrition-empty"><CalendarDays size={22}/><p>No saved meals on this date.</p><small>Food eaten without a log will not appear here.</small></div> : chosenMeals.map(meal => { const prior = ordered[ordered.findIndex(m => m.id === meal.id) - 1]; const gap = prior?.consumedAt && meal.consumedAt ? Date.parse(meal.consumedAt) - Date.parse(prior.consumedAt) : null; return <div key={meal.id} className="cc-nutrition-timeline-item">{gap !== null && gap > 0 && <div className="cc-nutrition-gap"><Clock3 size={13}/>{elapsedLabel(gap)} between logged meals{nutritionDay(prior.consumedAt!) !== anchor ? ` · previous ${mealTimeLabel(prior.consumedAt)}` : ''}</div>}<button type="button" onClick={() => onOpenMeal(meal.id)}><span className="cc-nutrition-meal-time">{mealTimeLabel(meal.consumedAt, false)}</span><span className="cc-nutrition-meal-name"><strong>{meal.description}</strong><small>{meal.imageStored ? 'Saved photo · ' : ''}Logged{meal.totalIsPartial ? ' · partial estimate' : ''}</small></span><span className="cc-nutrition-meal-kcal">{typeof meal.total?.calories === 'number' ? Math.round(meal.total.calories).toLocaleString() : '—'}<small>est. kcal</small></span><ChevronRight size={18}/></button></div>; })}</div>}
      <LastMeal meals={history.meals} now={now} onOpenMeal={onOpenMeal}/>
      <Coverage history={history}/>
    </>}
    {onSaveSettings && <NutritionSettingsForm settings={settings} onSave={onSaveSettings}/>}
  </section>;
}
