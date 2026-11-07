/** Build-time opt-in only. No URL, storage, persona or request can enable it. */
export const ACCOUNT_SESSIONS = import.meta.env?.VITE_CUPCAKE_ACCOUNT_SESSIONS === 'true';
export const ACCOUNT_UNAVAILABLE = 'This feature is not available for account sign-in yet. Your saved data stays unchanged.';
export function requireLegacyTransport() {
  if (ACCOUNT_SESSIONS) throw new Error(ACCOUNT_UNAVAILABLE);
}
/** Every older private feed/provider/device transport fails before networking. */
export async function privateFetch(input: RequestInfo | URL, init?: RequestInit) {
  requireLegacyTransport();
  return fetch(input, init);
}
