// Isolated preview of the Robyn coach overview (dev only). Every viewer request is answered
// locally from tests/robyn-sample.local.json (an uncommitted aggregate export) or a synthetic
// fallback; ?state=expired previews the expired-link screen. No production writes.
import { createRoot } from 'react-dom/client';
import RobynPage from '../src/pages/cupcake/robyn/page';
import '../src/index.css';
if (!import.meta.env.DEV) throw new Error('Preview is development only.');
const params = new URLSearchParams(location.search);
const samples = import.meta.glob('./robyn-sample.local.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
const sample = Object.values(samples)[0] || {};
const detailSamples = import.meta.glob('./robyn-details.local.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
const details = Object.values(detailSamples)[0] || {};
// Coach data is a clearly marked SAMPLE fixture (sample: true → watermark); nothing is written to the library.
const coachSamples = import.meta.glob('./robyn-coach.local.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const coach = params.get('coach') === 'off' ? { ok: true, has_data: false, checkins: [], derived: { count: 0, deltas: {} } } : Object.values(coachSamples)[0];
sessionStorage.setItem('cupcake-robyn-viewer', 'rv_' + 'p'.repeat(43));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
window.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  await new Promise(r => setTimeout(r, 250));
  if (params.get('state') === 'expired') return json({ ok: false, error: 'expired' }, 401);
  if (url.pathname.endsWith('/weekly')) return sample[url.searchParams.get('weeks') || '1'] ? json(sample[url.searchParams.get('weeks') || '1']) : json({ error: 'no sample' }, 503);
  if (url.pathname.endsWith('/details')) return details[url.searchParams.get('weeks') || '1'] ? json(details[url.searchParams.get('weeks') || '1']) : json({ error: 'no sample' }, 503);
  if (url.pathname.endsWith('/coach')) return coach ? json(coach) : json({ ok: true, has_data: false, checkins: [], derived: { count: 0, deltas: {} } });
  if (url.pathname.endsWith('/chat') && init?.method !== 'POST') return json({ ok: true, available: params.get('chat') !== 'off', voice: params.get('chat') !== 'off', limits: { voice_per_day: 6, voice_max_seconds: 600 } });
  if (url.pathname.endsWith('/chat')) return json({ ok: true, answer: 'Preview answer: exercise rose to **8 sessions** (258 min) from 5 (166 min).' });
  if (url.pathname.endsWith('/export')) return new Response(new Blob(['{}']), { status: 200 });
  if (url.pathname.endsWith('/notes') && init?.method === 'POST') return json({ ok: true, note: { id: 'rn_preview', createdAt: new Date().toISOString(), author: 'robyn' } });
  return json({ error: 'disabled' }, 404);
};
createRoot(document.getElementById('root')!).render(<RobynPage />);
// Screenshot helpers: ?open=day|metric|chat|chat-text|export simulates the tap after load.
const open = params.get('open');
const click = (sel: string, i = 0) => (document.querySelectorAll(sel)[i] as HTMLElement | undefined)?.click();
if (open) setTimeout(() => {
  if (open === 'day') click('.rv-day', Number(params.get('i') ?? 5));
  if (open === 'metric') click('.rv-kpi', Number(params.get('i') ?? 3));
  if (open === 'export') click('.rv-pill');
  if (open.startsWith('chat')) { click('.rv-fab'); if (open === 'chat-text') setTimeout(() => { click('.rv-seg-sm button', 1); setTimeout(() => click('.rv-chips button', 0), 300); }, 500); }
}, 2500);
