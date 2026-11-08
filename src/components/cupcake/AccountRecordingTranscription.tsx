import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountRecordingClient, type ArchivedRecording } from './accountRecording';
import { permanentTranscriptionFailure, requestTranscription, transcriptionError, transcriptionRecovery, TranscriptionRequestError, type TranscriptionIntent, type TranscriptionResult } from './accountTranscription';
import './account-transcription.css';

export default function AccountRecordingTranscription({ recording, active }: { recording: ArchivedRecording; active: boolean }) {
  const [initial] = useState(() => {
    try { const recovery = transcriptionRecovery(recording); return { recovery, intent: recovery.load(), error: '' }; }
    catch { return { recovery: null, intent: null, error: 'Browser transcription recovery is unavailable or does not match this original. No new transcription request was sent.' }; }
  });
  const [intent, setIntent] = useState(initial.intent), [result, setResult] = useState<TranscriptionResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(initial.error), [missing, setMissing] = useState(false), [polls, setPolls] = useState(0);
  const [language, setLanguage] = useState('');
  const current = useRef<TranscriptionIntent | null>(initial.intent), client = useRef<AccountRecordingClient | null>(null), alive = useRef(false), inFlight = useRef(false), confirmed = useRef<TranscriptionResult | null>(null);
  useEffect(() => { alive.current = true; const transport = new AccountRecordingClient(); client.current = transport; return () => { alive.current = false; transport.dispose(); }; }, []);
  const act = useCallback(async (action: 'transcribe' | 'transcription-status' | 'transcription-retry' | 'transcription-publish', automatic = false) => {
    if (!active || inFlight.current || !client.current || !initial.recovery) return;
    const known = confirmed.current?.request;
    if (action === 'transcription-retry' && (!known?.can_retry_unsent || known.dispatched || known.status !== 'failed')) return;
    if (action === 'transcription-publish' && (!known?.can_publish_saved_result || known.status !== 'publication_pending')) return;
    if (action === 'transcribe' && current.current && !missing) return;
    inFlight.current = true; setBusy(true); setError('');
    if (!automatic) setPolls(0);
    try {
      client.current.assert();
      let original = current.current;
      if (action === 'transcribe') {
        original ||= { request_id: crypto.randomUUID(), recording_id: recording.id, original_sha256: recording.originalSha256!, language: language || null };
        initial.recovery.save(original); current.current = original; setIntent(original);
      }
      if (!original) throw Error('No saved transcription request was found.');
      const data = await requestTranscription(client.current, action, original);
      if (!alive.current || current.current?.request_id !== original.request_id) return;
      confirmed.current = data; setResult(data); setMissing(false);
    } catch (cause) {
      if (!alive.current || cause instanceof DOMException && cause.name === 'AbortError') return;
      setMissing(action === 'transcription-status' && cause instanceof TranscriptionRequestError && cause.code === 'transcription_request_not_found');
      confirmed.current = null; setResult(null);
      setError(cause instanceof Error ? cause.message : 'Transcription was not confirmed. Check the saved request before trying again.');
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }, [active, initial.recovery, language, missing, recording.id, recording.originalSha256]);
  useEffect(() => {
    if (!active || busy || error || !['queued', 'running'].includes(result?.request.status || '') || polls >= 24) return;
    const timer = window.setTimeout(() => { setPolls(value => value + 1); void act('transcription-status', true); }, 2500);
    return () => window.clearTimeout(timer);
  }, [active, busy, error, result, polls, act]);
  if (recording.status !== 'stored' || !recording.originalStored || !recording.originalSha256) return null;
  const request = result?.request;
  return <section className="cc-audio-transcription" aria-label="Audio transcription">
    <h4>Transcript</h4><p className="cc-muted cc-small">Transcribe the complete saved clip, up to three minutes. Longer clips are rejected, never trimmed. This uses your account’s shared AI allowance; the original stays unchanged.</p>
    {!intent && <><label className="cc-label">Spoken language<select aria-label="Spoken language" value={language} disabled={busy || !initial.recovery} onChange={event => setLanguage(event.target.value)}><option value="">Detect automatically</option><option value="en">English</option><option value="fr">French</option></select></label><button className="cc-secondary" disabled={!active || busy || !initial.recovery} onClick={() => void act('transcribe')}>Transcribe full clip</button></>}
    {intent && <div className="cc-action-row"><button className="cc-secondary" disabled={!active || busy} onClick={() => void act('transcription-status')}>{busy ? 'Checking transcription…' : 'Check transcription status'}</button>{missing && <button className="cc-secondary" disabled={!active || busy} onClick={() => void act('transcribe')}>Send saved transcription request</button>}</div>}
    {intent && !request && !error && <p className="cc-muted cc-small">This browser has a saved transcription request. Check its status before continuing.</p>}
    {error && <p role="alert">{error}</p>}
    {request && <div role="status">
      {request.status === 'queued' && <p>Transcription queued. Your original is saved.</p>}
      {request.status === 'running' && <p>Transcribing the complete clip. Your original is saved.</p>}
      {polls >= 24 && ['queued', 'running'].includes(request.status) && <p className="cc-muted cc-small">Still waiting. Use Check transcription status later.</p>}
      {request.status === 'uncertain' && <p>The audio may have been sent, but no transcript was confirmed. Check status later. It will not be sent again automatically.</p>}
      {request.status === 'failed' && <p>{transcriptionError(request.error)}</p>}
      {request.status === 'publication_pending' && <p>{request.can_publish_saved_result ? 'The transcription result is waiting to be saved. Saving that result does not transcribe the audio again.' : 'The transcription response needs checking. No transcript is available to save. Your original is kept, and it will not be sent again automatically.'}</p>}
      {request.can_retry_unsent && !permanentTranscriptionFailure(request.error) && <button className="cc-secondary" disabled={!active || busy} onClick={() => void act('transcription-retry')}>Retry unsent transcription</button>}
      {request.can_publish_saved_result && <button className="cc-secondary" disabled={!active || busy} onClick={() => void act('transcription-publish')}>Save completed transcript</button>}
    </div>}
    {result?.transcript && <div className="cc-audio-transcript"><strong>Transcript saved</strong><p className="cc-muted cc-small">Speech-to-text estimate · may contain errors. Check against the original audio. No summary is included.</p><pre>{result.transcript.emptyTranscript ? 'No speech text was returned for this clip.' : result.transcript.text}</pre><details><summary>Transcript details</summary><p className="cc-muted cc-small">Complete clip: {result.transcript.durationSeconds.toFixed(1)} seconds. {result.transcript.modelVerification === 'unreported' ? 'The provider did not report the model used.' : 'The provider reported the requested speech-to-text model.'}</p></details></div>}
  </section>;
}
