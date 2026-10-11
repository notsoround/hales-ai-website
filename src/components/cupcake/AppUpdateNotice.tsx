import { useCallback, useEffect, useState } from 'react';
import { releaseEntry, releaseEntryFromHtml } from './appUpdate';

type UpdateStatus = 'idle' | 'checking' | 'current' | 'new' | 'unavailable';
const subscribers = new Set<(status: UpdateStatus) => void>();
let sharedStatus: UpdateStatus = 'idle';
let lastCheck = 0;
let checking = false;

function publish(status: UpdateStatus) {
  sharedStatus = status;
  subscribers.forEach(listener => listener(status));
}

async function loadPublicRelease() {
  // This public URL is outside the service worker's offline /cupcake fallback.
  const response = await fetch(new URL('/index.html', location.href), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('No app shell');
  const next = releaseEntryFromHtml(await response.text(), location.href);
  if (!next) throw new Error('No app version');
  return next;
}

/** One public /index.html check shared by the banner and the settings button. Never reloads, navigates, or clears storage. */
async function checkRelease(manual = false) {
  if (checking || (!manual && Date.now() - lastCheck < 60000)) return;
  const current = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')).map(script => releaseEntry(script.src, location.href)).find(Boolean);
  if (!current) { if (manual) publish('unavailable'); return; }
  checking = true; lastCheck = Date.now();
  if (manual) publish('checking');
  try {
    const next = await loadPublicRelease();
    publish(next !== current ? 'new' : manual ? 'current' : 'idle');
  } catch { if (manual) publish('unavailable'); }
  finally { checking = false; }
}

/** Detect a newer public shell. Never reload, navigate, or clear any app storage. */
export function AppUpdateNotice({ busy, part = 'all' }: { busy: boolean; part?: 'all' | 'banner' | 'check' }) {
  const [status, setStatus] = useState<UpdateStatus>(sharedStatus);
  const check = useCallback((manual = false) => { void checkRelease(manual); }, []);
  useEffect(() => {
    subscribers.add(setStatus);
    setStatus(sharedStatus);
    const visible = () => { if (document.visibilityState === 'visible') void checkRelease(); };
    document.addEventListener('visibilitychange', visible); visible();
    return () => { subscribers.delete(setStatus); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const banner = status === 'new' ? <p className="cc-notice" role="status">A new Cupcake version is available. {busy ? 'Finish your recording, call, or upload first. ' : ''}Save any unfinished entries, then reload or close and reopen the app. Cupcake will not reload itself.</p> : null;
  const manual = <>
    {status === 'current' && <p className="cc-muted cc-small" role="status">This page is using the current Cupcake version.</p>}
    {status === 'unavailable' && <p className="cc-muted cc-small" role="status">Could not check the app version. Your current work is still open.</p>}
    <button type="button" className="cc-text-button" disabled={status === 'checking'} onClick={() => check(true)}>{status === 'checking' ? 'Checking app version…' : 'Check for app update'}</button>
  </>;
  if (part === 'banner') return banner ? <aside aria-label="App updates">{banner}</aside> : null;
  if (part === 'check') return <div className="cc-update-check">{manual}</div>;
  return <aside aria-label="App updates">{banner}{manual}</aside>;
}
