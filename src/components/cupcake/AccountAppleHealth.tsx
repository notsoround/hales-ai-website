import { useState, type FormEvent } from 'react';
import { accountHealth } from './accountSession';

type Device = {
  id: string; label: string; timezone: string; preferred_source: string;
  created_at: number; expires_at: number; revoked_at: number | null;
  status: 'active' | 'expired' | 'revoked'; last_received_at: number | null;
  last_observed_at: string | null; metrics: string[];
};
type Sync = { devices: Device[]; last_received_at: number | null; last_observed_at: string | null; metrics: string[]; coverage_note: string };
type Setup = { request_id: string; label: string; timezone: string; preferred_source: string; expires_in_days: number };
type Created = { device: Device; upload_credential?: string; credential_shown: boolean; upload_url: string };
const UPLOAD_URL = 'https://automate.hales.ai/api/health-auto-export';
const received = (epoch: number | null) => epoch == null ? 'No upload received' : new Date(epoch * 1000).toLocaleString();
const observed = (iso: string | null) => iso == null ? 'No supported observation received' : new Date(iso).toLocaleString();

export function AccountAppleHealth() {
  const [label, setLabel] = useState('My iPhone');
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const [source, setSource] = useState('');
  const [expiry, setExpiry] = useState('30');
  const [devices, setDevices] = useState<Device[]>([]), [sync, setSync] = useState<Sync | null>(null);
  const [pending, setPending] = useState<Setup | null>(null);
  const [credential, setCredential] = useState<{ value: string; device: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');

  const refresh = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const [list, status] = await Promise.all([
        accountHealth<{ devices: Device[] }>('devices/list', {}), accountHealth<Sync>('sync', {}),
      ]);
      setDevices(list.devices); setSync(status);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Apple Health connection status is unavailable.'); }
    finally { setBusy(false); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage(''); setCredential(null);
    try {
      let request = pending;
      if (!request) {
        const days = Number(expiry);
        if (!label.trim() || !source.trim() || !Number.isInteger(days) || days < 1 || days > 90) throw Error('Enter a device label, Apple Health source name and expiry from 1 to 90 days.');
        try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw Error('Enter a valid IANA timezone.'); }
        if (!timezone.trim()) throw Error('Enter a valid IANA timezone.');
        request = { request_id: crypto.randomUUID(), label: label.trim(), timezone, preferred_source: source.trim(), expires_in_days: days };
        setPending(request);
      }
      const result = await accountHealth<Created>('devices/create', request);
      if (!result.device?.id || result.upload_url !== UPLOAD_URL || typeof result.credential_shown !== 'boolean') throw Error('The upload setup was not confirmed. Check devices before starting another setup.');
      if (result.credential_shown) {
        if (!/^ah_[A-Za-z0-9_-]{43}$/.test(result.upload_credential || '')) throw Error('The upload credential was not confirmed. Check devices before starting another setup.');
        setCredential({ value: result.upload_credential!, device: result.device.id });
        setMessage('Upload authorization created. This does not confirm an Apple Health upload.');
      } else setMessage('This connection already exists. Its credential cannot be shown again. If you did not save it, revoke this device and create a new connection.');
      setDevices(current => [result.device, ...current.filter(device => device.id !== result.device.id)]);
      setPending(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Setup was not confirmed. Retry the same request, then check devices.'); }
    finally { setBusy(false); }
  };
  const revoke = async (device: Device) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await accountHealth<{ revoked: boolean }>('devices/revoke', { device_id: device.id });
      if (result.revoked !== true) throw Error('Revocation was not confirmed. Check connection status.');
      setDevices(current => current.map(row => row.id === device.id ? { ...row, status: 'revoked' } : row));
      if (credential?.device === device.id) setCredential(null);
      setMessage('Upload authorization revoked. Previously saved observations stay unchanged.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Revocation was not confirmed.'); }
    finally { setBusy(false); }
  };

  return <section id="account-health-connection" tabIndex={-1} className="cc-account-controls" aria-label="Apple Health connection">
    <h3>Apple Health connection</h3>
    <p>Connect Health Auto Export with a separate upload credential for this account. Adding Matthieu to your Home Screen does not grant access to Apple Health.</p>
    <button type="button" className="cc-secondary" disabled={busy} onClick={() => void refresh()}>Check connection</button>
    {!sync && <p className="cc-muted cc-small">No successful connection check yet. No sync is confirmed by this screen.</p>}
    {sync && <div role="status"><p><strong>Last upload received:</strong> {received(sync.last_received_at)}<br/><strong>Latest observation:</strong> {observed(sync.last_observed_at)}</p><p className="cc-muted cc-small">{sync.coverage_note} {sync.metrics.length ? `Received metrics: ${sync.metrics.join(', ')}.` : 'No supported metrics received yet.'}</p></div>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={event => void create(event)}>
      <label className="cc-label">Device label<input required maxLength={80} value={label} disabled={busy || !!pending} onChange={event => setLabel(event.target.value)}/></label>
      <label className="cc-label">IANA Timezone<input required maxLength={100} value={timezone} disabled={busy || !!pending} onChange={event => setTimezone(event.target.value)}/></label>
      <label className="cc-label">Apple Health source name<input required maxLength={200} value={source} disabled={busy || !!pending} onChange={event => setSource(event.target.value)}/></label>
      <p className="cc-muted cc-small">Enter the exact source shown in Health Auto Export’s Preferred Sources. Select one source for each enabled metric. “All” does not establish verified daily step totals.</p>
      <label className="cc-label">Connection expiry (days)<input required type="number" min={1} max={90} step={1} value={expiry} disabled={busy || !!pending} onChange={event => setExpiry(event.target.value)}/></label>
      <button className="cc-secondary" disabled={busy}>{pending ? 'Retry same connection request' : 'Create Apple Health connection'}</button>
    </form>
    {pending && <p className="cc-muted cc-small">This setup is awaiting confirmation. Retry keeps the same request. If its credential was lost, check devices, revoke that authorization and create a new connection.</p>}
    {credential && <div className="cc-account-credential">
      <p><strong>Shown once.</strong> Copy this into Health Auto Export now. After you hide it, reload or sign out, it cannot be retrieved here.</p>
      <label className="cc-label">Upload endpoint<input aria-label="Upload endpoint" readOnly value={UPLOAD_URL}/></label>
      <label className="cc-label">Upload credential<textarea aria-label="Upload credential" readOnly autoComplete="off" spellCheck={false} rows={3} value={credential.value}/></label>
      <p className="cc-muted cc-small">Use this credential as a Bearer token with JSON v2 exports. Enable only steps, heart rate and summarized sleep. Daily steps must identify the exact preferred source; missing or different sources are not treated as verified daily totals. Sleep and heart-rate summaries retain the source information supplied by the exporter.</p>
      <button type="button" className="cc-text-button" onClick={() => setCredential(null)}>Hide credential</button>
    </div>}
    {devices.length > 0 && <ul aria-label="Apple Health devices" style={{ paddingLeft: 0, listStyle: 'none' }}>{devices.map(device => <li key={device.id} style={{ marginTop: 16 }}>
      <strong>{device.label}</strong> · {device.status === 'active' ? 'Upload authorization active' : device.status}<br/>
      <small>{device.timezone} · source: {device.preferred_source} · expires {new Date(device.expires_at * 1000).toLocaleDateString()}</small><br/>
      <small>{received(device.last_received_at)} · latest observation: {observed(device.last_observed_at)}</small>
      {device.status === 'active' && <button type="button" className="cc-text-button" disabled={busy} aria-label={`Revoke ${device.label}`} onClick={() => void revoke(device)}>Revoke connection</button>}
    </li>)}</ul>}
  </section>;
}
