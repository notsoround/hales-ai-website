import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

// Local React/Settings acceptance with disposable accounts and real small ZIP bytes.
// Every external request is intercepted; this does not contact production or a provider.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-sharing-export-'));
const server = await createServer({
  cacheDir,
  plugins: [{ name: 'synthetic-sharing-export', configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url?.split('?')[0] === '/cupcake/account') request.url = '/tests/account-browser-preview.html';
      next();
    });
  } }],
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const A = 'acc_synthetic_a', B = 'acc_synthetic_b';
const tableNames = {
  profile: ['accounts'],
  health: ['weight_batches', 'weight_versions', 'weight_clients', 'weight_adjustments', 'weight_manual_requests', 'health_manual_observations', 'body_checkins'],
  activity: ['personal_outcomes', 'exercise_entries'], food: ['food_meals', 'food_items', 'food_nutrition_settings'], plans: ['coach_plan'],
  phone: ['phone_daily_uploads', 'phone_daily_heads', 'ringconn_night_snapshots', 'ringconn_night_heads'],
  apple_health: ['health_device_grants', 'health_auto_export_batches', 'health_auto_export_points'],
  chat: ['quick_chat_threads', 'quick_chat_turns', 'quick_chat_attempts'], preferences: ['account_personas'],
  finance: ['receipts', 'receipt_candidate_sets', 'receipt_matches', 'recon_events', 'recon_links', 'recon_coverage'],
  library: ['documents', 'overlays', 'analyses', 'decisions', 'projects'],
  recordings: ['recordings', 'account_audio_transcription_requests', 'documents'], voice: ['account_voice_sessions', 'documents'],
  sharing: ['coach_invitations', 'coach_memberships', 'coach_grants', 'coach_membership_grants'],
};
const sections = Object.keys(tableNames), legacySections = sections.slice(0, 13);
const columns = {
  coach_invitations: ['id', 'coach_id', 'member_id', 'persona', 'created', 'expires', 'ttl_days', 'revoked', 'accepted'],
  coach_memberships: ['id', 'coach_id', 'member_id', 'invitation_id', 'created', 'disclosure_version', 'confirmed_persona'],
  coach_grants: ['id', 'data_owner_id', 'subject_id', 'scopes', 'created', 'expires', 'revoked'],
  coach_membership_grants: ['grant_id', 'membership_id'],
};
function sharingRows(owner) {
  return {
    coach_invitations: [{ id: 'inv_synthetic', coach_id: owner, member_id: null, persona: 'matthieu', created: 1790000000, expires: 1790600000, ttl_days: 7, revoked: null, accepted: null }],
    coach_memberships: [{ id: 'member_synthetic', coach_id: owner, member_id: 'acc_synthetic_peer', invitation_id: 'inv_accepted', created: 1780000000, disclosure_version: 'v1', confirmed_persona: 'matthieu' }],
    coach_grants: [{ id: 'grant_synthetic', data_owner_id: owner, subject_id: 'acc_synthetic_peer', scopes: '["health_report"]', created: 1780000000, expires: 1780600000, revoked: 1780500000 }],
    coach_membership_grants: [{ grant_id: 'grant_synthetic', membership_id: 'member_synthetic' }],
  };
}
function dataset(owner, selected, unavailable = false) {
  return Object.fromEntries(selected.filter(section => section !== 'sharing' || !unavailable).map(section => [section,
    section === 'sharing' ? sharingRows(owner) : Object.fromEntries(tableNames[section].map(table => [table, []])),
  ]));
}
const excluded = ['binary_originals', 'external_sources', 'auxiliary_history', 'authentication_and_operations', 'other_accounts_and_shared_reports']
  .map(section => ({ section, reason: 'excluded', note: `${section} remains excluded from this partial download.` }));
function jsonResult(owner, selected, unavailable = false) {
  const data = dataset(owner, selected, unavailable);
  const coverage = {
    scope: 'owned-local-structured-data', consistentSnapshot: true, selectedSections: selected,
    sections: Object.fromEntries(selected.map(section => [section, unavailable && section === 'sharing'
      ? { status: 'unavailable', reason: 'owned_relationship_unavailable', tables: {} }
      : { status: 'included', tables: Object.fromEntries(Object.entries(data[section]).map(([table, rows]) => [table, { rowCount: rows.length, columns: columns[table] || ['id'], jsonColumns: table === 'coach_grants' ? ['scopes'] : [] }])) } ])),
    excluded, notes: ['Invitation and consent history does not assert current access.'],
  };
  assert.ok(!selected.includes('recordings'), 'Small JSON scenarios intentionally use only the main store.');
  return { ok: true, export: { format: 'cupcake.account.local-export.v1', generatedAt: '2026-11-08T12:00:00Z', accountId: owner, completePrivacyExport: false, coverage, data }, filename: 'cupcake-local-data-20261108T120000Z.json', mimeType: 'application/json' };
}
const archiveCache = new Map();
function archive(owner, selected, originals = false, unavailable = false) {
  const key = JSON.stringify([owner, selected, originals, unavailable]);
  if (archiveCache.has(key)) return archiveCache.get(key);
  const python = `import base64,hashlib,io,json,sys,zipfile
p=json.loads(sys.argv[1]);raw=io.BytesIO();coverage={};record_bytes=0
with zipfile.ZipFile(raw,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for section in p['selected']:
  if section=='sharing' and p['unavailable']:
   coverage[section]={'status':'unavailable','reason':'owned_relationship_unavailable','tables':{}};continue
  coverage[section]={'status':'included','tables':{}}
  for table,rows in p['data'][section].items():
   chunks=[]
   if rows:
    data=''.join(json.dumps(row,separators=(',',':'))+'\\n' for row in rows).encode();member=f'data/{section}/{table}/000001.ndjson';z.writestr(member,data);record_bytes+=len(data);chunks=[{'member':member,'rowCount':len(rows),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}]
   coverage[section]['tables'][table]={'rowCount':len(rows),'columns':p['columns'].get(table,['id']),'jsonColumns':['scopes'] if table=='coach_grants' else [],'chunks':chunks}
 multi='recordings' in p['selected'];snapshots=[{'code':'library','source':'Saved account data','status':'included','consistentSnapshot':True,'readAt':'2026-11-08T12:00:00Z'}]
 if multi:snapshots.append({'code':'recordings','source':'Saved recording archive','status':'included','consistentSnapshot':True,'readAt':'2026-11-08T12:00:01Z'})
 manifest={'format':'cupcake.account.structured-bundle.v1','generatedAt':'2026-11-08T12:00:02Z','accountId':p['owner'],'completePrivacyExport':False,'recordBytes':record_bytes,'coverage':{'scope':'owned-local-structured-data-and-selected-originals' if p['originals'] else 'owned-local-structured-data','consistentSnapshot':not multi,'consistency':'per-database' if multi else 'single-database','sourceSnapshots':snapshots,'selectedSections':p['selected'],'sections':coverage,'excluded':[entry for entry in p['excluded'] if not(p['originals'] and entry['section']=='binary_originals')],'notes':['Historical permission metadata only.'],'noRowTruncation':True}}
 if p['originals']:manifest['originals']={'requested':True,'status':'included','files':[],'includedBytes':0,'unavailableCount':0,'sectionFailures':[]}
 z.writestr('manifest.json',json.dumps(manifest,separators=(',',':')))
data=raw.getvalue();print(json.dumps({'manifest':manifest,'base64':base64.b64encode(data).decode(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}))`;
  const value = JSON.parse(execFileSync('python3', ['-c', python, JSON.stringify({ owner, selected, originals, unavailable, data: dataset(owner, selected, unavailable), columns, excluded })], { maxBuffer: 1024 * 1024 }).toString());
  value.data = Buffer.from(value.base64, 'base64');
  archiveCache.set(key, value);
  return value;
}
let mode = 'json', release;
const calls = [], jobs = new Map();
async function jsonServer(owner, body) {
  calls.push({ owner, route: 'data', body });
  assert.deepEqual(Object.keys(body).sort(), ['action', 'sections']);
  assert.equal(body.action, 'account_self_export');
  if (mode === 'holdJson') await new Promise(resolve => { release = resolve; });
  if (mode.startsWith('zip')) return { status: 413, value: { ok: false, error: 'export_too_large' } };
  const value = jsonResult(owner, body.sections, mode === 'jsonUnavailable');
  if (mode === 'jsonUnknownSection') value.export.data.other_account_health = {};
  if (mode === 'jsonEmpty') {
    for (const table of tableNames.sharing) { value.export.data.sharing[table] = []; value.export.coverage.sections.sharing.tables[table].rowCount = 0; }
  }
  return { status: 200, value };
}
function status(owner, requestId) {
  const job = jobs.get(owner + ':' + requestId), value = archive(owner, job.sections, job.include_originals, job.unavailable);
  return { ok: true, id: requestId, requestId, state: 'ready', createdAt: '2026-11-08T12:00:00Z', expiresAt: new Date(Date.now() + 3600000).toISOString(), selectedSections: job.sections, ...(job.include_originals ? { includeOriginals: true } : {}), error: null, filename: `cupcake-structured-data-${requestId}.zip`, mimeType: 'application/zip', bytes: value.bytes, sha256: value.sha256, manifest: structuredClone(value.manifest) };
}
async function bundleServer(owner, route, body) {
  calls.push({ owner, route, body });
  const key = owner + ':' + body.request_id;
  if (route === 'exports/prepare') {
    assert.deepEqual(Object.keys(body).sort(), ['request_id', 'sections']);
    assert.deepEqual(body.sections, ['sharing']);
    assert.ok(!jobs.has(key), 'A saved request must not be rebuilt.');
    jobs.set(key, { sections: body.sections, unavailable: mode === 'zipUnavailable' });
    const pending = { ...status(owner, body.request_id), state: 'building', bytes: null, sha256: null, manifest: null };
    return { status: 202, value: pending, dropResponse: mode === 'zipLostPrepare' };
  }
  assert.deepEqual(Object.keys(body), ['request_id']);
  if (!jobs.has(key)) return { status: 404, value: { ok: false, error: 'export_not_found' } };
  if (route === 'exports/status') {
    const value = status(owner, body.request_id);
    if (mode === 'zipUnknownTable') value.manifest.coverage.sections.sharing.tables.accounts = { rowCount: 0, columns: ['id'], jsonColumns: [], chunks: [] };
    if (mode === 'zipMissingTable') delete value.manifest.coverage.sections.sharing.tables.coach_grants;
    if (mode === 'zipWrongOwner') value.manifest.accountId = B;
    if (mode === 'zipHoldStatus') await new Promise(resolve => { release = resolve; });
    return { status: 200, value };
  }
  assert.equal(route, 'exports/download');
  if (mode === 'zipDenied') return { status: 401, value: { ok: false, error: 'unauthenticated' } };
  const job = jobs.get(key), value = archive(owner, job.sections, job.include_originals, job.unavailable);
  return { status: 200, bytes: [...value.data], headers: { 'Content-Type': 'application/zip', 'Content-Length': String(value.bytes), 'X-Cupcake-Export-SHA256': value.sha256, 'X-Cupcake-Export-Request': body.request_id, 'X-Cupcake-Account-Context': owner } };
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.exposeFunction('syntheticExportServer', jsonServer);
  await context.exposeFunction('syntheticExportBundleServer', bundleServer);
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('dialog', dialog => dialog.accept());
  const downloads = [], errors = [];
  page.on('download', value => downloads.push(value)); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account');
  await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor();
  return { context, page, downloads, errors };
}
async function login(page, owner = 'a') {
  await page.getByLabel('Email', { exact: true }).fill(owner + '@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('MyCupcake — Synthetic ' + owner.toUpperCase(), { exact: true }).first().waitFor();
}
const ui = page => page.getByRole('region', { name: 'Download your data', exact: true });
async function settings(page) {
  await page.locator('summary[aria-label="Settings"]').click();
  await page.locator('.cc-settings-group > summary').filter({ hasText: 'Download my data' }).click();
  await ui(page).waitFor();
}
async function sharingOnly(page) {
  await ui(page).getByText('Choose sections · all selected', { exact: true }).click();
  assert.equal(await ui(page).getByRole('checkbox', { name: 'Invitations and sharing', exact: true }).isChecked(), true);
  assert.equal(await ui(page).getByRole('checkbox', { checked: true }).count(), 14);
  await ui(page).getByRole('button', { name: 'Clear selection', exact: true }).click();
  await ui(page).getByRole('checkbox', { name: 'Invitations and sharing', exact: true }).check();
}
const prepare = page => ui(page).getByRole('button', { name: 'Prepare my download', exact: true }).click();
const zipButton = page => ui(page).getByRole('button', { name: 'Download ZIP file', exact: true });
async function logout(page) {
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out of Cupcake', exact: true }).click();
  await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor();
}
async function safe(test) {
  const value = await test.page.evaluate(() => ({ requests: window.accountFixture.requests, blocked: window.accountFixture.blocked, legacyReads: window.accountFixture.legacyReads }));
  assert.deepEqual(value.blocked, []); assert.equal(value.legacyReads, 0); assert.deepEqual(test.errors, []);
  for (const request of value.requests.filter(request => request.route.startsWith('exports/') || request.body.action === 'account_self_export')) {
    assert.equal(request.credentials, 'include'); assert.equal(request.headers['x-cupcake-request'], 'account');
    assert.match(request.headers['x-cupcake-account-context'], /^acc_synthetic_[ab]$/); assert.equal(request.headers['x-cupcake-key'], undefined);
    assert.equal(request.body.owner_id, undefined); assert.equal(request.body.accountId, undefined);
  }
}
async function downloadedJSON(page) {
  const event = page.waitForEvent('download');
  await ui(page).getByRole('button', { name: 'Download JSON file', exact: true }).click();
  return JSON.parse(readFileSync(await (await event).path(), 'utf8'));
}
async function downloadedZIP(page, owner, selected, originals = false, unavailable = false) {
  const event = page.waitForEvent('download'); await zipButton(page).click();
  const file = await (await event).path(), expected = archive(owner, selected, originals, unavailable);
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected.sha256);
  return JSON.parse(execFileSync('python3', ['-c', "import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;m=json.loads(z.read('manifest.json'));print(json.dumps({'manifest':m,'sharing':{table:[json.loads(line) for chunk in info['chunks'] for line in z.read(chunk['member']).splitlines()] for table,info in m['coverage']['sections'].get('sharing',{}).get('tables',{}).items()}}))", file]).toString());
}
try {
  const json = await open(), p = json.page; await login(p); await settings(p);
  assert.equal(calls.length, 0); assert.equal(json.downloads.length, 0);
  await ui(p).getByText('Invitations and sharing includes your connection and permission history, including expired or revoked permissions.', { exact: false }).waitFor();
  await sharingOnly(p); await prepare(p); await ui(p).getByText('Invitations and sharing: 4 saved records', { exact: true }).waitFor();
  assert.equal(json.downloads.length, 0);
  const file = await downloadedJSON(p);
  assert.deepEqual(file.data, { sharing: sharingRows(A) });
  assert.deepEqual(file.coverage.selectedSections, ['sharing']); assert.equal(file.format, 'cupcake.account.local-export.v1');
  assert.equal(file.completePrivacyExport, false); assert.equal(file.data.sharing.coach_invitations[0].member_id, null);
  assert.equal(file.data.sharing.coach_grants[0].revoked, 1780500000); assert.deepEqual(JSON.parse(file.data.sharing.coach_grants[0].scopes), ['health_report']);
  for (const rows of Object.values(file.data.sharing)) for (const row of rows) assert.ok(!['email', 'token_hash', 'request_id', 'password', 'owner_id'].some(key => key in row));
  await safe(json); await json.context.close();
  console.log('PASS: sharing is the default fourteenth choice; explicit JSON keeps exact historical metadata, nulls and scopes, without credentials or report content.');

  for (const current of ['jsonUnavailable', 'jsonEmpty', 'jsonUnknownSection']) {
    mode = current; const test = await open(), q = test.page; await login(q); await settings(q); await sharingOnly(q); await prepare(q);
    if (current === 'jsonUnavailable') {
      await ui(q).getByText('Invitations and sharing: Unavailable for this account', { exact: true }).waitFor();
      const missing = await downloadedJSON(q); assert.deepEqual(missing.data, {}); assert.equal(missing.coverage.sections.sharing.reason, 'owned_relationship_unavailable');
    } else if (current === 'jsonEmpty') {
      await ui(q).getByText('Invitations and sharing: 0 saved records', { exact: true }).waitFor();
      const empty = await downloadedJSON(q); assert.equal(empty.coverage.sections.sharing.status, 'included');
      assert.deepEqual(empty.data.sharing, Object.fromEntries(tableNames.sharing.map(table => [table, []])));
    } else {
      await ui(q).getByRole('alert').waitFor(); assert.equal(await ui(q).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(test.downloads.length, 0);
    }
    await safe(test); await test.context.close();
  }
  console.log('PASS: empty sharing and unavailable sharing remain distinct; an unselected/unknown returned section cannot be downloaded.');

  mode = 'zip'; const zipped = await open(), z = zipped.page; await login(z); await settings(z); await sharingOnly(z); await prepare(z); await zipButton(z).waitFor();
  await ui(z).getByText('Invitations and sharing: 4 saved records', { exact: true }).waitFor(); assert.equal(zipped.downloads.length, 0);
  const zippedFile = await downloadedZIP(z, A, ['sharing']); assert.deepEqual(zippedFile.sharing, sharingRows(A));
  assert.equal(zippedFile.manifest.coverage.consistentSnapshot, true); assert.equal(zippedFile.manifest.completePrivacyExport, false);
  await safe(zipped); await zipped.context.close();
  for (const current of ['zipUnknownTable', 'zipMissingTable', 'zipWrongOwner']) {
    mode = current; const test = await open(), q = test.page; await login(q); await settings(q); await sharingOnly(q); await prepare(q);
    await ui(q).getByRole('alert').waitFor(); assert.equal(await zipButton(q).count(), 0); assert.equal(test.downloads.length, 0);
    await safe(test); await test.context.close();
  }
  mode = 'zipUnavailable'; const unavailable = await open(), u = unavailable.page; await login(u); await settings(u); await sharingOnly(u); await prepare(u); await zipButton(u).waitFor();
  await ui(u).getByText('Invitations and sharing: Unavailable for this account', { exact: true }).waitFor();
  const unavailableFile = await downloadedZIP(u, A, ['sharing'], false, true); assert.deepEqual(unavailableFile.sharing, {});
  await safe(unavailable); await unavailable.context.close();
  console.log('PASS: actual ZIP bytes include the four sharing tables and exact history; unexpected/missing tables and foreign owner fail closed; unavailable coverage remains explicit.');

  for (const originals of [false, true]) {
    mode = 'zip'; const old = await open(), q = old.page; await login(q);
    const requestId = originals ? '00000000-0000-4000-8000-000000000012' : '00000000-0000-4000-8000-000000000011';
    const intent = { request_id: requestId, sections: legacySections, ...(originals ? { include_originals: true } : {}) };
    jobs.set(A + ':' + requestId, { sections: legacySections, include_originals: originals });
    await q.evaluate(value => sessionStorage.setItem('cupcake-account-export-intent-v1:acc_synthetic_a', JSON.stringify(value)), intent);
    const before = calls.length; await q.reload(); await q.getByText('MyCupcake — Synthetic A', { exact: true }).first().waitFor(); await settings(q); await zipButton(q).waitFor();
    const recovered = calls.slice(before).filter(call => call.route.startsWith('exports/'));
    assert.ok(recovered.length > 0); assert.ok(recovered.every(call => call.route === 'exports/status' && call.body.request_id === requestId));
    assert.equal(old.downloads.length, 0);
    await ui(q).getByText('Choose sections · 13 selected', { exact: true }).click();
    assert.equal(await ui(q).getByRole('checkbox', { name: 'Invitations and sharing', exact: true }).isChecked(), false);
    assert.equal(await ui(q).getByRole('checkbox', { name: 'Include original photos and audio', exact: true }).isChecked(), originals);
    assert.equal(await ui(q).getByText('Invitations and sharing includes your connection and permission history, including expired or revoked permissions.', { exact: false }).count(), 0);
    const recoveredFile = await downloadedZIP(q, A, legacySections, originals); assert.deepEqual(recoveredFile.manifest.coverage.selectedSections, legacySections); assert.equal(recoveredFile.manifest.coverage.sections.sharing, undefined);
    await safe(old); await old.context.close();
  }
  console.log('PASS: existing 13-section intents, with and without originals, resume the same UUID through status only without silently adding sharing or automatically downloading.');

  mode = 'zip'; const badIntent = await open(), bi = badIntent.page; await login(bi);
  await bi.evaluate(() => sessionStorage.setItem('cupcake-account-export-intent-v1:acc_synthetic_a', JSON.stringify({ request_id: '00000000-0000-4000-8000-000000000013', sections: ['sharing', 'unknown_section'] })));
  const beforeInvalid = calls.length; await bi.reload(); await bi.getByText('MyCupcake — Synthetic A', { exact: true }).first().waitFor(); await settings(bi);
  await ui(bi).getByRole('alert').waitFor(); assert.equal(calls.slice(beforeInvalid).filter(call => call.route.startsWith('exports/')).length, 0);
  assert.equal(await zipButton(bi).count(), 0); assert.equal(badIntent.downloads.length, 0); await safe(badIntent); await badIntent.context.close();
  console.log('PASS: an unknown saved section never sends a recovery request or silently becomes a different selection.');


  mode = 'zipLostPrepare'; const lost = await open(), l = lost.page; await login(l); await settings(l); await sharingOnly(l); await prepare(l); await ui(l).getByRole('alert').waitFor();
  const previous = calls.filter(call => call.route === 'exports/prepare').length;
  const saved = await l.evaluate(() => JSON.parse(sessionStorage.getItem('cupcake-account-export-intent-v1:acc_synthetic_a')));
  mode = 'zip'; await l.reload(); await l.getByText('MyCupcake — Synthetic A', { exact: true }).first().waitFor(); await settings(l); await zipButton(l).waitFor();
  assert.equal(calls.filter(call => call.route === 'exports/prepare').length, previous); assert.equal(calls.at(-1).body.request_id, saved.request_id); assert.equal(lost.downloads.length, 0);
  await safe(lost); await lost.context.close();
  console.log('PASS: new sharing requests also recover a lost preparation response without a duplicate build.');

  mode = 'zip'; const denied = await open(), d = denied.page; await login(d); await settings(d); await sharingOnly(d); await prepare(d); await zipButton(d).waitFor();
  mode = 'zipDenied'; await zipButton(d).click(); await d.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); assert.equal(denied.downloads.length, 0);
  await safe(denied); await denied.context.close();
  mode = 'holdJson'; const switched = await open(), s = switched.page; await login(s); await settings(s); await sharingOnly(s); await prepare(s);
  await ui(s).getByRole('button', { name: 'Preparing your download…', exact: true }).waitFor(); await logout(s); await login(s, 'b'); release(); release = undefined;
  await settings(s); assert.equal(await ui(s).getByRole('button', { name: 'Download JSON file', exact: true }).count(), 0); assert.equal(switched.downloads.length, 0);
  await safe(switched); await switched.context.close();
  console.log('PASS: revoked session and late sharing response after an account switch never create a stale download.');
} finally {
  release?.(); await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true });
}
