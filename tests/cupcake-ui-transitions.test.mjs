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
  const Component = context.exports.default || context.exports.FeedDashboard;
  function render() { cursor = 0; pendingEffects = []; dirty = false; tree = Component(props); pendingEffects.forEach(effect => effect()); return tree; }
  return {
    context, render, get tree() { return tree; },
    async settle() { for (let i = 0; i < 20; i++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); if (!dirty) return tree; } throw Error('Fixture did not settle'); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

async function dateTransitions() {
  const requests = [];
  const app = surface('DashboardView.tsx', { loadStats: async range => { requests.push({ ...range }); return { range, totals: { calories: 0, spend: 0 }, series: [], entries: [] }; } });
  await app.settle();
  button(app.tree, 'Custom').props.onClick(); await app.settle();
  change(labelInput(app.tree, 'From'), '2026-08-20');
  change(labelInput(app.tree, 'Through'), '2026-08-31'); await app.settle();
  assert.deepEqual(requests.at(-1), { preset: 'custom', start: '2026-08-20', end: '2026-08-31', timezone: 'America/Chicago' });
  for (const [label, preset, start] of [['Last 7 days', 'week', '2026-09-13'], ['Last 30 days', 'month', '2026-08-21'], ['Day', 'day', '2026-09-19']]) {
    button(app.tree, label).props.onClick(); await app.settle();
    assert.deepEqual(requests.at(-1), { preset, start, end: '2026-09-19', timezone: 'America/Chicago' }, `${label} returns to the current Chicago date`);
  }
  button(app.tree, 'Custom').props.onClick(); await app.settle();
  assert.equal(labelInput(app.tree, 'From').props.value, '2026-08-20');
  assert.equal(labelInput(app.tree, 'Through').props.value, '2026-08-31', 'custom dates survive using relative presets');
  app.unmount();
}

async function receiptTransitions() {
  const a = { id: 'fixture_a', status: 'extracted', createdAt: fixedNow, merchant: 'Fixture A', date: '2026-09-19', currency: 'USD', total: 10, tax: null, tip: null, lineItems: [], matchedTransactionId: null };
  const b = { ...a, id: 'fixture_b', merchant: 'Fixture B', total: 20 };
  const revoked = []; let rejectExtraction = false;
  const app = surface('ReceiptWorkspace.tsx', { active: true }, {
    api: async body => {
      if (body.action === 'receipt_list') return { receipts: [a, b] };
      if (body.action === 'receipt_extract') { if (rejectExtraction) throw Error('Synthetic extraction failure'); return { receipt: a, duplicate: false }; }
      throw Error(`Unexpected receipt action ${body.action}`);
    },
    extra: { URL: { revokeObjectURL: url => revoked.push(url) }, __imageData: async file => ({ url: 'synthetic:image', preview: `blob:${file.name}` }) },
  });
  vm.runInContext('imageData = __imageData;', app.context);
  await app.settle();
  const choose = name => {
    const input = one(app.tree, item => item.type === 'input' && item.props.accept === 'image/jpeg,image/png,image/webp');
    input.props.onChange({ target: { files: [{ name }] }, currentTarget: { value: name } });
  };
  choose('fixture-a'); await app.settle();
  assert.equal(one(app.tree, item => item.type === 'img').props.src, 'blob:fixture-a');
  assert.ok(all(app.tree, item => item.type === 'h3').some(item => text(item) === 'Fixture A'));
  const savedB = one(app.tree, item => item.type === 'button' && item.props.className === 'cc-library-item' && text(item).includes('Fixture B'));
  savedB.props.onClick(); await app.settle();
  assert.equal(all(app.tree, item => item.type === 'img').length, 0, 'saved B never shows A\'s transient photo');
  assert.ok(all(app.tree, item => item.type === 'h3').some(item => text(item) === 'Fixture B'));
  assert.deepEqual(revoked, ['blob:fixture-a'], 'stale object URL is released');
  rejectExtraction = true; choose('fixture-failed'); await app.settle();
  assert.equal(one(app.tree, item => item.type === 'img').props.src, 'blob:fixture-failed');
  assert.ok(!all(app.tree, item => item.type === 'h3').some(item => text(item) === 'Fixture B'), 'a failed new image never appears beside an older saved receipt');
  app.unmount();
  assert.deepEqual(revoked, ['blob:fixture-a', 'blob:fixture-failed'], 'latest preview released on unmount');
}

async function projectTransitions() {
  const project = { id: 'fixture_project', name: 'Fixture project', description: 'Original description', status: 'active', sourceUrl: 'https://fixture.invalid/project', tags: ['keep topic', 'comma, inside tag'] };
  const saves = []; let failSave = true;
  const app = surface('LibraryWorkspace.tsx', { active: true, onOpenRecording() {}, onWork() {} }, { api: async body => {
    if (body.action === 'list') return { documents: [], projects: [project] };
    if (body.action === 'project_save') { saves.push(JSON.parse(JSON.stringify(body))); if (failSave) throw Error('Synthetic save failure'); return { project }; }
    throw Error(`Unexpected project action ${body.action}`);
  } });
  await app.settle(); button(app.tree, 'Projects').props.onClick(); await app.settle();
  button(app.tree, 'Edit project').props.onClick(); await app.settle();
  assert.equal(labelInput(app.tree, 'Project name').props.maxLength, 120, 'name limit matches the server');
  change(labelInput(app.tree, "What it does, what exists, and what's blocked"), 'Description changed only'); await app.settle();
  button(app.tree, 'Save project').props.onClick(); await app.settle();
  assert.deepEqual(saves.at(-1).tags, project.tags, 'failed save does not clear tags');
  failSave = false; button(app.tree, 'Save project').props.onClick(); await app.settle();
  assert.deepEqual(saves.at(-1), { action: 'project_save', id: project.id, name: project.name, description: 'Description changed only', status: project.status, sourceUrl: project.sourceUrl, tags: project.tags });
  assert.ok(text(app.tree).includes('Project updated.'), 'editing is reported as an update');
  button(app.tree, 'Add project').props.onClick(); await app.settle();
  change(labelInput(app.tree, 'Project name'), 'Fresh fixture project'); await app.settle();
  button(app.tree, 'Save project').props.onClick(); await app.settle();
  assert.deepEqual(saves.at(-1).tags, [], 'new project does not inherit the previous project topics');
  assert.equal(saves.at(-1).id, undefined);
  app.unmount();
}

await dateTransitions();
await receiptTransitions();
await projectTransitions();
console.log('PASS actual UI transitions: custom dates ↔ Chicago-relative presets; receipt identity/preview cleanup; project tag preservation through edit and retry; new-project isolation. Synthetic data only.');
