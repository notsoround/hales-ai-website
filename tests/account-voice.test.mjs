// Real studio/components and account transport; only network, Daily and browser
// capture are synthetic. No service credentials, live account data or calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-account-voice-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'local-account-voice', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-voice-preview.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''); next(); }); } }], resolve: { alias: { '@daily-co/daily-js': path.resolve('tests/account-voice-daily.ts') } }, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0], browser = await chromium.launch({ headless: true });
let completed = 0;
const open = async (query = '', width = 390) => {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + 'cupcake/account?' + query);
  const panel = page.getByRole('region', { name: 'Account live voice', exact: true });
  await panel.getByText(/Up to 180 seconds per conversation/).waitFor();
  return { context, page, panel, errors };
};
const voice = (page, method) => page.evaluate(method);
const wait = (page, expression) => page.waitForFunction(expression);
const counts = page => voice(page, () => ({ mic: window.voiceFixture.micRequests, active: window.voiceFixture.activeTracks, stopped: window.voiceFixture.tracksStopped, joins: [...window.voiceFixture.joins], starts: window.voiceFixture.requests.filter(row => row.route === 'voice/start').length, recovery: window.voiceFixture.recovery() }));
const finish = async ({ context, page, errors }, label) => {
  assert.deepEqual(await voice(page, () => window.voiceFixture.blocked), [], label + ': no unexpected API routes');
  assert.deepEqual(errors, [], label + ': no component exceptions');
  for (const row of await voice(page, () => window.voiceFixture.requests.filter(row => row.route.startsWith('voice/')))) {
    assert.equal(row.credentials, 'include'); assert.equal(row.headers['x-cupcake-request'], 'account'); assert.equal(row.headers['x-cupcake-account-context'], row.owner);
    assert.equal(Object.keys(row.body).some(key => /^(owner_?id|account_?id|role|actor)$/i.test(key)), false);
  }
  await context.close(); completed++; console.log('PASS ' + label);
};
const start = async ({ page, panel }) => { await panel.getByRole('button', { name: 'Start conversation', exact: true }).click(); await panel.getByRole('button', { name: 'End conversation', exact: true }).waitFor(); await wait(page, () => window.voiceFixture.joins.length === 1); };
try {
  // Availability off still exposes only owned ended history; opening/refreshing
  // and switching modes never capture audio or dispatch a paid request.
  for (const theme of ['caribbean', 'rose']) for (const width of [320, 390, 1280]) {
    const view = await open('off&theme=' + theme, width), { page, panel } = view;
    assert.equal(await panel.getByRole('button', { name: 'Start conversation', exact: true }).isDisabled(), true);
    await panel.getByRole('button', { name: 'Open saved conversation', exact: true }).click();
    await panel.getByText('Owned saved estimate.', { exact: false }).waitFor();
    await panel.getByText(/Provider-fetched speech-to-text estimate/).waitFor();
    assert.equal(await panel.getByRole('link', { name: 'View source transcript', exact: true }).first().getAttribute('href'), '/cupcake/account?tab=library&document=doc_' + 'a'.repeat(32));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, theme + '/' + width + ' fits viewport');
    await page.getByRole('button', { name: 'Record preview', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Start microphone recording', exact: true }).isEnabled(), true);
    assert.equal(await page.locator('.cc-meeting-capture').isEnabled(), true);
    assert.equal(await page.locator('input[type=file][accept^="audio/"]').isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal((await counts(page)).mic, 0); assert.equal((await counts(page)).starts, 0);
    assert.equal((await counts(page)).joins.length, 0);
    assert.ok((await voice(page, () => window.voiceFixture.requests.filter(row => row.route.startsWith('voice/')).map(row => row.route))).every(route => ['voice/config', 'voice/list', 'voice/status'].includes(route)));
    await finish(view, `off/history + preserved Record/import ${theme} ${width}`);
  }
  {
    const view = await open(), { page, panel } = view;
    await voice(page, () => { window.voiceFixture.micMode = 'deny'; });
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await panel.getByText(/Microphone is blocked/).waitFor();
    const state = await counts(page); assert.equal(state.starts, 0); assert.equal(state.joins.length, 0); assert.equal(state.active, 0);
    assert.match(state.recovery.requestId, /^[a-f0-9-]{36}$/);
    assert.equal(await voice(page, () => window.voiceFixture.micRecovery[0].requestId), state.recovery.requestId, 'UUID persisted before permission');
    assert.equal(await voice(page, () => localStorage.getItem('live-voice-v1')), null, 'recovery is account namespaced');
    assert.equal(await voice(page, () => window.voiceFixture.namespace()), 'cupcake-account-v1:acc_voice_a:');
    await finish(view, 'durable account UUID before denied microphone; no paid request');
  }
  {
    const view = await open(), { page, panel } = view;
    await voice(page, () => { window.voiceFixture.micMode = 'hold'; });
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await wait(page, () => window.voiceFixture.micRequests === 1);
    await panel.getByRole('button', { name: 'Cancel connection', exact: true }).click();
    await voice(page, () => window.voiceFixture.releaseMic());
    await wait(page, () => window.voiceFixture.tracksStopped === 1);
    const state = await counts(page); assert.equal(state.starts, 0); assert.equal(state.active, 0); assert.equal(state.joins.length, 0);
    await finish(view, 'cancel permission; late microphone stream stopped');
  }
  {
    const view = await open(), { page, panel } = view;
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).evaluate(button => { button.click(); button.click(); });
    await panel.getByRole('button', { name: 'End conversation', exact: true }).waitFor();
    let state = await counts(page); assert.equal(state.starts, 1); assert.equal(state.mic, 1); assert.equal(state.joins.length, 1); assert.equal(state.active, 1);
    assert.equal(await voice(page, () => window.voiceFixture.micRecovery[0].requestId), state.recovery.requestId);
    assert.equal(await voice(page, () => window.voiceFixture.requests.find(row => row.route === 'voice/start').recovery.requestId), state.recovery.requestId);
    await voice(page, () => window.voiceFixture.emit('Temporary streamed words.'));
    await panel.getByRole('heading', { name: 'Live captions · provisional', exact: true }).waitFor();
    await panel.getByText(/not your saved transcript/).waitFor();
    await panel.getByRole('button', { name: 'End conversation', exact: true }).click();
    await panel.getByText('Owned saved estimate.', { exact: false }).waitFor();
    await panel.getByText(/Provider-fetched speech-to-text estimate/).waitFor();
    assert.equal(await panel.getByText('Temporary streamed words.', { exact: true }).count(), 0);
    state = await counts(page); assert.equal(state.active, 0); assert.equal(state.recovery, null); assert.equal(state.starts, 1);
    await wait(page, () => window.voiceFixture.destroys >= 1);
    await finish(view, 'one explicit start; provisional captions separate from authenticated saved estimate');
  }
  {
    const view = await open('behavior=lostStart'), { page } = view; let panel = view.panel;
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await panel.getByText(/request may have started/).waitFor();
    const before = await counts(page); assert.equal(before.starts, 1); assert.equal(before.joins.length, 0); assert.equal(before.active, 0);
    await page.reload(); panel = page.getByRole('region', { name: 'Account live voice', exact: true });
    await panel.getByRole('button', { name: 'Resume same conversation', exact: true }).waitFor();
    let state = await counts(page); assert.equal(state.mic, 0); assert.equal(state.starts, 0); assert.equal(state.joins.length, 0); assert.equal(state.recovery.requestId, before.recovery.requestId);
    assert.ok((await voice(page, () => window.voiceFixture.requests.filter(row => row.route === 'voice/recover'))).every(row => row.body.request_id === before.recovery.requestId));
    await panel.getByRole('button', { name: 'Resume same conversation', exact: true }).click();
    await panel.getByRole('button', { name: 'End conversation', exact: true }).waitFor();
    state = await counts(page); assert.equal(state.starts, 0); assert.deepEqual(state.joins, ['https://vapi.daily.co/synthetic-room']); assert.equal(state.recovery.requestId, before.recovery.requestId);
    await panel.getByRole('button', { name: 'End conversation', exact: true }).click();
    await wait(page, () => window.voiceFixture.activeTracks === 0 && window.voiceFixture.recovery() === null);
    await finish(view, 'lost response reload only recovers; explicit Resume reuses UUID and room');
  }
  {
    const view = await open('unknown'), { page, panel } = view;
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).waitFor();
    const old = await counts(page); assert.equal(old.starts, 0); assert.equal(old.mic, 0);
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await panel.getByRole('button', { name: 'End conversation', exact: true }).waitFor();
    const state = await counts(page); assert.equal(state.starts, 1); assert.equal(state.recovery.requestId, old.recovery.requestId);
    await panel.getByRole('button', { name: 'End conversation', exact: true }).click();
    await wait(page, () => window.voiceFixture.activeTracks === 0);
    await finish(view, 'unknown recovery requires explicit same UUID start');
  }
  for (const phase of ['start', 'join']) {
    const view = await open(phase === 'start' ? 'behavior=holdStart' : ''), { page, panel } = view;
    if (phase === 'join') await voice(page, () => { window.voiceFixture.holdJoin = true; });
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await wait(page, phase === 'start' ? () => window.voiceFixture.held : () => window.voiceFixture.joins.length === 1);
    await panel.getByRole('button', { name: 'Cancel connection', exact: true }).click();
    assert.equal((await counts(page)).active, 0, 'local capture closes before server reply');
    await voice(page, () => { window.voiceFixture.release(); window.voiceFixture.releaseJoin(); });
    await wait(page, () => window.voiceFixture.requests.some(row => row.route === 'voice/end'));
    await wait(page, () => window.voiceFixture.recovery() === null);
    assert.equal((await counts(page)).starts, 1);
    if (phase === 'start') assert.equal((await counts(page)).joins.length, 0); else await wait(page, () => window.voiceFixture.destroys >= 1);
    await finish(view, `cancel pending ${phase}; late result cleaned without replay`);
  }
  for (const behavior of ['badRoom', 'wrongEcho']) {
    const view = await open('behavior=' + behavior), { page, panel } = view;
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await wait(page, () => window.voiceFixture.requests.some(row => row.route === 'voice/start'));
    await wait(page, () => window.voiceFixture.activeTracks === 0);
    const state = await voice(page, () => ({ joins: window.voiceFixture.joins.length, starts: window.voiceFixture.requests.filter(row => row.route === 'voice/start').length, held: localStorage.getItem('cupcake-account-v1:acc_voice_a:live-voice-v1') }));
    assert.equal(state.joins, 0); assert.equal(state.starts, 1); assert.ok(state.held);
    await finish(view, behavior + ' discards response and never joins');
  }
  {
    const view = await open('behavior=holdStart'), { page, panel } = view;
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click(); await wait(page, () => window.voiceFixture.held);
    await voice(page, () => window.voiceFixture.switchOwner('B'));
    assert.equal((await counts(page)).active, 0);
    await voice(page, () => window.voiceFixture.release());
    await page.getByRole('heading', { name: 'Live voice with Cupcake', exact: true }).waitFor();
    await wait(page, () => window.voiceFixture.requests.some(row => row.route === 'voice/config' && row.owner === 'acc_voice_b'));
    assert.equal((await counts(page)).joins.length, 0); assert.equal((await counts(page)).recovery, null);
    assert.ok(await voice(page, () => localStorage.getItem('cupcake-account-v1:acc_voice_a:live-voice-v1')));
    assert.equal(await panel.getByText('Owned saved estimate.', { exact: false }).count(), 0);
    await finish(view, 'account switch stops microphone; old start discarded and recovery stays in old namespace');
  }
  {
    const view = await open('behavior=endUncertain'), { page, panel } = view; await start(view);
    const id = (await counts(page)).recovery.requestId;
    await panel.getByRole('button', { name: 'End conversation', exact: true }).click();
    await panel.getByText(/Wrapping up the conversation/).waitFor();
    let state = await counts(page); assert.equal(state.active, 0); assert.equal(state.recovery.requestId, id);
    assert.equal(await panel.getByText(/^Conversation ended\./).count(), 0);
    assert.equal(await panel.getByRole('button', { name: 'Start conversation', exact: true }).count(), 0);
    await panel.getByRole('button', { name: 'Check status now', exact: true }).click();
    await panel.getByText(/Wrapping up the conversation/).waitFor(); state = await counts(page); assert.equal(state.recovery.requestId, id); assert.equal(state.starts, 1);
    // One tap recovers: it waits for the server to confirm the old call ended, then starts.
    await panel.getByRole('button', { name: 'Start new conversation', exact: true }).click();
    await panel.getByRole('button', { name: 'Starting after the last one closes…', exact: true }).waitFor();
    await page.waitForTimeout(2500); state = await counts(page); assert.equal(state.starts, 1, 'never starts while the old call is unconfirmed'); assert.equal(state.mic, 1);
    await voice(page, () => window.voiceFixture.confirmEnd());
    await wait(page, () => window.voiceFixture.requests.filter(row => row.route === 'voice/start').length === 2 && window.voiceFixture.joins.length === 2);
    assert.notEqual((await counts(page)).recovery.requestId, id, 'new conversation uses a new request id');
    await finish(view, 'uncertain end keeps recovery; one tap starts again only after the server confirms the end');
  }
  {
    const view = await open('behavior=slowEnd'), { page, panel } = view; await start(view);
    await panel.getByRole('button', { name: 'End conversation', exact: true }).click();
    await panel.getByText(/Wrapping up the conversation/).waitFor();
    assert.equal((await counts(page)).active, 0, 'microphone off at once');
    await panel.getByText('Owned saved estimate.', { exact: false }).waitFor({ timeout: 20000 });
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).waitFor();
    assert.equal((await counts(page)).recovery, null);
    await finish(view, 'slow server end resolves by itself without a tap');
  }
  for (const how of ['status', 'left']) {
    const view = await open(), { page, panel } = view; await start(view);
    if (how === 'status') await voice(page, () => window.voiceFixture.remote('app-message', { data: { type: 'status-update', status: 'ended', endedReason: 'call.in-progress.error-assistant-did-not-receive-customer-audio' } }));
    else await voice(page, () => window.voiceFixture.remote('participant-left', { participant: { local: false } }));
    await wait(page, () => window.voiceFixture.activeTracks === 0 && window.voiceFixture.requests.some(row => row.route === 'voice/end'));
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).waitFor();
    if (how === 'status') await panel.getByText(/could not hear your microphone/).waitFor();
    await finish(view, `provider ending the call (${how}) stops the microphone and closes it`);
  }
  {
    const view = await open(), { page, panel } = view;
    await voice(page, () => { window.voiceFixture.holdJoin = true; });
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await wait(page, () => window.voiceFixture.joins.length === 1);
    await panel.getByText(/did not open in time/).waitFor({ timeout: 20000 });
    await wait(page, () => window.voiceFixture.activeTracks === 0 && window.voiceFixture.requests.some(row => row.route === 'voice/end'));
    await panel.getByRole('button', { name: 'Start conversation', exact: true }).waitFor();
    await finish(view, 'a join that never opens times out and closes the call');
  }
  {
    const view = await open('behavior=emptyResult'), { page, panel } = view;
    await voice(page, () => { window.voiceFixture.holdLeave = true; }); await start(view);
    await panel.getByRole('button', { name: 'End conversation', exact: true }).click();
    await panel.getByText(/No speech transcript was returned/).waitFor();
    assert.equal(await panel.getByText(/provider-fetched transcript is saved/).count(), 0);
    assert.equal(await panel.getByText(/Provider-fetched speech-to-text estimate/).count(), 0);
    assert.equal((await counts(page)).active, 0);
    await wait(page, () => window.voiceFixture.destroys >= 1);
    assert.equal((await counts(page)).recovery, null);
    await finish(view, 'empty artifact makes no saved speech claim; hung leave still destroys transport');
  }
  {
    const view = await open(), { page, panel } = view; await start(view);
    await voice(page, () => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal((await counts(page)).active, 0, 'simulated pagehide immediately stops capture');
    await wait(page, () => window.voiceFixture.requests.some(row => row.route === 'voice/end'));
    await voice(page, () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await panel.getByText('Owned saved estimate.', { exact: false }).waitFor();
    const state = await counts(page); assert.equal(state.starts, 1); assert.equal(state.mic, 1); assert.equal(state.joins.length, 1); assert.equal(state.active, 0);
    assert.ok(await voice(page, () => window.voiceFixture.requests.some(row => row.route === 'voice/status')));
    await finish(view, 'simulated pagehide stops audio; pageshow checks status without capture or replay');
  }
  {
    const view = await open('behavior=deadline'), { page, panel } = view; await start(view);
    await wait(page, () => window.voiceFixture.activeTracks === 0 && window.voiceFixture.requests.some(row => row.route === 'voice/end'));
    await panel.getByText('Owned saved estimate.', { exact: false }).waitFor();
    assert.equal((await counts(page)).starts, 1); await finish(view, 'server hard deadline stops local capture and confirms end');
  }
  {
    const view = await open(), { page, panel } = view; await start(view);
    await page.getByRole('button', { name: 'Record preview', exact: true }).click();
    await wait(page, () => window.voiceFixture.activeTracks === 0);
    await page.getByRole('button', { name: 'Start microphone recording', exact: true }).waitFor();
    await wait(page, () => window.voiceFixture.requests.some(row => row.route === 'voice/end'));
    await page.getByRole('button', { name: 'Start microphone recording', exact: true }).click();
    await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Talk preview', exact: true }).click();
    assert.equal(await panel.getByRole('button', { name: 'Start conversation', exact: true }).isDisabled(), true, 'recording and live voice are mutually exclusive');
    await page.getByRole('button', { name: 'Record preview', exact: true }).click();
    await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
    await wait(page, () => window.voiceFixture.activeTracks === 0);
    assert.equal((await counts(page)).starts, 1); await finish(view, 'switching stops voice; active recording blocks new voice and preserves recording flow');
  }
  console.log(`PASS ${completed} focused account-voice browser scenarios. All media, accounts, transcripts and API replies simulated; no live calls, deployment or provider requests.`);
} catch (error) {
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page && !page.isClosed()) console.error('Synthetic fixture at failure:', (await page.locator('body').innerText()).slice(-5000));
  throw error;
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
