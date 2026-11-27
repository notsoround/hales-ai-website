import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryRequest, type Conversation } from './library';
import { callDisposition, savedCallRecap } from './phoneCallHistory';
import { ReadAloudButton } from './ReadAloudButton';

type CallPage = { documents: Conversation[]; browseTotal: number; nextCursor?: string };
const central = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
function when(call: Conversation) {
  const time = Date.parse(call.provenance?.occurredAt || call.createdAt);
  return Number.isFinite(time) ? central.format(time) : 'Date unavailable';
}

export default function PhoneCallArchive({ onOpenDocument }: { onOpenDocument: (id: string) => void }) {
  const readFilter = () => new URLSearchParams(location.search).get('callFilter') === 'missed';
  const [missed, setMissed] = useState(readFilter);
  const [calls, setCalls] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string>();
  const [detail, setDetail] = useState<Conversation>();
  const [detailError, setDetailError] = useState('');
  const pageRequest = useRef(0), detailRequest = useRef(0);

  const loadPage = useCallback(async (next?: string) => {
    const seq = ++pageRequest.current;
    setLoading(true); setError('');
    try {
      const page = await libraryRequest<CallPage>({ action: 'list', sourceFilter: missed ? 'missed-phone-calls' : 'phone-calls', ...(next ? { cursor: next } : {}) });
      if (seq !== pageRequest.current) return;
      setCalls(previous => next ? [...new Map([...previous, ...page.documents].map(row => [row.id, row])).values()] : page.documents);
      setCursor(page.nextCursor || undefined); setTotal(page.browseTotal);
    } catch {
      if (seq === pageRequest.current) setError('Phone history could not load.');
    } finally {
      if (seq === pageRequest.current) setLoading(false);
    }
  }, [missed]);

  useEffect(() => {
    const restore = () => setMissed(new URLSearchParams(location.search).get('callFilter') === 'missed');
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  function showMissed(next: boolean) {
    if (next === missed) return;
    const url = new URL(location.href);
    if (next) url.searchParams.set('callFilter', 'missed');
    else url.searchParams.delete('callFilter');
    history.pushState({ scroll: window.scrollY }, '', url);
    setMissed(next);
  }

  useEffect(() => {
    setCalls([]); setCursor(undefined); setSelected(undefined); setDetail(undefined);
    void loadPage();
    return () => { pageRequest.current++; detailRequest.current++; };
  }, [loadPage]);

  async function open(id?: string) {
    const seq = ++detailRequest.current;
    setSelected(id); setDetail(undefined); setDetailError('');
    if (!id) return;
    try {
      const data = await libraryRequest<{document: Conversation}>({action:'fetch', id});
      if (seq === detailRequest.current && data.document.id === id) setDetail(data.document);
    } catch {
      if (seq === detailRequest.current) setDetailError('The recap could not load.');
    }
  }

  return <section className="cc-card" aria-label="Saved phone calls">
    <div className="cc-heading-row"><h3>Phone calls</h3>
      <div role="group" className="cc-call-history-filter" aria-label="Call history filter">
        <button type="button" className="cc-text-button" aria-pressed={!missed} onClick={() => showMissed(false)}>All calls</button>
        <button type="button" className="cc-text-button" aria-pressed={missed} onClick={() => showMissed(true)}>Missed calls</button>
      </div>
    </div>
    {calls.length > 0 && <p className="cc-muted cc-small">{calls.length} of {total} {missed ? 'confirmed missed calls with records' : 'saved calls'} · Central time</p>}
    {calls.map(call => {
      const expanded = selected === call.id;
      const disposition = callDisposition(call);
      const party = call.provenance?.attribution?.participantIdentity === 'coach' ? 'Coach · ' : '';
      const recap = detail && expanded ? savedCallRecap(detail) : '';
      return <div key={call.id}>
        <button type="button" className="cc-library-item" style={{ width: '100%', textAlign: 'left' }} aria-expanded={expanded} onClick={() => void open(expanded ? undefined : call.id)}>
          <span><strong>{when(call)}</strong><small>{party}{disposition}</small></span>
          <span>{expanded ? 'Close' : 'Recap'}</span>
        </button>
        {expanded && <section aria-label="Call recap" className="cc-card">
          {detail ? <>
            <h4>Saved recap</h4>
            <p>{recap || 'This call has no saved summary.'}</p>
            {recap && <ReadAloudButton key={call.id} text={recap} label="Listen to recap" deviceOnly />}
            <button type="button" className="cc-text-button" onClick={() => onOpenDocument(call.id)}>
              {call.sourceApp === 'Cupcake phone transcript' ? 'Open full transcript' : 'Open original record'}
            </button>
          </> : detailError ? <p role="alert">{detailError} <button type="button" onClick={() => void open(call.id)}>Retry recap</button></p>
          : <p role="status">Loading recap…</p>}
        </section>}
      </div>;
    })}
    {!loading && !error && !calls.length && <p>{missed ? 'No confirmed missed calls have a saved recap or transcript here.' : 'No saved phone calls in your account.'}</p>}
    {loading && <p role="status">Loading calls…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && (error || cursor) && <button type="button" className="cc-secondary" onClick={() => void loadPage(cursor)}>{error ? 'Retry calls' : 'Earlier calls'}</button>}
  </section>;
}
