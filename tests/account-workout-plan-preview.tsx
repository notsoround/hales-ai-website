/* eslint-disable react-refresh/only-export-components -- Isolated synthetic development fixture. */
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { AccountLabsSettings } from '../src/components/cupcake/AccountLabsSettings';
import { AccountWorkoutPlan } from '../src/components/cupcake/AccountWorkoutPlan';
import '../src/pages/cupcake/sandbox/cupcakegpt/page'; // Account styles, as in the app.
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic workout plan preview is development only.');
const identity = { account_id: 'acc_labs_w', email: 'w@example.invalid', name: 'Synthetic W' };
type Turn = { id: string; text: string; status: string; response?: { reply: string; model: string } };
const threads = new Map<string, { id: string; title: string; turns: Turn[] }>();
const fixture = { requests: [] as Record<string, unknown>[], blocked: [] as string[], replies: [] as string[], mode: 'normal' as 'normal' | 'notReady',
  plan: JSON.parse(sessionStorage.getItem('synthetic-workout') || 'null') as unknown,
  meal: { meals: [{ name: 'Synthetic lunch', kcal: 500, items: ['Rice'] }] },
  answer() { for (const thread of threads.values()) for (const turn of thread.turns) if (turn.status === 'queued') { turn.status = 'completed'; turn.response = { reply: fixture.replies.shift() || 'No plan.', model: 'synthetic' }; } } };
(window as unknown as { workoutFixture: typeof fixture }).workoutFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  const body = JSON.parse(String(init?.body || '{}')), response = (data: object, status = 200) => Response.json({ ok: status < 400, ...data, identity }, { status });
  if (url.href === 'https://automate.hales.ai/api/account/session') return response({});
  if (url.href !== 'https://automate.hales.ai/api/account/data') { fixture.blocked.push(url.href); throw Error('External networking forbidden.'); }
  fixture.requests.push(body);
  if (body.action === 'coach_plan_get') return response({ plan: { meal_plan: fixture.meal, ...(fixture.plan ? { workout_template: fixture.plan } : {}) } });
  if (body.action === 'coach_plan_set') { if (body.kind !== 'workout_template') return response({ error: 'wrong kind' }, 400); fixture.plan = body.value; sessionStorage.setItem('synthetic-workout', JSON.stringify(body.value)); return response({ workout_template: body.value }); }
  if (String(body.action).startsWith('quick_chat_') && fixture.mode === 'notReady') return response({ error: 'account_action_not_ready' }, 503);
  if (body.action === 'quick_chat_create') { threads.set(body.threadId, { id: body.threadId, title: body.title, turns: [] }); return response({ thread: threads.get(body.threadId) }); }
  if (body.action === 'quick_chat_begin') { const thread = threads.get(body.threadId)!; thread.turns.push({ id: body.turnId, text: body.text, status: 'queued' }); return response({ thread: structuredClone(thread), acquired: true, execution: 'server' }); }
  if (body.action === 'quick_chat_get') return threads.has(body.threadId) ? response({ thread: structuredClone(threads.get(body.threadId)) }) : response({ error: 'not_found' }, 404);
  throw Error('Unexpected synthetic action ' + body.action);
};
await restoreSession();
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  return <div className="cc-app" data-appearance="rose" data-entry="account"><main style={{ maxWidth: 900, margin: 'auto', padding: 16 }}><p>Isolated synthetic workout plan. No live chat, plans or providers.</p>{session.identity && <><section aria-label="Labs settings"><AccountLabsSettings/></section><AccountWorkoutPlan/></>}</main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
