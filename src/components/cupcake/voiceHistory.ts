export type TalkLine = { role: 'You' | 'Cupcake'; text: string };
export type StartingContext = {title:string;lines:{role:'user'|'assistant';text:string}[];source?:{kind:'intervention'|'talk';id:string}};
export type SavedTalk = { id: string; title: string; startedAt: string; endedAt: string; lines: TalkLine[]; archived?: boolean; documentId?: string; startingContext?:StartingContext };
const KEY = 'cupcake-talk-history-v1';
const clean = (value: unknown, limit: number) => String(value || '').replace(/\0/g, '').trim().slice(0, limit);
export class TalkLineDrain {
  private accepting=true;
  private lines:TalkLine[]=[];
  private eventIds=new Set<string>();
  append(line:TalkLine,eventId?:unknown) {
    if(!this.accepting)return false;
    const id=typeof eventId==='string'&&eventId.length<=200?eventId:'';
    if(id&&this.eventIds.has(id))return false;
    const text=line.text;if(!text.trim())return false;
    if(id)this.eventIds.add(id);
    this.lines=[...this.lines,{role:line.role==='You'?'You':'Cupcake',text}];
    return true;
  }
  snapshot(){return this.lines.slice();}
  close(){this.accepting=false;return this.snapshot();}
}
export class VoiceEndingCoordinator {
  current:Promise<void>|null=null;
  begin(task:()=>Promise<void>){if(this.current)return this.current;const shared=Promise.resolve().then(task).finally(()=>{if(this.current===shared)this.current=null;});this.current=shared;return shared;}
}
export async function settleVoiceOperation(operation:()=>unknown,limit=2000) {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    await Promise.race([
      Promise.resolve().then(operation).catch(()=>{}),
      new Promise<void>(resolve=>{timer=setTimeout(resolve,limit);}),
    ]);
  } finally {if(timer)clearTimeout(timer);}
}
export async function drainVoiceTransport(transport:{leave:()=>unknown;destroy:()=>unknown}|null,drain:TalkLineDrain,limit=2000) {
  if(transport){await settleVoiceOperation(()=>transport.leave(),limit);await settleVoiceOperation(()=>transport.destroy(),limit);}
  return drain.close();
}
// UI teardown has a deadline; transcript finalization waits for the actual
// transport promises. A timeout or rejection never claims the session is final.
export async function closeVoiceTransport(transport:{leave:()=>unknown;destroy:()=>unknown}|null,onConfirmed:()=>void,limit=2000) {
  if(!transport){onConfirmed();return true;}
  const attempt=(operation:()=>unknown)=>Promise.resolve().then(operation).then(()=>true,()=>false);
  let confirmed=false;
  const left=attempt(()=>transport.leave());
  await settleVoiceOperation(()=>left,limit);
  const destroyed=attempt(()=>transport.destroy());
  void Promise.all([left,destroyed]).then(results=>{if(results.every(Boolean)){confirmed=true;onConfirmed();}});
  await settleVoiceOperation(()=>destroyed,limit);
  return confirmed;
}
export function readTalks(): SavedTalk[] { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
export function saveTalk(talk: SavedTalk) { const safe = {...talk,title:clean(talk.title,120),lines:talk.lines.map(x=>({...x}))}; const all=[safe,...readTalks().filter(x=>x.id!==safe.id)]; try { localStorage.setItem(KEY,JSON.stringify(all)); } catch { /* Private-library import remains the durable path. */ } return all; }
export function persistTalk(talk:SavedTalk){const talks=saveTalk(talk);let persisted=false;try{const found=JSON.parse(localStorage.getItem(KEY)||'[]').find((x:{id?:unknown})=>x?.id===talk.id);persisted=JSON.stringify(found)===JSON.stringify(talks.find(x=>x.id===talk.id));}catch{/* The in-memory copy remains reviewable. */}return {talks,persisted};}
export function archiveTalk(id: string, archived = true) { const all=readTalks().map(x=>x.id===id?{...x,archived}:x);try{localStorage.setItem(KEY,JSON.stringify(all));}catch{/* Private-library copy remains available. */}return all; }
export function validStartingContext(value:unknown):value is StartingContext {
 const c=value as StartingContext;
 return !!c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).every(k=>['title','lines','source'].includes(k))&&typeof c.title==='string'&&!!c.title.trim()&&c.title.length<=120&&Array.isArray(c.lines)&&c.lines.length>0&&c.lines.length<=40&&c.lines.every(l=>l&&Object.keys(l).every(k=>['role','text'].includes(k))&&['user','assistant'].includes(l.role)&&typeof l.text==='string'&&!!l.text.trim()&&l.text.length<=2000)&&c.lines.reduce((n,l)=>n+l.text.length,0)<=12000&&(c.source===undefined||(!!c.source&&!Array.isArray(c.source)&&Object.keys(c.source).every(k=>['kind','id'].includes(k))&&['intervention','talk'].includes(c.source.kind)&&typeof c.source.id==='string'&&!!c.source.id.trim()&&c.source.id.length<=200));
}
export function sameStartingContext(a:unknown,b:unknown):boolean {
 if(a===undefined||b===undefined)return a===b;
 if(!validStartingContext(a)||!validStartingContext(b))return false;
 return a.title===b.title&&a.lines.length===b.lines.length&&a.lines.every((line,i)=>line.role===b.lines[i].role&&line.text===b.lines[i].text)&&
  (a.source===undefined?b.source===undefined:!!b.source&&a.source.kind===b.source.kind&&a.source.id===b.source.id);
}
export function continuationContext(talk: SavedTalk) {
 const original=talk.startingContext;const lines:StartingContext['lines']=[];let remaining=12000;
 if(original){
  if(!validStartingContext(original))throw Error('Saved starting context needs review.');
  const first=original.lines[0];const anchor={...first,text:first.text.slice(0,2000)};lines.push(anchor);remaining-=anchor.text.length;
  let inheritedBudget=6000-anchor.text.length;const inherited:StartingContext['lines']=[];
  for(const line of original.lines.slice(1).reverse()){if(inheritedBudget<=0||inherited.length>=18)break;const text=line.text.slice(0,Math.min(2000,inheritedBudget));inherited.unshift({...line,text});inheritedBudget-=text.length;remaining-=text.length;}
  lines.push(...inherited);
 }
 const recent:StartingContext['lines']=[];
 for(const line of talk.lines.slice(-(40-lines.length)).reverse()) {
  if(remaining<=0)break;const text=clean(line.text,Math.min(2000,remaining));remaining-=text.length;
  if(text)recent.unshift({role:line.role==='You'?'user':'assistant',text});
 }
 return {title:clean(original?.title||talk.title,120),lines:[...lines,...recent]};
}
export function startingContextFor(talk:SavedTalk):StartingContext {
 return {...continuationContext(talk),source:{kind:talk.id.startsWith('intervention')?'intervention':'talk',id:talk.id.slice(0,200)}};
}
