import { useState } from 'react';
import { accountNative } from './accountSession';
import { NATIVE_CLIENT } from './nativeConnectionRequest';
import './native-connections.css';

type Installation = { installation_id: string; client_id: string; epoch: number; created: number; refreshed: number; idle_expires: number; absolute_expires: number; revoked: number | null; scope: 'native:profile'; status: 'active' | 'expired' | 'revoked' };
function installationList(result: unknown): Installation[] {
  const rows = (result as { installations?: unknown })?.installations;
  if (!Array.isArray(rows) || rows.length > 1000 || rows.some(row => !row || typeof row !== 'object'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.installation_id)
      || row.client_id !== NATIVE_CLIENT || row.scope !== 'native:profile' || !Number.isSafeInteger(row.epoch) || row.epoch < 1
      || !['active','expired','revoked'].includes(row.status)
      || ['created','refreshed','idle_expires','absolute_expires'].some(key => typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] < 0)
      || (row.revoked !== null && (typeof row.revoked !== 'number' || !Number.isFinite(row.revoked))))) throw Error('The connected-app list could not be confirmed.');
  return rows;
}
export function NativeInstallationControls() {
  const [rows, setRows] = useState<Installation[] | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const load = async () => {
    if (busy) return; setBusy(true); setMessage('');
    try { setRows(installationList(await accountNative('installations/list', {}))); }
    catch { setMessage('The connected-app list is unavailable. No connection changes were made.'); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    if (busy) return; setBusy(true); setMessage('');
    try {
      const result = await accountNative<{ revoked: boolean; installation_id: string }>('installations/revoke', { installation_id: id });
      if (result.installation_id !== id || typeof result.revoked !== 'boolean') throw Error('Unconfirmed response');
      const saved = installationList(await accountNative('installations/list', {}));
      if (saved.some(row => row.installation_id === id && row.status === 'active')) throw Error('Revocation not confirmed');
      setRows(saved);
      setMessage('This app connection is disconnected. Your saved account data is kept.');
    } catch { setMessage('Disconnection could not be confirmed. Reload the list before trying again.'); setRows(null); }
    finally { setBusy(false); }
  };
  return <details className="cc-account-controls cc-native-app-controls"><summary>Android app connections</summary>
    <p>The Android preview can confirm your name and email. Health upload is not yet available. Disconnecting stops this app’s account access and keeps saved history.</p>
    <button type="button" className="cc-secondary" disabled={busy} onClick={() => void load()}>{busy ? 'Checking…' : rows === null ? 'Load connected apps' : 'Refresh connected apps'}</button>
    {rows && (rows.length ? <ul>{rows.map(row => <li key={row.installation_id}><strong>Cupcake Android preview</strong><p>{row.status === 'active' ? 'Connected' : row.status === 'expired' ? 'Expired' : 'Disconnected'} · {row.installation_id.slice(-8)}</p><p className="cc-small">Last connected {new Date(row.refreshed * 1000).toLocaleString()}</p>{row.status === 'active' && <button type="button" className="cc-secondary" disabled={busy} aria-label={`Disconnect Android app ${row.installation_id.slice(-8)}`} onClick={() => void revoke(row.installation_id)}>Disconnect this app</button>}</li>)}</ul> : <p>No Android apps are connected to this account.</p>)}
    {message && <p role="status">{message}</p>}
  </details>;
}
