import { missingGroceryItems } from './groceryChecklist';
import { WEEKDAYS, type WorkoutPlan } from './workoutPlanModel';

/** Labs: the assistant may SUGGEST changes in chat. Each suggestion becomes a card the
 *  signed-in owner confirms with a tap; nothing is written without that tap. The chat
 *  model itself still has no tools: it only writes a fenced `cupcake-action` block that
 *  this file validates strictly and turns into one existing, reviewed account data action.
 *  Edits are limited to a meal's portion, removing a logged workout and a purchase's review
 *  status; each names one record from the owner's own snapshot. No other account. */

export const ACTIONS_MARK = '[Cupcake app: assistant suggestions are on]';
const SEPARATOR = '\n\nMy message:\n';
const PROTOCOL = 'The Cupcake app on my screen turns a suggestion of yours into a card that I review and tap to save. '
  + 'You cannot change anything yourself; nothing changes unless I tap. '
  + 'Only when I clearly ask you to log, add, change, remove or plan something, first reply in plain words, then end with one block per change, exactly like this:\n'
  + '```cupcake-action\n{"type":"log_meal","description":"Turkey sandwich and an apple","when":"2026-01-05T12:30","calories":520,"protein_g":32}\n```\n'
  + 'Types (JSON fields):\n'
  + '- log_meal: description (what I ate), when (my local time YYYY-MM-DDTHH:MM), optional estimated calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g\n'
  + '- log_workout: description, when, minutes, calories (estimated burn, 1-5000)\n'
  + '- log_weight: value, unit ("lb" or "kg"), when. Only a number I told you\n'
  + '- log_glucose: value, unit ("mg/dL" or "mmol/L"), method ("fingerstick" or "manual"), when. Only a reading I told you; never CGM data\n'
  + '- add_groceries: items (short strings, at most 30)\n'
  + '- record_outcome: outcome ("win" or "setback"), title, date (YYYY-MM-DD), optional note\n'
  + '- save_meal_plan: title (optional), meals [{name, items [strings], kcal (optional estimate)}], 1-10 meals. Replaces my whole meal plan and keeps my groceries\n'
  + '- save_workout_plan: days {mon..sun: [{name, minutes 1-300}]}; leave rest days out. Replaces my weekly workout plan\n'
  + '- set_calorie_target: calories (daily target, 800-6000), starting today\n'
  + '- set_portion: mealId (from recentMeals), fraction (0.25, 0.5, 0.75 or 1 = the original estimate)\n'
  + '- remove_workout: workoutId (from recentWorkouts)\n'
  + '- review_purchase: purchaseId (from purchases), status ("confirmed", "not_spending" or "undecided")\n'
  + 'Asking you to write, make or change a plan counts as asking for save_meal_plan or save_workout_plan. '
  + 'Meals, weights and wins cannot be removed from the chat: say so plainly, and never use a portion change to remove a meal. '
  + 'Use only ids listed in my app data below; never invent one. Never suggest more than 5 changes in one reply. '
  + 'If a time, amount, record or detail is unclear, ask me instead of guessing. Do not write a block when I only ask a question. '
  + 'Never say you logged, changed or saved something; say it is ready for me to check.';

/** Compact, owner-only app data read just before sending. Each section has its own budget. */
export type AppSnapshot = { mealPlan?: unknown; workoutPlan?: unknown; recentMeals?: unknown; recentWorkouts?: unknown; purchases?: unknown; nutritionSettings?: unknown };
const SECTIONS: [keyof AppSnapshot, string, number][] = [
  ['nutritionSettings', 'nutritionSettings', 200], ['recentMeals', 'recentMeals', 1500], ['recentWorkouts', 'recentWorkouts', 700], ['purchases', 'purchases', 1200],
  ['mealPlan', 'mealPlanAndGroceries', 1800], ['workoutPlan', 'weeklyWorkoutPlan', 800]];
const pad = (n: number) => String(n).padStart(2, '0');
export const localStamp = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
const clip = (text: string, max: number) => text.length > max ? text.slice(0, max - 16) + '…(cut)' : text;

/** The text sent to the chat. Budget: the server accepts 8000 characters per message. */
export function wrapMessage(text: string, snapshot: AppSnapshot, now = new Date()): string {
  const head = `${ACTIONS_MARK}\n${PROTOCOL}\nNow, my local time: ${localStamp(now)} (${Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'}).\nMy app data, read just now from my own account:`;
  let room = 8000 - head.length - SEPARATOR.length - text.length - 40;
  const parts: string[] = [];
  for (const [key, label, budget] of SECTIONS) {
    if (snapshot[key] === undefined) continue;
    const available = Math.min(budget, room - label.length - 3);
    const line = available >= 40 ? `\n${label}: ${clip(JSON.stringify(snapshot[key] ?? null), available)}` : `\n${label}: (left out)`;
    if (line.length > room) break;
    parts.push(line); room -= line.length;
  }
  return `${head}${parts.join('')}${SEPARATOR}${text}`.slice(0, 8000);
}
/** Longest message the person can type while suggestions are on. */
export const MAX_WRAPPED_INPUT = 2500;

/** What the person actually typed (history shows only this). */
export function shownMessage(sent: string): string {
  if (!sent.startsWith(ACTIONS_MARK)) return sent;
  const at = sent.indexOf(SEPARATOR);
  return at < 0 ? sent : sent.slice(at + SEPARATOR.length);
}

const BLOCK = /```[ \t]*cupcake-action[ \t]*\r?\n([\s\S]*?)```/g;
/** The reply without suggestion blocks, for reading and read-aloud. */
export const replyText = (reply: string) => reply.replace(BLOCK, '').replace(/\n{3,}/g, '\n\n').trim();

type Nutrients = Partial<Record<'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g', number>>;
export type PlanMeal = { name: string; items: string[]; kcal?: number };
export type PurchaseStatus = 'confirmed' | 'not_spending' | 'undecided';
export type Proposal =
  | { type: 'log_meal'; description: string; at: number; total: Nutrients }
  | { type: 'log_workout'; description: string; at: number; minutes: number; kcal: number }
  | { type: 'log_weight'; value: number; unit: 'lb' | 'kg'; at: number }
  | { type: 'log_glucose'; value: number; unit: 'mg/dL' | 'mmol/L'; method: 'fingerstick' | 'manual'; at: number }
  | { type: 'set_calorie_target'; calories: number }
  | { type: 'add_groceries'; items: string[] }
  | { type: 'record_outcome'; outcome: 'win' | 'loss'; title: string; date: string; note: string }
  | { type: 'save_meal_plan'; title: string; meals: PlanMeal[] }
  | { type: 'save_workout_plan'; plan: WorkoutPlan }
  | { type: 'set_portion'; mealId: string; fraction: 0.25 | 0.5 | 0.75 | 1 }
  | { type: 'remove_workout'; workoutId: string }
  | { type: 'review_purchase'; purchaseId: string; status: PurchaseStatus };
export type Suggestion = { index: number; proposal: Proposal | null; problem: string };
/** Kinds that change or remove something already saved. Their cards say so. */
export const EDITS = new Set<Proposal['type']>(['set_calorie_target', 'set_portion', 'remove_workout', 'review_purchase', 'save_meal_plan', 'save_workout_plan']);

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const words = (value: unknown, max: number) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim().replace(/\s+/g, ' ') : null;
const num = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
const ident = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value) ? value : null;
/** A local wall time "YYYY-MM-DDTHH:MM" (or "now"). Instants with a zone are accepted as given. */
export function parseWhen(value: unknown, now: number): number | null {
  if (value === undefined || value === 'now') return now;
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::\d\d)?$/);
  if (m) {
    const at = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return at.getMonth() === +m[2] - 1 && at.getDate() === +m[3] ? at.getTime() : null;
  }
  return /(?:Z|[+-]\d\d:\d\d)$/.test(value.trim()) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
}
const DAY = 86400000;
function timeProblem(at: number | null, now: number, maxDays: number): string {
  if (at === null) return 'The time could not be read.';
  if (at > now + 5 * 60000) return 'The time is in the future.';
  if (at < now - maxDays * DAY) return `Only the last ${maxDays} days can be logged here.`;
  return '';
}

/** Validate one block. Anything unexpected is shown as a problem, never saved. */
export function parseProposal(raw: unknown, now = Date.now()): { proposal: Proposal | null; problem: string } {
  const bad = (problem: string) => ({ proposal: null, problem });
  const ok = (proposal: Proposal) => ({ proposal, problem: '' });
  if (!record(raw) || typeof raw.type !== 'string') return bad('This suggestion was not in a format the app understands.');
  switch (raw.type) {
    case 'log_meal': {
      const description = words(raw.description, 300), at = parseWhen(raw.when, now);
      if (!description) return bad('The meal needs a description of up to 300 characters.');
      const late = timeProblem(at, now, 400); if (late) return bad(late);
      const total: Nutrients = {};
      for (const [key, max] of [['calories', 20000], ['protein_g', 2000], ['carbs_g', 3000], ['fat_g', 2000], ['fiber_g', 2000], ['sugar_g', 2000]] as const) {
        if (raw[key] === undefined || raw[key] === null) continue;
        const value = num(raw[key], 0, max); if (value === null) return bad(`The ${key.replace('_g', '')} estimate is not a usable number.`);
        total[key] = Math.round(value);
      }
      return ok({ type: 'log_meal', description, at: at as number, total });
    }
    case 'log_workout': {
      const description = words(raw.description, 300), at = parseWhen(raw.when, now);
      const minutes = num(raw.minutes, 1, 1440), kcal = num(raw.calories, 1, 5000);
      if (!description) return bad('The workout needs a description of up to 300 characters.');
      if (minutes === null) return bad('The workout needs its length in minutes.');
      if (kcal === null) return bad('The workout needs an estimated calorie burn from 1 to 5000.');
      const late = timeProblem(at, now, 31); if (late) return bad(late);
      return ok({ type: 'log_workout', description, at: at as number, minutes: Math.round(minutes), kcal: Math.round(kcal) });
    }
    case 'log_weight': {
      const unit = raw.unit === 'lb' || raw.unit === 'kg' ? raw.unit : null, at = parseWhen(raw.when, now);
      const value = num(raw.value, 1, 600);
      if (!unit || value === null) return bad('The weight needs a number and a unit (lb or kg).');
      const lb = unit === 'lb' ? value : value / 0.45359237;
      if (lb < 66 || lb > 550) return bad('That weight is outside 66 to 550 lb.');
      const late = timeProblem(at, now, 400); if (late) return bad(late);
      return ok({ type: 'log_weight', value: Math.round(value * 10) / 10, unit, at: at as number });
    }
    case 'log_glucose': {
      const unit = raw.unit === 'mg/dL' || raw.unit === 'mmol/L' ? raw.unit : null, method = raw.method === 'fingerstick' || raw.method === 'manual' ? raw.method : null;
      const value = num(raw.value, 0.1, 999), at = parseWhen(raw.when, now);
      if (!unit || value === null) return bad('The glucose reading needs a number and a unit (mg/dL or mmol/L).');
      if ((unit === 'mg/dL' ? value : value * 18.0182) >= 1000 || (unit === 'mg/dL' && value < 10)) return bad('That glucose value is outside the range the app accepts.');
      if (!method) return bad('Say whether the reading was a fingerstick or another manual meter; CGM readings arrive on their own.');
      const late = timeProblem(at, now, 400); if (late) return bad(late);
      return ok({ type: 'log_glucose', value: Math.round(value * 10) / 10, unit, method, at: at as number });
    }
    case 'set_calorie_target': {
      const calories = num(raw.calories, 800, 6000);
      return calories === null ? bad('A daily calorie target must be between 800 and 6000.') : ok({ type: 'set_calorie_target', calories: Math.round(calories) });
    }
    case 'add_groceries': {
      if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > 30) return bad('The grocery suggestion needs 1 to 30 items.');
      const items = raw.items.map(item => words(item, 120));
      if (items.some(item => !item)) return bad('Each grocery item must be a short line of text.');
      return ok({ type: 'add_groceries', items: [...new Set(items as string[])] });
    }
    case 'record_outcome': {
      const outcome = raw.outcome === 'win' ? 'win' : raw.outcome === 'setback' || raw.outcome === 'loss' ? 'loss' : null;
      const title = words(raw.title, 160), note = raw.note === undefined ? '' : words(raw.note, 2000);
      const date = typeof raw.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(raw.date) ? raw.date : null;
      if (!outcome || !title) return bad('A win or setback needs its type and a short title.');
      if (note === null) return bad('The note is too long.');
      const day = date ? Date.parse(date + 'T12:00:00') : NaN;
      if (!date || !Number.isFinite(day) || day > now + DAY || day < now - 400 * DAY) return bad('The date must be a real day in the last 400 days.');
      return ok({ type: 'record_outcome', outcome, title, date, note });
    }
    case 'save_meal_plan': {
      const title = raw.title === undefined || raw.title === null || raw.title === '' ? '' : words(raw.title, 200);
      if (title === null) return bad('The plan title is too long.');
      if (!Array.isArray(raw.meals) || !raw.meals.length || raw.meals.length > 10) return bad('A meal plan needs 1 to 10 meals.');
      const meals: PlanMeal[] = [];
      for (const meal of raw.meals) {
        const name = record(meal) ? words(meal.name, 300) : null;
        const items = record(meal) && Array.isArray(meal.items) && meal.items.length && meal.items.length <= 40 ? meal.items.map(item => words(item, 200)) : null;
        if (!name || !items || items.some(item => !item)) return bad('Each planned meal needs a name and a list of food items.');
        const kcal = record(meal) && meal.kcal != null ? num(meal.kcal, 0, 20000) : undefined;
        if (kcal === null) return bad('A planned calorie estimate is not a usable number.');
        meals.push({ name, items: items as string[], ...(kcal === undefined ? {} : { kcal: Math.round(kcal) }) });
      }
      if (JSON.stringify(meals).length > 15000) return bad('This plan is too long to save.');
      return ok({ type: 'save_meal_plan', title, meals });
    }
    case 'save_workout_plan': {
      if (!record(raw.days)) return bad('A workout plan needs days, each with workouts.');
      const plan: WorkoutPlan = { days: {} }; let count = 0;
      for (const key of Object.keys(raw.days)) if (!(WEEKDAYS as readonly string[]).includes(key)) return bad('Workout days must be mon to sun.');
      for (const key of WEEKDAYS) {
        const list = raw.days[key];
        if (list === undefined || (Array.isArray(list) && !list.length)) continue;
        if (!Array.isArray(list) || list.length > 10) return bad('Each day needs a short list of workouts.');
        const workouts = list.map(w => record(w) ? { name: words(w.name, 120), minutes: num(w.minutes, 1, 300) } : null);
        if (workouts.some(w => !w || !w.name || w.minutes === null)) return bad('Each workout needs a name and 1 to 300 minutes.');
        plan.days[key] = workouts.map(w => ({ name: w!.name!, minutes: Math.round(w!.minutes!) })); count += workouts.length;
      }
      if (!count) return bad('The workout plan has no workouts.');
      return ok({ type: 'save_workout_plan', plan });
    }
    case 'set_portion': {
      const mealId = ident(raw.mealId), fraction = [0.25, 0.5, 0.75, 1].find(value => value === raw.fraction) as 0.25 | 0.5 | 0.75 | 1 | undefined;
      if (!mealId) return bad('The portion change does not name a meal from your recent meals.');
      if (!fraction) return bad('A portion must be ¼, ½, ¾ or the full original estimate.');
      return ok({ type: 'set_portion', mealId, fraction });
    }
    case 'remove_workout': {
      const workoutId = ident(raw.workoutId);
      return workoutId ? ok({ type: 'remove_workout', workoutId }) : bad('The removal does not name a workout from your recent workouts.');
    }
    case 'review_purchase': {
      const purchaseId = ident(raw.purchaseId), status = (['confirmed', 'not_spending', 'undecided'] as const).find(value => value === raw.status);
      if (!purchaseId) return bad('The purchase change does not name a purchase from your list.');
      if (!status) return bad('A purchase can be marked confirmed, not spending, or undecided.');
      return ok({ type: 'review_purchase', purchaseId, status });
    }
    default: return bad('The assistant suggested a kind of change the app does not allow.');
  }
}

/** At most five suggestions per reply; extra blocks are reported, never saved. */
export function suggestionsFrom(reply: string, now = Date.now()): Suggestion[] {
  const found: Suggestion[] = [];
  for (const match of reply.matchAll(BLOCK)) {
    const index = found.length;
    if (index >= 5) { found.push({ index, proposal: null, problem: 'Only five suggestions per reply can be shown.' }); break; }
    let raw: unknown; try { raw = JSON.parse(match[1].trim()); } catch { found.push({ index, proposal: null, problem: 'This suggestion was not in a format the app understands.' }); continue; }
    found.push({ index, ...parseProposal(raw, now) });
  }
  return found;
}

const fmtTime = (at: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(at));
const fmtDay = (day: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(day + 'T12:00:00'));
const DAYS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
export const PORTION_LABEL = { 0.25: '¼', 0.5: '½', 0.75: '¾', 1: 'Full (original estimate)' } as const;
export const PURCHASE_LABEL: Record<PurchaseStatus, string> = { confirmed: 'Confirmed spending', not_spending: 'Not spending (ignored in totals)', undecided: 'Undecided (back to review)' };
/** Plain-language card text: a heading and the exact values that will be saved. Edit cards add
 *  the record they change once it has been looked up (`target`). */
export function describe(p: Proposal, target = ''): { heading: string; lines: string[]; save: string } {
  switch (p.type) {
    case 'log_meal': {
      const n = p.total, parts = [n.calories != null && `${n.calories} kcal`, n.protein_g != null && `${n.protein_g} g protein`, n.carbs_g != null && `${n.carbs_g} g carbs`, n.fat_g != null && `${n.fat_g} g fat`, n.fiber_g != null && `${n.fiber_g} g fiber`, n.sugar_g != null && `${n.sugar_g} g sugar`].filter(Boolean) as string[];
      return { heading: 'Log a meal', lines: [p.description, fmtTime(p.at), parts.length ? `Estimate: ${parts.join(' · ')}` : 'No nutrition estimate'], save: 'Save meal' };
    }
    case 'log_workout': return { heading: 'Log a workout', lines: [p.description, `${fmtTime(p.at)} · ${p.minutes} min`, `Estimated burn: ${p.kcal} kcal`], save: 'Save workout' };
    case 'log_weight': return { heading: 'Log a weight', lines: [`${p.value} ${p.unit}`, fmtTime(p.at)], save: 'Save weight' };
    case 'log_glucose': return { heading: 'Log a glucose reading', lines: [`${p.value} ${p.unit} · ${p.method === 'fingerstick' ? 'fingerstick' : 'manual meter'}`, fmtTime(p.at)], save: 'Save reading' };
    case 'set_calorie_target': return { heading: 'Change your daily calorie target', lines: [target || 'Looking up your current target…', `New target: ${p.calories} kcal a day, starting today. Earlier days keep their old target.`], save: 'Change target' };
    case 'add_groceries': return { heading: `Add ${p.items.length} to groceries`, lines: p.items, save: 'Add to groceries' };
    case 'record_outcome': return { heading: p.outcome === 'win' ? 'Record a win' : 'Record a setback', lines: [p.title, fmtDay(p.date), ...(p.note ? [p.note] : [])], save: p.outcome === 'win' ? 'Save win' : 'Save setback' };
    case 'save_meal_plan': return { heading: 'Replace your meal plan', lines: [...(p.title ? [p.title] : []), ...p.meals.map(m => `${m.name}${m.kcal != null ? ` · ~${m.kcal} kcal` : ''}: ${m.items.join(', ')}`), 'Your grocery list is kept.'], save: 'Save meal plan' };
    case 'save_workout_plan': return { heading: 'Replace your weekly workout plan', lines: WEEKDAYS.filter(d => p.plan.days[d]?.length).map(d => `${DAYS[d]}: ${p.plan.days[d]!.map(w => `${w.name} (${w.minutes} min)`).join(' · ')}`), save: 'Save workout plan' };
    case 'set_portion': return { heading: 'Change a meal’s portion', lines: [target || 'Looking up the meal…', `New portion: ${PORTION_LABEL[p.fraction]}`], save: 'Change portion' };
    case 'remove_workout': return { heading: 'Remove a logged workout', lines: [target || 'Looking up the workout…'], save: 'Remove workout' };
    case 'review_purchase': return { heading: 'Mark a purchase', lines: [target || 'Looking up the purchase…', `Mark as: ${PURCHASE_LABEL[p.status]}`], save: 'Mark purchase' };
  }
}

/** Stable id per reply and suggestion, so a second tap or another device replays instead of duplicating. */
export async function stableHex(seed: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cupcake-assistant-action:' + seed));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export const asUuid = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
const SOURCE = (seed: string) => ({ type: 'owner-request', reference: `cupcake-assistant:${seed}`.slice(0, 200), description: 'Suggested by the assistant in chat; saved only after the owner tapped Save.' });

type Direct = Extract<Proposal, { type: 'log_meal' | 'log_workout' | 'log_weight' | 'log_glucose' | 'record_outcome' | 'set_portion' | 'remove_workout' | 'review_purchase' | 'save_workout_plan' }>;
/** The exact existing account data request for a suggestion (groceries and meal plans need the latest plan). */
export function requestFor(p: Direct, hex: string): Record<string, unknown> {
  const id = asUuid(hex);
  switch (p.type) {
    case 'log_meal': return { action: 'food_manual_log', source: 'manual-entry', dedupeKey: id, confirmConsumed: true, description: p.description, consumedAt: new Date(p.at).toISOString(), total: p.total };
    case 'log_workout': return { action: 'exercise_log', requestId: `ex_${hex.slice(0, 32)}`, description: p.description, performedAt: new Date(p.at).toISOString(), minutes: p.minutes, kcal: p.kcal, basis: 'assistant-estimate' };
    case 'log_weight': return { action: 'weight_add', requestId: id, value: p.value, unit: p.unit, observedAt: new Date(p.at).toISOString(), source: SOURCE(id) };
    case 'log_glucose': return { action: 'glucose_add', requestId: id, value: p.value, unit: p.unit, method: p.method, observedAt: new Date(p.at).toISOString(), source: SOURCE(id) };
    case 'record_outcome': return { action: 'outcome_record', id, date: p.date, title: p.title, outcome: p.outcome, note: p.note, source: SOURCE(id), metrics: {} };
    case 'set_portion': return { action: 'food_portion_set', mealId: p.mealId, fraction: p.fraction };
    case 'remove_workout': return { action: 'exercise_delete', id: p.workoutId };
    case 'review_purchase': return { action: 'reconcile_resolve', id: p.purchaseId, status: { confirmed: 'committed', not_spending: 'ignored', undecided: 'pending' }[p.status], note: 'Marked from the assistant chat after the owner tapped confirm.' };
    case 'save_workout_plan': return { action: 'coach_plan_set', kind: 'workout_template', value: p.plan };
  }
}

/** New meal plan document: the suggested meals and title, keeping groceries and fields other screens own. */
export function mealPlanWith(latest: Record<string, unknown> | null, p: Extract<Proposal, { type: 'save_meal_plan' }>): Record<string, unknown> {
  const value: Record<string, unknown> = { ...(latest || {}), meals: p.meals };
  if (p.title) value.title = p.title; else delete value.title;
  return value;
}

/** New grocery text, or null when every item is already on the list. */
export function groceriesWith(current: string, items: string[]): { text: string; added: string[] } | null {
  const added = missingGroceryItems(current, items);
  if (!added.length) return null;
  const base = current.replace(/\s+$/, '');
  return { text: (base ? base + '\n' : '') + added.map(item => `- [ ] ${item}`).join('\n'), added };
}

/** Which screens should reload after a confirmed save. */
export const changedArea = (p: Proposal) => ({ log_glucose: 'glucose', set_calorie_target: 'food', log_meal: 'food', log_workout: 'exercise', log_weight: 'weight', add_groceries: 'plan', record_outcome: 'outcome',
  save_meal_plan: 'plan', save_workout_plan: 'workout-plan', set_portion: 'food', remove_workout: 'exercise', review_purchase: 'purchase' } as const)[p.type];

/** Compact snapshot rows (ids the assistant may name, nothing else). */
type Row = Record<string, unknown>;
const short = (value: unknown, max = 70) => typeof value === 'string' ? clip(value.replace(/\s+/g, ' ').trim(), max) : undefined;
export const compactMeals = (meals: Row[]) => meals.slice(0, 12).map(m => ({ mealId: m.id, when: short(m.consumedAt || m.createdAt, 25), what: short(m.description), kcal: record(m.total) ? m.total.calories ?? null : null }));
export const compactWorkouts = (entries: Row[]) => entries.slice(-10).map(e => ({ workoutId: e.id, when: short(e.performedAt, 25), what: short(e.description), minutes: e.minutes, kcal: e.kcal }));
export const compactPurchases = (links: Row[]) => links.slice(-12).map(l => ({ purchaseId: l.id, day: l.day, merchant: short(l.merchant, 40), amount: l.amount, status: { committed: 'confirmed', ignored: 'not_spending', pending: 'undecided' }[String(l.status)] || l.status }));
