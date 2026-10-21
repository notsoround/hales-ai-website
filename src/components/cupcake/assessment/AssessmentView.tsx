import { useState } from 'react';
import './assessment.css';

/** Robyn's coach-entered assessment (her RP/FitBudd assessment sheet), as computed by the Cupcake library. */
export type AssessmentRow = { date: string; weight_lb: number; body_fat_pct: number; lean_mass_lb: number; fat_mass_lb: number };
export type AssessmentChange = Omit<AssessmentRow, 'date'>;
export type Assessment = {
  table: { count: number; current_body_fat_pct: number; first: AssessmentRow; previous: AssessmentRow | null; current: AssessmentRow;
    weekly: AssessmentChange | null; average: AssessmentChange | null; total: AssessmentChange | null } | null;
  history: ({ date: string; source: string } & Record<string, number | null | string>)[];
  columns: string[]; all_columns?: string[]; notes: string[]; source_label: string;
};

const COLS: Record<string, [string, string]> = {
  bicep_mm: ['Bicep', 'mm'], tricep_mm: ['Tricep', 'mm'], iliac_mm: ['Iliac', 'mm'], subscap_mm: ['Subscap', 'mm'],
  neck_in: ['Neck', 'in'], arm_in: ['Arm', 'in'], chest_in: ['Chest', 'in'], waist_in: ['Waist', 'in'], hips_in: ['Hips', 'in'],
  thigh_in: ['Thigh', 'in'], calf_in: ['Calf', 'in'], forearm_in: ['Forearm', 'in'],
  weight_lb: ['Weight', 'lb'], body_fat_pct: ['Body fat', '%'], lean_mass_lb: ['Lean muscle', 'lb'], fat_mass_lb: ['Fat mass', 'lb'],
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const mdy = (iso: string) => `${md(iso)}, ${iso.slice(0, 4)}`;
const f2 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${f2(Math.abs(v))}`;
const KEYS = ['weight_lb', 'body_fat_pct', 'lean_mass_lb', 'fat_mass_lb'] as const;
const UNIT: Record<typeof KEYS[number], string> = { weight_lb: ' lb', body_fat_pct: '%', lean_mass_lb: ' lb', fat_mass_lb: ' lb' };

function BodyFatTrend({ points }: { points: { date: string; v: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 520, H = 128, top = 20, bottom = 20, left = 6, right = 8;
  const t = (iso: string) => Date.parse(iso + 'T12:00:00Z');
  const lo0 = Math.min(...points.map(p => p.v)), hi0 = Math.max(...points.map(p => p.v)), pad = Math.max(0.3, (hi0 - lo0) * 0.3);
  const lo = lo0 - pad, hi = hi0 + pad, x0 = t(points[0].date), x1 = t(points[points.length - 1].date);
  const x = (iso: string) => left + (W - left - right) * ((t(iso) - x0) / Math.max(1, x1 - x0));
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points[points.length - 1].date)},${H - bottom} L${x(points[0].date)},${H - bottom} Z`;
  const h = hover === null ? null : points[hover];
  return (
    <figure className="ax-trend" aria-label="Body fat at each assessment">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Body fat from ${points[0].v}% on ${md(points[0].date)} to ${points[points.length - 1].v}% on ${md(points[points.length - 1].date)}`} onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="ax-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--ax-accent)" stopOpacity=".24" /><stop offset="1" stopColor="var(--ax-accent)" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#ax-grad)" />
        <path d={line} className="ax-line" />
        {points.map((p, i) => <circle key={p.date} cx={x(p.date)} cy={y(p.v)} r={hover === i ? 5.5 : 3.8} className="ax-pt" tabIndex={0}
          onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} aria-label={`${mdy(p.date)}: ${f2(p.v)}%`} />)}
        <text x={x(points[0].date)} y={y(points[0].v) - 9} className="ax-tick" textAnchor="start">{f2(points[0].v)}%</text>
        <text x={x(points[points.length - 1].date)} y={y(points[points.length - 1].v) - 9} className="ax-tick" textAnchor="end">{f2(points[points.length - 1].v)}%</text>
        <text x={left} y={H - 5} className="ax-tick">{md(points[0].date)}</text>
        <text x={W - right} y={H - 5} className="ax-tick" textAnchor="end">{md(points[points.length - 1].date)}</text>
      </svg>
      {h && <div className="ax-tip" style={{ left: `${(x(h.date) / W) * 100}%` }} role="status">{mdy(h.date)} · {f2(h.v)}%</div>}
    </figure>
  );
}

/** Same information as Robyn's assessment screen: headline, summary table and measurements history. */
export function AssessmentView({ data, variant }: { data: Assessment; variant: 'light' | 'dark' }) {
  const t = data.table;
  if (!t) return null;
  const rows: [string, string, AssessmentRow | AssessmentChange | null, string][] = [
    ['First assessment', mdy(t.first.date), t.first, ''],
    ['Previous assessment', t.previous ? mdy(t.previous.date) : '', t.previous, ''],
    ['Current assessment', mdy(t.current.date), t.current, ''],
    ['Weekly loss / gain', `current vs ${t.previous ? md(t.previous.date) : 'previous'}`, t.weekly, 'ax-c1'],
    ['Average loss / gain', `per assessment · ${t.count - 1} intervals`, t.average, 'ax-c2'],
    ['Total loss / gain', `since ${md(t.first.date)}`, t.total, 'ax-c3'],
  ];
  const cols = data.columns.filter(c => COLS[c]);
  const bf = data.history.filter(h => typeof h.body_fat_pct === 'number').map(h => ({ date: h.date, v: h.body_fat_pct as number }));
  return (
    <div className={`ax ax-${variant}`}>
      <div className="ax-hero">
        <div>
          <div className="ax-label">Current body fat</div>
          <div className="ax-big">{f2(t.current_body_fat_pct)}<span>%</span></div>
          <div className="ax-sub">{data.source_label} · {mdy(t.current.date)}</div>
        </div>
        <div className="ax-chips">
          {t.total && <span className={`ax-chip ${t.total.body_fat_pct < 0 ? 'ax-chip-down' : ''}`}><b>{signed(t.total.body_fat_pct)} pts</b> since {md(t.first.date)}</span>}
          <span className="ax-chip"><b>{f2(t.current.lean_mass_lb)} lb</b> lean muscle</span>
          <span className="ax-chip"><b>{f2(t.current.fat_mass_lb)} lb</b> fat mass</span>
        </div>
        <BodyFatTrend points={bf} />
      </div>
      <div className="ax-table" role="table" aria-label="Assessment summary">
        <div className="ax-tr ax-th" role="row"><span role="columnheader" /><span role="columnheader">Weight</span><span role="columnheader">Body fat</span><span role="columnheader">Lean muscle</span><span role="columnheader">Fat mass</span></div>
        {rows.filter(r => r[2]).map(([label, sub, v, change]) => (
          <div key={label} className={`ax-tr${change ? ` ax-change ${change}` : ''}`} role="row">
            <span role="rowheader" className="ax-rh"><b>{label}</b><small>{sub}</small></span>
            {KEYS.map(k => <span key={k} role="cell" data-label={COLS[k][0]}>{change ? signed(v![k]) : f2(v![k])}<small>{UNIT[k]}</small></span>)}
          </div>))}
      </div>
      <details className="ax-history" open={variant === 'light'}>
        <summary><span className="ax-label">Measurements history</span><span className="ax-sub">{data.history.length} assessments · columns without values are hidden</span></summary>
        <div className="ax-scroll">
          <table>
            <thead><tr><th>Date</th>{cols.map(c => <th key={c}>{COLS[c][0]}<small>{COLS[c][1]}</small></th>)}</tr></thead>
            <tbody>{[...data.history].reverse().map(h => <tr key={h.date}><th>{mdy(h.date)}</th>{cols.map(c => <td key={c}>{typeof h[c] === 'number' ? f2(h[c] as number) : ''}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
      <p className="ax-foot">Entered by Robyn in her assessments; lean muscle and fat mass as she recorded them.{' '}
        Previous and current rows use fat mass rounded to 0.1 lb, as on her sheet; changes are computed from these rows.{data.notes.length ? ` ${data.notes.join(' ')}` : ''}</p>
    </div>
  );
}
