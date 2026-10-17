import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryRequest } from './library';
import { privateAccessHeaders } from './privateAccess';
import { EMPTY_NUTRITION_SETTINGS, mealDay, nutritionDay, validDay, type FoodHistoryMeal, type NutritionHistory, type NutritionSettings, type NutritionSettingVersion } from './nutritionModel';

export type FoodArchivePage = { meals: FoodHistoryMeal[]; total: number; nextCursor?: string | null; hasMore?: boolean; pendingCount: number; undatedLoggedCount: number; undatedMealIds?: string[]; coverageNote?: string };
export type FoodLedgerEntry = { id: string; type: string; date: string; time?: string; title?: string; calories?: number | null; details?: { mealId?: string | null; protein?: number | null; carbs?: number | null; fat?: number | null; sugar?: number | null } };
export type FoodLedgerPage = { items?: FoodLedgerEntry[]; nextCursor?: string | null; coverage?: { scope?: string; complete?: boolean; notes?: string[] } };

/** Parse only a saved, valid clock time. Missing/noon defaults and ambiguous DST clocks are never meal timestamps. */
export function foodLedgerTime(day: string, time: string | undefined): string | null {
  if (!validDay(day) || !time) return null;
  const qualified = /^(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})$/.exec(time.trim());
  if (qualified) {
    if (Number(qualified[1]) > 23 || Number(qualified[2]) > 59 || Number(qualified[3]) > 59) return null;
    const parsed = new Date(`${day}T${time.trim()}`);
    return Number.isFinite(parsed.getTime()) && nutritionDay(parsed) === day ? parsed.toISOString() : null;
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(time.trim());
  if (!match) return null;
  let hour = Number(match[1]); const minute = Number(match[2]), second = Number(match[3] || 0), ampm = match[4]?.toUpperCase();
  if (minute > 59 || second > 59 || (ampm ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (ampm) hour = hour % 12 + (ampm === 'PM' ? 12 : 0);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const desired = `${String(hour).padStart(2, '0')}:${match[2]}:${String(second).padStart(2, '0')}`;
  // Both possible offsets cover DST changes; accept one unambiguous real instant.
  const nominal = Date.parse(`${day}T${desired}Z`), matches = [5, 6].map(offset => nominal + offset * 3600000).filter(ms => nutritionDay(new Date(ms)) === day && clock.format(new Date(ms)) === desired);
  return matches.length === 1 ? new Date(matches[0]).toISOString() : null;
}
export function mergeFoodHistory(archive: FoodArchivePage, ledger: FoodLedgerEntry[], complete: boolean): NutritionHistory {
  const meals = new Map<string, FoodHistoryMeal>();
  for (const meal of archive.meals) meals.set(meal.id, meal);
  const datedLedgerIds = new Set<string>();
  for (const entry of ledger) {
    if (entry.type !== 'food' || !entry.id || !validDay(entry.date)) continue;
    const canonical = /^meal_[a-f0-9]{32}$/.test(entry.details?.mealId || '') ? entry.details!.mealId! : entry.id;
    datedLedgerIds.add(canonical);
    if (meals.has(canonical)) continue;
    const calories = typeof entry.calories === 'number' && Number.isFinite(entry.calories) && entry.calories >= 0 ? entry.calories : null;
    meals.set(canonical, { id: canonical, source: 'food_sheet', date: entry.date, description: entry.title || 'Logged food',
      consumedAt: foodLedgerTime(entry.date, entry.time), sheetLoggedAt: 'canonical_food_sheet', countedInTotals: true, imageStored: false,
      total: { calories, protein_g: entry.details?.protein ?? null, carbs_g: entry.details?.carbs ?? null, fat_g: entry.details?.fat ?? null, sugar_g: entry.details?.sugar ?? null }, totalIsPartial: calories === null });
  }
  const undated = archive.undatedMealIds ? archive.undatedMealIds.filter(id => !datedLedgerIds.has(id)).length : archive.undatedLoggedCount;
  const values = [...meals.values()].filter(meal => !!mealDay(meal));
  return { meals: values, complete, pendingCount: archive.pendingCount, undatedLoggedCount: undated, unknownTimeCount: values.filter(m => !m.consumedAt).length,
    scope: 'canonical_food_and_saved_photos', coverageNote: 'Saved photo meals and canonical Food ledger rows, matched once by meal ID. Calories are logged estimates; meals you did not log may be missing.' };
}

async function readLedgerPage(cursor?: string): Promise<FoodLedgerPage> {
  const response = await fetch(`https://automate.hales.ai/webhook/cupcake-feed?scope=food-history${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: privateAccessHeaders(), cache: 'no-store', signal: AbortSignal.timeout(60000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.coverage?.scope !== 'food-history') throw Error('Older Food ledger history is unavailable. Saved photo totals may be incomplete.');
  return data;
}
export async function loadNutritionHistory(request = libraryRequest, readLedger = readLedgerPage): Promise<{ history: NutritionHistory; error: string }> {
  let archive: FoodArchivePage = { meals: [], total: 0, pendingCount: 0, undatedLoggedCount: 0 }, archiveError = '', ledgerError = '';
  const entries: FoodLedgerEntry[] = [];
  const archiveLoad = async () => {
    const seen = new Set<string>(); let cursor: string | undefined;
    do {
      const page = await request<FoodArchivePage>({ action: 'food_history', limit: 200, ...(cursor ? { cursor } : {}) });
      archive = { ...page, meals: [...archive.meals, ...page.meals] };
      if (page.hasMore && !page.nextCursor) throw Error('Saved meal pagination did not finish.');
      cursor = page.nextCursor || undefined;
      if (cursor && seen.has(cursor)) throw Error('Saved meal pagination did not advance.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    if (new Set(archive.meals.map(m => m.id)).size < archive.total) throw Error('Saved meal history changed while loading. Refresh to finish.');
  };
  const ledgerLoad = async () => {
    const seen = new Set<string>(); let cursor: string | undefined;
    do {
      const page = await readLedger(cursor); entries.push(...(page.items || []));
      cursor = page.nextCursor || undefined;
      if (!cursor && page.coverage?.complete === false) throw Error('Older Food ledger history is incomplete.');
      if (cursor && seen.has(cursor)) throw Error('Food ledger pagination did not advance.');
      if (cursor) seen.add(cursor);
    } while (cursor);
  };
  await Promise.all([archiveLoad().catch(e => { archiveError = e instanceof Error ? e.message : 'Saved food photos could not load.'; }), ledgerLoad().catch(e => { ledgerError = e instanceof Error ? e.message : 'Older Food ledger could not load.'; })]);
  const error = [archiveError, ledgerError].filter(Boolean).join(' ');
  return { history: mergeFoodHistory(archive, entries, !error), error };
}

export function useNutritionData() {
  const [history, setHistory] = useState<NutritionHistory | null>(null), [settings, setSettings] = useState<NutritionSettings>(EMPTY_NUTRITION_SETTINGS), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const reload = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError(''); setHistory(null);
    const [food, preferences] = await Promise.allSettled([loadNutritionHistory(), libraryRequest<{ settings: NutritionSettings }>({ action: 'food_settings_get' })]);
    if (current !== generation.current) return;
    const errors: string[] = [];
    if (food.status === 'fulfilled') { setHistory(food.value.history); if (food.value.error) errors.push(food.value.error); }
    else errors.push(food.reason instanceof Error ? food.reason.message : 'Food history could not load.');
    if (preferences.status === 'fulfilled') setSettings(preferences.value.settings);
    else { setSettings(EMPTY_NUTRITION_SETTINGS); errors.push('Nutrition settings could not load. Target and energy comparisons are unavailable.'); }
    setError(errors.join(' ')); setLoading(false);
  }, []);
  useEffect(() => { void reload(); return invalidate; }, [reload, invalidate]);
  const saveSettings = useCallback(async (version: NutritionSettingVersion) => {
    const response = await libraryRequest<{ settings: NutritionSettings }>({ action: 'food_settings_save', calorieTarget: version.calorieTarget, expenditureEstimate: version.expenditureEstimate, effectiveFrom: version.effectiveFrom }, { foodGesture: true });
    setSettings(response.settings);
  }, []);
  return { history, settings, loading, error, reload, saveSettings };
}
