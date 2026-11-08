import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-summary-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-summary', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-recording-summary-preview.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''); next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`, browser = await chromium.launch({ headless: true });
const ids = { A: '1'.repeat(32), B: '2'.repeat(32) }, hashes = { A: 'a'.repeat(64), B: 'b'.repeat(64) }, transcriptHash = 'c'.repeat(64);
const threadId = '11111111-1111-4111-8111-111111111111', turnId = '22222222-2222-4222-8222-222222222222';
let mode, calls, saved, release, held;
function reset(next = 'normal') { mode = next; calls = []; saved = new Map(); release = () => {}; held = false; }
function audio(owner) { return { id: ids[owner], title: `Synthetic ${owner} original`, createdAt: '2026-11-07T12:00:00Z', mimeType: 'audio/webm', status: 'stored', receivedParts: [{ index: 0, size: 5 }], receivedBytes: 5, totalBytes: 5, partBytes: 1048576, originalStored: true, originalBytes: 5, originalSha256: hashes[owner] }; }
function value(owner, row) {
  const status = row?.status || 'not_started', sourceUrl = `https://hales.ai/cupcake/account?document=rec_${ids[owner]}`;
  return { ok: true, source: { recordingId: ids[owner], originalSha256: hashes[owner], transcriptSha256: mode === 'wrongSource' ? 'd'.repeat(64) : transcriptHash, transcriptBytes: 200, complete: true, documentId: 'rec_' + ids[owner], sourceUrl }, summary: { recordingId: ids[owner], originalSha256: hashes[owner], transcriptSha256: transcriptHash, documentId: 'summary_' + ids[owner], threadId, turnId, status, sourceUrl }, thread: row ? { id: threadId, title: 'Recording summary', turns: [{ id: turnId, status, error: status === 'failed' ? 'account_budget_exceeded' : null, ...(status === 'completed' ? { response: { ok: true, reply: `Synthetic ${owner} saved summary.\nCheck the original audio for exact wording.`, model: 'synthetic-fixed-model' } } : {}) }] } : null };
}
async function remote(owner, route, body) {
  calls.push({ owner, route, body });
  const error = (status, code) => ({ status, value: { ok: false, error: code } });
  if (route === 'recordings/list') return { status: 200, value: { ok: true, recordings: [audio(owner)] } };
  if (route === 'recordings/get') return { status: 200, value: { ok: true, recording: audio(owner) } };
  assert.equal(route, 'data');
  if (body.action === 'list') return { status: 200, value: { documents: [], projects: [], browseTotal: 0, libraryTotal: 0, hasMore: false } };
  if (body.action === 'analysis_list') return { status: 200, value: { analyses: [] } };
  if (body.action === 'projects') return { status: 200, value: { projects: [] } };
  if (body.action === 'decision_list') return { status: 200, value: { decisions: [] } };
  if (body.action === 'fetch') { assert.equal(body.id, 'rec_' + ids[owner]); return { status: 200, value: { document: { id: body.id, title: 'Synthetic source transcript', status: 'transcribed', kind: 'recording', text: 'Complete synthetic source transcript.', transcript: 'Complete synthetic source transcript.', createdAt: '2026-11-07T12:00:00Z', tags: [], analyses: [] } } }; }
  assert.ok(['recording_summary_get', 'recording_summary_begin'].includes(body.action));
  assert.equal(body.recordingId, ids[owner]); assert.equal(body.originalSha256, hashes[owner]);
  assert.equal(body.owner_id, undefined); assert.equal(body.text, undefined); assert.equal(body.transcript, undefined);
  if (mode === 'missing') return error(404, 'recording_summary_transcript_unavailable');
  if (mode === 'oversized') return error(413, 'recording_summary_transcript_too_large');
  if (mode === 'staged') return error(503, 'account_recording_summary_not_ready');
  let row = saved.get(owner);
  if (body.action === 'recording_summary_begin') {
    assert.deepEqual(Object.keys(body).sort(), ['action', 'originalSha256', 'recordingId', 'requestId', 'transcriptSha256']);
    assert.equal(body.transcriptSha256, transcriptHash); assert.match(body.requestId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
    if (row) assert.equal(body.requestId, row.requestId);
    if (mode === 'lostBefore') { mode = 'normal'; throw Error('Synthetic request lost before commit'); }
    row ||= { requestId: body.requestId, status: ['uncertain', 'failed', 'cancelled'].includes(mode) ? mode : 'queued', reads: 0 };
    saved.set(owner, row);
    if (mode === 'lostAfter') { mode = 'normal'; row.status = 'completed'; throw Error('Synthetic response lost after commit'); }
  } else {
    assert.equal(body.requestId, undefined);
    if (mode === 'hold') { held = true; await new Promise(resolve => { release = resolve; }); }
    if (body.transcriptSha256) assert.equal(body.transcriptSha256, transcriptHash);
    if (row && ['queued', 'running'].includes(row.status)) { row.reads++; row.status = row.reads === 1 ? 'running' : 'completed'; }
  }
  return { status: 200, value: value(owner, row) };
}
async function open(width = 390, suffix = '') {
  const context = await browser.newContext({ viewport: { width, height: 960 } }); await context.exposeFunction('syntheticSummaryServer', remote);
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base + '/cupcake/account' + suffix); if (!suffix) await ui(page).waitFor(); return { context, page, errors };
}
const ui = page => page.getByRole('region', { name: 'Saved transcript summary', exact: true });
const check = page => ui(page).getByRole('button', { name: /Check saved transcript|Check summary status/ }).click();
const begin = page => ui(page).getByRole('button', { name: 'Summarize saved transcript', exact: true }).click();
async function safe(test, archive = true) {
  const fixture = await test.page.evaluate(() => ({ requests: window.summaryFixture.requests, blocked: window.summaryFixture.blocked }));
  assert.deepEqual(fixture.blocked, []); assert.deepEqual(test.errors, []);
  for (const request of fixture.requests) { assert.equal(request.headers['x-cupcake-key'], undefined); assert.equal(request.headers['x-cupcake-request'], 'account'); assert.equal(request.headers['x-cupcake-account-context'], request.owner === 'A' ? 'acc_summary_a' : 'acc_summary_b'); }
  assert.equal(calls.some(call => /recordings\/(start|part|finish|transcribe|transcription-retry)$/.test(call.route)), false);
  if (archive) for (const name of ['Listen to saved audio', 'Download saved original', 'Transcribe full clip']) assert.equal(await test.page.getByRole('button', { name, exact: true }).isEnabled(), true);
}
const out = path.resolve('output/account-recording-summary'); mkdirSync(out, { recursive: true }); const metrics = [];
try {
  // Group 1: complete explicit flow + server persistence + responsive themes + original controls.
  for (const [width, appearance] of [[320, 'rose'], [1280, 'caribbean']]) {
    reset(); const test = await open(width), p = test.page; await p.evaluate(a => window.summaryFixture.appearance(a), appearance);
    assert.deepEqual(calls.map(c => c.route), ['recordings/list']); assert.equal(await ui(p).getByRole('button', { name: 'Summarize saved transcript', exact: true }).count(), 0);
    await check(p); assert.equal(calls.some(c => c.body.action === 'recording_summary_begin'), false); await begin(p); await ui(p).getByText('Summary saved', { exact: true }).waitFor();
    assert.equal(calls.filter(c => c.body.action === 'recording_summary_begin').length, 1); assert.equal(calls.filter(c => c.body.transcriptSha256 && c.body.action === 'recording_summary_get').length, 2);
    assert.equal(await ui(p).getByRole('link', { name: 'View source transcript' }).getAttribute('href'), '/cupcake/account?document=rec_' + ids.A);
    await ui(p).getByRole('button', { name: 'Listen to original', exact: true }).click(); assert.equal(calls.some(c => c.route === 'recordings/get'), true);
    const size = await p.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, summaryWidth: document.querySelector('.cc-recording-summary').getBoundingClientRect().width })); assert.ok(size.scroll <= size.viewport, JSON.stringify(size)); metrics.push({ width, appearance, ...size });
    await ui(p).getByRole('button', { name: 'Check summary status' }).focus(); assert.equal(await ui(p).getByRole('button', { name: 'Check summary status' }).evaluate(el => el === document.activeElement), true);
    await ui(p).screenshot({ path: path.join(out, `summary-${width}-${appearance}.png`) });
    await p.reload(); await ui(p).waitFor(); assert.equal(calls.filter(c => c.body.action === 'recording_summary_begin').length, 1); await check(p); await ui(p).getByText('Summary saved', { exact: true }).waitFor(); await safe(test); await test.context.close();
  }
  console.log('PASS group 1: explicit full-source summary, pinned polling, persisted readback, original/transcription controls, 320px Violet +1280px Caribbean, focus/no overflow');
  // Group 2: ambiguous response recovery + terminal states never replay inference.
  for (const scenario of ['lostBefore', 'lostAfter', 'uncertain', 'failed', 'cancelled']) {
    reset(scenario); const test = await open(), p = test.page; await check(p); await begin(p);
    if (scenario.startsWith('lost')) { await ui(p).getByRole('alert').waitFor(); const requestId = calls.find(c => c.body.action === 'recording_summary_begin').body.requestId; await p.reload(); await ui(p).waitFor(); await check(p);
      if (scenario === 'lostBefore') { await begin(p); await ui(p).getByText('Summary saved', { exact: true }).waitFor(); assert.deepEqual(calls.filter(c => c.body.action === 'recording_summary_begin').map(c => c.body.requestId), [requestId, requestId]); }
      else { await ui(p).getByText('Summary saved', { exact: true }).waitFor(); assert.equal(calls.filter(c => c.body.action === 'recording_summary_begin').length, 1); }
    } else { await ui(p).getByText(scenario === 'uncertain' ? 'The summary may have started' : scenario === 'failed' ? 'There isn’t enough AI allowance' : 'This summary was cancelled', { exact: false }).waitFor(); await check(p); assert.equal(await ui(p).getByRole('button', { name: /Summarize|Retry|Regenerate/ }).count(), 0); assert.equal(calls.filter(c => c.body.action === 'recording_summary_begin').length, 1); }
    await safe(test); await test.context.close();
  }
  console.log('PASS group 2: lost-before/lost-after responses recover stable UUID, failed/uncertain/cancelled outcomes cannot replay or regenerate');
  // Group 3: eligibility/storage/owner-generation failures stop unsafe summary actions.
  for (const scenario of ['missing', 'oversized', 'staged', 'wrongSource', 'storage']) {
    reset(scenario); const test = await open(), p = test.page; if (scenario === 'storage') await p.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k.includes('audio-summary-v1:')) throw Error('Synthetic storage unavailable'); return set.call(this, k, v); }; });
    await check(p); if (scenario === 'storage') await begin(p); await ui(p).getByRole('alert').waitFor(); assert.equal(calls.some(c => c.body.action === 'recording_summary_begin'), false); assert.equal(await ui(p).getByRole('button', { name: 'Summarize saved transcript', exact: true }).count(), 0); await safe(test); await test.context.close();
  }
  reset(); const late = await open(), p = late.page; mode = 'hold'; const pending = check(p); while (!held) await new Promise(resolve => setTimeout(resolve, 5)); await p.evaluate(() => window.summaryFixture.switchOwner('B')); release(); await pending; await p.getByText('Synthetic B original', { exact: true }).waitFor(); assert.equal(await ui(p).getByRole('button', { name: 'Summarize saved transcript', exact: true }).count(), 0); assert.equal(calls.some(c => c.owner === 'B' && c.route !== 'recordings/list'), false); await safe(late); await late.context.close();
  console.log('PASS group 3: absent/overlong/staged/mismatched source, blocked recovery storage, late owner response cannot send or reveal summary');
  // Group 4: the actual source deep link opens owned Library transcript, never legacy recording route.
  reset(); const link = await open(1280, '?document=rec_' + ids.A); await link.page.getByText('Synthetic source transcript', { exact: true }).waitFor(); await link.page.getByText('Read full transcript', { exact: true }).click(); await link.page.getByText('Complete synthetic source transcript.', { exact: true }).waitFor(); assert.equal(calls.some(c => c.body.action === 'fetch' && c.body.id === 'rec_' + ids.A), true); assert.equal(calls.some(c => c.body.action === 'recording_summary_begin'), false); await safe(link, false); await link.context.close();
  console.log('PASS group 4: real Library deep-link effect renders owned source transcript without legacy callback/provider action');
  writeFileSync(path.join(out, 'responsive-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
