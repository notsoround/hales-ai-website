import assert from 'node:assert/strict';
import { calorieState, stepInk } from '../src/components/cupcake/noir/metricProgress.ts';

assert.equal(calorieState(2200, null), 'normal');
assert.equal(calorieState(0, 2000), 'normal');
assert.equal(calorieState(1799, 2000), 'normal');
assert.equal(calorieState(1800, 2000), 'near-target');
assert.equal(calorieState(2000, 2000), 'at-target');
assert.equal(calorieState(2001, 2000), 'over-target');
assert.equal(stepInk(null), 'var(--nx-ink-3)');
assert.equal(new Set([0, 0.15, 0.5, 0.85, 1].map(stepInk)).size, 5);
assert.equal(stepInk(1), 'var(--nx-warm)');
assert.equal(stepInk(1.5), stepInk(1));
