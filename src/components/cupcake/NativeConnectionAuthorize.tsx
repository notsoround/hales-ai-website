import { useEffect, useState } from 'react';
import { accountNative, type AccountIdentity } from './accountSession';
import { nativeCallback, nativeRequestCurrent, type PendingNativeConnection } from './nativeConnectionRequest';
import './native-connections.css';

export function NativeConnectionAuthorize({ pending, identity, appearance, onClose }: { pending: PendingNativeConnection; identity: AccountIdentity | null; appearance: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false), [error, setError] = useState('');
  const [callback, setCallback] = useState(''), [expiresAt, setExpiresAt] = useState<number | null>(null), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = expiresAt !== null ? now >= expiresAt : !nativeRequestCurrent(pending, now);
  const authorize = async () => {
    if (!identity || busy || attempted || !pending.request || !nativeRequestCurrent(pending)) return;
    const requestedAt = Date.now();
    setBusy(true); setAttempted(true); setError('');
    try {
      const result = await accountNative('authorize', pending.request);
      const target = nativeCallback(result, pending.request, identity.account_id);
      setCallback(target); setExpiresAt(requestedAt + 120000);
    } catch {
      setError('The connection was not confirmed. Return to the Android app and start a fresh connection. Your web account is still signed in.');
    } finally { setBusy(false); }
  };
  return <main className="cc-app cc-account-gate cc-native-connect" data-appearance={appearance}><section className="cc-unlock" aria-labelledby="cc-native-title">
    <span className="cc-eyebrow">ANDROID APP CONNECTION</span><h1 id="cc-native-title">Connect your Android app</h1>
    {pending.error ? <p role="alert">{pending.error}</p> : !identity ? <p>Sign in to confirm which account the app should connect to.</p> : <>
      <p>Connect the Cupcake Android preview to <strong>{identity.name || identity.email}</strong> ({identity.email}).</p>
      <p className="cc-small">Connection request: <strong>{pending.request?.installation_id.slice(-8)}</strong>. Compare this with the request in your Android app.</p>
      <p>This connection lets the app confirm your account name and email. Health uploads require a separate approval. This does not share data with a coach or give the app access to your health history, Library or AI allowance.</p>
      {expired ? <p role="alert">This connection request expired. Start again from the Android app.</p> : callback ? <>
        <p role="status">Approved. Return to the same Android app before this approval expires to finish connecting.</p>
        <a className="cc-primary" href={callback} referrerPolicy="no-referrer">Return to Android app</a>
      </> : <button type="button" className="cc-primary" disabled={busy || attempted} onClick={() => void authorize()}>{busy ? 'Confirming…' : 'Connect Android app'}</button>}
      {error && <p role="alert">{error}</p>}
    </>}
    <button type="button" className="cc-secondary" disabled={busy} onClick={onClose}>{callback ? 'Stay on the web' : 'Cancel app connection'}</button>
  </section></main>;
}
