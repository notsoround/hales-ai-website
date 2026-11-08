// Full app roots with local synthetic transports. Never starts voice or recording.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-voice-availability-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'local-voice-root', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; if (req.url?.split('?')[0] === '/cupcake') req.url = '/tests/assistant-integration-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0], browser = await chromium.launch({ headless: true });
try {
  for (const [name, persona, width] of [['Matthieu', 'matthieu', 390], ['Cupcake', 'cupcake', 1280]]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(({ name, persona }) => {
      localStorage.setItem('synthetic-account-server', 'acc_synthetic_a');
      localStorage.setItem('synthetic-persona-server:acc_synthetic_a', JSON.stringify({ preferences: { appearance: 'rose', persona, name }, revision: 1, updated: 1, saved: true }));
    }, { name, persona });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    await page.goto(base + 'cupcake/account?tab=talk');
    const panel = page.locator('#cupcake-assistant');
    await panel.getByRole('heading', { name: 'Live voice with ' + name, exact: true }).waitFor();
    assert.equal(await panel.getByRole('button', { name: 'Live voice unavailable', exact: true }).isDisabled(), true);
    await panel.getByText(`Live voice is not available for account sign-in yet. Choose Text to chat with ${name}, or Record to save audio and transcribe a complete clip up to three minutes.`, { exact: true }).waitFor();
    assert.equal(await panel.getByText('Private voice session', { exact: false }).count(), 0);
    await panel.getByRole('button', { name: 'Text', exact: true }).click();
    assert.equal(await panel.getByRole('button', { name: 'Text', exact: true }).getAttribute('aria-pressed'), 'true');
    await panel.getByRole('button', { name: 'Record', exact: true }).click();
    await panel.getByRole('button', { name: 'Start microphone recording', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.accountFixture.micRequests), 0);
    assert.equal(await page.evaluate(() => window.accountFixture.legacyReads), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 844 }, serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.goto(base + 'cupcake?tab=talk');
  const panel = page.locator('#cupcake-assistant');
  assert.equal(await panel.getByRole('button', { name: 'Talk to Cupcake', exact: true }).isEnabled(), true);
  assert.equal(await page.evaluate(() => window.assistantFixture.micRequests), 0);
  await panel.getByRole('button', { name: 'Minimize assistant', exact: true }).click();
  const hide = page.getByRole('button', { name: 'Hide floating companion', exact: true });
  await hide.waitFor();
  const target = await hide.boundingBox();
  assert.ok(target.width >= 44 && target.height >= 44);
  await hide.click();
  assert.equal(await page.getByRole('button', { name: /^Open .* assistant\. Drag to move/ }).count(), 0);
  await page.getByRole('navigation', { name: 'Cupcake', exact: true }).getByRole('button', { name: 'Assistant', exact: true }).click();
  await page.getByRole('button', { name: 'Show floating companion', exact: true }).click();
  await page.getByRole('button', { name: 'Minimize assistant', exact: true }).click();
  await hide.waitFor();
  await context.close();
  console.log('PASS account live voice truthfully disabled with Cupcake/Matthieu names at390/1280; Text/Record remain reachable; legacy live voice stays enabled; floating companion44px hide/restore works. No microphone or provider work started.');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
