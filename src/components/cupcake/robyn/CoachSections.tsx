import { useState } from 'react';
import type { Checkin, Coach, CoreField, Day } from './viewerApi.ts';
import { adherence, dailyActuals, fmt, longDate, shortDate } from './viewerApi.ts';

const DAYMS = 86400000;
const t = (iso: string) => Date.parse(iso + 'T12:00:00Z');
const FLAG_TEXT = { entry_error: 'Likely entry error', repeated_value: 'Repeated value' } as const;

function Card({ title, kicker, tone, sample, aside, children, wide }: { title: string; kicker: string; tone: string; sample?: boolean; aside?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`rv-card rv-section rv-toned rv-s-${tone}${wide ? ' rv-wide' : ''}${sample ? ' rv-sample' : ''}`}>
      {sample && <span className="rv-watermark" aria-label="Sample data">Sample</span>}
      <header className="rv-section-head"><div><div className="rv-kicker"><i className="rv-sdot" />{kicker}</div><h2>{title}</h2></div>{aside}</header>
      {children}
    </section>
  );
}

/** Smooth (monotone-ish Catmull-Rom) path through points. */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const k = 0.18;
    d += ` C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function Trend({ rows, field, unit, digits = 1, height = 150, compact = false, label }: { rows: Checkin[]; field: CoreField; unit: string; digits?: number; height?: number; compact?: boolean; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const all = rows.filter(r => r[field] !== null).map(r => ({ date: r.date, v: r[field] as number, flag: r.flags[field] }));
  const good = all.filter(p => !p.flag);
  if (!good.length) return <p className="rv-empty">No {label.toLowerCase()} readings.</p>;
  const W = 360, H = height, top = 14, bottom = compact ? 16 : 22, left = 4, right = 8;
  const lo0 = Math.min(...good.map(p => p.v)), hi0 = Math.max(...good.map(p => p.v)), pad = Math.max(0.4, (hi0 - lo0) * 0.25);
  const lo = lo0 - pad, hi = hi0 + pad;
  const x0 = t(all[0].date), x1 = t(all[all.length - 1].date) || x0 + DAYMS;
  const x = (iso: string) => left + (W - left - right) * (x1 === x0 ? 0.5 : (t(iso) - x0) / (x1 - x0));
  const y = (v: number) => top + (H - top - bottom) * (1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo));
  const path = smooth(good.map(p => [x(p.date), y(p.v)]));
  const area = path && `${path} L${x(good[good.length - 1].date)},${H - bottom} L${x(good[0].date)},${H - bottom} Z`;
  const h = hover === null ? null : all[hover];
  const id = `g-${field}-${compact ? 'c' : 'f'}`;
  return (
    <figure className="rv-chart" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} from ${good[0].v} to ${good[good.length - 1].v} ${unit}`} onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--c-bar)" stopOpacity=".28" /><stop offset="1" stopColor="var(--c-bar)" stopOpacity="0" /></linearGradient></defs>
        {!compact && [lo0, hi0].map(v => <g key={v}><line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className="rv-grid" /><text x={W - right} y={y(v) - 4} textAnchor="end" className="rv-tick">{v.toFixed(digits)}</text></g>)}
        {area && <path d={area} fill={`url(#${id})`} />}
        {path && <path d={path} className="rv-line rv-line-smooth" />}
        {all.map((p, i) => p.flag
          ? <g key={p.date} className="rv-flag-pt" tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} aria-label={`${longDate(p.date)}: ${p.v} ${unit}, ${FLAG_TEXT[p.flag]}, excluded from the trend`}>
              <circle cx={x(p.date)} cy={y(p.v)} r={4.5} /><path d={`M${x(p.date) - 2.2},${y(p.v) - 2.2}l4.4,4.4m0,-4.4l-4.4,4.4`} /></g>
          : <circle key={p.date} cx={x(p.date)} cy={y(p.v)} r={hover === i ? 5.5 : compact ? 2.8 : 3.8} className="rv-point" tabIndex={0}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} aria-label={`${longDate(p.date)}: ${p.v} ${unit}`} />)}
        {!compact && <><text x={left} y={H - 6} className="rv-tick">{shortDate(all[0].date)}</text><text x={W - right} y={H - 6} textAnchor="end" className="rv-tick">{shortDate(all[all.length - 1].date)}</text></>}
      </svg>
      {h && <div className="rv-tip" style={{ left: `${(x(h.date) / W) * 100}%` }} role="status"><div className="rv-tip-date">{longDate(h.date)}</div>
        <div>{h.v.toFixed(digits)} {unit}</div>{h.flag && <div className="rv-tip-prev">{FLAG_TEXT[h.flag]} · excluded from trend</div>}</div>}
    </figure>
  );
}

/** Semicircle gauge with general reference bands. */
function Gauge({ value, label, sub, flag }: { value: number | null; label: string; sub: string; flag?: 'entry_error' | 'repeated_value' }) {
  const bands = [[0, 14, 'rv-band-a'], [14, 18, 'rv-band-b'], [18, 25, 'rv-band-c'], [25, 32, 'rv-band-d'], [32, 45, 'rv-band-e']] as const;
  const min = 0, max = 45, R = 52, cx = 64, cy = 62;
  const pt = (v: number, r = R) => { const a = Math.PI * (1 - (Math.min(Math.max(v, min), max) - min) / (max - min)); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const arc = (a: number, b: number) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`; };
  const [nx, ny] = value === null ? [cx, cy] : pt(value, R - 14);
  return (
    <div className={`rv-gauge${flag ? ' rv-gauge-flag' : ''}`}>
      <svg viewBox="0 0 128 74" role="img" aria-label={`${label}: ${value === null ? 'no reading' : value + '%'}${flag ? ', ' + FLAG_TEXT[flag] : ''}`}>
        {bands.map(([a, b, c]) => <path key={c} d={arc(a + 0.25, b - 0.25)} className={`rv-band ${c}`} />)}
        {value !== null && <><line x1={cx} y1={cy} x2={nx} y2={ny} className="rv-needle" /><circle cx={cx} cy={cy} r={3.5} className="rv-needle-hub" /></>}
      </svg>
      <div className="rv-gauge-val">{value === null ? '—' : `${fmt(value, 1)}%`}</div>
      <div className="rv-label">{label}</div>
      <div className="rv-sub">{flag ? <span className="rv-flag-chip">{FLAG_TEXT[flag]}</span> : sub}</div>
    </div>
  );
}

function Chip({ label, change, unit, since }: { label: string; change: number | undefined; unit: string; since: string }) {
  if (change === undefined) return null;
  return <span className={`rv-dchip ${change < 0 ? 'rv-dchip-down' : change > 0 ? 'rv-dchip-up' : ''}`}><b>{change > 0 ? '+' : change < 0 ? '−' : ''}{fmt(Math.abs(change), 1)}{unit}</b> {label} since {since}</span>;
}

export function BodySection({ coach }: { coach: Coach }) {
  const rows = coach.checkins.filter(r => r.source === 'robyn_peck_app');
  if (!rows.length) return null;
  const d = coach.derived;
  const first = d.first ? shortDate(d.first) : '';
  const bf = rows.filter(r => r.body_fat_pct !== null);
  const bfGood = bf.filter(r => !r.flags.body_fat_pct);
  const bfLatest = bf[bf.length - 1];
  const groups = new Map<string, { f: string; k: 'entry_error' | 'repeated_value'; dates: string[]; v: number | null }>();
  rows.forEach(r => Object.entries(r.flags).forEach(([f, k]) => {
    const key = `${f}|${k}`; const g = groups.get(key) ?? { f, k: k!, dates: [], v: (r as unknown as Record<string, number | null>)[f] ?? null };
    g.dates.push(r.date); groups.set(key, g);
  }));
  const NAMES: Record<string, string> = { weight_lb: 'weight', neck_in: 'neck', waist_in: 'waist', hips_in: 'hips', body_fat_pct: 'body fat' };
  const flagged = [...groups.values()].map(g => g.k === 'repeated_value' && g.dates.length > 1
    ? `${NAMES[g.f] ?? g.f} ${g.v ?? ''}${g.f === 'body_fat_pct' ? '%' : ''} repeated ${shortDate(g.dates[0])} – ${shortDate(g.dates[g.dates.length - 1])} (${g.dates.length} check-ins)`
    : `${g.dates.map(shortDate).join(', ')} ${NAMES[g.f] ?? g.f} ${g.v ?? ''}${g.f === 'body_fat_pct' ? '%' : g.f.endsWith('_in') ? '″' : ''} (${FLAG_TEXT[g.k].toLowerCase()})`);
  return (
    <>
      <Card title="Body" kicker="Check-ins · Robyn Peck app" tone="weight" sample={coach.sample} wide
        aside={<div className="rv-dchips"><Chip label="weight" change={d.deltas.weight_lb?.change} unit=" lb" since={first} /><Chip label="waist" change={d.deltas.waist_in?.change} unit="″" since={first} /></div>}>
        <div className="rv-body-grid">
          <div>
            <div className="rv-body-head"><span className="rv-label">Weight</span><strong>{fmt(d.deltas.weight_lb?.latest.value ?? rows[rows.length - 1].weight_lb, 1)}<small> lb</small></strong>
              <span className="rv-sub">from {fmt(d.deltas.weight_lb?.first.value, 1)} lb on {first}</span></div>
            <Trend rows={rows} field="weight_lb" unit="lb" label="Weight at check-ins" />
          </div>
          <div>
            <div className="rv-body-head"><span className="rv-label">Waist</span><strong>{fmt(d.deltas.waist_in?.latest.value, 1)}<small> in</small></strong>
              <span className="rv-sub">from {fmt(d.deltas.waist_in?.first.value, 1)} in on {first}</span></div>
            <Trend rows={rows} field="waist_in" unit="in" label="Waist at check-ins" />
          </div>
        </div>
        <div className="rv-multiples">
          {(['neck_in', 'waist_in', 'hips_in'] as const).map(f => {
            const s = rows.filter(r => r[f] !== null && !r.flags[f]);
            const ch = s.length > 1 ? (s[s.length - 1][f] as number) - (s[0][f] as number) : null;
            return <div key={f} className="rv-multiple"><div className="rv-multiple-head"><span className="rv-label">{{ neck_in: 'Neck', waist_in: 'Waist', hips_in: 'Hips' }[f]}</span>
              <span className="rv-multiple-val">{s.length ? `${fmt(s[s.length - 1][f], 1)}″` : '—'}{ch !== null && <em>{ch > 0 ? '+' : ch < 0 ? '−' : ''}{fmt(Math.abs(ch), 1)}</em>}</span></div>
              <Trend rows={rows} field={f} unit="in" height={70} compact label={`${f.split('_')[0]} trend`} /></div>;
          })}
        </div>
        <div className="rv-gauges">
          <Gauge value={bfGood[0]?.body_fat_pct ?? null} label="Body fat · first reliable" sub={bfGood[0] ? shortDate(bfGood[0].date) : 'no reading'} />
          <Gauge value={bfLatest?.body_fat_pct ?? null} label="Body fat · latest" sub={bfLatest ? shortDate(bfLatest.date) : 'no reading'} flag={bfLatest?.flags.body_fat_pct} />
          <div className="rv-band-key"><span className="rv-label">General reference ranges</span>
            {[['rv-band-a', '< 14%'], ['rv-band-b', '14–18%'], ['rv-band-c', '18–25%'], ['rv-band-d', '25–32%'], ['rv-band-e', '> 32%']].map(([c, l]) => <span key={c}><i className={`rv-band-sw ${c}`} />{l}</span>)}
            <span className="rv-sub">For orientation only; tape and scale estimates vary.</span></div>
        </div>
        {flagged.length > 0 && <p className="rv-foot rv-flag-foot"><span className="rv-flag-ico" aria-hidden="true" />Marked readings are shown but left out of trend lines and changes:{' '}
          {flagged.join('; ')}.</p>}
      </Card>
    </>
  );
}

export function CheckinsCard({ coach }: { coach: Coach }) {
  const rows = coach.checkins.filter(r => r.source === 'robyn_peck_app');
  if (!rows.length) return null;
  const d = coach.derived;
  const prog = coach.program;
  const pct = prog ? Math.min(100, Math.max(0, (100 * (Date.now() - t(prog.start))) / (t(prog.end) - t(prog.start)))) : 0;
  const span0 = t(rows[0].date), span1 = d.next_due ? t(d.next_due) : t(rows[rows.length - 1].date);
  const pos = (iso: string) => `${(100 * (t(iso) - span0)) / Math.max(DAYMS, span1 - span0)}%`;
  return (
    <Card title="Check-ins" kicker="Timeline" tone="weight" sample={coach.sample}
        aside={d.next_due && <span className="rv-next">Next due ~{shortDate(d.next_due)}</span>}>
        <div className="rv-timeline" role="list">
          <div className="rv-tl-line" />
          {rows.map(r => <span key={r.date} role="listitem" className={`rv-tl-dot${Object.values(r.flags).includes('entry_error') ? ' rv-tl-flag' : ''}`} style={{ left: pos(r.date) }} title={`${longDate(r.date)}${r.weight_lb ? ` · ${r.weight_lb} lb` : ''}`}><em>{shortDate(r.date)}</em></span>)}
          {d.next_due && <span className="rv-tl-dot rv-tl-next" style={{ left: '100%' }} role="listitem"><em>{shortDate(d.next_due)}</em></span>}
        </div>
        <Stats2 items={[['Check-ins', String(d.count)], ['Last', d.latest ? shortDate(d.latest) : '—'], ['Every', '~7 days']]} />
        {prog && <div className="rv-program">
          <div className="rv-program-head"><span className="rv-label">Plan</span><strong>{prog.name}</strong><span className="rv-sub">{shortDate(prog.start)}, {prog.start.slice(0, 4)} – {shortDate(prog.end)}, {prog.end.slice(0, 4)}{prog.coach ? ` · Coach ${prog.coach}` : ''}</span></div>
          <div className="rv-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Plan elapsed"><span style={{ width: `${pct}%` }} /></div>
          <span className="rv-sub">{Math.round(pct)}% of the plan period elapsed</span>
        </div>}
      </Card>
  );
}

function Stats2({ items }: { items: [string, string][] }) {
  return <dl className="rv-stats">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function Ring({ value, target, label, unit, tone, digits = 0, note }: { value: number | null; target: number | undefined; label: string; unit: string; tone: string; digits?: number; note?: string }) {
  if (target === undefined) return null;
  const r = 34, c = 2 * Math.PI * r;
  const f = value === null ? 0 : value / target;
  const over = f > 1.05;
  return (
    <div className={`rv-ring rv-s-${tone}${value === null ? ' rv-ring-none' : ''}`}>
      <svg viewBox="0 0 84 84" role="img" aria-label={`${label}: ${value === null ? 'not tracked' : `${fmt(value, digits)} of ${fmt(target)} ${unit}`}`}>
        <circle cx="42" cy="42" r={r} className="rv-ring-track" />
        {value !== null && <circle cx="42" cy="42" r={r} className="rv-ring-fill" strokeDasharray={`${Math.min(1, f) * c} ${c}`} transform="rotate(-90 42 42)" />}
        {over && <circle cx="42" cy="42" r={r} className="rv-ring-over" strokeDasharray={`${Math.min(1, f - 1) * c} ${c}`} transform="rotate(-90 42 42)" />}
        <text x="42" y="40" textAnchor="middle" className="rv-ring-pct">{value === null ? '—' : `${Math.round(f * 100)}%`}</text>
        <text x="42" y="54" textAnchor="middle" className="rv-ring-sub">{value === null ? 'not tracked' : 'of target'}</text>
      </svg>
      <div className="rv-label">{label}</div>
      <div className="rv-ring-nums">{value === null ? <span className="rv-sub">{note ?? 'Not tracked in Cupcake'}</span> : <><b>{fmt(value, digits)}</b> / {fmt(target)} {unit}</>}</div>
    </div>
  );
}

export function PlanVsActual({ coach, days }: { coach: Coach; days: Day[] }) {
  const tg = coach.targets;
  if (!tg) return null;
  const a = dailyActuals(days);
  return (
    <Card title="Plan vs actual" kicker="Daily targets" tone="food" sample={coach.sample} wide aside={<span className="rv-sub rv-hint">Average per logged day · {a.days} days with meals</span>}>
      <div className="rv-rings">
        <Ring label="Calories" value={a.kcal} target={tg.kcal} unit="kcal" tone="food" />
        <Ring label="Protein" value={a.protein_g} target={tg.protein_g} unit="g" tone="food" />
        <Ring label="Fat" value={a.fat_g} target={tg.fat_g} unit="g" tone="food" />
        <Ring label="Carbs" value={a.carbs_g} target={tg.carbs_g} unit="g" tone="food" />
        <Ring label="Steps" value={a.steps} target={tg.steps} unit="" tone="steps" />
        <Ring label="Water" value={null} target={tg.water_fl_oz} unit="fl oz" tone="sleep" note={`Target ${fmt(tg.water_fl_oz)} fl oz · not tracked`} />
      </div>
      <p className="rv-foot">Targets from Robyn&rsquo;s plan; actuals from Cupcake logs. Calorie and macro figures are estimates, and days without meals are left out.</p>
    </Card>
  );
}

export function WorkoutGrid({ coach, days, onDay }: { coach: Coach; days: Day[]; onDay: (d: string) => void }) {
  if (!coach.workout_template) return null;
  const rows = adherence(coach.workout_template, days);
  const planned = rows.filter(r => r.planned > 0);
  const hit = planned.filter(r => r.state === 'done').length;
  const weeks: typeof rows[] = [];
  rows.forEach((r, i) => { if (i % 7 === 0) weeks.push([]); weeks[weeks.length - 1].push(r); });
  const ICON = { done: '✓', partial: '◐', missed: '', rest: '', extra: '+' };
  return (
    <Card title="Assigned vs done" kicker="Workouts" tone="exercise" sample={coach.sample} wide aside={<span className="rv-next">{hit} of {planned.length} planned days completed</span>}>
      <div className="rv-wgrid" role="table" aria-label="Assigned workouts against logged workouts">
        {weeks.map((w, wi) => <div key={wi} className="rv-wrow" role="row">{w.map(r => (
          <button key={r.date} role="cell" className={`rv-wcell rv-w-${r.state}`} onClick={() => onDay(r.date)}
            aria-label={`${longDate(r.date)}: assigned ${r.assigned.map(x => `${x.name} ${x.minutes} min`).join(' and ') || 'rest'}; logged ${r.done} min`}>
            <span className="rv-wday">{new Date(r.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} <b>{Number(r.date.slice(8))}</b></span>
            <span className="rv-wmark" aria-hidden="true">{ICON[r.state]}</span>
            <span className="rv-wplan">{r.assigned.length ? r.assigned.map(x => <span key={x.name}>{x.name} · {x.minutes}′</span>) : <span>Rest</span>}</span>
            <span className="rv-wdone">{r.done ? `${fmt(r.done)} min logged` : r.planned ? 'Not logged' : ''}</span>
          </button>))}</div>)}
      </div>
      <div className="rv-wlegend"><span><i className="rv-w-done" />Done (≥80% of planned minutes)</span><span><i className="rv-w-partial" />Partial</span><span><i className="rv-w-missed" />Not logged</span></div>
    </Card>
  );
}

export function MealPlanCard({ coach }: { coach: Coach }) {
  const mp = coach.meal_plan;
  if (!mp) return null;
  const total = mp.meals.reduce((a, m) => a + m.kcal, 0);
  return (
    <Card title={mp.title ?? 'Meal plan · reference day'} kicker="Nutrition plan" tone="food" sample={coach.sample} aside={<span className="rv-next">{fmt(total)} kcal</span>}>
      <ol className="rv-mealplan">{mp.meals.map(m => (
        <li key={m.name}><div className="rv-mp-head"><strong>{m.name}</strong><span>{fmt(m.kcal)} kcal</span></div>
          <div className="rv-mp-bar"><span style={{ width: `${(100 * m.kcal) / Math.max(...mp.meals.map(x => x.kcal))}%` }} /></div>
          <p>{m.items.join(' · ')}</p></li>))}</ol>
      {mp.notes && mp.notes.length > 0 && <div className="rv-mp-notes"><div className="rv-label">Notes from Robyn</div><ul>{mp.notes.map(n => <li key={n}>{n}</li>)}</ul></div>}
    </Card>
  );
}
