import { useEffect, useRef, useState } from 'react';
import type { CaptureIntent, CaptureKind } from '../accountMealPhotoHandoff';
import { captureStorageScope } from '../personalStorage';
import { keepReviewPhoto } from './localCaptureReview';

const choices: CaptureKind[] = ['meal', 'receipt', 'other'];
const titles = { meal: 'Meal', receipt: 'Receipt', other: 'Other' };
const actions = { meal: 'Log meal', receipt: 'Save and read receipt', other: 'Keep on this device' };
const copy = {
  meal: 'Send to your meal estimator and log the visible portion.',
  receipt: 'Send to your receipt reader. You can review and correct the amounts.',
  other: 'Keep the original here privately. Find it under Food → Photos on this device.',
};

export function CapturePreview({ file, intent, onRetake, onChoose }: {
  file: File; intent: CaptureIntent; onRetake: () => void; onChoose: (kind: CaptureKind) => void;
}) {
  const [scope] = useState(captureStorageScope), [url, setUrl] = useState('');
  const [kind, setKind] = useState<CaptureKind>(intent === 'auto' ? 'other' : intent);
  const [checking, setChecking] = useState(intent === 'auto'), [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const chosen = useRef(false), busy = useRef(false);
  const detect = useRef<AbortController | null>(null);
  useEffect(() => {
    const image = URL.createObjectURL(file); setUrl(image);
    return () => URL.revokeObjectURL(image);
  }, [file]);
  useEffect(() => {
    if (intent !== 'auto') return;
    const abort = new AbortController(); detect.current = abort;
    const limit = setTimeout(() => { abort.abort(); setChecking(false); }, 20_000);
    void import('./classifyCapture').then(module => module.classifyCapture(file, abort.signal))
      .then(result => { if (!abort.signal.aborted && !chosen.current) setKind(result); })
      .catch(() => undefined).finally(() => { clearTimeout(limit); if (!abort.signal.aborted) setChecking(false); });
    return () => { clearTimeout(limit); abort.abort(); };
  }, [intent, file]);
  async function finish() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); detect.current?.abort();
    try {
      if (kind === 'other') await keepReviewPhoto(file, scope);
      onChoose(kind);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not keep this photo.'); }
    finally { busy.current = false; setSaving(false); setChecking(false); }
  }
  return <div className="cc-capture-preview">
    <img src={url || undefined} alt="New photo"/>
    <fieldset disabled={saving}><legend>Where does this photo belong?</legend>
      {choices.map(value => <label key={value}><input type="radio" name="capture-kind" checked={kind === value}
        onChange={() => { chosen.current = true; detect.current?.abort(); setChecking(false); setKind(value); }}/>{titles[value]}</label>)}
    </fieldset>
    <p role="status">{checking ? 'Checking on this device. You can choose now.' : copy[kind]}</p>
    {error && <p role="alert">{error}</p>}
    <div><button type="button" className="cc-secondary" disabled={saving} onClick={onRetake}>Retake</button>
    <button type="button" className="cc-primary" disabled={saving} onClick={() => void finish()}>{actions[kind]}</button></div>
  </div>;
}
