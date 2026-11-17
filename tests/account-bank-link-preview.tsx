import { createRoot } from 'react-dom/client';
import { AccountBankConnection } from '../src/components/cupcake/AccountBankConnection';
import { invalidateSession, restoreSession } from '../src/components/cupcake/accountSession';
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic fixture only.');
const owners = {
  A: { account_id: 'acc_bank_a', email: 'a@example.invalid', name: 'Synthetic A' },
  B: { account_id: 'acc_bank_b', email: 'b@example.invalid', name: 'Synthetic B' },
};
let owner = owners.A;
const banks = new Map<string, { connectionId: string; institutionName: string; status: string; lastSyncAt: string | null }>();
const resolved = new Map<string, { request_id: string; connectionId: string }[]>();
const fixture = {
  calls: [] as { owner: string; action: string; body: Record<string, unknown> }[],
  opened: 0, returnedUri: '', token: '', success: (_token: string | null) => {}, exit: () => {}, failExchange: false,
};
Object.assign(window, { bankFixture: fixture, switchOwner: async (key: 'A' | 'B') => {
  invalidateSession('', false); owner = owners[key]; await restoreSession();
}, setBankNeedsReconnect: () => {
  const previous = banks.get(owner.account_id);
  if (previous) banks.set(owner.account_id, { ...previous, status: 'reconnect_required' });
} });
window.Plaid = { create(config) {
  fixture.token = config.token;
  fixture.returnedUri = config.receivedRedirectUri || '';
  fixture.success = config.onSuccess;
  fixture.exit = config.onExit;
  return { open() { fixture.opened++; }, destroy() {} };
} };
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== 'https://automate.hales.ai') throw Error('Unexpected network');
  const headers = new Headers(init?.headers), body = JSON.parse(String(init?.body || '{}'));
  const response = (value: object, status = 200) => Response.json({ ok: true, ...value, identity: owner }, { status });
  if (url.pathname.endsWith('/session')) return response({});
  if (!url.pathname.endsWith('/data') || headers.get('X-Cupcake-Account-Context') !== owner.account_id || init?.credentials !== 'include') throw Error('Wrong account context');
  fixture.calls.push({ owner: owner.account_id, action: body.action, body });
  if (body.action === 'bank_connection_status') return response({ configured: true, connections: banks.has(owner.account_id) ? [banks.get(owner.account_id)] : [], uncertainRequests: [], resolvedRequests: resolved.get(owner.account_id) || [] });
  if (body.action === 'bank_link_create') return response({ link_token: 'synthetic-link-token', expiration: '2099-01-01T00:00:00Z' });
  if (body.action === 'bank_link_update_create') return response({ link_token: 'synthetic-update-token', expiration: '2099-01-01T00:00:00Z' });
  if (body.action === 'bank_link_update_complete') {
    const previous = banks.get(owner.account_id);
    if (!previous || body.connectionId !== previous.connectionId) throw Error('Wrong connection');
    banks.set(owner.account_id, { ...previous, status: 'connected', lastSyncAt: '2026-11-17T10:00:00Z' });
    return response({ connectionId: previous.connectionId, status: 'connected', lastSyncAt: '2026-11-17T10:00:00Z' });
  }
  if (body.action === 'bank_link_exchange') {
    const connection = { connectionId: 'bank_connection_synthetic', institutionName: 'Synthetic Bank', status: 'connected', lastSyncAt: null };
    banks.set(owner.account_id, connection);
    resolved.set(owner.account_id, [...(resolved.get(owner.account_id) || []), { request_id: String(body.request_id), connectionId: connection.connectionId }]);
    if (fixture.failExchange) { fixture.failExchange = false; throw Error('Synthetic response lost'); }
    return response({ connection });
  }
  if (body.action === 'bank_sync') {
    const previous = banks.get(owner.account_id);
    if (!previous || body.connectionId !== previous.connectionId) throw Error('Wrong connection');
    banks.set(owner.account_id, { ...previous, lastSyncAt: '2026-11-17T10:00:00Z' });
    return response({ status: 'connected', lastSyncAt: '2026-11-17T10:00:00Z', added: 1, modified: 0, removed: 0 });
  }
  if (body.action === 'bank_disconnect') {
    const previous = banks.get(owner.account_id);
    if (!previous || body.connectionId !== previous.connectionId || body.confirmed !== true) throw Error('Wrong disconnection');
    banks.set(owner.account_id, { ...previous, status: 'disconnected' });
    return response({ status: 'disconnected' });
  }
  throw Error('Unexpected synthetic action: ' + body.action);
};
await restoreSession();
createRoot(document.getElementById('root')!).render(<div className="cc-app" data-entry="account"><AccountBankConnection/></div>);
