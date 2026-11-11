import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-coach-vite-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-coach-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const A='acc_synthetic_a',B='acc_synthetic_b',now=Date.now()/1000;
const CLEAN='00000000-0000-4000-8000-000000000101',PHOTO='00000000-0000-4000-8000-000000000102',BOTH='00000000-0000-4000-8000-000000000103';
const grant=(id,scopes,extra={})=>({id,owner_id:A,subject_id:B,scopes,created:now-60,expires:now+3600,revoked:null,ownerDisplayName:'Shared A',subjectDisplayName:'Viewer B',...extra});
const grants=[grant(CLEAN,['clean-report']),grant(PHOTO,['meal-photo']),grant(BOTH,['clean-report','meal-photo']),grant('00000000-0000-4000-8000-000000000104',['clean-report'],{expires:now-1}),grant('00000000-0000-4000-8000-000000000105',['meal-photo'],{revoked:now-1}),grant('00000000-0000-4000-8000-000000000106',['clean-report'],{subject_id:A})];
const requests=[];let denyReport=false,denyPhoto=false,wrongPhotoEcho=false,holdReport,holdPhoto;
const deferred=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
const png=Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lE8AAAAASUVORK5CYII=','base64'));
const coverage=()=>Object.fromEntries(['weight','bodyMeasurements','manualGlucose','exercise','outcomes','steps','ringconnNight','nutrition'].map(key=>[key,{queryComplete:true,rowsRead:key==='nutrition'?1:0,invalidRows:0}]));
function report(g,body){return {version:1,scope:'clean-report',source:'owned_local_ledgers',grantId:g.id,ownerId:g.owner_id,period:{start:body.start,end:body.end,timezone:'America/Chicago'},generatedAt:new Date().toISOString(),
  data:{weight:{daily:[{date:body.end,meanLb:200,minLb:200,maxLb:200,samples:1}],firstLb:200,latestLb:200,changeLb:null,samples:1},bodyMeasurements:null,manualGlucose:null,
    exercise:{daily:[{date:body.end,entries:1,minutes:null,knownDurationEntries:0,missingDurationEntries:1,energyKcal:300}]},outcomes:null,steps:{daily:[{date:body.end,count:0}]},ringconnNight:null,
    nutrition:{daily:[{date:body.end,confirmedMeals:1,partialMeals:1,knownTotals:{calories:{sum:900,mealsWithValue:1,missingMeals:0},protein_g:{sum:null,mealsWithValue:0,missingMeals:1},carbs_g:{sum:70,mealsWithValue:1,missingMeals:0},fat_g:{sum:40,mealsWithValue:1,missingMeals:0},sugar_g:{sum:null,mealsWithValue:0,missingMeals:1}}}]},private_note:'FORBIDDEN PRIVATE NOTE'},coverage:coverage()};}
async function syntheticCoachServer(owner,route,body,query){
  requests.push({owner,route,body:structuredClone(body),query});const ok=value=>({status:200,value:{ok:true,...value}}),denied=()=>({status:403,value:{ok:false,error:'coach_access_denied'}});
  if(route==='coach/grants/received')return ok({grants:grants.filter(g=>g.subject_id===owner)}); // Include expired/revoked rows to exercise defensive filtering too.
  if(route==='coach/grants/list')return ok({grants:grants.filter(g=>g.owner_id===owner)});
  if(route==='coach/grants/revoke'){const g=grants.find(g=>g.id===body.grant_id&&g.owner_id===owner);if(!g)return denied();g.revoked=Date.now()/1000;return ok({revoked:true});}
  const token=query&&new URLSearchParams(query).get('token');
  const g=grants.find(g=>g.id===(route==='coach/meal-photo'?token:body.grant_id)&&g.subject_id===owner&&g.revoked===null&&g.expires>Date.now()/1000);
  if(!g)return denied();
  if(route==='coach/report'){
    if(!g.scopes.includes('clean-report')||denyReport)return denied();const snapshot=report(g,body);if(holdReport){const hold=holdReport;holdReport=undefined;await hold.promise;}return ok({report:snapshot});
  }
  if(!g.scopes.includes('meal-photo'))return denied();
  if(route==='coach/meal-list')return ok({mealPhotos:{entries:[{mealId:'synthetic-meal',savedAt:body.end+'T12:00:00Z',availability:'stored_reference'}],coverage:{queryComplete:true,rowsRead:1,invalidRows:0},dateBasis:'saved_at',source:'owned_saved_meal_originals'}});
  if(route==='coach/meal-photo-url')return ok({url:'/api/account/coach/meal-photo?token='+g.id,expires_at:Date.now()/1000+120});
  if(route==='coach/meal-photo'){if(denyPhoto)return denied();if(holdPhoto){const hold=holdPhoto;holdPhoto=undefined;await hold.promise;}return {status:200,bytes:png,echo:wrongPhotoEcho?A:owner};}
  throw Error('Unknown coach route '+route);
}
async function login(page,who){await page.getByLabel('Email',{exact:true}).fill(who+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+who.toUpperCase(),{exact:true}).first().waitFor();}
async function nav(page,name){await page.getByRole('navigation',{name:'Cupcake',exact:true}).getByRole('button',{name,exact:true}).click();}
async function logout(page){await page.getByRole('button',{name:'Sign out of Cupcake'}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await page.waitForFunction(()=>!document.querySelector('button.cc-primary')?.disabled);}
async function choose(page,id){await page.getByLabel('Authorized owner',{exact:true}).selectOption(id);}
async function safe(page){const s=await page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads}));assert.equal(s.reads,0);assert.deepEqual(s.blocked,[]);for(const r of s.requests.filter(r=>r.route.startsWith('coach/'))){assert.equal(r.credentials,'include');assert.equal(r.headers['x-cupcake-request'],'account');assert.match(r.headers['x-cupcake-account-context'],/^acc_synthetic_[ab]$/);assert.equal(r.headers['x-cupcake-key'],undefined);assert.equal(r.body.owner_id,undefined);assert.equal(r.body.account_id,undefined);}}
try{
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.exposeFunction('syntheticCoachServer',syntheticCoachServer);const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base+'/cupcake/account');await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await login(page,'b');await nav(page,'Reports');
  await page.waitForFunction(()=>document.querySelector('select[aria-label="Authorized owner"]')?.options.length===4);
  await choose(page,CLEAN);await page.getByRole('heading',{name:'Report — Shared A',exact:true}).waitFor();await page.getByRole('heading',{name:'Health numbers',exact:true}).waitFor();
  assert.equal(await page.getByText('FORBIDDEN PRIVATE NOTE',{exact:true}).count(),0);
  const exercise=page.locator('.cc-coach-grid>.cc-card').filter({has:page.getByRole('heading',{name:'Exercise',exact:true})});assert.match(await exercise.innerText(),/unknown/);assert.equal(await exercise.getByRole('cell',{name:'—',exact:true}).count(),1);
  const glucose=page.locator('.cc-coach-empty-row').filter({hasText:'Manual glucose'});await glucose.locator('summary').click();assert.match(await glucose.innerText(),/unknown, not zero/);
  const weight=page.locator('.cc-coach-grid>.cc-card').filter({has:page.getByRole('heading',{name:'Weight',exact:true})});assert.match(await weight.innerText(),/Change lb\n—/);
  assert.equal(requests.filter(r=>r.route==='coach/meal-list').length,0);assert.equal(await page.getByRole('button',{name:'Load photo',exact:true}).count(),0);
  await page.getByLabel('Report end date',{exact:true}).fill('2026-11-01');await page.getByRole('button',{name:'30 days',exact:true}).click();await page.getByRole('heading',{name:'Health numbers',exact:true}).waitFor();
  const lastReport=requests.filter(r=>r.route==='coach/report').at(-1);assert.equal(lastReport.body.end,'2026-11-01');assert.equal(lastReport.body.start,'2026-10-03');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'MyCupcake — Synthetic B',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'Report — Shared A',exact:true}).count(),0);
  await nav(page,'Reports');await choose(page,CLEAN);await page.getByRole('heading',{name:'Health numbers',exact:true}).waitFor();await nav(page,'Assistant');assert.equal(await page.getByRole('heading',{name:'Report — Shared A',exact:true}).count(),0);await page.getByRole('button',{name:'Minimize assistant'}).click();
  console.log('PASS: active discovery, explicit own/report context, numeric/null/provenance coverage, 7/30-day dates and independent clean-report scope');

  await nav(page,'Reports');await choose(page,PHOTO);await page.getByRole('button',{name:'Load photo',exact:true}).waitFor();
  const priorReportCount=requests.filter(r=>r.route==='coach/report').length;
  await page.evaluate(()=>{window.coachRevoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.coachRevoked.push(url);revoke(url);};});
  await page.getByRole('button',{name:'Load photo',exact:true}).click();const image=page.getByRole('img',{name:'Authorized saved meal original',exact:true});await image.waitFor();const url=await image.getAttribute('src');assert.match(url,/^blob:/);assert.equal(requests.filter(r=>r.route==='coach/report').length,priorReportCount);
  await choose(page,CLEAN);await page.getByRole('heading',{name:'Health numbers',exact:true}).waitFor();assert.equal(await page.evaluate(url=>window.coachRevoked.includes(url),url),true);assert.equal(await image.count(),0);
  const invalid=await page.evaluate(async()=>{try{await window.accountFixture.photo('https://evil.invalid/api/account/coach/meal-photo?token=synthetic');return false;}catch{return true;}});assert.equal(invalid,true);
  denyReport=true;await choose(page,BOTH);await page.getByRole('button',{name:'Retry health report',exact:true}).waitFor();await page.getByRole('button',{name:'Load photo',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Health numbers',exact:true}).count(),0);
  denyReport=false;await page.getByRole('button',{name:'Retry health report',exact:true}).click();await page.getByRole('heading',{name:'Health numbers',exact:true}).waitFor();
  denyPhoto=true;await page.getByRole('button',{name:'Load photo',exact:true}).click();await page.getByText('This meal photo is unavailable or its authorization expired. Reload your authorized reports.',{exact:true}).waitFor();assert.equal(await image.count(),0);
  denyPhoto=false;wrongPhotoEcho=true;await page.getByRole('button',{name:'Load photo',exact:true}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();wrongPhotoEcho=false;
  console.log('PASS: independent photo permission, authenticated blob-only images, URL cleanup, refusals and wrong binary principal echo locks');

  await login(page,'b');await nav(page,'Reports');const delayed=deferred();holdReport=delayed;await choose(page,BOTH);await page.getByRole('button',{name:'Load photo',exact:true}).waitFor();const photoDelay=deferred();holdPhoto=photoDelay;const priorBinary=requests.filter(r=>r.route==='coach/meal-photo').length;await page.getByRole('button',{name:'Load photo',exact:true}).click();
  await page.waitForFunction(previous=>window.accountFixture.requests.filter(r=>r.route==='coach/meal-photo').length>previous,priorBinary);
  await logout(page);await login(page,'a');delayed.release();photoDelay.release();await nav(page,'Reports');
  await page.getByRole('tab',{name:/^Shared with me/}).click();await page.getByText('No active reports have been shared with this account.',{exact:false}).waitFor();assert.equal(await image.count(),0);assert.equal(await page.getByRole('heading',{name:'Health numbers',exact:true}).count(),0);
  await page.getByRole('tab',{name:'My sharing & clients',exact:true}).click();
  await page.getByRole('button',{name:'Sharing you authorized',exact:true}).click();const cleanShare=page.locator('.cc-coach>section.cc-card article').filter({hasText:'Health report'}).filter({hasNotText:'Meal photos'}).first();await cleanShare.getByRole('button',{name:'Revoke sharing',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cc-coach')?.textContent.includes('Revoked'));
  assert.ok(grants.find(g=>g.id===CLEAN).revoked);
  await logout(page);await login(page,'b');await nav(page,'Reports');await page.waitForFunction(()=>document.querySelector('select[aria-label="Authorized owner"]')?.options.length===3);assert.equal(await page.locator(`option[value="${CLEAN}"]`).count(),0);
  await page.setViewportSize({width:1280,height:900});await choose(page,BOTH);await page.getByRole('heading',{name:'Health numbers',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Load photo',exact:true}).click();await image.waitFor();const finalUrl=await image.getAttribute('src');await logout(page);assert.equal(await page.evaluate(url=>window.coachRevoked.includes(url),finalUrl),true);assert.equal(await image.count(),0);
  await safe(page);await context.close();
  console.log('PASS: stale old-account report/photo results discarded, own sharing list/revoke and revoked discovery refresh');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log('PASS: 3 synthetic coach browser scenarios');
