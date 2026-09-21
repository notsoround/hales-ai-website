import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { libraryRequest } from './library';
import type { DashboardRange } from './DashboardView';

type PersonalOutcome = {
  id: string; date: string; title: string; outcome: 'win' | 'loss' | 'unscored'; note: string;
  source: { type: 'owner-request'; reference: string; description: string };
  metrics: { steps?: number; activeMinutes?: number; energyKcal?: number };
  evidenceType: 'owner-reported-outcome'; createdAt: string;
};
type OutcomePage = {
  entries: PersonalOutcome[]; nextCursor: string | null;
  counts: { wins: number; losses: number; unscored: number; total: number };
};

export function PersonalOutcomes({ range, refreshKey }: { range: DashboardRange; refreshKey?: unknown }) {
  const [page, setPage] = useState<OutcomePage | null>(null);
  const [filter, setFilter] = useState<PersonalOutcome['outcome'] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  const request = useCallback((cursor?: string) => libraryRequest<OutcomePage>({
    action: 'outcome_list', limit: 50,
    ...(range.preset === 'all' ? {} : { start: range.start, end: range.end }),
    ...(cursor ? { cursor } : {}),
  }), [range.preset, range.start, range.end]);
  const refresh = useCallback(async () => {
    const revision = ++version.current;
    setBusy(true); setPage(null); setSelected(null); setError('');
    try { const next = await request(); if (revision === version.current) setPage(next); }
    catch (e) { if (revision === version.current) setError(e instanceof Error ? e.message : 'Personal outcomes could not be loaded.'); }
    finally { if (revision === version.current) setBusy(false); }
  }, [request]);
  useEffect(() => { void refresh(); return () => { version.current += 1; }; }, [refresh, refreshKey]);
  const more = async () => {
    if (!page?.nextCursor || moreBusy) return;
    const revision = version.current;
    setMoreBusy(true); setError('');
    try {
      const next = await request(page.nextCursor);
      if (revision === version.current) setPage(current => current ? { ...next, entries: [...current.entries, ...next.entries.filter(e => !current.entries.some(old => old.id === e.id))] } : next);
    } catch (e) { if (revision === version.current) setError(e instanceof Error ? e.message : 'More outcomes could not be loaded.'); }
    finally { setMoreBusy(false); }
  };
  const entries = page?.entries.filter(e => !filter || e.outcome === filter) || [];
  return <section className="cc-dashboard-section" aria-label="Personal wins and losses">
    <div className="cc-heading-row"><div><span className="cc-eyebrow">THE WINS YOU REPORT</span><h3><Trophy size={20} aria-hidden="true" /> Personal wins &amp; losses</h3></div><button className="cc-secondary" onClick={() => void refresh()} disabled={busy} aria-label="Refresh personal outcomes"><RefreshCw size={17} className={busy ? 'cc-spin' : ''} /></button></div>
    <p className="cc-muted cc-small">Personal wins and losses you explicitly record. Your report counts; it is labeled separately from synced phone measurements and purchase interventions.</p>
    {busy && <p className="cc-thinking" role="status"><Loader2 size={16} className="cc-spin" />Loading your outcomes…</p>}
    {error && <p className="cc-error" role="alert">{error}</p>}
    {page && <>
      <div className="cc-dashboard-cards cc-outcome-cards">
        <button className="cc-dashboard-card" aria-pressed={filter === 'win'} onClick={() => setFilter(filter === 'win' ? null : 'win')}><strong>{page.counts.wins}</strong><span>Personal wins · your report</span></button>
        <button className="cc-dashboard-card" aria-pressed={filter === 'loss'} onClick={() => setFilter(filter === 'loss' ? null : 'loss')}><strong>{page.counts.losses}</strong><span>Personal losses · your report</span></button>
        <button className="cc-dashboard-card" aria-pressed={filter === 'unscored'} onClick={() => setFilter(filter === 'unscored' ? null : 'unscored')}><strong>{page.counts.unscored}</strong><span>Unscored · no automatic penalty</span></button>
      </div>
      {filter && <button className="cc-text-button" onClick={() => setFilter(null)}>Show all personal outcomes</button>}
      {entries.map(entry => <div key={entry.id}>
        <button className="cc-dashboard-entry" aria-expanded={selected === entry.id} onClick={() => setSelected(selected === entry.id ? null : entry.id)}><span className="cc-dashboard-entry-icon">{entry.outcome === 'win' ? '🏆' : entry.outcome === 'loss' ? '↗' : '•'}</span><span><strong>{entry.title}</strong><small>{entry.date} · {entry.outcome} · owner reported</small></span><ChevronRight size={17} /></button>
        {selected === entry.id && <div className="cc-card"><p className="cc-answer-text">{entry.note}</p><div className="cc-dashboard-cards">
          {entry.metrics.steps !== undefined && <div><strong>{entry.metrics.steps.toLocaleString()}</strong><p className="cc-muted cc-small">Steps you reported</p></div>}
          {entry.metrics.activeMinutes !== undefined && <div><strong>{entry.metrics.activeMinutes} min</strong><p className="cc-muted cc-small">Activity you reported</p></div>}
          {entry.metrics.energyKcal !== undefined && <div><strong>{entry.metrics.energyKcal} kcal</strong><p className="cc-muted cc-small">Burn you reported · not food intake</p></div>}
        </div><p className="cc-muted cc-small">{entry.source.description}</p><p className="cc-muted cc-small">This score follows your explicit request. It does not claim that Cupcake independently verified a step target.</p></div>}
      </div>)}
      {!entries.length && <p className="cc-muted">{filter ? 'No matching entries loaded for this selection.' : 'No personal outcomes recorded in this range yet.'}</p>}
      {page.nextCursor && <button className="cc-secondary" disabled={moreBusy} onClick={() => void more()}>{moreBusy ? 'Loading…' : 'Load older personal outcomes'}</button>}
      <p className="cc-muted cc-small">{page.entries.length} of {page.counts.total} personal outcomes loaded. Silence stays unscored. The phone scorecard below is unchanged.</p>
    </>}
  </section>;
}
