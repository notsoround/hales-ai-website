/* eslint-disable react-refresh/only-export-components -- Development-only root fixture, not a refresh boundary. */
import { createRoot } from 'react-dom/client';
import Cupcake from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import { libraryRequest } from '../src/components/cupcake/library';
import { personalNamespace, personalStorage, captureStorageScope } from '../src/components/cupcake/personalStorage';
import { drafts, putDraft, putChunk, draftBlob } from '../src/components/cupcake/storage';
import { readTalks, saveTalk } from '../src/components/cupcake/voiceHistory';
import { TalkCheckpointRecovery, talkDeviceStorage } from '../src/components/cupcake/talkCheckpoints';
import { receivedAnswers, rememberAnswer, pendingBegin, rememberBegin, readChatStorage } from '../src/components/cupcake/quickChatRecovery';
import { TALK_SEED_KEY } from '../src/components/cupcake/dashboardModel';
import { pendingReset, savePendingReset } from '../src/components/cupcake/quickResetRecovery';
import { keepPendingOutcome, readPendingOutcome } from '../src/components/cupcake/personalOutcomeDraft';
import { ACCOUNT_SESSIONS } from '../src/components/cupcake/accountMode';
import '../src/index.css';

if (!import.meta.env.DEV || !ACCOUNT_SESSIONS) throw Error('Synthetic account preview requires a local opt-in test build.');
const A = {account_id:'acc_synthetic_a',email:'a@example.invalid',name:'Synthetic A'};
const B = {account_id:'acc_synthetic_b',email:'b@example.invalid',name:'Synthetic B'};
const SERVER = 'synthetic-account-server';
const nativeFetch = window.fetch.bind(window);
const fixture = {
  requests: [] as {route:string;body:Record<string,unknown>;headers:Record<string,string>;credentials?:RequestCredentials}[],
  blocked: [] as string[], legacyReads:0, micRequests:0, tracksStopped:0, recorderStops:0,
  delay:false, release:()=>{}, wrongEcho:false, failLogout:false,
  serverOwner:(owner:string|null)=>{if(owner)localStorage.setItem(SERVER,owner);else localStorage.removeItem(SERVER);},
  async seed(label:string) {
    const local=personalStorage('localStorage'), tab=personalStorage('sessionStorage');
    local.setItem('synthetic-sentinel',label);tab.setItem('synthetic-sentinel',label);
    savePendingReset({id:'00000000-0000-4000-8000-000000000001',message:label,mode:'tip'});
    const id='00000000-0000-4000-8000-000000000002';keepPendingOutcome(tab,{action:'outcome_record',id,date:'2026-11-05',title:label,outcome:'win',note:'Synthetic',source:{type:'owner-request',reference:'cupcake-web:'+id,description:'Explicit synthetic test request'},metrics:{}});
    const talk={id:'talk-'+label,title:label,startedAt:'2026-11-05T12:00:00Z',endedAt:'2026-11-05T12:01:00Z',lines:[{role:'You' as const,text:label}]};
    tab.setItem(TALK_SEED_KEY,JSON.stringify(talk));saveTalk(talk);const recovery=new TalkCheckpointRecovery(talkDeviceStorage(),async()=>{throw Error('No checkpoint transport');});recovery.create(talk.id,talk.startedAt);recovery.capture(talk.id,talk.lines);
    rememberAnswer({threadId:'thread-'+label,turnId:'turn-'+label,attemptId:'attempt-'+label,response:{ok:true,reply:label,model:'synthetic'}});
    rememberBegin({threadId:'pending',turnId:'turn',text:label,parentTurnId:null});
    await putDraft({id:'draft-'+label,title:label,startedAt:1,mime:'audio/webm',complete:true,blob:new Blob([label])});
    return personalNamespace();
  },
  async caches() {return {namespace:personalNamespace(),local:personalStorage('localStorage').getItem('synthetic-sentinel'),tab:personalStorage('sessionStorage').getItem('synthetic-sentinel'),
    seed:personalStorage('sessionStorage').getItem(TALK_SEED_KEY),reset:pendingReset(),outcome:readPendingOutcome(personalStorage('sessionStorage')).pending,talks:readTalks(),checkpoints:new TalkCheckpointRecovery(talkDeviceStorage(),async()=>{throw Error('No transport');}).talks(),
    answers:receivedAnswers(),pending:pendingBegin('pending'),drafts:await drafts(),chat:readChatStorage('cupcake-quick-chat-draft')};},
  request:libraryRequest,
  heldStore:null as Storage|null,heldScope:null as ReturnType<typeof captureStorageScope>|null,
  holdScope(){this.heldStore=personalStorage('localStorage');this.heldScope=captureStorageScope();},
  async staleWrite(){let rejected=0;try{this.heldStore!.setItem('late-secret','late A');}catch{rejected++;}try{await putChunk('late-A',0,new Blob(['A']),this.heldScope!);}catch{rejected++;}try{await draftBlob({id:'A',title:'A',startedAt:1,mime:'audio/webm',complete:true,blob:new Blob(['A']),storageScope:this.heldScope!.namespace});}catch{rejected++;}return rejected;},
};
(window as unknown as {accountFixture:typeof fixture}).accountFixture=fixture;
history.replaceState({},'',`/cupcake${location.search}`);
if(!sessionStorage.getItem('synthetic-legacy-seeded')) {
  localStorage.setItem('cupcake-private-access','synthetic-legacy-key');sessionStorage.setItem('cupcake-private-access','synthetic-legacy-key');
  localStorage.setItem('cupcake-assistant-appearance-v1',JSON.stringify({appearance:'rose',persona:'matthieu',name:'LEGACY PRIVATE NAME'}));
  sessionStorage.setItem('cupcake-quick-chat-draft','LEGACY PRIVATE DRAFT');
  localStorage.setItem('cupcake-talk-history-v1',JSON.stringify([{id:'legacy',title:'LEGACY PRIVATE TALK',lines:[]} ]));
  await new Promise<void>((resolve,reject)=>{const open=indexedDB.open('cupcake-recorder',1);open.onupgradeneeded=()=>{open.result.createObjectStore('drafts',{keyPath:'id'});open.result.createObjectStore('chunks',{keyPath:'id'});};open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({id:'legacy',title:'LEGACY PRIVATE RECORDING',startedAt:1,mime:'audio/webm',complete:true,blob:new Blob(['legacy'])});tx.oncomplete=()=>{db.close();resolve();};};open.onerror=()=>reject(open.error);});
  sessionStorage.setItem('synthetic-legacy-seeded','1');
}
const getItem=Storage.prototype.getItem;
Storage.prototype.getItem=function(key:string){if(key==='cupcake-private-access'){fixture.legacyReads++;throw Error('An account build must never read an owner key');}return getItem.call(this,key);};
window.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
  if(url.origin===location.origin)return nativeFetch(input,init);
  if(!url.href.startsWith('https://automate.hales.ai/api/account/')){fixture.blocked.push(url.href);throw Error('External networking forbidden by synthetic fixture');}
  const route=url.pathname.split('/api/account/')[1],body=JSON.parse(String(init?.body||'{}'));
  const headers=Object.fromEntries(new Headers(init?.headers));fixture.requests.push({route,body,headers,credentials:init?.credentials});
  const response=(status:number,value:object)=>Response.json(value,{status});
  const current=()=>localStorage.getItem(SERVER)==='acc_synthetic_a'?A:localStorage.getItem(SERVER)==='acc_synthetic_b'?B:null;
  if(['password','recovery/issue','sign-out-all','sign-out'].includes(route)&&headers['x-cupcake-account-context']&&headers['x-cupcake-account-context']!==current()?.account_id)return response(409,{ok:false,error:'account_context_changed'});
  if(route==='sign-in'){const owner=body.email===A.email?A:body.email===B.email?B:null;if(!owner||body.password!=='Synthetic password 123!')return response(401,{ok:false});fixture.serverOwner(owner.account_id);return response(200,{ok:true,identity:owner});}
  if(route==='recovery/redeem'){fixture.serverOwner(null);return response(200,{ok:true});}
  if(route.startsWith('sign-out')){if(fixture.failLogout)return response(503,{ok:false});fixture.serverOwner(null);return response(200,{ok:true});}
  const owner=current();if(!owner)return response(401,{ok:false,error:'unauthenticated'});
  if(route==='session')return response(200,{ok:true,identity:owner});
  if(route==='recovery/issue')return response(200,{ok:true,recovery_code:'synthetic-one-time-recovery'});
  if(route==='password'){fixture.serverOwner(null);return response(200,{ok:true});}
  if(route!=='data')throw Error('Unknown synthetic account route '+route);
  if(headers['x-cupcake-account-context']!==owner.account_id)return response(409,{ok:false,error:'account_context_changed'});
  if(fixture.delay&&body.action==='fetch'&&body.id==='deferred-test')await new Promise<void>(resolve=>{fixture.release=resolve;});
  const identity=fixture.wrongEcho?(owner===A?B:A):owner;
  const ok=(value:object)=>response(200,{ok:true,...value,identity});
  if(body.action==='list')return ok({documents:[{id:'doc-'+owner.account_id,title:owner.name+' private document',createdAt:'2026-11-05T12:00:00Z',kind:'note',status:'ready',text:owner.name+' source text'}],projects:[],browseTotal:1,libraryTotal:1,hasMore:false,nextCursor:null});
  if(body.action==='fetch')return ok({document:{id:String(body.id),title:owner.name+' delayed original',kind:'note',status:'ready',text:owner.name+' private source'}});
  if(body.action==='weight_list')return ok({measurements:[],latestMeasurement:null,total:0,nextCursor:null,coverage:{}});
  if(body.action==='body_headline_get')return ok({body:{weight:null,weight_others:[],body_fat:null,body_fat_others:[]}});
  if(body.action==='food_history')return ok({meals:[],total:0,nextCursor:null,pendingCount:0,undatedLoggedCount:0});
  if(body.action==='food_settings_get')return ok({settings:{calorieTarget:null,expenditureEstimate:null,effectiveFrom:null,versions:[]}});
  if(body.action==='food_list')return ok({meals:[]});
  if(body.action==='body_assessment_get')return ok({table:null,history:[],columns:[],all_columns:[],notes:[]});
  if(body.action==='projects')return ok({projects:[]});
  if(body.action==='analysis_list')return ok({analyses:[]});
  if(body.action==='decision_list')return ok({decisions:[]});
  if(body.action==='search')return ok({results:[]});
  if(['exercise_list','glucose_manual_list','checkin_list','steps_list','ringconn_night_list','outcome_list'].includes(body.action))return ok({entries:[],latest:null,counts:{wins:0,losses:0,unscored:0,total:0}});
  throw Error('Unexpected synthetic account data action '+String(body.action));
};

// Real generated browser tracks, synthetic recorder bytes; no device permission.
Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{fixture.micRequests++;const audio=new AudioContext(),source=audio.createOscillator(),out=audio.createMediaStreamDestination();source.connect(out);source.start();out.stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{fixture.tracksStopped++;stop();void audio.close();};});return out.stream;}});
class SyntheticRecorder {
  static isTypeSupported(){return true;}
  state='inactive';ondataavailable:((event:{data:Blob})=>void)|null=null;onstop:(()=>void)|null=null;onerror:(()=>void)|null=null;timer:ReturnType<typeof setInterval>|undefined;
  start(){this.state='recording';this.timer=setInterval(()=>this.ondataavailable?.({data:new Blob(['synthetic audio'])}),30);}
  stop(){if(this.state==='inactive')return;this.state='inactive';fixture.recorderStops++;clearInterval(this.timer);setTimeout(()=>this.onstop?.(),20);}
}
Object.defineProperty(window,'MediaRecorder',{value:SyntheticRecorder});
createRoot(document.getElementById('root')!).render(<Cupcake/>);
