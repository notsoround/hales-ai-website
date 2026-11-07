import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const caches=[],servers=[];
async function serve(enabled){
  const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-entry-'));caches.push(cacheDir);
  const server=await createServer({cacheDir,plugins:enabled?[{name:'synthetic-entry-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}]:[],
    define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':JSON.stringify(String(enabled))},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
  await server.listen();servers.push(server);return `http://127.0.0.1:${server.httpServer.address().port}`;
}
const browser=await chromium.launch({headless:true});
const LEGACY='synthetic-legacy-key',THREAD='00000000-0000-4000-8000-000000000901';
const localFeed={items:[{id:'synthetic-matt-private',type:'glucose',date:'2026-11-06',time:'08:00',ts:1793988000000,title:'PRIVATE MATT LEGACY TELEMETRY',body:'Existing full legacy source fixture',icon:'💧'}],totals:{calories:123,spendUsd:12,weightLb:180},outcomes:{wins:1,losses:0,missed:0,unscored:0,interventions:1},daily:[]};
async function routeNetwork(context,base,requests){
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();
    if(url.origin!=='https://automate.hales.ai')return route.abort();
    requests.push({url:url.href,headers:req.headers(),body:req.postDataJSON()});
    let data=localFeed;
    if(url.pathname==='/cupcake-library'){
      const action=req.postDataJSON()?.action;
      data=action==='weight_list'?{measurements:[],latestMeasurement:null,total:0,nextCursor:null,coverage:{}}:
        action==='food_history'?{meals:[],total:0,pendingCount:0,undatedLoggedCount:0,nextCursor:null}:
        action==='food_settings_get'?{settings:{calorieTarget:null,expenditureEstimate:null,effectiveFrom:null,versions:[]}}:
        action==='quick_chat_list'?{threads:[]}:{documents:[],projects:[],entries:[],meals:[],analyses:[],decisions:[],nextCursor:null,counts:{wins:0,losses:0,unscored:0,total:0}};
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...data})});
  });
}
async function login(page){await page.getByLabel('Email',{exact:true}).fill('b@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic B',{exact:true}).first().waitFor();}
async function draftCount(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('cupcake-recorder',1);open.onsuccess=()=>{const db=open.result;if(!db.objectStoreNames.contains('drafts')){db.close();resolve(0);return;}const read=db.transaction('drafts').objectStore('drafts').count();read.onsuccess=()=>{db.close();resolve(read.result);};read.onerror=()=>reject(read.error);};open.onerror=()=>reject(open.error);}));}
try{
  const base=await serve(true),context=await browser.newContext({viewport:{width:390,height:844}}),requests=[];
  await routeNetwork(context,base,requests);
  await context.addInitScript(()=>{localStorage.setItem('cupcake-private-access','synthetic-legacy-key');window.entryRegistrations=[];if('serviceWorker'in navigator){const register=navigator.serviceWorker.register.bind(navigator.serviceWorker);navigator.serviceWorker.register=(...args)=>{window.entryRegistrations.push(args[0]);return register(...args);};}});
  const legacy=await context.newPage();legacy.setDefaultTimeout(10000);await legacy.goto(base+'/cupcake?tab=feed');
  await legacy.getByRole('button',{name:'Lock Cupcake',exact:true}).waitFor();await legacy.getByText('PRIVATE MATT LEGACY TELEMETRY',{exact:true}).first().waitFor();
  const account=await context.newPage();account.setDefaultTimeout(10000);account.on('dialog',d=>d.accept());await account.goto(base+'/cupcake/account');await account.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await login(account);
  assert.equal(await legacy.evaluate(()=>localStorage.getItem('cupcake-private-access')),LEGACY);
  assert.equal(await account.getByText('PRIVATE MATT LEGACY TELEMETRY',{exact:true}).count(),0);
  assert.equal(await account.evaluate(()=>window.accountFixture.legacyReads),0);
  assert.deepEqual(await account.evaluate(()=>window.entryRegistrations),[]);
  assert.equal(await account.locator('link[rel="manifest"]').count(),0);
  assert.equal(await legacy.locator('link[rel="manifest"]').getAttribute('href'),'/cupcake.webmanifest');
  assert.ok(requests.length>0);assert.ok(requests.every(r=>r.headers['x-cupcake-key']===LEGACY));
  assert.equal(await account.evaluate(async()=>{const mode=await import('/src/components/cupcake/accountMode.ts');return mode.ACCOUNT_SESSIONS;}),true);
  assert.equal(await legacy.evaluate(async()=>{const mode=await import('/src/components/cupcake/accountMode.ts');return mode.ACCOUNT_SESSIONS;}),false);
  const mapped=await account.evaluate(async()=>{const {cupcakeHref}=await import('/src/components/cupcake/accountMode.ts');return ['/cupcake?tab=snap&meal=own#photo','https://hales.ai/cupcake?tab=library&document=own','https://example.invalid/cupcake?tab=library'].map(cupcakeHref);});
  assert.deepEqual(mapped,['/cupcake/account?tab=snap&meal=own#photo','/cupcake/account?tab=library&document=own','https://example.invalid/cupcake?tab=library']);
  await account.getByRole('navigation',{name:'Cupcake',exact:true}).getByRole('button',{name:'Library',exact:true}).click();
  assert.match(new URL(account.url()).pathname,/^\/cupcake\/account$/);await account.goBack();assert.equal(new URL(account.url()).pathname,'/cupcake/account');
  await account.locator('summary[aria-label="Settings"]').click();await account.getByText(/Account app installation and system audio sharing are not available yet/).waitFor();await account.getByRole('button',{name:'Close settings'}).click();
  console.log('PASS: actual App routing keeps legacy telemetry/key and account context separate in concurrent tabs, deep links and staged PWA are explicit');

  await context.exposeFunction('syntheticQuickChatServer',async(_owner,body)=>({status:200,value:body.action==='quick_chat_list'?{threads:[{id:THREAD,title:'Owned source link'}]}:{thread:{id:THREAD,title:'Owned source link',turns:[{id:THREAD+'-turn',text:'Own original',status:'completed',retryAfter:0,response:{ok:true,reply:'Owned source response',model:'synthetic',sources:[{title:'Owned original',url:'https://hales.ai/cupcake?tab=library&document=own-original'}]}}]}}}));
  await account.goto(base+'/cupcake/account/?tab=chat&thread='+THREAD);await account.getByText('Owned source response',{exact:true}).waitFor();
  const source=account.getByRole('link',{name:'Owned original',exact:true});assert.equal(await source.getAttribute('href'),'/cupcake/account?tab=library&document=own-original');
  const popupPromise=context.waitForEvent('page');await source.click();const popup=await popupPromise;await popup.getByText('Synthetic B delayed original',{exact:true}).first().waitFor();assert.equal(new URL(popup.url()).pathname,'/cupcake/account');await popup.close();
  await legacy.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const before=await draftCount(legacy);
  await account.evaluate(()=>navigator.serviceWorker.controller.postMessage({type:'cupcake-browser-mode',accountSessions:true}));
  const share=await legacy.evaluate(async()=>{const body=new FormData();body.set('audio',new File(['synthetic legacy share'],'legacy.webm',{type:'audio/webm'}));const r=await fetch('/cupcake/share',{method:'POST',body});return {status:r.status,url:r.url};});
  assert.equal(share.status,200);assert.equal(new URL(share.url).pathname,'/cupcake');assert.equal(new URL(share.url).search,'?shared=1');assert.equal(await draftCount(legacy),before+1);
  for(const endpoint of ['/cupcake/account/share','/cupcake/share']){
    const status=await account.evaluate(async endpoint=>{const body=new FormData();body.set('audio',new File(['must not store'],'account.webm',{type:'audio/webm'}));return (await fetch(endpoint,{method:'POST',body})).status;},endpoint);
    assert.equal(status,409);assert.equal(await draftCount(legacy),before+1);
  }
  assert.equal(await account.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('PASS: actual trailing-slash/source popup stays in account; account messages cannot disable legacy shares and account shares cannot adopt legacy drafts');
  await context.close();

  const off=await serve(false),offContext=await browser.newContext(),offRequests=[];await routeNetwork(offContext,off,offRequests);
  await offContext.addInitScript(()=>localStorage.setItem('cupcake-private-access','synthetic-legacy-key'));
  const closed=await offContext.newPage();await closed.goto(off+'/cupcake/account?tab=feed');await closed.getByRole('heading',{name:'Account sign-in is not enabled'}).waitFor();assert.deepEqual(offRequests,[]);
  assert.equal(await closed.evaluate(()=>localStorage.getItem('cupcake-private-access')),LEGACY);
  await closed.goto(off+'/cupcake/accounting');await closed.getByText(/That page doesn't exist/).waitFor();assert.deepEqual(offRequests,[]);
  await closed.goto(off+'/cupcake?account=true');await closed.getByRole('button',{name:'Lock Cupcake',exact:true}).waitFor();assert.ok(offRequests.every(r=>r.headers['x-cupcake-key']===LEGACY));
  await offContext.close();console.log('PASS: default-off account path fails closed, unknown prefix is404 and query flags cannot change legacy mode');
}finally{await browser.close();for(const server of servers)await server.close();for(const cache of caches)rmSync(cache,{recursive:true,force:true});}
console.log('PASS: 3 synthetic actual-root account entry scenarios');
