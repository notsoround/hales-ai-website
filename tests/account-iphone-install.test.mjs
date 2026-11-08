import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-iphone-vite-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-iphone-account-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],
  define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const requests=[],outside=[],logs=[],issued=[],devices=[],attempts=new Map();
const UPLOAD='https://automate.hales.ai/api/health-auto-export';
const COVERAGE='Synthetic uploads cover only the selected Apple Health source; missing data is unknown.';
let failCreate=false,uncertainCreate=false,serial=0,uploaded=false;
const clone=value=>structuredClone(value);
const ok=value=>({status:200,value:{ok:true,...value}});
function device(body){const now=Date.now()/1000;return {id:randomUUID(),label:body.label,timezone:body.timezone,preferred_source:body.preferred_source,created_at:now,expires_at:now+Number(body.expires_in_days)*86400,revoked_at:null,status:'active',last_received_at:null,last_observed_at:null,metrics:[]};}
async function syntheticHealthServer(owner,route,body){
  requests.push({owner,route,body:clone(body)});
  if(route==='health/devices/list')return ok({devices:devices.filter(row=>row.owner===owner).map(({owner:_owner,...row})=>clone(row))});
  if(route==='health/sync')return ok({devices:devices.filter(row=>row.owner===owner).map(({owner:_owner,...row})=>clone(row)),last_received_at:uploaded?1794052800:null,last_observed_at:uploaded?'2026-11-07T12:00:00Z':null,metrics:uploaded?['step_count']:[],coverage_note:COVERAGE});
  if(route==='health/devices/create'){
    assert.deepEqual(Object.keys(body).sort(),['expires_in_days','label','preferred_source','request_id','timezone']);
    assert.match(body.request_id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    if(failCreate){failCreate=false;return {status:503,value:{ok:false,error:'health_connector_unavailable'}};}
    const prior=attempts.get(owner+':'+body.request_id);
    if(prior){assert.deepEqual(body,prior.body);return ok({device:clone(prior.device),credential_shown:false,upload_url:UPLOAD});}
    const created=device(body),credential='ah_'+String(++serial).padStart(43,'s');
    attempts.set(owner+':'+body.request_id,{body:clone(body),device:created});devices.push({...created,owner});issued.push(credential);
    if(uncertainCreate){uncertainCreate=false;throw Error('Synthetic response lost after creation');}
    return ok({device:created,upload_credential:credential,credential_shown:true,upload_url:UPLOAD});
  }
  if(route==='health/devices/revoke'){
    assert.deepEqual(Object.keys(body),['device_id']);const row=devices.find(row=>row.owner===owner&&row.id===body.device_id);assert.ok(row);row.status='revoked';row.revoked_at=Date.now()/1000;return ok({revoked:true});
  }
  throw Error('Unexpected synthetic health route '+route);
}
async function open(entry='/cupcake/account?assistant=matthieu'){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base)return route.continue();outside.push(url.href);return route.abort();});
  await context.exposeFunction('syntheticHealthServer',syntheticHealthServer);
  await context.addInitScript(()=>{window.installRegistrations=[];if('serviceWorker'in navigator){const register=navigator.serviceWorker.register.bind(navigator.serviceWorker);navigator.serviceWorker.register=(...args)=>{window.installRegistrations.push(args[0]);return register(...args);};}});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('console',message=>logs.push(message.text()));page.on('dialog',dialog=>dialog.accept());
  await page.goto(base+entry);await page.getByRole('heading',{name:entry.includes('assistant=matthieu')?'Sign in to Matthieu':'Sign in to Cupcake',exact:true}).waitFor();return {context,page};
}
async function login(page){await page.getByLabel('Email',{exact:true}).fill('a@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();}
async function settings(page){await page.locator('summary[aria-label="Settings"]').click();await page.locator('.cc-settings-group > summary').filter({hasText:'iPhone & Apple Health'}).click();await page.getByRole('button',{name:'Create Apple Health connection',exact:true}).waitFor();await page.getByRole('region',{name:'Add to iPhone Home Screen',exact:true}).getByText('then choose Save audio to account',{exact:false}).waitFor();}
async function fillConnection(page,label){await page.getByLabel('Device label',{exact:true}).fill(label);await page.getByLabel('IANA Timezone',{exact:true}).fill('America/Chicago');await page.getByLabel('Apple Health source name',{exact:true}).fill('Synthetic Watch');await page.getByLabel('Connection expiry (days)',{exact:true}).fill('30');}
async function metadata(page){
  assert.equal(await page.locator('link[rel="manifest"]').getAttribute('href'),'/matthieu-account.webmanifest');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),'Matthieu');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),'yes');
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'),'/matthieu-avatar.png');
  assert.deepEqual(await page.evaluate(()=>window.installRegistrations),[]);
  assert.equal(new URL(page.url()).pathname,'/cupcake/account');
}
async function noCredentialSaved(page){
  const saved=await page.evaluate(()=>({local:Object.entries(localStorage),session:Object.entries(sessionStorage)}));
  for(const credential of issued){assert.ok(!JSON.stringify(saved).includes(credential));assert.ok(!logs.some(line=>line.includes(credential)));}
}
async function safe(page){
  const state=await page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads}));
  assert.equal(state.reads,0);assert.deepEqual(state.blocked,[]);
  for(const request of state.requests){assert.equal(request.credentials,'include');assert.equal(request.headers['x-cupcake-key'],undefined);assert.equal(request.headers.authorization,undefined);if(request.route.startsWith('health/')){assert.equal(request.headers['x-cupcake-request'],'account');assert.equal(request.headers['x-cupcake-account-context'],'acc_synthetic_a');assert.equal(request.body.owner_id,undefined);assert.equal(request.body.account_id,undefined);}}
  await noCredentialSaved(page);
}
try{
  const matt=await open('/cupcake/account');
  const defaultAccountMetadata=async()=>{
    assert.equal(await matt.page.locator('link[rel="manifest"]').count(),0);
    assert.equal(await matt.page.locator('meta[name="apple-mobile-web-app-title"]').count(),0);
    assert.equal(await matt.page.locator('meta[name="apple-mobile-web-app-capable"]').count(),0);
    assert.equal(await matt.page.locator('link[rel="apple-touch-icon"]').getAttribute('href'),'/cupcake-avatar.jpg');
    assert.equal(await matt.page.title(),'Cupcake — Your private companion');
    assert.deepEqual(await matt.page.evaluate(()=>window.installRegistrations),[]);
  };
  await defaultAccountMetadata();await login(matt.page);await defaultAccountMetadata();
  await matt.page.reload();await matt.page.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await defaultAccountMetadata();
  await settings(matt.page);assert.equal(await matt.page.getByRole('link',{name:'Add Matthieu to iPhone',exact:true}).getAttribute('href'),'/cupcake/account?assistant=matthieu');
  await defaultAccountMetadata();await safe(matt.page);await matt.context.close();
  console.log('PASS: default Matt/Cupcake account keeps its existing title/icon and no Matthieu install metadata before sign-in, after sign-in and after reload');

  const beforeGuest=requests.length;const {context,page}=await open();await metadata(page);
  const manifest=await page.evaluate(async()=>{const response=await fetch('/matthieu-account.webmanifest');return {status:response.status,value:await response.json()};});
  assert.equal(manifest.status,200);assert.equal(manifest.value.id,'/cupcake/account?assistant=matthieu');assert.equal(manifest.value.start_url,'/cupcake/account?assistant=matthieu');assert.equal(manifest.value.scope,'/cupcake/account');assert.equal(manifest.value.name,'Matthieu');assert.equal(manifest.value.short_name,'Matthieu');assert.equal(manifest.value.display,'standalone');assert.equal(manifest.value.share_target,undefined);assert.ok(manifest.value.icons.some(icon=>icon.src==='/matthieu-avatar.png'&&icon.type==='image/png'));
  const icon=await page.evaluate(async()=>{const response=await fetch('/matthieu-avatar.png');return {status:response.status,type:response.headers.get('content-type'),signature:Array.from(new Uint8Array(await response.arrayBuffer()).slice(0,8))};});assert.equal(icon.status,200);assert.match(icon.type,/image\/png/);assert.deepEqual(icon.signature,[137,80,78,71,13,10,26,10]);
  const legacyManifest=await page.evaluate(async()=>fetch('/cupcake.webmanifest').then(response=>response.json()));assert.equal(legacyManifest.start_url,'/cupcake');assert.equal(legacyManifest.scope,'/cupcake');assert.equal(legacyManifest.share_target.action,'/cupcake/share');
  assert.equal(requests.length,beforeGuest);await login(page);await metadata(page);await page.reload();await page.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await metadata(page);await safe(page);
  console.log('PASS: guest and cookie-restored iPhone launch uses the Matthieu manifest/icon/meta, stays in account and registers no worker');

  await settings(page);assert.equal(requests.filter(row=>['health/devices/create','health/devices/revoke'].includes(row.route)).length,0);assert.equal(await page.getByLabel('Upload credential',{exact:true}).count(),0);assert.equal(await page.getByLabel('Upload endpoint',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Check connection',exact:true}).click();await page.getByText(COVERAGE,{exact:false}).waitFor();await page.getByText('No upload received',{exact:false}).first().waitFor();
  assert.ok(requests.some(row=>row.route==='health/devices/list'));assert.ok(requests.some(row=>row.route==='health/sync'));
  for(const row of requests.filter(row=>['health/devices/list','health/sync'].includes(row.route)))assert.deepEqual(row.body,{});
  await fillConnection(page,'Synthetic iPhone');await page.getByRole('button',{name:'Create Apple Health connection',exact:true}).click();
  const credential=page.getByLabel('Upload credential',{exact:true});await credential.waitFor();assert.equal(await credential.inputValue(),issued.at(-1));assert.equal(await credential.getAttribute('readonly'),'');assert.equal(await page.getByLabel('Upload endpoint',{exact:true}).inputValue(),UPLOAD);
  assert.deepEqual(requests.find(row=>row.route==='health/devices/create').body,{request_id:requests.find(row=>row.route==='health/devices/create').body.request_id,label:'Synthetic iPhone',timezone:'America/Chicago',preferred_source:'Synthetic Watch',expires_in_days:30});
  await page.getByRole('button',{name:'Revoke Synthetic iPhone',exact:true}).waitFor();uploaded=true;await page.getByRole('button',{name:'Check connection',exact:true}).click();await page.getByText(/Received metrics: step_count/).waitFor();await safe(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.reload();await page.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await settings(page);assert.equal(await credential.count(),0);assert.equal(await page.getByLabel('Upload endpoint',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Check connection',exact:true}).click();await page.getByRole('button',{name:'Revoke Synthetic iPhone',exact:true}).waitFor();await page.getByRole('button',{name:'Revoke Synthetic iPhone',exact:true}).click();await page.getByRole('button',{name:'Revoke Synthetic iPhone',exact:true}).waitFor({state:'hidden'});
  assert.equal(devices.find(row=>row.label==='Synthetic iPhone').status,'revoked');await safe(page);await context.close();
  console.log('PASS: explicit status/list, bounded device creation, one-time credential, reload removal and owner-bound revoke without uploads');

  const retry=await open();await login(retry.page);await settings(retry.page);await fillConnection(retry.page,'Retry iPhone');failCreate=true;
  const before=requests.filter(row=>row.route==='health/devices/create').length;await retry.page.getByRole('button',{name:'Create Apple Health connection',exact:true}).click();await retry.page.getByText(/This feature is not available for account sign-in yet/).waitFor();assert.equal(await retry.page.getByLabel('Upload credential',{exact:true}).count(),0);
  await retry.page.getByRole('button',{name:'Retry same connection request',exact:true}).click();await retry.page.getByLabel('Upload credential',{exact:true}).waitFor();const repeated=requests.filter(row=>row.route==='health/devices/create').slice(before);assert.equal(repeated.length,2);assert.deepEqual(repeated[0].body,repeated[1].body);
  await retry.page.getByRole('button',{name:'Close settings',exact:true}).click();await retry.page.getByRole('button',{name:'Sign out of Cupcake',exact:true}).click();await retry.page.getByRole('heading',{name:/^Sign in to /}).waitFor();assert.equal(await retry.page.getByLabel('Upload credential',{exact:true}).count(),0);await login(retry.page);await settings(retry.page);assert.equal(await retry.page.getByLabel('Upload credential',{exact:true}).count(),0);await safe(retry.page);await retry.context.close();
  console.log('PASS: 503 stays unavailable, retry retains its UUID and body, and credential is absent from storage/logs and after logout');

  const uncertain=await open();await login(uncertain.page);await settings(uncertain.page);await fillConnection(uncertain.page,'Uncertain iPhone');uncertainCreate=true;const beforeUncertain=requests.filter(row=>row.route==='health/devices/create').length;
  await uncertain.page.getByRole('button',{name:'Create Apple Health connection',exact:true}).click();await uncertain.page.getByText(/Synthetic response lost after creation/).waitFor();await uncertain.page.getByRole('button',{name:'Retry same connection request',exact:true}).click();await uncertain.page.getByRole('button',{name:'Revoke Uncertain iPhone',exact:true}).waitFor();assert.equal(await uncertain.page.getByLabel('Upload credential',{exact:true}).count(),0);const uncertainRetries=requests.filter(row=>row.route==='health/devices/create').slice(beforeUncertain);assert.equal(uncertainRetries.length,2);assert.deepEqual(uncertainRetries[0].body,uncertainRetries[1].body);assert.equal(devices.filter(row=>row.label==='Uncertain iPhone').length,1);await safe(uncertain.page);await uncertain.context.close();
  console.log('PASS: lost create response reuses its request and never recreates or re-exposes the upload credential');

  const wrong=await open();await login(wrong.page);await settings(wrong.page);await fillConnection(wrong.page,'Wrong echo iPhone');await wrong.page.evaluate(()=>{window.accountFixture.wrongEcho=true;});await wrong.page.getByRole('button',{name:'Create Apple Health connection',exact:true}).click();await wrong.page.getByRole('heading',{name:/^Sign in to /}).waitFor();assert.equal(await wrong.page.getByLabel('Upload credential',{exact:true}).count(),0);assert.ok(!await wrong.page.locator('body').innerText().then(text=>text.includes(issued.at(-1))));await safe(wrong.page);await wrong.context.close();
  assert.deepEqual(outside,[]);assert.ok(requests.every(row=>['health/devices/create','health/devices/list','health/devices/revoke','health/sync'].includes(row.route)));
  console.log('PASS: wrong account echo locks before exposing a credential; all traffic is synthetic and no upload route is called');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log('PASS: 6 synthetic iPhone installation and Apple Health Settings scenarios');
