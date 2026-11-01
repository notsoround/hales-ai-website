// Server-side exercise log in the private library (owner-only actions
// exercise_log / exercise_list / exercise_delete). Until the library is
// deployed with those actions, every call reports `unavailable` and nothing is
// stored anywhere else: no localStorage fallback, no invented entries.
import type { LibraryRequest } from './glucoseApi';
import type { ExerciseEstimateItem } from './exerciseEstimate';

/** Structured strength detail as stored: reps are per set, load in kg (shown in lb), holds in seconds, `side: 'each'` = both sides, `scheme` = pyramid like "5/3/1". */
export type ExerciseItem = { activity: string; sets?: number; reps?: number; loadKg?: number; minutes?: number; holdSeconds?: number; side?: 'each'; scheme?: string };
export type ExerciseEntry = { id: string; description: string; performedAt: string; at: number; minutes: number; kcal: number; basis: string; items: ExerciseItem[] };
export type ExerciseInput = { requestId: string; description: string; performedAt: string; minutes: number; kcal: number; basis: string; items?: ExerciseItem[] };
export const MAX_EXERCISE_ITEMS = 20;
export class ExerciseUnavailableError extends Error {
  constructor() { super('Exercise storage is not available yet. Nothing was saved.'); this.name = 'ExerciseUnavailableError'; }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** The deployed library rejects actions it does not know with "Unknown library action". */
export function isUnknownAction(error: unknown): boolean {
  return error instanceof Error && /unknown (library )?action/i.test(error.message);
}

export function parseExerciseEntry(value: unknown): ExerciseEntry | null {
  if (!record(value) || typeof value.id !== 'string' || typeof value.description !== 'string' || typeof value.performedAt !== 'string') return null;
  const at = Date.parse(value.performedAt);
  const kcal = typeof value.kcal === 'number' ? value.kcal : NaN;
  const minutes = typeof value.minutes === 'number' ? value.minutes : 0;
  if (!Number.isFinite(at) || !Number.isFinite(kcal) || kcal < 0) return null;
  return { id: value.id, description: value.description, performedAt: value.performedAt, at, minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0, kcal: Math.round(kcal), basis: typeof value.basis === 'string' ? value.basis : '', items: parseItems(value.items) };
}

const positive = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;
function parseItems(value: unknown): ExerciseItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): ExerciseItem[] => {
    if (!record(raw) || typeof raw.activity !== 'string' || !raw.activity.trim()) return [];
    return [{ activity: raw.activity.trim().slice(0, 60), ...(positive(raw.sets, 50) ? { sets: Math.round(raw.sets) } : {}), ...(positive(raw.reps, 1000) ? { reps: Math.round(raw.reps) } : {}),
      ...(positive(raw.loadKg, 500) ? { loadKg: raw.loadKg } : {}), ...(positive(raw.minutes, 1440) ? { minutes: raw.minutes } : {}),
      ...(positive(raw.holdSeconds, 600) ? { holdSeconds: Math.round(raw.holdSeconds) } : {}), ...(raw.side === 'each' ? { side: 'each' as const } : {}),
      ...(typeof raw.scheme === 'string' && SCHEME.test(raw.scheme) ? { scheme: raw.scheme } : {}) }];
  }).slice(0, MAX_EXERCISE_ITEMS);
}

export const SCHEME = /^\d{1,3}(?:\/\d{1,3}){0,9}$/;
/** Estimator items -> the bounded shape the library stores (reps per set, kg to 2 dp). */
export function toStoredItems(items: readonly ExerciseEstimateItem[]): ExerciseItem[] {
  return items.slice(0, MAX_EXERCISE_ITEMS).map(item => {
    const sets = item.reps !== undefined || item.holdSeconds !== undefined || item.sets !== undefined ? Math.max(1, item.sets ?? 1) : undefined;
    const reps = item.reps !== undefined && sets && !item.scheme ? Math.max(1, Math.round(item.reps / sets)) : undefined;
    return { activity: (item.name || item.activity).slice(0, 60), ...(sets && sets <= 50 ? { sets } : {}), ...(reps && reps <= 1000 ? { reps } : {}),
      ...(item.scheme && SCHEME.test(item.scheme) ? { scheme: item.scheme } : {}),
      ...(item.holdSeconds && item.holdSeconds <= 600 ? { holdSeconds: Math.round(item.holdSeconds) } : {}), ...(item.side === 'each' ? { side: 'each' as const } : {}),
      ...(item.loadKg !== undefined && item.loadKg > 0 && item.loadKg <= 500 ? { loadKg: Math.round(item.loadKg * 100) / 100 } : {}),
      ...(item.minutes > 0 ? { minutes: Math.round(Math.min(item.minutes, 1440) * 10) / 10 } : {}) };
  });
}

export const KG_PER_LB = 0.45359237;
/** Kilograms to pounds for display, to the nearest half pound (Matt reads lb). */
export const kgToLb = (kg: number) => Math.round(kg / KG_PER_LB * 2) / 2;
const shortName = (name: string) => name.replace(/\b(?:kettle[\s-]?bells?|kb)\b/gi, 'KB').replace(/\b(?:dumb[\s-]?bells?|db)\b/gi, 'DB').replace(/^./, c => c.toUpperCase());
/** "KB swings 3×15 @ 35 lb", "Side plank 3 sets (5/3/1) · 10s holds · each side", "Rowing · 20 min". */
export function formatExerciseItem(item: ExerciseItem): string {
  const volume = item.scheme ? `${item.sets ?? item.scheme.split('/').length} sets (${item.scheme})` : item.sets && item.reps ? `${item.sets}×${item.reps}` : item.reps ? `×${item.reps}` : item.sets && item.sets > 1 ? `${item.sets} sets` : '';
  const load = item.loadKg ? `@ ${kgToLb(item.loadKg)} lb` : '';
  const hold = item.holdSeconds ? `${item.holdSeconds}s hold${item.scheme || item.reps || (item.sets ?? 1) > 1 ? 's' : ''}` : '';
  const time = !volume && !hold && item.minutes ? `${item.minutes < 1 ? item.minutes : Math.round(item.minutes)} min` : '';
  const head = [shortName(item.activity), volume, load].filter(Boolean).join(' ');
  return [head, hold, item.side === 'each' ? 'each side' : '', time].filter(Boolean).join(' · ');
}
/** Exercise is energy burned: always shown as a positive number. */
export const burnedLabel = (kcal: number) => `Burned ${Math.round(Math.abs(kcal)).toLocaleString('en-US')} kcal`;
/** Stored description: what Matt wrote (or the routine name) plus notes like "partial (50%)", "first time"; max 300 chars. */
export function exerciseDescription(text: string, notes: readonly string[], fallback = 'Workout'): string {
  const base = text.trim().replace(/\s+/g, ' ') || fallback;
  const tail = notes.filter(n => !base.toLowerCase().includes(n.toLowerCase()));
  const suffix = tail.length ? ` — ${tail.join(', ')}` : '';
  return base.slice(0, 300 - suffix.length) + suffix;
}

export type ExerciseWhen = 'now' | 'earlier' | 'yesterday';
export const EXERCISE_MAX_AGE_MS = 31 * 86400000;
const CHICAGO = 'America/Chicago';
/** Chicago calendar date (YYYY-MM-DD) for an instant. */
export function chicagoDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
/** "HH:MM" on the Chicago clock for an instant. */
export function chicagoTime(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: CHICAGO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
}
function chicagoOffsetMs(ms: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: CHICAGO, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
/** A Chicago wall-clock date + "HH:MM" as an instant (DST-aware). */
export function chicagoWallTime(date: string, time: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!d || !t || +t[1] > 23 || +t[2] > 59) return NaN;
  const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let ms = wall - chicagoOffsetMs(wall);
  ms = wall - chicagoOffsetMs(ms);
  return ms;
}
/** The 'When' choice as an ISO instant with a timezone (Z), inside the library's 31-day window and never in the future. */
export function exercisePerformedAt(when: ExerciseWhen, time: string, now: number): { performedAt: string; at: number } | { error: string } {
  if (when === 'now') return { performedAt: new Date(now).toISOString(), at: now };
  const day = when === 'yesterday' ? chicagoDate(chicagoWallTime(chicagoDate(now), '12:00') - 86400000) : chicagoDate(now);
  const at = chicagoWallTime(day, time);
  if (!Number.isFinite(at)) return { error: 'Pick a time for this workout.' };
  if (at > now + 60000) return { error: 'That time has not happened yet today. Pick an earlier time.' };
  if (at < now - EXERCISE_MAX_AGE_MS) return { error: 'Cupcake can only log workouts from the last 31 days.' };
  return { performedAt: new Date(at).toISOString(), at };
}

async function call<T>(request: LibraryRequest, body: Record<string, unknown>): Promise<T> {
  try { return await request<T>(body); }
  catch (error) { if (isUnknownAction(error)) throw new ExerciseUnavailableError(); throw error; }
}

export async function listExercises(request: LibraryRequest, start: number, end: number): Promise<ExerciseEntry[]> {
  const data = await call<{ entries?: unknown }>(request, { action: 'exercise_list', start: new Date(start).toISOString(), end: new Date(end).toISOString(), limit: 100 });
  return (Array.isArray(data.entries) ? data.entries : []).map(parseExerciseEntry).filter((e): e is ExerciseEntry => e !== null).sort((a, b) => a.at - b.at);
}

export async function logExercise(request: LibraryRequest, input: ExerciseInput): Promise<ExerciseEntry> {
  // Never send an entry with nothing recognised: the library needs a positive burn, and so does Matt.
  if (!(Number.isFinite(input.kcal) && input.kcal >= 1) || !input.description.trim()) throw new Error('Nothing recognised to log yet. Nothing was saved.');
  const data = await call<{ entry?: unknown }>(request, { action: 'exercise_log', ...input });
  const entry = parseExerciseEntry(data.entry);
  if (!entry) throw new Error('Cupcake did not confirm the saved exercise. Check before logging it again.');
  return entry;
}

export async function deleteExercise(request: LibraryRequest, id: string): Promise<boolean> {
  const data = await call<{ deleted?: unknown }>(request, { action: 'exercise_delete', id });
  return data.deleted === true;
}
