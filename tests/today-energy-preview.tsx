// Isolated synthetic preview of Cupcake Today (dev only). Every request is
// answered locally; no production data, keys or writes. ?heat=hot previews Hot; ?exercise=1 simulates a deployed exercise log.
import { createRoot } from 'react-dom/client';
import CupcakeGPT from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import '../src/index.css';
if (!import.meta.env.DEV) throw new Error('Synthetic preview is development only.');
const params = new URLSearchParams(location.search);
localStorage.setItem('cupcake-private-access', 'synthetic-preview-only');
localStorage.setItem('cupcake-accent-heat-v1', params.get('heat') === 'hot' ? 'hot' : 'calm');
const now = Date.now(), at = (hoursAgo: number) => new Date(now - hoursAgo * 3600000).toISOString();
const meals = params.get('empty') ? [] : [3, 6.5].map((h, i) => ({ id: `synthetic_meal_${i}`, status: 'ready', description: i ? 'Synthetic breakfast' : 'Synthetic lunch', consumedAt: at(h), photoTakenAt: at(h), createdAt: at(h), sheetLoggedAt: at(h), total: { calories: i ? 420 : 640 }, totalIsPartial: false, items: [] }));
const feed = params.get('empty') ? [] : [{ id: 'synthetic_tx', type: 'transaction', icon: '💳', title: 'Synthetic Coffee Co', body: 'Synthetic purchase', date: at(5).slice(0, 10), time: '', ts: now - 5 * 3600000, amount: 6.4, currency: 'USD', details: { category: 'Food and Drink: Coffee' } }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
window.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('cupcake-feed') && url.includes('scope=food-history')) return json({ items: [], coverage: { scope: 'food-history', complete: true } });
  if (url.includes('cupcake-feed')) return json({ items: feed });
  if (url.includes('cupcake-library')) {
    const body = JSON.parse(String(init?.body || '{}'));
    switch (body.action) {
      case 'food_history': return json({ ok: true, meals, total: meals.length, pendingCount: 0, undatedLoggedCount: 0 });
      case 'food_settings_get': return json({ ok: true, settings: { calorieTarget: 2000, expenditureEstimate: 2400, effectiveFrom: '2026-01-01', versions: [] } });
      case 'glucose_manual_list': return json({ ok: true, entries: [] });
      case 'exercise_list': return params.get('exercise') ? json({ ok: true, entries: [{ id: 'exe_synthetic', description: 'Synthetic 30 min walk', performedAt: at(1), minutes: 30, kcal: 140, basis: 'local-met' }] }) : json({ ok: false, error: 'Unknown library action' }, 400);
      case 'exercise_log': case 'exercise_delete': return json({ ok: false, error: 'Writes are disabled in this synthetic preview.' }, 400);
      default: return json({ ok: true, entries: [], items: [] });
    }
  }
  return json({ error: 'External networking is disabled in this synthetic preview.' }, 404);
};
createRoot(document.getElementById('root')!).render(<CupcakeGPT/>);
