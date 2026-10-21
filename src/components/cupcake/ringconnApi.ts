// RingConn nightly summaries from the private library (owner-only ringconn_night_list).
// Tasker uploads one bundle per morning (RingConn → Health Connect); values are provider
// estimates. Missing values stay null; nothing here fills or recomputes them.
import type { LibraryRequest } from './glucoseApi';
import { isUnknownAction } from './exerciseApi.ts';

export type RingconnNight = {
  nightId: string; capturedAt: string; asleepMinutes: number | null; sessionMinutes: number | null;
  avgHeartRate: number | null; restingHeartRate: number | null; spo2Mean: number | null; spo2Min: number | null;
  complete: boolean; failed: string[];
};
export class RingconnUnavailableError extends Error {
  constructor() { super('RingConn nights are not available from the library yet.'); this.name = 'RingconnUnavailableError'; }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const field = (parent: unknown, key: string): unknown => record(parent) ? parent[key] : undefined;

export function parseRingconnNight(value: unknown): RingconnNight | null {
  if (!record(value) || typeof value.night_id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.night_id) || typeof value.captured_at !== 'string') return null;
  const m = value.metrics, sleep = field(m, 'sleep'), types = field(value.coverage, 'types');
  return {
    nightId: value.night_id, capturedAt: value.captured_at,
    asleepMinutes: num(field(sleep, 'asleep_minutes')), sessionMinutes: num(field(sleep, 'session_duration_minutes')),
    avgHeartRate: num(field(field(m, 'average_heart_rate'), 'value_bpm')), restingHeartRate: num(field(field(m, 'resting_heart_rate'), 'value_bpm')),
    spo2Mean: num(field(field(m, 'spo2'), 'mean_percent')), spo2Min: num(field(field(m, 'spo2'), 'min_percent')),
    complete: field(value.coverage, 'all_reads_complete') === true,
    failed: record(types) ? Object.entries(types).filter(([, c]) => field(c, 'status') === 'read_error').map(([k]) => k) : [],
  };
}

/** Newest uploaded night in [start, end] (YYYY-MM-DD morning dates), or null. */
export async function latestRingconnNight(request: LibraryRequest, start: string, end: string): Promise<RingconnNight | null> {
  let data: { entries?: unknown };
  try { data = await request<{ entries?: unknown }>({ action: 'ringconn_night_list', start, end }); }
  catch (error) { if (isUnknownAction(error)) throw new RingconnUnavailableError(); throw error; }
  const nights = (Array.isArray(data.entries) ? data.entries : []).map(parseRingconnNight).filter((n): n is RingconnNight => n !== null);
  return nights.sort((a, b) => b.nightId.localeCompare(a.nightId))[0] || null;
}

export function hoursMinutes(minutes: number): string {
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} m`;
}

/** One-line summary of the measurable values, e.g. "Asleep 6 h 37 m · resting HR 55 · SpO₂ 96% (min 91)". */
export function nightSummary(n: RingconnNight): string {
  const parts = [n.asleepMinutes !== null ? `Asleep ${hoursMinutes(n.asleepMinutes)}${n.sessionMinutes !== null ? ` of ${hoursMinutes(n.sessionMinutes)}` : ''}`
    : n.sessionMinutes !== null ? `Session ${hoursMinutes(n.sessionMinutes)} (no stages)` : 'No sleep session'];
  if (n.restingHeartRate !== null) parts.push(`resting HR ${Math.round(n.restingHeartRate)}`);
  if (n.avgHeartRate !== null) parts.push(`avg HR ${Math.round(n.avgHeartRate)}`);
  if (n.spo2Mean !== null) parts.push(`SpO₂ ${Math.round(n.spo2Mean)}%${n.spo2Min !== null ? ` (min ${Math.round(n.spo2Min)})` : ''}`);
  return parts.join(' · ');
}
