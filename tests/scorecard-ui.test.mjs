import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as dashboardModel from '../src/components/cupcake/dashboardModel.ts';

const fixedNow = '2026-09-20T02:30:00Z'; // Still September 19 in Chicago.
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return new Date(fixedNow).getTime(); }
}
const sameDeps = (a, b) => !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const node = (type, props, key) => ({ type, props: props || {}, key });
const text = element => element == null || typeof element === 'boolean' ? '' : typeof element !== 'object' ? String(element) : Array.isArray(element) ? element.map(text).join('') : text(element.props?.children);
function all(element, predicate) {
  if (element == null || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(child => all(child, predicate));
  return [...(predicate(element) ? [element] : []), ...all(element.props?.children, predicate)];
}
function one(element, predicate) { const found = all(element, predicate); assert.equal(found.length, 1, 'expected exactly one control'); return found[0]; }
const button = (element, name) => one(element, item => item.type === 'button' && text(item) === name);
const labelInput = (element, label) => one(one(element, item => item.type === 'label' && text(item).startsWith(label)), item => ['input', 'textarea'].includes(item.type));
const change = (control, value) => control.props.onChange({ target: { value }, currentTarget: { value } });

// Execute the component's real render and event handlers with deterministic hook state.
// API, image decoding, clock and DOM are synthetic; no browser permission or network is used.
function surface(file, props, { api = async () => { throw Error('Unexpected API request'); }, extra = {} } = {}) {
  const slots = []; let cursor = 0, pendingEffects = [], dirty = true, tree;
  const useMemo = (factory, deps) => { const i = cursor++; if (!slots[i] || !sameDeps(slots[i].deps, deps)) slots[i] = { value: factory(), deps }; return slots[i].value; };
  const hooks = {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, update => { const value = typeof update === 'function' ? update(slots[i].value) : update; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: initial } }; return slots[i].value; },
    useMemo,
    useCallback: (callback, deps) => useMemo(() => callback, deps),
    useEffect(effect, deps) { const i = cursor++; if (!slots[i] || !sameDeps(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps, cleanup: previous?.cleanup }; pendingEffects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); }); } },
  };
  const emptyComponent = () => null;
  const context = {
    exports: {}, Date: FixtureDate, Intl, URL, URLSearchParams, setInterval, clearInterval,
    location: { search: '', href: 'https://fixture.invalid/cupcake' }, history: { replaceState() {} },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'fragment' };
      if (name === 'lucide-react') return new Proxy({}, { get: () => emptyComponent });
      if (name === './WeightHistoryConnected') return { WeightHistoryConnected: emptyComponent };
      if (name === './weightApi') return { loadWeightPage: async () => ({ latestMeasurement: null }) };
      if (name === './weightHistoryModel') return { weightTime: String };
      if (name === './PersonalOutcomes') return { PersonalOutcomes: emptyComponent };
      if (name === './dashboardModel') return dashboardModel;
      if (name === './library') return { libraryRequest: api };
      if (name.endsWith('.css')) return {};
      if (['./ConnectionCheck', './StrategyRequests', './PlanningWorkspace', './ReceiptWorkspace', './ConversationPanel'].includes(name)) return { default: emptyComponent, AnalysisCard: emptyComponent };
      throw Error(`Unexpected fixture dependency ${name}`);
    },
    ...extra,
  };
  vm.createContext(context);
  const source = readFileSync(`src/components/cupcake/${file}`, 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  const Component = context.exports.default || context.exports.FeedDashboard || context.exports.PersonalOutcomes;
  function render() { cursor = 0; pendingEffects = []; dirty = false; tree = Component(props); pendingEffects.forEach(effect => effect()); return tree; }
  return {
    context, render, get tree() { return tree; },
    async settle() { for (let i = 0; i < 20; i++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); if (!dirty) return tree; } throw Error('Fixture did not settle'); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}


const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const emptyStats = range => ({ range, totals: { calories: 0, spend: 0 }, series: [], entries: [] });
async function dashboardPaging() {
  const later = deferred(); const calls = [];
  const meal = id => ({ id, date: '2026-09-19', type: 'food', title: id });
  const app = surface('DashboardView.tsx', { loadStats: async (range, cursor) => {
    calls.push({ ...range, cursor });
    if (cursor) return later.promise;
    return { ...emptyStats(range), entries: [meal('one')], nextCursor: 'next', totalCount: 2 };
  } });
  await app.settle();
  const personal = one(app.tree, item => item.props.refreshKey !== undefined);
  const initialRefreshKey = personal.props.refreshKey;
  assert.equal(calls[0].end, '2026-09-19', 'dashboard uses Chicago day even when UTC is the following day');
  assert.equal(calls[0].start, '2026-09-13', 'seven day range includes today and the six preceding dates');
  button(app.tree, '0Est. calories logged · View food').props.onClick(); await app.settle();
  assert.deepEqual(Array.from(app.tree.props.entries, e => e.id), ['one']);
  app.tree.props.onMore(); app.tree.props.onMore(); await app.settle();
  assert.equal(calls.filter(c => c.cursor).length, 1, 'double clicks share one pagination request');
  later.resolve({ ...emptyStats(calls[0]), entries: [meal('one'), meal('two'), meal('two')], nextCursor: null });
  await app.settle();
  assert.deepEqual(Array.from(app.tree.props.entries, e => e.id), ['one', 'two'], 'open food drilldown updates after loading older records');
  app.tree.props.onBack(); await app.settle();
  assert.equal(one(app.tree, item => item.props.refreshKey !== undefined).props.refreshKey, initialRefreshKey, 'feed pagination never resets personal outcomes');
  button(app.tree, 'Custom').props.onClick(); await app.settle();
  const before = calls.length;
  change(labelInput(app.tree, 'From'), ''); await app.settle();
  assert.equal(calls.length, before, 'clearing a custom date does not trigger an invalid API call');
  assert.match(text(app.tree), /Choose valid dates/);
  app.unmount();
}
async function personalPaging() {
  const counts = { wins: 1, losses: 1, unscored: 0, total: 2 };
  const entry = (id, outcome) => ({ id, outcome, date: '2026-09-19', title: id, metrics: {}, source: { description: 'Synthetic' }, note: '' });
  const props = { range: { preset: 'week', start: '2026-09-13', end: '2026-09-19' }, refreshKey: 1 };
  const app = surface('PersonalOutcomes.tsx', props, { api: async body => ({ counts, entries: body.cursor ? [entry('win', 'win'), entry('win', 'win')] : [entry('loss', 'loss')], nextCursor: body.cursor ? null : 'next' }) });
  await app.settle();
  assert.match(text(app.tree), /50% reported wins/);
  button(app.tree, '1Personal wins · your report').props.onClick(); await app.settle();
  assert.match(text(app.tree), /0 of 1 personal wins loaded/);
  assert.match(text(app.tree), /Matching outcomes are on older pages/);
  button(app.tree, 'Load older personal outcomes').props.onClick(); await app.settle();
  assert.match(text(app.tree), /1 of 1 personal wins loaded/);
  assert.equal(all(app.tree, item => item.type === 'button' && item.props.className === 'cc-dashboard-entry').length, 1);
  app.unmount();
}
async function stalePageError() {
  const old = deferred();
  const app = surface('DashboardView.tsx', { loadStats: async (range, cursor) => cursor ? old.promise : { ...emptyStats(range), nextCursor: range.preset === 'week' ? 'old' : null } });
  await app.settle();
  button(app.tree, 'Load older records').props.onClick(); await app.settle();
  button(app.tree, 'Last 30 days').props.onClick(); await app.settle();
  old.reject(Error('Stale range failed')); await app.settle();
  assert.doesNotMatch(text(app.tree), /Stale range failed/, 'old pagination cannot add an error to the new date range');
  app.unmount();
}
async function phoneTotalsAndDrilldown() {
  const win = { id: 'win', type: 'intervention', date: '2026-09-19', title: 'Reported stop', details: { outcome: 'no_answer', ownerUpdated: true, ownerPurchaseChoice: 'no', boughtAnyway: false } };
  const loss = { id: 'loss', type: 'intervention', date: '2026-09-19', title: 'Purchase', details: { boughtAnyway: true } };
  const app = surface('DashboardView.tsx', { loadStats: async (range, cursor) => ({ ...emptyStats(range), outcomes: { wins: 1, losses: 1, missed: 0, unscored: 0, interventions: 2 }, entries: cursor ? [win] : [loss], nextCursor: cursor ? null : 'next' }) });
  await app.settle();
  assert.match(text(app.tree), /Phone intervention win rate50% recorded wins/);
  button(app.tree, '1Times you won · recorded stops').props.onClick(); await app.settle();
  assert.equal(app.tree.props.total, 1);
  assert.equal(app.tree.props.entries.length, 0, 'loaded page does not invent the not-yet-loaded win');
  assert.equal(app.tree.props.hasMore, true);
  app.tree.props.onMore(); await app.settle();
  assert.equal(app.tree.props.entries[0].id, 'win');
  assert.equal(app.tree.props.total, 1, 'loading the entry does not inflate full-range count');
  assert.equal(app.tree.props.hasMore, false);
  app.unmount();
}
await dashboardPaging();
await personalPaging();
await phoneTotalsAndDrilldown();
await stalePageError();
console.log('PASS scorecard UI: live drilldowns, page dedupe, no duplicate requests, independent personal refresh, category counts, valid dates and stale-page isolation. Synthetic fixtures only.');
