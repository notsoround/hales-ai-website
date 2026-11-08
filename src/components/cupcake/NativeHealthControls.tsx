import { useState, useSyncExternalStore } from 'react';
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

function HealthControls() {
  const [rows, setRows] = useState<Connection[] | null>(null), [saved, setSaved] = useState<Sync | null>(null);
  const [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const loadConnections = async () => {
    if (busy) return; setBusy('connections'); setMessage('');
    try { setRows(connections(await accountNativeHealth('connections/list',{}))); }
    catch { setRows(null); setMessage('Health upload permissions are unavailable. No permission changes were made.'); }
    finally { setBusy(''); }
  };
  const loadSync = async () => {
    if (busy) return; setBusy('sync'); setMessage('');
    try {
      const result = await accountNativeHealth('sync',{});
      const loaded = syncResult(result), listed = connections(result);
      setSaved(loaded); setRows(listed);
    } catch { setSaved(null); setMessage('Saved health syncs are unavailable. No new upload was requested.'); }
    finally { setBusy(''); }
  };
  const revoke = async (id: string) => {
    if (busy) return; setBusy(id); setMessage('');
    try {
      const result = await accountNativeHealth<unknown>('connections/revoke',{connection_id:id});
      if (!object(result) || result.ok !== true || result.connection_id !== id || typeof result.revoked !== 'boolean') throw Error('Unconfirmed permission change');
      const listed = connections(await accountNativeHealth('connections/list',{}));
      const canonical = listed.find(row => row.connection_id === id);
      if (!canonical || canonical.status === 'active') throw Error('Permission is still active or unconfirmed');
      setRows(listed); setMessage('Uploads are stopped for this health connection. Your saved sync history is kept.');
    } catch { setRows(null); setMessage('The permission change could not be confirmed. Reload health upload permissions before trying again.'); }
    finally { setBusy(''); }
  };
  return <details className="cc-account-controls cc-native-health-controls"><summary>Health uploads</summary>
    <p>An upload permission lets your connected Android or iPhone app send selected health records. A saved receipt confirms that an upload reached your account.</p>
    <p className="cc-native-health-note">Phone read permission is separate. Coach access is unchanged. Stopping uploads keeps saved history and does not change your phone’s permissions.</p>
    <div className="cc-native-health-actions">
      <button type="button" className="cc-secondary" disabled={!!busy} onClick={() => void loadConnections()}>{busy === 'connections' ? 'Loading permissions…' : rows === null ? 'Load upload permissions' : 'Refresh upload permissions'}</button>
      <button type="button" className="cc-secondary" disabled={!!busy} onClick={() => void loadSync()}>{busy === 'sync' ? 'Loading saved syncs…' : saved === null ? 'Load saved health syncs' : 'Refresh saved health syncs'}</button>
    </div>
    {message && <p role="status">{message}</p>}
    {rows && <section aria-label="Health upload permissions"><h4>Upload permissions</h4>{rows.length ? <ul className="cc-native-health-connections">{rows.map(row => <li key={row.connection_id}>
      <strong>{row.status === 'active' ? 'Upload permission active' : row.status === 'expired' ? 'Upload permission expired' : 'Uploads stopped'}</strong>
      <p>{row.source === 'ios_healthkit' ? 'iPhone' : 'Android'} app {row.installation_id.slice(-8)} · health connection {row.connection_id.slice(-8)}</p>
      <p>{row.types.map(type => TYPE_LABELS[type]).join(' · ')}</p>
      <dl className="cc-native-health-facts"><div><dt>Latest server receipt</dt><dd>{row.last_received_at === null ? 'No saved upload receipt' : new Date(row.last_received_at * 1000).toLocaleString()}</dd></div>
        <div><dt>Latest source observation</dt><dd>{row.last_observed_at === null ? 'No source observation confirmed' : new Date(row.last_observed_at).toLocaleString()}</dd></div>
        <div><dt>Permission expires</dt><dd>{new Date(row.expires * 1000).toLocaleString()}</dd></div></dl>
      {row.status === 'active' && <button type="button" className="cc-secondary" disabled={!!busy} aria-label={`Stop health uploads for connection ${row.connection_id.slice(-8)}`} onClick={() => void revoke(row.connection_id)}>{busy === row.connection_id ? 'Stopping uploads…' : 'Stop health uploads'}</button>}
    </li>)}</ul> : <p>No health upload permissions were found for this account.</p>}</section>}
    {saved && <section aria-label="Saved health sync receipts"><h4>Saved health syncs</h4>{!saved.available ? <p>Saved health sync readback is unavailable. No upload is confirmed here.</p> : saved.receipts.length ? <>
      <p className="cc-native-health-note">These are saved uploads, not live readings. Record counts do not establish daily totals or a complete history.</p>
      {saved.truncated && <p className="cc-native-health-note">Only the most recent saved syncs are shown.</p>}
      <div className="cc-native-health-receipts">{saved.receipts.map(receipt => <details key={receipt.request_id}><summary><strong>Received {new Date(receipt.received_at).toLocaleString()}</strong><span>{receipt.record_count} source {receipt.record_count === 1 ? 'record' : 'records'} · request {receipt.request_id.slice(-8)}</span></summary><NativeHealthSyncDetail value={{receipt}} /></details>)}</div>
    </> : <p>No saved health sync receipts were returned. An active permission alone does not confirm an upload.</p>}</section>}
  </details>;
}
