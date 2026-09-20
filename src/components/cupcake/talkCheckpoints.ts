import type {SavedTalk, TalkLine} from './voiceHistory';

type Checkpoint = {action:'talk_checkpoint';sessionId:string;version:number;title:string;lines:(TalkLine&{transcriptType:'final'})[];final:boolean};
type State = {id:string;title:string;startedAt:string;updatedAt:string;lines:TalkLine[];final:boolean;version:number;ackCount:number;ackFinal:boolean;pending?:Checkpoint;documentId?:string};
type StorageLike = Pick<Storage,'getItem'|'setItem'|'key'|'length'>;
export type RemoteTalk = {id:string;title:string;createdAt:number;updatedAt:number;version:number;final:boolean;documentId:string};
export type RemoteTalkSession = RemoteTalk & {lines:(TalkLine&{transcriptType:'final'})[]};
type Response = {session:{id:string;version:number;documentId:string;lines?:RemoteTalkSession['lines'];final?:boolean};libraryStatus:string};
const prefix='cupcake-talk-checkpoint-v1:';
const archivePrefix='cupcake-talk-archive-v1:';
const storageWarning='No durable device copy could be confirmed. Keep this page open until private-library sync succeeds, or export the received transcript.';
const samePrefix=(a:TalkLine[],b:TalkLine[])=>a.length<=b.length&&a.every((line,i)=>line.role===b[i]?.role&&line.text===b[i]?.text);
const validLines=(lines:unknown):lines is TalkLine[]=>Array.isArray(lines)&&lines.every(l=>l&&(l.role==='You'||l.role==='Cupcake')&&typeof l.text==='string');

export function talkDeviceStorage():StorageLike|null {try{return window.localStorage}catch{return null}}
export function remoteTalkSummary(t:RemoteTalk):SavedTalk {
 return {id:t.id,title:t.title,startedAt:new Date(t.createdAt*1000).toISOString(),endedAt:new Date(t.updatedAt*1000).toISOString(),lines:[],documentId:t.documentId};
}

export class TalkCheckpointRecovery {
 private memory=new Map<string,State>();
 private flights=new Map<string,Promise<void>>();
 private warnings=new Map<string,string>();
 private malformed=new Set<string>();
 private archives=new Map<string,boolean>();
 private storage:StorageLike|null;
 private send:(p:Checkpoint)=>Promise<Response>;
 constructor(storage:StorageLike|null,send:(p:Checkpoint)=>Promise<Response>){this.storage=storage;this.send=send}
 warning(){return [...new Set(this.warnings.values())].join(' ')}
 get(id:string):State|undefined {
  if(this.memory.has(id))return this.memory.get(id);
  let raw:string|null;
  try{if(!this.storage)throw Error();raw=this.storage.getItem(prefix+id)}catch{this.warnings.set('storage',storageWarning);return}
  if(!raw)return;
  try{
   const s=JSON.parse(raw) as State;
   if(s.id!==id||typeof s.title!=='string'||typeof s.startedAt!=='string'||typeof s.updatedAt!=='string'||!validLines(s.lines)||!Number.isInteger(s.version)||s.version<0||!Number.isInteger(s.ackCount)||s.ackCount<0||s.ackCount>s.lines.length||typeof s.final!=='boolean'||typeof s.ackFinal!=='boolean')throw Error();
   if(s.pending&&(s.pending.action!=='talk_checkpoint'||s.pending.sessionId!==id||s.pending.version!==s.version+1||s.pending.title!==s.title||typeof s.pending.final!=='boolean'||!validLines(s.pending.lines)||!samePrefix(s.pending.lines,s.lines)||s.pending.lines.some(l=>l.transcriptType!=='final')))throw Error();
   this.memory.set(id,s);return s;
  }catch{this.malformed.add(id);this.warnings.set(prefix+id,'An unreadable saved Talk record was kept unchanged. Other transcripts can still sync; Export includes its raw original.');return}
 }
 private write(s:State){
  this.memory.set(s.id,s);
  try{if(!this.storage)throw Error();this.storage.setItem(prefix+s.id,JSON.stringify(s));this.warnings.delete(prefix+s.id)}
  catch{this.warnings.set(prefix+s.id,storageWarning)}
 }
 create(id:string,startedAt:string){
  if(this.get(id))return;
  if(this.malformed.has(id))throw Error('This Talk record is unreadable; its original has been preserved.');
  this.write({id,title:'Talk with Cupcake · '+new Date(startedAt).toLocaleString(),startedAt,updatedAt:startedAt,lines:[],final:false,version:0,ackCount:0,ackFinal:false});
 }
 capture(id:string,lines:TalkLine[],final=false){
  const s=this.get(id);if(!s)throw Error('Talk recovery session missing');
  if(s.final&&JSON.stringify(lines)!==JSON.stringify(s.lines))throw Error('Finalized Talk cannot accept additional lines.');
  if(!samePrefix(s.lines,lines))throw Error('Talk transcript changed; saved original retained.');
  this.write({...s,lines:lines.map(l=>({...l})),final:s.final||final,updatedAt:new Date().toISOString()});
 }
 private keys(){
  const keys:string[]=[];
  try{if(!this.storage)throw Error();for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key?.startsWith(prefix)||key?.startsWith(archivePrefix))keys.push(key)}}
  catch{this.warnings.set('storage',storageWarning)}
  return keys;
 }
 list(){for(const key of this.keys())if(key.startsWith(prefix))this.get(key.slice(prefix.length));return [...this.memory.values()]}
 isArchived(id:string,fallback=false){
  if(this.archives.has(id))return this.archives.get(id)!;
  try{if(!this.storage)return fallback;const raw=this.storage.getItem(archivePrefix+id);if(raw===null)return fallback;const value=JSON.parse(raw);if(typeof value!=='boolean')throw Error();this.archives.set(id,value);return value}
  catch{this.warnings.set(archivePrefix+id,'A saved archive preference could not be read; its original was preserved.');return fallback}
 }
 setArchived(id:string,value:boolean){
  this.archives.set(id,value);
  try{if(!this.storage)throw Error();this.storage.setItem(archivePrefix+id,JSON.stringify(value));this.warnings.delete(archivePrefix+id)}
  catch{this.warnings.set(archivePrefix+id,'The archive preference is only in this page; device storage is unavailable.')}
 }
 talks():SavedTalk[]{return this.list().filter(s=>s.lines.length).map(s=>({id:s.id,title:s.title,startedAt:s.startedAt,endedAt:s.updatedAt,lines:s.lines,documentId:s.documentId,archived:this.isArchived(s.id)}))}
 pending(){return this.list().filter(s=>s.lines.length&&(s.pending||s.lines.length!==s.ackCount||s.final!==s.ackFinal))}
 exportOriginals(){
  const records=this.list(),rawRecords:{key:string;value:string|null}[]=[];
  for(const key of this.keys()){try{rawRecords.push({key,value:this.storage!.getItem(key)})}catch{this.warnings.set(key,storageWarning)}}
  return {formatVersion:1,records,rawRecords,warnings:[...new Set(this.warnings.values())]};
 }
 adoptRemote(t:RemoteTalkSession):SavedTalk {
  if(!Array.isArray(t.lines)||!t.lines.every(l=>(l.role==='You'||l.role==='Cupcake')&&typeof l.text==='string'))throw Error('The saved Talk transcript was incomplete.');
  const old=this.get(t.id),base=remoteTalkSummary(t);
  if(this.malformed.has(t.id))return {...base,lines:t.lines.map(l=>({role:l.role,text:l.text})),archived:this.isArchived(t.id)};
  if(old&&(old.pending||old.ackCount!==old.lines.length||old.ackFinal!==old.final)){
   this.write({...old,documentId:t.documentId});
  }else if(!old||t.version>=old.version){
   if(old&&!samePrefix(old.lines,t.lines))throw Error('The server transcript differs from the saved device original. Both copies were preserved.');
   this.write({id:t.id,title:t.title,startedAt:base.startedAt,updatedAt:base.endedAt,lines:t.lines.map(l=>({role:l.role,text:l.text})),final:t.final,version:t.version,ackCount:t.lines.length,ackFinal:t.final,documentId:t.documentId});
  }
  const s=this.get(t.id)!;
  return {id:s.id,title:s.title,startedAt:s.startedAt,endedAt:s.updatedAt,lines:s.lines,documentId:s.documentId,archived:this.isArchived(s.id)};
 }
 flush(id:string):Promise<void>{const existing=this.flights.get(id);if(existing)return existing;const job=this.run(id).finally(()=>this.flights.delete(id));this.flights.set(id,job);return job}
 private async run(id:string){
  for(;;){let s=this.get(id);if(!s||!s.lines.length)return;
   if(!s.pending){if(s.ackCount===s.lines.length&&s.ackFinal===s.final)return;const pending:Checkpoint={action:'talk_checkpoint',sessionId:id,version:s.version+1,title:s.title,lines:s.lines.map(l=>({...l,transcriptType:'final'})),final:s.final};this.write({...s,pending});s=this.get(id)!}
   const p=s.pending!,result=await this.send(p);
   if(result.session.id!==id||result.session.version<p.version)throw Error('Talk checkpoint confirmation was incomplete; retry the saved revision.');
   if(result.libraryStatus!=='indexed')throw Error('Talk transcript reached private storage; library indexing is pending. Retry sync to repair it.');
   const latest=this.get(id)!;
   if(result.session.version>p.version){
    const remote=result.session.lines;
    if(!remote||(!samePrefix(latest.lines,remote)&&!samePrefix(remote,latest.lines))||(result.session.final&&remote.length<latest.lines.length))throw Error('A newer server revision needs review. The received device transcript was preserved; export it before closing.');
    const lines=remote.length>=latest.lines.length?remote.map(l=>({role:l.role,text:l.text})):latest.lines;
    this.write({...latest,lines,final:latest.final||Boolean(result.session.final),version:result.session.version,ackCount:remote.length,ackFinal:Boolean(result.session.final),pending:undefined,documentId:result.session.documentId});
   }else{
    // Capture may append more final transcript events during this request.
    this.write({...latest,version:p.version,ackCount:p.lines.length,ackFinal:p.final,pending:undefined,documentId:result.session.documentId});
   }
  }
 }
}
