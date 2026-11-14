// Synthetic account History; all outgoing browser traffic is blocked by lib.mjs.
import assert from 'node:assert/strict';
import { open, nav, base, browser, server } from './lib.mjs';

try {
  for (const [width, assistant] of [[390, 'matthieu'], [1280, 'cupcake']]) {
    const { c, p, errors } = await open(width, 'account-browser-preview');
    try {
      await c.exposeFunction('syntheticFeedServer', async (_owner, body) => {
        if (body.action === 'outcome_list') return { status: 200, value: { ok: true, entries: [], counts: { wins: 0, losses: 0, unscored: 0, total: 0 } } };
        if (body.action === 'exercise_list') return { status: 200, value: { ok: true, entries: [] } };
        assert.equal(body.action, 'feed_get');
        const end = body.end || '2026-11-14', start = body.start || end;
        const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
        const history = body.scope === 'history';
        const calories = days === 29 ? 420 : days === 0 ? 0 : null;
        const items = history ? [] : [{
          id: 'synthetic-step-entry', type: 'steps', date: end, ts: Date.parse(end + 'T19:00:00Z'),
          time: '13:00', title: 'Synthetic step entry', body: 'A signal without chartable calories or spend.',
        }];
        return { status: 200, value: {
          ok: true, items, nextCursor: null, totals: { calories, spendUsd: null },
          daily: history ? [] : [{ date: end, calories, spendUsd: null }],
          personalOutcomes: null, outcomes: { wins: null, losses: null, missed: null, unscored: null, interventions: null },
          coverage: { start, end, timezone: 'America/Chicago', scope: history ? 'history' : 'range',
            source: 'owned-local-ledgers', complete: false, localComplete: true, notes: [] },
        } };
      });
      await p.goto(base + '/cupcake/account?assistant=' + assistant);
      await p.getByLabel('Email', { exact: true }).fill('a@example.invalid');
      await p.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
      await p.getByRole('button', { name: 'Sign in', exact: true }).click();
      await nav(p, 'Today');
      await p.getByRole('button', { name: 'All signals', exact: true }).click();
      const dash = p.getByRole('region', { name: 'Cupcake dashboard' });
      const chart = dash.locator('.cc-dashboard-chart');
      const empty = chart.getByText('No calorie or spending data to chart in this range.', { exact: true });
      await empty.waitFor();
      assert.equal(await chart.locator('.cc-bars, .cc-chart-scales, .cc-chart-legend').count(), 0);
      await dash.getByRole('button', { name: /Synthetic step entry/ }).waitFor();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), width);

      await dash.getByRole('tab', { name: 'Last 30 days' }).click();
      const day = chart.getByRole('button', { name: /420 calories, spend unavailable/ });
      await day.click();
      await p.getByRole('button', { name: /Synthetic step entry/ }).waitFor();
      await p.getByRole('button', { name: 'Back to dashboard' }).click();
      await dash.getByRole('tab', { name: 'Day', exact: true }).click();
      await chart.getByRole('button', { name: /: 0 calories, spend unavailable/ }).waitFor();
      assert.equal(await empty.count(), 0, 'recorded zero is a real chart value');
      await dash.getByRole('tab', { name: 'All time' }).click();
      await dash.getByRole('heading', { name: 'Nothing saved in this range yet' }).waitFor();
      assert.equal(await chart.count(), 0, 'all-time history does not render a day chart');
      assert.deepEqual(errors, []);
    } finally {
      await c.close();
    }
  }
  console.log('PASS: empty History chart, retained signals, populated day drilldown, recorded zero and all-time view.');
} finally {
  await browser.close();
  await server.close();
}
