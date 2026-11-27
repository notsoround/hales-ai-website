import { createRoot } from 'react-dom/client';
import { receiptDraftStore } from '../src/components/cupcake/accountReceiptDraft';
import { AccountReceiptPhoto } from '../src/components/cupcake/AccountReceiptPhoto';
import { invalidateSession, restoreSession } from '../src/components/cupcake/accountSession';

if (!import.meta.env.DEV) throw Error('Synthetic fixture only.');
const owners = {
  A: { account_id: 'acc_receipt_a', email: 'a@example.invalid', name: 'Synthetic A' },
  B: { account_id: 'acc_receipt_b', email: 'b@example.invalid', name: 'Synthetic B' },
};
let owner = owners.A;
const data = new Map<string, { id: string; status: string; image: string }>();
const state = { requests: [] as { owner: string; id: string; image: string }[], failAfterCommit: false, off: false, saved: [] as string[] };
Object.assign(window, { receiptFixture: state, switchOwner: async (key: 'A' | 'B') => { invalidateSession('', false); owner = owners[key]; await restoreSession(); } });
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== 'https://automate.hales.ai') throw Error('Unexpected network');
  const headers = new Headers(init?.headers), body = JSON.parse(String(init?.body || '{}'));
  const response = (value: object, status = 200) => Response.json({ ...value, identity: owner }, { status });
  if (url.pathname.endsWith('/session')) return response({ ok: true });
  if (headers.get('X-Cupcake-Account-Context') !== owner.account_id || init?.credentials !== 'include') return response({ ok: false, error: 'account_context_changed' }, 409);
  if (url.pathname.endsWith('/receipts/photo')) {
    const id = 'receipt_' + body.request_id.replace(/-/g, '').toLowerCase();
    const key = owner.account_id + ':' + id;
    state.requests.push({ owner: owner.account_id, id, image: body.image });
    if (state.off) return response({ ok: false, error: 'account_receipt_photo_not_ready' }, 503);
    const previous = data.get(key);
    if (previous && previous.image !== body.image) return response({ ok: false }, 409);
    const receipt = previous || { id, status: 'saved_unread', image: body.image };
    data.set(key, receipt);
    if (state.failAfterCommit) { state.failAfterCommit = false; receipt.status = 'extracted'; throw Error('Synthetic response lost'); }
    return response({ ok: true, receipt, duplicate: !!previous });
  }
  if (url.pathname.endsWith('/data') && body.action === 'receipt_get') {
    const receipt = data.get(owner.account_id + ':' + body.receiptId);
    return response(receipt ? { ok: true, receipt } : { ok: false }, receipt ? 200 : 404);
  }
  throw Error('Unexpected synthetic request: ' + url.pathname);
};
await restoreSession();
if (new URLSearchParams(location.search).get('demo') === 'photo-retry') {
  const paper = document.createElement('canvas');
  paper.width = 280; paper.height = 100;
  const ink = paper.getContext('2d')!;
  ink.fillStyle = '#fbf6e7'; ink.fillRect(0, 0, paper.width, paper.height);
  ink.fillStyle = '#201f21'; ink.font = '18px monospace';
  ink.fillText('MARINA MARKET', 18, 30); ink.fillText('Total     $24.00', 18, 62);
  const image = paper.toDataURL('image/png');
  const request_id = '11111111-2222-4333-8444-555555555555';
  const id = 'receipt_' + request_id.replaceAll('-', '');
  data.set(owner.account_id + ':' + id, { id, status: 'extracted', image });
  await receiptDraftStore().save({request_id, image});
}
function render() { createRoot(document.getElementById('root')!).render(<AccountReceiptPhoto onSaved={id => state.saved.push(id)} />); }
render();
