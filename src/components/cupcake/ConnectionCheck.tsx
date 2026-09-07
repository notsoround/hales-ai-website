import { useRef, useState } from 'react';
import { accessHeaders, libraryRequest } from './library';

type Check = { name: string; status: string; detail: string };
export default function ConnectionCheck() {
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [checkedAt, setCheckedAt] = useState('');
  const running = useRef(false);
  async function check() {
    if (running.current) return;
    running.current = true; setBusy(true);
    const results = await Promise.allSettled([
      libraryRequest({ action: 'projects' }),
      fetch('https://automate.hales.ai/webhook/cupcake-feed', { headers: accessHeaders(), cache: 'no-store', signal: AbortSignal.timeout(20000) }).then(async r => { if (!r.ok) throw new Error('Unavailable'); const d = await r.json(); if (!Array.isArray(d.items)) throw new Error('Invalid response'); }),
      navigator.permissions?.query({ name: 'microphone' as PermissionName }).then(p => p.state),
    ]);
    const mic = results[2];
    setChecks([
      { name: 'Private library', status: results[0].status === 'fulfilled' ? 'Reachable' : 'Needs attention', detail: results[0].status === 'fulfilled' ? 'Your password can access the library and project index.' : 'Check your password and connection, then retry.' },
      { name: 'Daily feed', status: results[1].status === 'fulfilled' ? 'Reachable' : 'Needs attention', detail: results[1].status === 'fulfilled' ? 'The authenticated feed returned a valid response.' : 'The feed could not be verified. Reconnect or try again.' },
      { name: 'Microphone', status: mic.status === 'fulfilled' && mic.value === 'granted' ? 'Allowed' : mic.status === 'fulfilled' && mic.value === 'denied' ? 'Blocked' : 'Ask when starting', detail: mic.status === 'fulfilled' && mic.value === 'denied' ? 'Allow Microphone in your browser’s site settings for hales.ai.' : 'This check does not turn on your microphone. Talk tests the actual audio connection.' },
    ]);
    setCheckedAt(new Date().toLocaleTimeString()); running.current = false; setBusy(false);
  }
  return <section className="cc-card" aria-label="Connection check">
    <div className="cc-heading-row"><h3>What can Cupcake reach?</h3><button className="cc-secondary" disabled={busy} onClick={() => void check()}>{busy ? 'Checking…' : 'Check access'}</button></div>
    <p className="cc-muted">Verify your library, feed, and microphone permission without starting a call.</p>
    <div aria-live="polite">{checks.map(c => <div key={c.name} className="cc-card"><strong>{c.name} · {c.status}</strong><p className="cc-muted">{c.detail}</p></div>)}{checkedAt && <p className="cc-muted cc-small">Last checked {checkedAt}. A reachable service does not confirm every connected account is signed in.</p>}</div>
    <p className="cc-muted cc-small">Below, access keys let other apps search your selected Cupcake library. They do not automatically import those apps’ private chat histories.</p>
  </section>;
}
