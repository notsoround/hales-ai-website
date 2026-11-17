import { useCallback, useEffect, useRef, useState } from 'react';
import { accountData, AccountRequestError, assertGeneration, sessionSnapshot } from './accountSession';
import { personalStorage } from './personalStorage';
import { notifyDataChanged } from './dataChanges';
import { appConfirm } from './appConfirm';

type Connection = { connectionId: string; institutionName: string | null; status: string; lastSyncAt: string | number | null };
type BankRequest = { request_id: string; status: string; connectionId: string | null };
type BankStatus = { configured: boolean; connections: Connection[]; requests: BankRequest[]; uncertainRequests: {request_id: string; status: string}[]; resolvedRequests: {request_id: string; connectionId: string}[] };
type LinkSession = { requestId: string; connectionId?: string; returned: boolean };
const LINK_SESSION_KEY = 'cupcake-bank-hosted-session-v1';
const PENDING_EXCHANGE_KEY = 'cupcake-bank-exchange-pending-v1';
const syncTime = (value: string | number | null) => {
  if (value == null) return '';
  const date = new Date(typeof value === 'number' ? value * 1000 : value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
};

export function AccountBankConnection() {
  const [storage] = useState(() => personalStorage('sessionStorage'));
  const [generation] = useState(() => sessionSnapshot().generation);
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [session, setSession] = useState<LinkSession | null>(() => {
    try { return JSON.parse(storage.getItem(LINK_SESSION_KEY) || 'null') as LinkSession | null; } catch { return null; }
  });
  const [pendingExchange, setPendingExchange] = useState(() => {
    try { return storage.getItem(PENDING_EXCHANGE_KEY) || ''; } catch { return ''; }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [tick, setTick] = useState(0);
  const attempts = useRef(0);
  const pendingRef = useRef(pendingExchange);
  const sessionRef = useRef(session);
  const root = useRef<HTMLElement>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);
  const active = useCallback(() => {
    assertGeneration(generation);
    if (!alive.current) throw new DOMException('The bank connection screen was closed.', 'AbortError');
  }, [generation]);

  const clearSession = useCallback(() => {
    storage.removeItem(PENDING_EXCHANGE_KEY);
    storage.removeItem(LINK_SESSION_KEY);
    pendingRef.current = ''; sessionRef.current = null;
    setPendingExchange(''); setSession(null); setWaiting(false);
    const url = new URL(location.href);
    url.searchParams.delete('bankLink');
    history.replaceState(history.state, '', url);
  }, [storage]);

  const refresh = useCallback(async () => {
    const result = await accountData<BankStatus>({ action: 'bank_connection_status' });
    active();
    if (typeof result.configured !== 'boolean' || !Array.isArray(result.connections) || !Array.isArray(result.requests) || !Array.isArray(result.uncertainRequests) || !Array.isArray(result.resolvedRequests)) throw Error('Bank connection status could not be confirmed.');
    const pending = pendingRef.current;
    if (pending && result.resolvedRequests.some(item => item.request_id === pending && item.connectionId)) {
      clearSession();
      notifyDataChanged('purchase');
      setError('');
      setMessage('Bank connection confirmed. Refresh transactions to use it for receipt matching.');
    }
    setStatus(result);
    return result;
  }, [active, clearSession]);

  const complete = useCallback(async (item: LinkSession) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setWaiting(false);
    try {
      active();
      storage.setItem(PENDING_EXCHANGE_KEY, item.requestId);
      pendingRef.current = item.requestId; setPendingExchange(item.requestId);
      const body = item.connectionId
        ? { action: 'bank_link_update_complete', request_id: item.requestId, connectionId: item.connectionId }
        : { action: 'bank_link_complete', request_id: item.requestId };
      const result = await accountData<{ connection?: Connection; connectionId?: string; status?: string; sync?: unknown; syncStatus?: string }>(body);
      active();
      const connectionId = result.connection?.connectionId || result.connectionId;
      if (!connectionId || (item.connectionId && connectionId !== item.connectionId)) throw Error('The bank connection could not be confirmed.');
      clearSession();
      if (item.connectionId || result.sync) notifyDataChanged('purchase');
      setMessage(item.connectionId ? 'Bank reconnected and transactions refreshed.' : result.sync ? 'Bank connected and transactions refreshed.' : 'Bank connected. Refresh transactions to use it for receipt matching.');
      await refresh(); active();
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        if (cause instanceof AccountRequestError && cause.code === 'bank_link_pending') {
          storage.removeItem(PENDING_EXCHANGE_KEY); pendingRef.current = ''; setPendingExchange('');
          setWaiting(true);
          setMessage('Waiting for Plaid to finish confirming your connection…');
        } else {
          setError('The connection could not be confirmed. Check status before starting another connection.');
          setMessage('');
        }
      }
    } finally {
      inFlight.current = false;
      if (alive.current && sessionSnapshot().generation === generation) setBusy(false);
    }
  }, [active, clearSession, generation, refresh, storage]);

  useEffect(() => {
    alive.current = true;
    const address = new URL(location.href);
    if (address.pathname === '/cupcake/account' && address.searchParams.get('bankLink') === 'complete') {
      let parent = root.current?.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      const current = sessionRef.current;
      if (current) {
        const returned = { ...current, returned: true };
        try {
          storage.setItem(LINK_SESSION_KEY, JSON.stringify(returned));
          sessionRef.current = returned; setSession(returned);
          if (pendingRef.current === returned.requestId) setError('The connection could not be confirmed. Check status before starting another connection.');
          else void complete(returned);
        } catch { setError('Your bank session could not be restored. Check bank connections.'); }
      } else {
        setMessage('Checking your bank connection…');
        const hadUncertainExchange = !!pendingRef.current;
        void refresh().then(result => {
          if (!alive.current || sessionSnapshot().generation !== generation || hadUncertainExchange) return;
          const ready = result.requests.filter(row => row.status === 'ready');
          if (ready.length !== 1) {
            setMessage('');
            setError(ready.length ? 'Choose a pending bank connection to check.' : 'No pending bank connection was found for this account.');
            return;
          }
          const row = ready[0];
          const item = { requestId: row.request_id, ...(row.connectionId ? { connectionId: row.connectionId } : {}), returned: true };
          storage.setItem(LINK_SESSION_KEY, JSON.stringify(item));
          sessionRef.current = item; setSession(item);
          void complete(item);
        }).catch(() => {
          if (alive.current && sessionSnapshot().generation === generation) {
            setMessage(''); setError('Your bank session could not be restored. Check bank connections for pending requests.');
          }
        });
      }
    }
    return () => { alive.current = false; };
  }, [complete, generation, refresh, storage]);

  useEffect(() => {
    if (!waiting || busy || !session || attempts.current >= 4) return;
    const timer = setTimeout(() => { attempts.current++; void complete(session); setTick(value => value + 1); }, 3000);
    return () => clearTimeout(timer);
  }, [waiting, busy, complete, session, tick]);

  async function start(item: LinkSession) {
    if (busy || inFlight.current || pendingRef.current || status?.uncertainRequests.length) return;
    inFlight.current = true; setBusy(true); setMessage(''); setError('');
    try {
      active();
      storage.setItem(LINK_SESSION_KEY, JSON.stringify(item));
      sessionRef.current = item; setSession(item);
      const body = item.connectionId
        ? { action: 'bank_link_update_create', request_id: item.requestId, connectionId: item.connectionId }
        : { action: 'bank_link_create', request_id: item.requestId };
      const result = await accountData<{ hosted_link_url: string }>(body);
      active();
      const target = new URL(result.hosted_link_url);
      if (target.protocol !== 'https:' || target.hostname !== 'secure.plaid.com' || !target.pathname.startsWith('/hl/') || target.username || target.password || target.port || target.hash) throw Error('Bank connection link could not be verified.');
      location.assign(target.href);
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError(cause instanceof Error ? cause.message : 'Bank connection could not be started.');
        setBusy(false);
      }
    } finally { inFlight.current = false; }
  }

  async function sync(connectionId: string) {
    if (busy || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('Refreshing your transactions…');
    try {
      active(); await accountData({ action: 'bank_sync', connectionId });
      active(); notifyDataChanged('purchase'); await refresh(); active();
      setMessage('Transaction refresh completed.');
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError(cause instanceof Error ? cause.message : 'Transactions could not be refreshed.'); setMessage('');
      }
    } finally {
      inFlight.current = false;
      if (alive.current && sessionSnapshot().generation === generation) setBusy(false);
    }
  }

  async function disconnect(connectionId: string) {
    if (busy || inFlight.current) return;
    if (!await appConfirm('Disconnect this bank from your account? Saved transactions remain available.', { title: 'Disconnect bank?', yes: 'Disconnect' })) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('Disconnecting your bank…');
    try {
      active(); await accountData({ action: 'bank_disconnect', connectionId, confirmed: true });
      await refresh(); active(); setMessage('Bank disconnected.');
    } catch {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError('The disconnection could not be confirmed. Check status before trying again.'); setMessage('');
      }
    } finally {
      inFlight.current = false;
      if (alive.current && sessionSnapshot().generation === generation) setBusy(false);
    }
  }

  return <section ref={root} aria-label="Bank connections">
    <p className="cc-muted cc-small">Connect your bank through Plaid to use your saved transactions for receipt matching. Plaid handles bank sign-in and permission.</p>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {session && !pendingExchange && <div className="cc-action-row">
      {!session.returned && <button className="cc-secondary" type="button" disabled={busy} onClick={() => void start(session)}>Continue bank connection</button>}
      <button className="cc-secondary" type="button" disabled={busy} onClick={() => { attempts.current = 0; void complete(session); }}>Check connection</button>
      <button className="cc-text-button" type="button" disabled={busy} onClick={() => { clearSession(); setMessage('You can check the pending connection later.'); }}>Leave for later</button>
    </div>}
    {!status && <button className="cc-secondary" type="button" disabled={busy} onClick={() => void refresh().catch(cause => setError(cause instanceof Error ? cause.message : 'Bank status is unavailable.'))}>Check bank connections</button>}
    {status && <>
      {!status.configured ? <p className="cc-muted">Bank connections are not available yet.</p> : <>
        {!status.connections.length && <p className="cc-muted">No bank is connected to this account.</p>}
        {status.connections.map(connection => <article className="cc-card" key={connection.connectionId}>
          <strong>{connection.institutionName || 'Bank connection'}</strong>
          <p className="cc-muted">{connection.status === 'connected' ? 'Connected' : connection.status === 'reconnect_required' ? 'Sign-in needs attention' : connection.status === 'disconnecting' ? 'Disconnecting' : connection.status === 'disconnect_uncertain' ? 'Disconnection unconfirmed' : connection.status === 'disconnected' ? 'Disconnected' : 'Status unavailable'}{syncTime(connection.lastSyncAt) ? ` · Last refreshed ${syncTime(connection.lastSyncAt)}` : ''}</p>
          {connection.status === 'connected' && <button className="cc-secondary" type="button" disabled={busy} onClick={() => void sync(connection.connectionId)}>Refresh transactions</button>}
          {['connected', 'reconnect_required'].includes(connection.status) && <button className="cc-secondary" type="button" disabled={busy || !!pendingExchange} onClick={() => void start({ requestId: crypto.randomUUID(), connectionId: connection.connectionId, returned: false })}>Reconnect bank</button>}
          {connection.status !== 'disconnected' && <button className="cc-text-button" type="button" disabled={busy || connection.status === 'disconnecting'} onClick={() => void disconnect(connection.connectionId)}>{connection.status === 'disconnect_uncertain' ? 'Retry disconnection' : 'Disconnect bank'}</button>}
        </article>)}
        {status.requests.filter(row => row.status === 'ready' && row.request_id !== session?.requestId).map(row => <button key={row.request_id} type="button" className="cc-text-button" disabled={busy || !!pendingExchange} onClick={() => {
          const item = { requestId: row.request_id, ...(row.connectionId ? { connectionId: row.connectionId } : {}), returned: true };
          storage.setItem(LINK_SESSION_KEY, JSON.stringify(item)); sessionRef.current = item; setSession(item); attempts.current = 0; void complete(item);
        }}>Check pending bank connection</button>)}
        {(pendingExchange || status.uncertainRequests.length > 0) && <p role="status">A bank connection is still being confirmed. Check status, or contact support if it remains unresolved.</p>}
        {status.connections.some(connection => ['connected', 'reconnect_required'].includes(connection.status)) && <p className="cc-muted cc-small">To update an existing bank, use Reconnect bank. Connecting it again can duplicate transactions.</p>}
        <div className="cc-action-row"><button className="cc-primary" type="button" disabled={busy || !!pendingExchange || status.uncertainRequests.length > 0} onClick={() => void start({ requestId: crypto.randomUUID(), returned: false })}>Connect a bank</button><button className="cc-text-button" type="button" disabled={busy} onClick={() => void refresh().catch(cause => setError(cause instanceof Error ? cause.message : 'Bank status is unavailable.'))}>Refresh status</button></div>
      </>}
    </>}
  </section>;
}
