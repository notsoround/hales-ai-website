// Opening Today sends a burst of account reads. The proxy (nginx limit_req, burst 20 per address)
// answers the excess with a bare 429 that never reaches Cupcake. Those reads must be resent after
// a short wait instead of leaving Today empty. All data is synthetic.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/components/cupcake/accountSession.ts', 'utf8');
const calls = [];
let script = [];
const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const html = status => ({ status, ok: false, json: async () => { throw new SyntaxError('Unexpected token <'); } });
const fetch = async (url, init) => { calls.push({ route: url.replace('https://automate.hales.ai/api/account/', ''), body: init.body ? JSON.parse(init.body) : undefined }); const next = script.shift(); assert.ok(next, 'unexpected extra request'); return next(); };
const storage = new Map();
const context = { exports: {}, fetch, setTimeout, clearTimeout, AbortController, DOMException, JSON, Math, Error, Set, Map, Promise, URL,
  window: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} }, CustomEvent: class {}, Event: class { constructor(type) { this.type = type; } }, crypto: { randomUUID: () => 'synthetic-uuid' },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
  require: name => name.startsWith('./accountMode') ? { ACCOUNT_SESSIONS: true, ACCOUNT_UNAVAILABLE: 'unavailable' } : {} };
vm.createContext(context);
vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
const session = context.exports;
const identity = { account_id: 'acc_synthetic_owner', email: 'owner@example.invalid', name: 'Synthetic Owner' };

// Pure policy.
assert.equal(session.edgeThrottleRetryDelay('data', 429, null, 0, () => 0), 400);
assert.equal(session.edgeThrottleRetryDelay('data', 429, null, 3, () => 0), 3500);
assert.equal(session.edgeThrottleRetryDelay('data', 429, null, 4, () => 0), null, 'gives up after four waits');
assert.equal(session.edgeThrottleRetryDelay('data', 429, { ok: false, error: 'web_search_daily_limit' }, 0), null, 'a Cupcake 429 is an answer, not edge throttling');
assert.equal(session.edgeThrottleRetryDelay('sign-in', 429, null, 0), null, 'credentials are never resent automatically');
assert.equal(session.edgeThrottleRetryDelay('recovery/redeem', 429, null, 0), null);
assert.equal(session.edgeThrottleRetryDelay('data', 503, null, 0), null);

// Sign in (restore), then a Today read that is throttled twice at the edge.
script = [() => json(200, { ok: true, identity })];
await session.restoreSession();
assert.equal(session.sessionSnapshot().identity.account_id, identity.account_id);
const meal = { id: 'meal_' + '1'.padStart(32, '0'), description: 'Synthetic evening plate', consumedAt: '2026-11-19T02:13:26+00:00', sheetLoggedAt: '2026-11-19T02:13:45Z', countedInTotals: true, total: { calories: 180 } };
script = [() => html(429), () => html(429), () => json(200, { ok: true, meals: [meal], total: 1, pendingCount: 0, undatedLoggedCount: 0, nextCursor: null, identity })];
calls.length = 0;
const started = Date.now();
const history = await session.accountData({ action: 'food_history', limit: 200 });
assert.equal(history.meals[0].total.calories, 180, 'the throttled read still returns the 8:13 PM CT meal');
assert.equal(calls.length, 3); assert.ok(calls.every(c => c.route === 'data' && c.body.action === 'food_history'));
assert.ok(Date.now() - started >= 1300, 'it waited before resending');

// Persistent edge throttling still ends in the existing message, after four waits.
script = Array.from({ length: 5 }, () => () => html(429)); calls.length = 0;
await assert.rejects(session.accountData({ action: 'feed_get', start: '2026-11-18', end: '2026-11-18' }), /Too many attempts/);
assert.equal(calls.length, 5);

// A Cupcake JSON 429 is not resent.
script = [() => json(429, { ok: false, error: 'web_search_daily_limit' })]; calls.length = 0;
await assert.rejects(session.accountData({ action: 'food_history', limit: 200 }), /10 web searches/);
assert.equal(calls.length, 1);
console.log('PASS account-edge-throttle: bare proxy 429s are resent with backoff (max 4), Cupcake 429s and credentials are not. All data synthetic.');
