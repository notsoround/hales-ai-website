/** Today's multi-ring instrument. Several readings share one 270° dial: the selected one is the wide outer arc with its scale
 *  and the big number; the others stay as thin arcs just inside it. Tap the dial to move to the next reading, or pick one from
 *  the row beneath. Touching an arc is different from tapping the middle: the arc swells under the finger, comes to the front if it
 *  was a thin one, and opens a tray of facts with the way into its full page. Each arc shows progress on its own scale. A reading with no data keeps its faint track only. */
import { useId, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { DialState } from './metricProgress';
import './noir-multidial.css';

type DialTone = 'cal' | 'fast' | 'glucose' | 'sleep';
export type DialMetric = {
  key: DialTone; label: string; tone: DialTone;
  /** 0..1 of the arc to light. null = no data: the ring stays a faint track. */
  fraction: number | null;
  state: DialState;
  /** Overshoot arc from zero (calories over target). */
  over?: number;
  /** 0..1 position of a pace notch outside the arc. */
  notch?: number | null;
  scale: string[]; eyebrow: string; value: string; unit?: string; detail: ReactNode; chip: string;
  spoken: string; drill: { label: string; run: () => void };
  /** A few plain facts shown in the tray when the arc is touched. */
  facts: { k: string; v: string }[];
};

const START = 225, SWEEP = 270;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function MultiDial({ metrics, selected, onSelect, size = 300 }: { metrics: DialMetric[]; selected: DialTone; onSelect: (key: DialTone) => void; size?: number }) {
  const id = useId().replace(/:/g, '');
  const R = size * 0.385, cx = size / 2, cy = size / 2, wide = size * 0.032, thin = size * 0.011;
  const index = Math.max(0, metrics.findIndex(m => m.key === selected)), active = metrics[index]!;
  const pt = (a: number, r = R) => { const rad = (a - 90) * Math.PI / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const; };
  const arc = useMemo(() => { const [x0, y0] = pt(START), [x1, y1] = pt(START + SWEEP); return `M${x0.toFixed(2)},${y0.toFixed(2)}A${R},${R} 0 1 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);
  const ticks = useMemo(() => Array.from({ length: 85 }, (_, i) => {
    const a = START + SWEEP * i / 84, kind = i % 28 === 0 ? 'is-major' : i % 7 === 0 ? 'is-mid' : '', r0 = R + size * 0.03, [x0, y0] = pt(a, r0), [x1, y1] = pt(a, r0 + size * (kind === 'is-major' ? 0.022 : kind ? 0.015 : 0.008));
    return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={`nx-tick ${kind}`} />;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [size]);
  /** Slot 0 is the wide outer arc; the rest keep their order on the thin inner slots. */
  const slotOf = (i: number) => i === index ? 0 : 1 + metrics.filter((_, j) => j !== index).indexOf(metrics[i]!);
  const radius = (slot: number) => slot === 0 ? R : R - size * (0.02 + slot * 0.027);
  const next = metrics[(index + 1) % metrics.length]!;
  const [open, setOpen] = useState(false), [pressed, setPressed] = useState<string | null>(null), [touched, setTouched] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  /** Which ring is under the pointer, or null for the middle of the dial. */
  const ringAt = (clientX: number, clientY: number): DialMetric | null => {
    const box = svg.current?.getBoundingClientRect(); if (!box || !box.width) return null;
    const unit = size / box.width, x = (clientX - box.left) * unit, y = (clientY - box.top) * unit, r = Math.hypot(x - cx, y - cy);
    const inner = radius(metrics.length - 1) - size * 0.03;
    if (r < inner || r > R + size * 0.075) return null;
    const deg = (Math.atan2(y - cy, x - cx) * 180 / Math.PI + 90 + 360) % 360; if (deg > 140 && deg < 220) return null;
    let best = 0; metrics.forEach((_, i) => { if (Math.abs(radius(slotOf(i)) - r) < Math.abs(radius(slotOf(best)) - r)) best = i; });
    return r > R - size * 0.025 ? active : metrics[best]!;
  };
  const tap = (e: MouseEvent) => {
    const ring = e.detail === 0 ? null : ringAt(e.clientX, e.clientY);
    if (!ring) { onSelect(next.key); return; }
    if (ring.key !== active.key) onSelect(ring.key);
    setOpen(true); setTouched(n => n + 1);
    try { navigator.vibrate?.(8); } catch { /* Haptics are optional. */ }
  };
  const press = (e: PointerEvent) => setPressed(ringAt(e.clientX, e.clientY)?.key ?? null);
  const [hx, hy] = pt(START + SWEEP * clamp(active.fraction ?? 0, 0, 1));
  const notch = active.notch !== null && active.notch !== undefined ? START + SWEEP * clamp(active.notch, 0, 1) : null;

  return <div className="nx-md" data-tone={active.tone} data-state={active.state}>
    <div className="nx-md-dial">
    <button type="button" className="nx-md-face" onClick={tap} onPointerDown={press} onPointerUp={() => setPressed(null)} onPointerLeave={() => setPressed(null)} onPointerCancel={() => setPressed(null)} aria-label={`${active.spoken}. Show ${next.label.toLowerCase()}`}>
      <svg ref={svg} viewBox={`0 0 ${size} ${size * 0.86}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1={size * 0.12} y1={size * 0.85} x2={size * 0.88} y2={size * 0.12}><stop offset="0" stopColor="var(--nx-a2)" /><stop offset="1" stopColor="var(--nx-a)" /></linearGradient>
          <filter id={`${id}b`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={size * 0.028} /></filter>
        </defs>
        {ticks}
        <g key={`scale-${active.key}`} className="nx-md-scale">{active.scale.map((text, i) => { const [x, y] = pt(START + SWEEP * i / Math.max(1, active.scale.length - 1), R + size * 0.078); return <text key={i} x={x} y={y + 3} textAnchor="middle" className="nx-dial-scale">{text}</text>; })}</g>
        {metrics.map((m, i) => {
          const slot = slotOf(i), k = radius(slot) / R, w = (slot === 0 ? wide : thin) * (pressed === m.key ? (slot === 0 ? 1.35 : 2.4) : 1) / k, f = clamp(m.fraction ?? 0, 0, 1), stroke = m.tone === 'cal' ? `url(#${id}g)` : undefined;
          return <g key={m.key} data-state={m.state} className={`nx-md-ring is-${m.tone}${slot === 0 ? ' is-primary' : ''}${m.fraction === null ? ' is-empty' : ''}${pressed === m.key ? ' is-pressed' : ''}`} style={{ transform: `scale(${k})`, transformOrigin: `${cx}px ${cy}px` }}>
            <path d={arc} className="nx-md-track" strokeWidth={w} />
            {slot === 0 && f > 0.004 && <path key={`glow-${touched}`} d={arc} pathLength={1} stroke={stroke} strokeWidth={w} strokeDasharray={`${f} 1`} className={`nx-md-glow${touched ? ' is-touched' : ''}`} filter={`url(#${id}b)`} />}
            {f > 0.004 && <path d={arc} pathLength={1} stroke={stroke} strokeWidth={w} strokeDasharray={`${f} 1`} className="nx-md-fill" />}
            {m.over && m.over > 0.004 ? <path d={arc} pathLength={1} strokeWidth={w} strokeDasharray={`${clamp(m.over, 0, 1)} 1`} className="nx-md-over" /> : null}
          </g>;
        })}
        {notch !== null && (() => { const [x0, y0] = pt(notch, R + size * 0.024), [x1, y1] = pt(notch, R + size * 0.058); return <line x1={x0} y1={y0} x2={x1} y2={y1} className="nx-dial-pace" />; })()}
        {active.fraction !== null && <g key={`head-${active.key}`} className="nx-md-headg"><circle cx={hx} cy={hy} r={size * 0.027} className="nx-dial-head-ring" /><circle cx={hx} cy={hy} r={size * 0.015} className="nx-dial-head" /></g>}
      </svg>
      <span key={active.key} className="nx-md-centre">
        <small>{active.eyebrow}</small>
        <strong className="nx-big">{active.value}{active.unit ? <sub>{active.unit}</sub> : null}</strong>
        <span className="nx-md-detail">{active.detail}</span>
      </span>
    </button>
    <button type="button" className="nx-md-drill" aria-expanded={open} aria-controls={`${id}t`} onClick={() => setOpen(o => !o)}>{open ? 'Less' : 'Details'}<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    </div>
    <div className="nx-md-keys" role="tablist" aria-label="Reading on the dial">
      {metrics.map(m => <button key={m.key} type="button" role="tab" data-state={m.state} aria-selected={m.key === active.key} className={`nx-md-key is-${m.tone}${m.fraction === null ? ' is-empty' : ''}`} onClick={() => onSelect(m.key)}>
        <i aria-hidden="true" /><span>{m.label}</span><b>{m.chip}</b>
      </button>)}
    </div>
    <div id={`${id}t`} className="nx-md-tray" data-open={open || undefined} role="region" aria-label={`${active.label} details`} hidden={!open}>
      <div key={active.key} className="nx-md-tray-in">
        <dl>{active.facts.map(f => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>
        <button type="button" className="nx-md-open" onClick={active.drill.run}>Open {active.drill.label.toLowerCase()}<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
      </div>
    </div>
  </div>;
}
