// Words and targets for the Today dial's readings. Pure helpers: every label is derived from a value the
// dial already holds (minutes, a reading's timestamp, its method), so nothing here invents data.

/** The dial's one sleep target. The sleep arc fills to it, its scale ends at it, and every sentence is judged against it. */
export const SLEEP_TARGET_MIN = 8 * 60;
/** Fasting milestone: hours elapsed since the last logged meal. Elapsed time only; the app measures nothing metabolic. */
export const FAST_GOAL_MIN = 16 * 60;
/** A glucose reading older than this is not shown as the current number. */
export const GLUCOSE_FRESH_MS = 24 * 3600000;

/** "1 h 34 m", "34 m", "8 h 0 m". Minutes are rounded once so 59.6 never prints as "0 h 60 m". */
export function durationLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes)), h = Math.floor(total / 60), m = total % 60;
  return h ? `${h} h ${m} m` : `${m} m`;
}

/** Hours and minutes as separate numbers for the big dial figure. */
export function durationParts(minutes: number): { h: number; m: number } {
  const total = Math.max(0, Math.round(minutes));
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** How old a timestamped reading is: "just now", "25 m ago", "3 h ago", "2 d ago". */
export function ageLabel(atMs: number, nowMs: number): string {
  const minutes = Math.floor(Math.max(0, nowMs - atMs) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} m ago`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / 1440)} d ago`;
}

/** Sleep against the single target. `short` is how far under, in words; null once the target is reached. */
export function sleepVerdict(asleepMinutes: number): { reached: boolean; text: string; short: string | null } {
  const target = `${SLEEP_TARGET_MIN / 60} h`;
  if (Math.round(asleepMinutes) >= SLEEP_TARGET_MIN) return { reached: true, text: `${target} target reached`, short: null };
  const short = durationLabel(SLEEP_TARGET_MIN - Math.round(asleepMinutes));
  return { reached: false, text: `${short} under ${target} target`, short };
}

/** Where a reading on the dial came from. The dial only loads owner-entered readings; sensor readings are not in this list. */
export function glucoseSourceLabel(method?: string): string {
  const m = (method || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return m && m !== 'manual' ? `Manual reading (${m})` : 'Manual reading';
}
