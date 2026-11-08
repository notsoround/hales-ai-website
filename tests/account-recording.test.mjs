import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, realpathSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-audio-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-recording',configureServer(server){server.middlewares.use((req,_res,next)=>{if(req.url?.split('?')[0]==='/cupcake/account')req.url='/tests/account-recording-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`,browser=await chromium.launch({headless:true});
let records,calls;
function reset(){records={A:[],B:[]};calls=[];}
const hash=bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const receipt=r=>({id:r.id,title:r.intent.title,mimeType:r.intent.mimeType,createdAt:'2026-11-07T12:00:00Z',status:r.status,partBytes:1048576,totalBytes:r.intent.totalBytes,receivedParts:Object.entries(r.parts).map(([i,b])=>({index:Number(i),size:b.length})),receivedBytes:Object.values(r.parts).reduce((n,b)=>n+b.length,0),originalStored:r.status==='stored',originalBytes:r.status==='stored'?r.intent.totalBytes:null,originalSha256:r.status==='stored'?r.intent.sha256:null});
async function remote(owner,route,body,query,bytes){
  calls.push({owner,route,body,bytes:bytes.length});
  const ok=value=>({status:200,value:{ok:true,...value}}),error=(status,error)=>({status,value:{ok:false,error}});
  if(route==='recordings/start'){
    const existing=records[owner].find(r=>r.intent.uploadId===body.uploadId);
    if(existing){if(JSON.stringify(existing.intent)!==JSON.stringify(body))return error(409,'recording_intent_conflict');return ok({recording:receipt(existing)});}
    const r={id:(records.A.length+records.B.length+1).toString(16).padStart(32,'0'),intent:body,parts:{},status:'uploading'};records[owner].push(r);return ok({recording:receipt(r)});
  }
  if(route==='recordings/list')return ok({recordings:records[owner].filter(r=>r.status==='stored').map(receipt)});
  const params=new URLSearchParams(query),r=records[owner].find(r=>r.id===(body.id||params.get('id')));if(!r)return error(404,'recording_not_found');
  if(route==='recordings/part'){const i=params.get('index');if(r.parts[i]&&hash(r.parts[i])!==hash(bytes))return error(409,'recording_part_conflict');r.parts[i]=bytes;return ok({id:r.id,part:Number(i),received:true,receivedBytes:receipt(r).receivedBytes});}
  if(route==='recordings/finish'){const original=Object.entries(r.parts).sort(([a],[b])=>Number(a)-Number(b)).flatMap(([,b])=>b);if(hash(original)!==r.intent.sha256||original.length!==r.intent.totalBytes)return error(409,'recording_hash_mismatch');r.status='stored';return ok({recording:receipt(r)});}
  if(route==='recordings/get')return ok({recording:receipt(r)});
  throw Error('Unexpected synthetic route '+route);
}
async function open(width=390){const context=await browser.newContext({viewport:{width,height:844}});await context.exposeFunction('syntheticAudioServer',remote);const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>console.error('Synthetic preview:',error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await page.goto(base+'/cupcake/account');await page.getByRole('heading',{name:'Saved audio',exact:true}).waitFor();return{context,page};}
async function importAudio(page,bytes=5){await page.locator('input[type=file]').setInputFiles({name:'Synthetic.webm',mimeType:'audio/webm',buffer:Buffer.alloc(bytes,97)});await page.getByRole('button',{name:'Save audio to account',exact:true}).waitFor();}
const button=page=>page.getByRole('button',{name:'Save audio to account',exact:true});
try{
  reset();const first=await open(),p=first.page;
  await importAudio(p,1048581);assert.equal(calls.filter(c=>c.route==='recordings/start').length,0);assert.equal(await p.getByText('Automatically transcribe recordings and files I choose').count(),0);
  await p.evaluate(()=>{window.audioFixture.behavior='losePart';});await button(p).click();await p.getByRole('button',{name:'Resume upload',exact:true}).waitFor();
  const intent=calls.find(c=>c.route==='recordings/start').body;assert.equal(intent.sha256,hash(Buffer.alloc(1048581,97)));assert.equal(records.A[0].status,'uploading');assert.equal((await p.evaluate(()=>window.audioFixture.locals()))[0].recordingId,undefined);
  await p.getByRole('button',{name:'Resume upload',exact:true}).click();await p.getByText('Original audio verified and saved to your account.',{exact:false}).waitFor();
  assert.equal(calls.filter(c=>c.route==='recordings/part').length,2);assert.deepEqual(calls.filter(c=>c.route==='recordings/start').map(c=>c.body),[intent,intent]);
  const local=await p.evaluate(()=>window.audioFixture.locals());assert.equal(local[0].bytes,1048581);assert.equal(local[0].recordingId,records.A[0].id);
  await p.getByRole('button',{name:'Open saved audio',exact:true}).click();const audio=p.getByLabel('Saved original audio');await audio.waitFor();assert.match(await audio.getAttribute('src'),/^https:\/\/automate.hales.ai\/api\/account\/recordings\/original\?token=/);assert.equal(await audio.getAttribute('crossorigin'),'use-credentials');assert.equal(await audio.getAttribute('preload'),'metadata');
  const digestReads=await p.evaluate(()=>window.audioFixture.digestReads);await p.getByRole('button',{name:'Close saved audio',exact:true}).click();assert.equal(await p.evaluate(()=>window.audioFixture.digestReads),digestReads);assert.ok(await p.evaluate(()=>window.audioFixture.audioStops>0&&window.audioFixture.clearedSources>0));
  await p.getByRole('button',{name:'Listen to saved audio',exact:true}).click();await audio.waitFor();await p.evaluate(()=>window.audioFixture.switchOwner('B'));await p.waitForFunction(()=>!document.querySelector('audio[aria-label="Saved original audio"]'));assert.equal((await p.evaluate(()=>window.audioFixture.locals())).length,0);assert.equal(await p.getByText('Synthetic.webm',{exact:true}).count(),0);
  const safe=await p.evaluate(()=>({blocked:window.audioFixture.blocked,requests:window.audioFixture.requests}));assert.deepEqual(safe.blocked,[]);for(const r of safe.requests){assert.equal(r.headers['x-cupcake-key'],undefined);assert.equal(r.headers['x-cupcake-account-context'],r.owner==='A'?'acc_audio_a':'acc_audio_b');}
  await first.context.close();

  reset();const second=await open(),q=second.page;await importAudio(q);await q.evaluate(()=>{window.audioFixture.behavior='loseFinish';});await button(q).click();await q.getByRole('button',{name:'Resume upload',exact:true}).waitFor();assert.equal(records.A[0].status,'stored');assert.equal((await q.evaluate(()=>window.audioFixture.locals()))[0].recordingId,undefined);await q.getByRole('button',{name:'Resume upload',exact:true}).click();await q.getByText('Original audio verified and saved to your account.',{exact:false}).waitFor();assert.equal(calls.filter(c=>c.route==='recordings/finish').length,1);await second.context.close();

  reset();const third=await open(),r=third.page;await importAudio(r);await r.evaluate(()=>{window.audioFixture.behavior='badReceipt';});await button(r).click();await r.getByRole('button',{name:'Resume upload',exact:true}).waitFor();assert.equal((await r.evaluate(()=>window.audioFixture.locals()))[0].recordingId,undefined);await third.context.close();

  reset();const fourth=await open(),s=fourth.page;await importAudio(s,1048581);await s.evaluate(()=>{window.audioFixture.behavior='holdPart';});await button(s).click();await s.waitForFunction(()=>window.audioFixture.held);await s.evaluate(()=>window.audioFixture.switchOwner('B'));await s.evaluate(()=>window.audioFixture.release());await s.waitForTimeout(100);assert.equal(calls.filter(c=>c.owner==='B'&&c.route!=='recordings/list').length,0);assert.equal(calls.filter(c=>c.route==='recordings/finish').length,0);assert.equal((await s.evaluate(()=>window.audioFixture.locals())).length,0);await fourth.context.close();

  reset();const leave=await open(),u=leave.page;await importAudio(u,1048581);await u.evaluate(()=>{window.audioFixture.behavior='holdPart';});await button(u).click();await u.waitForFunction(()=>window.audioFixture.held);await u.getByRole('button',{name:'Leave recorder',exact:true}).click();await u.evaluate(()=>window.audioFixture.release());await u.waitForTimeout(100);assert.equal(calls.filter(c=>c.route==='recordings/part').length,1);assert.equal(calls.filter(c=>c.route==='recordings/finish').length,0);assert.equal((await u.evaluate(()=>window.audioFixture.locals()))[0].recordingId,undefined);await leave.context.close();

  reset();const fifth=await open(),t=fifth.page;const tooLarge=await t.evaluate(()=>window.audioFixture.run(32*1024*1024+1));assert.match(tooLarge.error,/32 MiB/);assert.equal(calls.filter(c=>c.route==='recordings/start').length,0);await t.evaluate(()=>{window.audioFixture.behavior='off';});await importAudio(t);await button(t).click();await t.getByText('Saving audio to your account is not available yet.',{exact:false}).waitFor();assert.equal((await t.evaluate(()=>window.audioFixture.locals()))[0].recordingId,undefined);await t.evaluate(()=>{window.audioFixture.behavior='wrongEcho';});assert.match(await t.evaluate(()=>window.audioFixture.unsafeEcho()),/did not confirm the current account/);await fifth.context.close();

  reset();const out=path.join(process.cwd(),'output/account-recording-synthetic');mkdirSync(out,{recursive:true});
  for(const width of [320,1280]){const smoke=await open(width);await importAudio(smoke.page);assert.equal(await button(smoke.page).isVisible(),true);const sizes=await smoke.page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(sizes.document<=sizes.viewport,JSON.stringify(sizes));await smoke.page.screenshot({path:path.join(out,`recording-${width}.png`),fullPage:true});await smoke.context.close();}
  console.log('PASS account audio: explicit save, SHA/parts/resume/lost finish, verified receipt, local recovery, owner/late response fences, streamed playback cleanup, caps/unavailable/wrong echo, 320px + 1280px layout. Synthetic only.');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
