/** Small behaviours that make the account app act like an installed phone app. Each one is optional: where the
 *  browser lacks the feature nothing happens, and nothing here reads or stores account data. */
import { useEffect, useRef, useState } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';

type Watcher = { onclose: (() => void) | null; destroy: () => void };
/** How many layers registered through useBackClose are open right now (sheets, panels, the recap card). */
let openLayers = 0;
export function openLayerCount() { return openLayers; }
/** While `open`, the phone's Back button or gesture closes this layer instead of leaving the screen (Android Chrome's
 *  close-request signal; Escape on a keyboard). History is not touched, so tab Back keeps working underneath.
 *  An open layer is also counted, so page gestures (pull to refresh) stay off while it is up. */
export function useBackClose(open: boolean, onClose: () => void) {
  const latest = useRef(onClose); latest.current = onClose;
  useEffect(() => {
    if (!open || !ACCOUNT_SESSIONS) return;
    openLayers++;
    const release = () => { openLayers = Math.max(0, openLayers - 1); };
    const Ctor = (window as unknown as { CloseWatcher?: new () => Watcher }).CloseWatcher;
    if (!Ctor) return release;
    let watcher: Watcher;
    try { watcher = new Ctor(); } catch { return release; }
    watcher.onclose = () => latest.current();
    return () => { release(); watcher.onclose = null; try { watcher.destroy(); } catch { /* already closed */ } };
  }, [open]);
}

/** A short tap on phones that support it (Android). Silent everywhere else and for people who prefer reduced motion. */
export function haptic(kind: 'tap' | 'confirm' | 'warn' = 'tap') {
  if (!ACCOUNT_SESSIONS || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate(kind === 'tap' ? 8 : kind === 'confirm' ? [10, 40, 14] : [18, 60, 18]);
  } catch { /* Haptics are optional. */ }
}

type Sentinel = { release: () => Promise<void> };
/** Keeps the screen on while `active` (a live conversation, a recording, the camera) and lets it sleep again after. */
export function useScreenAwake(active: boolean) {
  useEffect(() => {
    if (!active || !ACCOUNT_SESSIONS) return;
    const api = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!api) return;
    let lock: Sentinel | null = null, live = true;
    const hold = () => { if (document.visibilityState !== 'visible') return; void api.request('screen').then(next => { if (live) lock = next; else void next.release().catch(() => {}); }).catch(() => {}); };
    hold(); document.addEventListener('visibilitychange', hold);
    return () => { live = false; document.removeEventListener('visibilitychange', hold); void lock?.release().catch(() => {}); };
  }, [active]);
}

/** Whether the phone reports a connection. `back` flips true for a moment after the connection returns. */
export function useConnection() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const [back, setBack] = useState(false);
  useEffect(() => {
    let timer = 0;
    const up = () => { setOnline(true); setBack(true); window.clearTimeout(timer); timer = window.setTimeout(() => setBack(false), 2600); };
    const down = () => { window.clearTimeout(timer); setBack(false); setOnline(false); };
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.clearTimeout(timer); window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return { online, back };
}

/** Calls `onResume` when the app comes back to the front after at least `awayMs` out of view, while connected. */
export function useResumed(awayMs: number, onResume: () => void) {
  const latest = useRef(onResume); latest.current = onResume;
  useEffect(() => {
    let hiddenAt: number | null = null;
    const change = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt; hiddenAt = null;
      if (away >= awayMs && navigator.onLine !== false) latest.current();
    };
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, [awayMs]);
}
