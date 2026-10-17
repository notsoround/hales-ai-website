import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Headphones, Loader2, RefreshCw } from 'lucide-react';
import './dashboard.css';
import './meal-detail.css';
import { WeightHistoryConnected as WeightHistory } from './WeightHistoryConnected';
import { loadWeightPage, weightProvenanceLabel, type WeightRecord } from './weightApi';
import { weightTime } from './weightHistoryModel';
import { PersonalOutcomes } from './PersonalOutcomes';
import { dashboardSelectionEntries, interventionGroups, mergeEntries, metricScales, outcomeRate, rangeLabel, transactionAmount, validDashboardDates, type DashboardSelection } from './dashboardModel';

export type DashboardRange = { preset: 'day' | 'week' | 'month' | 'custom' | 'all'; start: string; end: string; timezone: 'America/Chicago' };
export type DashboardEntry = { id: string; type: string; date: string; time?: string; title: string; body?: string; amount?: number | null; currency?: string | null; calories?: number | null; parentId?: string | null; source?: string; category?: string; saved?: boolean | string; icon?: string; details?: { mealId?: string | null; outcome?: unknown; boughtAnyway?: unknown; [key: string]: unknown } };
export type FoodMeal = { id: string; status: string; createdAt?: string; photoTakenAt?: string; autoLogRequested?: boolean; consumedAt?: string; pendingConsumedAt?: string; logState?: string; countedInTotals?: boolean; calorieRange?: { low: number; high: number } | null; description?: string; total?: Record<string, number | null>; warnings?: string[]; lookupWarnings?: string[]; totalIsPartial?: boolean; items?: Array<{ id: string; name: string; quantity?: number | null; unit?: string | null; nutrition?: Record<string, number | null>; provenance?: string; calculation?: string; confidence?: string; portionAssumption?: string; calorieRange?: { low: number; high: number } | null; variantWarning?: string; sourceCitations?: Array<{ title: string; url: string }> }>; needsClarification?: boolean; clarification?: string | null; sheetLoggedAt?: string | null };
export type DashboardStats = { range: { start: string; end: string; timezone?: string; coverage?: string; spendSource?: string }; totals: { calories: number; spend: number; currency?: string; weightLb?: number | null; weightDate?: string }; series: Array<{ date: string; calories: number; spend: number }>; entries: DashboardEntry[]; nextCursor?: string | null; totalCount?: number; outcomes?: {wins:number;losses:number;missed:number;unscored:number;interventions:number}; coverage?: string };
export type DashboardLoader = (range: DashboardRange, cursor?: string) => Promise<DashboardStats>;
export type InterventionUpdate = (entry: DashboardEntry, note: string, boughtAnyway: boolean | null) => Promise<void>;
export type TalkAboutEntry = (entry: DashboardEntry) => void;

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
    return { id: String(item.id || `${type}-${item.ts || index}`), type, date: String(item.date || ''), time: String(item.time || ''), title: String(item.title || 'Signal'), body, amount: type === 'transaction' ? parseMoney(body) : null, currency: type === 'transaction' && body.trim().startsWith('$') ? 'USD' : null, calories: type === 'food' && calorieMatch ? Number(calorieMatch[1].replace(/,/g, '')) : null, icon: String(item.icon || '•') };
  }).filter(item => item.date >= start && item.date <= end);
  const seen = new Set<string>();
  const unique = entries.filter(entry => { const key = `${entry.type}|${entry.date}|${entry.title}|${entry.amount ?? ''}`; if (entry.type === 'transaction' && seen.has(key)) return false; seen.add(key); return true; });
  const series = Array.from({ length: Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs) + 1) }, (_, i) => { const date = shift(start, i); const day = unique.filter(item => item.date === date); return { date, calories: day.reduce((sum, item) => sum + (item.calories || 0), 0), spend: day.reduce((sum, item) => sum + (item.amount || 0), 0) }; });
  return { range: { start, end, timezone: chicago, coverage: 'Recent feed coverage only; this feed may omit older entries.' }, totals: { calories: unique.reduce((sum, item) => sum + (item.calories || 0), 0), spend: unique.reduce((sum, item) => sum + (item.amount || 0), 0), weightLb: unique.find(item => item.type === 'activity')?.amount ?? null }, series, entries: unique, coverage: 'Recent feed coverage only; this feed may omit older entries.' };
}

function rangeKey(range: DashboardRange) { return `${range.preset}|${range.start}|${range.end}|${range.timezone}`; }
function displayTime(time?: string) {
  if (!time || !/T|[+-]\d{2}:?\d{2}/.test(time)) return time || '';
  const parsed = Date.parse(time);
  if (!Number.isFinite(parsed)) return time;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: chicago, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(parsed));
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  const dayPeriod = parts.find(part => part.type === 'dayPeriod')?.value;
  return hour && minute && dayPeriod ? `${hour}:${minute} ${dayPeriod}` : time;
}
function entryWhen(entry: DashboardEntry) { const time = displayTime(entry.time); return `${entry.date}${time ? ` · ${time}` : ''}`; }
function relativeWeightAge(measuredAt: number, now = Date.now()) {
  if (!Number.isFinite(measuredAt) || now - measuredAt <= 48 * 60 * 60 * 1000) return '';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: chicago, year: 'numeric', month: '2-digit', day: '2-digit' });
  const days = Math.round((Date.parse(`${day.format(now)}T12:00:00Z`) - Date.parse(`${day.format(measuredAt)}T12:00:00Z`)) / dayMs);
  return days <= 1 ? 'yesterday' : `${days} days ago`;
}
function dashboardLoadError(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message ? error.message : fallback;
  const network = message === 'Failed to fetch' || message === 'Load failed' || message === 'Network request failed' || /networkerror|network error|failed to fetch|net::ERR_|offline|internet connection/i.test(message) || (error instanceof TypeError && /fetch|network|load failed/i.test(message));
  return network ? 'Cupcake couldn’t load this dashboard. Check your connection, then try again.' : message;
}
function textField(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function signalFacts(entry: DashboardEntry) {
  const details = entry.details || {};
  const rawSource = textField(entry.source);
  const detailSource = textField(details.source);
  const sourceUrl = /^https?:\/\//i.test(rawSource) ? rawSource : '';
  const source = sourceUrl ? detailSource : rawSource || detailSource;
  const notice = `${textField(details.notice)} ${textField(details.channel)} ${textField(details.delivery)}`;
  const telegram = details.telegram === true || /telegram/i.test(notice) || /telegram/i.test(source) || /telegram/i.test(rawSource);
  const savedRaw = details.saved ?? details.stored ?? details.appSaved ?? entry.saved;
  const savedText = typeof savedRaw === 'boolean' ? (savedRaw ? 'Saved in Cupcake' : 'Not saved in the app') : textField(savedRaw);
  return { date: textField(entry.date), time: displayTime(entry.time), category: textField(entry.category) || textField(details.category), type: textField(entry.type), source: telegram && /telegram/i.test(source) ? '' : source, sourceUrl, telegram, saved: /telegram/i.test(savedText) ? '' : savedText };
}
function countsFor(stats: DashboardStats) {
  const grouped = interventionGroups(stats.entries);
  return stats.outcomes || { wins: grouped.wins.length, losses: grouped.losses.length, missed: grouped.missed.length, unscored: grouped.unscored.length, interventions: grouped.interventions.length };
}
function rangeIsEmpty(stats: DashboardStats) {
  const counts = countsFor(stats);
  return stats.entries.length === 0 && !stats.totals.calories && !stats.totals.spend && !counts.wins && !counts.losses && !counts.missed && !counts.unscored && !counts.interventions && !stats.nextCursor;
}
function partialCoverageLine(coverage?: string) {
  if (!coverage?.includes('Partial')) return '';
  const sentence = coverage.split(/\n|(?<=\.)\s+/)[0]?.trim() || '';
  return sentence.includes('Partial') && sentence.length <= 180 ? sentence : 'Partial coverage in this range.';
}

export function FeedDashboard({ loadStats, feedLoader, loadMeal, updateIntervention, onTalkAbout }: { loadStats?: DashboardLoader; feedLoader?: () => Promise<{ items: Array<Record<string, unknown>> }>; loadMeal?: (mealId: string) => Promise<FoodMeal>; updateIntervention?: InterventionUpdate; onTalkAbout?: TalkAboutEntry }) {
  const today = chicagoToday();
  const [latestWeight,setLatestWeight]=useState<WeightRecord|null>(null);const [weightError,setWeightError]=useState(false);
  useEffect(()=>{let live=true;void loadWeightPage().then(p=>{if(live)setLatestWeight(p.latestMeasurement);}).catch(()=>{if(live)setWeightError(true);});return()=>{live=false;};},[]);
  const [preset, setPreset] = useState<DashboardRange['preset']>('week');
  const [customEnd, setCustomEnd] = useState(today); const [customStart, setCustomStart] = useState(shift(today, -6));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selected, setSelected] = useState<DashboardEntry | null>(null);
  const [selectedList, setSelectedList] = useState<DashboardSelection | null>(null);
  const [pageBusy,setPageBusy]=useState(false);
  const pageRequestVersion = useRef<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [weightOpen, setWeightOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const requestVersion=useRef(0); const statsKeyRef=useRef<string|null>(null); const errorKeyRef=useRef<string|null>(null);
  const range = useMemo<DashboardRange>(() => ({ preset, start: preset === 'custom' ? customStart : startFor(preset, today), end: preset === 'custom' ? customEnd : today, timezone: chicago }), [preset, today, customEnd, customStart]);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const key = rangeKey(range);
    setLoading(true); setPageBusy(false);
    // A new range must not keep the previous range's rows. The same range keeps the last good stats until this request succeeds.
    if (statsKeyRef.current !== key) { statsKeyRef.current = null; setStats(null); }
    errorKeyRef.current = null; setError('');
    if (range.preset !== 'all' && !validDashboardDates(range.start, range.end)) {
      errorKeyRef.current = key; setError('Choose valid dates with From on or before Through.'); setLoading(false); return;
    }
    try {
      const result = loadStats ? await loadStats(range) : fallbackStats((await (feedLoader ? feedLoader() : Promise.resolve({ items: [] }))).items, range);
      if (version === requestVersion.current) { statsKeyRef.current = key; setStats({ ...result, entries: mergeEntries([], result.entries) }); setRefreshKey(refreshKey => refreshKey + 1); }
    } catch (e) { if (version === requestVersion.current) { errorKeyRef.current = key; setError(dashboardLoadError(e, 'Could not load dashboard data.')); } }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [feedLoader, loadStats, range]);
  useEffect(() => { setVisibleCount(20); setSelected(null); setSelectedList(null); void refresh(); return () => { requestVersion.current += 1; }; }, [refresh]);
  const loadMore = async () => {
    const version = requestVersion.current;
    const key = rangeKey(range);
    if (pageRequestVersion.current === version || !stats?.nextCursor || !loadStats || statsKeyRef.current !== key) return;
    pageRequestVersion.current = version; setPageBusy(true); errorKeyRef.current = null; setError('');
    try {
      const page = await loadStats(range, stats.nextCursor);
      if (version === requestVersion.current) setStats(current => current ? { ...current, nextCursor: page.nextCursor, entries: mergeEntries(current.entries, page.entries) } : current);
    } catch (e) { if (version === requestVersion.current) { errorKeyRef.current = key; setError(dashboardLoadError(e, 'Could not load more.')); } }
    finally { if (pageRequestVersion.current === version) pageRequestVersion.current = null; if (version === requestVersion.current) setPageBusy(false); }
  };
  const currentKey = rangeKey(range);
  const ready = stats && statsKeyRef.current === currentKey ? stats : null;
  const visibleError = error && errorKeyRef.current === currentKey ? error : '';
  if (selected) return <SignalDetail backLabel={weightOpen ? 'Back to weight history' : selectedList ? `Back to ${selectedList.title.toLowerCase()}` : undefined} entry={selected} onBack={() => setSelected(null)} loadMeal={loadMeal} updateIntervention={updateIntervention} onUpdated={() => { setSelected(null); void refresh(); }} onTalkAbout={onTalkAbout} />;
  if (weightOpen) return <WeightHistory entries={ready?.entries || []} range={range} loading={loading} error={visibleError} hasMore={!!ready?.nextCursor} loadingMore={pageBusy} onMore={() => void loadMore()} onBack={() => setWeightOpen(false)} onRefresh={() => void refresh()} onRange={(p,start,end) => { setPreset(p); if(start)setCustomStart(start); if(end)setCustomEnd(end); }} onSelect={setSelected} />;
  if (selectedList) {
    const entries = dashboardSelectionEntries(ready?.entries || [], selectedList);
    const total = selectedList.kind === 'outcome' ? ready?.outcomes?.[selectedList.group] : undefined;
    return <SignalList title={selectedList.title} entries={entries} total={total} error={visibleError} hasMore={!!ready?.nextCursor && (total === undefined || entries.length < total)} loadingMore={pageBusy} onMore={() => void loadMore()} onBack={() => setSelectedList(null)} onSelect={setSelected} />;
  }
  const scales = metricScales(ready?.series || []);
  const moneyPrefix = ready?.totals.currency && !['USD','$'].includes(ready.totals.currency) ? `${ready.totals.currency} ` : '$';
  const empty = !!ready && rangeIsEmpty(ready);
  const counts = ready ? countsFor(ready) : null;
  const rate = counts ? outcomeRate(counts) : null;
  const partial = partialCoverageLine(ready?.coverage);
  const latest = latestWeight ? { lb: latestWeight.weightLb, at: Date.parse(latestWeight.measuredAt) } : null;
  const weightAge = latest ? relativeWeightAge(latest.at) : '';
  const weightButton = <button className="cc-dashboard-card" onClick={() => setWeightOpen(true)}><strong>{latest ? `${latest.lb.toFixed(1)} lb` : '—'}</strong><span>{latest ? `${weightProvenanceLabel(latestWeight?.basis, latestWeight?.source)} ${weightTime(latest.at)}${weightAge ? ` · ${weightAge}` : ''} · View graph` : weightError ? 'Weight unavailable · Open to retry' : 'Weight history · Awaiting a timestamped weigh-in'}</span></button>;
  return <section className="cc-dashboard" aria-label="Cupcake dashboard">
    <div className="cc-heading-row"><div><span className="cc-eyebrow">YOUR DASHBOARD</span><h2>Wins, losses &amp;<br /><em>the bigger picture.</em></h2></div><button className="cc-secondary" aria-label="Refresh dashboard" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? 'cc-spin' : ''} size={18} /></button></div>
    <div className="cc-dashboard-range" role="tablist" aria-label="Dashboard range">{(['day', 'week', 'month', 'custom', 'all'] as const).map(option => <button key={option} role="tab" aria-selected={preset === option} onClick={() => setPreset(option)}>{rangeLabel(option)}</button>)}</div>
    {preset === 'custom' && <div className="cc-dashboard-dates"><label>From<input type="date" value={customStart} max={customEnd || undefined} onChange={event => setCustomStart(event.target.value)} /></label><label>Through<input type="date" value={customEnd} min={customStart || undefined} onChange={event => setCustomEnd(event.target.value)} /></label></div>}
    <p className="cc-muted cc-small">{preset === 'all' ? 'All saved dates' : `${range.start} through ${range.end}, inclusive`} · Chicago time</p>
    {visibleError && <div className="cc-error" role="alert"><span>{visibleError}</span><button type="button" className="cc-secondary" onClick={() => void refresh()}>Retry</button></div>}
    {!ready && !visibleError && <p className="cc-thinking"><Loader2 className="cc-spin" size={17} />Loading your signals…</p>}
    {ready && counts && rate && <>
      <PersonalOutcomes range={range} refreshKey={refreshKey} />
      {empty ? <>
        <div className="cc-card"><h3>Nothing saved in this range yet</h3><p className="cc-muted">Food, spend, and purchase decisions saved in these dates will show up here.</p></div>
        {preset === 'all' && <button className="cc-dashboard-card" onClick={() => setWeightOpen(true)}>Weight history · Open graph</button>}
        {preset !== 'all' && (latest || weightError) && weightButton}
      </> : <>
        <h3>Purchase decisions</h3>
        <div className="cc-dashboard-cards cc-outcome-cards" aria-label="Recorded intervention outcomes">
          <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Times you won', kind: 'outcome', group: 'wins' })}><strong>{counts.wins}</strong><span>Times you won · recorded stops</span></button>
          <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Times you caved', kind: 'outcome', group: 'losses' })}><strong>{counts.losses}</strong><span>Times you caved · bought anyway</span></button>
          <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Missed calls', kind: 'outcome', group: 'missed' })}><strong>{counts.missed}</strong><span>Missed · no scored follow-up</span></button>
          <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Interventions', kind: 'outcome', group: 'interventions' })}><strong>{counts.interventions}</strong><span>Total intervention records</span></button>
          <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Unscored interventions', kind: 'outcome', group: 'unscored' })}><strong>{counts.unscored}</strong><span>Unscored · no automatic penalty</span></button>
        </div>
        <div className="cc-card"><h3>Purchase decision win rate</h3><p className="cc-muted">{rate.percent === null ? 'No scored phone outcomes in this range' : `${rate.percent}% recorded wins`}</p><p className="cc-muted">{counts.wins} wins out of {rate.scored} scored outcomes ({counts.wins} wins + {counts.losses} losses). {rate.excluded} missed or unscored records excluded.</p></div>
        {preset!=='all'&&<div className="cc-dashboard-cards">
          <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: 'Food entries', kind: 'food' })}><strong>{Math.round(ready.totals.calories).toLocaleString()}</strong><span>Est. calories logged · View food</span></button>
          <button className="cc-dashboard-card" onClick={() => setSelectedList({ title: `${ready.totals.currency || 'USD'} transactions`, kind: 'transaction', currency: ready.totals.currency })}><strong>{moneyPrefix}{ready.totals.spend.toFixed(2)}</strong><span>{ready.range.spendSource === 'Plaid posted outflows' ? 'Posted spend' : 'Logged spend'} · View transactions</span></button>
          {weightButton}
        </div>}
        {preset==='all'&&<button className="cc-dashboard-card" onClick={()=>setWeightOpen(true)}>Weight history · Open graph</button>}
        {preset!=='all'&&<div className="cc-dashboard-chart cc-card">
          <div className="cc-heading-row"><h3>{rangeLabel(preset)}</h3><span className="cc-muted cc-small">{ready.range.start} → {ready.range.end}</span></div>
          <div className="cc-chart-scales"><span>Calories · max {Math.round(scales.calorieMax).toLocaleString()} kcal</span><span>Spend · max {moneyPrefix}{scales.spendMax.toFixed(2)}</span></div>
          <div className="cc-bars" style={{ '--cc-days': ready.series.length } as React.CSSProperties} aria-label="Calories and spend by day">{ready.series.map((day, index) => <button key={day.date} className="cc-bar-day" aria-label={`${day.date}: ${day.calories} calories, ${moneyPrefix}${day.spend.toFixed(2)} spend. Open all entries.`} onClick={() => setSelectedList({ title: day.date, kind: 'day', date: day.date })}><span className="cc-bar-stack"><i style={{ height: `${scales.caloriePercent(day.calories)}%` }} /><b style={{ height: `${scales.spendPercent(day.spend)}%` }} /></span><small className={ready.series.length > 14 && index % 5 !== 0 && index !== ready.series.length - 1 ? 'cc-visually-hidden' : ''}>{day.date.slice(5)}</small></button>)}</div>
          <div className="cc-chart-legend"><span><i />Calories (kcal scale)</span><span><b />Spend ({ready.totals.currency || 'USD'} scale)</span></div>
        </div>}
        <div className="cc-dashboard-section"><div className="cc-heading-row"><h3>Signals in this range</h3><span className="cc-muted cc-small">{ready.entries.length} loaded</span></div>{ready.entries.slice(0, visibleCount).map(entry => <button className="cc-dashboard-entry" key={entry.id} onClick={() => setSelected(entry)}><span className="cc-dashboard-entry-icon">{entry.icon || '•'}</span><span><strong>{entry.title}</strong><small>{entryWhen(entry)} · {entry.body || entry.type}</small></span><ChevronRight size={17} /></button>)}{visibleCount < ready.entries.length && <button className="cc-secondary cc-dashboard-more" onClick={() => setVisibleCount(count => count + 20)}>Show more ({ready.entries.length - visibleCount} remaining)</button>}{!ready.entries.length && <p className="cc-muted">No entries in this range.</p>}</div>
        {ready.nextCursor&&<button className="cc-secondary" disabled={pageBusy} onClick={()=>void loadMore()}>{pageBusy?'Loading…':'Load older records'}</button>}
      </>}
      {partial && <p className="cc-muted cc-small cc-dashboard-coverage">{partial}</p>}
      <details className="cc-card"><summary>How these scores work</summary>
        <p className="cc-muted">This score covers purchase intervention calls only. Personal outcomes above have their own score; the two are not added together. Tap a total to see its entries.</p>
        <p className="cc-muted">Wins + losses + missed + unscored = total intervention records. Missed calls are never automatic losses. A recorded agreement to stop or your explicit update that you did not buy counts as a win. These are reported outcomes, not independently verified follow-through. Choose All time to include older records.</p>
        <h3>Data coverage</h3>
        <p className="cc-muted">{ready.totalCount??ready.entries.length} available records · {ready.entries.length} loaded. This describes the app’s evidence, not your health or behavior.</p>
        {ready.coverage&&<p className="cc-muted cc-small">{ready.coverage}</p>}
      </details>
    </>}
  </section>;
}

function SignalList({ title, entries, total, error, onBack, onSelect,hasMore,onMore,loadingMore }: { title: string; entries: DashboardEntry[]; total?: number; error?: string; onBack: () => void; onSelect: (entry: DashboardEntry) => void;hasMore?:boolean;onMore?:()=>void;loadingMore?:boolean }) {
  const [visibleCount, setVisibleCount] = useState(20);
  return <section className="cc-dashboard cc-dashboard-detail"><button className="cc-text-button" onClick={onBack}><ArrowLeft size={17} />Back to dashboard</button><span className="cc-eyebrow">DASHBOARD ENTRIES</span><h2>{title}</h2>{error && <p className="cc-error" role="alert">{error}</p>}{hasMore&&<button className="cc-secondary" disabled={loadingMore} onClick={onMore}>{loadingMore?'Loading…':'Load older records'}</button>}<p className="cc-muted">{entries.length}{total === undefined ? '' : ` of ${total}`} {entries.length === 1 && total === undefined ? 'entry' : 'entries'} loaded.{hasMore ? ' Load older records to see more matches in this selection.' : total !== undefined && entries.length < total ? ' Some matching records are outside this loaded feed. Choose All time on the dashboard to browse older records.' : ''}</p><div className="cc-dashboard-section">{entries.slice(0, visibleCount).map(entry => <button className="cc-dashboard-entry" key={entry.id} onClick={() => onSelect(entry)}><span className="cc-dashboard-entry-icon">{entry.icon || '•'}</span><span><strong>{entry.title}</strong><small>{entryWhen(entry)} · {entry.body || entry.type}</small></span><ChevronRight size={17} /></button>)}{!entries.length && <p className="cc-muted">{hasMore || (total !== undefined && total > 0) ? 'No matching entries are loaded yet.' : 'No entries in this selection.'}</p>}{visibleCount < entries.length && <button className="cc-secondary cc-dashboard-more" onClick={() => setVisibleCount(count => count + 20)}>Show more ({entries.length - visibleCount} remaining)</button>}</div></section>;
}

export function SignalDetail({ entry, onBack, backLabel = 'Back to dashboard', loadMeal, updateIntervention, onUpdated, onTalkAbout }: { entry: DashboardEntry; onBack: () => void; backLabel?: string; loadMeal?: (mealId: string) => Promise<FoodMeal>; updateIntervention?: InterventionUpdate; onUpdated?: () => void; onTalkAbout?: TalkAboutEntry }) {
  const mealId = entry.details?.mealId;
  const [meal, setMeal] = useState<FoodMeal | null>(null); const [mealError, setMealError] = useState('');
  const [note, setNote] = useState(''); const [bought, setBought] = useState<'yes' | 'no' | ''>('');
  const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState('');
  useEffect(() => { setMeal(null); setMealError(''); if (!mealId || !loadMeal) return; let current = true; void loadMeal(mealId).then(value => { if (current) setMeal(value); }).catch(error => { if (current) setMealError(error instanceof Error ? error.message : 'Meal details unavailable.'); }); return () => { current = false; }; }, [loadMeal, mealId]);
  const mealWarnings = meal ? [...(meal.lookupWarnings || []), ...(meal.warnings || [])] : [];
  const canUpdate = entry.type === 'intervention' && !!updateIntervention;
  const ownerUpdated = entry.details?.ownerUpdated === true;
  const missed = entry.details?.missed === true || /no[_ -]?answer|missed|voicemail/i.test(String(entry.details?.outcome || ''));
  const facts = signalFacts(entry);
  return <section className="cc-dashboard cc-dashboard-detail"><button className="cc-text-button" onClick={onBack}><ArrowLeft size={17} />{backLabel}</button><span className="cc-eyebrow">SIGNAL DETAIL</span><h2>{entry.icon || '•'} {entry.title}</h2>{facts.date && <p className="cc-muted">Date: {facts.date}{facts.time ? ` · ${facts.time}` : ''}</p>}{facts.category && <p className="cc-muted">Category: {facts.category}</p>}{facts.type && <p className="cc-muted">Type: {facts.type}</p>}{facts.source && <p className="cc-muted">Source: {facts.source}</p>}{facts.telegram && <p className="cc-muted">Telegram notice</p>}{facts.saved && <p className="cc-muted">{facts.saved}</p>}<div className="cc-card"><p className="cc-answer-text">{entry.body || 'No additional detail was provided.'}</p>{missed && <p className="cc-muted">Cupcake tried this call and did not get an answer.{ownerUpdated ? ' You later left an update.' : ' Leave a note below if you want the log to show that you followed up.'}</p>}{typeof entry.details?.summary === 'string' && entry.details.summary ? <p className="cc-muted">{entry.details.summary}</p> : null}{entry.amount != null && entry.type !== 'activity' && <strong>{transactionAmount(entry.amount, entry.currency)}</strong>}{entry.type === 'activity' && entry.amount != null && <><strong>{entry.amount} lb</strong><p className="cc-muted">{entry.details?.weightKind==='measurement' ? `${weightProvenanceLabel(entry.details.weightBasis,entry.details.source)} · ${String(entry.details.measuredAt || 'Time unavailable')}` : entry.details?.weightKind==='excluded' ? 'Excluded original; kept for reference and not included in the graph or totals.' : entry.details?.weightKind==='aggregate' ? 'Aggregate average; not an individual weigh-in.' : 'Measurement type or original time is unverified.'}</p></>}{entry.calories != null && <strong>{entry.calories.toLocaleString()} kcal</strong>}{entry.type==='food'&&!mealId&&<p className="cc-muted">This older entry has no saved item breakdown.{typeof entry.details?.notes==='string'&&entry.details.notes ? ` Original notes: ${entry.details.notes}` : ''}</p>}{facts.sourceUrl && <a className="cc-text-button" href={facts.sourceUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={15} /></a>}{mealId && <a className="cc-text-button" href={`/cupcake?tab=snap&meal=${encodeURIComponent(mealId)}`}>Open meal, original photo &amp; calendar <ArrowUpRight size={15}/></a>}{mealId && loadMeal && !meal && !mealError && <p className="cc-thinking"><Loader2 className="cc-spin" size={16} />Loading meal breakdown…</p>}{mealError && <p className="cc-muted">{mealError} This historical entry has no saved breakdown.</p>}{mealWarnings.map(warning => <p className="cc-muted" key={warning}>Estimate warning: {warning}</p>)}{meal && <div className="cc-meal-breakdown"><strong>Saved meal total: {meal.total?.calories == null ? 'Calories unknown' : `${meal.total.calories} kcal${meal.totalIsPartial ? ' (partial)' : ''}`}</strong>{meal.totalIsPartial && <small>Some items could not be identified, so this total is incomplete.</small>}{meal.items?.map(item => <div key={item.id}><span>{item.name}{item.quantity != null && item.quantity !== 1 ? ` × ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}</span><small>{item.nutrition?.calories == null ? 'Calories unknown' : `${item.nutrition.calories} kcal`} · {item.provenance || 'Estimate provenance unavailable'}</small>{item.calculation && <small>Calculation: {item.calculation}</small>}{item.variantWarning && <small>Estimate warning: {item.variantWarning}</small>}{item.sourceCitations?.length ? <small className="cc-meal-sources">Sources: {item.sourceCitations.map((source, index) => <span key={`${source.url}-${source.title}`}>{index > 0 && ', '}<a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={11} /></a></span>)}</small> : <small>Source link unavailable</small>}</div>)}</div>}{entry.type === 'intervention' && onTalkAbout && <button type="button" className="cc-primary" onClick={() => onTalkAbout(entry)}><Headphones size={18}/>Talk to Cupcake about this call</button>}{canUpdate && <form className="cc-intervention-note" onSubmit={event => {
    event.preventDefault(); if ((!note.trim() && bought === '') || saving || !updateIntervention) return;
    setSaving(true); setSaveError('');
    void updateIntervention(entry, note.trim(), bought === 'yes' ? true : bought === 'no' ? false : null)
      .then(() => onUpdated?.())
      .catch(error => setSaveError(error instanceof Error ? error.message : 'Could not save that update.'))
      .finally(() => setSaving(false));
  }}>
    <fieldset className="cc-bought" disabled={saving}><legend>Did you buy it anyway?</legend>
      <p className="cc-muted cc-small">No records a reported win. Yes records a reported loss. Not sure keeps the existing choice.</p>
      <label><input type="radio" name="boughtAnyway" value="no" checked={bought==='no'} onChange={() => setBought('no')} /> No</label>
      <label><input type="radio" name="boughtAnyway" value="yes" checked={bought==='yes'} onChange={() => setBought('yes')} /> Yes</label>
      <label><input type="radio" name="boughtAnyway" value="" checked={bought===''} onChange={() => setBought('')} /> Not sure</label>
    </fieldset>
    <label className="cc-label">Note (optional)<textarea value={note} disabled={saving} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Add any details you want Cupcake to remember." /></label>
    {saveError && <p className="cc-error" role="alert">{saveError}</p>}
    {!note.trim() && bought === '' && <p className="cc-muted cc-small">Choose Yes or No to save without a note.</p>}
    <button className="cc-primary" disabled={saving || (!note.trim() && bought === '')}>{saving ? 'Saving…' : 'Update Cupcake'}</button>
  </form>}</div></section>;
}
