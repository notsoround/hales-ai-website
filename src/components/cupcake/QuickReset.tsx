import {useEffect,useRef,useState} from 'react';
import {libraryRequest} from './library';
import {ReadAloudButton} from './ReadAloudButton';
import {pendingReset,savePendingReset,clearPendingReset,readChatStorage,writeChatStorage,resetDraftKey,selectedResetKey,type PendingReset} from './quickResetRecovery';
type Session={id:string;request:{mode:string;message:string};status:string;response?:{reply:string;model:string;sources?:{title?:string;url?:string}[];recordsUnavailable?:boolean};createdAt:number;outcome:string;note:string;error?:string};
const outcomeLabel=(value:string)=>value==='win'?'You did it':value==='loss'?"You didn't":'Not scored';
function planLine(session:Session){
  const note=session.note.trim();
  if(note)return note.slice(0,4000);
  const reply=session.response?.reply?.trim()||'';
  const line=reply.split('\n').map(item=>item.trim()).find(Boolean)||session.request.message;
  return line.slice(0,4000);
}
export function QuickReset({onBack,onMode,mode='reset'}:{onBack:()=>void;onMode?:(mode:'tip'|'reset')=>void;mode?:'tip'|'reset'}){
 const [sessions,setSessions]=useState<Session[]>([]),[current,setCurrent]=useState<Session|null>(null),[message,setMessage]=useState(()=>readChatStorage(resetDraftKey(mode))||''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[savedDecision,setSavedDecision]=useState(false),[decisionText,setDecisionText]=useState('');
 const pending=useRef<PendingReset|null>(null);const sending=useRef(false);const [recovery,setRecovery]=useState<PendingReset|null>(null),[checking,setChecking]=useState(true);
 useEffect(()=>{if(!writeChatStorage(resetDraftKey(mode),message))setError('Your draft cannot be saved in this browser. Keep this page open.')},[message,mode]);
 const load=async()=>{const d=await libraryRequest<{sessions:Session[]}>({action:'reset_list'});setSessions(d.sessions)};
 const acknowledge=(session:Session)=>{setCurrent(session);setNote(session.note||'');setSavedDecision(false);setDecisionText(planLine(session));writeChatStorage(selectedResetKey,session.id);if(pending.current?.id===session.id){clearPendingReset(session.id);pending.current=null;setRecovery(null);}};
 useEffect(()=>{let cancelled=false;void(async()=>{try{const saved=pendingReset();pending.current=saved;if(saved){setRecovery(saved);setMessage(saved.message);}const d=await libraryRequest<{sessions:Session[]}>({action:'reset_list'});if(cancelled)return;setSessions(d.sessions);const id=saved?.id||readChatStorage(selectedResetKey);if(id){const found=d.sessions.find(s=>s.id===id);if(found)acknowledge(found);else{const detail=await libraryRequest<{session:Session}>({action:'reset_get',id});if(!cancelled)acknowledge(detail.session);}}}catch(e){if(!cancelled)setError(`Saved request status could not be confirmed. No new AI request was sent. ${e instanceof Error?e.message:''}`);}finally{if(!cancelled)setChecking(false);}})();return()=>{cancelled=true;};},[]);

 useEffect(()=>{if(!current||!['queued','running'].includes(current.status))return;let cancelled=false;const timer=setInterval(()=>{void libraryRequest<{session:Session}>({action:'reset_get',id:current.id}).then(d=>{if(!cancelled)setCurrent(d.session)}).catch(()=>{if(!cancelled)setError('Your plan continues on the server. Reopen it to check.')} )},4000);return()=>{cancelled=true;clearInterval(timer)}},[current]);
 const start=async(retry=false)=>{if(busy||sending.current||checking)return;if(recovery&&!retry){setError('Recover the saved request before starting another.');return;}const text=message.trim()||(mode==='tip'?'Give me one practical next move for this time of day, based on my current records.':'Help me interrupt the spiral and pick one achievable move for the next ten minutes.');sending.current=true;setBusy(true);setError('');try{const stored=pendingReset();if(stored)pending.current=stored;if(!pending.current)pending.current={id:crypto.randomUUID(),message:text,mode};savePendingReset(pending.current);setRecovery(pending.current);const d=await libraryRequest<{session:Session}>({action:'reset_start',...pending.current});acknowledge(d.session);await load();}catch(e){setError(e instanceof Error?e.message:'Could not confirm the saved request.');}finally{sending.current=false;setBusy(false);}};
 const checkSaved=async()=>{if(!recovery||busy)return;setBusy(true);setError('');try{const d=await libraryRequest<{session:Session}>({action:'reset_get',id:recovery.id});acknowledge(d.session);}catch{setError('Still unable to confirm this request. Retry the same saved request when ready; do not create a replacement.');}finally{setBusy(false);}};

 const outcome=async(value:string)=>{if(!current||busy)return;setBusy(true);setError('');try{const d=await libraryRequest<{session:Session}>({action:'reset_outcome',id:current.id,outcome:value,note});setCurrent(d.session);setDecisionText(planLine(d.session));setSavedDecision(false);await load()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const saveDecision=async()=>{if(!current||busy||!decisionText.trim()||!['win','loss'].includes(current.outcome))return;setBusy(true);setError('');try{await libraryRequest({action:'decision_save',text:decisionText.trim(),type:'decision',status:current.outcome==='win'?'done':'open',sourceIds:[]});setSavedDecision(true);}catch(e){setError(e instanceof Error?e.message:'The decision could not be saved. This plan score is unchanged.');}finally{setBusy(false);}};
 const scored = current && ['win', 'loss'].includes(current.outcome);
 return <section className="space-y-5 pb-6">
  <button onClick={onBack} className="rounded-xl border border-white/20 px-4 py-3">← Today</button>
  <div>
   <p className="text-xs uppercase tracking-[.2em] text-pink-300">Cupcake in your corner</p>
   <h2 className="mt-2 text-3xl font-bold">{mode === 'tip' ? 'One good next move.' : 'Take back the next ten minutes.'}</h2>
   <p className="mt-3 text-white/65">{mode === 'tip' ? 'A short plan using your recent records and the time of day. Tell me what’s happening, or let me start.' : 'One interrupt for the next ten minutes. It does not call anyone, and it does not change your scores until you say how it went.'}</p>
  </div>
  {onMode && <button type="button" className="cc-text-button" onClick={() => onMode(mode === 'tip' ? 'reset' : 'tip')}>{mode === 'tip' ? 'I need a 10-minute reset instead' : 'Back to a quick tip'}</button>}
  <textarea aria-label="What is happening right now?" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={3} placeholder="What’s pulling you off track? What do you need right now?" className="w-full rounded-2xl bg-white/10 p-4" />
  <button onClick={() => void start()} disabled={busy || checking || !!recovery || !!current && ['queued', 'running'].includes(current.status)} className="rounded-xl bg-pink-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40">{busy ? 'Saving…' : mode === 'tip' ? 'Give me a Quick Tip' : 'Give me a Quick Reset'}</button>
  {recovery && <div className="rounded-xl border border-amber-300/40 p-4"><p>Your {recovery.mode === 'tip' ? 'tip' : 'reset'} request is saved on this device. Closing this page will not change its request ID.</p><div className="mt-3 flex flex-wrap gap-2"><button className="rounded-xl border px-4 py-3" disabled={busy || checking} onClick={() => void checkSaved()}>Check saved request</button><button className="rounded-xl border px-4 py-3" disabled={busy || checking} onClick={() => void start(true)}>Retry same saved request</button></div><p className="mt-2 text-xs">Checking is read-only. Retrying uses the same ID and will not restart an already saved job.</p></div>}
  {error && <p role="alert" className="text-amber-200">{error}</p>}
  {current && <article className="space-y-4 rounded-3xl border border-pink-300/25 bg-pink-300/5 p-5">
   <p className="text-xs text-white/50">{new Date(current.createdAt * 1000).toLocaleString()} · {outcomeLabel(current.outcome)}</p>
   {current.response ? <>
    <ReadAloudButton text={current.response.reply} label={mode === 'tip' ? 'Play this tip' : 'Play this reset'} />
    <p className="whitespace-pre-wrap leading-relaxed">{current.response.reply}</p>
    <p className="text-xs text-white/50">{current.response.model} · AI coaching, based on the sources available for this request.</p>
    {current.response.recordsUnavailable && <p className="text-amber-200 text-sm">Some current records were unavailable. This plan may be less specific.</p>}
    {current.response.sources?.map((s, i) => <p className="text-xs text-pink-200" key={i}>{s.url?.startsWith('https://') ? <a href={s.url} target="_blank" rel="noreferrer">{s.title || 'Source'}</a> : s.title}</p>)}
    <label className="block text-sm">How did it go?<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={2} className="mt-2 w-full rounded-xl bg-white/10 p-3" placeholder="Optional outcome note" /></label>
    <div className="flex flex-wrap gap-2">{[['win', 'I did it'], ['loss', 'I didn’t'], ['unscored', 'Leave unscored']].map(([value, label]) => <button key={value} disabled={busy} onClick={() => void outcome(value)} className={`rounded-xl border px-4 py-3 ${current.outcome === value ? 'border-pink-200 bg-pink-300/15' : 'border-white/20'}`}>{label}</button>)}</div>
    <p className="text-xs text-white/50">Only your response scores this plan. Silence stays unscored. Phone intervention scores and personal wins stay separate.</p>
    {current.outcome !== 'unscored' && <p role="status" className="text-sm text-white/80">Saved on this plan and filed in your library. Cupcake can see it when you ask across your library. It does not check off a to-do or change your other scores.</p>}
    {scored && <div className="cc-decision-form">
     <label className="cc-label">{current.outcome === 'win' ? 'Save the move you finished' : 'Keep the move on your decision list'}<textarea value={decisionText} onChange={e => setDecisionText(e.target.value)} maxLength={4000} rows={3} /></label>
     <p className="cc-muted cc-small">{current.outcome === 'win' ? 'Saving marks this decision done in Review your day.' : 'Saving leaves this decision open in Review your day.'} Edit the words first. The tip itself stays an AI suggestion.</p>
     {savedDecision ? <p role="status">Saved on your decision list. Open Library, then Review your day, to see it.</p> : <button type="button" className="cc-primary" disabled={busy || !decisionText.trim()} onClick={() => void saveDecision()}>{current.outcome === 'win' ? 'Save as done' : 'Save as still open'}</button>}
    </div>}
   </> : <p aria-live="polite">{['queued', 'running'].includes(current.status) ? 'Cupcake is checking your context and building a short plan. You can leave and come back.' : current.error || 'This attempt could not be confirmed.'}</p>}
  </article>}
  {!!sessions.length && <details><summary className="cursor-pointer py-3">Your saved plans ({sessions.length})</summary><div className="space-y-2">{sessions.map(s => <button key={s.id} onClick={() => { try { acknowledge(s); } catch (e) { setError(String(e)); } }} className="block w-full rounded-xl bg-white/5 p-3 text-left"><span className="block text-sm">{s.request.message.slice(0, 100)}</span><span className="text-xs text-white/50">{new Date(s.createdAt * 1000).toLocaleDateString()} · {s.status} · {outcomeLabel(s.outcome)}</span></button>)}</div></details>}
 </section>;
}
