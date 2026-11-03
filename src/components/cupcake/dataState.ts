// Pure helpers that keep three states apart on Today and the dashboard: still loading, could not load
// (error / unavailable), and genuinely zero or empty. A failed or missing read is never shown as 0 or "none".
export type LoadStatus = 'loading' | 'ready' | 'unavailable' | 'error';
export type StatState = { kind: 'loading' | 'error' | 'unavailable' | 'none' | 'value'; text: string };

/** The Energy card's Exercise figure. Only a successful read with no workouts is "None logged". */
export function exerciseStat(status: LoadStatus, burnedKcal: number): StatState {
  if (status === 'error') return { kind: 'error', text: 'Couldn’t load' };
  if (status === 'unavailable') return { kind: 'unavailable', text: 'Not available' };
  if (burnedKcal > 0) return { kind: 'value', text: Math.round(burnedKcal).toLocaleString('en-US') };
  if (status === 'loading') return { kind: 'loading', text: '…' };
  return { kind: 'none', text: 'None logged' };
}

/** Sentence for the Energy note when workouts could not be read, so net and the projection are not taken as complete. */
export function exerciseCoverageNote(status: LoadStatus): string {
  if (status === 'error') return 'Exercise couldn’t load, so net and the midnight projection leave out any workouts. ';
  if (status === 'unavailable') return 'Exercise is not available from the library, so workouts are not included. ';
  return '';
}

type DaySummary = { meals: readonly unknown[]; calories: number; knownCalorieCount: number; partial: boolean };
/** Today line "kcal eaten": unknown calories are not 0, so a partial day says so and an all-unknown day shows —. */
export function todayKcalBit(food: DaySummary | null): { v: string; l: string } | null {
  if (!food || !food.meals.length) return null;
  if (!food.knownCalorieCount) return { v: '—', l: 'kcal unknown' };
  return { v: Math.round(food.calories).toLocaleString('en-US'), l: food.partial ? 'kcal eaten · partial' : 'kcal eaten' };
}

type FoodEntry = { type: string; calories?: number | null };
/** Dashboard calorie total: null totals are unavailable (—), and food entries without an estimate mark it partial. */
export function calorieTotal(total: number | null | undefined, entries: readonly FoodEntry[]): { value: string; partial: boolean; unknown: number; available: boolean } {
  const unknown = entries.filter(e => e.type === 'food' && (typeof e.calories !== 'number' || !Number.isFinite(e.calories))).length;
  if (typeof total !== 'number' || !Number.isFinite(total)) return { value: '—', partial: unknown > 0, unknown, available: false };
  return { value: Math.round(total).toLocaleString(), partial: unknown > 0, unknown, available: true };
}
