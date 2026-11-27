import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { speakText, speechPieces } from './quickChatRecovery';

export function ReadAloudButton({ text, label = 'Play', deviceOnly = false }: { text: string; label?: string; deviceOnly?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (deviceOnly) window.speechSynthesis?.getVoices(); }, [deviceOnly]);
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
    <button type="button" className="cc-text-button cc-read-aloud" aria-pressed={playing} onClick={playing ? stop : play}>{playing ? <Square size={15} /> : <Volume2 size={15} />}{playing ? 'Stop' : label}</button>
    {note && <p className="cc-muted cc-small" role="status">{note}</p>}
  </>;
}
