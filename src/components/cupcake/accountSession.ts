import { ACCOUNT_SESSIONS, ACCOUNT_UNAVAILABLE } from './accountMode.ts';

export type AccountIdentity = Readonly<{ account_id: string; email: string; name: string }>;
export class AccountRequestError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'AccountRequestError'; }
}
type Session = Readonly<{ identity: AccountIdentity | null; generation: number; checking: boolean; message: string }>;
let state: Session = { identity: null, generation: 0, checking: true, message: '' };
const listeners = new Set<() => void>();
const requests = new Set<AbortController>();
let channel: BroadcastChannel | undefined;
export const SESSION_EVENT = 'cupcake-account-session-change';
export const sessionSnapshot = () => state;
export const subscribeSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function assertGeneration(generation: number) {
  if (generation !== state.generation) throw new DOMException('The signed-in account changed. This response was discarded.', 'AbortError');
}
function transition(identity: AccountIdentity | null, message = '', checking = false) {
  for (const request of requests) request.abort();
  requests.clear();
  state = { identity, message, checking, generation: state.generation + 1 };
  try { window.speechSynthesis?.cancel(); } catch { /* Media components also stop on keyed unmount. */ }
  listeners.forEach(listener => listener());
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export function invalidateSession(message = 'Sign in to open your Cupcake.', broadcast = true) {
  transition(null, message);
  if (broadcast) broadcastLock();
}
export function initializeSessionBoundary() {
  if (!ACCOUNT_SESSIONS) return () => {};
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('cupcake-account-lock-v1');
    channel.onmessage = () => invalidateSession('Your session changed in another tab. Sign in again.', false);
  }
  const storage = (event: StorageEvent) => {
    if (event.key === 'cupcake-account-lock-v1') invalidateSession('Your session changed in another tab. Sign in again.', false);
  };
  window.addEventListener('storage', storage);
  return () => { channel?.close(); channel = undefined; window.removeEventListener('storage', storage); };
}
function broadcastLock() {
  channel?.postMessage('lock');
  try { localStorage.setItem('cupcake-account-lock-v1', crypto.randomUUID()); } catch { /* BroadcastChannel still works. */ }
}
function identity(value: unknown): AccountIdentity {
  const row = value as AccountIdentity;
  if (!row || typeof row.account_id !== 'string' || !row.account_id.trim() || row.account_id.length > 128 || row.account_id.includes('\0')
      || typeof row.email !== 'string' || typeof row.name !== 'string') throw Error('Cupcake did not confirm your account identity.');
  return Object.freeze({ account_id: row.account_id, email: row.email, name: row.name });
}
async function send<T>(route: string, body: Record<string, unknown> | undefined, generation: number, expectedAccount?: string): Promise<T> {
  if (!ACCOUNT_SESSIONS) throw Error('Account sign-in is disabled in this build.');
  assertGeneration(generation);
  const controller = new AbortController(); requests.add(controller);
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('https://automate.hales.ai/api/account/' + route, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Cupcake-Request': 'account',
        ...(expectedAccount ? {'X-Cupcake-Account-Context':expectedAccount} : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    assertGeneration(generation);
    const result = await response.json().catch(() => null);
    assertGeneration(generation);
    if ((response.status === 401 && !['sign-in','recovery/redeem'].includes(route)) || (response.status === 409 && result?.error === 'account_context_changed')) {
      invalidateSession('Your session expired or changed. Sign in again.');
      throw Error('Your session expired or changed. Sign in again.');
    }
    if (response.status === 409 && result?.error === 'persona_conflict') throw new AccountRequestError('Your assistant preferences changed elsewhere.', 'persona_conflict');
    if (!response.ok || !result || result.ok === false) throw Error(response.status === 503 ? ACCOUNT_UNAVAILABLE
      : response.status === 429 ? 'Too many attempts. Please try again later.'
      : response.status === 401 ? 'Check your sign-in details and try again.'
      : result?.error === 'observation_conflict' ? 'That request ID already belongs to a saved original.'
      : 'Cupcake could not complete that request. Check your details and try again.');
    return result as T;
  } finally { clearTimeout(timer); requests.delete(controller); }
}
export async function restoreSession() {
  transition(null, '', true);
  const generation = state.generation;
  try {
    const result = await send<{ identity: unknown }>('session', undefined, generation);
    transition(identity(result.identity));
  } catch (error) {
    if (state.generation === generation) transition(null, error instanceof Error ? error.message : 'Sign in to continue.');
  }
}
export async function verifySession() {
  const snapshot = state;
  if (!snapshot.identity) return;
  try {
    const result = await send<{ identity: unknown }>('session', undefined, snapshot.generation);
    const verified = identity(result.identity);
    if (JSON.stringify(verified) !== JSON.stringify(snapshot.identity)) transition(verified);
  } catch { /* A 401 already locks every view; transient errors never select another owner. */ }
}
export async function signIn(email: string, password: string, remember: boolean) {
  transition(null);
  const generation = state.generation;
  const result = await send<{ identity: unknown }>('sign-in', { email, password, remember_me: remember }, generation);
  assertGeneration(generation);
  transition(identity(result.identity)); broadcastLock();
}
export async function accountControl<T>(route: 'password' | 'recovery/issue' | 'recovery/redeem' | 'sign-out' | 'sign-out-all', body: Record<string, unknown>) {
  const generation = state.generation;
  const expectedAccount = route === 'recovery/redeem' ? undefined : state.identity?.account_id;
  if (['password','recovery/issue','sign-out-all'].includes(route) && !expectedAccount) throw Error('Sign in again before changing this account.');
  // Hide data, abort pending work and stop mounted media immediately on logout.
  if (route.startsWith('sign-out')) {
    transition(null, 'Signing out…', true); broadcastLock();
    try { const result = await send<T>(route, body, state.generation, expectedAccount); transition(null, 'Signed out on this browser.'); return result; }
    catch (error) { invalidateSession('This browser is locked. Server sign-out was not confirmed; retry sign-out before leaving this device.'); throw error; }
  }
  const result = await send<T>(route, body, generation, expectedAccount);
  if (route === 'password' || route === 'recovery/redeem') { invalidateSession('Password changed. Sign in again.'); broadcastLock(); }
  return result;
}

// Match the reviewed backend boundary explicitly; never auto-admit new actions.
const DATA_ACTIONS = new Set(('list search fetch projects analysis_list analysis_get decision_list '
  + 'food_list food_get food_history food_photo food_settings_get food_settings_save food_manual_log '
  + 'weight_list weight_get weight_add weight_correct glucose_add glucose_manual_list checkin_add checkin_list health_observation_get '
  + 'exercise_log exercise_list exercise_delete outcome_record outcome_list outcome_get body_checkin_upsert body_checkin_delete '
  + 'body_checkin_list body_assessment_get coach_plan_set coach_plan_get phone_daily_list steps_list steps_ingest '
  + 'ringconn_night_list ringconn_night_get personal_snapshot body_headline_get persona_get persona_save').split(' '));
export async function accountData<T>(body: Record<string, unknown>): Promise<T> {
  const snapshot = state;
  if (!snapshot.identity) throw Error('Sign in to open your Cupcake.');
  if (typeof body.action !== 'string' || !DATA_ACTIONS.has(body.action)) throw Error(ACCOUNT_UNAVAILABLE);
  if (['owner_id','ownerId','accountId','account_id','role','actor','reportOwnerId','report_owner_id'].some(key => key in body)) throw Error('Request fields cannot choose an account.');
  const result = await send<T & {identity:unknown}>('data', body, snapshot.generation, snapshot.identity.account_id);
  // The server compares this expectation to the cookie principal before any
  // read/write, then adds the authenticated identity last in its response.
  let verified: AccountIdentity;
  try { verified = identity(result.identity); }
  catch { invalidateSession('Cupcake could not confirm whose data was returned. Sign in again.'); throw Error('The account response was not confirmed.'); }
  if (verified.account_id !== snapshot.identity.account_id) {
    invalidateSession('Your signed-in account changed. Sign in again.');
    throw new DOMException('The account changed; this result was discarded.', 'AbortError');
  }
  assertGeneration(snapshot.generation);
  return result;
}
