import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-feed-vite-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-account-feed-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const A='acc_synthetic_a',B='acc_synthetic_b';
const requests=[];let holdA,wrongSource=false,unavailable=false,emptyB=false;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const deferred=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
const personal=owner=>({wins:owner===A?2:5,losses:owner===A?1:0,unscored:1,total:owner===A?4:6});
const workouts=new Map([[A,new Map()],[B,new Map()]]);
const item=(owner,id,date= today)=>({id:owner+':'+id,type:'glucose',date,time:'08:30',ts:Date.parse(date+'T14:30:00Z'),icon:'💧',title:(owner===A?'A':'B')+' saved '+id,body:'Synthetic owned local evidence'});
async function syntheticFeedServer(owner,body){
  requests.push({owner,body:structuredClone(body)});
  if(body.action==='exercise_list')return {status:200,value:{ok:true,entries:[...workouts.get(owner).values()]}};
  if(body.action==='exercise_log'){
    const entry={id:body.requestId,description:body.description,performedAt:body.performedAt,minutes:body.minutes,kcal:body.kcal,basis:body.basis,items:body.items||[]};
    workouts.get(owner).set(entry.id,entry);return {status:200,value:{ok:true,entry}};
  }
  if(body.action==='exercise_delete')return {status:200,value:{ok:true,deleted:workouts.get(owner).delete(body.id)}};
  if(body.action==='outcome_list')return {status:200,value:{ok:true,entries:[],nextCursor:null,counts:emptyB&&owner===B?{wins:0,losses:0,unscored:0,total:0}:personal(owner)}};
  if(unavailable)return {status:503,value:{ok:false,error:'account_action_not_ready'}};
  const history=body.scope==='history',end=body.end||today,start=history?'1970-01-01':body.start||shift(end,-29);
  const title=wrongSource?'REJECTED PRIVATE SOURCE':history?body.cursor?'history older':'history newest':'local timeline';
  const items=emptyB&&owner===B?[]:[item(owner,title,end),...(history?[]:[{...item(owner,'purchase',end),type:'transaction',amount:9,currency:null,title:(owner===A?'A':'B')+' saved purchase',body:'Saved amount, currency unknown; this is not a meal.'}])];
  if(!history&&!(emptyB&&owner===B)){
    items.push({...item(owner,'feed-only-workout',end),type:'exercise',title:(owner===A?'A':'B')+' feed-only workout',body:'25 min · 180 kcal · owner-reported exercise estimate',details:{id:'only-in-feed',minutes:25,kcal:180,estimated:true}});
    for(const entry of workouts.get(owner).values())items.push({...item(owner,'exercise-'+entry.id,end),type:'exercise',title:entry.description,body:entry.minutes+' min · owner-reported exercise estimate',details:entry});
  }
  const value={ok:true,items,nextCursor:history&&!body.cursor?'synthetic-'+owner+'-page2':null,
    totals:{calories:null,spendUsd:null,loggedSpendUsd:9,foodCount:null,transactionCount:null,weightLb:null,weightDate:'',caloriesPartial:null},
    daily:history?[]:[{date:end,calories:null,spendUsd:null,foodCount:null,transactionCount:null}],
    outcomes:{wins:null,losses:null,missed:null,unscored:null,interventions:null},personalOutcomes:emptyB&&owner===B?null:personal(owner),
    coverage:{start,end,timezone:'America/Chicago',scope:history?'history':'range',source:wrongSource?'legacy-private-feed':'owned-local-ledgers',complete:false,localComplete:false,returnedCount:items.length,totalCount:null,
      spendSource:'Owned local reconciliation (no refresh)',notes:['Saved local evidence only. Private Sheet, CGM, bank refresh and purchase-call history are unavailable in account mode.','Some local components are unavailable; missing totals are not zero intake or spending.']}};
  if(owner===A&&holdA)await holdA.promise; // Deliberately ignore AbortSignal: the real generation fence must reject.
  return {status:200,value};
}
async function open(context){await context.exposeFunction('syntheticFeedServer',syntheticFeedServer);const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await page.goto(base+'/cupcake/account');await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();return page;}
async function login(page,who){await page.getByLabel('Email',{exact:true}).fill(who+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+who.toUpperCase(),{exact:true}).first().waitFor();}
async function logout(page){const minimize=page.getByRole('button',{name:'Minimize assistant'});if(await minimize.isVisible())await minimize.click();await page.getByRole('button',{name:'Sign out of Cupcake'}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await page.waitForFunction(()=>!document.querySelector('button.cc-primary')?.disabled);}
async function dashboard(page){await page.getByRole('button',{name:'All signals',exact:true}).click();await page.getByRole('region',{name:'Cupcake dashboard',exact:true}).waitFor();}
async function safe(page){const s=await page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads}));assert.equal(s.reads,0);assert.deepEqual(s.blocked,[]);const feeds=s.requests.filter(r=>r.body.action==='feed_get');assert.ok(feeds.length);for(const r of feeds){assert.equal(r.route,'data');assert.equal(r.credentials,'include');assert.equal(r.headers['x-cupcake-request'],'account');assert.match(r.headers['x-cupcake-account-context'],/^acc_synthetic_[ab]$/);assert.equal(r.headers['x-cupcake-key'],undefined);assert.equal(r.headers.authorization,undefined);assert.equal(r.body.owner_id,undefined);assert.equal(r.body.account_id,undefined);}return feeds;}
try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await open(context);await login(page,'a');
  await page.getByText('A saved local timeline',{exact:true}).waitFor();await page.locator('.cc-account-outcome-summary').getByText('2',{exact:true}).waitFor();
  assert.match(await page.locator('.cc-account-outcome-summary').innerText(),/1 personal losses/);assert.match(await page.locator('.cc-account-outcome-summary').innerText(),/Phone purchase-call outcomes are not connected/);
  assert.equal(await page.getByText('B saved local timeline',{exact:true}).count(),0);
  assert.ok(requests.some(r=>r.owner===A&&r.body.action==='feed_get'&&r.body.start===today&&r.body.end===today));
  const timeline=page.locator('.cc-signals');
  assert.equal(await timeline.getByText('A feed-only workout',{exact:true}).count(),1);
  assert.equal(await page.locator('.cc-exercise-list').getByText('A feed-only workout',{exact:true}).count(),0);
  const todayFeeds=()=>requests.filter(r=>r.owner===A&&r.body.action==='feed_get'&&r.body.start===today&&r.body.end===today).length;
  const beforeLog=todayFeeds();await page.locator('.cc-quick').getByRole('button',{name:'Log exercise',exact:true}).click();
  await page.getByLabel('What did you do?',{exact:true}).fill('20 min rowing');await page.locator('.cc-exercise-form').getByRole('button',{name:'Save',exact:true}).click();
  await timeline.getByText('20 min rowing',{exact:true}).waitFor();assert.ok(todayFeeds()>beforeLog);assert.equal(await timeline.getByText('20 min rowing',{exact:true}).count(),1);assert.equal(await timeline.getByText('A feed-only workout',{exact:true}).count(),1);
  const beforeUndo=todayFeeds();await page.locator('.cc-exercise-list li').filter({hasText:'20 min rowing'}).getByRole('button',{name:'Undo',exact:true}).click();
  await timeline.getByText('20 min rowing',{exact:true}).waitFor({state:'detached'});await timeline.getByText('A feed-only workout',{exact:true}).waitFor();assert.ok(todayFeeds()>beforeUndo);assert.equal(workouts.get(A).size,0);assert.equal(await timeline.getByText('A feed-only workout',{exact:true}).count(),1);
  assert.equal(requests.filter(r=>r.owner===A&&r.body.action==='exercise_log').length,1);assert.equal(requests.filter(r=>r.owner===A&&r.body.action==='exercise_delete').length,1);
  await dashboard(page);const dash=page.getByRole('region',{name:'Cupcake dashboard',exact:true});
  await dash.getByRole('heading',{name:'Purchase-call outcomes unavailable',exact:true}).waitFor();
  const calories=dash.getByRole('button',{name:/Calories unavailable.*View food/}),spend=dash.getByRole('button',{name:/Spend unavailable.*View transactions/});
  assert.equal(await calories.locator('strong').innerText(),'—');assert.equal(await spend.locator('strong').innerText(),'—');
  await spend.click();await page.getByRole('heading',{name:'Saved transactions',exact:true}).waitFor();await page.getByRole('button',{name:/A saved purchase/}).waitFor();await page.getByRole('button',{name:'Back to dashboard',exact:true}).click();
  assert.equal(await dash.locator('[aria-label="Recorded intervention outcomes"]').count(),0);
  await dash.getByRole('button',{name:new RegExp(today+': Calories unavailable, spend unavailable')}).waitFor();
  await dash.getByRole('button',{name:/A saved purchase/}).click();await page.getByText('Currency unknown 9.00',{exact:true}).waitFor();assert.equal(await page.getByText('$9.00',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Back to dashboard',exact:true}).click();
  await dash.getByRole('tab',{name:'Last 30 days',exact:true}).click();await dash.getByText('A saved local timeline',{exact:true}).waitFor();
  assert.ok(requests.some(r=>r.body.action==='feed_get'&&r.body.start===shift(today,-29)&&r.body.end===today));
  await dash.getByRole('tab',{name:'Custom',exact:true}).click();await page.getByLabel('From',{exact:true}).fill('2026-11-01');await page.getByLabel('Through',{exact:true}).fill('2026-11-05');
  await page.waitForFunction(()=>window.accountFixture.requests.some(r=>r.body.action==='feed_get'&&r.body.start==='2026-11-01'&&r.body.end==='2026-11-05'));
  await dash.getByRole('tab',{name:'All time',exact:true}).click();await dash.getByText('A saved history newest',{exact:true}).waitFor();await dash.getByRole('button',{name:'Load older records',exact:true}).click();await dash.getByText('A saved history older',{exact:true}).waitFor();
  assert.ok(requests.some(r=>r.owner===A&&r.body.scope==='history'&&r.body.cursor==='synthetic-'+A+'-page2'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await safe(page);
  console.log('PASS: authoritative workouts and synthetic add/undo feed refresh; own range/history, nullable totals and unknown-currency drilldown');

  await logout(page);const delayed=deferred();holdA=delayed;await login(page,'a');await page.getByRole('navigation',{name:'Cupcake',exact:true}).getByRole('button',{name:'Today',exact:true}).click();
  await page.evaluate(()=>{window.feedResult=null;window.feedError='';void window.accountFixture.feed({start:'2026-11-01',end:'2026-11-01'}).then(value=>{window.feedResult=value;},error=>{window.feedError=error.name;});});
  await page.waitForFunction(()=>window.accountFixture.requests.some(r=>r.body.action==='feed_get'&&r.body.start==='2026-11-01'&&r.body.end==='2026-11-01'));
  await logout(page);await login(page,'b');await page.getByRole('navigation',{name:'Cupcake',exact:true}).getByRole('button',{name:'Today',exact:true}).click();await page.getByText('B saved local timeline',{exact:true}).waitFor();await page.locator('.cc-account-outcome-summary').getByText('5',{exact:true}).waitFor();
  holdA=undefined;delayed.release();await page.waitForFunction(()=>window.feedError==='AbortError');assert.equal(await page.evaluate(()=>window.feedResult),null);assert.equal(await page.getByText('A saved local timeline',{exact:true}).count(),0);
  emptyB=true;await dashboard(page);await dash.getByRole('heading',{name:'Some saved records are unavailable',exact:true}).waitFor();assert.equal(await dash.getByRole('heading',{name:'Nothing saved in this range yet',exact:true}).count(),0);assert.equal(await dash.getByRole('button',{name:/Saves · times you resisted/}).count(),0);
  await safe(page);console.log('PASS: A/B late responses and cached summaries do not cross identities; unavailable empty ledgers do not become zero evidence');

  emptyB=false;wrongSource=true;await page.getByRole('button',{name:'Back to Today',exact:true}).click();await page.locator('.cc-signals [role="alert"]').waitFor();
  assert.equal(await page.getByText('B saved REJECTED PRIVATE SOURCE',{exact:true}).count(),0);
  const rejected=await page.evaluate(async()=>{try{await window.accountFixture.feed({scope:'history'});return '';}catch(error){return error.message;}});assert.equal(rejected,'The account feed source was not confirmed.');
  wrongSource=false;unavailable=true;await page.locator('.cc-signals').getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.cc-signals [role="alert"]').waitFor();assert.equal(await page.getByText('B saved local timeline',{exact:true}).count(),0);
  unavailable=false;await page.locator('.cc-signals').getByRole('button',{name:'Retry',exact:true}).click();await page.getByText('B saved local timeline',{exact:true}).waitFor();await safe(page);
  await context.close();console.log('PASS: wrong source and unavailable backend refuse data without owner-key/private-webhook fallback, then retry recovers');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log('PASS: 3 synthetic account feed browser scenarios');
