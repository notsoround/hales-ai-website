export type TalkLine = { role: 'You' | 'Cupcake'; text: string };
export type SavedTalk = { id: string; title: string; startedAt: string; endedAt: string; lines: TalkLine[]; archived?: boolean; documentId?: string };
const KEY = 'cupcake-talk-history-v1';
const clean = (value: unknown, limit: number) => String(value || '').replace(/\0/g, '').trim().slice(0, limit);
export function readTalks(): SavedTalk[] { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value.slice(0, 20) : []; } catch { return []; } }
export function saveTalk(talk: SavedTalk) { const safe = {...talk,title:clean(talk.title,120),lines:talk.lines.slice(-100).map(x=>({role:x.role==='You'?'You' as const:'Cupcake' as const,text:clean(x.text,2000)})).filter(x=>x.text)}; const all=[safe,...readTalks().filter(x=>x.id!==safe.id)].slice(0,20); try { localStorage.setItem(KEY,JSON.stringify(all)); } catch { /* Private-library import remains the durable path. */ } return all; }
export function archiveTalk(id: string, archived = true) { const all=readTalks().map(x=>x.id===id?{...x,archived}:x);try{localStorage.setItem(KEY,JSON.stringify(all));}catch{/* Private-library copy remains available. */}return all; }
export function continuationContext(talk: SavedTalk) { let remaining=12000; const lines=talk.lines.slice(-40).map(x=>{const text=clean(x.text,Math.min(2000,remaining));remaining-=text.length;return {role:x.role==='You'?'user':'assistant',text};}).filter(x=>x.text); return {title:clean(talk.title,120),lines}; }
