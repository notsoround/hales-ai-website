import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-self-export-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-self-export-root', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const A = 'acc_synthetic_a', B = 'acc_synthetic_b', sectionCodes = ['profile','health','activity','food','plans','phone','apple_health','chat','preferences','finance','library'];
let mode = 'normal', release = () => {}, requests = [];
function result(owner) {
  const sections = Object.fromEntries(sectionCodes.map(section => [section, { status: section === 'finance' ? 'unavailable' : 'included', ...(section === 'finance' ? { reason: 'owned_schema_unavailable' } : {}), tables: section === 'food' ? { saved_meals: { rowCount: 1, columns: ['description', 'total'], jsonColumns: ['total'] } } : {} }]));
  return { export: { format: 'cupcake.account.local-export.v1', generatedAt: '2026-11-08T00:00:00Z', accountId: owner, completePrivacyExport: false, coverage: { scope: 'owned-local-structured-data', consistentSnapshot: true, selectedSections: sectionCodes, sections, excluded: [{ section: 'binary_originals', reason: 'not_in_json_export', note: 'Original photos, audio and files are not included.' }, { section: 'authentication_and_operations', reason: 'excluded_credentials_and_operational_data', note: 'Passwords, access credentials and service operations are not included.' }], notes: ['Synthetic allowlisted local records only.'] }, data: { food: { saved_meals: [{ description: owner === A ? 'Synthetic A meal' : 'Synthetic B meal', total: '{"calories":null,"protein_g":0}' }] } } }, filename: 'cupcake-local-data-20261108T000000Z.json', mimeType: 'application/json' };
}
async function syntheticExportServer(owner, body) {
  requests.push({ owner, body }); assert.deepEqual(body, { action: 'account_self_export' });
  if (mode === 'hold') { mode = 'normal'; await new Promise(resolve => { release = resolve; }); }
  if (mode === 'oversized') return { status: 413, value: { ok: false, error: 'export_too_large' } };
  if (mode === 'notReady') return { status: 503, value: { ok: false, error: 'export_not_ready' } };
  const response = result(owner);
  if (mode === 'wrongExportOwner') response.export.accountId = owner === A ? B : A;
  if (mode === 'badCoverage') response.export.coverage.selectedSections = ['profile'];
  return { status: 200, value: { ok: true, ...response } };
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); await context.exposeFunction('syntheticExportServer', syntheticExportServer);
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('dialog', dialog => dialog.accept());
  const downloads = [], errors = []; page.on('download', download => downloads.push(download)); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor();
  return { context, page, downloads, errors };
}
async function login(page, owner) {
  await page.getByLabel('Email', { exact: true }).fill(owner + '@example.invalid'); await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByText('MyCupcake — Synthetic ' + owner.toUpperCase(), { exact: true }).first().waitFor();
}
async function settings(page) { await page.locator('summary[aria-label="Settings"]').click(); await page.getByRole('region', { name: 'Download your data', exact: true }).waitFor(); }
const exportUI = page => page.getByRole('region', { name: 'Download your data', exact: true });
const prepare = page => exportUI(page).getByRole('button', { name: 'Prepare my download', exact: true }).click();
async function logout(page) { await page.getByRole('button', { name: 'Close settings', exact: true }).click(); await page.getByRole('button', { name: 'Sign out of Cupcake', exact: true }).click(); await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); }
async function safe(page) {
  const fixture = await page.evaluate(() => ({ requests: window.accountFixture.requests, blocked: window.accountFixture.blocked, legacyReads: window.accountFixture.legacyReads })); assert.deepEqual(fixture.blocked, []); assert.equal(fixture.legacyReads, 0);
  for (const request of fixture.requests.filter(request => request.body.action === 'account_self_export')) { assert.equal(request.route, 'data'); assert.equal(request.credentials, 'include'); assert.equal(request.headers['x-cupcake-request'], 'account'); assert.match(request.headers['x-cupcake-account-context'], /^acc_synthetic_[ab]$/); assert.equal(request.headers['x-cupcake-key'], undefined); assert.equal(request.body.owner_id, undefined); }
}
try {
  const main = await open(), p = main.page; await login(p, 'a'); await settings(p);
  assert.equal(requests.length, 0); assert.equal(main.downloads.length, 0);
  await prepare(p); await exportUI(p).getByText('Your file is ready.', { exact: false }).waitFor(); assert.equal(main.downloads.length, 0);
  await exportUI(p).getByRole('list', { name: 'Download coverage', exact: true }).getByText('Meals and food settings:', { exact: false }).waitFor();
  await exportUI(p).getByText('Financial records:', { exact: false }).waitFor(); await exportUI(p).getByText('Financial records: Unavailable for this account', { exact: true }).waitFor();
  await exportUI(p).getByText('What this download leaves out', { exact: true }).click(); await exportUI(p).getByText('Original photos, audio and files are not included.', { exact: true }).waitFor();
  const downloadEvent = p.waitForEvent('download'); await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).click(); const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'cupcake-local-data-20261108T000000Z.json');
  const file = JSON.parse(readFileSync(await download.path(), 'utf8')); assert.deepEqual(file, result(A).export); assert.equal(file.identity, undefined); assert.equal(file.filename, undefined); assert.equal(file.completePrivacyExport, false); assert.deepEqual(JSON.parse(file.data.food.saved_meals[0].total), { calories: null, protein_g: 0 });
  assert.equal(await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); await exportUI(p).getByText('Download requested.', { exact: false }).waitFor();
  await prepare(p); await exportUI(p).getByRole('button', { name: 'Clear prepared file', exact: true }).click(); assert.equal(main.downloads.length, 1);
  await safe(p); assert.deepEqual(main.errors, []); await main.context.close();
  console.log('PASS: explicit prepare/download in actual Settings, coverage/omissions, JSON export-only file with unknown/zero intact, no auto-fetch/download or legacy key');

  for (const failure of ['oversized','notReady','wrongExportOwner','badCoverage']) {
    mode = failure; const test = await open(), q = test.page; await login(q, 'a'); await settings(q); await prepare(q); await exportUI(q).getByRole('alert').waitFor();
    assert.equal(await exportUI(q).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(test.downloads.length, 0);
    if (failure === 'oversized') await exportUI(q).getByText('Your data exceeds the current download limit. No partial file was created.', { exact: true }).waitFor();
    if (failure === 'notReady') await exportUI(q).getByText('Your data download is not available yet. Try again later.', { exact: true }).waitFor();
    await safe(q); assert.deepEqual(test.errors, []); await test.context.close();
  }
  console.log('PASS: oversized/unavailable/mismatched-owner/malformed-coverage responses never create a download');

  mode = 'normal'; const isolation = await open(), i = isolation.page; await login(i, 'a'); await settings(i); await prepare(i); await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  await logout(i); await login(i, 'b'); await settings(i); assert.equal(await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(isolation.downloads.length, 0);
  mode = 'hold'; await prepare(i); await exportUI(i).getByRole('button', { name: 'Preparing your download…', exact: true }).waitFor(); await logout(i); await login(i, 'a'); release(); await settings(i);
  assert.equal(await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(isolation.downloads.length, 0);
  await prepare(i); await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  const event = i.waitForEvent('download'); await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).click(); const own = JSON.parse(readFileSync(await (await event).path(), 'utf8')); assert.equal(own.accountId, A);
  await safe(i); assert.deepEqual(isolation.errors, []); await isolation.context.close();
  console.log('PASS: prepared files are cleared on account switch, late prior-account exports discarded, fresh own-account download works');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
