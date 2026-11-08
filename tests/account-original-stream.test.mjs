import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-original-stream-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-original-stream-root', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const A = 'acc_synthetic_a', B = 'acc_synthetic_b';
const requests = [], native = []; let mode = 'normal', pendingRelease, tokenSequence = 0;
const sha = value => createHash('sha256').update(value).digest('hex');
function file(kind, id, bytes, available = true) { return { kind, sourceId: id, filename: kind + '-' + sha(kind + '\0' + id) + (kind === 'recording_audio' ? '.audio' : '.jpg'), title: kind === 'recording_audio' ? 'Synthetic saved recording ' + id : null, mimeType: kind === 'recording_audio' ? null : 'image/jpeg', bytes: available ? bytes : null, sha256: available ? sha(id) : null, status: available ? 'available' : 'unavailable', ...(available ? {} : { reason: 'saved_original_missing' }), verification: 'saved_metadata_and_file_stat' }; }
function inventory(owner) {
  const files = owner === B ? [] : [file('meal_photo', 'synthetic_meal_1', 4000), file('receipt_photo', 'synthetic_receipt_missing', 0, false), ...Array.from({ length: 41 }, (_, i) => file('recording_audio', 'synthetic_audio_' + i, i === 0 ? 140 * 1024 ** 2 : i === 1 ? 1.25 * 1024 ** 3 : 1024))];
  return { ok: true, format: 'cupcake.account.original-inventory.v1', accountId: owner, generatedAt: new Date().toISOString(), completePrivacyExport: false, sections: ['food', 'finance', 'recordings'], files, sectionFailures: [], totalBytes: files.reduce((sum, file) => sum + (file.bytes || 0), 0), notes: ['Saved metadata and file status only. This is not a complete privacy export.'] };
}
async function remote(owner, route, body) {
  requests.push({ owner, route, body });
  if (mode === 'hold' || mode === 'holdInventory') await new Promise(resolve => { pendingRelease = resolve; });
  if (mode === 'revoked') return { status: 401, value: { ok: false, error: 'unauthenticated' } };
  if (mode === 'changedContext') return { status: 409, value: { ok: false, error: 'account_context_changed' } };
  if (mode === 'changedOriginal') return { status: 409, value: { ok: false, error: 'original_changed' } };
  if (route === 'exports/originals') {
    assert.deepEqual(body, { sections: ['food', 'finance', 'recordings'] });
    const value = inventory(owner);
    if (mode === 'wrongOwner') value.accountId = owner === A ? B : A;
    if (mode === 'wrongFormat') value.format = 'unknown';
    if (mode === 'completePrivacy') value.completePrivacyExport = true;
    if (mode === 'duplicateSections') value.sections[2] = 'food';
    if (mode === 'missingSections') value.sections.pop();
    if (mode === 'unknownKind') value.files[0].kind = 'other';
    if (mode === 'badDigest') value.files[0].sha256 = 'invalid';
    if (mode === 'zeroBytes') value.files[0].bytes = 0;
    if (mode === 'unsafeFilename') value.files[0].filename = '../private.jpg';
    if (mode === 'wrongUnavailable') value.files[1].sha256 = sha('unexpected');
    if (mode === 'wrongTotal') value.totalBytes++;
    if (mode === 'duplicateFile') value.files.push(structuredClone(value.files[0]));
    if (mode === 'falseVerification') value.files[0].verification = 'full_file_sha256';
    if (mode === 'empty') { value.files = []; value.totalBytes = 0; }
    if (mode === 'missingSection') { value.files = value.files.filter(file => file.kind !== 'recording_audio'); value.totalBytes = value.files.reduce((sum, file) => sum + (file.bytes || 0), 0); value.sectionFailures = [{ section: 'recordings', reason: 'owned_archive_unavailable' }]; }
    return { status: 200, value };
  }
  assert.equal(route, 'exports/original-link');
  assert.deepEqual(Object.keys(body).sort(), ['kind', 'sha256', 'source_id']);
  const original = inventory(owner).files.find(file => file.kind === body.kind && file.sourceId === body.source_id);
  assert.ok(original); assert.equal(original.sha256, body.sha256); assert.equal(original.status, 'available');
  const token = (++tokenSequence).toString().padStart(43, 'a');
  const value = { ok: true, url: 'https://automate.hales.ai/api/account/exports/original?token=' + token, expiresAt: Math.floor(Date.now() / 1000) + 300, original: Object.fromEntries(['kind', 'sourceId', 'filename', 'mimeType', 'bytes', 'sha256'].map(key => [key, original[key]])) };
  if (mode === 'urlHttp') value.url = value.url.replace('https:', 'http:');
  if (mode === 'urlHost') value.url = value.url.replace('automate.hales.ai', 'evil.example.invalid');
  if (mode === 'urlPath') value.url = value.url.replace('/exports/original?', '/exports/download?');
  if (mode === 'urlQuery') value.url += '&extra=1';
  if (mode === 'urlFragment') value.url += '#anything';
  if (mode === 'urlShortToken') value.url = value.url.slice(0, -1);
  if (mode === 'urlCredentials') value.url = value.url.replace('https://', 'https://anything@');
  if (mode === 'expired') value.expiresAt = Math.floor(Date.now() / 1000) - 1;
  if (mode === 'longExpiry') value.expiresAt += 60;
  if (mode === 'wrongBytes') value.original.bytes++;
  if (mode === 'wrongSHA') value.original.sha256 = sha('different');
  if (mode === 'wrongSource') value.original.sourceId = 'another';
  if (mode === 'wrongKind') value.original.kind = 'meal_photo';
  if (mode === 'wrongName') value.original.filename = 'another.audio';
  if (mode === 'wrongMime') value.original.mimeType = 'audio/wav';
  return { status: 200, value };
}
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.exposeFunction('syntheticExportBundleServer', remote);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base) return route.continue();
    if (url.origin === 'https://automate.hales.ai' && url.pathname === '/api/account/exports/original') {
      native.push({ url: request.url(), method: request.method(), navigation: request.isNavigationRequest(), headers: request.headers() });
      // A tiny response proves native navigation/download. The >1GiB descriptors are not allocated or claimed as real file-byte acceptance.
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'Content-Disposition': 'attachment; filename="synthetic-original.audio"' }, body: 'small synthetic native-download response' });
    }
    return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('dialog', dialog => dialog.accept());
  const downloads = [], errors = []; page.on('download', download => downloads.push(download)); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/cupcake/account'); await page.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor();
  return { page, context, downloads, errors };
}
async function login(page, owner = 'a') { await page.getByLabel('Email', { exact: true }).fill(owner + '@example.invalid'); await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByText('MyCupcake — Synthetic ' + owner.toUpperCase(), { exact: true }).first().waitFor(); }
async function settings(page) { await page.locator('summary[aria-label="Settings"]').click(); await page.locator('.cc-settings-group > summary').filter({ hasText: 'Download my data' }).click(); await page.getByText('Download originals individually', { exact: true }).click(); }
const ui = page => page.getByRole('region', { name: 'Individual original downloads', exact: true });
const list = page => ui(page).getByRole('button', { name: /^(List my originals|Refresh original list)$/ }).click();
const audio = (page, i = 0) => ui(page).getByRole('button', { name: `Download ${inventory(A).files[i + 2].filename} (synthetic_audio_${i})`, exact: true });
async function loaded(page) { await ui(page).getByText('Recording audio · 41', { exact: true }).waitFor(); }
async function audioGroup(page) { await ui(page).getByText('Recording audio · 41', { exact: true }).click(); }
async function safe(test) {
  const value = await test.page.evaluate(() => ({ requests: window.accountFixture.requests, blocked: window.accountFixture.blocked, legacy: window.accountFixture.legacyReads, storage: [...Object.entries(localStorage), ...Object.entries(sessionStorage)] }));
  assert.deepEqual(value.blocked, []); assert.equal(value.legacy, 0); assert.deepEqual(test.errors, []);
  for (const request of value.requests.filter(request => request.route.startsWith('exports/'))) { assert.equal(request.credentials, 'include'); assert.equal(request.headers['x-cupcake-request'], 'account'); assert.match(request.headers['x-cupcake-account-context'], /^acc_synthetic_[ab]$/); assert.equal(request.headers['x-cupcake-key'], undefined); assert.ok(['exports/originals', 'exports/original-link'].includes(request.route)); }
  assert.equal(JSON.stringify(value.storage).includes('/exports/original?token='), false);
}
try {
  const main = await open(), p = main.page; await login(p); await settings(p); assert.equal(requests.length, 0); assert.equal(native.length, 0);
  await list(p); await loaded(p); assert.equal(requests.length, 1); assert.equal(native.length, 0); assert.equal(main.downloads.length, 0); assert.equal(await audio(p).isVisible(), false);
  await ui(p).getByText('Receipt photos · 1', { exact: true }).click(); await ui(p).getByText('Original unavailable.', { exact: false }).waitFor(); assert.equal(await ui(p).getByRole('button', { name: /synthetic_receipt_missing/ }).count(), 0);
  await audioGroup(p);
  await p.evaluate(() => { window.originalBufferChecks = { blobs: 0, binaryReads: 0 }; const NativeBlob = window.Blob; window.Blob = class extends NativeBlob { constructor(...args) { window.originalBufferChecks.blobs++; super(...args); } }; for (const method of ['blob', 'arrayBuffer']) { const original = Response.prototype[method]; Response.prototype[method] = function(...args) { window.originalBufferChecks.binaryReads++; return original.apply(this, args); }; } });
  for (const i of [0, 1]) { const event = p.waitForEvent('download'); await audio(p, i).evaluate(button => { button.click(); button.click(); }); const download = await event; assert.equal(download.suggestedFilename(), 'synthetic-original.audio'); await ui(p).getByText('Download requested. Check your browser’s downloads for completion.', { exact: true }).waitFor(); }
  assert.equal(native.length, 2); assert.ok(native.every(request => request.method === 'GET' && request.navigation && request.headers.referer === undefined));
  const links = requests.filter(request => request.route === 'exports/original-link'); assert.equal(links.length, 2); assert.equal(links[0].body.sha256, sha('synthetic_audio_0')); assert.equal(links[1].body.sha256, sha('synthetic_audio_1'));
  assert.deepEqual(await p.evaluate(() => window.originalBufferChecks), { blobs: 0, binaryReads: 0 });
  for (const width of [320, 1280]) { await p.setViewportSize({ width, height: 900 }); const dimensions = await ui(p).evaluate(el => ({ scroll: el.scrollWidth, width: el.clientWidth, page: document.documentElement.scrollWidth, viewport: innerWidth })); assert.ok(dimensions.scroll <= dimensions.width); assert.ok(dimensions.page <= dimensions.viewport); }
  await safe(main); await main.context.close(); console.log('PASS: explicit metadata-only all-three inventory, 41 grouped audios/unavailable photo, >128MiB and >1GiB descriptors use native downloads with zero JS Blob/binary reads; responsive320/1280 and no token persistence');

  const malformed = await open(), m = malformed.page; await login(m); await settings(m); const nativeBefore = native.length;
  for (const failure of ['wrongOwner', 'wrongFormat', 'completePrivacy', 'duplicateSections', 'missingSections', 'unknownKind', 'badDigest', 'zeroBytes', 'unsafeFilename', 'wrongUnavailable', 'wrongTotal', 'duplicateFile', 'falseVerification']) { mode = failure; await list(m); await ui(m).getByRole('alert').waitFor(); assert.equal(await ui(m).getByText('Recording audio · 41', { exact: true }).count(), 0); }
  assert.equal(native.length, nativeBefore); await safe(malformed); await malformed.context.close(); console.log('PASS: wrong owner/coverage/schema, duplicate references, invalid metadata/verification and unsafe filenames never expose download controls');

  mode = 'normal'; const invalid = await open(), q = invalid.page; await login(q); await settings(q); await list(q); await loaded(q); await audioGroup(q); const invalidNative = native.length;
  for (const failure of ['urlHttp', 'urlHost', 'urlPath', 'urlQuery', 'urlFragment', 'urlShortToken', 'urlCredentials', 'expired', 'longExpiry', 'wrongBytes', 'wrongSHA', 'wrongSource', 'wrongKind', 'wrongName', 'wrongMime']) { mode = failure; await audio(q).click(); await ui(q).getByRole('alert').waitFor(); assert.equal(native.length, invalidNative); }
  mode = 'changedOriginal'; await audio(q).click(); await ui(q).getByText('This original changed since the list was loaded. Refresh the list before downloading it.', { exact: true }).waitFor(); assert.equal(native.length, invalidNative);
  await safe(invalid); await invalid.context.close(); console.log('PASS: malformed URLs, expired/overlong links and any changed expected original metadata never invoke browser navigation');

  for (const missing of ['empty', 'missingSection']) { mode = missing; const test = await open(), e = test.page; await login(e); await settings(e); await list(e); await ui(e).getByText(missing === 'empty' ? 'No saved meal photos, receipt photos or recording audio were found for this account.' : 'Some originals could not be listed. This is not a complete list.', { exact: true }).waitFor(); assert.equal(await ui(e).getByRole('button', { name: /Download .*synthetic_audio/ }).count(), 0); await safe(test); await test.context.close(); }
  console.log('PASS: empty account and unavailable recording section stay explicit without invented originals');

  mode = 'normal'; const switched = await open(), s = switched.page; await login(s); await settings(s); await list(s); await loaded(s); await audioGroup(s); const switchNative = native.length;
  mode = 'hold'; await audio(s).click(); while (!pendingRelease) await new Promise(resolve => setTimeout(resolve, 5));
  await s.getByRole('button', { name: 'Close settings', exact: true }).click(); await s.getByRole('button', { name: /^Sign out of / }).click(); await s.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); await login(s, 'b'); pendingRelease(); pendingRelease = undefined; mode = 'normal'; await settings(s); await list(s); await ui(s).getByText('No saved meal photos, receipt photos or recording audio were found for this account.', { exact: true }).waitFor(); assert.equal(native.length, switchNative); assert.equal(await ui(s).getByText('Recording audio · 41', { exact: true }).count(), 0); await safe(switched); await switched.context.close();
  console.log('PASS: late link after account switch/unmount cannot download; second owner receives only its own empty inventory');

  for (const denied of ['revoked', 'changedContext']) { mode = 'normal'; const test = await open(), r = test.page; await login(r); await settings(r); await list(r); await loaded(r); await audioGroup(r); const before = native.length; mode = denied; await audio(r).click(); await r.getByRole('heading', { name: 'Sign in to Cupcake', exact: true }).waitFor(); assert.equal(native.length, before); await safe(test); await test.context.close(); }
  console.log('PASS: server revocation and context mismatch return to sign-in with no original navigation');
} finally { pendingRelease?.(); await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
