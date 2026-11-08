import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-health-sync-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-health-sync', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-health-sync-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`, browser = await chromium.launch({ headless: true });
const now = Math.floor(Date.now() / 1000); let mode, calls, held, release;
function reset(next = 'recent') { mode = next; calls = []; held = false; release = () => {}; }
function value(owner) {
  const empty = ['none', 'created'].includes(mode), received = empty ? null : mode === 'stale' ? now - 3 * 86400 : now - 300;
  const observed = empty || mode === 'emptyReceipt' ? null : '2026-11-06T06:00:00Z', metrics = observed ? ['heart_rate', 'sleep_analysis', 'step_count'] : [];
  return { ok: true, devices: mode === 'none' ? [] : [{ id: `synthetic-device-${owner}`, label: `Synthetic ${owner} iPhone`, timezone: 'America/Chicago', preferred_source: `Synthetic ${owner} Watch`, created_at: now - 10000, expires_at: now + 10000, revoked_at: mode === 'revoked' ? now - 100 : null, status: mode === 'revoked' ? 'revoked' : 'active', last_received_at: received, last_observed_at: observed, metrics }], last_received_at: received, last_observed_at: observed, metrics, coverage_note: 'Synthetic historical daily snapshots; sleep is an estimate.' };
}
async function remote(owner, route, body) {
  calls.push({ owner, route, body }); assert.equal(route, 'health/sync'); assert.deepEqual(body, {});
  if (mode === 'hold') { held = true; await new Promise(resolve => { release = resolve; }); }
  if (mode === 'error') return { status: 503, value: { ok: false, error: 'health_intake_not_ready' } };
  if (mode === 'network') throw Error('Synthetic connection lost');
  const result = value(owner); if (mode === 'malformed') result.last_received_at = 'bad-timestamp';
  return { status: 200, value: result };
}
async function open(width = 390, legacy = false) {
  const context = await browser.newContext({ viewport: { width, height: 960 } }); await context.exposeFunction('syntheticHealthServer', remote);
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + (legacy ? '/tests/account-health-sync-preview.html' : '/cupcake/account')); return { context, page, errors };
}
const ui = page => page.getByRole('region', { name: 'Apple Health uploads', exact: true });
const settled = page => page.waitForFunction(() => document.querySelector('button[aria-label="Check upload status"]')?.disabled === false);
async function safe(test) {
  const fixture = await test.page.evaluate(() => ({ requests: window.healthFixture.requests, blocked: window.healthFixture.blocked })); assert.deepEqual(fixture.blocked, []); assert.deepEqual(test.errors, []);
  for (const request of fixture.requests) { assert.equal(request.route, 'health/sync'); assert.deepEqual(request.body, {}); assert.equal(request.headers['x-cupcake-key'], undefined); assert.equal(request.headers['x-cupcake-request'], 'account'); assert.equal(request.headers['x-cupcake-account-context'], request.owner === 'A' ? 'acc_health_a' : 'acc_health_b'); }
  assert.equal(calls.some(call => call.route !== 'health/sync'), false);
}
const out = path.resolve('output/account-health-sync-card'); mkdirSync(out, { recursive: true }); const metrics = [];
try {
  if (!process.argv.includes('--layout-only')) {
  // Group 1: real status semantics across initial, no setup, permission-only, empty upload, old upload and revoked history.
  reset('hold'); const initial = await open(); await ui(initial.page).getByText('Checking Apple Health uploads…', { exact: true }).waitFor(); assert.equal(await ui(initial.page).getByText('None received', { exact: true }).count(), 0); mode = 'recent'; release(); await ui(initial.page).getByText('Daily summaries', { exact: false }).waitFor(); await safe(initial); await initial.context.close();
  for (const scenario of ['none', 'created', 'emptyReceipt', 'stale', 'revoked']) {
    reset(scenario); const test = await open(), p = test.page; await settled(p);
    if (scenario === 'none') { await ui(p).getByText('No Apple Health upload set up for this account.', { exact: true }).waitFor(); assert.equal(await ui(p).locator('dl').count(), 0); }
    if (scenario === 'created') { await ui(p).getByText('Waiting for the first upload.', { exact: false }).waitFor(); assert.equal(await ui(p).locator('dl').count(), 0); }
    if (scenario === 'emptyReceipt') { await ui(p).getByText('Upload received; no supported observations are confirmed.', { exact: true }).waitFor(); assert.equal(await ui(p).getByText('Saved previously:', { exact: false }).count(), 0); }
    if (scenario === 'stale') await ui(p).getByText('No upload received in the last 2 days.', { exact: false }).waitFor();
    if (scenario === 'revoked') { await ui(p).getByText('Connection details (1)', { exact: true }).click(); await ui(p).getByText('Upload permission revoked', { exact: false }).waitFor(); await ui(p).getByText('Saved previously:', { exact: false }).waitFor(); }
    assert.equal(await ui(p).getByText(/\bsynced\b/i).count(), 0); if (!['none', 'created', 'emptyReceipt'].includes(scenario)) { await ui(p).getByText('Nov 6, 2026 (America/Chicago)', { exact: true }).waitFor(); await ui(p).getByText('Daily summaries · Sleep is an estimate', { exact: true }).waitFor(); }
    await safe(test); await test.context.close();
  }
  console.log('PASS group 1: pending/no setup/permission-only/zero-observation receipt/stale upload/revoked history; distinct daily period+upload time, sleep estimate, no false sync');
  if (!process.argv.includes('--compact-only')) {
  // Group 2: failed reads, malformed status, account changes and legacy isolation.
  for (const scenario of ['error', 'network', 'malformed']) {
    reset(scenario); const test = await open(); await ui(test.page).getByRole('alert').waitFor(); assert.equal(await ui(test.page).getByText('Last upload received', { exact: true }).count(), 0); mode = 'recent'; await ui(test.page).getByRole('button', { name: 'Check upload status' }).click(); await ui(test.page).getByText('Daily summaries', { exact: false }).waitFor(); await safe(test); await test.context.close();
  }
  reset('hold'); const late = await open(), p = late.page; while (!held) await new Promise(resolve => setTimeout(resolve, 5)); mode = 'recent'; await p.evaluate(() => window.healthFixture.switchOwner('B')); release(); await ui(p).getByText('Latest saved daily period', { exact: true }).waitFor(); await ui(p).getByText('Connection details (1)', { exact: true }).click(); await ui(p).getByText('Synthetic B iPhone', { exact: true }).waitFor(); assert.equal(await p.getByText('Synthetic A iPhone', { exact: true }).count(), 0); await safe(late); await late.context.close();
  reset(); const legacy = await open(390, true); await legacy.page.waitForTimeout(100); assert.equal(await ui(legacy.page).count(), 0); assert.deepEqual(calls, []); await safe(legacy); await legacy.context.close();
  console.log('PASS group 2: staged/network/malformed status retry, late A read cannot appear for B, legacy entry performs no account read');
  }
  }
  // Group 3: responsive themed card plus actual existing iPhone Settings navigation; no setup write.
  for (const [width, appearance] of [[320, 'rose'], [1280, 'caribbean']]) {
    reset(); const test = await open(width), p = test.page; await p.evaluate(theme => window.healthFixture.theme(theme), appearance); await ui(p).getByText('Daily summaries · Sleep is an estimate', { exact: true }).waitFor(); assert.equal(await ui(p).locator('details').evaluate(el => el.open), false); assert.equal(await ui(p).getByText('Saved previously:', { exact: false }).isVisible(), false);
    const size = await p.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, cardWidth: document.querySelector('.cc-health-sync').getBoundingClientRect().width, cardHeight: document.querySelector('.cc-health-sync').getBoundingClientRect().height })); assert.ok(size.scroll <= size.viewport, JSON.stringify(size)); metrics.push({ width, appearance, ...size }); await ui(p).screenshot({ path: path.join(out, `health-${width}-${appearance}-collapsed.png`) });
    await ui(p).getByText('Connection details (1)', { exact: true }).click(); await ui(p).getByText('Configured export source: Synthetic A Watch', { exact: false }).waitFor(); await ui(p).getByText('Daily dates use the connection’s timezone.', { exact: false }).waitFor(); await ui(p).getByText('Saved previously:', { exact: false }).waitFor(); await ui(p).getByText('Connection details (1)', { exact: true }).click();
    const reads = calls.length; await ui(p).getByRole('button', { name: 'iPhone setup in Settings', exact: true }).click(); await p.getByRole('region', { name: 'Apple Health connection', exact: true }).waitFor(); await p.waitForFunction(() => document.getElementById('account-health-connection') === document.activeElement); await p.getByRole('region', { name: 'Add to iPhone Home Screen', exact: true }).waitFor(); assert.equal(calls.length, reads); await safe(test); await test.context.close();
  }
  console.log('PASS group 3: 320px Violet +1280px Caribbean, no overflow; setup opens/focuses real Apple Health Settings +iPhone instructions without creating a grant');
  writeFileSync(path.join(out, 'responsive-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
