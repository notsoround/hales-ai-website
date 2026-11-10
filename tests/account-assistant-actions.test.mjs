import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-assistant-actions-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-assistant-actions', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-assistant-actions-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const block = value => '```cupcake-action\n' + JSON.stringify(value) + '\n```';
const pad = n => String(n).padStart(2, '0'), local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const hourAgo = local(new Date(Date.now() - 3600000)), today = local(new Date()).slice(0, 10);
const REPLY = ['Nice lunch! Here is everything ready for you to check and save.',
  block({ type: 'log_meal', description: 'Synthetic turkey sandwich and an apple', when: hourAgo, calories: 520, protein_g: 32 }),
  block({ type: 'log_workout', description: 'Synthetic brisk walk', when: hourAgo, minutes: 30, calories: 150 }),
  block({ type: 'add_groceries', items: ['Bananas', 'Oats', 'Greek yogurt'] }),
  block({ type: 'record_outcome', outcome: 'win', title: 'Synthetic walk after lunch', date: today }),
  block({ type: 'delete_meal', mealId: 'meal_1' })].join('\n\n');
const WRITES = new Set(['reconcile_resolve', 'food_manual_log', 'exercise_log', 'weight_add', 'outcome_record', 'coach_plan_set', 'exercise_delete', 'body_checkin_delete', 'weight_correct', 'food_portion_set']);
async function open(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('switch', { name: 'Let the assistant suggest changes' }).waitFor();
  return { context, page, errors };
}
const requests = page => page.evaluate(() => window.suggestFixture.requests);
async function ask(page, text, reply) {
  await page.evaluate(r => { window.suggestFixture.replies.push(r); }, reply);
  await page.getByLabel('Message Cupcake').fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Check status' }).last().waitFor();
  await page.evaluate(() => window.suggestFixture.answer());
  await page.getByRole('button', { name: 'Check status' }).last().click();
}
try {
  const m = await server.ssrLoadModule('/src/components/cupcake/assistantActionsModel.ts');
  const now = Date.now(), wrapped = m.wrapMessage('Log my lunch', { mealPlan: { meals: [] } });
  assert.ok(wrapped.startsWith(m.ACTIONS_MARK)); assert.ok(wrapped.length <= 8000); assert.equal(m.shownMessage(wrapped), 'Log my lunch'); assert.equal(m.shownMessage('plain'), 'plain');
  assert.ok(m.wrapMessage('x'.repeat(m.MAX_WRAPPED_INPUT), { mealPlan: { groceries: 'y'.repeat(20000) } }).length <= 8000, 'a long plan is cut so the message fits the 8000-character limit');
  const found = m.suggestionsFrom(REPLY, now);
  assert.deepEqual(found.map(s => s.proposal?.type ?? null), ['log_meal', 'log_workout', 'add_groceries', 'record_outcome', null]);
  assert.match(found[4].problem, /does not allow/);
  assert.equal(m.replyText(REPLY), 'Nice lunch! Here is everything ready for you to check and save.');
  const bad = raw => m.parseProposal(raw, now).problem;
  assert.match(bad({ type: 'log_meal', description: 'x', when: local(new Date(now + 3 * 3600000)) }), /future/);
  assert.match(bad({ type: 'log_weight', value: 40, unit: 'lb' }), /66 to 550/);
  assert.match(bad({ type: 'log_weight', value: 180 }), /unit/);
  assert.match(bad({ type: 'log_workout', description: 'Run', minutes: 20 }), /calorie/);
  assert.match(bad({ type: 'log_workout', description: 'Run', minutes: 20, calories: 200, when: local(new Date(now - 40 * 86400000)) }), /31 days/);
  assert.match(bad({ type: 'log_meal', description: 'x', when: '2026-02-30T12:00' }), /time could not be read/);
  assert.match(bad({ type: 'add_groceries', items: ['x'.repeat(121)] }), /short line/);
  assert.equal(m.suggestionsFrom(Array(7).fill(block({ type: 'add_groceries', items: ['a'] })).join('\n'), now).length, 6, 'at most five usable suggestions, then one notice');
  const hex = await m.stableHex('turn:0:reply'); assert.equal(hex, await m.stableHex('turn:0:reply')); assert.notEqual(hex, await m.stableHex('turn:0:other reply'));
  const meal = m.requestFor(found[0].proposal, hex);
  assert.deepEqual(Object.keys(meal).sort(), ['action', 'confirmConsumed', 'consumedAt', 'dedupeKey', 'description', 'source', 'total']);
  assert.match(meal.dedupeKey, /^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  assert.match(m.requestFor(found[1].proposal, hex).requestId, /^ex_[a-f0-9]{32}$/);
  for (const p of found.slice(0, 4)) if (p.proposal.type !== 'add_groceries') assert.equal(['owner_id', 'ownerId', 'accountId', 'account_id', 'role', 'actor'].some(k => k in m.requestFor(p.proposal, hex)), false);
  assert.equal(m.groceriesWith('- [ ] Oats', ['oats']), null);
  assert.deepEqual(m.groceriesWith('- [ ] Oats\n', ['Oats', 'Kale']), { text: '- [ ] Oats\n- [ ] Kale', added: ['Kale'] });
  assert.match(bad({ type: 'set_portion', mealId: 'meal_1', fraction: 0 }), /¼, ½, ¾/);
  assert.match(bad({ type: 'set_portion', mealId: 'meal 1; drop', fraction: 0.5 }), /does not name a meal/);
  assert.match(bad({ type: 'review_purchase', purchaseId: 'l1', status: 'delete' }), /confirmed, not spending/);
  assert.match(bad({ type: 'save_workout_plan', days: { funday: [] } }), /mon to sun/);
  assert.match(bad({ type: 'save_workout_plan', days: { mon: [{ name: 'Run', minutes: 400 }] } }), /1 to 300/);
  assert.match(bad({ type: 'save_meal_plan', meals: [] }), /1 to 10/);
  assert.deepEqual(m.requestFor(m.parseProposal({ type: 'review_purchase', purchaseId: 'l1', status: 'undecided' }).proposal, hex).status, 'pending');
  assert.deepEqual(m.mealPlanWith({ meals: [], groceries: '- [ ] Oats', title: 'Old' }, m.parseProposal({ type: 'save_meal_plan', meals: [{ name: 'A', items: ['x'] }] }).proposal), { meals: [{ name: 'A', items: ['x'] }], groceries: '- [ ] Oats' });
  const big = m.wrapMessage('hello', { recentMeals: Array(40).fill({ mealId: 'meal_x', what: 'y'.repeat(70) }), purchases: [], mealPlan: { groceries: 'z'.repeat(19000) }, workoutPlan: null, recentWorkouts: [] });
  assert.ok(big.length <= 8000 && big.endsWith('My message:\nhello'));
  console.log('PASS: only the allowed kinds become suggestions; bad times, units and amounts are refused; ids are stable; no account fields');

  const { context, page, errors } = await open();
  assert.equal(await page.getByRole('switch', { name: 'Let the assistant suggest changes' }).isChecked(), false, 'off by default');
  await ask(page, 'Log my lunch please', REPLY);
  await page.getByText('Turn on Settings → Labs', { exact: false }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Suggested changes' }).count(), 0);
  let sent = (await requests(page)).find(r => r.action === 'quick_chat_begin');
  assert.equal(sent.text, 'Log my lunch please', 'with Labs off the message is sent unchanged');
  assert.equal((await requests(page)).some(r => WRITES.has(r.action)), false);
  console.log('PASS: with Labs off, messages are unchanged and replies show no Save buttons');

  await page.getByRole('switch', { name: 'Let the assistant suggest changes' }).check();
  const cards = page.getByRole('region', { name: 'Suggested changes' });
  await cards.waitFor(); // The earlier reply's suggestions become reviewable once Labs is on.
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await ask(page, 'I had a turkey sandwich and an apple an hour ago and walked after', REPLY);
  sent = (await requests(page)).filter(r => r.action === 'quick_chat_begin').at(-1);
  assert.ok(sent.text.startsWith('[Cupcake app: assistant suggestions are on]')); assert.match(sent.text, /Synthetic week/); assert.match(sent.text, /meal_syn_a1/); assert.match(sent.text, /ex_syn0001aaaa/); assert.match(sent.text, /lnk_syn_77/); assert.ok(sent.text.length <= 8000); assert.match(sent.text, /My message:\nI had a turkey sandwich/);
  await page.locator('p', { hasText: 'I had a turkey sandwich and an apple an hour ago and walked after' }).first().waitFor();
  assert.equal(await page.getByText('[Cupcake app', { exact: false }).count(), 0, 'the format instructions never show in the chat');
  const latest = cards.last();
  await latest.getByText('Synthetic turkey sandwich and an apple').waitFor();
  await latest.getByText('Suggestion not shown').waitFor();
  assert.equal((await requests(page)).some(r => WRITES.has(r.action)), false, 'nothing is written before a tap');
  if (process.env.SHOT_DIR) await latest.screenshot({ path: path.join(process.env.SHOT_DIR, 'assistant-suggestions-390.png') });

  await latest.getByRole('button', { name: 'Save meal' }).click();
  await latest.getByText('Saved to your food log.').waitFor();
  let writes = (await requests(page)).filter(r => WRITES.has(r.action));
  assert.equal(writes.length, 1); assert.equal(writes[0].action, 'food_manual_log'); assert.equal(writes[0].description, 'Synthetic turkey sandwich and an apple'); assert.deepEqual(writes[0].total, { calories: 520, protein_g: 32 });

  const groceries = page.getByRole('region', { name: 'Groceries preview' });
  assert.equal(await groceries.getByLabel('Grocery checklist').getByText('Bananas').count(), 0);
  await latest.getByRole('button', { name: 'Add to groceries' }).click();
  await latest.getByText('Added 2 to your grocery list (the rest were already there).').waitFor();
  await groceries.getByLabel('Grocery checklist').getByText('Bananas').waitFor(); // The groceries screen refreshed without a reload.
  const planSet = (await requests(page)).filter(r => r.action === 'coach_plan_set');
  assert.equal(planSet.length, 1); assert.equal(planSet[0].value.groceries, '- [ ] Oats\n- [x] Rice\n- [ ] Bananas\n- [ ] Greek yogurt'); assert.deepEqual(planSet[0].value.meals, [{ name: 'Mon dinner', items: ['salmon', 'rice'] }]); assert.ok(planSet[0].expected_value);

  await page.evaluate(() => { window.suggestFixture.failNext = 'exercise_log'; });
  await latest.getByRole('button', { name: 'Save workout' }).click();
  await latest.getByRole('alert').filter({ hasText: 'Not saved' }).waitFor();
  await latest.getByRole('button', { name: 'Save workout' }).click();
  await latest.getByText('Saved to today’s workouts.').waitFor();
  const workouts = (await requests(page)).filter(r => r.action === 'exercise_log');
  assert.equal(workouts.length, 2); assert.equal(workouts[0].requestId, workouts[1].requestId, 'a retry reuses the same request id'); assert.equal(workouts[1].basis, 'assistant-estimate');

  await latest.getByRole('button', { name: 'Not now' }).click();
  await latest.getByText('Not saved.', { exact: false }).waitFor();
  writes = (await requests(page)).filter(r => WRITES.has(r.action));
  assert.equal(writes.some(r => r.action === 'outcome_record'), false, 'a dismissed suggestion is never saved');
  assert.equal(writes.some(r => /delete|correct|portion/.test(r.action)), false);
  console.log('PASS: Labs on: plans are shared with the assistant, cards save only on tap, groceries refresh live, retries reuse ids, dismiss and refused kinds save nothing');

  await ask(page, 'I weighed 180.4 lb at breakfast', 'Ready for you to check.\n\n' + block({ type: 'log_weight', value: 180.4, unit: 'lb', when: hourAgo }));
  await cards.last().getByRole('button', { name: 'Save weight' }).click();
  await cards.last().getByText('Saved to your weight history.').waitFor();
  const weight = (await requests(page)).find(r => r.action === 'weight_add');
  assert.equal(weight.value, 180.4); assert.equal(weight.unit, 'lb'); assert.equal(weight.source.type, 'owner-request'); assert.match(weight.observedAt, /Z$/);
  assert.deepEqual(await page.evaluate(() => window.suggestFixture.blocked), []); assert.deepEqual(errors, []);
  const EDIT_REPLY = ['Ready for you to check.',
    block({ type: 'set_portion', mealId: 'meal_syn_a1', fraction: 0.5 }),
    block({ type: 'remove_workout', workoutId: 'ex_syn0001aaaa' }),
    block({ type: 'review_purchase', purchaseId: 'lnk_syn_77', status: 'not_spending' }),
    block({ type: 'set_portion', mealId: 'meal_syn_old', fraction: 0.5 }),
    block({ type: 'remove_workout', workoutId: 'ex_invented' })].join('\n\n');
  await ask(page, 'Half portion on the burrito, remove the walk, and the coffee was a work expense', EDIT_REPLY);
  const edits = cards.last();
  await edits.getByText('Synthetic burrito bowl', { exact: false }).waitFor();
  await edits.getByText('Synthetic walk logged by mistake', { exact: false }).waitFor();
  await edits.getByText('Synthetic Coffee Co', { exact: false }).waitFor();
  await edits.getByText('cannot be changed here', { exact: false }).waitFor();
  await edits.getByText('not found in the last 31 days', { exact: false }).waitFor();
  assert.equal(await edits.getByText('Changes something already saved').count(), 5);
  assert.equal((await requests(page)).some(r => ['food_portion_set', 'exercise_delete', 'reconcile_resolve'].includes(r.action)), false, 'edits wait for a tap');
  if (process.env.SHOT_DIR) await edits.screenshot({ path: path.join(process.env.SHOT_DIR, 'assistant-edits-390.png') });
  await edits.getByRole('button', { name: 'Change portion' }).click();
  await edits.getByText('Portion set to ½; this meal now counts 450 kcal.').waitFor();
  await edits.getByRole('button', { name: 'Remove workout' }).click();
  await edits.getByText('Workout removed from your log.').waitFor();
  await edits.getByRole('button', { name: 'Mark purchase' }).click();
  await edits.getByText('Purchase marked: Not spending (ignored in totals).').waitFor();
  const changes = (await requests(page)).filter(r => ['food_portion_set', 'exercise_delete', 'reconcile_resolve'].includes(r.action));
  assert.deepEqual(changes.map(r => [r.action, r.mealId || r.id, r.fraction ?? r.status ?? null]), [['food_portion_set', 'meal_syn_a1', 0.5], ['exercise_delete', 'ex_syn0001aaaa', null], ['reconcile_resolve', 'lnk_syn_77', 'ignored']]);
  console.log('PASS: edit cards show the exact record first, refuse unknown or locked records, and change only after a tap');

  const PLAN_REPLY = ['Here are both plans.',
    block({ type: 'save_meal_plan', title: 'Synthetic easy dinners', meals: [{ name: 'Mon dinner', items: ['chicken', 'rice'], kcal: 600 }, { name: 'Tue dinner', items: ['lentil soup'] }] }),
    block({ type: 'save_workout_plan', days: { mon: [{ name: 'Strength', minutes: 30 }], fri: [{ name: 'Walk', minutes: 45 }] } })].join('\n\n');
  await ask(page, 'Write my dinner plan and a workout plan', PLAN_REPLY);
  const plans = cards.last();
  await plans.getByText('Your grocery list is kept.').waitFor();
  await plans.getByRole('button', { name: 'Save meal plan' }).click();
  await plans.getByText('Meal plan saved with 2 meals; your grocery list is unchanged.').waitFor();
  const mealPlan = (await requests(page)).filter(r => r.action === 'coach_plan_set' && r.kind === 'meal_plan').at(-1);
  assert.equal(mealPlan.value.title, 'Synthetic easy dinners'); assert.equal(mealPlan.value.meals.length, 2); assert.match(mealPlan.value.groceries, /Bananas/, 'groceries are kept'); assert.ok(mealPlan.expected_value);
  await plans.getByRole('button', { name: 'Save workout plan' }).click();
  await plans.getByText('Weekly workout plan saved.').waitFor();
  assert.deepEqual(await page.evaluate(() => window.suggestFixture.workoutPlan), { days: { mon: [{ name: 'Strength', minutes: 30 }], fri: [{ name: 'Walk', minutes: 45 }] } });
  console.log('PASS: meal and workout plans save from the chat on a tap; the meal plan keeps the grocery list');

  await ask(page, 'Fingerstick 104 just now, and set my target to 2000', ['Ready to check.', block({ type: 'log_glucose', value: 104, unit: 'mg/dL', method: 'fingerstick', when: hourAgo }), block({ type: 'set_calorie_target', calories: 2000 }), block({ type: 'log_glucose', value: 104, unit: 'mg/dL', when: hourAgo })].join('\n\n'));
  const health = cards.last();
  await health.getByText('Current target: 2200 kcal a day').waitFor();
  await health.getByText('fingerstick or another manual meter', { exact: false }).waitFor();
  await health.getByRole('button', { name: 'Save reading' }).click();
  await health.getByText('Saved as a manual glucose reading.').waitFor();
  await health.getByRole('button', { name: 'Change target' }).click();
  await health.getByText('Daily target set to 2000 kcal from today.').waitFor();
  const glucose = (await requests(page)).find(r => r.action === 'glucose_add'), target = (await requests(page)).find(r => r.action === 'food_settings_save');
  assert.equal(glucose.method, 'fingerstick'); assert.equal(glucose.unit, 'mg/dL'); assert.equal(glucose.source.type, 'owner-request');
  assert.equal(target.calorieTarget, 2000); assert.equal(target.expenditureEstimate, 2600, 'the energy estimate is kept'); assert.match(target.effectiveFrom, /^\d{4}-\d\d-\d\d$/);
  console.log('PASS: glucose needs its method; a calorie target change shows the current target and keeps the energy estimate');

  if (process.env.AXE) {
    await page.addScriptTag({ path: process.env.AXE });
    const issues = await page.evaluate(async () => (await window.axe.run(document.querySelector('[aria-label="Suggested changes"]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id));
    assert.deepEqual(issues, []); console.log('PASS: axe finds no serious or critical issues in the suggestion cards');
  }
  await context.close();
  console.log('PASS: a weight suggestion saves with its unit and an owner-confirmed source');

  const narrow = await open(320);
  await narrow.page.getByRole('switch', { name: 'Let the assistant suggest changes' }).check();
  await ask(narrow.page, 'Log lunch', REPLY);
  await narrow.page.getByRole('region', { name: 'Suggested changes' }).getByRole('button', { name: 'Save meal' }).waitFor();
  const wide = await narrow.page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(e => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().right)}`));
  assert.equal(await narrow.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll at 320px: ' + wide.join(' | '));
  assert.deepEqual(narrow.errors, []); await narrow.context.close();
  console.log('PASS: 320px has no horizontal scroll');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
