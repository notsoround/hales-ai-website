import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../src/components/cupcake/nutritionModel.ts';

const { nutritionDay, nutritionDayStart, nutritionPeriod, nutritionDays, periodNutrition, lastLoggedMeal, mealNeighbors, settingsForDay } = model;
const now = new Date('2026-10-17T17:00:00Z');
const id = number => 'meal_' + number.toString(16).padStart(32, '0');
const meal = (number, consumedAt, calories = 500, extra = {}) => ({ id: id(number), description: `Fixture ${number}`, consumedAt, sheetLoggedAt: 'receipt', countedInTotals: true, total: { calories }, ...extra });
const settings = { calorieTarget: 2000, expenditureEstimate: 2400, effectiveFrom: '2026-10-17', versions: [{ calorieTarget: 2200, expenditureEstimate: 2600, effectiveFrom: '2026-10-01' }, { calorieTarget: 2000, expenditureEstimate: 2400, effectiveFrom: '2026-10-17' }] };
assert.equal(nutritionDay('2026-10-17T04:59:00Z'), '2026-10-16', 'eaten day stays in Chicago, independent of UTC/upload day');
assert.equal(nutritionPeriod('2026-10-17', 'week').start, '2026-10-12');
assert.equal(nutritionPeriod('2024-06-11', 'year').days.length, 366);
assert.equal(nutritionPeriod('2026-02-01', 'month').days.length, 28);
assert.equal(nutritionDayStart('2026-03-09') - nutritionDayStart('2026-03-08'), 23 * 3600000);
assert.equal(nutritionDayStart('2026-11-02') - nutritionDayStart('2026-11-01'), 25 * 3600000);
assert.equal(settingsForDay(settings, '2026-09-30'), null, 'new settings never silently apply to earlier history');
assert.equal(settingsForDay(settings, '2026-10-16').calorieTarget, 2200);
const eaten = meal(1, '2026-10-17T13:00:00Z', 500, { createdAt: '2026-10-19T00:00:00Z' });
const dates = nutritionDays([eaten, eaten, meal(2, '2026-10-17T16:00:00Z', 200), meal(3, '2026-10-17T15:00:00Z', 999, { sheetLoggedAt: null })], ['2026-10-17'], settings, now);
assert.equal(dates[0].calories, 700, 'parent IDs count once and unlogged analyses do not count');
assert.equal(dates[0].expenditure, 1200, 'current-day estimate explicitly uses elapsed Chicago day');
assert.equal(dates[0].balance, -500);
assert.equal(nutritionDays([eaten], ['2026-10-17'], undefined, now)[0].balance, null, 'no invented expenditure');
assert.equal(periodNutrition(nutritionDays([eaten], ['2026-10-16', '2026-10-17'], settings, now), '2026-10-17').balance, null, 'a missing day is unknown intake');
const unknown = nutritionDays([meal(4, '2026-10-17T12:00:00Z', null)], ['2026-10-17'], settings, now)[0];
assert.equal(unknown.knownCalorieCount, 0); assert.equal(unknown.partial, true); assert.equal(unknown.balance, null);
const dateOnly = meal(5, null, 300, { date: '2026-10-17', source: 'food_sheet' });
assert.equal(nutritionDays([eaten, dateOnly], ['2026-10-17'], settings, now)[0].calories, 800, 'date-known legacy meals count on their date');
assert.equal(lastLoggedMeal([eaten, dateOnly], now).id, eaten.id, 'unknown clock is never a meal timer');
assert.equal(mealNeighbors([meal(7, '2026-10-17T16:00:00Z'), eaten], eaten.id).next.id, id(7));

const loadModule = (path, dependencies) => {
  const context = { exports: {}, URL, Date, Intl, Set, Map, Error, AbortSignal, require: name => dependencies[name] || {} };
  vm.createContext(context); vm.runInContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context); return context.exports;
};
const api = loadModule('src/components/cupcake/nutritionApi.ts', { './nutritionModel': model });
assert.equal(api.foodLedgerTime('2026-10-17', ''), null, 'never promote absent time to noon');
assert.equal(api.foodLedgerTime('2026-10-17', '12:00 PM'), '2026-10-17T17:00:00.000Z');
assert.equal(api.foodLedgerTime('2026-10-17', '12:00 AM'), '2026-10-17T05:00:00.000Z');
assert.equal(api.foodLedgerTime('2026-03-08', '2:30 AM'), null, 'nonexistent spring clock is unknown');
assert.equal(api.foodLedgerTime('2026-11-01', '1:30 AM'), null, 'ambiguous fall clock is unknown without a saved offset');
assert.equal(api.foodLedgerTime('2026-11-01', '01:30:00-05:00'), '2026-11-01T06:30:00.000Z');
assert.equal(api.foodLedgerTime('2026-10-17', '25:00'), null);
const merged = api.mergeFoodHistory({ meals: [eaten], pendingCount: 0, undatedLoggedCount: 1, undatedMealIds: [id(8)] }, [
  { id: 'food:2', type: 'food', date: '2026-10-17', time: '8:00 AM', calories: 999, details: { mealId: eaten.id } },
  { id: 'food:3', type: 'food', date: '2026-10-17', time: '', calories: 300, details: { mealId: id(8) } },
  { id: 'food:4', type: 'food', date: '2026-10-16', time: '11:59 PM', calories: 400 },
], true);
assert.equal(merged.meals.length, 3); assert.equal(merged.meals.find(m => m.id === eaten.id).total.calories, 500, 'archive receipt total remains authoritative for its matching ledger row');
assert.equal(merged.undatedLoggedCount, 0, 'a canonical sheet date can recover date coverage without inventing a clock'); assert.equal(merged.unknownTimeCount, 1);
assert.equal(nutritionDays(merged.meals, ['2026-10-17'], settings, now)[0].calories, 800);

const archiveMeals = Array.from({ length: 405 }, (_, i) => meal(i + 1, '2026-10-17T12:00:00Z', 1));
const ledgerEntries = archiveMeals.map((m, i) => ({ id: `food:${i + 2}`, type: 'food', date: '2026-10-17', time: '7:00 AM', calories: 1, details: { mealId: m.id } }));
let archiveCalls = 0, ledgerCalls = 0;
const loaded = await api.loadNutritionHistory(async body => { archiveCalls++; const start = Number(body.cursor || 0), end = start + 200; return { meals: archiveMeals.slice(start, end), total: 405, nextCursor: end < 405 ? String(end) : null, pendingCount: 0, undatedLoggedCount: 0 }; }, async cursor => { ledgerCalls++; const start = Number(cursor || 0), end = start + 200; return { items: ledgerEntries.slice(start, end), nextCursor: end < 405 ? String(end) : null, coverage: { complete: end >= 405 } }; });
assert.equal(archiveCalls, 3); assert.equal(ledgerCalls, 3); assert.equal(loaded.history.complete, true); assert.equal(loaded.history.meals.length, 405); assert.equal(loaded.error, '');
const failed = await api.loadNutritionHistory(async () => ({ meals: [eaten], total: 1, pendingCount: 0, undatedLoggedCount: 0 }), async () => { throw Error('Fixture offline'); });
assert.equal(failed.history.complete, false); assert.equal(failed.history.meals.length, 1); assert.match(failed.error, /offline/);

// Render the real components with minimal hooks. No network, real records, or writes.
const jsx = (type, props) => ({ type, props: props || {} });
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
const all = (node, match) => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(n => all(n, match)) : [...(match(node) ? [node] : []), ...all(node.props?.children, match)];
function surface(component, props) {
  const slots = []; let cursor = 0;
  const ui = loadModule('src/components/cupcake/NutritionWorkspace.tsx', { './nutritionModel': model, react: { useState: initial => { const i = cursor++; slots[i] ||= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = value; }]; }, useEffect() {} }, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' } });
  return { render() { cursor = 0; return ui[component](props); } };
}
const fullHistory = { meals: [eaten], complete: true, pendingCount: 0, undatedLoggedCount: 0 };
for (const incomplete of [{ complete: false }, { pendingCount: 1 }, { undatedLoggedCount: 1 }]) {
  const card = surface('NutritionTodayCard', { history: { ...fullHistory, ...incomplete }, settings, now, onOpenMeal() {}, onOpenCalendar() {} }).render();
  assert.match(text(card), /Not available/); assert.doesNotMatch(text(card), /kcal vs your/);
  const workspace = surface('NutritionWorkspace', { history: { ...fullHistory, ...incomplete }, settings, now, onOpenMeal() {} }).render();
  assert.match(text(workspace), /Resolve incomplete history/); assert.doesNotMatch(text(workspace), /kcal intake target/);
}
const workspace = surface('NutritionWorkspace', { history: { ...fullHistory, meals: [meal(4, '2026-10-17T12:00:00Z', null)] }, settings, now, onOpenMeal() {} });
let tree = workspace.render();
for (const scale of ['Week', 'Month', 'Year']) {
  all(tree, n => n.type === 'button' && text(n) === scale)[0].props.onClick(); tree = workspace.render();
  assert.match(text(tree), /partial/i, `${scale} discloses unknown nutrition`);
  const cells = all(tree, n => n.type === 'button' && n.props['aria-label']?.includes('calories unknown'));
  if (scale !== 'Year') assert.ok(cells.length > 0, `${scale} never labels unknown calories as 0 kcal`);
}
console.log('PASS nutrition: exact Chicago eaten dates; DST; historical settings; parent dedup; unknown/partial coverage; full 405-meal archive+ledger pagination; no invented expenditure or times; honest Today/calendar comparisons. All data simulated.');
