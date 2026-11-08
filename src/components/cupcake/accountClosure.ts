import { ACCOUNT_SESSIONS } from './accountMode';
import { assertGeneration, invalidateSession, SESSION_EVENT, sessionSnapshot } from './accountSession';

export const CLOSURE_SCOPE = 'account-close-2026-11-07';
export const CLOSURE_PHRASE = 'CLOSE MY ACCOUNT';
const PREFIX = 'cupcake-account-closure-v1:';
const LATEST = PREFIX + 'latest';
const WEEK = 7 * 86400;
export type ClosureIntent = { ownerId: string; request_id: string; receipt_token: string; scope_version: typeof CLOSURE_SCOPE; receiptExpiresAt: number };
export type ClosureReceipt = { request_id: string; state: 'prepared' | 'closed'; access_closed: boolean; data_erased: false; closed_at: number | null; prepare_expires_at: number; receipt_expires_at: number; scope_version: typeof CLOSURE_SCOPE };
export type ClosureDisclosure = { version: typeof CLOSURE_SCOPE; effect: string; retained: string; external: string; reopening: string; before: string; receipt: string };
export class ClosureRequestError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'ClosureRequestError'; }
}
const ownerKey = (owner: string) => PREFIX + encodeURIComponent(owner);
function validIntent(value: unknown): value is ClosureIntent {
  const v = value as ClosureIntent;
  return !!v && typeof v.ownerId === 'string' && !!v.ownerId && v.ownerId.length <= 128 && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v.request_id)
    && /^cc_[A-Za-z0-9_-]{43}$/.test(v.receipt_token) && v.scope_version === CLOSURE_SCOPE && Number.isFinite(v.receiptExpiresAt);
}
/** Receipt capabilities stay only in this browser; never use URLs or account exports. */
export function readClosureIntent(owner?: string): ClosureIntent | null {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const oldKey = localStorage.key(i);
      if (!oldKey?.startsWith(PREFIX) || oldKey === LATEST) continue;
      let old: unknown;
      try { old = JSON.parse(localStorage.getItem(oldKey) || 'null'); } catch { continue; }
      if (validIntent(old) && old.receiptExpiresAt <= Date.now() / 1000) {
        localStorage.removeItem(oldKey);
        if (localStorage.getItem(LATEST) === oldKey) localStorage.removeItem(LATEST);
      }
    }
    const key = owner ? ownerKey(owner) : localStorage.getItem(LATEST);
    if (!key?.startsWith(PREFIX) || key === LATEST) return null;
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    if (!validIntent(value) || key !== ownerKey(value.ownerId) || (owner && value.ownerId !== owner)) return null;
    if (value.receiptExpiresAt <= Date.now() / 1000) {
      localStorage.removeItem(key);
      if (localStorage.getItem(LATEST) === key) localStorage.removeItem(LATEST);
      return null;
    }
    return value;
  } catch { return null; }
}
function saveIntent(intent: ClosureIntent, generation: number) {
  assertGeneration(generation);
  const key = ownerKey(intent.ownerId), serialized = JSON.stringify(intent);
  try {
    localStorage.setItem(key, serialized);
    if (localStorage.getItem(key) !== serialized) throw Error();
    localStorage.setItem(LATEST, key);
  } catch { throw Error('This browser could not save the private recovery receipt. Check the saved receipt before continuing.'); }
}
export function createClosureIntent(): ClosureIntent {
  const snapshot = sessionSnapshot();
  if (!ACCOUNT_SESSIONS || !snapshot.identity) throw Error('Sign in before reviewing account closure.');
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const intent: ClosureIntent = { ownerId: snapshot.identity.account_id, request_id: crypto.randomUUID(), receipt_token: 'cc_' + token,
    scope_version: CLOSURE_SCOPE, receiptExpiresAt: Date.now() / 1000 + WEEK };
  try { saveIntent(intent, snapshot.generation); }
  catch { throw Error('This browser could not save a private recovery receipt. No new closure request was sent. Allow browser storage before continuing.'); }
  return intent;
}
export function removeExpiredClosureIntent(intent: ClosureIntent) {
  if (intent.receiptExpiresAt > Date.now() / 1000) return;
  readClosureIntent(intent.ownerId);
}
function receipt(value: unknown, intent: ClosureIntent): ClosureReceipt {
  const v = value as ClosureReceipt;
  if (!v || v.request_id !== intent.request_id || v.scope_version !== CLOSURE_SCOPE || !['prepared', 'closed'].includes(v.state)
      || v.data_erased !== false || v.access_closed !== (v.state === 'closed') || !Number.isFinite(v.prepare_expires_at) || !Number.isFinite(v.receipt_expires_at)
      || v.receipt_expires_at <= v.prepare_expires_at || (v.state === 'closed' ? !Number.isFinite(v.closed_at) : v.closed_at !== null)) {
    throw Error('The closure result could not be verified. Check the saved receipt before continuing.');
  }
  return v;
}
function disclosure(value: unknown): ClosureDisclosure {
  const v = value as ClosureDisclosure;
  if (!v || v.version !== CLOSURE_SCOPE || ['effect', 'retained', 'external', 'reopening', 'before', 'receipt'].some(key => typeof v[key as keyof ClosureDisclosure] !== 'string' || !v[key as keyof ClosureDisclosure].trim() || v[key as keyof ClosureDisclosure].length > 2000)) {
    throw Error('The account closure explanation could not be verified. Closing is unavailable until it can be reviewed.');
  }
  return v;
}
const errors: Record<string, string> = {
  account_closure_not_ready: 'Account closure is not available yet. No closure was confirmed.',
  closure_password_incorrect: 'The current password was not accepted. Closure was not confirmed. Check the receipt before trying again.',
  closure_confirmation_required: 'Review the current explanation and type CLOSE MY ACCOUNT before confirming.',
  closure_preparation_expired: 'This preparation expired. Check the receipt, then review a new preparation if your account is still open.',
  closure_intent_conflict: 'This request does not match its saved receipt. No closure was confirmed. Check the receipt before continuing.',
  closure_scope_changed: 'The account closure explanation changed. Check the receipt, then review the current explanation.',
  closure_receipt_not_found: 'This receipt is unavailable or expired. It cannot confirm whether the account is closed. It does not mean data was erased.',
  closure_try_later: 'Too many closure attempts. Wait before trying again. Your saved receipt is kept.',
};
type Result = { closure: ClosureReceipt; disclosure?: ClosureDisclosure };
export async function requestClosure(route: 'prepare' | 'confirm' | 'status', intent: ClosureIntent, password?: string): Promise<Result> {
  const snapshot = sessionSnapshot(), owner = snapshot.identity?.account_id;
  if (!ACCOUNT_SESSIONS || !validIntent(intent) || (owner && owner !== intent.ownerId) || (route !== 'status' && !owner)) throw Error('Sign in to the account that started this request.');
  if (intent.receiptExpiresAt <= Date.now() / 1000) { removeExpiredClosureIntent(intent); throw new ClosureRequestError(errors.closure_receipt_not_found, 'closure_receipt_not_found'); }
  assertGeneration(snapshot.generation);
  const controller = new AbortController(), abort = () => controller.abort();
  window.addEventListener(SESSION_EVENT, abort);
  const timer = window.setTimeout(abort, 60000);
  const body = route === 'status' ? { request_id: intent.request_id, receipt_token: intent.receipt_token }
    : { request_id: intent.request_id, receipt_token: intent.receipt_token, scope_version: CLOSURE_SCOPE,
      ...(route === 'confirm' ? { current_password: password, confirmation: CLOSURE_PHRASE } : {}) };
  try {
    const response = await fetch('https://automate.hales.ai/api/account/privacy/close/' + route, {
      method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Cupcake-Request': 'account', ...(owner ? { 'X-Cupcake-Account-Context': owner } : {}) }, body: JSON.stringify(body),
    });
    assertGeneration(snapshot.generation);
    const value = await response.json().catch(() => null);
    assertGeneration(snapshot.generation);
    if ((response.status === 401 && route !== 'status') || (response.status === 409 && ['account_context_changed', 'closure_account_changed'].includes(value?.error))) {
      invalidateSession('Your session expired or changed. Your closure receipt is kept on this browser.');
      throw Error('Your session expired or changed. Check your saved closure receipt.');
    }
    if (!response.ok || value?.ok !== true) throw new ClosureRequestError(errors[value?.error] || (response.status === 429 ? errors.closure_try_later : 'The closure request was not confirmed. Check your saved receipt before trying again.'), String(value?.error || 'closure_unconfirmed'));
    if (route === 'status') {
      if ('identity' in value || 'data' in value) throw Error('The private receipt response could not be verified.');
    } else if (value.identity?.account_id !== owner || typeof value.identity.email !== 'string' || typeof value.identity.name !== 'string') {
      invalidateSession('Cupcake could not confirm whose closure response was returned. Sign in again.');
      throw Error('The account closure response was discarded.');
    }
    const closed = receipt(value.closure, intent);
    const reviewed = route === 'prepare' ? disclosure(value.disclosure) : undefined;
    if (route === 'confirm' && !closed.access_closed) throw Error('Account closure was not confirmed. Check the saved receipt before continuing.');
    saveIntent({ ...intent, receiptExpiresAt: closed.receipt_expires_at }, snapshot.generation);
    return { closure: closed, ...(reviewed ? { disclosure: reviewed } : {}) };
  } finally { window.clearTimeout(timer); window.removeEventListener(SESSION_EVENT, abort); }
}
