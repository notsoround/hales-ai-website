import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Coach, Day, DayPoint, ExportSection, Metric, Weekly } from './viewerApi.ts';
import { BodySection, CheckinsCard, MealPlanCard, PlanVsActual, WorkoutGrid } from './CoachSections.tsx';
import { EXPORT_SECTIONS, fetchCoach, NOTE_MAX, ViewerAuthError, captureToken, deltaText, deltaTone, expiryLabel, exportName, fetchDetails, fetchExport, fetchWeekly, fmt, hm, longDate, niceMax, postNote, rpAppLink, shortDate } from './viewerApi.ts';
import { DaySheet } from './DaySheet.tsx';
import type { MetricKey, SheetView } from './DaySheet.tsx';
import { CupcakePanel } from './CupcakePanel.tsx';
import './robyn.css';

type Weeks = 1 | 2 | 4;
type State = { kind: 'loading' } | { kind: 'ready'; data: Weekly } | { kind: 'expired' } | { kind: 'missing' } | { kind: 'error'; message: string };
type NumKey = { [K in keyof DayPoint]: DayPoint[K] extends number | null ? K : never }[keyof DayPoint];

const storage = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };

function useHeadMeta() {
  useEffect(() => {
    const prev = { title: document.title, bg: document.body.style.background };
    document.title = 'Weekly overview · Matt Hales';
    document.body.style.background = 'var(--rv-bg, #F5F5F7)';
    const metas = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m); return m;
    });
    return () => { document.title = prev.title; document.body.style.background = prev.bg; metas.forEach(m => m.remove()); };
  }, []);
}

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts up once when the value first appears; instant under reduced motion. */
function useCountUp(target: number | null, ms = 700): number | null {
  const [v, setV] = useState<number | null>(target);
  const first = useRef(true);
  useEffect(() => {
    if (target === null) { setV(null); return; }
    if (reduced() || !first.current) { setV(target); return; }
    first.current = false;
    let raf = 0; let t0: number | null = null;
    const tick = (t: number) => {
      if (t0 === null) t0 = t;
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = window.setTimeout(() => { cancelAnimationFrame(raf); setV(target); }, ms + 150);   // never left mid-count (hidden tabs pause rAF)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [target, ms]);
  return v;
}

/** Adds rv-seen once the element enters the viewport (drives the one-time accent sweep). */
function useSeen<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

function Delta({ m, kind, unit }: { m: Metric; kind?: 'number' | 'minutes' | 'decimal'; unit?: string }) {
  const tone = deltaTone(m);
  return <span className={`rv-delta rv-${tone}`}>{deltaText(m, kind, unit)}{m.delta !== null && m.delta !== 0 ? <span className="rv-delta-ref"> vs prior</span> : null}</span>;
}

function Kpi({ label, value, format, unit, sub, children, section, key_, onOpen }: { label: string; value: number | null; format: (v: number | null) => string; unit?: string; sub?: string;
  children?: React.ReactNode; section: string; key_?: boolean; onOpen: () => void }) {
  const shown = useCountUp(value);
  const [ref, seen] = useSeen<HTMLButtonElement>();
  return (
    <button ref={ref} className={`rv-card rv-kpi rv-s-${section}${key_ ? ' rv-key' : ''}${key_ && seen ? ' rv-seen' : ''}`} onClick={onOpen} aria-label={`${label}: ${format(value)}${unit ? ' ' + unit : ''}. Show breakdown`}>
      <div className="rv-label"><i className="rv-sdot" />{label}</div>
      <div className="rv-value"><span className="rv-value-num">{format(shown === null ? null : value !== null && Number.isInteger(value) ? Math.round(shown) : shown)}</span>{unit ? <span className="rv-unit"> {unit}</span> : null}</div>
      <div className="rv-kpi-foot">{children}{sub ? <span className="rv-sub">{sub}</span> : null}</div>
    </button>
  );
}

function RpLink() {
  const link = useMemo(() => rpAppLink(navigator.userAgent), []);
  const open = (e: React.MouseEvent) => {
    if (!link.fallback) return;
    // Universal link opens the installed app; if the page is still visible shortly after, offer the store.
    e.preventDefault();
    const started = Date.now();
    window.location.href = link.href;
    window.setTimeout(() => { if (document.visibilityState === 'visible' && Date.now() - started < 2500) window.location.href = link.fallback!; }, 1600);
  };
  return (
    <a className="rv-rp" href={link.href} onClick={open} target={link.fallback ? undefined : '_blank'} rel="noopener noreferrer">
      <img src="/cupcake-rp-app-icon.png" alt="" width={20} height={20} />Open the RP app
    </a>
  );
}

function ExportMenu({ token, weeks, end, onExpired }: { token: string; weeks: Weeks; end: string; onExpired: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close); window.addEventListener('keydown', close);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', close); };
  }, [open]);
  const get = async (format: 'json' | 'csv', section?: ExportSection) => {
    const id = format + (section ?? ''); setBusy(id); setError('');
    try {
      const blob = await fetchExport(token, weeks, format, section ?? 'days');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = exportName(weeks, end, format, section); document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      if (e instanceof ViewerAuthError) return onExpired();
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally { setBusy(null); }
  };
  const label = weeks === 1 ? 'this week and the prior week' : `these ${weeks} weeks and the prior ${weeks}`;
  return (
    <div className="rv-export" ref={box}>
      <button className="rv-pill" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" /></svg>Export
      </button>
      {open && <div className="rv-menu" role="menu">
        <div className="rv-menu-head">Includes {label}, in Chicago time.</div>
        <button role="menuitem" onClick={() => get('json')} disabled={!!busy}><strong>JSON</strong><span>Everything in one self-describing file</span>{busy === 'json' && <i className="rv-spin" />}</button>
        <div className="rv-menu-sep">CSV</div>
        {EXPORT_SECTIONS.map(sec => <button key={sec} role="menuitem" onClick={() => get('csv', sec)} disabled={!!busy}><strong>{sec[0].toUpperCase() + sec.slice(1)}</strong><span>{{ days: 'One row per day', meals: 'Every meal with macros', workouts: 'Every workout', sleep: 'Nightly sleep and heart rate', weight: 'Every weigh-in' }[sec]}</span>{busy === 'csv' + sec && <i className="rv-spin" />}</button>)}
        {error && <div className="rv-menu-error" role="alert">{error}</div>}
      </div>}
    </div>
  );
}

function DayGrid({ days, onDay }: { days: Day[]; onDay: (d: string) => void }) {
  const cur = days.filter(d => d.period !== 'previous');
  return (
    <div className="rv-days">{cur.map(d => (
      <button key={d.date} className="rv-day" onClick={() => onDay(d.date)} aria-label={`${longDate(d.date)}: open details`}>
        <span className="rv-day-date">{new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}<b>{Number(d.date.slice(8))}</b></span>
        <span className="rv-day-kcal">{d.food_kcal === null ? '—' : fmt(d.food_kcal)}<small> kcal</small></span>
        <span className="rv-day-dots" aria-hidden="true">
          <i className={d.meals.length ? 'rv-s-food' : ''} /><i className={d.workouts.length ? 'rv-s-exercise' : ''} /><i className={d.steps !== null ? 'rv-s-steps' : ''} /><i className={d.sleep ? 'rv-s-sleep' : ''} /><i className={d.weight.length ? 'rv-s-weight' : ''} />
        </span>
      </button>))}
    </div>
  );
}

function BarChart({ series, cur, prev, format, title, unitLabel, onDay }: { series: DayPoint[]; cur: NumKey; prev: NumKey; format: (v: number) => string; title: string; unitLabel: string; onDay: (d: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 360, H = 168, top = 14, bottom = 24, left = 2, right = 2;
  const max = niceMax(series.flatMap(d => [d[cur] as number | null, d[prev] as number | null]));
  const col = (W - left - right) / series.length;
  const bw = Math.max(2, Math.min(14, col / 2 - 2.5));
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const every = series.length <= 7 ? 1 : series.length <= 14 ? 2 : 7;
  const hovered = hover === null ? null : series[hover];
  return (
    <figure className="rv-chart" aria-label={title}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: this period in the section colour, the same day of the prior period in a lighter tint`} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map(f => <line key={f} x1={left} x2={W - right} y1={y(max * f)} y2={y(max * f)} className="rv-grid" />)}
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} className="rv-axis" />
        <text x={W - right} y={y(max) - 2} textAnchor="end" className="rv-tick">{format(max)}</text>
        {series.map((d, i) => {
          const x0 = left + i * col + col / 2, a = d[prev] as number | null, b = d[cur] as number | null;
          return (
            <g key={d.date} className={hover === i ? 'rv-col rv-on' : 'rv-col'}>
              <rect x={left + i * col} y={top} width={col} height={H - top - bottom} className="rv-hit" tabIndex={0} role="button"
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => onDay(d.date)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDay(d.date); } }}
                aria-label={`${longDate(d.date)}: ${b === null ? 'no data' : format(b)}; prior ${a === null ? 'no data' : format(a)}. Open day`} />
              {a !== null && <rect x={x0 - bw - 1} y={y(Math.max(a, 0))} width={bw} height={Math.max(a > 0 ? 2 : 1, y(0) - y(a))} rx={Math.min(3, bw / 2)} className="rv-bar-prev" />}
              {b !== null && <rect x={x0 + 1} y={y(Math.max(b, 0))} width={bw} height={Math.max(b > 0 ? 2 : 1, y(0) - y(b))} rx={Math.min(3, bw / 2)} className="rv-bar" />}
              {i % every === 0 && <text x={x0} y={H - 7} textAnchor="middle" className="rv-tick">{series.length <= 7 ? d.label : shortDate(d.date)}</text>}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className="rv-tip" style={{ left: `${((left + hover! * col + col / 2) / W) * 100}%` }} role="status">
          <div className="rv-tip-date">{longDate(hovered.date)}</div>
          <div><span className="rv-dot" />{hovered[cur] === null ? 'No data' : `${format(hovered[cur] as number)} ${unitLabel}`}</div>
          <div className="rv-tip-prev"><span className="rv-dot rv-dot-prev" />{shortDate(hovered.prev_date)}: {hovered[prev] === null ? 'No data' : `${format(hovered[prev] as number)} ${unitLabel}`}</div>
        </div>
      )}
      <figcaption className="rv-legend"><span><span className="rv-dot" />This period</span><span><span className="rv-dot rv-dot-prev" />Same day, prior period</span></figcaption>
    </figure>
  );
}

function WeightChart({ series, onDay }: { series: DayPoint[]; onDay: (d: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = series.map((d, i) => ({ i, d, v: d.weight_lb })).filter((p): p is { i: number; d: DayPoint; v: number } => p.v !== null);
  if (!pts.length) return <p className="rv-empty">No weigh-ins in this period.</p>;
  const W = 360, H = 150, top = 16, bottom = 22, left = 2, right = 6;
  const lo = Math.floor(Math.min(...pts.map(p => p.v)) - 1), hi = Math.ceil(Math.max(...pts.map(p => p.v)) + 1);
  const x = (i: number) => left + (W - left - right) * (series.length === 1 ? 0.5 : i / (series.length - 1));
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo));
  const h = hover === null ? null : pts[hover];
  return (
    <figure className="rv-chart" aria-label="Weight">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Weigh-ins from ${pts[0].v.toFixed(1)} to ${pts[pts.length - 1].v.toFixed(1)} lb`} onMouseLeave={() => setHover(null)}>
        {[lo, (lo + hi) / 2, hi].map(v => <g key={v}><line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className="rv-grid" /><text x={left} y={y(v) - 4} className="rv-tick">{v.toFixed(1)}</text></g>)}
        {pts.length > 1 && <polyline points={pts.map(p => `${x(p.i)},${y(p.v)}`).join(' ')} className="rv-line" />}
        {pts.map((p, k) => <circle key={p.d.date} cx={x(p.i)} cy={y(p.v)} r={hover === k ? 6 : 4} className="rv-point" tabIndex={0}
          onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} onBlur={() => setHover(null)} onClick={() => onDay(p.d.date)} role="button"
          onKeyDown={e => { if (e.key === 'Enter') onDay(p.d.date); }} aria-label={`${longDate(p.d.date)}: ${p.v.toFixed(1)} lb. Open day`} />)}
        <text x={left} y={H - 6} className="rv-tick">{shortDate(series[0].date)}</text>
        <text x={W - right} y={H - 6} textAnchor="end" className="rv-tick">{shortDate(series[series.length - 1].date)}</text>
      </svg>
      {h && <div className="rv-tip" style={{ left: `${(x(h.i) / W) * 100}%` }} role="status"><div className="rv-tip-date">{longDate(h.d.date)}</div><div>{h.v.toFixed(1)} lb</div></div>}
    </figure>
  );
}

function Section({ title, kicker, children, aside, tone }: { title: string; kicker?: string; children: React.ReactNode; aside?: React.ReactNode; tone?: string }) {
  return (
    <section className={`rv-card rv-section${tone ? ` rv-s-${tone} rv-toned` : ''}`}>
      <header className="rv-section-head"><div>{kicker && <div className="rv-kicker"><i className="rv-sdot" />{kicker}</div>}<h2>{title}</h2></div>{aside}</header>
      {children}
    </section>
  );
}

function Stats({ items }: { items: [string, string][] }) {
  return <dl className="rv-stats">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function Notes({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({ kind: 'idle' });
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || status.kind === 'sending') return;
    setStatus({ kind: 'sending' });
    try {
      const saved = await postNote(token, text);
      setText('');
      setStatus({ kind: 'sent', message: `Sent to Matt · ${new Date(saved.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` });
    } catch (error) {
      if (error instanceof ViewerAuthError) return onExpired();
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'The note was not sent.' });
    }
  };
  return (
    <section className="rv-card rv-section rv-notes">
      <header className="rv-section-head"><div><div className="rv-kicker">Coach</div><h2>Notes for Matt</h2></div></header>
      <form onSubmit={send}>
        <label htmlFor="rv-note" className="rv-sub">Notes are added to Matt&rsquo;s next weekly report. They can&rsquo;t be edited after sending.</label>
        <textarea id="rv-note" value={text} maxLength={NOTE_MAX} rows={4} placeholder="Write a note…"
          onChange={e => { setText(e.target.value); if (status.kind !== 'sending') setStatus({ kind: 'idle' }); }} />
        <div className="rv-note-row">
          <span className={`rv-note-status rv-${status.kind}`} aria-live="polite">
            {status.kind === 'sent' && <><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>{status.message}</>}
            {status.kind === 'error' && status.message}
            {(status.kind === 'idle' || status.kind === 'sending') && <span className="rv-count">{text.length.toLocaleString()} / {NOTE_MAX.toLocaleString()}</span>}
          </span>
          <button type="submit" className="rv-button" disabled={!text.trim() || status.kind === 'sending'}>{status.kind === 'sending' ? 'Sending…' : 'Send note'}</button>
        </div>
      </form>
    </section>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return <main className="rv rv-center"><div className="rv-card rv-message"><div className="rv-kicker">Weekly overview</div><h1>{title}</h1><p>{body}</p></div></main>;
}

function Skeleton() {
  return <div className="rv-kpis" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="rv-card rv-kpi rv-skeleton"><span /><span /><span /></div>)}</div>;
}

const WELCOME_KEY = 'cupcake-robyn-welcome-v1';
const WELCOME_ITEMS: [string, string, string][] = [
  ['summary', 'Live dashboard', 'Updates as Matt logs, with this week beside last week.'],
  ['food', 'Day drill-downs', 'Tap any day, bar or figure for meals, workouts and sleep.'],
  ['weight', 'Coaching check-ins', 'Check-ins and the plan from your app, with body trends.'],
  ['steps', 'Export', 'Download everything as a spreadsheet (CSV) or JSON.'],
  ['sleep', 'Ask Cupcake', 'Ask about the numbers by voice or text.'],
];
function Welcome({ onAsk }: { onAsk: () => void }) {
  const [open, setOpen] = useState(() => { try { return storage()?.getItem(WELCOME_KEY) !== 'dismissed'; } catch { return true; } });
  if (!open) return null;
  const close = () => { try { storage()?.setItem(WELCOME_KEY, 'dismissed'); } catch { /* ignore */ } setOpen(false); };
  return (
    <section className="rv-card rv-welcome" aria-labelledby="rv-welcome-title">
      <button className="rv-welcome-x" onClick={close} aria-label="Dismiss welcome">×</button>
      <h2 id="rv-welcome-title">Hi Robyn, welcome</h2>
      <p className="rv-sub">Matt set this page up for your weekly sessions. It's read-only, and here's what's new:</p>
      <ul className="rv-welcome-list">{WELCOME_ITEMS.map(([tone, t, d]) => <li key={t} className={`rv-s-${tone}`}><i className="rv-sdot" /><div><strong>{t}</strong><span>{d}</span></div></li>)}</ul>
      <div className="rv-welcome-actions"><button className="rv-wbtn rv-wbtn-primary" onClick={close}>Get started</button><button className="rv-wbtn" onClick={() => { close(); onAsk(); }}>Ask Cupcake</button></div>
    </section>
  );
}

export default function RobynDashboard() {
  useHeadMeta();
  const token = useMemo(() => captureToken(window.location.href, window.history, storage()), []);
  const [weeks, setWeeks] = useState<Weeks>(1);
  const [state, setState] = useState<State>(() => token ? { kind: 'loading' } : { kind: 'missing' });
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<{ weeks: Weeks; days: Day[] } | null>(null);
  const [sheet, setSheet] = useState<SheetView | null>(null);
  const [chat, setChat] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  useEffect(() => { if (token) fetchCoach(token).then(setCoach).catch(() => undefined); }, [token]);
  const seq = useRef(0);
  const expire = useCallback(() => { try { storage()?.removeItem('cupcake-robyn-viewer'); } catch { /* ignore */ } setState({ kind: 'expired' }); }, []);

  useEffect(() => {
    if (!token) return;
    const id = ++seq.current;
    setBusy(true);
    fetchWeekly(token, weeks).then(data => { if (id === seq.current) setState({ kind: 'ready', data }); })
      .catch(error => {
        if (id !== seq.current) return;
        if (error instanceof ViewerAuthError) return error.expired ? expire() : setState({ kind: 'expired' });
        setState(s => s.kind === 'ready' ? s : { kind: 'error', message: error instanceof Error ? error.message : 'Unavailable' });
      }).finally(() => { if (id === seq.current) setBusy(false); });
    fetchDetails(token, weeks).then(d => { if (id === seq.current) setDetails({ weeks, days: d.days }); }).catch(() => undefined);
  }, [token, weeks, expire]);
  const openDay = useCallback((date: string) => setSheet({ kind: 'day', date }), []);
  const openMetric = useCallback((metric: MetricKey) => setSheet({ kind: 'metric', metric }), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeChat = useCallback(() => setChat(false), []);

  if (state.kind === 'missing') return <Message title="Link required" body="Open this page from the link in the weekly email. For privacy, the overview needs a personal access link." />;
  if (state.kind === 'expired') return <Message title="This link is no longer active" body="For privacy, overview links expire after two weeks. The next weekly email includes a new link." />;
  if (state.kind === 'error') return <Message title="Overview unavailable" body={`${state.message} Please try again shortly.`} />;

  const data = state.kind === 'ready' ? state.data : null;
  const m = data?.metrics;
  const p = data?.period;
  const heading = p ? (p.weeks === 1 ? `Week of ${p.current.label}` : `${p.current.label}`) : 'Loading…';
  const unit = weeks === 1 ? 'week' : `${weeks} weeks`;
  // The 2–3 clearest improvements get a one-time accent sweep.
  const keys = new Set(m ? (['exercise_minutes', 'steps_avg', 'meals'] as const)
    .filter(k => deltaTone(m[k]) === 'good' && (m[k].pct === null || Math.abs(m[k].pct as number) >= 5)).slice(0, 3) : []);
  const days = details && details.weeks === weeks ? details.days : null;
  return (
    <main className="rv">
      <div className="rv-wrap">
        <div className="rv-bar-top"><div className="rv-kicker">Weekly overview</div><RpLink /></div>
        <header className="rv-top">
          <div>
            <h1>Matt Hales <span className="rv-h1-sep">·</span> <span className="rv-h1-week">{heading}</span></h1>
            <p className="rv-sub">{p ? `Compared with ${p.previous.label} · ${weeks === 1 ? 'one-week' : `${weeks}-week`} view` : '\u00a0'}</p>
          </div>
          <div className="rv-controls">
          <div className="rv-seg" role="radiogroup" aria-label="Period length" style={{ ['--rv-i' as string]: [1, 2, 4].indexOf(weeks) }}>
            <span className="rv-seg-thumb" aria-hidden="true" />
            {([1, 2, 4] as Weeks[]).map(w => <button key={w} role="radio" aria-checked={weeks === w} className={weeks === w ? 'rv-on' : ''} onClick={() => setWeeks(w)}>{w} {w === 1 ? 'week' : 'weeks'}</button>)}
          </div>
          {p && <ExportMenu token={token} weeks={weeks} end={p.current.end} onExpired={expire} />}
          </div>
        </header>

        {!data || !m ? <Skeleton /> : (
          <div className={busy ? 'rv-body rv-busy' : 'rv-body'} aria-busy={busy}>
            <Welcome onAsk={() => setChat(true)} />
            <div className="rv-kpis">
              <Kpi section="food" onOpen={() => openMetric('food')} label="Logged calories" value={m.food_kcal_avg.current} format={v => fmt(v)} unit="kcal" sub={`per logged day · ${fmt(m.food_days.current)} of ${weeks * 7} days`}><Delta m={m.food_kcal_avg} unit="kcal" /></Kpi>
              <Kpi section="food" onOpen={() => openMetric('meals')} key_={keys.has('meals')} label="Meals logged" value={m.meals.current} format={v => fmt(v)} sub={`prior ${fmt(m.meals.previous)}`}><Delta m={m.meals} /></Kpi>
              <Kpi section="steps" onOpen={() => openMetric('steps')} key_={keys.has('steps_avg')} label="Steps per day" value={m.steps_avg.current} format={v => fmt(v)} sub={`${fmt(m.steps_days.current)} days with data`}><Delta m={m.steps_avg} /></Kpi>
              <Kpi section="exercise" onOpen={() => openMetric('exercise')} key_={keys.has('exercise_minutes')} label="Exercise" value={m.exercise_minutes.current} format={v => fmt(v)} unit="min" sub={`${fmt(m.exercise_sessions.current)} sessions`}><Delta m={m.exercise_minutes} unit="min" /></Kpi>
              <Kpi section="sleep" onOpen={() => openMetric('sleep')} label="Sleep" value={m.sleep_avg_min.current} format={v => hm(v)} sub={`${fmt(m.sleep_nights.current)} nights tracked`}><Delta m={m.sleep_avg_min} kind="minutes" /></Kpi>
              <Kpi section="weight" onOpen={() => openMetric('weight')} label="Weight" value={m.weight_end.current} format={v => fmt(v, 1)} unit="lb" sub="latest weigh-in"><Delta m={m.weight_end} kind="decimal" unit="lb" /></Kpi>
            </div>

            <Section title="Summary" kicker="Overview" tone="summary">
              <ul className="rv-headlines">{data.headlines.map(h => <li key={h}>{h}</li>)}</ul>
              {(data.status ?? []).length > 0 && <div className="rv-status">{data.status!.map(t => <span key={t}>{t}</span>)}</div>}
              {data.gaps.length > 0 && <div className="rv-gaps"><div className="rv-label">Data gaps</div><ul>{data.gaps.map(g => <li key={g}>{g}</li>)}</ul></div>}
            </Section>

            <Section title="Day by day" kicker="Details" tone="summary" aside={<span className="rv-sub rv-hint">Tap a day, bar or figure for details</span>}>
              {days ? <DayGrid days={days} onDay={openDay} /> : <div className="rv-days rv-days-skel" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <span key={i} />)}</div>}
            </Section>

            <div className="rv-grid2">
              <Section tone="food" title="Food" kicker="Nutrition" aside={<Delta m={m.food_kcal_avg} unit="kcal" />}>
                <Stats items={[['Meals', fmt(m.meals.current)], ['Logged kcal', fmt(m.food_kcal_total.current)], ['Sugar / day', m.sugar_g_avg.current === null ? '—' : `${fmt(m.sugar_g_avg.current)} g`]]} />
                <BarChart series={data.series} cur="kcal" prev="prev_kcal" format={v => fmt(v)} title="Logged calories per day" unitLabel="kcal" onDay={openDay} />
                <p className="rv-foot">Some meals are estimated from card charges. Days without entries are gaps, not zero intake.</p>
              </Section>
              <Section tone="steps" title="Steps" kicker="Activity" aside={<Delta m={m.steps_avg} />}>
                <Stats items={[['Total', fmt(m.steps_total.current)], ['Per day', fmt(m.steps_avg.current)], ['Prior per day', fmt(m.steps_avg.previous)]]} />
                <BarChart series={data.series} cur="steps" prev="prev_steps" format={v => fmt(v)} title="Steps per day" unitLabel="steps" onDay={openDay} />
                <p className="rv-foot">Blank days had no upload from the phone.</p>
              </Section>
              <Section tone="exercise" title="Exercise" kicker="Activity" aside={<Delta m={m.exercise_minutes} unit="min" />}>
                <Stats items={[['Sessions', fmt(m.exercise_sessions.current)], ['Minutes', fmt(m.exercise_minutes.current)], ['Calories', fmt(m.exercise_kcal.current)]]} />
                <BarChart series={data.series} cur="ex_min" prev="prev_ex_min" format={v => fmt(v)} title="Exercise minutes per day" unitLabel="min" onDay={openDay} />
              </Section>
              <Section tone="sleep" title="Sleep" kicker="Recovery" aside={<Delta m={m.sleep_avg_min} kind="minutes" />}>
                <Stats items={[['Average', hm(m.sleep_avg_min.current)], ['Resting HR', m.resting_hr_avg.current === null ? '—' : `${fmt(m.resting_hr_avg.current)} bpm`], ['SpO₂ mean / low', m.spo2_mean.current === null ? '—' : `${fmt(m.spo2_mean.current)}% / ${fmt(m.spo2_min.current)}%`]]} />
                <BarChart series={data.series} cur="sleep_min" prev="prev_sleep_min" format={v => hm(v)} title="Sleep per night" unitLabel="" onDay={openDay} />
                <p className="rv-foot">RingConn estimate where available. HRV is not reported by this source.</p>
              </Section>
            </div>

            <div className="rv-grid2">
              <Section tone="weight" title="Weight" kicker="Body" aside={<Delta m={m.weight_end} kind="decimal" unit="lb" />}>
                <WeightChart series={data.series} onDay={openDay} />
                <div className="rv-trend">{data.weight_trend.map(t => <div key={t.week}><span className="rv-label">{t.week}</span><strong>{fmt(t.avg_lb, 1)}</strong><span className="rv-sub">{t.readings} readings</span></div>)}</div>
              </Section>
              <Section tone="wins" title="Outcomes" kicker="Accountability">
                <Stats items={[['Wins', fmt(m.wins.current)], ['Setbacks', fmt(m.losses.current)], [`Prior ${unit}`, `${fmt(m.wins.previous)} / ${fmt(m.losses.previous)}`], ['Days with data', `${fmt(m.coverage_days.current)} of ${weeks * 7}`]]} />
                <p className="rv-foot">Wins and setbacks are recorded by Matt. Details stay in his private log.</p>
              </Section>
            </div>

            {coach?.has_data && <>
              <div className="rv-coach-head"><div className="rv-kicker">From Robyn&rsquo;s plan</div><h2>Coaching plan &amp; check-ins</h2>
                <p className="rv-sub">Entered from the Robyn Peck app into Cupcake by Matt. There is no live connection to the app.</p></div>
              <div className="rv-coach">
                <BodySection coach={coach} />
                {days && <PlanVsActual coach={coach} days={days.filter(d => d.period !== 'previous')} />}
                {days && <WorkoutGrid coach={coach} days={days.filter(d => d.period !== 'previous')} onDay={openDay} />}
                <CheckinsCard coach={coach} />
                <MealPlanCard coach={coach} />
              </div>
            </>}

            <Notes token={token} onExpired={expire} />
            <footer className="rv-footer">Read-only overview · Link expires {expiryLabel(data.expiresAt)}<br />Prepared by Cupcake, Matt&rsquo;s AI wellness assistant<div className="rv-footer-rp"><RpLink /></div></footer>
          </div>
        )}
      </div>
      {sheet && <DaySheet view={sheet} days={days} loading={!days} onClose={closeSheet} onDay={openDay} />}
      {data && <>
        <button className={chat ? 'rv-fab rv-fab-hidden' : 'rv-fab'} onClick={() => setChat(true)} aria-label="Ask Cupcake" aria-expanded={chat}>
          <img src="/cupcake-icon.svg" alt="" /><span>Ask Cupcake</span>
        </button>
        <CupcakePanel token={token} open={chat} onClose={closeChat} onExpired={expire} />
      </>}
    </main>
  );
}
