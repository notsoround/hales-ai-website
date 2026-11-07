/** The account entry selects a transport, never an authenticated identity. */
export const ACCOUNT_ENTRY = '/cupcake/account';
export const ACCOUNT_BUILD_ENABLED = import.meta.env?.VITE_CUPCAKE_ACCOUNT_SESSIONS === 'true';
export const isAccountEntryPath = (pathname: string) => /^\/cupcake\/account\/?$/.test(pathname);
export const ACCOUNT_ENTRY_REQUESTED = isAccountEntryPath(window.location.pathname);
export const ACCOUNT_SESSIONS = ACCOUNT_BUILD_ENABLED && ACCOUNT_ENTRY_REQUESTED;
export const CUPCAKE_ENTRY = ACCOUNT_SESSIONS ? ACCOUNT_ENTRY : '/cupcake';
export const ACCOUNT_UNAVAILABLE = 'This feature is not available for account sign-in yet. Your saved data stays unchanged.';
/** Keep internal record/source links in this entry; external URLs stay intact. */
export function cupcakeHref(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    if ((url.origin === window.location.origin || url.origin === 'https://hales.ai')
        && /^\/cupcake(?:\/account)?\/?$/.test(url.pathname) && !url.username && !url.password) {
      return CUPCAKE_ENTRY + url.search + url.hash;
    }
  } catch { /* Invalid links are left to their existing caller validation. */ }
  return href;
}
export function requireLegacyTransport() {
  if (ACCOUNT_SESSIONS) throw new Error(ACCOUNT_UNAVAILABLE);
}
/** Every older private feed/provider/device transport fails before networking. */
export async function privateFetch(input: RequestInfo | URL, init?: RequestInit) {
  requireLegacyTransport();
  return fetch(input, init);
}
