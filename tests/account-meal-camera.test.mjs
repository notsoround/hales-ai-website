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
    await camera.getByRole('button', { name: 'Close camera' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.cc-cam-feed')?.videoWidth > 0);
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
  await camera.getByText('Camera off', { exact: false }).first().waitFor();
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

  // ---- Sharp photos: a real still when the browser offers one, the right lens, continuous focus ----
  const analyzed = page => page.evaluate(async () => { const row = window.photoFixture.requests.find(r => r.route.endsWith('/food/photo/analyze')); const img = new Image(); img.src = row.body.image; await img.decode(); return { w: img.naturalWidth, h: img.naturalHeight }; });
  const start = async (init) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(init);
    await page.route('**/*', route => new URL(route.request().url()).origin === base || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.goto(base + '/cupcake/account'); await page.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('button')?.disabled);
    await page.getByRole('button', { name: 'Take meal photo', exact: true }).click();
    const camera = page.getByRole('dialog', { name: 'Meal camera' });
    await page.waitForFunction(() => document.querySelector('.cc-cam-feed')?.videoWidth > 0);
    return { context, page, camera, errors };
  };
  {
    // A phone with a still-photo API: the shutter takes a real 3000×2250 photo, not the 640-wide preview frame.
    const { context, page, camera, errors } = await start(() => {
      window.cameraProbe = { stills: 0, settings: null };
      window.ImageCapture = class { getPhotoCapabilities() { return Promise.resolve({ imageWidth: { min: 640, max: 4000, step: 1 } }); }
        takePhoto(settings) { window.cameraProbe.stills++; window.cameraProbe.settings = settings; const c = document.createElement('canvas'); c.width = 3000; c.height = 2250; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 3000, 2250); x.fillStyle = '#111'; for (let i = 0; i < 60; i++) x.fillText('SYNTHETIC RECEIPT LINE ' + i, 40, 40 + i * 36); return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', .95)); } };
    });
    await camera.getByRole('button', { name: 'Take meal photo' }).click();
    await camera.waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.photoFixture.requests.some(row => row.route.endsWith('/food/photo/analyze')));
    const probe = await page.evaluate(() => window.cameraProbe), size = await analyzed(page);
    assert.equal(probe.stills, 1, 'one real still per shutter press');
    assert.equal(probe.settings.imageWidth, 2400, 'asks for a still at least 2400 px wide, not the sensor maximum');
    assert.deepEqual(size, { w: 2048, h: 1536 }, 'upload keeps 2048 px on the long edge');
    assert.equal(await page.evaluate(() => document.querySelectorAll('video').length), 0);
    assert.deepEqual(errors, []); await context.close();
  }
  {
    // No still-photo API (iPhone Safari): the preview is asked for its sharpest size and its frame is the photo. A failing still also falls back.
    const { context, page, camera, errors } = await start(() => {
      delete window.ImageCapture; window.cameraProbe = { asked: [] };
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = constraints => { window.cameraProbe.asked.push(JSON.parse(JSON.stringify(constraints.video))); return real(constraints); };
    });
    assert.equal((await page.evaluate(() => window.cameraProbe.asked))[0].width.ideal, 3840);
    const frame = await page.evaluate(() => { const v = document.querySelector('.cc-cam-feed'); return { w: v.videoWidth, h: v.videoHeight }; });
    await camera.getByRole('button', { name: 'Take meal photo' }).click();
    await camera.waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.photoFixture.requests.some(row => row.route.endsWith('/food/photo/analyze')));
    const size = await analyzed(page), scale = Math.min(1, 2048 / Math.max(frame.w, frame.h));
    assert.deepEqual(size, { w: Math.round(frame.w * scale), h: Math.round(frame.h * scale) }, 'the preview frame is uploaded at its own size (up to 2048 px)');
    assert.deepEqual(errors, []); await context.close();
  }
  {
    // A phone that hands back a fixed-focus wide lens: the camera switches to the main rear lens and keeps it focusing.
    const { context, page, errors } = await start(() => {
      window.cameraProbe = { asked: [], applied: [] };
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = async () => [
        { kind: 'videoinput', deviceId: 'wide', label: 'camera2 2, facing back', groupId: 'g' }, { kind: 'videoinput', deviceId: 'main', label: 'camera2 0, facing back', groupId: 'g' },
        { kind: 'videoinput', deviceId: 'selfie', label: 'camera2 1, facing front', groupId: 'g' }];
      navigator.mediaDevices.getUserMedia = async constraints => {
        const video = constraints.video, main = video.deviceId?.exact === 'main'; window.cameraProbe.asked.push(main ? 'main' : 'environment');
        const stream = await real({ audio: false, video: true }), track = stream.getVideoTracks()[0];
        Object.defineProperty(track, 'label', { value: main ? 'camera2 0, facing back' : 'camera2 2, facing back' });
        track.getSettings = () => ({ deviceId: main ? 'main' : 'wide' });
        track.getCapabilities = () => ({ focusMode: main ? ['manual', 'single-shot', 'continuous'] : ['manual'], exposureMode: ['continuous'] });
        track.applyConstraints = async value => { window.cameraProbe.applied.push({ lens: main ? 'main' : 'wide', ...value.advanced[0] }); };
        return stream;
      };
    });
    await page.waitForFunction(() => window.cameraProbe.asked.includes('main') && window.cameraProbe.applied.some(row => row.lens === 'main' && row.focusMode === 'continuous'));
    const probe = await page.evaluate(() => window.cameraProbe);
    assert.deepEqual(probe.asked, ['environment', 'main'], 'one switch to the main lens, no loop');
    // Tap to focus sets a point of interest, then the ring disappears.
    const box = await page.locator('.cc-cam-panel').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * .4);
    await page.waitForFunction(() => window.cameraProbe.applied.some(row => row.lens === 'main' && row.pointsOfInterest && row.focusMode === 'single-shot'));
    assert.equal(await page.getByRole('dialog', { name: 'Meal camera' }).count(), 1, 'a tap focuses; it does not close the camera');
    assert.deepEqual(errors, []); await context.close();
  }
  console.log('PASS: real still photo at 2048 px upload; frame fallback asks for the sharpest preview; fixed-focus lens swapped for the main lens with continuous focus and tap to focus');
} finally { await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
