import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const preview = process.argv.includes('--serve');
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-receipt-bank-'));
const server = await createServer({ cacheDir, define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"' },
  plugins: [{name:'synthetic-bank-workspace', configureServer(s){s.middlewares.use((req,_res,next)=>{
    if(req.url?.split('?')[0]==='/cupcake/account')req.url='/tests/account-receipt-navigation-preview.html';
    next();
  });}}], server: {host:'127.0.0.1',port:preview?5302:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}} });
await server.listen();
const base='http://127.0.0.1:'+server.httpServer.address().port;
const url=tab=>base+'/cupcake/account?tab='+tab+'&view=receipts';
if(preview) { console.log('Synthetic receipt workspace: '+url('library')); } else {
  const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  const browser=await chromium.launch();
  try {
    for(const [tab,width] of [['library',390],['snap',1366]]) {
      const page=await browser.newPage({viewport:{width,height:845},serviceWorkers:'block'});page.setDefaultTimeout(9000);
      const failures=[]; page.on('pageerror',e=>failures.push(e.message)); const external=[];
      await page.route('**/*', r=>{const u=new URL(r.request().url());if(u.origin===base||u.protocol==='data:'||u.protocol==='blob:')return r.continue();external.push(u.href);return r.abort();});
      await page.goto(url(tab)); const workspace=page.locator('.cc-receipts:visible');
      const query=()=>new URL(page.url()).searchParams;
      const bank=workspace.getByRole('button',{name:'Bank purchases',exact:true});
      await bank.click();
      const rows=workspace.locator('.cc-bank-purchase-row').filter({hasText:'Marina Market'}); await rows.first().waitFor(); assert.equal(await rows.count(),2);
      await rows.nth(1).click(); await workspace.getByRole('heading',{name:'Bank purchase',exact:true}).waitFor();
      assert.equal(query().get('transaction'),'synthetic-b-1042');assert.equal(query().get('tab'),tab);
      await workspace.getByRole('link',{name:/Marina Market/}).click();
      await workspace.getByText('Compare this receipt with the selected bank purchase before confirming.',{exact:true}).waitFor();
      assert.equal(await workspace.getByRole('radio').count(),1);
      assert.equal(await workspace.getByRole('radio').isChecked(),true);
      assert.deepEqual(await page.evaluate(()=>window.receiptNavFixture.confirms),[]);
      const comparison=page.url(); await page.reload();
      await workspace.getByText('Compare this receipt with the selected bank purchase before confirming.',{exact:true}).waitFor();
      assert.equal(page.url(),comparison);
      await workspace.getByRole('button',{name:'Refresh matches'}).click();
      await workspace.getByText('Compare this receipt with the selected bank purchase before confirming.',{exact:true}).waitFor();
      assert.equal(await workspace.getByRole('radio').count(),1);
      await workspace.getByRole('button',{name:'Confirm selected match',exact:true}).click();
      await workspace.getByRole('link',{name:'Open matched bank purchase',exact:true}).waitFor();
      assert.deepEqual(await page.evaluate(()=>window.receiptNavFixture.confirms),['synthetic-b-1042']);
      await workspace.getByRole('link',{name:'Open matched bank purchase',exact:true}).click();
      await workspace.getByRole('link',{name:'Open matched receipt',exact:true}).click();
      assert.equal(query().get('transaction'),'synthetic-b-1042'); assert.equal(query().get('tab'),tab);
      await page.goBack(); await workspace.getByRole('link',{name:'Open matched receipt',exact:true}).waitFor();
      await page.goto(url(tab)+'&transaction=synthetic-a-1041');
      await workspace.getByText('No matching saved receipt found for this purchase.',{exact:true}).waitFor();
      assert.equal(await workspace.getByRole('link',{name:'Open matched receipt',exact:true}).count(),0);
      await workspace.getByRole('button',{name:'Back',exact:true}).click();
      await workspace.getByRole('heading',{name:'Saved bank purchases',exact:true}).waitFor();
      await workspace.getByRole('link',{name:/Harbor Bakery/}).click();
      await workspace.getByRole('link',{name:'Open matched receipt',exact:true}).click();
      await workspace.getByText('Automatically matched to a bank purchase.',{exact:true}).waitFor();
      await page.goto(comparison);
      await workspace.getByRole('button',{name:'Change match'}).click();
      await workspace.getByRole('button',{name:'Cancel',exact:true}).click();
      await workspace.getByRole('link',{name:'Open matched bank purchase'}).waitFor();
      await workspace.getByRole('button',{name:'Change match'}).click();
      await workspace.getByRole('button',{name:'Unlink purchase',exact:true}).click();
      await workspace.getByText('Bank link removed. You can choose another purchase.').waitFor();
      assert.equal(query().get('transaction'),null);
      await workspace.getByRole('button',{name:'Find transaction matches'}).click();
      await workspace.getByRole('radio').first().waitFor();
      assert.equal(await workspace.getByRole('radio').count(),2);
      await page.goto(url(tab)+'&transaction=synthetic-b-1042');
      await workspace.getByRole('heading',{name:'Find an existing receipt'}).waitFor();
      assert.equal(await workspace.getByRole('link',{name:'Open matched receipt'}).count(),0);
      await workspace.getByRole('link',{name:/Marina Market/}).click();
      await workspace.getByRole('button',{name:'Confirm selected match'}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      assert.deepEqual(failures,[]);assert.deepEqual(external,[]);await page.close();
    }
    console.log('PASS: mobile Library and desktop Food, similarly priced charges stay distinct across selection, confirmation, saving, refresh and Back; reciprocal links, automatic-match copy, reversible unlink with both records preserved. Synthetic only.');
  } finally {await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
}
