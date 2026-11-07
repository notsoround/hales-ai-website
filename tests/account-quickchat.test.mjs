import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-quickchat-vite-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-quickchat-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const A='acc_synthetic_a',B='acc_synthetic_b',OLD_A='00000000-0000-4000-8000-000000000201',OLD_B='00000000-0000-4000-8000-000000000202';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const old=(id,who)=>({id,title:who+' private saved conversation',turns:[{id:id+'-turn',text:who+' saved private question',status:'completed',retryAfter:0,response:{ok:true,reply:who+' saved private answer',model:'synthetic-local'}}]});
const histories=new Map([[A,new Map([[OLD_A,old(OLD_A,'A')]])],[B,new Map([[OLD_B,old(OLD_B,'B')]])]]);
const requests=[];let complete=false,failBegin=false;
async function syntheticQuickChatServer(owner,body){
  requests.push({owner,body:structuredClone(body)});const ok=value=>({status:200,value:{ok:true,...structuredClone(value)}});
  const fields=expected=>assert.deepEqual(Object.keys(body).sort(),['action',...expected].sort());
  const history=histories.get(owner);
  if(body.action==='quick_chat_list'){fields([]);return ok({threads:[...history.values()].map(({id,title})=>({id,title}))});}
  assert.equal(typeof body.threadId,'string');
  if(body.action==='quick_chat_create'){fields(['threadId','title']);assert.match(body.threadId,uuid);if(!history.has(body.threadId))history.set(body.threadId,{id:body.threadId,title:body.title,turns:[]});return ok({thread:history.get(body.threadId)});}
  const thread=history.get(body.threadId);if(!thread)return {status:404,value:{ok:false,error:'not_found'}};
  if(body.action==='quick_chat_get'){
    fields(['threadId']);if(complete)for(const turn of thread.turns)if(turn.status==='queued'){turn.status='completed';turn.response={ok:true,reply:(owner===A?'A':'B')+' completed simulated reply',model:'synthetic-server',recordsUnavailable:true};}
    return ok({thread});
  }
  if(body.action==='quick_chat_cancel'){fields(['threadId','turnId']);return ok({thread,execution:'server'});}
  assert.equal(body.action,'quick_chat_begin','The UI must never complete/fail a server-owned attempt.');
  fields(['threadId','turnId','text','parentTurnId',...(body.regenerate?['regenerate','requestId']:[])]);assert.match(body.turnId,uuid);
  if(body.regenerate){assert.equal(body.regenerate,true);assert.match(body.requestId,uuid);}else assert.equal(body.requestId,undefined);
  if(failBegin)return {status:503,value:{ok:false,error:'account_action_not_ready'}};
  assert.equal(body.parentTurnId,thread.turns.at(-1)?.id||null);
  if(!thread.turns.some(turn=>turn.id===body.turnId))thread.turns.push({id:body.turnId,text:body.text,status:'queued',retryAfter:0});
  return ok({thread,acquired:true,execution:'server',attemptId:'00000000-0000-4000-8000-000000000299'});
}
async function open(context){await context.exposeFunction('syntheticQuickChatServer',syntheticQuickChatServer);const page=await context.newPage();page.setDefaultTimeout(12000);page.on('dialog',dialog=>dialog.accept());await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await page.goto(base+'/cupcake/account');await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();return page;}
async function login(page,who){await page.getByLabel('Email',{exact:true}).fill(who+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+who.toUpperCase(),{exact:true}).first().waitFor();}
async function assistant(page){await page.getByRole('navigation',{name:'Cupcake',exact:true}).getByRole('button',{name:'Assistant',exact:true}).click();await page.getByLabel('Message Cupcake',{exact:true}).waitFor();}
async function logout(page){const minimize=page.getByRole('button',{name:'Minimize assistant'});if(await minimize.isVisible())await minimize.click();await page.getByRole('button',{name:'Sign out of Cupcake'}).click();await page.getByRole('heading',{name:'Sign in to Cupcake'}).waitFor();await page.waitForFunction(()=>!document.querySelector('button.cc-primary')?.disabled);}
async function safe(page){const value=await page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads}));assert.equal(value.reads,0);assert.deepEqual(value.blocked,[]);const calls=value.requests.filter(r=>String(r.body.action).startsWith('quick_chat_'));assert.ok(calls.length);for(const r of calls){assert.equal(r.route,'data');assert.equal(r.credentials,'include');assert.equal(r.headers['x-cupcake-request'],'account');assert.match(r.headers['x-cupcake-account-context'],/^acc_synthetic_[ab]$/);assert.equal(r.headers['x-cupcake-key'],undefined);assert.equal(r.body.owner_id,undefined);assert.equal(r.body.account_id,undefined);assert.ok(['quick_chat_list','quick_chat_get','quick_chat_create','quick_chat_begin','quick_chat_cancel'].includes(r.body.action));}return calls;}
try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await open(context);await login(page,'a');await assistant(page);
  await page.getByRole('option',{name:'A private saved conversation',exact:true}).waitFor({state:'attached'});const composer=page.getByLabel('Message Cupcake',{exact:true}),saved=page.getByLabel('Saved conversations',{exact:true});
  await composer.fill('Queue this synthetic question');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Your reply is being prepared on the server. You can close this page.',{exact:true}).waitFor();
  const sent=requests.find(r=>r.body.action==='quick_chat_begin');assert.ok(sent);const newId=sent.body.threadId;assert.equal(await composer.inputValue(),'');assert.equal(await page.getByText('A completed simulated reply',{exact:true}).count(),0);
  await page.reload();await page.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await page.getByText('Your reply is being prepared on the server. You can close this page.',{exact:true}).waitFor();
  assert.equal(await saved.inputValue(),newId);complete=true;await page.getByText('A completed simulated reply',{exact:true}).waitFor();
  assert.equal(requests.filter(r=>r.body.action==='quick_chat_begin').length,1);assert.equal(requests.filter(r=>r.body.action==='quick_chat_create').length,1);assert.ok(requests.filter(r=>r.body.action==='quick_chat_get'&&r.body.threadId===newId).length>=2);
  await page.getByText("Some of your records couldn't be read for this answer, so it may be missing details.",{exact:true}).waitFor();await safe(page);
  console.log('PASS: queued server execution survives actual-root reload, polls to completed and never calls browser completion/failure');

  await composer.fill('A unsent confidential draft');await logout(page);await login(page,'b');await assistant(page);
  await page.getByRole('option',{name:'B private saved conversation',exact:true}).waitFor({state:'attached'});assert.equal(await composer.inputValue(),'');assert.equal(await page.getByRole('option',{name:'A private saved conversation',exact:true}).count(),0);assert.equal(await page.getByText('A completed simulated reply',{exact:true}).count(),0);
  await saved.selectOption(OLD_B);await page.getByText('B saved private answer',{exact:true}).waitFor();await composer.fill('B unsent private draft');await logout(page);await login(page,'a');await assistant(page);
  await page.getByRole('option',{name:'A private saved conversation',exact:true}).waitFor({state:'attached'});assert.equal(await composer.inputValue(),'A unsent confidential draft');assert.equal(await page.getByRole('option',{name:'B private saved conversation',exact:true}).count(),0);assert.equal(await page.getByText('B saved private answer',{exact:true}).count(),0);
  await saved.selectOption(newId);await page.getByText('A completed simulated reply',{exact:true}).waitFor();await safe(page);
  console.log('PASS: A/B private server history and browser drafts stay isolated across same-tab identity switches');

  await page.getByRole('button',{name:'New',exact:true}).click();failBegin=true;await composer.fill('Unavailable synthetic request');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('alert').filter({hasText:'This feature is not available for account sign-in yet.'}).waitFor();
  assert.equal(await composer.inputValue(),'Unavailable synthetic request');assert.equal(await page.getByText('A completed simulated reply',{exact:true}).count(),0);assert.equal(requests.filter(r=>r.body.action==='quick_chat_begin'&&r.body.text==='Unavailable synthetic request').length,1);
  const before=requests.length;const rejections=await page.evaluate(async()=>{const results=[];for(const action of ['quick_chat_complete','quick_chat_fail'])try{await window.accountFixture.request({action});results.push(false);}catch{results.push(true);}return results;});assert.deepEqual(rejections,[true,true]);assert.equal(requests.length,before);
  await safe(page);await context.close();console.log('PASS: 503 keeps the unsent draft and honest error; direct completion/failure actions refuse before transport with no fallback');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log('PASS: 3 synthetic account Quick Chat browser scenarios');
