import { useCallback, useEffect, useRef, useState } from 'react';
import Daily, { type DailyCall } from '@daily-co/daily-js';
import { Mic, Square, Upload, Headphones, ArrowLeft, Download, Send, RefreshCw, Monitor, LockKeyhole } from 'lucide-react';
import { drafts, putDraft, putChunk, draftBlob, deleteDraft, type Draft } from './storage';
import './studio.css';

const API = 'https://automate.hales.ai/webhook';
const headers = () => ({ 'X-Cupcake-Key': sessionStorage.getItem('cupcake-private-access') || '' });
type Recording = { id: string; title: string; createdAt: string; status: string; progress?: {completed:number;total:number}; phase?:string; transcript?: string; summary?: string; keyPoints?: string[]; commitments?: { text: string; owner?: string; dueDate?: string; evidence?: string }[]; chat?: { role: string; text?: string; content?: string }[] };
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}/${path}`, { ...init, headers: { ...headers(), ...init.headers }, signal: init.signal || AbortSignal.timeout(180000), cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Your private access expired. Lock and unlock Cupcake to reconnect.' : response.status === 413 ? 'This upload part is too large. Keep your original and try again.' : `Cupcake could not complete that request (${response.status}). Your local recording is still available.`);
  const data = await response.json(); if (data.ok === false) throw new Error(data.error || 'Please try again.'); return data;
}
const extension = (mime:string) => mime.includes('mp4')?'m4a':mime.includes('mpeg')?'mp3':mime.includes('wav')?'wav':mime.includes('ogg')?'ogg':'webm';
const clock = (s: number) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }

export default function CupcakeStudio({ mode, onBusy }: { mode: 'talk' | 'record' | 'library'; onBusy: (busy: boolean) => void }) {
  const [error, setError] = useState(''); const [voice, setVoice] = useState<'idle'|'connecting'|'live'>('idle'); const [muted, setMuted] = useState(false);
  const [lines, setLines] = useState<{ role: string; text: string }[]>([]); const [speaking, setSpeaking] = useState(false);
  const call = useRef<DailyCall | null>(null); const remoteId=useRef<string|null>(null); const voiceGeneration = useRef(0); const players = useRef(new Map<string, HTMLAudioElement>());
  const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0); const [title, setTitle] = useState(''); const [local, setLocal] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false); const [records, setRecords] = useState<Recording[] | null>(null); const [selected, setSelected] = useState<Recording | null>(null); const [question, setQuestion] = useState('');
  const recorder = useRef<MediaRecorder | null>(null); const streams = useRef<MediaStream[]>([]); const context = useRef<AudioContext | null>(null); const started = useRef(0); const finishing = useRef(false); const mounted = useRef(true);
  const refreshDrafts = useCallback(() => drafts().then(setLocal).catch(() => setError('Device storage is unavailable. Check browser storage permissions before recording.')), []);
  const refreshLibrary = useCallback(async () => { try { const d = await request('cupcake-recordings'); setRecords(d.recordings || []); } catch(e) { setError((e as Error).message); } }, []);
  const cleanupTracks = useCallback(() => { streams.current.forEach(s => s.getTracks().forEach(t => t.stop())); streams.current = []; void context.current?.close(); context.current = null; }, []);
  const endRemote = useCallback(async(id:string) => {
    for(const delay of [0,1500,3500,8000]) {
      if(delay)await new Promise(r=>setTimeout(r,delay));
      try { const r=await fetch(`${API}/cupcake-voice-end`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({callId:id}),signal:AbortSignal.timeout(15000)});if(r.ok)return;if(r.status!==409&&r.status!==404)break; }catch{ /* The local microphone is already closed. */ }
    }
    if(mounted.current)setError('Voice disconnected locally. Server session cleanup could not be confirmed.');
  },[]);
  const endVoice = useCallback(async () => { voiceGeneration.current++; const c = call.current; call.current = null; const id=remoteId.current;remoteId.current=null; for (const p of players.current.values()) { p.pause(); p.srcObject = null; } players.current.clear(); if (c) { await c.leave().catch(() => {}); await c.destroy().catch(() => {}); } if (mounted.current) { setVoice('idle'); setSpeaking(false); } if(id)void endRemote(id); }, [endRemote]);
  useEffect(() => { mounted.current=true; void refreshDrafts(); return () => { mounted.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); cleanupTracks(); void endVoice(); }; }, [refreshDrafts, cleanupTracks, endVoice]);
  useEffect(() => { onBusy(recording || voice !== 'idle' || busy); }, [recording, voice, busy, onBusy]);
  useEffect(() => { if (mode === 'library') void refreshLibrary(); }, [mode, refreshLibrary]);
  useEffect(() => { if (!recording) return; const tick = setInterval(() => { const elapsed = (Date.now()-started.current)/1000; setSeconds(elapsed);  }, 250); const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => { clearInterval(tick); window.removeEventListener('beforeunload', warn); }; }, [recording]);
  useEffect(() => { if(!selected || ['ready','failed'].includes(selected.status))return;const id=selected.id;const timer=setInterval(()=>{void request(`cupcake-recording-detail?id=${encodeURIComponent(id)}`).then(d=>setSelected(d.recording)).catch(()=>{});},5000);return()=>clearInterval(timer);},[selected]);
  async function startVoice() {
    if (voice !== 'idle' || recording || busy) return; setError(''); setVoice('connecting'); setLines([]); const generation = ++voiceGeneration.current;
    try {
      const d = await request('cupcake-voice-session', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
      if (generation !== voiceGeneration.current || !mounted.current) {if(d.callId)void endRemote(d.callId);return;} remoteId.current=d.callId;
      const c = Daily.createCallObject({ audioSource: true, videoSource: false, startVideoOff: true }); call.current = c;
      c.on('track-started', e => { if (e?.track.kind !== 'audio' || e.participant?.local) return; const id = e.track.id; const audio = new Audio(); audio.autoplay = true; audio.srcObject = new MediaStream([e.track]); players.current.set(id, audio); void audio.play().catch(() => setError('Tap Resume audio to hear Cupcake.')); });
      c.on('track-stopped', e => { if (e?.track) { const p = players.current.get(e.track.id); if(p) { p.pause(); p.srcObject = null; players.current.delete(e.track.id); } } });
      c.on('app-message', e => { let d=e?.data; if(typeof d==='string'){try{d=JSON.parse(d);}catch{return;}} if (!d || typeof d !== 'object') return; if(d.type === 'speech-update') setSpeaking(d.status === 'started' && d.role === 'assistant'); if(d.type === 'transcript' && d.transcriptType === 'final' && typeof d.transcript === 'string') setLines(a => [...a.slice(-99), {role:d.role === 'assistant'?'Cupcake':'You', text:d.transcript}]); });
      c.on('left-meeting', () => { if(call.current === c) void endVoice(); }); c.on('error', () => { setError('The voice connection ended. You can reconnect.'); void endVoice(); });
      await c.join({url:d.webCallUrl}); if (generation !== voiceGeneration.current) { await c.destroy(); return; } setVoice('live'); setMuted(false);
    } catch(e) { setError((e as Error).message); await endVoice(); }
  }
  async function startRecording(meeting: boolean) {
    if(recording || voice !== 'idle' || busy) return; setError(''); finishing.current = false;
    try {
      if(!window.MediaRecorder || !navigator.mediaDevices) throw new Error('Recording needs a supported browser over HTTPS. You can still import an audio file.');
      const id = crypto.randomUUID(); const types = ['audio/webm;codecs=opus','audio/mp4','audio/webm']; const mime = types.find(t => MediaRecorder.isTypeSupported(t)); if(!mime) throw new Error('This browser cannot record a supported audio format. Please import a recording.');
      let input: MediaStream;
      if(meeting) {
        if(!navigator.mediaDevices.getDisplayMedia) throw new Error('Meeting-tab recording is unavailable here. Use a desktop browser or import audio.');
        const screen = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}); streams.current.push(screen);
        if(!screen.getAudioTracks().length) throw new Error('No meeting audio was shared. Select a browser tab and turn on Share tab audio.');
        const mic = await navigator.mediaDevices.getUserMedia({audio:true}); streams.current.push(mic);
        const ac = new AudioContext(); context.current = ac; const destination = ac.createMediaStreamDestination(); ac.createMediaStreamSource(new MediaStream(screen.getAudioTracks())).connect(destination); ac.createMediaStreamSource(mic).connect(destination); input = destination.stream; streams.current.push(input);
        screen.getVideoTracks().forEach(t => t.addEventListener('ended', () => { if(recorder.current?.state === 'recording') recorder.current.stop(); }));
      } else { input = await navigator.mediaDevices.getUserMedia({audio:true}); streams.current.push(input); }
      const draft: Draft = {id,title:title.trim() || (meeting?'Meeting':'Voice note'),startedAt:Date.now(),mime,complete:false}; await putDraft(draft);
      const r = new MediaRecorder(input,{mimeType:mime,audioBitsPerSecond:64000}); recorder.current=r; let index=0; let writes=Promise.resolve();
      r.ondataavailable = e => { if(!e.data.size) return; const n=index++; writes=writes.then(() => putChunk(id,n,e.data)); void writes.catch(() => {setError('Device storage is full. Recording stopped. Recover the saved portion below.'); if(r.state==='recording') r.stop();});  };
      r.onstop = () => { if(finishing.current)return; finishing.current=true; cleanupTracks(); setRecording(false); void writes.then(() => putDraft({...draft,complete:true})).then(refreshDrafts).catch(() => {setError('Some audio could not be saved. Check the recoverable draft.');void refreshDrafts();}); };
      r.onerror = () => { setError('Recording was interrupted. Recover the saved audio below.'); if(r.state !== 'inactive')r.stop(); else {cleanupTracks();setRecording(false);} };
      started.current=Date.now(); setSeconds(0); r.start(3000); setRecording(true);
    } catch(e) {cleanupTracks();setError((e as Error).message);}
  }
  async function importAudio(file?: File) { if(!file)return; if(file.size>1000000000){setError('This upload exceeds the current 1 GB storage limit. Keep the original and split it into files before importing.');return;} const d: Draft={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,''),startedAt:Date.now(),mime:file.type||'audio/mp4',complete:true,blob:file};try{await putDraft(d);await refreshDrafts();}catch{setError('Could not save the imported file on this device.');} }
  async function upload(draft: Draft) {
    if(busy || recording || voice!=='idle')return;setBusy(true);setError('');
    try {
      if(draft.recordingId){setSelected((await request(`cupcake-recording-detail?id=${encodeURIComponent(draft.recordingId)}`)).recording);return;}
      const blob=await draftBlob(draft);if(!blob.size)throw new Error('This draft contains no audio.');
      const started=await request('cupcake-recording-start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:draft.title,uploadId:draft.id,mimeType:blob.type,totalBytes:blob.size,filename:`recording.${extension(blob.type)}`})});
      const id=started.recording?.id||started.id; if(started.recording&&started.recording.status!=='uploading'){setSelected(started.recording);await putDraft({...draft,recordingId:id});await refreshDrafts();return;} if(!id)throw new Error('Upload could not be initialized.');
      const size=8*1024*1024,parts=Math.ceil(blob.size/size);
      for(let index=0;index<parts;index++){const f=new FormData();f.append('audio',blob.slice(index*size,Math.min(blob.size,(index+1)*size)),`part-${index}`);f.append('id',id);f.append('index',String(index));await request('cupcake-recording-part',{method:'POST',body:f});}
      const d=await request('cupcake-recording-finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,parts})});
      setSelected(d.recording);await refreshLibrary();
      await putDraft({...draft,complete:true,recordingId:id});await refreshDrafts();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function openRecord(id:string){setBusy(true);setError('');try{setSelected((await request(`cupcake-recording-detail?id=${encodeURIComponent(id)}`)).recording);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function retry(){if(!selected||busy)return;setBusy(true);try{setSelected((await request('cupcake-recording-retry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id})})).recording);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function ask(){if(!selected||selected.status!=='ready'||busy||!question.trim())return;setBusy(true);setError('');try{const d=await request('cupcake-recording-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,message:question})});setSelected(d.recording||{...selected,chat:[...(selected.chat||[]),{role:'user',text:question},{role:'assistant',text:d.reply}]});setQuestion('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="cc-studio">
    {error&&<div role="alert" className="cc-error">{error}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
    {(recording||voice!=='idle')&&<div className="cc-live-bar"><span className="cc-dot"/>{recording?`Recording · ${clock(seconds)}`:voice==='connecting'?'Connecting to Cupcake…':'Voice conversation active'}<button onClick={()=>recording?recorder.current?.stop():void endVoice()}>Stop</button></div>}
    <div hidden={mode!=='talk'}>
      <div className={`cc-portrait ${speaking?'is-speaking':''}`}><img src="/cupcake-avatar.jpg" alt="Cupcake"/><span className="cc-portrait-shade"/><div><span className="cc-eyebrow">YOUR PRIVATE COMPANION</span><h2>I'm listening,<br/>Matt.</h2><p>A real conversation. A little attitude.</p></div></div>
      <div className="cc-action-row"><button className="cc-primary" onClick={()=>voice==='idle'?void startVoice():void endVoice()} disabled={recording||busy}>{voice==='idle'?<Headphones size={20}/>:<Square size={18}/>} {voice==='idle'?'Talk to Cupcake':voice==='connecting'?'Cancel connection':'End conversation'}</button>{voice==='live'&&<button className="cc-secondary" onClick={()=>{call.current?.setLocalAudio(muted);setMuted(!muted);}}>{muted?'Unmute':'Mute'}</button>}</div>
      <p className="cc-muted">Private voice session · microphone on only after you start · live back-and-forth voice. She has a recent context snapshot; this conversation cannot take actions.</p>
      {voice==='live'&&<button className="cc-text-button" onClick={()=>players.current.forEach(p=>void p.play().catch(()=>{}))}>Resume audio</button>}
      <div className="cc-transcript" aria-live="polite">{lines.map((l,i)=><p key={i}><strong>{l.role}</strong>{l.text}</p>)}</div>
    </div>
    <div hidden={mode!=='record'}>
      <span className="cc-eyebrow">RECORD & REMEMBER</span><h2>Catch the conversation.<br/><em>Keep what matters.</em></h2>
      <p className="cc-muted">Record a voice note or conversation, or import a Samsung recording. Cupcake turns it into a transcript, summary, and commitments you can review.</p>
      <label className="cc-label">Recording title<input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="A thought, a meeting, a promise…" disabled={recording}/></label>
      <div className={`cc-recorder ${recording?'is-recording':''}`}><div className="cc-wave" aria-hidden="true">{Array.from({length:27},(_,i)=><i key={i} style={{height:`${12+((i*17)%49)}px`,animationDelay:`${i*.07}s`}}/>)}</div><div className="cc-timer">{clock(seconds)}</div><button className="cc-record-button" onClick={()=>recording?recorder.current?.stop():void startRecording(false)} disabled={voice!=='idle'||busy} aria-label={recording?'Stop recording':'Start microphone recording'}>{recording?<Square fill="currentColor"/>:<Mic size={28}/>}</button><p>{recording?'Recording microphone · tap to stop':'Tap to record'}</p></div>
      <div className="cc-action-row"><button className="cc-secondary" onClick={()=>void startRecording(true)} disabled={recording||voice!=='idle'||busy}><Monitor size={18}/>Meeting tab + mic</button><label className="cc-secondary cc-file"><Upload size={18}/>Import audio<input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.mp4" disabled={recording||voice!=='idle'||busy} onChange={e=>{void importAudio(e.target.files?.[0]);e.target.value='';}}/></label></div>
      <p className="cc-muted">No fixed recording-duration cap. Current upload storage limit: 1 GB per file. Keep this app open while recording; use Samsung Recorder for long background recordings. Meeting audio requires a desktop browser and its sharing picker; phone-call capture is not supported here.</p>
      <div className="cc-privacy"><LockKeyhole size={18}/><span>Audio stays on this device until you choose Transcribe. Then your private server and configured AI provider process it.</span></div>
      {!!local.length&&<h3>On this device</h3>}{local.map(d=><article className="cc-card" key={d.id}><strong>{d.title}</strong><p className="cc-muted">{d.recordingId?'Uploaded · original still on this device':d.complete?'Ready to transcribe':'Interrupted recording · recover saved audio'}</p><div className="cc-action-row"><button className="cc-primary" disabled={busy||recording||voice!=='idle'} onClick={()=>void upload(d)}>{busy?'Uploading…':d.recordingId?'Open transcript status':'Transcribe & summarize'}</button><button className="cc-secondary" onClick={()=>void draftBlob(d).then(b=>download(b,`${d.title}.${extension(d.mime)}`))} aria-label="Download original audio"><Download size={18}/></button><button className="cc-text-button" disabled={busy||recording} onClick={()=>{if(confirm('Delete this local audio draft?'))void deleteDraft(d.id).then(refreshDrafts);}}>Discard</button></div></article>)}
    </div>
    <div hidden={mode!=='library'}><div className="cc-heading-row"><div><span className="cc-eyebrow">YOUR CONVERSATIONS</span><h2>Nothing important<br/><em>slips away.</em></h2></div><button className="cc-secondary" aria-label="Refresh recordings" disabled={busy} onClick={()=>void refreshLibrary()}><RefreshCw size={18}/></button></div>{records===null?<p className="cc-muted">Loading your private library…</p>:records.length===0?<div className="cc-card"><h3>Your first conversation belongs here.</h3><p>Use Record to capture or import audio. Summaries and transcripts will be available on your phone and computer after upload.</p></div>:records.map(r=><button className="cc-library-item" key={r.id} onClick={()=>void openRecord(r.id)}><span><strong>{r.title}</strong><small>{new Date(r.createdAt).toLocaleString()}</small></span><span>Open ↗</span></button>)}</div>
    {selected&&<div className="cc-detail" role="dialog" aria-modal="false" aria-label="Recording details"><button className="cc-text-button" onClick={()=>setSelected(null)}><ArrowLeft size={17}/>Close recording</button><h2>{selected.title}</h2>{selected.status!=='ready'&&<div className="cc-card"><strong>{selected.status==='failed'?'Processing needs attention':'Preparing your transcript…'}</strong><p>{selected.phase||selected.status}{selected.progress?` · ${selected.progress.completed} / ${selected.progress.total} sections`:''}</p><p className="cc-muted">Your original is retained. You can leave this page while server processing continues.</p>{selected.status==='failed'&&<button className="cc-primary" disabled={busy} onClick={()=>void retry()}>Retry incomplete processing</button>}</div>}<h3>Summary</h3><p>{selected.summary||'No summary available.'}</p>{!!selected.keyPoints?.length&&<ul>{selected.keyPoints.map((p,i)=><li key={i}>{p}</li>)}</ul>}<h3>Commitments to review</h3>{selected.commitments?.length?selected.commitments.map((c,i)=><div className="cc-card" key={i}><strong>{c.text}</strong><p>{c.owner||'Owner unclear'} · {c.dueDate||'No date stated'}</p>{c.evidence&&<blockquote>{c.evidence}</blockquote>}</div>):<p className="cc-muted">{selected.status==='ready'?'No explicit commitments identified.':'Commitments will appear after processing.'}</p>}<p className="cc-muted">Extracted notes only. No messages, payments, or reminders are sent automatically.</p><details><summary>Read full transcript</summary><pre>{selected.transcript}</pre></details><button className="cc-text-button" onClick={()=>download(new Blob([`${selected.title}\n\n${selected.summary}\n\n${selected.transcript||''}`],{type:'text/plain'}),`${selected.title}.txt`)}><Download size={16}/>Export transcript</button><h3>Ask about this conversation</h3>{selected.chat?.map((m,i)=><p className="cc-chat-line" key={i}><strong>{m.role==='user'?'You':'Cupcake'}</strong>{m.text||m.content}</p>)}<form className="cc-ask" onSubmit={e=>{e.preventDefault();void ask();}}><input aria-label="Question about the recording" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} placeholder="What did I agree to?"/><button className="cc-primary" disabled={busy||!question.trim()||selected.status!=='ready'} aria-label="Ask Cupcake"><Send size={18}/></button></form></div>}
  </section>;
}
