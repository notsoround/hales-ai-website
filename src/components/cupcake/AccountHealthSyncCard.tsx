import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HeartPulse } from 'lucide-react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { sessionSnapshot, subscribeSession } from './accountSession';
import { HealthStatusClient, healthMetricLabel, openHealthSettings, type HealthSyncStatus } from './accountHealthStatus';
import './account-health-sync.css';

const time = (seconds: number | null) => seconds === null ? 'None received' : new Date(seconds * 1000).toLocaleString();
function period(data: HealthSyncStatus) {
  if (data.last_observed_at === null) return 'No supported observations confirmed';
  const device = data.devices.find(d => d.last_observed_at === data.last_observed_at);
  if (!device) return 'Saved period could not be matched to a connection';
  try { return new Intl.DateTimeFormat(undefined, { timeZone: device.timezone, dateStyle: 'medium' }).format(new Date(data.last_observed_at)) + ` (${device.timezone})`; }
  catch { return 'Saved period timezone is unavailable'; }
}
// A visible recency hint for a daily export, never evidence that a device failed.
const twoDays = 48 * 60 * 60 * 1000;
function HealthSyncCard() {
  const [client] = useState(() => new HealthStatusClient());
  const [data, setData] = useState<HealthSyncStatus | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState(''), [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const alive = useRef(false), inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setData(null); setCheckedAt(null);
    try { const result = await client.read(); if (alive.current) { setData(result); setCheckedAt(new Date()); } }
    catch (cause) { if (alive.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Health connection status could not be checked.'); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }, [client]);
  useEffect(() => { alive.current = true; void refresh(); return () => { alive.current = false; }; }, [refresh]);
  const oldUpload = data?.last_received_at != null && checkedAt !== null && checkedAt.getTime() - data.last_received_at * 1000 > twoDays;
  const labels = data ? [...new Set(data.metrics.map(healthMetricLabel))] : [];
  const setup = () => { if (!openHealthSettings()) setError('Open Settings, then Apple Health connection, to set up or check your phone.'); };
  return <section className="cc-card cc-health-sync" aria-label="Apple Health uploads">
    <div className="cc-heading-row"><h3 className="cc-card-title"><HeartPulse size={20} aria-hidden="true"/>Apple Health uploads</h3></div>
    <p className="cc-muted cc-small">From your iPhone to this account.</p>
    {busy && <p role="status">Checking Apple Health uploads…</p>}
    {error && <div role="alert"><p>{error}</p><p className="cc-muted cc-small">No new upload or observation is confirmed by this check.</p></div>}
    {data && <>
      {!data.devices.length && <p>No Apple Health upload set up for this account.</p>}
      {data.devices.length > 0 && data.last_received_at === null && <p>Waiting for the first upload. Phone permission alone does not mean data is arriving.</p>}
      <dl className="cc-health-sync-times"><div><dt>Last upload received</dt><dd>{time(data.last_received_at)}</dd></div><div><dt>Latest saved daily period</dt><dd>{period(data)}</dd></div></dl>
      <p className="cc-muted cc-small">Daily dates use the connection’s timezone. They are not measurement or sleep-end times. An upload may contain no supported data.</p>
      {data.last_received_at !== null && data.last_observed_at === null && <p>Upload received; no supported observations are confirmed.</p>}
      {oldUpload && <p className="cc-health-sync-old">No upload received in the last 2 days. Check the exporter on your phone.</p>}
      {labels.length > 0 && <p className="cc-muted cc-small">Saved previously: {labels.join(', ')}. These may come from earlier uploads, including expired or revoked connections.</p>}
      {data.devices.length > 0 && <details><summary>Connection details ({data.devices.length})</summary><ul>{data.devices.map(device => <li key={device.id}><strong>{device.label}</strong> · {device.status === 'active' ? 'Upload permission active' : device.status === 'expired' ? 'Upload permission expired' : 'Upload permission revoked'}<p className="cc-muted cc-small">Configured export source: {device.preferred_source || 'Not specified'} · {device.timezone}<br/>Last upload: {time(device.last_received_at)}</p></li>)}</ul><p className="cc-muted cc-small">Permission alone does not confirm uploads. Sleep is an algorithm estimate. The configured source does not verify a measurement.</p></details>}
      {checkedAt && <p className="cc-muted cc-small">Status checked {checkedAt.toLocaleTimeString()}. Checking does not refresh measurements.</p>}
    </>}
    <div className="cc-action-row"><button type="button" className="cc-secondary" disabled={busy} onClick={() => void refresh()}>Check upload status</button><button type="button" className="cc-text-button" onClick={setup}>iPhone setup in Settings</button></div>
  </section>;
}
export default function AccountHealthSyncCard() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  return ACCOUNT_SESSIONS && session.identity ? <HealthSyncCard key={session.generation}/> : null;
}
