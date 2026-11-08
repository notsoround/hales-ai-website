/* eslint-disable react-refresh/only-export-components -- Isolated synthetic fixture. */
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Timeline } from '../src/components/cupcake/TodayPulse';
import { SavedMealDialog } from '../src/components/cupcake/SavedMealDialog';
import { useCupcakeViewport } from '../src/components/cupcake/useCupcakeViewport';
import { AccountPhotoMeal } from '../src/components/cupcake/AccountPhotoMeal';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { photoDraftStore, type PhotoIntent } from '../src/components/cupcake/accountFoodPhotoDraft';
import type { FoodMeal } from '../src/components/cupcake/DashboardView';
import '../src/index.css';
import '../src/components/cupcake/studio.css';
import '../src/components/cupcake/design/tokens.css';
import '../src/components/cupcake/design/cupcake-theme.css';
import '../src/components/cupcake/pulse.css';
import '../src/components/cupcake/assistant-appearance.css';

if (!import.meta.env.DEV) throw Error('Synthetic photo preview is development only.');
const params = new URLSearchParams(location.search);
const layout = params.has('layout');
const description = params.has('long') ? 'SyntheticProductName'.repeat(15) : 'Synthetic photo meal';
const statusCase = params.get('status');
const stamp = new Date().toISOString();
const labelMeal: FoodMeal | null = statusCase ? {
  id: 'meal_synthetic_label', status: 'ready', description: 'Synthetic status meal', createdAt: stamp, imageStored: false, total: { calories: null },
  ...(statusCase === 'legacy' ? { source: 'food_sheet', sheetLoggedAt: stamp, consumedAt: stamp } : { source: 'account-photo-estimate', logDestination: 'account-local', ...(statusCase !== 'unlogged' ? { accountLoggedAt: stamp } : {}), ...(['logged', 'missing-time'].includes(statusCase || '') ? { logState: 'logged', countedInTotals: true, ...(statusCase === 'logged' ? { consumedAt: stamp } : {}) } : { logState: 'awaiting_confirmation', countedInTotals: false }) }),
} : null;
let owner = 'A';
const identities = { A: { account_id: 'acc_photo_a', email: 'a@example.invalid', name: 'Synthetic A' }, B: { account_id: 'acc_photo_b', email: 'b@example.invalid', name: 'Synthetic B' } };
type Entry = { body: PhotoIntent; status: 'queued' | 'running' | 'completed' | 'failed' | 'uncertain'; meal: FoodMeal };
const persisted = JSON.parse(sessionStorage.getItem('synthetic-photo-server') || '{}');
const saved: Record<string, Map<string, Entry>> = { A: new Map(persisted.A || []), B: new Map(persisted.B || []) };
const persist = () => sessionStorage.setItem('synthetic-photo-server', JSON.stringify({ A: [...saved.A], B: [...saved.B] }));
const fixture = {
  mode: 'normal', requests: [] as { owner: string; route: string; body: Record<string, unknown> }[], persistedBeforeUpload: true, savedCallbacks: 0, release: () => {},
  async switchOwner(value: 'A' | 'B') { owner = value; await restoreSession(); },
  async drafts() { return await photoDraftStore().list(); },
};
(window as unknown as { photoFixture: typeof fixture }).photoFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  if (!url.href.startsWith('https://automate.hales.ai/api/account/')) throw Error('Unexpected network request blocked.');
  const scope = owner, identity = identities[owner as 'A' | 'B'];
  const response = (data: object) => Response.json({ ok: true, ...data, identity });
  if (url.pathname.endsWith('/session')) return response({});
  if (new Headers(init?.headers).get('X-Cupcake-Account-Context') !== identity.account_id) return Response.json({ ok: false, error: 'account_context_changed' }, { status: 409 });
  const body = JSON.parse(String(init?.body || '{}'));
  fixture.requests.push({ owner: scope, route: url.pathname, body });
  const envelope = (entry: Entry) => ({ request: { request_id: entry.body.request_id, attempt: 'attempt_' + entry.body.request_id, meal_id: entry.meal.id, status: entry.status, error: entry.status === 'failed' ? 'account_budget_exceeded' : null, dispatched: entry.status !== 'failed' }, ...(entry.status === 'completed' ? { meal: entry.meal } : {}) });
  if (url.pathname.endsWith('/food/photo/analyze')) {
    fixture.persistedBeforeUpload &&= (await photoDraftStore().list()).some(item => JSON.stringify(item) === JSON.stringify(body));
    if (fixture.mode === 'beforeUpload') { fixture.mode = 'normal'; throw Error('Synthetic upload lost before persistence'); }
    const intent = body as PhotoIntent;
    const previous = saved[scope].get(intent.request_id);
    const entry: Entry = previous || { body: intent, status: fixture.mode === 'uncertain' ? 'uncertain' : fixture.mode === 'failed' ? 'failed' : 'queued', meal: { id: 'meal_' + intent.request_id.replaceAll('-', ''), status: 'ready', description, source: 'account-photo-estimate', logDestination: 'account-local', accountLoggedAt: new Date().toISOString(), consumedAt: intent.consumed_at, logState: 'logged', countedInTotals: true, total: { calories: null, protein_g: 20 }, totalIsPartial: true, imageStored: true } };
    saved[scope].set(intent.request_id, entry); persist();
    if (fixture.mode === 'lost') { fixture.mode = 'normal'; throw Error('Synthetic response lost after request committed'); }
    if (fixture.mode === 'holdUpload') { fixture.mode = 'normal'; await new Promise<void>(resolve => { fixture.release = resolve; }); }
    if (fixture.mode === 'wrongReceipt') return response({ request: { ...envelope(entry).request, request_id: crypto.randomUUID() } });
    return response(envelope(entry));
  }
  if (body.action === 'food_photo_status' || body.action === 'food_photo_retry') {
    const entry = saved[scope].get(String(body.request_id));
    if (!entry) return Response.json({ ok: false, error: 'photo_request_not_found' }, { status: 404 });
    if (body.action === 'food_photo_retry') entry.status = 'queued';
    else if (entry.status === 'queued') entry.status = 'completed';
    persist();
    return response(envelope(entry));
  }
  if (body.action === 'food_photo') return response({ photo: { dataUrl: [...saved[scope].values()].find(entry => entry.meal.id === body.mealId)?.body.image } });
  if (body.action === 'food_get') {
    if (fixture.mode === 'holdGet') { fixture.mode = 'normal'; await new Promise<void>(resolve => { fixture.release = resolve; }); }
    return response({ meal: body.mealId === labelMeal?.id ? labelMeal : [...saved[scope].values()].find(entry => entry.meal.id === body.mealId)?.meal });
  }
  throw Error('Unexpected synthetic action blocked.');
};
await restoreSession();
function Preview() {
  useCupcakeViewport();
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const [, savedVersion] = useState(0), [selectedMeal, setSelectedMeal] = useState<string | null>(labelMeal?.id || null), [opened, setOpened] = useState('');
  const meals = [...saved[owner].values()].filter(entry => entry.status === 'completed').map(entry => entry.meal);
  const count = params.get('count') === '0' ? 0 : params.get('count') === '1' ? 1 : 300;
  const items = Array.from({ length: count }, (_, index) => ({ id: 'synthetic_signal_' + index, type: 'food', date: '2026-11-08', time: '12:00', title: 'Synthetic signal ' + (index + 1), body: 'Retained timestamp and detail ' + (index + 1), calories: index + 1 }));
  return <div className="cc-app" data-appearance={params.get('theme') === 'caribbean' ? 'caribbean' : 'rose'}><main style={{ maxWidth: 900, padding: 16, margin: 'auto' }}><p>Isolated synthetic photo preview. No real uploads or provider calls.</p>{session.identity && <AccountPhotoMeal key={session.generation} onSaved={() => { fixture.savedCallbacks += 1; savedVersion(value => value + 1); }}/>}
    {layout && <>
      {meals.map(meal => <button type="button" className="cc-secondary" key={meal.id} onClick={() => setSelectedMeal(meal.id)}>View saved meal</button>)}
      <SavedMealDialog mealId={selectedMeal} meals={[]} onSelect={setSelectedMeal} onClose={() => setSelectedMeal(null)}/>
      <section className="cc-card" aria-label="Today timeline"><h3>Timeline</h3><Timeline items={items} onOpen={item => setOpened(item.title)} onAll={() => setOpened('All signals history')}/></section>
      <p role="status">{opened}</p>
    </>}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
