// Card 8 (Nov 27 review): one duration format and the Today headline wording. Pure functions, synthetic values only.
import assert from 'node:assert/strict';
import { formatDuration, formatDurationSpoken } from '../src/components/cupcake/formatDuration.ts';
import { todayLine } from '../src/components/cupcake/noir/voice.ts';

assert.equal(formatDuration(94), '1 h 34 m');
assert.equal(formatDuration(380), '6 h 20 m');
assert.equal(formatDuration(120), '2 h');
assert.equal(formatDuration(45), '45 m');
assert.equal(formatDuration(0), '0 m');
assert.equal(formatDuration(59.6), '1 h', 'rounds whole minutes first, never "0:60"');
assert.equal(formatDuration(-90), '−1 h 30 m');
assert.equal(formatDuration(null), '—');
assert.equal(formatDuration(Number.NaN), '—');
assert.equal(formatDurationSpoken(94), '1 hour 34 minutes');
assert.equal(formatDurationSpoken(61), '1 hour 1 minute');
assert.equal(formatDurationSpoken(120), '2 hours');
assert.equal(formatDurationSpoken(undefined), 'unknown');

const onPace = todayLine({ persona: 'cupcake', name: 'Synthetic A', hour: 13, meals: 2, left: 984, pace: 0, mealHint: null });
assert.equal(onPace.before + onPace.accent + onPace.after, '984 left, right on pace. Look at you.');
console.log('PASS: formatDuration ("1 h 34 m"), spoken durations and the "984 left, right on pace." headline');
