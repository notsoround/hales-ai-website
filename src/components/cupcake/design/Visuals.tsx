/** Small design-system visuals: a progress ring and a sparkline. Pure SVG, coloured by CSS (currentColor / category tokens). */
export function ProgressRing({ value, size = 92, stroke = 10, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return <svg className="ds-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <circle className="ds-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
    <circle className="ds-ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round"
      strokeDasharray={`${v * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
  </svg>;
}

export function Sparkline({ values, width = 160, height = 44 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1, pad = 4;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), pad + (1 - (v - lo) / span) * (height - pad * 2)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return <svg className="ds-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <path className="ds-spark-area" d={`${d} L${lx.toFixed(1)} ${height} L${pad} ${height} Z`} />
    <path className="ds-spark-line" d={d} fill="none" />
    <circle className="ds-spark-dot" cx={lx} cy={ly} r={3.5} />
  </svg>;
}
