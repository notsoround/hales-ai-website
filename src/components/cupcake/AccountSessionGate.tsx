import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccountSplash } from './AccountSplash';
import './noir/noir-gate.css';
import { accountControl, initializeSessionBoundary, invalidateSession, restoreSession, sessionSnapshot, signIn, subscribeSession, verifySession, type AccountIdentity } from './accountSession';
import './account-session.css';
import { AccountInvitationEntry } from './AccountInvitationEntry';
import { takeInvitationFragment } from './accountInvitationFragment';
import { assistantIcon, personalAssistantLabel, publicAssistantBrand, useAssistantDocumentBrand } from './assistantBrand';
import { AccountSelfExport } from './AccountSelfExport';
import { AccountClosureControls, AccountClosureRecovery } from './AccountClosureControls';
import { clearNativeConnectionRequest, takeNativeConnectionRequest } from './nativeConnectionRequest';
import { NativeConnectionAuthorize } from './NativeConnectionAuthorize';
import { NativeInstallationControls } from './NativeInstallationControls';
import { clearNativeHealthConnectionRequest, takeNativeHealthConnectionRequest } from './nativeHealthConnectionRequest';
import { NativeHealthConnectionAuthorize } from './NativeHealthConnectionAuthorize';

let entryNativeHealthConnection=takeNativeHealthConnectionRequest();
let entryNativeConnection=takeNativeConnectionRequest();
let entryInvitation=takeInvitationFragment();

export function AccountSessionGate({ children }: { children: (identity: AccountIdentity) => ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const [invitation,setInvitation]=useState(entryInvitation);
  const [nativeConnection,setNativeConnection]=useState(entryNativeConnection);
  const [nativeHealthConnection,setNativeHealthConnection]=useState(entryNativeHealthConnection);
  useEffect(()=>{entryInvitation=null;},[]);
  useEffect(()=>{entryNativeConnection=null;},[]);
  useEffect(()=>{entryNativeHealthConnection=null;},[]);
  const closeNativeRequest=()=>{clearNativeHealthConnectionRequest();clearNativeConnectionRequest();setNativeHealthConnection(null);setNativeConnection(null);};
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [remember, setRemember] = useState(true);
  const [recovering, setRecovering] = useState(false), [recovery, setRecovery] = useState(''), [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const brand = publicAssistantBrand();
  // Cold start: hold the launch portrait while the saved session is checked, so a signed-in person never sees the
  // sign-in form flash by. Only before the first answer, and never longer than five seconds.
  const [launching, setLaunching] = useState(true);
  useEffect(() => { if (!session.checking) setLaunching(false); }, [session.checking]);
  useEffect(() => { const timer = window.setTimeout(() => setLaunching(false), 5000); return () => window.clearTimeout(timer); }, []);
  useAssistantDocumentBrand(brand.name, brand.persona, !session.identity && invitation === null);
  useEffect(() => {
    if (!session.identity) return;
    setEmail(''); setPassword(''); setRecovery(''); setNewPassword(''); setRemember(true); setRecovering(false); setError('');
  }, [session.identity]);
  useEffect(() => {
    // Account storage/transports cannot read the separate legacy access key.
    // Leave it intact for Matt's concurrently open private Cupcake entry.
    const stop = initializeSessionBoundary();
    void restoreSession();
    let lastCheck = 0;
    const revalidate = (force = false) => {
      if (document.visibilityState === 'hidden') return;
      const snap = sessionSnapshot();
      if (snap.identity) {
        const now = Date.now();
        if (!force && now - lastCheck < 15000) return;
        lastCheck = now;
        void verifySession();
      } else if (snap.transient && !snap.checking) {
        void restoreSession();
      }
    };
    const onInterval = () => revalidate(true);
    const onFocus = () => revalidate(false);
    const onOnline = () => revalidate(true);
    const onVisible = () => { if (document.visibilityState === 'visible') revalidate(false); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) revalidate(true); };
    const timer = window.setInterval(onInterval, 60000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      invalidateSession('', false);
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      if (recovering) { await accountControl('recovery/redeem', { email, recovery_code:recovery, new_password:newPassword }); setRecovering(false); }
      else await signIn(email, password, remember);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in could not finish.'); }
    finally { setBusy(false); setPassword(''); setNewPassword(''); setRecovery(''); }
  };
  if(invitation!==null)return <AccountInvitationEntry token={invitation} identity={session.identity} checking={session.checking} onClose={()=>setInvitation(null)}/>;
  if (nativeHealthConnection && (session.identity || nativeHealthConnection.error)) return <NativeHealthConnectionAuthorize key={`${session.identity?.account_id || 'unsigned'}:${session.generation}`} pending={nativeHealthConnection} identity={session.identity} appearance={brand.appearance} onClose={closeNativeRequest}/>;
  if (nativeConnection && (session.identity || nativeConnection.error)) return <NativeConnectionAuthorize key={`${session.identity?.account_id || 'unsigned'}:${session.generation}`} pending={nativeConnection} identity={session.identity} appearance={brand.appearance} onClose={closeNativeRequest}/>;
  if (session.identity) return <div key={`${session.identity.account_id}:${session.generation}`}>{children(session.identity)}</div>;
  if (launching && session.checking && !session.message && !error) return <AccountSplash/>;
  return <main className="cc-app cc-account-gate" data-appearance={brand.appearance}><form className="cc-unlock" onSubmit={event => void submit(event)}>
    <img src={assistantIcon(brand.persona)} alt={brand.name}/><span className="cc-eyebrow">YOUR PRIVATE {brand.name.toUpperCase()}</span>
    <h1>{recovering ? 'Recover your account' : `Sign in to ${brand.name}`}</h1>
    <p>{recovering ? 'Enter your recovery code and choose a new password.' : brand.persona === 'cupcake' ? 'There you are. Let’s see what you’ve been up to.' : 'Welcome back. Your numbers are waiting.'}</p>
    {nativeConnection && <p role="status">Sign in to review the Android app connection. Nothing connects until you approve it.</p>}
    {nativeHealthConnection && <p role="status">Sign in to choose which health types the Android app may upload. Nothing uploads until you approve it.</p>}
    <label className="cc-label">Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy||session.checking}/></label>
    {recovering ? <><label className="cc-label">Recovery code<input autoComplete="off" required value={recovery} onChange={e=>setRecovery(e.target.value)} disabled={busy}/></label><label className="cc-label">New password<input type="password" autoComplete="new-password" required value={newPassword} onChange={e=>setNewPassword(e.target.value)} disabled={busy}/></label></>
      : <><label className="cc-label">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||session.checking}/></label><label className="cc-account-check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember me on this device</label></>}
    <button className="cc-primary" disabled={busy||session.checking}>{session.checking?'Checking session…':busy?'Please wait…':recovering?'Reset password':'Sign in'}</button>
    <button type="button" className="cc-text-button" disabled={busy} onClick={()=>{setRecovering(!recovering);setError('');setPassword('');setRecovery('');setNewPassword('');}}>{recovering?'Back to sign in':'Use a recovery code'}</button>
    {session.transient && !error && <div className="cc-session-reconnect" role="status"><p>{session.message}</p><button type="button" className="cc-secondary" disabled={busy || session.checking} onClick={() => void restoreSession()}>{session.checking ? 'Reconnecting…' : 'Retry connection'}</button></div>}
    {(error || (session.message && !session.transient)) && <p role="alert">{error || session.message}</p>}
    {session.message.includes('Server sign-out was not confirmed')&&<button type="button" className="cc-secondary" disabled={busy} onClick={()=>void accountControl('sign-out',{}).catch(()=>{})}>Retry sign out</button>}
    {!session.checking&&!session.transient&&<button type="button" className="cc-text-button" disabled={busy} onClick={()=>void restoreSession()}>Check saved session</button>}
    <p className="cc-muted cc-small">Passwords and recovery codes stay out of browser storage. Use Sign out on shared devices.</p>
    <a className="cc-text-button" href="/">← Hales.ai</a>
  </form><AccountClosureRecovery key={session.generation}/></main>;
}

export function AccountControls({ identity, assistantName = 'Cupcake', includePrivacy = true }: { identity: AccountIdentity; assistantName?: string; includePrivacy?: boolean }) {
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const perform = async (route: 'password' | 'recovery/issue' | 'sign-out' | 'sign-out-all') => {
    setBusy(true); setMessage(''); setCode('');
    try {
      const result = await accountControl<{ recovery_code?: string }>(route, route === 'password' ? {current_password:current,new_password:next} : route === 'recovery/issue' ? {current_password:current} : {});
      if (result.recovery_code) { setCode(result.recovery_code); setMessage('Save this one-time recovery code somewhere private. It is not stored in this browser.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The account change was not confirmed.'); }
    finally { setCurrent(''); setNext(''); setBusy(false); }
  };
  return <><section className="cc-account-controls" aria-label="Your account"><h3>{personalAssistantLabel(assistantName, identity.name||identity.email)}</h3><p>{identity.email}</p>
    <form onSubmit={event=>{event.preventDefault();void perform('password');}}>
      <label className="cc-label">Current password<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} disabled={busy}/></label>
      <label className="cc-label">New password<input type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)} disabled={busy}/></label>
      <button className="cc-secondary" disabled={busy||!current||!next}>Change password</button>
      <button type="button" className="cc-text-button" disabled={busy||!current} onClick={()=>void perform('recovery/issue')}>Create recovery code</button>
    </form>
    {code&&<output className="cc-account-code" aria-label="One-time recovery code">{code}</output>}
    {message&&<p role="status">{message}</p>}
    <button type="button" className="cc-text-button" disabled={busy} onClick={()=>void perform('sign-out')}>Sign out</button>
    <button type="button" className="cc-text-button" disabled={busy} onClick={()=>void perform('sign-out-all')}>Sign out all devices</button>
  </section><NativeInstallationControls/>{includePrivacy&&<><AccountSelfExport/><AccountClosureControls owner={identity.account_id}/></>}</>;
}
