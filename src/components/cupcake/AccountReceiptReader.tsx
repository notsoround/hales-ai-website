import { useCallback, useEffect, useRef, useState } from 'react';
import { accountData, AccountRequestError, assertGeneration, sessionSnapshot } from './accountSession';
import { personalStorage } from './personalStorage';

type ReadRequest = {
  request_id: string;
  receiptId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'uncertain';
  error: string | null;
  dispatched: boolean;
};
type ReadResponse = { request: ReadRequest };
const statuses = new Set(['queued', 'running', 'completed', 'failed', 'uncertain']);

export function AccountReceiptReader({ receiptId, autoStart, canStart = true, onFinished }: {
  receiptId: string;
  autoStart: boolean;
  canStart?: boolean;
  onFinished: () => void;
}) {
  const [storage] = useState(() => personalStorage('localStorage'));
  const [generation] = useState(() => sessionSnapshot().generation);
  const [requestId, setRequestId] = useState('');
  const [request, setRequest] = useState<ReadRequest | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const finished = useRef(onFinished);
  finished.current = onFinished;
  const key = 'receipt-read:' + receiptId;
  const active = useCallback(() => {
    assertGeneration(generation);
    if (!alive.current) throw new DOMException('The receipt was closed.', 'AbortError');
  }, [generation]);

  const accept = useCallback((data: ReadResponse, id: string) => {
    active();
    const row = data?.request;
    if (!row || row.request_id !== id || row.receiptId !== receiptId || !statuses.has(row.status) || typeof row.dispatched !== 'boolean') {
      throw Error('The receipt reading status could not be confirmed.');
    }
    setRequest(row); setMissing(false); setError('');
    if (row.status === 'completed' && !completed.current) {
      completed.current = true;
      storage.removeItem(key);
      finished.current();
    }
  }, [active, receiptId, storage, key]);

  const check = useCallback(async (id: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try { accept(await accountData<ReadResponse>({ action: 'receipt_read_status', request_id: id }), id); }
    catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        if (cause instanceof AccountRequestError && cause.code === 'receipt_read_not_found') {
          setMissing(true); setError('');
        } else setError('Could not check receipt reading. Try checking its status again.');
      }
    } finally { inFlight.current = false; }
  }, [accept, generation]);

  const begin = useCallback(async (id: string, action: 'receipt_read_start' | 'receipt_read_retry') => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      active();
      storage.setItem(key, id);
      setRequestId(id); setMissing(false);
      const body = action === 'receipt_read_start'
        ? { action, receiptId, request_id: id }
        : { action, request_id: id };
      accept(await accountData<ReadResponse>(body), id);
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError(cause instanceof Error ? cause.message : 'The reading request could not be confirmed. Check its status before retrying.');
      }
    } finally {
      inFlight.current = false;
      if (alive.current && sessionSnapshot().generation === generation) setBusy(false);
    }
  }, [accept, active, generation, key, receiptId, storage]);

  useEffect(() => {
    alive.current = true;
    try {
      const saved = storage.getItem(key);
      if (saved) { setRequestId(saved); void check(saved); }
      else if (autoStart && canStart) void begin(crypto.randomUUID(), 'receipt_read_start');
    } catch {
      setError('Receipt reading needs browser storage to keep its request safe.');
    }
    return () => { alive.current = false; };
  }, [autoStart, begin, canStart, check, key, storage]);

  useEffect(() => {
    if (!requestId || !request || !['queued', 'running'].includes(request.status) || busy || error) return;
    const timer = setTimeout(() => void check(requestId), 2500);
    return () => clearTimeout(timer);
  }, [requestId, request, busy, error, check]);

  if (request?.status === 'completed') return <p role="status">Receipt reading complete.</p>;
  return <div className="cc-receipt-read">
    {request?.status === 'queued' && <p role="status">Receipt saved. Waiting to read the photo…</p>}
    {request?.status === 'running' && <p role="status">Reading your receipt…</p>}
    {request?.status === 'uncertain' && <p role="status">The reading result could not be confirmed. Check its status before trying again.</p>}
    {request?.status === 'failed' && <p role="status">The receipt could not be read. Your saved photo is available.</p>}
    {error && <p role="alert">{error}</p>}
    {!requestId && canStart && (!autoStart || !!error) && <button className="cc-secondary" disabled={busy} onClick={() => void begin(crypto.randomUUID(), 'receipt_read_start')}>Read receipt photo</button>}
    {!requestId && !canStart && <p role="status">Receipt reading is already in progress. Refresh your receipts to check for the result.</p>}
    {requestId && (error || request?.status === 'uncertain') && <button className="cc-secondary" disabled={busy} onClick={() => void check(requestId)}>Check reading status</button>}
    {requestId && missing && <button className="cc-secondary" disabled={busy} onClick={() => void begin(requestId, 'receipt_read_start')}>Start reading</button>}
    {requestId && request?.status === 'failed' && !request.dispatched && <button className="cc-secondary" disabled={busy} onClick={() => void begin(requestId, 'receipt_read_retry')}>Retry reading</button>}
  </div>;
}
