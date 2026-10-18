// Server-side exercise log in the private library (owner-only actions
// exercise_log / exercise_list / exercise_delete). Until the library is
// deployed with those actions, every call reports `unavailable` and nothing is
// stored anywhere else: no localStorage fallback, no invented entries.
import type { LibraryRequest } from './glucoseApi';

export type ExerciseEntry = { id: string; description: string; performedAt: string; at: number; minutes: number; kcal: number; basis: string };
export type ExerciseInput = { requestId: string; description: string; performedAt: string; minutes: number; kcal: number; basis: string };
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
  return { id: value.id, description: value.description, performedAt: value.performedAt, at, minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0, kcal: Math.round(kcal), basis: typeof value.basis === 'string' ? value.basis : '' };
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
  const data = await call<{ entry?: unknown }>(request, { action: 'exercise_log', ...input });
  const entry = parseExerciseEntry(data.entry);
  if (!entry) throw new Error('Cupcake did not confirm the saved exercise. Check before logging it again.');
  return entry;
}

export async function deleteExercise(request: LibraryRequest, id: string): Promise<boolean> {
  const data = await call<{ deleted?: unknown }>(request, { action: 'exercise_delete', id });
  return data.deleted === true;
}
