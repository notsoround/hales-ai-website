// Daily Health Connect steps from the private library (owner-only steps_list).
// Tasker uploads one count per local day; the newest day with a count is shown.
// Until the library supports steps_list every call reports `unavailable`.
import type { LibraryRequest } from './glucoseApi';
import { isUnknownAction } from './exerciseApi.ts';

export type StepsDay = { date: string; count: number; windowBasis: string; source: string };
export class StepsUnavailableError extends Error {
  constructor() { super('Steps are not available from the library yet.'); this.name = 'StepsUnavailableError'; }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseStepsDay(value: unknown): StepsDay | null {
  if (!record(value) || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
  const count = value.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100000) return null;
  return { date: value.date, count, windowBasis: typeof value.windowBasis === 'string' ? value.windowBasis : 'calendar_day', source: typeof value.source === 'string' ? value.source : 'health_connect' };
}

/** Newest uploaded day in [start, end] (YYYY-MM-DD, Chicago days), or null. */
export async function latestSteps(request: LibraryRequest, start: string, end: string): Promise<StepsDay | null> {
  let data: { entries?: unknown };
  try { data = await request<{ entries?: unknown }>({ action: 'steps_list', start, end }); }
  catch (error) { if (isUnknownAction(error)) throw new StepsUnavailableError(); throw error; }
  const days = (Array.isArray(data.entries) ? data.entries : []).map(parseStepsDay).filter((d): d is StepsDay => d !== null);
  return days.sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

/** "Mon, Oct 19" for a YYYY-MM-DD day. */
export function stepsDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}
