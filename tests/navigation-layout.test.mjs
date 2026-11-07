// Real roots and styles; reuse the existing synthetic API/media fixtures only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir, tmpdir} from 'node:os';
import {mkdtempSync, realpathSync, rmSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-navigation-'));
const server = await createServer({cacheDir, define: {'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': JSON.stringify('true')},
  plugins: [{name: 'synthetic-navigation-roots', configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const pathname = req.url?.split('?')[0];
      if (pathname === '/cupcake') req.url = '/tests/assistant-integration-preview.html';
      if (pathname === '/cupcake/account') req.url = '/tests/account-browser-preview.html';
      next();
    });
  }}], server: {host: '127.0.0.1', port: 0, hmr: false, fs: {allow: [process.cwd(), realpathSync('node_modules')]}}});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({headless: true});
const start = performance.now();
let geometryChecks = 0, paletteChecks = 0, calendarChecks = 0, searchChecks = 0, weekChecks = 0;
const nav = page => page.getByRole('navigation', {name: 'Cupcake', exact: true});
const button = (page, name) => nav(page).getByRole('button', {name, exact: true});
const settle = page => page.evaluate(async () => {
  await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
const closeTo = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${actual} vs ${expected}`);

async function measure(page, width, count) {
  await page.setViewportSize({width, height: 900});
  await settle(page);
  const layout = await page.evaluate(() => {
    const rect = element => {const r = element.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height};};
    const navigation = document.querySelector('.cc-nav');
    return {inner: innerWidth, scroll: document.documentElement.scrollWidth, nav: rect(navigation),
      buttons: [...navigation.querySelectorAll('button')].map(element => ({...rect(element), scroll: element.scrollWidth, client: element.clientWidth})),
      shell: rect(document.querySelector('.cc-shell')), header: rect(document.querySelector('.cc-top'))};
  });
  assert.equal(layout.inner, width, 'CSS viewport width');
  assert.ok(layout.scroll <= width, `${count} tabs/${width}px: document overflow ${layout.scroll}`);
  assert.equal(layout.buttons.length, count);
  closeTo(layout.nav.left, 0, 'navigation left edge');
  if (width < 1024) {
    closeTo(layout.nav.right, width, 'bottom navigation fills viewport');
    closeTo(layout.nav.bottom, 900, 'bottom navigation hugs viewport');
    for (const [index, item] of layout.buttons.entries()) {
      closeTo(item.width, width / count, `tab ${index} equal allocation`);
      closeTo(item.left, index * width / count, `tab ${index} left edge`);
      closeTo(item.bottom, layout.nav.bottom, `tab ${index} bottom edge`);
      assert.ok(item.height >= 44 && item.scroll <= item.client, 'touch target and label fit');
    }
  } else {
    closeTo(layout.nav.width, 220, 'desktop sidebar width');
    closeTo(layout.nav.top, 0, 'sidebar top edge');
    closeTo(layout.nav.bottom, 900, 'sidebar bottom edge');
    closeTo(layout.header.left, layout.shell.left, 'desktop header and content align');
    assert.ok(layout.shell.left >= layout.nav.right && layout.shell.right <= width, 'content fits beside sidebar');
    for (const [index, item] of layout.buttons.entries()) {
      assert.ok(item.left >= layout.nav.left && item.right <= layout.nav.right, 'button stays in sidebar');
      closeTo(item.left, layout.buttons[0].left, 'sidebar button alignment');
      if (index) assert.ok(item.top >= layout.buttons[index - 1].bottom, 'sidebar stacks buttons vertically');
    }
  }
  geometryChecks++;
}

async function tokens(page) {
  return page.evaluate(() => {
    const app = document.querySelector('.cc-app'), probe = document.createElement('i');
    app.append(probe);
    const resolved = name => {probe.style.color = `var(${name})`; return getComputedStyle(probe).color;};
    const result = {active: resolved('--cc-pink-bright'), inactive: resolved('--cc-text-3'), wash: resolved('--cc-accent-wash')};
    probe.remove(); return result;
  });
}

async function assertPalette(page, expected, current, expanded = false) {
  await page.waitForFunction(({active, inactive, wash}) => [...document.querySelectorAll('.cc-nav button')].every(element => {
    const selected = element.hasAttribute('aria-current') || element.getAttribute('aria-expanded') === 'true';
    const style = getComputedStyle(element);
    return style.color === (selected ? active : inactive) && (!selected || style.backgroundColor === wash);
  }), expected);
  const state = await nav(page).getByRole('button').evaluateAll(elements => elements.map(element => ({
    name: element.textContent.trim(), current: element.getAttribute('aria-current'), expanded: element.getAttribute('aria-expanded'),
    color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor,
  })));
  assert.deepEqual(state.filter(item => item.current).map(item => item.name), [current], 'one underlying current page');
  for (const item of state) {
    const active = item.name === current || (item.name === 'Assistant' && expanded);
    assert.equal(item.color, active ? expected.active : expected.inactive, `${item.name} palette color`);
    if (active) assert.equal(item.background, expected.wash, `${item.name} active wash`);
  }
  assert.equal(state.find(item => item.name === 'Assistant').expanded, String(expanded));
  paletteChecks++;
}

try {
  for (const account of [false, true]) {
    const context = await browser.newContext({viewport: {width: 390, height: 900}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    try {
      const external = [], errors = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === base) return route.continue();
        external.push(route.request().url()); return route.abort();
      });
      // The existing account fixture's empty-grant response keeps Reports local.
      await context.exposeFunction('syntheticCoachServer', async (_owner, route) => {
        assert.equal(route, 'coach/grants/received');
        return {status: 200, value: {ok: true, grants: []}};
      });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + (account ? '/cupcake/account' : '/cupcake'));
      if (account) {
        await page.getByLabel('Email', {exact: true}).fill('b@example.invalid');
        await page.getByLabel('Password', {exact: true}).fill('Synthetic password 123!');
        await page.getByRole('button', {name: 'Sign in', exact: true}).click();
      }
      await button(page, 'Today').waitFor();
      const labels = ['Today', 'Food', 'Library', 'Assistant', ...(account ? ['Reports'] : [])];
      assert.deepEqual(await nav(page).getByRole('button').allTextContents(), labels);
      for (const width of [320, 390, 430, 768, 1023, 1024, 1440]) await measure(page, width, labels.length);

      const paletteByAppearance = new Map();
      for (const width of [390, 1440]) {
        await page.setViewportSize({width, height: 900});
        for (const appearance of ['caribbean', 'rose']) {
          await page.locator('.cc-settings > summary').click();
          await page.getByRole('combobox', {name: 'Assistant appearance'}).selectOption(appearance);
          await page.getByRole('button', {name: 'Close settings', exact: true}).click();
          assert.equal(await page.locator('.cc-app').getAttribute('data-appearance'), appearance);
          const expected = await tokens(page);
          assert.notEqual(expected.active, expected.inactive, 'selection remains distinguishable');
          if (paletteByAppearance.has(appearance)) assert.deepEqual(expected, paletteByAppearance.get(appearance), 'appearance tokens stay stable across phone and desktop');
          else paletteByAppearance.set(appearance, expected);
          if (appearance === 'rose') assert.notDeepEqual(expected, paletteByAppearance.get('caribbean'), 'appearance changes the palette');
          for (const label of labels.filter(label => label !== 'Assistant')) {
            await button(page, label).click();
            await assertPalette(page, expected, label);
            if (label === 'Library' && width === 1440) {
              const search = await page.locator('.cc-library-search .cc-secondary').evaluate(element => {
                const lines = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()).flatMap(node => {
                  const range = document.createRange(); range.selectNodeContents(node);
                  return [...range.getClientRects()].map(rect => rect.top);
                });
                return {text: element.textContent.trim(), lines: new Set(lines).size, scroll: element.scrollWidth, client: element.clientWidth};
              });
              assert.equal(search.text, 'Search'); assert.equal(search.lines, 1, 'Library Search text stays on one line');
              assert.ok(search.scroll <= search.client, 'Library Search label fits its button'); searchChecks++;
            }
            if (label === 'Food') {
              const scale = page.getByRole('group', {name: 'Calendar scale'});
              await scale.getByRole('button', {name: 'Month', exact: true}).click();
              assert.equal(await scale.getByRole('button', {name: 'Month', exact: true}).getAttribute('aria-pressed'), 'true');
              const colors = await scale.getByRole('button').evaluateAll(elements => elements.map(element => ({
                selected: element.getAttribute('aria-pressed') === 'true', color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor,
              })));
              for (const color of colors) assert.equal(color.color, color.selected ? expected.active : expected.inactive, 'calendar scale follows appearance tokens');
              assert.equal(colors.find(color => color.selected).background, expected.wash);
              calendarChecks++;
            }
            const assistant = button(page, 'Assistant');
            assert.equal(await assistant.getAttribute('aria-controls'), 'cupcake-assistant');
            await assistant.click();
            await page.locator('#cupcake-assistant.is-panel').waitFor();
            // Existing account boundary returns to personal Today from Reports.
            const underlying = label === 'Reports' ? 'Today' : label;
            await assertPalette(page, expected, underlying, true);
            // Phone panel covers the nav; Enter also verifies its native keyboard toggle.
            await assistant.press('Enter');
            await assertPalette(page, expected, underlying);
            assert.equal(await page.locator('#cupcake-assistant.is-panel').isVisible(), false);
          }
        }
      }
      await button(page, 'Today').click();
      await page.getByRole('button', {name: 'All signals', exact: true}).click();
      assert.equal(new URL(page.url()).searchParams.get('tab'), 'week');
      await assertPalette(page, paletteByAppearance.get('rose'), 'Today'); weekChecks++;
      await button(page, 'Today').focus();
      await page.keyboard.press('Tab');
      const focus = await button(page, 'Food').evaluate(element => ({focused: element === document.activeElement, visible: element.matches(':focus-visible'), width: getComputedStyle(element).outlineWidth, offset: getComputedStyle(element).outlineOffset}));
      assert.deepEqual(focus, {focused: true, visible: true, width: '3px', offset: '-4px'});
      assert.deepEqual(errors, [], 'no browser errors');
      assert.deepEqual(external, [], 'all external networking is blocked and none attempted');
      const fixture = await page.evaluate(() => window.accountFixture ? {unknown: window.accountFixture.blocked, mic: window.accountFixture.micRequests, keyReads: window.accountFixture.legacyReads} : {unknown: window.assistantFixture.unknown, mic: window.assistantFixture.micRequests, keyReads: 0});
      assert.deepEqual(fixture, {unknown: [], mic: 0, keyReads: 0}, 'fixtures covered every call without real credentials or media');
    } finally {await context.close();}
  }
  console.log(`PASS: ${geometryChecks} responsive navigation layouts, ${paletteChecks} tab/assistant palette states, ${calendarChecks} Food calendar states, ${searchChecks} desktop Search labels, ${weekChecks} nested Today selections; keyboard focus; all data simulated, zero external requests (${((performance.now() - start) / 1000).toFixed(1)}s).`);
} finally {await browser.close(); await server.close(); rmSync(cacheDir, {recursive: true, force: true});}
