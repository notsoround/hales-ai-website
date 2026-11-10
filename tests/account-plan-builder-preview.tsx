/* eslint-disable react-refresh/only-export-components -- Isolated synthetic development fixture. */
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { SnapView } from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { AccountLabsSettings } from '../src/components/cupcake/AccountLabsSettings';
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic plan builder preview is development only.');
const identity = { account_id: 'acc_labs_a', email: 'a@example.invalid', name: 'Synthetic A' };
type Turn = { id: string; text: string; status: string; error?: string; response?: { reply: string; model: string } };
// The synthetic server survives a page reload (like a real server) through this tab's sessionStorage.
const threads = new Map<string, { id: string; title: string; turns: Turn[] }>(JSON.parse(sessionStorage.getItem('synthetic-server-threads') || '[]'));
const persist = () => sessionStorage.setItem('synthetic-server-threads', JSON.stringify([...threads]));
const fixture = { requests: [] as Record<string, unknown>[], blocked: [] as string[], plan: null as unknown, replies: [] as string[], mode: 'normal' as 'normal' | 'notReady' | 'fail',
  answer() { for (const thread of threads.values()) for (const turn of thread.turns) if (turn.status === 'queued') { if (fixture.mode === 'fail') { turn.status = 'failed'; turn.error = 'provider_rejected'; } else { turn.status = 'completed'; turn.response = { reply: fixture.replies.shift() || 'No plan.', model: 'synthetic' }; } } persist(); } };
(window as unknown as { labsFixture: typeof fixture }).labsFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  const body = JSON.parse(String(init?.body || '{}')), response = (data: object, status = 200) => Response.json({ ok: status < 400, ...data, identity }, { status });
  if (url.href === 'https://automate.hales.ai/api/account/session') return response({});
  if (url.href !== 'https://automate.hales.ai/api/account/data') { fixture.blocked.push(url.href); throw Error('External networking forbidden.'); }
  fixture.requests.push(body); queueMicrotask(persist);
  if (body.action === 'food_list') return response({ meals: [] });
  if (body.action === 'food_history') return response({ meals: [], total: 0, pendingCount: 0, undatedLoggedCount: 0, hasMore: false });
  if (body.action === 'food_settings_get') return response({ settings: { calorieTarget: null, expenditureEstimate: null, effectiveFrom: null } });
  if (body.action === 'coach_plan_get') return response({ plan: fixture.plan ? { meal_plan: fixture.plan } : {} });
  if (body.action === 'coach_plan_set') { fixture.plan = body.value; return response({ meal_plan: body.value }); }
  if (String(body.action).startsWith('quick_chat_') && fixture.mode === 'notReady') return response({ error: 'account_action_not_ready' }, 503);
  if (body.action === 'quick_chat_create') { threads.set(body.threadId, { id: body.threadId, title: body.title, turns: [] }); return response({ thread: threads.get(body.threadId) }); }
  if (body.action === 'quick_chat_begin') { const thread = threads.get(body.threadId)!; thread.turns.push({ id: body.turnId, text: body.text, status: 'queued' }); return response({ thread: structuredClone(thread), acquired: true, execution: 'server' }); }
  if (body.action === 'quick_chat_get') return threads.has(body.threadId) ? response({ thread: structuredClone(threads.get(body.threadId)) }) : response({ error: 'not_found' }, 404);
  throw Error('Unexpected synthetic action ' + body.action);
};
await restoreSession();
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  return <div className="cc-app" data-appearance="rose" data-entry="account"><main style={{ maxWidth: 900, margin: 'auto', padding: 16 }}><p>Isolated synthetic plan builder. No live chat, plans or providers.</p>{session.identity && <><section aria-label="Labs settings"><AccountLabsSettings/></section><SnapView key={session.generation}/></>}</main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
