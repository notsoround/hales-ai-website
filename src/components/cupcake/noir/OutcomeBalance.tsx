/** Personal wins and losses for the account app, as one light instrument: the win rate up front, a two-week tally (wins rise
 *  above a hairline, losses hang below, unscored sit on it) that you tap or drag to read a day, one split line whose three
 *  keys filter the list, and the latest rows with the rest a tap away. Presentation only. Loading, paging and saving stay in
 *  PersonalOutcomes.tsx. */
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ChevronRight, RotateCw, X } from 'lucide-react';
import './noir-outcomes.css';
import './noir-history.css';

export type BalanceEntry = { id: string; date: string; title: string; outcome: 'win' | 'loss' | 'unscored'; note: string; sourceNote: string; metrics: { steps?: number; activeMinutes?: number; energyKcal?: number } };
type Filter = BalanceEntry['outcome'] | null;
const TZ = 'America/Chicago';
const LATEST = 3;
const dayKey = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));
const niceDay = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
const WORD = { win: 'Win', loss: 'Loss', unscored: 'Unscored' } as const;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const tally = (list: BalanceEntry[]) => {
  const w = list.filter(e => e.outcome === 'win').length, l = list.filter(e => e.outcome === 'loss').length, u = list.length - w - l;
  return [w && plural(w, 'win', 'wins'), l && plural(l, 'loss', 'losses'), u && `${u} unscored`].filter(Boolean).join(', ') || 'nothing reported';
};

export function OutcomeBalance({ counts, percent, entries, allEntries, filter, onFilter, selected, onSelect, busy, error, notice, onRefresh, form, more, assistantName = 'the assistant' }: {
  counts: { wins: number; losses: number; unscored: number; total: number } | null; percent: number | null; entries: BalanceEntry[]; allEntries: BalanceEntry[];
  filter: Filter; onFilter: (f: Filter) => void; selected: string | null; onSelect: (id: string | null) => void; busy: boolean; error: string; notice: ReactNode;
  onRefresh: () => void; form: ReactNode; more: ReactNode; assistantName?: string;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState(13);
  const strip = useRef<HTMLOListElement>(null);
  const dragging = useRef(false);
  const days = Array.from({ length: 14 }, (_, i) => dayKey(Date.now() - (13 - i) * 864e5));
  const byDay = new Map<string, BalanceEntry[]>(); allEntries.forEach(e => byDay.set(e.date, [...(byDay.get(e.date) || []), e]));
  const total = counts?.total || 0, scored = (counts?.wins ?? 0) + (counts?.losses ?? 0);
  const keys: { f: Exclude<Filter, null>; label: string; n: number }[] = [{ f: 'win', label: 'Wins', n: counts?.wins ?? 0 }, { f: 'loss', label: 'Losses', n: counts?.losses ?? 0 }, { f: 'unscored', label: 'Unscored', n: counts?.unscored ?? 0 }];
  const summary = counts ? `${counts.wins} wins, ${counts.losses} losses, ${counts.unscored} unscored${percent !== null ? `, ${percent} percent win rate` : ''}` : 'Loading';
  const shown = day ? entries.filter(e => e.date === day) : entries;
  const visible = expanded ? shown : shown.slice(0, LATEST);
  const hidden = shown.length - visible.length;
  const caption = day ? `${niceDay(day)} · ${tally(byDay.get(day) || [])}` : percent === null ? (busy ? 'Loading' : 'Nothing scored yet') : `Win rate · ${counts!.wins} of ${scored} scored`;

  const pick = (d: string | null) => { setDay(d); onSelect(null); };
  const columnAt = (x: number) => { const r = strip.current?.getBoundingClientRect(); if (!r || !r.width) return null; return Math.min(13, Math.max(0, Math.floor(((x - r.left) / r.width) * 14))); };
  const onDown = (e: PointerEvent<HTMLOListElement>) => { if (e.pointerType !== 'mouse') dragging.current = true; };
  const onMove = (e: PointerEvent<HTMLOListElement>) => { if (!dragging.current) return; const i = columnAt(e.clientX); if (i !== null && days[i] !== day) { setCursor(i); pick(days[i]); } };
  const onUp = () => { dragging.current = false; };
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0;
    if (!step) return;
    e.preventDefault();
    const i = Math.min(13, Math.max(0, cursor + step)); setCursor(i);
    strip.current?.querySelectorAll<HTMLButtonElement>('button')[i]?.focus();
  };

  return <section className="nx-wl" aria-label="Personal wins and losses" data-empty={counts && counts.total === 0 ? '' : undefined}>
    <header className="nx-wl-head"><h3>Wins &amp; losses</h3>
      <button type="button" className="nx-wl-refresh" onClick={onRefresh} disabled={busy} aria-label="Refresh personal outcomes"><RotateCw size={15} aria-hidden="true" className={busy ? 'is-spinning' : undefined} /></button></header>
    {error && <p className="cc-error" role="alert">{error}</p>}
    <div className="nx-wl-hero" role="img" aria-label={summary}>
      <strong aria-hidden="true">{percent === null ? '—' : percent}{percent !== null && <sub>%</sub>}</strong>
    </div>
    <p className="nx-wl-caption">{caption}</p>
    <ol ref={strip} className="nx-wl-tally" aria-label="Reported outcomes, last 14 days. Choose a day to show only that day." onKeyDown={onKey}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
      {days.map((d, i) => { const list = byDay.get(d) || [], up = list.filter(e => e.outcome === 'win'), down = list.filter(e => e.outcome === 'loss'), flat = list.some(e => e.outcome === 'unscored');
        return <li key={d}><button type="button" tabIndex={i === cursor ? 0 : -1} aria-pressed={day === d} aria-label={`${niceDay(d)}: ${tally(list)}`} onFocus={() => setCursor(i)} onClick={() => pick(day === d ? null : d)}>
          <span className="nx-wl-up" aria-hidden="true">{up.slice(0, 3).map(e => <i key={e.id} />)}</span>
          <span className="nx-wl-mid" aria-hidden="true">{flat ? <i className="is-unscored" /> : !list.length && <i className="is-none" />}</span>
          <span className="nx-wl-down" aria-hidden="true">{down.slice(0, 3).map(e => <i key={e.id} />)}</span>
          <small aria-hidden="true">{i === 13 ? 'Today' : i === 0 || i === 7 ? niceDay(d).split(', ')[1] : ''}</small>
        </button></li>; })}
    </ol>
    <div className="nx-wl-split" aria-hidden="true">
      {keys.map(k => k.n > 0 && <i key={k.f} className={`is-${k.f}`} style={{ flexGrow: total ? k.n / total : 0 }} />)}
    </div>
    <div className="nx-wl-keys" role="group" aria-label="Filter outcomes">
      {keys.map(k => <button key={k.f} type="button" className={`is-${k.f}`} aria-pressed={filter === k.f} onClick={() => { onFilter(filter === k.f ? null : k.f); onSelect(null); }}><b>{k.n}</b><span>{k.label}</span></button>)}
    </div>
    {day && <div className="nx-wl-scope"><span>Showing {niceDay(day)}</span><button type="button" onClick={() => pick(null)} aria-label={`Show all dates, not just ${niceDay(day)}`}><X size={14} aria-hidden="true" />All dates</button></div>}
    {notice}
    <ul className="nx-wl-list">{visible.map(e => <li key={e.id}>
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
    {hidden > 0 && <button type="button" className="nx-wl-all" onClick={() => setExpanded(true)}>Show all {shown.length}<ChevronRight size={15} aria-hidden="true" /></button>}
    {expanded && shown.length > LATEST && <button type="button" className="nx-wl-all" onClick={() => setExpanded(false)}>Show the latest {LATEST}</button>}
    {counts && !shown.length && <p className="nx-wl-empty">{day ? 'Nothing matches on that day.' : filter ? 'Nothing matches that filter in these dates.' : 'Nothing reported in these dates yet.'}</p>}
    {(expanded || hidden === 0) && !day && more}
    <div className="nx-wl-form">{form}</div>
    <details className="nx-wl-how"><summary>How this is scored</summary><p>Only outcomes you explicitly report are counted, within the dates above. Win rate is wins divided by wins plus losses; unscored outcomes are left out, and silence never adds a loss. This score is separate from purchase call outcomes.</p></details>
  </section>;
}
