import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-food-plan-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-food-plan', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-food-plan-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
let plans, calls, behavior, release;
const normalized = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
function reset(plan = null) { plans = { A: structuredClone(plan), B: null }; calls = []; behavior = 'normal'; release = () => {}; }
async function syntheticPlanServer(owner, body) {
  calls.push({ owner, body: structuredClone(body) });
  if (body.action === 'coach_plan_get') {
    if (behavior === 'holdReadback' && calls.some(call => call.body.action === 'coach_plan_set')) { behavior = 'normal'; await new Promise(resolve => { release = resolve; }); }
    if (behavior === 'readbackFail' && calls.some(call => call.body.action === 'coach_plan_set')) { behavior = 'normal'; return { status: 503, value: { ok: false } }; }
    return { status: 200, value: { ok: true, plan: plans[owner] ? { meal_plan: structuredClone(plans[owner]) } : {} } };
  }
  assert.equal(body.action, 'coach_plan_set'); assert.equal(body.kind, 'meal_plan');
  assert.deepEqual(Object.keys(body).sort(), ['action', 'kind', 'value', 'expected_value'].sort());
  if (normalized(body.value) !== normalized(plans[owner]) && normalized(body.expected_value) !== normalized(plans[owner])) return { status: 409, value: { ok: false, error: 'plan_conflict' } };
  plans[owner] = structuredClone(body.value);
  if (behavior === 'lost') { behavior = 'normal'; return { status: 200, value: { ok: true, lostResponse: true } }; }
  if (behavior === 'holdWrite') { behavior = 'normal'; await new Promise(resolve => { release = resolve; }); }
  return { status: 200, value: { ok: true, meal_plan: structuredClone(plans[owner]) } };
}
async function open(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } }); await context.exposeFunction('syntheticPlanServer', syntheticPlanServer);
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('tab', { name: 'Food log', exact: true }).waitFor();
  return { context, page, errors };
}
// Desktop folds Meal plan and Groceries into one "Plan & groceries" tab.
const tab = async (page, name) => { const wide = name !== 'Food log' && await page.getByRole('tab', { name: 'Plan & groceries', exact: true }).count(); return page.getByRole('tab', { name: wide ? 'Plan & groceries' : name, exact: true }).click(); };
const plan = page => page.getByRole('region', { name: 'Meal plan workspace', exact: true });
const save = page => page.getByRole('button', { name: 'Save plan & groceries', exact: true });
const saved = page => page.getByText('Plan and groceries saved to your account.', { exact: false }).waitFor();
// The raw list text folds behind "Edit list as text" once the checklist has items.
async function notes(page) {
  await page.locator('.cc-grocery-checklist').first().waitFor();
  const toggle = page.getByRole('button', { name: 'Edit list as text', exact: true });
  if (await toggle.count() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  return page.getByLabel('Grocery notes');
}
async function meal(page, name, items) { await page.getByRole('button', { name: 'Add planned meal', exact: true }).click(); await page.getByLabel('Meal 1 name', { exact: true }).fill(name); await page.getByLabel('Meal 1 food items · one per line', { exact: true }).fill(items); }
async function safe(page) {
  const snapshot = await page.evaluate(() => ({ requests: window.planFixture.requests, blocked: window.planFixture.blocked })); assert.deepEqual(snapshot.blocked, []);
  assert.equal(snapshot.requests.some(row => ['food_manual_log', 'food_log', 'food_analyze', 'receipt_extract'].includes(row.body.action)), false);
  for (const row of snapshot.requests.filter(row => row.body.action.startsWith('coach_plan_'))) { assert.equal(row.headers['x-cupcake-key'], undefined); assert.equal(row.headers['x-cupcake-account-context'], row.owner === 'A' ? 'acc_plan_a' : 'acc_plan_b'); assert.equal(row.body.owner_id, undefined); }
}
try {
  const checklist = await server.ssrLoadModule('/src/components/cupcake/groceryChecklist.ts');
  const rawGroceries = '# Produce\r\n- [ ] Eggs — 12\r\n* Milk\r\nBananas\r\n- [X] Oats\r\n\r\nNotes:\r\n> Keep this note\r\n```\r\nuntouched code\r\n```\r\n| store | aisle |\r\n';
  const checkedEggs = rawGroceries.replace('- [ ] Eggs', '- [x] Eggs');
  assert.equal(checklist.checkGroceryItem(rawGroceries, 1, true), checkedEggs);
  assert.equal(checklist.checkGroceryItem(checkedEggs, 1, false), rawGroceries);
  assert.equal(checklist.checkGroceryItem(rawGroceries, 9, true), rawGroceries);
  assert.equal(checklist.groceryItems(rawGroceries).length, 4);
  assert.deepEqual(checklist.groceryItems('Notes: buy ripe fruit\n- Tip: ask the butcher\nOats').map(item => item.label), ['Oats'], 'a "Notes:" line is a note, not a checkbox');
  assert.deepEqual(checklist.groceryItems('- [ ] Note: ripe ones').map(item => item.label), ['Note: ripe ones'], 'an explicit task stays an item');
  assert.deepEqual(checklist.groceryNotes(rawGroceries + 'Notes: buy ripe fruit'), [{ line: 7, text: 'Keep this note' }, { line: 12, text: 'Notes: buy ripe fruit' }]);
  assert.deepEqual(checklist.missingGroceryItems(rawGroceries, [' eggs — 12 ', 'MILK', 'Bananas', 'Oats', 'Milk — 2 litres', 'Spinach', ' spinach ', '']), ['Milk — 2 litres', 'Spinach']);
  assert.equal(checklist.appendGroceryItems(rawGroceries, ['Oats', 'Milk — 2 litres', 'Spinach']), rawGroceries + '- [ ] Milk — 2 litres\r\n- [ ] Spinach');
  assert.equal(checklist.appendGroceryItems(rawGroceries, ['Oats']), rawGroceries);
  assert.throws(() => checklist.appendGroceryItems('Notes:\n```\nkept original', ['Spinach']), /unfinished code block/);
  assert.throws(() => checklist.appendGroceryItems('x'.repeat(10000), ['Spinach']), /limit/);
  const shoppingPlan = { title: 'Synthetic weekly plan', meals: [{ name: 'Breakfast', items: ['Oats', 'Milk', 'Bananas', 'Bananas'], kcal: null, provenance: 'keep' }, { name: 'Dinner', items: ['Spinach', 'Milk — 2 litres'], kcal: 0 }], groceries: rawGroceries, custom: { original: true } };
  reset(shoppingPlan); const shopping = await open(), s = shopping.page; await tab(s, 'Groceries');
  await s.getByRole('checkbox', { name: 'Oats', exact: true }).waitFor();
  assert.equal(await s.getByLabel('Grocery notes').count(), 0, 'the list is not shown twice: raw text stays folded beside a filled checklist');
  assert.equal(await s.getByRole('button', { name: 'Edit list as text', exact: true }).getAttribute('aria-expanded'), 'false');
  assert.deepEqual(await s.getByRole('list', { name: 'Shopping notes', exact: true }).getByRole('listitem').allTextContents(), ['Keep this note']);
  await s.getByRole('button', { name: 'Choose meal plan items', exact: true }).click();
  const choices = s.getByRole('group', { name: 'Meal plan items to add', exact: true });
  assert.equal(await choices.getByRole('checkbox').count(), 2);
  assert.equal(await choices.getByRole('checkbox', { name: 'Spinach', exact: true }).isChecked(), true);
  await choices.getByRole('button', { name: 'Clear selection', exact: true }).click();
  assert.equal(await choices.getByRole('button', { name: 'Add 0 items to grocery draft', exact: true }).isDisabled(), true);
  await choices.getByRole('button', { name: 'Select all', exact: true }).click();
  await choices.getByRole('checkbox', { name: 'Milk — 2 litres', exact: true }).uncheck();
  for (const width of [320, 390, 1280]) {
    await s.setViewportSize({ width, height: 900 });
    for (const theme of ['caribbean', 'rose']) {
      await s.evaluate(value => document.querySelector('.cc-app').setAttribute('data-appearance', value), theme);
      assert.equal(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  }
  await choices.getByRole('button', { name: 'Add 1 item to grocery draft', exact: true }).click();
  assert.equal(await choices.count(), 0);
  await s.waitForFunction(() => document.activeElement?.textContent === 'Shopping checklist');
  assert.equal(await (await notes(s)).inputValue(), rawGroceries.replace(/\r\n/g, '\n') + '- [ ] Spinach');
  assert.equal(await s.getByRole('checkbox', { name: 'Oats', exact: true }).isChecked(), true);
  assert.equal(calls.some(call => call.body.action === 'coach_plan_set'), false);
  await s.reload(); await tab(s, 'Groceries');
  await s.getByRole('checkbox', { name: 'Spinach', exact: true }).waitFor();
  await s.getByRole('button', { name: 'Choose meal plan items', exact: true }).click();
  assert.equal(await s.getByRole('group', { name: 'Meal plan items to add', exact: true }).getByRole('checkbox').count(), 1);
  await s.getByRole('button', { name: 'Close meal plan items', exact: true }).click();
  await save(s).click(); await saved(s);
  assert.deepEqual(plans.A, { ...shoppingPlan, groceries: rawGroceries + '- [ ] Spinach' });
  await safe(s); assert.deepEqual(shopping.errors, []); await shopping.context.close();
  console.log('PASS: meal-plan grocery selection, exact-text dedup, distinct quantities, unchanged checked/CRLF notes and extras, draft reload, explicit confirmed save, both themes/320/390/1280; no food writes');
  const groceryPlan = { meals: [{ name: 'Reference', items: ['Preserved food'], provenance: { original: true } }], groceries: rawGroceries, custom: { keep: 'all extra fields' } };
  reset(groceryPlan); const checks = await open(), g = checks.page; await tab(g, 'Groceries');
  await g.getByRole('checkbox', { name: 'Eggs — 12', exact: true }).check();
  await g.getByText('Unsaved changes · draft kept in this browser tab', { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.body.action === 'coach_plan_set').length, 0);
  assert.equal(await g.getByRole('checkbox', { name: 'Oats', exact: true }).isChecked(), true);
  await g.reload(); await tab(g, 'Groceries'); await g.getByRole('checkbox', { name: 'Eggs — 12', exact: true }).waitFor();
  assert.equal(await g.getByRole('checkbox', { name: 'Eggs — 12', exact: true }).isChecked(), true);
  assert.equal(calls.filter(call => call.body.action === 'coach_plan_set').length, 0);
  behavior = 'holdReadback'; await save(g).click();
  for (let n = 0; n < 30 && behavior === 'holdReadback'; n++) await g.waitForTimeout(20);
  assert.equal(await g.getByRole('checkbox', { name: 'Milk', exact: true }).isDisabled(), true);
  assert.equal(await g.getByText('Plan and groceries saved to your account.', { exact: false }).count(), 0);
  release(); await saved(g); assert.deepEqual(plans.A, { ...groceryPlan, groceries: checkedEggs });
  await g.reload(); await tab(g, 'Groceries'); await g.getByRole('checkbox', { name: 'Eggs — 12', exact: true }).waitFor();
  assert.equal(await g.getByRole('checkbox', { name: 'Eggs — 12', exact: true }).isChecked(), true);
  assert.equal(await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await g.setViewportSize({ width: 1280, height: 900 }); assert.equal(await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const changed = { ...structuredClone(plans.A), title: 'New device title' }; plans.A = changed;
  await g.getByRole('checkbox', { name: 'Milk', exact: true }).check(); await save(g).click();
  await g.getByText('Latest saved version · draft kept', { exact: true }).waitFor();
  assert.deepEqual(plans.A, changed); assert.equal(await g.getByRole('checkbox', { name: 'Milk', exact: true }).isChecked(), true);
  await g.getByRole('button', { name: 'Keep my draft for a new save', exact: true }).click();
  behavior = 'holdWrite'; await save(g).click();
  for (let n = 0; n < 30 && behavior === 'holdWrite'; n++) await g.waitForTimeout(20);
  await g.evaluate(() => window.planFixture.switchOwner('B')); release(); await tab(g, 'Groceries');
  await (await notes(g)).waitFor(); assert.equal(await g.getByRole('checkbox').count(), 0);
  assert.equal(await g.getByText('Plan and groceries saved to your account.', { exact: false }).count(), 0); assert.equal(plans.B, null);
  await safe(g); assert.deepEqual(checks.errors, []); await checks.context.close();
  console.log('PASS: grocery checkboxes preserve full CRLF/unknown text and extras; unsaved/reload/confirmed CAS save; stale conflict and late owner isolation; mobile/desktop');

  reset(); const first = await open(), p = first.page;
  assert.equal(await p.getByRole('button', { name: 'Add meal', exact: true }).isVisible(), true); assert.equal(calls.length, 0);
  await tab(p, 'Groceries'); await (await notes(p)).fill('Synthetic oats — 1 bag\nSynthetic fruit — 3');
  assert.equal(await save(p).isDisabled(), true); assert.equal(calls.filter(call => call.body.action === 'coach_plan_set').length, 0);
  await p.getByRole('button', { name: 'Create your meal plan first', exact: true }).click(); await meal(p, 'Synthetic planned breakfast', 'Oats\nFruit');
  await p.getByLabel('Plan title (optional)').fill('Owner-entered reference');
  behavior = 'holdReadback'; await save(p).click(); await p.waitForFunction(() => document.body.textContent.includes('Confirming saved plan'));
  assert.equal(await p.getByText('Plan and groceries saved to your account.', { exact: false }).count(), 0);
  // Wait until the synthetic readback is held, then release it.
  for (let i = 0; i < 20 && calls.filter(call => call.body.action === 'coach_plan_get').length < 2; i++) await p.waitForTimeout(20);
  release(); await saved(p);
  assert.deepEqual(plans.A, { meals: [{ name: 'Synthetic planned breakfast', items: ['Oats', 'Fruit'] }], title: 'Owner-entered reference', groceries: 'Synthetic oats — 1 bag\nSynthetic fruit — 3' });
  assert.equal(plans.A.meals[0].kcal, undefined);
  await p.reload(); await tab(p, 'Meal plan'); await p.getByLabel('Meal 1 name', { exact: true }).waitFor(); assert.equal(await p.getByLabel('Meal 1 name', { exact: true }).inputValue(), 'Synthetic planned breakfast');
  await tab(p, 'Groceries'); assert.equal(await (await notes(p)).inputValue(), plans.A.groceries);
  await tab(p, 'Food log'); assert.equal(await p.getByRole('button', { name: 'Add meal', exact: true }).isVisible(), true); assert.equal(await p.locator('.cc-nutrition-timeline-item').count(), 0);
  await p.getByRole('tab', { name: 'Food log', exact: true }).focus(); await p.keyboard.press('ArrowRight'); assert.equal(await p.getByRole('tab', { name: 'Meal plan', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await p.getByRole('button', { name: 'Toggle reference viewer', exact: true }).click(); await p.getByText('200 known kcal · partial', { exact: true }).waitFor(); await p.getByText('Calories unknown', { exact: true }).waitFor(); assert.equal(await p.getByText('NaN', { exact: false }).count(), 0);
  await safe(p); assert.deepEqual(first.errors, []); await first.context.close();
  console.log('PASS: owner-entered plan + grocery persistence/readback/reload; no invented calories or consumed meals; empty plan does not fabricate grocery placeholder; keyboard/mobile tabs and honest reference viewer');

  const original = { title: 'Synthetic coach reference', notes: ['Preserve existing note'], custom: { keep: 'source metadata' }, groceries: 'Original grocery', meals: [{ name: 'Original meal', items: ['Original food'], kcal: 0, provenance: { source: 'synthetic coach' } }] };
  reset(original); const conflict = await open(), c = conflict.page; await tab(c, 'Groceries'); await (await notes(c)).fill('Owner edited groceries');
  const latest = { ...structuredClone(original), title: 'Changed on another device', notes: ['Latest note'], extra: 'Latest extra', meals: [{ ...original.meals[0], provenance: { source: 'latest source' } }] }; plans.A = latest;
  await save(c).click(); await c.getByText('Latest saved version · draft kept', { exact: true }).waitFor();
  assert.equal(await (await notes(c)).inputValue(), 'Owner edited groceries'); assert.deepEqual(plans.A, latest); assert.equal(await save(c).isDisabled(), true);
  await c.getByRole('button', { name: 'Reload saved plan', exact: true }).click(); assert.equal(await (await notes(c)).inputValue(), 'Owner edited groceries');
  await c.getByRole('button', { name: 'Keep my draft for a new save', exact: true }).click(); await save(c).click(); await saved(c);
  assert.equal(plans.A.title, 'Changed on another device'); assert.equal(plans.A.custom.keep, 'source metadata'); assert.equal(plans.A.extra, 'Latest extra'); assert.deepEqual(plans.A.notes, ['Latest note']); assert.deepEqual(plans.A.meals[0].provenance, { source: 'latest source' }); assert.equal(plans.A.meals[0].kcal, 0); assert.equal(plans.A.groceries, 'Owner edited groceries');
  await safe(c); assert.deepEqual(conflict.errors, []); await conflict.context.close();
  console.log('PASS: atomic stale-save conflict keeps draft; reload/rebase is explicit; latest document/meal extra fields and explicit zero survive');

  for (const failure of ['lost', 'readbackFail']) {
    reset(original); const test = await open(), q = test.page; await tab(q, 'Groceries'); await (await notes(q)).fill('Uncertain exact ' + failure); behavior = failure; await save(q).click(); await q.getByRole('alert').waitFor();
    assert.equal(await (await notes(q)).isDisabled(), true); const firstRequest = calls.find(call => call.body.action === 'coach_plan_set');
    await tab(q, 'Food log'); await tab(q, 'Groceries'); await q.getByRole('button', { name: 'Retry same plan save', exact: true }).click(); await saved(q);
    assert.deepEqual(calls.filter(call => call.body.action === 'coach_plan_set')[1], firstRequest);
    await safe(q); assert.deepEqual(test.errors, []); await test.context.close();
  }
  console.log('PASS: uncertain committed response and readback failure retry exact desired/expected values, never optimistic success');

  reset(original); const resumed = await open(), r = resumed.page; await tab(r, 'Groceries'); await (await notes(r)).fill('Owner draft retained after reload');
  await r.reload(); await tab(r, 'Groceries'); await (await notes(r)).waitFor(); assert.equal(await (await notes(r)).inputValue(), 'Owner draft retained after reload');
  assert.equal(calls.some(call => call.body.action === 'coach_plan_set'), false);
  behavior = 'lost'; await save(r).click(); await r.getByRole('alert').waitFor(); await r.reload(); await tab(r, 'Groceries'); await saved(r);
  assert.equal(calls.filter(call => call.body.action === 'coach_plan_set').length, 1); await safe(r); assert.deepEqual(resumed.errors, []); await resumed.context.close();
  console.log('PASS: unsaved draft survives reload without writes; uncertain save is confirmed by account readback without another write');

  reset(original); const isolated = await open(), i = isolated.page; await tab(i, 'Groceries'); await (await notes(i)).fill('Owner A private unsaved draft');
  await i.evaluate(() => window.planFixture.switchOwner('B')); await tab(i, 'Groceries'); await (await notes(i)).waitFor(); assert.equal(await (await notes(i)).inputValue(), '');
  await i.evaluate(() => window.planFixture.switchOwner('A')); await tab(i, 'Groceries'); await (await notes(i)).waitFor(); assert.equal(await (await notes(i)).inputValue(), 'Owner A private unsaved draft');
  behavior = 'holdWrite'; await save(i).click(); for (let n = 0; n < 20 && !calls.some(call => call.body.action === 'coach_plan_set'); n++) await i.waitForTimeout(20);
  await i.evaluate(() => window.planFixture.switchOwner('B')); release(); await tab(i, 'Groceries'); await (await notes(i)).waitFor(); assert.equal(await (await notes(i)).inputValue(), ''); assert.equal(await i.getByText('Plan and groceries saved to your account.', { exact: false }).count(), 0);
  assert.equal(plans.B, null); await safe(i); assert.deepEqual(isolated.errors, []); await isolated.context.close();
  console.log('PASS: owner-scoped draft restoration and late save responses stay isolated; no legacy auth/provider/health writes');

  reset(null); const wide = await open(1280), w = wide.page;
  assert.equal(await w.getByRole('tab', { name: 'Groceries', exact: true }).count(), 0, 'desktop folds groceries into one tab');
  await tab(w, 'Plan & groceries'); const both = w.getByRole('region', { name: 'Meal plan and grocery workspace', exact: true }); await both.waitFor();
  assert.equal(await w.getByRole('region', { name: 'Meal plan workspace', exact: true }).count() + await w.getByRole('region', { name: 'Grocery workspace', exact: true }).count(), 0, 'one workspace, not two drafts');
  await meal(w, 'Synthetic breakfast', 'Oats\nBerries');
  const planBox = await w.getByLabel('Meal 1 name', { exact: true }).boundingBox(), groceryBox = await (await notes(w)).boundingBox();
  assert.ok(groceryBox.x > planBox.x + planBox.width - 1, 'groceries sit to the right of the plan on desktop');
  await w.getByRole('button', { name: /Shop this plan/ }).click(); assert.equal(await w.evaluate(() => document.activeElement?.textContent), 'Shop your meal plan', 'Shop this plan moves focus to the grocery column');
  await w.getByRole('button', { name: 'Choose meal plan items', exact: true }).click(); await w.getByRole('button', { name: 'Add 2 items to grocery draft', exact: true }).click();
  assert.equal(await save(w).count(), 1, 'one save for both halves'); await save(w).click(); await saved(w);
  const writes = calls.filter(call => call.body.action === 'coach_plan_set'); assert.equal(writes.length, 1);
  assert.equal(writes[0].body.value.meals[0].name, 'Synthetic breakfast'); assert.match(writes[0].body.value.groceries, /Oats[\s\S]*Berries/);
  await (await notes(w)).fill('Synthetic draft kept across resize'); await w.setViewportSize({ width: 390, height: 844 });
  await w.getByRole('tab', { name: 'Groceries', exact: true }).waitFor(); await tab(w, 'Groceries'); assert.equal(await (await notes(w)).inputValue(), 'Synthetic draft kept across resize', 'shrinking to a phone keeps the same draft');
  await safe(w); assert.deepEqual(wide.errors, []); await wide.context.close();
  console.log('PASS: desktop shows plan and groceries side by side from one draft with one save; resizing keeps the draft');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
