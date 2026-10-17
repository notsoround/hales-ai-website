export const NUTRITION_TIME_ZONE = 'America/Chicago';
export type NutritionScale = 'day' | 'week' | 'month' | 'year';
export type FoodHistoryMeal = {
  id: string; description: string; consumedAt?: string | null; date?: string; source?: 'food_sheet'; createdAt?: string; photoTakenAt?: string;
  sheetLoggedAt?: string | null; countedInTotals?: boolean; total?: { calories?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null; sugar_g?: number | null };
  totalIsPartial?: boolean; calorieRange?: { low: number; high: number } | null; imageStored?: boolean;
};
export type NutritionHistory = { meals: FoodHistoryMeal[]; complete: boolean; pendingCount: number; undatedLoggedCount: number; unknownTimeCount?: number; scope?: string; coverageNote?: string };
export type NutritionSettingVersion = { calorieTarget: number | null; expenditureEstimate: number | null; effectiveFrom: string | null; updatedAt?: string | null };
export type NutritionSettings = NutritionSettingVersion & { versions?: NutritionSettingVersion[] };
export const EMPTY_NUTRITION_SETTINGS: NutritionSettings = { calorieTarget: null, expenditureEstimate: null, effectiveFrom: null, versions: [] };

const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: NUTRITION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export function nutritionDay(value: string | Date = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const parts = dateParts.formatToParts(d);
  return ['year', 'month', 'day'].map(part => parts.find(p => p.type === part)?.value).join('-');
}
export function validDay(day: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day; }
export function addDays(day: string, amount: number): string { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); }
export function dayLabel(day: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}
export function mealTimeLabel(when: string | undefined | null, includeDate = true): string {
  if (!when || !Number.isFinite(Date.parse(when))) return 'Eaten time not recorded';
  return new Intl.DateTimeFormat('en-US', { timeZone: NUTRITION_TIME_ZONE, ...(includeDate ? { month: 'short', day: 'numeric', year: 'numeric' } as const : {}), hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(when));
}
const knownNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function loggedMeals(meals: FoodHistoryMeal[]): FoodHistoryMeal[] {
  const seen = new Set<string>();
  return meals.map(meal => ({ meal, day: mealDay(meal) })).filter(({ meal, day }) => { if (!meal.id || seen.has(meal.id) || !meal.sheetLoggedAt || meal.countedInTotals === false || !day) return false; seen.add(meal.id); return true; })
    .sort((a, b) => a.day.localeCompare(b.day) || (a.meal.consumedAt && b.meal.consumedAt ? Date.parse(a.meal.consumedAt) - Date.parse(b.meal.consumedAt) : a.meal.consumedAt ? -1 : b.meal.consumedAt ? 1 : 0) || a.meal.id.localeCompare(b.meal.id)).map(({ meal }) => meal);
}
export function mealDay(meal: FoodHistoryMeal): string { return meal.consumedAt && /(Z|[+-]\d\d:\d\d)$/.test(meal.consumedAt) ? nutritionDay(meal.consumedAt) : meal.date && validDay(meal.date) ? meal.date : ''; }
export function mealNeighbors(meals: FoodHistoryMeal[], id: string): { previous: FoodHistoryMeal | null; next: FoodHistoryMeal | null; position: number; total: number } {
  const ordered = loggedMeals(meals); const index = ordered.findIndex(m => m.id === id);
  return { previous: index > 0 ? ordered[index - 1] : null, next: index >= 0 ? ordered[index + 1] || null : null, position: index + 1, total: ordered.length };
}
export function lastLoggedMeal(meals: FoodHistoryMeal[], now = new Date()): FoodHistoryMeal | null { const eligible = loggedMeals(meals).filter(m => m.consumedAt && Date.parse(m.consumedAt) <= now.getTime()); return eligible[eligible.length - 1] || null; }
export function elapsedLabel(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 1) return 'less than a minute';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours.toLocaleString()}h${rest ? ` ${rest}m` : ''}` : `${minutes}m`;
}
export function nutritionPeriod(anchor: string, scale: NutritionScale): { start: string; end: string; days: string[]; label: string } {
  const selected = validDay(anchor) ? anchor : nutritionDay(); const y = Number(selected.slice(0, 4)), mo = Number(selected.slice(5, 7));
  let start = selected, end = selected;
  if (scale === 'week') { const weekday = new Date(`${selected}T12:00:00Z`).getUTCDay(); start = addDays(selected, -(weekday + 6) % 7); end = addDays(start, 6); }
  if (scale === 'month') { start = `${selected.slice(0, 7)}-01`; end = addDays(`${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}-01`, -1); }
  if (scale === 'year') { start = `${y}-01-01`; end = `${y}-12-31`; }
  const days: string[] = []; for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const label = scale === 'day' ? dayLabel(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : scale === 'week' ? `${dayLabel(start, { month: 'short', day: 'numeric' })} – ${dayLabel(end)}` : scale === 'month' ? dayLabel(start, { month: 'long', year: 'numeric' }) : String(y);
  return { start, end, days, label };
}
export function moveNutritionPeriod(anchor: string, scale: NutritionScale, direction: number): string {
  const period = nutritionPeriod(anchor, scale);
  if (scale === 'day' || scale === 'week') return addDays(anchor, direction * (scale === 'week' ? 7 : 1));
  if (scale === 'month') return direction < 0 ? nutritionPeriod(addDays(period.start, -1), 'month').start : addDays(period.end, 1);
  return `${Number(anchor.slice(0, 4)) + direction}-01-01`;
}
export function settingsForDay(settings: NutritionSettings, day: string): NutritionSettingVersion | null {
  const versions = settings.versions?.length ? settings.versions : settings.effectiveFrom ? [settings] : [];
  const eligible = versions.filter(v => v.effectiveFrom && v.effectiveFrom <= day).sort((a, b) => a.effectiveFrom!.localeCompare(b.effectiveFrom!));
  return eligible[eligible.length - 1] || null;
}
// Resolve local midnight independently on both sides of DST; a day is not always 24h.
export function nutritionDayStart(day: string): number {
  const [year, month, date] = day.split('-').map(Number); const nominal = Date.UTC(year, month - 1, date);
  let result = nominal;
  const format = new Intl.DateTimeFormat('en-US', { timeZone: NUTRITION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 3; i++) { const p = Object.fromEntries(format.formatToParts(new Date(result)).map(x => [x.type, x.value])); const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)); result += nominal - local; }
  return result;
}
export type NutritionDay = { day: string; meals: FoodHistoryMeal[]; calories: number; knownCalorieCount: number; unknownCalories: number; partial: boolean; target: number | null; expenditure: number | null; balance: number | null; elapsedFraction: number };
export function nutritionDays(meals: FoodHistoryMeal[], days: string[], settings = EMPTY_NUTRITION_SETTINGS, now = new Date()): NutritionDay[] {
  const ordered = loggedMeals(meals), today = nutritionDay(now);
  const buckets = new Map<string, FoodHistoryMeal[]>();
  for (const meal of ordered) { const day = mealDay(meal), bucket = buckets.get(day) || []; bucket.push(meal); buckets.set(day, bucket); }
  return days.map(day => {
    const entries = buckets.get(day) || [];
    const basis = settingsForDay(settings, day);
    const fraction = day < today ? 1 : day > today ? 0 : Math.max(0, Math.min(1, (now.getTime() - nutritionDayStart(day)) / (nutritionDayStart(addDays(day, 1)) - nutritionDayStart(day))));
    const expenditure = knownNumber(basis?.expenditureEstimate) && basis.expenditureEstimate > 0 ? basis.expenditureEstimate * fraction : null;
    const calories = entries.reduce((sum, m) => sum + (knownNumber(m.total?.calories) ? m.total!.calories! : 0), 0);
    const unknownCalories = entries.filter(m => !knownNumber(m.total?.calories)).length;
    return { day, meals: entries, calories, knownCalorieCount: entries.length - unknownCalories, unknownCalories, partial: unknownCalories > 0 || entries.some(m => m.totalIsPartial), target: knownNumber(basis?.calorieTarget) && basis.calorieTarget > 0 ? basis.calorieTarget : null, expenditure, balance: entries.length && !unknownCalories && !entries.some(m => m.totalIsPartial) && expenditure !== null ? calories - expenditure : null, elapsedFraction: fraction };
  });
}
export function periodNutrition(days: NutritionDay[], today = nutritionDay()) {
  const elapsed = days.filter(d => d.day <= today), withMeals = elapsed.filter(d => d.meals.length), partial = elapsed.some(d => d.partial);
  const calories = elapsed.reduce((sum, d) => sum + d.calories, 0);
  const target = elapsed.length && elapsed.every(d => d.target !== null) ? elapsed.reduce((sum, d) => sum + d.target!, 0) : null;
  const expenditure = elapsed.length && elapsed.every(d => d.expenditure !== null) ? elapsed.reduce((sum, d) => sum + d.expenditure!, 0) : null;
  // A date without a log is unknown intake, never evidence of zero consumption.
  const allDaysLogged = elapsed.length > 0 && withMeals.length === elapsed.length;
  return { calories, target, expenditure, partial, knownCalorieCount: elapsed.reduce((sum, d) => sum + d.knownCalorieCount, 0), mealCount: elapsed.reduce((sum, d) => sum + d.meals.length, 0), daysWithLogs: withMeals.length, elapsedDays: elapsed.length, balance: allDaysLogged && !partial && expenditure !== null ? calories - expenditure : null };
}
export function signedCalories(value: number): string { return `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.round(Math.abs(value)).toLocaleString('en-US')}`; }
