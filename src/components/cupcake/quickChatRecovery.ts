export type ChatReply = {ok:true;reply:string;model:string;sources?:{title?:string;url?:string}[];libraryUnavailable?:boolean;recordsUnavailable?:boolean;unavailableSources?:string[]};
/** Plain-words notice naming what the answer could not read, or null when nothing was missing. */
export function unavailableNotice(r:Pick<ChatReply,'libraryUnavailable'|'recordsUnavailable'|'unavailableSources'>):string|null{
  const named=Array.isArray(r.unavailableSources)?r.unavailableSources.filter(s=>typeof s==='string'&&s.trim()).slice(0,6):[];
  if(named.length)return `Couldn't read ${named.length===1?named[0]:named.slice(0,-1).join(', ')+' and '+named[named.length-1]} for this answer, so it doesn't include that data.`;
  if(r.libraryUnavailable||r.recordsUnavailable)return "Some of your records couldn't be read for this answer, so it may be missing details.";
  return null;
}
export type ReceivedAnswer = {threadId:string;turnId:string;attemptId:string;response:ChatReply};
export type PendingBegin = {threadId:string;turnId:string;text:string;parentTurnId:string|null;requestId?:string};
const answerPrefix = 'cupcake-quick-chat-answer:';
const beginPrefix = 'cupcake-quick-chat-begin:';
const answers = new Map<string,ReceivedAnswer>();
const begins = new Map<string,PendingBegin>();
export const recoveryEvent = 'cupcake-quick-chat-recovery-changed';
export const readChatStorage = (key:string) => {try{return sessionStorage.getItem(key)}catch{return null}};
export const writeChatStorage = (key:string,value:string|null) => {try{if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,value);return true}catch{return false}};
const answerId = (answer:ReceivedAnswer) => answerPrefix+answer.threadId+':'+answer.turnId+':'+answer.attemptId;
function isAnswer(value:unknown):value is ReceivedAnswer {
  if(!value||typeof value!=='object')return false;
  const p=value as ReceivedAnswer;
  return typeof p.threadId==='string'&&typeof p.turnId==='string'&&typeof p.attemptId==='string'&&p.response?.ok===true&&typeof p.response.reply==='string'&&typeof p.response.model==='string';
}
export function receivedAnswers():ReceivedAnswer[] {
  // Read the former single-answer slot once, retaining it until successful save.
  const legacy=readChatStorage('cupcake-quick-chat-unsaved-answer');
  try{const p=JSON.parse(legacy||'null');if(isAnswer(p))answers.set(answerId(p),p)}catch{/* A malformed draft cannot hide other received answers. */}
  try {
    for(let i=0;i<sessionStorage.length;i++) {
      const key=sessionStorage.key(i);
      if(key?.startsWith(answerPrefix)) {
        try {const p=JSON.parse(sessionStorage.getItem(key)||'null');if(isAnswer(p))answers.set(answerId(p),p)}
        catch {/* Keep other answers available. */}
      }
    }
  } catch {/* In-memory recovery still works when browser storage is unavailable. */}
  return [...answers.values()];
}
export function rememberAnswer(answer:ReceivedAnswer) {
  answers.set(answerId(answer),answer);
  const persisted=writeChatStorage(answerId(answer),JSON.stringify(answer));
  window.dispatchEvent(new Event(recoveryEvent));
  return persisted;
}
export function forgetAnswer(answer:ReceivedAnswer) {
  answers.delete(answerId(answer));
  writeChatStorage(answerId(answer),null);
  try{const old=JSON.parse(readChatStorage('cupcake-quick-chat-unsaved-answer')||'null');if(isAnswer(old)&&answerId(old)===answerId(answer))writeChatStorage('cupcake-quick-chat-unsaved-answer',null)}catch{/* Ignore malformed legacy data. */}
  window.dispatchEvent(new Event(recoveryEvent));
}
export function rememberBegin(begin:PendingBegin) {
  begins.set(begin.threadId,begin);
  writeChatStorage(beginPrefix+begin.threadId,JSON.stringify(begin));
}
export function pendingBegin(threadId:string):PendingBegin|null {
  if(begins.has(threadId))return begins.get(threadId)||null;
  try{const p=JSON.parse(readChatStorage(beginPrefix+threadId)||'null');if(p&&p.threadId===threadId&&typeof p.turnId==='string'&&typeof p.text==='string')return p}catch{/* The server remains the source of saved turn identities. */}
  return null;
}
export function forgetBegin(threadId:string) {
  begins.delete(threadId);writeChatStorage(beginPrefix+threadId,null);
}
