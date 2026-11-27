import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { speakText, speechPieces } from './quickChatRecovery';

export function ReadAloudButton({ text, label = 'Play', deviceOnly = false }: { text: string; label?: string; deviceOnly?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState('');
  // On-device only: 'none' once the browser has listed its voices and none of them is local, or it has no speech at all.
  // An empty list is 'unknown' (many browsers fill it late), so the person can still try.
  const [local, setLocal] = useState<'unknown' | 'ready' | 'none'>('unknown');
  useEffect(() => {
    if (!deviceOnly) return;
    const synth = window.speechSynthesis;
    if (!synth) { setLocal('none'); return; }
    const check = () => {
      const voices = synth.getVoices();
      setLocal(voices.some(voice => voice.localService) ? 'ready' : voices.length ? 'none' : 'unknown');
    };
    check();
    synth.addEventListener?.('voiceschanged', check);
    return () => synth.removeEventListener?.('voiceschanged', check);
  }, [deviceOnly]);
  const unavailable = deviceOnly && local === 'none';
  useEffect(() => () => {
    try { window.speechSynthesis?.cancel(); } catch { /* The page is going away. */ }
  }, []);
  useEffect(() => { setPlaying(false); setNote(''); }, [text]);
  const stop = () => {
    try { window.speechSynthesis?.cancel(); } catch { /* Already stopped. */ }
    setPlaying(false);
  };
  const play = () => {
    if (!speechPieces(text).length) return;
    const voices = deviceOnly ? window.speechSynthesis?.getVoices().filter(voice => voice.localService) || [] : [];
    const voice = voices.find(v => /^en(?:-|$)/i.test(v.lang)) || voices.find(v => v.default) || voices[0];
    if (deviceOnly && !voice) {
      setNote('No on-device reading voice is available in this browser. The recap is shown here.');
      return;
    }
    if (!speakText(text, () => setPlaying(false), voice, () => { setPlaying(false); setNote('Playback stopped. You can try again or read the recap here.'); })) {
      setNote('This browser cannot read aloud. The text stays on screen.');
      return;
    }
    setPlaying(true);
    setNote('');
  };
  return <>
    <button type="button" className="cc-text-button cc-read-aloud" aria-pressed={playing} disabled={unavailable && !playing} onClick={playing ? stop : play}>{playing ? <Square size={15} /> : <Volume2 size={15} />}{playing ? 'Stop' : label}</button>
    {unavailable && !note
      ? <p className="cc-muted cc-small" role="status">No on-device reading voice is available in this browser, so listening is off. The recap is shown here.</p>
      : deviceOnly && local === 'ready' && !note && <p className="cc-muted cc-small">Plays with a voice on this device. Nothing is sent anywhere.</p>}
    {note && <p className="cc-muted cc-small" role="status">{note}</p>}
  </>;
}
