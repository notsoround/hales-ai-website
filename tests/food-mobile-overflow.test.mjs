// Real components, synthetic local responses only. No food or health data is sent.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const server = await createServer({ server: { host: '127.0.0.1', port: 0, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0];
const failures = [], checks = [];
const soft = process.env.FOOD_OVERFLOW_BASELINE === '1';
const image = { name: 'synthetic-wide.png', mimeType: 'image/png', buffer: null };
// A wide, camera-size original exercises image constraints, rather than a 1px placeholder.
async function check(page, label, width) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const result = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    inner: innerWidth,
    scale: visualViewport?.scale || 1,
    policy: document.querySelector('meta[name="viewport"]')?.content,
    dialogs: [...document.querySelectorAll('dialog[open], .cc-photo-viewer')].map(el => ({
      width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right,
      scroll: el.scrollWidth, client: el.clientWidth,
    })),
  }));
  checks.push({ label, width, ...result });
  try {
    assert.equal(result.viewport, width, `${label}: viewport remains phone-sized`);
    assert.ok(result.scroll <= width, `${label}: document scrollWidth ${result.scroll} > ${width}`);
    assert.ok(result.inner <= width, `${label}: layout viewport expanded to ${result.inner}`);
    assert.ok(result.scale <= 1.01, `${label}: unexpected focus zoom ${result.scale}`);
    assert.doesNotMatch(result.policy, /maximum-scale|user-scalable\s*=\s*(?:no|0)/, 'user-controlled zoom remains available');
    for (const d of result.dialogs) {
      assert.ok(d.left >= -1 && d.right <= width + 1, `${label}: dialog outside viewport`);
      assert.ok(d.scroll <= d.client + 1, `${label}: dialog scrollWidth ${d.scroll} > clientWidth ${d.client}`);
    }
  } catch (error) { if (!soft) throw error; failures.push(error.message); console.log(JSON.stringify({ failure: error.message, result })); }
}

try {
  for (const name of (process.env.FOOD_BROWSER ? [process.env.FOOD_BROWSER] : ['chromium', 'webkit'])) {
    const browser = await playwright[name].launch({ headless: true });
    try {
      for (const width of [320, 375, 390, 430]) {
        const device = playwright.devices[name === 'webkit' ? 'iPhone 13' : 'Pixel 7'];
        const context = await browser.newContext({ ...device, viewport: { width, height: 844 }, serviceWorkers: 'block' });
        const errors = [];
        await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        if (!image.buffer) image.buffer = Buffer.from(await page.evaluate(() => {
          const canvas = document.createElement('canvas'); canvas.width = 4096; canvas.height = 2048;
          canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png').split(',')[1];
        }), 'base64');
        const measure = state => check(page, `${name}/${state}`, width);
        const visit = query => page.goto(`${base}tests/food-mobile-preview.html?long=1&${query}`);
        const capture = async () => {
          await page.locator('summary').filter({ hasText: 'Log a food photo' }).click();
          await measure('capture-open');
          await page.locator('input[type=file][capture]').setInputFiles(image);
        };
        await visit('defer=1');
        await measure('queue'); await capture();
        await page.getByText('Estimating and saving your meal… You can close this window while it finishes.').waitFor();
        await measure('analyzing');
        await page.evaluate(() => window.dispatchEvent(new Event('cupcake-fixture-release')));
        await page.getByText('Estimated nutrition for the portions below.').waitFor();
        await measure('automatic-result');
        await page.getByRole('button', { name: 'Browse saved meal & photo' }).click();
        await page.getByRole('button', { name: 'View full photo' }).waitFor();
        await measure('saved-details');
        await page.getByText('Estimate details & sources', { exact: true }).click();
        await measure('sources-expanded');
        await page.getByRole('button', { name: 'View full photo' }).click();
        await measure('full-photo');
        if (soft) await page.getByRole('button', { name: 'Close photo viewer' }).evaluate(el => el.click());
        else await page.getByRole('button', { name: 'Close photo viewer' }).click();
        await page.getByRole('button', { name: 'Close meal details' }).click();
        await measure('closed');

        await visit('');
        await page.locator('summary').filter({ hasText: 'Log a food photo' }).click();
        await page.getByRole('checkbox', { name: 'Review before logging' }).check();
        await page.locator('input[type=file][capture]').setInputFiles(image);
        await page.getByLabel('Portion corrections').waitFor(); await measure('review');
        await page.getByLabel('Portion corrections').fill('Half the rice'); await measure('focused-correction');
        assert.ok(Number.parseFloat(await page.getByLabel('Portion corrections').evaluate(el => getComputedStyle(el).fontSize)) >= 16);
        await page.getByRole('button', { name: 'Apply correction & re-estimate' }).click();
        await page.getByRole('dialog', { name: 'Meal details', exact: true }).getByText('Synthetic corrected rice bowl and unsweetened tea', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Choose date & time' }).click(); await measure('date-time');
        await page.getByRole('button', { name: 'Close meal details' }).click(); await measure('pending-closed');

        await visit('scenario=network-error'); await capture();
        await page.getByRole('alert').filter({ hasText: 'Synthetic food analysis connection failure.' }).waitFor(); await measure('network-error');
        await page.getByRole('button', { name: 'Close meal details' }).click();
        await page.getByRole('button', { name: 'Retry food analysis' }).click();
        await page.getByText('Estimated nutrition for the portions below.').waitFor(); await measure('retry-result');

        await visit('scenario=analysis-failed'); await capture();
        await page.getByRole('button', { name: 'Retry analysis', exact: true }).waitFor(); await measure('analysis-failed');
        await page.getByRole('button', { name: 'Retry analysis', exact: true }).click();
        await page.getByRole('button', { name: 'Browse saved meal & photo' }).waitFor(); await measure('analysis-retried');
        assert.deepEqual(errors, [], `${name}/${width}: no uncaught browser errors`);
        if (width === 320) {
          // The real app applies the same policy even on its locked screen, and
          // leaving Cupcake restores the public site's original viewport.
          await page.goto(`${base}cupcake?tab=snap`);
          await page.getByRole('button', { name: 'Open Cupcake', exact: true }).waitFor();
          assert.doesNotMatch(await page.locator('meta[name="viewport"]').getAttribute('content'), /maximum-scale|user-scalable\s*=\s*(?:no|0)/);
          await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
          await page.waitForFunction(() => document.querySelector('meta[name="viewport"]')?.content === 'width=device-width, initial-scale=1.0');
        }
        await context.close();
      }
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify({ checks: checks.length, failures }));
  if (!soft) console.log('PASS selected browser matrix at 320/375/390/430px. Synthetic data; native camera and OS keyboard are not simulated.');
} finally { await server.close(); }
