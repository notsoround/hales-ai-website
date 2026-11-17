import { createRoot } from 'react-dom/client';
import { AccountReceiptReader } from '../src/components/cupcake/AccountReceiptReader';
import { restoreSession } from '../src/components/cupcake/accountSession';

if (!import.meta.env.DEV) throw Error('Synthetic fixture only.');
const identity = { account_id: 'acc_reader_fixture', email: 'reader@example.invalid', name: 'Synthetic reader' };
const receiptId = 'receipt_' + 'a'.repeat(32);
let request: { request_id: string; receiptId: string; status: string; error: string | null; dispatched: boolean } | null = null;
const state = { starts: 0, checks: 0, retries: 0, finished: 0, loseResponse: false, requestId: '', mode: 'queued' };
Object.assign(window, { readerFixture: state });
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== 'https://automate.hales.ai') throw Error('Unexpected network');
  const headers = new Headers(init?.headers), body = JSON.parse(String(init?.body || '{}'));
  const response = (value: object, status = 200) => Response.json({ ...value, identity }, { status });
  if (url.pathname.endsWith('/session')) return response({ ok: true });
  if (headers.get('X-Cupcake-Account-Context') !== identity.account_id || init?.credentials !== 'include') throw Error('Wrong account context');
  if (!url.pathname.endsWith('/data')) throw Error('Unexpected synthetic route');
  if (body.action === 'receipt_read_start') {
    state.starts++;
    if (body.receiptId !== receiptId) throw Error('Wrong receipt');
    request ||= { request_id: body.request_id, receiptId, status: 'queued', error: null, dispatched: false };
    state.requestId = request.request_id;
    if (state.loseResponse) { state.loseResponse = false; throw Error('Synthetic response lost'); }
    return response({ ok: true, request });
  }
  if (body.action === 'receipt_read_status') {
    state.checks++;
    if (!request) return response({ ok: false, error: 'receipt_read_not_found' }, 404);
    if (body.request_id !== request.request_id) throw Error('Wrong request ID');
    request = { ...request, status: state.mode, dispatched: state.mode !== 'queued' };
    return response({ ok: true, request });
  }
  if (body.action === 'receipt_read_retry') {
    state.retries++;
    if (!request || body.request_id !== request.request_id) throw Error('Wrong retry');
    return response({ ok: true, request });
  }
  throw Error('Unexpected synthetic action');
};
await restoreSession();
const autoStart = !new URL(location.href).searchParams.has('manual');
createRoot(document.getElementById('root')!).render(<AccountReceiptReader receiptId={receiptId} autoStart={autoStart} onFinished={() => state.finished++}/>);
