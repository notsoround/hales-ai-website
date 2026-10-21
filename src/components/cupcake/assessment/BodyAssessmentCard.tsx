import { useCallback, useEffect, useState } from 'react';
import { libraryRequest } from '../library';
import { AssessmentView, type Assessment } from './AssessmentView';

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
  if (error) return <section className="cc-card"><span className="cc-eyebrow">BODY · ROBYN&rsquo;S ASSESSMENT</span><p className="cc-muted">Assessment unavailable right now.</p><button type="button" className="cc-secondary" onClick={load}>Retry</button></section>;
  if (!data?.table) return null;
  const t = data.table;
  const ch = t.total?.body_fat_pct;
  return (
    <section className="cc-card cc-assessment">
      <button type="button" className="cc-assessment-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><span className="cc-eyebrow">BODY · ROBYN&rsquo;S ASSESSMENT</span>
          <strong>{t.current_body_fat_pct.toFixed(2)}% body fat</strong>
          <small>Robyn&rsquo;s {md(t.current.date)} assessment · lean {t.current.lean_mass_lb.toFixed(1)} lb · fat {t.current.fat_mass_lb.toFixed(1)} lb{ch !== undefined ? ` · ${ch > 0 ? '+' : ch < 0 ? '−' : ''}${Math.abs(ch).toFixed(2)} pts since ${md(t.first.date)}` : ''}</small></span>
        <span className="cc-assessment-toggle" aria-hidden="true">{open ? 'Hide' : 'Details'}</span>
      </button>
      {open && <div className="cc-assessment-body"><AssessmentView data={data} variant="dark" /></div>}
    </section>
  );
}
