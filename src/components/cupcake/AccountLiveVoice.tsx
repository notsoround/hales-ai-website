import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { Headphones, Mic, Square, Volume2 } from 'lucide-react';
import { AccountVoiceClient, voiceError, type VoiceConfig, type VoiceRecovery, type VoiceSession } from './accountVoice';
import { subscribeSession } from './accountSession';
import { cupcakeHref } from './accountMode';
import { acquireMicrophone, microphoneConstraints, microphoneMessage, readInputDevice, saveInputDevice } from './voiceInput';
import VoiceInputCheck from './VoiceInputCheck';
import { closeVoiceTransport } from './voiceHistory';
import './account-live-voice.css';

type MediaState = 'idle' | 'connecting' | 'live' | 'ending';
type ProvisionalLine = { role: 'user' | 'assistant'; text: string };
const MAX_POLLS = 40;
const terminal = (session: VoiceSession | null) => session?.state === 'ended' || (session?.state === 'failed' && session.reason === 'voice_not_dispatched');
const hasSpeech = (session: VoiceSession | null) => !!session?.result && (!!session.result.transcript?.trim() || session.result.messages.some(line => line.message.trim()));
const deadline = (value: unknown) => typeof value === 'number' ? value * 1000 : typeof value === 'string' ? Date.parse(value) : NaN;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const dateLabel = (value: unknown) => { const time = deadline(value); return Number.isFinite(time) ? new Date(time).toLocaleString() : 'Saved conversation'; };

export default function AccountLiveVoice({ assistantName, active, keepMediaOnHide, disabled, onStateChange, onStopReady, onTestingChange }: {
  assistantName: string; active: boolean; keepMediaOnHide: boolean; disabled: boolean;
  onStateChange: (state: MediaState) => void; onStopReady: (stop: (() => void) | null) => void;
  onTestingChange?: (testing: boolean) => void;
}) {
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [session, setSession] = useState<VoiceSession | null>(null), [recovery, setRecovery] = useState<VoiceRecovery | null>(null);
  const [rows, setRows] = useState<VoiceSession[]>([]), [opened, setOpened] = useState<VoiceSession | null>(null);
  const [mediaState, setMediaState] = useState<MediaState>('idle'), [checking, setChecking] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('Microphone off until you start.');
  const [missing, setMissing] = useState(false), [muted, setMuted] = useState(false), [audioBlocked, setAudioBlocked] = useState(false);
  const [provisional, setProvisional] = useState<ProvisionalLine[]>([]), [remaining, setRemaining] = useState<number | null>(null);
  const [inputDevice, setInputDevice] = useState(readInputDevice), [testing, setTesting] = useState(false), [polls, setPolls] = useState(0);
  const alive = useRef(false), generation = useRef(0), client = useRef<AccountVoiceClient | null>(null);
  const currentSession = useRef<VoiceSession | null>(null), currentRecovery = useRef<VoiceRecovery | null>(null);
  const state = useRef<MediaState>('idle'), acquisition = useRef<AbortController | null>(null), microphone = useRef<MediaStream | null>(null);
  const transport = useRef<DailyCall | null>(null), players = useRef(new Map<string, HTMLAudioElement>());
  const stopRequested = useRef(false), connecting = useRef(false), reading = useRef(false), ending = useRef(false), joinedDeadline = useRef(0);
  const locallyUnsent = useRef(false);
  const transcriptIds = useRef(new Set<string>());
  const callbacks = useRef({ onStateChange, onStopReady, onTestingChange }); callbacks.current = { onStateChange, onStopReady, onTestingChange };

  const changeState = useCallback((next: MediaState) => { state.current = next; if (alive.current) setMediaState(next); callbacks.current.onStateChange(next); }, []);
  // Close capture and playback before awaiting any transport or server response.
  const stopLocal = useCallback(() => {
    generation.current++; acquisition.current?.abort(); acquisition.current = null;
    microphone.current?.getTracks().forEach(track => track.stop()); microphone.current = null;
    players.current.forEach(player => { player.pause(); player.srcObject = null; }); players.current.clear();
    const call = transport.current; transport.current = null; joinedDeadline.current = 0;
    if (call) void closeVoiceTransport(call, () => {}, 1000);
    if (alive.current) { setMuted(false); setAudioBlocked(false); setRemaining(null); }
  }, []);

  const remember = useCallback((value: VoiceSession, owner: AccountVoiceClient) => {
    if (!alive.current || client.current !== owner) return;
    currentSession.current = value; setSession(value); setMissing(false);
    if (terminal(value)) {
      stopLocal(); changeState('idle'); owner.clearRecovery(value.sessionId); currentRecovery.current = null; setRecovery(null); stopRequested.current = false;
      if (value.state === 'ended') { setRows(previous => [value, ...previous.filter(row => row.sessionId !== value.sessionId)].slice(0, 25)); setOpened(value); }
      setProvisional([]);
      setNotice(value.state === 'failed' ? 'The server confirmed this request was never sent. Microphone off; you can start when ready.' : hasSpeech(value) ? 'Conversation ended. The provider-fetched transcript is saved to your account.' : 'Conversation ended. No speech transcript was returned.');
    } else if (value.state === 'ending' || stopRequested.current) {
      stopLocal(); changeState('ending'); setNotice('Microphone off. Waiting for the server to confirm the conversation ended.');
    } else if (value.state === 'uncertain' || value.state === 'failed') {
      stopLocal(); changeState('idle'); setNotice('Microphone off. This saved request needs a status check before another conversation can start.');
    }
  }, [changeState, stopLocal]);

  const finish = useCallback(async (owner: AccountVoiceClient, value: VoiceSession) => {
    if (ending.current) return;
    ending.current = true;
    try { remember(await owner.end(value.sessionId), owner); }
    catch (cause) { if (alive.current && client.current === owner) { setError(voiceError(cause)); setNotice('Microphone off. Ending is not confirmed; check the same saved conversation.'); changeState('ending'); } }
    finally { ending.current = false; }
  }, [changeState, remember]);

  const stop = useCallback(() => {
    stopRequested.current = true; stopLocal();
    const owner = client.current, value = currentSession.current;
    if (!owner) return;
    if (value && !terminal(value)) { changeState('ending'); setNotice('Microphone off. Confirming the conversation has ended…'); void finish(owner, value); }
    else if (currentRecovery.current && !locallyUnsent.current) { changeState('ending'); setNotice('Microphone off. The saved request is kept; check its status to confirm whether a conversation started.'); }
    else if (currentRecovery.current) { setMissing(true); changeState('idle'); setNotice('Startup cancelled. Microphone off. No paid voice request was sent; its saved request ID is kept.'); }
    else { stopRequested.current = false; changeState('idle'); setNotice('Startup cancelled. Microphone off.'); }
  }, [changeState, finish, stopLocal]);

  const checkCurrent = useCallback(async (resetPolls = true) => {
    const owner = client.current, saved = currentRecovery.current, value = currentSession.current;
    if (!owner || reading.current || connecting.current || (!saved && !value)) return;
    reading.current = true; setChecking(true); if (resetPolls) setPolls(0);
    try {
      const next = value ? await owner.status(value.sessionId) : await owner.recover(saved!.requestId);
      if (!alive.current || client.current !== owner) return;
      setError(''); remember(next, owner);
      if (stopRequested.current && !terminal(next)) void finish(owner, next);
    } catch (cause) {
      if (!alive.current || client.current !== owner) return;
      setMissing((cause as { code?: string })?.code === 'voice_session_not_found'); setError(voiceError(cause));
    } finally { reading.current = false; if (alive.current && client.current === owner) setChecking(false); }
  }, [finish, remember]);

  const refresh = useCallback(async () => {
    const owner = client.current; if (!owner) return;
    setChecking(true);
    const results = await Promise.allSettled([owner.config(), owner.list()]);
    if (!alive.current || client.current !== owner) return;
    if (results[0].status === 'fulfilled') setConfig(results[0].value); else setError(voiceError(results[0].reason));
    if (results[1].status === 'fulfilled') setRows(results[1].value); else setError(voiceError(results[1].reason));
    setChecking(false);
  }, []);

  useEffect(() => {
    alive.current = true; const owner = new AccountVoiceClient(); client.current = owner;
    try { const saved = owner.readRecovery(); currentRecovery.current = saved; setRecovery(saved); }
    catch (cause) { setError(voiceError(cause)); }
    const pagehide = () => {
      stopRequested.current = true; stopLocal(); const value = currentSession.current;
      if (value && !terminal(value)) {
        changeState('ending'); setNotice('Microphone off. Check the saved status when you return to confirm the conversation ended.');
        owner.endOnPageHide(value.sessionId);
      } else if (currentRecovery.current && !locallyUnsent.current) {
        changeState('ending'); setNotice('Microphone off. The saved request needs a status check when you return.');
      } else { changeState('idle'); setNotice('Microphone off. No new voice request will start automatically.'); }
    };
    const pageshow = () => { void checkCurrent(); };
    const unsubscribe = subscribeSession(() => { stopRequested.current = true; stopLocal(); const value = currentSession.current; if (value && !terminal(value)) owner.endOnPageHide(value.sessionId); changeState('idle'); setSession(null); setRows([]); setOpened(null); setProvisional([]); setConfig(null); setRecovery(null); currentSession.current = null; currentRecovery.current = null; });
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    return () => { alive.current = false; unsubscribe(); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow); stopRequested.current = true; stopLocal(); const value = currentSession.current; if (value && !terminal(value)) owner.endOnPageHide(value.sessionId); owner.dispose(); if (client.current === owner) client.current = null; callbacks.current.onStopReady(null); callbacks.current.onStateChange('idle'); callbacks.current.onTestingChange?.(false); };
  }, [changeState, stopLocal, checkCurrent]);
  useEffect(() => { callbacks.current.onStopReady(stop); return () => callbacks.current.onStopReady(null); }, [stop]);
  useEffect(() => { if (!active) return; void refresh(); void checkCurrent(); }, [active, refresh, checkCurrent]);
  useEffect(() => { if (!active && !keepMediaOnHide && (state.current === 'live' || state.current === 'connecting')) stop(); }, [active, keepMediaOnHide, stop]);
  useEffect(() => { if (!active) { setTesting(false); callbacks.current.onTestingChange?.(false); } }, [active]);
  useEffect(() => {
    if (!session || terminal(session) || session.state === 'failed' || polls >= MAX_POLLS || checking || connecting.current || (!active && mediaState === 'idle')) return;
    const timer = window.setTimeout(() => { setPolls(value => value + 1); void checkCurrent(false); }, 3000);
    return () => clearTimeout(timer);
  }, [active, session, mediaState, checking, polls, checkCurrent]);
  useEffect(() => {
    if (mediaState !== 'live') return;
    const tick = () => { const end = Math.min(joinedDeadline.current || Infinity, deadline(currentSession.current?.expiresAt) || Infinity); const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000)); setRemaining(Number.isFinite(seconds) ? seconds : null); if (seconds <= 0) stop(); };
    tick(); const timer = window.setInterval(tick, 250); return () => clearInterval(timer);
  }, [mediaState, stop]);
  useEffect(() => { if (mediaState === 'idle') return; const warn = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [mediaState]);

  async function connect(intent: 'start' | 'resume') {
    const owner = client.current;
    if (!owner || !active || disabled || testing || connecting.current || state.current !== 'idle' || !config?.available) return;
    if (intent === 'start' && currentRecovery.current && !missing) return;
    if (intent === 'resume' && (!currentRecovery.current || !currentSession.current || terminal(currentSession.current))) return;
    connecting.current = true; stopRequested.current = false; setError(''); setNotice('Waiting for microphone permission and startup…'); setPolls(0); changeState('connecting');
    const token = ++generation.current, controller = new AbortController(); acquisition.current = controller;
    let dispatched = false;
    try {
      // The explicit start saves its id before capture; denied permission never sends it.
      const saved = intent === 'start' ? owner.prepare() : currentRecovery.current!;
      currentRecovery.current = saved; setRecovery(saved);
      locallyUnsent.current = intent === 'start';
      if (intent === 'start' && terminal(currentSession.current)) { currentSession.current = null; setSession(null); }
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Voice needs a supported browser with microphone access over HTTPS.');
      const mic = await acquireMicrophone(constraints => navigator.mediaDevices.getUserMedia(constraints), microphoneConstraints(inputDevice), 12000, controller.signal);
      if (!alive.current || client.current !== owner || token !== generation.current) { mic.getTracks().forEach(track => track.stop()); return; }
      microphone.current = mic;
      const Daily = (await import('@daily-co/daily-js')).default;
      if (!alive.current || client.current !== owner || token !== generation.current) return;
      dispatched = true; locallyUnsent.current = false;
      setNotice(intent === 'resume' ? 'Reopening the same saved conversation…' : 'Starting the saved voice request…');
      const value = intent === 'resume' ? await owner.recover(saved.requestId) : await owner.start(saved.requestId);
      if (!alive.current || client.current !== owner || token !== generation.current || stopRequested.current) {
        if (!terminal(value)) { if (alive.current && client.current === owner) { currentSession.current = value; setSession(value); void finish(owner, value); } else owner.endOnPageHide(value.sessionId); }
        return;
      }
      remember(value, owner);
      if (terminal(value)) return;
      if (value.state !== 'live' || !value.webCallUrl) { stopLocal(); changeState(value.state === 'ending' ? 'ending' : 'idle'); setNotice('Microphone off. The saved request has not confirmed a joinable conversation. Check its status.'); return; }
      const call = Daily.createCallObject({ audioSource: mic.getAudioTracks()[0], videoSource: false, startVideoOff: true }); transport.current = call;
      const current = () => alive.current && client.current === owner && token === generation.current && transport.current === call;
      transcriptIds.current.clear(); setProvisional([]); setOpened(null);
      call.on('track-started', event => {
        if (!current() || event?.track.kind !== 'audio' || event.participant?.local) return;
        const player = new Audio(); player.autoplay = true; player.srcObject = new MediaStream([event.track]); players.current.set(event.track.id, player);
        void player.play().then(() => { if (current()) call.sendAppMessage('playable'); }).catch(() => { if (current()) setAudioBlocked(true); });
      });
      call.on('track-stopped', event => { const player = event?.track && players.current.get(event.track.id); if (player) { player.pause(); player.srcObject = null; players.current.delete(event!.track.id); } });
      call.on('app-message', event => {
        if (!current()) return;
        let data = event?.data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
        if (!data || typeof data !== 'object' || data.type !== 'transcript' || data.transcriptType !== 'final' || !['user', 'assistant'].includes(data.role) || typeof data.transcript !== 'string') return;
        const text = data.transcript.trim().slice(0, 10000); if (!text) return;
        const id = typeof (data.id || data.messageId || data.transcriptId) === 'string' ? data.id || data.messageId || data.transcriptId : `${data.role}:${text}`;
        if (transcriptIds.current.has(id)) return; transcriptIds.current.add(id);
        setProvisional(previous => [...previous, { role: data.role, text }].slice(-100));
      });
      call.on('left-meeting', () => { if (current()) stop(); });
      call.on('error', () => { if (current()) { setError('The audio connection was interrupted. Microphone off; checking this saved conversation.'); stop(); } });
      await call.join({ url: value.webCallUrl });
      if (!current() || stopRequested.current) { try { await call.destroy(); } catch { /* Local audio was already stopped. */ } return; }
      joinedDeadline.current = Date.now() + value.maxSeconds * 1000; setMuted(false); changeState('live'); setNotice('Microphone live. Your conversation will stop at its time limit.');
    } catch (cause) {
      if (!alive.current || client.current !== owner || token !== generation.current) return;
      stopLocal(); setError(dispatched ? voiceError(cause) : microphoneMessage(cause as Error));
      if (dispatched && currentSession.current && !terminal(currentSession.current)) { stopRequested.current = true; changeState('ending'); void finish(owner, currentSession.current); }
      else { changeState('idle'); if (!dispatched && intent === 'start') setMissing(true); setNotice(dispatched ? 'Microphone off. This request may have started. Check its saved status; it will not be sent again automatically.' : 'Microphone off. No paid voice request was sent.'); }
    } finally {
      connecting.current = false; if (acquisition.current === controller) acquisition.current = null;
    }
  }

  async function open(row: VoiceSession) {
    const owner = client.current; if (!owner || checking) return;
    setChecking(true); setError('');
    try { const value = await owner.status(row.sessionId); if (alive.current && client.current === owner) setOpened(value); }
    catch (cause) { if (alive.current && client.current === owner) setError(voiceError(cause)); }
    finally { if (alive.current && client.current === owner) setChecking(false); }
  }
  const pending = !!recovery && !terminal(session);
  const canResume = pending && session?.state === 'live' && mediaState === 'idle';
  const result = opened?.state === 'ended' ? opened.result : null;
  const resultMessages = result?.messages || [];
  return <section className="cc-account-voice" aria-label="Account live voice">
    <h2 className="cc-talk-heading">Live voice with {assistantName}</h2>
    <p className="cc-muted">Talk back and forth using your microphone. Voice uses your account’s shared AI allowance alongside text, photo estimates and transcription.</p>
    <p className="cc-muted cc-small">Starting sends your microphone audio and saved account context to the voice provider.</p>
    {config && <p className="cc-muted cc-small">Up to {config.maxSeconds} seconds per conversation. Starting reserves ${(config.reservedMicros / 1000000).toFixed(2)} of that allowance while provider usage is checked; this reservation is not an invoice.</p>}
    {!config?.available && <p role="status" className="cc-muted">{config ? `Live voice is currently unavailable. You can still use Text or Record.` : 'Checking live voice availability…'}</p>}
    <div className="cc-action-row">
      {!pending && mediaState === 'idle' && <button className="cc-primary" disabled={!active || disabled || testing || checking || !config?.available} onClick={() => void connect('start')}><Headphones size={20}/>Start conversation</button>}
      {missing && pending && mediaState === 'idle' && <button className="cc-primary" disabled={!active || disabled || testing || checking || !config?.available} onClick={() => void connect('start')}>Send saved voice request</button>}
      {canResume && <button className="cc-primary" disabled={!active || disabled || testing || checking || !config?.available} onClick={() => void connect('resume')}><Headphones size={20}/>Resume same conversation</button>}
      {mediaState !== 'idle' && <button className="cc-primary" onClick={stop} disabled={mediaState === 'ending' && ending.current}><Square size={18}/>{mediaState === 'connecting' ? 'Cancel connection' : mediaState === 'ending' ? 'Retry ending conversation' : 'End conversation'}</button>}
      {pending && mediaState === 'idle' && !missing && <button className="cc-secondary" onClick={stop} disabled={checking}>End saved conversation</button>}
      {pending && <button className="cc-secondary" disabled={checking || mediaState === 'connecting'} onClick={() => void checkCurrent()}>{checking ? 'Checking conversation…' : 'Check saved status'}</button>}
      {mediaState === 'live' && <><button className="cc-secondary" onClick={() => { const next = !muted; microphone.current?.getAudioTracks().forEach(track => { track.enabled = !next; }); void transport.current?.setLocalAudio(!next); setMuted(next); }}><Mic size={17}/>{muted ? 'Unmute microphone' : 'Mute microphone'}</button><button className="cc-text-button" onClick={() => { players.current.forEach(player => void player.play().then(() => { transport.current?.sendAppMessage('playable'); setAudioBlocked(false); }).catch(() => setAudioBlocked(true))); }}><Volume2 size={17}/>Resume audio</button></>}
    </div>
    <p role="status" className="cc-muted cc-small cc-mic-line">{notice}{mediaState === 'live' && muted ? ' Microphone muted.' : ''}{remaining !== null ? ` ${clock(remaining)} remaining.` : ''}</p>
    {audioBlocked && <p role="alert">Audio playback is blocked. Tap Resume audio and allow sound in this browser.</p>}
    {error && <p role="alert" className="cc-voice-error">{error}</p>}
    {polls >= MAX_POLLS && pending && <p className="cc-muted cc-small">Automatic status checks paused. Use Check saved status later. A new conversation remains blocked until this one is confirmed ended.</p>}
    {pending && <p className="cc-muted cc-small">Reopening this page only checks your saved request. It never starts or joins a call, turns on the microphone, or repeats a paid request automatically.</p>}
    <details className="cc-fold"><summary>Microphone settings</summary>{active && <VoiceInputCheck deviceId={inputDevice} disabled={disabled || mediaState !== 'idle'} onTesting={value => { setTesting(value); callbacks.current.onTestingChange?.(value); }} onDevice={id => { setInputDevice(id); saveInputDevice(id); }}/>}</details>
    {!!provisional.length && <section className="cc-voice-provisional"><h3>Live captions · provisional</h3><p className="cc-muted cc-small">Temporary connection messages. They may be incomplete and are not your saved transcript.</p><div className="cc-transcript" aria-live="polite">{provisional.map((line, index) => <p key={index}><strong>{line.role === 'user' ? 'You' : assistantName}</strong>{line.text}</p>)}</div></section>}
    <section className="cc-voice-history" aria-label="Saved voice conversations"><div className="cc-heading-row"><h3>Saved voice conversations</h3><button className="cc-text-button" disabled={checking} onClick={() => void refresh()}>Refresh history</button></div><p className="cc-muted cc-small">Your latest 25 ended conversations. Opening one keeps the microphone off.</p>
      {!rows.length && <p className="cc-muted">No saved voice conversations loaded.</p>}
      {rows.map(row => <article key={row.sessionId} className="cc-card"><strong>{dateLabel(row.createdAt || row.result?.startedAt)}</strong><div className="cc-action-row"><button className="cc-secondary" disabled={checking} onClick={() => void open(row)}>Open saved conversation</button>{row.documentId && <a className="cc-text-button" href={cupcakeHref(`/cupcake?tab=library&document=${encodeURIComponent(row.documentId)}`)}>View source transcript</a>}</div></article>)}
      {opened && <article className="cc-card cc-voice-saved"><div className="cc-heading-row"><h3>Saved conversation</h3><button className="cc-text-button" onClick={() => setOpened(null)}>Close transcript</button></div>{result && hasSpeech(opened) ? <><p className="cc-muted cc-small">Provider-fetched speech-to-text estimate · may contain errors. This is the saved transcript, separate from temporary live captions.</p>{resultMessages.length ? resultMessages.map((message, index) => <p className="cc-voice-line" key={message.providerMessageId || index}><strong>{message.role === 'user' ? 'You' : assistantName}</strong>{message.message}</p>) : <p className="cc-voice-line">{result.transcript || 'No speech text was returned for this conversation.'}</p>}</> : <p className="cc-muted">No provider-fetched transcript is available for this ended conversation.</p>}{opened.documentId && <a className="cc-text-button" href={cupcakeHref(`/cupcake?tab=library&document=${encodeURIComponent(opened.documentId)}`)}>View source transcript</a>}</article>}
    </section>
  </section>;
}
