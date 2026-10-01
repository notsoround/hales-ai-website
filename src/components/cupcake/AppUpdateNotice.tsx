import { useCallback, useEffect, useRef, useState } from 'react';
import { releaseEntry, releaseEntryFromHtml } from './appUpdate';

/** Detect a newer public shell. Never reload, navigate, or clear any app storage. */
export function AppUpdateNotice({ busy }: { busy: boolean }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'current' | 'new' | 'unavailable'>('idle');
  const lastCheck = useRef(0);
  const checking = useRef(false);
  const alive = useRef(true);
  const check = useCallback(async (manual = false) => {
    if (checking.current || (!manual && Date.now() - lastCheck.current < 60000)) return;
    const current = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')).map(script => releaseEntry(script.src, location.href)).find(Boolean);
    if (!current) { if (manual) setStatus('unavailable'); return; }
    checking.current = true; lastCheck.current = Date.now();
    if (manual) setStatus('checking');
    try {
      // This public URL is outside the service worker's offline /cupcake fallback.
      const response = await fetch(new URL('/index.html', location.href), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('No app shell');
      const next = releaseEntryFromHtml(await response.text(), location.href);
      if (!next) throw new Error('No app version');
      if (alive.current) setStatus(next !== current ? 'new' : manual ? 'current' : 'idle');
    } catch { if (alive.current && manual) setStatus('unavailable'); }
    finally { checking.current = false; }
  }, []);
  useEffect(() => {
    alive.current = true;
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', visible); visible();
    return () => { alive.current = false; document.removeEventListener('visibilitychange', visible); };
  }, [check]);
  return <aside aria-label="App updates">
    {status === 'new' && <p className="cc-notice" role="status">A new Cupcake version is available. {busy ? 'Finish your recording, call, or upload first. ' : ''}Save any unfinished entries, then reload or close and reopen the app. Cupcake will not reload itself.</p>}
    {status === 'current' && <p className="cc-muted cc-small" role="status">This page is using the current Cupcake version.</p>}
    {status === 'unavailable' && <p className="cc-muted cc-small" role="status">Could not check the app version. Your current work is still open.</p>}
    <button type="button" className="cc-text-button" disabled={status === 'checking'} onClick={() => void check(true)}>{status === 'checking' ? 'Checking app version…' : 'Check for app update'}</button>
  </aside>;
}
