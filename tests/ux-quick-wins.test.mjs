import test from 'node:test';
import assert from 'node:assert/strict';
import { closestReading, SIX_PM_WINDOW_MS } from '../src/components/cupcake/glucoseApi.ts';
import { f1, intervalLabel, raw, signed } from '../src/components/cupcake/assessment/assessmentFormat.ts';

const six = Date.parse('2026-10-21T23:00:00Z'); // 6 PM Chicago (CDT)
const at = (min, v = 100) => ({ at: six + min * 60000, valueMgDl: v });

test('6 PM sugar only uses a reading within 90 minutes of 6 PM', () => {
  assert.equal(closestReading([at(-600, 140)], six, SIX_PM_WINDOW_MS), null, 'a morning reading is never relabelled as 6 PM');
  assert.equal(closestReading([at(-600, 140), at(-45, 120), at(70, 110)], six, SIX_PM_WINDOW_MS).valueMgDl, 120);
  assert.equal(closestReading([at(91, 130)], six, SIX_PM_WINDOW_MS), null);
  assert.equal(closestReading([at(-600, 140)], six).valueMgDl, 140, 'no window keeps the old behaviour for other callers');
});

test('assessment interval label says weekly only for a one-week gap, figures use one decimal', () => {
  assert.deepEqual(intervalLabel('2026-10-14', '2026-10-21'), ['Weekly loss / gain', 'vs Oct 14 · 1 week']);
  assert.deepEqual(intervalLabel('2026-09-23', '2026-10-21'), ['Since last assessment', 'vs Sep 23 · 4 weeks']);
  assert.deepEqual(intervalLabel('2026-10-11', '2026-10-21'), ['Since last assessment', 'vs Oct 11 · 10 days']);
  assert.equal(f1(28.9), '28.9'); assert.equal(f1(196.5), '196.5'); assert.equal(signed(-0.3), '−0.3'); assert.equal(signed(2.1), '+2.1');
  assert.equal(raw(16.25), '16.25'); assert.equal(raw(42.2), '42.2');
});
