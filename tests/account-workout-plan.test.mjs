import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-workout-plan-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-workout-plan', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-workout-plan-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const REPLY = 'Great goal! Here is a starter week:\n\n**Monday: Upper body 45 min:**\n- Push-ups 3×10\n- Dumbbell rows 3×10\n\n### Wednesday: Rest\n\nThursday:\n- Brisk walk 30 min\n- Stretching 10 min\n\nNotes:\n- Warm up first\n\nHow many days can you train?';
async function open(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('switch', { name: 'Weekly workout plan' }).waitFor();
  return { context, page, errors };
}
const card = page => page.getByRole('region', { name: /Workout plan/ });
const builder = page => page.getByRole('region', { name: 'Build a workout plan with the assistant', exact: true });
try {
  const model = await server.ssrLoadModule('/src/components/cupcake/workoutPlanModel.ts');
  const text = model.routineFromReply(REPLY), parsed = model.parseRoutine(text);
  assert.deepEqual(parsed.plan, { days: { mon: [{ name: 'Upper body: Push-ups 3×10 · Dumbbell rows 3×10', minutes: 45 }], thu: [{ name: 'Brisk walk', minutes: 30 }, { name: 'Stretching', minutes: 10 }] } });
  assert.deepEqual(parsed.rest, ['wed']); assert.equal(parsed.workouts, 3);
  assert.equal(/Great goal|How many/.test(text), false, 'greeting and closing question are not part of the routine');
  assert.deepEqual(model.parseRoutine(model.routineText(parsed.plan)).plan, parsed.plan, 'saved text round-trips');
  assert.deepEqual(model.parseRoutine('Day 2: Swim 1 h').plan, { days: { tue: [{ name: 'Swim', minutes: 60 }] } });
  assert.deepEqual(model.parseRoutine('Fri:\n- 400 m repeats x6').problems.length, 1, 'no minutes is a problem, metres are not minutes');
  assert.equal(model.parseRoutine('Sat: Long ride 400 min').problems.length, 1, 'over 300 minutes is refused');
  { const r = model.parseRoutine('My plan\nMonthly goals: none'); assert.equal(r.workouts, 0, '"Monthly" is not Monday'); assert.equal(r.problems.length, 0); assert.equal(r.notes.length, 1); }
  assert.equal(model.parseWorkoutPlan({ days: { mon: [{ name: 'x' }], bad: 1 } }).days.mon, undefined);
  console.log('PASS: routines parse by weekday; minutes are required and bounded; replies keep only the routine; text round-trips');

  const { context, page, errors } = await open();
  assert.equal(await card(page).count(), 0, 'Labs workout plan must be hidden by default');
  assert.equal(await page.getByRole('switch', { name: 'Weekly workout plan' }).isChecked(), false);
  await page.getByRole('switch', { name: 'Weekly workout plan' }).check();
  await card(page).getByText('No weekly workout plan yet', { exact: false }).waitFor();
  await card(page).getByRole('button', { name: 'Add a plan' }).click();
  const box = card(page).getByLabel('Routine, one weekday per heading');
  await box.fill('Tuesday:\n- Squats 3×8');
  await card(page).getByText('add how many minutes', { exact: false }).waitFor();
  assert.equal(await card(page).getByRole('button', { name: 'Save workout plan' }).isDisabled(), true, 'cannot save with problems');
  await page.evaluate(reply => { window.workoutFixture.replies.push(reply); }, REPLY);
  await builder(page).getByLabel('What routine do you want?').fill('Three easy days, no gym');
  await builder(page).getByRole('button', { name: 'Send to the assistant' }).click();
  await builder(page).getByText('The assistant is writing a draft', { exact: false }).waitFor();
  await page.evaluate(() => window.workoutFixture.answer());
  await builder(page).getByText('3 workouts found in the latest reply').waitFor();
  if (process.env.SHOT_DIR) await card(page).screenshot({ path: path.join(process.env.SHOT_DIR, 'workout-plan-390.png') });
  await builder(page).getByRole('button', { name: 'Use this routine' }).click();
  assert.match(await box.inputValue(), /^Monday: Upper body 45 min:/);
  await card(page).getByText('Preview: 3 workouts, 1 rest day').waitFor();
  let requests = await page.evaluate(() => window.workoutFixture.requests);
  assert.equal(requests.some(r => r.action === 'coach_plan_set'), false, 'builder never saves by itself');
  const begin = requests.find(r => r.action === 'quick_chat_begin'); assert.match(begin.text, /weekly workout routine/); assert.match(begin.text, /What I want: Three easy days, no gym$/); assert.match(begin.text, /cannot search the web/);
  assert.equal(requests.some(r => r.owner_id || r.ownerId), false);
  if (process.env.AXE) {
    await page.addScriptTag({ path: process.env.AXE });
    const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id));
    assert.deepEqual(found, []); console.log('PASS: axe clean with the workout editor and a reply shown');
  }
  await card(page).getByRole('button', { name: 'Save workout plan' }).click();
  await card(page).getByText('Workout plan saved to your account.', { exact: false }).waitFor();
  const saved = await page.evaluate(() => window.workoutFixture.plan);
  assert.equal(saved.days.thu.length, 2); assert.equal(saved.days.wed, undefined);
  requests = await page.evaluate(() => window.workoutFixture.requests);
  const set = requests.filter(r => r.action === 'coach_plan_set'); assert.equal(set.length, 1); assert.equal(set[0].kind, 'workout_template');
  assert.equal(await page.evaluate(() => window.workoutFixture.meal.meals.length), 1, 'meal plan untouched');
  console.log('PASS: Labs off by default; switch shows the card; reply → editor → preview; only Save writes workout_template');

  await card(page).getByRole('button', { name: 'Edit' }).click();
  await page.evaluate(() => { window.workoutFixture.plan = { days: { sun: [{ name: 'Changed elsewhere', minutes: 20 }] } }; sessionStorage.setItem('synthetic-workout', JSON.stringify(window.workoutFixture.plan)); });
  await box.fill('Monday:\n- Walk 20 min');
  await card(page).getByRole('button', { name: 'Save workout plan' }).click();
  await card(page).getByRole('alert').filter({ hasText: 'changed somewhere else' }).waitFor();
  assert.equal(await page.evaluate(() => window.workoutFixture.plan.days.sun[0].name), 'Changed elsewhere', 'a stale save never overwrites');
  assert.equal(await box.inputValue(), 'Monday:\n- Walk 20 min', 'text is kept');
  await card(page).getByRole('button', { name: 'Load the latest plan' }).click();
  await card(page).getByRole('button', { name: 'Cancel' }).click();
  await card(page).getByText('Changed elsewhere').waitFor();
  console.log('PASS: a plan changed elsewhere blocks the save, keeps the text, and loads the latest');

  await page.reload(); await card(page).getByText('Changed elsewhere').waitFor();
  await page.getByRole('switch', { name: 'Weekly workout plan' }).uncheck();
  assert.equal(await card(page).count(), 0);
  assert.deepEqual(await page.evaluate(() => window.workoutFixture.blocked), []); assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS: switch persists across reload; turning it off hides the card');

  const second = await open(320), p = second.page;
  await p.getByRole('switch', { name: 'Weekly workout plan' }).check();
  await p.evaluate(() => { window.workoutFixture.mode = 'notReady'; });
  await card(p).getByRole('button', { name: /Add a plan|Edit/ }).click();
  await card(p).getByLabel('Routine, one weekday per heading').fill('Monday: Upper body 45 min:\n- Push-ups 3×10 with a very long synthetic exercise description that must wrap neatly on a narrow phone');
  await builder(p).getByLabel('What routine do you want?').fill('Anything');
  await builder(p).getByRole('button', { name: 'Send to the assistant' }).click();
  await builder(p).getByRole('alert').filter({ hasText: /not available/ }).waitFor();
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll at 320px');
  if (process.env.SHOT_DIR) await card(p).screenshot({ path: path.join(process.env.SHOT_DIR, 'workout-plan-320.png') });
  assert.deepEqual(second.errors, []); await second.context.close();
  console.log('PASS: unavailable chat says so plainly; 320px has no horizontal scroll');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
