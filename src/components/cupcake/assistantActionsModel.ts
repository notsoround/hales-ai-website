import { missingGroceryItems } from './groceryChecklist';

/** Labs: the assistant may SUGGEST changes in chat. Each suggestion becomes a card the
 *  signed-in owner confirms with a tap; nothing is written without that tap. The chat
 *  model itself still has no tools: it only writes a fenced `cupcake-action` block that
 *  this file validates strictly and turns into one existing, reviewed account data action.
 *  No deletes, no edits of existing records, no other account. */

export const ACTIONS_MARK = '[Cupcake app: assistant suggestions are on]';
const SEPARATOR = '\n\nMy message:\n';
const PROTOCOL = 'The Cupcake app on my screen turns a suggestion of yours into a card that I review and tap to save. '
  + 'You still cannot change anything yourself, and nothing is saved unless I tap Save. '
  + 'Only when I clearly ask you to log, add or record something, first reply to me in plain words, then end your reply with one block per change, exactly like this:\n'
  + '```cupcake-action\n{"type":"log_meal","description":"Turkey sandwich and an apple","when":"2026-01-05T12:30","calories":520,"protein_g":32}\n```\n'
  + 'Types (JSON fields):\n'
  + '- log_meal: description (what I ate, up to 300 characters), when (my local time YYYY-MM-DDTHH:MM), optional estimated calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g\n'
  + '- log_workout: description, when, minutes, calories (estimated calories burned, 1 to 5000)\n'
  + '- log_weight: value, unit ("lb" or "kg"), when. Only a number I told you; never estimate or invent a weight\n'
  + '- add_groceries: items (a list of short grocery items, at most 30)\n'
  + '- record_outcome: outcome ("win" or "setback"), title (short), date (YYYY-MM-DD), optional note\n'
  + 'Never suggest deleting or editing an existing record, and never suggest more than 5 changes in one reply. '
  + 'If a time, amount or detail is unclear, ask me instead of guessing. Do not write a block when I am only asking a question. '
  + 'Never say you logged or saved something; say it is ready for me to check and save.';

export type AppSnapshot = { mealPlan?: unknown; workoutPlan?: unknown };
const pad = (n: number) => String(n).padStart(2, '0');
export const localStamp = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;

/** The text sent to the chat. Budget: the server accepts 8000 characters per message. */
export function wrapMessage(text: string, snapshot: AppSnapshot, now = new Date()): string {
  const head = `${ACTIONS_MARK}\n${PROTOCOL}\nNow, my local time: ${localStamp(now)} (${Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'}).`;
  let state = JSON.stringify({ mealPlanAndGroceries: snapshot.mealPlan ?? null, weeklyWorkoutPlan: snapshot.workoutPlan ?? null });
  const room = 8000 - head.length - SEPARATOR.length - text.length - 80;
  if (state.length > room) state = room > 200 ? state.slice(0, room - 20) + '…(cut for length)' : '(not included: message too long)';
  return `${head}\nMy current plans, read just now from my own account: ${state}${SEPARATOR}${text}`;
}
/** Longest message the person can type while suggestions are on. */
export const MAX_WRAPPED_INPUT = 8000 - ACTIONS_MARK.length - PROTOCOL.length - 400;

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
export type Proposal =
  | { type: 'log_meal'; description: string; at: number; total: Nutrients }
  | { type: 'log_workout'; description: string; at: number; minutes: number; kcal: number }
  | { type: 'log_weight'; value: number; unit: 'lb' | 'kg'; at: number }
  | { type: 'add_groceries'; items: string[] }
  | { type: 'record_outcome'; outcome: 'win' | 'loss'; title: string; date: string; note: string };
export type Suggestion = { index: number; proposal: Proposal | null; problem: string };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const words = (value: unknown, max: number) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim().replace(/\s+/g, ' ') : null;
const num = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
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
      return { proposal: { type: 'log_meal', description, at: at as number, total }, problem: '' };
    }
    case 'log_workout': {
      const description = words(raw.description, 300), at = parseWhen(raw.when, now);
      const minutes = num(raw.minutes, 1, 1440), kcal = num(raw.calories, 1, 5000);
      if (!description) return bad('The workout needs a description of up to 300 characters.');
      if (minutes === null) return bad('The workout needs its length in minutes.');
      if (kcal === null) return bad('The workout needs an estimated calorie burn from 1 to 5000.');
      const late = timeProblem(at, now, 31); if (late) return bad(late);
      return { proposal: { type: 'log_workout', description, at: at as number, minutes: Math.round(minutes), kcal: Math.round(kcal) }, problem: '' };
    }
    case 'log_weight': {
      const unit = raw.unit === 'lb' || raw.unit === 'kg' ? raw.unit : null, at = parseWhen(raw.when, now);
      const value = num(raw.value, 1, 600);
      if (!unit || value === null) return bad('The weight needs a number and a unit (lb or kg).');
      const lb = unit === 'lb' ? value : value / 0.45359237;
      if (lb < 66 || lb > 550) return bad('That weight is outside 66 to 550 lb.');
      const late = timeProblem(at, now, 400); if (late) return bad(late);
      return { proposal: { type: 'log_weight', value: Math.round(value * 10) / 10, unit, at: at as number }, problem: '' };
    }
    case 'add_groceries': {
      if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > 30) return bad('The grocery suggestion needs 1 to 30 items.');
      const items = raw.items.map(item => words(item, 120));
      if (items.some(item => !item || /[\r\n]/.test(item))) return bad('Each grocery item must be a short line of text.');
      return { proposal: { type: 'add_groceries', items: [...new Set(items as string[])] }, problem: '' };
    }
    case 'record_outcome': {
      const outcome = raw.outcome === 'win' ? 'win' : raw.outcome === 'setback' || raw.outcome === 'loss' ? 'loss' : null;
      const title = words(raw.title, 160), note = raw.note === undefined ? '' : words(raw.note, 2000);
      const date = typeof raw.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(raw.date) ? raw.date : null;
      if (!outcome || !title) return bad('A win or setback needs its type and a short title.');
      if (note === null) return bad('The note is too long.');
      const day = date ? Date.parse(date + 'T12:00:00') : NaN;
      if (!date || !Number.isFinite(day) || day > now + DAY || day < now - 400 * DAY) return bad('The date must be a real day in the last 400 days.');
      return { proposal: { type: 'record_outcome', outcome, title, date, note }, problem: '' };
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
/** Plain-language card text: a heading and the exact values that will be saved. */
export function describe(p: Proposal): { heading: string; lines: string[]; save: string } {
  switch (p.type) {
    case 'log_meal': {
      const n = p.total, parts = [n.calories != null && `${n.calories} kcal`, n.protein_g != null && `${n.protein_g} g protein`, n.carbs_g != null && `${n.carbs_g} g carbs`, n.fat_g != null && `${n.fat_g} g fat`, n.fiber_g != null && `${n.fiber_g} g fiber`, n.sugar_g != null && `${n.sugar_g} g sugar`].filter(Boolean) as string[];
      return { heading: 'Log a meal', lines: [p.description, fmtTime(p.at), parts.length ? `Estimate: ${parts.join(' · ')}` : 'No nutrition estimate'], save: 'Save meal' };
    }
    case 'log_workout': return { heading: 'Log a workout', lines: [p.description, `${fmtTime(p.at)} · ${p.minutes} min`, `Estimated burn: ${p.kcal} kcal`], save: 'Save workout' };
    case 'log_weight': return { heading: 'Log a weight', lines: [`${p.value} ${p.unit}`, fmtTime(p.at)], save: 'Save weight' };
    case 'add_groceries': return { heading: `Add ${p.items.length} to groceries`, lines: p.items, save: 'Add to groceries' };
    case 'record_outcome': return { heading: p.outcome === 'win' ? 'Record a win' : 'Record a setback', lines: [p.title, fmtDay(p.date), ...(p.note ? [p.note] : [])], save: p.outcome === 'win' ? 'Save win' : 'Save setback' };
  }
}

/** Stable id per reply and suggestion, so a second tap or another device replays instead of duplicating. */
export async function stableHex(seed: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cupcake-assistant-action:' + seed));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export const asUuid = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
const SOURCE = (seed: string) => ({ type: 'owner-request', reference: `cupcake-assistant:${seed}`.slice(0, 200), description: 'Suggested by the assistant in chat; saved only after the owner tapped Save.' });

/** The exact existing account data request for a suggestion (groceries need the latest plan). */
export function requestFor(p: Exclude<Proposal, { type: 'add_groceries' }>, hex: string): Record<string, unknown> {
  const id = asUuid(hex);
  switch (p.type) {
    case 'log_meal': return { action: 'food_manual_log', source: 'manual-entry', dedupeKey: id, confirmConsumed: true, description: p.description, consumedAt: new Date(p.at).toISOString(), total: p.total };
    case 'log_workout': return { action: 'exercise_log', requestId: `ex_${hex.slice(0, 32)}`, description: p.description, performedAt: new Date(p.at).toISOString(), minutes: p.minutes, kcal: p.kcal, basis: 'assistant-estimate' };
    case 'log_weight': return { action: 'weight_add', requestId: id, value: p.value, unit: p.unit, observedAt: new Date(p.at).toISOString(), source: SOURCE(id) };
    case 'record_outcome': return { action: 'outcome_record', id, date: p.date, title: p.title, outcome: p.outcome, note: p.note, source: SOURCE(id), metrics: {} };
  }
}

/** New grocery text, or null when every item is already on the list. */
export function groceriesWith(current: string, items: string[]): { text: string; added: string[] } | null {
  const added = missingGroceryItems(current, items);
  if (!added.length) return null;
  const base = current.replace(/\s+$/, '');
  return { text: (base ? base + '\n' : '') + added.map(item => `- [ ] ${item}`).join('\n'), added };
}

/** Which screens should reload after a confirmed save. */
export const changedArea = (p: Proposal) => ({ log_meal: 'food', log_workout: 'exercise', log_weight: 'weight', add_groceries: 'plan', record_outcome: 'outcome' } as const)[p.type];
