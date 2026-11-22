import { ACCOUNT_SESSIONS, cupcakeHref } from './accountMode';
import './noir/noir-pages.css';
import React, {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowUp,Disc,Headphones,Info,Mic,Plus,RotateCw,Square,Volume2,VolumeX} from 'lucide-react';
import {libraryRequest} from './library';
import {type ChatReply,unavailableNotice,type ReceivedAnswer,receivedAnswers,forgetAnswer,rememberBegin,pendingBegin,forgetBegin,readChatStorage,writeChatStorage,recoveryEvent,speakText} from './quickChatRecovery';
import './chat-layout.css';
import './noir/assistant/noir-chat.css';
import {ReadAloudButton} from './ReadAloudButton';
import {useLab} from './labsFlags';
import {AssistantSuggestions} from './AssistantSuggestions';
import {ReportReply} from './ReportReply';
import type {ReportableReply} from './accountSession';
import type {AssistantMode} from './AssistantShell';
import {summarizeGroceryAndPantry} from './groceryChecklist';
import {ACTIONS_MARK,MAX_WRAPPED_INPUT,compactMeals,compactPurchases,compactWorkouts,replyText,shownMessage,wrapMessage} from './assistantActionsModel';

type Turn={id:string;text:string;status:string;response?:ChatReply;retryAfter:number;error?:string;alternatives?:{attemptId:string;response:ChatReply}[]};
type Thread={id:string;title:string;turns:Turn[]};
type Result={thread:Thread;acquired?:boolean;execution?:string;attemptId?:string};
type Recognition={lang:string;onresult:(event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void;onerror:()=>void;onend:()=>void;start:()=>void;stop:()=>void};
type Retryable={kind:'list'}|{kind:'load'|'status';id:string};
const draftKey='cupcake-quick-chat-draft';
const selectedKey='cupcake-quick-chat-selected';
const newThreadKey='cupcake-quick-chat-new-thread';
const visibleError=(value:string)=>value.replace(/^Error: /,'');
const allowanceErrors:Record<string,string>={
  account_budget_unavailable:'Your reply allowance is unavailable right now. Your message is saved. Check again later.',
  account_budget_exceeded:'There isn’t enough reply allowance for this answer right now. Your message is saved.',
  account_budget_reconciliation_required:'Reply usage needs to be checked before another answer can start. Your message is saved.',
  account_budget_attempt_already_reserved:'This answer may already have started. Your message is saved. Check status before trying again.',
  account_budget_attempt_not_dispatched:'This answer’s status could not be confirmed. Your message is saved. Check status before trying again.',
};
const updateThreadUrl=(id:string|null)=>{const url=new URL(location.href);for(const key of ['document','analysis','recording','shared'])url.searchParams.delete(key);url.searchParams.set('tab','chat');if(id)url.searchParams.set('thread',id);else url.searchParams.delete('thread');history.replaceState(history.state,'',url)};

const Answer:React.FC<{response:ChatReply;seed?:string;suggest?:boolean;report?:ReportableReply}>=({response,seed='',suggest=false,report})=><div className="cc-chat-reply mr-4 rounded-2xl bg-white/10 p-4 whitespace-pre-wrap break-words"><ReadAloudButton text={replyText(response.reply)} label="Play answer"/><p>{replyText(response.reply)}</p>{ACCOUNT_SESSIONS&&seed&&<AssistantSuggestions reply={response.reply} seed={seed} enabled={suggest}/>}<p className="cc-chat-reply-meta mt-2 text-xs text-white/50">AI response · {response.model} · interpretation, not verified fact</p>{report&&<ReportReply reply={report}/>}{unavailableNotice(response)&&<p className="text-xs text-amber-300">{unavailableNotice(response)}</p>}{response.sources?.map((s,i)=><p key={i} className="text-xs text-pink-200">Source: {s.url?.startsWith('https://')?<a href={cupcakeHref(s.url)} target="_blank" rel="noreferrer">{s.title||'Library evidence'}</a>:s.title||'Library evidence'}</p>)}</div>;

/** Labs: the owner's own current app data, read just before sending, so the assistant can see it
 *  and name exact records. Each part that fails to load is marked unavailable, never guessed. */
async function currentAppState(){
  const now=Date.now(),day=(offset:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date(now+offset*864e5));
  type Row=Record<string,unknown>;
  const [plan,meals,workouts,purchases,settings]=await Promise.allSettled([
    libraryRequest<{plan:{meal_plan?:unknown;workout_template?:unknown}}>({action:'coach_plan_get'}),
    libraryRequest<{meals?:Row[]}>({action:'food_list',limit:12}),
    libraryRequest<{entries?:Row[]}>({action:'exercise_list',start:new Date(now-7*864e5).toISOString(),end:new Date(now+6e5).toISOString(),limit:100}),
    libraryRequest<{links?:Row[]}>({action:'reconcile_list',start:day(-14),end:day(0)}),
    libraryRequest<{settings?:Row}>({action:'food_settings_get'})]);
  const gone='(could not be read just now)';
  const rawMeals=meals.status==='fulfilled'?meals.value.meals||[]:[];
  const rawMealPlan=plan.status==='fulfilled'?plan.value.plan?.meal_plan??null:null;
  const groceryText=rawMealPlan&&typeof rawMealPlan==='object'&&!Array.isArray(rawMealPlan)&&typeof (rawMealPlan as Row).groceries==='string'?(rawMealPlan as Row).groceries as string:'';
  const kitchen=summarizeGroceryAndPantry(groceryText,rawMeals as {description?:string;consumedAt?:string|null;createdAt?:string}[]);
  const hasKitchen=kitchen.activeShoppingList.totalCount>0||kitchen.activeShoppingList.notes.length>0||kitchen.pantry.stocked.length>0||kitchen.pantry.runningLow.length>0;
  const mealPlanValue=plan.status==='fulfilled'
    ?(rawMealPlan&&typeof rawMealPlan==='object'&&!Array.isArray(rawMealPlan)
      ?(hasKitchen?{...(rawMealPlan as Row),activeShoppingList:kitchen.activeShoppingList,pantry:kitchen.pantry}:rawMealPlan)
      :(hasKitchen?{activeShoppingList:kitchen.activeShoppingList,pantry:kitchen.pantry}:rawMealPlan))
    :(hasKitchen?{planStatus:gone,pantry:kitchen.pantry}:gone);
  return{nutritionSettings:settings.status==='fulfilled'?{calorieTarget:settings.value.settings?.calorieTarget??null,since:settings.value.settings?.effectiveFrom??null}:gone,recentMeals:meals.status==='fulfilled'?compactMeals(rawMeals):gone,
    recentWorkouts:workouts.status==='fulfilled'?compactWorkouts(workouts.value.entries||[]):gone,
    purchases:purchases.status==='fulfilled'?compactPurchases(purchases.value.links||[]):gone,
    mealPlan:mealPlanValue,
    workoutPlan:plan.status==='fulfilled'?plan.value.plan?.workout_template??null:gone};
}
// Account app: tap to fill the message box (never sends on its own).
const STARTERS=['How am I doing this week?','What should I eat for dinner?','Help me plan tomorrow'];
export const QuickChat:React.FC<{speak:boolean;mediaBusy:boolean;active?:boolean;locked?:boolean;assistantName?:string;onMode?:(mode:AssistantMode)=>void;speakEnabled?:boolean;onSpeakChange?:(next:boolean)=>void}>=({speak,mediaBusy,active=true,locked=false,assistantName='Cupcake',onMode,speakEnabled,onSpeakChange})=>{
  const composerRef=useRef<HTMLTextAreaElement>(null);
  const canReport=useLab('reply-reports')&&ACCOUNT_SESSIONS&&active;
  const suggest=useLab('assistant-actions')&&ACCOUNT_SESSIONS;
  const [threads,setThreads]=useState<{id:string;title:string}[]>([]),[thread,setThread]=useState<Thread|null>(null);
  const [input,setInput]=useState(()=>readChatStorage(draftKey)||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState(false);
  const [unsaved,setUnsaved]=useState(receivedAnswers),[retryable,setRetryable]=useState<Retryable|null>(null),[sending,setSending]=useState(false);
  const [uncertainSettled,setUncertainSettled]=useState<string>('');
  const newThreadId=useRef(readChatStorage(newThreadKey)||crypto.randomUUID());
  const mounted=useRef(true),recognition=useRef<Recognition|null>(null),audioAllowed=useRef(false),listed=useRef(false);
  const inFlight=useRef(false),loadGen=useRef(0),threadRef=useRef<Thread|null>(null);
  threadRef.current=thread;
  const bootId=useRef<string|null|undefined>(undefined);
  const selectedThreadId=thread?.id;
  const speakOn=speakEnabled??speak;
  audioAllowed.current=active&&speak&&!mediaBusy;
  useEffect(()=>{if(active&&selectedThreadId)updateThreadUrl(selectedThreadId)},[active,selectedThreadId]);
  useEffect(()=>{if(!writeChatStorage(draftKey,input)){setError('Browser storage is unavailable. Keep this page open to retain your draft.');setRetryable(null)}},[input]);
  useEffect(()=>{const update=()=>setUnsaved(receivedAnswers());window.addEventListener(recoveryEvent,update);return()=>window.removeEventListener(recoveryEvent,update)},[]);
  useEffect(()=>{if(!active||mediaBusy){recognition.current?.stop();window.speechSynthesis?.cancel()}},[active,mediaBusy]);
  const refresh=async()=>{const d=await libraryRequest<{threads:{id:string;title:string}[]}>({action:'quick_chat_list'});if(mounted.current)setThreads(d.threads)};
  const selectThread=useCallback((value:Thread)=>{setThread(value);writeChatStorage(selectedKey,value.id);const pending=pendingBegin(value.id);if(pending&&value.turns.some(t=>t.id===pending.turnId))forgetBegin(value.id)},[]);
  const open=async(id:string)=>{
    const gen=++loadGen.current;
    setBusy(true);setError('');setRetryable(null);
    try{const d=await libraryRequest<Result>({action:'quick_chat_get',threadId:id});if(mounted.current&&gen===loadGen.current)selectThread(d.thread)}catch(e){if(mounted.current&&gen===loadGen.current){setError(String(e));setRetryable({kind:'load',id})}}finally{if(mounted.current&&gen===loadGen.current)setBusy(false)}
  };
  useEffect(()=>{
    mounted.current=true;
    if(bootId.current===undefined)bootId.current=new URLSearchParams(location.search).get('thread')||readChatStorage(selectedKey);
    return()=>{mounted.current=false;recognition.current?.stop();window.speechSynthesis?.cancel()};
  },[]);
  useEffect(()=>{
    if(listed.current)return;
    const id=bootId.current||null;
    const queued=!!thread?.turns.some(t=>t.status==='queued'||t.status==='running');
    // Hidden and idle: do not start quick_chat_list. A queued reply or unsaved answer still loads.
    if(!active&&unsaved.length===0&&!queued&&!(id&&pendingBegin(id)))return;
    listed.current=true;
    refresh().catch(e=>{if(mounted.current){setError(String(e));setRetryable({kind:'list'})}});
    if(id)void open(id);
    // The saved selection is read only on mount; changing it must not reopen stale state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[active,unsaved,thread]);
  const save=async(answer:ReceivedAnswer)=>{
    const d=await libraryRequest<Result>({action:'quick_chat_complete',...answer});
    forgetAnswer(answer);forgetBegin(answer.threadId);
    if(mounted.current){selectThread(d.thread);setUnsaved(receivedAnswers());await refresh().catch(()=>{setError('Your answer is saved. The conversation list could not refresh.');setRetryable({kind:'list'})})}
  };
  const send=async(regenerate?:Turn)=>{
    if(locked||busy||inFlight.current||unsaved.length)return;
    const typed=regenerate?.text||input.trim();if(!typed)return;
    if(suggest&&!regenerate&&typed.length>MAX_WRAPPED_INPUT){setError(`With assistant suggestions on, keep a message under ${MAX_WRAPPED_INPUT} characters.`);setRetryable(null);return}
    inFlight.current=true;
    setBusy(true);setSending(true);setError('');setRetryable(null);setUncertainSettled('');recognition.current?.stop();
    const gen=++loadGen.current;
    let current=thread;
    try{
      if(!current){
        const createId=newThreadId.current;
        writeChatStorage(newThreadKey,createId);
        const d=await libraryRequest<Result>({action:'quick_chat_create',threadId:createId,title:typed.slice(0,120)});
        current=d.thread;
        newThreadId.current=crypto.randomUUID();
        writeChatStorage(newThreadKey,null);
        if(mounted.current&&gen===loadGen.current)selectThread(current);
      }
      let prior=pendingBegin(current.id);
      // If a previous send attempt failed before confirmation and the user changed their text,
      // check the server thread first so stale local recovery never blocks a fresh message.
      if(!regenerate&&prior&&shownMessage(prior.text)!==typed){
        try{
          const latest=await libraryRequest<Result>({action:'quick_chat_get',threadId:current.id});
          current=latest.thread;
          if(mounted.current&&gen===loadGen.current)selectThread(current);
          if(current.turns.some(t=>t.id===prior!.turnId)){
            forgetBegin(current.id);prior=null;
            if(current.turns.some(t=>!t.response&&t.status!=='completed'))return;
          }else{forgetBegin(current.id);prior=null;}
        }catch{
          throw Error('A previous message may already be saved. Reopen this conversation before changing or sending it.');
        }
      }
      // Labs: add the suggestion format and current plans. A pending identical message is reused as sent.
      let text=typed;
      if(!regenerate&&prior&&shownMessage(prior.text)===typed)text=prior.text;
      else if(!regenerate&&suggest&&!typed.startsWith(ACTIONS_MARK))text=wrapMessage(typed,await currentAppState());
      const turnId=regenerate?.id||prior?.turnId||crypto.randomUUID();
      const begin={threadId:current.id,turnId,text,parentTurnId:current.turns[current.turns.length-1]?.id||null,...(regenerate?{requestId:prior?.requestId||crypto.randomUUID()}:{})};
      rememberBegin(begin);
      const begun=await libraryRequest<Result>({action:'quick_chat_begin',...begin,...(regenerate?{regenerate:true}:{})});
      forgetBegin(current.id);
      if(mounted.current&&gen===loadGen.current)selectThread(begun.thread);
      if(!regenerate)setInput(value=>value.trim()===typed?'':value);
      if(!begun.acquired&&begun.execution!=='server'&&mounted.current)setError('Your saved request was reopened. No duplicate AI job was started.');
      try{await refresh()}catch(e){if(mounted.current){setError(String(e));setRetryable({kind:'list'})}}
    }catch(e){
      if(mounted.current){
        const msg=String(e);
        if(current&&/not available for account sign-in/i.test(msg))forgetBegin(current.id);
        setError(msg);setRetryable(null);
      }
    }finally{inFlight.current=false;if(mounted.current){setBusy(false);setSending(false)}}
  };
  const pollActiveTurn=!!thread?.turns.some(t=>!t.response&&(t.status==='queued'||t.status==='running'||t.retryAfter>0));
  const uncertainTurnId=thread?.turns.find(t=>!t.response&&t.status==='uncertain'&&!t.error)?.id||'';
  const pollUncertain=!!uncertainTurnId&&uncertainSettled!==`${thread?.id}:${uncertainTurnId}`;
  const shouldPoll=active&&!!thread&&(pollActiveTurn||pollUncertain);
  useEffect(()=>{
    if(!shouldPoll||!thread?.id)return;
    const targetId=thread.id;
    const gen=loadGen.current;
    let cancelled=false,delay=2000,uncertainChecks=0;
    let timer=0;
    const poll=async()=>{
      try{
        const d=await libraryRequest<Result>({action:'quick_chat_get',threadId:targetId});
        if(cancelled||!mounted.current||gen!==loadGen.current)return;
        const prev=threadRef.current;
        const old=prev?.turns[prev.turns.length-1],latest=d.thread.turns[d.thread.turns.length-1];
        selectThread(d.thread);
        setRetryable(current=>current?.kind==='status'?null:current);
        setError(current=>current==='Status could not refresh. Your server request continues; reopen this conversation later.'?'':current);
        if(old&&!old.response&&latest?.response&&audioAllowed.current)speakText(replyText(latest.response.reply));
        const stillActive=d.thread.turns.some(t=>!t.response&&(t.status==='queued'||t.status==='running'||t.retryAfter>0));
        const stillUncertain=d.thread.turns.find(t=>!t.response&&t.status==='uncertain'&&!t.error);
        if(stillActive){delay=Math.min(Math.round(delay*1.35),5000);}
        else if(stillUncertain){
          uncertainChecks+=1;
          if(uncertainChecks>=4){setUncertainSettled(`${targetId}:${stillUncertain.id}`);return;}
          delay=Math.min(Math.round(delay*1.6),8000);
        }else{return;}
      }catch{
        if(cancelled)return;
        delay=Math.min(delay*2,30000);
        setError('Status could not refresh. Your server request continues; reopen this conversation later.');
        setRetryable({kind:'status',id:targetId});
      }
      if(!cancelled)timer=window.setTimeout(poll,delay);
    };
    timer=window.setTimeout(poll,delay);
    return()=>{cancelled=true;window.clearTimeout(timer)};
  },[shouldPoll,thread?.id,uncertainTurnId,selectThread]);
  const dictate=()=>{
    if(listening){recognition.current?.stop();return}
    const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
    const SR=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!SR){setError('Voice typing is unavailable in this browser. Your phone keyboard may offer dictation.');setRetryable(null);return}
    const rec=new SR();rec.lang='en-US';rec.onresult=e=>setInput(v=>(v+(v?' ':'')+e.results[0][0].transcript).slice(0,8000));rec.onerror=()=>{setListening(false);setError('Voice typing could not start. Check microphone access.');setRetryable(null)};rec.onend=()=>setListening(false);recognition.current=rec;
    try{rec.start();setListening(true)}catch{setError('Voice typing could not start. Check microphone access.');setRetryable(null)}
  };
  const toggleSpeak=()=>{
    if(!onSpeakChange)return;
    const next=!speakOn;
    if(!next)window.speechSynthesis?.cancel();
    onSpeakChange(next);
  };
  const startNew=()=>{loadGen.current++;setThread(null);newThreadId.current=crypto.randomUUID();writeChatStorage(newThreadKey,newThreadId.current);writeChatStorage(selectedKey,null);if(active)updateThreadUrl(null);setError('');setRetryable(null);setUncertainSettled('')};
  const retryLast=()=>{
    if(!retryable||busy)return;
    if(retryable.kind==='list'){
      setBusy(true);setError('');setRetryable(null);
      refresh().then(()=>{if(mounted.current)setBusy(false)}).catch(e=>{if(mounted.current){setError(String(e));setRetryable({kind:'list'});setBusy(false)}});
      return;
    }
    void open(retryable.id);
  };
  // Account composer grows with its text up to a few lines, like a messaging app.
  useLayoutEffect(()=>{const el=composerRef.current;if(!ACCOUNT_SESSIONS||!el)return;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,148)}px`},[input]);
  const last=thread?.turns[thread.turns.length-1];
  const options=thread&&!threads.some(t=>t.id===thread.id)?[thread,...threads]:threads;
  const showSending=sending&&!thread?.turns.some(t=>!t.response);
  const canSend=!(locked||busy||!!unsaved.length||!input.trim()||!!(last&&last.status!=='completed'));
  return <section className="cc-chat space-y-4">
    <div className="cc-chat-threads flex gap-2"><select aria-label="Saved conversations" className="cc-chat-saved min-w-0 flex-1 rounded-xl bg-slate-900 p-3" disabled={busy||!!unsaved.length} value={thread?.id||''} onChange={e=>e.target.value?void open(e.target.value):startNew()}><option value="">New conversation</option>{options.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><button disabled={busy||!!unsaved.length} onClick={startNew} className="cc-chat-new rounded-xl bg-white/10 px-3">{ACCOUNT_SESSIONS&&<Plus size={15} aria-hidden="true"/>}New</button>{thread&&<button disabled={busy} onClick={()=>void open(thread.id)} className="cc-chat-refresh rounded-xl bg-white/10 px-3" aria-label={ACCOUNT_SESSIONS?'Refresh':undefined} title={ACCOUNT_SESSIONS?'Refresh':undefined}>{ACCOUNT_SESSIONS?<RotateCw size={16} aria-hidden="true"/>:'Refresh'}</button>}{ACCOUNT_SESSIONS&&<details className="cc-chat-about"><summary aria-label="About conversation privacy"><Info size={17} aria-hidden="true"/></summary><p>Private. Saved across your devices and searchable in your Library, which also keeps deeper research and original recordings. AI replies are interpretations, not verified facts.</p></details>}</div>
    {!ACCOUNT_SESSIONS&&<p className="text-xs text-white/50">Private conversation history is saved across your devices and searchable in your library. AI replies are interpretations, not verified facts.</p>}
    {thread?.turns.map(t=>{
      const checkingUncertain=!t.response&&t.status==='uncertain'&&!t.error&&uncertainSettled!==`${thread.id}:${t.id}`;
      const inProgress=!t.response&&(t.status==='queued'||t.status==='running'||t.retryAfter>0||checkingUncertain||(sending&&t.id===last?.id));
      const allowanceNotice=['failed','uncertain'].includes(t.status)?allowanceErrors[t.error||'']:undefined;
      const detail=t.status==='queued'||t.status==='running'?'Your reply is being prepared on the server. You can close this page.':sending&&t.id===last?.id?'Working on your reply…':checkingUncertain?'Checking for your reply…':allowanceNotice||(t.status==='failed'?(t.error==='request_budget_exceeded'?'This conversation is too large for the pilot reply limit. Your message is saved. Start a shorter conversation.':'The reply service rejected this attempt. Your message is saved.'):t.retryAfter>0?'Waiting for this reply. Check status shortly.':'This reply did not finish confirming. Your message is saved—check status or try again.');
      return <div key={t.id} className="space-y-2"><p className="cc-chat-user ml-8 rounded-2xl bg-pink-700 p-4 whitespace-pre-wrap break-words"><span className="cc-chat-who block text-xs opacity-60">You · original message</span>{shownMessage(t.text)}</p>{t.response?<Answer response={t.response} seed={t.id} suggest={suggest} report={canReport&&t.status==='completed'?{kind:'quick_chat',threadId:thread.id,turnId:t.id}:undefined}/>:<div className={inProgress?'cc-chat-progress':'text-sm text-amber-200'} role={inProgress?'status':undefined}>{inProgress&&<span className="cc-chat-progress-label">Answer in progress</span>}<span className="text-sm text-amber-200">{detail}</span>{!busy&&<button className="underline ml-2" onClick={()=>void open(thread.id)}>Check status</button>}{!busy&&!unsaved.length&&t.retryAfter===0&&!['queued','running'].includes(t.status)&&!checkingUncertain&&<><button className="underline ml-2" onClick={()=>void send(t)}>Request another answer (may repeat the AI request)</button><button type="button" className="underline ml-2" onClick={startNew}>New chat</button></>}</div>}{t.alternatives?.map(a=><details key={a.attemptId}><summary className="text-sm text-amber-200 cursor-pointer">Another received AI answer</summary><Answer response={a.response} seed={t.id} suggest={suggest} report={canReport?{kind:'quick_chat',threadId:thread.id,turnId:t.id,attemptId:a.attemptId}:undefined}/></details>)}</div>;
    })}
    {ACCOUNT_SESSIONS&&!thread&&!unsaved.length&&!locked&&<div className="nx-chat-empty"><strong>{assistantName==='Cupcake'?'Well? Out with it.':'What would you like to look at?'}</strong><span>{assistantName==='Cupcake'?'Your day, your numbers, what to eat next. I have opinions on all of it.':'Your day, your numbers, or what to eat next.'}</span></div>}
    {ACCOUNT_SESSIONS&&!thread&&!input.trim()&&!unsaved.length&&!locked&&<div className="cc-chat-starters" role="group" aria-label="Conversation starters">{STARTERS.map(text=><button type="button" key={text} onClick={()=>{setInput(text);composerRef.current?.focus();}}>{text}</button>)}</div>}
    {showSending&&<p className="cc-chat-progress" role="status"><span className="cc-chat-progress-label">Answer in progress</span></p>}
    {unsaved.map(answer=><div key={answer.attemptId} className="rounded-xl border border-amber-400 p-4"><p className="whitespace-pre-wrap break-words">{replyText(answer.response.reply)}</p><p className="text-xs">Received answer awaiting save. It remains an AI interpretation.</p><button disabled={busy} onClick={async()=>{setBusy(true);setError('');setRetryable(null);try{await save(answer)}catch(e){setError(String(e));setRetryable(null)}finally{setBusy(false)}}} className="underline">Save answer again</button></div>)}
    {error&&<p role="alert" className="text-sm text-amber-200 break-words">{visibleError(error)}{retryable&&<button type="button" className="underline ml-2" disabled={busy} onClick={retryLast}>Retry</button>}</p>}
    {locked&&<p role="status" className="cc-chat-locked">Typing is paused while audio or recording work is active. Open its controls to finish, then send your message.</p>}{ACCOUNT_SESSIONS?<div className={`cc-chat-composer cc-chat-pill${canSend?' is-ready':''}${listening?' is-listening':''}`}><textarea ref={composerRef} aria-label={`Message ${assistantName}`} disabled={locked} value={input} maxLength={8000} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&window.matchMedia('(hover: hover)').matches&&canSend){e.preventDefault();void send();}}} placeholder={`Message ${assistantName}`} rows={1}/><div className="cc-chat-pill-bar"><div className="cc-chat-pill-tools"><button type="button" className="cc-chat-tool cc-chat-mic" aria-label={listening?'Stop dictation':'Dictate'} title={listening?'Stop dictation':'Dictate'} disabled={locked||busy||mediaBusy} onClick={dictate}>{listening?<Square size={14} fill="currentColor" aria-hidden="true"/>:<Mic size={18} aria-hidden="true"/>}</button>{onMode&&<><button type="button" className="cc-chat-tool" aria-label="Live voice" title="Live voice" disabled={locked||mediaBusy} onClick={()=>onMode('voice')}><Headphones size={18} aria-hidden="true"/></button><button type="button" className="cc-chat-tool" aria-label="Record" title="Record" disabled={locked||mediaBusy} onClick={()=>onMode('record')}><Disc size={18} aria-hidden="true"/></button></>}{onSpeakChange&&<button type="button" role="switch" aria-checked={speakOn} className={`cc-chat-tool cc-chat-speak${speakOn?' is-on':''}`} aria-label="Read replies aloud" title={speakOn?'Read replies aloud: on':'Read replies aloud: off'} onClick={toggleSpeak}>{speakOn?<Volume2 size={18} aria-hidden="true"/>:<VolumeX size={18} aria-hidden="true"/>}</button>}</div><button type="button" className="cc-chat-send" aria-label="Send" title="Send" disabled={!canSend} onClick={()=>void send()}><ArrowUp size={18} strokeWidth={2.4} aria-hidden="true"/></button></div></div>
    :<div className="cc-chat-composer flex gap-2"><textarea ref={composerRef} aria-label={`Message ${assistantName}`} disabled={locked} value={input} maxLength={8000} onChange={e=>setInput(e.target.value)} placeholder={`Talk to ${assistantName}…`} className="min-w-0 flex-1 rounded-xl bg-white/10 p-3" rows={3}/><div className="flex flex-col gap-2"><button className="rounded-xl bg-pink-600 p-3 disabled:opacity-40" disabled={!canSend} onClick={()=>void send()}>Send</button><button className="rounded-xl bg-white/10 p-2 disabled:opacity-40" disabled={locked||busy||mediaBusy} onClick={dictate}>{listening?'Stop dictation':'Dictate'}</button></div></div>}
  </section>;
};
