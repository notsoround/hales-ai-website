// Actual account gate/components, isolated fictional responses; no device/provider uploads.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-native-ios-web-'));
const server=await createServer({cacheDir,plugins:[{name:'fictional-ios',configureServer(s){s.middlewares.use((req,_res,next)=>{if(req.url?.split('?')[0]==='/cupcake/account')req.url='/tests/native-health-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const profile={client_id:'cupcake-ios-health-preview-v1',redirect_uri:'ai.hales.cupcake.health.preview.ios:/oauth/callback',installation_id:'00000000-0000-4000-8000-000000000123',state:'S'.repeat(43),code_challenge:'H'.repeat(43),code_challenge_method:'S256'};
const health={...profile,redirect_uri:'ai.hales.cupcake.health.preview.ios:/health/callback',epoch:'1',types:'sleep,heart_rate,steps'};
const link=(kind,request)=>base+'/cupcake/account?ios=1&'+kind+'=1#'+new URLSearchParams(request);
let checks=0;
async function open(browser,url=base+'/cupcake/account?ios=1') {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await context.addInitScript(()=>sessionStorage.setItem('synthetic-native-signed-in','1'));
  const page=await context.newPage();page.setDefaultTimeout(9000);await page.goto(url);return {context,page};
}
try { for(const engine of ['chromium','webkit']) {
  const browser=await pw[engine].launch({headless:true});try {
    const a=await open(browser,link('native_connect',profile)),p=a.page;
    await p.getByRole('heading',{name:'Connect your iPhone app',exact:true}).waitFor();
    assert.equal(await p.evaluate(()=>window.nativeFixture.requests.some(r=>r.route==='native/authorize')),false);
    await p.getByRole('button',{name:'Connect iPhone app',exact:true}).click();
    const callback=p.getByRole('link',{name:'Return to iPhone app',exact:true});await callback.waitFor();
    assert.equal(new URL(await callback.getAttribute('href')).protocol,'ai.hales.cupcake.health.preview.ios:');
    assert.equal(await p.evaluate(()=>window.nativeFixture.requests.some(r=>r.route.startsWith('native/health/'))),false);
    await a.context.close();checks++;

    const h=await open(browser,link('native_health_connect',health)),q=h.page;
    await q.getByRole('heading',{name:'Allow health uploads',exact:true}).waitFor();
    for(const box of await q.getByRole('checkbox').all())assert.equal(await box.isChecked(),false);
    await q.getByText(/empty HealthKit result does not establish/).waitFor();
    await q.getByLabel('Sleep sessions',{exact:true}).check();await q.getByLabel('Step records',{exact:true}).check();
    await q.getByRole('button',{name:'Allow selected health uploads',exact:true}).click();
    const target=q.getByRole('link',{name:'Return to iPhone app',exact:true});await target.waitFor();
    assert.equal(new URL(await target.getAttribute('href')).pathname,'/health/callback');
    const sent=await q.evaluate(()=>window.nativeFixture.requests.find(r=>r.route==='native/health/authorize'));
    assert.deepEqual(sent.body,{...health,epoch:1,types:['sleep','steps']});
    assert.equal(sent.headers['x-cupcake-account-context'],'acc_native_test_a');assert.equal(sent.headers['x-cupcake-key'],undefined);
    const stored=await q.evaluate(()=>JSON.stringify({...sessionStorage,...localStorage}));
    for(const secret of ['nhc_','nhw_','code_verifier','native-batch','native-receipt'])assert.equal(stored.includes(secret),false);
    await h.context.close();checks++;

    for(const [kind,request] of [['native_connect',{...profile,redirect_uri:'ai.hales.cupcake.health.preview:/oauth/callback'}],['native_health_connect',{...health,redirect_uri:'ai.hales.cupcake.health.preview:/health/callback'}],['native_health_connect',{...health,client_id:'unregistered'}]]) {
      const item=await open(browser,link(kind,request));await item.page.getByRole('alert').filter({hasText:'invalid or expired'}).waitFor();
      assert.equal(await item.page.evaluate(()=>window.nativeFixture.requests.some(r=>/native\/(health\/)?authorize/.test(r.route))),false);await item.context.close();checks++;
    }
    const m=await open(browser,base+'/cupcake/account?ios=1&partial=1'),r=m.page;
    const detail=r.getByRole('region',{name:'Saved iPhone health sync',exact:true});
    await detail.getByText('HealthKit sleep categories; not verified measured sleep',{exact:true}).waitFor();
    await detail.getByText('0 source records · No readable data; access or absence is unknown',{exact:true}).waitFor();
    await detail.getByText('1 source record · Incomplete read',{exact:true}).waitFor();
    await detail.getByText(/“Not user entered” does not establish automatic tracking/).waitFor();
    await detail.getByRole('button',{name:'Load saved original batch',exact:true}).click();
    await detail.getByText('Saved original batch (JSON)',{exact:true}).click();
    const raw=await detail.getByLabel('Saved original health batch JSON').innerText();assert.match(raw,/test.synthetic.watch/);assert.match(raw,/12:00:00.123456789Z/);assert.doesNotMatch(raw,/sourcePackage/);
    for(const width of [320,390,1280]){await r.setViewportSize({width,height:844});assert.equal(await r.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
    await r.getByText('Mobile app connections',{exact:true}).click();await r.getByRole('button',{name:'Load connected apps',exact:true}).click();
    await r.getByText('Cupcake iPhone preview',{exact:true}).waitFor();await r.getByText('Health uploads',{exact:true}).click();
    await r.getByRole('button',{name:'Load upload permissions',exact:true}).click();await r.getByText('iPhone app 00000123 · health connection 00000456',{exact:true}).waitFor();
    await r.getByRole('button',{name:'Disconnect iPhone app 00000123',exact:true}).click();await r.getByRole('status').filter({hasText:'This app connection is disconnected'}).waitFor();
    await m.context.close();checks++;

    const v=await open(browser);const guards=await v.page.evaluate(async ({profile,health})=>{
      const p=await import('/src/components/cupcake/nativeConnectionRequest.ts'),h=await import('/src/components/cupcake/nativeHealthConnectionRequest.ts');
      const d=await import('/src/components/cupcake/NativeHealthSyncDetail.tsx');
      const req={...health,epoch:1,types:['sleep']};
      const result={ok:true,redirect_uri:req.redirect_uri,state:req.state,expires_in:120,code:'nhc_'+'C'.repeat(43),identity:{account_id:'owner'}};
      const rejected=fn=>{try{fn();return false;}catch{return true;}};
      const receipt={ok:true,format:'cupcake.health.native-receipt.v1',request_id:profile.installation_id,connection_id:profile.installation_id,connection_epoch:1,installation_id:profile.installation_id,epoch:1,body_sha256:'a'.repeat(64),received_at:'2026-11-08T13:00:00Z',observed_at:null,types:[{type:'sleep',status:'no_readable_data',record_count:0}],record_count:0,upserted:0,deleted:0,coverage:'requested_window_only',source:'ios_healthkit',estimated_sleep:null};
      return [p.validNativeConnection(profile),h.validNativeHealthConnection(req),
        !h.validNativeHealthConnection({...req,client_id:'unknown',redirect_uri:undefined}),
        rejected(()=>h.nativeHealthCallback({...result,redirect_uri:'ai.hales.cupcake.health.preview:/health/callback'},req,'owner')),
        rejected(()=>h.nativeHealthCallback(result,req,'other-owner')),
        d.nativeHealthReceipt(receipt).source==='ios_healthkit',
        rejected(()=>d.nativeHealthReceipt({...receipt,estimated_sleep:true})),
        rejected(()=>d.nativeHealthReceipt({...receipt,types:[{type:'sleep',status:'permission_required',record_count:0}]}))];
    },{profile,health});assert.deepEqual(guards,Array(8).fill(true));await v.context.close();checks++;
  } finally { await browser.close(); }
} } finally { await server.close();rmSync(cacheDir,{recursive:true,force:true}); }
console.log(`PASS: ${checks} Chromium/WebKit iOS native web cases; real gate/consent/strict client binding/source truth/owned receipt and revoke; all data fictional`);
