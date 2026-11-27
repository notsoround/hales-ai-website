// Exercise both missed-call entry points with a local, synthetic account.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-call-entry-'));
const server = await createServer({
  cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  plugins: [{ name: 'synthetic-call-history', configureServer(s) {
    s.middlewares.use((req, _res, next) => {
      if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html';
      next();
    });
  } }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(10000);
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('synthetic-account-server','acc_synthetic_a');
    window.fixtureCallReads = [];
    window.syntheticReceiptNavigation = (_owner, body) => {
      window.fixtureCallReads.push([body.action, body.sourceFilter]);
      if (body.action === 'notifications_summary') return {
        missedCalls7d:9, unreadCount:9,
        items:[{id:'old-missed',kind:'missed_calls',title:'Missed 9 calls',detail:'Catch up by voice',targetTab:'talk',count:9}],
      };
      if (body.action === 'list' && body.sourceFilter?.endsWith('phone-calls')) return {
        documents:[], browseTotal:0, nextCursor:null,
      };
    };
  });
  await page.goto(base + '/cupcake/account?tab=feed');
  const entry = page.getByRole('link',{ name:'Missed calls · Read or listen →' });
  const verifyArchive = async () => {
    await page.getByRole('tab',{name:'Phone calls',exact:true}).waitFor();
    await page.getByRole('button',{name:'Missed calls', pressed:true, exact:true}).waitFor();
    await page.getByText('No confirmed missed calls have a saved recap or transcript here.').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('view'),'calls');
    assert.equal(new URL(page.url()).searchParams.get('callFilter'),'missed');
  };
  await entry.click();
  await verifyArchive();
  await page.getByRole('button',{name:'All calls',exact:true}).click();
  await page.getByText('No saved phone calls in your account.').waitFor();
  await page.goBack(); await verifyArchive();
  await page.goBack(); await entry.waitFor();
  await page.locator('.nx-notif-btn').click();
  await page.getByRole('button',{name:/Missed call recaps/}).click();
  await verifyArchive();
  const reads = await page.evaluate(()=>window.fixtureCallReads);
  assert.ok(reads.some(([a, f])=>a==='list' && f==='missed-phone-calls'));
  assert.ok(reads.every(([a])=>!['voice_start','voice_session_start','voice_extract_updates','ask','outcome_record'].includes(a)));
  console.log('Passed Today and bell → confirmed missed-call archive, filter and browser Back, without starting a call.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive:true, force:true });
}
