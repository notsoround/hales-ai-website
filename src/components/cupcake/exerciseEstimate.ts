// Ported from cupcake-opolis ui/src/pages/nutrition/exercise-estimate.ts (pure, no deps), extended Nov 2026.
/**
 * Deterministic burn estimator for plain-language exercise descriptions.
 * Pure, no I/O, works offline. Used by the Today exercise quick-log.
 *
 *   "yesterday I did the McGill big three but only about half, first time"
 *   "I did 10 kettlebell squats"
 *   "KB swings 3x15 @ 25 lb, side plank 3x10s each side, 20 min rowing"
 *
 * Named routines (McGill Big Three) expand to their standard prescription.
 * Every other clause is matched to an activity with a MET value (Compendium of
 * Physical Activities, rounded). Clock time comes from an explicit duration,
 * distance/steps at a typical pace, sets (~1.75 min per set, rest included),
 * holds (hold time + a short reset), or a bare rep count (work + ~1 min setup).
 * Work runs at the activity MET; rest and setup at a light MET.
 *
 * Only the *net* cost above resting is counted, and it is a positive burn:
 *   kcal = (MET − 1) × bodyWeightKg × hours
 * because the baseline TDEE burn on the curve already includes resting energy.
 *
 * Partial sessions ("about half", "partial", "60%", "only did 2 of 3 sets")
 * scale sets, minutes and kcal. "first time" is noted, never changes the math.
 */

export const DEFAULT_BODY_WEIGHT_KG = 80;

type Activity = {
  id: string;
  /** Lower-case regex, matched against the clause. */
  pattern: RegExp;
  met: number;
  /** Seconds of work per rep, for rep-counted movements. */
  secondsPerRep?: number;
  /** Minutes per mile, for distance-based movements. */
  minutesPerMile?: number;
  /** Assumed minutes when only the activity is named. */
  defaultMinutes?: number;
  /** Isometric or hold-friendly: "30s", "3x10s holds". */
  hold?: boolean;
};

// Order matters: more specific patterns first.
const ACTIVITIES: readonly Activity[] = [
  { id: "curl-ups", pattern: /curl[\s-]?ups?/, met: 2.8, secondsPerRep: 3, hold: true },
  { id: "side plank", pattern: /side[\s-]?planks?|sideways (?:plank|hold)/, met: 3.5, defaultMinutes: 1, hold: true },
  { id: "bird dog", pattern: /bird[\s-]?dogs?/, met: 2.8, secondsPerRep: 3, hold: true },
  { id: "dead bug", pattern: /dead[\s-]?bugs?/, met: 2.8, secondsPerRep: 3, hold: true },
  { id: "hollow hold", pattern: /hollow(?:[\s-]?body)?(?:[\s-]?holds?)?/, met: 3.5, defaultMinutes: 1, hold: true },
  { id: "glute bridge", pattern: /glute[\s-]?bridges?|\bbridges?\b|hip[\s-]?thrusts?/, met: 3.5, secondsPerRep: 3, hold: true },
  { id: "push-ups", pattern: /push[\s-]?ups?|press[\s-]?ups?/, met: 8, secondsPerRep: 2 },
  { id: "pull-ups", pattern: /pull[\s-]?ups?|chin[\s-]?ups?/, met: 8, secondsPerRep: 3 },
  { id: "burpees", pattern: /burpees?/, met: 8, secondsPerRep: 4 },
  { id: "jumping jacks", pattern: /jumping[\s-]?jacks?|star[\s-]?jumps?/, met: 8, secondsPerRep: 1 },
  { id: "sit-ups", pattern: /sit[\s-]?ups?|crunch(?:es)?/, met: 3.8, secondsPerRep: 2.5 },
  { id: "squats", pattern: /squats?/, met: 5, secondsPerRep: 4 },
  { id: "lunges", pattern: /lunges?|split squats?|step[\s-]?ups?/, met: 4, secondsPerRep: 4 },
  { id: "plank", pattern: /planks?/, met: 3.8, defaultMinutes: 1, hold: true },
  { id: "wall sit", pattern: /wall[\s-]?sits?/, met: 4, defaultMinutes: 1, hold: true },
  { id: "kettlebell", pattern: /kettle[\s-]?bells?|\bkbs?\b|swings?\b|snatch(?:es)?|turkish get[\s-]?ups?|clean and press/, met: 6, secondsPerRep: 3 },
  { id: "jump rope", pattern: /jump(?:ing)?[\s-]?rope|skipping/, met: 11, secondsPerRep: 0.5 },
  // Strength rows (with an implement, or written as sets/reps) before the rowing machine.
  {
    id: "weights",
    pattern:
      /(?:dumbbell|\bdbs?|barbell|\bbb|cable|bent[\s-]?over|upright|seated|renegade|single[\s-]?arm|one[\s-]?arm|t[\s-]?bar|inverted|pendlay)\s+rows?\b|\brows?\b(?=.*(?:\d+\s*x\s*\d+|\d+\s*sets?\b|\d+\s*reps?\b))/,
    met: 5,
    secondsPerRep: 3,
  },
  { id: "rowing", pattern: /row(?:ing)?[\s-]?machine|\berg\b|rower|\brow(?:ing|ed)?\b/, met: 7, minutesPerMile: 9, defaultMinutes: 15 },
  {
    id: "weights",
    pattern:
      /weights?|lift(?:ing|ed)?|deadlifts?|\brdls?\b|bench|curls?\b|\bpress(?:es)?\b|\bfl(?:y|ys|ies|yes)\b|raises?|extensions?|shrugs?|dumb[\s-]?bells?|\bdbs?\b|barbell|\brows?\b|carr(?:y|ies)|thrusters?/,
    met: 5,
    secondsPerRep: 3,
  },
  { id: "running", pattern: /\brun(?:s|ning)?\b|\bran\b|jog(?:s|ging|ged)?/, met: 9.8, minutesPerMile: 10 },
  { id: "cycling", pattern: /cycl(?:e|ing|ed)|bik(?:e|ing|ed)|spin(?:ning)?|peloton/, met: 7.5, minutesPerMile: 4 },
  { id: "swimming", pattern: /swim(?:s|ming)?|swam|\blaps?\b/, met: 7, minutesPerMile: 35 },
  { id: "hiking", pattern: /hik(?:e|ing|ed)/, met: 6, minutesPerMile: 25 },
  { id: "stairs", pattern: /stairs?|stair[\s-]?master|stepper/, met: 8 },
  { id: "elliptical", pattern: /elliptical|cross[\s-]?trainer/, met: 5 },
  { id: "hiit", pattern: /hiit|circuit|tabata|crossfit/, met: 8 },
  { id: "yoga", pattern: /yoga|pilates/, met: 2.8 },
  { id: "stretching", pattern: /stretch(?:ing|ed)?|mobility/, met: 2.3 },
  { id: "dancing", pattern: /danc(?:e|ing|ed)/, met: 5 },
  { id: "tennis", pattern: /tennis|pickleball|squash|padel/, met: 7 },
  { id: "basketball", pattern: /basketball|soccer|football/, met: 7 },
  { id: "golf", pattern: /golf/, met: 4.8 },
  { id: "walking", pattern: /walk(?:s|ing|ed)?|steps?\b|stroll/, met: 3.5, minutesPerMile: 20 },
  { id: "workout", pattern: /work(?:ed)?[\s-]?out|exercis(?:e|ed|ing)|training|gym/, met: 5, defaultMinutes: 30 },
];

/** A routine item before any partial scaling. Reps are per set; `scheme` is a descending pyramid like "5/3/1". */
type RoutineItem = { activity: string; name: string; met: number; sets: number; repsPerSet: number; scheme?: string; holdSeconds?: number; side?: "each"; minutes: number };
export type ExerciseRoutine = { id: string; name: string; pattern: RegExp; items: readonly RoutineItem[] };

/** McGill Big Three: curl-up, side plank, bird dog; 10 s holds in a 5/3/1 descending pyramid, both sides. ~5 min. */
export const ROUTINES: readonly ExerciseRoutine[] = [
  {
    id: "mcgill-big-three",
    name: "McGill Big Three",
    pattern: /\bmc\s?gill(?:'s)?(?:\s+big\s*(?:3|three))?\b|\bbig\s*(?:3|three)\b(?=.*\b(?:core|back|mcgill|curl|plank|bird)\b)|\bbig\s*(?:3|three)\s+(?:core|back)/,
    items: [
      { activity: "curl-ups", name: "modified curl-up", met: 2.8, sets: 3, repsPerSet: 3, scheme: "5/3/1", holdSeconds: 10, minutes: 1.5 },
      { activity: "side plank", name: "side plank", met: 3.5, sets: 3, repsPerSet: 3, scheme: "5/3/1", holdSeconds: 10, side: "each", minutes: 1.75 },
      { activity: "bird dog", name: "bird dog", met: 2.8, sets: 3, repsPerSet: 3, scheme: "5/3/1", holdSeconds: 10, side: "each", minutes: 1.75 },
    ],
  },
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100, half: 0.5,
};

const REST_MET = 2.5; // Light movement between sets and while setting up.
/** Wall-clock minutes per written set (work + rest) when no total time is given. */
export const MINUTES_PER_SET = 1.75;
/** Setup/transition time added to a bare rep count ("10 kettlebell squats"). */
export const SETUP_MINUTES = 1;
/** Reset between holds, per hold set and side. */
const HOLD_RESET_MINUTES = 0.25;
const STEPS_PER_MINUTE = 100;
/** Assumed implement weight when none is written (Matt's usual: 25 lb KB, 15 lb DBs). Intensity only; never stored. */
const IMPLIED_LOAD_KG: ReadonlyArray<[RegExp, number]> = [[/kettle[\s-]?bells?|\bkbs?\b|swings?\b/, 11.34], [/dumb[\s-]?bells?|\bdbs?\b/, 6.8]];

export type ExerciseEstimateItem = {
  activity: string;
  /** What was written, without numbers or units ("kettlebell swings"); falls back to the activity id. */
  name: string;
  /** Minutes on the clock: work plus rest/setup. */
  minutes: number;
  /** Total reps across all sets (per side when `side` is "each"). */
  reps?: number;
  sets?: number;
  loadKg?: number;
  holdSeconds?: number;
  side?: "each";
  /** Descending pyramid, e.g. "5/3/1" (reps per set). */
  scheme?: string;
  kcal: number;
  /** True when the activity or its amount had to be assumed. */
  assumed: boolean;
};

export type ExerciseWhen = "now" | "earlier" | "yesterday";
export type DetectedWhen = { when: Exclude<ExerciseWhen, "now">; time: string | null; phrase: string };

export type ExerciseEstimate = {
  kcal: number;
  minutes: number;
  items: ExerciseEstimateItem[];
  /** Clauses that matched no activity and were not counted (narrative filler is dropped once something matched). */
  unrecognized: string[];
  /** Fraction of the prescribed/described work actually done (1 = all of it). */
  fraction: number;
  /** Where the fraction came from: the text, the form's Partial control, or neither. */
  fractionSource: "text" | "manual" | null;
  /** Human notes for the saved entry, e.g. "partial (50%)", "first time". */
  notes: string[];
  routine: string | null;
  /** Backdating words found in the text ("yesterday", "this morning"). */
  when: DetectedWhen | null;
  source: "local-met";
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/×/g, "x")
    .replace(/(\d),(\d{3})\b/g, "$1$2")
    // Rowing/running distances in metres ("2000m", "500 meters"); small numbers stay minutes.
    .replace(/(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)\b/g, (whole, n: string) => (Number(n) >= 100 ? `${Number(n) / 1000} km` : whole))
    .replace(/\bhalf (?:an )?hour\b/g, "30 min")
    .replace(/\b(?:an|one) hour\b/g, "60 min")
    .replace(/\bquarter (?:of )?(?:an )?hour\b/g, "15 min")
    .replace(
      /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred)\b(?=\s*(?:an?\s+)?(?:hours?|hrs?|minutes?|mins?|seconds?|secs?|miles?|mi|km|k|sets?|reps?|rounds?|x\b|push|pull|sit|squat|lunge|burpee|jumping|kettle|kb|swing|goblet|curl|bird|dead|plank|side))/g,
      (word) => String(NUMBER_WORDS[word] ?? word),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function splitClauses(text: string): string[] {
  return text
    .split(/[,;:\n+.]|\band then\b|\bthen\b|\band\b|\bplus\b|\bfollowed by\b|\bbut\b|\bso\b/)
    .map((part) => part.trim())
    .filter((part) => /[a-z]/.test(part));
}

/** Words that set the form's When field: "yesterday", "this morning", "last night", "earlier", "at 7 am". */
export function detectWhen(description: string): DetectedWhen | null {
  const t = description.toLowerCase();
  const clock = /\b(?:at|around|about)?\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/.exec(t);
  const explicit = clock ? `${String((Number(clock[1]) % 12) + (clock[3] === "p" ? 12 : 0)).padStart(2, "0")}:${clock[2] ?? "00"}` : null;
  const rules: ReadonlyArray<[RegExp, DetectedWhen["when"], string | null]> = [
    [/\byesterday morning\b/, "yesterday", "08:00"],
    [/\byesterday afternoon\b/, "yesterday", "15:00"],
    [/\b(?:yesterday evening|last night|last evening)\b/, "yesterday", "19:00"],
    [/\byesterday\b/, "yesterday", null],
    [/\bthis morning\b/, "earlier", "08:00"],
    [/\bthis afternoon\b/, "earlier", "14:00"],
    [/\b(?:this evening|tonight)\b/, "earlier", "19:00"],
    [/\b(?:earlier(?: today)?|before (?:breakfast|lunch|work))\b/, "earlier", null],
  ];
  for (const [pattern, when, time] of rules) {
    const m = pattern.exec(t);
    if (m) return { when, time: explicit ?? time, phrase: m[0] };
  }
  return explicit ? { when: "earlier", time: explicit, phrase: clock![0].trim() } : null;
}

/** "about half", "partial", "60%", "only did 2 of 3 sets" → fraction of the work done. */
export function detectFraction(text: string): number | null {
  const pct = /(\d{1,3})\s*%/.exec(text);
  if (pct && Number(pct[1]) > 0 && Number(pct[1]) < 100) return Number(pct[1]) / 100;
  const of = /\bonly (?:did|got through|managed) (\d+) (?:of|out of) (\d+)\b/.exec(text);
  if (of && Number(of[2]) > 0 && Number(of[1]) < Number(of[2])) return Number(of[1]) / Number(of[2]);
  if (/three[\s-]quarters|¾/.test(text)) return 0.75;
  if (/\b(?:about |roughly |around |maybe |like |only |just )?(?:half|halfway)\b/.test(text)) return 0.5;
  if (/\b(?:a |one[\s-])?third\b/.test(text)) return 1 / 3;
  if (/\b(?:a |one[\s-])?quarter\b/.test(text)) return 0.25;
  if (/\bpartial(?:ly)?\b|\bdidn'?t finish\b|\bcut (?:it )?short\b/.test(text)) return 0.5;
  return null;
}

function detectNotes(text: string): string[] {
  return /\bfirst (?:time|go|attempt|try)\b|\bnever done\b|\bnew to (?:this|it)\b/.test(text) ? ["first time"] : [];
}

function parseDurationMinutes(clause: string): number | null {
  const clock = /\b(\d{1,2}):([0-5]\d)\b/.exec(clause);
  if (clock && !/[ap]\.?m\b/.test(clause.slice(clock.index))) return Number(clock[1]) + Number(clock[2]) / 60;
  let total = 0;
  let found = false;
  const unit = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?|s\b)/g;
  for (const match of clause.matchAll(unit)) {
    const value = Number(match[1]);
    const label = match[2] ?? "";
    found = true;
    total += label.startsWith("h") ? value * 60 : label.startsWith("s") ? value / 60 : value;
  }
  return found ? total : null;
}

function parseDistanceMiles(clause: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(miles?|mi\b|km\b|kilometers?|kilometres?|k\b)/.exec(clause);
  if (!match) return null;
  const value = Number(match[1]);
  return (match[2] ?? "").startsWith("m") ? value : value * 0.621371;
}

function parseSteps(clause: string): number | null {
  const match = /(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*steps?\b/.exec(clause);
  if (!match) return null;
  const value = Number((match[1] ?? "").replace(/,/g, ""));
  return match[2] ? value * 1000 : value;
}

/** "3x10s", "3 x 30 sec holds", "2 sets of 20 seconds" → sets + hold seconds. */
function parseHoldSets(clause: string): { sets: number; seconds: number } | null {
  const grid = /(\d+)\s*x\s*(\d+)\s*(?:s|secs?|seconds?)\b/.exec(clause) ?? /(\d+)\s*sets?\s*(?:of\s*)?(\d+)\s*(?:s|secs?|seconds?)\b/.exec(clause);
  return grid ? { sets: Number(grid[1]), seconds: Number(grid[2]) } : null;
}

function parseSetsReps(clause: string): { sets: number; reps: number } | null {
  const grid = /(\d+)\s*x\s*(\d+)\b(?!\s*(?:s|secs?|seconds?)\b)/.exec(clause);
  if (grid) return { sets: Number(grid[1]), reps: Number(grid[2]) };
  const words = /(\d+)\s*sets?\s*(?:of\s*)?(\d+)\b(?!\s*(?:s|secs?|seconds?)\b)/.exec(clause);
  if (words) return { sets: Number(words[1]), reps: Number(words[2]) };
  const setsOnly = /(\d+)\s*(?:sets?|rounds?)\b/.exec(clause);
  if (setsOnly) return { sets: Number(setsOnly[1]), reps: 0 };
  const repsOnly = /(\d+)\s*reps?\b/.exec(clause) ?? /\bx\s*(\d+)\b/.exec(clause);
  if (repsOnly) return { sets: 1, reps: Number(repsOnly[1]) };
  return null;
}

function parseLoadKg(clause: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|#|kgs?|kilos?)/.exec(clause);
  if (!match) return null;
  const value = Number(match[1]);
  return (match[2] ?? "").startsWith("k") ? value : value * 0.45359237;
}

/** A bare count ("10 kettlebell squats"), ignoring numbers that carry units. */
function parseBareCount(clause: string): number | null {
  const stripped = clause
    .replace(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?|s\b|miles?|mi\b|km\b|k\b|lbs?|pounds?|#|kgs?|kilos?|steps?|%)/g, " ")
    .replace(/\d+\s*x\s*\d+/g, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\b/g, " ");
  const match = /\b(\d+)\b/.exec(stripped);
  return match ? Number(match[1]) : null;
}

const perSide = (clause: string) => /\b(?:each|per|both)\s+(?:side|sides|leg|legs|arm|arms)\b|\/\s*side\b|\ba side\b/.test(clause);

/** "kettlebell swings 3x15 at 35 lb" -> "kettlebell swings". */
function clauseName(clause: string, fallback: string): string {
  const name = clause
    .replace(/\b(?:yesterday|today|this morning|this afternoon|this evening|last night|tonight|earlier)\b/g, " ")
    .replace(/^(?:(?:i|we)\s+)?(?:(?:also|then|just|only)\s+)?(?:did|do|done|had|went|got in|finished|completed|knocked out)\s+/, "")
    .replace(/\s(?:with|using|at|@)\s.*$|@.*$/, " ")
    .replace(/\b(?:each|per|both)\s+(?:side|sides|leg|legs|arm|arms)\b|\/\s*side\b/g, " ")
    .replace(/\d+(?:\.\d+)?\s*x\s*\d+\s*(?:s|secs?|seconds?)?\b/g, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?|s\b|miles?|mi\b|km\b|k\b|lbs?|pounds?|#|kgs?|kilos?|steps?|sets?(?:\s*of)?|reps?|rounds?)?/g, " ")
    .replace(/\b(?:of|for|x|reps?|sets?|holds?|about|around|some|the|a|an|on|my)\b/g, " ")
    .replace(/[^a-z\s'/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (name || fallback).slice(0, 60);
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const netPerMinute = (met: number, weightKg: number) => ((met - 1) * weightKg) / 60;

type ContextLoads = { kb?: number; db?: number };
const KB_WORDS = /kettle[\s-]?bells?|\bkbs?\b|swings?\b|goblet/;
const DB_WORDS = /dumb[\s-]?bells?|\bdbs?\b/;
/** "25 lb KB / 15 lb DBs" — an equipment note, not an exercise. Returns its loads, or null if the clause is more than that. */
function equipmentNote(clause: string): ContextLoads | null {
  const loads: ContextLoads = {};
  for (const m of clause.matchAll(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|#|kgs?|kilos?)\s*(kettle[\s-]?bells?|kbs?|dumb[\s-]?bells?|dbs?)\b/g)) {
    const kg = m[2].startsWith("k") ? Number(m[1]) : Number(m[1]) * 0.45359237;
    if (/^(?:kettle|kb)/.test(m[3])) loads.kb = kg; else loads.db = kg;
  }
  const left = clause.replace(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|#|kgs?|kilos?)/g, " ").replace(/kettle[\s-]?bells?|\bkbs?\b|dumb[\s-]?bells?|\bdbs?\b|\band\b|\bwith\b|[/&]/g, " ").trim();
  return left === "" && (loads.kb !== undefined || loads.db !== undefined) ? loads : null;
}

const FILLER = /\b(?:i|i'?ve|we|did|do|done|doing|the|a|an|it|that|this|then|also|just|only|some|yesterday|today|morning|afternoon|evening|last|night|tonight|earlier|forth|back|again|really|pretty|kind|of|sort|like|um|uh)\b/g;
/** Worth showing as "not counted"? Numbers, or a short phrase that is more than filler. */
const meaningful = (clause: string) => /\d/.test(clause) || (() => { const words = clause.replace(FILLER, " ").replace(/[^a-z\s'-]/g, " ").trim().split(/\s+/).filter(Boolean); return words.length > 0 && words.length <= 4; })();

function estimateClause(clause: string, weightKg: number, context: ContextLoads = {}): ExerciseEstimateItem | null {
  const activity = ACTIVITIES.find((entry) => entry.pattern.test(clause));
  if (!activity) return null;
  const loadKg = parseLoadKg(clause) ?? (KB_WORDS.test(clause) ? context.kb : DB_WORDS.test(clause) ? context.db : undefined) ?? undefined;
  const intensityLoad = loadKg ?? IMPLIED_LOAD_KG.find(([p]) => p.test(clause))?.[1];
  // External load raises intensity modestly (capped at +40%).
  const met = activity.met * (intensityLoad ? 1 + Math.min(0.4, intensityLoad / weightKg / 2) : 1);
  const sides = perSide(clause) ? 2 : 1;
  let work: number | null = null;
  let rest = 0;
  let reps: number | undefined;
  let sets: number | undefined;
  let holdSeconds: number | undefined;
  let assumed = false;

  const holdSets = activity.hold ? parseHoldSets(clause) : null;
  if (holdSets) {
    sets = holdSets.sets;
    holdSeconds = holdSets.seconds;
    work = (sets * holdSeconds * sides) / 60;
    rest = sets * sides * HOLD_RESET_MINUTES;
  }
  if (work === null) {
    const minutes = parseDurationMinutes(clause);
    if (minutes !== null) {
      work = minutes;
      if (activity.hold && minutes <= 5) {
        holdSeconds = Math.round(minutes * 60);
        sets = 1;
        work = minutes * sides;
        rest = sides * HOLD_RESET_MINUTES;
      }
    }
  }
  if (work === null) {
    const steps = parseSteps(clause);
    const miles = parseDistanceMiles(clause);
    if (steps !== null) work = steps / STEPS_PER_MINUTE;
    else if (miles !== null && activity.minutesPerMile) work = miles * activity.minutesPerMile;
  }
  if (work === null && activity.secondsPerRep) {
    const setsReps = parseSetsReps(clause);
    const count = setsReps ? null : parseBareCount(clause);
    if (setsReps && setsReps.reps > 0) {
      // Written as sets: ~1.75 min per set on the clock, rest included.
      sets = setsReps.sets;
      reps = setsReps.sets * setsReps.reps;
      work = (reps * activity.secondsPerRep * sides) / 60;
      rest = Math.max(0, setsReps.sets * MINUTES_PER_SET - work);
    } else if (setsReps) {
      sets = setsReps.sets;
      work = setsReps.sets * MINUTES_PER_SET * 0.4;
      rest = setsReps.sets * MINUTES_PER_SET * 0.6;
      assumed = true;
    } else if (count !== null) {
      sets = 1;
      reps = count;
      work = (count * activity.secondsPerRep * sides) / 60;
      rest = SETUP_MINUTES;
    }
  }
  if (work === null && activity.secondsPerRep && !/work(?:ed)?[\s-]?out|session|class|routine|circuit/.test(clause)) {
    // Named with no numbers ("kettlebell squats"): assume 3 sets, flagged as assumed.
    sets = 3;
    work = 3 * MINUTES_PER_SET * 0.4;
    rest = 3 * MINUTES_PER_SET * 0.6;
    assumed = true;
  }
  if (work === null) {
    work = activity.defaultMinutes ?? (activity.secondsPerRep ? 30 : 15);
    assumed = true;
  }
  work = Math.min(work, 8 * 60);
  const kcal = netPerMinute(met, weightKg) * work + netPerMinute(REST_MET, weightKg) * rest;
  return {
    activity: activity.id,
    name: clauseName(clause, activity.id),
    minutes: round1(work + rest),
    ...(reps !== undefined ? { reps } : {}),
    ...(sets !== undefined && (sets > 1 || holdSeconds !== undefined || reps !== undefined) ? { sets } : {}),
    ...(loadKg !== undefined ? { loadKg: Math.round(loadKg * 100) / 100 } : {}),
    ...(holdSeconds !== undefined ? { holdSeconds } : {}),
    ...(sides === 2 ? { side: "each" as const } : {}),
    kcal: Math.max(0, kcal),
    assumed,
  };
}

function routineItems(routine: ExerciseRoutine, weightKg: number): ExerciseEstimateItem[] {
  return routine.items.map((r) => {
    const work = (r.sets * r.repsPerSet * (r.holdSeconds ?? 3) * (r.side ? 2 : 1)) / 60;
    const rest = Math.max(0, r.minutes - work);
    return {
      activity: r.activity, name: r.name, minutes: r.minutes, sets: r.sets, reps: r.sets * r.repsPerSet,
      ...(r.scheme ? { scheme: r.scheme } : {}), ...(r.holdSeconds ? { holdSeconds: r.holdSeconds } : {}), ...(r.side ? { side: r.side } : {}),
      kcal: netPerMinute(r.met, weightKg) * work + netPerMinute(REST_MET, weightKg) * rest, assumed: false,
    };
  });
}

/** Scale an item to the fraction actually done: sets (at least 1, pyramid trimmed), reps, minutes and kcal. */
function scaleItem(item: ExerciseEstimateItem, f: number): ExerciseEstimateItem {
  if (f === 1) return item;
  const sets = item.sets ? Math.max(1, Math.round(item.sets * f)) : undefined;
  const scheme = item.scheme && sets ? item.scheme.split("/").slice(0, sets).join("/") : item.scheme;
  const repsPerSet = item.reps && item.sets ? item.reps / item.sets : undefined;
  const reps = item.reps !== undefined ? (scheme ? scheme.split("/").reduce((s, n) => s + Number(n), 0) : repsPerSet && sets ? Math.round(repsPerSet * sets) : Math.max(1, Math.round(item.reps * f))) : undefined;
  return { ...item, ...(sets !== undefined ? { sets } : {}), ...(scheme ? { scheme } : {}), ...(reps !== undefined ? { reps } : {}), minutes: round1(item.minutes * f), kcal: item.kcal * f };
}


/** Estimate the net kcal burned for a plain-language description. `fraction` (0–1] overrides one found in the text. */
export function estimateExerciseBurn(description: string, options: { weightKg?: number; fraction?: number | null } = {}): ExerciseEstimate {
  const weightKg = options.weightKg && Number.isFinite(options.weightKg) && options.weightKg > 20 ? options.weightKg : DEFAULT_BODY_WEIGHT_KG;
  const text = normalize(description);
  const routine = ROUTINES.find((r) => r.pattern.test(text)) ?? null;
  const items: ExerciseEstimateItem[] = routine ? routineItems(routine, weightKg) : [];
  const unrecognized: string[] = [];
  const rest = routine ? text.replace(routine.pattern, " ").replace(/\s+/g, " ") : text;
  const context: ContextLoads = {};
  for (const clause of splitClauses(rest)) {
    // Inside a routine description, its own moves ("the sideways thing", "bird dogs") are already counted.
    if (routine && ROUTINE_MOVE.test(clause)) continue;
    const note = equipmentNote(clause);
    if (note) { Object.assign(context, note); continue; }
    const item = estimateClause(clause, weightKg, context);
    if (item) items.push(item);
    else unrecognized.push(clause);
  }
  const manual = options.fraction !== undefined && options.fraction !== null && options.fraction > 0 && options.fraction <= 1 ? options.fraction : null;
  const parsed = detectFraction(text);
  const fraction = manual ?? parsed ?? 1;
  const scaled = items.map((item) => scaleItem(item, fraction));
  const notes = [...(fraction < 1 && scaled.length ? [`partial (${Math.round(fraction * 100)}%)`] : []), ...detectNotes(text)];
  const kcal = scaled.reduce((sum, item) => sum + item.kcal, 0);
  return {
    kcal: Math.round(kcal),
    minutes: round1(scaled.reduce((sum, item) => sum + item.minutes, 0)),
    items: scaled.map((item) => ({ ...item, kcal: Math.round(item.kcal) })),
    unrecognized: scaled.length ? unrecognized.filter(meaningful) : unrecognized,
    fraction,
    fractionSource: manual !== null ? "manual" : parsed !== null ? "text" : null,
    notes,
    routine: routine?.name ?? null,
    when: detectWhen(description),
    source: "local-met",
  };
}

const ROUTINE_MOVE = /curl[\s-]?ups?|side[\s-]?planks?|sideways|bird[\s-]?dogs?|back,? (?:and )?forth|switch(?:ed|ing)? (?:sides|back)|both sides/;
