import { useEffect, useRef, useState } from 'react';
import { assertGeneration, invalidateSession, sessionSnapshot } from './accountSession';
import { CLOSURE_PHRASE, createClosureIntent, readClosureIntent, removeExpiredClosureIntent, requestClosure, type ClosureDisclosure, type ClosureIntent, type ClosureReceipt } from './accountClosure';
import './account-closure.css';

function ClosureControls({ owner }: { owner?: string }) {
  const [intent, setIntent] = useState<ClosureIntent | null>(() => readClosureIntent(owner));
  const [receipt, setReceipt] = useState<ClosureReceipt | null>(null), [disclosure, setDisclosure] = useState<ClosureDisclosure | null>(null);
  const [needsCheck, setNeedsCheck] = useState(!!intent), [canReplace, setCanReplace] = useState(false);
  const [password, setPassword] = useState(''), [phrase, setPhrase] = useState(''), [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(true), inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!intent) return;
    const expire = () => { removeExpiredClosureIntent(intent); setIntent(null); setDisclosure(null); setPassword(''); setPhrase(''); setAccepted(false); setReceipt(null); setError('The seven-day recovery receipt expired and was removed from this browser. It can no longer confirm closure.'); };
    const delay = Math.max(0, intent.receiptExpiresAt * 1000 - Date.now());
    const timer = window.setTimeout(expire, Math.min(delay, 2147483647));
    return () => window.clearTimeout(timer);
  }, [intent]);
  const act = async (action: 'prepare' | 'confirm' | 'status') => {
    if (inFlight.current) return;
    const session = sessionSnapshot();
    if (owner && session.identity?.account_id !== owner) return;
    let current = intent;
    const secret = password;
    if (action === 'confirm' && (!disclosure || !accepted || phrase !== CLOSURE_PHRASE || !secret || needsCheck || !receipt || receipt.prepare_expires_at * 1000 <= Date.now())) return;
    inFlight.current = true; setBusy(true); setError(''); setPassword('');
    try {
      if (action === 'prepare' && (!current || canReplace)) { current = createClosureIntent(); setIntent(current); setCanReplace(false); }
      if (!current) throw Error('No private closure receipt is saved on this browser.');
      const result = await requestClosure(action, current, action === 'confirm' ? secret : undefined);
      assertGeneration(session.generation);
      if (!mounted.current) return;
      setIntent({ ...current, receiptExpiresAt: result.closure.receipt_expires_at }); setReceipt(result.closure); setNeedsCheck(false);
      setDisclosure(result.disclosure || null); setAccepted(false); setPhrase('');
      setCanReplace(result.closure.state === 'prepared' && result.closure.prepare_expires_at * 1000 <= Date.now());
      if (result.closure.access_closed && owner) invalidateSession('Your account access is closed. Saved content and backups have not been erased. A private receipt is kept on this browser for seven days.');
    } catch (cause) {
      if (mounted.current && sessionSnapshot().generation === session.generation) {
        setNeedsCheck(true); setDisclosure(null); setAccepted(false); setPhrase('');
        setCanReplace(action === 'status' && cause instanceof Error && 'code' in cause && cause.code === 'closure_receipt_not_found');
        setError(cause instanceof Error ? cause.message : 'Closure was not confirmed. Check the saved receipt before continuing.');
      }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  if (!owner && !intent) return null;
  return <section className="cc-account-controls cc-closure-controls" aria-label={owner ? 'Close your account' : 'Saved account closure receipt'}>
    <h3>{owner ? 'Close your account' : 'Saved account closure receipt'}</h3>
    {owner ? <><p>Closing stops access to this account. It does not erase your saved content, original files or backups.</p>
      <p className="cc-muted cc-small">Download your data and any originals you want to keep first. You cannot sign back in or use recovery after closing, and reopening is not available in the app.</p></>
      : <p>Check the private receipt saved on this browser. It can confirm closure, but cannot open an account or retrieve saved data.</p>}
    {intent && !receipt && <p className="cc-muted cc-small">A previous request is saved on this browser. Check its receipt before continuing.</p>}
    {intent && <button type="button" className="cc-secondary" disabled={busy} onClick={() => void act('status')}>{busy ? 'Please wait…' : 'Check closure receipt'}</button>}
    {owner && (!intent || !needsCheck || canReplace) && !receipt?.access_closed && <button type="button" className="cc-text-button" disabled={busy} onClick={() => void act('prepare')}>{canReplace ? 'Review a new preparation' : 'Review account closure'}</button>}
    {error && <p role="alert">{error}</p>}
    {receipt && <div role="status" className="cc-closure-result">
      <strong>{receipt.access_closed ? 'Account access is closed.' : 'This request is prepared. It has not confirmed account closure.'}</strong>
      <p>Saved data has not been erased.</p>
      {receipt.closed_at !== null && <p>Closure confirmed: {new Date(receipt.closed_at * 1000).toLocaleString()}.</p>}
      <p className="cc-muted cc-small">Receipt available until {new Date(receipt.receipt_expires_at * 1000).toLocaleString()}. The private recovery capability is removed from this browser when it expires.</p>
    </div>}
    {owner && disclosure && receipt?.state === 'prepared' && <div className="cc-closure-review">
      <h4>Before you close access</h4>
      <ul>{(['effect', 'retained', 'external', 'reopening', 'before', 'receipt'] as const).map(key => <li key={key}>{disclosure[key]}</li>)}</ul>
      <p className="cc-muted cc-small">This preparation expires {new Date(receipt.prepare_expires_at * 1000).toLocaleString()}. The private receipt stays on this browser for up to seven days; keep this device private.</p>
      <form onSubmit={event => { event.preventDefault(); void act('confirm'); }}>
        <label className="cc-account-check"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)}/>I understand that closing access does not erase my data.</label>
        <label className="cc-label">Type CLOSE MY ACCOUNT<input autoComplete="off" spellCheck={false} value={phrase} disabled={busy} onChange={event => setPhrase(event.target.value)}/></label>
        <label className="cc-label">Current password to close<input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)}/></label>
        <button type="submit" className="cc-secondary" disabled={busy || needsCheck || !accepted || phrase !== CLOSURE_PHRASE || !password || receipt.prepare_expires_at * 1000 <= Date.now()}>Close my account access</button>
      </form>
    </div>}
  </section>;
}
export function AccountClosureControls({ owner }: { owner: string }) { return <ClosureControls key={owner} owner={owner}/>; }
export function AccountClosureRecovery() { return <ClosureControls/>; }
