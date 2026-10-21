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
  headlines: string[]; gaps: string[];
};
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

async function call<T>(fetchImpl: Fetch, path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchImpl(VIEWER_API + path, {
    ...init, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), 'X-Cupcake-Viewer': token },
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (response.status === 401) throw new ViewerAuthError(data.error === 'expired');
  if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Please wait a moment and try again.' : 'The overview is temporarily unavailable.');
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
