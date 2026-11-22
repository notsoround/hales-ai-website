import { NUTRITION_TIME_ZONE, type FoodHistoryMeal } from './nutritionModel.ts';

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

/* ---------- Smart meal-slot suggestions & live daily tracking ---------- */

export type MealSlotKind = 'breakfast' | 'am_snack' | 'lunch' | 'pm_snack' | 'dinner' | 'snack' | 'meal';

export type SlotSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fromPlan?: boolean;
  items: string[];
};

export type SlotTracking = {
  slotIndex: number;
  kind: MealSlotKind;
  targetKcal: number | null;
  loggedMeals: FoodHistoryMeal[];
  loggedKcal: number;
  unknownKcalCount: number;
  deltaKcal: number | null;
  progress: number | null;
  status: 'empty' | 'on_track' | 'hit' | 'over' | 'logged_no_target';
};

export function inferMealSlotKind(name: string): MealSlotKind {
  const lower = name.toLowerCase();
  if (/\b(?:am|morning|mid-?morning)\s*snack\b/.test(lower) || /\bsnack\s*1\b/.test(lower)) return 'am_snack';
  if (/\b(?:pm|afternoon|evening|late|night)\s*snack\b/.test(lower) || /\bsnack\s*2\b/.test(lower)) return 'pm_snack';
  if (/\b(?:breakfast|morning|brunch)\b/.test(lower)) return 'breakfast';
  if (/\b(?:lunch|midday)\b/.test(lower)) return 'lunch';
  if (/\b(?:dinner|supper|evening)\b/.test(lower)) return 'dinner';
  if (/\b(?:snack|pre-?workout|post-?workout|shake)\b/.test(lower)) return 'snack';
  return 'meal';
}

type SuggestionTemplate = {
  title: string;
  portionBase: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  items: string[];
  slots: MealSlotKind[];
};

const CURATED_TEMPLATES: readonly SuggestionTemplate[] = [
  { title: 'Greek yogurt berry bowl', portionBase: '1 cup 0% Greek yogurt, berries & 1 tbsp chia', kcal: 340, proteinG: 28, carbsG: 36, fatG: 9, items: ['Greek yogurt', 'Mixed berries', 'Chia seeds'], slots: ['breakfast', 'am_snack', 'snack'] },
  { title: 'Eggs, sourdough & avocado', portionBase: '2 eggs, 1 slice sourdough & ¼ avocado', kcal: 370, proteinG: 19, carbsG: 28, fatG: 20, items: ['Eggs', 'Sourdough bread', 'Avocado'], slots: ['breakfast', 'meal'] },
  { title: 'Protein oats with banana', portionBase: '½ cup rolled oats, whey scoop & ½ banana', kcal: 380, proteinG: 29, carbsG: 50, fatG: 7, items: ['Rolled oats', 'Protein powder', 'Bananas'], slots: ['breakfast'] },
  { title: 'Smoked salmon egg wrap', portionBase: '2 eggs, 2 oz smoked salmon, spinach & tortilla', kcal: 410, proteinG: 32, carbsG: 26, fatG: 19, items: ['Eggs', 'Smoked salmon', 'Spinach', 'Whole wheat tortillas'], slots: ['breakfast', 'lunch'] },

  { title: 'Cottage cheese, pineapple & almonds', portionBase: '¾ cup cottage cheese, pineapple & 12 almonds', kcal: 270, proteinG: 22, carbsG: 22, fatG: 10, items: ['Cottage cheese', 'Pineapple', 'Almonds'], slots: ['am_snack', 'pm_snack', 'snack'] },
  { title: 'Apple slices & peanut butter', portionBase: '1 crisp apple & 1.5 tbsp natural peanut butter', kcal: 260, proteinG: 7, carbsG: 31, fatG: 13, items: ['Apples', 'Peanut butter'], slots: ['am_snack', 'pm_snack', 'snack'] },
  { title: 'Turkey roll-ups & hummus', portionBase: '3 oz sliced turkey, cucumber, bell pepper & hummus', kcal: 250, proteinG: 24, carbsG: 16, fatG: 9, items: ['Sliced turkey', 'Cucumbers', 'Hummus'], slots: ['am_snack', 'pm_snack', 'snack'] },
  { title: 'Roasted edamame & string cheese', portionBase: '½ cup roasted edamame & 1 mozzarella stick', kcal: 240, proteinG: 21, carbsG: 14, fatG: 11, items: ['Edamame', 'Mozzarella string cheese'], slots: ['am_snack', 'pm_snack', 'snack'] },

  { title: 'Grilled chicken quinoa bowl', portionBase: '5 oz chicken breast, ½ cup quinoa, greens & olive oil', kcal: 510, proteinG: 46, carbsG: 42, fatG: 16, items: ['Chicken breast', 'Quinoa', 'Mixed greens', 'Olive oil'], slots: ['lunch', 'dinner', 'meal'] },
  { title: 'Mediterranean tuna salad plate', portionBase: '1 can tuna, cucumber, feta, olives & pita', kcal: 460, proteinG: 39, carbsG: 36, fatG: 17, items: ['Canned tuna', 'Cucumbers', 'Feta cheese', 'Pita bread'], slots: ['lunch', 'meal'] },
  { title: 'Turkey avocado sourdough sandwich', portionBase: '4 oz turkey, sourdough, avocado, tomato & greens', kcal: 490, proteinG: 34, carbsG: 44, fatG: 18, items: ['Sliced turkey', 'Sourdough bread', 'Avocado', 'Tomatoes'], slots: ['lunch'] },
  { title: 'Crispy tofu & edamame rice bowl', portionBase: '5 oz tofu, ½ cup brown rice, broccoli & tamari', kcal: 480, proteinG: 28, carbsG: 54, fatG: 16, items: ['Firm tofu', 'Brown rice', 'Broccoli', 'Tamari'], slots: ['lunch', 'dinner', 'meal'] },

  { title: 'Baked salmon, sweet potato & broccoli', portionBase: '5 oz salmon fillet, roasted sweet potato & broccoli', kcal: 560, proteinG: 40, carbsG: 42, fatG: 24, items: ['Salmon fillets', 'Sweet potatoes', 'Broccoli'], slots: ['dinner', 'meal'] },
  { title: 'Lean sirloin stir-fry & jasmine rice', portionBase: '5 oz sirloin strips, bell peppers, snap peas & rice', kcal: 580, proteinG: 44, carbsG: 52, fatG: 20, items: ['Sirloin steak', 'Bell peppers', 'Jasmine rice'], slots: ['dinner', 'meal'] },
  { title: 'Herb turkey meatballs & zucchini pasta', portionBase: '5 oz lean turkey meatballs, marinara & pasta blend', kcal: 520, proteinG: 42, carbsG: 46, fatG: 16, items: ['Ground turkey', 'Marinara sauce', 'Zucchini', 'Pasta'], slots: ['dinner'] },
];

function scaleTemplate(template: SuggestionTemplate, targetKcal: number, index: number): SlotSuggestion {
  const safeTarget = Math.max(120, Math.min(1400, targetKcal));
  const rawRatio = safeTarget / template.kcal;
  const ratio = Math.max(0.55, Math.min(1.65, rawRatio));
  const kcal = Math.round((template.kcal * ratio) / 5) * 5;
  const proteinG = Math.max(1, Math.round(template.proteinG * ratio));
  const carbsG = Math.max(0, Math.round(template.carbsG * ratio));
  const fatG = Math.max(0, Math.round(template.fatG * ratio));
  const sizeHint = ratio < 0.85 ? 'Lighter portion · ' : ratio > 1.2 ? 'Heartier portion · ' : '';
  return {
    id: `tpl-${index}-${template.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: template.title,
    subtitle: `${sizeHint}${template.portionBase}`,
    kcal,
    proteinG,
    carbsG,
    fatG,
    items: template.items,
  };
}

/** Generate smart, calorie-matched suggestions for a meal plan slot. */
export function suggestForMealSlot(
  meal: { name: string; items: readonly string[]; kcal?: number | null },
  remainingSlotKcal?: number | null,
): SlotSuggestion[] {
  const kind = inferMealSlotKind(meal.name);
  const defaultTarget = kind === 'am_snack' || kind === 'pm_snack' || kind === 'snack' ? 250 : kind === 'breakfast' ? 380 : kind === 'lunch' ? 500 : 560;
  const baseTarget = typeof meal.kcal === 'number' && Number.isFinite(meal.kcal) && meal.kcal > 0 ? meal.kcal : defaultTarget;
  const target = typeof remainingSlotKcal === 'number' && Number.isFinite(remainingSlotKcal) && remainingSlotKcal >= 100 && remainingSlotKcal < baseTarget - 40
    ? remainingSlotKcal
    : baseTarget;

  const suggestions: SlotSuggestion[] = [];
  const planItems = meal.items.map(item => item.trim()).filter(Boolean);
  if (planItems.length > 0) {
    // Macro-balanced estimate for the slot's own planned ingredients sized to target.
    const proteinShare = kind === 'am_snack' || kind === 'pm_snack' || kind === 'snack' ? 0.24 : 0.30;
    const fatShare = 0.28;
    const carbShare = 1 - proteinShare - fatShare;
    suggestions.push({
      id: 'plan-match',
      title: `Your planned ${meal.name}`,
      subtitle: `${planItems.slice(0, 4).join(' · ')}${planItems.length > 4 ? ` +${planItems.length - 4} more` : ''}`,
      kcal: Math.round(target),
      proteinG: Math.round((target * proteinShare) / 4),
      carbsG: Math.round((target * carbShare) / 4),
      fatG: Math.round((target * fatShare) / 9),
      fromPlan: true,
      items: planItems,
    });
  }

  const primaryPool = CURATED_TEMPLATES.filter(t => t.slots.includes(kind));
  const pool = primaryPool.length >= 3 ? primaryPool : [...primaryPool, ...CURATED_TEMPLATES.filter(t => !primaryPool.includes(t))];
  // Sort by closest natural calorie fit to the target so portion scaling stays realistic.
  const ranked = [...pool].sort((a, b) => Math.abs(a.kcal - target) - Math.abs(b.kcal - target));
  for (let i = 0; i < Math.min(3, ranked.length); i++) {
    suggestions.push(scaleTemplate(ranked[i], target, i));
  }
  return suggestions;
}

const chicagoHourFormat = new Intl.DateTimeFormat('en-US', { timeZone: NUTRITION_TIME_ZONE, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });

function mealLocalHour(meal: FoodHistoryMeal): number | null {
  if (!meal.consumedAt) return null;
  const ms = Date.parse(meal.consumedAt);
  if (!Number.isFinite(ms)) return null;
  const parts = chicagoHourFormat.formatToParts(new Date(ms));
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
  if (!Number.isFinite(hour)) return null;
  return (hour === 24 ? 0 : hour) + minute / 60;
}

const SLOT_CENTER_HOUR: Record<MealSlotKind, number> = {
  breakfast: 8.25,
  am_snack: 10.75,
  lunch: 12.75,
  pm_snack: 15.75,
  dinner: 18.75,
  snack: 15.25,
  meal: 13.0,
};

function descriptionSlotHint(description: string): MealSlotKind | null {
  const lower = description.toLowerCase();
  if (/\b(breakfast|oats|oatmeal|pancake|waffle|cereal|eggs?|bacon|bagel|coffee|latte)\b/.test(lower)) return 'breakfast';
  if (/\b(dinner|steak|salmon|lasagna|roast|supper)\b/.test(lower)) return 'dinner';
  if (/\b(lunch|sandwich|wrap|salad|panini|sub|burrito)\b/.test(lower)) return 'lunch';
  if (/\b(snack|bar|almonds?|apple|chips|popcorn|shake|smoothie|hummus)\b/.test(lower)) return 'snack';
  return null;
}

/** Map today's logged meals onto the meal plan's slots and compute live target comparisons. */
export function matchTodayMealsToPlan(
  planMeals: readonly { name: string; kcal?: number | null }[],
  todayMeals: readonly FoodHistoryMeal[],
): SlotTracking[] {
  const slots: SlotTracking[] = planMeals.map((meal, slotIndex) => ({
    slotIndex,
    kind: inferMealSlotKind(meal.name),
    targetKcal: typeof meal.kcal === 'number' && Number.isFinite(meal.kcal) && meal.kcal > 0 ? meal.kcal : null,
    loggedMeals: [],
    loggedKcal: 0,
    unknownKcalCount: 0,
    deltaKcal: typeof meal.kcal === 'number' && Number.isFinite(meal.kcal) && meal.kcal > 0 ? meal.kcal : null,
    progress: null,
    status: 'empty',
  }));
  if (!slots.length || !todayMeals.length) return slots;

  for (const meal of todayMeals) {
    const hour = mealLocalHour(meal);
    const hint = descriptionSlotHint(meal.description || '');
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      let score = 0;
      const center = SLOT_CENTER_HOUR[slot.kind];
      if (hour !== null) {
        const dist = Math.abs(hour - center);
        score -= dist * 2.2;
      } else {
        score -= i * 0.1;
      }
      if (hint) {
        if (slot.kind === hint) score += 5.5;
        else if (hint === 'snack' && (slot.kind === 'am_snack' || slot.kind === 'pm_snack')) score += 4.5;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    slots[bestIndex].loggedMeals.push(meal);
  }

  for (const slot of slots) {
    if (!slot.loggedMeals.length) continue;
    let sum = 0;
    let unknown = 0;
    for (const m of slot.loggedMeals) {
      if (typeof m.total?.calories === 'number' && Number.isFinite(m.total.calories)) sum += m.total.calories;
      else unknown++;
    }
    slot.loggedKcal = Math.round(sum);
    slot.unknownKcalCount = unknown;
    if (slot.targetKcal !== null) {
      slot.deltaKcal = Math.round(slot.targetKcal - sum);
      slot.progress = sum / slot.targetKcal;
      if (sum > slot.targetKcal + 15) slot.status = 'over';
      else if (sum >= slot.targetKcal - 25) slot.status = 'hit';
      else slot.status = 'on_track';
    } else {
      slot.deltaKcal = null;
      slot.progress = null;
      slot.status = 'logged_no_target';
    }
  }
  return slots;
}

