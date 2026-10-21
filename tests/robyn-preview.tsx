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
sessionStorage.setItem('cupcake-robyn-viewer', 'rv_' + 'p'.repeat(43));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
window.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  await new Promise(r => setTimeout(r, 250));
  if (params.get('state') === 'expired') return json({ ok: false, error: 'expired' }, 401);
  if (url.pathname.endsWith('/weekly')) return sample[url.searchParams.get('weeks') || '1'] ? json(sample[url.searchParams.get('weeks') || '1']) : json({ error: 'no sample' }, 503);
  if (url.pathname.endsWith('/notes') && init?.method === 'POST') return json({ ok: true, note: { id: 'rn_preview', createdAt: new Date().toISOString(), author: 'robyn' } });
  return json({ error: 'disabled' }, 404);
};
createRoot(document.getElementById('root')!).render(<RobynPage />);
