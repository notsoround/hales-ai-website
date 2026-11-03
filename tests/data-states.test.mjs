// Item 2 of the design review: unavailable or partial data is never shown as zero or complete.
// Loading, error/unavailable and genuinely zero/empty stay three different states. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { calorieTotal, exerciseCoverageNote, exerciseStat, todayKcalBit } from '../src/components/cupcake/dataState.ts';
import * as viewerApi from '../src/components/cupcake/robyn/viewerApi.ts';

test('Energy card exercise: a failed or unavailable read is not "None logged"', () => {
  assert.deepEqual(exerciseStat('error', 0), { kind: 'error', text: 'Couldn’t load' });
  assert.deepEqual(exerciseStat('unavailable', 0), { kind: 'unavailable', text: 'Not available' });
  assert.deepEqual(exerciseStat('loading', 0), { kind: 'loading', text: '…' });
  assert.deepEqual(exerciseStat('ready', 0), { kind: 'none', text: 'None logged' }, 'only a successful empty read is none');
  assert.deepEqual(exerciseStat('ready', 212.4), { kind: 'value', text: '212' });
  assert.equal(exerciseStat('loading', 150).kind, 'value', 'a reload keeps the figure already shown');
  assert.equal(exerciseStat('error', 150).kind, 'error', 'an error is never presented as a complete figure');
  assert.match(exerciseCoverageNote('error'), /couldn’t load.*leave out any workouts/);
  assert.match(exerciseCoverageNote('unavailable'), /not available/);
  assert.equal(exerciseCoverageNote('ready'), ''); assert.equal(exerciseCoverageNote('loading'), '');
});

test('Today line kcal: unknown calories are partial or unknown, not 0', () => {
  assert.equal(todayKcalBit(null), null, 'not loaded: nothing claimed');
  assert.equal(todayKcalBit({ meals: [], calories: 0, knownCalorieCount: 0, partial: false }), null, 'no meals: nothing claimed');
  assert.deepEqual(todayKcalBit({ meals: [1], calories: 0, knownCalorieCount: 0, partial: true }), { v: '—', l: 'kcal unknown' });
  assert.deepEqual(todayKcalBit({ meals: [1, 2], calories: 640, knownCalorieCount: 1, partial: true }), { v: '640', l: 'kcal eaten · partial' });
  assert.deepEqual(todayKcalBit({ meals: [1], calories: 1210, knownCalorieCount: 1, partial: false }), { v: '1,210', l: 'kcal eaten' });
});

test('Dashboard calorie total: missing totals are unavailable and unknown entries mark it partial', () => {
  const food = calories => ({ type: 'food', calories });
  assert.deepEqual(calorieTotal(null, []), { value: '—', partial: false, unknown: 0, available: false });
  assert.deepEqual(calorieTotal(undefined, [food(null)]), { value: '—', partial: true, unknown: 1, available: false });
  assert.deepEqual(calorieTotal(900, [food(400), food(500), { type: 'transaction', calories: null }]), { value: '900', partial: false, unknown: 0, available: true });
  assert.deepEqual(calorieTotal(400, [food(400), food(null), food(undefined)]), { value: '400', partial: true, unknown: 2, available: true });
  assert.deepEqual(calorieTotal(0, []), { value: '0', partial: false, unknown: 0, available: true }, 'a genuine 0 stays 0');
});

// Render the real Robyn DaySheet with synthetic hook state (no DOM, no network).
function daySheet() {
  const node = (type, props, key) => ({ type, props: props || {}, key });
  const context = {
    exports: {}, Intl, Date,
    require(name) {
      if (name === 'react') return { useEffect() {}, useRef: current => ({ current }) };
      if (name === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'fragment' };
      if (name === './viewerApi.ts') return viewerApi;
      throw Error(`Unexpected fixture dependency ${name}`);
    },
  };
  vm.createContext(context);
  const source = readFileSync(new URL('../src/components/cupcake/robyn/DaySheet.tsx', import.meta.url), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return context.exports.DaySheet;
}
const text = element => element == null || typeof element === 'boolean' ? '' : typeof element !== 'object' ? String(element) : Array.isArray(element) ? element.map(text).join('') : typeof element.type === 'function' ? text(element.type(element.props)) : text(element.props?.children);
const has = (element, cls) => element && typeof element === 'object' && (Array.isArray(element) ? element.some(e => has(e, cls)) : String(element.props?.className || '').split(' ').includes(cls) || has(element.props?.children, cls));
const meal = (kcal, extra = {}) => ({ time: '12:00', description: 'Synthetic meal', source: 'Photo', kcal, protein_g: null, carbs_g: null, fat_g: null, sugar_g: null, partial: false, ...extra });
const day = (date, meals) => ({ date, period: 'current', meals, workouts: [], sleep: null, steps: null, weight: [], wins: 0, losses: 0, food_kcal: meals.length ? meals.reduce((a, m) => a + (m.kcal ?? 0), 0) : null, exercise_minutes: 0, exercise_kcal: 0 });

test('Robyn day details: a failed load is unavailable, not an endless skeleton', () => {
  const DaySheet = daySheet(), base = { view: { kind: 'day', date: '2026-10-19' }, onClose() {}, onDay() {} };
  const failed = DaySheet({ ...base, days: null, loading: false, error: true });
  assert.match(text(failed), /Day details couldn’t load/); assert.ok(!has(failed, 'rv-sheet-loading'));
  const loading = DaySheet({ ...base, days: null, loading: true, error: false });
  assert.ok(has(loading, 'rv-sheet-loading')); assert.doesNotMatch(text(loading), /couldn’t load/);
});

test('Robyn day details: unknown meal calories mark the day partial instead of adding 0', () => {
  const DaySheet = daySheet();
  const days = [day('2026-10-19', [meal(600), meal(null)]), day('2026-10-20', [meal(450)]), day('2026-10-21', [])];
  const list = text(DaySheet({ view: { kind: 'metric', metric: 'food' }, days, loading: false, onClose() {}, onDay() {} }));
  assert.match(list, /600 kcal · partial/); assert.match(list, /450 kcal(?! · partial)/);
  const detail = text(DaySheet({ view: { kind: 'day', date: '2026-10-19' }, days, loading: false, onClose() {}, onDay() {} }));
  assert.match(detail, /kcal · 2 meals · partial/);
  const empty = text(DaySheet({ view: { kind: 'day', date: '2026-10-21' }, days, loading: false, onClose() {}, onDay() {} }));
  assert.match(empty, /a gap, not zero intake/);
});
