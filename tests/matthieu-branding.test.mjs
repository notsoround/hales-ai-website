import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'matthieu-branding-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-branding-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const A='acc_synthetic_a',B='acc_synthetic_b';
const saved=new Map([
  [A,{preferences:{name:'Cupcake',persona:'cupcake',appearance:'caribbean'},revision:1,updated:1,saved:true}],
  [B,{preferences:{name:'Matthieu',persona:'matthieu',appearance:'rose'},revision:1,updated:1,saved:true}],
]);
const requests=[],contexts=[];
async function open(entry,{owner=null,width=390}={}){
  const context=await browser.newContext({viewport:{width,height:900}});contexts.push(context);
  await context.exposeFunction('syntheticPersonaServer',async(account,body)=>{
    requests.push({account,body});assert.equal(body.action,'persona_get','A public branding hint must never write saved preferences');
    return {status:200,value:{ok:true,...saved.get(account)}};
  });
  await context.exposeFunction('syntheticCoachServer',async(account,route)=>{
    assert.equal(route,'coach/grants/received');return {status:200,value:{ok:true,grants:[]}};
  });
  if(owner)await context.addInitScript(owner=>localStorage.setItem('synthetic-account-server',owner),owner);
  const external=[],page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('dialog',dialog=>dialog.accept());
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===base)return route.continue();external.push(route.request().url());return route.abort();});
  await page.goto(base+entry);return {page,context,external};
}
async function assertSafe({page,external}){
  const state=await page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads,mics:window.accountFixture.micRequests}));
  assert.equal(state.reads,0);assert.equal(state.mics,0);assert.deepEqual(state.blocked,[]);assert.deepEqual(external,[]);
  for(const request of state.requests){assert.equal(request.headers['x-cupcake-key'],undefined);assert.equal(request.body.owner_id,undefined);assert.equal(request.body.account_id,undefined);}
}
async function settings(page){await page.locator('summary[aria-label="Settings"]').click();await page.getByText('Saved to your account.',{exact:true}).waitFor();}
async function fit(page){for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No horizontal overflow at ${width}px`);}}
const entry='/cupcake/account?assistant=matthieu';
async function login(page,who){await page.getByLabel('Email',{exact:true}).fill(who+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();}
async function header(page,text){await page.locator('.cc-top .cc-account-identity').filter({hasText:text}).waitFor();assert.equal(await page.locator('.cc-top .cc-account-identity').innerText(),text);}
async function metadata(page,brand){await page.waitForFunction(brand=>document.title===brand+' — Your private companion',brand);const path=brand==='Matthieu'?'/matthieu-avatar.png':'/cupcake-avatar.jpg';for(const rel of ['icon','apple-touch-icon']){const icons=await page.locator(`link[rel="${rel}"]`).evaluateAll(links=>links.map(link=>new URL(link.href).pathname));assert.deepEqual(icons,[path]);}}
async function matthieuGate(page){await page.getByRole('heading',{name:'Sign in to Matthieu',exact:true}).waitFor();await page.getByText('YOUR PRIVATE MATTHIEU',{exact:true}).waitFor();assert.equal(await page.getByRole('img',{name:'Matthieu',exact:true}).getAttribute('src'),'/matthieu-avatar.png');assert.equal(await page.locator('.cc-account-gate').getAttribute('data-appearance'),'rose');await metadata(page,'Matthieu');}

try{
  const invited=await open(entry),page=invited.page;
  await matthieuGate(page);assert.equal(await page.getByText(/Synthetic [AB]/).count(),0);await fit(page);
  assert.equal(await page.locator('link[rel="manifest"]').count(),0);
  await page.getByLabel('Remember me on this device',{exact:true}).check();await login(page,'b');await header(page,'Matthieu — Synthetic B');await metadata(page,'Matthieu');
  assert.equal(await page.locator('.cc-app').getAttribute('data-appearance'),'rose');await page.locator('.cc-top').getByRole('img',{name:'Matthieu assistant character',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.accountFixture.requests.find(request=>request.route==='sign-in')?.body.remember_me),true);
  await settings(page);assert.equal(await page.locator('.cc-account-controls h3').innerText(),'Matthieu — Synthetic B');assert.equal(await page.getByLabel('Assistant name',{exact:true}).inputValue(),'Matthieu');assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).inputValue(),'rose');
  assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).locator('option[value="rose"]').innerText(),'Violet · lilac & amethyst');await fit(page);
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.locator('.cc-nav').getByRole('button',{name:'Reports',exact:true}).click();await page.locator('.cc-coach-context').getByRole('button',{name:'Matthieu — Synthetic B',exact:true}).click();await page.locator('.cc-coach').waitFor({state:'detached'});await header(page,'Matthieu — Synthetic B');
  await page.reload();await header(page,'Matthieu — Synthetic B');await metadata(page,'Matthieu');await assertSafe(invited);
  console.log('PASS: public Matthieu link has matching login portrait/violet preset and metadata; Robyn saved persona controls header, settings, coach return and remembered reload');

  await page.locator('.cc-top .cc-lock').click();await matthieuGate(page);assert.equal(new URL(page.url()).searchParams.get('assistant'),'matthieu');assert.equal(await page.getByText('Synthetic B',{exact:false}).count(),0);assert.equal(await page.getByText('b@example.invalid',{exact:false}).count(),0);
  await login(page,'a');await header(page,'MyCupcake — Synthetic A');await metadata(page,'Cupcake');assert.equal(await page.locator('.cc-app').getAttribute('data-appearance'),'caribbean');await page.locator('.cc-top').getByRole('img',{name:'Cupcake assistant character',exact:true}).waitFor();
  await settings(page);assert.equal(await page.locator('.cc-account-controls h3').innerText(),'MyCupcake — Synthetic A');assert.equal(await page.getByLabel('Assistant name',{exact:true}).inputValue(),'Cupcake');assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).inputValue(),'caribbean');await assertSafe(invited);
  const currentMatt=await open(entry,{owner:A,width:1280});await header(currentMatt.page,'MyCupcake — Synthetic A');await metadata(currentMatt.page,'Cupcake');assert.equal(await currentMatt.page.locator('.cc-app').getAttribute('data-appearance'),'caribbean');await fit(currentMatt.page);await assertSafe(currentMatt);
  console.log('PASS: sign-out removes private identity while preserving public hint; current Matt stays Cupcake/Caribbean and resets prior Matthieu metadata/icons');

  const remembered=await open('/cupcake/account',{owner:B,width:390});await header(remembered.page,'Matthieu — Synthetic B');await metadata(remembered.page,'Matthieu');assert.equal(await remembered.page.locator('.cc-app').getAttribute('data-appearance'),'rose');await fit(remembered.page);await assertSafe(remembered);
  saved.get(B).preferences.name='Quiet Mentor';const customized=await open(entry,{owner:B});await header(customized.page,'Quiet Mentor — Synthetic B');await assertSafe(customized);
  assert.equal(requests.some(request=>request.body.action==='persona_save'),false);
  console.log('PASS: remembered Robyn without branding hint uses saved Matthieu; customized safe name survives hint; all320/390/1280 layouts fit with zero legacy keys, provider/network or microphone requests');
}finally{for(const context of contexts)await context.close();await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
