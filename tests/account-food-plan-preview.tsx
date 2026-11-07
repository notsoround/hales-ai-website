/* eslint-disable react-refresh/only-export-components -- Isolated synthetic development fixture. */
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { SnapView } from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { MealPlanCard } from '../src/components/cupcake/robyn/CoachSections';
import type { Coach } from '../src/components/cupcake/robyn/viewerApi';
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic food plan preview is development only.');
const owners = { A: { account_id: 'acc_plan_a', email: 'a@example.invalid', name: 'Synthetic A' }, B: { account_id: 'acc_plan_b', email: 'b@example.invalid', name: 'Synthetic B' } };
let owner: 'A' | 'B' = 'A';
const fixture = { requests: [] as { owner: string; body: Record<string, unknown>; headers: Record<string, string> }[], blocked: [] as string[], async switchOwner(next: 'A' | 'B') { owner = next; await restoreSession(); } };
(window as unknown as { planFixture: typeof fixture }).planFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  const identity = owners[owner], scope = owner, body = JSON.parse(String(init?.body || '{}'));
  const response = (data: object) => Response.json({ ok: true, ...data, identity });
  if (url.href === 'https://automate.hales.ai/api/account/session') return response({});
  if (url.href !== 'https://automate.hales.ai/api/account/data') { fixture.blocked.push(url.href); throw Error('External networking forbidden.'); }
  const headers = Object.fromEntries(new Headers(init?.headers));
  if (headers['x-cupcake-account-context'] !== identity.account_id) return Response.json({ ok: false, error: 'account_context_changed' }, { status: 409 });
  fixture.requests.push({ owner: scope, body, headers });
  if (body.action === 'food_list') return response({ meals: [] });
  if (body.action === 'food_history') return response({ meals: [], total: 0, pendingCount: 0, undatedLoggedCount: 0, hasMore: false });
  if (body.action === 'food_settings_get') return response({ settings: { calorieTarget: null, expenditureEstimate: null, effectiveFrom: null } });
  if (['coach_plan_get', 'coach_plan_set'].includes(body.action)) {
    const remote = (window as unknown as { syntheticPlanServer: (owner: string, body: Record<string, unknown>) => Promise<{ status: number; value: Record<string, unknown> }> }).syntheticPlanServer;
    const result = await remote(scope, body);
    if (result.value.lostResponse) throw TypeError('Synthetic response lost after committed write');
    return Response.json({ ...result.value, identity }, { status: result.status });
  }
  throw Error('Unexpected synthetic Food action ' + body.action);
};
await restoreSession();
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot), [visible, setVisible] = useState(true), [viewer, setViewer] = useState(false);
  const sample = { meal_plan: { title: 'Synthetic partial reference', meals: [{ name: 'Known reference', kcal: 200, items: ['Owner-entered item'] }, { name: 'Unknown reference', items: ['Owner-entered unknown'] }] } } as Coach;
  return <div className="cc-app" data-appearance="rose"><main style={{ maxWidth: 900, margin: 'auto', padding: 16 }}><p>Isolated synthetic food planning. No live meals, orders or providers.</p><button onClick={() => setVisible(value => !value)}>{visible ? 'Leave Food preview' : 'Return to Food preview'}</button><button onClick={() => setViewer(value => !value)}>Toggle reference viewer</button>{viewer && <MealPlanCard coach={sample}/>} {visible && session.identity && <SnapView key={session.generation}/>}</main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
