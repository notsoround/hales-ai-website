import { useCallback, useEffect, useRef, useState } from 'react';
import { accountData, assertGeneration, sessionSnapshot } from './accountSession';
import { personalStorage } from './personalStorage';
import { notifyDataChanged } from './dataChanges';
import { appConfirm } from './appConfirm';

type Connection = { connectionId: string; institutionName: string | null; status: string; lastSyncAt: string | null };
type BankStatus = { configured: boolean; connections: Connection[]; uncertainRequests: {request_id: string; status: string}[]; resolvedRequests: {request_id: string; connectionId: string}[] };
type LinkSession = { requestId: string; token: string; connectionId?: string };
type PlaidHandler = { open: () => void; destroy: () => void };
type PlaidApi = { create: (config: { token: string; receivedRedirectUri?: string; onSuccess: (publicToken: string | null) => void; onExit: () => void }) => PlaidHandler };
declare global { interface Window { Plaid?: PlaidApi } }
const LINK_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
const LINK_SESSION_KEY = 'cupcake-bank-link-session-v1';
const PENDING_EXCHANGE_KEY = 'cupcake-bank-exchange-pending-v1';

function loadPlaid(): Promise<PlaidApi> {
  if (window.Plaid) return Promise.resolve(window.Plaid);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LINK_SCRIPT;
    script.async = true;
    script.onload = () => window.Plaid ? resolve(window.Plaid) : reject(Error('Bank connection could not open.'));
    script.onerror = () => { script.remove(); reject(Error('Bank connection could not load. Check your connection and try again.')); };
    document.head.append(script);
  });
}

export function AccountBankConnection() {
  const [storage] = useState(() => personalStorage('sessionStorage'));
  const [generation] = useState(() => sessionSnapshot().generation);
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingExchange, setPendingExchange] = useState(() => {
    try { return storage.getItem(PENDING_EXCHANGE_KEY) || ''; } catch { return ''; }
  });
  const pendingExchangeRef = useRef(pendingExchange);
  const handler = useRef<PlaidHandler | null>(null);
  const root = useRef<HTMLElement>(null);
  const alive = useRef(true);
  const request = useRef(false);
  const active = useCallback(() => {
    assertGeneration(generation);
    if (!alive.current) throw new DOMException('The bank connection screen was closed.', 'AbortError');
  }, [generation]);

  const refresh = useCallback(async () => {
    const result = await accountData<BankStatus>({ action: 'bank_connection_status' });
    active();
    if (typeof result.configured !== 'boolean' || !Array.isArray(result.connections) || !Array.isArray(result.uncertainRequests) || !Array.isArray(result.resolvedRequests)) throw Error('Bank connection status could not be confirmed.');
    const pending = pendingExchangeRef.current;
    if (pending && result.resolvedRequests.some(item => item.request_id === pending && item.connectionId)) {
      storage.removeItem(PENDING_EXCHANGE_KEY);
      storage.removeItem(LINK_SESSION_KEY);
      pendingExchangeRef.current = '';
      setPendingExchange('');
      setError('');
      setMessage('Bank connection confirmed. Refresh transactions to use it for receipt matching.');
    }
    setStatus(result);
    return result;
  }, [active, storage]);

  const openLink = useCallback(async (session: LinkSession, redirect?: string) => {
    const Plaid = await loadPlaid();
    active();
    handler.current?.destroy();
    handler.current = Plaid.create({
      token: session.token,
      ...(redirect ? { receivedRedirectUri: redirect } : {}),
      onSuccess: publicToken => {
        void (async () => {
          if ((!publicToken && !session.connectionId) || request.current) return;
          request.current = true;
          setBusy(true); setError(''); setMessage('Confirming your connection…');
          try {
            active();
            if (session.connectionId) {
              const result = await accountData<{ connectionId: string; status: string }>({ action: 'bank_link_update_complete', request_id: session.requestId, connectionId: session.connectionId });
              active();
              if (result.connectionId !== session.connectionId) throw Error('The bank reconnection could not be confirmed.');
              storage.removeItem(LINK_SESSION_KEY);
              const url = new URL(location.href); url.searchParams.delete('oauth_state_id'); history.replaceState(history.state, '', url);
              notifyDataChanged('purchase');
              await refresh(); active(); setMessage('Bank reconnected and transactions refreshed.');
              return;
            }
            storage.setItem(PENDING_EXCHANGE_KEY, session.requestId);
            pendingExchangeRef.current = session.requestId;
            setPendingExchange(session.requestId);
            const result = await accountData<{ connection: Connection }>({ action: 'bank_link_exchange', request_id: session.requestId, public_token: publicToken });
            active();
            if (!result.connection?.connectionId) throw Error('The bank connection could not be confirmed.');
            storage.removeItem(LINK_SESSION_KEY);
            storage.removeItem(PENDING_EXCHANGE_KEY);
            pendingExchangeRef.current = '';
            setPendingExchange('');
            const url = new URL(location.href);
            url.searchParams.delete('oauth_state_id');
            history.replaceState(history.state, '', url);
            try {
              await accountData({ action: 'bank_sync', connectionId: result.connection.connectionId });
              active(); notifyDataChanged('purchase');
              await refresh();
              active();
              setMessage('Bank connected and transactions refreshed.');
            } catch {
              active();
              setMessage('Bank connected. Transactions could not refresh yet. Try Refresh transactions.');
              void refresh().catch(() => undefined);
            }
          } catch {
            if (alive.current && sessionSnapshot().generation === generation) {
              setError('The connection could not be confirmed. Check status before starting another connection.');
              setMessage('');
            }
          } finally {
            request.current = false;
            if (alive.current && sessionSnapshot().generation === generation) setBusy(false);
          }
        })();
      },
      onExit: () => {
        if (alive.current && sessionSnapshot().generation === generation && !request.current) {
          try { storage.removeItem(LINK_SESSION_KEY); } catch { /* The next connection can replace the expired session. */ }
          const url = new URL(location.href);
          url.searchParams.delete('oauth_state_id');
          history.replaceState(history.state, '', url);
          setBusy(false);
          setMessage('Bank connection was closed.');
        }
      },
    });
    handler.current.open();
  }, [active, generation, refresh, storage]);

  useEffect(() => {
    alive.current = true;
    const address = new URL(location.href);
    const oauthReturn = address.pathname === '/cupcake/account' && address.searchParams.has('oauth_state_id');
    if (oauthReturn) {
      const element = root.current;
      let parent = element?.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      try {
        const parts = address.search.slice(1).split('&').filter(part => part.split('=')[0] === 'oauth_state_id');
        if (parts.length !== 1) throw Error('The bank return address is invalid. Start the connection again.');
        const redirect = address.origin + address.pathname + '?' + parts[0];
        const saved = JSON.parse(storage.getItem(LINK_SESSION_KEY) || 'null') as LinkSession | null;
        if (!saved || typeof saved.requestId !== 'string' || typeof saved.token !== 'string') throw Error('Your bank session could not be restored. Start the connection again.');
        setBusy(true); setMessage('Resuming your bank connection…');
        void openLink(saved, redirect).catch(cause => {
          if (alive.current && sessionSnapshot().generation === generation) {
            setError(cause instanceof Error ? cause.message : 'Your bank session could not be restored.');
            setBusy(false); setMessage('');
          }
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Your bank session could not be restored.');
      }
    }
    return () => { alive.current = false; handler.current?.destroy(); handler.current = null; };
  }, [generation, openLink, storage]);

  async function connect() {
    if (busy || request.current || pendingExchange || status?.uncertainRequests.length) return;
    request.current = true; setBusy(true); setMessage(''); setError('');
    try {
      active();
      const requestId = crypto.randomUUID();
      const result = await accountData<{ link_token: string }>({ action: 'bank_link_create', request_id: requestId });
      active();
      if (typeof result.link_token !== 'string' || !result.link_token) throw Error('Bank connection could not be started.');
      const session = { requestId, token: result.link_token };
      storage.setItem(LINK_SESSION_KEY, JSON.stringify(session));
      request.current = false;
      await openLink(session);
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError(cause instanceof Error ? cause.message : 'Bank connection could not be started.');
        setBusy(false);
      }
    } finally { request.current = false; }
  }

  async function sync(connectionId: string) {
    if (busy || request.current) return;
    request.current = true; setBusy(true); setError(''); setMessage('Refreshing your transactions…');
    try {
      active();
      await accountData({ action: 'bank_sync', connectionId });
      active(); notifyDataChanged('purchase');
      await refresh(); active();
      setMessage('Transaction refresh completed.');
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError(cause instanceof Error ? cause.message : 'Transactions could not be refreshed.');
        setMessage('');
      }
    } finally {
      request.current = false;
      if (alive.current && sessionSnapshot().generation === generation) setBusy(false);
    }
  }
  async function reconnect(connectionId: string) {
    if (busy || request.current || pendingExchange || status?.uncertainRequests.length) return;
    request.current = true; setBusy(true); setMessage(''); setError('');
    try {
      active();
      const requestId = crypto.randomUUID();
      const result = await accountData<{ link_token: string }>({ action: 'bank_link_update_create', request_id: requestId, connectionId });
      active();
      if (typeof result.link_token !== 'string' || !result.link_token) throw Error('Bank reconnection could not be started.');
      const session = { requestId, token: result.link_token, connectionId };
      storage.setItem(LINK_SESSION_KEY, JSON.stringify(session));
      request.current = false;
      await openLink(session);
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError(cause instanceof Error ? cause.message : 'Bank reconnection could not be started.');
        setBusy(false);
      }
    } finally { request.current = false; }
  }
  async function disconnect(connectionId: string) {
    if (busy || request.current) return;
    if (!await appConfirm('Disconnect this bank from your account? Saved transactions remain available.', { title: 'Disconnect bank?', yes: 'Disconnect' })) return;
    request.current = true; setBusy(true); setError(''); setMessage('Disconnecting your bank…');
    try {
      active();
      await accountData({ action: 'bank_disconnect', connectionId, confirmed: true });
      await refresh(); active();
      setMessage('Bank disconnected.');
    } catch {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError('The disconnection could not be confirmed. Check status before trying again.');
        setMessage('');
      }
    } finally {
      request.current = false;
      if (alive.current && sessionSnapshot().generation === generation) setBusy(false);
    }
  }

  return <section ref={root} aria-label="Bank connections">
    <p className="cc-muted cc-small">Connect your bank through Plaid to use your saved transactions for receipt matching. Plaid handles bank sign-in and permission.</p>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!status && <button className="cc-secondary" type="button" disabled={busy} onClick={() => void refresh().catch(cause => setError(cause instanceof Error ? cause.message : 'Bank status is unavailable.'))}>Check bank connections</button>}
    {status && <>
      {!status.configured ? <p className="cc-muted">Bank connections are not available yet.</p> : <>
        {!status.connections.length && <p className="cc-muted">No bank is connected to this account.</p>}
        {status.connections.map(connection => <article className="cc-card" key={connection.connectionId}>
          <strong>{connection.institutionName || 'Bank connection'}</strong>
          <p className="cc-muted">{connection.status === 'connected' ? 'Connected' : connection.status === 'reconnect_required' ? 'Sign-in needs attention' : connection.status === 'disconnecting' ? 'Disconnecting' : connection.status === 'disconnect_uncertain' ? 'Disconnection unconfirmed' : connection.status === 'disconnected' ? 'Disconnected' : connection.status === 'uncertain' ? 'Connection status unconfirmed' : 'Status unavailable'}{connection.lastSyncAt ? ` · Last refreshed ${new Date(connection.lastSyncAt).toLocaleString()}` : ''}</p>
          {connection.status === 'connected' && <button className="cc-secondary" type="button" disabled={busy} onClick={() => void sync(connection.connectionId)}>Refresh transactions</button>}
          {connection.status === 'reconnect_required' && <button className="cc-secondary" type="button" disabled={busy || !!pendingExchange} onClick={() => void reconnect(connection.connectionId)}>Reconnect bank</button>}
          {connection.status !== 'disconnected' && <button className="cc-text-button" type="button" disabled={busy || connection.status === 'disconnecting'} onClick={() => void disconnect(connection.connectionId)}>{connection.status === 'disconnect_uncertain' ? 'Retry disconnection' : 'Disconnect bank'}</button>}
        </article>)}
        {(pendingExchange || status.uncertainRequests.length > 0) && <p role="status">A bank connection is still being confirmed. Check status, or contact support if it remains unresolved.</p>}
        <div className="cc-action-row"><button className="cc-primary" type="button" disabled={busy || !!pendingExchange || status.uncertainRequests.length > 0} onClick={() => void connect()}>Connect a bank</button><button className="cc-text-button" type="button" disabled={busy} onClick={() => void refresh().catch(cause => setError(cause instanceof Error ? cause.message : 'Bank status is unavailable.'))}>Refresh status</button></div>
      </>}
    </>}
  </section>;
}
