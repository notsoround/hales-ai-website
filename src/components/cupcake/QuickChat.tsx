import React, {useEffect,useRef,useState} from 'react';
import {libraryRequest} from './library';
import {type ChatReply,type ReceivedAnswer,receivedAnswers,forgetAnswer,rememberBegin,pendingBegin,forgetBegin,readChatStorage,writeChatStorage,recoveryEvent} from './quickChatRecovery';

type Turn={id:string;text:string;status:string;response?:ChatReply;retryAfter:number;error?:string;alternatives?:{attemptId:string;response:ChatReply}[]};
type Thread={id:string;title:string;turns:Turn[]};
type Result={thread:Thread;acquired?:boolean;execution?:string;attemptId?:string};
type Recognition={lang:string;onresult:(event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void;onerror:()=>void;onend:()=>void;start:()=>void;stop:()=>void};
const draftKey='cupcake-quick-chat-draft';
const selectedKey='cupcake-quick-chat-selected';
const newThreadKey='cupcake-quick-chat-new-thread';
const updateThreadUrl=(id:string|null)=>{const url=new URL(location.href);for(const key of ['document','analysis','recording','shared'])url.searchParams.delete(key);url.searchParams.set('tab','chat');if(id)url.searchParams.set('thread',id);else url.searchParams.delete('thread');history.replaceState(history.state,'',url)};

const Answer:React.FC<{response:ChatReply}>=({response})=><div className="mr-4 rounded-2xl bg-white/10 p-4 whitespace-pre-wrap break-words"><p>{response.reply}</p><p className="mt-2 text-xs text-white/50">AI response · {response.model} · interpretation, not verified fact</p>{(response.libraryUnavailable||response.recordsUnavailable)&&<p className="text-xs text-amber-300">Some private sources were unavailable for this answer.</p>}{response.sources?.map((s,i)=><p key={i} className="text-xs text-pink-200">Source: {s.url?.startsWith('https://')?<a href={s.url} target="_blank" rel="noreferrer">{s.title||'Library evidence'}</a>:s.title||'Library evidence'}</p>)}</div>;

export const QuickChat:React.FC<{speak:boolean;mediaBusy:boolean;active?:boolean}>=({speak,mediaBusy,active=true})=>{
  const [threads,setThreads]=useState<{id:string;title:string}[]>([]),[thread,setThread]=useState<Thread|null>(null);
  const [input,setInput]=useState(()=>readChatStorage(draftKey)||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState(false);
  const [unsaved,setUnsaved]=useState(receivedAnswers);
  const newThreadId=useRef(readChatStorage(newThreadKey)||crypto.randomUUID());
  const mounted=useRef(true),recognition=useRef<Recognition|null>(null),audioAllowed=useRef(false);
  const selectedThreadId=thread?.id;
  audioAllowed.current=active&&speak&&!mediaBusy;
  useEffect(()=>{if(active&&selectedThreadId)updateThreadUrl(selectedThreadId)},[active,selectedThreadId]);
  useEffect(()=>{if(!writeChatStorage(draftKey,input))setError('Browser storage is unavailable. Keep this page open to retain your draft.')},[input]);
  useEffect(()=>{const update=()=>setUnsaved(receivedAnswers());window.addEventListener(recoveryEvent,update);return()=>window.removeEventListener(recoveryEvent,update)},[]);
  useEffect(()=>{if(!active||mediaBusy){recognition.current?.stop();window.speechSynthesis?.cancel()}},[active,mediaBusy]);
  const refresh=async()=>{const d=await libraryRequest<{threads:{id:string;title:string}[]}>({action:'quick_chat_list'});if(mounted.current)setThreads(d.threads)};
  const selectThread=(value:Thread)=>{setThread(value);writeChatStorage(selectedKey,value.id);const pending=pendingBegin(value.id);if(pending&&value.turns.some(t=>t.id===pending.turnId&&t.status==='completed'))forgetBegin(value.id)};
  const open=async(id:string)=>{
    setBusy(true);setError('');
    try{const d=await libraryRequest<Result>({action:'quick_chat_get',threadId:id});if(mounted.current)selectThread(d.thread)}catch(e){if(mounted.current)setError(String(e))}finally{if(mounted.current)setBusy(false)}
  };
  useEffect(()=>{
    mounted.current=true;
    refresh().catch(e=>{if(mounted.current)setError(String(e))});
    const id=new URLSearchParams(location.search).get('thread')||readChatStorage(selectedKey);if(id)void open(id);
    return()=>{mounted.current=false;recognition.current?.stop();window.speechSynthesis?.cancel()};
    // The saved selection is read only on mount; changing it must not reopen stale state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const save=async(answer:ReceivedAnswer)=>{
    const d=await libraryRequest<Result>({action:'quick_chat_complete',...answer});
    forgetAnswer(answer);forgetBegin(answer.threadId);
    if(mounted.current){selectThread(d.thread);setUnsaved(receivedAnswers());await refresh().catch(()=>setError('Your answer is saved. The conversation list could not refresh.'))}
  };
  const send=async(regenerate?:Turn)=>{
    if(busy||unsaved.length)return;
    const text=regenerate?.text||input.trim();if(!text)return;
    setBusy(true);setError('');recognition.current?.stop();
    let current=thread;
    try{
      if(!current){
        writeChatStorage(newThreadKey,newThreadId.current);
        const d=await libraryRequest<Result>({action:'quick_chat_create',threadId:newThreadId.current,title:text.slice(0,120)});
        current=d.thread;if(mounted.current)selectThread(current);
      }
      const prior=pendingBegin(current.id);
      if(!regenerate&&prior&&prior.text!==text)throw Error('A previous message may already be saved. Reopen this conversation before changing or sending it.');
      const turnId=regenerate?.id||prior?.turnId||crypto.randomUUID();
      const begin={threadId:current.id,turnId,text,parentTurnId:current.turns[current.turns.length-1]?.id||null,...(regenerate?{requestId:prior?.requestId||crypto.randomUUID()}:{})};
      rememberBegin(begin);
      const begun=await libraryRequest<Result>({action:'quick_chat_begin',...begin,...(regenerate?{regenerate:true}:{})});
      forgetBegin(current.id);
      if(mounted.current)selectThread(begun.thread);
      if(!regenerate)setInput(value=>value.trim()===text?'':value);
      if(!begun.acquired&&begun.execution!=='server'&&mounted.current)setError('Your saved request was reopened. No duplicate AI job was started.');
      await refresh();
    }catch(e){if(mounted.current)setError(String(e))}finally{if(mounted.current)setBusy(false)}
  };
  useEffect(()=>{
    if(!active||!thread||!thread.turns.some(t=>t.status==='queued'||t.status==='running'))return;
    let cancelled=false,delay=5000;
    let timer:number;
    const poll=async()=>{
      try{
        const d=await libraryRequest<Result>({action:'quick_chat_get',threadId:thread.id});
        if(cancelled||!mounted.current)return;
        const old=thread.turns[thread.turns.length-1],latest=d.thread.turns[d.thread.turns.length-1];
        selectThread(d.thread);
        if(old&&!old.response&&latest?.response&&audioAllowed.current&&window.speechSynthesis)window.speechSynthesis.speak(new SpeechSynthesisUtterance(latest.response.reply));
      }catch{if(!cancelled){delay=Math.min(delay*2,30000);setError('Status could not refresh. Your server request continues; reopen this conversation later.')}}
      finally{if(!cancelled)timer=window.setTimeout(poll,delay)}
    };
    timer=window.setTimeout(poll,delay);
    return()=>{cancelled=true;window.clearTimeout(timer)};
  },[active,thread]);
  const dictate=()=>{
    if(listening){recognition.current?.stop();return}
    const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
    const SR=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!SR){setError('Voice typing is unavailable in this browser. Your phone keyboard may offer dictation.');return}
    const rec=new SR();rec.lang='en-US';rec.onresult=e=>setInput(v=>(v+(v?' ':'')+e.results[0][0].transcript).slice(0,8000));rec.onerror=()=>{setListening(false);setError('Voice typing could not start. Check microphone access.')};rec.onend=()=>setListening(false);recognition.current=rec;
    try{rec.start();setListening(true)}catch{setError('Voice typing could not start. Check microphone access.')}
  };
  const startNew=()=>{setThread(null);newThreadId.current=crypto.randomUUID();writeChatStorage(newThreadKey,newThreadId.current);writeChatStorage(selectedKey,null);if(active)updateThreadUrl(null);setError('')};
  const last=thread?.turns[thread.turns.length-1];
  const options=thread&&!threads.some(t=>t.id===thread.id)?[thread,...threads]:threads;
  return <section className="space-y-4 pb-6">
    <div className="flex gap-2"><select aria-label="Saved conversations" className="min-w-0 flex-1 rounded-xl bg-slate-900 p-3" disabled={busy||!!unsaved.length} value={thread?.id||''} onChange={e=>e.target.value?void open(e.target.value):startNew()}><option value="">New conversation</option>{options.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><button disabled={busy||!!unsaved.length} onClick={startNew} className="rounded-xl bg-white/10 px-3">New</button>{thread&&<button disabled={busy} onClick={()=>void open(thread.id)} className="rounded-xl bg-white/10 px-3">Refresh</button>}</div>
    <p className="text-xs text-white/50">Private conversation history is saved across your devices and searchable in your library. AI replies are interpretations, not verified facts.</p>
    {thread?.turns.map(t=><div key={t.id} className="space-y-2"><p className="ml-8 rounded-2xl bg-pink-700 p-4 whitespace-pre-wrap break-words"><span className="block text-xs opacity-60">You · original message</span>{t.text}</p>{t.response?<Answer response={t.response}/>:<div className="text-sm text-amber-200">{busy?'Working on your reply…':t.status==='queued'||t.status==='running'?'Your reply is being prepared on the server. You can close this page.':t.status==='failed'?'The reply service rejected this attempt. Your message is saved.':t.retryAfter>0?'Waiting for this reply. Check status shortly.':'Reply outcome uncertain. A request may already have completed.'} {!busy&&<button className="underline ml-2" onClick={()=>void open(thread.id)}>Check status</button>}{!busy&&!unsaved.length&&t.retryAfter===0&&!['queued','running'].includes(t.status)&&<button className="underline ml-2" onClick={()=>void send(t)}>Request another answer (may repeat the AI request)</button>}</div>}{t.alternatives?.map(a=><details key={a.attemptId}><summary className="text-sm text-amber-200 cursor-pointer">Another received AI answer</summary><Answer response={a.response}/></details>)}</div>)}
    {unsaved.map(answer=><div key={answer.attemptId} className="rounded-xl border border-amber-400 p-4"><p className="whitespace-pre-wrap break-words">{answer.response.reply}</p><p className="text-xs">Received answer awaiting save. It remains an AI interpretation.</p><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await save(answer)}catch(e){setError(String(e))}finally{setBusy(false)}}} className="underline">Save answer again</button></div>)}
    {error&&<p role="alert" className="text-sm text-amber-200 break-words">{error}</p>}
    <div className="flex gap-2"><textarea aria-label="Message Cupcake" value={input} maxLength={8000} onChange={e=>setInput(e.target.value)} placeholder="Talk to Cupcake…" className="min-w-0 flex-1 rounded-xl bg-white/10 p-3" rows={3}/><div className="flex flex-col gap-2"><button className="rounded-xl bg-pink-600 p-3 disabled:opacity-40" disabled={busy||!!unsaved.length||!input.trim()||!!(last&&last.status!=='completed')} onClick={()=>void send()}>Send</button><button className="rounded-xl bg-white/10 p-2 disabled:opacity-40" disabled={busy||mediaBusy} onClick={dictate}>{listening?'Stop dictation':'Dictate'}</button></div></div>
  </section>;
};
