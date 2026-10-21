import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DayPoint, Metric, Weekly } from './viewerApi.ts';
import { NOTE_MAX, ViewerAuthError, captureToken, deltaText, deltaTone, expiryLabel, fetchWeekly, fmt, hm, longDate, niceMax, postNote, shortDate } from './viewerApi.ts';
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

function Delta({ m, kind, unit }: { m: Metric; kind?: 'number' | 'minutes' | 'decimal'; unit?: string }) {
  const tone = deltaTone(m);
  return <span className={`rv-delta rv-${tone}`}>{deltaText(m, kind, unit)}{m.delta !== null && m.delta !== 0 ? <span className="rv-delta-ref"> vs prior</span> : null}</span>;
}

function Kpi({ label, value, unit, sub, children }: { label: string; value: string; unit?: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="rv-card rv-kpi">
      <div className="rv-label">{label}</div>
      <div className="rv-value">{value}{unit ? <span className="rv-unit"> {unit}</span> : null}</div>
      <div className="rv-kpi-foot">{children}{sub ? <span className="rv-sub">{sub}</span> : null}</div>
    </div>
  );
}

function BarChart({ series, cur, prev, format, title, unitLabel }: { series: DayPoint[]; cur: NumKey; prev: NumKey; format: (v: number) => string; title: string; unitLabel: string }) {
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
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: this period in blue, the same day of the prior period in grey`} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map(f => <line key={f} x1={left} x2={W - right} y1={y(max * f)} y2={y(max * f)} className="rv-grid" />)}
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} className="rv-axis" />
        <text x={W - right} y={y(max) - 2} textAnchor="end" className="rv-tick">{format(max)}</text>
        {series.map((d, i) => {
          const x0 = left + i * col + col / 2, a = d[prev] as number | null, b = d[cur] as number | null;
          return (
            <g key={d.date} className={hover === i ? 'rv-col rv-on' : 'rv-col'}>
              <rect x={left + i * col} y={top} width={col} height={H - top - bottom} className="rv-hit" tabIndex={0}
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${longDate(d.date)}: ${b === null ? 'no data' : format(b)}; prior ${a === null ? 'no data' : format(a)}`} />
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

function WeightChart({ series }: { series: DayPoint[] }) {
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
          onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} onBlur={() => setHover(null)} aria-label={`${longDate(p.d.date)}: ${p.v.toFixed(1)} lb`} />)}
        <text x={left} y={H - 6} className="rv-tick">{shortDate(series[0].date)}</text>
        <text x={W - right} y={H - 6} textAnchor="end" className="rv-tick">{shortDate(series[series.length - 1].date)}</text>
      </svg>
      {h && <div className="rv-tip" style={{ left: `${(x(h.i) / W) * 100}%` }} role="status"><div className="rv-tip-date">{longDate(h.d.date)}</div><div>{h.v.toFixed(1)} lb</div></div>}
    </figure>
  );
}

function Section({ title, kicker, children, aside }: { title: string; kicker?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rv-card rv-section">
      <header className="rv-section-head"><div>{kicker && <div className="rv-kicker">{kicker}</div>}<h2>{title}</h2></div>{aside}</header>
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

export default function RobynDashboard() {
  useHeadMeta();
  const token = useMemo(() => captureToken(window.location.href, window.history, storage()), []);
  const [weeks, setWeeks] = useState<Weeks>(1);
  const [state, setState] = useState<State>(() => token ? { kind: 'loading' } : { kind: 'missing' });
  const [busy, setBusy] = useState(false);
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
  }, [token, weeks, expire]);

  if (state.kind === 'missing') return <Message title="Link required" body="Open this page from the link in the weekly email. For privacy, the overview needs a personal access link." />;
  if (state.kind === 'expired') return <Message title="This link is no longer active" body="For privacy, overview links expire after two weeks. The next weekly email includes a new link." />;
  if (state.kind === 'error') return <Message title="Overview unavailable" body={`${state.message} Please try again shortly.`} />;

  const data = state.kind === 'ready' ? state.data : null;
  const m = data?.metrics;
  const p = data?.period;
  const heading = p ? (p.weeks === 1 ? `Week of ${p.current.label}` : `${p.current.label}`) : 'Loading…';
  const unit = weeks === 1 ? 'week' : `${weeks} weeks`;
  return (
    <main className="rv">
      <div className="rv-wrap">
        <header className="rv-top">
          <div>
            <div className="rv-kicker">Weekly overview</div>
            <h1>Matt Hales <span className="rv-h1-sep">·</span> <span className="rv-h1-week">{heading}</span></h1>
            <p className="rv-sub">{p ? `Compared with ${p.previous.label} · ${weeks === 1 ? 'one-week' : `${weeks}-week`} view` : '\u00a0'}</p>
          </div>
          <div className="rv-seg" role="radiogroup" aria-label="Period length" style={{ ['--rv-i' as string]: [1, 2, 4].indexOf(weeks) }}>
            <span className="rv-seg-thumb" aria-hidden="true" />
            {([1, 2, 4] as Weeks[]).map(w => <button key={w} role="radio" aria-checked={weeks === w} className={weeks === w ? 'rv-on' : ''} onClick={() => setWeeks(w)}>{w} {w === 1 ? 'week' : 'weeks'}</button>)}
          </div>
        </header>

        {!data || !m ? <Skeleton /> : (
          <div className={busy ? 'rv-body rv-busy' : 'rv-body'} aria-busy={busy}>
            <div className="rv-kpis">
              <Kpi label="Logged calories" value={fmt(m.food_kcal_avg.current)} unit="kcal" sub={`per logged day · ${fmt(m.food_days.current)} of ${weeks * 7} days`}><Delta m={m.food_kcal_avg} unit="kcal" /></Kpi>
              <Kpi label="Meals logged" value={fmt(m.meals.current)} sub={`prior ${fmt(m.meals.previous)}`}><Delta m={m.meals} /></Kpi>
              <Kpi label="Steps per day" value={fmt(m.steps_avg.current)} sub={`${fmt(m.steps_days.current)} days with data`}><Delta m={m.steps_avg} /></Kpi>
              <Kpi label="Exercise" value={fmt(m.exercise_minutes.current)} unit="min" sub={`${fmt(m.exercise_sessions.current)} sessions`}><Delta m={m.exercise_minutes} unit="min" /></Kpi>
              <Kpi label="Sleep" value={hm(m.sleep_avg_min.current)} sub={`${fmt(m.sleep_nights.current)} nights tracked`}><Delta m={m.sleep_avg_min} kind="minutes" /></Kpi>
              <Kpi label="Weight" value={fmt(m.weight_end.current, 1)} unit="lb" sub="latest weigh-in"><Delta m={m.weight_end} kind="decimal" unit="lb" /></Kpi>
            </div>

            <Section title="Summary" kicker="Overview">
              <ul className="rv-headlines">{data.headlines.map(h => <li key={h}>{h}</li>)}</ul>
              {data.gaps.length > 0 && <div className="rv-gaps"><div className="rv-label">Data gaps</div><ul>{data.gaps.map(g => <li key={g}>{g}</li>)}</ul></div>}
            </Section>

            <div className="rv-grid2">
              <Section title="Food" kicker="Nutrition" aside={<Delta m={m.food_kcal_avg} unit="kcal" />}>
                <Stats items={[['Meals', fmt(m.meals.current)], ['Logged kcal', fmt(m.food_kcal_total.current)], ['Sugar / day', m.sugar_g_avg.current === null ? '—' : `${fmt(m.sugar_g_avg.current)} g`]]} />
                <BarChart series={data.series} cur="kcal" prev="prev_kcal" format={v => fmt(v)} title="Logged calories per day" unitLabel="kcal" />
                <p className="rv-foot">Some meals are estimated from card charges. Days without entries are gaps, not zero intake.</p>
              </Section>
              <Section title="Steps" kicker="Activity" aside={<Delta m={m.steps_avg} />}>
                <Stats items={[['Total', fmt(m.steps_total.current)], ['Per day', fmt(m.steps_avg.current)], ['Prior per day', fmt(m.steps_avg.previous)]]} />
                <BarChart series={data.series} cur="steps" prev="prev_steps" format={v => fmt(v)} title="Steps per day" unitLabel="steps" />
                <p className="rv-foot">Blank days had no upload from the phone.</p>
              </Section>
              <Section title="Exercise" kicker="Activity" aside={<Delta m={m.exercise_minutes} unit="min" />}>
                <Stats items={[['Sessions', fmt(m.exercise_sessions.current)], ['Minutes', fmt(m.exercise_minutes.current)], ['Calories', fmt(m.exercise_kcal.current)]]} />
                <BarChart series={data.series} cur="ex_min" prev="prev_ex_min" format={v => fmt(v)} title="Exercise minutes per day" unitLabel="min" />
              </Section>
              <Section title="Sleep" kicker="Recovery" aside={<Delta m={m.sleep_avg_min} kind="minutes" />}>
                <Stats items={[['Average', hm(m.sleep_avg_min.current)], ['Resting HR', m.resting_hr_avg.current === null ? '—' : `${fmt(m.resting_hr_avg.current)} bpm`], ['SpO₂ mean / low', m.spo2_mean.current === null ? '—' : `${fmt(m.spo2_mean.current)}% / ${fmt(m.spo2_min.current)}%`]]} />
                <BarChart series={data.series} cur="sleep_min" prev="prev_sleep_min" format={v => hm(v)} title="Sleep per night" unitLabel="" />
                <p className="rv-foot">RingConn estimate where available. HRV is not reported by this source.</p>
              </Section>
            </div>

            <div className="rv-grid2">
              <Section title="Weight" kicker="Body" aside={<Delta m={m.weight_end} kind="decimal" unit="lb" />}>
                <WeightChart series={data.series} />
                <div className="rv-trend">{data.weight_trend.map(t => <div key={t.week}><span className="rv-label">{t.week}</span><strong>{fmt(t.avg_lb, 1)}</strong><span className="rv-sub">{t.readings} readings</span></div>)}</div>
              </Section>
              <Section title="Outcomes" kicker="Accountability">
                <Stats items={[['Wins', fmt(m.wins.current)], ['Setbacks', fmt(m.losses.current)], [`Prior ${unit}`, `${fmt(m.wins.previous)} / ${fmt(m.losses.previous)}`], ['Days with data', `${fmt(m.coverage_days.current)} of ${weeks * 7}`]]} />
                <p className="rv-foot">Wins and setbacks are recorded by Matt. Details stay in his private log.</p>
              </Section>
            </div>

            <Notes token={token} onExpired={expire} />
            <footer className="rv-footer">Read-only overview · Link expires {expiryLabel(data.expiresAt)}<br />Prepared by Cupcake, Matt&rsquo;s AI wellness assistant</footer>
          </div>
        )}
      </div>
    </main>
  );
}
