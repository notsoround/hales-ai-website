// Actual App/root, synthetic local fixtures only; no settings mutations or providers.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-settings-usability-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'actual-settings-root', configureServer(server) { server.middlewares.use((req, _res, next) => { const route = req.url?.split('?')[0]; if (route === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; if (route === '/cupcake') req.url = '/tests/assistant-integration-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const groups = ['Appearance', 'Account & security', 'Download my data', 'Close account access', 'App & updates', 'iPhone & Apple Health'];
const health = { ok: true, devices: [], last_received_at: null, last_observed_at: null, metrics: [], coverage_note: 'Synthetic saved status only.' };
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const group = (page, title) => page.locator('.cc-settings-group').filter({ has: page.locator('summary').filter({ hasText: new RegExp('^' + escaped(title) + '$') }) });
async function openSettings(page) {
  const trigger = page.locator('.cc-settings > summary'); await trigger.focus(); await trigger.press('Enter');
  await page.waitForFunction(() => document.querySelector('.cc-settings')?.open);
  await page.waitForFunction(() => document.querySelector('.cc-settings-panel')?.getAttribute('aria-modal') === 'true');
}
async function returned(page) {
  await page.waitForFunction(() => !document.querySelector('.cc-settings')?.open && document.activeElement === document.querySelector('.cc-settings > summary'));
}
async function trapped(page) {
  const count = await page.locator('.cc-settings-panel').evaluate(container => [...container.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')].filter(el => el.getClientRects().length && !el.disabled && el.tabIndex >= 0).length);
  for (const key of ['Tab', 'Shift+Tab']) for (let at = 0; at < count + 2; at++) {
    await page.keyboard.press(key);
    assert.equal(await page.evaluate(() => document.querySelector('.cc-settings-panel').contains(document.activeElement)), true, key + ' escaped Settings');
  }
  await page.locator('.cc-nav button').first().evaluate(el => el.focus());
  assert.equal(await page.evaluate(() => document.querySelector('.cc-settings-panel').contains(document.activeElement)), true, 'Background focus escaped modal containment');
}
let cases = 0;
try {
  for (const appearance of ['rose', 'caribbean']) for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const remote = [], errors = [], writes = [];
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : (remote.push(route.request().url()), route.abort()));
    await context.addInitScript(() => localStorage.setItem('synthetic-account-server', 'acc_synthetic_a'));
    await context.exposeFunction('syntheticPersonaServer', async (_owner, body) => {
      assert.equal(body.action, 'persona_get'); return { status: 200, value: { ok: true, preferences: { appearance, persona: appearance === 'rose' ? 'matthieu' : 'cupcake', name: appearance === 'rose' ? 'Matthieu' : 'Cupcake' }, revision: 1, updated: 1, saved: true } };
    });
    await context.exposeFunction('syntheticHealthServer', async (_owner, route) => { if (route !== 'health/sync' && route !== 'health/devices/list') writes.push(route); return { status: 200, value: health }; });
    await context.exposeFunction('syntheticCoachServer', async (_owner, route) => ({ status: 200, value: { ok: true, grants: [], relationships: [], coach_enabled: true, invitations_supported: true, invitations: [], limits: { max_clients: 10, max_pending_invitations: 10 }, route } }));
    await context.exposeFunction('syntheticInvitationServer', async () => ({ status: 200, value: { ok: true, relationships: [] } }));
    const page = await context.newPage(); page.setDefaultTimeout(6000); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '/cupcake/account'); await page.getByRole('button', { name: 'iPhone setup in Settings', exact: true }).waitFor();
      await page.waitForFunction(expected => document.querySelector('.cc-app')?.getAttribute('data-appearance') === expected, appearance);
      assert.equal(await page.locator('.cc-account-note').getAttribute('open'), null);
      await openSettings(page);
      assert.deepEqual(await page.locator('.cc-settings-group > summary').allTextContents(), groups);
      assert.equal(await page.locator('.cc-settings-group[open]').count(), 0);
      await trapped(page);
      for (const title of groups) await group(page, title).locator(':scope > summary').click();
      const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
      for (const label of ['Assistant appearance', 'Assistant name', 'Current password', 'New password', 'Device label', 'IANA Timezone', 'Apple Health source name', 'Connection expiry (days)']) assert.equal(await dialog.getByLabel(label, { exact: true }).count(), 1, label);
      for (const name of ['Change password', 'Create recovery code', 'Sign out', 'Sign out all devices', 'Prepare my download', 'Review account closure', 'Check for app update', 'Check connection', 'Create Apple Health connection']) assert.equal(await dialog.getByRole('button', { name, exact: true }).count(), 1, name);
      assert.equal(await dialog.getByRole('region', { name: 'Download your data', exact: true }).count(), 1);
      assert.equal(await dialog.getByRole('region', { name: 'Close your account', exact: true }).count(), 1);
      assert.equal(await dialog.getByRole('link', { name: 'Add Matthieu to iPhone', exact: true }).count(), 1);
      await trapped(page); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.keyboard.press('Escape'); await returned(page);
      await openSettings(page); await page.getByRole('button', { name: 'Close settings', exact: true }).click(); await returned(page);
      await openSettings(page); await page.locator('.cc-settings-scrim').click({ position: { x: 2, y: 2 } }); await returned(page);
      await page.reload(); await page.getByRole('button', { name: 'iPhone setup in Settings', exact: true }).click();
      await page.waitForFunction(() => { const section = document.getElementById('account-health-connection'); return section && document.activeElement === section && [...document.querySelectorAll('.cc-settings,.cc-settings-group')].filter(el => el.contains(section)).every(el => el.open); });
      assert.equal(await group(page, 'iPhone & Apple Health').getAttribute('open'), '');
      assert.equal(await page.getByRole('dialog', { name: 'Settings', exact: true }).getAttribute('aria-modal'), 'true');
      await page.keyboard.press('Escape'); await returned(page);
      await page.locator('.cc-account-note > summary').click(); await page.getByRole('button', { name: 'Open Reports', exact: true }).click();
      await page.getByRole('button', { name: 'Sharing controls', exact: true }).waitFor();
      const snapshot = await page.evaluate(() => ({ requests: window.accountFixture.requests, blocked: window.accountFixture.blocked }));
      assert.equal(snapshot.requests.some(row => ['password', 'recovery/issue', 'sign-out', 'sign-out-all'].includes(row.route) || row.route.startsWith('privacy/close/') || row.route.endsWith('/create') || row.body.action === 'account_self_export' || row.body.action === 'persona_save'), false);
      assert.deepEqual(writes, []); assert.deepEqual(snapshot.blocked, []); assert.deepEqual(remote, []); assert.deepEqual(errors, []);
      cases++; console.log(`PASS Settings account ${appearance} ${width}: six groups/controls, focus/dismiss, nested setup and Reports; no writes`);
    } finally { await context.close(); }
  }
  for (const width of [320, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const remote = [], errors = []; await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : (remote.push(route.request().url()), route.abort()));
    const page = await context.newPage(); page.setDefaultTimeout(6000); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '/cupcake?tab=feed'); await page.locator('.cc-settings > summary').waitFor(); await openSettings(page);
      assert.deepEqual(await page.locator('.cc-settings-group > summary').allTextContents(), ['Appearance', 'App & updates']);
      assert.equal(await page.locator('.cc-settings-group[open]').count(), 0); await trapped(page);
      await group(page, 'Appearance').locator(':scope > summary').click(); assert.equal(await page.getByRole('combobox', { name: 'Assistant appearance', exact: true }).count(), 1);
      await group(page, 'App & updates').locator(':scope > summary').click(); assert.equal(await page.getByRole('button', { name: 'Check for app update', exact: true }).count(), 1);
      await page.keyboard.press('Escape'); await returned(page); await openSettings(page); await page.getByRole('button', { name: 'Close settings', exact: true }).click(); await returned(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(remote, []); assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.assistantFixture.unknown), []);
      cases++; console.log(`PASS Settings legacy ${width}: retained appearance/update/install copy, focus containment and dismissal`);
    } finally { await context.close(); }
  }
  console.log(`PASS ${cases} actual-root Settings cases; synthetic read-only APIs only.`);
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
