import { ACCOUNT_SESSIONS, ACCOUNT_UNAVAILABLE } from './accountMode.ts';

export type AccountIdentity = Readonly<{ account_id: string; email: string; name: string }>;
export class AccountRequestError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'AccountRequestError'; }
}
type Session = Readonly<{ identity: AccountIdentity | null; generation: number; checking: boolean; message: string; transient: boolean }>;
let state: Session = { identity: null, generation: 0, checking: true, message: '', transient: false };
const listeners = new Set<() => void>();
const requests = new Set<AbortController>();
const MAX_IN_FLIGHT = 6;
let inFlightCount = 0;
type QueueEntry = {
  priority: number;
  seq: number;
  generation: number;
  signal?: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  onAbort?: () => void;
};
const requestQueue: QueueEntry[] = [];
let queueSeq = 0;
type InFlightRead = {
  controller: AbortController;
  waiters: number;
  promise: Promise<unknown>;
};
const inFlightReads = new Map<string, InFlightRead>();
let verifying: Promise<void> | null = null;
let channel: BroadcastChannel | undefined;
export const SESSION_EVENT = 'cupcake-account-session-change';
export const sessionSnapshot = () => state;
export const subscribeSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function assertGeneration(generation: number) {
  if (generation !== state.generation) throw new DOMException('The signed-in account changed. This response was discarded.', 'AbortError');
}
function drainQueueForTransition() {
  const pending = requestQueue.splice(0, requestQueue.length);
  for (const entry of pending) {
    if (entry.onAbort) entry.signal?.removeEventListener('abort', entry.onAbort);
    entry.reject(new DOMException('The signed-in account changed. This response was discarded.', 'AbortError'));
  }
}
function transition(identity: AccountIdentity | null, message = '', checking = false, transient = false) {
  for (const request of requests) request.abort();
  requests.clear();
  inFlightReads.clear();
  drainQueueForTransition();
  verifying = null;
  state = { identity, message, checking, transient, generation: state.generation + 1 };
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
/** Edge throttling (nginx limit_req) answers 429 with no Cupcake JSON and never reaches the server.
 *  Returns a wait in ms before resending, or null when the response must be handled normally.
 *  Sign-in and recovery are never resent automatically. */
export function edgeThrottleRetryDelay(route: string, status: number, result: unknown, attempt: number, random = Math.random): number | null {
  if (status !== 429 || attempt >= EDGE_THROTTLE_DELAYS.length || ['sign-in', 'recovery/redeem'].includes(route)) return null;
  if (result && typeof result === 'object' && 'error' in result) return null;
  return EDGE_THROTTLE_DELAYS[attempt]! + Math.floor(random() * 250);
}
const EDGE_THROTTLE_DELAYS = [400, 900, 1800, 3500];
function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, ms);
    const stop = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', stop, { once: true });
  });
}
const READ_ONLY_DATA_ACTIONS = new Set([
  'list', 'search', 'fetch', 'projects', 'analysis_list', 'analysis_get', 'decision_list',
  'food_list', 'food_get', 'food_history', 'food_photo_thumbnail', 'food_review_list', 'food_settings_get', 'food_photo_status',
  'weight_list', 'weight_get', 'glucose_manual_list', 'checkin_list', 'health_observation_get',
  'exercise_list', 'outcome_list', 'outcome_get', 'body_checkin_list', 'body_assessment_get',
  'coach_plan_get', 'phone_daily_list', 'steps_list', 'ringconn_night_list', 'ringconn_night_get',
  'personal_snapshot', 'body_headline_get', 'persona_get', 'feed_get',
  'receipt_meal_choices', 'bank_purchase_list', 'bank_purchase_get', 'receipt_list', 'receipt_get', 'receipt_match_candidates', 'receipt_read_status', 'reconcile_list',
  'bank_connection_status', 'quick_chat_list', 'quick_chat_get', 'recording_summary_get',
  'ai_budget_status', 'notifications_summary', 'reset_list', 'reset_get',
]);
const READ_ONLY_ROUTES = new Set([
  'coach/grants/received', 'coach/grants/list', 'coach/workspace', 'coach/invitations/list',
  'health/devices/list', 'health/cgm/latest',
]);
function isDedupableRead(route: string, body: Record<string, unknown> | undefined): boolean {
  if (route === 'data') return typeof body?.action === 'string' && READ_ONLY_DATA_ACTIONS.has(body.action);
  if (READ_ONLY_ROUTES.has(route)) return true;
  if (route === 'health/sync') return !body || Object.keys(body).length === 0;
  return false;
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => v === undefined ? 'null' : canonicalJson(v)).join(',') + ']';
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter(key => record[key] !== undefined).sort();
  return '{' + keys.map(key => JSON.stringify(key) + ':' + canonicalJson(record[key])).join(',') + '}';
}
function shouldQueue(route: string): boolean {
  return route === 'data' || route.startsWith('health/');
}
function requestPriority(route: string, body: Record<string, unknown> | undefined): number {
  if (route === 'session' || (route === 'data' && body?.action === 'persona_get')) return 0;
  if (route === 'data' && (body?.action === 'notifications_summary' || body?.action === 'ai_budget_status' || body?.action === 'food_photo_thumbnail')) return 2;
  return 1;
}
function makeReleaser(): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlightCount = Math.max(0, inFlightCount - 1);
    pumpQueue();
  };
}
function pumpQueue() {
  while (inFlightCount < MAX_IN_FLIGHT && requestQueue.length > 0) {
    const next = requestQueue.shift()!;
    if (next.onAbort) next.signal?.removeEventListener('abort', next.onAbort);
    if (next.generation !== state.generation) {
      next.reject(new DOMException('The signed-in account changed. This response was discarded.', 'AbortError'));
      continue;
    }
    if (next.signal?.aborted) {
      next.reject(new DOMException('Aborted', 'AbortError'));
      continue;
    }
    inFlightCount++;
    next.resolve(makeReleaser());
  }
}
function acquireSlot(priority: number, generation: number, signal?: AbortSignal): Promise<() => void> {
  assertGeneration(generation);
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  if (inFlightCount < MAX_IN_FLIGHT) {
    inFlightCount++;
    return Promise.resolve(makeReleaser());
  }
  return new Promise<() => void>((resolve, reject) => {
    const entry: QueueEntry = { priority, seq: ++queueSeq, generation, signal, resolve, reject };
    if (signal) {
      const onAbort = () => {
        const index = requestQueue.indexOf(entry);
        if (index !== -1) requestQueue.splice(index, 1);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      entry.onAbort = onAbort;
      signal.addEventListener('abort', onAbort, { once: true });
    }
    let insertAt = requestQueue.length;
    for (let i = 0; i < requestQueue.length; i++) {
      const current = requestQueue[i]!;
      if (priority < current.priority || (priority === current.priority && entry.seq < current.seq)) {
        insertAt = i;
        break;
      }
    }
    requestQueue.splice(insertAt, 0, entry);
  });
}
async function send<T>(route: string, body: Record<string, unknown> | undefined, generation: number, expectedAccount?: string, signal?: AbortSignal): Promise<T> {
  if (!ACCOUNT_SESSIONS) throw Error('Account sign-in is disabled in this build.');
  assertGeneration(generation);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!isDedupableRead(route, body)) {
    return executeSend<T>(route, body, generation, expectedAccount, signal);
  }
  const key = `${generation}:${expectedAccount || ''}:${route}:${canonicalJson(body)}`;
  let entry = inFlightReads.get(key);
  if (!entry) {
    const sharedController = new AbortController();
    const sharedEntry: InFlightRead = { controller: sharedController, waiters: 0, promise: Promise.resolve() };
    const promise = executeSend<T>(route, body, generation, expectedAccount, sharedController.signal).finally(() => {
      if (inFlightReads.get(key) === sharedEntry) inFlightReads.delete(key);
    });
    // Suppress unhandled rejections if all callers abort before the shared fetch rejects.
    promise.catch(() => {});
    sharedEntry.promise = promise;
    inFlightReads.set(key, sharedEntry);
    entry = sharedEntry;
  }
  entry.waiters++;
  const activeEntry = entry;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finishWaiter = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      activeEntry.waiters = Math.max(0, activeEntry.waiters - 1);
      return true;
    };
    const onAbort = () => {
      if (!finishWaiter()) return;
      if (activeEntry.waiters === 0) {
        if (inFlightReads.get(key) === activeEntry) inFlightReads.delete(key);
        activeEntry.controller.abort();
      }
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    activeEntry.promise.then(
      value => {
        if (!finishWaiter()) return;
        try { assertGeneration(generation); resolve(value as T); }
        catch (err) { reject(err); }
      },
      err => {
        if (!finishWaiter()) return;
        reject(err);
      },
    );
  });
}
async function executeSend<T>(route: string, body: Record<string, unknown> | undefined, generation: number, expectedAccount?: string, signal?: AbortSignal): Promise<T> {
  if (!ACCOUNT_SESSIONS) throw Error('Account sign-in is disabled in this build.');
  assertGeneration(generation);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const release = shouldQueue(route) ? await acquireSlot(requestPriority(route, body), generation, signal) : null;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => controller?.abort();
  try {
    assertGeneration(generation);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    controller = new AbortController(); requests.add(controller);
    signal?.addEventListener('abort', abort, { once:true }); if (signal?.aborted) controller.abort();
    timer = setTimeout(() => controller?.abort(), 60000);
    let response: Response, result: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const sessionRetryDelays = [400, 1000];
    const retryableRead = isDedupableRead(route, body);
    let sessionTransientAttempt = 0;
    let readNetworkAttempt = 0;
    let edgeAttempt = 0;
    for (;;) {
      try {
        response = await fetch('https://automate.hales.ai/api/account/' + route, {
          method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store',
          headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Cupcake-Request': 'account',
            ...(expectedAccount ? {'X-Cupcake-Account-Context':expectedAccount} : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
        });
      } catch (networkError) {
        assertGeneration(generation);
        if (route === 'session' && !controller.signal.aborted && sessionTransientAttempt < sessionRetryDelays.length) {
          const wait = sessionRetryDelays[sessionTransientAttempt++]!;
          await abortableDelay(wait, controller.signal);
          assertGeneration(generation);
          continue;
        }
        if (retryableRead && !controller.signal.aborted && readNetworkAttempt < 1) {
          readNetworkAttempt++;
          const wait = 400 + Math.floor(Math.random() * 250);
          await abortableDelay(wait, controller.signal);
          assertGeneration(generation);
          continue;
        }
        throw networkError;
      }
      assertGeneration(generation);
      result = await response.json().catch(() => null);
      assertGeneration(generation);
      // Opening Today sends a burst of reads. The proxy in front of the server
      // turns the excess away with a bare 429 before Cupcake sees the request,
      // so waiting and sending the same request again is safe.
      const wait = edgeThrottleRetryDelay(route, response.status, result, edgeAttempt);
      if (wait !== null) {
        edgeAttempt++;
        await abortableDelay(wait, controller.signal);
        assertGeneration(generation);
        continue;
      }
      // Transient gateway/service hiccups during session restore/revalidation should retry quietly.
      if (route === 'session' && [502, 503, 504].includes(response.status) && sessionTransientAttempt < sessionRetryDelays.length) {
        const retryWait = sessionRetryDelays[sessionTransientAttempt++]!;
        await abortableDelay(retryWait, controller.signal);
        assertGeneration(generation);
        continue;
      }
      break;
    }
    if (response.status === 401 && route === 'session' && !expectedAccount && !state.identity) {
      // A first visit has no session to expire. Keep the normal sign-in screen,
      // and do not broadcast a lock to another tab that may already be signed in.
      transition(null);
      throw new AccountRequestError('Sign in to continue.', 'not_signed_in');
    }
    if ((response.status === 401 && !['sign-in','recovery/redeem'].includes(route)) || (response.status === 409 && result?.error === 'account_context_changed')) {
      invalidateSession('Your session expired or changed. Sign in again.');
      throw Error('Your session expired or changed. Sign in again.');
    }
    if (response.status === 409 && result?.error === 'persona_conflict') throw new AccountRequestError('Your assistant preferences changed elsewhere.', 'persona_conflict');
    if (response.status === 409 && result?.error === 'plan_conflict') throw new AccountRequestError('Your saved meal plan changed elsewhere. Your draft is kept; reload the saved version before saving.', 'plan_conflict');
    if (response.status === 503 && result?.error === 'health_intake_not_ready') throw new AccountRequestError('Apple Health connections are not available for this account yet. No upload has been confirmed.', 'health_intake_not_ready');
    if (response.status === 503 && result?.error === 'export_not_ready') throw new AccountRequestError('Your data download is not available yet. Try again later.', 'export_not_ready');
    if (response.status === 413 && result?.error === 'export_too_large') throw new AccountRequestError('Your data exceeds the current download limit. No partial file was created.', 'export_too_large');
    if (['exports/originals','exports/original-link'].includes(route) && !response.ok) {
      const messages: Record<string,string> = { original_stream_limit:'Another original download is still active. Wait for it to finish, then try this file again.', original_inventory_limit:'The original-file list exceeds the current service allowance. No partial list was returned.', original_link_limit:'Original downloads are busy. Try this file again shortly.', original_unavailable:'This saved original is unavailable. Refresh the list to check its current status.', original_changed:'This original changed since the list was loaded. Refresh the list before downloading it.' };
      throw new AccountRequestError(messages[result?.error] || 'The original-file request could not be confirmed. Refresh the list and try again.', typeof result?.error === 'string' ? result.error : 'original_request_failed');
    }
    if (route.startsWith('exports/') && !response.ok && typeof result?.error === 'string') {
      const messages: Record<string,string> = { export_not_found:'This saved preparation is unavailable for this sign-in. Start a new preparation when you are ready.', export_expired:'This prepared ZIP has expired. Start a new preparation.', export_owner_busy:'A download is already being prepared for your account. Check its saved status.', export_busy:'Download preparation is busy. Check status or try again later.', export_request_conflict:'This saved preparation no longer matches this sign-in or selection.', export_storage_limit:'Download preparation has reached its temporary storage limit. Try again later.', export_job_limit:'Several downloads were prepared recently. Try again after they expire.' };
      throw new AccountRequestError(messages[result.error] || 'The ZIP request could not be confirmed. Check the saved status before starting another preparation.', result.error);
    }
    if (route.startsWith('voice/') && !response.ok && typeof result?.error === 'string') throw new AccountRequestError('Your voice request could not be confirmed.', result.error);
    if (route === 'reply-report' && response.status === 503) throw new AccountRequestError('Reply reporting isn’t available yet.', 'account_reply_report_not_ready');
    if (route === 'receipts/photo' && response.status === 503 && result?.error === 'account_receipt_photo_not_ready') throw new AccountRequestError('Receipt photo saving isn’t available yet. Your photo is kept on this device.', 'account_receipt_photo_not_ready');
    if (route === 'data' && typeof result?.error === 'string' && result.error.startsWith('receipt_read_')) {
      throw new AccountRequestError('Receipt reading could not be confirmed. Check its status again.', result.error);
    }
    if (route === 'data' && result?.error === 'bank_not_ready') {
      throw new AccountRequestError('Bank connection is unavailable right now.', 'bank_not_ready');
    }
    if (route === 'data' && typeof result?.error === 'string' && result.error.startsWith('bank_')) {
      throw new AccountRequestError('Bank connection could not be confirmed.', result.error);
    }
    if (route === 'data' && !response.ok && (result?.error === 'unknown_action' || result?.error === 'account_action_not_ready')) {
      throw new AccountRequestError(response.status === 503 ? ACCOUNT_UNAVAILABLE : 'Cupcake could not complete that request. Check your details and try again.', result.error);
    }
    if (!response.ok && typeof result?.error === 'string' && (result.error.startsWith('recording_summary_') || result.error === 'account_recording_summary_not_ready')) throw new AccountRequestError('The saved transcript summary is unavailable. Your original and transcript are kept.', result.error);
    const photoErrors: Record<string, string> = {
      account_food_photo_not_ready: 'Photo meal logging is not available for this account yet. Your original is kept on this device.',
      photo_request_not_found: 'No matching photo request was found.',
      target_photo_exists: 'That meal already has a photo. Choose another meal.',
      photo_review_busy: 'This upload is still processing. Refresh once it finishes.',
      photo_request_conflict: 'This saved request belongs to different photo details. Check your food history before starting another.',
      photo_already_saved: 'This photo already has a saved meal. Open it in your food history instead of logging it twice.',
      photo_retry_not_allowed: 'This estimate cannot safely be repeated. Check the saved photo status; your original is kept.',
      photo_invalid_time: 'Choose the actual meal time within the last 400 days, no later than five minutes from now.',
      account_budget_exceeded: 'Your account’s AI allowance is currently used or reserved. The request has not been confirmed.',
      account_budget_unavailable: 'Your account’s AI allowance is unavailable. The request has not been confirmed.',
      account_budget_reconciliation_required: 'An earlier AI charge needs reconciliation. Your photo is kept while the allowance is checked.',
    };
    if (!response.ok && typeof result?.error === 'string' && photoErrors[result.error]) throw new AccountRequestError(photoErrors[result.error], result.error);
    const invitationErrors: Record<string,string> = {
      invitation_unavailable:'This invitation is unavailable. It may have expired, been revoked or already been accepted.',
      invitation_conflict:'A pending invitation already exists, or this request changed. Check your invitations before trying again.',
      invitation_limit:'Your pilot invitation or client limit has been reached.',
      coach_not_enabled:'Invitation management is available only to enabled pilot coaches.',
      invitation_sign_in_required:'This email already has an account. Sign in with its own password, then accept the invitation.',
      invitation_account_mismatch:'This invitation is for a different account. Sign in with the intended email.',
      disclosure_required:'Read and accept the pilot disclosure before continuing.',
    };
    if (response.status === 429 && result?.error === 'web_search_daily_limit') throw new AccountRequestError('You have used today’s 10 web searches. Try again tomorrow.', 'web_search_daily_limit');
    if (!response.ok && typeof result?.error === 'string' && invitationErrors[result.error]) throw new AccountRequestError(invitationErrors[result.error],result.error);
    if (!response.ok || !result || result.ok === false) throw Error(response.status === 503 ? ACCOUNT_UNAVAILABLE
      : response.status === 429 ? 'Too many attempts. Please try again later.'
      : response.status === 401 ? 'Check your sign-in details and try again.'
      : result?.error === 'coach_access_denied' ? 'This authorization is unavailable or expired. Reload your authorized reports.'
      : result?.error === 'observation_conflict' ? 'That request ID already belongs to a saved original.'
      : 'Cupcake could not complete that request. Check your details and try again.');
    return result as T;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    if (controller) requests.delete(controller);
    release?.();
  }
}
export async function restoreSession() {
  const expectedAccount = state.identity?.account_id;
  transition(null, '', true, false);
  const generation = state.generation;
  try {
    const result = await send<{ identity: unknown }>('session', undefined, generation, expectedAccount);
    transition(identity(result.identity));
  } catch (error) {
    if (state.generation === generation) {
      const transient = !(error instanceof AccountRequestError && error.code === 'not_signed_in');
      const message = transient
        ? 'Couldn’t reach Cupcake right now. Your saved sign-in may still be active — we’ll reconnect automatically when your connection returns.'
        : error instanceof Error ? error.message : 'Sign in to continue.';
      transition(null, message, false, transient);
    }
  }
}
let lastSessionRefresh = 0;
export async function refreshAccountSession() {
  const snapshot = state;
  if (!ACCOUNT_SESSIONS || !snapshot.identity) return;
  const now = Date.now();
  if (now - lastSessionRefresh < 12 * 3600000) return;
  lastSessionRefresh = now;
  try {
    const response = await fetch('https://automate.hales.ai/api/account/session/refresh', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Cupcake-Request': 'account',
        'X-Cupcake-Account-Context': snapshot.identity.account_id,
      },
      body: '{}',
    });
    if (!response.ok) lastSessionRefresh = 0;
  } catch {
    lastSessionRefresh = 0;
  }
}
export async function verifySession() {
  const snapshot = state;
  if (!snapshot.identity) return;
  if (verifying) return verifying;
  const run = (async () => {
    try {
      const result = await send<{ identity: unknown }>('session', undefined, snapshot.generation, snapshot.identity!.account_id);
      const verified = identity(result.identity);
      if (JSON.stringify(verified) !== JSON.stringify(snapshot.identity)) transition(verified);
      void refreshAccountSession();
    } catch { /* A 401/409 already locks every view; transient 429/5xx/network errors never sign the user out. */ }
  })();
  verifying = run;
  try { await run; } finally { if (verifying === run) verifying = null; }
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
  + 'food_list food_get food_history food_photo food_photo_thumbnail food_review_list food_review_resolve food_settings_get food_settings_save food_manual_log food_portion_set '
  + 'weight_list weight_get weight_add weight_correct glucose_add glucose_manual_list checkin_add checkin_list health_observation_get '
  + 'exercise_log exercise_list exercise_delete outcome_record outcome_list outcome_get body_checkin_upsert body_checkin_delete '
  + 'body_checkin_list body_assessment_get coach_plan_set coach_plan_get phone_daily_list steps_list steps_ingest '
  + 'ringconn_night_list ringconn_night_get personal_snapshot body_headline_get persona_get persona_save feed_get '
  + 'receipt_meal_choices receipt_meal_set bank_purchase_list bank_purchase_get receipt_list receipt_get receipt_confirm_match receipt_unlink_match receipt_match_candidates receipt_read_start receipt_read_status receipt_read_retry receipt_set_payment_method reconcile_list reconcile_resolve reconcile_settings '
  + 'bank_connection_status bank_link_create bank_link_complete bank_link_update_create bank_link_update_complete bank_sync bank_disconnect '
  + 'quick_chat_list quick_chat_get quick_chat_create quick_chat_begin quick_chat_cancel account_self_export food_photo_status food_photo_retry recording_summary_get recording_summary_begin '
  + 'ai_budget_status notifications_summary reset_list reset_start reset_get reset_outcome voice_extract_updates').split(' '));
export async function accountData<T>(body: Record<string, unknown>, signal?:AbortSignal): Promise<T> {
  const snapshot = state;
  if (!snapshot.identity) throw Error('Sign in to open your Cupcake.');
  if (typeof body.action !== 'string' || !DATA_ACTIONS.has(body.action)) throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('data', body, snapshot, signal);
}
async function accountJSON<T>(route: string, body: Record<string, unknown>, snapshot: Session, signal?: AbortSignal): Promise<T> {
  if (!snapshot.identity) throw Error('Sign in to open your Cupcake.');
  if (['owner_id','ownerId','accountId','account_id','role','actor','reportOwnerId','report_owner_id'].some(key => key in body)) throw Error('Request fields cannot choose an account.');
  const result = await send<T & {identity:unknown}>(route, body, snapshot.generation, snapshot.identity.account_id, signal);
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

/** Dedicated bounded photo route; the ordinary data action body cap stays unchanged. */
export async function accountFoodPhoto<T>(body: Record<string, unknown>): Promise<T> {
  return accountJSON<T>('food/photo/analyze', body, state);
}

/** Save a receipt photo to the verified account with its stable request ID. */
export async function accountReceiptPhoto<T>(body: Record<string, unknown>): Promise<T> {
  return accountJSON<T>('receipts/photo', body, state);
}

export type ReportableReply = { kind: 'quick_chat'; threadId: string; turnId: string; attemptId?: string }
  | { kind: 'voice'; sessionId: string; lineIndex: number };

export async function accountReplyReport(reply: ReportableReply, reason: string) {
  const result = await accountJSON<{ ok: boolean; report?: { id?: string; reportedAt?: string } }>(
    'reply-report', { ...reply, ...(reason ? { reason } : {}) }, state);
  if (result.ok !== true || typeof result.report?.id !== 'string' || !result.report.id ||
    typeof result.report.reportedAt !== 'string' || !Number.isFinite(Date.parse(result.report.reportedAt))) {
    throw Error('The report receipt could not be confirmed.');
  }
}

export async function accountVoice<T>(route: 'config'|'list'|'start'|'recover'|'status'|'end', body: Record<string, unknown>, snapshot = state): Promise<T> {
  if (!['config','list','start','recover','status','end'].includes(route)) throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('voice/' + route, body, snapshot);
}

/** Fixed export API routes. Original links are separately checked before native download. */
export async function accountExport<T>(route:'prepare'|'status'|'originals'|'original-link', body:Record<string,unknown>, snapshot = state, signal?:AbortSignal):Promise<T> {
  if (!['prepare','status','originals','original-link'].includes(route)) throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('exports/' + route, body, snapshot, signal);
}

export async function accountExportDownload(requestId:string, expected:{bytes:number;sha256:string}, snapshot = state, signal?:AbortSignal):Promise<Blob> {
  if (!ACCOUNT_SESSIONS || !snapshot.identity) throw Error('Sign in before downloading your data.');
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(requestId) || !Number.isSafeInteger(expected.bytes) || expected.bytes <= 0 || expected.bytes > 128 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(expected.sha256)) throw Error('The ZIP details could not be verified. No file was created.');
  assertGeneration(snapshot.generation);
  const controller = new AbortController(); requests.add(controller);
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, {once:true}); if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 120000);
  try {
    const response = await fetch('https://automate.hales.ai/api/account/exports/download', {method:'POST',credentials:'include',cache:'no-store',redirect:'error',signal:controller.signal,
      headers:{'Content-Type':'application/json','X-Cupcake-Request':'account','X-Cupcake-Account-Context':snapshot.identity.account_id},body:JSON.stringify({request_id:requestId})});
    assertGeneration(snapshot.generation);
    if (!response.ok) {
      const failure = await response.json().catch(() => null); assertGeneration(snapshot.generation);
      if (response.status === 401 || (response.status === 409 && failure?.error === 'account_context_changed')) invalidateSession('Your session expired or changed. Sign in again.');
      throw new AccountRequestError('The ZIP is unavailable or this sign-in has expired. Check its status before downloading again.', typeof failure?.error === 'string' ? failure.error : 'export_download_unavailable');
    }
    if (response.headers.get('X-Cupcake-Account-Context') !== snapshot.identity.account_id || response.headers.get('X-Cupcake-Export-Request') !== requestId
        || response.headers.get('X-Cupcake-Export-SHA256') !== expected.sha256 || response.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/zip'
        || !/^\d+$/.test(response.headers.get('Content-Length') || '') || Number(response.headers.get('Content-Length')) !== expected.bytes || !response.body) throw Error('The ZIP response could not be verified. No file was created.');
    let bytes:Uint8Array;
    try {bytes = new Uint8Array(expected.bytes);} catch {throw Error('This browser could not hold the ZIP for verification. No file was created.');}
    const reader = response.body.getReader(); let received = 0;
    try {
      while (true) {
        const part = await reader.read(); assertGeneration(snapshot.generation);
        if (signal?.aborted || controller.signal.aborted) throw new DOMException('Download cancelled.', 'AbortError');
        if (part.done) break;
        received += part.value.byteLength;
        if (received > expected.bytes) throw Error('The ZIP size did not match. No file was created.');
        bytes.set(part.value, received - part.value.byteLength);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (received !== expected.bytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw Error('The ZIP was incomplete. No file was created. Check status and retry the download.');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2,'0')).join('');
    assertGeneration(snapshot.generation);
    if (signal?.aborted || controller.signal.aborted) throw new DOMException('Download cancelled.', 'AbortError');
    if (digest !== expected.sha256) throw Error('The ZIP integrity check failed. No file was created. Check status and retry the download.');
    return new Blob([bytes], {type:'application/zip'});
  } finally { controller.abort(); clearTimeout(timer); signal?.removeEventListener('abort', abort); requests.delete(controller); }
}

type CoachRoute = 'grants/received' | 'grants/list' | 'grants/revoke' | 'report' | 'meal-list' | 'meal-photo-url' | 'workspace' | 'invitations/create' | 'invitations/list' | 'invitations/revoke';
const COACH_ROUTES = new Set<CoachRoute>(['grants/received','grants/list','grants/revoke','report','meal-list','meal-photo-url','workspace','invitations/create','invitations/list','invitations/revoke']);
export async function accountCoach<T>(route: CoachRoute, body: Record<string, unknown>): Promise<T> {
  if (!COACH_ROUTES.has(route)) throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('coach/' + route, body, state);
}
export async function accountInvitation<T>(route:'preview'|'redeem',body:Record<string,unknown>):Promise<T> {
  if(!['preview','redeem'].includes(route))throw Error(ACCOUNT_UNAVAILABLE);
  return send<T>('invitations/'+route,body,state.generation);
}
export async function acceptAccountInvitation<T>(body:Record<string,unknown>):Promise<T> {
  return accountJSON<T>('invitations/accept',body,state);
}
export async function accountSharing<T>(route:'relationships'|'grant'|'revoke',body:Record<string,unknown>):Promise<T> {
  if(!['relationships','grant','revoke'].includes(route))throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('sharing/'+route,body,state);
}
export async function accountNative<T = unknown>(route:'authorize'|'installations/list'|'installations/revoke', body:Record<string,unknown>):Promise<T> {
  if (!['authorize','installations/list','installations/revoke'].includes(route)) throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('native/' + route, body, state);
}
export async function accountNativeHealth<T = unknown>(route:'authorize'|'connections/list'|'connections/revoke'|'sync'|'batch', body:Record<string,unknown>):Promise<T> {
  if (!['authorize','connections/list','connections/revoke','sync','batch'].includes(route)) throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('native/health/' + route, body, state);
}
type HealthRoute = 'devices/create' | 'devices/list' | 'devices/revoke' | 'sync' | 'cgm/latest';
const HEALTH_ROUTES = new Set<HealthRoute>(['devices/create','devices/list','devices/revoke','sync','cgm/latest']);
export async function accountHealth<T>(route: HealthRoute, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (!HEALTH_ROUTES.has(route)) throw Error(ACCOUNT_UNAVAILABLE);
  return accountJSON<T>('health/' + route, body, state, signal);
}
/** The signed path is never an img src: cookies, context and its echo are required. */
export async function accountCoachPhoto(path: string): Promise<Blob> {
  const snapshot = state;
  if (!ACCOUNT_SESSIONS || !snapshot.identity) throw Error('Sign in to view an authorized meal photo.');
  const url = new URL(path, 'https://automate.hales.ai');
  if (url.origin !== 'https://automate.hales.ai' || url.pathname !== '/api/account/coach/meal-photo' || url.hash
      || url.username || url.password || [...url.searchParams.keys()].length !== 1 || !url.searchParams.get('token') || url.search.length > 2101) throw Error('The photo address was not confirmed.');
  assertGeneration(snapshot.generation);
  const controller = new AbortController(); requests.add(controller);
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url.href, { credentials:'include',cache:'no-store',redirect:'error',signal:controller.signal,
      headers:{'X-Cupcake-Request':'account','X-Cupcake-Account-Context':snapshot.identity.account_id} });
    assertGeneration(snapshot.generation);
    if (!response.ok) {
      const error = await response.json().catch(() => null); assertGeneration(snapshot.generation);
      if (response.status === 401 || (response.status === 409 && error?.error === 'account_context_changed')) invalidateSession('Your session expired or changed. Sign in again.');
      throw Error('This meal photo is unavailable or its authorization expired. Reload your authorized reports.');
    }
    if (response.headers.get('X-Cupcake-Account-Context') !== snapshot.identity.account_id) {
      invalidateSession('Cupcake could not confirm whose photo was returned. Sign in again.');
      throw Error('The photo response was not confirmed.');
    }
    const blob = await response.blob(); assertGeneration(snapshot.generation);
    if (!['image/jpeg','image/png','image/webp'].includes(blob.type) || !blob.size || blob.size > 1274000) throw Error('The photo format was not confirmed.');
    return blob;
  } finally { clearTimeout(timer); requests.delete(controller); }
}
