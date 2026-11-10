import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { sessionSnapshot, subscribeSession } from './accountSession';
import { CGMStatusClient, visibleCGMFreshness, type CGMStatus } from './accountCGM';
import { ToneIcon } from './design/ToneIcon';
import './account-cgm.css';

const time = (value: string | null) => value === null ? 'Unknown' : new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const freshnessLabel = { current: 'Recent saved reading · not a live stream', stale: 'Stale reading · not live', future: 'Source time is ahead · timing unverified', unknown: 'Reading time unknown · freshness unverified' };
const unavailableLabel = (data: CGMStatus) => data.reason === 'no_saved_reading' ? 'No saved CGM reading' : data.reason === 'not_connected' || data.reason === 'credential_unavailable' ? 'CGM source is not connected' : 'Saved CGM source is unavailable';
function CGMCard() {
  const [client] = useState(() => new CGMStatusClient());
  const [data, setData] = useState<CGMStatus | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState(''), [elapsed, setElapsed] = useState(0);
  const alive = useRef(false), pending = useRef<AbortController | null>(null), receivedAt = useRef(0), shown = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setData(null); setElapsed(0);
    try {
      const result = await client.read(controller.signal);
      if (alive.current && !controller.signal.aborted) { receivedAt.current = performance.now(); shown.current = result.reason !== 'unsupported_account'; setData(result); }
    } catch (cause) {
      if (alive.current && !controller.signal.aborted && !(cause instanceof DOMException && cause.name === 'AbortError')) setError('Saved CGM source could not be checked. Manual readings are unchanged.');
    } finally { if (pending.current === controller) { pending.current = null; if (alive.current) setBusy(false); } }
  }, [client]);
  useEffect(() => {
    alive.current = true; void refresh();
    const timer = window.setInterval(() => setElapsed(Math.max(0, performance.now() - receivedAt.current)), 60000);
    return () => { alive.current = false; pending.current?.abort(); pending.current = null; window.clearInterval(timer); };
  }, [refresh]);
  // Unsupported accounts never see another person's source or an irrelevant setup card.
  if (data?.reason === 'unsupported_account' || busy && !shown.current && !error) return null;
  const status = data ? visibleCGMFreshness(data, elapsed) : 'unknown';
  return <section className="cc-card cc-cgm" aria-label="Saved CGM source" data-empty={data && !data.latest && !error && !busy ? '' : undefined}>
    <div className="cc-cgm-heading"><h3 className="cc-card-title"><ToneIcon tone="glucose"/>Libre CGM</h3><button type="button" className="cc-text-button" aria-label="Check saved CGM source" disabled={busy} onClick={() => void refresh()}>{busy ? 'Checking…' : 'Refresh'}</button></div>
    {busy && <p role="status">Checking saved CGM source…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p className="cc-cgm-freshness" role="status">{data.latest ? freshnessLabel[status] : unavailableLabel(data)}</p>
      {data.latest && <><p className="cc-cgm-value"><strong>{data.latest.value.toLocaleString(undefined, { maximumSignificantDigits: 12 })}</strong> <span>{data.latest.unit}</span></p>
        <p className="cc-muted cc-small">Saved reading time: <time dateTime={data.latest.observedAt || undefined}>{time(data.latest.observedAt)}</time></p></>}
      <details><summary>Source & timing</summary>
        <dl><div><dt>Saved source checked</dt><dd><time dateTime={data.checkedAt}>{time(data.checkedAt)}</time></dd></div><div><dt>Provider last checked</dt><dd>Unknown</dd></div>
          <div><dt>Source connection</dt><dd>{data.connected === true ? 'Reported connected' : data.connected === false ? 'Reported disconnected' : 'Unknown'}</dd></div>
          {data.sourceStatus !== null && <div><dt>Source status</dt><dd>{data.sourceStatus}</dd></div>}
          {data.latest && <div><dt>Source trend</dt><dd>{data.latest.trend}</dd></div>}
        </dl>
        <p className="cc-muted cc-small">Latest saved Libre observation only; not complete CGM history. Original provider timestamp is not retained in this view. Refresh checks the saved source and does not request a new sensor reading. Manual readings are kept separately.</p>
      </details>
    </>}
  </section>;
}
export default function AccountCGMCard() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  return ACCOUNT_SESSIONS && session.identity ? <CGMCard key={session.generation}/> : null;
}
