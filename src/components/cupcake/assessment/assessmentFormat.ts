const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const md = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
export const mdy = (iso: string) => `${md(iso)}, ${iso.slice(0, 4)}`;
/** Headline and summary figures: one decimal (28.9%, 196.5 lb). */
export const f1 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Raw tape/caliper values in the history table keep quarter-inch entries (16.25) but drop padding zeros (42.2). */
export const raw = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const signed = (v: number) => { const r = Math.round(v * 10) / 10; return `${r > 0 ? '+' : r < 0 ? '−' : ''}${f1(Math.abs(r))}`; };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
/** Robyn's sheet calls this row "weekly", but it is current vs the previous assessment, whatever the gap. */
export function intervalLabel(previous: string | null | undefined, current: string): [string, string] {
  if (!previous) return ['Since last assessment', 'vs previous'];
  const d = daysBetween(previous, current), w = Math.max(1, Math.round(d / 7));
  const weekly = d >= 6 && d <= 8;
  return [weekly ? 'Weekly loss / gain' : 'Since last assessment', weekly ? `vs ${md(previous)} · 1 week` : d < 14 ? `vs ${md(previous)} · ${d} days` : `vs ${md(previous)} · ${w} weeks`];
}
