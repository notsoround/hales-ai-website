import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { speakText, speechPieces } from './quickChatRecovery';

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
    if (!speechPieces(text).length) return;
    if (!speakText(text, () => setPlaying(false))) {
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
