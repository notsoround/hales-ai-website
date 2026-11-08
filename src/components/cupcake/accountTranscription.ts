import { AccountRecordingClient, ArchiveRequestError, type ArchivedRecording } from './accountRecording';
import { personalStorage } from './personalStorage';

export type TranscriptionIntent = { request_id: string; recording_id: string; original_sha256: string; language: string | null };
export type TranscriptionRequest = { request_id: string; attempt: string; recording_id: string; status: 'queued' | 'running' | 'completed' | 'publication_pending' | 'failed' | 'uncertain'; error: string | null; dispatched: boolean; can_retry_unsent: boolean; can_publish_saved_result: boolean };
export type SavedTranscript = { text: string; source: 'speech-to-text'; requestedModel: string; actualModel: string | null; modelVerification: 'unreported' | 'provider-reported'; mayContainErrors: true; durationSeconds: number; originalSha256: string; createdAt: string; emptyTranscript: boolean };
export type TranscriptionResult = { request: TranscriptionRequest; originalStored: true; transcript?: SavedTranscript };
export class TranscriptionRequestError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'TranscriptionRequestError'; }
}
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const model = 'openai/whisper-1';
export const MAX_TRANSCRIPTION_SECONDS = 600;
const messages: Record<string, string> = {
  account_transcription_not_ready: 'Transcription is not available for this account yet. Your saved original is kept.',
  transcription_request_not_found: 'No matching transcription request was found. You can explicitly send the saved request; it will not be sent automatically.',
  transcription_request_conflict: 'This request has different saved details. Nothing was replaced. Check its status before continuing.',
  transcription_already_requested: 'Transcription was already requested for this original. Check the browser that started it, or look for a saved transcript in Library.',
  transcription_queue_full: 'The transcription queue is full. Your original and request are kept. Check status before trying again.',
  transcription_retry_not_allowed: 'This transcription cannot safely be sent again. Check its status; your original is kept.',
  transcription_publication_unavailable: 'No saved transcription result is available to publish. Check its status; audio will not be sent again.',
  transcription_too_long: 'This clip exceeded the duration limit when it was checked and was not sent for transcription. The current limit is ten minutes. Your saved original is unchanged.',
  decoder_invalid_audio: 'This audio could not be decoded for transcription. Your saved original is unchanged.',
  decoder_resource_limit: 'This clip could not be prepared within the transcription limits. Your saved original is unchanged.',
  recording_original_changed: 'The saved original could not be verified. Nothing was replaced. Refresh saved audio before continuing.',
  recording_not_found: 'This original is unavailable in the current account.',
  transcription_graph_changed: 'This request no longer matches its saved original. Nothing was replaced. Check its status before continuing.',
  transcription_model_mismatch: 'The transcription result could not be verified. Your original is kept; audio will not be sent again automatically.',
  account_budget_unavailable: 'Your account’s AI allowance is unavailable. Your original is kept.',
  account_budget_exceeded: 'Your account’s AI allowance is currently used or reserved. Your original is kept.',
  account_budget_reconciliation_required: 'Earlier AI usage is being checked. Your original is kept while the allowance is reviewed.',
};
export const transcriptionError = (code: string | null) => messages[code || ''] || 'Transcription did not finish. Your saved original is kept. Check status before trying again.';
export const permanentTranscriptionFailure = (code: string | null) => ['decoder_invalid_audio', 'recording_original_changed', 'transcription_graph_changed'].includes(code || '');
function validIntent(value: unknown, recording: ArchivedRecording): value is TranscriptionIntent {
  const v = value as TranscriptionIntent;
  return !!v && uuid.test(v.request_id) && v.recording_id === recording.id && /^[a-f0-9]{32}$/.test(v.recording_id)
    && v.original_sha256 === recording.originalSha256 && /^[a-f0-9]{64}$/.test(v.original_sha256)
    && (v.language === null || typeof v.language === 'string' && /^[a-z]{2}$/.test(v.language));
}
/** Exact owned original/intent binding, never a new paid request on reload. */
export function transcriptionRecovery(recording: ArchivedRecording) {
  const storage = personalStorage('localStorage'), key = 'audio-transcription-v1:' + recording.id;
  const load = () => {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw Error('The saved transcription request could not be read. No new request was sent.'); }
    if (!validIntent(value, recording)) throw Error('The saved transcription request does not match this original. No new request was sent.');
    return value;
  };
  return { load, save(intent: TranscriptionIntent) {
    if (!validIntent(intent, recording)) throw Error('The transcription request does not match this saved original.');
    const old = load(), raw = JSON.stringify(intent);
    if (old && JSON.stringify(old) !== raw) throw Error('Keep the original transcription request and check its status before continuing.');
    try { storage.setItem(key, raw); if (storage.getItem(key) !== raw) throw Error(); }
    catch { throw Error('Browser recovery could not be saved. No new transcription request was sent. Allow browser storage before continuing.'); }
  } };
}
function verified(value: TranscriptionResult, intent: TranscriptionIntent): TranscriptionResult {
  const r = value?.request;
  if (!r || r.request_id !== intent.request_id || r.recording_id !== intent.recording_id || !uuid.test(r.attempt)
      || !['queued', 'running', 'completed', 'publication_pending', 'failed', 'uncertain'].includes(r.status)
      || !(r.error === null || typeof r.error === 'string' && r.error.length <= 200) || typeof r.dispatched !== 'boolean'
      || typeof r.can_retry_unsent !== 'boolean' || typeof r.can_publish_saved_result !== 'boolean' || value.originalStored !== true
      || r.can_retry_unsent && (r.status !== 'failed' || r.dispatched) || r.can_publish_saved_result && r.status !== 'publication_pending') throw Error('The transcription status could not be verified. Check the same request again.');
  if (r.status === 'completed') {
    const t = value.transcript;
    if (!t || typeof t.text !== 'string' || t.text.length > 524288 || t.source !== 'speech-to-text' || t.requestedModel !== model
        || !(t.actualModel === null || t.actualModel === model) || t.modelVerification !== (t.actualModel === null ? 'unreported' : 'provider-reported')
        || t.mayContainErrors !== true || !Number.isFinite(t.durationSeconds) || t.durationSeconds <= 0 || t.durationSeconds > MAX_TRANSCRIPTION_SECONDS
        || t.originalSha256 !== intent.original_sha256 || !Number.isFinite(Date.parse(t.createdAt)) || t.emptyTranscript !== !t.text.trim()) throw Error('The saved transcript could not be verified against this original. Check the same request again.');
  } else if (value.transcript !== undefined) throw Error('An unfinished request returned an unexpected transcript. Check its status again.');
  return value;
}
export async function requestTranscription(client: AccountRecordingClient, action: 'transcribe' | 'transcription-status' | 'transcription-retry' | 'transcription-publish', intent: TranscriptionIntent) {
  try {
    const result = await client.request<TranscriptionResult>(action, action === 'transcribe' ? intent : { request_id: intent.request_id });
    return verified(result, intent);
  } catch (cause) {
    if (cause instanceof ArchiveRequestError) throw new TranscriptionRequestError(transcriptionError(cause.code), cause.code);
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw Error('The transcription response was not confirmed. Check the saved request before trying again. Your original is kept.');
  }
}
