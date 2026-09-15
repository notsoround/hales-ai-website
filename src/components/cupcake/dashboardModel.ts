export type DashboardMetricDay = { date: string; calories: number; spend: number };
export type DatedEntry = { date: string; type: string; currency?: string | null };
export type DashboardOutcome = 'win' | 'loss' | 'unscored';
type OutcomeEntry = DatedEntry & { details?: { outcome?: unknown; boughtAnyway?: unknown } };

export function entriesForDay<T extends DatedEntry>(entries: T[], date: string): T[] {
  return entries.filter(entry => entry.date === date);
}

export function entriesForType<T extends DatedEntry>(entries: T[], type: 'food' | 'transaction'): T[] {
  return entries.filter(entry => entry.type === type);
}

/** Keep the spend drilldown on the same currency population as its total. */
export function transactionEntriesForCurrency<T extends DatedEntry>(entries: T[], currency?: string): T[] {
  const target = currency === '$' ? 'USD' : currency?.trim().toUpperCase();
  const transactions = entriesForType(entries, 'transaction');
  return target ? transactions.filter(entry => entry.currency?.trim().toUpperCase() === target) : transactions;
}

export function transactionAmount(amount: number, currency?: string | null): string {
  const code = currency?.trim().toUpperCase();
  return `${code && /^[A-Z]{3}$/.test(code) ? code : 'Currency unknown'} ${amount.toFixed(2)}`;
}

/** Interventions are kept separate from meals/spend so outcome cards never inflate totals. */
export function interventionEntries<T extends OutcomeEntry>(entries: T[]): T[] {
  return entries.filter(entry => entry.type === 'intervention');
}

/** Classifies only recorded evidence. A bought-anyway flag takes precedence over the call outcome. */
export function interventionOutcome(entry: OutcomeEntry): DashboardOutcome {
  if (entry.details?.boughtAnyway === true) return 'loss';
  const outcome = String(entry.details?.outcome || '').trim().toLowerCase().replace(/[ -]/g, '_');
  if (['agreed_to_stop', 'agreed', 'put_back', 'stopped'].includes(outcome)) return 'win';
  return 'unscored';
}

export function interventionGroups<T extends OutcomeEntry>(entries: T[]) {
  const interventions = interventionEntries(entries);
  return {
    interventions,
    wins: interventions.filter(entry => interventionOutcome(entry) === 'win'),
    losses: interventions.filter(entry => interventionOutcome(entry) === 'loss'),
    unscored: interventions.filter(entry => interventionOutcome(entry) === 'unscored'),
  };
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
