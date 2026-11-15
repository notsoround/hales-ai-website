import { useEffect, useState } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';

/** Light / dark / follow-the-phone for the account app only. The original /cupcake app stays dark:
 *  the attribute is never set outside the account entry, and every light rule is scoped under it.
 *  A device preference (like a phone's own setting), so it lives in plain localStorage and also
 *  applies to the sign-in screen before anyone is signed in. It holds no personal data. */
export type SchemeChoice = 'dark' | 'light' | 'system';
export type Scheme = 'dark' | 'light';
export const SCHEME_STORAGE_KEY = 'cupcake-account-scheme-v1';
export const SCHEME_ATTRIBUTE = 'data-cc-scheme';
const LIGHT_THEME_COLOR = '#f4f6f7';
let darkThemeColor: string | null = null;

export const normalizeSchemeChoice = (value: unknown): SchemeChoice => value === 'light' || value === 'system' ? value : 'dark';
export function loadSchemeChoice(): SchemeChoice {
  try { return normalizeSchemeChoice(globalThis.localStorage?.getItem(SCHEME_STORAGE_KEY)); } catch { return 'dark'; }
}
function saveSchemeChoice(choice: SchemeChoice) {
  try { globalThis.localStorage?.setItem(SCHEME_STORAGE_KEY, choice); } catch { /* still applies for this tab */ }
}
const systemQuery = () => { try { return window.matchMedia?.('(prefers-color-scheme: light)') ?? null; } catch { return null; } };
export const resolveScheme = (choice: SchemeChoice): Scheme => choice === 'system' ? (systemQuery()?.matches ? 'light' : 'dark') : choice;

export function applyScheme(scheme: Scheme) {
  if (!ACCOUNT_SESSIONS || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute(SCHEME_ATTRIBUTE, scheme);
  root.style.colorScheme = scheme === 'light' ? 'light' : ''; // dark keeps the page exactly as before
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) { darkThemeColor ??= meta.content; meta.content = scheme === 'light' ? LIGHT_THEME_COLOR : darkThemeColor; }
}

// Set before the first paint so the sign-in screen never flashes the other scheme.
applyScheme(resolveScheme(loadSchemeChoice()));

/** The chosen preference and its setter; keeps the page attribute in step with the phone and other tabs. */
export function useAccountScheme(): [SchemeChoice, (choice: SchemeChoice) => void, Scheme] {
  const [choice, setChoice] = useState<SchemeChoice>(loadSchemeChoice);
  const [system, setSystem] = useState<Scheme>(() => resolveScheme('system'));
  const scheme = choice === 'system' ? system : choice;
  useEffect(() => { applyScheme(scheme); }, [scheme]);
  useEffect(() => {
    const query = systemQuery();
    const onChange = () => setSystem(query?.matches ? 'light' : 'dark');
    query?.addEventListener?.('change', onChange);
    const onStorage = (event: StorageEvent) => { if (event.key === SCHEME_STORAGE_KEY) setChoice(loadSchemeChoice()); };
    window.addEventListener('storage', onStorage);
    return () => { query?.removeEventListener?.('change', onChange); window.removeEventListener('storage', onStorage); };
  }, []);
  return [choice, (next: SchemeChoice) => { const value = normalizeSchemeChoice(next); saveSchemeChoice(value); setChoice(value); }, scheme];
}
