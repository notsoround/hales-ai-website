/** Noir chart kit for the account app: a dial, a touchable trend line, touchable bars and a sparkline.
 *  Pure SVG, coloured from CSS custom properties (--nx-a accent, --nx-a2 second tone), so Cupcake and Matthieu theme them for free.
 *  Every chart can be scrubbed with a finger, a mouse or the arrow keys, and states its summary to screen readers. */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { monotonePath } from '../metabolicSeries';
import './noir-charts.css';

/** Width of the chart's container, tracked with ResizeObserver. */
export function useBoxWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => { const w = Math.round(el.clientWidth); if (w > 0) setWidth(w); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const niceStep = (span: number, count: number) => { const raw = span / Math.max(1, count), mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag; return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag; };

/** 270° gauge that drains: the lit arc is what is left of `target` after `value`, read against a labelled scale.
 *  `pace` (0..1 of target expected to be used by now) draws a notch outside the arc; overshoot shows as a warm arc from zero. */
export function Dial({ value, target, label, children, size = 300, pace = null, scale = [] }: { value: number; target: number; label: string; children?: ReactNode; size?: number; pace?: number | null; scale?: string[] }) {
  const id = useId().replace(/:/g, '');
  const R = size * 0.385, cx = size / 2, cy = size / 2, start = 225, sweep = 270, sw = size * 0.032;
  const left = target > 0 ? clamp(1 - value / target, 0, 1) : 0, over = target > 0 ? clamp(value / target - 1, 0, 1) : 0;
  const pt = (a: number, r = R) => { const rad = (a - 90) * Math.PI / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const; };
  const arc = (a0: number, a1: number) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0.toFixed(2)},${y0.toFixed(2)}A${R},${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };
  const len = 2 * Math.PI * R * (sweep * left / 360);
  const ticks = useMemo(() => Array.from({ length: 85 }, (_, i) => {
    const a = start + sweep * i / 84, kind = i % 28 === 0 ? 'is-major' : i % 7 === 0 ? 'is-mid' : '', r0 = R - size * 0.05, [x0, y0] = pt(a, r0), [x1, y1] = pt(a, r0 - size * (kind === 'is-major' ? 0.03 : kind ? 0.02 : 0.011));
    return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={`nx-tick ${kind}`} />;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [size]);
  const [hx, hy] = pt(start + sweep * left);
  const notch = pace !== null && target > 0 ? start + sweep * clamp(1 - pace, 0, 1) : null;
  const h = size * 0.86;
  return <div className="nx-dial" role="img" aria-label={label}>
    <svg viewBox={`0 0 ${size} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1={size * 0.12} y1={size * 0.85} x2={size * 0.88} y2={size * 0.12}><stop offset="0" stopColor="var(--nx-a2)" /><stop offset="1" stopColor="var(--nx-a)" /></linearGradient>
        <filter id={`${id}b`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={size * 0.028} /></filter>
      </defs>
      {ticks}
      {scale.map((text, i) => { const [x, y] = pt(start + sweep * i / Math.max(1, scale.length - 1), R + size * 0.072); return <text key={i} x={x} y={y + 3} textAnchor="middle" className="nx-dial-scale">{text}</text>; })}
      <path d={arc(start, start + sweep)} className="nx-dial-track" strokeWidth={sw} />
      {left > 0.004 && <>
        <path d={arc(start, start + sweep * left)} stroke={`url(#${id}g)`} strokeWidth={sw} className="nx-dial-glow" filter={`url(#${id}b)`} />
        <path d={arc(start, start + sweep * left)} stroke={`url(#${id}g)`} strokeWidth={sw} className="nx-dial-fill nx-draw" style={{ ['--nx-len' as string]: len }} />
      </>}
      {over > 0.004 && <path d={arc(start, start + sweep * over)} strokeWidth={sw} className="nx-dial-over" />}
      {notch !== null && (() => { const [x0, y0] = pt(notch, R + size * 0.028), [x1, y1] = pt(notch, R + size * 0.05); return <line x1={x0} y1={y0} x2={x1} y2={y1} className="nx-dial-pace" />; })()}
      {target > 0 && <><circle cx={hx} cy={hy} r={size * 0.027} className="nx-dial-head-ring" /><circle cx={hx} cy={hy} r={size * 0.015} className="nx-dial-head" /></>}
    </svg>
    <div className="nx-dial-centre">{children}</div>
  </div>;
}

export function Spark({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 100, h = 24, lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => ({ x: i * w / (values.length - 1), y: h - 3 - (v - lo) / span * (h - 6) }));
  const last = pts[pts.length - 1]!;
  return <svg className={`nx-spark ${className || ''}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
    <path d={monotonePath(pts)} vectorEffect="non-scaling-stroke" />
    <circle cx={last.x} cy={last.y} r="2.2" />
  </svg>;
}

export type TrendPoint = { t: number; v: number; label?: string };
type Readout = { x: number; y: number; title: string; value: string };

/** Scrubbing shared by line and bar charts: pointer and keyboard pick an index; the readout follows it. */
function useScrub(count: number) {
  const [index, setIndex] = useState<number | null>(null);
  const onKey = useCallback((e: KeyboardEvent) => {
    if (!count) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setIndex(i => clamp((i ?? count - 1) + (e.key === 'ArrowLeft' ? -1 : 1), 0, count - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setIndex(count - 1); }
    else if (e.key === 'Escape') setIndex(null);
  }, [count]);
  return { index, setIndex, onKey };
}

function ReadoutTag({ r, width }: { r: Readout | null; width: number }) {
  if (!r) return null;
  const left = clamp(r.x, 52, width - 52);
  return <div className="nx-readout" style={{ left, top: Math.max(0, r.y - 50) }} aria-hidden="true"><b>{r.value}</b><span>{r.title}</span></div>;
}

/** A trend line over time. Optional 7-point rolling average (raw readings become faint dots), goal line, target band and markers. */
export function TrendChart({ points, height = 180, average, goal, band, unit, formatValue = v => v.toFixed(1), formatTime, axisTimes, label, live, markers = [], className, tone = 'a', scatter = false }: {
  points: TrendPoint[]; height?: number; average?: number; goal?: { value: number; label: string }; band?: [number, number]; unit: string;
  formatValue?: (v: number) => string; formatTime: (t: number) => string; axisTimes: { t: number; label: string }[]; label: string; live?: boolean;
  markers?: { t: number; label: string }[]; className?: string; tone?: 'a' | 'a2'; scatter?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const [box, W] = useBoxWidth<HTMLDivElement>(340);
  const pad = { l: 36, r: 14, t: 18, b: 24 }, iw = Math.max(10, W - pad.l - pad.r), ih = height - pad.t - pad.b;
  const sorted = useMemo(() => [...points].sort((a, b) => a.t - b.t), [points]);
  const smoothed = useMemo(() => average && sorted.length > 2 ? sorted.map((p, i) => { const s = sorted.slice(Math.max(0, i - average + 1), i + 1); return { ...p, v: s.reduce((a, b) => a + b.v, 0) / s.length }; }) : sorted, [sorted, average]);
  const t0 = Math.min(...axisTimes.map(a => a.t), ...sorted.map(p => p.t)), t1 = Math.max(...axisTimes.map(a => a.t), ...sorted.map(p => p.t));
  const values = [...sorted.map(p => p.v), ...(goal ? [goal.value] : []), ...(band || [])];
  const rawLo = Math.min(...values), rawHi = Math.max(...values), step = niceStep(Math.max(1, rawHi - rawLo), 3);
  const lo = Math.floor((rawLo - step * 0.2) / step) * step, hi = Math.ceil((rawHi + step * 0.2) / step) * step;
  const x = (t: number) => pad.l + (t1 > t0 ? (t - t0) / (t1 - t0) : 1) * iw, y = (v: number) => pad.t + ih - (v - lo) / (hi - lo || 1) * ih;
  const line = smoothed.map(p => ({ x: x(p.t), y: y(p.v) }));
  const d = monotonePath(line), last = line[line.length - 1];
  const { index, setIndex, onKey } = useScrub(sorted.length);
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (!sorted.length) return;
    const rect = e.currentTarget.getBoundingClientRect(), px = e.clientX - rect.left;
    let best = 0; for (let i = 1; i < line.length; i++) if (Math.abs(line[i]!.x - px) < Math.abs(line[best]!.x - px)) best = i;
    setIndex(best);
  };
  const ticks: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  const active = index !== null ? { p: sorted[index]!, s: smoothed[index]!, pt: line[index]! } : null;
  const readout: Readout | null = active ? { x: active.pt.x, y: active.pt.y, title: active.p.label || formatTime(active.p.t), value: `${formatValue(average ? active.s.v : active.p.v)} ${unit}` } : null;
  if (!sorted.length) return null;
  return <div ref={box} className={`nx-chart nx-tone-${tone} ${className || ''}`} tabIndex={0} role="img" aria-label={label} onKeyDown={onKey}
    onPointerMove={pick} onPointerDown={pick} onPointerLeave={e => { if (e.pointerType === 'mouse') setIndex(null); }} onBlur={() => setIndex(null)}>
    <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} aria-hidden="true">
      <defs><linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="nx-fill-top" /><stop offset="1" className="nx-fill-bottom" /></linearGradient></defs>
      {band && <rect x={pad.l} y={y(band[1])} width={iw} height={Math.max(0, y(band[0]) - y(band[1]))} className="nx-band" />}
      {ticks.map(v => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="nx-grid" /><text x={pad.l - 8} y={y(v) + 3.5} textAnchor="end" className="nx-axis">{formatValue(v).replace(/\.0$/, '')}</text></g>)}
      {axisTimes.map((a, i) => <text key={a.t} x={x(a.t)} y={height - 6} textAnchor={i === 0 ? 'start' : i === axisTimes.length - 1 ? 'end' : 'middle'} className="nx-axis">{a.label}</text>)}
      {goal && <><line x1={pad.l} x2={W - pad.r} y1={y(goal.value)} y2={y(goal.value)} className="nx-goal" /><text x={W - pad.r} y={y(goal.value) - 6} textAnchor="end" className="nx-goal-label">{goal.label}</text></>}
      {markers.map(m => <g key={m.t} className="nx-marker"><line x1={x(m.t)} x2={x(m.t)} y1={pad.t} y2={pad.t + ih} /><circle cx={x(m.t)} cy={pad.t} r="3.5" /><title>{m.label}</title></g>)}
      {!scatter && line.length > 1 && <path d={`${d}L${last!.x},${pad.t + ih}L${line[0]!.x},${pad.t + ih}Z`} fill={`url(#${id}f)`} />}
      {average && sorted.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r="1.7" className="nx-raw" />)}
      {scatter && line.length > 1 ? <path d={d} className="nx-thread" /> : null}
      {!scatter && line.length > 1 ? <path d={d} className="nx-line nx-draw" style={{ ['--nx-len' as string]: W * 2 }} /> : null}
      {scatter ? line.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.4" className={`nx-point${band && (sorted[i]!.v < band[0] || sorted[i]!.v > band[1]) ? ' is-out' : ''}`} style={{ ['--i' as string]: i }} />)
        : !average && line.length < 40 && line.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.6" className="nx-point" />)}
      {last && !active && <>{live && <circle cx={last.x} cy={last.y} r="10" className="nx-pulse" />}<circle cx={last.x} cy={last.y} r="4.5" className="nx-head" /></>}
      {active && <><line x1={active.pt.x} x2={active.pt.x} y1={pad.t} y2={pad.t + ih} className="nx-cursor" /><circle cx={active.pt.x} cy={active.pt.y} r="5" className="nx-head" /></>}
    </svg>
    <ReadoutTag r={readout} width={W} />
  </div>;
}

export type Bar = { key: string; label: string; value: number | null; title?: string };
/** Vertical bars with an optional target line. Bars over target turn warm; days without data show as a faint stub. */
export function BarChart({ bars, height = 150, target, unit, formatValue = v => Math.round(v).toLocaleString('en-US'), axis, label, className }: {
  bars: Bar[]; height?: number; target?: number | null; unit: string; formatValue?: (v: number) => string; axis: { index: number; label: string }[]; label: string; className?: string;
}) {
  const [box, W] = useBoxWidth<HTMLDivElement>(340);
  const pad = { l: 36, r: 10, t: 14, b: 22 }, iw = Math.max(10, W - pad.l - pad.r), ih = height - pad.t - pad.b;
  const max = Math.max(1, ...bars.map(b => b.value || 0), target || 0) * 1.08, step = niceStep(max, 2);
  const y = (v: number) => pad.t + ih - v / max * ih, bw = iw / Math.max(1, bars.length), gap = bw * 0.52;
  const { index, setIndex, onKey } = useScrub(bars.length);
  const pick = (e: PointerEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); setIndex(clamp(Math.floor((e.clientX - rect.left - pad.l) / bw), 0, bars.length - 1)); };
  const active = index !== null ? bars[index] : null;
  const readout: Readout | null = active && index !== null ? { x: pad.l + index * bw + bw / 2, y: active.value ? y(active.value) : pad.t + ih, title: active.title || active.label, value: active.value === null ? 'Not logged' : `${formatValue(active.value)} ${unit}` } : null;
  const ticks: number[] = []; for (let v = step; v < max; v += step) if (!target || Math.abs(v - target) > step * 0.4) ticks.push(v);
  return <div ref={box} className={`nx-chart ${className || ''}`} tabIndex={0} role="img" aria-label={label} onKeyDown={onKey}
    onPointerMove={pick} onPointerDown={pick} onPointerLeave={e => { if (e.pointerType === 'mouse') setIndex(null); }} onBlur={() => setIndex(null)}>
    <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} aria-hidden="true">
      {ticks.map(v => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="nx-grid" /><text x={pad.l - 8} y={y(v) + 3.5} textAnchor="end" className="nx-axis">{v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : formatValue(v)}</text></g>)}
      {bars.map((b, i) => {
        const x0 = pad.l + i * bw + gap / 2, w = Math.max(1, bw - gap);
        if (b.value === null) return <circle key={b.key} cx={x0 + w / 2} cy={pad.t + ih - 3} r="1.6" className="nx-bar-missing" />;
        const top = y(b.value), base = pad.t + ih, capped = target && b.value > target ? y(target) : top, state = `${index === i ? ' is-active' : ''}${index !== null && index !== i ? ' is-dim' : ''}`;
        return <g key={b.key} className={`nx-bar-g${state}`} style={{ ['--i' as string]: i }}>
          <rect x={x0} y={capped} width={w} height={Math.max(1, base - capped)} rx={w / 2} className={`nx-bar${i === bars.length - 1 ? ' is-now' : ''}`} />
          {capped !== top && <rect x={x0} y={top} width={w} height={Math.max(1, capped - top - 2)} rx={Math.min(w / 2, (capped - top - 2) / 2)} className="nx-bar is-over" />}
        </g>;
      })}
      {target ? <><line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="nx-target" /><text x={pad.l - 8} y={y(target) + 3.5} textAnchor="end" className="nx-axis nx-target-label">{target >= 1000 ? `${(target / 1000).toFixed(1)}k` : formatValue(target)}</text></> : null}
      {axis.map((a, i) => <text key={a.index} x={pad.l + a.index * bw + bw / 2} y={height - 6} textAnchor={i === 0 && a.index === 0 ? 'start' : i === axis.length - 1 && a.index === bars.length - 1 ? 'end' : 'middle'} className="nx-axis">{a.label}</text>)}
    </svg>
    <ReadoutTag r={readout} width={W} />
  </div>;
}
