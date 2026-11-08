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
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); await context.exposeFunction('syntheticPlanServer', syntheticPlanServer);
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('tab', { name: 'Food log', exact: true }).waitFor();
  return { context, page, errors };
}
const tab = (page, name) => page.getByRole('tab', { name, exact: true }).click();
const plan = page => page.getByRole('region', { name: 'Meal plan workspace', exact: true });
const save = page => page.getByRole('button', { name: 'Save plan & groceries', exact: true });
const saved = page => page.getByText('Plan and groceries saved to your account.', { exact: false }).waitFor();
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
  await g.getByLabel('Grocery notes').waitFor(); assert.equal(await g.getByRole('checkbox').count(), 0);
  assert.equal(await g.getByText('Plan and groceries saved to your account.', { exact: false }).count(), 0); assert.equal(plans.B, null);
  await safe(g); assert.deepEqual(checks.errors, []); await checks.context.close();
  console.log('PASS: grocery checkboxes preserve full CRLF/unknown text and extras; unsaved/reload/confirmed CAS save; stale conflict and late owner isolation; mobile/desktop');

  reset(); const first = await open(), p = first.page;
  assert.equal(await p.getByRole('button', { name: 'Add meal', exact: true }).isVisible(), true); assert.equal(calls.length, 0);
  await tab(p, 'Groceries'); await p.getByLabel('Grocery notes', { exact: true }).fill('Synthetic oats — 1 bag\nSynthetic fruit — 3');
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
  await tab(p, 'Groceries'); assert.equal(await p.getByLabel('Grocery notes').inputValue(), plans.A.groceries);
  await tab(p, 'Food log'); assert.equal(await p.getByRole('button', { name: 'Add meal', exact: true }).isVisible(), true); assert.equal(await p.locator('.cc-nutrition-timeline-item').count(), 0);
  await p.getByRole('tab', { name: 'Food log', exact: true }).focus(); await p.keyboard.press('ArrowRight'); assert.equal(await p.getByRole('tab', { name: 'Meal plan', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await p.getByRole('button', { name: 'Toggle reference viewer', exact: true }).click(); await p.getByText('200 known kcal · partial', { exact: true }).waitFor(); await p.getByText('Calories unknown', { exact: true }).waitFor(); assert.equal(await p.getByText('NaN', { exact: false }).count(), 0);
  await safe(p); assert.deepEqual(first.errors, []); await first.context.close();
  console.log('PASS: owner-entered plan + grocery persistence/readback/reload; no invented calories or consumed meals; empty plan does not fabricate grocery placeholder; keyboard/mobile tabs and honest reference viewer');

  const original = { title: 'Synthetic coach reference', notes: ['Preserve existing note'], custom: { keep: 'source metadata' }, groceries: 'Original grocery', meals: [{ name: 'Original meal', items: ['Original food'], kcal: 0, provenance: { source: 'synthetic coach' } }] };
  reset(original); const conflict = await open(), c = conflict.page; await tab(c, 'Groceries'); await c.getByLabel('Grocery notes').fill('Owner edited groceries');
  const latest = { ...structuredClone(original), title: 'Changed on another device', notes: ['Latest note'], extra: 'Latest extra', meals: [{ ...original.meals[0], provenance: { source: 'latest source' } }] }; plans.A = latest;
  await save(c).click(); await c.getByText('Latest saved version · draft kept', { exact: true }).waitFor();
  assert.equal(await c.getByLabel('Grocery notes').inputValue(), 'Owner edited groceries'); assert.deepEqual(plans.A, latest); assert.equal(await save(c).isDisabled(), true);
  await c.getByRole('button', { name: 'Reload saved plan', exact: true }).click(); assert.equal(await c.getByLabel('Grocery notes').inputValue(), 'Owner edited groceries');
  await c.getByRole('button', { name: 'Keep my draft for a new save', exact: true }).click(); await save(c).click(); await saved(c);
  assert.equal(plans.A.title, 'Changed on another device'); assert.equal(plans.A.custom.keep, 'source metadata'); assert.equal(plans.A.extra, 'Latest extra'); assert.deepEqual(plans.A.notes, ['Latest note']); assert.deepEqual(plans.A.meals[0].provenance, { source: 'latest source' }); assert.equal(plans.A.meals[0].kcal, 0); assert.equal(plans.A.groceries, 'Owner edited groceries');
  await safe(c); assert.deepEqual(conflict.errors, []); await conflict.context.close();
  console.log('PASS: atomic stale-save conflict keeps draft; reload/rebase is explicit; latest document/meal extra fields and explicit zero survive');

  for (const failure of ['lost', 'readbackFail']) {
    reset(original); const test = await open(), q = test.page; await tab(q, 'Groceries'); await q.getByLabel('Grocery notes').fill('Uncertain exact ' + failure); behavior = failure; await save(q).click(); await q.getByRole('alert').waitFor();
    assert.equal(await q.getByLabel('Grocery notes').isDisabled(), true); const firstRequest = calls.find(call => call.body.action === 'coach_plan_set');
    await tab(q, 'Food log'); await tab(q, 'Groceries'); await q.getByRole('button', { name: 'Retry same plan save', exact: true }).click(); await saved(q);
    assert.deepEqual(calls.filter(call => call.body.action === 'coach_plan_set')[1], firstRequest);
    await safe(q); assert.deepEqual(test.errors, []); await test.context.close();
  }
  console.log('PASS: uncertain committed response and readback failure retry exact desired/expected values, never optimistic success');

  reset(original); const resumed = await open(), r = resumed.page; await tab(r, 'Groceries'); await r.getByLabel('Grocery notes').fill('Owner draft retained after reload');
  await r.reload(); await tab(r, 'Groceries'); await r.getByLabel('Grocery notes').waitFor(); assert.equal(await r.getByLabel('Grocery notes').inputValue(), 'Owner draft retained after reload');
  assert.equal(calls.some(call => call.body.action === 'coach_plan_set'), false);
  behavior = 'lost'; await save(r).click(); await r.getByRole('alert').waitFor(); await r.reload(); await tab(r, 'Groceries'); await saved(r);
  assert.equal(calls.filter(call => call.body.action === 'coach_plan_set').length, 1); await safe(r); assert.deepEqual(resumed.errors, []); await resumed.context.close();
  console.log('PASS: unsaved draft survives reload without writes; uncertain save is confirmed by account readback without another write');

  reset(original); const isolated = await open(), i = isolated.page; await tab(i, 'Groceries'); await i.getByLabel('Grocery notes').fill('Owner A private unsaved draft');
  await i.evaluate(() => window.planFixture.switchOwner('B')); await tab(i, 'Groceries'); await i.getByLabel('Grocery notes').waitFor(); assert.equal(await i.getByLabel('Grocery notes').inputValue(), '');
  await i.evaluate(() => window.planFixture.switchOwner('A')); await tab(i, 'Groceries'); await i.getByLabel('Grocery notes').waitFor(); assert.equal(await i.getByLabel('Grocery notes').inputValue(), 'Owner A private unsaved draft');
  behavior = 'holdWrite'; await save(i).click(); for (let n = 0; n < 20 && !calls.some(call => call.body.action === 'coach_plan_set'); n++) await i.waitForTimeout(20);
  await i.evaluate(() => window.planFixture.switchOwner('B')); release(); await tab(i, 'Groceries'); await i.getByLabel('Grocery notes').waitFor(); assert.equal(await i.getByLabel('Grocery notes').inputValue(), ''); assert.equal(await i.getByText('Plan and groceries saved to your account.', { exact: false }).count(), 0);
  assert.equal(plans.B, null); await safe(i); assert.deepEqual(isolated.errors, []); await isolated.context.close();
  console.log('PASS: owner-scoped draft restoration and late save responses stay isolated; no legacy auth/provider/health writes');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
