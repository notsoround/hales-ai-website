/** Living vs Static sky atmosphere preference (account app only; device preference, zero personal data). */
import { useEffect, useState } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';

export type SkyPreference = 'living' | 'static';
export const SKY_STORAGE_KEY = 'cupcake-account-sky-v1';
export const SKY_ATTRIBUTE = 'data-cc-sky';
const SKY_EVENT = 'cc-sky-pref-changed';

export const normalizeSkyPreference = (value: unknown): SkyPreference =>
  value === 'static' ? 'static' : 'living';

export function loadSkyPreference(): SkyPreference {
  try {
    return normalizeSkyPreference(globalThis.localStorage?.getItem(SKY_STORAGE_KEY));
  } catch {
    return 'living';
  }
}

function saveSkyPreference(pref: SkyPreference) {
  try {
    globalThis.localStorage?.setItem(SKY_STORAGE_KEY, pref);
  } catch {
    /* preference still applies for this tab */
  }
}

export function applySkyPreference(pref: SkyPreference) {
  if (!ACCOUNT_SESSIONS || typeof document === 'undefined') return;
  document.documentElement.setAttribute(SKY_ATTRIBUTE, pref);
}

applySkyPreference(loadSkyPreference());

export function useAccountSky(): [SkyPreference, (next: SkyPreference) => void] {
  const [pref, setPref] = useState<SkyPreference>(loadSkyPreference);

  useEffect(() => {
    applySkyPreference(pref);
  }, [pref]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setPref(loadSkyPreference());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === SKY_STORAGE_KEY) sync();
    };
    window.addEventListener(SKY_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SKY_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = (next: SkyPreference) => {
    const clean = normalizeSkyPreference(next);
    saveSkyPreference(clean);
    applySkyPreference(clean);
    setPref(clean);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SKY_EVENT));
  };

  return [pref, update];
}
