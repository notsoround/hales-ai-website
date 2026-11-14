/** Personal wins and losses for the account app: one balance gauge (wins sweep in from the left, losses from the right, the
 *  gap between is unscored), a two-week strip of what was reported each day, three counts that filter the list, and the list.
 *  Presentation only. Loading, paging and saving stay in PersonalOutcomes.tsx. */
import type { ReactNode } from 'react';
import { ChevronRight, RotateCw } from 'lucide-react';
import './noir-outcomes.css';
import './noir-history.css';

export type BalanceEntry = { id: string; date: string; title: string; outcome: 'win' | 'loss' | 'unscored'; note: string; sourceNote: string; metrics: { steps?: number; activeMinutes?: number; energyKcal?: number } };
type Filter = BalanceEntry['outcome'] | null;
const TZ = 'America/Chicago';
const dayKey = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));
const niceDay = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
const WORD = { win: 'Win', loss: 'Loss', unscored: 'Unscored' } as const;

export function OutcomeBalance({ counts, percent, entries, allEntries, filter, onFilter, selected, onSelect, busy, error, notice, onRefresh, form, more, assistantName = 'the assistant' }: {
  counts: { wins: number; losses: number; unscored: number; total: number } | null; percent: number | null; entries: BalanceEntry[]; allEntries: BalanceEntry[];
  filter: Filter; onFilter: (f: Filter) => void; selected: string | null; onSelect: (id: string | null) => void; busy: boolean; error: string; notice: ReactNode;
  onRefresh: () => void; form: ReactNode; more: ReactNode; assistantName?: string;
}) {
  const total = counts?.total || 0, w = total ? counts!.wins / total : 0, l = total ? counts!.losses / total : 0, gap = w > 0 && l > 0 ? 0.012 : 0;
  const days = Array.from({ length: 14 }, (_, i) => dayKey(Date.now() - (13 - i) * 864e5));
  const byDay = new Map<string, BalanceEntry[]>(); allEntries.forEach(e => byDay.set(e.date, [...(byDay.get(e.date) || []), e]));
  const keys: { f: Exclude<Filter, null>; label: string; n: number }[] = [{ f: 'win', label: 'Wins', n: counts?.wins ?? 0 }, { f: 'loss', label: 'Losses', n: counts?.losses ?? 0 }, { f: 'unscored', label: 'Unscored', n: counts?.unscored ?? 0 }];
  const summary = counts ? `${counts.wins} wins, ${counts.losses} losses, ${counts.unscored} unscored${percent !== null ? `, ${percent} percent win rate` : ''}` : 'Loading';
  return <section className="nx-wl" aria-label="Personal wins and losses">
    <header className="nx-wl-head"><div><h3>Wins &amp; losses</h3><p>What you reported in the dates above</p></div>
      <button type="button" className="nx-wl-refresh" onClick={onRefresh} disabled={busy} aria-label="Refresh personal outcomes"><RotateCw size={16} aria-hidden="true" className={busy ? 'is-spinning' : undefined} /></button></header>
    {error && <p className="cc-error" role="alert">{error}</p>}
    <div className="nx-wl-gauge" role="img" aria-label={summary}>
      <svg viewBox="0 0 300 168" aria-hidden="true">
        <path d="M30,150A120,120 0 0 1 270,150" className="nx-wl-track" />
        {w > 0 && <path d="M30,150A120,120 0 0 1 270,150" pathLength={1} strokeDasharray={`${Math.max(0.002, w - gap)} 1`} className="nx-wl-win" />}
        {l > 0 && <path d="M270,150A120,120 0 0 0 30,150" pathLength={1} strokeDasharray={`${Math.max(0.002, l - gap)} 1`} className="nx-wl-loss" />}
      </svg>
      <div className="nx-wl-centre"><strong>{percent === null ? '—' : percent}{percent !== null && <sub>%</sub>}</strong><small>{percent === null ? (busy ? 'Loading' : 'Nothing scored yet') : 'Win rate'}</small></div>
      <span className="nx-wl-end is-win">Wins</span><span className="nx-wl-end is-loss">Losses</span>
    </div>
    <ol className="nx-wl-strip" aria-label="Reported outcomes, last 14 days">{days.map((d, i) => { const list = byDay.get(d) || []; return <li key={d} aria-label={`${niceDay(d)}: ${list.length ? list.map(e => WORD[e.outcome]).join(', ') : 'nothing reported'}`}>
      <span>{list.length ? list.slice(0, 3).map(e => <i key={e.id} className={`is-${e.outcome}`} />) : <i className="is-none" />}</span>
      <small aria-hidden="true">{i === 13 ? 'Today' : i === 0 || i === 7 ? niceDay(d).split(', ')[1] : ''}</small></li>; })}</ol>
    <div className="nx-wl-keys" role="group" aria-label="Filter outcomes">
      {keys.map(k => <button key={k.f} type="button" className={`is-${k.f}`} aria-pressed={filter === k.f} onClick={() => onFilter(filter === k.f ? null : k.f)}><i aria-hidden="true" /><span>{k.label}</span><b>{k.n}</b></button>)}
    </div>
    {notice}
    <ul className="nx-wl-list">{entries.map(e => <li key={e.id}>
      <button type="button" aria-expanded={selected === e.id} onClick={() => onSelect(selected === e.id ? null : e.id)}>
        <i className={`is-${e.outcome}`} aria-hidden="true" /><span><b>{e.title}</b><small>{niceDay(e.date)} · {WORD[e.outcome]}</small></span><ChevronRight size={16} aria-hidden="true" /></button>
      {selected === e.id && <div className="nx-wl-detail"><p>{e.note}</p>
        {(e.metrics.steps !== undefined || e.metrics.activeMinutes !== undefined || e.metrics.energyKcal !== undefined) && <dl>
          {e.metrics.steps !== undefined && <div><dt>Steps you reported</dt><dd>{e.metrics.steps.toLocaleString('en-US')}</dd></div>}
          {e.metrics.activeMinutes !== undefined && <div><dt>Activity you reported</dt><dd>{e.metrics.activeMinutes} min</dd></div>}
          {e.metrics.energyKcal !== undefined && <div><dt>Burn you reported</dt><dd>{e.metrics.energyKcal} kcal</dd></div>}
        </dl>}
        <small>{e.sourceNote} This follows what you told {assistantName}; it was not independently verified.</small></div>}
    </li>)}</ul>
    {counts && !entries.length && <p className="nx-wl-empty">{filter ? 'Nothing matches that filter in these dates.' : 'Nothing reported in these dates yet.'}</p>}
    {more}
    <div className="nx-wl-form">{form}</div>
    <details className="nx-wl-how"><summary>How this is scored</summary><p>Only outcomes you explicitly report are counted. Win rate is wins divided by wins plus losses; unscored outcomes are left out, and silence never adds a loss. This score is separate from purchase call outcomes.</p></details>
  </section>;
}
