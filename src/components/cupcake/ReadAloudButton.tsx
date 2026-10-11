import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';

function pieces(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buffer = '';
  for (const part of parts) {
    const next = buffer ? `${buffer} ${part}` : part;
    if (next.length > 240 && buffer) {
      out.push(buffer);
      buffer = part;
    } else buffer = next;
  }
  if (buffer) out.push(buffer);
  return out;
}

export function ReadAloudButton({ text, label = 'Play' }: { text: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => () => {
    try { window.speechSynthesis?.cancel(); } catch { /* The page is going away. */ }
  }, []);
  useEffect(() => { setPlaying(false); setNote(''); }, [text]);
  const stop = () => {
    try { window.speechSynthesis?.cancel(); } catch { /* Already stopped. */ }
    setPlaying(false);
  };
  const play = () => {
    const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
    if (!synth) {
      setNote('This browser cannot read aloud. The text stays on screen.');
      return;
    }
    const chunks = pieces(text);
    if (!chunks.length) return;
    synth.cancel();
    try { synth.resume(); } catch { /* Some browsers reject resume until speech starts. */ }
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = 'en-US';
      utterance.rate = 1;
      if (index === chunks.length - 1) utterance.onend = () => setPlaying(false);
      utterance.onerror = () => setPlaying(false);
      synth.speak(utterance);
    });
    setPlaying(true);
    setNote('');
  };
  return <>
    <button type="button" className="cc-text-button cc-read-aloud" aria-pressed={playing} onClick={playing ? stop : play}>{playing ? <Square size={15} /> : <Volume2 size={15} />}{playing ? 'Stop' : label}</button>
    {note && <p className="cc-muted cc-small" role="status">{note}</p>}
  </>;
}
