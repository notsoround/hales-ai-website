import { useLayoutEffect } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';

/** Public launch metadata only; it never selects an account or contains credentials. */
export const ACCOUNT_INSTALL_URL = '/cupcake/account?assistant=matthieu';
export const ACCOUNT_INSTALL_MANIFEST = '/matthieu-account.webmanifest';
export const ACCOUNT_INSTALL_ICON = '/matthieu-avatar.png';

export function useAccountInstallMetadata() {
  useLayoutEffect(() => {
    if (!ACCOUNT_SESSIONS) return;
    const cleanups: (() => void)[] = [];
    const manifest = document.createElement('link');
    manifest.rel = 'manifest'; manifest.href = ACCOUNT_INSTALL_MANIFEST;
    document.head.appendChild(manifest); cleanups.push(() => manifest.remove());
    for (const [name, content] of [['apple-mobile-web-app-title', 'Matthieu'], ['apple-mobile-web-app-capable', 'yes']]) {
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
