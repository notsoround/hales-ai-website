import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { accountNativeHealth, sessionSnapshot, subscribeSession } from './accountSession';
import { NativeHealthSyncDetail, nativeHealthReceipt, type NativeHealthReceipt } from './NativeHealthSyncDetail';
import './native-health.css';

type Connection = { connection_id: string; connection_epoch: number; installation_id: string; epoch: number;
  source?: 'android_health_connect' | 'ios_healthkit';
  types: ('sleep' | 'heart_rate' | 'steps')[]; created: number; expires: number; revoked: number | null;
  status: 'active' | 'expired' | 'revoked'; last_received_at: number | null; last_observed_at: string | null };
type Sync = { receipts: NativeHealthReceipt[]; available: boolean; truncated: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TYPE_LABELS = { sleep:'Sleep sessions', heart_rate:'Heart rate samples', steps:'Step records' };
function object(value: unknown): value is Record<string,unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function stamp(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 253402300799; }
function instant(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19); }
function connections(result: unknown): Connection[] {
  if (!object(result) || result.ok !== true || !Array.isArray(result.connections) || result.connections.length > 1000) throw Error('Unconfirmed health connections');
  const seen = new Set<string>();
  for (const row of result.connections) {
    if (!object(row) || typeof row.connection_id !== 'string' || !UUID.test(row.connection_id) || seen.has(row.connection_id)
        || typeof row.installation_id !== 'string' || !UUID.test(row.installation_id) || row.connection_epoch !== 1
        || (row.source !== undefined && !['android_health_connect','ios_healthkit'].includes(row.source as string))
        || typeof row.epoch !== 'number' || !Number.isSafeInteger(row.epoch) || row.epoch < 1
        || !Array.isArray(row.types) || !row.types.length || row.types.length > 3 || new Set(row.types).size !== row.types.length
        || !row.types.every(type => typeof type === 'string' && ['sleep','heart_rate','steps'].includes(type))
        || !stamp(row.created) || !stamp(row.expires) || row.expires <= row.created
        || (row.revoked !== null && !stamp(row.revoked)) || !['active','expired','revoked'].includes(row.status as string)
        || (row.last_received_at !== null && !stamp(row.last_received_at))
        || (row.last_observed_at !== null && !instant(row.last_observed_at))) throw Error('Unconfirmed health connections');
    seen.add(row.connection_id);
  }
  return result.connections as Connection[];
}
function syncResult(result: unknown): Sync {
  if (!object(result) || result.ok !== true || !object(result.coverage) || typeof result.coverage.available !== 'boolean'
      || result.coverage.scope !== 'owned_native_health' || !Array.isArray(result.receipts) || result.receipts.length > 1000
      || (result.coverage.truncated !== undefined && typeof result.coverage.truncated !== 'boolean')) throw Error('Unconfirmed saved health syncs');
  const receipts = result.receipts.map(nativeHealthReceipt);
  if (new Set(receipts.map(receipt => receipt.request_id)).size !== receipts.length
      || (!result.coverage.available && receipts.length)) throw Error('Unconfirmed saved health syncs');
  return { receipts, available:result.coverage.available, truncated:result.coverage.truncated === true };
}

export function NativeHealthControls() {
  const session = useSyncExternalStore(subscribeSession,sessionSnapshot);
  return session.identity ? <HealthControls key={`${session.identity.account_id}:${session.generation}`} /> : null;
}

const REQUEST_TIMEOUT_MS = 20000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(Error('Request timed out.')), ms);
    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function HealthControls() {
  const [rows, setRows] = useState<Connection[] | null>(null), [saved, setSaved] = useState<Sync | null>(null);
  const [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const mounted = useRef(true), busyRef = useRef(''), requestId = useRef(0), lastRefreshMs = useRef(0);
  const loadedRef = useRef({ rows: false, saved: false });
  loadedRef.current = { rows: rows !== null, saved: saved !== null };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const setBusyState = (value: string) => { busyRef.current = value; if (mounted.current) setBusy(value); };
  const loadConnections = useCallback(async (quiet = false) => {
    if (busyRef.current) return;
    const token = ++requestId.current;
    setBusyState('connections');
    if (!quiet) setMessage('');
    try {
      const listed = connections(await withTimeout(accountNativeHealth('connections/list', {}), REQUEST_TIMEOUT_MS));
      if (!mounted.current || requestId.current !== token) return;
      lastRefreshMs.current = Date.now();
      setRows(listed);
      setRenewingId(prev => prev && listed.some(row => row.connection_id === prev && row.status === 'expired') ? prev : null);
    } catch {
      if (!mounted.current || requestId.current !== token) return;
      if (!quiet) { setRows(null); setMessage('Health upload permissions are unavailable. No permission changes were made.'); }
    } finally {
      if (requestId.current === token) setBusyState('');
    }
  }, []);
  const loadSync = useCallback(async (quiet = false) => {
    if (busyRef.current) return;
    const token = ++requestId.current;
    setBusyState('sync');
    if (!quiet) setMessage('');
    try {
      const result = await withTimeout(accountNativeHealth('sync', {}), REQUEST_TIMEOUT_MS);
      const loaded = syncResult(result), listed = connections(result);
      if (!mounted.current || requestId.current !== token) return;
      lastRefreshMs.current = Date.now();
      setSaved(loaded); setRows(listed);
      setRenewingId(prev => prev && listed.some(row => row.connection_id === prev && row.status === 'expired') ? prev : null);
    } catch {
      if (!mounted.current || requestId.current !== token) return;
      if (!quiet) { setSaved(null); setMessage('Saved health syncs are unavailable. No new upload was requested.'); }
    } finally {
      if (requestId.current === token) setBusyState('');
    }
  }, []);
  // Auto-refresh after the user returns from the mobile app, only once they have loaded this view.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || busyRef.current) return;
      if (Date.now() - lastRefreshMs.current < 10000) return;
      if (loadedRef.current.saved) void loadSync(true);
      else if (loadedRef.current.rows) void loadConnections(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadConnections, loadSync]);
  const revoke = async (id: string) => {
    if (busyRef.current) return;
    const token = ++requestId.current;
    setBusyState(id); setMessage('');
    try {
      const result = await withTimeout(accountNativeHealth<unknown>('connections/revoke', { connection_id: id }), REQUEST_TIMEOUT_MS);
      if (!object(result) || result.ok !== true || result.connection_id !== id || typeof result.revoked !== 'boolean') throw Error('Unconfirmed permission change');
      const listed = connections(await withTimeout(accountNativeHealth('connections/list', {}), REQUEST_TIMEOUT_MS));
      const canonical = listed.find(row => row.connection_id === id);
      if (!canonical || canonical.status === 'active') throw Error('Permission is still active or unconfirmed');
      if (!mounted.current || requestId.current !== token) return;
      lastRefreshMs.current = Date.now();
      setRows(listed); setMessage('Uploads are stopped for this health connection. Your saved sync history is kept.');
    } catch {
      if (!mounted.current || requestId.current !== token) return;
      setRows(null); setMessage('The permission change could not be confirmed. Reload health upload permissions before trying again.');
    } finally {
      if (requestId.current === token) setBusyState('');
    }
  };
  return <details className="cc-account-controls cc-native-health-controls"><summary>Health uploads</summary>
    <p>An upload permission lets your connected Android or iPhone app send selected health records. A saved receipt confirms that an upload reached your account.</p>
    <p className="cc-native-health-note">Phone read permission is separate. Coach access is unchanged. Stopping uploads keeps saved history and does not change your phone’s permissions.</p>
    <div className="cc-native-health-actions">
      <button type="button" className="cc-secondary" disabled={!!busy} onClick={() => void loadConnections()}>{busy === 'connections' ? 'Loading permissions…' : rows === null ? 'Load upload permissions' : 'Refresh upload permissions'}</button>
      <button type="button" className="cc-secondary" disabled={!!busy} onClick={() => void loadSync()}>{busy === 'sync' ? 'Loading saved syncs…' : saved === null ? 'Load saved health syncs' : 'Refresh saved health syncs'}</button>
    </div>
    {message && <p role="status">{message}</p>}
    {rows && <section aria-label="Health upload permissions"><h4>Upload permissions</h4>{rows.length ? <ul className="cc-native-health-connections">{rows.map(row => {
      const appLabel = row.source === 'ios_healthkit' ? 'iPhone' : 'Android';
      const isRenewing = renewingId === row.connection_id;
      return <li key={row.connection_id} data-status={row.status}>
        <div className="cc-native-health-row-head">
          <strong>{row.status === 'active' ? 'Upload permission active' : row.status === 'expired' ? 'Upload permission expired' : 'Uploads stopped'}</strong>
          <span className={`cc-native-health-pill is-${row.status}`}>{row.status === 'active' ? 'Active' : row.status === 'expired' ? 'Expired' : 'Stopped'}</span>
        </div>
        <p>{appLabel} app {row.installation_id.slice(-8)} · health connection {row.connection_id.slice(-8)}</p>
        <p>{row.types.map(type => TYPE_LABELS[type]).join(' · ')}</p>
        <dl className="cc-native-health-facts"><div><dt>Latest server receipt</dt><dd>{row.last_received_at === null ? 'No saved upload receipt' : new Date(row.last_received_at * 1000).toLocaleString()}</dd></div>
          <div><dt>Latest source observation</dt><dd>{row.last_observed_at === null ? 'No source observation confirmed' : new Date(row.last_observed_at).toLocaleString()}</dd></div>
          <div><dt>{row.status === 'expired' ? 'Permission expired' : 'Permission expires'}</dt><dd>{new Date(row.expires * 1000).toLocaleString()}</dd></div></dl>
        {row.status === 'active' && <button type="button" className="cc-secondary" disabled={!!busy} aria-label={`Stop health uploads for connection ${row.connection_id.slice(-8)}`} onClick={() => void revoke(row.connection_id)}>{busy === row.connection_id ? 'Stopping uploads…' : 'Stop health uploads'}</button>}
        {row.status === 'expired' && <div className="cc-native-health-renew">
          <div className="cc-native-health-actions">
            <button type="button" className="cc-primary" disabled={!!busy} onClick={() => setRenewingId(isRenewing ? null : row.connection_id)}>{isRenewing ? 'Hide renew steps' : 'Renew upload permission'}</button>
            <button type="button" className="cc-secondary" disabled={!!busy} onClick={() => void loadConnections()}>{busy === 'connections' ? 'Checking…' : 'Check status'}</button>
          </div>
          {isRenewing && <div className="cc-native-health-renew-steps" role="status">
            <p>Your saved health history is kept. To resume uploads from your {appLabel} app:</p>
            <ol>
              <li>Open the Cupcake {appLabel} preview app on your phone.</li>
              <li>Tap <strong>Reconnect health uploads</strong> to open the approval screen here.</li>
              <li>Approve your health types — this page refreshes automatically when you return.</li>
            </ol>
          </div>}
        </div>}
      </li>;
    })}</ul> : <p>No health upload permissions were found for this account.</p>}</section>}
    {saved && <section aria-label="Saved health sync receipts"><h4>Saved health syncs</h4>{!saved.available ? <p>Saved health sync readback is unavailable. No upload is confirmed here.</p> : saved.receipts.length ? <>
      <p className="cc-native-health-note">These are saved uploads, not live readings. Record counts do not establish daily totals or a complete history.</p>
      {saved.truncated && <p className="cc-native-health-note">Only the most recent saved syncs are shown.</p>}
      <div className="cc-native-health-receipts">{saved.receipts.map(receipt => <details key={receipt.request_id}><summary><strong>Received {new Date(receipt.received_at).toLocaleString()}</strong><span>{receipt.record_count} source {receipt.record_count === 1 ? 'record' : 'records'} · request {receipt.request_id.slice(-8)}</span></summary><NativeHealthSyncDetail value={{receipt}} /></details>)}</div>
    </> : <p>No saved health sync receipts were returned. An active permission alone does not confirm an upload.</p>}</section>}
  </details>;
}
