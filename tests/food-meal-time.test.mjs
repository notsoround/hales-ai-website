import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { localMealDate, parseMealTime } from '../src/components/cupcake/mealTime.ts';

process.env.TZ = 'America/Chicago';
const fixedNow = '2026-09-29T05:05:00.000Z'; // 12:05 AM locally, after UTC midnight.
const now = new Date(fixedNow);
const fields = { month: '9', day: '28', year: '2026', hour: '11', minute: '59', period: 'PM' };
assert.deepEqual(localMealDate(new Date('2026-09-29T00:30:00Z')), { month: '9', day: '28', year: '2026' });
assert.equal(parseMealTime(fields, now).consumedAt, '2026-09-29T04:59:00.000Z', 'late evening stays on its local day');
assert.equal(parseMealTime({ ...fields, day: '29', hour: '12', minute: '00', period: 'AM' }, now).consumedAt, '2026-09-29T05:00:00.000Z', '12 AM means local midnight');
assert.equal(parseMealTime({ ...fields, hour: '12', minute: '00' }, now).consumedAt, '2026-09-28T17:00:00.000Z', '12 PM means local noon');
for (const invalid of [{ minute: '' }, { hour: '0' }, { minute: '60' }, { month: '2', day: '30' }, { year: '26' }, { year: '1999' }, { period: 'oops' }, { day: '29', hour: '12', minute: '06', period: 'AM' }]) {
  const parsed = parseMealTime({ ...fields, ...invalid }, now);
  assert.equal(parsed.consumedAt, '', `invalid date/time is never usable: ${JSON.stringify(invalid)}`);
  assert.ok(parsed.error);
}
assert.equal(parseMealTime({ month: '3', day: '8', year: '2026', hour: '2', minute: '30', period: 'AM' }, now).consumedAt, '', 'reject nonexistent local time at spring daylight-saving transition');

class FixtureDate extends Date { constructor(...args) { super(...(args.length ? args : [fixedNow])); } static now() { return now.getTime(); } }
const element = (type, props) => ({ type, props: props || {} });
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
function all(node, test) { return node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(child => all(child, test)) : [...(test(node) ? [node] : []), ...all(node.props?.children, test)]; }
function one(tree, test) { const matches = all(tree, test); assert.equal(matches.length, 1); return matches[0]; }
const button = (tree, name) => one(tree, node => node.type === 'button' && text(node) === name);
const change = (control, value) => control.props.onChange({ target: { value } });
function surface(path, component, props, dependencies = {}) {
  const slots = []; let cursor = 0, dirty = true, effects = [], tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) { const i = cursor++; slots[i] ||= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; dirty = true; }]; },
    useRef(value) { const i = cursor++; slots[i] ||= { value: { current: value } }; return slots[i].value; },
    useId() { return `fixture-${cursor++}`; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { slots[i] = { deps }; effects.push(fn); } },
  };
  const context = { exports: {}, Date: FixtureDate, Intl, URL, URLSearchParams, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'fragment' };
    if (name === './mealTime') return { localMealDate, parseMealTime: f => parseMealTime(f, now) };
    if (name in dependencies) return dependencies[name];
    return {};
  } };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText + `\nexports.TestComponent = ${component};`, context);
  return { get tree() { return tree; }, async settle() { for (let i = 0; i < 20; i++) { if (dirty) { cursor = 0; effects = []; dirty = false; tree = context.exports.TestComponent(props); effects.forEach(fn => fn()); } await new Promise(resolve => setImmediate(resolve)); if (!dirty) return tree; } throw Error('Did not settle'); } };
}

// Real keyboard controls: no native date picker and no implicit default meal time.
let selected = '';
const picker = surface('src/components/cupcake/MealTimeInput.tsx', 'MealTimeInput', { value: '', onChange: value => { selected = value; } });
await picker.settle();
assert.equal(selected, '');
button(picker.tree, 'Ate just now').props.onClick(); await picker.settle();
assert.equal(selected, fixedNow);
button(picker.tree, 'Choose date & time').props.onClick(); await picker.settle();
assert.equal(selected, '', 'choosing a custom time requires entering a clock time');
const field = key => one(picker.tree, node => node.type === 'input' && node.props.id.endsWith(`-${key}`));
for (const [key, value] of [['month', '9'], ['day', '28'], ['year', '2026'], ['hour', '11'], ['minute', '59']]) { assert.equal(field(key).props.type, 'text'); assert.equal(field(key).props.inputMode, 'numeric'); change(field(key), value); await picker.settle(); }
change(one(picker.tree, node => node.type === 'select'), 'PM'); await picker.settle();
assert.equal(selected, '2026-09-29T04:59:00.000Z');
change(field('day'), '30'); await picker.settle();
assert.equal(selected, '', 'a future time cannot enable logging');
assert.match(text(picker.tree), /no later than now/);
change(field('minute'), ''); await picker.settle();
assert.equal(selected, '', 'clearing a required field clears the usable timestamp');

// Actual Snap actions against synthetic API responses; nothing goes to the network.
const MealTimeInput = () => null;
let meal = { id: 'synthetic_meal', status: 'ready', description: 'Synthetic rice bowl', total: { calories: 320, carbs_g: 48, sugar_g: 5, protein_g: 12 }, items: [{ id: 'synthetic_item', name: 'Synthetic rice', nutrition: { calories: 320, carbs_g: 48, sugar_g: 5 } }] };
let failFirstLog = true;
const requests = [];
const snap = surface('src/pages/cupcake/sandbox/cupcakegpt/page.tsx', 'SnapView', {}, {
  '../../../../components/cupcake/MealTimeInput': { MealTimeInput },
  '../../../../components/cupcake/library': { libraryRequest: async body => {
    requests.push(body);
    if (body.action === 'food_list') return { meals: [meal] };
    if (body.action === 'food_get') return { meal };
    if (body.action === 'food_refine') return { meal: { ...meal, description: 'Corrected synthetic rice bowl' } };
    if (body.action === 'food_log') { if (failFirstLog) { failFirstLog = false; throw Error('Synthetic uncertain save'); } meal = { ...meal, sheetLoggedAt: fixedNow }; return { meal }; }
    throw Error(`Unexpected request ${body.action}`);
  } },
});
await snap.settle();
one(snap.tree, node => node.type === 'button' && node.props.className === 'cc-snap-recent-item').props.onClick(); await snap.settle();
assert.match(text(snap.tree), /48 g total carbs · 5 g sugar/);
const consent = () => one(snap.tree, node => node.type === 'input' && node.props.type === 'checkbox');
const setTime = value => one(snap.tree, node => node.type === MealTimeInput).props.onChange(value);
assert.equal(button(snap.tree, 'Add to food log').props.disabled, true);
assert.equal(requests.filter(r => r.action === 'food_log').length, 0, 'opening a saved photo never logs it');
setTime('2026-09-29T04:59:00.000Z'); await snap.settle();
consent().props.onChange({ target: { checked: true } }); await snap.settle();
assert.equal(button(snap.tree, 'Add to food log').props.disabled, false);
change(one(snap.tree, node => node.props['aria-label'] === 'Portion corrections'), 'Half the rice'); await snap.settle();
assert.equal(consent().props.checked, false, 'changing portions revokes confirmation');
assert.equal(consent().props.disabled, true, 'apply or clear the pending correction first');
button(snap.tree, 'Apply correction & re-estimate').props.onClick(); await snap.settle();
assert.equal(consent().props.checked, false, 'an updated estimate still needs fresh confirmation');
setTime('2026-09-30T04:59:00.000Z'); await snap.settle();
consent().props.onChange({ target: { checked: true } }); await snap.settle();
button(snap.tree, 'Add to food log').props.onClick(); await snap.settle();
assert.equal(requests.filter(r => r.action === 'food_log').length, 0, 'submit independently rejects future time');
setTime('2026-09-29T04:59:00.000Z'); await snap.settle();
assert.equal(consent().props.checked, false, 'changing time revokes confirmation');
consent().props.onChange({ target: { checked: true } }); await snap.settle();
button(snap.tree, 'Add to food log').props.onClick(); await snap.settle();
assert.match(text(snap.tree), /Retrying the same meal time/);
assert.equal(all(snap.tree, node => node.type === MealTimeInput).length, 0, 'uncertain save locks the attempted meal time even if refresh omits pendingConsumedAt');
assert.equal(all(snap.tree, node => node.props['aria-label'] === 'Portion corrections').length, 0, 'uncertain save locks portion edits');
button(snap.tree, 'Add to food log').props.onClick(); await snap.settle();
const logs = requests.filter(r => r.action === 'food_log');
assert.equal(logs.length, 2);
assert.equal(logs[0].consumedAt, logs[1].consumedAt, 'retry preserves the original attempted timestamp');
assert.equal(logs[0].confirmConsumed, true);
assert.match(text(snap.tree), /Added to your food log/);
assert.equal(all(snap.tree, node => node.type === 'button' && text(node) === 'Add to food log').length, 0);
console.log('PASS food: numeric mobile controls, local midnight/noon, missing/invalid/future/DST dates, explicit consent, correction and time resets, uncertain-save retry lock. All API data and actions were simulated.');
