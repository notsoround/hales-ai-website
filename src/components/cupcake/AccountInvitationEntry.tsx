import { useEffect, useRef, useState } from 'react';
import { accountControl, accountInvitation, acceptAccountInvitation, AccountRequestError, signIn, type AccountIdentity } from './accountSession';

type Persona = 'cupcake'|'matthieu';
type Preview = {invitation:{id:string;coach_name:string;email_hint:string;expires_at:number;persona:Persona};disclosure:{version:string;text:string}};
const validToken = /^ci_[A-Za-z0-9_-]{43}$/;
const message = (reason:unknown) => reason instanceof Error ? reason.message : 'The invitation could not be confirmed.';

export function AccountInvitationEntry({token,identity,checking,onClose}:{token:string;identity:AccountIdentity|null;checking:boolean;onClose:()=>void}) {
  const [preview,setPreview]=useState<Preview|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [existing,setExisting]=useState(false),[email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState('');
  const [persona,setPersona]=useState<Persona|''>(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[complete,setComplete]=useState(false);
  const [createdEmail,setCreatedEmail]=useState<string|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[complete]);
  useEffect(()=>{
    if(checking)return;
    let alive=true;setLoading(true);setError('');
    if(!validToken.test(token)){setLoading(false);setError('This invitation link is incomplete or invalid. Ask your coach for a new link.');return;}
    void accountInvitation<Preview>('preview',{invite_token:token}).then(value=>{
      if(!value.invitation||typeof value.invitation.coach_name!=='string'||typeof value.invitation.email_hint!=='string'
        ||!Number.isFinite(value.invitation.expires_at)||value.invitation.expires_at<=Date.now()/1000
        ||!['cupcake','matthieu'].includes(value.invitation.persona)||!value.disclosure?.version||!value.disclosure.text)throw Error('The invitation details were not confirmed.');
      if(alive)setPreview(value);
    }).catch(reason=>{if(alive)setError(message(reason));}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[token,checking]);
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy||!preview||!consent||!persona)return;setBusy(true);setError('');
    const confirmation={invite_token:token,persona,disclosure_version:preview.disclosure.version,disclosure_accepted:true};
    try {
      if(identity){await acceptAccountInvitation(confirmation);setComplete(true);}
      else if(existing){await signIn(email,password,false);}
      else {
        const result=await accountInvitation<{relationship:{id:string;status:string}}>('redeem',{...confirmation,email,name,password});
        if(!result.relationship?.id||result.relationship.status!=='active')throw Error('The account connection was not confirmed.');
        // Redemption has succeeded even if the following sign-in fails. Never
        // offer to consume this one-time invitation again on a sign-in retry.
        setCreatedEmail(email);
        await signIn(email,password,false);setComplete(true);
      }
    }catch(reason){if(reason instanceof AccountRequestError&&reason.code==='invitation_sign_in_required')setExisting(true);setError(message(reason));}
    finally{setBusy(false);setPassword('');}
  };
  const retryCreatedSignIn=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy||!createdEmail)return;setBusy(true);setError('');
    try{await signIn(createdEmail,password,false);setComplete(true);}
    catch(reason){setError(message(reason));}
    finally{setBusy(false);setPassword('');}
  };
  const signOut=async()=>{setBusy(true);setError('');try{await accountControl('sign-out',{});}catch(reason){setError(message(reason));}finally{setBusy(false);}};
  return <main className="cc-app cc-account-gate" data-appearance={(persona||preview?.invitation.persona)==='matthieu'?'rose':'caribbean'}><section className="cc-unlock cc-invitation-entry" aria-label="Pilot invitation">
    <span className="cc-eyebrow">INVITATION ONLY · ADULT PILOT</span>
    <h1 ref={heading} tabIndex={-1}>{complete?'You’re connected':'Your Cupcake invitation'}</h1>
    {complete?<><p>Your personal Cupcake is yours. Accepting this invitation did not share any health report or meal photos.</p><p>Open Reports → Sharing controls whenever you want to authorize a specific report, choose an expiry or revoke access.</p><button className="cc-primary" onClick={onClose}>Open my Cupcake</button></>:
      <>{(checking||loading)&&<p role="status">Checking invitation…</p>}{preview&&<>
        <p><strong>{preview.invitation.coach_name}</strong> invited <strong>{preview.invitation.email_hint}</strong>.</p>
        <p className="cc-muted">Expires {new Date(preview.invitation.expires_at*1000).toLocaleString()}. The link is private and can be accepted once.</p>
        <p>Suggested assistant: {preview.invitation.persona==='cupcake'?'Cupcake · Caribbean':'Matthieu · Soft rose'}. Your assistant’s presentation does not change access.</p>
        {createdEmail?<form onSubmit={event=>void retryCreatedSignIn(event)}>
          <p>Your account and invitation acceptance were confirmed. Sign in to open your Cupcake; the invitation will not be redeemed again.</p>
          <label className="cc-label">Created account email<input type="email" autoComplete="username" readOnly value={createdEmail}/></label>
          <label className="cc-label">Your password<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></label>
          <button className="cc-primary" disabled={busy||checking}>{busy?'Please wait…':'Sign in to my Cupcake'}</button>
          <p className="cc-muted cc-small">If you need recovery, leave this invitation and choose “Use a recovery code” on the sign-in screen for {createdEmail}.</p>
        </form>:<form onSubmit={event=>void submit(event)}>
          {identity?<><p>Signed in as <strong>{identity.email}</strong>. Your password and saved assistant preferences will not change.</p><button type="button" className="cc-text-button" disabled={busy} onClick={()=>void signOut()}>Use a different account</button></>:
            <><div className="cc-invitation-actions" role="group" aria-label="Account choice"><button type="button" className="cc-secondary" aria-pressed={!existing} onClick={()=>{setExisting(false);setError('');}} disabled={busy}>Create my account</button><button type="button" className="cc-secondary" aria-pressed={existing} onClick={()=>{setExisting(true);setError('');}} disabled={busy}>I already have an account</button></div>
              <label className="cc-label">Invited email<input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} disabled={busy}/></label>
              {!existing&&<label className="cc-label">Your name<input autoComplete="name" required maxLength={100} value={name} onChange={event=>setName(event.target.value)} disabled={busy}/></label>}
              <label className="cc-label">{existing?'Your password':'Choose your own password'}<input type="password" autoComplete={existing?'current-password':'new-password'} required minLength={existing?undefined:12} value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></label>
              {!existing&&<p className="cc-muted cc-small">Use at least 12 characters. No password is supplied by your coach.</p>}
            </>}
          <label className="cc-label">Confirm assistant preset<select aria-label="Confirm assistant preset" required value={persona} onChange={event=>setPersona(event.target.value as Persona|'')} disabled={busy}><option value="">Choose a preset</option><option value="cupcake">Cupcake · Caribbean</option><option value="matthieu">Matthieu · Soft rose</option></select></label>
          <div className="cc-invitation-disclosure"><h2>Pilot disclosure</h2><p>{preview.disclosure.text}</p><p>This adult pilot provides personal wellness and accountability tools. It is not an emergency service. Joining does not share your data: report and optional photo access are off until you explicitly authorize them.</p></div>
          <label className="cc-account-check"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={busy}/>I am 18 or older and accept this pilot disclosure.</label>
          <button className="cc-primary" disabled={busy||checking||loading||!consent||!persona}>{busy?'Please wait…':identity?'Accept invitation':existing?'Sign in to accept':'Create account and accept'}</button>
          {!identity&&existing&&<p className="cc-muted cc-small">After sign-in, confirm the invitation for the intended account.</p>}
        </form>}
      </>}{error&&<p role="alert">{error}</p>}<button type="button" className="cc-text-button" disabled={busy} onClick={onClose}>Leave invitation</button></>}
  </section></main>;
}
