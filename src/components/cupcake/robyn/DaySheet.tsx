import { useEffect, useRef } from 'react';
import type { Day } from './viewerApi.ts';
import { fmt, hm, longDate } from './viewerApi.ts';

export type SheetView = { kind: 'day'; date: string } | { kind: 'metric'; metric: MetricKey };
export type MetricKey = 'food' | 'meals' | 'steps' | 'exercise' | 'sleep' | 'weight';

const METRICS: Record<MetricKey, { title: string; section: string; value: (d: Day) => string; raw: (d: Day) => number | null }> = {
  food: { title: 'Logged calories by day', section: 'food', value: d => d.food_kcal === null ? '—' : `${fmt(d.food_kcal)} kcal`, raw: d => d.food_kcal },
  meals: { title: 'Meals by day', section: 'food', value: d => d.meals.length ? `${d.meals.length} meal${d.meals.length === 1 ? '' : 's'}` : '—', raw: d => d.meals.length || null },
  steps: { title: 'Steps by day', section: 'steps', value: d => d.steps === null ? '—' : fmt(d.steps), raw: d => d.steps },
  exercise: { title: 'Exercise by day', section: 'exercise', value: d => d.workouts.length ? `${fmt(d.exercise_minutes)} min · ${fmt(d.exercise_kcal)} kcal` : '—', raw: d => d.workouts.length ? d.exercise_minutes : null },
  sleep: { title: 'Sleep by night', section: 'sleep', value: d => d.sleep ? hm(d.sleep.asleep_min ?? d.sleep.session_min) : '—', raw: d => d.sleep ? (d.sleep.asleep_min ?? d.sleep.session_min) : null },
  weight: { title: 'Weigh-ins by day', section: 'weight', value: d => d.weight.length ? `${d.weight[d.weight.length - 1].lb.toFixed(1)} lb` : '—', raw: d => d.weight.length ? d.weight[d.weight.length - 1].lb : null },
};

const time12 = (hhmm: string | null | undefined): string => {
  if (!hhmm) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.includes('T') ? hhmm.split('T')[1] : hhmm);
  if (!m) return '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

function Empty({ children }: { children: React.ReactNode }) { return <p className="rv-sheet-empty">{children}</p>; }

function DayBody({ day }: { day: Day }) {
  const sl = day.sleep;
  const stages = sl?.stages_min ? (['deep', 'light', 'rem', 'awake'] as const).filter(k => sl.stages_min?.[k] !== undefined) : [];
  const stageTotal = stages.reduce((a, k) => a + (sl?.stages_min?.[k] ?? 0), 0);
  return (
    <>
      <div className="rv-sheet-kpis">
        <div className="rv-s-food"><span className="rv-label"><i className="rv-sdot" />Food</span><strong>{day.food_kcal === null ? '—' : fmt(day.food_kcal)}</strong><span className="rv-sub">kcal · {day.meals.length} meals</span></div>
        <div className="rv-s-exercise"><span className="rv-label"><i className="rv-sdot" />Exercise</span><strong>{fmt(day.exercise_minutes)}</strong><span className="rv-sub">min · {fmt(day.exercise_kcal)} kcal</span></div>
        <div className="rv-s-steps"><span className="rv-label"><i className="rv-sdot" />Steps</span><strong>{fmt(day.steps)}</strong><span className="rv-sub">{day.steps === null ? 'no upload' : 'phone'}</span></div>
        <div className="rv-s-sleep"><span className="rv-label"><i className="rv-sdot" />Sleep</span><strong>{sl ? hm(sl.asleep_min ?? sl.session_min) : '—'}</strong><span className="rv-sub">{sl ? sl.source : 'not tracked'}</span></div>
      </div>

      <section className="rv-sheet-sec rv-s-food">
        <h3><i className="rv-sdot" />Meals</h3>
        {day.meals.length ? <ul className="rv-rows">{day.meals.map((m, i) => (
          <li key={i}>
            <div className="rv-row-main"><span className="rv-row-time">{time12(m.time)}</span><span className="rv-row-desc">{m.description || 'Meal'}</span><span className="rv-row-val">{m.kcal === null ? '—' : `${fmt(m.kcal)} kcal`}</span></div>
            <div className="rv-row-meta">
              <span className={`rv-chip rv-chip-${m.source === 'Bank estimate' ? 'bank' : m.source === 'Photo' ? 'photo' : 'manual'}`}>{m.source}</span>
              {[['P', m.protein_g], ['C', m.carbs_g], ['F', m.fat_g], ['Sugar', m.sugar_g]].filter(([, v]) => v !== null).map(([k, v]) => <span key={k as string}>{k} {fmt(v as number)} g</span>)}
              {m.partial && <span>partial estimate</span>}
            </div>
          </li>))}</ul> : <Empty>No meals logged. A day without entries is a gap, not zero intake.</Empty>}
      </section>

      <section className="rv-sheet-sec rv-s-exercise">
        <h3><i className="rv-sdot" />Workouts</h3>
        {day.workouts.length ? <ul className="rv-rows">{day.workouts.map((w, i) => (
          <li key={i}><div className="rv-row-main"><span className="rv-row-time">{time12(w.time)}</span><span className="rv-row-desc">{w.description}</span><span className="rv-row-val">{fmt(w.minutes)} min · {fmt(w.kcal)} kcal</span></div></li>))}</ul>
          : <Empty>No workouts logged.</Empty>}
      </section>

      <section className="rv-sheet-sec rv-s-sleep">
        <h3><i className="rv-sdot" />Sleep</h3>
        {sl ? <>
          <dl className="rv-stats">
            {sl.asleep_min !== null && <div><dt>Asleep</dt><dd>{hm(sl.asleep_min)}</dd></div>}
            {sl.session_min !== null && <div><dt>{sl.source === 'RingConn' ? 'Session' : 'Time in bed'}</dt><dd>{hm(sl.session_min)}</dd></div>}
            {sl.resting_hr !== null && <div><dt>Resting HR</dt><dd>{fmt(sl.resting_hr)} bpm</dd></div>}
            {sl.avg_hr !== null && <div><dt>Average HR</dt><dd>{fmt(sl.avg_hr)} bpm</dd></div>}
            {sl.spo2_mean !== null && <div><dt>SpO₂ mean / low</dt><dd>{fmt(sl.spo2_mean, 1)}% / {fmt(sl.spo2_min)}%</dd></div>}
            {sl.bedtime && <div><dt>Bed / wake</dt><dd>{time12(sl.bedtime)} – {time12(sl.waketime)}</dd></div>}
          </dl>
          {stages.length > 0 && <div className="rv-stages" role="img" aria-label={stages.map(k => `${k} ${hm(sl.stages_min?.[k])}`).join(', ')}>
            <div className="rv-stage-bar">{stages.map(k => <span key={k} className={`rv-stage-${k}`} style={{ flexGrow: sl.stages_min?.[k] ?? 0 }} />)}</div>
            <div className="rv-stage-legend">{stages.map(k => <span key={k}><i className={`rv-stage-${k}`} />{k === 'rem' ? 'REM' : k[0].toUpperCase() + k.slice(1)} {hm(sl.stages_min?.[k])} <em>{stageTotal ? Math.round(100 * (sl.stages_min?.[k] ?? 0) / stageTotal) : 0}%</em></span>)}</div>
          </div>}
          <p className="rv-foot">{sl.source === 'RingConn' ? 'RingConn nightly summary. HRV is not reported by this source.' : 'Phone (Health Connect) sleep session; stages and heart rate are not available for this night.'}</p>
        </> : <Empty>No sleep data for this night.</Empty>}
      </section>

      <section className="rv-sheet-sec rv-s-weight">
        <h3><i className="rv-sdot" />Weight</h3>
        {day.weight.length ? <ul className="rv-rows">{day.weight.map((w, i) => (
          <li key={i}><div className="rv-row-main"><span className="rv-row-time">{time12(w.time)}</span><span className="rv-row-desc">{w.source}</span><span className="rv-row-val">{w.lb.toFixed(1)} lb</span></div></li>))}</ul>
          : <Empty>No weigh-in.</Empty>}
      </section>
      {(day.wins > 0 || day.losses > 0) && <p className="rv-foot">Outcomes recorded: {day.wins} win{day.wins === 1 ? '' : 's'}, {day.losses} setback{day.losses === 1 ? '' : 's'}. Details stay in Matt&rsquo;s private log.</p>}
    </>
  );
}

export function DaySheet({ view, days, loading, onClose, onDay }: { view: SheetView; days: Day[] | null; loading: boolean; onClose: () => void; onDay: (date: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<Element | null>(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; (prevFocus.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);
  const current = (days ?? []).filter(d => d.period !== 'previous');
  const idx = view.kind === 'day' ? (days ?? []).findIndex(d => d.date === view.date) : -1;
  const day = idx >= 0 ? days![idx] : null;
  const metric = view.kind === 'metric' ? METRICS[view.metric] : null;
  const max = metric ? Math.max(1, ...current.map(d => metric.raw(d) ?? 0)) : 1;
  return (
    <div className="rv-sheet-wrap" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rv-sheet" role="dialog" aria-modal="true" aria-labelledby="rv-sheet-title" tabIndex={-1} ref={ref}>
        <header className="rv-sheet-head">
          <div>
            <div className="rv-kicker">{view.kind === 'day' ? 'Day detail' : 'Breakdown'}</div>
            <h2 id="rv-sheet-title">{view.kind === 'day' ? longDate(view.date) : metric!.title}</h2>
          </div>
          <div className="rv-sheet-nav">
            {view.kind === 'day' && <>
              <button className="rv-icon-btn" aria-label="Previous day" disabled={idx <= 0} onClick={() => onDay(days![idx - 1].date)}><svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" /></svg></button>
              <button className="rv-icon-btn" aria-label="Next day" disabled={idx < 0 || idx >= days!.length - 1} onClick={() => onDay(days![idx + 1].date)}><svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" /></svg></button>
            </>}
            <button className="rv-icon-btn" aria-label="Close" onClick={onClose}><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>
          </div>
        </header>
        <div className="rv-sheet-body">
          {loading && !days ? <div className="rv-sheet-loading" aria-live="polite"><span /><span /><span /></div>
            : view.kind === 'day' ? (day ? <DayBody day={day} /> : <Empty>This day is outside the selected window.</Empty>)
              : <ul className={`rv-metric-list rv-s-${metric!.section}`}>{[...current].reverse().map(d => {
                  const v = metric!.raw(d);
                  return <li key={d.date}><button onClick={() => onDay(d.date)}>
                    <span className="rv-ml-date">{longDate(d.date)}</span>
                    <span className="rv-ml-bar"><span style={{ width: v === null ? 0 : `${Math.max(3, (100 * v) / max)}%` }} /></span>
                    <span className="rv-ml-val">{metric!.value(d)}</span>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
                  </button></li>;
                })}</ul>}
        </div>
      </div>
    </div>
  );
}
