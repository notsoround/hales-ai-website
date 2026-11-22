import { ACCOUNT_SESSIONS } from './accountMode';
import { matchesPersonalStorageKey } from './personalStorage';
import { useEffect, useState } from 'react';
import { ACCENT_HEAT_ATTRIBUTE, ACCENT_HEAT_STORAGE_KEY, loadAccentHeat, normalizeAccentHeat, saveAccentHeat, type AccentHeat } from './accentHeat';

/** Applies the attribute while the Cupcake app is mounted and follows other tabs. */
export function useAccentHeat(): [AccentHeat, (heat: AccentHeat) => void] {
  const [heat, setHeat] = useState<AccentHeat>(() => ACCOUNT_SESSIONS ? 'calm' : loadAccentHeat());
  useEffect(() => {
    const root = document.documentElement;
    if (ACCOUNT_SESSIONS) {
      root.removeAttribute(ACCENT_HEAT_ATTRIBUTE);
      return;
    }
    root.setAttribute(ACCENT_HEAT_ATTRIBUTE, heat);
    return () => root.removeAttribute(ACCENT_HEAT_ATTRIBUTE);
  }, [heat]);
  useEffect(() => {
    if (ACCOUNT_SESSIONS) return;
    const onStorage = (event: StorageEvent) => { if (matchesPersonalStorageKey(event.key,ACCENT_HEAT_STORAGE_KEY)) setHeat(loadAccentHeat()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return [heat, (next: AccentHeat) => { if (ACCOUNT_SESSIONS) return; const value = normalizeAccentHeat(next); saveAccentHeat(value); setHeat(value); }];
}
