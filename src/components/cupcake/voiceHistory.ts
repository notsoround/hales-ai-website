export type TalkLine = { role: 'You' | 'Cupcake'; text: string };
export type SavedTalk = { id: string; title: string; startedAt: string; endedAt: string; lines: TalkLine[]; archived?: boolean; documentId?: string };
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
    const text=clean(line.text,2000);if(!text)return false;
    if(id)this.eventIds.add(id);
    this.lines=[...this.lines.slice(-99),{role:line.role==='You'?'You':'Cupcake',text}];
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
export function readTalks(): SavedTalk[] { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value.slice(0, 20) : []; } catch { return []; } }
export function saveTalk(talk: SavedTalk) { const safe = {...talk,title:clean(talk.title,120),lines:talk.lines.slice(-100).map(x=>({role:x.role==='You'?'You' as const:'Cupcake' as const,text:clean(x.text,2000)})).filter(x=>x.text)}; const all=[safe,...readTalks().filter(x=>x.id!==safe.id)].slice(0,20); try { localStorage.setItem(KEY,JSON.stringify(all)); } catch { /* Private-library import remains the durable path. */ } return all; }
export function persistTalk(talk:SavedTalk){const talks=saveTalk(talk);let persisted=false;try{const found=JSON.parse(localStorage.getItem(KEY)||'[]').find((x:{id?:unknown})=>x?.id===talk.id);persisted=JSON.stringify(found)===JSON.stringify(talks.find(x=>x.id===talk.id));}catch{/* The in-memory copy remains reviewable. */}return {talks,persisted};}
export function archiveTalk(id: string, archived = true) { const all=readTalks().map(x=>x.id===id?{...x,archived}:x);try{localStorage.setItem(KEY,JSON.stringify(all));}catch{/* Private-library copy remains available. */}return all; }
export function continuationContext(talk: SavedTalk) {
  let remaining=12000;
  const lines:{role:'user'|'assistant';text:string}[]=[];
  for(const line of talk.lines.slice(-40).reverse()) {
    if(remaining<=0)break;
    const text=clean(line.text,Math.min(2000,remaining));
    remaining-=text.length;
    if(text)lines.unshift({role:line.role==='You'?'user':'assistant',text});
  }
  return {title:clean(talk.title,120),lines};
}
