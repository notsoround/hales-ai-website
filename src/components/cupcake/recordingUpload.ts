import type { Conversation } from './library';

export class RecordingRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export type UploadProgress = { id: string; received: number; total: number; phase: 'uploading' | 'finishing'; retryAttempt?: number };
type Receipt = { recording?: Conversation & { receivedParts?: { index: number; size: number }[] }; id?: string; received?: boolean; part?: number };
type Request = (path: string, init?: RequestInit) => Promise<Receipt>;
export const UPLOAD_PART_BYTES = 8 * 1024 * 1024;

function temporary(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')
    || (error instanceof RecordingRequestError && [408, 429, 500, 502, 503, 504].includes(error.status));
}

export async function uploadRecording(options: {
  draft: { id: string; title: string; mime: string };
  blob: Blob;
  request: Request;
  onProgress: (progress: UploadProgress) => void;
  wait?: (milliseconds: number) => Promise<void>;
}) {
  const { draft, blob, request, onProgress } = options;
  if (!blob.size) throw new Error('This draft contains no audio.');
  const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let received = 0;
  let phase: UploadProgress['phase'] = 'uploading';
  const progress = (retryAttempt?: number) => onProgress({ id: draft.id, received, total: blob.size, phase, retryAttempt });
  const send = async (path: string, init: RequestInit) => {
    for (let attempt = 0; ; attempt++) {
      try { const response = await request(path, init); progress(); return response; }
      catch (error) {
        if (attempt >= 2 || !temporary(error)) throw error;
        progress(attempt + 1);
        await wait(1000 * (attempt + 1));
      }
    }
  };
  const json = (body: object): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  progress();
  const started = await send('cupcake-recording-start', json({ title: draft.title, uploadId: draft.id, mimeType: blob.type || draft.mime, totalBytes: blob.size }));
  const id = started.recording?.id || started.id;
  if (!id || !/^[a-f0-9]{32}$/.test(id)) throw new Error('Upload could not be initialized.');
  if (started.recording && started.recording.status !== 'uploading') return started.recording;
  const parts = Math.ceil(blob.size / UPLOAD_PART_BYTES);
  const savedParts = new Map((started.recording?.receivedParts || []).map(part => [part.index, part.size]));
  for (let index = 0; index < parts; index++) {
    const start = index * UPLOAD_PART_BYTES;
    const end = Math.min(blob.size, start + UPLOAD_PART_BYTES);
    if (savedParts.get(index) !== end - start) {
      const data = new FormData();
      data.append('audio', blob.slice(start, end), `part-${index}`);
      data.append('id', id); data.append('index', String(index));
      const receipt = await send('cupcake-recording-part', { method: 'POST', body: data });
      if (receipt.received !== true || receipt.id !== id || receipt.part !== index) throw new Error('The server did not confirm this audio part. Your original is saved; resume the upload to check again.');
    }
    received = end; progress();
  }
  phase = 'finishing'; progress();
  const finished = await send('cupcake-recording-finish', json({ id, parts }));
  if (!finished.recording || finished.recording.id !== id || finished.recording.status === 'uploading') throw new Error('The server has not confirmed a transcription job yet. Resume the upload to check its status.');
  return finished.recording;
}
