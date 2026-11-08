import { useEffect, useState } from 'react';
import { accountNativeHealth, type AccountIdentity } from './accountSession';
import { nativeHealthCallback, nativeHealthRequestCurrent, type PendingNativeHealthConnection, type NativeHealthType } from './nativeHealthConnectionRequest';
import './native-health.css';

const LABELS: Record<NativeHealthType, string> = { sleep: 'Sleep sessions', heart_rate: 'Heart rate samples', steps: 'Step records' };
type Props = { pending: PendingNativeHealthConnection; identity: AccountIdentity | null; appearance: string; onClose: () => void };

export function NativeHealthConnectionAuthorize(props: Props) {
  return <HealthConsent key={`${props.identity?.account_id || ''}:${props.pending.createdAt}:${props.pending.request?.state || ''}`} {...props} />;
}

function HealthConsent({ pending, identity, appearance, onClose }: Props) {
  const [selected, setSelected] = useState<NativeHealthType[]>([]);
  const [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false), [error, setError] = useState('');
  const [approval, setApproval] = useState<{ callback: string; wallDeadline: number; monotonicDeadline: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = approval ? now >= approval.wallDeadline || performance.now() >= approval.monotonicDeadline : !nativeHealthRequestCurrent(pending, now);
  const authorize = async () => {
    if (!identity || busy || attempted || !pending.request || !selected.length || !nativeHealthRequestCurrent(pending)) return;
    const wallDeadline = Date.now() + 120000, monotonicDeadline = performance.now() + 120000;
    const request = { ...pending.request, types: pending.request.types.filter(type => selected.includes(type)) };
    if (!request.types.length) return;
    setBusy(true); setAttempted(true); setError('');
    try {
      const result = await accountNativeHealth('authorize', request);
      const callback = nativeHealthCallback(result, request, identity.account_id);
      if (Date.now() >= wallDeadline || performance.now() >= monotonicDeadline) throw Error('Approval expired');
      setApproval({ callback, wallDeadline, monotonicDeadline });
    } catch {
      setError('Health upload permission was not confirmed. Return to the Android app and start a fresh request. Do not repeat this approval.');
    } finally { setBusy(false); }
  };
  return <main className="cc-app cc-account-gate cc-native-health-consent" data-appearance={appearance}><section className="cc-unlock" aria-labelledby="cc-native-health-title">
    <span className="cc-eyebrow">ANDROID HEALTH CONNECTION</span><h1 id="cc-native-health-title">Allow health uploads</h1>
    {pending.error ? <p role="alert">{pending.error}</p> : !identity ? <p>Sign in to choose the account that will receive your health uploads.</p> : <>
      <p>Upload to <strong>{identity.name || identity.email}</strong> ({identity.email}) from the Cupcake Android preview.</p>
      <p className="cc-small">Android app request: <strong>{pending.request?.installation_id.slice(-8)}</strong> · connection version {pending.request?.epoch}. Compare this with the request in your Android app.</p>
      <p>Choose which Health Connect records this app may upload when you request a sync. Android permission and upload permission are separate. This does not grant coach access.</p>
      <p className="cc-small">Sleep retains its source’s estimate or manual label. Step records from different sources may overlap; they are not combined into a daily total.</p>
      {expired ? <p role="alert">This request expired. Start a fresh health connection from the Android app.</p> : approval ? <>
        <p role="status">Approval is ready. Return to the same Android app before it expires to finish setting up uploads. No health upload is confirmed yet.</p>
        <a className="cc-primary" href={approval.callback} referrerPolicy="no-referrer" onClick={event => {
          if (Date.now() >= approval.wallDeadline || performance.now() >= approval.monotonicDeadline) { event.preventDefault(); setNow(Date.now()); }
        }}>Return to Android app</a>
      </> : <>
        <fieldset className="cc-native-health-choices" disabled={busy || attempted}><legend>Records you allow to be uploaded</legend>
          {pending.request?.types.map(type => <label key={type}><input type="checkbox" checked={selected.includes(type)} onChange={event => setSelected(previous => event.target.checked ? [...previous, type] : previous.filter(value => value !== type))} /><span>{LABELS[type]}</span></label>)}
        </fieldset>
        <button type="button" className="cc-primary" disabled={busy || attempted || !selected.length} onClick={() => void authorize()}>{busy ? 'Confirming permission…' : 'Allow selected health uploads'}</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </>}
    <button type="button" className="cc-secondary" disabled={busy} onClick={onClose}>{approval ? 'Stay on the web' : 'Cancel health connection'}</button>
  </section></main>;
}
