// Real account/photo/dialog/timeline components; all responses and images are local fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-mobile-photo-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'local-account-photo-fixture', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-photo-meal-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0];
const output = process.env.MOBILE_UI_OUTPUT;
if (output) mkdirSync(output, { recursive: true });
const browserNames = process.env.MOBILE_BROWSER ? [process.env.MOBILE_BROWSER] : ['chromium', 'webkit'];
const widths = process.env.MOBILE_WIDTH ? [Number(process.env.MOBILE_WIDTH)] : [320, 390, 1280];
const themes = process.env.MOBILE_THEME ? [process.env.MOBILE_THEME] : ['caribbean', 'rose'];
let measuredStates = 0;

async function measure(page, width, label) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth, inner: innerWidth, scroll: document.documentElement.scrollWidth,
    scale: visualViewport?.scale || 1,
    boxes: [...document.querySelectorAll('.cc-account-photo-progress, dialog[open], .cc-photo-viewer')].map(el => ({ left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth })),
  }));
  assert.equal(result.viewport, width, label + ': viewport width');
  assert.equal(result.inner, width, label + ': layout viewport did not expand');
  assert.ok(result.scroll <= width, `${label}: document overflow ${result.scroll} > ${width}`);
  assert.equal(result.scale, 1, label + ': no unintended viewport scale');
  for (const box of result.boxes) {
    assert.ok(box.left >= -1 && box.right <= width + 1, label + ': content stays inside the viewport');
    assert.ok(box.scroll <= box.client + 1, label + ': no inner horizontal panning');
  }
  measuredStates++;
}

try {
  for (const name of browserNames) {
    const browser = await playwright[name].launch({ headless: true });
    try {
      for (const width of widths) for (const theme of themes) {
        const mobile = width < 600;
        const context = await browser.newContext({ ...(mobile ? playwright.devices[name === 'webkit' ? 'iPhone 13' : 'Pixel 7'] : {}), viewport: { width, height: 844 }, serviceWorkers: 'block' });
        await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const label = `${name}/${width}/${theme}`;
        await page.goto(`${base}cupcake/account?layout=1&long=1&theme=${theme}`);
        await page.getByRole('button', { name: 'Choose meal photo', exact: true }).waitFor();
        await page.getByText('Change portions or meal time', { exact: true }).click();
        const note = page.getByLabel('Portion or meal note (optional)');
        await note.fill('Half the rice');
        assert.ok(Number.parseFloat(await note.evaluate(el => getComputedStyle(el).fontSize)) >= 16, label + ': note does not invite iOS focus zoom');
        await measure(page, width, label + '/focused-note');
        await page.getByRole('checkbox', { name: 'Use photo file time for when I ate' }).uncheck();
        await page.getByRole('button', { name: 'Choose date & time', exact: true }).click();
        for (const select of await page.locator('.cc-meal-time select').all()) assert.ok(Number.parseFloat(await select.evaluate(el => getComputedStyle(el).fontSize)) >= 16, label + ': date select font ' + await select.evaluate(el => getComputedStyle(el).fontSize));
        await measure(page, width, label + '/date-time');
        await page.getByRole('button', { name: 'Ate just now', exact: true }).click();
        const image = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 4096; canvas.height = 2048; canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/png').split(',')[1]; });
        await page.evaluate(() => { window.photoFixture.mode = 'holdUpload'; });
        await page.getByLabel('Choose meal photo file').setInputFiles({ name: 'synthetic-wide.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
        await page.getByAltText('Selected meal photo').waitFor();
        await page.waitForFunction(() => window.photoFixture.requests.some(row => row.route.endsWith('/food/photo/analyze')));
        await measure(page, width, label + '/selected-analysis-pending');
        await page.evaluate(() => window.photoFixture.release());
        await page.getByRole('button', { name: 'Check saved photo', exact: true }).click();
        await page.getByRole('heading', { name: 'Meal saved to your food log', exact: true }).waitFor();
        await measure(page, width, label + '/saved-long-description');
        assert.equal(await page.evaluate(() => window.photoFixture.requests.filter(row => row.route.endsWith('/food/photo/analyze')).length), 1);
        assert.equal(await page.evaluate(() => window.photoFixture.persistedBeforeUpload), true);

        const timeline = page.getByRole('region', { name: 'Recent signals', exact: true });
        assert.equal(await timeline.locator('li').count(), 3);
        assert.ok(await timeline.evaluate(el => el.clientHeight <= 320));
        await page.getByRole('button', { name: 'Show all 300 signals', exact: true }).click();
        assert.equal(await timeline.locator('li').count(), 300);
        assert.equal(await timeline.locator('time').filter({ hasText: /\d/ }).count(), 300);
        assert.ok(await timeline.evaluate(el => el.scrollHeight > el.clientHeight));
        await timeline.focus(); await page.keyboard.press('End');
        await page.getByRole('button', { name: 'Open Synthetic signal 300', exact: true }).click();
        await page.getByRole('status').filter({ hasText: /^Synthetic signal 300$/ }).waitFor();
        await measure(page, width, label + '/all-signals-bounded');
        await page.getByRole('button', { name: 'Show latest 3', exact: true }).click();
        assert.equal(await timeline.locator('li').count(), 3);
        assert.equal(await timeline.evaluate(el => el.scrollTop), 0);
        await page.getByRole('button', { name: 'Show all 300 signals', exact: true }).click();
        await page.getByRole('button', { name: 'Open full history', exact: true }).click();
        await page.getByRole('status').filter({ hasText: /^All signals history$/ }).waitFor();
        await page.getByRole('button', { name: 'Show latest 3', exact: true }).click();
        if (output && name === 'webkit' && width === 390) await page.screenshot({ path: path.join(output, `account-photo-timeline-${theme}.png`), fullPage: true });

        // Safari pointer taps need not focus buttons; explicitly exercise keyboard return focus.
        await page.getByRole('button', { name: 'View saved meal', exact: true }).focus();
        await page.getByRole('button', { name: 'View saved meal', exact: true }).press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Meal details', exact: true });
        await dialog.getByRole('button', { name: /View full photo$/ }).waitFor();
        await dialog.getByText('America/Chicago · In your food log', { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('dialog[open] h2')), true, label + ': safe heading focus');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        await measure(page, width, label + '/saved-meal-dialog');
        await dialog.getByText('Estimate details & sources', { exact: true }).click();
        await measure(page, width, label + '/expanded-estimate');
        await dialog.getByRole('button', { name: /View full photo$/ }).click();
        await page.getByRole('button', { name: 'Close photo viewer', exact: true }).waitFor();
        await measure(page, width, label + '/full-photo');
        await page.getByRole('button', { name: 'Close photo viewer', exact: true }).click();
        await dialog.getByRole('button', { name: 'Close meal details', exact: true }).click();
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        assert.equal(await page.getByRole('button', { name: 'View saved meal', exact: true }).evaluate(el => document.activeElement === el), true, label + ': keyboard opener focus restored');
        await measure(page, width, label + '/closed-focus-restored');
        assert.deepEqual(errors, [], label + ': no uncaught browser errors');
        await context.close();
      }
      // Fewer than three records retain their action and do not offer an empty expansion.
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      for (const count of [0, 1]) {
        await page.goto(`${base}cupcake/account?layout=1&count=${count}`);
        await page.getByRole('region', { name: 'Recent signals', exact: true }).waitFor({ state: 'attached' });
        assert.equal(await page.getByRole('region', { name: 'Recent signals', exact: true }).locator('li').count(), count);
        assert.equal(await page.getByRole('button', { name: /^Show all/ }).count(), 0);
      }
      for (const status of ['logged', 'unlogged', 'stamp-only', 'missing-time', 'legacy']) {
        await page.goto(`${base}cupcake/account?layout=1&status=${status}`);
        const dialog = page.getByRole('dialog', { name: 'Meal details', exact: true });
        const expected = ['logged', 'legacy'].includes(status) ? 'In your food log' : 'Not in calorie totals yet';
        await dialog.getByText('America/Chicago · ' + expected, { exact: true }).waitFor();
        assert.equal(await dialog.getByText('Unknown', { exact: true }).count(), 4, 'Unknown nutrition does not determine logging status');
      }
      await page.close();
    } finally { await browser.close(); }
  }
  console.log(`PASS ${measuredStates} measured account photo/dialog/timeline states at ${widths.join('/')} in ${browserNames.join('/')}, ${themes.join('/')}; empty/single timeline, all 300 actions/times and focus/overflow restoration retained. Local simulated uploads only; native camera and OS keyboard are not simulated.`);
} finally { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
