export type DashboardMetricDay = { date: string; calories: number; spend: number };
export type DatedEntry = { date: string; type: string };

export function entriesForDay<T extends DatedEntry>(entries: T[], date: string): T[] {
  return entries.filter(entry => entry.date === date);
}

export function entriesForType<T extends DatedEntry>(entries: T[], type: 'food' | 'transaction'): T[] {
  return entries.filter(entry => entry.type === type);
}

export function metricScales(series: DashboardMetricDay[]) {
  const calorieMax = Math.max(0, ...series.map(day => Math.max(0, day.calories)));
  const spendMax = Math.max(0, ...series.map(day => Math.max(0, day.spend)));
  return {
    calorieMax,
    spendMax,
    caloriePercent: (value: number) => calorieMax > 0 && value > 0 ? Math.min(100, value / calorieMax * 100) : 0,
    spendPercent: (value: number) => spendMax > 0 && value > 0 ? Math.min(100, value / spendMax * 100) : 0,
  };
}

export function rangeLabel(preset: 'day' | 'week' | 'month' | 'custom') {
  return preset === 'day' ? 'Day' : preset === 'week' ? 'Last 7 days' : preset === 'month' ? 'Last 30 days' : 'Custom';
}
