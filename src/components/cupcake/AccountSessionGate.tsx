import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { accountControl, initializeSessionBoundary, invalidateSession, restoreSession, sessionSnapshot, signIn, subscribeSession, verifySession, type AccountIdentity } from './accountSession';
import { clearPrivateAccess } from './privateAccess';
import './account-session.css';

export function AccountSessionGate({ children }: { children: (identity: AccountIdentity) => ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [remember, setRemember] = useState(false);
  const [recovering, setRecovering] = useState(false), [recovery, setRecovery] = useState(''), [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!session.identity) return;
    setEmail(''); setPassword(''); setRecovery(''); setNewPassword(''); setRemember(false); setRecovering(false); setError('');
  }, [session.identity]);
  useEffect(() => {
    clearPrivateAccess();
    // Mark account mode before sign-in too. The worker cannot bind OS-shared
    // audio to a trusted cookie identity and must keep that path closed.
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/cupcake-sw.js',{scope:'/cupcake'})
      .then(()=>navigator.serviceWorker.ready).then(registration=>registration.active?.postMessage({type:'cupcake-browser-mode',accountSessions:true})).catch(()=>{});
    const stop = initializeSessionBoundary();
    void restoreSession();
    const check = () => { void verifySession(); };
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => { stop(); invalidateSession('', false); window.clearInterval(timer); window.removeEventListener('focus', check); };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      if (recovering) { await accountControl('recovery/redeem', { email, recovery_code:recovery, new_password:newPassword }); setRecovering(false); }
      else await signIn(email, password, remember);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in could not finish.'); }
    finally { setBusy(false); setPassword(''); setNewPassword(''); setRecovery(''); }
  };
  if (session.identity) return <div key={`${session.identity.account_id}:${session.generation}`}>{children(session.identity)}</div>;
  return <main className="cc-app cc-account-gate"><form className="cc-unlock" onSubmit={event => void submit(event)}>
    <img src="/cupcake-avatar.jpg" alt="Cupcake"/><span className="cc-eyebrow">YOUR PRIVATE CUPCAKE</span>
    <h1>{recovering ? 'Recover your account' : 'Sign in to Cupcake'}</h1>
    <p>Your identity comes from your account. Your assistant’s name and appearance are separate choices.</p>
    <label className="cc-label">Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy||session.checking}/></label>
    {recovering ? <><label className="cc-label">Recovery code<input autoComplete="off" required value={recovery} onChange={e=>setRecovery(e.target.value)} disabled={busy}/></label><label className="cc-label">New password<input type="password" autoComplete="new-password" required value={newPassword} onChange={e=>setNewPassword(e.target.value)} disabled={busy}/></label></>
      : <><label className="cc-label">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||session.checking}/></label><label className="cc-account-check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember me on this device</label></>}
    <button className="cc-primary" disabled={busy||session.checking}>{session.checking?'Checking session…':busy?'Please wait…':recovering?'Reset password':'Sign in'}</button>
    <button type="button" className="cc-text-button" disabled={busy} onClick={()=>{setRecovering(!recovering);setError('');setPassword('');setRecovery('');setNewPassword('');}}>{recovering?'Back to sign in':'Use a recovery code'}</button>
    {(error||session.message)&&<p role="alert">{error||session.message}</p>}
    {session.message.includes('Server sign-out was not confirmed')&&<button type="button" className="cc-secondary" disabled={busy} onClick={()=>void accountControl('sign-out',{}).catch(()=>{})}>Retry sign out</button>}
    {!session.checking&&<button type="button" className="cc-text-button" disabled={busy} onClick={()=>void restoreSession()}>Check saved session</button>}
    <p className="cc-muted cc-small">Passwords and recovery codes stay out of browser storage. Use Sign out on shared devices.</p>
    <a className="cc-text-button" href="/">← Hales.ai</a>
  </form></main>;
}

export function AccountControls({ identity }: { identity: AccountIdentity }) {
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
  return <section className="cc-account-controls" aria-label="Your account"><h3>MyCupcake — {identity.name||identity.email}</h3><p>{identity.email}</p>
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
  </section>;
}
