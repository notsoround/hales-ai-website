import assert from 'node:assert/strict';
import { entriesForDay, entriesForType, metricScales, rangeLabel } from '../src/components/cupcake/dashboardModel.ts';

const entries = [
  { id: 'meal-a', date: '2026-09-07', type: 'food' },
  { id: 'meal-b', date: '2026-09-07', type: 'food' },
  { id: 'spend-a', date: '2026-09-07', type: 'transaction' },
  { id: 'meal-old', date: '2026-09-06', type: 'food' },
];

assert.deepEqual(entriesForDay(entries, '2026-09-07').map(entry => entry.id), ['meal-a', 'meal-b', 'spend-a'], 'a chart day opens every entry on that date');
assert.deepEqual(entriesForType(entries, 'food').map(entry => entry.id), ['meal-a', 'meal-b', 'meal-old'], 'the calorie card drills into food entries');
assert.deepEqual(entriesForType(entries, 'transaction').map(entry => entry.id), ['spend-a'], 'the spend card drills into transactions');

const scales = metricScales([
  { date: '2026-09-06', calories: 0, spend: 100 },
  { date: '2026-09-07', calories: 2_000, spend: 50 },
]);
assert.equal(scales.caloriePercent(0), 0, 'a zero calorie value has zero height');
assert.equal(scales.spendPercent(0), 0, 'zero spend has zero height');
assert.equal(scales.caloriePercent(2_000), 100);
assert.equal(scales.spendPercent(50), 50, 'spend uses its own scale instead of the calorie scale');
assert.equal(rangeLabel('week'), 'Last 7 days');
assert.equal(rangeLabel('month'), 'Last 30 days');

console.log('dashboard model tests passed');
