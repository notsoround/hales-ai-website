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
type Connection = { connectionId: string; institutionName: string; status: string; lastSyncAt: string | null };
type Request = { request_id: string; status: string; connectionId: string | null };
type SyntheticBackend = { banks: Record<string, Connection>; requests: Record<string, Request[]>; mode: string; calls: { owner: string; action: string; body: Record<string, unknown> }[] };
const key = 'synthetic-bank-server';
const load = (): SyntheticBackend => JSON.parse(sessionStorage.getItem(key) || '{"banks":{},"requests":{},"mode":"success","calls":[]}');
const save = (value: SyntheticBackend) => sessionStorage.setItem(key, JSON.stringify(value));
Object.assign(window, {
  bankFixture: { load, mode: (mode: string) => { const state = load(); state.mode = mode; save(state); }, setReconnect: () => { const state = load(); if (state.banks[owner.account_id]) state.banks[owner.account_id].status = 'reconnect_required'; save(state); } },
  switchOwner: async (id: 'A' | 'B') => { invalidateSession('', false); owner = owners[id]; await restoreSession(); },
});
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== 'https://automate.hales.ai') throw Error('Unexpected network');
  const headers = new Headers(init?.headers), body = JSON.parse(String(init?.body || '{}'));
  const response = (value: object, status = 200) => Response.json({ ok: true, ...value, identity: owner }, { status });
  if (url.pathname.endsWith('/session')) return response({});
  if (!url.pathname.endsWith('/data') || headers.get('X-Cupcake-Account-Context') !== owner.account_id || init?.credentials !== 'include') throw Error('Wrong account context');
  const state = load();
  state.calls.push({ owner: owner.account_id, action: body.action, body });
  const rows = state.requests[owner.account_id] ||= [];
  const reply = (value: object, status = 200) => { save(state); return response(value, status); };
  if (body.action === 'bank_connection_status') return reply({
    configured: true, connections: state.banks[owner.account_id] ? [state.banks[owner.account_id]] : [], requests: rows,
    uncertainRequests: rows.filter(row => row.status === 'uncertain' || row.status === 'exchanging'),
    resolvedRequests: rows.filter(row => row.status === 'completed'),
  });
  if (body.action === 'bank_link_create' || body.action === 'bank_link_update_create') {
    if (!rows.some(row => row.request_id === body.request_id)) rows.push({ request_id: String(body.request_id), status: 'ready', connectionId: body.connectionId || null });
    return reply({ hosted_link_url: 'https://secure.plaid.com/hl/synthetic', expiration: '2099-01-01T00:00:00Z' });
  }
  if (body.action === 'bank_link_complete' || body.action === 'bank_link_update_complete') {
    const row = rows.find(item => item.request_id === body.request_id);
    if (!row) return reply({ ok: false, error: 'bank_request_not_found' }, 404);
    if (state.mode === 'expired') { row.status = 'expired'; return reply({ ok: false, error: 'bank_link_expired' }, 409); }
    if (state.mode === 'pending') return reply({ ok: false, error: 'bank_link_pending' }, 409);
    const connection = { connectionId: 'bank_connection_synthetic', institutionName: 'Synthetic Bank', status: 'connected', lastSyncAt: '2026-11-17T10:00:00Z' };
    row.status = 'completed'; row.connectionId = connection.connectionId; state.banks[owner.account_id] = connection;
    if (state.mode === 'lost') { state.mode = 'success'; save(state); throw Error('Synthetic response lost'); }
    return reply(body.action === 'bank_link_update_complete' ? { connectionId: connection.connectionId, status: 'connected' } : { connection, sync: { status: 'connected' } });
  }
  if (body.action === 'bank_sync') {
    const previous = state.banks[owner.account_id];
    if (!previous || body.connectionId !== previous.connectionId) throw Error('Wrong connection');
    previous.lastSyncAt = '2026-11-17T10:00:00Z';
    return reply({ status: 'connected', lastSyncAt: previous.lastSyncAt });
  }
  if (body.action === 'bank_disconnect') {
    const previous = state.banks[owner.account_id];
    if (!previous || body.connectionId !== previous.connectionId || body.confirmed !== true) throw Error('Wrong disconnection');
    previous.status = 'disconnected';
    return reply({ status: 'disconnected' });
  }
  throw Error('Unexpected synthetic action: ' + body.action);
};
await restoreSession();
createRoot(document.getElementById('root')!).render(<div className="cc-app" data-entry="account"><AccountBankConnection/></div>);
