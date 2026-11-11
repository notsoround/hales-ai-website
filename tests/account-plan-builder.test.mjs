import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-plan-builder-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-plan-builder', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-plan-builder-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const REPLY = 'Hi! Here is a simple plan for you:\n\n**Monday dinner ~600 kcal:**\n- 150 g salmon\n- 1 cup rice\n\n### Tuesday dinner\n1. Lentil soup, 2 cups\n2. Side salad\n\nWould you like snacks too?';
async function open(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('tab', { name: 'Meal plan', exact: true }).waitFor();
  return { context, page, errors };
}
const openImport = async page => { await page.getByRole('tab', { name: 'Meal plan', exact: true }).click(); await page.getByText('Paste or upload a plan', { exact: true }).click(); };
const builder = page => page.getByRole('region', { name: 'Build a plan with the assistant', exact: true });
try {
  const model = await server.ssrLoadModule('/src/components/cupcake/planBuilderModel.ts');
  const meals = model.planFromReply(REPLY);
  assert.deepEqual(meals.map(m => [m.items, m.kcal]), [[['150 g salmon', '1 cup rice'], '600'], [['Lentil soup, 2 cups', 'Side salad'], '']]);
  assert.deepEqual(meals.map(m => m.name), ['Monday dinner', 'Tuesday dinner']);
  assert.equal(model.plainReply('**Monday:**\n### Tuesday'), 'Monday:\nTuesday');
  assert.match(meals[0].name, /^Monday dinner/); assert.equal(meals.some(m => /plan for you|snacks/i.test(m.name + m.items.join())), false);
  assert.deepEqual(model.planFromReply('Sure! What do you like to eat?'), []);
  assert.equal(model.spokenText(model.builderMessage('  five lunches ', true)), 'five lunches');
  assert.equal(model.spokenText(model.builderMessage('no pork', false)), 'no pork');
  const legacy = model.builderMessage('old', true).replace('Do not claim any source except web results I paste in.', 'You cannot search the web, so do not cite or claim sources.');
  assert.equal(model.spokenText(legacy), 'old', 'saved conversations with the earlier wording still show only what was typed');
  console.log('PASS: replies become planned meals only from headings and list items; greetings and questions are ignored');

  const { context, page, errors } = await open();
  await openImport(page);
  assert.equal(await builder(page).count(), 0, 'Labs plan builder must be hidden by default');
  assert.equal(await page.getByRole('switch', { name: 'Build a plan by talking with the assistant' }).isChecked(), false);
  await page.getByRole('switch', { name: 'Build a plan by talking with the assistant' }).check();
  await builder(page).waitFor();
  await page.evaluate(reply => { window.labsFixture.replies.push(reply); }, REPLY);
  await builder(page).getByLabel('What plan do you want?').fill('Two easy dinners');
  await builder(page).getByRole('button', { name: 'Send to the assistant' }).click();
  await builder(page).getByText('The assistant is writing a draft', { exact: false }).waitFor();
  await page.evaluate(() => window.labsFixture.answer());
  await builder(page).getByText('2 planned meals found in the latest reply').waitFor();
  if (process.env.SHOT_DIR) await builder(page).screenshot({ path: path.join(process.env.SHOT_DIR, 'plan-builder-390.png') });
  if (process.env.AXE) { // WCAG 2.1 A/AA, serious and critical, on the Labs switch and the builder.
    await page.addScriptTag({ path: process.env.AXE });
    const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id));
    assert.deepEqual(found, []); console.log('PASS: axe finds no serious or critical issues with Labs on and a reply shown');
  }
  await builder(page).getByRole('button', { name: 'Add 2 planned meals to draft' }).click();
  assert.equal(await page.getByLabel('Meal 2 name', { exact: true }).inputValue(), 'Tuesday dinner');
  assert.equal(await page.getByLabel('Meal 1 planned calories (optional)', { exact: true }).inputValue(), '600');
  let requests = await page.evaluate(() => window.labsFixture.requests);
  assert.equal(requests.some(r => r.action === 'coach_plan_set'), false, 'Builder must never save the plan by itself');
  const begin = requests.find(r => r.action === 'quick_chat_begin'); assert.match(begin.text, /What I want: Two easy dinners$/); assert.match(begin.text, /Do not claim any source except web results I paste in/); assert.doesNotMatch(begin.text, /Web results I picked/);
  assert.equal(requests.some(r => r.owner_id || r.ownerId), false);
  await builder(page).locator('.cc-plan-builder-you', { hasText: 'Two easy dinners' }).waitFor();
  await page.getByRole('button', { name: 'Save plan & groceries', exact: true }).click();
  await page.getByText('Plan and groceries saved to your account.', { exact: false }).waitFor();
  const plan = await page.evaluate(() => window.labsFixture.plan); assert.equal(plan.meals.length, 2);
  console.log('PASS: Labs off by default; switch reveals builder; reply becomes an unsaved draft; only the owner’s Save writes');

  await page.reload(); await openImport(page); await builder(page).waitFor();
  await builder(page).locator('.cc-plan-builder-you', { hasText: 'Two easy dinners' }).waitFor();
  await page.getByRole('switch', { name: 'Build a plan by talking with the assistant' }).uncheck();
  assert.equal(await builder(page).count(), 0);
  const blocked = await page.evaluate(() => window.labsFixture.blocked); assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS: switch persists across reload, conversation resumes in the same tab, turning it off hides the builder');

  const second = await open(320), p = second.page;
  await p.getByRole('switch', { name: 'Build a plan by talking with the assistant' }).check();
  await p.evaluate(() => { window.labsFixture.mode = 'notReady'; }); await openImport(p);
  await builder(p).getByRole('button', { name: 'Start over' }).click().catch(() => {});
  await builder(p).getByLabel('What plan do you want?').fill('Anything');
  await builder(p).getByRole('button', { name: 'Send to the assistant' }).click();
  await builder(p).getByRole('alert').filter({ hasText: /not available/ }).waitFor();
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll at 320px');
  assert.deepEqual(second.errors, []); await second.context.close();
  console.log('PASS: unavailable chat says so plainly; 320px has no horizontal scroll');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
