import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArchivedRecording } from './accountRecording';
import { RecordingSummaryClient, summaryFailure, summaryRecovery, type RecordingSummary, type SummaryIntent } from './recordingSummaryClient';
import { cupcakeHref } from './accountMode';
import './account-recording-summary.css';

export default function AccountRecordingSummary({ recording, active, onListen }: { recording: ArchivedRecording; active: boolean; onListen: () => void }) {
  const [client] = useState(() => new RecordingSummaryClient(recording));
  const [result, setResult] = useState<RecordingSummary | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [polls, setPolls] = useState(0);
  const alive = useRef(false), inFlight = useRef(false), current = useRef<RecordingSummary | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const act = useCallback(async (begin: boolean, automatic = false) => {
    if (!active || inFlight.current) return;
    const previous = current.current;
    if (begin && previous?.summary.status !== 'not_started') return;
    inFlight.current = true; setBusy(true); setError('');
    if (!automatic) setPolls(0);
    try {
      let data: RecordingSummary;
      if (begin && previous) {
        const recovery = summaryRecovery(previous.source);
        const intent: SummaryIntent = recovery.load() || { requestId: crypto.randomUUID(), recordingId: previous.source.recordingId, originalSha256: previous.source.originalSha256, transcriptSha256: previous.source.transcriptSha256 };
        recovery.save(intent); // Recovery must be durable before the explicit paid action.
        data = await client.begin(previous.source, intent);
      } else data = await client.check(automatic ? previous?.source : undefined);
      if (!alive.current) return;
      current.current = data; setResult(data);
    } catch (cause) {
      if (!alive.current || cause instanceof DOMException && cause.name === 'AbortError') return;
      // A lost begin response cannot leave an enabled button that starts another attempt.
      current.current = null; setResult(null);
      setError(cause instanceof Error ? cause.message : 'The summary was not confirmed. Check summary status before continuing.');
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }, [active, client]);
  useEffect(() => {
    if (!active || busy || error || !['queued', 'running'].includes(result?.summary.status || '') || polls >= 24) return;
    const timer = window.setTimeout(() => { setPolls(value => value + 1); void act(false, true); }, 2500);
    return () => window.clearTimeout(timer);
  }, [active, busy, error, result, polls, act]);
  if (recording.status !== 'stored' || !recording.originalStored || !recording.originalSha256) return null;
  const status = result?.summary.status, turn = result?.thread?.turns[0];
  return <section className="cc-recording-summary" aria-label="Saved transcript summary">
    <h4>Summary</h4><p className="cc-muted cc-small">Summarize a complete saved transcript using your account’s shared AI allowance. Your original audio and transcript stay unchanged. Nothing is shortened.</p>
    <div className="cc-action-row"><button className="cc-secondary" disabled={!active || busy} onClick={() => void act(false)}>{busy ? 'Checking summary…' : result ? 'Check summary status' : 'Check saved transcript'}</button>
      {status === 'not_started' && <button className="cc-primary" disabled={!active || busy} onClick={() => void act(true)}>Summarize saved transcript</button>}</div>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status">
      {status === 'not_started' && <p>A complete saved transcript is ready. Summary starts only when you choose Summarize.</p>}
      {status === 'queued' && <p>Summary queued. You can close this page and check again later.</p>}
      {status === 'running' && <p>Preparing your summary from the complete saved transcript.</p>}
      {polls >= 24 && ['queued', 'running'].includes(status || '') && <p>Still waiting. Check summary status later.</p>}
      {status === 'uncertain' && <p>The summary may have started, but no result was confirmed. Check status later. It will not be sent again automatically.</p>}
      {status === 'failed' && <p>{summaryFailure(turn?.error)} No retry is available here; checking status does not start another summary.</p>}
      {status === 'cancelled' && <p>This summary was cancelled. Your original and transcript are kept. Checking status does not start another summary.</p>}
    </div>}
    {status === 'completed' && turn?.response && <div className="cc-recording-summary-result"><strong>Summary saved</strong><p className="cc-muted cc-small">AI interpretation · may contain errors. Check it against your transcript and original audio.</p><pre>{turn.response.reply}</pre></div>}
    {result && <div className="cc-action-row"><a className="cc-text-button" href={cupcakeHref(result.source.sourceUrl)}>View source transcript</a><button className="cc-text-button" disabled={!active || busy} onClick={onListen}>Listen to original</button></div>}
  </section>;
}
