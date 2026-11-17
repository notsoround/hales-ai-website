import { createRoot } from 'react-dom/client';
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
    if (state.failAfterCommit) { state.failAfterCommit = false; throw Error('Synthetic response lost'); }
    return response({ ok: true, receipt, duplicate: !!previous });
  }
  if (url.pathname.endsWith('/data') && body.action === 'receipt_get') {
    const receipt = data.get(owner.account_id + ':' + body.receiptId);
    return response(receipt ? { ok: true, receipt } : { ok: false }, receipt ? 200 : 404);
  }
  throw Error('Unexpected synthetic request: ' + url.pathname);
};
await restoreSession();
function render() { createRoot(document.getElementById('root')!).render(<AccountReceiptPhoto onSaved={id => state.saved.push(id)} />); }
render();
