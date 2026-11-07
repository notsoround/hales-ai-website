/* eslint-disable react-refresh/only-export-components -- Isolated synthetic development fixture. */
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { SnapView } from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import type { FoodMeal } from '../src/components/cupcake/DashboardView';
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic manual meal preview is development only.');
const owners = { A: { account_id: 'acc_manual_a', email: 'a@example.invalid', name: 'Synthetic A' }, B: { account_id: 'acc_manual_b', email: 'b@example.invalid', name: 'Synthetic B' } };
let owner: 'A' | 'B' = 'A';
const saved = { A: new Map<string, { request: string; meal: FoodMeal }>(), B: new Map<string, { request: string; meal: FoodMeal }>() };
const fixture = {
  mode: 'normal', requests: [] as { owner: string; body: Record<string, unknown> }[], blocked: [] as string[],
  release: () => {}, async switchOwner(next: 'A' | 'B') { owner = next; await restoreSession(); },
};
(window as unknown as { manualFixture: typeof fixture }).manualFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  const body = JSON.parse(String(init?.body || '{}'));
  const identity = owners[owner], scope = owner;
  const response = (data: object) => Response.json({ ok: true, ...data, identity });
  if (url.href === 'https://automate.hales.ai/api/account/session') return response({});
  if (url.href !== 'https://automate.hales.ai/api/account/data') { fixture.blocked.push(url.href); throw Error('External networking blocked.'); }
  if (new Headers(init?.headers).get('x-cupcake-account-context') !== identity.account_id) return Response.json({ ok: false, error: 'account_context_changed' }, { status: 409 });
  fixture.requests.push({ owner: scope, body });
  const meals = () => [...saved[scope].values()].map(item => item.meal);
  if (body.action === 'food_list') return response({ meals: meals() });
  if (body.action === 'food_history') return response({ meals: meals(), total: meals().length, pendingCount: 0, undatedLoggedCount: 0, hasMore: false });
  if (body.action === 'food_settings_get') return response({ settings: { calorieTarget: 2000, expenditureEstimate: 2200, effectiveFrom: '2020-01-01' } });
  if (body.action === 'food_photo') throw Error('Manual meals have no photo.');
  if (body.action === 'food_manual_log') {
    const key = String(body.dedupeKey), previous = saved[scope].get(key);
    // Like the backend, compare normalized content, never JSON object key order.
    const request = JSON.stringify({ description: body.description, consumedAt: body.consumedAt, confirmConsumed: body.confirmConsumed, source: body.source, total: Object.fromEntries(Object.entries(body.total as object).sort(([a], [b]) => a.localeCompare(b))) });
    if (fixture.mode === 'conflict') { fixture.mode = 'normal'; return response({ meal: { id: 'meal_conflicting' }, matchesRequest: false }); }
    const total = Object.fromEntries(['calories', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'fiber_g'].map(key => [key, (body.total as Record<string, number>)[key] ?? null]));
    const meal: FoodMeal = previous?.meal || { id: 'meal_' + key.replaceAll('-', ''), status: 'ready', description: String(body.description), consumedAt: String(body.consumedAt), createdAt: new Date().toISOString(), sheetLoggedAt: new Date().toISOString(), manualLoggedAt: new Date().toISOString(), countedInTotals: true, logState: 'logged', source: 'manual-entry', imageStored: false, total, totalIsPartial: Object.values(total).some(value => value === null) };
    if (!previous) saved[scope].set(key, { request, meal });
    if (fixture.mode === 'lost') { fixture.mode = 'normal'; throw TypeError('Synthetic response lost after committed write'); }
    if (fixture.mode === 'holdWrite') { fixture.mode = 'normal'; await new Promise<void>(resolve => { fixture.release = resolve; }); }
    return response({ meal, created: !previous, duplicate: !!previous, matchesRequest: !previous || previous.request === request });
  }
  if (body.action === 'food_get') {
    if (fixture.mode === 'readbackFail') { fixture.mode = 'normal'; throw TypeError('Synthetic readback unavailable'); }
    if (fixture.mode === 'holdGet') { fixture.mode = 'normal'; await new Promise<void>(resolve => { fixture.release = resolve; }); }
    return response({ meal: meals().find(meal => meal.id === body.mealId) });
  }
  throw Error('Unexpected synthetic manual meal action: ' + body.action);
};
await restoreSession();
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const [visible, setVisible] = useState(true);
  return <div className="cc-app" data-appearance="rose"><main style={{ maxWidth: 900, margin: 'auto', padding: 16 }}>
    <p>Isolated synthetic manual meal preview. No live records or providers.</p>
    <button onClick={() => setVisible(value => !value)}>{visible ? 'Leave Food preview' : 'Return to Food preview'}</button>
    {session.identity && visible && <SnapView key={session.generation}/>}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
