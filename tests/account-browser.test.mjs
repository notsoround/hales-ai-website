import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-account-vite-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-account-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},
  server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
let checks=0;
const fixture=(page,fn,arg)=>page.evaluate(fn,arg);
async function open(context){const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await page.goto(base+'/cupcake/account');await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();return page;}
async function login(page,who,remember=false){await page.getByLabel('Email',{exact:true}).fill(who+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');if(remember)await page.getByLabel('Remember me on this device').check();await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+who.toUpperCase(),{exact:true}).first().waitFor();}
async function logout(page){const minimize=page.getByRole('button',{name:'Minimize assistant'});if(await minimize.isVisible())await minimize.click();await page.getByRole('button',{name:'Sign out of Cupcake'}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('button.cc-primary')?.disabled);}
async function nav(page,label){await page.getByRole('navigation',{name:'Cupcake',exact:true}).getByRole('button',{name:label,exact:true}).click();}
async function requestsSafe(page){const state=await fixture(page,()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads}));assert.equal(state.reads,0);assert.deepEqual(state.blocked,[]);for(const r of state.requests){assert.equal(r.credentials,'include');assert.equal(r.headers['x-cupcake-key'],undefined);assert.equal(r.headers.authorization,undefined);if(r.route!=='session')assert.equal(r.headers['x-cupcake-request'],'account');if(['data','password','recovery/issue','sign-out-all'].includes(r.route))assert.match(r.headers['x-cupcake-account-context'],/^acc_synthetic_[ab]$/);}return state;}
try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await open(context);mkdirSync('output/account-preview',{recursive:true});await page.screenshot({path:'output/account-preview/sign-in-390.png'});await login(page,'a',true);
  assert.equal((await requestsSafe(page)).requests.find(r=>r.route==='sign-in').body.remember_me,true);
  await page.locator('summary[aria-label="Settings"]').click();
  await page.getByLabel('Assistant name',{exact:true}).fill('Sunrise A');await page.getByLabel('Assistant appearance',{exact:true}).selectOption('rose');
  await page.getByRole('button',{name:'Close settings'}).click();
  await nav(page,'Assistant');const composer=page.getByLabel('Message Cupcake',{exact:true});await composer.fill('A confidential draft');
  await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText(/This feature is not available for account sign-in yet/).first().waitFor();
  const nsA=await fixture(page,()=>window.accountFixture.seed('A originals'));
  await fixture(page,()=>window.accountFixture.holdScope());
  await logout(page);await login(page,'b');await nav(page,'Assistant');
  assert.equal(await page.getByLabel('Message Cupcake',{exact:true}).inputValue(),'');
  const empty=await fixture(page,()=>window.accountFixture.caches());assert.equal(empty.local,null);assert.equal(empty.tab,null);assert.deepEqual(empty.talks,[]);assert.deepEqual(empty.checkpoints,[]);assert.deepEqual(empty.answers,[]);assert.deepEqual(empty.drafts,[]);assert.equal(empty.pending,null);assert.equal(empty.seed,null);assert.equal(empty.reset,null);assert.equal(empty.outcome,null);assert.notEqual(empty.namespace,nsA);
  assert.equal(await fixture(page,()=>window.accountFixture.staleWrite()),3);
  await page.getByRole('button',{name:'Minimize assistant'}).click();await page.locator('summary[aria-label="Settings"]').click();
  assert.equal(await page.getByLabel('Assistant name',{exact:true}).inputValue(),'Cupcake');assert.equal(await page.getByLabel('Assistant appearance',{exact:true}).inputValue(),'caribbean');
  await page.getByLabel('Assistant name',{exact:true}).fill('Harbor B');await page.getByRole('button',{name:'Close settings'}).click();
  await fixture(page,()=>window.accountFixture.seed('B originals'));
  await page.reload();await page.getByText('MyCupcake — Synthetic B',{exact:true}).first().waitFor();
  const b=await fixture(page,()=>window.accountFixture.caches());assert.equal(b.local,'B originals');assert.equal(b.drafts[0].title,'B originals');
  await logout(page);await login(page,'a');
  const a=await fixture(page,()=>window.accountFixture.caches());assert.equal(a.local,'A originals');assert.equal(a.talks[0].title,'A originals');assert.equal(a.answers[0].response.reply,'A originals');assert.equal(a.pending.text,'A originals');assert.equal(a.reset.message,'A originals');assert.equal(a.outcome.title,'A originals');assert.match(a.seed,/A originals/);assert.equal(a.drafts[0].title,'A originals');
  assert.match(await fixture(page,()=>localStorage.getItem('cupcake-assistant-appearance-v1')),/LEGACY PRIVATE NAME/);
  assert.equal(await fixture(page,()=>sessionStorage.getItem('cupcake-quick-chat-draft')),'LEGACY PRIVATE DRAFT');
  assert.equal(await fixture(page,()=>document.documentElement.scrollWidth<=innerWidth),true);
  await requestsSafe(page);checks++;console.log('PASS: shared root, remembered sign-in, isolated caches/drafts/appearance, reload and legacy preservation');

  // Late data ignores abort in the synthetic transport so the generation check
  // itself must reject it before any consumer can expose/cache its result.
  await fixture(page,()=>{window.accountFixture.delay=true;window.staleResult=null;window.staleError='';void window.accountFixture.request({action:'fetch',id:'deferred-test'}).then(value=>{window.staleResult=value;},error=>{window.staleError=error.name;});});
  await page.waitForFunction(()=>window.accountFixture.requests.some(r=>r.body.id==='deferred-test'));
  await logout(page);await login(page,'b');
  await fixture(page,()=>window.accountFixture.release());await page.waitForFunction(()=>window.staleError==='AbortError');assert.equal(await fixture(page,()=>window.staleResult),null);
  await fixture(page,()=>{window.accountFixture.serverOwner('acc_synthetic_a');void window.accountFixture.request({action:'projects'}).catch(()=>{});});
  await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor(); // atomic expected-principal mismatch
  await login(page,'a');
  await fixture(page,()=>{window.accountFixture.wrongEcho=true;void window.accountFixture.request({action:'projects'}).catch(()=>{});});
  await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();
  await fixture(page,()=>{window.accountFixture.wrongEcho=false;});await login(page,'a');
  await nav(page,'Assistant');await page.getByRole('button',{name:'Live voice',exact:true}).click();
  const closeTalk=page.getByRole('button',{name:'Close conversation',exact:true});await closeTalk.waitFor();await closeTalk.click();
  const beforeMic=await fixture(page,()=>window.accountFixture.micRequests);await page.getByRole('button',{name:/^Talk to Cupcake/}).click();assert.equal(await fixture(page,()=>window.accountFixture.micRequests),beforeMic);
  await page.getByRole('group',{name:'Assistant mode'}).getByRole('button',{name:'Record',exact:true}).click();
  await page.getByRole('button',{name:'Start microphone recording'}).click();await page.getByRole('button',{name:'Stop recording',exact:true}).waitFor();
  await fixture(page,()=>{window.accountFixture.serverOwner(null);void window.accountFixture.request({action:'projects'}).catch(()=>{});});
  await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await page.waitForFunction(()=>window.accountFixture.recorderStops>0&&window.accountFixture.tracksStopped>0);
  await login(page,'b');const afterExpiry=await fixture(page,()=>window.accountFixture.caches());assert.equal(afterExpiry.drafts.length,1);assert.equal(afterExpiry.drafts[0].title,'B originals');
  await requestsSafe(page);checks++;console.log('PASS: stale reply, expected-principal/identity fencing, 401 media teardown and recorder owner handoff');

  await page.setViewportSize({width:1280,height:900});
  await page.locator('summary[aria-label="Settings"]').click();await page.getByLabel('Current password',{exact:true}).fill('Synthetic password 123!');
  await page.getByRole('button',{name:'Create recovery code',exact:true}).click();await page.getByLabel('One-time recovery code').waitFor();
  assert.equal(await page.getByLabel('One-time recovery code').textContent(),'synthetic-one-time-recovery');
  await page.screenshot({path:'output/account-preview/account-controls-1280.png'});
  await page.getByLabel('Current password',{exact:true}).fill('Synthetic password 123!');await page.getByLabel('New password',{exact:true}).fill('Synthetic next password 123!');await page.getByRole('button',{name:'Change password',exact:true}).click();
  await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await login(page,'a');
  const sibling=await context.newPage();await sibling.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await sibling.goto(base+'/cupcake/account');await sibling.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();
  await page.locator('summary[aria-label="Settings"]').click();await page.getByRole('button',{name:'Sign out all devices',exact:true}).click();
  await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await sibling.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();
  await page.getByRole('button',{name:'Use a recovery code'}).click();await page.getByLabel('Email',{exact:true}).fill('a@example.invalid');await page.getByLabel('Recovery code',{exact:true}).fill('synthetic-one-time-recovery');await page.getByLabel('New password',{exact:true}).fill('Synthetic recovered password 123!');await page.getByRole('button',{name:'Reset password',exact:true}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();
  await requestsSafe(page);checks++;console.log('PASS: desktop account controls, ephemeral recovery code, password reset and all-device broadcast lock');
  // The worker has no trusted cookie principal; it must never assign a shared
  // file to the active account or import an old unscoped recorder database.
  await login(page,'b');
  // Simulate a legacy worker already installed before the account tab opened.
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.register('/cupcake-sw.js',{scope:'/cupcake'});if(!registration.active)await new Promise(resolve=>{const worker=registration.installing||registration.waiting;worker.addEventListener('statechange',()=>{if(worker.state==='activated')resolve();});});});
  await page.reload();await page.getByText('MyCupcake — Synthetic B',{exact:true}).first().waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const shared=await page.evaluate(async()=>{const form=new FormData();form.set('audio',new File(['synthetic share'],'synthetic.webm',{type:'audio/webm'}));return (await fetch('/cupcake/share',{method:'POST',body:form})).status;});
  assert.equal(shared,409);
  await fixture(page,()=>{window.accountFixture.failLogout=true;});await logout(page);
  await page.getByRole('button',{name:'Retry sign out',exact:true}).waitFor();
  await fixture(page,()=>{window.accountFixture.failLogout=false;});await page.getByRole('button',{name:'Retry sign out',exact:true}).click();
  await page.getByText('Signed out on this browser.',{exact:true}).waitFor();
  await login(page,'a');await page.locator('summary[aria-label="Settings"]').click();
  await page.getByLabel('Current password',{exact:true}).fill('Synthetic password 123!');await page.getByLabel('New password',{exact:true}).fill('Synthetic protected mutation 123!');
  await fixture(page,()=>window.accountFixture.serverOwner('acc_synthetic_b'));
  await page.getByRole('button',{name:'Change password',exact:true}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();
  assert.equal(await fixture(page,()=>localStorage.getItem('synthetic-account-server')),'acc_synthetic_b');
  await requestsSafe(page);
  checks++;console.log('PASS: service-worker share refusal, unconfirmed sign-out retry and protected-mutation context fence');
  await context.close();
} finally {await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log(`PASS: ${checks} synthetic browser account boundary scenarios`);
