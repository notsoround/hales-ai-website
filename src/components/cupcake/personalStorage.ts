import { ACCOUNT_SESSIONS } from './accountMode.ts';
import { assertGeneration, sessionSnapshot } from './accountSession.ts';

export function personalNamespace() {
  if (!ACCOUNT_SESSIONS) return '';
  const owner = sessionSnapshot().identity?.account_id;
  if (!owner) throw Error('Personal storage requires a verified signed-in account.');
  return 'cupcake-account-v1:' + encodeURIComponent(owner) + ':';
}
/** Bound at creation. Old callbacks cannot redirect a held store to a new user. */
export function personalStorage(kind: 'localStorage' | 'sessionStorage'): Storage {
  const namespace = personalNamespace(), generation = sessionSnapshot().generation;
  const check = () => { if (ACCOUNT_SESSIONS) assertGeneration(generation); };
  let storage: Storage;
  try { storage = globalThis[kind]; if (!storage) throw Error('Unavailable'); }
  catch {
    const unavailable = (): never => { check(); throw Error('Browser storage is unavailable.'); };
    return { get length() { return unavailable(); }, key:unavailable, getItem:unavailable, setItem:unavailable, removeItem:unavailable, clear:unavailable };
  }
  const keys = () => { check(); return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => key !== null && (!namespace || key.startsWith(namespace))); };
  return {
    get length() { return keys().length; },
    key(index) { const key = keys()[index]; return key === undefined ? null : key.slice(namespace.length); },
    getItem(key) { check(); return storage.getItem(namespace + key); },
    setItem(key, value) { check(); storage.setItem(namespace + key, value); },
    removeItem(key) { check(); storage.removeItem(namespace + key); },
    clear() { for (const key of keys()) storage.removeItem(key); },
  };
}
export function personalDatabaseName() { return personalNamespace() + 'cupcake-recorder'; }
export const captureStorageScope = () => ({ namespace: personalNamespace(), generation: sessionSnapshot().generation });
export type StorageScope = ReturnType<typeof captureStorageScope>;
export function assertStorageScope(scope: StorageScope) { if (ACCOUNT_SESSIONS) assertGeneration(scope.generation); }
export function matchesPersonalStorageKey(key: string | null, logical: string) {
  try { return key === null || key === personalNamespace() + logical; } catch { return false; }
}
