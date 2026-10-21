import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatInfo, ChatTurn } from './viewerApi.ts';
import { CHAT_MAX, SUGGESTIONS, ViewerAuthError, WELCOME, endVoice, fetchChatInfo, markdownLight, sendChat, startVoice } from './viewerApi.ts';

// @vapi-ai/web is CJS (`exports.default = Vapi`); depending on interop the default import is the
// constructor or `{ default: Constructor }` (same handling as src/hooks/use-vapi.ts).
type VoiceMessage = { type?: string; transcriptType?: string; role?: string; transcript?: string };
type VapiLike = {
  on: (event: string, handler: (...args: never[]) => void) => void;
  reconnect: (call: { id: string; webCallUrl: string }) => Promise<void>;
  stop: () => void | Promise<void>;
  setMuted: (mute: boolean) => void;
  removeAllListeners?: () => void;
};
type VapiCtor = new (key: string) => VapiLike;
/** Loaded on first use so the overview itself stays light. */
async function loadVapi(): Promise<VapiCtor> {
  const mod = await import('@vapi-ai/web') as unknown as { default?: VapiCtor | { default?: VapiCtor } };
  const d = mod.default as { default?: VapiCtor } | VapiCtor | undefined;
  return ((d && typeof d === 'object' && 'default' in d ? d.default : d) ?? (mod as unknown as VapiCtor)) as VapiCtor;
}

type Voice = 'idle' | 'mic' | 'connecting' | 'live' | 'ended' | 'error';
type Caption = { role: 'user' | 'assistant'; text: string };

function Rich({ text }: { text: string }) {
  const lines = markdownLight(text);
  return <>{lines.map((l, i) => l.segs.length === 0 ? <br key={i} /> : (
    <p key={i} className={l.bullet ? 'rv-md-li' : undefined}>{l.segs.map((s, j) => s.bold ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>)}</p>
  ))}</>;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function CupcakePanel({ token, open, onClose, onExpired }: { token: string; open: boolean; onClose: () => void; onExpired: () => void }) {
  const [info, setInfo] = useState<ChatInfo | null | 'error'>(null);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [voice, setVoice] = useState<Voice>('idle');
  const [voiceNote, setVoiceNote] = useState('');
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [partial, setPartial] = useState<Caption | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(600);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const vapi = useRef<VapiLike | null>(null);
  const session = useRef<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || info !== null) return;
    fetchChatInfo(token).then(setInfo).catch(e => { if (e instanceof ViewerAuthError) onExpired(); else setInfo('error'); });
  }, [open, info, token, onExpired]);

  useEffect(() => {
    if (info && info !== 'error' && !info.voice && info.available) setMode('text');
  }, [info]);

  const finish = useCallback(() => {
    const id = session.current; session.current = null;
    if (id) endVoice(token, id).catch(() => undefined);
  }, [token]);

  const stop = useCallback(() => {
    const v = vapi.current; vapi.current = null;
    try { void v?.stop(); } catch { /* already gone */ }
    finish();
    setVoice(s => (s === 'live' || s === 'connecting' ? 'ended' : s)); setSpeaking(false); setLevel(0); setPartial(null);
  }, [finish]);

  useEffect(() => () => { const v = vapi.current; vapi.current = null; try { void v?.stop(); } catch { /* ignore */ } }, []);
  useEffect(() => () => finish(), [finish]);

  useEffect(() => { panel.current?.toggleAttribute('inert', !open); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (voice !== 'live') return;
    const started = Date.now();
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [voice]);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' }); }, [captions, partial, turns, sending]);

  const begin = async () => {
    setVoiceNote(''); setCaptions([]); setPartial(null); setElapsed(0); setMuted(false);
    setVoice('mic');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      setVoice('error'); setVoiceNote('Microphone access is needed for a voice conversation. You can allow it in the browser settings, or type instead.');
      return;
    }
    setVoice('connecting');
    try {
      const started = await startVoice(token);
      session.current = started.session; setMaxSeconds(started.maxSeconds);
      const Vapi = await loadVapi();
      const v = new Vapi('robyn-viewer-session');   // no key: the call was created server-side; the browser only joins it
      vapi.current = v;
      v.on('call-start', () => setVoice('live'));
      v.on('call-end', () => { if (vapi.current === v) { vapi.current = null; } finish(); setVoice('ended'); setSpeaking(false); setLevel(0); setPartial(null); });
      v.on('speech-start', () => setSpeaking(true));
      v.on('speech-end', () => setSpeaking(false));
      v.on('volume-level', ((n: number) => setLevel(Math.max(0, Math.min(1, n)))) as never);
      v.on('message', ((m: VoiceMessage) => {
        if (m.type !== 'transcript' || !m.transcript || (m.role !== 'user' && m.role !== 'assistant')) return;
        const c: Caption = { role: m.role, text: m.transcript };
        if (m.transcriptType === 'final') { setPartial(null); setCaptions(list => [...list, c].slice(-40)); } else setPartial(c);
      }) as never);
      v.on('error', (() => { if (vapi.current === v) { setVoiceNote('The voice connection dropped. You can start again or type instead.'); stop(); setVoice('error'); } }) as never);
      await v.reconnect(started.webCall);
    } catch (e) {
      if (e instanceof ViewerAuthError) return onExpired();
      stop(); setVoice('error');
      setVoiceNote(e instanceof Error && e.message !== 'unavailable' && !/temporarily/.test(e.message) ? e.message : 'Voice isn’t available right now. You can type instead.');
    }
  };

  const toggleMute = () => { const next = !muted; vapi.current?.setMuted(next); setMuted(next); };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setChatError(''); setDraft('');
    const history = turns;
    setTurns(t => [...t, { role: 'user', content: message }]); setSending(true);
    try {
      const answer = await sendChat(token, message, history);
      setTurns(t => [...t, { role: 'assistant', content: answer }]);
    } catch (e) {
      if (e instanceof ViewerAuthError) return onExpired();
      setTurns(t => t.slice(0, -1)); setDraft(message);
      setChatError(e instanceof Error && e.message !== 'unavailable' && !/temporarily/.test(e.message) ? e.message : 'Cupcake couldn’t answer just now. Please try again in a moment.');
    } finally { setSending(false); }
  };

  const unavailable = info === 'error' || (info !== null && !info.available && !info.voice);
  const remaining = Math.max(0, maxSeconds - elapsed);
  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const orbScale = reducedMotion() ? 1 : 1 + (voice === 'live' ? (speaking ? 0.06 + level * 0.22 : 0.02 + level * 0.1) : 0);
  const status = { idle: 'Talk with Cupcake about this report', mic: 'Waiting for microphone permission…', connecting: 'Connecting…',
    live: muted ? 'Muted' : speaking ? 'Cupcake is speaking' : 'Listening', ended: 'Conversation ended', error: 'Voice unavailable' }[voice];

  return (
    <aside className={open ? 'rv-panel rv-open' : 'rv-panel'} aria-hidden={!open} aria-label="Ask Cupcake" tabIndex={-1} ref={panel}>
      <header className="rv-panel-head">
        <img src="/cupcake-avatar.jpg" alt="" className="rv-panel-avatar" />
        <div><h2>Ask Cupcake</h2><span className="rv-sub">About Matt&rsquo;s logged data</span></div>
        {info && info !== 'error' && info.voice && info.available && (
          <div className="rv-seg rv-seg-sm" role="radiogroup" aria-label="Conversation mode" style={{ ['--rv-i' as string]: mode === 'voice' ? 0 : 1 }}>
            <span className="rv-seg-thumb" aria-hidden="true" />
            <button role="radio" aria-checked={mode === 'voice'} className={mode === 'voice' ? 'rv-on' : ''} onClick={() => setMode('voice')}>Voice</button>
            <button role="radio" aria-checked={mode === 'text'} className={mode === 'text' ? 'rv-on' : ''} onClick={() => { if (voice === 'live' || voice === 'connecting') stop(); setMode('text'); }}>Text</button>
          </div>
        )}
        <button className="rv-icon-btn" aria-label="Close" onClick={onClose}><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>
      </header>

      {info === null ? <div className="rv-panel-center"><div className="rv-sheet-loading"><span /><span /><span /></div></div>
        : unavailable ? <div className="rv-panel-center"><div className="rv-unavail"><h3>Chat isn&rsquo;t available yet</h3><p>The overview, details and export work as usual.</p></div></div>
          : mode === 'voice' ? (
            <div className="rv-voice">
              <div className="rv-voice-stage">
                <div className={`rv-orb rv-orb-${voice}${speaking ? ' rv-orb-speaking' : ''}`} style={{ transform: `scale(${orbScale.toFixed(3)})` }} aria-hidden="true"><span /><span /><span /></div>
                <div className="rv-voice-status" aria-live="polite">{status}{voice === 'live' && <span className="rv-voice-clock">{clock} left</span>}</div>
                {voiceNote && <p className="rv-voice-note" role="alert">{voiceNote}</p>}
              </div>
              <div className="rv-captions" ref={scroller} aria-live="polite">
                {captions.length === 0 && !partial && (voice === 'idle' || voice === 'mic') && <p className="rv-caption-hint">Cupcake greets you first. Ask about this week, compare periods, or go through a specific day. Conversations end after {Math.round(maxSeconds / 60)} minutes.</p>}
                {captions.map((c, i) => <p key={i} className={`rv-caption rv-caption-${c.role}`}><span>{c.role === 'assistant' ? 'Cupcake' : 'You'}</span>{c.text}</p>)}
                {partial && <p className={`rv-caption rv-caption-${partial.role} rv-caption-partial`}><span>{partial.role === 'assistant' ? 'Cupcake' : 'You'}</span>{partial.text}</p>}
              </div>
              <div className="rv-voice-controls">
                {voice === 'live' || voice === 'connecting' ? <>
                  <button className={`rv-round ${muted ? 'rv-round-on' : ''}`} onClick={toggleMute} disabled={voice !== 'live'} aria-pressed={muted} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
                    <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0M12 18v3" />{muted && <path d="M4 4l16 16" />}</svg>
                  </button>
                  <button className="rv-round rv-round-end" onClick={stop} aria-label="End conversation"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </> : <button className="rv-button rv-button-lg" onClick={begin} disabled={voice === 'mic'}>{voice === 'ended' || voice === 'error' ? 'Start again' : 'Start conversation'}</button>}
                {typeof info === "object" && info.available && <button className="rv-link" onClick={() => { if (voice === 'live' || voice === 'connecting') stop(); setMode('text'); }}>Type instead</button>}
              </div>
            </div>
          ) : (
            <div className="rv-chat">
              <div className="rv-msgs" ref={scroller} aria-live="polite">
                <div className="rv-msg rv-msg-assistant"><Rich text={WELCOME} /></div>
                {turns.map((t, i) => <div key={i} className={`rv-msg rv-msg-${t.role}`}>{t.role === 'assistant' ? <Rich text={t.content} /> : t.content}</div>)}
                {sending && <div className="rv-msg rv-msg-assistant rv-typing" aria-label="Cupcake is typing"><span /><span /><span /></div>}
                {turns.length === 0 && <div className="rv-chips">{SUGGESTIONS.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
              </div>
              {chatError && <p className="rv-chat-error" role="alert">{chatError}</p>}
              <form className="rv-compose" onSubmit={e => { e.preventDefault(); void send(draft); }}>
                <textarea value={draft} maxLength={CHAT_MAX} rows={1} placeholder="Ask about Matt’s data…" aria-label="Message"
                  onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }} />
                <button type="submit" className="rv-send" disabled={!draft.trim() || sending} aria-label="Send"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
              </form>
            </div>
          )}
      <p className="rv-panel-foot">Cupcake can make mistakes; answers are based on Matt&rsquo;s logged data.</p>
    </aside>
  );
}
