/** Pure helpers for the coach Reports screen: dates, plain-language headline and the four KPI tiles.
 *  Every sentence is derived from numbers the report actually contains; missing data stays unknown, never zero. */
export type Row = Record<string, unknown>;

export const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
export const rec = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
export const list = (value: unknown): Row[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const dayTime = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const shortDate = (iso: string) => new Date(dayTime(iso)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
export const shortTime = (t: number) => new Date(t).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
export const whole = (value: number) => Math.round(value).toLocaleString('en-US');
export const signed = (value: number, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}`;

/** Every calendar day of the period, oldest first. */
export function periodDates(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = dayTime(start), last = dayTime(end); Number.isFinite(t) && t <= last && out.length < 400; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Three date labels (first, middle, last) for a bar axis. */
export const barAxis = (dates: string[]) => {
  if (!dates.length) return [];
  const picks = dates.length < 3 ? [0, dates.length - 1] : [0, Math.floor((dates.length - 1) / 2), dates.length - 1];
  return [...new Set(picks)].map(index => ({ index, label: shortDate(dates[index]!) }));
};
export const timeAxis = (dates: string[]) => barAxis(dates).map(({ index, label }) => ({ t: dayTime(dates[index]!), label }));

/** Rows keyed by their date, keeping only well-formed days. */
export function byDate(rows: Row[]) {
  const map = new Map<string, Row>();
  for (const row of rows) if (isDay(row.date)) map.set(row.date, row);
  return map;
}

export const calories = (row: Row) => num(rec(rec(row.knownTotals).calories).sum);
export const foodDays = (nutrition: Row | null) => list(nutrition?.daily).filter(row => isDay(row.date) && (num(row.confirmedMeals) ?? 0) > 0);
export const stepDays = (steps: Row | null) => list(steps?.daily).filter(row => isDay(row.date) && num(row.count) !== null);
export const exerciseDays = (exercise: Row | null) => list(exercise?.daily).filter(row => isDay(row.date) && (num(row.entries) ?? 0) > 0);

export type Kpi = { key: string; label: string; value: string | null; unit: string; note: string };
export type Insight = { headline: string; details: string[]; kpis: Kpi[] };

/** Plain-language summary and KPI tiles for one report. */
export function summarize(data: Record<string, Row | null>, dates: string[]): Insight {
  const total = dates.length, details: string[] = [];
  let headline = '';
  // Weight: first-to-latest change across the readings actually saved.
  const weight = data.weight, weightDays = list(weight?.daily).filter(row => isDay(row.date) && num(row.meanLb) !== null);
  const latest = num(weight?.latestLb), change = num(weight?.changeLb), samples = num(weight?.samples) ?? 0;
  const firstDay = weightDays[0]?.date as string | undefined, lastDay = weightDays[weightDays.length - 1]?.date as string | undefined;
  const span = firstDay && lastDay ? Math.round((dayTime(lastDay) - dayTime(firstDay)) / 86400000) : 0;
  if (change !== null && samples >= 2) {
    const over = span >= 1 ? ` over ${span} day${span === 1 ? '' : 's'}` : ` across ${samples} readings`;
    headline = Math.abs(change) < 0.1 ? `Weight steady${over}` : `${change < 0 ? 'Down' : 'Up'} ${Math.abs(change).toFixed(1)} lb${over}`;
  }
  // Food: days with at least one confirmed meal.
  const food = foodDays(data.nutrition), foodLine = `Food logged ${food.length} of ${total} days`;
  if (data.nutrition) { if (headline) details.push(foodLine); else headline = foodLine; }
  // Steps: mean over the days that have a count.
  const steps = stepDays(data.steps), stepMean = steps.length ? steps.reduce((sum, row) => sum + (num(row.count) ?? 0), 0) / steps.length : null;
  if (stepMean !== null) {
    const line = `Steps averaged ${whole(stepMean)} on ${steps.length} day${steps.length === 1 ? '' : 's'} with data`;
    if (headline) details.push(line); else headline = line;
  }
  const active = exerciseDays(data.exercise);
  if (active.length) { const line = `Exercise logged on ${active.length} of ${total} days`; if (headline) details.push(line); else headline = line; }
  if (!headline) headline = 'No saved entries in this period';

  const kcalDays = food.map(calories).filter((value): value is number => value !== null);
  const kcalMean = kcalDays.length ? kcalDays.reduce((a, b) => a + b, 0) / kcalDays.length : null;
  const partial = food.some(row => (num(row.partialMeals) ?? 0) > 0 || (num(rec(rec(row.knownTotals).calories).missingMeals) ?? 0) > 0);
  const kpis: Kpi[] = [
    { key: 'weight', label: 'Weight', value: latest === null ? null : latest.toFixed(1), unit: 'lb',
      note: latest === null ? 'Not saved this period' : change !== null && firstDay ? `${signed(change)} lb since ${shortDate(firstDay)}` : `${samples || 1} reading${samples === 1 ? '' : 's'}` },
    { key: 'calories', label: 'Calories', value: kcalMean === null ? null : whole(kcalMean), unit: 'kcal / day',
      note: kcalMean === null ? 'No confirmed meals' : `Known values, ${kcalDays.length} logged day${kcalDays.length === 1 ? '' : 's'}${partial ? ' · some partial' : ''}` },
    { key: 'logged', label: 'Days logged', value: data.nutrition ? String(food.length) : null, unit: `of ${total}`,
      note: data.nutrition ? 'Days with confirmed meals' : 'No confirmed meals' },
    stepMean !== null || !active.length
      ? { key: 'steps', label: 'Steps', value: stepMean === null ? null : whole(stepMean), unit: 'avg / day', note: stepMean === null ? 'Not saved this period' : `${steps.length} day${steps.length === 1 ? '' : 's'} with data` }
      : { key: 'active', label: 'Active days', value: String(active.length), unit: `of ${total}`, note: 'Days with exercise' },
  ];
  return { headline, details, kpis };
}
