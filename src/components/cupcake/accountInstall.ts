import { useLayoutEffect } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';

/** Public launch metadata only; it never selects an account or contains credentials. */
export const ACCOUNT_INSTALL_URL = '/cupcake/account?assistant=matthieu';
export const ACCOUNT_INSTALL_MANIFEST = '/matthieu-account.webmanifest';
export const ACCOUNT_INSTALL_ICON = '/matthieu-avatar.png';
export const CUPCAKE_ACCOUNT_INSTALL_URL = '/cupcake/account?assistant=cupcake';
export const CUPCAKE_ACCOUNT_INSTALL_MANIFEST = '/cupcake-account.webmanifest';
export const CUPCAKE_ACCOUNT_INSTALL_ICON = '/cupcake-app-touch-180.png';
const requested = () => ACCOUNT_SESSIONS ? new URLSearchParams(window.location.search).get('assistant') : null;
/** Opt-in branding must not replace Matt's ordinary Cupcake account installation. */
export const isMatthieuAccountInstall = () => requested() === 'matthieu';
/** The account app installs as its own app only from its named link; the bare account address and the original app are unchanged. */
export const isCupcakeAccountInstall = () => requested() === 'cupcake';
export const accountInstallIcon = () => isMatthieuAccountInstall() ? ACCOUNT_INSTALL_ICON : isCupcakeAccountInstall() ? CUPCAKE_ACCOUNT_INSTALL_ICON : null;
/** True when this page was opened from the installed app (home screen icon), not a browser tab. */
export const isInstalledApp = () => typeof window !== 'undefined'
  && (!!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function useAccountInstallMetadata() {
  useLayoutEffect(() => {
    const matthieu = isMatthieuAccountInstall();
    if (!matthieu && !isCupcakeAccountInstall()) return;
    const cleanups: (() => void)[] = [];
    const manifest = document.createElement('link');
    manifest.rel = 'manifest'; manifest.href = matthieu ? ACCOUNT_INSTALL_MANIFEST : CUPCAKE_ACCOUNT_INSTALL_MANIFEST;
    document.head.appendChild(manifest); cleanups.push(() => manifest.remove());
    for (const [name, content] of [['apple-mobile-web-app-title', matthieu ? 'Matthieu' : 'Cupcake'], ['apple-mobile-web-app-capable', 'yes'], ['mobile-web-app-capable', 'yes']]) {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const meta = existing || document.createElement('meta');
      const before = meta.getAttribute('content');
      meta.name = name; meta.content = content;
      if (!existing) document.head.appendChild(meta);
      cleanups.push(() => { if (!existing) meta.remove(); else if (before === null) meta.removeAttribute('content'); else meta.content = before; });
    }
    // Deliberately no service worker, private-data cache, share target or identity persistence.
    return () => cleanups.reverse().forEach(cleanup => cleanup());
  }, []);
}
