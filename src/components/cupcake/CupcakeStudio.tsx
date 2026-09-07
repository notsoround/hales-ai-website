import { useCallback, useEffect, useRef, useState } from 'react';
import Daily, { type DailyCall } from '@daily-co/daily-js';
import { Mic, Square, Upload, Headphones, Download, Monitor, LockKeyhole } from 'lucide-react';
import { drafts, putDraft, putChunk, draftBlob, deleteDraft, type Draft } from './storage';
import ConversationPanel from './ConversationPanel';
import LibraryWorkspace from './LibraryWorkspace';
import { uploadLabel, type Conversation as Recording } from './library';
import './studio.css';

const API = 'https://automate.hales.ai/webhook';
const headers = () => ({ 'X-Cupcake-Key': sessionStorage.getItem('cupcake-private-access') || '' });
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}/${path}`, { ...init, headers: { ...headers(), ...init.headers }, signal: init.signal || AbortSignal.timeout(180000), cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Your private access expired. Lock and unlock Cupcake to reconnect.' : response.status === 413 ? 'This upload part is too large. Keep your original and try again.' : `Cupcake could not complete that request (${response.status}). Your local recording is still available.`);
  let data;try{data=await response.json();}catch{throw new Error('The recording service returned an incomplete response. Your audio is safe on this device; please try again.');} if (data.ok === false) throw new Error(data.error || 'Please try again.'); return data;
}
function mediaError(error: unknown) {
  const e = error as {name?:string;message?:string};
  if(e?.name==='NotAllowedError'||/permission denied|permission dismissed/i.test(e?.message||'')) return 'Microphone access is blocked. In your browser’s site settings for hales.ai, allow Microphone, then try again. On Mac, also check System Settings → Privacy & Security → Microphone for your browser. Importing recordings still works.';
  if(e?.name==='NotFoundError') return 'No microphone was found. Connect or select a microphone, then try again.';
  if(e?.name==='NotReadableError') return 'Your microphone could not start. Check the selected input and close another app using it, then try again.';
  return e?.message || 'Voice could not start. Please try again.';
}
const extension = (mime:string) => mime.includes('mp4')?'m4a':mime.includes('mpeg')?'mp3':mime.includes('wav')?'wav':mime.includes('ogg')?'ogg':'webm';
const clock = (s: number) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }

export default function CupcakeStudio({ mode, onBusy }: { mode: 'talk' | 'record' | 'library'; onBusy: (busy: boolean) => void }) {
  const [error, setError] = useState(''); const [voice, setVoice] = useState<'idle'|'connecting'|'live'>('idle'); const [muted, setMuted] = useState(false);
  const [lines, setLines] = useState<{ role: string; text: string }[]>([]); const [speaking, setSpeaking] = useState(false);
  const voiceMic = useRef<MediaStream | null>(null);
  const call = useRef<DailyCall | null>(null); const remoteId=useRef<string|null>(null); const voiceGeneration = useRef(0); const players = useRef(new Map<string, HTMLAudioElement>());
  const [autoAnalyze,setAutoAnalyze]=useState(true);
  const [level,setLevel]=useState(0);const [heardAudio,setHeardAudio]=useState(false);const [inputName,setInputName]=useState('Microphone');const meterFrame=useRef(0);const [preview,setPreview]=useState<{id:string;url:string}|null>(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
  const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0); const [title, setTitle] = useState(''); const [local, setLocal] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false); const [selected, setSelected] = useState<Recording | null>(null);
  const [asking,setAsking]=useState(false); const [questionError,setQuestionError]=useState(''); const [libraryBusy,setLibraryBusy]=useState(false);
  const [uploadProgress,setUploadProgress]=useState<{id:string;received:number;total:number;phase:'uploading'|'finishing'}|null>(null);const uploading=useRef(false);
  const recorder = useRef<MediaRecorder | null>(null); const streams = useRef<MediaStream[]>([]); const context = useRef<AudioContext | null>(null); const started = useRef(0); const finishing = useRef(false); const mounted = useRef(true);
  const refreshDrafts = useCallback(() => drafts().then(setLocal).catch(() => setError('Device storage is unavailable. Check browser storage permissions before recording.')), []);
  const cleanupTracks = useCallback(() => { cancelAnimationFrame(meterFrame.current); streams.current.forEach(s => s.getTracks().forEach(t => t.stop())); streams.current = []; void context.current?.close(); context.current = null; }, []);
  const endRemote = useCallback(async(id:string) => {
    for(const delay of [0,1500,3500,8000]) {
      if(delay)await new Promise(r=>setTimeout(r,delay));
      try { const r=await fetch(`${API}/cupcake-voice-end`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({callId:id}),signal:AbortSignal.timeout(15000)});if(r.ok)return;if(r.status!==409&&r.status!==404)break; }catch{ /* The local microphone is already closed. */ }
    }
    if(mounted.current)setError('Voice disconnected locally. Server session cleanup could not be confirmed.');
  },[]);
  const endVoice = useCallback(async () => { voiceGeneration.current++; const c = call.current; call.current = null; const id=remoteId.current;remoteId.current=null; for (const p of players.current.values()) { p.pause(); p.srcObject = null; } players.current.clear(); voiceMic.current?.getTracks().forEach(t=>t.stop()); voiceMic.current=null; if (c) { await c.leave().catch(() => {}); await c.destroy().catch(() => {}); } if (mounted.current) { setVoice('idle'); setSpeaking(false); } if(id)void endRemote(id); }, [endRemote]);
  useEffect(() => { mounted.current=true; void refreshDrafts(); return () => { mounted.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); cleanupTracks(); void endVoice(); }; }, [refreshDrafts, cleanupTracks, endVoice]);
  useEffect(() => { onBusy(recording || voice !== 'idle' || busy || libraryBusy || asking); }, [recording, voice, busy, libraryBusy, asking, onBusy]);
  useEffect(() => { if (!recording) return; const tick = setInterval(() => { const elapsed = (Date.now()-started.current)/1000; setSeconds(elapsed);  }, 250); const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => { clearInterval(tick); window.removeEventListener('beforeunload', warn); }; }, [recording]);
  useEffect(()=>{const id=new URLSearchParams(location.search).get('recording');if(!id||!/^[a-f0-9]{32}$/.test(id))return;void request(`cupcake-recording-detail?id=${encodeURIComponent(id)}`).then(d=>setSelected(d.recording)).catch(e=>setError(e.message));},[]);
  useEffect(() => { if(!selected || ['ready','failed'].includes(selected.status))return;const id=selected.id;const timer=setInterval(()=>{void request(`cupcake-recording-detail?id=${encodeURIComponent(id)}`).then(d=>setSelected(current=>current?.id===id?d.recording:current)).catch(()=>{});},5000);return()=>clearInterval(timer);},[selected]);
  async function startVoice() {
    if (voice !== 'idle' || recording || busy) return; setError('');setPreview(null); setVoice('connecting'); setLines([]); const generation = ++voiceGeneration.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice needs microphone access in a supported browser over HTTPS.');
      const mic = await navigator.mediaDevices.getUserMedia({audio:true});
      if (generation !== voiceGeneration.current || !mounted.current) { mic.getTracks().forEach(t=>t.stop()); return; }
      voiceMic.current=mic;
      const d = await request('cupcake-voice-session', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
      if (generation !== voiceGeneration.current || !mounted.current) {if(d.callId)void endRemote(d.callId);return;} remoteId.current=d.callId;
      const c = Daily.createCallObject({ audioSource: mic.getAudioTracks()[0], videoSource: false, startVideoOff: true }); call.current = c;
      c.on('track-started', e => { if(call.current!==c||generation!==voiceGeneration.current)return; if (e?.track.kind !== 'audio' || e.participant?.local) return; const id = e.track.id; const audio = new Audio(); audio.autoplay = true; audio.srcObject = new MediaStream([e.track]); players.current.set(id, audio); void audio.play().then(() => {if(call.current===c&&generation===voiceGeneration.current)c.sendAppMessage('playable');}).catch(() => setError('Tap Resume audio to hear Cupcake.')); });
      c.on('track-stopped', e => { if (e?.track) { const p = players.current.get(e.track.id); if(p) { p.pause(); p.srcObject = null; players.current.delete(e.track.id); } } });
      c.on('app-message', e => { if(call.current!==c||generation!==voiceGeneration.current)return; let d=e?.data; if(typeof d==='string'){try{d=JSON.parse(d);}catch{return;}} if (!d || typeof d !== 'object') return; if(d.type === 'speech-update') setSpeaking(d.status === 'started' && d.role === 'assistant'); if(d.type === 'transcript' && d.transcriptType === 'final' && typeof d.transcript === 'string') setLines(a => [...a.slice(-99), {role:d.role === 'assistant'?'Cupcake':'You', text:d.transcript}]); });
      c.on('left-meeting', () => { if(call.current === c) void endVoice(); }); c.on('error', () => { if(call.current!==c||generation!==voiceGeneration.current)return; setError('The voice connection ended. You can reconnect.'); void endVoice(); });
      await c.join({url:d.webCallUrl}); if (generation !== voiceGeneration.current || call.current!==c) { await c.destroy().catch(()=>{}); return; } setVoice('live'); setMuted(false);
    } catch(e) { if(generation!==voiceGeneration.current)return; setError(mediaError(e)); await endVoice(); }
  }
  async function startRecording(meeting: boolean) {
    if(recording || voice !== 'idle' || busy) return; setBusy(true);setPreview(null); setError(''); finishing.current = false;
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
      if(!mounted.current){cleanupTracks();return;}
      setHeardAudio(false);setLevel(0);setInputName(meeting?'Shared tab + microphone':input.getAudioTracks()[0]?.label||'Microphone');
      try{const ac=context.current||new AudioContext();context.current=ac;await ac.resume();const analyser=ac.createAnalyser();analyser.fftSize=512;ac.createMediaStreamSource(input).connect(analyser);const samples=new Uint8Array(analyser.fftSize);let last=0;const measure=(now:number)=>{if(now-last>120){analyser.getByteTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((n,x)=>n+((x-128)/128)**2,0)/samples.length);setLevel(Math.min(1,rms*8));if(rms>.003)setHeardAudio(true);last=now;}meterFrame.current=requestAnimationFrame(measure);};meterFrame.current=requestAnimationFrame(measure);}catch{setInputName('Microphone · level meter unavailable');}
      const draft: Draft = {id,title:title.trim() || (meeting?'Meeting':'Voice note'),startedAt:Date.now(),mime,complete:false}; await putDraft(draft);
      const r = new MediaRecorder(input,{mimeType:mime,audioBitsPerSecond:64000}); recorder.current=r; let index=0; let captureFailed=false; let writes=Promise.resolve();
      r.ondataavailable = e => { if(!e.data.size) return; const n=index++; writes=writes.then(() => putChunk(id,n,e.data)); void writes.catch(() => {captureFailed=true;setError('Device storage is full. Recording stopped. Recover the saved portion below.'); if(r.state==='recording') r.stop();});  };
      r.onstop = () => { if(finishing.current)return; finishing.current=true; cleanupTracks(); setRecording(false); void writes.then(() => putDraft({...draft,complete:true})).then(refreshDrafts).then(()=>{if(autoAnalyze&&!captureFailed&&mounted.current)void upload({...draft,complete:true});}).catch(() => {setError('Some audio could not be saved. Check the recoverable draft.');void refreshDrafts();}); };
      r.onerror = () => { captureFailed=true; setError('Recording was interrupted. Recover the saved audio below.'); if(r.state !== 'inactive')r.stop(); else {cleanupTracks();setRecording(false);} };
      started.current=Date.now(); setSeconds(0); r.start(3000); setRecording(true);
    } catch(e) {cleanupTracks();setError(mediaError(e));}finally{setBusy(false);}
  }
  async function importAudio(file?: File) { if(!file)return; if(file.size>1000000000){setError('This upload exceeds the current 1 GB storage limit. Keep the original and split it into files before importing.');return;} const d: Draft={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,''),startedAt:Date.now(),mime:file.type||'audio/mp4',complete:true,blob:file};try{await putDraft(d);await refreshDrafts();}catch{setError('Could not save the imported file on this device.');} }
  async function upload(draft: Draft) {
    if(busy || recording || voice!=='idle'||uploading.current)return;uploading.current=true;setBusy(true);setError('');
    try {
      if(draft.recordingId){setSelected((await request(`cupcake-recording-detail?id=${encodeURIComponent(draft.recordingId)}`)).recording);return;}
      const blob=await draftBlob(draft);if(!blob.size)throw new Error('This draft contains no audio.');setUploadProgress({id:draft.id,received:0,total:blob.size,phase:'uploading'});
      const started=await request('cupcake-recording-start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:draft.title,uploadId:draft.id,mimeType:blob.type,totalBytes:blob.size,filename:`recording.${extension(blob.type)}`})});
      const id=started.recording?.id||started.id; if(started.recording&&started.recording.status!=='uploading'){setSelected(started.recording);await putDraft({...draft,recordingId:id});await refreshDrafts();return;} if(!id)throw new Error('Upload could not be initialized.');
      const size=8*1024*1024,parts=Math.ceil(blob.size/size);
      for(let index=0;index<parts;index++){const f=new FormData();f.append('audio',blob.slice(index*size,Math.min(blob.size,(index+1)*size)),`part-${index}`);f.append('id',id);f.append('index',String(index));await request('cupcake-recording-part',{method:'POST',body:f});setUploadProgress({id:draft.id,received:Math.min(blob.size,(index+1)*size),total:blob.size,phase:'uploading'});}
      setUploadProgress({id:draft.id,received:blob.size,total:blob.size,phase:'finishing'});
      const d=await request('cupcake-recording-finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,parts})});
      setSelected(d.recording);
      await putDraft({...draft,complete:true,recordingId:id});await refreshDrafts();
    }catch(e){setError((e as Error).message);}finally{uploading.current=false;setUploadProgress(null);setBusy(false);}
  }
  async function openRecord(id:string){setBusy(true);setError('');try{setSelected((await request(`cupcake-recording-detail?id=${encodeURIComponent(id)}`)).recording);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function retry(){if(!selected||busy)return;setBusy(true);try{setSelected((await request('cupcake-recording-retry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id})})).recording);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function ask(message:string){
    if(!selected||selected.status!=='ready'||asking||!message.trim())return;
    const id=selected.id;setAsking(true);setQuestionError('');
    try{const d=await request('cupcake-recording-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,message}),signal:AbortSignal.timeout(300000)});
      if(d.recording?.chat?.length&&d.model){const last=d.recording.chat.at(-1);if(last.role!=='user'&&(last.text||last.content)===d.reply){last.model=d.model;last.createdAt=last.createdAt||d.createdAt;last.sources=last.sources||d.sources;}}
      setSelected(current=>current?.id===id?(d.recording||{...current,chat:[...(current.chat||[]),{role:'user',text:message,createdAt:new Date().toISOString()},{role:'assistant',text:d.reply,model:d.model,createdAt:d.createdAt,sources:d.sources}]}):current);
    }catch(e){setQuestionError((e as Error).message);throw e;}finally{setAsking(false);}
  }
  return <section className="cc-studio">
    {error&&<div role="alert" className="cc-error">{error}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
    {(recording||voice!=='idle')&&<div className="cc-live-bar"><span className="cc-dot"/>{recording?`Recording · ${clock(seconds)}`:voice==='connecting'?'Connecting to Cupcake…':'Voice conversation active'}<button onClick={()=>recording?recorder.current?.stop():void endVoice()}>Stop</button></div>}
    <div hidden={mode!=='talk'}>
      <div className={`cc-portrait ${speaking?'is-speaking':''}`}><img src="/cupcake-avatar.jpg" alt="Cupcake"/><span className="cc-portrait-shade"/><div><span className="cc-eyebrow">YOUR PRIVATE COMPANION</span><h2>I'm listening,<br/>Matt.</h2><p>A real conversation. A little attitude.</p></div></div>
      <div className="cc-action-row"><button className="cc-primary" onClick={()=>voice==='idle'?void startVoice():void endVoice()} disabled={recording||busy}>{voice==='idle'?<Headphones size={20}/>:<Square size={18}/>} {voice==='idle'?'Talk to Cupcake':voice==='connecting'?'Cancel connection':'End conversation'}</button>{voice==='live'&&<button className="cc-secondary" onClick={()=>{call.current?.setLocalAudio(muted);setMuted(!muted);}}>{muted?'Unmute':'Mute'}</button>}</div>
      <p className="cc-muted">Private voice session · microphone on only after you start · live back-and-forth voice. She can search your private library and use a recent context snapshot. This conversation cannot take actions.</p>
      {voice==='live'&&<button className="cc-text-button" onClick={()=>players.current.forEach(p=>void p.play().then(()=>call.current?.sendAppMessage('playable')).catch(()=>setError('Audio is still blocked. Allow sound for hales.ai, then tap Resume audio.')))}>Resume audio</button>}
      <div className="cc-transcript" aria-live="polite">{lines.map((l,i)=><p key={i}><strong>{l.role}</strong>{l.text}</p>)}</div>
    </div>
    <div hidden={mode!=='record'}>
      <span className="cc-eyebrow">RECORD & REMEMBER</span><h2>Catch the conversation.<br/><em>Keep what matters.</em></h2>
      <p className="cc-muted">Record a voice note or conversation, or import a Samsung recording. Cupcake turns it into a transcript, summary, and commitments you can review.</p>
      <label className="cc-label">Recording title<input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="A thought, a meeting, a promise…" disabled={recording}/></label>
      <label className="cc-auto"><input type="checkbox" checked={autoAnalyze} disabled={recording||busy} onChange={e=>setAutoAnalyze(e.target.checked)}/>Transcribe automatically when I stop</label>
      <div className={`cc-recorder ${recording?'is-recording':''}`}><div className="cc-wave" aria-hidden="true">{Array.from({length:27},(_,i)=><i key={i} style={{height:`${recording?3+level*(12+((i*17)%49)):12+((i*17)%49)}px`}}/>)}</div><div className="cc-timer">{clock(seconds)}</div><button className="cc-record-button" onClick={()=>recording?recorder.current?.stop():void startRecording(false)} disabled={voice!=='idle'||busy} aria-label={recording?'Stop recording':'Start microphone recording'}>{recording?<Square fill="currentColor"/>:<Mic size={28}/>}</button><p>{recording?'Recording · tap to stop':'Tap to record'}</p>{recording&&<div className="cc-input-status"><span>{inputName}</span><div className="cc-level" role="meter" aria-label="Audio input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level*100)}><i style={{width:`${Math.max(1,level*100)}%`}}/></div><p role="status">{heardAudio?'Audio detected':seconds>2?'No audio detected yet. Speak and check your microphone.':'Listening for audio…'}</p></div>}</div>
      <div className="cc-action-row"><button className="cc-secondary" onClick={()=>void startRecording(true)} disabled={recording||voice!=='idle'||busy}><Monitor size={18}/>Meeting tab + mic</button><label className="cc-secondary cc-file"><Upload size={18}/>Import audio<input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.mp4" disabled={recording||voice!=='idle'||busy} onChange={e=>{void importAudio(e.target.files?.[0]);e.target.value='';}}/></label></div>
      <p className="cc-muted">No fixed recording-duration cap. Current upload storage limit: 1 GB per file. Keep this app open while recording; use Samsung Recorder for long background recordings. Meeting audio requires a desktop browser and its sharing picker; phone-call capture is not supported here.</p>
      <div className="cc-privacy"><LockKeyhole size={18}/><span>With automatic transcription on, stopping uploads your recording to your private server and configured AI provider. Imports wait until you choose Transcribe. Your original stays on this device.</span></div>
      {!!local.length&&<h3>On this device</h3>}{local.map(d=><article className="cc-card" key={d.id}><strong>{d.title}</strong>{uploadProgress?.id===d.id&&<div className="cc-upload-progress" role="status"><progress max={uploadProgress.total} value={uploadProgress.received}/><span>{uploadLabel(uploadProgress.received,uploadProgress.total)}</span><small>{uploadProgress.phase==='finishing'?'All parts received. Preparing the transcript job…':'Server-confirmed bytes · keep this page open'}</small></div>}<p className="cc-muted">{d.recordingId?'Uploaded · original still on this device':d.complete?'Ready to transcribe':'Interrupted recording · recover saved audio'}</p><div className="cc-action-row"><button className="cc-primary" disabled={busy||recording||voice!=='idle'} onClick={()=>void upload(d)}>{uploadProgress?.id===d.id?(uploadProgress.phase==='finishing'?'Finishing upload…':'Uploading this recording…'):d.recordingId?'Open transcript status':'Transcribe & summarize'}</button><button className="cc-secondary" disabled={recording||voice!=='idle'} onClick={()=>void draftBlob(d).then(b=>setPreview({id:d.id,url:URL.createObjectURL(b)}))}>Listen to original</button><button className="cc-secondary" onClick={()=>void draftBlob(d).then(b=>download(b,`${d.title}.${extension(d.mime)}`))} aria-label="Download original audio"><Download size={18}/></button><button className="cc-text-button" disabled={busy||recording} onClick={()=>{if(confirm('Delete this local audio draft?'))void deleteDraft(d.id).then(refreshDrafts);}}>Discard</button></div>{preview?.id===d.id&&<audio controls src={preview.url} aria-label="Original recording playback" style={{width:'100%'}}/>}</article>)}
    </div>
    <div hidden={mode!=='library'}><LibraryWorkspace active={mode==='library'} onOpenRecording={id=>void openRecord(id)} onWork={setLibraryBusy}/></div>
    {selected&&<ConversationPanel key={selected.id} record={selected} onClose={()=>{setSelected(null);setQuestionError('');}} onAsk={ask} onRetry={()=>void retry()} asking={asking} questionError={questionError} retrying={busy} onOrganized={(project,tags)=>setSelected(current=>current?{...current,project,tags}:current)}/>}
  </section>;
}
