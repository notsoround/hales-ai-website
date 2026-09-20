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

const requests=[];
const app=surface('LibraryWorkspace.tsx',{active:true,onOpenRecording(){},onWork(){}},{api:async body=>{requests.push(body);if(body.action==='list')return body.sourceFilter==='channel-messages'?{documents:[{id:'doc_synthetic',title:'Synthetic',createdAt:'2026-09-20T00:00:00Z',status:'ready',speakerRole:'assistant',sourceApp:'Cupcake Telegram conversation',excerpt:'Synthetic excerpt'}],browseTotal:510}:{documents:[],projects:[],browseTotal:0,libraryTotal:510,hasMore:false};throw Error('Unexpected request');}});
await app.settle();assert.equal(requests[0].sourceFilter,'artifacts');
button(app.tree,'Channel messages').props.onClick();await app.settle();
assert.equal(requests.at(-1).sourceFilter,'channel-messages');assert.match(text(app.tree),/1 shown of 510 channel messages/);assert.match(text(app.tree),/Cupcake · AI/);assert.match(text(app.tree),/Continue the conversation in Telegram or WhatsApp/);
one(app.tree,item=>item.type==='button'&&item.props['aria-label']==='Refresh channel messages').props.onClick();await app.settle();assert.equal(requests.filter(x=>x.sourceFilter==='channel-messages').length,2);
app.unmount();console.log('Channel message view and refresh passed');
