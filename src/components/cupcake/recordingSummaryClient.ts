import { accountData, AccountRequestError, assertGeneration, sessionSnapshot } from './accountSession';
import type { ArchivedRecording } from './accountRecording';
import { personalStorage } from './personalStorage';

export type SummarySource = { recordingId: string; originalSha256: string; transcriptSha256: string; transcriptBytes: number; complete: true; documentId: string; sourceUrl: string };
export type SummaryIntent = Pick<SummarySource, 'recordingId' | 'originalSha256' | 'transcriptSha256'> & { requestId: string };
type SummaryStatus = 'not_started' | 'queued' | 'running' | 'completed' | 'failed' | 'uncertain' | 'cancelled';
export type RecordingSummary = { source: SummarySource; summary: Pick<SummarySource, 'recordingId' | 'originalSha256' | 'transcriptSha256' | 'documentId' | 'sourceUrl'> & { threadId: string; turnId: string; status: SummaryStatus }; thread: null | { id: string; turns: { id: string; status: string; error?: string | null; response?: { reply: string; model: string } | null }[] } };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{64}$/;
export const summaryMessages: Record<string, string> = {
  account_recording_summary_not_ready: 'Saved transcript summaries are not available for this account yet. Your original and transcript are kept.',
  recording_summary_transcript_unavailable: 'A complete saved transcript could not be opened. If transcription is still pending, finish it first, then check again.',
  recording_summary_transcript_changed: 'The saved transcript changed. Check the current transcript before requesting a summary.',
  recording_summary_transcript_too_large: 'This complete transcript exceeds the summary limit. Nothing was shortened or sent for a summary.',
  recording_summary_invalid_request: 'The summary request does not match this original. Refresh saved audio before continuing.',
  recording_summary_source_changed: 'The saved summary no longer matches this transcript. Nothing was replaced. Check again later.',
  recording_summary_thread_limit: 'Your saved conversation limit has been reached. No new summary was confirmed.',
  recording_summary_queue_full: 'The summary queue is full. Check summary status before trying again.',
  account_budget_unavailable: 'Your account’s AI allowance is unavailable. Your original and transcript are kept.',
  account_budget_exceeded: 'There isn’t enough AI allowance for this summary right now. Your original and transcript are kept.',
  account_budget_reconciliation_required: 'Earlier AI usage is being checked. Your original and transcript are kept.',
  account_budget_attempt_already_reserved: 'This summary may already have started. Check status before trying again.',
  account_budget_attempt_not_dispatched: 'The summary outcome could not be confirmed. Check status before trying again.',
  request_budget_exceeded: 'This complete transcript exceeds the pilot reply limit. Nothing was shortened. Your original and transcript are kept.',
};
export const summaryFailure = (code?: string | null) => summaryMessages[code || ''] || 'The summary did not finish. Your original and transcript are kept. Check status later; it will not be sent again automatically.';

function validIntent(value: unknown, source: SummarySource): value is SummaryIntent {
  const v = value as SummaryIntent;
  return !!v && uuid.test(v.requestId) && v.recordingId === source.recordingId && v.originalSha256 === source.originalSha256 && v.transcriptSha256 === source.transcriptSha256;
}
/** One immutable request per owned transcript version, persisted before any begin. */
export function summaryRecovery(source: SummarySource) {
  const storage = personalStorage('localStorage'), key = `audio-summary-v1:${source.recordingId}:${source.transcriptSha256}`;
  const load = () => {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw Error('The saved summary request could not be read. No new summary was sent.'); }
    if (!validIntent(value, source)) throw Error('The saved summary request has different details. No new summary was sent.');
    return value;
  };
  return { load, save(intent: SummaryIntent) {
    if (!validIntent(intent, source)) throw Error('This summary request does not match the saved transcript.');
    const old = load(), raw = JSON.stringify(intent);
    if (old && JSON.stringify(old) !== raw) throw Error('Keep the saved summary request and check its status before continuing.');
    try { storage.setItem(key, raw); if (storage.getItem(key) !== raw) throw Error(); }
    catch { throw Error('Browser recovery could not be saved. No new summary was sent. Allow browser storage before continuing.'); }
  } };
}
function verified(value: RecordingSummary, recording: ArchivedRecording, pinned?: SummarySource): RecordingSummary {
  const s = value?.source, m = value?.summary;
  const sourceUrl = `https://hales.ai/cupcake/account?document=rec_${recording.id}`;
  if (!s || s.recordingId !== recording.id || s.originalSha256 !== recording.originalSha256 || !sha.test(s.transcriptSha256)
      || s.complete !== true || !Number.isInteger(s.transcriptBytes) || s.transcriptBytes < 1 || s.transcriptBytes > 100000
      || s.documentId !== `rec_${recording.id}` || s.sourceUrl !== sourceUrl || pinned && s.transcriptSha256 !== pinned.transcriptSha256
      || !m || m.recordingId !== s.recordingId || m.originalSha256 !== s.originalSha256 || m.transcriptSha256 !== s.transcriptSha256
      || typeof m.documentId !== 'string' || !m.documentId || m.documentId.length > 200 || !uuid.test(m.threadId) || !uuid.test(m.turnId)
      || m.sourceUrl !== sourceUrl || !['not_started', 'queued', 'running', 'completed', 'failed', 'uncertain', 'cancelled'].includes(m.status)) throw Error('The summary source could not be verified. Nothing was sent again. Check the saved transcript.');
  const thread = value.thread;
  if (m.status === 'not_started') {
    if (thread !== null) throw Error('The summary status could not be verified. Check again.');
  } else {
    const turn = thread?.turns?.[0];
    if (!thread || thread.id !== m.threadId || thread.turns.length !== 1 || !turn || turn.id !== m.turnId || turn.status !== m.status
        || m.status === 'completed' && (!turn.response || typeof turn.response.reply !== 'string' || !turn.response.reply.trim() || turn.response.reply.length > 200000 || typeof turn.response.model !== 'string')
        || m.status !== 'completed' && turn.response != null) throw Error('The saved summary could not be verified against this transcript. Check status again.');
  }
  return value;
}
/** The session captured here cannot be redirected to a later signed-in account. */
export class RecordingSummaryClient {
  private generation = sessionSnapshot().generation;
  constructor(private recording: ArchivedRecording) {}
  private async request(action: 'recording_summary_get' | 'recording_summary_begin', source?: SummarySource, intent?: SummaryIntent) {
    assertGeneration(this.generation);
    try {
      const result = await accountData<RecordingSummary>({ action, recordingId: this.recording.id, originalSha256: this.recording.originalSha256,
        ...(source ? { transcriptSha256: source.transcriptSha256 } : {}), ...(intent ? { requestId: intent.requestId } : {}) });
      assertGeneration(this.generation);
      return verified(result, this.recording, source);
    } catch (cause) {
      if (cause instanceof AccountRequestError) throw Error(summaryMessages[cause.code] || cause.message);
      throw cause;
    }
  }
  check(source?: SummarySource) { return this.request('recording_summary_get', source); }
  begin(source: SummarySource, intent: SummaryIntent) {
    if (!validIntent(intent, source)) throw Error('The saved summary request does not match this transcript.');
    return this.request('recording_summary_begin', source, intent);
  }
}
