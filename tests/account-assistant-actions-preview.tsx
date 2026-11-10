/* eslint-disable react-refresh/only-export-components -- Isolated synthetic development fixture. */
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { QuickChat } from '../src/components/cupcake/QuickChat';
import { AccountFoodPlan } from '../src/components/cupcake/AccountFoodPlan';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { AccountLabsSettings } from '../src/components/cupcake/AccountLabsSettings';
import '../src/index.css';
import '../src/components/cupcake/design/tokens.css';
import '../src/components/cupcake/design/cupcake-theme.css';
import '../src/components/cupcake/account-base.css';

if (!import.meta.env.DEV) throw Error('Synthetic assistant suggestions preview is development only.');
const identity = { account_id: 'acc_suggest_a', email: 'a@example.invalid', name: 'Synthetic A' };
type Turn = { id: string; text: string; status: string; retryAfter: number; error?: string; response?: { reply: string; model: string } };
const threads = new Map<string, { id: string; title: string; turns: Turn[] }>();
const saved = { meals: new Map<string, unknown>(), exercise: new Map<string, unknown>(), weights: new Map<string, unknown>(), outcomes: new Map<string, unknown>() };
const fixture = { requests: [] as Record<string, unknown>[], blocked: [] as string[], replies: [] as string[], failNext: '' as string,
  plan: { title: 'Synthetic week', meals: [{ name: 'Mon dinner', items: ['salmon', 'rice'] }], groceries: '- [ ] Oats\n- [x] Rice' } as Record<string, unknown> | null,
  answer() { for (const thread of threads.values()) for (const turn of thread.turns) if (turn.status === 'queued') { turn.status = 'completed'; turn.response = { reply: fixture.replies.shift() || 'Okay.', model: 'synthetic' }; } },
  saved };
(window as unknown as { suggestFixture: typeof fixture }).suggestFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  const body = JSON.parse(String(init?.body || '{}')), response = (data: object, status = 200) => Response.json({ ok: status < 400, ...data, identity }, { status });
  if (url.href === 'https://automate.hales.ai/api/account/session') return response({});
  if (url.href !== 'https://automate.hales.ai/api/account/data') { fixture.blocked.push(url.href); throw Error('External networking forbidden.'); }
  fixture.requests.push(body);
  if (fixture.failNext && body.action === fixture.failNext) { fixture.failNext = ''; return response({ error: 'synthetic_failure' }, 500); }
  switch (body.action) {
    case 'quick_chat_list': return response({ threads: [...threads.values()].map(t => ({ id: t.id, title: t.title })) });
    case 'quick_chat_create': threads.set(body.threadId, { id: body.threadId, title: body.title, turns: [] }); return response({ thread: structuredClone(threads.get(body.threadId)) });
    case 'quick_chat_begin': { const thread = threads.get(body.threadId)!; thread.turns.push({ id: body.turnId, text: body.text, status: 'queued', retryAfter: 0 }); return response({ thread: structuredClone(thread), acquired: true, execution: 'server' }); }
    case 'quick_chat_get': return response({ thread: structuredClone(threads.get(body.threadId)) });
    case 'coach_plan_get': return response({ plan: fixture.plan ? { meal_plan: fixture.plan } : {} });
    case 'coach_plan_set': {
      if (JSON.stringify(body.expected_value) !== JSON.stringify(fixture.plan)) return response({ error: 'plan_conflict' }, 409);
      fixture.plan = body.value; return response({ meal_plan: body.value });
    }
    case 'food_manual_log': { const replayed = saved.meals.has(body.dedupeKey); saved.meals.set(body.dedupeKey, body); return response({ meal: { id: 'meal_' + body.dedupeKey }, matchesRequest: true, replayed }); }
    case 'exercise_log': { const replayed = saved.exercise.has(body.requestId); saved.exercise.set(body.requestId, body); return response({ entry: { id: body.requestId }, replayed }); }
    case 'weight_add': { const replayed = saved.weights.has(body.requestId); saved.weights.set(body.requestId, body); return response({ entry: { id: body.requestId }, replayed }); }
    case 'outcome_record': { saved.outcomes.set(body.id, body); return response({ entry: { id: body.id } }); }
  }
  throw Error('Unexpected synthetic action ' + body.action);
};
await restoreSession();
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  return <div className="cc-app" data-appearance="rose" data-entry="account"><main style={{ maxWidth: 900, margin: 'auto', padding: 16 }}><p>Isolated synthetic assistant suggestions. No live chat, records or providers.</p>{session.identity && <><section aria-label="Labs settings"><AccountLabsSettings/></section><QuickChat speak={false} mediaBusy={false}/><section aria-label="Groceries preview"><AccountFoodPlan section="groceries" onPlan={() => {}}/></section></>}</main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
