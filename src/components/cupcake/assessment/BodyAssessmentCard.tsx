import { useCallback, useEffect, useState } from 'react';
import { libraryRequest } from '../library';
import { AssessmentView, type Assessment } from './AssessmentView';
import { f1 } from './assessmentFormat';
import { ToneIcon } from '../design/ToneIcon';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

/** Cupcake app (owner) card: Robyn's latest assessment, expandable to her full assessment view. Read-only. */
export function BodyAssessmentCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [data, setData] = useState<Assessment | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const load = useCallback(() => {
    setError(false);
    libraryRequest<Assessment>({ action: 'body_assessment_get' }).then(setData).catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <section className="cc-card"><span className="cc-eyebrow"><ToneIcon tone="body"/>Body · Robyn&rsquo;s assessment</span><p className="cc-muted">Assessment unavailable right now.</p><button type="button" className="cc-secondary" onClick={load}>Retry</button></section>;
  if (!data?.table) return null;
  const t = data.table;
  const ch = t.total?.body_fat_pct;
  return (
    <section className="cc-card cc-assessment">
      <button type="button" className="cc-assessment-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><span className="cc-eyebrow"><ToneIcon tone="body"/>Body · Robyn&rsquo;s assessment</span>
          <strong>{f1(t.current_body_fat_pct)}% body fat</strong>
          <small>Robyn&rsquo;s {md(t.current.date)} assessment · lean {f1(t.current.lean_mass_lb)} lb · fat {f1(t.current.fat_mass_lb)} lb{ch !== undefined ? ` · ${ch > 0 ? '+' : ch < 0 ? '−' : ''}${f1(Math.abs(ch))} pts since ${md(t.first.date)}` : ''}</small></span>
        <span className="cc-assessment-toggle" aria-hidden="true">{open ? 'Hide' : 'Details'}</span>
      </button>
      {open && <div className="cc-assessment-body"><AssessmentView data={data} variant="dark" hideHero /></div>}
    </section>
  );
}
