// Account meal camera: framed viewfinder with a fake camera, capture hands the photo to the
// existing account photo flow, and a refused camera falls back to the phone camera. Synthetic only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-meal-camera-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-photo-account', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-photo-meal-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const shots = process.env.SHOTS;
async function open(width, refuse = false) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, permissions: refuse ? [] : ['camera'] });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  if (refuse) await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
  await page.route('**/*', route => new URL(route.request().url()).origin === base || route.request().url().startsWith('data:') ? route.continue() : route.abort());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/cupcake/account'); await page.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button')?.disabled);
  return { page, context, errors };
}
try {
  for (const width of [390, 1280]) {
    const { page, context, errors } = await open(width);
    await page.getByRole('button', { name: 'Take meal photo', exact: true }).click();
    const camera = page.getByRole('dialog', { name: 'Meal camera' });
    await camera.getByRole('heading', { name: 'Take a photo of your meal' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.cc-meal-camera-feed')?.dataset.live === 'true' && document.querySelector('.cc-meal-camera-feed').videoWidth > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (shots) await page.screenshot({ path: `${shots}/camera-live-${width}.png` });
    await camera.getByRole('button', { name: 'Take meal photo' }).click();
    await camera.waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.photoFixture.requests.some(row => row.route.endsWith('/food/photo/analyze')));
    assert.equal(await page.evaluate(() => !!navigator.mediaDevices && document.querySelectorAll('video').length), 0, 'camera released after capture');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: framed viewfinder at phone/desktop widths; shutter hands one photo to the account flow and releases the camera');
  const { page, context, errors } = await open(390, true);
  await page.getByRole('button', { name: 'Take meal photo', exact: true }).click();
  const camera = page.getByRole('dialog', { name: 'Meal camera' });
  await camera.getByText('Camera access is off').waitFor();
  await camera.getByRole('button', { name: 'Open phone camera' }).waitFor();
  assert.equal(await camera.getByLabel('Take meal photo file').getAttribute('capture'), 'environment');
  if (shots) await page.screenshot({ path: `${shots}/camera-blocked-390.png` });
  await camera.getByLabel('Take meal photo file').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') });
  await camera.waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.photoFixture.requests.some(row => row.route.endsWith('/food/photo/analyze')));
  await page.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor().catch(() => undefined);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS: refused camera falls back to the phone camera with the same photo flow');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
