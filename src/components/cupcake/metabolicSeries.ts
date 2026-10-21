// Today's energy-balance curve. Pure math, ported from cupcake-opolis
// ui/src/pages/nutrition/metabolic-series.ts, but driven by nutritionModel.ts so
// the end of the line equals the Balance shown in Food today.
//
//   net(t) = eaten(t) − living(t) − exercise(t)
//
// eaten    logged meals only, same rules as nutritionDays (unknown calories add 0
//          and mark the day partial); a meal without a clock time counts from midnight.
// living   the saved expenditure estimate prorated across the Chicago day.
// exercise net burn of exercise entries saved in the library.
// bought   café/takeout purchases are markers only and never change net.
// steps    latest Health Connect daily count (steps_list); display only, never changes net.
import { addDays, loggedMeals, mealDay, nutritionDay, nutritionDayStart, nutritionDays, settingsForDay } from './nutritionModel.ts';
import type { FoodHistoryMeal, NutritionSettings } from './nutritionModel.ts';

export const SERIES_INTERVALS_PER_DAY = 144;

export type BalanceEvent = { kind: 'meal' | 'exercise'; id: string; at: number; label: string; kcal: number | null; untimed?: boolean };
export type BoughtEvent = { id: string; at: number; label: string; amount: number; currency: string };
export type SeriesSample = { t: number; net: number };
export type MetabolicSeries = {
  day: string; dayStart: number; dayEnd: number; now: number;
  samples: SeriesSample[]; events: BalanceEvent[]; bought: BoughtEvent[];
  eaten: number; living: number; exercise: number; steps: number | null;
  /** eaten − living, exactly nutritionDays(...).balance whenever that is known. */
  foodBalance: number | null; net: number; partial: boolean; projectedEndOfDay: number;
};
export type ExerciseLike = { id: string; at: number; kcal: number; description: string };

const knownCalories = (meal: FoodHistoryMeal) => typeof meal.total?.calories === 'number' && Number.isFinite(meal.total.calories) ? meal.total.calories : null;
const mealAt = (meal: FoodHistoryMeal, dayStart: number) => meal.consumedAt && /(Z|[+-]\d\d:\d\d)$/.test(meal.consumedAt) && Number.isFinite(Date.parse(meal.consumedAt)) ? Date.parse(meal.consumedAt) : dayStart;

/** Returns null when there is no expenditure estimate for the day (the line would be meaningless). */
export function buildMetabolicSeries(input: { meals: FoodHistoryMeal[]; settings: NutritionSettings; exercise?: readonly ExerciseLike[]; bought?: readonly BoughtEvent[]; steps?: number | null; now?: Date }): MetabolicSeries | null {
  const nowDate = input.now || new Date(), day = nutritionDay(nowDate);
  const basis = settingsForDay(input.settings, day);
  const expenditure = basis && typeof basis.expenditureEstimate === 'number' && basis.expenditureEstimate > 0 ? basis.expenditureEstimate : null;
  if (expenditure === null) return null;
  const dayStart = nutritionDayStart(day), dayEnd = nutritionDayStart(addDays(day, 1)), span = dayEnd - dayStart;
  const now = Math.max(dayStart, Math.min(dayEnd, nowDate.getTime()));
  const clamp = (t: number) => Math.max(dayStart, Math.min(now, t));
  const meals = loggedMeals(input.meals).filter(m => mealDay(m) === day);
  const events: BalanceEvent[] = [
    ...meals.map((m): BalanceEvent => { const at = mealAt(m, dayStart); return { kind: 'meal', id: m.id, at: clamp(at), label: m.description || 'Meal', kcal: knownCalories(m), ...(at === dayStart && !(m.consumedAt && /(Z|[+-]\d\d:\d\d)$/.test(m.consumedAt)) ? { untimed: true } : {}) }; }),
    ...(input.exercise || []).filter(e => e.at >= dayStart && e.at < dayEnd && e.kcal > 0).map((e): BalanceEvent => ({ kind: 'exercise', id: e.id, at: clamp(e.at), label: e.description, kcal: Math.round(e.kcal) })),
  ].sort((a, b) => a.at - b.at);
  const bought = (input.bought || []).filter(b => b.at >= dayStart && b.at < dayEnd).map(b => ({ ...b, at: clamp(b.at) }));
  const step = span / SERIES_INTERVALS_PER_DAY;
  const netAt = (t: number) => {
    let total = -expenditure * ((t - dayStart) / span);
    for (const e of events) if (e.at <= t && e.kcal !== null) total += e.kind === 'meal' ? e.kcal : -e.kcal;
    return total;
  };
  const samples: SeriesSample[] = [];
  for (let t = dayStart; t < now; t += step) samples.push({ t, net: netAt(t) });
  // Exact before/after points at each event keep meal and exercise steps crisp.
  for (const e of events) if (e.kcal !== null) { if (e.at > dayStart) samples.push({ t: e.at - 1, net: netAt(e.at - 1) }); samples.push({ t: e.at, net: netAt(e.at) }); }
  samples.push({ t: now, net: netAt(now) });
  samples.sort((a, b) => a.t - b.t);
  const eaten = events.reduce((s, e) => s + (e.kind === 'meal' && e.kcal !== null ? e.kcal : 0), 0);
  const exercise = events.reduce((s, e) => s + (e.kind === 'exercise' ? e.kcal || 0 : 0), 0);
  const living = expenditure * ((now - dayStart) / span);
  const reference = nutritionDays(input.meals, [day], input.settings, new Date(now))[0];
  const net = eaten - living - exercise;
  return {
    day, dayStart, dayEnd, now, samples, events, bought, eaten, living, exercise, steps: typeof input.steps === 'number' && Number.isFinite(input.steps) ? input.steps : null,
    foodBalance: reference ? reference.balance : null, net, partial: !!reference?.partial,
    projectedEndOfDay: net - expenditure * ((dayEnd - now) / span),
  };
}

/** Net value at time t (step function between samples). */
export function sampleNetAt(samples: readonly SeriesSample[], t: number): number {
  if (!samples.length) return 0;
  let value = samples[0]!.net;
  for (const s of samples) { if (s.t > t) break; value = s.net; }
  return value;
}

export type Point = { x: number; y: number };
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
/** Monotone cubic (Fritsch–Carlson style) SVG path: smooth, never overshoots. */
export function monotonePath(points: readonly Point[]): string {
  if (!points.length) return '';
  const first = points[0]!;
  if (points.length === 1) return `M${fmt(first.x)},${fmt(first.y)}`;
  const slopes: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) { const a = points[i]!, b = points[i + 1]!, dx = b.x - a.x; slopes.push(dx === 0 ? 0 : (b.y - a.y) / dx); }
  const tangents: number[] = [slopes[0]!];
  for (let i = 1; i < points.length - 1; i += 1) { const l = slopes[i - 1]!, r = slopes[i]!; tangents.push(l * r <= 0 ? 0 : (2 * l * r) / (l + r)); }
  tangents.push(slopes[slopes.length - 1]!);
  let path = `M${fmt(first.x)},${fmt(first.y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!, b = points[i + 1]!, third = (b.x - a.x) / 3;
    path += `C${fmt(a.x + third)},${fmt(a.y + tangents[i]! * third)} ${fmt(b.x - third)},${fmt(b.y - tangents[i + 1]! * third)} ${fmt(b.x)},${fmt(b.y)}`;
  }
  return path;
}
