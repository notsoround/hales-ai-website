// Labs camera-autofile: the Food button camera files a confident guess itself after a countdown.
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
const cacheDir=mkdtempSync(join(tmpdir(),'cupcake-autofile-test-'));
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
      const images=await page.evaluate(()=>{
        const c=document.createElement('canvas'); c.width=800;c.height=900;
        const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,900);
        ctx.fillStyle='#161616';ctx.font='bold 44px monospace';
        ['FARM MARKET','SALES RECEIPT','APPLES       12.00','SUBTOTAL     12.00','TAX           0.84','TOTAL        12.84','CASH         20.00','CHANGE DUE    7.16'].forEach((line,i)=>ctx.fillText(line,60,100+i*88));
        const receipt=c.toDataURL('image/png').split(',')[1];
        ctx.fillStyle='#777';ctx.fillRect(0,0,800,900);
        return {receipt,blank:c.toDataURL('image/png').split(',')[1]};
      });
      const asFile=data=>({name:'capture.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
      const routes=()=>page.evaluate(()=>window.accountFixture?.requests?.map(r=>r.route)||[]);
      const choose=async data=>{await center.click();const camera=page.getByRole('dialog',{name:'Camera'});
        await camera.locator('input[type=file]:not([capture])').setInputFiles(asFile(data));};
      const preview=page.getByRole('dialog',{name:'Review capture'});
      await page.evaluate(()=>import('/src/components/cupcake/labsFlags.ts').then(m=>m.writeLab('camera-autofile',true)));
      // 1. A receipt is recognised, announced, and filed in Receipts with no tap.
      await choose(images.receipt);
      await preview.getByText('This looks like a receipt.').waitFor({timeout:80000});
      await preview.getByText(/Saving to Receipts in [1-3]…/).waitFor();
      await page.waitForFunction(()=>window.accountFixture?.requests?.some?.(r=>r.route==='receipts/photo')||document.body.innerText.includes('Retry this photo'),null,{timeout:15000});
      assert.equal(await preview.count(),0,'the review closes after filing');
      assert.equal(await page.getByRole('tab',{name:'Receipts',exact:true}).getAttribute('aria-selected'),'true');
      assert.ok(!(await routes()).includes('food/photo/analyze'),'nothing went to the meal estimator');
      // 2. One tap on a correction files it elsewhere instead, before the countdown ends.
      await choose(images.receipt);
      await preview.getByText('This looks like a receipt.').waitFor({timeout:80000});
      await preview.getByRole('button',{name:'It’s a meal'}).click();
      await page.waitForFunction(()=>window.accountFixture?.requests?.some?.(r=>r.route==='food/photo/analyze')||document.body.innerText.includes('Check saved photo'),null,{timeout:15000});
      // 3. "Let me choose" stops the countdown and shows the usual chooser.
      const before=(await routes()).filter(r=>r==='receipts/photo').length;
      await choose(images.receipt);
      await preview.getByText('This looks like a receipt.').waitFor({timeout:80000});
      await preview.getByRole('button',{name:'Let me choose'}).click();
      await page.waitForTimeout(4200);
      assert.equal(await preview.getByRole('radio',{name:'Receipt',exact:true}).isChecked(),true);
      assert.equal((await routes()).filter(r=>r==='receipts/photo').length,before,'nothing filed while choosing');
      await preview.getByRole('button',{name:'Retake'}).click();
      await page.keyboard.press('Escape');
      // 4. When it cannot tell, it asks as before and files nothing.
      await choose(images.blank);
      await preview.getByText(/Couldn’t tell what this is/).waitFor({timeout:80000});
      assert.equal(await preview.getByRole('radio',{name:'Other',exact:true}).isChecked(),true);
      await page.waitForTimeout(3500);
      assert.equal(await preview.count(),1,'an unsure photo is never filed by itself');
      assert.deepEqual(external,[]); assert.deepEqual(errors,[]);
      console.log(name+' passed camera auto-file: receipt filed, one-tap correction, manual choice, unsure asks');
    } finally {await browser.close();}
  }
} finally {await server.close();rmSync(cacheDir,{recursive:true,force:true});}
