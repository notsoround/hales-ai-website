export type PlannedMeal = Record<string, unknown> & { name: string; items: string[]; kcal?: number | null };
export type MealPlan = Record<string, unknown> & { meals: PlannedMeal[]; title?: string; groceries?: string };
export type PlanDraft = { title: string; groceries: string; meals: { original: PlannedMeal | null; name: string; items: string; kcal: string }[] };
export type PlanIntent = { action: 'coach_plan_set'; kind: 'meal_plan'; value: MealPlan; expected_value: MealPlan | null };
export type PlanRecovery = { base: MealPlan | null; draft: PlanDraft; pending: PlanIntent | null };
export const PLAN_DRAFT_KEY = 'cupcake-food-plan-draft-v1';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parseMealPlan(value: unknown): MealPlan | null {
  if (value === null || value === undefined) return null;
  if (!record(value) || !Array.isArray(value.meals) || value.meals.length > 10 || !value.meals.length || value.meals.some(meal => !record(meal) || typeof meal.name !== 'string' || !Array.isArray(meal.items) || meal.items.some(item => typeof item !== 'string') || (meal.kcal != null && (typeof meal.kcal !== 'number' || !Number.isFinite(meal.kcal) || meal.kcal < 0))) || (value.title !== undefined && typeof value.title !== 'string') || (value.groceries !== undefined && typeof value.groceries !== 'string')) throw Error('This saved meal plan uses a format this editor cannot safely change. Your saved plan is unchanged.');
  return value as MealPlan;
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  return value;
}
export const samePlan = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
export function planDraft(plan: MealPlan | null): PlanDraft {
  return { title: plan?.title || '', groceries: plan?.groceries || '', meals: (plan?.meals || []).map(meal => ({ original: meal, name: meal.name, items: meal.items.join('\n'), kcal: meal.kcal == null ? '' : String(meal.kcal) })) };
}
/** Preserve fields owned by other clients, including per-meal provenance. */
export function draftPlan(base: MealPlan | null, draft: PlanDraft): MealPlan {
  const value: MealPlan = { ...base, meals: draft.meals.map(meal => {
    const value: PlannedMeal = { ...meal.original, name: meal.original && meal.name === meal.original.name ? meal.original.name : meal.name.trim(), items: meal.original && meal.items === meal.original.items.join('\n') ? meal.original.items : meal.items.split('\n').map(item => item.trim()).filter(Boolean) };
    if (meal.kcal !== (meal.original?.kcal == null ? '' : String(meal.original.kcal))) {
      if (meal.kcal.trim()) value.kcal = Number(meal.kcal); else delete value.kcal;
    }
    return value;
  }) };
  if (draft.title !== (base?.title || '')) { if (draft.title.trim()) value.title = draft.title.trim(); else delete value.title; }
  if (draft.groceries !== (base?.groceries || '')) value.groceries = draft.groceries;
  return value;
}
export function planDraftError(draft: PlanDraft, value: MealPlan): string {
  if (!draft.meals.length) return 'Add a meal to your plan before saving. Planned meals are separate from what you ate.';
  if (draft.meals.length > 10) return 'A plan can contain up to 10 meals.';
  if (draft.title.length > 200 || draft.groceries.length > 10000) return 'Shorten the plan title or grocery notes before saving.';
  if (draft.meals.some(meal => !meal.name.trim() || meal.name.length > 300 || !meal.items.trim() || meal.items.length > 5000 || (meal.kcal.trim() && (!Number.isFinite(Number(meal.kcal)) || Number(meal.kcal) < 0 || Number(meal.kcal) > 20000)))) return 'Each planned meal needs a name and food items. Leave unknown planned calories blank, or enter a number from 0 to 20,000.';
  if (JSON.stringify(value).length > 19000) return 'This plan is too long to save. Shorten meal items or grocery notes.';
  return '';
}
export function rebasePlanDraft(base: MealPlan | null, draft: PlanDraft, latest: MealPlan | null): PlanDraft {
  const fresh = planDraft(latest), unchangedMeals = samePlan(draftPlan(base, draft).meals, base?.meals || []);
  const meals = unchangedMeals ? fresh.meals : draft.meals.map(meal => {
    const saved = meal.original && latest?.meals.find(item => item.name === meal.original?.name);
    if (!saved) return meal;
    return { original: saved, name: meal.name === meal.original?.name ? saved.name : meal.name,
      items: meal.items === meal.original?.items.join('\n') ? saved.items.join('\n') : meal.items,
      kcal: meal.kcal === (meal.original?.kcal == null ? '' : String(meal.original.kcal)) ? (saved.kcal == null ? '' : String(saved.kcal)) : meal.kcal };
  });
  if (!unchangedMeals) for (const meal of fresh.meals) if (!base?.meals.some(previous => previous.name === meal.name) && !meals.some(edited => edited.name === meal.name)) meals.push(meal);
  return { title: draft.title === (base?.title || '') ? fresh.title : draft.title,
    groceries: draft.groceries === (base?.groceries || '') ? fresh.groceries : draft.groceries, meals };
}
export function readPlanRecovery(storage: Storage): PlanRecovery | null {
  try {
    const value = JSON.parse(storage.getItem(PLAN_DRAFT_KEY) || 'null');
    if (!record(value) || !record(value.draft) || typeof value.draft.title !== 'string' || typeof value.draft.groceries !== 'string' || !Array.isArray(value.draft.meals) || value.draft.meals.length > 10) return null;
    const base = parseMealPlan(value.base), draft = value.draft as PlanDraft;
    if (draft.meals.some(meal => !record(meal) || typeof meal.name !== 'string' || typeof meal.items !== 'string' || typeof meal.kcal !== 'string' || (meal.original !== null && (!record(meal.original) || !Array.isArray(meal.original.items) || meal.original.items.some(item => typeof item !== 'string'))))) return null;
    let pending: PlanIntent | null = null;
    if (value.pending != null) {
      if (!record(value.pending) || value.pending.action !== 'coach_plan_set' || value.pending.kind !== 'meal_plan') return null;
      const desired = parseMealPlan(value.pending.value);
      if (!desired) return null;
      pending = { action: 'coach_plan_set', kind: 'meal_plan', value: desired, expected_value: parseMealPlan(value.pending.expected_value) };
    }
    return { base, draft, pending };
  } catch { return null; }
}
