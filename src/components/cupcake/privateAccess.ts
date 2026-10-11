// Only a password entered by the owner belongs here; never import a build-time key.
export const PRIVATE_ACCESS_STORAGE = 'cupcake-private-access';
let memoryKey = '';

function browserStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try { return window[kind]; } catch { return null; }
}
function storedKey(storage: Storage | null): string {
  try { return storage?.getItem(PRIVATE_ACCESS_STORAGE)?.trim() || ''; } catch { return ''; }
}
function removeKey(storage: Storage | null): boolean {
  if (!storage) return true;
  try { storage.removeItem(PRIVATE_ACCESS_STORAGE); return !storage.getItem(PRIVATE_ACCESS_STORAGE); } catch { return false; }
}

export function readPrivateAccess(): string {
  memoryKey = storedKey(browserStorage('localStorage')) || storedKey(browserStorage('sessionStorage')) || memoryKey;
  return memoryKey;
}

// Call only after the private API has accepted the password. Legacy tab sessions
// are migrated at that point; unavailable storage still permits this open page.
export function savePrivateAccess(key: string): boolean {
  memoryKey = key.trim();
  const local = browserStorage('localStorage');
  try {
    local?.setItem(PRIVATE_ACCESS_STORAGE, memoryKey);
    if (local && storedKey(local) === memoryKey) {
      removeKey(browserStorage('sessionStorage'));
      return true;
    }
  } catch { /* Keep a usable in-memory/session fallback. */ }
  try { browserStorage('sessionStorage')?.setItem(PRIVATE_ACCESS_STORAGE, memoryKey); } catch { /* This page remains usable. */ }
  return false;
}

export function clearPrivateAccess(): boolean {
  memoryKey = '';
  const localCleared = removeKey(browserStorage('localStorage'));
  const sessionCleared = removeKey(browserStorage('sessionStorage'));
  return localCleared && sessionCleared;
}

export const privateAccessHeaders = () => ({ 'X-Cupcake-Key': readPrivateAccess() });
