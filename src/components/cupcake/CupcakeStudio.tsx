import {TalkCheckpointRecovery, remoteTalkSummary, talkDeviceStorage, type RemoteTalk, type RemoteTalkSession} from './talkCheckpoints';
import { useCallback, useEffect, useRef, useState } from 'react';
import Daily, { type DailyCall } from '@daily-co/daily-js';
import { Mic, Square, Upload, Headphones, Download, Monitor, LockKeyhole } from 'lucide-react';
import { drafts, putDraft, putChunk, draftBlob, deleteDraft, type Draft } from './storage';
import ConversationPanel from './ConversationPanel';
import LibraryWorkspace from './LibraryWorkspace';
import VoiceInputCheck from './VoiceInputCheck';
import TalkHistory from './TalkHistory';
import { continuationContext, closeVoiceTransport, persistTalk, readTalks, saveTalk, TalkLineDrain, VoiceEndingCoordinator, type SavedTalk, type TalkLine } from './voiceHistory';
import { TALK_SEED_KEY } from './dashboardModel';
import { acquireMicrophone, microphoneConstraints, microphoneMessage, readInputDevice, saveInputDevice } from './voiceInput';
import { libraryRequest, uploadLabel, type Conversation as Recording } from './library';
import { RecordingRequestError, uploadRecording, type UploadProgress } from './recordingUpload';
import './studio.css';

const API = 'https://automate.hales.ai/webhook';
const headers = () => ({ 'X-Cupcake-Key': sessionStorage.getItem('cupcake-private-access') || '' });
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}/${path}`, { ...init, headers: { ...headers(), ...init.headers }, signal: init.signal || AbortSignal.timeout(180000), cache: 'no-store' });
  if (!response.ok) throw new RecordingRequestError(response.status === 401 || response.status === 403 ? 'Your private access expired. Lock and unlock Cupcake to reconnect.' : response.status === 413 ? 'This upload part is too large. Keep your original and try again.' : `Cupcake could not complete that request (${response.status}). Your local recording is still available.`, response.status);
  let data;try{data=await response.json();}catch{throw new RecordingRequestError('The recording service returned an incomplete response. Your audio is safe on this device; please try again.', 502);} if (data.ok === false) throw new Error(data.error || 'Please try again.'); return data;
}
function mediaError(error: unknown) {
  const e = error as {name?:string;message?:string};
  return microphoneMessage(e);
}
const extension = (mime:string) => mime.includes('mp4')?'m4a':mime.includes('mpeg')?'mp3':mime.includes('wav')?'wav':mime.includes('ogg')?'ogg':'webm';
const clock = (s: number) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function mergeTalks(incoming:SavedTalk[],current:SavedTalk[],recovery:TalkCheckpointRecovery){
 const rows=new Map(current.map(t=>[t.id,t]));
 for(const talk of incoming)rows.set(talk.id,{...talk,archived:recovery.isArchived(talk.id,rows.get(talk.id)?.archived??talk.archived??false)});
 return [...rows.values()].map(t=>({...t,archived:recovery.isArchived(t.id,t.archived)})).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
}
type TalkCapture={id:string;startedAt:string;drain:TalkLineDrain;closing:boolean};

export default function CupcakeStudio({ mode, onBusy, active = true }: { mode: 'talk' | 'record' | 'library'; onBusy: (busy: boolean) => void; active?: boolean }) {
  const [error, setError] = useState(''); const [notice,setNotice]=useState(''); const [failedUploadId,setFailedUploadId]=useState<string|null>(null); const importing=useRef(false); const [voice, setVoice] = useState<'idle'|'connecting'|'live'>('idle'); const [muted, setMuted] = useState(false);
  const [lines, setLines] = useState<TalkLine[]>([]); const linesRef=useRef<TalkLine[]>([]); const lineDrain=useRef(new TalkLineDrain()); const endingVoice=useRef(new VoiceEndingCoordinator()); const stoppingVoice=useRef(false); const [speaking, setSpeaking] = useState(false);
  const talkCapture=useRef<TalkCapture|null>(null);
  const [inputDevice,setInputDevice]=useState(readInputDevice);
  const [micTesting,setMicTesting]=useState(false);
  const checkpointRecovery=useRef<TalkCheckpointRecovery|null>(null);
  if(!checkpointRecovery.current)checkpointRecovery.current=new TalkCheckpointRecovery(talkDeviceStorage(),p=>libraryRequest(p));
  const [checkpointStatus,setCheckpointStatus]=useState('');
  const [historyStatus,setHistoryStatus]=useState('');const remoteTalkIds=useRef(new Set<string>());const openingTalk=useRef(0);const historyRefresh=useRef<Promise<void>|null>(null);
  const [talks,setTalks]=useState<SavedTalk[]>(()=>readTalks());const [openedTalk,setOpenedTalk]=useState<SavedTalk|null>(null);const talkStarted=useRef('');const talkLocalId=useRef('');
  const [callSeed,setCallSeed]=useState<SavedTalk|null>(null);
  const voiceMic = useRef<MediaStream | null>(null);const voiceAcquisition=useRef<AbortController|null>(null);
  const captureAcquisition=useRef<AbortController|null>(null);const captureGeneration=useRef(0);const [captureStarting,setCaptureStarting]=useState<'microphone'|'meeting'|null>(null);
  const call = useRef<DailyCall | null>(null); const remoteId=useRef<string|null>(null); const voiceGeneration = useRef(0); const players = useRef(new Map<string, HTMLAudioElement>());
  const [autoAnalyze,setAutoAnalyze]=useState(true);
  const [level,setLevel]=useState(0);const [heardAudio,setHeardAudio]=useState(false);const [inputName,setInputName]=useState('Microphone');const meterFrame=useRef(0);const [preview,setPreview]=useState<{id:string;url:string}|null>(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
  const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0); const [title, setTitle] = useState(''); const [local, setLocal] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false); const [selected, setSelected] = useState<Recording | null>(null);
  const [asking,setAsking]=useState(false); const [questionError,setQuestionError]=useState(''); const [libraryBusy,setLibraryBusy]=useState(false);
  const [uploadProgress,setUploadProgress]=useState<UploadProgress|null>(null);const uploading=useRef(false);
  const recorder = useRef<MediaRecorder | null>(null); const streams = useRef<MediaStream[]>([]); const context = useRef<AudioContext | null>(null); const started = useRef(0); const finishing = useRef(false); const mounted = useRef(true);
  const refreshDrafts = useCallback(() => drafts().then(setLocal).catch(() => setError('Device storage is unavailable. Check browser storage permissions before recording.')), []);
  const cleanupTracks = useCallback(() => { cancelAnimationFrame(meterFrame.current); streams.current.forEach(s => s.getTracks().forEach(t => t.stop())); streams.current = []; void context.current?.close(); context.current = null; }, []);
  const cancelRecordingStart=useCallback(()=>{if(!captureAcquisition.current)return;captureGeneration.current++;captureAcquisition.current.abort();captureAcquisition.current=null;cleanupTracks();if(mounted.current){setCaptureStarting(null);setBusy(false);setNotice('Recording startup cancelled. No recording was started.');}},[cleanupTracks]);
  const endRemote = useCallback(async(id:string) => {
    for(const delay of [0,1500,3500,8000]) {
      if(delay)await new Promise(r=>setTimeout(r,delay));
      try { const r=await fetch(`${API}/cupcake-voice-end`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({callId:id}),signal:AbortSignal.timeout(15000)});if(r.ok)return;if(r.status!==409&&r.status!==404)break; }catch{ /* The local microphone is already closed. */ }
    }
    if(mounted.current)setError('Voice disconnected locally. Server session cleanup could not be confirmed.');
  },[]);
  const flushTalk=useCallback(async(id:string)=>{
    try{await checkpointRecovery.current!.flush(id);if(mounted.current){setTalks(current=>mergeTalks(checkpointRecovery.current!.talks(),current,checkpointRecovery.current!));setCheckpointStatus(['Received transcript lines saved to your private library.',checkpointRecovery.current!.warning()].filter(Boolean).join(' '));}}
    catch(e){if(mounted.current)setCheckpointStatus(String(e instanceof Error?e.message:e))}
  },[]);
  const syncTalk=useCallback(async(talk:SavedTalk,devicePersisted=true)=>{
    if(checkpointRecovery.current!.get(talk.id)){await flushTalk(talk.id);return;}
    // Legacy records remain explicit saves; growing new sessions never use import.
    try{const d=await libraryRequest<{document:{id:string}}>({action:'import',kind:'conversation',sourceApp:'Cupcake voice',title:talk.title,text:talk.lines.map(x=>`${x.role}:\n${x.text}`).join('\n\n')});const saved={...talk,documentId:d.document.id};if(mounted.current){setTalks(current=>mergeTalks(saveTalk(saved),current,checkpointRecovery.current!));setOpenedTalk(current=>current?.id===saved.id?saved:current);}}
    catch{if(mounted.current)setError(devicePersisted?'Legacy conversation is on this device. Retry Save to private library.':'Copy this conversation before closing; device and library saving could not be confirmed.');}
  },[flushTalk]);
  const refreshTalkHistory=useCallback(()=>{
    if(historyRefresh.current)return historyRefresh.current;
    const work=(async()=>{try{
      if(mounted.current)setHistoryStatus('Loading saved conversations…');
      const data=await libraryRequest<{sessions:RemoteTalk[]}>({action:'talk_list'});
      if(!mounted.current)return;
      remoteTalkIds.current=new Set(data.sessions.map(t=>t.id));
      setTalks(current=>mergeTalks(data.sessions.map(t=>({...remoteTalkSummary(t),lines:current.find(x=>x.id===t.id)?.lines||[]})),current,checkpointRecovery.current!));
      setHistoryStatus('Saved conversations are up to date.');
    }catch(e){if(mounted.current)setHistoryStatus(String(e instanceof Error?e.message:e))}})().finally(()=>{historyRefresh.current=null});
    historyRefresh.current=work;return work;
  },[]);
  const openTalk=useCallback(async(talk:SavedTalk)=>{
    const requestId=++openingTalk.current;
    setOpenedTalk(talk.lines.length?talk:null);
    if(!remoteTalkIds.current.has(talk.id)&&!checkpointRecovery.current!.get(talk.id)){setOpenedTalk(talk);return;}
    setHistoryStatus('Loading saved transcript…');
    try{
      const data=await libraryRequest<{session:RemoteTalkSession;libraryStatus:string}>({action:'talk_get',sessionId:talk.id});
      if(!mounted.current||requestId!==openingTalk.current)return;
      const loaded=checkpointRecovery.current!.adoptRemote(data.session);
      setTalks(current=>mergeTalks([loaded],current,checkpointRecovery.current!));setOpenedTalk(loaded);
      setHistoryStatus(data.libraryStatus==='indexed'?'Saved transcript opened.':'Transcript opened; library indexing is pending.');
      if(checkpointRecovery.current!.warning())setCheckpointStatus(checkpointRecovery.current!.warning());
    }catch(e){if(mounted.current&&requestId===openingTalk.current)setHistoryStatus(String(e instanceof Error?e.message:e))}
  },[]);
  useEffect(()=>{
    const recover=()=>{try{setTalks(current=>mergeTalks(checkpointRecovery.current!.talks(),current,checkpointRecovery.current!));for(const item of checkpointRecovery.current!.pending())void flushTalk(item.id);if(checkpointRecovery.current!.warning())setCheckpointStatus(checkpointRecovery.current!.warning());}catch(e){setCheckpointStatus(String(e))}};
    recover();const timer=setInterval(recover,5000);return()=>clearInterval(timer);
  },[flushTalk]);
  useEffect(()=>{void refreshTalkHistory();const refresh=()=>{void refreshTalkHistory()};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[refreshTalkHistory]);
  const endVoice = useCallback(() => {
    stoppingVoice.current=true;voiceAcquisition.current?.abort();voiceAcquisition.current=null;
    return endingVoice.current.begin(async()=>{
      const c=call.current, id=remoteId.current, capture=talkCapture.current;
      talkLocalId.current='';
      if(capture)capture.closing=true;
      const saveCaptured=(final:boolean)=>{
        if(!capture)return;
        const captured=final?capture.drain.close():capture.drain.snapshot();
        if(talkCapture.current===capture)linesRef.current=captured;
        if(!captured.length)return;
        const first=captured.find(x=>x.role==='You')?.text||captured[0].text;
        const talk:SavedTalk={id:capture.id,title:first.slice(0,80)||'Talk with Cupcake',startedAt:capture.startedAt,endedAt:new Date().toISOString(),lines:captured};
        try{
          checkpointRecovery.current!.capture(capture.id,captured,final);
          const stored=persistTalk(talk);
          void flushTalk(capture.id);
          if(mounted.current)setTalks(current=>mergeTalks(stored.talks,current,checkpointRecovery.current!));
        }catch(e){if(mounted.current)setCheckpointStatus(String(e instanceof Error?e.message:e));}
      };
      try {
        voiceMic.current?.getTracks().forEach(t=>t.stop());voiceMic.current=null;
        for(const player of players.current.values()){player.pause();player.srcObject=null;}
        players.current.clear();
        const confirmed=await closeVoiceTransport(c,()=>saveCaptured(true));
        if(!confirmed){saveCaptured(false);if(mounted.current)setError('Voice stopped locally; transport closure is not confirmed. Any further received transcript lines will continue saving without starting another call.');}
      } catch {
        if(mounted.current)setError('Voice ended, but saving the conversation could not be confirmed. Copy the visible conversation before leaving this page.');
      } finally {
        if(talkCapture.current===capture)talkCapture.current=null;
        call.current=null;remoteId.current=null;voiceGeneration.current++;
        if(mounted.current){setVoice('idle');setSpeaking(false);}
        if(id)void endRemote(id);
        stoppingVoice.current=false;
      }
    });
  },[endRemote,flushTalk]);
  useEffect(() => { mounted.current=true; void refreshDrafts(); return () => { mounted.current = false; cancelRecordingStart(); if (recorder.current?.state === 'recording') recorder.current.stop(); cleanupTracks(); void endVoice(); }; }, [refreshDrafts, cleanupTracks, endVoice, cancelRecordingStart]);
  useEffect(()=>{if((!active||mode!=='record')&&captureAcquisition.current)cancelRecordingStart();if((!active||mode!=='talk')&&voice==='connecting')void endVoice();},[active,mode,voice,cancelRecordingStart,endVoice]);
  useEffect(() => { onBusy(recording || voice !== 'idle' || busy || libraryBusy || asking || micTesting); }, [recording, voice, busy, libraryBusy, asking, micTesting, onBusy]);
  useEffect(() => { if (!recording) return; const tick = setInterval(() => { const elapsed = (Date.now()-started.current)/1000; setSeconds(elapsed);  }, 250); const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => { clearInterval(tick); window.removeEventListener('beforeunload', warn); }; }, [recording]);
  useEffect(()=>{if(!busy)return;const warn=(e:BeforeUnloadEvent)=>{if(uploading.current||importing.current)e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy]);
  useEffect(()=>{if(!active||mode!=='talk')return;try{const raw=sessionStorage.getItem(TALK_SEED_KEY);if(!raw)return;const seed=JSON.parse(raw) as SavedTalk;if(!seed?.id||!Array.isArray(seed.lines)||!seed.lines.length)return;setCallSeed(seed);setOpenedTalk(seed);setNotice('This Talk will include why Cupcake called. Tap Talk to Cupcake about this call when you are ready — the microphone stays off until then.');}catch{/* A bad seed must not start a call. */}},[active,mode]);
  useEffect(()=>{const id=new URLSearchParams(location.search).get('recording');if(!id||!/^[a-f0-9]{32}$/.test(id))return;void request(`cupcake-recording-detail?id=${encodeURIComponent(id)}`).then(d=>setSelected(d.recording)).catch(e=>setError(e.message));},[]);
  useEffect(() => { if(!selected || ['ready','failed'].includes(selected.status))return;const id=selected.id;const timer=setInterval(()=>{void request(`cupcake-recording-detail?id=${encodeURIComponent(id)}`).then(d=>setSelected(current=>current?.id===id?d.recording:current)).catch(()=>{});},5000);return()=>clearInterval(timer);},[selected]);
  async function startVoice(previous?:SavedTalk) {
    if (voice !== 'idle' || recording || busy || micTesting || voiceAcquisition.current) return; const contextTalk=previous||callSeed||undefined; try{sessionStorage.removeItem(TALK_SEED_KEY);}catch{/* Context still lives in memory for this start. */} setCallSeed(null); stoppingVoice.current=false;setError('');setPreview(null); setOpenedTalk(null);setVoice('connecting'); lineDrain.current=new TalkLineDrain();linesRef.current=[];setLines([]);talkStarted.current=new Date().toISOString();talkLocalId.current=crypto.randomUUID(); const generation = ++voiceGeneration.current;const checkpointId=talkLocalId.current;
    const capture:TalkCapture={id:checkpointId,startedAt:talkStarted.current,drain:lineDrain.current,closing:false};talkCapture.current=capture;
    const acquisition=new AbortController();voiceAcquisition.current=acquisition;
    try {
      checkpointRecovery.current!.create(checkpointId,talkStarted.current);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice needs microphone access in a supported browser over HTTPS.');
      const mic = await acquireMicrophone(c=>navigator.mediaDevices.getUserMedia(c),microphoneConstraints(inputDevice),12000,acquisition.signal);
      if (stoppingVoice.current || generation !== voiceGeneration.current || !mounted.current) { mic.getTracks().forEach(t=>t.stop()); return; }
      voiceMic.current=mic;
      const body=contextTalk?{context:continuationContext(contextTalk)}:{};
      const d = await request('cupcake-voice-session', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (stoppingVoice.current || generation !== voiceGeneration.current || !mounted.current) {if(d.callId)void endRemote(d.callId);return;} remoteId.current=d.callId;
      const c = Daily.createCallObject({ audioSource: mic.getAudioTracks()[0], videoSource: false, startVideoOff: true }); call.current = c;
      c.on('track-started', e => { if(stoppingVoice.current||call.current!==c||generation!==voiceGeneration.current)return; if (e?.track.kind !== 'audio' || e.participant?.local) return; const id = e.track.id; const audio = new Audio(); audio.autoplay = true; audio.srcObject = new MediaStream([e.track]); players.current.set(id, audio); void audio.play().then(() => {if(!stoppingVoice.current&&call.current===c&&generation===voiceGeneration.current)c.sendAppMessage('playable');}).catch(() => {if(!stoppingVoice.current&&call.current===c&&generation===voiceGeneration.current)setError('Tap Resume audio to hear Cupcake.');}); });
      c.on('track-stopped', e => { if (e?.track) { const p = players.current.get(e.track.id); if(p) { p.pause(); p.srcObject = null; players.current.delete(e.track.id); } } });
      c.on('app-message', e => {let d=e?.data;if(typeof d==='string'){try{d=JSON.parse(d);}catch{return;}}if(!d||typeof d!=='object')return;
        const current=call.current===c&&generation===voiceGeneration.current&&mounted.current;
        if(current&&!stoppingVoice.current&&d.type==='speech-update')setSpeaking(d.status==='started'&&d.role==='assistant');
        if(d.type==='transcript'&&d.transcriptType==='final'&&(d.role==='user'||d.role==='assistant')&&typeof d.transcript==='string'){
          const line:TalkLine={role:d.role==='assistant'?'Cupcake':'You',text:d.transcript};
          if(capture.drain.append(line,d.id||d.messageId||d.transcriptId)){
            const next=capture.drain.snapshot();if(current){linesRef.current=next;setLines(next);}
            try{checkpointRecovery.current!.capture(checkpointId,next);if(capture.closing)void flushTalk(checkpointId);if(mounted.current)setCheckpointStatus(checkpointRecovery.current!.warning()||'Final transcript saved on this device · syncing privately.');}
            catch(error){if(mounted.current)setCheckpointStatus(String(error));}
          }
        }
      });
      c.on('left-meeting', () => { if(call.current === c) void endVoice(); }); c.on('error', () => { if(call.current!==c||generation!==voiceGeneration.current)return; setError('The voice connection ended. You can reconnect.'); void endVoice(); });
      await c.join({url:d.webCallUrl}); if (stoppingVoice.current || generation !== voiceGeneration.current || call.current!==c) { await c.destroy().catch(()=>{}); return; } setVoice('live'); setMuted(false);
    } catch(e) { if(stoppingVoice.current||generation!==voiceGeneration.current||!mounted.current)return; setError(mediaError(e)); await endVoice(); }finally{if(voiceAcquisition.current===acquisition)voiceAcquisition.current=null;}
  }
  async function startRecording(meeting: boolean) {
    if(recording || voice !== 'idle' || busy || micTesting || captureAcquisition.current) return; const acquisition=new AbortController();captureAcquisition.current=acquisition;const generation=++captureGeneration.current;setCaptureStarting(meeting?'meeting':'microphone');setBusy(true);setPreview(null);setNotice(''); setError(''); finishing.current = false;
    try {
      if(!window.MediaRecorder || !navigator.mediaDevices) throw new Error('Recording needs a supported browser over HTTPS. You can still import an audio file.');
      const id = crypto.randomUUID(); const types = ['audio/webm;codecs=opus','audio/mp4','audio/webm']; const mime = types.find(t => MediaRecorder.isTypeSupported(t)); if(!mime) throw new Error('This browser cannot record a supported audio format. Please import a recording.');
      let input: MediaStream;
      if(meeting) {
        if(!navigator.mediaDevices.getDisplayMedia) throw new Error('Meeting-tab recording is unavailable here. Use a desktop browser or import audio.');
        let screen:MediaStream;try{screen=await acquireMicrophone(c=>navigator.mediaDevices.getDisplayMedia(c),{video:true,audio:true},60000,acquisition.signal);}catch(e){if((e as Error).name==='MicrophoneTimeoutError')throw new Error('Meeting sharing did not finish. Choose a browser tab, enable Share tab audio, and try again.');throw e;}
        if(generation!==captureGeneration.current||!mounted.current){screen.getTracks().forEach(t=>t.stop());return;}streams.current.push(screen);
        if(!screen.getAudioTracks().length) throw new Error('No meeting audio was shared. Select a browser tab and turn on Share tab audio.');
        const mic = await acquireMicrophone(c=>navigator.mediaDevices.getUserMedia(c),microphoneConstraints(inputDevice),12000,acquisition.signal);
        if(generation!==captureGeneration.current||!mounted.current){mic.getTracks().forEach(t=>t.stop());return;}streams.current.push(mic);
        const ac = new AudioContext(); context.current = ac; const destination = ac.createMediaStreamDestination(); ac.createMediaStreamSource(new MediaStream(screen.getAudioTracks())).connect(destination); ac.createMediaStreamSource(mic).connect(destination); input = destination.stream; streams.current.push(input);
        screen.getVideoTracks().forEach(t => t.addEventListener('ended', () => { if(recorder.current?.state === 'recording') recorder.current.stop(); }));
      } else { input = await acquireMicrophone(c=>navigator.mediaDevices.getUserMedia(c),microphoneConstraints(inputDevice),12000,acquisition.signal);if(generation!==captureGeneration.current||!mounted.current){input.getTracks().forEach(t=>t.stop());return;}streams.current.push(input); }
      if(generation!==captureGeneration.current||!mounted.current){cleanupTracks();return;}
      setHeardAudio(false);setLevel(0);setInputName(meeting?'Shared tab + microphone':input.getAudioTracks()[0]?.label||'Microphone');
      try{const ac=context.current||new AudioContext();context.current=ac;await ac.resume();if(generation!==captureGeneration.current||!mounted.current)return;const analyser=ac.createAnalyser();analyser.fftSize=512;ac.createMediaStreamSource(input).connect(analyser);const samples=new Uint8Array(analyser.fftSize);let last=0;const measure=(now:number)=>{if(now-last>120){analyser.getByteTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((n,x)=>n+((x-128)/128)**2,0)/samples.length);setLevel(Math.min(1,rms*8));if(rms>.003)setHeardAudio(true);last=now;}meterFrame.current=requestAnimationFrame(measure);};meterFrame.current=requestAnimationFrame(measure);}catch{setInputName('Microphone · level meter unavailable');}
      if(generation!==captureGeneration.current||!mounted.current)return;
      const draft: Draft = {id,title:title.trim() || (meeting?'Meeting':'Voice note'),startedAt:Date.now(),mime,complete:false}; await putDraft(draft);
      if(generation!==captureGeneration.current||!mounted.current){try{await deleteDraft(id);if(mounted.current)await refreshDrafts();}catch{if(mounted.current)setError('Recording startup was cancelled, but its empty draft could not be removed. Discard it under On this device.');}return;}
      const r = new MediaRecorder(input,{mimeType:mime,audioBitsPerSecond:64000}); recorder.current=r; let index=0; let captureFailed=false; let writes=Promise.resolve();
      r.ondataavailable = e => { if(!e.data.size) return; const n=index++; writes=writes.then(() => putChunk(id,n,e.data)); void writes.catch(() => {captureFailed=true;setError('Device storage is full. Recording stopped. Recover the saved portion below.'); if(r.state==='recording') r.stop();});  };
      r.onstop = () => { if(finishing.current)return; finishing.current=true; cleanupTracks(); setRecording(false); void writes.then(() => putDraft({...draft,complete:true})).then(refreshDrafts).then(()=>{if(autoAnalyze&&!captureFailed&&mounted.current)void upload({...draft,complete:true});}).catch(() => {setError('Some audio could not be saved. Check the recoverable draft.');void refreshDrafts();}); };
      r.onerror = () => { captureFailed=true; setError('Recording was interrupted. Recover the saved audio below.'); if(r.state !== 'inactive')r.stop(); else {cleanupTracks();setRecording(false);} };
      started.current=Date.now(); setSeconds(0); r.start(3000); setRecording(true);
    } catch(e) {if(generation===captureGeneration.current){cleanupTracks();if(mounted.current)setError(mediaError(e));}}finally{if(captureAcquisition.current===acquisition){captureAcquisition.current=null;if(mounted.current){setCaptureStarting(null);setBusy(false);}}}
  }
  async function importAudio(file?: File) {
    if(!file || importing.current || uploading.current || busy || recording || voice!=='idle')return;
    if(!file.size){setError('This file is empty. Choose the original recording.');return;}
    if(file.size>1000000000){setError('This upload exceeds the current 1 GB storage limit. Keep the original and split it into files before importing.');return;}
    importing.current=true;setBusy(true);setError('');setNotice('Saving the selected recording on this device…');
    const d: Draft={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,''),startedAt:Date.now(),mime:file.type||'audio/mp4',complete:true,blob:file};
    try {
      await putDraft(d);await refreshDrafts();
      if(autoAnalyze){setNotice('Local copy saved. Starting the upload…');await upload(d,true);}
      else setNotice('Saved on this device only. Tap Transcribe & summarize below when you want to upload it.');
    }catch{setNotice('');setError('Could not save the imported file on this device. Keep the original in your recording app, free some browser storage, and choose it again.');}
    finally{importing.current=false;setBusy(false);}
  }
  async function upload(draft: Draft, fromImport=false) {
    if((busy&&!fromImport) || recording || voice!=='idle'||uploading.current)return;
    uploading.current=true;setBusy(true);setError('');setFailedUploadId(null);
    try {
      if(draft.recordingId){setSelected((await request(`cupcake-recording-detail?id=${encodeURIComponent(draft.recordingId)}`)).recording);return;}
      const blob=await draftBlob(draft);
      const record=await uploadRecording({draft,blob,request,onProgress:setUploadProgress});
      setSelected(record);await putDraft({...draft,complete:true,recordingId:record.id});await refreshDrafts();
      setNotice(record.status==='ready'?'Transcript ready. Open the recording to read it.':record.status==='failed'?'The upload arrived, but processing needs attention. Open its status below.':'Upload confirmed. Cupcake is preparing your transcript; you can reopen its status from the library.');
    }catch(e){setNotice('');setFailedUploadId(draft.id);setError(`${(e as Error).message} Your original stays under On this device. Tap Resume upload to continue.`);}
    finally{uploading.current=false;setUploadProgress(null);setBusy(false);}
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
    {notice&&<div role="status" className="cc-notice">{notice}</div>}
    {captureStarting&&<div className="cc-live-bar" role="status"><span>{captureStarting==='meeting'?'Waiting for meeting sharing and microphone…':'Waiting for microphone permission and startup…'}</span><button onClick={cancelRecordingStart}>Cancel startup</button></div>}
    {(recording||voice!=='idle')&&<div className="cc-live-bar"><span className="cc-dot"/>{recording?`Recording · ${clock(seconds)}`:voice==='connecting'?'Connecting to Cupcake…':'Voice conversation active'}<button onClick={()=>recording?recorder.current?.stop():void endVoice()}>Stop</button></div>}
    <div hidden={mode!=='talk'}>
      <div className={`cc-portrait ${speaking?'is-speaking':''}`}><img src="/cupcake-avatar.jpg" alt="Cupcake"/><span className="cc-portrait-shade"/><div><span className="cc-eyebrow">YOUR PRIVATE COMPANION</span><h2>I'm listening,<br/>Matt.</h2><p>A real conversation. A little attitude.</p></div></div>
      <VoiceInputCheck deviceId={inputDevice} disabled={voice!=='idle'||recording||busy} onTesting={setMicTesting} onDevice={id=>{setInputDevice(id);saveInputDevice(id);}}/>
      <div className="cc-action-row"><button className="cc-primary" onClick={()=>voice==='idle'?void startVoice(callSeed||undefined):void endVoice()} disabled={recording||busy||micTesting}>{voice==='idle'?<Headphones size={20}/>:<Square size={18}/>} {voice==='idle'?(callSeed?'Talk to Cupcake about this call':'Talk to Cupcake'):voice==='connecting'?'Cancel connection':'End conversation'}</button>{voice==='live'&&<button className="cc-secondary" onClick={()=>{call.current?.setLocalAudio(muted);setMuted(!muted);}}>{muted?'Unmute':'Mute'}</button>}</div>
      <a className="cc-text-button" href="/cupcake?tab=library&view=messages">Browse saved Telegram and WhatsApp messages →</a>
      <p className="cc-muted">Private voice session · microphone on only after you start · live back-and-forth voice. She can search your private library and use a recent context snapshot. This conversation cannot take actions.</p>
      {voice==='live'&&<button className="cc-text-button" onClick={()=>players.current.forEach(p=>void p.play().then(()=>call.current?.sendAppMessage('playable')).catch(()=>setError('Audio is still blocked. Allow sound for hales.ai, then tap Resume audio.')))}>Resume audio</button>}
      <p className="cc-muted cc-small" role="status">{checkpointStatus||'Final transcript lines are checkpointed while you talk. Reopening never starts a call.'}</p>
      <button className="cc-text-button" onClick={()=>{try{for(const item of checkpointRecovery.current!.pending())void flushTalk(item.id)}catch(e){setCheckpointStatus(String(e))}}}>Retry transcript sync</button>
      <button className="cc-text-button" onClick={()=>{try{download(new Blob([JSON.stringify(checkpointRecovery.current!.exportOriginals(),null,2)],{type:'application/json'}),'cupcake-talk-originals.json')}catch(e){setCheckpointStatus(String(e))}}}>Export received transcripts</button>
      <div className="cc-transcript" aria-live="polite">{lines.map((l,i)=><p key={i}><strong>{l.role}</strong>{l.text}</p>)}</div>
      {voice==='idle'&&<><button className="cc-text-button" onClick={()=>void refreshTalkHistory()}>Refresh saved conversations</button><p className="cc-muted cc-small" role="status">{historyStatus}</p><TalkHistory talks={talks} selected={openedTalk} onOpen={talk=>void openTalk(talk)} onClose={()=>{openingTalk.current++;setOpenedTalk(null)}} onContinue={talk=>void startVoice(talk)} onSave={talk=>void syncTalk(talk)} onArchive={(talk,archived)=>{checkpointRecovery.current!.setArchived(talk.id,archived);setTalks(current=>current.map(t=>t.id===talk.id?{...t,archived}:t));openingTalk.current++;setOpenedTalk(null);if(checkpointRecovery.current!.warning())setCheckpointStatus(checkpointRecovery.current!.warning());}}/></>}
    </div>
    <div hidden={mode!=='record'}>
      <span className="cc-eyebrow">RECORD & REMEMBER</span><h2>Catch the conversation.<br/><em>Keep what matters.</em></h2>
      <p className="cc-muted">Record a voice note or conversation, or import a Samsung recording. Cupcake turns it into a transcript, summary, and commitments you can review.</p>
      <label className="cc-label">Recording title<input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="A thought, a meeting, a promise…" disabled={recording}/></label>
      <label className="cc-auto"><input type="checkbox" checked={autoAnalyze} disabled={recording||busy} onChange={e=>setAutoAnalyze(e.target.checked)}/>Automatically transcribe recordings and files I choose</label>
      <div className={`cc-recorder ${recording?'is-recording':''}`}><div className="cc-wave" aria-hidden="true">{Array.from({length:27},(_,i)=><i key={i} style={{height:`${recording?3+level*(12+((i*17)%49)):12+((i*17)%49)}px`}}/>)}</div><div className="cc-timer">{clock(seconds)}</div><button className="cc-record-button" onClick={()=>recording?recorder.current?.stop():void startRecording(false)} disabled={voice!=='idle'||busy||micTesting} aria-label={recording?'Stop recording':'Start microphone recording'}>{recording?<Square fill="currentColor"/>:<Mic size={28}/>}</button><p>{recording?'Recording · tap to stop':'Tap to record'}</p>{recording&&<div className="cc-input-status"><span>{inputName}</span><div className="cc-level" role="meter" aria-label="Audio input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level*100)}><i style={{width:`${Math.max(1,level*100)}%`}}/></div><p role="status">{heardAudio?'Audio detected':seconds>2?'No audio detected yet. Speak and check your microphone.':'Listening for audio…'}</p></div>}</div>
      <div className="cc-action-row"><button className="cc-secondary" onClick={()=>void startRecording(true)} disabled={recording||voice!=='idle'||busy||micTesting}><Monitor size={18}/>Meeting tab + mic</button><label className="cc-secondary cc-file"><Upload size={18}/>Import audio<input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.mp4" disabled={recording||voice!=='idle'||busy} onChange={e=>{void importAudio(e.target.files?.[0]);e.target.value='';}}/></label></div>
      <p className="cc-muted">No fixed recording-duration cap. Current upload storage limit: 1 GB per file. Keep this app open while recording; use Samsung Recorder for long background recordings. Meeting audio requires a desktop browser and its sharing picker; phone-call capture is not supported here.</p>
      <div className="cc-privacy"><LockKeyhole size={18}/><span>With automatic transcription on, stopping a recording or choosing an audio file uploads it to your private server and configured AI provider. Turn it off to save locally first. Only the file you choose is imported; your other recordings stay untouched.</span></div>
      {!!local.length&&<h3>On this device</h3>}{local.map(d=><article className="cc-card" key={d.id}><strong>{d.title}</strong>{uploadProgress?.id===d.id&&<div className="cc-upload-progress" role="status"><progress max={uploadProgress.total} value={uploadProgress.received}/><span>{uploadLabel(uploadProgress.received,uploadProgress.total)}</span><small>{uploadProgress.retryAttempt?`Connection interrupted · retrying (${uploadProgress.retryAttempt}/2)…`:uploadProgress.phase==='finishing'?'All parts received. Preparing the transcript job…':'Server-confirmed bytes · keep this page open'}</small></div>}<p className="cc-muted">{d.recordingId?'Uploaded · original still on this device':d.complete?'Ready to transcribe':'Interrupted recording · recover saved audio'}</p><div className="cc-action-row"><button className="cc-primary" disabled={busy||recording||voice!=='idle'} onClick={()=>void upload(d)}>{uploadProgress?.id===d.id?(uploadProgress.phase==='finishing'?'Finishing upload…':'Uploading this recording…'):d.recordingId?'Open transcript status':failedUploadId===d.id?'Resume upload':'Transcribe & summarize'}</button><button className="cc-secondary" disabled={recording||voice!=='idle'} onClick={()=>void draftBlob(d).then(b=>setPreview({id:d.id,url:URL.createObjectURL(b)}))}>Listen to original</button><button className="cc-secondary" onClick={()=>void draftBlob(d).then(b=>download(b,`${d.title}.${extension(d.mime)}`))} aria-label="Download original audio"><Download size={18}/></button><button className="cc-text-button" disabled={busy||recording} onClick={()=>{if(confirm('Delete this local audio draft?'))void deleteDraft(d.id).then(refreshDrafts);}}>Discard</button></div>{preview?.id===d.id&&<audio controls src={preview.url} aria-label="Original recording playback" style={{width:'100%'}}/>}</article>)}
    </div>
    <div hidden={mode!=='library'}><LibraryWorkspace active={mode==='library'} onOpenRecording={id=>void openRecord(id)} onWork={setLibraryBusy}/></div>
    {selected&&<ConversationPanel key={selected.id} record={selected} onClose={()=>{setSelected(null);setQuestionError('');}} onAsk={ask} onRetry={()=>void retry()} asking={asking} questionError={questionError} retrying={busy} onOrganized={(project,tags)=>setSelected(current=>current?{...current,project,tags}:current)}/>}
  </section>;
}
