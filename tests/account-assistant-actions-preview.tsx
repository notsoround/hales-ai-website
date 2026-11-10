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
  saved, workoutPlan: null as unknown, settings: { calorieTarget: 2200, expenditureEstimate: 2600, effectiveFrom: '2026-01-01' } as Record<string, unknown>,
  meals: [{ id: 'meal_syn_a1', status: 'logged', description: 'Synthetic burrito bowl', consumedAt: new Date(Date.now() - 3 * 3600000).toISOString(), total: { calories: 900 }, portion: { editable: true, fraction: 1 } as Record<string, unknown> }, { id: 'meal_syn_old', status: 'logged', description: 'Synthetic sheet-era meal', consumedAt: new Date(Date.now() - 86400000).toISOString(), total: { calories: 400 }, portion: { editable: false } as Record<string, unknown> }] as Array<Record<string, unknown> & { id: string; portion: Record<string, unknown>; total: Record<string, unknown> }>,
  workouts: [{ id: 'ex_syn0001aaaa', description: 'Synthetic walk logged by mistake', performedAt: new Date(Date.now() - 7200000).toISOString(), minutes: 30, kcal: 150, basis: 'local-met' }] as Array<Record<string, unknown> & { id: string }>,
  links: [{ id: 'lnk_syn_77', day: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date()), merchant: 'Synthetic Coffee Co', amount: 6.4, status: 'pending' }] as Array<Record<string, unknown> & { id: string }> };
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
    case 'coach_plan_get': return response({ plan: { ...(fixture.plan ? { meal_plan: fixture.plan } : {}), ...(fixture.workoutPlan ? { workout_template: fixture.workoutPlan } : {}) } });
    case 'coach_plan_set': {
      if (body.kind === 'meal_plan' && JSON.stringify(body.expected_value) !== JSON.stringify(fixture.plan)) return response({ error: 'plan_conflict' }, 409);
      if (body.kind === 'workout_template') { fixture.workoutPlan = body.value; return response({ workout_template: body.value }); }
      fixture.plan = body.value; return response({ meal_plan: body.value });
    }
    case 'food_manual_log': { const replayed = saved.meals.has(body.dedupeKey); saved.meals.set(body.dedupeKey, body); return response({ meal: { id: 'meal_' + body.dedupeKey }, matchesRequest: true, replayed }); }
    case 'exercise_log': { const replayed = saved.exercise.has(body.requestId); saved.exercise.set(body.requestId, body); return response({ entry: { id: body.requestId }, replayed }); }
    case 'weight_add': { const replayed = saved.weights.has(body.requestId); saved.weights.set(body.requestId, body); return response({ entry: { id: body.requestId }, replayed }); }
    case 'glucose_add': return response({ entry: { id: body.requestId }, replayed: false });
    case 'food_settings_get': return response({ settings: fixture.settings });
    case 'food_settings_save': { fixture.settings = { calorieTarget: body.calorieTarget, expenditureEstimate: body.expenditureEstimate, effectiveFrom: body.effectiveFrom }; return response({ settings: fixture.settings }); }
    case 'food_list': return response({ meals: fixture.meals });
    case 'food_get': { const meal = fixture.meals.find(m => m.id === body.mealId); return meal ? response({ meal }) : response({ error: 'meal_not_found' }, 404); }
    case 'food_portion_set': { const meal = fixture.meals.find(m => m.id === body.mealId)!; meal.portion = { editable: true, fraction: body.fraction }; meal.total = { calories: Math.round(900 * body.fraction) }; return response({ meal, unchanged: false }); }
    case 'exercise_list': return response({ entries: fixture.workouts });
    case 'exercise_delete': { const before = fixture.workouts.length; fixture.workouts = fixture.workouts.filter(w => w.id !== body.id); return response({ deleted: fixture.workouts.length < before, id: body.id }); }
    case 'reconcile_list': return response({ links: fixture.links, spend_total: 0 });
    case 'reconcile_resolve': { const link = fixture.links.find(l => l.id === body.id); if (!link) return response({ error: 'Link not found' }, 400); link.status = body.status; return response({ resolved: true }); }
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
