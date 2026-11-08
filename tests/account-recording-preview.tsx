/* eslint-disable react-refresh/only-export-components -- Isolated development-only synthetic recorder fixture. */
import { useSyncExternalStore, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CupcakeStudio from '../src/components/cupcake/CupcakeStudio';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { drafts, putDraft } from '../src/components/cupcake/storage';
import { uploadAccountRecording, AccountRecordingClient } from '../src/components/cupcake/accountRecording';
import '../src/index.css';
import '../src/components/cupcake/assistant-appearance.css';

if (!import.meta.env.DEV) throw Error('Synthetic archive preview is development only.');
const owners = {A: {account_id:'acc_audio_a',email:'a@example.invalid',name:'Synthetic A'}, B: {account_id:'acc_audio_b',email:'b@example.invalid',name:'Synthetic B'}};
let owner: 'A'|'B' = 'A';
const fixture = {
  requests: [] as {owner:string;route:string;body:Record<string,unknown>;bytes:number;headers:Record<string,string>}[], blocked: [] as string[],
  behavior:'normal', held:false, release:() => {}, audioStops:0, clearedSources:0, digestReads:0,
  async switchOwner(next: 'A'|'B') { owner=next; await restoreSession(); },
  async locals() { return (await drafts()).map(d => ({id:d.id,title:d.title,recordingId:d.recordingId,bytes:d.blob?.size})); },
  async seed(bytes=5) { const id=crypto.randomUUID(); await putDraft({id,title:'Synthetic original',startedAt:1,mime:'audio/webm',complete:true,blob:new Blob([new Uint8Array(bytes).fill(97)],{type:'audio/webm'})}); return id; },
  async run(bytes=5) { const d={id:crypto.randomUUID(),title:'Synthetic transport',startedAt:1,mime:'audio/webm',complete:true};try {return await uploadAccountRecording({draft:d,blob:new Blob([new Uint8Array(bytes).fill(97)]),onProgress:()=>{}});}catch(error){return {error:(error as Error).message};} },
  async unsafeEcho() { const c=new AccountRecordingClient();try {await c.request('list',{});return 'accepted';}catch(error){return (error as Error).message;}finally{c.dispose();} },
};
(window as unknown as {audioFixture:typeof fixture}).audioFixture=fixture;
const nativeFetch=window.fetch.bind(window), arrayBuffer=Blob.prototype.arrayBuffer;
Blob.prototype.arrayBuffer=function(){fixture.digestReads++;return arrayBuffer.call(this);};
const pause=HTMLMediaElement.prototype.pause, remove=Element.prototype.removeAttribute;
HTMLMediaElement.prototype.pause=function(){fixture.audioStops++;return pause.call(this);};
Element.prototype.removeAttribute=function(name){if(this.tagName==='AUDIO'&&name==='src')fixture.clearedSources++;return remove.call(this,name);};
window.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
  if(url.origin===location.origin)return nativeFetch(input,init);
  const route=url.pathname.split('/api/account/')[1];
  if(!route){fixture.blocked.push(url.href);throw Error('External network forbidden.');}
  const identity=owners[owner], captured=owner, headers=Object.fromEntries(new Headers(init?.headers));
  if(route==='session')return Response.json({ok:true,identity});
  if(!route.startsWith('recordings/')){fixture.blocked.push(url.href);throw Error('Unexpected account action.');}
  if(headers['x-cupcake-account-context']!==identity.account_id)return Response.json({ok:false,error:'account_context_changed'},{status:409});
  const part=init?.body instanceof Blob, body=part?{}:JSON.parse(String(init?.body||'{}'));
  fixture.requests.push({owner:captured,route,body,bytes:part?(init.body as Blob).size:0,headers});
  if(route==='recordings/transcribe') {
    const key='cupcake-account-v1:'+encodeURIComponent(identity.account_id)+':audio-transcription-v1:'+body.recording_id;
    if(localStorage.getItem(key)!==JSON.stringify(body))throw Error('Synthetic transcription request was not saved before sending');
  }
  if(fixture.behavior==='off')return Response.json({ok:false,error:'recording_archive_not_ready'},{status:503});
  const response=(value:object)=>Response.json({ok:true,...value,identity:fixture.behavior==='wrongEcho'?owners.B:identity});
  const remote=(window as unknown as {syntheticAudioServer:(owner:string,route:string,body:Record<string,unknown>,query:string,bytes:number[])=>Promise<{status:number;value:Record<string,unknown>}>}).syntheticAudioServer;
  if(route==='recordings/original-link')return response({url:'https://automate.hales.ai/api/account/recordings/original?token='+'t'.repeat(43),expiresAt:Date.now()/1000+300});
  const result=await remote(captured,route,body,url.search,part?Array.from(new Uint8Array(await arrayBuffer.call(init.body as Blob))):[]);
  if((fixture.behavior==='holdPart'&&route==='recordings/part')||(fixture.behavior==='holdFinish'&&route==='recordings/finish')){fixture.behavior='normal';fixture.held=true;await new Promise<void>(resolve=>{fixture.release=resolve;});fixture.held=false;}
  if((fixture.behavior==='losePart'&&route==='recordings/part')||(fixture.behavior==='loseFinish'&&route==='recordings/finish')){fixture.behavior='normal';throw TypeError('Synthetic connection lost after commit');}
  if(fixture.behavior==='badReceipt'&&route==='recordings/finish')return response({recording:{...(result.value.recording as object),originalSha256:'f'.repeat(64)}});
  return Response.json({...result.value,identity:fixture.behavior==='wrongEcho'?owners.B:identity},{status:result.status});
};
await restoreSession();
function Preview(){const session=useSyncExternalStore(subscribeSession,sessionSnapshot),[visible,setVisible]=useState(true);return <div className="cc-app" data-appearance="rose"><main style={{maxWidth:900,margin:'auto',padding:12}}><p>Synthetic audio only. No provider or live account.</p><button onClick={()=>setVisible(v=>!v)}>{visible?'Leave recorder':'Open recorder'}</button>{visible&&session.identity&&<CupcakeStudio key={session.generation} mode="record" onBusy={()=>{}}/>}</main></div>;}
createRoot(document.getElementById('root')!).render(<Preview/>);
