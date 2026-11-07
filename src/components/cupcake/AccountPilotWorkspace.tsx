import { useEffect, useRef, useState } from 'react';
import { accountCoach, accountSharing, type AccountIdentity } from './accountSession';

type Persona='cupcake'|'matthieu';
type Invitation={id:string;email:string;status:'pending'|'expired'|'revoked'|'accepted';expires_at:number;persona:Persona;created_at:number};
type Share={id:string;owner_id:string;subject_id:string;scopes:('clean-report'|'meal-photo')[];expires_at:number;status:'active'|'expired'|'revoked'};
type Relationship={id:string;coach_account_id:string;coach_name:string;member_account_id:string;member_name:string;member_email_hint:string;role:'coach'|'client';status:'active';grants:Share[]};
type Workspace={coach_enabled:boolean;invitations_supported:boolean;relationships:Relationship[];limits:{max_clients:number;max_pending_invitations:number}};
const failure=(reason:unknown)=>reason instanceof Error?reason.message:'The pilot request could not be confirmed.';
const date=(seconds:number)=>new Date(seconds*1000).toLocaleString();
const preset=(persona:Persona)=>persona==='cupcake'?'Cupcake · Caribbean':'Matthieu · Violet';
const invitationState=(invitation:Invitation)=>invitation.status==='pending'&&invitation.expires_at<=Date.now()/1000?'expired':invitation.status;
const otherName=(relationship:Relationship,identity:AccountIdentity)=>relationship.coach_account_id===identity.account_id?relationship.member_name:relationship.coach_name;

export function AccountPilotWorkspace({identity,onSharingChanged}:{identity:AccountIdentity;onSharingChanged:()=>void}) {
  const [view,setView]=useState<'clients'|'sharing'|null>(null);
  return <section className="cc-card cc-pilot-workspace" aria-label="Clients and sharing">
    <h3>Your connections</h3><p>Keep your personal space and coaching workspace together. An invitation creates a connection; access to your data always needs a separate permission.</p>
    <div className="cc-invitation-actions"><button className="cc-secondary" aria-expanded={view==='clients'} onClick={()=>setView(view==='clients'?null:'clients')}>My clients & invitations</button><button className="cc-secondary" aria-expanded={view==='sharing'} onClick={()=>setView(view==='sharing'?null:'sharing')}>Sharing controls</button></div>
    {view==='clients'&&<CoachInvitations identity={identity}/>}
    {view==='sharing'&&<SharingControls identity={identity} onChanged={onSharingChanged}/>}
  </section>;
}

function CoachInvitations({identity}:{identity:AccountIdentity}) {
  const [workspace,setWorkspace]=useState<Workspace|null>(null),[invitations,setInvitations]=useState<Invitation[]>([]);
  const [email,setEmail]=useState(''),[persona,setPersona]=useState<Persona>('cupcake'),[days,setDays]=useState(7);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[link,setLink]=useState('');
  const alive=useRef(true),linkField=useRef<HTMLInputElement>(null);
  const load=async()=>{
    setLoading(true);setError('');
    try{
      const result=await accountCoach<Workspace>('workspace',{});if(!alive.current)return;
      if(typeof result.coach_enabled!=='boolean'||!Array.isArray(result.relationships))throw Error('The coaching workspace was not confirmed.');
      setWorkspace(result);
      if(result.coach_enabled){const listed=await accountCoach<{invitations:Invitation[]}>('invitations/list',{});if(alive.current)setInvitations(listed.invitations);}
    }catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setLoading(false);}
  };
  useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(link)linkField.current?.focus();},[link]);
  const create=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');setLink('');
    try{
      const result=await accountCoach<{invitation:Invitation;invite_token?:string}>('invitations/create',{request_id:crypto.randomUUID(),email,persona,expires_in_days:days});
      if(!alive.current)return;
      if(result.invite_token&&/^ci_[A-Za-z0-9_-]{43}$/.test(result.invite_token)){
        setLink(new URL('/cupcake/account',window.location.origin).href+'#invite='+result.invite_token);
        setNotice('Copy this private link now. It is shown once and no email was sent.');setEmail('');
      }else setNotice('The invitation exists, but its private link cannot be retrieved again. Revoke the pending invitation and create a new one if you did not save it.');
      await load();
    }catch(reason){if(alive.current)setError(failure(reason)+' If the response was lost, reload invitations before creating another. A private link cannot be retrieved again.');}
    finally{if(alive.current)setBusy(false);}
  };
  const revoke=async(invitation:Invitation)=>{
    if(!confirm(`Revoke the invitation to ${invitation.email}?`))return;setBusy(true);setError('');
    try{await accountCoach('invitations/revoke',{invitation_id:invitation.id});if(alive.current){setLink('');setNotice('Invitation revoked.');await load();}}
    catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setBusy(false);}
  };
  const copy=async()=>{try{await navigator.clipboard.writeText(link);setNotice('Private invitation link copied. Share it only with the invited person.');}catch{linkField.current?.focus();linkField.current?.select();setNotice('Select and copy the private link from the field.');}};
  const clients=workspace?.relationships.filter(relationship=>relationship.role==='coach'&&relationship.coach_account_id===identity.account_id)||[];
  return <section aria-label="My clients and invitations"><h3>My clients & invitations</h3>
    {loading&&<p role="status">Checking your coaching workspace…</p>}{error&&<p role="alert">{error}</p>}
    {workspace&&!workspace.coach_enabled&&<p>Your personal account is available. Invitation management is reserved for enabled pilot coaches.</p>}
    {workspace?.coach_enabled&&<><p>{clients.length} connected clients · Pilot limits: {workspace.limits.max_clients} clients and {workspace.limits.max_pending_invitations} pending invitations.</p>
      {clients.length?<ul className="cc-connection-list">{clients.map(relationship=><li key={relationship.id}><strong>{relationship.member_name}</strong><span>{relationship.member_email_hint} · Connected</span><span>{relationship.grants.some(grant=>grant.owner_id===relationship.member_account_id&&grant.status==='active'&&grant.expires_at>Date.now()/1000)?'A client-authorized report may be available above.':'No active client sharing. A connection alone does not include a report.'}</span></li>)}</ul>:<p>No clients connected yet. You can invite a new person or someone who already has their own Cupcake account.</p>}
      <form onSubmit={event=>void create(event)} className="cc-invitation-form"><h4>Create an invitation</h4>
        <label className="cc-label">Client email<input type="email" autoComplete="off" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} disabled={busy}/></label>
        <label className="cc-label">Suggested assistant<select aria-label="Suggested assistant" value={persona} onChange={event=>setPersona(event.target.value as Persona)} disabled={busy}><option value="cupcake">Cupcake · Caribbean</option><option value="matthieu">Matthieu · Violet</option></select></label>
        <p className="cc-muted cc-small">Preview: {preset(persona)}. The recipient confirms their choice; an existing account keeps its saved assistant.</p>
        <label className="cc-label">Invitation expires in<select aria-label="Invitation expires in" value={days} onChange={event=>setDays(Number(event.target.value))} disabled={busy}>{[1,7,14].map(value=><option key={value} value={value}>{value} {value===1?'day':'days'}</option>)}</select></label>
        <p>No data is shared by creating or accepting an invitation. You copy the link yourself; Cupcake does not send an email.</p>
        <button className="cc-primary" disabled={busy||loading}>{busy?'Please wait…':'Create private invitation link'}</button>
      </form>
      {link&&<div className="cc-invitation-secret"><label className="cc-label">One-time invitation link<input ref={linkField} readOnly value={link} onFocus={event=>event.target.select()}/></label><div className="cc-invitation-actions"><button className="cc-secondary" onClick={()=>void copy()}>Copy invitation link</button><button className="cc-text-button" onClick={()=>{setLink('');setNotice('Link hidden. It cannot be retrieved again.');}}>Hide private link</button></div></div>}
      {notice&&<p role="status">{notice}</p>}
      <h4>Invitations</h4>{!loading&&!invitations.length&&<p>No invitations yet.</p>}<ul className="cc-connection-list">{invitations.map(invitation=><li key={invitation.id}><strong>{invitation.email}</strong><span className="cc-invitation-state">{invitationState(invitation)} · {preset(invitation.persona)}</span><span>Expires {date(invitation.expires_at)}</span><button className="cc-text-button" disabled={busy||invitationState(invitation)!=='pending'} onClick={()=>void revoke(invitation)}>Revoke invitation</button></li>)}</ul>
    </>}
    <button className="cc-text-button" disabled={busy||loading} onClick={()=>void load()}>Reload clients and invitations</button>
  </section>;
}

function SharingControls({identity,onChanged}:{identity:AccountIdentity;onChanged:()=>void}) {
  const [relationships,setRelationships]=useState<Relationship[]>([]),[selected,setSelected]=useState('');
  const [report,setReport]=useState(false),[photos,setPhotos]=useState(false),[days,setDays]=useState(7);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const alive=useRef(true);
  const load=async()=>{setLoading(true);setError('');try{const result=await accountSharing<{relationships:Relationship[]}>('relationships',{});if(alive.current){setRelationships(result.relationships);setSelected(current=>result.relationships.some(item=>item.id===current)?current:'');}}catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setLoading(false);}};
  useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
  const share=async(event:React.FormEvent)=>{
    event.preventDefault();if((!report&&!photos)||!selected||busy)return;setBusy(true);setError('');setNotice('');
    try{await accountSharing('grant',{relationship_id:selected,grant_id:crypto.randomUUID(),scopes:[...(report?['clean-report']:[]),...(photos?['meal-photo']:[])],expires_at:Math.floor(Date.now()/1000)+days*86400});
      if(alive.current){setReport(false);setPhotos(false);setNotice('Your sharing is active until the chosen expiry. You can revoke it below.');await load();onChanged();}}
    catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setBusy(false);}
  };
  const revoke=async(grant:Share,recipient:string)=>{
    if(!confirm(`Revoke your sharing with ${recipient}?`))return;setBusy(true);setError('');
    try{await accountSharing('revoke',{grant_id:grant.id});if(alive.current){setNotice('Your sharing was revoked.');await load();onChanged();}}
    catch(reason){if(alive.current)setError(failure(reason));}finally{if(alive.current)setBusy(false);}
  };
  return <section aria-label="Sharing controls"><h3>Sharing controls</h3><p>You control <strong>your own data</strong>. Connections do not authorize access, and sharing in one direction does not share the other person’s data.</p>
    {loading&&<p role="status">Checking your connections and permissions…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!loading&&!error&&!relationships.length&&<p>No accepted connections yet. Accept a private invitation before choosing someone to share with.</p>}
    {!!relationships.length&&<><form onSubmit={event=>void share(event)} className="cc-invitation-form">
      <label className="cc-label">Share my data with<select aria-label="Share my data with" required value={selected} onChange={event=>{setSelected(event.target.value);setReport(false);setPhotos(false);setNotice('');}} disabled={busy||loading}><option value="">Choose a connected person</option>{relationships.map(item=><option key={item.id} value={item.id}>{otherName(item,identity)}</option>)}</select></label>
      <label className="cc-account-check"><input type="checkbox" checked={report} onChange={event=>setReport(event.target.checked)} disabled={busy||!selected}/>Share my clean health report</label>
      <p className="cc-muted cc-small">Includes weight, body measurements, manual glucose, exercise, outcomes, steps, sleep and nutrition from your saved local records. Excludes private chats, notes, financial details and original meal photos.</p>
      <label className="cc-account-check"><input type="checkbox" checked={photos} onChange={event=>setPhotos(event.target.checked)} disabled={busy||!selected}/>Share original meal photos (separate permission)</label>
      <label className="cc-label">Sharing expires in<select aria-label="Sharing expires in" value={days} onChange={event=>setDays(Number(event.target.value))} disabled={busy}>{[1,7,30].map(value=><option key={value} value={value}>{value} {value===1?'day':'days'}</option>)}</select></label>
      <button className="cc-primary" disabled={busy||loading||(!report&&!photos)||!selected}>{busy?'Please wait…':report?'Share my report':photos?'Share my meal photos':'Share selected data'}</button>
    </form><h4>Permissions for my data</h4><ul className="cc-connection-list">{relationships.flatMap(item=>item.grants.filter(grant=>grant.owner_id===identity.account_id).map(grant=><li key={grant.id}><strong>{otherName(item,identity)}</strong><span>{grant.scopes.map(scope=>scope==='clean-report'?'Health report':'Meal photos').join(' + ')}{!grant.scopes.includes('meal-photo')?' · No meal photos':!grant.scopes.includes('clean-report')?' · No health report':''}</span><span>{grant.status==='active'&&grant.expires_at<=Date.now()/1000?'expired':grant.status} · Until {date(grant.expires_at)}</span><button className="cc-text-button" disabled={busy||grant.status!=='active'||grant.expires_at<=Date.now()/1000} onClick={()=>void revoke(grant,otherName(item,identity))}>Revoke my sharing</button></li>))}</ul>{relationships.every(item=>!item.grants.some(grant=>grant.owner_id===identity.account_id))&&<p>You have not shared a report or meal photos with these connections.</p>}</>}
    <button className="cc-text-button" disabled={busy||loading} onClick={()=>void load()}>Reload sharing controls</button>
  </section>;
}
