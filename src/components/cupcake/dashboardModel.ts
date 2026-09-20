export type DashboardMetricDay = { date: string; calories: number; spend: number };
export type DatedEntry = { date: string; type: string; currency?: string | null };
export type DashboardOutcome = 'win' | 'loss' | 'missed' | 'unscored';
type OutcomeEntry = DatedEntry & { details?: { outcome?: unknown; boughtAnyway?: unknown; missed?: unknown; ownerUpdated?: unknown } };

function missedCall(entry: OutcomeEntry): boolean {
  if (entry.details?.missed === true) return true;
  return /no[_ -]?answer|missed|voicemail|did not answer|customer-did-not-answer|silence-timed-out|busy|no-answer/i.test(String(entry.details?.outcome || ''));
}

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
  if (missedCall(entry) && entry.details?.boughtAnyway !== false) return 'missed';
  return 'unscored';
}

export function interventionGroups<T extends OutcomeEntry>(entries: T[]) {
  const interventions = interventionEntries(entries);
  return {
    interventions,
    wins: interventions.filter(entry => interventionOutcome(entry) === 'win'),
    losses: interventions.filter(entry => interventionOutcome(entry) === 'loss'),
    missed: interventions.filter(entry => interventionOutcome(entry) === 'missed'),
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

export function rangeLabel(preset: 'day' | 'week' | 'month' | 'custom' | 'all') {
  return preset === 'all' ? 'All time' : preset === 'day' ? 'Day' : preset === 'week' ? 'Last 7 days' : preset === 'month' ? 'Last 30 days' : 'Custom';
}

export const TALK_SEED_KEY = 'cupcake-talk-seed-v1';

type TalkSeedEntry = {
  id: string;
  date: string;
  time?: string;
  title: string;
  body?: string;
  details?: { merchant?: unknown; outcome?: unknown; summary?: unknown; missed?: unknown; ownerUpdated?: unknown };
};

const clip = (value: unknown, limit: number) => String(value || '').replace(/\0/g, '').trim().slice(0, limit);

/** Builds Talk continuation context from a logged call. User/assistant lines only. */
export function talkSeedFromIntervention(entry: TalkSeedEntry) {
  const merchant = clip(entry.details?.merchant || String(entry.title || '').replace(/^Intervention:\s*/i, '') || 'that stop', 80);
  const when = clip([entry.date, entry.time].filter(Boolean).join(' '), 80);
  const outcome = clip(entry.details?.outcome, 80);
  const summary = clip(entry.details?.summary || entry.body, 500);
  const missed = entry.details?.missed === true || missedCall({ date: entry.date, type: 'intervention', details: entry.details });
  const text = clip([
    missed
      ? `I called Matt at ${when || 'an earlier time'} about ${merchant} and did not get an answer.`
      : `I called Matt at ${when || 'an earlier time'} about ${merchant}.`,
    outcome ? `The phone-bot log recorded this outcome: ${outcome}.` : '',
    summary ? `What I had at the time: ${summary}` : '',
    'Matt is opening Talk to tell me what was going on and what he wants me to remember about this exact call. Stay with this merchant and timestamp. Do not invent other calls or outcomes.',
  ].filter(Boolean).join(' '), 2000);
  const startedAt = `${entry.date || '2026-01-01'}T12:00:00.000Z`;
  return {
    id: clip(`intervention-seed-${entry.id}`, 80),
    title: clip(`${missed ? 'Missed call' : 'Phone call'} · ${merchant}`, 120),
    startedAt,
    endedAt: startedAt,
    lines: [{ role: 'Cupcake' as const, text }],
  };
}
