// CupcakeGPT — Matt's AI accountability app
// Chat + food-photo calorie tracking + live feed + week view.
// Talks to n8n webhooks on automate.hales.ai (CORS-enabled).

import React, { useState, useEffect, useRef, useCallback } from 'react';
// framer-motion intentionally not used: tab switches must render instantly and
// never depend on rAF (which throttles/freezes in backgrounded webviews).
import {
  Home, MessageCircle, Camera, CalendarDays, Send, Mic, Volume2, VolumeX, Loader2,
} from 'lucide-react';

export const metadata = {
  title: 'CupcakeGPT',
  description: "Matt's AI accountability app — chat, snap your food for calories, and see everything Cupcake is tracking.",
  createdAt: '2026-08-09',
};

const API = 'https://automate.hales.ai/webhook';
// A private key must never be compiled into the public website bundle.
const TOKEN_STORAGE = 'cupcake-private-access';
const authHeaders = () => ({ 'X-Cupcake-Key': sessionStorage.getItem(TOKEN_STORAGE) || '' });
async function readJson(response: Response) {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}
const ICON = '/cupcakegpt-icon.png';

type FeedItem = { type: string; icon: string; title: string; body: string; date: string; time: string; ts: number };
type ChatMsg = { role: 'user' | 'cupcake'; text: string };

type SpeechInput = {
  lang: string; interimResults: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; start: () => void; stop: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechInput; webkitSpeechRecognition?: new () => SpeechInput };
type FoodResult = {
  Description?: string; description?: string; error?: boolean;
  Calories?: number; calories?: number; Sugar?: number; sugar_g?: number; Protein?: number; protein_g?: number;
};

const tabs = [
  { key: 'feed', label: 'Feed', Icon: Home },
  { key: 'chat', label: 'Chat', Icon: MessageCircle },
  { key: 'snap', label: 'Snap', Icon: Camera },
  { key: 'week', label: 'Week', Icon: CalendarDays },
] as const;
type TabKey = (typeof tabs)[number]['key'];

const CupcakeGPT: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('feed');
  const [speak, setSpeak] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState(() => sessionStorage.getItem(TOKEN_STORAGE) || '');
  const [unlocking, setUnlocking] = useState(false);
  const [accessError, setAccessError] = useState('');
  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!keyInput.trim() || unlocking) return;
    setUnlocking(true); setAccessError('');
    try {
      const response = await fetch(`${API}/cupcake-feed`, { headers: { 'X-Cupcake-Key': keyInput.trim() }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Access could not be verified. Check your key and try again.');
      sessionStorage.setItem(TOKEN_STORAGE, keyInput.trim()); setUnlocked(true);
    } catch { setAccessError('Access could not be verified. Check your key and connection, then try again.'); }
    finally { setUnlocking(false); }
  };

  // set PWA icon + title so "Add to Home Screen" uses the cupcake
  useEffect(() => {
    document.title = 'CupcakeGPT';
    const set = (rel: string) => {
      let l = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); }
      l.href = ICON;
    };
    set('apple-touch-icon'); set('icon');
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = '#e11d48';
  }, []);

  if (!unlocked) return <main className="min-h-screen bg-[#100a12] text-white flex items-center justify-center p-6"><form onSubmit={unlock} className="max-w-sm w-full space-y-5"><a href="/" className="text-pink-300">← Hales.ai</a><h1 className="text-3xl font-bold">Private Cupcake access</h1><p className="text-gray-300">Enter your personal access key to open your feed, chat, and food log. It stays in this browser tab for this session.</p><label className="block">Access key<input type="password" autoComplete="off" required value={keyInput} onChange={e=>setKeyInput(e.target.value)} className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20"/></label><button disabled={unlocking} className="w-full p-3 rounded-lg bg-pink-500 disabled:opacity-50">{unlocking?'Checking access…':'Unlock Cupcake'}</button>{accessError&&<p role="alert" className="text-red-300">{accessError}</p>}</form></main>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a12] via-[#0e0710] to-black text-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-black/40 border-b border-pink-500/20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <img src={ICON} alt="CupcakeGPT" className="w-10 h-10 rounded-xl shadow-lg shadow-pink-500/30" />
          <div className="flex-1">
            <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-pink-300 to-rose-400 bg-clip-text text-transparent">CupcakeGPT</h1>
            <p className="text-[11px] text-pink-200/50 leading-tight mt-0.5">your accountability demon</p>
          </div>
          <button onClick={() => { sessionStorage.removeItem(TOKEN_STORAGE); setKeyInput(''); setUnlocked(false); }} className="text-sm text-pink-200">Lock</button>
          <button
            onClick={() => setSpeak((s) => !s)}
            className={`p-2 rounded-full transition ${speak ? 'bg-pink-500/30 text-pink-200' : 'bg-white/5 text-white/40'}`}
            aria-label="Toggle voice"
          >
            {speak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pb-28 pt-4">
        <div key={tab}>
          {tab === 'feed' && <FeedView />}
          {tab === 'chat' && <ChatView speak={speak} />}
          {tab === 'snap' && <SnapView />}
          {tab === 'week' && <WeekView />}
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-20 backdrop-blur-xl bg-black/60 border-t border-pink-500/20">
        <div className="max-w-md mx-auto grid grid-cols-4">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-1 py-3 transition ${tab === key ? 'text-pink-400' : 'text-white/40'}`}
            >
              <Icon size={22} strokeWidth={tab === key ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

// ---------- FEED ----------
const FeedView: React.FC = () => {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch(`${API}/cupcake-feed`, { headers: authHeaders() })
      .then(readJson)
      .then((d) => setItems(d.items || []))
      .catch(() => setErr(true));
  }, []);
  if (err) return <Empty text="Couldn't reach the feed. Try again in a sec." />;
  if (!items) return <Spinner />;
  if (!items.length) return <Empty text="Nothing yet. Go live your life — Cupcake is watching." />;
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex gap-3 items-start bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl px-4 py-3"
        >
          <div className="text-2xl leading-none mt-0.5">{it.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{it.title}</p>
            <p className="text-xs text-white/60">{it.body}</p>
          </div>
          <div className="text-[10px] text-white/30 whitespace-nowrap mt-1">{it.time?.replace(/:\d\d\s/, ' ')}</div>
        </div>
      ))}
    </div>
  );
};

// ---------- CHAT ----------
const ChatView: React.FC<{ speak: boolean }> = ({ speak }) => {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: 'cupcake', text: "Hey Matt. What are we conquering — or confessing? 🧁" },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechInput | null>(null);
  useEffect(() => () => { recRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const say = useCallback((text: string) => {
    if (!speak || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05; u.pitch = 1.15;
    window.speechSynthesis.speak(u);
  }, [speak]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: t }]);
    setInput(''); setBusy(true);
    try {
      const r = await fetch(`${API}/cupcake-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message: t }),
      });
      const d = await readJson(r);
      const reply = d.reply || "Hmm, my brain glitched. Say that again?";
      setMsgs((m) => [...m, { role: 'cupcake', text: reply }]);
      say(reply);
    } catch {
      setMsgs((m) => [...m, { role: 'cupcake', text: "Can't reach the kitchen right now. Try again." }]);
    } finally { setBusy(false); }
  };

  const toggleMic = () => {
    const SR = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SR) { alert('Voice input needs Chrome/Safari.'); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false;
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start(); recRef.current = rec; setListening(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-11rem)]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-snug ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-br-sm'
                : 'bg-white/[0.07] border border-white/5 text-white/90 rounded-bl-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-white/[0.07] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm">
              <Loader2 className="animate-spin text-pink-300" size={16} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 pt-3">
        <button onClick={toggleMic}
          className={`p-3 rounded-full transition ${listening ? 'bg-pink-500 text-white animate-pulse' : 'bg-white/10 text-pink-200'}`}
          aria-label="Voice input">
          <Mic size={18} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder="Talk to Cupcake…"
          className="flex-1 bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm outline-none focus:border-pink-400/50 placeholder:text-white/30"
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()}
          className="p-3 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 disabled:opacity-40 transition" aria-label="Send">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

// ---------- SNAP (food photo) ----------
const SnapView: React.FC = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<FoodResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => { setPreview(reader.result as string); setResult(null); };
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!preview || busy) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch(`${API}/cupcake-food-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ image: preview, note }),
      });
      setResult(await readJson(r));
    } catch {
      setResult({ Description: 'Upload failed. Check your access and connection, then try again.', error: true });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileRef.current?.click()}
        className="relative aspect-square rounded-3xl border-2 border-dashed border-pink-500/30 bg-white/[0.03] overflow-hidden flex items-center justify-center cursor-pointer"
      >
        {preview ? (
          <img src={preview} alt="food" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-pink-200/50 px-6">
            <Camera size={40} className="mx-auto mb-3" />
            <p className="text-sm">Tap to snap or upload your meal</p>
            <p className="text-xs mt-1 text-white/30">Cupcake estimates the calories & sugar</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

      {preview && (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…"
            className="w-full bg-white/[0.06] border border-white/10 rounded-full px-4 py-3 text-sm outline-none focus:border-pink-400/50 placeholder:text-white/30" />
          <button onClick={analyze} disabled={busy}
            className="w-full py-3.5 rounded-full font-semibold bg-gradient-to-r from-pink-500 to-rose-600 flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <><Loader2 className="animate-spin" size={18} /> Analyzing…</> : 'Analyze & Log'}
          </button>
        </>
      )}

      {result && (
        <div className="bg-white/[0.05] border border-pink-500/20 rounded-2xl p-4">
          <p className="font-semibold text-pink-200">{result.Description || result.description || 'Logged'}</p>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <Stat label="Calories" value={result.Calories ?? result.calories} />
            <Stat label="Sugar (g)" value={result.Sugar ?? result.sugar_g} />
            <Stat label="Protein (g)" value={result.Protein ?? result.protein_g} />
          </div>
          {!result.error && <p className="text-xs text-emerald-300/70 mt-3">✓ Saved to your food log</p>}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-black/30 rounded-xl py-2">
    <div className="text-lg font-bold text-white">{value ?? '—'}</div>
    <div className="text-[10px] text-white/40">{label}</div>
  </div>
);

// ---------- WEEK ----------
const WeekView: React.FC = () => {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(`${API}/cupcake-feed`, { headers: authHeaders() }).then(readJson).then((d) => setItems(d.items || [])).catch(() => setError(true));
  }, []);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekItems = (items || []).filter((item) => Number.isFinite(item.ts) && item.ts >= cutoff);
  const food = weekItems.filter((i) => i.type === 'food');
  const kcal = food.reduce((s, f) => s + (parseInt(f.body) || 0), 0);
  const interventions = weekItems.filter((i) => i.type === 'intervention');
  const wins = interventions.filter((i) => /agreed/.test(i.body)).length;

  if (error) return <Empty text="Couldn't load this week's data. Lock and unlock Cupcake to check access, or try again later." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card big label="Est. calories logged" value={items ? kcal : '…'} tint="from-pink-500/20" />
        <Card big label="Interventions" value={items ? interventions.length : '…'} tint="from-rose-500/20" />
        <Card big label="Times you caved" value={items ? interventions.filter((i) => /bought anyway/.test(i.body)).length : '…'} tint="from-red-500/20" />
        <Card big label="Times you won" value={items ? wins : '…'} tint="from-emerald-500/20" />
      </div>

      <div className="bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1"><CalendarDays size={16} className="text-pink-300" /><p className="font-semibold text-sm">Next check-in</p></div>
        <p className="text-sm text-white/80">Robyn — Wednesday 2:00 PM (Utah)</p>
        <p className="text-xs text-white/40 mt-1">Cupcake sends her your weekly report 45 min before.</p>
      </div>

      <p className="text-xs text-white/30 text-center">Last 7 days within the recent feed. This may not include every entry.</p>
    </div>
  );
};

const Card: React.FC<{ label: string; value: React.ReactNode; big?: boolean; tint?: string }> = ({ label, value, tint }) => (
  <div className={`bg-gradient-to-br ${tint} to-transparent border border-white/10 rounded-2xl p-4`}>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-[11px] text-white/50 mt-1">{label}</div>
  </div>
);

// ---------- shared ----------
const Spinner = () => <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pink-400" size={28} /></div>;
const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center py-16 text-white/40 text-sm px-8">{text}</div>
);

export default CupcakeGPT;
