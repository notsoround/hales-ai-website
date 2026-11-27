import { addDays, nutritionDayStart } from './nutritionModel.ts';
// Daily Health Connect / Apple Health / multi-device steps from the private library (owner-only steps_list).
// Multi-device uploads report the daily maximum across sources (never summed across phones).
// Until the library supports steps_list every call reports `unavailable`.
import type { LibraryRequest } from './glucoseApi';
import { isUnknownAction } from './exerciseApi.ts';

export const DAILY_STEP_GOAL = 8000;

export type StepsSourceSample = { source: string; count: number };

export type StepsDay = {
  date: string;
  count: number;
  windowBasis: string;
  windowStart?: string;
  windowEnd?: string;
  source: string;
  winningSource?: string;
  sourcesCount?: number;
  updatedAt?: string;
  sources?: StepsSourceSample[];
};

export class StepsUnavailableError extends Error {
  constructor() { super('Steps are not available from the library yet.'); this.name = 'StepsUnavailableError'; }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseSources(value: unknown): StepsSourceSample[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: StepsSourceSample[] = [];
  for (const item of value) {
    if (!record(item)) continue;
    const source = nonEmptyString(item.source);
    const count = item.count;
    if (!source || typeof count !== 'number' || !Number.isFinite(count) || count < 0 || count > 100000) continue;
    out.push({ source, count: Math.round(count) });
  }
  return out.length ? out : undefined;
}

export function parseStepsDay(value: unknown): StepsDay | null {
  if (!record(value) || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
  const count = value.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100000) return null;
  const source = nonEmptyString(value.source) ?? 'health_connect';
  const winningSource = nonEmptyString(value.winningSource);
  const sourcesCount = typeof value.sourcesCount === 'number' && Number.isInteger(value.sourcesCount) && value.sourcesCount >= 1
    ? value.sourcesCount
    : undefined;
  const updatedAt = nonEmptyString(value.updatedAt) ?? nonEmptyString(value.capturedAt) ?? nonEmptyString(value.receivedAt);
  const sources = parseSources(value.sources);
  const windowStart = nonEmptyString(value.windowStart);
  const windowEnd = nonEmptyString(value.windowEnd);
  return {
    date: value.date,
    count,
    windowBasis: typeof value.windowBasis === 'string' ? value.windowBasis : 'unknown',
    source,
    ...(windowStart ? { windowStart } : {}),
    ...(windowEnd ? { windowEnd } : {}),
    ...(winningSource ? { winningSource } : {}),
    ...(sourcesCount !== undefined ? { sourcesCount } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(sources ? { sources } : {}),
  };
}

/** All uploaded days in [start, end] (YYYY-MM-DD, Chicago days), sorted newest first. */
export async function stepsHistory(request: LibraryRequest, start: string, end: string) {
  let data: { entries?: unknown; averageSource?: string };
  try { data = await request<typeof data>({ action: 'steps_list', start, end }); }
  catch (error) { if (isUnknownAction(error)) throw new StepsUnavailableError(); throw error; }
  const days = (Array.isArray(data.entries) ? data.entries : []).map(parseStepsDay).filter((d): d is StepsDay => d !== null);
  days.sort((a, b) => b.date.localeCompare(a.date));
  return { days, phoneAverage: data.averageSource === 'galaxy_a55' || days.some(day => day.source === 'galaxy_a55') };
}

export async function listStepsDays(request: LibraryRequest, start: string, end: string): Promise<StepsDay[]> {
  return (await stepsHistory(request, start, end)).days;
}

/** Require both Chicago midnights, including the 23- or 25-hour day across DST. */
export function isCompleteA55Day(day: StepsDay): boolean {
  return day.source === 'galaxy_a55' && day.windowBasis === 'calendar_day'
    && Date.parse(day.windowStart ?? '') === nutritionDayStart(day.date)
    && Date.parse(day.windowEnd ?? '') === nutritionDayStart(addDays(day.date, 1));
}

/** Newest uploaded day in [start, end] (YYYY-MM-DD, Chicago days), or null. */
export async function latestSteps(request: LibraryRequest, start: string, end: string): Promise<StepsDay | null> {
  const days = await listStepsDays(request, start, end);
  return days[0] || null;
}

/** "Mon, Oct 19" for a YYYY-MM-DD day. */
export function stepsDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}

/** Human-friendly display label for a steps source identifier. */
export function stepsSourceLabel(source?: string): string {
  const raw = (source || '').trim();
  if (!raw) return 'Device sync';
  const low = raw.toLowerCase();
  if (low === 'apple_health' || low.includes('apple')) return 'Apple Health';
  if (low.includes('shealth') || low.includes('samsung')) return 'Samsung Health';
  if (low.includes('google.android.apps.fitness') || low.includes('google_fit')) return 'Google Fit';
  if (low.includes('ringconn')) return 'RingConn';
  if (low.includes('fitbit')) return 'Fitbit';
  if (low.includes('garmin')) return 'Garmin';
  if (low.includes('whoop')) return 'WHOOP';
  if (low === 'health_connect') return 'Health Connect';
  if (low === 'phone_daily') return 'Phone sync';
  if (low.startsWith('native_health:')) {
    const pkg = raw.slice('native_health:'.length).trim();
    const parts = pkg.split('.').filter(Boolean);
    const tail = parts[parts.length - 1];
    if (tail && tail.length >= 2) return tail.charAt(0).toUpperCase() + tail.slice(1);
    return 'Health Connect';
  }
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

/** Concise last-updated label for a steps record (e.g. "Updated 12m ago", "Updated today", or "Mon, Oct 19"). */
export function stepsUpdatedLabel(day: Pick<StepsDay, 'date' | 'updatedAt'> | null | undefined, nowMs = Date.now()): string {
  if (!day) return '';
  if (day.updatedAt) {
    const ms = Date.parse(day.updatedAt);
    if (Number.isFinite(ms)) {
      const diffMin = Math.max(0, Math.round((nowMs - ms) / 60000));
      if (diffMin < 2) return 'Updated just now';
      if (diffMin < 60) return `Updated ${diffMin}m ago`;
      if (diffMin < 24 * 60) return `Updated ${Math.round(diffMin / 60)}h ago`;
      return `Updated ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' }).format(new Date(ms))}`;
    }
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
  if (day.date === today) return 'Synced today';
  return stepsDayLabel(day.date);
}

/** Concise provenance summary for a multi-device steps record (e.g. "Samsung Health · higher of 2 devices"). */
export function stepsSourceSummary(day: StepsDay): string {
  const winner = stepsSourceLabel(day.winningSource || day.source);
  if (day.sourcesCount && day.sourcesCount > 1) return `${winner} · max of ${day.sourcesCount} devices`;
  return winner;
}

/** Explain what the selected daily reading actually covers, including older rolling reports. */
export function stepsWindowLabel(day: StepsDay): string | null {
  if (day.windowBasis === 'calendar_day') return 'Calendar day · Chicago time';
  if (day.windowBasis === 'reported_past_day_snapshot') return 'Reported past-day snapshot';
  if (day.windowBasis !== 'trailing_24h_previous_day') return null;
  const start = Date.parse(day.windowStart ?? ''), end = Date.parse(day.windowEnd ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'Rolling 24-hour count';
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return `Rolling 24 hours · ${format.format(start)} – ${format.format(end)} CT`;
}
