import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-persona-vite-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-persona-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},
  server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const A='acc_synthetic_a',B='acc_synthetic_b';
const records=new Map([
  [A,{preferences:{appearance:'rose',persona:'matthieu',name:'Server A'},revision:1,updated:1,saved:true}],
  [B,{preferences:{appearance:'caribbean',persona:'cupcake',name:'Server B'},revision:1,updated:1,saved:true}],
]);
const requests=[];
let blockedGet,blockedSave,failGet=false,failSave=false,activeSaves=0,maxActiveSaves=0;
const defer=owner=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {owner,promise,release};};
async function syntheticPersonaServer(owner,body){
  requests.push({owner,body:structuredClone(body)});
  const reply=(status,value)=>({status,value});
  if(body.action==='persona_get'){
    const snapshot=structuredClone(records.get(owner));
    if(blockedGet?.owner===owner){const hold=blockedGet;blockedGet=undefined;await hold.promise;}
    return failGet?reply(503,{ok:false}):reply(200,{ok:true,...snapshot});
  }
  activeSaves++;maxActiveSaves=Math.max(maxActiveSaves,activeSaves);
  try{
    if(blockedSave?.owner===owner){const hold=blockedSave;blockedSave=undefined;await hold.promise;}
    if(failSave)return reply(503,{ok:false});
    const current=records.get(owner);
    if(body.revision!==current.revision)return reply(409,{ok:false,error:'persona_conflict'});
    assert.deepEqual(Object.keys(body.preferences).sort(),['appearance','name','persona']);
    assert.equal(body.preferences.name,body.preferences.name.trim());
    const record={preferences:structuredClone(body.preferences),revision:current.revision+1,updated:current.updated+1,saved:true};
    records.set(owner,record);return reply(200,{ok:true,...record});
  } finally{activeSaves--;}
}
async function open(context){
  await context.exposeFunction('syntheticPersonaServer',syntheticPersonaServer);
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base+'/cupcake/account');await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();return page;
}
async function login(page,who){await page.getByLabel('Email',{exact:true}).fill(who+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+who.toUpperCase(),{exact:true}).first().waitFor();}
async function settings(page){await page.locator('summary[aria-label="Settings"]').click();}
async function logout(page){await page.getByRole('button',{name:'Close settings'}).click();await page.getByRole('button',{name:'Sign out of Cupcake'}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await page.waitForFunction(()=>!document.querySelector('button.cc-primary')?.disabled);}
async function value(page,name){await page.waitForFunction(name=>document.querySelector('input[aria-label="Assistant name"]')?.value===name,name);}
async function saved(page){await page.getByText('Saved to your account.',{exact:true}).waitFor();}
async function safe(page){const state=await page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads}));assert.equal(state.reads,0);assert.deepEqual(state.blocked,[]);for(const r of state.requests.filter(r=>r.body.action?.startsWith('persona_'))){assert.equal(r.credentials,'include');assert.match(r.headers['x-cupcake-account-context'],/^acc_synthetic_[ab]$/);assert.equal(r.headers['x-cupcake-key'],undefined);assert.equal(r.body.owner_id,undefined);}}
try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await open(context);
  const hold=defer(A);blockedGet=hold;
  await page.evaluate(()=>localStorage.setItem('cupcake-account-v1:acc_synthetic_a:cupcake-assistant-appearance-v1',JSON.stringify({appearance:'caribbean',persona:'cupcake',name:'Local only A'})));
  await login(page,'a');await settings(page);
  assert.equal(await page.getByLabel('Assistant name',{exact:true}).isDisabled(),true);
  assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:/Matthieu/}).isDisabled(),true);
  await page.getByText('Loading your account preferences…',{exact:true}).waitFor();hold.release();await value(page,'Server A');await saved(page);
  assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).inputValue(),'rose');
  assert.equal(await page.getByRole('button',{name:/Matthieu/}).getAttribute('aria-pressed'),'true');
  const firstSaveCount=requests.filter(r=>r.body.action==='persona_save').length;
  await page.getByLabel('Assistant name',{exact:true}).fill('  Ocean A  ');await page.getByLabel('Assistant appearance',{exact:true}).selectOption('caribbean');
  await saved(page);await value(page,'Ocean A');assert.equal(requests.filter(r=>r.body.action==='persona_save').length,firstSaveCount+1);
  assert.deepEqual(records.get(A).preferences,{appearance:'caribbean',persona:'matthieu',name:'Ocean A'});
  const serial=defer(A);blockedSave=serial;
  await page.getByLabel('Assistant name',{exact:true}).fill('First in flight');
  await page.waitForFunction(()=>window.accountFixture.requests.some(r=>r.body.action==='persona_save'&&r.body.preferences?.name==='First in flight'));
  await page.getByLabel('Assistant name',{exact:true}).fill('Newest draft');
  await page.waitForTimeout(650);assert.equal(activeSaves,1);assert.equal(requests.filter(r=>r.body.preferences?.name==='Newest draft').length,0);
  serial.release();await saved(page);await value(page,'Newest draft');assert.equal(maxActiveSaves,1);assert.equal(records.get(A).preferences.name,'Newest draft');
  assert.match(await page.evaluate(()=>localStorage.getItem('cupcake-account-v1:acc_synthetic_a:cupcake-assistant-appearance-v1')),/Local only A/);
  console.log('PASS: server-first hydration, independent choices, trimmed debounce and serialized revision saves without local fallback');

  // Separate cookie/storage containers share only the simulated server records.
  const otherContext=await browser.newContext({viewport:{width:1280,height:900}}),other=await open(otherContext);
  await login(other,'a');await settings(other);await value(other,'Newest draft');
  await other.getByLabel('Assistant name',{exact:true}).fill('Changed on device 2');await other.getByLabel('Assistant appearance',{exact:true}).selectOption('rose');await saved(other);
  const beforeConflict=requests.filter(r=>r.body.action==='persona_save').length;
  await page.getByLabel('Assistant name',{exact:true}).fill('Stale device 1 edit');
  await page.getByText('Preferences changed elsewhere. The latest settings are loaded; your unsaved changes were not applied.',{exact:true}).waitFor();
  await value(page,'Changed on device 2');assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).inputValue(),'rose');
  assert.equal(records.get(A).preferences.name,'Changed on device 2');assert.equal(requests.filter(r=>r.body.action==='persona_save').length,beforeConflict+1);
  await page.reload();await page.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await settings(page);await value(page,'Changed on device 2');
  await logout(page);await login(page,'b');await settings(page);await value(page,'Server B');assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).inputValue(),'caribbean');
  failGet=true;await page.reload();await page.getByText('MyCupcake — Synthetic B',{exact:true}).first().waitFor();await settings(page);
  await page.getByRole('button',{name:'Retry assistant preferences'}).waitFor();assert.equal(await page.getByLabel('Assistant name',{exact:true}).isDisabled(),true);
  failGet=false;await page.getByRole('button',{name:'Retry assistant preferences'}).click();await value(page,'Server B');
  failSave=true;await page.getByLabel('Assistant name',{exact:true}).fill('Unsaved B');await page.getByText('Could not save to your account. Your changes are unsaved; retry before leaving.',{exact:true}).waitFor();
  assert.equal(records.get(B).preferences.name,'Server B');await value(page,'Unsaved B');failSave=false;
  await page.getByRole('button',{name:'Retry assistant preferences'}).click();await saved(page);assert.equal(records.get(B).preferences.name,'Unsaved B');
  console.log('PASS: two-device persistence/reload, stale revision reload without overwrite, A/B isolation and honest load/save retry');

  await logout(page);await login(page,'a');await settings(page);await value(page,'Changed on device 2');
  const staleSave=defer(A);blockedSave=staleSave;await page.getByLabel('Assistant name',{exact:true}).fill('Late authorized A save');
  await page.waitForFunction(()=>window.accountFixture.requests.some(r=>r.body.preferences?.name==='Late authorized A save'));
  await logout(page);await login(page,'b');await settings(page);await value(page,'Unsaved B');staleSave.release();
  await page.waitForTimeout(650);await value(page,'Unsaved B');assert.equal(records.get(B).preferences.name,'Unsaved B');
  await logout(page);
  const staleGet=defer(A);blockedGet=staleGet;await login(page,'a');await settings(page);assert.equal(await page.getByLabel('Assistant name',{exact:true}).isDisabled(),true);
  await logout(page);await login(page,'b');await settings(page);await value(page,'Unsaved B');staleGet.release();await page.waitForTimeout(100);await value(page,'Unsaved B');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await safe(page);await safe(other);
  await context.close();await otherContext.close();
  console.log('PASS: delayed old-account saves/hydration cannot update the next account or redirect its writes');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log('PASS: 3 synthetic account persona browser scenarios');
