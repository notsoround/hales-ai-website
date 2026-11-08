import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-budget-copy-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-budget-copy', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const cases = [
  ['account_budget_unavailable','Your reply allowance is unavailable right now. Your message is saved. Check again later.'],
  ['account_budget_exceeded','There isn’t enough reply allowance for this answer right now. Your message is saved.'],
  ['account_budget_reconciliation_required','Reply usage needs to be checked before another answer can start. Your message is saved.'],
  ['account_budget_attempt_already_reserved','This answer may already have started. Your message is saved. Check status before trying again.'],
  ['account_budget_attempt_not_dispatched','This answer’s status could not be confirmed. Your message is saved. Check status before trying again.'],
];
const threads = new Map(), calls = [];
let sequence = 1;
for (const status of ['failed','uncertain']) for (const [error, copy] of cases) {
  const id = '00000000-0000-4000-8000-' + String(sequence++).padStart(12, '0');
  threads.set(id, { id, title: status + ' ' + error, turns: [{ id: id + '-turn', text: 'Synthetic original ' + status + ' ' + error, status, error, retryAfter: 0 }], copy });
}
const unknown = '00000000-0000-4000-8000-000000000099';
threads.set(unknown, { id: unknown, title: 'Unknown failure fallback', turns: [{ id: unknown + '-turn', text: 'Synthetic original unknown failure', status: 'failed', error: 'account_budget_future_code', retryAfter: 0 }] });
async function syntheticQuickChatServer(owner, body) {
  assert.equal(owner, 'acc_synthetic_a'); calls.push(structuredClone(body));
  const ok = value => ({ status: 200, value: { ok: true, ...structuredClone(value) } });
  if (body.action === 'quick_chat_list') return ok({ threads: [...threads.values()].map(({ id, title }) => ({ id, title })) });
  const thread = threads.get(body.threadId); assert.ok(thread);
  if (body.action === 'quick_chat_get') return ok({ thread });
  assert.equal(body.action, 'quick_chat_begin');
  assert.equal(body.regenerate, true); assert.equal(body.turnId, thread.turns[0].id); assert.equal(body.text, thread.turns[0].text); assert.match(body.requestId, /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
  return ok({ thread, acquired: false, execution: 'server' });
}
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); await context.exposeFunction('syntheticQuickChatServer', syntheticQuickChatServer);
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByLabel('Email', { exact: true }).fill('a@example.invalid'); await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('MyCupcake — Synthetic A', { exact: true }).first().waitFor();
  await page.getByRole('navigation', { name: 'Cupcake', exact: true }).getByRole('button', { name: 'Assistant', exact: true }).click();
  const saved = page.getByLabel('Saved conversations', { exact: true });
  for (const thread of [...threads.values()].filter(thread => thread.copy)) {
    await saved.selectOption(thread.id); await page.getByText(thread.copy, { exact: true }).waitFor();
    await page.getByText(thread.turns[0].text, { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Check status', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Request another answer (may repeat the AI request)', exact: true }).isEnabled(), true);
    assert.equal(calls.filter(call => call.action === 'quick_chat_begin').length, 0);
  }
  console.log('PASS: five exact allowance codes have plain saved-message copy for failed and uncertain turns, with no automatic retry');
  const last = [...threads.values()].filter(thread => thread.copy).at(-1); const before = calls.length;
  await page.getByRole('button', { name: 'Check status', exact: true }).click(); await page.getByText(last.copy, { exact: true }).waitFor(); assert.equal(calls[before].action, 'quick_chat_get');
  await page.getByRole('button', { name: 'Request another answer (may repeat the AI request)', exact: true }).click(); await page.getByText(last.copy, { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.action === 'quick_chat_begin').length, 1);
  await saved.selectOption(unknown); await page.getByText('The reply service rejected this attempt. Your message is saved.', { exact: true }).waitFor();
  const safety = await page.evaluate(() => ({ blocked: window.accountFixture.blocked, legacyReads: window.accountFixture.legacyReads })); assert.deepEqual(safety.blocked, []); assert.equal(safety.legacyReads, 0); assert.deepEqual(errors, []);
  await context.close(); console.log('PASS: original status/read and explicit retry transport remain unchanged; unknown errors keep the existing fallback');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
