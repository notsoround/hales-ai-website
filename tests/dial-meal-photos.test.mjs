// Mount the real React hook and account transport. Every account response is synthetic.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-dial-photos-'));
const html = '<main></main><script type="module" src="/tests/dial-meal-photos-fixture.tsx"></script>';
const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'synthetic-dial', configureServer(s) {
    s.middlewares.use(async (req, res, next) => {
      if (req.url !== '/cupcake/account') return next();
      res.setHeader('content-type', 'text/html');
      res.end(await s.transformIndexHtml(req.url, html));
    });
  } }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch();
  const page = await browser.newPage({ serviceWorkers: 'block' });
  await page.clock.setFixedTime(new Date('2026-11-27T01:30:00Z')); // Still the 26th in Chicago.
  const day = '2026-11-26';
  const meal = (id, time, extra = {}) => ({
    id, consumedAt: time, sheetLoggedAt: time, imageStored: true, ...extra,
  });
  const photos = [
    meal('dinner', '2026-11-27T01:00:00Z'), meal('dinner', '2026-11-27T01:00:00Z'),
    meal('afternoon', '2026-11-26T16:00:00Z'), meal('breakfast', '2026-11-26T12:00:00Z'),
    meal('older', '2026-11-26T11:00:00Z'), meal('later', '2026-11-27T02:00:00Z'),
    meal('yesterday', '2026-11-26T05:59:00Z'), meal('pending', '2026-11-27T01:10:00Z', { countedInTotals: false }),
    meal('unknown-zone', '2026-11-26T19:05:00', { date: day }),
    meal('receipt', '2026-11-27T01:05:00Z', { sheetLoggedAt: null }), meal('manual', '2026-11-27T01:05:00Z', { imageStored: false }),
  ];
  const history = { meals: photos, complete: true, pendingCount: 0, undatedLoggedCount: 0 };
  const render = (args = {}) => page.evaluate(props => window.fixture.render(props), { history, day, enabled: true, ...args });
  const expectPhotos = expected => page.waitForFunction(value => document.querySelector('output')?.textContent === JSON.stringify(value), expected, { timeout: 6000 });
  let owner = 'a', release, markReadStarted, markReadFinished;
  const readStarted = new Promise(resolve => { markReadStarted = resolve; });
  const readFinished = new Promise(resolve => { markReadFinished = resolve; });
  const replacements = new Map();
  const reads = [], external = [], src = (id, who = owner) => 'data:image/jpeg;base64,' + Buffer.from(who + '.' + id).toString('base64');
  await page.route('**/*', async r => {
    const url = new URL(r.request().url());
    if (url.origin === base) return r.continue();
    if (url.origin !== 'https://automate.hales.ai' || !['/api/account/data','/api/account/session'].includes(url.pathname)) {
      external.push(url.href); return r.abort();
    }
    const who = owner, identity = { account_id: who, email: who + '@example.invalid', name: 'Synthetic ' + who };
    if (url.pathname.endsWith('/session')) return r.fulfill({ json: { ok: true, identity } });
    const { action, mealId } = r.request().postDataJSON();
    reads.push({ action, mealId, owner: r.request().headers()['x-cupcake-account-context'] });
    if (mealId === 'delayed') await new Promise(resolve => { release = resolve; markReadStarted(); });
    const dataUrl = mealId === 'unsafe' ? 'https://example.invalid/private-original' : src(replacements.get(mealId) ?? (mealId === 'duplicate' ? 'dinner' : mealId), who);
    await r.fulfill({ json: { ok: true, identity, photo: { dataUrl } } });
    if (mealId === 'delayed') markReadFinished();
  });
  await page.goto(base + '/cupcake/account');
  await page.waitForFunction(() => !!window.fixture);
  await render();
  await expectPhotos([]);
  assert.equal(reads.length, 0);
  await page.evaluate(() => window.fixture.login());
  await expectPhotos(['dinner', 'afternoon', 'breakfast'].map(id => src(id)));
  assert.deepEqual(reads.map(r => r.mealId).sort(), ['afternoon', 'breakfast', 'dinner']);

  await render({ enabled: false });
  await expectPhotos([]);
  await render();
  await expectPhotos(['dinner', 'afternoon', 'breakfast'].map(id => src(id)));
  await render({ history: null });
  await expectPhotos([]);
  await render();
  await expectPhotos(['dinner', 'afternoon', 'breakfast'].map(id => src(id)));
  assert.equal(reads.length, 3);

  const updated = { ...history, meals: [meal('snack', '2026-11-27T01:15:00Z'), ...photos] };
  await render({ history: updated });
  await expectPhotos(['snack', 'dinner', 'afternoon'].map(id => src(id)));
  assert.equal(reads.length, 4);
  await render({ history: { ...history, meals: [meal('unsafe', '2026-11-27T01:25:00Z'), meal('duplicate', '2026-11-27T01:20:00Z'), ...photos] } });
  await expectPhotos([src('dinner')]);

  await render({ history: { ...history, meals: [meal('delayed', '2026-11-27T01:25:00Z')] } });
  await readStarted;
  assert.ok(release, 'the prior account has a read in flight');
  await page.evaluate(() => window.fixture.logout());
  await expectPhotos([]);
  await render();
  owner = 'b';
  await page.evaluate(() => window.fixture.login());
  await expectPhotos(['dinner', 'afternoon', 'breakfast'].map(id => src(id)));
  release();
  await readFinished;
  await expectPhotos(['dinner', 'afternoon', 'breakfast'].map(id => src(id)));
  await render({ day: '2026-11-27' });
  await expectPhotos([]);
  // The calendar can revisit a meal whose first attachment was undone and replaced.
  const oneMeal = { ...history, meals: [photos[0]] };
  const oneMealWithoutPhoto = { ...history, meals: [{ ...photos[0], imageStored: false }] };
  replacements.set('dinner', 'attachment-a');
  await render({ history: oneMeal });
  await expectPhotos([src('attachment-a')]);
  const readsBeforeUndo = reads.length;
  await render({ history: oneMealWithoutPhoto });
  await expectPhotos([]);
  replacements.set('dinner', 'attachment-b');
  await render({ history: oneMeal });
  await expectPhotos([src('attachment-b')]);
  assert.equal(reads.length, readsBeforeUndo + 1);

  // Some refreshes keep the same selected meal IDs, including a change on another device.
  replacements.set('dinner', 'replacement');
  await page.evaluate(() => window.fixture.changed('food'));
  await expectPhotos([src('replacement')]);
  assert.equal(reads.length, readsBeforeUndo + 2);
  await render({ history: oneMeal, enabled: false });
  await expectPhotos([]);
  replacements.set('dinner', 'changed-while-hidden');
  await page.evaluate(() => window.fixture.changed('food'));
  await render({ history: oneMeal, day: '' });
  await expectPhotos([]);
  assert.equal(reads.length, readsBeforeUndo + 2);
  await render({ history: oneMeal });
  await expectPhotos([src('changed-while-hidden')]);
  assert.equal(reads.length, readsBeforeUndo + 3);
  assert.deepEqual(external, []);
  assert.ok(reads.every(r => r.action === 'food_photo_thumbnail' && ['a','b'].includes(r.owner)));
  console.log('PASS: confirmed local-day meals, fresh save, ordering, duplicate IDs/images, bounded reads, dial reuse, unsafe response, midnight, account changes, replacing an attachment after Undo, and refresh with stable meal IDs.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
