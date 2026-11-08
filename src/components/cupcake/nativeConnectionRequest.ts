export const NATIVE_CLIENT = 'cupcake-android-health-preview-v1';
export const NATIVE_REDIRECT = 'ai.hales.cupcake.health.preview:/oauth/callback';
const KEY = 'cupcake-native-connect-request-v1';
const LIFETIME = 10 * 60 * 1000;
const FIELDS = ['client_id', 'redirect_uri', 'installation_id', 'state', 'code_challenge', 'code_challenge_method'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RANDOM = /^[A-Za-z0-9_-]{43}$/;
export type NativeConnectionRequest = Record<typeof FIELDS[number], string>;
export type PendingNativeConnection = { request: NativeConnectionRequest | null; createdAt: number; error?: string };

export function validNativeConnection(value: unknown): value is NativeConnectionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === FIELDS.length && FIELDS.every(key => typeof row[key] === 'string')
    && row.client_id === NATIVE_CLIENT && row.redirect_uri === NATIVE_REDIRECT
    && UUID.test(row.installation_id as string) && RANDOM.test(row.state as string)
    && RANDOM.test(row.code_challenge as string) && row.code_challenge_method === 'S256';
}

export function nativeRequestCurrent(pending: PendingNativeConnection, now = Date.now()): boolean {
  return validNativeConnection(pending.request) && Number.isFinite(pending.createdAt)
    && pending.createdAt <= now && now - pending.createdAt < LIFETIME;
}

/** Only public PKCE request parameters enter tab storage; never verifier/code/tokens. */
export function takeNativeConnectionRequest(): PendingNativeConnection | null {
  if (!/^\/cupcake\/account\/?$/.test(location.pathname)) return null;
  const query = new URLSearchParams(location.search);
  if (!query.has('native_connect')) return null;
  const invalid = (): PendingNativeConnection => ({ request: null, createdAt: Date.now(), error: 'This app connection request is invalid or expired. Start again from the Android app.' });
  const fragment = location.hash.slice(1);
  try {
    if (query.getAll('native_connect').length !== 1 || query.get('native_connect') !== '1') {
      sessionStorage.removeItem(KEY); return invalid();
    }
    if (fragment) {
      // Strip the public request from the address before any sign-in navigation.
      history.replaceState(history.state, '', location.pathname + location.search);
      sessionStorage.removeItem(KEY);
      const params = new URLSearchParams(fragment);
      if ([...params.keys()].length !== FIELDS.length || FIELDS.some(key => params.getAll(key).length !== 1)) return invalid();
      const request = Object.fromEntries(params);
      if (!validNativeConnection(request)) return invalid();
      const pending = { request, createdAt: Date.now() };
      sessionStorage.setItem(KEY, JSON.stringify(pending));
      return pending;
    }
    const pending: PendingNativeConnection = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!pending || !nativeRequestCurrent(pending) || Object.keys(pending).some(key => !['request','createdAt'].includes(key))) {
      sessionStorage.removeItem(KEY); return invalid();
    }
    return pending;
  } catch {
    return { request: null, createdAt: Date.now(), error: 'This browser could not keep the app connection request. Start again from the Android app.' };
  }
}

export function clearNativeConnectionRequest() {
  try { sessionStorage.removeItem(KEY); } catch { /* No secret is stored here. */ }
  const query = new URLSearchParams(location.search); query.delete('native_connect');
  history.replaceState(history.state, '', location.pathname + (query.size ? '?' + query.toString() : ''));
}

export function nativeCallback(result: unknown, request: NativeConnectionRequest, owner: string): string {
  const row = result as Record<string, unknown>;
  const identity = row?.identity as Record<string, unknown> | undefined;
  if (!row || row.ok !== true || row.redirect_uri !== NATIVE_REDIRECT || row.state !== request.state
      || row.expires_in !== 120 || typeof row.code !== 'string' || !/^nc_[A-Za-z0-9_-]{43}$/.test(row.code)
      || identity?.account_id !== owner) throw Error('The app connection response could not be confirmed. Start again from the Android app.');
  const url = new URL(NATIVE_REDIRECT);
  url.searchParams.set('code', row.code); url.searchParams.set('state', request.state);
  return url.href;
}
