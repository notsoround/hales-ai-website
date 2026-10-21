// Robyn's read-only coach view. Talks ONLY to the viewer API with a short-lived viewer
// token from the link (?t=…). Never reads or sends the Cupcake password/owner key.
export const VIEWER_API = 'https://automate.hales.ai/api/viewer';
export const VIEWER_STORAGE = 'cupcake-robyn-viewer';
export const NOTE_MAX = 2000;
const TOKEN = /^rv_[A-Za-z0-9_-]{40,60}$/;

export type Metric = { label: string; unit: string; current: number | null; previous: number | null; delta: number | null; pct: number | null; better: 'up' | 'down' | null };
export type DayPoint = {
  date: string; prev_date: string; label: string;
  kcal: number | null; prev_kcal: number | null; meals: number; prev_meals: number;
  steps: number | null; prev_steps: number | null; ex_min: number; prev_ex_min: number; ex_kcal: number; prev_ex_kcal: number;
  sleep_min: number | null; prev_sleep_min: number | null; resting_hr: number | null; spo2: number | null;
  weight_lb: number | null; prev_weight_lb: number | null;
};
export type Period = { start: string; end: string; label: string };
export type Weekly = {
  ok: true; viewer: string; expiresAt: string; generatedAt: string; subject: string;
  period: { end_date: string; weeks: number; current: Period; previous: Period };
  metrics: Record<string, Metric>; series: DayPoint[];
  weight_trend: { week: string; avg_lb: number | null; readings: number }[];
  headlines: string[]; gaps: string[]; status?: string[];
};
export type Meal = { time: string; description: string; source: 'Photo' | 'Manual' | 'Bank estimate'; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; sugar_g: number | null; partial: boolean };
export type Workout = { time: string; description: string; minutes: number | null; kcal: number };
export type Sleep = { source: 'RingConn' | 'Health Connect'; asleep_min: number | null; session_min: number | null; bedtime: string | null; waketime: string | null;
  stages_min: Partial<Record<'deep' | 'light' | 'rem' | 'awake', number>> | null; resting_hr: number | null; avg_hr: number | null; spo2_mean: number | null; spo2_min: number | null };
export type Day = { date: string; period?: 'current' | 'previous'; meals: Meal[]; workouts: Workout[]; sleep: Sleep | null; steps: number | null;
  weight: { time: string; lb: number; source: string }[]; wins: number; losses: number; food_kcal: number | null; exercise_minutes: number; exercise_kcal: number };
export type Details = { ok: true; timezone: string; window: { weeks: number; current: { start: string; end: string }; previous: { start: string; end: string } }; days: Day[] };
export type CoreField = 'weight_lb' | 'neck_in' | 'waist_in' | 'hips_in' | 'body_fat_pct';
export type Checkin = { date: string; source: string; weight_lb: number | null; neck_in: number | null; waist_in: number | null; hips_in: number | null; body_fat_pct: number | null;
  extra: Record<string, number>; flags: Partial<Record<string, 'entry_error' | 'repeated_value'>>; note: string | null };
export type WorkoutItem = { name: string; minutes: number };
export type Coach = { ok: true; has_data: boolean; sample?: boolean; timezone: string;
  program: { name: string; start: string; end: string; coach?: string } | null;
  targets: Partial<Record<'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'steps' | 'water_fl_oz', number>> | null;
  workout_template: { days: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', WorkoutItem[]>> } | null;
  meal_plan: { title?: string; meals: { name: string; kcal: number; items: string[] }[]; notes?: string[] } | null;
  checkins: Checkin[]; derived: { count: number; first: string | null; latest: string | null; next_due: string | null;
    deltas: Partial<Record<CoreField, { first: { date: string; value: number }; latest: { date: string; value: number }; change: number }>> };
  source_labels?: Record<string, string> };
export function fetchCoach(token: string, fetchImpl: Fetch = fetch): Promise<Coach> {
  return call<Coach>(fetchImpl, '/coach', token);
}
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const weekdayKey = (iso: string) => WD[new Date(iso + 'T12:00:00Z').getUTCDay()];
/** Per-day plan adherence: assigned minutes from the template vs logged Cupcake workouts. */
export function adherence(template: Coach['workout_template'], days: Day[]) {
  return days.map(d => {
    const assigned = template?.days?.[weekdayKey(d.date)] ?? [];
    const planned = assigned.reduce((a, w) => a + w.minutes, 0);
    const done = d.exercise_minutes;
    const state: 'rest' | 'done' | 'partial' | 'missed' | 'extra' = !planned ? (done ? 'extra' : 'rest') : done >= planned * 0.8 ? 'done' : done > 0 ? 'partial' : 'missed';
    return { date: d.date, assigned, planned, done, sessions: d.workouts.length, state };
  });
}
/** Average per logged day over the window's current days (macros summed from meals). */
export function dailyActuals(days: Day[]) {
  const logged = days.filter(d => d.meals.length);
  const avg = (f: (d: Day) => number) => logged.length ? logged.reduce((a, d) => a + f(d), 0) / logged.length : null;
  const sum = (d: Day, k: 'protein_g' | 'fat_g' | 'carbs_g') => d.meals.reduce((a, m) => a + (m[k] ?? 0), 0);
  const steps = days.filter(d => d.steps !== null);
  return { days: logged.length, kcal: avg(d => d.food_kcal ?? 0), protein_g: avg(d => sum(d, 'protein_g')), fat_g: avg(d => sum(d, 'fat_g')), carbs_g: avg(d => sum(d, 'carbs_g')),
    steps: steps.length ? steps.reduce((a, d) => a + (d.steps ?? 0), 0) / steps.length : null, stepDays: steps.length, water_fl_oz: null as number | null };
}
export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type ChatInfo = { available: boolean; voice: boolean; limits: Record<string, number> };
export type VoiceStart = { session: string; webCall: { id: string; webCallUrl: string }; maxSeconds: number };
export const EXPORT_SECTIONS = ['days', 'meals', 'workouts', 'sleep', 'weight'] as const;
export type ExportSection = typeof EXPORT_SECTIONS[number];
export const CHAT_MAX = 1000;
export const CHAT_TURNS = 10;
export const WELCOME = "Hi Robyn, I'm Cupcake. I can walk you through Matt's numbers: meals, workouts, steps, sleep and weight, up to four weeks back. What would you like to look at?";
export const SUGGESTIONS = ['How did this week compare to last?', 'Show the biggest change', "What's missing from the data?"];
export class ViewerAuthError extends Error {
  readonly expired: boolean;
  constructor(expired: boolean) { super(expired ? 'This link has expired.' : 'This link is not valid.'); this.name = 'ViewerAuthError'; this.expired = expired; }
}
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
type HistoryLike = { replaceState: (data: unknown, unused: string, url?: string) => void };

export const validToken = (value: unknown): value is string => typeof value === 'string' && TOKEN.test(value);

/** Takes ?t= from the URL into sessionStorage and strips it from the address bar. */
export function captureToken(href: string, history: HistoryLike | null, storage: Storage | null): string {
  const url = new URL(href);
  const fromUrl = url.searchParams.get('t');
  if (url.searchParams.has('t')) {
    url.searchParams.delete('t');
    history?.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
  }
  if (validToken(fromUrl)) {
    try { storage?.setItem(VIEWER_STORAGE, fromUrl); } catch { /* the open page still works */ }
    return fromUrl;
  }
  try { const saved = storage?.getItem(VIEWER_STORAGE); return validToken(saved) ? saved : ''; } catch { return ''; }
}

async function call<T>(fetchImpl: Fetch, path: string, token: string, init: RequestInit = {}, raw = false): Promise<T> {
  const response = await fetchImpl(VIEWER_API + path, {
    ...init, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), 'X-Cupcake-Viewer': token },
  });
  if (raw && response.ok) return await response.blob() as T;
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (response.status === 401) throw new ViewerAuthError(data.error === 'expired');
  if (!response.ok) throw new Error(response.status === 429 ? (data.error && data.error.length > 12 ? data.error : 'Too many requests. Please wait a moment and try again.')
    : 'The overview is temporarily unavailable.');
  return data as T;
}

export function fetchWeekly(token: string, weeks: 1 | 2 | 4, fetchImpl: Fetch = fetch): Promise<Weekly> {
  return call<Weekly>(fetchImpl, `/weekly?weeks=${weeks}`, token);
}

export async function postNote(token: string, note: string, fetchImpl: Fetch = fetch): Promise<{ id: string; createdAt: string }> {
  const text = note.trim();
  if (!text || text.length > NOTE_MAX) throw new Error(`Notes can be 1–${NOTE_MAX} characters.`);
  const out = await call<{ note: { id: string; createdAt: string } }>(fetchImpl, '/notes', token, { method: 'POST', body: JSON.stringify({ note: text }) });
  return out.note;
}

export function fetchDetails(token: string, weeks: 1 | 2 | 4, fetchImpl: Fetch = fetch): Promise<Details> {
  return call<Details>(fetchImpl, `/details?weeks=${weeks}`, token);
}

export function fetchExport(token: string, weeks: 1 | 2 | 4, format: 'json' | 'csv', section: ExportSection = 'days', fetchImpl: Fetch = fetch): Promise<Blob> {
  const q = format === 'json' ? `format=json` : `format=csv&section=${section}`;
  return call<Blob>(fetchImpl, `/export?weeks=${weeks}&${q}`, token, {}, true);
}

export const exportName = (weeks: number, end: string, format: 'json' | 'csv', section?: ExportSection): string =>
  `matt-hales-${weeks}w-${end}${format === 'csv' ? '-' + section : ''}.${format}`;

export function fetchChatInfo(token: string, fetchImpl: Fetch = fetch): Promise<ChatInfo> {
  return call<ChatInfo>(fetchImpl, '/chat', token);
}

/** Keeps the last CHAT_TURNS turns, client-held; the server re-validates. */
export function trimHistory(turns: ChatTurn[]): ChatTurn[] {
  return turns.filter((t) => (t.role === 'user' || t.role === 'assistant') && t.content.trim()).slice(-CHAT_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
}

export async function sendChat(token: string, message: string, history: ChatTurn[], fetchImpl: Fetch = fetch): Promise<string> {
  const text = message.trim();
  if (!text || text.length > CHAT_MAX) throw new Error(`Messages can be 1–${CHAT_MAX} characters.`);
  const out = await call<{ answer?: string; available?: boolean }>(fetchImpl, '/chat', token, { method: 'POST', body: JSON.stringify({ message: text, history: trimHistory(history) }) });
  if (out.available === false || !out.answer) throw new Error('unavailable');
  return out.answer;
}

export function startVoice(token: string, fetchImpl: Fetch = fetch): Promise<VoiceStart> {
  return call<VoiceStart>(fetchImpl, '/voice/start', token, { method: 'POST', body: '{}' });
}

export function endVoice(token: string, session: string, fetchImpl: Fetch = fetch): Promise<unknown> {
  return call<unknown>(fetchImpl, '/voice/end', token, { method: 'POST', body: JSON.stringify({ session }) });
}

// ---- Robyn's own app (link only; no data integration) ----
export const RP_APP = { web: 'https://robynpeck.fitbudd.com/app', ios: 'https://apps.apple.com/us/app/robyn-peck/id6469142871',
  android: 'https://play.google.com/store/apps/details?id=com.robynpeck.app' };
/** The universal link opens the installed app; otherwise the store for the platform, or the web app. */
export function rpAppLink(userAgent: string): { href: string; fallback: string | null } {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))) return { href: RP_APP.web, fallback: RP_APP.ios };
  if (/Android/i.test(userAgent)) return { href: RP_APP.web, fallback: RP_APP.android };
  return { href: RP_APP.web, fallback: null };
}

/** Minimal markdown-light: **bold**, bullet lines and paragraphs, returned as plain segments (no HTML injection). */
export type Seg = { bold: boolean; text: string };
export function markdownLight(text: string): { bullet: boolean; segs: Seg[] }[] {
  return text.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).filter((l, i, a) => l || (i > 0 && a[i - 1])).map((line) => {
    const bullet = /^\s*[-*•]\s+/.test(line);
    const body = line.replace(/^\s*[-*•]\s+/, '').replace(/^#+\s*/, '');
    const segs = body.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => p.startsWith('**') && p.endsWith('**') ? { bold: true, text: p.slice(2, -2) } : { bold: false, text: p });
    return { bullet, segs };
  });
}

// ---- presentation helpers (pure) ----
export type Tone = 'good' | 'caution' | 'neutral';
export function deltaTone(m: Metric): Tone {
  if (m.delta === null || m.delta === 0 || m.better === null) return 'neutral';
  return (m.delta > 0) === (m.better === 'up') ? 'good' : 'caution';
}
export const fmt = (v: number | null | undefined, digits = 0): string =>
  v === null || v === undefined ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export function hm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const t = Math.round(minutes); return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')} m`;
}
export function deltaText(m: Metric, kind: 'number' | 'minutes' | 'decimal' = 'number', unit = ''): string {
  if (m.delta === null) return m.previous === null ? 'No prior data' : 'No comparison';
  if (m.delta === 0) return 'No change';
  const size = kind === 'minutes' ? hm(Math.abs(m.delta)) : fmt(Math.abs(m.delta), kind === 'decimal' ? 1 : 0) + (unit ? ` ${unit}` : '');
  return `${m.delta > 0 ? '▲' : '▼'} ${size}`;
}
export function niceMax(values: (number | null)[]): number {
  const top = Math.max(0, ...values.filter((v): v is number => v !== null));
  if (top <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(top)); const n = top / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}
export const shortDate = (iso: string): string => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const longDate = (iso: string): string => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const expiryLabel = (iso: string): string => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
