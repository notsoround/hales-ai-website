import { assertGeneration, invalidateSession, sessionSnapshot, subscribeSession } from './accountSession';
import type { Draft } from './storage';
import type { UploadProgress } from './recordingUpload';

export const ACCOUNT_AUDIO_PART_BYTES = 1024 * 1024;
export const ACCOUNT_AUDIO_FILE_BYTES = 32 * ACCOUNT_AUDIO_PART_BYTES;
const API = 'https://automate.hales.ai/api/account/recordings/';
export type ArchivedRecording = {
  id: string; title: string; createdAt: string; mimeType: string; status: 'uploading' | 'stored';
  receivedParts: {index: number; size: number}[]; receivedBytes: number; totalBytes: number; partBytes: number;
  originalStored: boolean; originalBytes: number | null; originalSha256: string | null;
};
export class ArchiveRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}
const messages: Record<string, string> = {
  recording_archive_not_ready: 'Saving audio to your account is not available yet. Your local original is kept.',
  recording_file_limit: 'Account audio saving supports files up to 32 MiB. Keep this original or split a copy before uploading.',
  recording_account_limit: 'Your account audio archive has reached its 128 MiB limit. Your local original is kept.',
  recording_incomplete_limit: 'Two audio uploads are unfinished. Resume one before starting another.',
  recording_storage_full: 'Audio storage is full. Your local original is kept; try again later.',
  recording_intent_conflict: 'This upload refers to a different saved original. Nothing was replaced. Keep your local original.',
  recording_part_conflict: 'An audio part differs from the saved part. Nothing was replaced. Keep your local original.',
  recording_hash_mismatch: 'The server could not verify the original audio. Your local copy is kept.',
  recording_link_expired: 'This playback link expired. Open the audio again to get a fresh link.',
  recording_not_found: 'This saved audio is unavailable in your current account.',
};

/** A single captured account for the entire upload, not a new owner per part. */
export class AccountRecordingClient {
  private snapshot = sessionSnapshot();
  private controller = new AbortController();
  private unsubscribe = subscribeSession(() => this.controller.abort());
  dispose() { this.controller.abort(); this.unsubscribe(); }
  assert() {
    assertGeneration(this.snapshot.generation);
    if (this.controller.signal.aborted) throw new DOMException('Audio request cancelled.', 'AbortError');
    if (!this.snapshot.identity) throw Error('Sign in before saving or opening audio.');
    return this.snapshot.identity.account_id;
  }
  async request<T>(route: string, body: Record<string, unknown> | Blob): Promise<T> {
    const owner = this.assert();
    const request = new AbortController(), abort = () => request.abort();
    this.controller.signal.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(abort, 60000);
    try {
    const response = await fetch(API + route, {
      method: 'POST', credentials: 'include', cache: 'no-store', signal: request.signal,
      headers: {'Content-Type': body instanceof Blob ? 'application/octet-stream' : 'application/json',
        'X-Cupcake-Request': 'account', 'X-Cupcake-Account-Context': owner},
      body: body instanceof Blob ? body : JSON.stringify(body),
    });
    this.assert();
    const result = await response.json().catch(() => null);
    this.assert();
    if (response.status === 401 || result?.error === 'account_context_changed') {
      invalidateSession('Your session expired or changed. Sign in again.');
      throw Error('Your session expired or changed. Your local audio is kept.');
    }
    if (!response.ok || result?.ok !== true) throw new ArchiveRequestError(messages[result?.error]
      || (response.status === 429 ? 'Too many audio requests. Wait a moment and try again.' : 'Audio saving could not be confirmed. Your local original is kept; you can resume.'), response.status, result?.error || 'archive_request_failed');
    if (result.identity?.account_id !== owner) throw Error('The server did not confirm the current account. Your local original is kept.');
    return result as T;
    } catch (error) {
      this.assert();
      if (request.signal.aborted) throw Error('The audio request timed out. Your local original is kept; you can resume.');
      throw error;
    } finally { clearTimeout(timer); this.controller.signal.removeEventListener('abort', abort); }
  }
  async original(id: string, purpose: 'play' | 'download') {
    const result = await this.request<{url: string; expiresAt: number}>('original-link', {id, purpose});
    const url = new URL(result.url);
    if (url.origin !== 'https://automate.hales.ai' || url.pathname !== '/api/account/recordings/original'
      || !/^\?token=[A-Za-z0-9_-]{43}$/.test(url.search) || url.hash || !Number.isFinite(result.expiresAt)) throw Error('The server did not provide a valid audio link.');
    return result;
  }
}

function receipt(value: ArchivedRecording, bytes: number) {
  if (!value || !/^[a-f0-9]{32}$/.test(value.id) || !['uploading', 'stored'].includes(value.status)
    || value.totalBytes !== bytes || value.partBytes !== ACCOUNT_AUDIO_PART_BYTES || !Array.isArray(value.receivedParts)) throw Error('The server did not confirm this audio upload. Your local original is kept.');
  return value;
}
export async function uploadAccountRecording({draft, blob, onProgress, transport}: {draft: Draft; blob: Blob; onProgress: (progress: UploadProgress) => void; transport?: AccountRecordingClient}) {
  if (!blob.size || blob.size > ACCOUNT_AUDIO_FILE_BYTES) throw Error(messages.recording_file_limit);
  const client = transport || new AccountRecordingClient();
  try {
    client.assert();
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
    client.assert();
    const result = await client.request<{recording: ArchivedRecording}>('start', {
      uploadId: draft.id, title: draft.title.trim() || 'Untitled recording', mimeType: draft.mime || blob.type || 'audio/mp4', totalBytes: blob.size, sha256,
    });
    let record = receipt(result.recording, blob.size);
    const parts = Math.ceil(blob.size / ACCOUNT_AUDIO_PART_BYTES);
    if (record.status === 'uploading') {
      const received = new Map<number, number>();
      for (const part of record.receivedParts) {
        if (!Number.isInteger(part.index) || part.index < 0 || part.index >= parts
          || part.size !== Math.min(ACCOUNT_AUDIO_PART_BYTES, blob.size - part.index * ACCOUNT_AUDIO_PART_BYTES) || received.has(part.index)) throw Error('The saved audio parts could not be verified. Your local original is kept.');
        received.set(part.index, part.size);
      }
      let bytes = [...received.values()].reduce((sum, n) => sum + n, 0);
      for (let index = 0; index < parts; index++) {
        if (received.has(index)) continue;
        client.assert();
        onProgress({id: draft.id, phase: 'uploading', received: bytes, total: blob.size, retryAttempt: 0});
        const part = blob.slice(index * ACCOUNT_AUDIO_PART_BYTES, Math.min((index + 1) * ACCOUNT_AUDIO_PART_BYTES, blob.size));
        const ack = await client.request<{id: string; part: number; received: boolean; receivedBytes: number}>(`part?id=${encodeURIComponent(record.id)}&index=${index}`, part);
        if (ack.id !== record.id || ack.part !== index || ack.received !== true || ack.receivedBytes !== bytes + part.size) throw Error('An audio part was not confirmed. Your local original is kept; resume to check saved parts.');
        bytes = ack.receivedBytes;
      }
      onProgress({id: draft.id, phase: 'finishing', received: blob.size, total: blob.size, retryAttempt: 0});
      record = receipt((await client.request<{recording: ArchivedRecording}>('finish', {id: record.id, parts})).recording, blob.size);
    }
    if (record.status !== 'stored' || record.originalStored !== true || record.originalBytes !== blob.size || record.originalSha256 !== sha256) throw Error('The server did not verify the original audio. Your local copy is kept; resume to confirm.');
    client.assert();
    return record;
  } finally { client.dispose(); }
}
