// Local-only normal account shell. The printed receipt is generated on a canvas.
// No camera permission, actual documents, external inference or bank traffic.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
const { chromium, webkit } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ||
  join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(join(tmpdir(),'cupcake-route-test-'));
const server=await createServer({cacheDir,define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},
  optimizeDeps:{include:['lucide-react','tesseract.js','@mediapipe/tasks-vision']},
  plugins:[{name:'synthetic-account',configureServer(s){s.middlewares.use((req,res,next)=>{
    if(req.url?.split('?')[0]==='/cupcake/account')req.url='/tests/account-browser-preview.html';
    next();
  });}}],server:{host:'127.0.0.1',port:0,hmr:false}});
await server.listen();
const origin='http://127.0.0.1:'+server.httpServer.address().port;
try {
  for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]) {
    if(process.env.CAPTURE_ENGINE && process.env.CAPTURE_ENGINE!==name) continue;
    const browser=await engine.launch();
    try {
      const page=await browser.newPage({viewport:{width:390,height:844}}), external=[], errors=[];
      const diagnostics = [];
      page.on('requestfailed',r=>diagnostics.push([new URL(r.url()).pathname,r.failure()?.errorText]));
      page.on('console',m=>{if(m.type()==='error')diagnostics.push(m.text().slice(0,130));});
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if((u.protocol==='http:'||u.protocol==='https:')&&u.origin!==origin){external.push(u.hostname);return route.abort();}
        return route.continue();
      });
      await page.addInitScript(()=>{
        sessionStorage.setItem('synthetic-legacy-seeded','1'); // This fixture exercises camera routing, not the legacy audio migration.
        if (!localStorage.getItem('synthetic-account-server')) localStorage.setItem('synthetic-account-server','acc_synthetic_a');
      });
      await page.goto(origin+'/cupcake/account?tab=feed&rich=1');
      const center=page.locator('nav button[data-nav="snap"]');
      await center.waitFor({timeout:35000}).catch(async error=>{
        diagnostics.push(await page.evaluate(()=>({requests:performance.getEntriesByType('resource').length,
          last:performance.getEntriesByType('resource').slice(-5).map(r=>r.name.split('/').pop()),
          boot:typeof window.accountFixture,html:document.scripts.length})));
        throw Error(name+' account screen: '+(await page.locator('body').innerText()).slice(0,260)+'; JS: '+errors.join(' | ')+'; '+JSON.stringify(diagnostics.slice(-5))+'; '+error);
      });
      await page.evaluate(()=>{
        const base=window.fetch.bind(window); window.capturePosts=[];
        window.fetch=async(input,init)=>{
          const url=new URL(input instanceof Request?input.url:input,location.href);
          if(url.origin!=='https://automate.hales.ai')return base(input,init);
          const body=JSON.parse(init?.body||'{}');
          if(['/api/account/receipts/photo','/api/account/food/photo/analyze'].includes(url.pathname)){
            window.capturePosts.push({path:url.pathname,id:body.request_id});
            // A stopped upload leaves the actual scoped draft available to retry.
            return Response.json({ok:false,error:'synthetic_upload_unavailable'},{status:503});
          }
          return base(input,init);
        };
      });
      const source=await page.evaluate(()=>{
        const c=document.createElement('canvas'); c.width=800;c.height=900;
        const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,900);
        ctx.fillStyle='#161616';ctx.font='bold 44px monospace';
        ['FARM MARKET','SALES RECEIPT','APPLES       12.00','SUBTOTAL     12.00','TAX           0.84','TOTAL        12.84','CASH         20.00','CHANGE DUE    7.16'].forEach((line,i)=>ctx.fillText(line,60,100+i*88));
        return c.toDataURL('image/png').split(',')[1];
      });
      const file={name:'capture.png',mimeType:'image/png',buffer:Buffer.from(source,'base64')};
      const choose=async()=>{const camera=page.getByRole('dialog',{name:/^(Camera|Receipt camera|Meal camera)$/});
        await camera.locator('input[type=file]:not([capture])').setInputFiles(file);};
      await center.click(); await choose();
      const preview=page.getByRole('dialog',{name:'Review capture'}), receipt=preview.getByRole('radio',{name:'Receipt',exact:true});
      await preview.waitFor();
      await page.waitForFunction(()=>document.querySelector('dialog[aria-label="Review capture"] [role="status"]')?.textContent?.includes('Send to your receipt reader'),null,{timeout:80000});
      assert.equal(await receipt.isChecked(),true,'automatic local OCR suggests Receipt');
      assert.deepEqual(await page.evaluate(()=>window.capturePosts),[]);
      await preview.getByRole('radio',{name:'Other',exact:true}).check();
      await preview.getByRole('button',{name:'Keep on this device'}).click();
      const shelf=page.locator('summary').filter({hasText:'Photos on this device (1)'});
      await shelf.waitFor(); assert.deepEqual(await page.evaluate(()=>window.capturePosts),[]);
      await page.evaluate(()=>localStorage.setItem('synthetic-account-server','acc_synthetic_b'));
      await page.reload(); await page.getByRole('tab',{name:'Food log'}).waitFor();
      assert.equal(await page.getByText(/Photos on this device \(1\)/).count(),0,'another account cannot see the original');
      await page.evaluate(()=>localStorage.setItem('synthetic-account-server','acc_synthetic_a'));
      await page.reload(); await shelf.click();
      await page.getByRole('button',{name:'Read as receipt',exact:true}).click();
      await page.waitForFunction(()=>window.accountFixture?.requests?.some?.(r=>r.route==='receipts/photo') || document.body.innerText.includes('Retry this photo'));
      assert.equal(await page.getByRole('tab',{name:'Receipts',exact:true}).getAttribute('aria-selected'),'true');
      await page.getByRole('button',{name:'Take receipt photo'}).click(); await choose();
      assert.equal(await receipt.isChecked(),true,'receipt shortcut starts preselected');
      await preview.getByRole('radio',{name:'Meal',exact:true}).check();
      await preview.getByRole('button',{name:'Log meal',exact:true}).click();
      await page.waitForFunction(()=>window.accountFixture?.requests?.some?.(r=>r.route==='food/photo/analyze') || document.body.innerText.includes('Check saved photo'));
      const reported=await page.evaluate(()=>window.accountFixture?.requests?.map(r=>r.route)||[]);
      assert.ok(reported.some(x=>x==='receipts/photo')); assert.ok(reported.some(x=>x==='food/photo/analyze'));
      const guesses = await page.evaluate(async()=>{
        const {classifyCapture,receiptText}=await import('/src/components/cupcake/camera/classifyCapture.ts');
        const canvas=document.createElement('canvas'); canvas.width=canvas.height=384;
        const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,384,384);
        const classify=async()=>classifyCapture(new File([await new Promise(resolve=>canvas.toBlob(resolve))],'fixture.png',{type:'image/png'}),new AbortController().signal);
        const blank=await classify();
        ctx.font='310px Apple Color Emoji';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🍌',192,192);
        return {food:await classify(),blank,ticket:receiptText('POWERBALL LOTTERY TICKET SUBTOTAL 2.00 TAX 0.00 TOTAL 2.00')};
      });
      assert.equal(guesses.blank,'other');assert.equal(guesses.ticket,false);assert.equal(guesses.food,'meal');
      assert.deepEqual(external,[]); assert.deepEqual(errors,[]);
      console.log(name+' passed local receipt OCR, meal recognition, unknown scene, account-isolated recovery, and cross-category routing');
    } finally {await browser.close();}
  }
} finally {await server.close();rmSync(cacheDir,{recursive:true,force:true});}
