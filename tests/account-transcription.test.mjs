import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-transcription-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-transcription', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-recording-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`, browser = await chromium.launch({ headless: true });
const ids = { A: '1'.repeat(32), B: '2'.repeat(32) }, sha = { A: 'a'.repeat(64), B: 'b'.repeat(64) };
let mode, calls, saved, release;
function reset(next = 'normal') { mode = next; calls = []; saved = new Map(); release = () => {}; }
function audio(owner) { return { id: ids[owner], title: `Synthetic ${owner} original`, createdAt: '2026-11-07T12:00:00Z', mimeType: 'audio/webm', status: 'stored', receivedParts: [{ index: 0, size: 5 }], receivedBytes: 5, totalBytes: 5, partBytes: 1048576, originalStored: true, originalBytes: 5, originalSha256: sha[owner] }; }
function result(row, status = row.status) {
  return { ok: true, request: { request_id: row.body.request_id, attempt: '00000000-0000-4000-8000-000000000001', recording_id: row.body.recording_id, status, error: status === 'failed' ? row.error || 'account_budget_unavailable' : null, dispatched: !['queued', 'failed'].includes(status), can_retry_unsent: status === 'failed', can_publish_saved_result: status === 'publication_pending' && mode !== 'pendingNoResult' }, originalStored: true,
    ...(status === 'completed' ? { transcript: { text: mode === 'empty' ? '  ' : 'Synthetic saved speech-to-text only.', source: 'speech-to-text', requestedModel: 'openai/whisper-1', actualModel: null, modelVerification: 'unreported', mayContainErrors: true, durationSeconds: 14.5, originalSha256: mode === 'badHash' ? 'f'.repeat(64) : row.body.original_sha256, createdAt: '2026-11-07T12:01:00Z', emptyTranscript: mode === 'empty' } } : {}) };
}
async function remote(owner, route, body) {
  calls.push({ owner, route, body });
  const error = (status, code) => ({ status, value: { ok: false, error: code } });
  if (route === 'recordings/list') return { status: 200, value: { ok: true, recordings: [audio(owner)] } };
  if (route === 'recordings/get') return { status: 200, value: { ok: true, recording: audio(owner) } };
  assert.ok(['recordings/transcribe', 'recordings/transcription-status', 'recordings/transcription-retry', 'recordings/transcription-publish'].includes(route), route);
  assert.match(body.request_id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/); assert.equal(body.owner_id, undefined);
  if (mode === 'unavailable') return error(503, 'account_transcription_not_ready');
  let row = saved.get(owner + ':' + body.request_id);
  if (route === 'recordings/transcribe') {
    assert.deepEqual(Object.keys(body).sort(), ['language', 'original_sha256', 'recording_id', 'request_id']); assert.equal(body.recording_id, ids[owner]); assert.equal(body.original_sha256, sha[owner]);
    if (mode === 'lostBeforeCreate') { mode = 'normal'; throw Error('Synthetic request lost before commit'); }
    if (row) assert.deepEqual(row.body, body);
    row ||= { owner, body: structuredClone(body), status: ['pending', 'pendingNoResult'].includes(mode) ? 'publication_pending' : mode === 'failed' ? 'failed' : mode === 'uncertain' ? 'uncertain' : 'queued', reads: 0 };
    saved.set(owner + ':' + body.request_id, row);
    if (mode === 'lostCreate') { mode = 'normal'; throw Error('Synthetic response lost after commit'); }
    return { status: 200, value: result(row) };
  }
  assert.deepEqual(Object.keys(body), ['request_id']);
  if (!row) return error(404, 'transcription_request_not_found');
  if (mode === 'hold') { mode = 'normal'; await new Promise(resolve => { release = resolve; }); }
  if (route === 'recordings/transcription-retry') { assert.equal(row.status, 'failed'); row.status = 'queued'; row.reads = 0; }
  if (route === 'recordings/transcription-publish') { assert.equal(row.status, 'publication_pending'); row.status = 'completed'; }
  if (route === 'recordings/transcription-status' && ['queued', 'running'].includes(row.status)) {
    row.reads++; row.status = mode === 'tooLong' ? 'failed' : row.reads === 1 ? 'running' : 'completed'; if (mode === 'tooLong') row.error = 'transcription_too_long';
  }
  return { status: 200, value: result(row) };
}
async function open(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 900 } }); await context.exposeFunction('syntheticAudioServer', remote);
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account'); await ui(page).waitFor(); return { context, page, errors };
}
const ui = page => page.getByRole('region', { name: 'Audio transcription', exact: true });
const start = page => ui(page).getByRole('button', { name: 'Transcribe full clip', exact: true }).click();
const check = page => ui(page).getByRole('button', { name: 'Check transcription status', exact: true }).click();
async function safe(test) {
  const fixture = await test.page.evaluate(() => ({ requests: window.audioFixture.requests, blocked: window.audioFixture.blocked, digestReads: window.audioFixture.digestReads }));
  assert.deepEqual(fixture.blocked, []); assert.equal(fixture.digestReads, 0); assert.deepEqual(test.errors, []);
  assert.equal(calls.some(call => /recordings\/(start|part|finish)$/.test(call.route)), false);
  for (const request of fixture.requests) { assert.equal(request.headers['x-cupcake-key'], undefined); assert.equal(request.headers['x-cupcake-request'], 'account'); assert.equal(request.headers['x-cupcake-account-context'], request.owner === 'A' ? 'acc_audio_a' : 'acc_audio_b'); }
  assert.equal(await test.page.getByRole('button', { name: 'Listen to saved audio', exact: true }).isEnabled(), true); assert.equal(await test.page.getByRole('button', { name: 'Download saved original', exact: true }).isEnabled(), true);
}
try {
  reset(); const complete = await open(), p = complete.page; assert.deepEqual(calls.map(call => call.route), ['recordings/list']);
  await ui(p).getByLabel('Spoken language', { exact: true }).selectOption('fr'); await start(p); await ui(p).getByText('Transcript saved', { exact: true }).waitFor();
  const intent = calls.find(call => call.route === 'recordings/transcribe').body; assert.equal(intent.language, 'fr'); assert.equal(calls.filter(call => call.route === 'recordings/transcribe').length, 1);
  assert.equal(calls.filter(call => call.route === 'recordings/transcription-status').length, 2); await ui(p).getByText('Synthetic saved speech-to-text only.', { exact: true }).waitFor();
  await ui(p).getByText('Transcript details', { exact: true }).click(); await ui(p).getByText('The provider did not report the model used.', { exact: false }).waitFor();
  const out = path.join(process.cwd(), 'output/account-transcription-synthetic'); mkdirSync(out, { recursive: true });
  for (const width of [320, 1280]) { await p.setViewportSize({ width, height: 900 }); const metrics = await ui(p).evaluate(el => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, client: el.clientWidth, scroll: el.scrollWidth })); assert.ok(metrics.page <= metrics.viewport); assert.ok(metrics.scroll <= metrics.client); await ui(p).getByRole('button', { name: 'Check transcription status', exact: true }).focus(); assert.equal(await ui(p).getByRole('button', { name: 'Check transcription status', exact: true }).evaluate(el => el === document.activeElement), true); await p.screenshot({ path: path.join(out, `transcription-${width}.png`), fullPage: true }); console.log('PASS: transcription layout/focus', JSON.stringify(metrics)); }
  await safe(complete); await complete.context.close(); console.log('PASS: explicit full-clip request saved before POST, language/original binding, bounded read-only polling, completed uncertain-model transcript, original controls preserved');

  reset('lostCreate'); const lost = await open(), l = lost.page; await start(l); await ui(l).getByRole('alert').waitFor(); const first = calls.find(call => call.route === 'recordings/transcribe').body;
  const beforeReload = calls.length; await l.reload(); await ui(l).getByRole('button', { name: 'Check transcription status', exact: true }).waitFor(); assert.equal(calls.length, beforeReload + 1); assert.equal(calls.at(-1).route, 'recordings/list');
  await check(l); await ui(l).getByText('Transcript saved', { exact: true }).waitFor(); assert.equal(calls.filter(call => call.route === 'recordings/transcribe').length, 1); assert.ok(calls.filter(call => call.route === 'recordings/transcription-status').every(call => call.body.request_id === first.request_id)); await safe(lost); await lost.context.close(); console.log('PASS: ambiguous create + reload checks exact saved request first, no paid replay');

  reset('lostBeforeCreate'); const missing = await open(), m = missing.page; await start(m); await ui(m).getByRole('alert').waitFor(); const sent = calls.find(call => call.route === 'recordings/transcribe').body;
  await check(m); await ui(m).getByRole('button', { name: 'Send saved transcription request', exact: true }).waitFor(); assert.equal(calls.filter(call => call.route === 'recordings/transcribe').length, 1);
  await ui(m).getByRole('button', { name: 'Send saved transcription request', exact: true }).click(); await ui(m).getByText('Transcript saved', { exact: true }).waitFor(); assert.deepEqual(calls.filter(call => call.route === 'recordings/transcribe').map(call => call.body), [sent, sent]); await safe(missing); await missing.context.close(); console.log('PASS: status404 allows only explicit send of identical persisted intent');

  reset('pending'); const pending = await open(), q = pending.page; await start(q); await ui(q).getByRole('button', { name: 'Save completed transcript', exact: true }).click(); await ui(q).getByText('Transcript saved', { exact: true }).waitFor(); assert.equal(calls.filter(call => call.route === 'recordings/transcription-publish').length, 1); assert.equal(calls.filter(call => call.route === 'recordings/transcribe').length, 1); assert.equal(calls.filter(call => call.route === 'recordings/transcription-retry').length, 0); await safe(pending); await pending.context.close(); console.log('PASS: saved-result publication is a separate explicit action with no repeated transcription');

  reset('failed'); const retry = await open(), r = retry.page; await start(r); await ui(r).getByRole('button', { name: 'Retry unsent transcription', exact: true }).click(); await ui(r).getByText('Transcript saved', { exact: true }).waitFor(); assert.equal(calls.filter(call => call.route === 'recordings/transcription-retry').length, 1); assert.equal(calls.filter(call => call.route === 'recordings/transcribe').length, 1); await safe(retry); await retry.context.close(); console.log('PASS: explicit unsent retry requires server authorization and preserves original intent');

  for (const state of ['uncertain', 'tooLong', 'unavailable', 'badHash', 'empty', 'pendingNoResult']) {
    reset(state); const test = await open(), s = test.page; await start(s);
    if (state === 'unavailable') await ui(s).getByText('Transcription is not available for this account yet.', { exact: false }).waitFor();
    else if (state === 'uncertain') await ui(s).getByText('The audio may have been sent', { exact: false }).waitFor();
    else if (state === 'tooLong') await ui(s).getByText('This complete clip is longer than three minutes', { exact: false }).waitFor();
    else if (state === 'badHash') { await ui(s).getByRole('alert').waitFor(); assert.equal(await ui(s).getByText('Synthetic saved speech-to-text only.', { exact: true }).count(), 0); }
    else if (state === 'pendingNoResult') { await ui(s).getByText('No transcript is available to save.', { exact: false }).waitFor(); assert.equal(await ui(s).getByRole('button', { name: 'Save completed transcript', exact: true }).count(), 0); }
    else await ui(s).getByText('No speech text was returned for this clip.', { exact: true }).waitFor();
    assert.equal(await ui(s).getByRole('button', { name: 'Retry unsent transcription', exact: true }).count(), 0); assert.equal(calls.filter(call => call.route === 'recordings/transcribe').length, 1); await safe(test); await test.context.close();
  }
  console.log('PASS: uncertain/overlong/unavailable/mismatched-original/empty transcript states are honest; no unsafe retry or trimming');

  reset('lostCreate'); const late = await open(), a = late.page; await start(a); await ui(a).getByRole('alert').waitFor(); mode = 'hold'; await check(a); await a.waitForTimeout(50); await a.evaluate(() => window.audioFixture.switchOwner('B')); release(); await a.getByText('Synthetic B original', { exact: true }).waitFor();
  assert.equal(await ui(a).getByRole('button', { name: 'Transcribe full clip', exact: true }).count(), 1); assert.equal(await ui(a).getByText('Synthetic saved speech-to-text only.', { exact: true }).count(), 0); assert.equal(calls.some(call => call.owner === 'B' && call.route !== 'recordings/list'), false); await safe(late); await late.context.close(); console.log('PASS: late A response cannot display A transcript/request or dispatch for B');

  reset(); const blocked = await open(), b = blocked.page; await b.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.includes('audio-transcription-v1:')) throw Error('Synthetic storage denied'); return set.call(this, key, value); }; }); await start(b); await ui(b).getByRole('alert').waitFor(); assert.equal(calls.some(call => call.route === 'recordings/transcribe'), false); await safe(blocked); await blocked.context.close(); console.log('PASS: browser recovery storage failure blocks new transcription before POST');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
