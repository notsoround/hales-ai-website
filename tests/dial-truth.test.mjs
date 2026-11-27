// Today dial truth (Nov 27 review, item 4): chips carry a unit and an age, the glucose source and the meaning of its arc
// are stated, sleep has one target, and the Energy card counts the workouts the Timeline shows, once.
// Pure checks first, then the real Today screen with the fictional "Synthetic A" account (no network, no real data).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { FAST_GOAL_MIN, SLEEP_TARGET_MIN, ageLabel, durationLabel, durationParts, glucoseSourceLabel, sleepVerdict } from '../src/components/cupcake/noir/dialReadings.ts';
import { feedOnlyWorkouts } from '../src/components/cupcake/exerciseTimeline.ts';
import { exerciseStat } from '../src/components/cupcake/dataState.ts';

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('durations read "1 h 34 m" and never round into "60 m"', () => {
  assert.equal(durationLabel(94), '1 h 34 m');
  assert.equal(durationLabel(34), '34 m');
  assert.equal(durationLabel(480), '8 h 0 m');
  assert.equal(durationLabel(59.6), '1 h 0 m');
  assert.deepEqual(durationParts(119.7), { h: 2, m: 0 });
});

test('a reading\'s age is words, not colour', () => {
  const now = Date.parse('2026-11-27T21:30:00Z');
  assert.equal(ageLabel(now - 20000, now), 'just now');
  assert.equal(ageLabel(now - 25 * 60000, now), '25 m ago');
  assert.equal(ageLabel(now - 200 * 60000, now), '3 h ago');
  assert.equal(ageLabel(now - 30 * 3600000, now), '30 h ago');
  assert.equal(ageLabel(now - 6 * 86400000, now), '6 d ago');
});

test('sleep is judged against one target, 8 hours', () => {
  assert.equal(SLEEP_TARGET_MIN, 480);
  assert.deepEqual(sleepVerdict(380), { reached: false, text: '1 h 40 m under 8 h target', short: '1 h 40 m' });
  assert.equal(sleepVerdict(450).reached, false, '7 h 30 m is under the target, not "in band"');
  assert.deepEqual(sleepVerdict(480), { reached: true, text: '8 h target reached', short: null });
  assert.equal(sleepVerdict(560).reached, true);
  const dashboard = src('src/components/cupcake/noir/TodayDashboard.tsx');
  assert.match(dashboard, /SLEEP_GOAL = SLEEP_TARGET_MIN/);
  assert.doesNotMatch(dashboard, /7 \* 60|9 \* 60|8 \* 60|7–9|Under 7 h/, 'no second sleep target left in the dashboard');
});

test('fasting stays elapsed time and never claims a metabolic state', () => {
  assert.equal(FAST_GOAL_MIN, 960);
  for (const file of ['src/components/cupcake/noir/TodayDashboard.tsx', 'src/components/cupcake/noir/dialReadings.ts', 'src/components/cupcake/noir/MultiDial.tsx'])
    assert.doesNotMatch(src(file).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''), /keto/i, file);
});

test('glucose source label comes from the reading\'s own method', () => {
  assert.equal(glucoseSourceLabel(), 'Manual reading');
  assert.equal(glucoseSourceLabel('manual'), 'Manual reading');
  assert.equal(glucoseSourceLabel('fingerstick'), 'Manual reading (fingerstick)');
});

test('Energy counts the Timeline\'s workouts once', () => {
  const day = Date.parse('2026-11-27T06:00:00Z'), end = day + 86400000, at = day + 14 * 3600000;
  const logged = [{ id: 'exe_a', description: '20 min rowing', performedAt: new Date(at).toISOString(), at, minutes: 20, kcal: 150, basis: 'local-met', items: [] }];
  const feed = [
    { id: 'acc:exercise-exe_a', type: 'exercise', title: '20 min rowing', date: '2026-11-27', ts: at, details: { ...logged[0] } },          // the logged entry again
    { id: 'exercise-exe_a', type: 'exercise', title: '20 min rowing', date: '2026-11-27', ts: at },                                       // merged client row
    { id: 'acc:feed-only-workout', type: 'exercise', title: 'Feed-only workout', date: '2026-11-27', ts: at + 60000, details: { id: 'only-in-feed', minutes: 25, kcal: 180 } },
    { id: 'x1', type: 'exercise', title: 'Rowing, 25 min', date: '2026-11-27', ts: (at + 120000) / 1000, calories: -240 },                 // seconds timestamp, burn on the row
    { id: 'x2', type: 'exercise', title: 'Stretching', date: '2026-11-27', ts: at + 180000 },                                              // no burn figure
    { id: 'old', type: 'exercise', title: 'Yesterday run', date: '2026-11-26', ts: day - 3600000, details: { kcal: 300 } },
    { id: 'meal', type: 'food', title: 'Lunch', date: '2026-11-27', ts: at, calories: 600 },
  ];
  const only = feedOnlyWorkouts(feed, logged, day, end);
  assert.deepEqual(only.map(w => [w.id, w.kcal]), [['acc:feed-only-workout', 180], ['x1', 240], ['x2', null]]);
  assert.deepEqual(feedOnlyWorkouts(feed.slice(0, 2), logged, day, end), [], 'a logged workout is never counted a second time');
  assert.deepEqual(feedOnlyWorkouts(null, logged, day, end), []);
  // The figure the card shows.
  assert.deepEqual(exerciseStat('ready', 0, 0), { kind: 'none', text: 'None logged' });
  assert.deepEqual(exerciseStat('ready', 0, 1), { kind: 'logged', text: '1 logged · burn not recorded' }, 'a workout on the timeline is never "None logged"');
  assert.deepEqual(exerciseStat('ready', 240, 0), { kind: 'value', text: '240' });
  assert.equal(exerciseStat('error', 240, 1).kind, 'error', 'a failed read is still not shown as a complete figure');
});

test('Today screen: units, age, source, one sleep target, and Energy agrees with the Timeline', async () => {
  const { createServer } = await import('vite');
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-dial-truth-'));
  const server = await createServer({ cacheDir, envDir: cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
    optimizeDeps: { entries: ['tests/experience-review-preview.ts'] },
    plugins: [{ name: 'synthetic-dial-truth',
      configureServer(s) { s.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; next(); }); },
      transformIndexHtml(html, context) { return context.filename.endsWith('/tests/account-browser-preview.html') ? html.replace('/tests/account-browser-preview.tsx', '/tests/experience-review-preview.ts') : html; } }],
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  const browser = await chromium.launch();
  try {
    // 3:30 PM Chicago today: the fixture's lunch (about 12:30p), 2:12p reading and 2:06p rowing are all in the past.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'shortOffset' }).formatToParts(new Date(today + 'T18:00:00Z')).find(p => p.type === 'timeZoneName').value.replace('GMT', '');
    const fixed = new Date(`${today}T15:30:00${offset.length <= 3 ? `${offset[0]}0${offset.slice(1)}:00` : offset}`);
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: 'block', timezoneId: 'America/Chicago' });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({ time: fixed });
      await page.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === base || u.protocol === 'data:' || u.protocol === 'blob:' ? r.continue() : r.abort(); });
      await page.goto(base + '/cupcake/account?tab=feed&rich=1');
      const key = tone => page.locator('.nx-md-key.is-' + tone);
      await key('glucose').locator('small').waitFor();
      // Every chip: a number, then its unit in words, and an age where the reading is timestamped. Readable without tapping.
      assert.match(await key('cal').innerText(), /^CALORIES\n[\d,]+\nkcal (left|over)$/i);
      assert.match(await key('fast').innerText(), /^FASTING\n(\d+ h )?\d+ m\nfasted$/i);
      assert.match(await key('glucose').innerText(), /^GLUCOSE\n\d+\nmg\/dL · (just now|\d+ [mh] ago)$/i);
      assert.match(await key('sleep').innerText(), /^SLEEP\n\d+ h \d+ m\nslept · estimate$/i);
      // Chips keep their class names and fit the phone.
      assert.equal(await page.locator('.nx-md-keys .nx-md-key').count(), 4);
      assert.deepEqual(await page.locator('.nx-md-key > *').evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)), [], 'chip text is not clipped');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');

      // Glucose: source, clock time and age in the middle; the arc is captioned as the 14-day in-range share.
      await key('glucose').click();
      const centre = page.locator('.nx-md-centre');
      await centre.getByText('Latest glucose').waitFor();
      assert.match(await centre.innerText(), /Manual · \d{1,2}:\d{2}[ap] · (just now|\d+ [mh] ago)\nArc: \d+% in range, 14 days/);
      assert.match(await page.locator('.nx-md-face').getAttribute('aria-label'), /manual reading from .* The arc shows \d+ percent of readings in range over 14 days/);
      await page.locator('.nx-md-drill').click();
      const tray = page.locator('.nx-md-tray');
      const fact = async k => (await tray.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp('^' + k + '$') }) }).locator('dd').innerText()).trim();
      assert.equal(await fact('Source'), 'Manual reading (fingerstick)');
      assert.match(await fact('Age'), /^(just now|\d+ [mh] ago)$/);
      assert.match(await fact('Arc: readings in 70–140, 14 days'), /^\d+%$/);

      // Sleep: the middle and the tray name the same 8 h target, and the estimate label stays.
      await key('sleep').click();
      await centre.getByText('Slept last night').waitFor();
      const sleepLine = await page.locator('.nx-md-detail').innerText();
      assert.match(sleepLine, /^Ring estimate · (\d+ h )?\d+ m under 8 h target$|^Ring estimate · 8 h target reached$/);
      assert.doesNotMatch(sleepLine + await tray.innerText(), /Under 7 h|7–9|Above 9 h|Against 8 hours/);
      const short = /· (.+) under 8 h target/.exec(sleepLine)?.[1];
      assert.equal(await fact('Against 8 h target'), short ? `${short} short` : 'Reached', 'dial and Details agree');
      assert.equal(await fact('Source'), 'Ring estimate');

      // Fasting: elapsed time, with how long is left to the 16-hour mark.
      await key('fast').click();
      await centre.getByText('Fasted so far').waitFor();
      assert.match(await page.locator('.nx-md-detail').innerText(), /Since your last logged meal · ((\d+ h )?\d+ m to 16 h|16 h elapsed)/);
      assert.equal(await fact('Measured from'), 'Your food log (elapsed time only)');
      assert.doesNotMatch(await page.locator('.nx-today').innerText(), /keto/i);

      // Tapping the middle still steps to the next reading (interaction unchanged).
      await page.locator('.nx-md-face').focus(); await page.keyboard.press('Enter');
      await centre.getByText('Latest glucose').waitFor();

      // The Timeline's rowing row and the Energy card now tell one story.
      await page.locator('.cc-energy-stats').first().waitFor();
      assert.ok(await page.getByText('Rowing, 25 min').count() >= 1, 'the fixture timeline has an exercise row');
      const exercise = (await page.locator('.cc-energy-stats > div').filter({ has: page.locator('dt', { hasText: /^Exercise$/ }) }).locator('dd').first().innerText()).trim();
      assert.doesNotMatch(exercise, /None logged/);
      assert.equal(exercise, '240 burned');
      assert.match(await page.locator('.cc-energy-note').first().innerText(), /Workouts burned 240 kcal/);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); await server.close(); }
});
