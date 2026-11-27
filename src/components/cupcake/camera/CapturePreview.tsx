import { useEffect, useRef, useState } from 'react';
import type { CaptureIntent, CaptureKind } from '../accountMealPhotoHandoff';
import { captureStorageScope } from '../personalStorage';
import { keepReviewPhoto } from './localCaptureReview';
import { useLab } from '../labsFlags';

const choices: CaptureKind[] = ['meal', 'receipt', 'other'];
const titles = { meal: 'Meal', receipt: 'Receipt', other: 'Other' };
const actions = { meal: 'Log meal', receipt: 'Save and read receipt', other: 'Keep on this device' };
const copy = {
  meal: 'Send to your meal estimator and log the visible portion.',
  receipt: 'Send to your receipt reader. You can review and correct the amounts.',
  other: 'Keep the original here privately. Find it under Food → Photos on this device.',
};
/** Labs "camera-autofile": where a confident guess is filed, and how long the person has to change it. */
export const AUTO_FILE_SECONDS = 3;
const places = { meal: 'Food log', receipt: 'Receipts', other: 'Photos on this device' };
const looks = { meal: 'a meal', receipt: 'a receipt', other: 'something else' };
const fixes = { meal: 'It’s a meal', receipt: 'It’s a receipt', other: 'Just keep it' };

export function CapturePreview({ file, intent, onRetake, onChoose }: {
  file: File; intent: CaptureIntent; onRetake: () => void; onChoose: (kind: CaptureKind) => void;
}) {
  const [scope] = useState(captureStorageScope), [url, setUrl] = useState('');
  const [kind, setKind] = useState<CaptureKind>(intent === 'auto' ? 'other' : intent);
  const [checking, setChecking] = useState(intent === 'auto'), [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const chosen = useRef(false), busy = useRef(false);
  const detect = useRef<AbortController | null>(null);
  // With the Labs switch on, a confident guess from the Food button files itself after a short countdown.
  const autoFile = useLab('camera-autofile') && intent === 'auto';
  const [guess, setGuess] = useState<CaptureKind | null>(null), [left, setLeft] = useState(AUTO_FILE_SECONDS);
  const [unsure, setUnsure] = useState(false);
  useEffect(() => {
    const image = URL.createObjectURL(file); setUrl(image);
    return () => URL.revokeObjectURL(image);
  }, [file]);
  useEffect(() => {
    if (intent !== 'auto') return;
    const abort = new AbortController(); detect.current = abort;
    const limit = setTimeout(() => { abort.abort(); setChecking(false); }, 20_000);
    void import('./classifyCapture').then(module => module.classifyCapture(file, abort.signal))
      .then(result => {
        if (abort.signal.aborted || chosen.current) return;
        setKind(result);
        if (autoFile && result !== 'other') { setGuess(result); setLeft(AUTO_FILE_SECONDS); }
        else if (autoFile) setUnsure(true);
      })
      .catch(() => undefined).finally(() => { clearTimeout(limit); if (!abort.signal.aborted) setChecking(false); });
    return () => { clearTimeout(limit); abort.abort(); };
  }, [intent, file, autoFile]);
  // A hidden page (phone locked, app switched) holds the countdown, so nothing files unseen.
  useEffect(() => {
    if (!guess || saving) return;
    if (left <= 0) { void finishRef.current(guess); return; }
    const tick = window.setTimeout(() => { if (document.visibilityState !== 'hidden') setLeft(value => value - 1); }, 1000);
    return () => window.clearTimeout(tick);
  }, [guess, left, saving]);
  const finishRef = useRef(finish); finishRef.current = finish;
  const stopAuto = () => { chosen.current = true; setGuess(null); setUnsure(false); };
  async function finish(target: CaptureKind = kind) {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); detect.current?.abort();
    try {
      if (target === 'other') await keepReviewPhoto(file, scope);
      onChoose(target);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not keep this photo.'); }
    finally { busy.current = false; setSaving(false); setChecking(false); setGuess(null); }
  }
  if (guess) return <div className="cc-capture-preview" data-autofile={guess}>
    <img src={url || undefined} alt="New photo"/>
    <p role="status" className="cc-capture-guess"><b>This looks like {looks[guess]}.</b> {saving ? `Saving to ${places[guess]}…` : `Saving to ${places[guess]} in ${left}…`}</p>
    {error && <p role="alert">{error}</p>}
    <div className="cc-capture-fix" role="group" aria-label="Wrong guess? File it somewhere else">
      {choices.filter(value => value !== guess).map(value => <button key={value} type="button" className="cc-secondary" disabled={saving} onClick={() => { stopAuto(); setKind(value); void finish(value); }}>{fixes[value]}</button>)}
    </div>
    <div><button type="button" className="cc-text-button" disabled={saving} onClick={() => { stopAuto(); setKind(guess); }}>Let me choose</button>
    <button type="button" className="cc-primary" disabled={saving} onClick={() => void finish(guess)}>Save now</button></div>
  </div>;
  return <div className="cc-capture-preview">
    <img src={url || undefined} alt="New photo"/>
    <fieldset disabled={saving}><legend>Where does this photo belong?</legend>
      {choices.map(value => <label key={value}><input type="radio" name="capture-kind" checked={kind === value}
        onChange={() => { stopAuto(); detect.current?.abort(); setChecking(false); setKind(value); }}/>{titles[value]}</label>)}
    </fieldset>
    <p role="status">{checking ? autoFile ? 'Looking at your photo on this device. You can choose now.' : 'Checking on this device. You can choose now.' : unsure ? `Couldn’t tell what this is. ${copy[kind]}` : copy[kind]}</p>
    {error && <p role="alert">{error}</p>}
    <div><button type="button" className="cc-secondary" disabled={saving} onClick={onRetake}>Retake</button>
    <button type="button" className="cc-primary" disabled={saving} onClick={() => void finish(kind)}>{actions[kind]}</button></div>
  </div>;
}
