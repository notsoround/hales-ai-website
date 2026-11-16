// Full account UI with synthetic chat, voice history, and report receipts. No external network or microphone.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root = fileURLToPath(new URL('../..', import.meta.url));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-reply-report-'));
const server = await createServer({
  root, cacheDir,
  plugins: [{ name: 'synthetic-reply-report', configureServer(vite) {
    vite.middlewares.use((req, _res, next) => {
      if (req.url?.split('?')[0] === '/cupcake/account') req.url = req.url.replace('/cupcake/account', '/tests/account-browser-preview.html');
      next();
    });
  } }],
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [root, realpathSync(path.join(root, 'node_modules'))] } },
});
const owner = 'acc_synthetic_a';
const threadId = '00000000-0000-4000-8000-000000000901';
const turnId = '00000000-0000-4000-8000-000000000902';
const attemptId = '00000000-0000-4000-8000-000000000903';
const sessionId = '00000000-0000-4000-8000-000000000904';
const callId = '00000000-0000-4000-8000-000000000905';
const reportId = '00000000-0000-4000-8000-000000000906';
const primaryText = 'Synthetic main answer. Keep this answer text out of the report.';
const alternativeText = 'Synthetic alternate answer. Keep this answer text out of the report.';
const promptText = 'Synthetic original prompt. Keep this text out of the report.';
const userVoiceText = 'Synthetic user voice line. Keep this text out of the report.';
const assistantVoiceText = 'Synthetic assistant voice line. Keep this text out of the report.';
const reason = 'The dates in this answer need review.';
const now = Math.floor(Date.now() / 1000);
const thread = { id: threadId, title: 'Synthetic saved conversation', turns: [{ id: turnId, text: promptText, status: 'completed', retryAfter: 0,
  response: { ok: true, reply: primaryText, model: 'synthetic' },
  alternatives: [{ attemptId, response: { ok: true, reply: alternativeText, model: 'synthetic' } }],
}] };
const savedVoice = { sessionId, state: 'ended', maxSeconds: 180, expiresAt: now - 60, createdAt: now - 120,
  result: { source: 'vapi_authenticated_call_read', evidenceType: 'speech-to-text estimate', providerCallId: callId,
    startedAt: '2026-11-15T12:00:00Z', endedAt: '2026-11-15T12:01:00Z', transcript: `${userVoiceText}\n${assistantVoiceText}`,
    messages: [{ role: 'user', message: userVoiceText }, { role: 'assistant', message: assistantVoiceText }],
    billing: 'provider-reported', billingReport: { cost: 0.014 },
  },
};
const ok = value => ({ status: 200, value: { ok: true, ...value } });
const reportName = 'Report this reply';
const reportButton = scope => scope.getByRole('button', { name: reportName, exact: true });
const reportReceipt = scope => scope.getByRole('button', { name: 'Reply reported', exact: true });
const reply = (page, content) => page.locator('.cc-chat-reply').filter({ has: page.getByText(content, { exact: true }) });
const reports = page => page.evaluate(() => window.accountFixture.requests.filter(request => request.route === 'reply-report'));
const withoutReason = (request, target) => {
  const { reason, ...pointer } = request.body;
  assert.equal(reason || '', '');
  assert.deepEqual(pointer, target);
};

await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const outbound = [], pageErrors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === base || url.protocol === 'data:') return route.continue();
    outbound.push(url.href); return route.abort();
  });
  await context.exposeFunction('syntheticQuickChatServer', async (actor, body) => {
    assert.equal(actor, owner);
    if (body.action === 'quick_chat_list') return ok({ threads: [{ id: threadId, title: thread.title }] });
    assert.deepEqual(body, { action: 'quick_chat_get', threadId });
    return ok({ thread });
  });
  await context.exposeFunction('syntheticVoiceServer', async (actor, route, body) => {
    assert.equal(actor, owner);
    if (route === 'voice/config') { assert.deepEqual(body, {}); return ok({ available: true, maxSeconds: 180, reservedMicros: 200000 }); }
    if (route === 'voice/list') { assert.deepEqual(body, {}); return ok({ sessions: [savedVoice] }); }
    assert.equal(route, 'voice/status', 'voice history only reads');
    assert.deepEqual(body, { session_id: sessionId });
    return ok(savedVoice);
  });
  await context.exposeFunction('syntheticReplyReportServer', async (actor, route, body) => {
    assert.equal(actor, owner);
    assert.equal(route, 'reply-report');
    return ok({ report: { id: reportId, reportedAt: new Date(now * 1000).toISOString() }, replayed: body.attemptId === attemptId });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${base}/cupcake/account?tab=chat&thread=${threadId}`);
  await page.getByLabel('Email', { exact: true }).fill('a@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const chatNav = page.locator('.cc-nav').getByRole('button', { name: 'Assistant', exact: true });
  const main = reply(page, primaryText), alt = reply(page, alternativeText);
  if (await chatNav.getAttribute('aria-expanded') !== 'true') await chatNav.click();
  await main.waitFor();
  const alternativeSummary = page.getByText('Another received AI answer', { exact: true });
  await alternativeSummary.click();
  await alt.waitFor();
  assert.equal(await reportButton(page).count(), 0, 'Labs is off by default even for saved replies');

  const setReports = async enabled => {
    const minimize = page.getByRole('button', { name: 'Minimize assistant', exact: true });
    if (await minimize.isVisible()) await minimize.click();
    await page.locator('summary[aria-label="Settings"]').click();
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    const labs = settings.locator('.cc-settings-group').filter({ has: page.getByText('Labs', { exact: true }) });
    const summary = labs.locator('summary');
    if (await labs.getAttribute('open') === null) await summary.click();
    const toggle = settings.getByRole('switch', { name: 'Report AI replies', exact: true });
    assert.equal(await toggle.isChecked(), !enabled);
    await toggle.setChecked(enabled);
    await settings.getByRole('button', { name: 'Close settings', exact: true }).click();
    if (await chatNav.getAttribute('aria-expanded') !== 'true') await chatNav.click();
  };
  await setReports(true);
  await reportButton(main).waitFor();
  assert.equal(await page.locator('.cc-chat-user').getByRole('button', { name: reportName, exact: true }).count(), 0, 'no report action on the user prompt');
  if (!(await alt.isVisible())) await alternativeSummary.click();
  await reportButton(alt).waitFor();
  assert.deepEqual(await reports(page), []);

  const dialog = page.getByRole('dialog', { name: reportName, exact: true });
  const openReport = async scope => {
    await reportButton(scope).click();
    await dialog.waitFor();
    const textarea = dialog.getByRole('textbox', { name: 'Reason (optional)', exact: true });
    assert.equal(await textarea.inputValue(), '', 'a dismissal does not retain a draft reason');
    return textarea;
  };
  await (await openReport(main)).fill('Must not be sent: cancelled reason.');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await reports(page), []);
  await (await openReport(main)).fill('Must not be sent: dismissed reason.');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await reports(page), []);
  await (await openReport(main)).fill(reason);
  await dialog.getByRole('button', { name: 'Save report', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await reportReceipt(main).waitFor();
  let sent = await reports(page);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body, { kind: 'quick_chat', threadId, turnId, reason });

  await openReport(alt);
  await dialog.getByRole('button', { name: 'Save report', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await reportReceipt(alt).waitFor();
  sent = await reports(page);
  assert.equal(sent.length, 2);
  withoutReason(sent[1], { kind: 'quick_chat', threadId, turnId, attemptId });

  const modes = page.getByRole('group', { name: 'Assistant mode', exact: true });
  await modes.getByRole('button', { name: 'Live voice', exact: true }).click();
  await page.getByRole('button', { name: 'Open saved conversation', exact: true }).click();
  const voice = page.locator('.cc-voice-saved');
  await voice.getByText(userVoiceText, { exact: false }).waitFor();
  await voice.getByText(assistantVoiceText, { exact: false }).waitFor();
  assert.equal(await reportButton(voice).count(), 1, 'only the saved assistant line can be reported');
  await openReport(voice);
  await dialog.getByRole('button', { name: 'Save report', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await reportReceipt(voice).waitFor();
  sent = await reports(page);
  assert.equal(sent.length, 3);
  withoutReason(sent[2], { kind: 'voice', sessionId, lineIndex: 1 });
  for (const { route, body, headers, credentials } of sent) {
    assert.equal(route, 'reply-report');
    assert.equal(credentials, 'include');
    assert.equal(headers['x-cupcake-request'], 'account');
    assert.equal(headers['x-cupcake-account-context'], owner);
    assert.equal(headers['x-cupcake-key'], undefined);
    const payload = JSON.stringify(body);
    for (const text of [primaryText, alternativeText, promptText, assistantVoiceText, userVoiceText]) assert.ok(!payload.includes(text));
  }
  await modes.getByRole('button', { name: 'Text', exact: true }).click();
  await main.waitFor();
  await setReports(false);
  assert.equal(await reportButton(page).count(), 0);
  assert.equal((await reports(page)).length, 3, 'a settings change does not send a report');
  const boundary = await page.evaluate(() => ({ mic: window.accountFixture.micRequests, blocked: window.accountFixture.blocked, legacy: window.accountFixture.legacyReads }));
  assert.deepEqual(boundary, { mic: 0, blocked: [], legacy: 0 });
  assert.deepEqual(outbound, []);
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log('PASS: default-off reporting, cancellation, primary and alternate text, assistant-only saved voice, and private pointer-only transport. All simulated.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
