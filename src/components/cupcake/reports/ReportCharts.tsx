/** Charts and the at-a-glance header for a shared health report, drawn with the Noir chart kit. */
import type { ReactNode } from 'react';
import { BarChart, TrendChart, type Bar, type OnChartScrub } from '../noir/NoirCharts';
import { barAxis, byDate, calories, dayTime, list, num, shortDate, shortTime, timeAxis, whole, type Insight, type Row } from './reportModel';
import './reports.css';

export function ReportGlance({ insight }: { insight: Insight }) {
  return <div className="cc-rep-glance">
    <p className="cc-rep-headline">{insight.headline}</p>
    {insight.details.length > 0 && <p className="cc-rep-details">{insight.details.join(' · ')}</p>}
    <dl className="cc-rep-kpis">
      {insight.kpis.map(kpi => <div key={kpi.key} className="cc-rep-kpi" data-kpi={kpi.key}>
        <dt>{kpi.label}</dt>
        <dd><span className="cc-rep-num">{kpi.value ?? '—'}</span>{kpi.value !== null && <span className="cc-rep-unit">{kpi.unit}</span>}</dd>
        <dd className="cc-rep-kpi-note">{kpi.note}</dd>
      </div>)}
    </dl>
  </div>;
}

const range = (dates: string[]) => dates.length ? `${shortDate(dates[0]!)} to ${shortDate(dates[dates.length - 1]!)}` : '';

/** One bar per calendar day; days without a row stay a faint stub ("Not logged"), never zero. */
export function DailyBars({ dates, rows, value, unit, label, title, format, onScrub }: {
  dates: string[]; rows: Row[]; value: (row: Row) => number | null; unit: string; label: string; title?: (row: Row) => string | undefined; format?: (v: number) => string; onScrub?: OnChartScrub;
}) {
  const map = byDate(rows);
  const bars: Bar[] = dates.map(date => { const row = map.get(date); return { key: date, label: shortDate(date), value: row ? value(row) : null, title: row ? title?.(row) ?? shortDate(date) : shortDate(date) }; });
  const known = bars.filter(bar => bar.value !== null) as (Bar & { value: number })[];
  const mean = known.length ? known.reduce((sum, bar) => sum + bar.value, 0) / known.length : null;
  const spoken = `${label}, ${range(dates)}: ${known.length} of ${dates.length} days with a value${mean === null ? '' : `, average ${format ? format(mean) : whole(mean)} ${unit}`}. Use the arrow keys to read each day.`;
  return <BarChart bars={bars} unit={unit} axis={barAxis(dates)} label={spoken} height={160} formatValue={format} className="cc-rep-chart" onScrub={onScrub} />;
}

export function WeightTrend({ dates, weight, onScrub }: { dates: string[]; weight: Row; onScrub?: OnChartScrub }) {
  const points = list(weight.daily).flatMap(row => { const v = num(row.meanLb); return typeof row.date === 'string' && v !== null ? [{ t: dayTime(row.date), v, label: `${shortDate(row.date)} · daily mean` }] : []; });
  if (!points.length) return null;
  const latest = points[points.length - 1]!;
  return <TrendChart onScrub={onScrub} points={points} unit="lb" axisTimes={timeAxis(dates)} formatTime={shortTime} height={180} className="cc-rep-chart"
    label={`Weight daily mean, ${range(dates)}: ${points.length} days with readings, latest ${latest.v.toFixed(1)} lb. Use the arrow keys to read each day.`} />;
}

/** Manual glucose as plain daily-mean points over a 70–140 mg/dL reference band. */
export function GlucosePoints({ dates, glucose, onScrub }: { dates: string[]; glucose: Row; onScrub?: OnChartScrub }) {
  const points = list(glucose.daily).flatMap(row => { const v = num(row.meanMgDl); return typeof row.date === 'string' && v !== null ? [{ t: dayTime(row.date), v, label: `${shortDate(row.date)} · mean of ${num(row.samples) ?? '?'}` }] : []; });
  if (!points.length) return null;
  return <TrendChart onScrub={onScrub} points={points} unit="mg/dL" band={[70, 140]} axisTimes={timeAxis(dates)} formatTime={shortTime} formatValue={v => v.toFixed(0)} height={170} tone="a2" className="cc-rep-chart cc-rep-points"
    label={`Manual glucose daily mean, ${range(dates)}: ${points.length} days with readings, shaded band 70 to 140 mg/dL. Use the arrow keys to read each day.`} />;
}

export function NutritionBars({ dates, nutrition, onScrub }: { dates: string[]; nutrition: Row; onScrub?: OnChartScrub }) {
  return <DailyBars onScrub={onScrub} dates={dates} rows={list(nutrition.daily)} value={calories} unit="kcal" label="Calories from confirmed meals"
    title={row => { const partial = num(row.partialMeals) ?? 0; return `${shortDate(String(row.date))} · ${num(row.confirmedMeals) ?? 0} meals${partial ? `, ${partial} partial` : ''}`; }} />;
}

export function ExerciseBars({ dates, exercise, onScrub }: { dates: string[]; exercise: Row; onScrub?: OnChartScrub }) {
  const rows = list(exercise.daily), anyMinutes = rows.some(row => num(row.minutes) !== null);
  const title = (row: Row) => { const missing = num(row.missingDurationEntries) ?? 0; return `${shortDate(String(row.date))} · ${num(row.entries) ?? 0} entr${num(row.entries) === 1 ? 'y' : 'ies'}${missing ? `, ${missing} without duration` : ''}`; };
  return anyMinutes
    ? <DailyBars onScrub={onScrub} dates={dates} rows={rows} value={row => num(row.minutes)} unit="min" label="Exercise minutes with a known duration" title={title} />
    : <DailyBars onScrub={onScrub} dates={dates} rows={rows} value={row => num(row.energyKcal)} unit="est. kcal" label="Estimated exercise energy" title={title} />;
}

export function SleepBars({ dates, nights, onScrub }: { dates: string[]; nights: Row[]; onScrub?: OnChartScrub }) {
  return <DailyBars onScrub={onScrub} dates={dates} rows={nights} value={row => { const m = num(row.asleepMinutes); return m === null ? null : m / 60; }} unit="h asleep" label="RingConn time asleep" format={v => v.toFixed(1)} />;
}

/** A small row of figures, for sections that read better as numbers than as a chart. */
export function Figures({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="cc-rep-figures">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
