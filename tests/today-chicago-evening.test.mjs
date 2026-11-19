// Regression guard for "today" after 6 PM Chicago, when UTC is already tomorrow.
// A meal eaten at 8:13 PM CT on Nov 18 is 02:13 UTC on Nov 19; it must count on Nov 18.
// All data is synthetic.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../src/components/cupcake/nutritionModel.ts';

const now = new Date('2026-11-19T04:50:00Z'); // 10:50 PM CT, Nov 18
const eatenAt = '2026-11-19T02:13:26Z';         // 8:13:26 PM CT, Nov 18
const id = n => 'meal_' + n.toString(16).padStart(32, '0');
assert.equal(model.nutritionDay(now), '2026-11-18', 'Today is the Chicago date, not the UTC date');
assert.equal(model.nutritionDay(eatenAt), '2026-11-18');

const photo = { id: id(1), description: 'Synthetic evening plate', consumedAt: eatenAt, source: 'account-photo-estimate', logDestination: 'account-local',
  accountLoggedAt: '2026-11-19T02:14:00Z', sheetLoggedAt: '2026-11-19T02:14:00Z', logState: 'logged', countedInTotals: true, total: { calories: 180, protein_g: 22, carbs_g: 7, fat_g: 7 } };
const [nov18, nov19] = model.nutritionDays([photo], ['2026-11-18', '2026-11-19'], undefined, now);
assert.deepEqual(nov18.meals.map(m => m.id), [photo.id], 'the 8:13 PM CT meal lands on the Chicago day');
assert.equal(nov18.calories, 180);
assert.equal(nov19.meals.length, 0, 'it never moves to the UTC day');
assert.ok(nov18.elapsedFraction > 0.9 && nov18.elapsedFraction < 1, 'Today is still in progress at 10:50 PM CT');

const loadModule = (path, dependencies) => {
  const context = { exports: {}, URL, Date, Intl, Set, Map, Error, AbortSignal, require: name => dependencies[name] || {} };
  vm.createContext(context); vm.runInContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context); return context.exports;
};
const api = loadModule('src/components/cupcake/nutritionApi.ts', { './nutritionModel': model, './accountMode': {}, './library': {}, './dataChanges': {}, './privateAccess': {}, react: {} });
// The Food ledger row shape the /cupcake feed uses: a Chicago date plus a local clock.
assert.equal(api.foodLedgerTime('2026-11-18', '8:13:26 PM'), '2026-11-19T02:13:26.000Z');
const merged = api.mergeFoodHistory({ meals: [], pendingCount: 0, undatedLoggedCount: 0 },
  [{ id: 'food:9001', type: 'food', date: '2026-11-18', time: '8:13:26 PM', title: 'Synthetic ledger plate', calories: 180 }], true);
const ledgerDay = model.nutritionDays(merged.meals, ['2026-11-18', '2026-11-19'], undefined, now);
assert.equal(ledgerDay[0].calories, 180, 'a ledger row at 8:13 PM CT counts on Nov 18');
assert.equal(ledgerDay[1].meals.length, 0);

// The account Today feed asks for the Chicago date, never the UTC date (page.tsx builds start/end with en-CA in America/Chicago).
const page = readFileSync('src/pages/cupcake/sandbox/cupcakegpt/page.tsx', 'utf8');
assert.match(page, /start:new Intl\.DateTimeFormat\('en-CA',\{timeZone:'America\/Chicago'\}\)\.format\(new Date\(\)\)/);
assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(now), '2026-11-18');
console.log('PASS today-chicago-evening: 8:13 PM CT meal and feed range stay on the Chicago day after UTC midnight. All data synthetic.');
