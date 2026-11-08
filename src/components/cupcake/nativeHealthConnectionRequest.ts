import { NATIVE_CLIENT } from './nativeConnectionRequest';

export const NATIVE_HEALTH_REDIRECT = 'ai.hales.cupcake.health.preview:/health/callback';
const KEY = 'cupcake-native-health-request-v1';
const LIFETIME = 10 * 60 * 1000;
const FIELDS = ['client_id','redirect_uri','installation_id','epoch','state','code_challenge','code_challenge_method','types'] as const;
const TYPES = ['sleep','heart_rate','steps'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RANDOM = /^[A-Za-z0-9_-]{43}$/;
export type NativeHealthType = typeof TYPES[number];
export type NativeHealthConnectionRequest = {
  client_id: string; redirect_uri: string; installation_id: string; epoch: number;
  state: string; code_challenge: string; code_challenge_method: string; types: NativeHealthType[];
};
export type PendingNativeHealthConnection = { request: NativeHealthConnectionRequest | null; createdAt: number; error?: string };

export function validNativeHealthConnection(value: unknown): value is NativeHealthConnectionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === FIELDS.length && FIELDS.every(key => Object.prototype.hasOwnProperty.call(row, key))
    && row.client_id === NATIVE_CLIENT && row.redirect_uri === NATIVE_HEALTH_REDIRECT
    && typeof row.installation_id === 'string' && UUID.test(row.installation_id)
    && typeof row.epoch === 'number' && Number.isSafeInteger(row.epoch) && row.epoch > 0
    && typeof row.state === 'string' && RANDOM.test(row.state)
    && typeof row.code_challenge === 'string' && RANDOM.test(row.code_challenge) && row.code_challenge_method === 'S256'
    && Array.isArray(row.types) && row.types.length > 0 && row.types.length <= TYPES.length
    && row.types.every((type, index, types) => TYPES.includes(type) && (index === 0 || TYPES.indexOf(type) > TYPES.indexOf(types[index - 1])));
}

export function nativeHealthRequestCurrent(pending: PendingNativeHealthConnection, now = Date.now()): boolean {
  return validNativeHealthConnection(pending.request) && Number.isFinite(pending.createdAt)
    && pending.createdAt <= now && now - pending.createdAt < LIFETIME;
}

/** Tab recovery contains public request parameters only, never health records or authority. */
export function takeNativeHealthConnectionRequest(): PendingNativeHealthConnection | null {
  if (!/^\/cupcake\/account\/?$/.test(location.pathname)) return null;
  const query = new URLSearchParams(location.search);
  if (!query.has('native_health_connect')) return null;
  const fragment = location.hash.slice(1);
  if (fragment) history.replaceState(history.state, '', location.pathname + location.search);
  const invalid = (): PendingNativeHealthConnection => ({ request: null, createdAt: Date.now(), error: 'This health-upload request is invalid or expired. Start again from the Android app.' });
  try {
    if (query.has('native_connect') || query.getAll('native_health_connect').length !== 1 || query.get('native_health_connect') !== '1') {
      sessionStorage.removeItem(KEY); return invalid();
    }
    if (fragment) {
      sessionStorage.removeItem(KEY);
      const params = new URLSearchParams(fragment);
      if ([...params.keys()].length !== FIELDS.length || FIELDS.some(key => params.getAll(key).length !== 1)) return invalid();
      const publicFields = Object.fromEntries(params);
      if (!/^[1-9][0-9]{0,15}$/.test(publicFields.epoch)) return invalid();
      const request = { ...publicFields, epoch: Number(publicFields.epoch), types: publicFields.types.split(',') };
      if (!validNativeHealthConnection(request)) return invalid();
      const pending = { request, createdAt: Date.now() };
      sessionStorage.setItem(KEY, JSON.stringify(pending));
      return pending;
    }
    const pending: PendingNativeHealthConnection = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!pending || !nativeHealthRequestCurrent(pending) || Object.keys(pending).some(key => !['request','createdAt'].includes(key))) {
      sessionStorage.removeItem(KEY); return invalid();
    }
    return pending;
  } catch {
    return { request: null, createdAt: Date.now(), error: 'This browser could not keep the health-upload request. Start again from the Android app.' };
  }
}

export function clearNativeHealthConnectionRequest() {
  try { sessionStorage.removeItem(KEY); } catch { /* Only public request parameters were stored. */ }
  const query = new URLSearchParams(location.search); query.delete('native_health_connect');
  history.replaceState(history.state, '', location.pathname + (query.size ? '?' + query.toString() : ''));
}

export function nativeHealthCallback(result: unknown, request: NativeHealthConnectionRequest, owner: string): string {
  const row = result as Record<string, unknown>;
  const identity = row?.identity as Record<string, unknown> | undefined;
  if (!validNativeHealthConnection(request) || !row || row.ok !== true || row.redirect_uri !== NATIVE_HEALTH_REDIRECT
      || row.state !== request.state || row.expires_in !== 120 || typeof row.code !== 'string'
      || !/^nhc_[A-Za-z0-9_-]{43}$/.test(row.code) || identity?.account_id !== owner)
    throw Error('The health-upload approval could not be confirmed. Start again from the Android app.');
  const url = new URL(NATIVE_HEALTH_REDIRECT);
  url.searchParams.set('code', row.code); url.searchParams.set('state', request.state);
  return url.href;
}
