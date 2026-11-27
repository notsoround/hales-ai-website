// Logged workouts on the Today Timeline: their own kind, merged client-side from the library's
// exercise_list (the n8n cupcake-feed is unchanged). Pure helpers; nothing is invented.
import { burnedLabel, chicagoDate, formatExerciseItem, type ExerciseEntry } from './exerciseApi.ts';
import type { PulseItem } from './pulseModel.ts';

/** Logged workouts as Timeline items of type 'exercise'. */
export function exerciseTimelineItems(entries: readonly ExerciseEntry[]): PulseItem[] {
  return entries.map(e => {
    const detail = e.items.length ? e.items.map(formatExerciseItem).join(' · ') : '';
    const minutes = e.minutes ? `${Math.round(e.minutes)} min` : '';
    return { id: `exercise-${e.id}`, type: 'exercise', title: e.description, body: ['Burned', minutes, detail].filter(Boolean).join(' · '),
      date: chicagoDate(e.at), time: new Date(e.at).toISOString(), ts: e.at, calories: null, icon: '🏋️',
      details: { kcal: e.kcal, minutes: e.minutes, items: e.items, source: `Logged in Cupcake · ${burnedLabel(e.kcal)} (estimated, above resting)` } };
  });
}

/** Title, second line and value for a workout row. */
export function exerciseRowParts(item: PulseItem): { title: string; sub: string; value: string } {
  const kcal = typeof item.details?.kcal === 'number' ? item.details.kcal as number : null;
  const minutes = typeof item.details?.minutes === 'number' ? item.details.minutes as number : 0;
  // Positive burn: the value is "129 kcal" and the line under the title starts with "Burned" (the full label is too wide for the value column at 375px).
  return { title: item.title || 'Workout', sub: item.body || (minutes ? `Burned · ${Math.round(minutes)} min` : 'Burned'), value: kcal !== null ? `${Math.round(Math.abs(kcal)).toLocaleString('en-US')} kcal` : '' };
}

/**
 * Merge extra items into the feed without reordering the feed: each goes before the first
 * feed row on an earlier day, or on the same day with an older timestamp.
 */
export function mergeTimelineItems(feed: readonly PulseItem[], extra: readonly PulseItem[]): PulseItem[] {
  const out = [...feed];
  for (const item of [...extra].sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
    const at = out.findIndex(row => row.date < item.date || (row.date === item.date && typeof row.ts === 'number' && typeof item.ts === 'number' && (row.ts < 1e12 ? row.ts * 1000 : row.ts) < item.ts));
    if (at < 0) out.push(item); else out.splice(at, 0, item);
  }
  return out;
}

/** A workout the Timeline shows from the feed that the exercise log did not return. `kcal` is null when the row carries no burn figure. */
export type FeedWorkout = { id: string; at: number; kcal: number | null; description: string };

/**
 * Workouts in the feed for [dayStart, dayEnd) that are not already in the exercise log, so the Energy card can count
 * what the Timeline shows without counting a workout twice. A feed row is the same workout as a log entry when it
 * carries that entry's id (`details.id`, or an item id ending `exercise-<id>`).
 */
type FeedRow = { id?: string; type?: string; title?: string; ts?: number; calories?: number | null; details?: Record<string, unknown> | null };
export function feedOnlyWorkouts(items: readonly FeedRow[] | null | undefined, entries: readonly ExerciseEntry[], dayStart: number, dayEnd: number): FeedWorkout[] {
  const logged = new Set(entries.map(e => e.id));
  const seen = new Set<string>(), out: FeedWorkout[] = [];
  for (const item of items || []) {
    if (item.type !== 'exercise') continue;
    const at = typeof item.ts === 'number' && Number.isFinite(item.ts) ? (item.ts < 1e12 ? item.ts * 1000 : item.ts) : NaN;
    if (!(at >= dayStart && at < dayEnd)) continue;
    const detailId = typeof item.details?.id === 'string' ? item.details.id : '';
    const itemId = typeof item.id === 'string' ? item.id : '';
    const fromLog = /(?:^|:)exercise-(.+)$/.exec(itemId)?.[1] || '';
    if (logged.has(detailId) || logged.has(fromLog)) continue;
    const id = itemId || detailId || `feed-exercise-${at}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // The burn is the row's own figure: `details.kcal`, or a negative `calories` (energy out). Anything else is unknown, not zero.
    const detailKcal = typeof item.details?.kcal === 'number' && Number.isFinite(item.details.kcal) ? Math.abs(item.details.kcal as number) : null;
    const rowKcal = typeof item.calories === 'number' && Number.isFinite(item.calories) && item.calories < 0 ? -item.calories : null;
    const kcal = detailKcal ?? rowKcal;
    out.push({ id, at, kcal: kcal !== null && kcal > 0 ? Math.round(kcal) : null, description: item.title || 'Workout' });
  }
  return out.sort((a, b) => a.at - b.at);
}
