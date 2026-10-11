// Local built-site checks. Every private API response is synthetic; external
// requests and service workers are blocked. No owner password or data is used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const dist = path.resolve('dist'), keyName = 'cupcake-private-access', fixtureKey = 'synthetic-owner-key';
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.join(dist, path.extname(pathname) ? pathname : '/index.html');
  if (!file.startsWith(dist + path.sep) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  response.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
async function fixture(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  const state = { mode: 'ok', pauseNext: false, waiting: null, errors: [], requests: [] };
  context.on('page', page => page.on('pageerror', error => state.errors.push(error.message)));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base) return route.continue();
    if (url.origin !== 'https://automate.hales.ai') return route.abort();
    assert.equal(request.headers()['x-cupcake-key'], fixtureKey, 'all private modules use the saved owner-entered key');
    const action = request.postData() ? request.postDataJSON().action : null;
    state.requests.push({ path: url.pathname, action });
    if (state.pauseNext && url.pathname.endsWith('/cupcake-feed')) {
      state.pauseNext = false;
      await new Promise(resolve => { state.waiting = resolve; });
    }
    if (state.mode === 'offline') return route.abort();
    if (state.mode === 'forbidden') return route.fulfill({ status: 403, body: '{}' });
    const data = url.pathname.endsWith('/cupcake-feed') ? { items: [], totals: {} } : { ok: true, items: [], threads: [], sessions: [], measurements: [], latestMeasurement: null, drafts: [], documents: [], projects: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { context, state };
}
const opened = page => page.getByRole('button', { name: 'Lock', exact: true }).waitFor();
const locked = page => page.getByRole('button', { name: 'Open Cupcake', exact: true }).waitFor();
async function stores(page) { return page.evaluate(key => ({ local: localStorage.getItem(key), session: sessionStorage.getItem(key) }), keyName); }

try {
  for (const width of [390, 1280]) {
    const { context, state } = await fixture(width);
    let page = await context.newPage();
    await page.goto(`${base}/cupcake`); await locked(page);
    await page.getByLabel('Cupcake password').fill(fixtureKey);
    await page.getByRole('button', { name: 'Open Cupcake' }).click(); await opened(page);
    assert.deepEqual(await stores(page), { local: fixtureKey, session: null });
    await page.reload(); await opened(page);
    await page.goto(base); await page.goto(`${base}/cupcake`); await opened(page);
    await page.close(); page = await context.newPage(); await page.goto(`${base}/cupcake`); await opened(page);
    const other = await context.newPage(); await other.goto(`${base}/cupcake`); await opened(other);
    state.pauseNext = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Connecting…', exact: true }).waitFor();
    const deadline = Date.now() + 5000;
    while (!state.waiting && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(state.waiting, 'startup validation reached the synthetic pause');
    await other.getByRole('button', { name: 'Lock', exact: true }).click(); await locked(other); await locked(page);
    state.waiting(); state.waiting = null;
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('button', { name: 'Lock', exact: true }).count(), 0, 'late validation cannot undo another tab’s Lock');
    assert.deepEqual(await stores(page), { local: null, session: null });
    await page.reload(); await locked(page);
    await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key: keyName, value: fixtureKey });
    await page.reload(); await opened(page);
    assert.deepEqual(await stores(page), { local: fixtureKey, session: null }, 'existing tab credential migrates after validation');
    state.mode = 'offline'; await page.reload(); await locked(page);
    await page.getByRole('alert').filter({ hasText: 'saved sign-in is still' }).waitFor();
    assert.equal((await stores(page)).local, fixtureKey);
    state.mode = 'ok'; await page.getByRole('button', { name: 'Open Cupcake' }).click(); await opened(page);
    state.mode = 'forbidden'; await page.reload(); await locked(page);
    await page.getByRole('alert').filter({ hasText: 'no longer valid' }).waitFor();
    assert.deepEqual(await stores(page), { local: null, session: null });
    assert.equal(state.errors.length, 0, state.errors.join('; '));
    assert.ok(state.requests.some(request => request.action === 'weight_list'), 'Library auth also uses persistent access');
    await context.close();
    console.log(`PASS ${width}px: reload, navigation, tab close/reopen, new tab, cross-tab Lock, delayed response, legacy migration, network retry, revoked key.`);
  }
  const { context, state } = await fixture(390);
  await context.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { configurable: true, get() { throw Error('Synthetic storage denied'); } });
  });
  const page = await context.newPage(); await page.goto(`${base}/cupcake`); await locked(page);
  await page.getByLabel('Cupcake password').fill(fixtureKey);
  await page.getByRole('button', { name: 'Open Cupcake' }).click(); await opened(page);
  await page.getByRole('status').filter({ hasText: 'could not save' }).waitFor();
  await page.getByRole('button', { name: 'Lock', exact: true }).click(); await locked(page);
  assert.equal(state.errors.length, 0, state.errors.join('; '));
  await context.close();
  console.log('PASS: denied storage permits this session with an accurate notice and explicit Lock. All API traffic was synthetic.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
