import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-closure-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-closure-root', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const A = 'acc_synthetic_a', B = 'acc_synthetic_b', scope = 'account-close-2026-11-07';
const identities = Object.fromEntries([A, B].map(owner => [owner, { account_id: owner, email: `${owner.at(-1)}@example.invalid`, name: 'Synthetic ' + owner.at(-1).toUpperCase() }]));
const disclosure = { version: scope, effect: 'Closes this account, signs out its devices and revokes its device uploads and coach sharing.', retained: 'Saved content, originals, profile and charge evidence remain on the server. This does not erase your data.', external: 'External integrations, existing backups and copies already saved by other people are not erased.', reopening: 'You cannot sign back in or use recovery after closing. Reopening is not available in the app.', before: 'Download your supported structured data and any originals you want before closing.', receipt: 'A private receipt can confirm closure for seven days. It cannot open your account or retrieve saved content.' };
let mode = 'normal', requests = [], records = new Map(), release = () => {};
function reset(next = 'normal') { mode = next; requests = []; records = new Map(); }
async function syntheticClosureServer(owner, route, body) {
  requests.push({ owner, route, body });
  assert.match(body.request_id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/); assert.match(body.receipt_token, /^cc_[A-Za-z0-9_-]{43}$/);
  assert.equal(body.owner_id, undefined); assert.equal(body.account_id, undefined);
  const action = route.split('/').at(-1), now = Date.now() / 1000;
  assert.deepEqual(Object.keys(body).sort(), (action === 'status' ? ['request_id', 'receipt_token'] : action === 'prepare' ? ['request_id', 'receipt_token', 'scope_version'] : ['request_id', 'receipt_token', 'scope_version', 'current_password', 'confirmation']).sort());
  if (action !== 'status') assert.equal(body.scope_version, scope);
  if (mode === 'notReady') return { status: 503, value: { ok: false, error: 'account_closure_not_ready' } };
  let record = records.get(body.request_id);
  if (action === 'prepare') {
    record ||= { owner, token: body.receipt_token, closure: { request_id: body.request_id, state: 'prepared', access_closed: false, data_erased: false, closed_at: null, prepare_expires_at: now + 900, receipt_expires_at: now + 7 * 86400, scope_version: scope } };
    assert.equal(record.owner, owner); assert.equal(record.token, body.receipt_token); records.set(body.request_id, record);
    if (mode === 'lostPrepare') { mode = 'normal'; return { status: 200, value: {}, dropResponse: true }; }
    return { status: 200, value: { ok: true, identity: identities[mode === 'wrongOwner' ? B : owner], closure: record.closure, disclosure: { ...disclosure, ...(mode === 'badDisclosure' ? { version: 'unsupported-scope' } : {}) } } };
  }
  if (!record || record.token !== body.receipt_token) return { status: 404, value: { ok: false, error: 'closure_receipt_not_found' } };
  if (owner && owner !== record.owner) return { status: 409, value: { ok: false, error: 'closure_account_changed' } };
  if (action === 'status') return { status: 200, value: { ok: true, closure: { ...record.closure, ...(mode === 'falseErasure' ? { data_erased: true } : {}) } } };
  assert.equal(body.confirmation, 'CLOSE MY ACCOUNT');
  if (body.current_password !== 'Synthetic password 123!') return { status: 403, value: { ok: false, error: 'closure_password_incorrect' } };
  record.closure = { ...record.closure, state: 'closed', access_closed: true, closed_at: now };
  const lose = mode === 'lostConfirm', hold = mode === 'holdConfirm'; mode = 'normal';
  if (hold) await new Promise(resolve => { release = resolve; });
  return { status: 200, closeOwner: true, dropResponse: lose, value: { ok: true, identity: identities[owner], closure: record.closure } };
}
async function open(init) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); await context.exposeFunction('syntheticClosureServer', syntheticClosureServer);
  if (init) await context.addInitScript(init);
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor();
  return { context, page, errors };
}
async function login(page, owner = 'a') { await page.getByLabel('Email', { exact: true }).fill(owner + '@example.invalid'); await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByText('MyCupcake — Synthetic ' + owner.toUpperCase(), { exact: true }).first().waitFor(); }
async function settings(page) { await page.locator('summary[aria-label="Settings"]').click(); await ui(page).waitFor(); }
const ui = page => page.getByRole('region', { name: 'Close your account', exact: true });
const recovery = page => page.getByRole('region', { name: 'Saved account closure receipt', exact: true });
async function review(page) { await ui(page).getByRole('button', { name: 'Review account closure', exact: true }).click(); await ui(page).getByRole('heading', { name: 'Before you close access', exact: true }).waitFor(); }
async function fillConfirmation(page, password = 'Synthetic password 123!') { await ui(page).getByRole('checkbox').check(); await ui(page).getByLabel('Type CLOSE MY ACCOUNT', { exact: true }).fill('CLOSE MY ACCOUNT'); await ui(page).getByLabel('Current password to close', { exact: true }).fill(password); }
async function logout(page) { await page.getByRole('button', { name: 'Close settings', exact: true }).click(); await page.getByRole('button', { name: 'Sign out of Cupcake', exact: true }).click(); await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); }
async function safe(test) {
  const result = await test.page.evaluate(() => ({ blocked: window.accountFixture.blocked, legacyReads: window.accountFixture.legacyReads, requests: window.accountFixture.requests.filter(r => r.route.startsWith('privacy/close/')) }));
  assert.deepEqual(result.blocked, []); assert.equal(result.legacyReads, 0); assert.deepEqual(test.errors, []);
  for (const request of result.requests) { assert.equal(request.credentials, 'include'); assert.equal(request.headers['x-cupcake-request'], 'account'); assert.equal(request.headers['x-cupcake-key'], undefined); if (!request.route.endsWith('/status')) assert.ok([A, B].includes(request.headers['x-cupcake-account-context'])); }
}
async function stored(page) { return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('cupcake-account-closure-v1:')).map(k => [k, localStorage.getItem(k)]))); }
try {
  reset(); const main = await open(), p = main.page; await login(p); await settings(p);
  assert.equal(requests.length, 0); await pageExistingFunctions(p); await review(p); assert.equal(requests.length, 1);
  const intent = requests[0].body, close = ui(p).getByRole('button', { name: 'Close my account access', exact: true });
  assert.equal(await close.isDisabled(), true); await ui(p).getByRole('checkbox').check(); await ui(p).getByLabel('Type CLOSE MY ACCOUNT', { exact: true }).fill('close my account'); await ui(p).getByLabel('Current password to close', { exact: true }).fill('Synthetic password 123!'); assert.equal(await close.isDisabled(), true);
  await ui(p).getByLabel('Type CLOSE MY ACCOUNT', { exact: true }).fill('CLOSE MY ACCOUNT'); assert.equal(await close.isEnabled(), true);
  assert.equal(JSON.stringify(await stored(p)).includes('Synthetic password'), false); assert.equal(await p.getByText(intent.receipt_token, { exact: false }).count(), 0); assert.equal(p.url().includes(intent.receipt_token), false);
  const artifact = path.join(process.cwd(), 'output/account-closure-controls-2026-11-07'); mkdirSync(artifact, { recursive: true });
  for (const width of [320, 1280]) {
    await p.setViewportSize({ width, height: 900 });
    if (width === 1280) await p.evaluate(() => document.querySelector('.cc-app').setAttribute('data-appearance', 'rose'));
    const metrics = await ui(p).evaluate(el => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, width: el.clientWidth, content: el.scrollWidth })); assert.ok(metrics.page <= metrics.viewport); assert.ok(metrics.content <= metrics.width);
    await ui(p).getByLabel('Type CLOSE MY ACCOUNT', { exact: true }).focus(); await p.keyboard.press('Tab'); await ui(p).getByLabel('Current password to close', { exact: true }).evaluate(el => { if (document.activeElement !== el) throw Error('Password focus order'); });
    await close.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(artifact, `closure-${width}.png`), fullPage: true }); console.log('PASS: layout/focus', JSON.stringify(metrics));
  }
  await close.click(); await p.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); await p.getByText('Your account access is closed.', { exact: false }).waitFor();
  assert.deepEqual(requests.at(-1).body, { ...intent, current_password: 'Synthetic password 123!', confirmation: 'CLOSE MY ACCOUNT' });
  await recovery(p).getByRole('button', { name: 'Check closure receipt', exact: true }).click(); await recovery(p).getByText('Account access is closed.', { exact: true }).waitFor(); await recovery(p).getByText('Saved data has not been erased.', { exact: true }).waitFor();
  assert.equal((await recovery(p).textContent()).includes('a@example.invalid'), false); assert.equal((await recovery(p).textContent()).includes('Synthetic A'), false);
  await safe(main); await main.context.close(); console.log('PASS: explicit prepare + verified disclosure + phrase/password confirmation; private receipt; confirmed closure means access revoked, never erasure');

  reset('lostPrepare'); const lost = await open(), l = lost.page; await login(l); await settings(l); await ui(l).getByRole('button', { name: 'Review account closure', exact: true }).click(); await ui(l).getByRole('alert').waitFor();
  const original = requests[0].body; await l.reload(); await l.getByText('MyCupcake — Synthetic A', { exact: true }).first().waitFor(); await settings(l); assert.equal(requests.length, 1);
  await ui(l).getByRole('button', { name: 'Check closure receipt', exact: true }).click(); await ui(l).getByText('This request is prepared.', { exact: false }).waitFor(); await review(l); assert.deepEqual(requests.at(-1).body, original);
  mode = 'lostConfirm'; await fillConfirmation(l); await ui(l).getByRole('button', { name: 'Close my account access', exact: true }).click(); await ui(l).getByRole('alert').waitFor();
  assert.equal(await ui(l).getByRole('button', { name: 'Close my account access', exact: true }).count(), 0);
  await l.reload(); await recovery(l).waitFor(); const beforeStatus = requests.length; assert.equal(beforeStatus, 4);
  await recovery(l).getByRole('button', { name: 'Check closure receipt', exact: true }).click(); await recovery(l).getByText('Account access is closed.', { exact: true }).waitFor();
  assert.equal(requests.length, beforeStatus + 1); assert.deepEqual(requests.at(-1).body, { request_id: original.request_id, receipt_token: original.receipt_token });
  await safe(lost); await lost.context.close(); console.log('PASS: prepare/confirm lost responses recover after reload using exact saved receipt, with no automatic request or repeated confirmation');

  reset(); const wrong = await open(), w = wrong.page; await login(w); await settings(w); await review(w); await fillConfirmation(w, 'wrong synthetic password'); await ui(w).getByRole('button', { name: 'Close my account access', exact: true }).click(); await ui(w).getByText('The current password was not accepted.', { exact: false }).waitFor();
  await w.getByText('MyCupcake — Synthetic A', { exact: true }).first().waitFor(); assert.equal(records.values().next().value.closure.access_closed, false); assert.equal(JSON.stringify(await stored(w)).includes('password'), false); await safe(wrong); await wrong.context.close(); console.log('PASS: bad password preserves session and receipt; no closure or password persistence');

  reset(); const late = await open(), a = late.page; await login(a); await settings(a); await review(a); await fillConfirmation(a); mode = 'holdConfirm'; await ui(a).getByRole('button', { name: 'Close my account access', exact: true }).click(); await ui(a).getByRole('button', { name: 'Please wait…', exact: true }).waitFor();
  await logout(a); await login(a, 'b'); release(); await settings(a); await a.waitForTimeout(100);
  assert.equal(await ui(a).getByRole('button', { name: 'Check closure receipt', exact: true }).count(), 0); assert.equal(await ui(a).getByText('Account access is closed.', { exact: true }).count(), 0);
  await a.getByText('MyCupcake — Synthetic B', { exact: true }).first().waitFor(); assert.equal(await a.evaluate(() => localStorage.getItem('synthetic-account-server')), B);
  assert.equal(requests.filter(r => r.owner === B).length, 0); await safe(late); await late.context.close(); console.log('PASS: late A confirmation cannot lock B, clear B cookie, show A receipt or select a different owner');

  for (const failure of ['notReady', 'badDisclosure', 'wrongOwner']) {
    reset(failure); const test = await open(), f = test.page; await login(f); await settings(f); await ui(f).getByRole('button', { name: 'Review account closure', exact: true }).click();
    if (failure === 'wrongOwner') await f.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor();
    else { await ui(f).getByRole('alert').waitFor(); assert.equal(await ui(f).getByRole('button', { name: 'Close my account access', exact: true }).count(), 0); }
    if (failure === 'notReady') await ui(f).getByText('Account closure is not available yet. No closure was confirmed.', { exact: true }).waitFor();
    assert.equal(requests.some(r => r.route.endsWith('/confirm')), false); await safe(test); await test.context.close();
  }
  console.log('PASS: staged service, unrecognized disclosure version and wrong identity fail closed before confirmation');

  reset(); const denied = await open(), d = denied.page; await login(d); await settings(d); await d.evaluate(() => { const native = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('cupcake-account-closure-v1:')) throw Error('Synthetic storage blocked'); return native.call(this, key, value); }; });
  await ui(d).getByRole('button', { name: 'Review account closure', exact: true }).click(); await ui(d).getByText('No new closure request was sent.', { exact: false }).waitFor(); assert.equal(requests.length, 0); await safe(denied); await denied.context.close(); console.log('PASS: browser storage failure blocks prepare before network');

  reset(); const expired = await open(() => { const key = 'cupcake-account-closure-v1:acc_synthetic_a'; localStorage.setItem(key, JSON.stringify({ ownerId: 'acc_synthetic_a', request_id: '00000000-0000-4000-8000-000000000001', receipt_token: 'cc_' + 'x'.repeat(43), scope_version: 'account-close-2026-11-07', receiptExpiresAt: Date.now() / 1000 - 1 })); localStorage.setItem('cupcake-account-closure-v1:latest', key); });
  assert.deepEqual(await stored(expired.page), {}); assert.equal(await recovery(expired.page).count(), 0); assert.equal(requests.length, 0); await expired.context.close(); console.log('PASS: expired seven-day recovery capability removed locally without a request');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
async function pageExistingFunctions(page) { await page.getByRole('region', { name: 'Download your data', exact: true }).waitFor(); await page.getByRole('button', { name: 'Change password', exact: true }).waitFor(); await page.getByRole('button', { name: 'Sign out all devices', exact: true }).waitFor(); }
