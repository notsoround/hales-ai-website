import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

// Actual React/Settings with isolated accounts and actual small ZIP files.
// All remote requests are intercepted; no production records or providers are used.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-source-history-export-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-source-history-export', configureServer(server) {
  server.middlewares.use((request, _response, next) => { if (request.url?.split('?')[0] === '/cupcake/account') request.url = '/tests/account-browser-preview.html'; next(); });
} }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`, browser = await chromium.launch({ headless: true });
const A = 'acc_synthetic_a', B = 'acc_synthetic_b';
const tables = {
  profile: ['accounts'], health: ['weight_batches', 'weight_versions', 'weight_clients', 'weight_adjustments', 'weight_manual_requests', 'health_manual_observations', 'body_checkins'],
  activity: ['personal_outcomes', 'exercise_entries'], food: ['food_meals', 'food_items', 'food_nutrition_settings'], plans: ['coach_plan'],
  phone: ['phone_daily_uploads', 'phone_daily_heads', 'ringconn_night_snapshots', 'ringconn_night_heads'],
  apple_health: ['health_device_grants', 'health_auto_export_batches', 'health_auto_export_points'], chat: ['quick_chat_threads', 'quick_chat_turns', 'quick_chat_attempts'],
  preferences: ['account_personas'], finance: ['receipts', 'receipt_candidate_sets', 'receipt_matches', 'recon_events', 'recon_links', 'recon_coverage'],
  library: ['documents', 'overlays', 'analyses', 'decisions', 'projects'], recordings: ['recordings', 'account_audio_transcription_requests', 'documents'], voice: ['account_voice_sessions', 'documents'],
  sharing: ['coach_invitations', 'coach_memberships', 'coach_grants', 'coach_membership_grants'],
  source_history: ['source_event_receipts', 'source_event_versions', 'source_event_heads', 'source_event_indexed'],
};
const sections = Object.keys(tables), calls = [], jobs = new Map(), archiveCache = new Map();
let mode = 'json', release;
const excluded = ['binary_originals', 'external_sources', 'auxiliary_history', 'authentication_and_operations', 'other_accounts_and_shared_reports'].map(section => ({ section, reason: 'excluded', note: `${section} is outside this partial export.` }));
function originalVersions(owner) {
  return {
    source_event_receipts: [1, 2].map(version => ({ receipt_id: `receipt_${version}`, owner_id: owner, event_id: `event_${version}`, event_hash: String(version).repeat(64), source_key: 'synthetic_source', source_version: version, content_hash: String(version).repeat(64), document_id: 'doc_synthetic', operation: 'upsert', predecessor_version: version === 1 ? null : 1, accepted_at: 1790000000 + version, provenance_json: '{"source":"synthetic_device","estimated":true}' })),
    source_event_versions: [1, 2].map(version => ({ source_key: 'synthetic_source', source_version: version, document_id: 'doc_synthetic', receipt_id: `receipt_${version}`, event_json: JSON.stringify({ description: `Original version ${version}`, calories: null, protein_g: 0 }), projection_json: JSON.stringify({ document_id: 'doc_synthetic', version, estimated: true }) })),
    source_event_heads: [{ source_key: 'synthetic_source', source_version: 2 }],
    source_event_indexed: [{ receipt_id: 'receipt_2', document_id: 'doc_synthetic', projection_hash: '2'.repeat(64), indexed_at: 1790000010 }],
  };
}
const unavailable = owner => owner === B;
function dataset(owner, selected, empty = false) {
  return Object.fromEntries(selected.filter(section => section !== 'source_history' || !unavailable(owner)).map(section => [section, section === 'source_history' && !empty ? originalVersions(owner) : Object.fromEntries(tables[section].map(table => [table, []]))]));
}
function sourceSnapshots(owner, selected) {
  return [{ code: 'library', source: 'Saved account data', status: 'included', consistentSnapshot: true, readAt: '2026-11-08T12:00:00Z' },
    ...(selected.includes('recordings') ? [{ code: 'recordings', source: 'Saved recording archive', status: 'included', consistentSnapshot: true, readAt: '2026-11-08T12:00:01Z' }] : []),
    ...(selected.includes('source_history') ? [{ code: 'source_events', source: 'Saved source-event journal', ...(unavailable(owner) ? { status: 'unavailable', reason: 'fixed_owner_source_not_connected', consistentSnapshot: false, readAt: null } : { status: 'included', consistentSnapshot: true, readAt: '2026-11-08T12:00:02Z' }) }] : [])];
}
function coverageFor(owner, selected, data) {
  const multi = selected.includes('recordings') || selected.includes('source_history');
  return { scope: 'owned-local-structured-data', consistentSnapshot: !multi, ...(multi ? { consistency: 'per-database', sourceSnapshots: sourceSnapshots(owner, selected) } : {}), selectedSections: selected,
    sections: Object.fromEntries(selected.map(section => [section, section === 'source_history' && unavailable(owner) ? { status: 'unavailable', reason: 'fixed_owner_source_not_connected', tables: {} } : { status: 'included', tables: Object.fromEntries(Object.entries(data[section]).map(([table, rows]) => [table, { rowCount: rows.length, columns: rows.length ? Object.keys(rows[0]) : ['id'], jsonColumns: Object.keys(rows[0] || {}).filter(key => key.endsWith('_json')) }])) }])), excluded, notes: ['Only retained owned source versions; provider copies and other sources remain excluded.'] };
}
function jsonResult(owner, selected) {
  const data = dataset(owner, selected, mode === 'jsonEmpty');
  return { ok: true, export: { format: selected.includes('source_history') ? 'cupcake.account.local-export.v3' : selected.includes('recordings') ? 'cupcake.account.local-export.v2' : 'cupcake.account.local-export.v1', generatedAt: '2026-11-08T12:00:03Z', accountId: owner, completePrivacyExport: false, coverage: coverageFor(owner, selected, data), data }, filename: 'cupcake-local-data-20261108T120003Z.json', mimeType: 'application/json' };
}
function mutate(file, selected, fault) {
  const snapshots = file.coverage.sourceSnapshots, source = snapshots?.find(item => item.code === 'source_events');
  if (fault === 'wrongOwner') file.accountId = B;
  if (fault === 'missingSource') file.coverage.sourceSnapshots = snapshots.filter(item => item.code !== 'source_events');
  if (fault === 'unknownSource') source.code = 'external_provider';
  if (fault === 'duplicateSource') source.code = 'library';
  if (fault === 'falseAtomic') file.coverage.consistentSnapshot = true;
  if (fault === 'badTime') source.readAt = null;
  if (fault === 'missingReason') delete source.reason;
  if (fault === 'mismatchedReason') source.reason = 'unrelated_reason';
  if (fault === 'sectionMismatch') source.status = 'unavailable', source.consistentSnapshot = false, source.readAt = null, source.reason = 'fixed_owner_source_not_connected';
  if (fault === 'extraRecordingSource') file.coverage.sourceSnapshots.push({ code: 'recordings', source: 'Unselected recordings', status: 'included', consistentSnapshot: true, readAt: '2026-11-08T12:00:01Z' });
  if (fault === 'missingTable') delete file.coverage.sections.source_history.tables.source_event_heads;
  if (fault === 'unknownTable') file.coverage.sections.source_history.tables.foreign_events = { rowCount: 0, columns: ['id'], jsonColumns: [], chunks: [] };
  if (fault === 'oldFormat') file.format = 'cupcake.account.local-export.v2';
  if (fault === 'unavailableData') file.data.source_history = originalVersions(A);
  assert.deepEqual(selected, ['source_history']);
}
function archive(owner, selected, originals = false) {
  const key = JSON.stringify([owner, selected, originals]);
  if (archiveCache.has(key)) return archiveCache.get(key);
  const data = dataset(owner, selected), coverage = coverageFor(owner, selected, data);
  const python = `import base64,hashlib,io,json,sys,zipfile
p=json.loads(sys.argv[1]);raw=io.BytesIO();record_bytes=0;coverage=p['coverage']
with zipfile.ZipFile(raw,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for section,entry in coverage['sections'].items():
  for table,info in entry['tables'].items():
   rows=p['data'][section][table];chunks=[]
   if rows:
    data=''.join(json.dumps(row,separators=(',',':'))+'\\n' for row in rows).encode();member=f'data/{section}/{table}/000001.ndjson';z.writestr(member,data);record_bytes+=len(data);chunks=[{'member':member,'rowCount':len(rows),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}]
   info['chunks']=chunks
 if 'sourceSnapshots' not in coverage:coverage.update(consistency='single-database',sourceSnapshots=[{'code':'library','source':'Saved account data','status':'included','consistentSnapshot':True,'readAt':'2026-11-08T12:00:00Z'}])
 coverage['noRowTruncation']=True
 manifest={'format':'cupcake.account.structured-bundle.v1','generatedAt':'2026-11-08T12:00:03Z','accountId':p['owner'],'completePrivacyExport':False,'recordBytes':record_bytes,'coverage':coverage}
 if p['originals']:
  coverage['scope']='owned-local-structured-data-and-selected-originals';coverage['excluded']=[entry for entry in coverage['excluded'] if entry['section']!='binary_originals'];manifest['originals']={'requested':True,'status':'included','files':[],'includedBytes':0,'unavailableCount':0,'sectionFailures':[]}
 z.writestr('manifest.json',json.dumps(manifest,separators=(',',':')))
data=raw.getvalue();print(json.dumps({'manifest':manifest,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'base64':base64.b64encode(data).decode()}))`;
  const value = JSON.parse(execFileSync('python3', ['-c', python, JSON.stringify({ owner, data, coverage, originals })]).toString());
  value.data = Buffer.from(value.base64, 'base64'); archiveCache.set(key, value); return value;
}
async function jsonServer(owner, body) {
  calls.push({ owner, route: 'data', body }); assert.deepEqual(Object.keys(body).sort(), ['action', 'sections']);
  if (mode.startsWith('zip')) return { status: 413, value: { ok: false, error: 'export_too_large' } };
  const value = jsonResult(owner, body.sections);
  if (mode.startsWith('json:')) mutate(value.export, body.sections, mode.slice(5));
  if (mode === 'jsonHold') await new Promise(resolve => { release = resolve; });
  return { status: 200, value };
}
function status(owner, id) {
  const job = jobs.get(owner + ':' + id), file = archive(owner, job.sections, job.originals);
  return { ok: true, id, requestId: id, state: 'ready', createdAt: '2026-11-08T12:00:00Z', expiresAt: new Date(Date.now() + 3600000).toISOString(), selectedSections: job.sections, ...(job.originals ? { includeOriginals: true } : {}), error: null, filename: `cupcake-structured-data-${id}.zip`, mimeType: 'application/zip', bytes: file.bytes, sha256: file.sha256, manifest: structuredClone(file.manifest) };
}
async function bundleServer(owner, route, body) {
  calls.push({ owner, route, body }); const key = owner + ':' + body.request_id;
  if (route === 'exports/prepare') {
    assert.ok(!jobs.has(key), 'No duplicate preparation.'); jobs.set(key, { sections: body.sections, originals: body.include_originals === true });
    return { status: 202, value: { ...status(owner, body.request_id), state: 'building', bytes: null, sha256: null, manifest: null }, dropResponse: mode === 'zipLostPrepare' };
  }
  assert.deepEqual(Object.keys(body), ['request_id']);
  if (!jobs.has(key)) return { status: 404, value: { ok: false, error: 'export_not_found' } };
  if (route === 'exports/status') {
    const value = status(owner, body.request_id);
    if (mode.startsWith('zip:')) mutate(value.manifest, value.selectedSections, mode.slice(4));
    return { status: 200, value };
  }
  assert.equal(route, 'exports/download');
  if (mode === 'zipDenied') return { status: 401, value: { ok: false, error: 'unauthenticated' } };
  const job = jobs.get(key), file = archive(owner, job.sections, job.originals);
  return { status: 200, bytes: [...file.data], headers: { 'Content-Type': 'application/zip', 'Content-Length': String(file.bytes), 'X-Cupcake-Export-SHA256': file.sha256, 'X-Cupcake-Export-Request': body.request_id, 'X-Cupcake-Account-Context': owner } };
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.exposeFunction('syntheticExportServer', jsonServer); await context.exposeFunction('syntheticExportBundleServer', bundleServer);
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('dialog', dialog => dialog.accept());
  const downloads = [], errors = []; page.on('download', value => downloads.push(value)); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); return { context, page, downloads, errors };
}
async function login(page, owner = 'a') {
  await page.getByLabel('Email', { exact: true }).fill(owner + '@example.invalid'); await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByText('MyCupcake — Synthetic ' + owner.toUpperCase(), { exact: true }).first().waitFor();
}
const ui = page => page.getByRole('region', { name: 'Download your data', exact: true });
async function settings(page) { await page.locator('summary[aria-label="Settings"]').click(); await page.locator('.cc-settings-group > summary').filter({ hasText: 'Download my data' }).click(); await ui(page).waitFor(); }
async function choose(page, selected) {
  await ui(page).locator('.cc-export-picker > summary').filter({ hasText: /^Choose sections/ }).click(); await ui(page).getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const section of selected) await ui(page).getByRole('checkbox', { name: ({ source_history: 'Saved source-event history', recordings: 'Saved recordings and transcripts', profile: 'Account profile' })[section], exact: true }).check();
}
const prepare = page => ui(page).getByRole('button', { name: 'Prepare my download', exact: true }).click();
const zipButton = page => ui(page).getByRole('button', { name: 'Download ZIP file', exact: true });
async function safe(test) {
  const value = await test.page.evaluate(() => ({ requests: window.accountFixture.requests, blocked: window.accountFixture.blocked, legacyReads: window.accountFixture.legacyReads }));
  assert.deepEqual(value.blocked, []); assert.equal(value.legacyReads, 0); assert.deepEqual(test.errors, []);
  for (const request of value.requests.filter(item => item.route.startsWith('exports/') || item.body.action === 'account_self_export')) {
    assert.equal(request.credentials, 'include'); assert.equal(request.headers['x-cupcake-request'], 'account'); assert.match(request.headers['x-cupcake-account-context'], /^acc_synthetic_[ab]$/);
    assert.equal(request.headers['x-cupcake-key'], undefined); assert.equal(request.body.owner_id, undefined);
  }
}
async function downloadJSON(page) { const event = page.waitForEvent('download'); await ui(page).getByRole('button', { name: 'Download JSON file', exact: true }).click(); return JSON.parse(readFileSync(await (await event).path(), 'utf8')); }
async function downloadZIP(page, owner, selected, originals = false) {
  const event = page.waitForEvent('download'); await zipButton(page).click(); const filename = await (await event).path();
  assert.equal(createHash('sha256').update(readFileSync(filename)).digest('hex'), archive(owner, selected, originals).sha256);
  return JSON.parse(execFileSync('python3', ['-c', "import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;m=json.loads(z.read('manifest.json'));print(json.dumps({'manifest':m,'history':{table:[json.loads(line) for chunk in info['chunks'] for line in z.read(chunk['member']).splitlines()] for table,info in m['coverage']['sections'].get('source_history',{}).get('tables',{}).items()}}))", filename]).toString());
}
try {
  for (const selected of [['source_history'], ['recordings', 'source_history']]) {
    mode = 'json'; const test = await open(), p = test.page; await login(p); await settings(p); assert.equal(test.downloads.length, 0);
    await ui(p).getByText('Saved source-event history includes retained original event versions.', { exact: false }).waitFor();
    await choose(p, selected); await prepare(p); await ui(p).getByText('Saved source-event history: 6 saved records', { exact: true }).waitFor();
    assert.equal(await ui(p).getByRole('list', { name: 'Saved store read times' }).getByRole('listitem').count(), selected.length + 1);
    const file = await downloadJSON(p); assert.equal(file.format, 'cupcake.account.local-export.v3'); assert.equal(file.completePrivacyExport, false); assert.equal(file.coverage.consistentSnapshot, false);
    assert.deepEqual(file.data.source_history, originalVersions(A)); assert.equal(JSON.parse(file.data.source_history.source_event_versions[0].event_json).calories, null); assert.equal(JSON.parse(file.data.source_history.source_event_versions[0].event_json).protein_g, 0);
    await safe(test); await test.context.close();
  }
  console.log('PASS: source history and recording combination use v3 with exact separate read times; both original versions, unknown/null, zero and estimate provenance survive explicit JSON download.');

  for (const [current, owner] of [['jsonEmpty', 'a'], ['json', 'b']]) {
    mode = current; const test = await open(), p = test.page; await login(p, owner); await settings(p); await choose(p, ['source_history']); await prepare(p);
    await ui(p).getByText(owner === 'a' ? 'Saved source-event history: 0 saved records' : 'Saved source-event history: Unavailable for this account', { exact: true }).waitFor();
    if (owner === 'b') await ui(p).getByRole('list', { name: 'Saved store read times' }).getByText('Saved source-event journal: Unavailable for this account', { exact: true }).waitFor();
    const file = await downloadJSON(p);
    if (owner === 'a') assert.deepEqual(file.data.source_history, Object.fromEntries(tables.source_history.map(table => [table, []])));
    else { assert.equal(file.data.source_history, undefined); assert.equal(file.coverage.sourceSnapshots.find(source => source.code === 'source_events').readAt, null); assert.equal(file.coverage.sections.source_history.reason, 'fixed_owner_source_not_connected'); }
    await safe(test); await test.context.close();
  }
  console.log('PASS: empty owned history is distinct from unavailable/unconnected history; no other-account records or invented read time are shown.');

  const faults = ['wrongOwner', 'missingSource', 'unknownSource', 'duplicateSource', 'falseAtomic', 'badTime', 'sectionMismatch', 'extraRecordingSource', 'missingTable', 'unknownTable'];
  for (const format of ['json', 'zip']) for (const fault of [...faults, ...(format === 'json' ? ['oldFormat'] : [])]) {
    mode = format + ':' + fault; const test = await open(), p = test.page; await login(p); await settings(p); await choose(p, ['source_history']); await prepare(p);
    await ui(p).getByRole('alert').waitFor(); assert.equal(await zipButton(p).count(), 0); assert.equal(await ui(p).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(test.downloads.length, 0);
    await safe(test); await test.context.close();
  }
  for (const current of ['json:missingReason', 'json:mismatchedReason', 'json:unavailableData', 'zip:missingReason', 'zip:mismatchedReason']) {
    mode = current; const test = await open(), p = test.page; await login(p, 'b'); await settings(p); await choose(p, ['source_history']); await prepare(p); await ui(p).getByRole('alert').waitFor();
    assert.equal(await zipButton(p).count(), 0); assert.equal(await ui(p).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(test.downloads.length, 0); await safe(test); await test.context.close();
  }
  console.log('PASS: JSON and ZIP reject foreign owner, unknown/missing/duplicate store, false atomicity, invalid read time, unbound status/reason, unselected recording store and incomplete/unknown tables.');

  for (const [owner, selected] of [['a', ['source_history']], ['a', ['recordings', 'source_history']], ['b', ['source_history']]]) {
    mode = 'zip'; const test = await open(), p = test.page; await login(p, owner); await settings(p); await choose(p, selected); await prepare(p); await zipButton(p).waitFor(); assert.equal(test.downloads.length, 0);
    const file = await downloadZIP(p, owner === 'a' ? A : B, selected); assert.equal(file.manifest.format, 'cupcake.account.structured-bundle.v1');
    assert.deepEqual(file.history, owner === 'a' ? originalVersions(A) : {}); assert.deepEqual(file.manifest.coverage.sourceSnapshots.map(source => source.code), ['library', ...(selected.includes('recordings') ? ['recordings'] : []), 'source_events']);
    await safe(test); await test.context.close();
  }
  console.log('PASS: actual fixture ZIP bytes retain the unchanged ZIP format, all original event versions, selected dynamic snapshots and honest unavailable history.');

  for (const length of [13, 14]) for (const originals of [false, true]) {
    mode = 'zip'; const test = await open(), p = test.page; await login(p);
    const selected = sections.slice(0, length), requestId = `00000000-0000-4000-8000-0000000000${length + (originals ? 2 : 0)}`;
    const intent = { request_id: requestId, sections: selected, ...(originals ? { include_originals: true } : {}) }; jobs.set(A + ':' + requestId, { sections: selected, originals });
    await p.evaluate(value => sessionStorage.setItem('cupcake-account-export-intent-v1:acc_synthetic_a', JSON.stringify(value)), intent);
    const before = calls.length; await p.reload(); await p.getByText('MyCupcake — Synthetic A', { exact: true }).first().waitFor(); await settings(p); await zipButton(p).waitFor();
    assert.ok(calls.slice(before).filter(call => call.route.startsWith('exports/')).every(call => call.route === 'exports/status' && call.body.request_id === requestId)); assert.equal(test.downloads.length, 0);
    await ui(p).getByText(`Choose sections · ${length} selected`, { exact: true }).click(); assert.equal(await ui(p).getByRole('checkbox', { name: 'Saved source-event history', exact: true }).isChecked(), false);
    assert.equal(await ui(p).getByRole('checkbox', { name: 'Include original photos and audio', exact: true }).isChecked(), originals);
    const file = await downloadZIP(p, A, selected, originals); assert.deepEqual(file.manifest.coverage.selectedSections, selected); assert.equal(file.manifest.coverage.sections.source_history, undefined);
    await safe(test); await test.context.close();
  }
  console.log('PASS: old13/14 pending intents with either original-file option keep exact UUID/selection, recover via status only and never silently acquire source history.');

  for (const selected of [['profile'], ['recordings']]) {
    mode = 'json'; const test = await open(), p = test.page; await login(p); await settings(p); await choose(p, selected); await prepare(p);
    const file = await downloadJSON(p); assert.equal(file.format, selected.includes('recordings') ? 'cupcake.account.local-export.v2' : 'cupcake.account.local-export.v1');
    assert.equal(file.coverage.sourceSnapshots?.some(source => source.code === 'source_events'), undefined === file.coverage.sourceSnapshots ? undefined : false); await safe(test); await test.context.close();
  }
  mode = 'zip'; const denied = await open(), d = denied.page; await login(d); await settings(d); await choose(d, ['source_history']); await prepare(d); await zipButton(d).waitFor(); mode = 'zipDenied'; await zipButton(d).click();
  await d.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); assert.equal(denied.downloads.length, 0); await safe(denied); await denied.context.close();
  console.log('PASS: legacy v1/v2 selections remain unchanged; revoked sign-in cannot download prepared source history.');
} finally { release?.(); await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
