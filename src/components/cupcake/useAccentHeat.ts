import { useEffect, useState } from 'react';
import { ACCENT_HEAT_ATTRIBUTE, ACCENT_HEAT_STORAGE_KEY, loadAccentHeat, normalizeAccentHeat, saveAccentHeat, type AccentHeat } from './accentHeat';

/** Applies the attribute while the Cupcake app is mounted and follows other tabs. */
export function useAccentHeat(): [AccentHeat, (heat: AccentHeat) => void] {
  const [heat, setHeat] = useState<AccentHeat>(loadAccentHeat);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(ACCENT_HEAT_ATTRIBUTE, heat);
    return () => root.removeAttribute(ACCENT_HEAT_ATTRIBUTE);
  }, [heat]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === ACCENT_HEAT_STORAGE_KEY) setHeat(loadAccentHeat()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return [heat, (next: AccentHeat) => { const value = normalizeAccentHeat(next); saveAccentHeat(value); setHeat(value); }];
}
