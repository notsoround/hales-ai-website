/** Weekly workout plan (Labs). Stored by the existing `coach_plan_set` kind `workout_template`:
 *  `{ days: { mon..sun: [{ name, minutes 1–300 }] } }`. Text in, preview, then the owner saves. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = typeof WEEKDAYS[number];
export const DAY_NAMES: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export type Workout = { name: string; minutes: number };
export type WorkoutPlan = { days: Partial<Record<Weekday, Workout[]>> };
export type ParsedRoutine = { plan: WorkoutPlan; workouts: number; rest: Weekday[]; problems: string[]; notes: string[] };

const MAX_PER_DAY = 12, MAX_NAME = 300;
const BULLET = /^(?:[-*+•▪◦]|\d+[.)]|\[[ xX]\])\s+(.*)$/;
const DAY = /^(?:#{1,6}\s*)?(?:(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\.?|day\s*([1-7]))(?![a-z])\s*(.*)$/i;
const OTHER_HEADING = /^(?:#{1,6}\s+\S.*|[^.?!]{1,80}:)$/;
const MINUTES = /(\d{1,3}(?:\.\d+)?)\s*(?:-\s*)?(min(?:ute)?s?|h(?:ou)?rs?|hours?|h)\b\.?/gi;
const REST = /^(?:rest|off|recovery|rest day|day off)\b/i;
const tidy = (text: string) => text.replace(/\(\s*\)/g, '').replace(/^[\s,·:;–—-]+|[\s,·:;–—(-]+$/g, '').replace(/\s{2,}/g, ' ').trim();

/** The last time in a line ("Bench 3×8 (45 min)" → 45), and the line without it. */
function minutesOf(text: string): { minutes: number | null; rest: string } {
  const found = [...text.matchAll(MINUTES)].pop();
  if (!found || found.index === undefined) return { minutes: null, rest: text };
  const amount = Number(found[1]) * (/^h/i.test(found[2]) ? 60 : 1);
  return { minutes: Math.round(amount), rest: tidy(text.slice(0, found.index) + ' ' + text.slice(found.index + found[0].length)) };
}

/** Day headings ("Monday — Upper body 45 min:", "Day 2", "Wed: Rest") start a day. Lines under a
 *  day with their own minutes are separate workouts; lines without minutes join the day's session. */
export function parseRoutine(text: string): ParsedRoutine {
  const days: Partial<Record<Weekday, Workout[]>> = {}, rest = new Set<Weekday>(), problems: string[] = [];
  let skipped = 0, day: Weekday | null = null, title = '', sessionMinutes: number | null = null, loose: string[] = [];
  const add = (key: Weekday, workout: Workout) => {
    const list = days[key] ||= [];
    if (workout.minutes < 1 || workout.minutes > 300) { problems.push(`${DAY_NAMES[key]}: “${workout.name}” is ${workout.minutes} minutes. Use 1 to 300.`); return; }
    if (list.length >= MAX_PER_DAY) { problems.push(`${DAY_NAMES[key]}: only ${MAX_PER_DAY} workouts fit in one day.`); return; }
    list.push({ name: workout.name.slice(0, MAX_NAME), minutes: workout.minutes });
  };
  const close = () => {
    if (!day) return;
    if (loose.length || (title && !REST.test(title))) {
      const name = tidy(title && loose.length ? `${title}: ${loose.join(' · ')}` : title || loose.join(' · '));
      if (sessionMinutes) add(day, { name: name || 'Workout', minutes: sessionMinutes });
      else problems.push(`${DAY_NAMES[day]}: add how many minutes “${name.slice(0, 60)}${name.length > 60 ? '…' : ''}” takes, such as “45 min”.`);
    } else if (title && REST.test(title) && !days[day]?.length) rest.add(day);
    day = null; title = ''; sessionMinutes = null; loose = [];
  };
  for (const raw of text.replace(/\*\*|__/g, '').split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line || /^([-*_=])\1{2,}$/.test(line)) continue;
    const bullet = line.match(BULLET), heading = !bullet && line.match(DAY);
    if (heading) {
      close();
      day = heading[1] ? heading[1].slice(0, 3).toLowerCase() as Weekday : WEEKDAYS[Number(heading[2]) - 1];
      const timed = minutesOf(tidy(heading[3].replace(/:\s*$/, '')));
      title = timed.rest; sessionMinutes = timed.minutes;
      continue;
    }
    if (!bullet && OTHER_HEADING.test(line)) { close(); skipped++; continue; } // "Notes:" ends the day.
    const item = tidy(bullet ? bullet[1] : line);
    if (!day) { skipped++; continue; }
    if (!item) continue;
    const timed = minutesOf(item);
    if (timed.minutes !== null && timed.rest) add(day, { name: timed.rest, minutes: timed.minutes });
    else if (REST.test(item) && !loose.length) title = title || item;
    else loose.push(item);
  }
  close();
  const notes = skipped ? [`${skipped} ${skipped === 1 ? 'line' : 'lines'} outside a day ${skipped === 1 ? 'was' : 'were'} left out. Start each day with its name, such as “Monday:”.`] : [];
  for (const key of WEEKDAYS) if (days[key] && !days[key]!.length) delete days[key];
  const ordered: WorkoutPlan = { days: {} };
  for (const key of WEEKDAYS) if (days[key]) ordered.days[key] = days[key];
  return { plan: ordered, workouts: countWorkouts(ordered), rest: WEEKDAYS.filter(key => rest.has(key) && !ordered.days[key]), problems, notes };
}
export const countWorkouts = (plan: WorkoutPlan | null) => plan ? WEEKDAYS.reduce((sum, key) => sum + (plan.days[key]?.length || 0), 0) : 0;

/** A saved plan as editable text that parses back to the same plan. */
export function routineText(plan: WorkoutPlan | null): string {
  if (!plan) return '';
  return WEEKDAYS.filter(key => plan.days[key]?.length).map(key => `${DAY_NAMES[key]}:\n${plan.days[key]!.map(w => `- ${w.name} (${w.minutes} min)`).join('\n')}`).join('\n\n');
}

/** Read the server document defensively; anything unexpected is treated as no plan. */
export function parseWorkoutPlan(value: unknown): WorkoutPlan | null {
  if (!value || typeof value !== 'object' || !('days' in value)) return null;
  const days = (value as { days: unknown }).days;
  if (!days || typeof days !== 'object') return null;
  const plan: WorkoutPlan = { days: {} };
  for (const key of WEEKDAYS) {
    const list = (days as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    const workouts = list.filter((w): w is Workout => !!w && typeof w === 'object' && typeof (w as Workout).name === 'string' && typeof (w as Workout).minutes === 'number')
      .map(w => ({ name: w.name, minutes: w.minutes }));
    if (workouts.length) plan.days[key] = workouts;
  }
  return plan;
}
export const sameWorkoutPlan = (a: WorkoutPlan | null, b: WorkoutPlan | null) => JSON.stringify(routineText(a)) === JSON.stringify(routineText(b));

/** Keep only day headings and list items from an assistant reply, so greetings and the closing
 *  question never become workouts. Returned as text for the owner to review in the editor. */
export function routineFromReply(reply: string): string {
  const lines = reply.replace(/\*\*|__/g, '').split(/\r\n|\n|\r/).map(line => line.trim()).filter(line =>
    BULLET.test(line) || OTHER_HEADING.test(line) || DAY.test(line));
  const first = lines.findIndex(line => !BULLET.test(line) && DAY.test(line));
  return first < 0 ? '' : lines.slice(first).join('\n');
}
