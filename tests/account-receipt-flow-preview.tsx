import { createRoot } from 'react-dom/client';
import ReceiptWorkspace from '../src/components/cupcake/ReceiptWorkspace';
import { restoreSession } from '../src/components/cupcake/accountSession';
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic fixture only.');
const identity = { account_id: 'acc_receipt_flow', email: 'receipt@example.invalid', name: 'Synthetic receipt' };
const date = new Date().toISOString().slice(0, 10);
const state = { actions: [] as string[], startCount: 0, matchCount: 0, confirmCount: 0, noBank: false, needsBankAttention: false };
Object.assign(window, { receiptFlowFixture: state });
let receipt: { id: string; status: string; merchant: string | null; date: string | null; currency: string | null; total: number | null; tip: number | null; tax: number | null; lineItems: never[]; matchedTransactionId: string | null; createdAt: string } | null = null;
let readRequest: { request_id: string; receiptId: string; status: string; error: string | null; dispatched: boolean } | null = null;
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== 'https://automate.hales.ai') throw Error('Unexpected network');
  const headers = new Headers(init?.headers), body = JSON.parse(String(init?.body || '{}'));
  const response = (value: object, status = 200) => Response.json({ ok: true, ...value, identity }, { status });
  if (url.pathname.endsWith('/session')) return response({});
  if (headers.get('X-Cupcake-Account-Context') !== identity.account_id || init?.credentials !== 'include') throw Error('Wrong account context');
  if (url.pathname.endsWith('/receipts/photo')) {
    receipt = { id: 'receipt_' + body.request_id.replace(/-/g, ''), status: 'saved_unread', merchant: null, date: null, currency: null, total: null, tip: null, tax: null, lineItems: [], matchedTransactionId: null, createdAt: new Date().toISOString() };
    return response({ receipt, duplicate: false });
  }
  if (!url.pathname.endsWith('/data')) throw Error('Unexpected synthetic route');
  state.actions.push(body.action);
  if (body.action === 'bank_connection_status') return response({ configured: true, connections: [{ connectionId: 'synthetic_bank', status: state.needsBankAttention ? 'reconnect_required' : 'connected' }], uncertainRequests: [], resolvedRequests: [] });
  if (body.action === 'bank_sync') {
    if (body.connectionId !== 'synthetic_bank') throw Error('Wrong bank owner or connection');
    return response({ status: 'connected' });
  }
  if (body.action === 'receipt_list') return response({ receipts: receipt ? [receipt] : [] });
  if (body.action === 'receipt_get') return response({ receipt });
  if (body.action === 'receipt_read_start') {
    state.startCount++;
    if (!receipt || body.receiptId !== receipt.id) throw Error('Wrong receipt');
    readRequest = { request_id: body.request_id, receiptId: receipt.id, status: 'queued', error: null, dispatched: false };
    return response({ request: readRequest });
  }
  if (body.action === 'receipt_read_status') {
    if (!receipt || !readRequest || body.request_id !== readRequest.request_id) throw Error('Wrong read request');
    receipt = { ...receipt, status: 'extracted', merchant: 'Synthetic Market', date, currency: 'USD', total: 12.50 };
    readRequest = { ...readRequest, status: 'completed', dispatched: true };
    return response({ request: readRequest, receipt });
  }
  if (body.action === 'receipt_match_candidates') {
    state.matchCount++;
    if (state.noBank) return response({ receipt, candidates: [], coverage: { complete: false, checkedAt: null, warnings: ['No bank coverage has been saved for this account.'] }, matchSummary: { exactCount: 0 } });
    return response({ receipt, candidates: [{ transactionId: 'synthetic_tx_1', merchant: 'Synthetic Market', date, amount: 12.50, currency: 'USD', pending: false, exactAmount: true, exactCurrency: true }], coverage: { complete: true }, matchSummary: { exactCount: 1 } });
  }
  if (body.action === 'receipt_confirm_match') {
    state.confirmCount++;
    if (!receipt || body.transactionId !== 'synthetic_tx_1') throw Error('Wrong candidate');
    receipt = { ...receipt, status: 'matched', matchedTransactionId: body.transactionId };
    return response({ receipt });
  }
  throw Error('Unexpected synthetic action: ' + body.action);
};
await restoreSession();
createRoot(document.getElementById('root')!).render(<div className="cc-app"><ReceiptWorkspace/></div>);
