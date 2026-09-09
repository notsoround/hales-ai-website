import assert from 'node:assert/strict';
import { entriesForDay, entriesForType, interventionGroups, interventionOutcome, metricScales, rangeLabel } from '../src/components/cupcake/dashboardModel.ts';

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

const interventions = [
  { id: 'won', date: '2026-09-07', type: 'intervention', details: { outcome: 'agreed_to_stop', boughtAnyway: false } },
  { id: 'lost', date: '2026-09-07', type: 'intervention', details: { outcome: 'agreed_to_stop', boughtAnyway: true } },
  { id: 'put-back', date: '2026-09-07', type: 'intervention', details: { outcome: 'put_back', boughtAnyway: null } },
  { id: 'disagreed', date: '2026-09-07', type: 'intervention', details: { outcome: 'defiant', boughtAnyway: false } },
  { id: 'unknown', date: '2026-09-07', type: 'intervention', details: { outcome: 'no_answer', boughtAnyway: null } },
  { id: 'food', date: '2026-09-07', type: 'food', details: { outcome: 'agreed_to_stop', boughtAnyway: true } },
];
assert.equal(interventionOutcome(interventions[1]), 'loss', 'an explicit bought-anyway flag wins over a stop-sounding outcome');
assert.equal(interventionOutcome(interventions[3]), 'unscored', 'disagreement without bought-anyway evidence is not a loss');
assert.equal(interventionOutcome({ date: '2026-09-07', type: 'intervention', details: { outcome: 'disagreed' } }), 'unscored', 'disagreed must not match agreed as a substring');
const groups = interventionGroups(interventions);
assert.deepEqual(groups.wins.map(entry => entry.id), ['won', 'put-back']);
assert.deepEqual(groups.losses.map(entry => entry.id), ['lost']);
assert.deepEqual(groups.unscored.map(entry => entry.id), ['disagreed', 'unknown']);
assert.deepEqual(groups.interventions.map(entry => entry.id), ['won', 'lost', 'put-back', 'disagreed', 'unknown']);

console.log('dashboard model tests passed');
