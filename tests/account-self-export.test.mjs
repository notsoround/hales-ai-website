import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { emptyNativeData, nativeMetadata } from './native-health-export-fixture.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-self-export-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-self-export-root', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const A = 'acc_synthetic_a', B = 'acc_synthetic_b', sectionCodes = ['profile','health','activity','food','plans','phone','apple_health','chat','preferences','finance','library','recordings','voice','sharing','source_history','native_health'];
let mode = 'normal', release = () => {}, requests = [];
function result(owner, selected = sectionCodes) {
  const sections = Object.fromEntries(selected.map(section => [section, { status: section === 'finance' ? 'unavailable' : 'included', ...(section === 'finance' ? { reason: 'owned_schema_unavailable' } : {}), tables: section === 'food' ? { saved_meals: { rowCount: 1, columns: ['description', 'total'], jsonColumns: ['total'] } } : {} }]));
  const data = Object.fromEntries(selected.filter(section => section !== 'finance').map(section => [section, section === 'food' ? { saved_meals: [{ description: owner === A ? 'Synthetic A meal' : 'Synthetic B meal', total: '{"calories":null,"protein_g":0}' }] } : {}]));
  if (selected.includes('source_history')) {
    const sourceTables = ['source_event_receipts','source_event_versions','source_event_heads','source_event_indexed'];
    sections.source_history.tables = Object.fromEntries(sourceTables.map(table => [table, { rowCount: 0, columns: ['id'], jsonColumns: [] }]));
    data.source_history = Object.fromEntries(sourceTables.map(table => [table, []]));
  }
  if (selected.includes('native_health')) { data.native_health = emptyNativeData(); sections.native_health.tables = nativeMetadata(data.native_health); }
  const omitted = sectionCodes.filter(section => !selected.includes(section)).map(section => ({ section, reason: 'not_selected', note: 'This supported section was not selected.' }));
  return { export: { format: selected.includes('source_history') ? 'cupcake.account.local-export.v3' : selected.includes('recordings') ? 'cupcake.account.local-export.v2' : 'cupcake.account.local-export.v1', generatedAt: '2026-11-08T00:00:00Z', accountId: owner, completePrivacyExport: false, coverage: { scope: 'owned-local-structured-data', consistentSnapshot: !selected.includes('recordings') && !selected.includes('source_history'), ...(selected.includes('recordings') || selected.includes('source_history') ? { consistency: 'per-database', sourceSnapshots: [{ code: 'library', source: 'Saved account data', status: 'included', consistentSnapshot: true, readAt: '2026-11-08T00:00:00Z' }, ...(selected.includes('recordings') ? [{ code: 'recordings', source: 'Saved recording archive', status: 'included', consistentSnapshot: true, readAt: '2026-11-08T00:00:01Z' }] : []), ...(selected.includes('source_history') ? [{ code: 'source_events', source: 'Saved source-event journal', status: 'included', consistentSnapshot: true, readAt: '2026-11-08T00:00:02Z' }] : [])] } : {}), selectedSections: selected, sections, excluded: [{ section: 'binary_originals', reason: 'not_in_json_export', note: 'Original photos, audio and files are not included.' }, { section: 'authentication_and_operations', reason: 'excluded_credentials_and_operational_data', note: 'Passwords, access credentials and service operations are not included.' }, ...omitted], notes: ['Synthetic allowlisted local records only.'] }, data }, filename: 'cupcake-local-data-20261108T000000Z.json', mimeType: 'application/json' };
}
async function syntheticExportServer(owner, body) {
  requests.push({ owner, body }); assert.deepEqual(Object.keys(body).sort(), ['action','sections']); assert.equal(body.action, 'account_self_export');
  assert.ok(Array.isArray(body.sections) && body.sections.length > 0); assert.equal(new Set(body.sections).size, body.sections.length); assert.ok(body.sections.every(section => sectionCodes.includes(section)));
  if (mode === 'hold') { mode = 'normal'; await new Promise(resolve => { release = resolve; }); }
  if (mode === 'oversized') return { status: 413, value: { ok: false, error: 'export_too_large' } };
  if (mode === 'notReady') return { status: 503, value: { ok: false, error: 'export_not_ready' } };
  const response = result(owner, body.sections);
  if (mode === 'wrongExportOwner') response.export.accountId = owner === A ? B : A;
  if (mode === 'badCoverage') response.export.coverage.selectedSections = ['profile'];
  if (mode === 'globalSnapshotClaim') response.export.coverage.consistentSnapshot = true;
  if (mode === 'missingSnapshot') response.export.coverage.sourceSnapshots = undefined;
  if (mode === 'duplicateSnapshot') response.export.coverage.sourceSnapshots[1].code = 'library';
  if (mode === 'badSnapshotTime') response.export.coverage.sourceSnapshots[1].readAt = 'not a date';
  if (mode === 'nullSnapshot') response.export.coverage.sourceSnapshots[1] = null;
  if (mode === 'legacyWithRecordings') response.export.format = 'cupcake.account.local-export.v1';
  if (mode === 'missingArchive') { response.export.coverage.sourceSnapshots[1] = { code: 'recordings', source: 'Saved recording archive', status: 'unavailable', consistentSnapshot: false, readAt: null }; response.export.coverage.sections.recordings = { status: 'unavailable', reason: 'owned_schema_unavailable', tables: {} }; delete response.export.data.recordings; }
  if (mode === 'unselectedData') response.export.data.food = result(owner).export.data.food;
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
async function settings(page) { await page.locator('summary[aria-label="Settings"]').click(); await page.locator('.cc-settings-group > summary').filter({hasText:'Download my data'}).click(); await page.getByRole('region', { name: 'Download your data', exact: true }).waitFor(); }
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
  await exportUI(p).getByText('Choose sections · all selected', { exact: true }).click();
  assert.equal(await exportUI(p).getByRole('checkbox', { checked: true }).count(), sectionCodes.length);
  for (const viewport of [{ width: 320, height: 844 }, { width: 1280, height: 900 }]) {
    await p.setViewportSize(viewport);
    const layout = await exportUI(p).locator('.cc-export-sections').evaluate(fieldset => ({ pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, contentWidth: fieldset.clientWidth, scrollWidth: fieldset.scrollWidth }));
    assert.ok(layout.pageWidth <= layout.viewport); assert.ok(layout.scrollWidth <= layout.contentWidth);
    await exportUI(p).getByRole('checkbox', { name: 'Library records', exact: true }).uncheck(); await exportUI(p).getByRole('checkbox', { name: 'Library records', exact: true }).check();
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await prepare(p); await exportUI(p).getByText('Your file is ready.', { exact: false }).waitFor(); assert.equal(main.downloads.length, 0);
  assert.deepEqual(requests[0].body.sections, sectionCodes);
  await exportUI(p).getByText('Each available saved store was read consistently;', { exact: false }).waitFor();
  assert.equal(await exportUI(p).getByRole('list', { name: 'Saved store read times' }).getByRole('listitem').count(), 3);
  await exportUI(p).getByRole('list', { name: 'Download coverage', exact: true }).getByText('Meals and food settings:', { exact: false }).waitFor();
  await exportUI(p).getByText('Financial records:', { exact: false }).waitFor(); await exportUI(p).getByText('Financial records: Unavailable for this account', { exact: true }).waitFor();
  await exportUI(p).getByText('What this download leaves out', { exact: true }).click(); await exportUI(p).getByText('Original photos, audio and files are not included.', { exact: true }).waitFor();
  const downloadEvent = p.waitForEvent('download'); await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).click(); const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'cupcake-local-data-20261108T000000Z.json');
  const file = JSON.parse(readFileSync(await download.path(), 'utf8')); assert.deepEqual(file, result(A).export); assert.equal(file.identity, undefined); assert.equal(file.filename, undefined); assert.equal(file.completePrivacyExport, false); assert.equal(file.format, 'cupcake.account.local-export.v3'); assert.equal(file.coverage.consistentSnapshot, false); assert.deepEqual(JSON.parse(file.data.food.saved_meals[0].total), { calories: null, protein_g: 0 });
  assert.equal(await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); await exportUI(p).getByText('Download requested.', { exact: false }).waitFor();
  await prepare(p); await exportUI(p).getByRole('button', { name: 'Clear prepared file', exact: true }).click(); assert.equal(main.downloads.length, 1);
  const beforeSubset = requests.length;
  await exportUI(p).getByRole('button', { name: 'Clear selection', exact: true }).click();
  assert.equal(await exportUI(p).getByRole('button', { name: 'Prepare my download', exact: true }).isDisabled(), true);
  await exportUI(p).getByText('Choose at least one section to prepare your download.', { exact: true }).waitFor(); assert.equal(requests.length, beforeSubset);
  await exportUI(p).getByRole('checkbox', { name: 'Meals and food settings', exact: true }).check(); await exportUI(p).getByRole('checkbox', { name: 'Plans and goals', exact: true }).check();
  mode = 'hold'; await prepare(p); await exportUI(p).getByRole('button', { name: 'Preparing your download…', exact: true }).waitFor();
  assert.equal(await exportUI(p).getByRole('checkbox', { name: 'Meals and food settings', exact: true }).isDisabled(), true); assert.equal(await exportUI(p).getByRole('button', { name: 'Select all', exact: true }).isDisabled(), true);
  assert.deepEqual(requests.at(-1).body.sections, ['food','plans']); release();
  await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  assert.equal(await exportUI(p).getByRole('list', { name: 'Download coverage', exact: true }).getByRole('listitem').count(), 2);
  await exportUI(p).getByText('What this download leaves out', { exact: true }).click();
  await exportUI(p).getByText('Account profile: This supported section was not selected.', { exact: true }).waitFor();
  await exportUI(p).getByRole('checkbox', { name: 'Plans and goals', exact: true }).uncheck();
  assert.equal(await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0);
  await prepare(p); await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  const subsetEvent = p.waitForEvent('download'); await exportUI(p).getByRole('button', { name: 'Download JSON file', exact: true }).click();
  const subsetFile = JSON.parse(readFileSync(await (await subsetEvent).path(), 'utf8')); assert.deepEqual(subsetFile, result(A, ['food']).export);
  assert.deepEqual(subsetFile.coverage.selectedSections, ['food']); assert.deepEqual(Object.keys(subsetFile.data), ['food']);
  await safe(p); assert.deepEqual(main.errors, []); await main.context.close();
  console.log('PASS: explicit prepare/download in actual Settings, coverage/omissions, JSON export-only file with unknown/zero intact, no auto-fetch/download or legacy key');
  console.log('PASS: all selected by default; empty selection disabled; frozen subset request; changed selection clears prepared file; JSON/coverage match only chosen records');

  for (const failure of ['notReady','wrongExportOwner','badCoverage','globalSnapshotClaim','missingSnapshot','duplicateSnapshot','badSnapshotTime','nullSnapshot','legacyWithRecordings']) {
    mode = failure; const test = await open(), q = test.page; await login(q, 'a'); await settings(q); await prepare(q); await exportUI(q).getByRole('alert').waitFor();
    assert.equal(await exportUI(q).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(test.downloads.length, 0);
    if (failure === 'notReady') await exportUI(q).getByText('Your data download is not available yet. Try again later.', { exact: true }).waitFor();
    await safe(q); assert.deepEqual(test.errors, []); await test.context.close();
  }
  console.log('PASS: unavailable/mismatched-owner/malformed-coverage responses never create a download');

  mode = 'unselectedData'; const unexpected = await open(), u = unexpected.page; await login(u, 'a'); await settings(u);
  await exportUI(u).getByText('Choose sections · all selected', { exact: true }).click(); await exportUI(u).getByRole('button', { name: 'Clear selection', exact: true }).click(); await exportUI(u).getByRole('checkbox', { name: 'Account profile', exact: true }).check();
  await prepare(u); await exportUI(u).getByRole('alert').waitFor(); assert.equal(unexpected.downloads.length, 0); assert.equal(await exportUI(u).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0);
  await safe(u); assert.deepEqual(unexpected.errors, []); await unexpected.context.close(); console.log('PASS: unselected records in a returned file prevent download');

  mode = 'missingArchive'; const absent = await open(), a = absent.page; await login(a, 'a'); await settings(a); await prepare(a);
  await exportUI(a).getByText('Saved recordings and transcripts: Unavailable for this account', { exact: true }).waitFor();
  await exportUI(a).getByRole('list', { name: 'Saved store read times' }).getByText('Saved recording archive: Unavailable for this account', { exact: true }).waitFor();
  const absentEvent = a.waitForEvent('download'); await exportUI(a).getByRole('button', { name: 'Download JSON file', exact: true }).click();
  const absentFile = JSON.parse(readFileSync(await (await absentEvent).path(), 'utf8'));
  assert.equal(absentFile.data.recordings, undefined); assert.equal(absentFile.coverage.sourceSnapshots[1].readAt, null);
  await safe(a); assert.deepEqual(absent.errors, []); await absent.context.close();
  console.log('PASS: missing recording archive is visibly unavailable, without a fake zero count or snapshot time');

  mode = 'normal'; const voice = await open(), v = voice.page; await login(v, 'a'); await settings(v);
  await exportUI(v).getByText('Choose sections · all selected', { exact: true }).click();
  await exportUI(v).getByRole('button', { name: 'Clear selection', exact: true }).click();
  await exportUI(v).getByRole('checkbox', { name: 'Saved voice conversations', exact: true }).check();
  await prepare(v); await exportUI(v).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  assert.equal(await exportUI(v).getByRole('list', { name: 'Saved store read times' }).count(), 0);
  const voiceEvent = v.waitForEvent('download'); await exportUI(v).getByRole('button', { name: 'Download JSON file', exact: true }).click();
  const voiceFile = JSON.parse(readFileSync(await (await voiceEvent).path(), 'utf8'));
  assert.equal(voiceFile.format, 'cupcake.account.local-export.v1'); assert.equal(voiceFile.coverage.consistentSnapshot, true); assert.deepEqual(Object.keys(voiceFile.data), ['voice']);
  await exportUI(v).getByRole('button', { name: 'Select all', exact: true }).click();
  await exportUI(v).getByRole('checkbox', { name: 'Saved voice conversations', exact: true }).uncheck();
  await exportUI(v).getByRole('checkbox', { name: 'Saved recordings and transcripts', exact: true }).uncheck();
  await exportUI(v).getByRole('checkbox', { name: 'Invitations and sharing', exact: true }).uncheck();
  await exportUI(v).getByRole('checkbox', { name: 'Saved source-event history', exact: true }).uncheck();
  await exportUI(v).getByRole('checkbox', { name: 'Android health history', exact: true }).uncheck();
  await prepare(v); await exportUI(v).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  const legacyEvent = v.waitForEvent('download'); await exportUI(v).getByRole('button', { name: 'Download JSON file', exact: true }).click();
  const legacyFile = JSON.parse(readFileSync(await (await legacyEvent).path(), 'utf8'));
  assert.equal(legacyFile.format, 'cupcake.account.local-export.v1'); assert.deepEqual(legacyFile.coverage.selectedSections, sectionCodes.slice(0, 11));
  await safe(v); assert.deepEqual(voice.errors, []); await voice.context.close();
  console.log('PASS: voice-only and original eleven-section selections retain the existing single-store v1 download');

  mode = 'normal'; const isolation = await open(), i = isolation.page; await login(i, 'a'); await settings(i);
  await exportUI(i).getByText('Choose sections · all selected', { exact: true }).click(); await exportUI(i).getByRole('button', { name: 'Clear selection', exact: true }).click(); await exportUI(i).getByRole('checkbox', { name: 'Meals and food settings', exact: true }).check();
  await prepare(i); await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  await logout(i); await login(i, 'b'); await settings(i); assert.equal(await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(isolation.downloads.length, 0);
  await exportUI(i).getByText('Choose sections · all selected', { exact: true }).click(); assert.equal(await exportUI(i).getByRole('checkbox', { checked: true }).count(), sectionCodes.length);
  mode = 'hold'; await prepare(i); await exportUI(i).getByRole('button', { name: 'Preparing your download…', exact: true }).waitFor(); await logout(i); await login(i, 'a'); release(); await settings(i);
  assert.equal(await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(isolation.downloads.length, 0);
  await prepare(i); await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).waitFor();
  const event = i.waitForEvent('download'); await exportUI(i).getByRole('button', { name: 'Download JSON file', exact: true }).click(); const own = JSON.parse(readFileSync(await (await event).path(), 'utf8')); assert.equal(own.accountId, A);
  await safe(i); assert.deepEqual(isolation.errors, []); await isolation.context.close();
  console.log('PASS: prepared files are cleared on account switch, late prior-account exports discarded, fresh own-account download works');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
