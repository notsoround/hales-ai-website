import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import './dashboard.css';
import './meal-detail.css';
import { entriesForDay, entriesForType, metricScales, rangeLabel } from './dashboardModel';

export type DashboardRange = { preset: 'day' | 'week' | 'month' | 'custom'; start: string; end: string; timezone: 'America/Chicago' };
export type DashboardEntry = { id: string; type: string; date: string; time?: string; title: string; body?: string; amount?: number | null; calories?: number | null; parentId?: string | null; source?: string; icon?: string; details?: { mealId?: string | null; [key: string]: unknown } };
export type FoodMeal = { id: string; status: string; createdAt?: string; description?: string; total?: Record<string, number | null>; warnings?: string[]; lookupWarnings?: string[]; totalIsPartial?: boolean; items?: Array<{ id: string; name: string; quantity?: number | null; unit?: string | null; nutrition?: Record<string, number | null>; provenance?: string; calculation?: string; confidence?: string; variantWarning?: string; sourceCitations?: Array<{ title: string; url: string }> }>; needsClarification?: boolean; clarification?: string | null; sheetLoggedAt?: string | null };
export type DashboardStats = { range: { start: string; end: string; timezone?: string; coverage?: string; spendSource?: string }; totals: { calories: number; spend: number; currency?: string }; series: Array<{ date: string; calories: number; spend: number }>; entries: DashboardEntry[]; coverage?: string };
export type DashboardLoader = (range: DashboardRange) => Promise<DashboardStats>;

const chicago = 'America/Chicago' as const;
const dayMs = 86400000;
function chicagoToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: chicago, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function shift(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function startFor(preset: DashboardRange['preset'], end: string) { return preset === 'day' ? end : shift(end, preset === 'week' ? -6 : -29); }
function parseMoney(body = '') { const match = body.match(/[-+]?\$\s*([\d,]+(?:\.\d+)?)/); return match ? Number(match[1].replace(/,/g, '')) : null; }
function fallbackStats(items: Array<Record<string, unknown>>, range: DashboardRange): DashboardStats {
  const start = range.start, end = range.end;
  const entries = items.map((item, index) => {
    const body = String(item.body || ''); const type = String(item.type || 'signal');
    const calorieMatch = body.match(/([\d,]+)\s*kcal/i);
    return { id: String(item.id || `${type}-${item.ts || index}`), type, date: String(item.date || ''), time: String(item.time || ''), title: String(item.title || 'Signal'), body, amount: type === 'transaction' ? parseMoney(body) : null, calories: type === 'food' && calorieMatch ? Number(calorieMatch[1].replace(/,/g, '')) : null, icon: String(item.icon || '•') };
  }).filter(item => item.date >= start && item.date <= end);
  const seen = new Set<string>();
  const unique = entries.filter(entry => { const key = `${entry.type}|${entry.date}|${entry.title}|${entry.amount ?? ''}`; if (entry.type === 'transaction' && seen.has(key)) return false; seen.add(key); return true; });
  const series = Array.from({ length: Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs) + 1) }, (_, i) => { const date = shift(start, i); const day = unique.filter(item => item.date === date); return { date, calories: day.reduce((sum, item) => sum + (item.calories || 0), 0), spend: day.reduce((sum, item) => sum + (item.amount || 0), 0) }; });
  return { range: { start, end, timezone: chicago, coverage: 'Recent feed coverage only; this feed may omit older entries.' }, totals: { calories: unique.reduce((sum, item) => sum + (item.calories || 0), 0), spend: unique.reduce((sum, item) => sum + (item.amount || 0), 0) }, series, entries: unique, coverage: 'Recent feed coverage only; this feed may omit older entries.' };
}

export function FeedDashboard({ loadStats, feedLoader, loadMeal }: { loadStats?: DashboardLoader; feedLoader?: () => Promise<{ items: Array<Record<string, unknown>> }>; loadMeal?: (mealId: string) => Promise<FoodMeal> }) {
  const today = chicagoToday();
  const [preset, setPreset] = useState<DashboardRange['preset']>('week');
  const [end, setEnd] = useState(today); const [customStart, setCustomStart] = useState(shift(today, -6));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selected, setSelected] = useState<DashboardEntry | null>(null);
  const [selectedList, setSelectedList] = useState<{ title: string; entries: DashboardEntry[] } | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const requestVersion=useRef(0);
  const range = useMemo<DashboardRange>(() => ({ preset, start: preset === 'custom' ? customStart : startFor(preset, end), end, timezone: chicago }), [preset, end, customStart]);
  const refresh = useCallback(async () => { const version=++requestVersion.current; setLoading(true); setStats(null); setError(''); try { const result = loadStats ? await loadStats(range) : fallbackStats((await (feedLoader ? feedLoader() : Promise.resolve({ items: [] }))).items, range); if(version===requestVersion.current)setStats(result); } catch (e) { if(version===requestVersion.current)setError(e instanceof Error ? e.message : 'Could not load dashboard data.'); } finally { if(version===requestVersion.current)setLoading(false); } }, [feedLoader, loadStats, range]);
  useEffect(() => { setVisibleCount(20); setSelected(null); setSelectedList(null); void refresh(); }, [refresh]);
  if (selected) return <SignalDetail entry={selected} onBack={() => setSelected(null)} loadMeal={loadMeal} />;
  if (selectedList) return <SignalList title={selectedList.title} entries={selectedList.entries} onBack={() => setSelectedList(null)} onSelect={setSelected} />;
  const scales = metricScales(stats?.series || []);
  const moneyPrefix = stats?.totals.currency && !['USD','$'].includes(stats.totals.currency) ? `${stats.totals.currency} ` : '$';
  return <section className="cc-dashboard" aria-label="Cupcake dashboard">
    <div className="cc-heading-row"><div><span className="cc-eyebrow">YOUR DASHBOARD</span><h2>Signals with<br /><em>some perspective.</em></h2></div><button className="cc-secondary" aria-label="Refresh dashboard" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? 'cc-spin' : ''} size={18} /></button></div>
    <div className="cc-dashboard-range" role="tablist" aria-label="Dashboard range">{(['day', 'week', 'month', 'custom'] as const).map(option => <button key={option} role="tab" aria-selected={preset === option} onClick={() => setPreset(option)}>{rangeLabel(option)}</button>)}</div>
    {preset === 'custom' && <div className="cc-dashboard-dates"><label>From<input type="date" value={customStart} max={end} onChange={event => setCustomStart(event.target.value)} /></label><label>Through<input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label></div>}
    {error && <p className="cc-error" role="alert">{error}</p>}
    {loading && !stats ? <p className="cc-thinking"><Loader2 className="cc-spin" size={17} />Loading your signals…</p> : stats && <>
      <div className="cc-dashboard-cards">
        <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Food entries', entries: entriesForType(stats.entries, 'food') })}><strong>{Math.round(stats.totals.calories).toLocaleString()}</strong><span>Est. calories logged · View food</span></button>
        <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Transactions', entries: entriesForType(stats.entries, 'transaction') })}><strong>{moneyPrefix}{stats.totals.spend.toFixed(2)}</strong><span>{stats.range.spendSource === 'Plaid posted outflows' ? 'Posted spend' : 'Logged spend'} · View transactions</span></button>
      </div>
      <div className="cc-dashboard-chart cc-card">
        <div className="cc-heading-row"><h3>{rangeLabel(preset)}</h3><span className="cc-muted cc-small">{stats.range.start} → {stats.range.end}</span></div>
        <div className="cc-chart-scales"><span>Calories · max {Math.round(scales.calorieMax).toLocaleString()} kcal</span><span>Spend · max {moneyPrefix}{scales.spendMax.toFixed(2)}</span></div>
        <div className="cc-bars" style={{ '--cc-days': stats.series.length } as React.CSSProperties} aria-label="Calories and spend by day">{stats.series.map((day, index) => <button key={day.date} className="cc-bar-day" aria-label={`${day.date}: ${day.calories} calories, ${moneyPrefix}${day.spend.toFixed(2)} spend. Open all entries.`} onClick={() => setSelectedList({ title: day.date, entries: entriesForDay(stats.entries, day.date) })}><span className="cc-bar-stack"><i style={{ height: `${scales.caloriePercent(day.calories)}%` }} /><b style={{ height: `${scales.spendPercent(day.spend)}%` }} /></span><small className={stats.series.length > 14 && index % 5 !== 0 && index !== stats.series.length - 1 ? 'cc-visually-hidden' : ''}>{day.date.slice(5)}</small></button>)}</div>
        <div className="cc-chart-legend"><span><i />Calories (kcal scale)</span><span><b />Spend ({stats.totals.currency || 'USD'} scale)</span></div>
      </div>
      <div className="cc-dashboard-section"><div className="cc-heading-row"><h3>Signals in this range</h3><span className="cc-muted cc-small">{stats.entries.length} total</span></div>{stats.entries.slice(0, visibleCount).map(entry => <button className="cc-dashboard-entry" key={entry.id} onClick={() => setSelected(entry)}><span className="cc-dashboard-entry-icon">{entry.icon || '•'}</span><span><strong>{entry.title}</strong><small>{entry.date}{entry.time ? ` · ${entry.time}` : ''} · {entry.body || entry.type}</small></span><ChevronRight size={17} /></button>)}{visibleCount < stats.entries.length && <button className="cc-secondary cc-dashboard-more" onClick={() => setVisibleCount(count => count + 20)}>Show more ({stats.entries.length - visibleCount} remaining)</button>}{!stats.entries.length && <p className="cc-muted">No entries in this range.</p>}</div>
      {stats.coverage && <p className="cc-muted cc-small cc-dashboard-coverage">{stats.coverage}</p>}
    </>}
  </section>;
}

function SignalList({ title, entries, onBack, onSelect }: { title: string; entries: DashboardEntry[]; onBack: () => void; onSelect: (entry: DashboardEntry) => void }) {
  const [visibleCount, setVisibleCount] = useState(20);
  return <section className="cc-dashboard cc-dashboard-detail"><button className="cc-text-button" onClick={onBack}><ArrowLeft size={17} />Back to dashboard</button><span className="cc-eyebrow">DASHBOARD ENTRIES</span><h2>{title}</h2><p className="cc-muted">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p><div className="cc-dashboard-section">{entries.slice(0, visibleCount).map(entry => <button className="cc-dashboard-entry" key={entry.id} onClick={() => onSelect(entry)}><span className="cc-dashboard-entry-icon">{entry.icon || '•'}</span><span><strong>{entry.title}</strong><small>{entry.date}{entry.time ? ` · ${entry.time}` : ''} · {entry.body || entry.type}</small></span><ChevronRight size={17} /></button>)}{!entries.length && <p className="cc-muted">No entries in this selection.</p>}{visibleCount < entries.length && <button className="cc-secondary cc-dashboard-more" onClick={() => setVisibleCount(count => count + 20)}>Show more ({entries.length - visibleCount} remaining)</button>}</div></section>;
}

export function SignalDetail({ entry, onBack, loadMeal }: { entry: DashboardEntry; onBack: () => void; loadMeal?: (mealId: string) => Promise<FoodMeal> }) {
  const mealId = entry.details?.mealId;
  const [meal, setMeal] = useState<FoodMeal | null>(null); const [mealError, setMealError] = useState('');
  useEffect(() => { if (!mealId || !loadMeal) return; let current = true; void loadMeal(mealId).then(value => { if (current) setMeal(value); }).catch(error => { if (current) setMealError(error instanceof Error ? error.message : 'Meal details unavailable.'); }); return () => { current = false; }; }, [loadMeal, mealId]);
  const mealWarnings = meal ? [...(meal.lookupWarnings || []), ...(meal.warnings || [])] : [];
  return <section className="cc-dashboard cc-dashboard-detail"><button className="cc-text-button" onClick={onBack}><ArrowLeft size={17} />Back to dashboard</button><span className="cc-eyebrow">SIGNAL DETAIL</span><h2>{entry.icon || '•'} {entry.title}</h2><p className="cc-muted">{entry.date}{entry.time ? ` · ${entry.time}` : ''} · {entry.type}</p><div className="cc-card"><p className="cc-answer-text">{entry.body || 'No additional detail was provided.'}</p>{entry.amount != null && <strong>${entry.amount.toFixed(2)}</strong>}{entry.calories != null && <strong>{entry.calories.toLocaleString()} kcal</strong>}{entry.type==='food'&&!mealId&&<p className="cc-muted">This older entry has no saved item breakdown.{typeof entry.details?.notes==='string'&&entry.details.notes ? ` Original notes: ${entry.details.notes}` : ''}</p>}{entry.source && <a className="cc-text-button" href={entry.source} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={15} /></a>}{mealId && loadMeal && !meal && !mealError && <p className="cc-thinking"><Loader2 className="cc-spin" size={16} />Loading meal breakdown…</p>}{mealError && <p className="cc-muted">{mealError} This historical entry has no saved breakdown.</p>}{mealWarnings.map(warning => <p className="cc-muted" key={warning}>Estimate warning: {warning}</p>)}{meal && <div className="cc-meal-breakdown"><strong>Saved meal total: {meal.total?.calories == null ? 'Calories unknown' : `${meal.total.calories} kcal${meal.totalIsPartial ? ' (partial)' : ''}`}</strong>{meal.totalIsPartial && <small>Some items could not be identified, so this total is incomplete.</small>}{meal.items?.map(item => <div key={item.id}><span>{item.name}{item.quantity != null && item.quantity !== 1 ? ` × ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}</span><small>{item.nutrition?.calories == null ? 'Calories unknown' : `${item.nutrition.calories} kcal`} · {item.provenance || 'Estimate provenance unavailable'}</small>{item.calculation && <small>Calculation: {item.calculation}</small>}{item.variantWarning && <small>Estimate warning: {item.variantWarning}</small>}{item.sourceCitations?.length ? <small className="cc-meal-sources">Sources: {item.sourceCitations.map((source, index) => <span key={`${source.url}-${source.title}`}>{index > 0 && ', '}<a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={11} /></a></span>)}</small> : <small>Source link unavailable</small>}</div>)}</div>}</div></section>; }
