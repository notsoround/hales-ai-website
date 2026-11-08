/* eslint-disable react-refresh/only-export-components -- Isolated development-only account source fixture. */
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { TodayEnergy, type ExerciseState } from '../src/components/cupcake/TodayEnergy';
import { accountData, restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { chicagoHourOnDay } from '../src/components/cupcake/glucoseApi';
import { nutritionDay, type NutritionSettings } from '../src/components/cupcake/nutritionModel';
import '../src/index.css';
import '../src/components/cupcake/studio.css';
import '../src/components/cupcake/design/tokens.css';
import '../src/components/cupcake/assistant-appearance.css';
if (!import.meta.env.DEV) throw Error('Synthetic CGM preview is development only.');
const owners = { A: { account_id: 'acc_cgm_a', email: 'a@example.invalid', name: 'Synthetic A' }, B: { account_id: 'acc_cgm_b', email: 'b@example.invalid', name: 'Synthetic B' } };
type Owner = keyof typeof owners;
type Result = { status: number; value: Record<string, unknown> };
type SyntheticServer = (owner: Owner, route: string, body: Record<string, unknown>) => Promise<Result>;
let owner: Owner = 'A', appearance = 'caribbean';
const listeners = new Set<() => void>();
const fixture = {
  requests: [] as { owner: Owner; route: string; body: Record<string, unknown>; headers: Record<string, string>; credentials?: RequestCredentials }[], blocked: [] as string[], completed: [] as {owner: Owner; route: string}[], wrongEcho: false,
  async switchOwner(next: Owner) { owner = next; await restoreSession(); },
  async manualWrite() { return accountData({ action: 'glucose_add', requestId: crypto.randomUUID(), observedAt: new Date().toISOString(), glucoseMgDl: 117, method: 'fingerstick' }); },
  theme(next: string) { appearance = next; for (const listener of listeners) listener(); },
};
(window as unknown as { cgmFixture: typeof fixture }).cgmFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  if (url.origin !== 'https://automate.hales.ai' || !['/api/account/session', '/api/account/health/cgm/latest', '/api/account/data'].includes(url.pathname) || url.search || url.hash) { fixture.blocked.push(url.href); throw Error('External network forbidden.'); }
  const route = url.pathname.slice('/api/account/'.length), captured = owner, identity = owners[captured];
  if (route === 'session') return Response.json({ ok: true, identity });
  const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>, headers = Object.fromEntries(new Headers(init?.headers));
  fixture.requests.push({ owner: captured, route, body, headers, credentials: init?.credentials });
  if (init?.method !== 'POST' || headers['x-cupcake-request'] !== 'account' || headers['x-cupcake-account-context'] !== identity.account_id) return Response.json({ ok: false, error: 'account_context_changed' }, { status: 409 });
  let result: Result;
  if (route === 'health/cgm/latest') result = await (window as unknown as { syntheticCGMServer: SyntheticServer }).syntheticCGMServer(captured, route, body);
  else {
    const at = new Date(chicagoHourOnDay(nutritionDay(new Date()), 18)).toISOString();
    if (body.action === 'glucose_manual_list') result = { status: 200, value: { ok: true, entries: [{ id: 'synthetic-manual-' + captured, observedAt: at, glucoseMgDl: 117, method: 'fingerstick' }] } };
    else if (['steps_list', 'ringconn_night_list', 'exercise_list'].includes(String(body.action))) result = { status: 200, value: { ok: true, entries: [] } };
    else if (body.action === 'glucose_add') result = { status: 200, value: { ok: true, entry: { ...body, id: 'synthetic-manual-new-' + captured } } };
    else { fixture.blocked.push(String(body.action)); throw Error('Only explicit synthetic manual glucose write is allowed.'); }
  }
  fixture.completed.push({ owner: captured, route });
  return Response.json({ ...result.value, identity: fixture.wrongEcho ? owners[captured === 'A' ? 'B' : 'A'] : identity }, { status: result.status });
};
await restoreSession();
const exercise: ExerciseState = { status: 'ready', entries: [], reload() {}, add() {}, remove() {} };
const settings: NutritionSettings = { calorieTarget: 2000, expenditureEstimate: null, effectiveFrom: null, versions: [] };
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const theme = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => appearance);
  return <div className="cc-app" data-appearance={theme}><main className="cc-studio" style={{ padding: 12 }}><p className="cc-muted">Synthetic account CGM and manual fixtures only.</p>
    {session.identity ? <TodayEnergy key={session.generation} items={[]} nutrition={{ history: null, loading: false, settings }} exercise={exercise}/> : <p>Signed out</p>}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
