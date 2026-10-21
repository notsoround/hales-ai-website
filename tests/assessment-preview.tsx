// Dev-only preview of the Cupcake app's Body/Assessment card. Answers body_assessment_get from
// tests/robyn-assessment.local.json (uncommitted) or a synthetic fallback. No network.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BodyAssessmentCard } from '../src/components/cupcake/assessment/BodyAssessmentCard';
import '../src/components/cupcake/studio.css';
if (!import.meta.env.DEV) throw new Error('Preview is development only.');
const local = Object.values(import.meta.glob('./robyn-assessment.local.json', { eager: true, import: 'default' }))[0] as Record<string, unknown> | undefined;
const row = (date: string, w: number, bf: number, lm: number, fm: number) => ({ date, weight_lb: w, body_fat_pct: bf, lean_mass_lb: lm, fat_mass_lb: fm });
const synthetic = { table: { count: 2, current_body_fat_pct: 25, first: row('2026-01-01', 200, 30, 140, 60), previous: row('2026-01-01', 200, 30, 140, 60), current: row('2026-02-01', 190, 25, 142.5, 47.5),
  weekly: { weight_lb: -10, body_fat_pct: -5, lean_mass_lb: 2.5, fat_mass_lb: -12.5 }, average: { weight_lb: -10, body_fat_pct: -5, lean_mass_lb: 2.5, fat_mass_lb: -12.5 }, total: { weight_lb: -10, body_fat_pct: -5, lean_mass_lb: 2.5, fat_mass_lb: -12.5 } },
  history: [{ source: 'robyn_assessment', ...row('2026-01-01', 200, 30, 140, 60) }, { source: 'robyn_assessment', ...row('2026-02-01', 190, 25, 142.5, 47.5) }],
  columns: ['weight_lb', 'body_fat_pct', 'lean_mass_lb', 'fat_mass_lb'], notes: [], source_label: 'Robyn assessment' };
window.fetch = async (_url, init) => {
  const b = JSON.parse(String(init?.body || '{}'));
  if (b.action !== 'body_assessment_get') throw new Error('External networking is disabled in this preview.');
  return new Response(JSON.stringify({ ok: true, ...(local || synthetic) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const open = new URLSearchParams(location.search).get('open') === '1';
createRoot(document.getElementById('root')!).render(<React.StrictMode><div className="cc-app" style={{ fontFamily: 'system-ui, sans-serif' }}><main className="cc-shell"><BodyAssessmentCard defaultOpen={open} /></main></div></React.StrictMode>);
