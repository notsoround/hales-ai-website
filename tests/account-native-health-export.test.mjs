import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { nativeColumns, emptyNativeData, nativeMetadata } from './native-health-export-fixture.mjs';

// Actual React export controls; real source-produced synthetic JSON/ZIP fixtures only.
// No production account, health store, provider, phone or native authorization is used.
const fixtureRoot = process.env.NATIVE_HEALTH_EXPORT_FIXTURES || path.join(homedir(),'voice-vault/output/native-health-export-2026-11-08/fixtures');
const original = JSON.parse(readFileSync(path.join(fixtureRoot,'native.json'),'utf8'));
const actualFile = original.export || original;
const emptyFile = JSON.parse(readFileSync(path.join(fixtureRoot,'empty.json'),'utf8'));
const A=actualFile.accountId,B=(emptyFile.export || emptyFile).accountId;
assert.notEqual(A,B);
const actualData = actualFile.data.native_health, actualMetadata = actualFile.coverage.sections.native_health.tables;
assert.equal(actualFile.completePrivacyExport,false);assert.equal(actualFile.format,'cupcake.account.local-export.v1');
assert.deepEqual(Object.keys(actualData),Object.keys(nativeColumns));
const actualZIP = readFileSync(path.join(fixtureRoot,'native.zip'));
console.log('SOURCE FIXTURE SHA256',JSON.stringify({json:createHash('sha256').update(readFileSync(path.join(fixtureRoot,'native.json'))).digest('hex'),zip:createHash('sha256').update(actualZIP).digest('hex')}));
const actualZIPManifest = JSON.parse(execFileSync('python3',['-c',"import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(z.read('manifest.json').decode())",path.join(fixtureRoot,'native.zip')],{maxBuffer:8*1024*1024}).toString());
assert.ok(actualData.native_health_batch_chunks.some(chunk=>chunk.bytes===256*1024),'Fixture must exercise a full256KiB native chunk.');
let largeZIP,largeFixture;
function loadLarge(){if(largeFixture)return;largeZIP=readFileSync(path.join(fixtureRoot,'large.zip'));largeFixture=JSON.parse(execFileSync('python3',['-c',"import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;m=json.loads(z.read('manifest.json'));print(json.dumps({'manifest':m,'data':{t:[json.loads(l) for c in i['chunks'] for l in z.read(c['member']).splitlines()] for t,i in m['coverage']['sections']['native_health']['tables'].items()}}))",path.join(fixtureRoot,'large.zip')],{maxBuffer:64*1024*1024}).toString());}
const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-native-health-export-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-native-export',transform(code,id){if(id.endsWith('/tests/account-browser-preview.tsx'))return code.replaceAll('acc_synthetic_a',A).replaceAll('acc_synthetic_b',B);},configureServer(server){server.middlewares.use((request,_response,next)=>{if(request.url?.split('?')[0]==='/cupcake/account')request.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const tables={profile:['accounts'],health:['weight_batches','weight_versions','weight_clients','weight_adjustments','weight_manual_requests','health_manual_observations','body_checkins'],activity:['personal_outcomes','exercise_entries'],food:['food_meals','food_items','food_nutrition_settings'],plans:['coach_plan'],phone:['phone_daily_uploads','phone_daily_heads','ringconn_night_snapshots','ringconn_night_heads'],apple_health:['health_device_grants','health_auto_export_batches','health_auto_export_points'],chat:['quick_chat_threads','quick_chat_turns','quick_chat_attempts'],preferences:['account_personas'],finance:['receipts','receipt_candidate_sets','receipt_matches','recon_events','recon_links','recon_coverage'],library:['documents','overlays','analyses','decisions','projects'],recordings:['recordings','account_audio_transcription_requests','documents'],voice:['account_voice_sessions','documents'],sharing:['coach_invitations','coach_memberships','coach_grants','coach_membership_grants'],source_history:['source_event_receipts','source_event_versions','source_event_heads','source_event_indexed'],native_health:Object.keys(nativeColumns)};
const sections=Object.keys(tables), calls=[],jobs=new Map(),archives=new Map();let mode='json',release;
const excluded=['binary_originals','external_sources','auxiliary_history','authentication_and_operations','other_accounts_and_shared_reports'].map(section=>({section,reason:'excluded',note:'Outside this partial export.'}));
function result(owner,selected){
  if(owner===A&&selected.length===1&&selected[0]==='native_health'&&!['empty','unavailable'].includes(mode))return{export:structuredClone(actualFile),filename:original.filename || 'cupcake-local-data-20261108T120003Z.json',mimeType:'application/json'};
  const data=Object.fromEntries(selected.filter(section=>section!=='native_health'||mode!=='unavailable').map(section=>[section,section==='native_health'?structuredClone(mode==='empty'?emptyNativeData():actualData):Object.fromEntries(tables[section].map(table=>[table,[]]))]));
  const multi=selected.includes('recordings')||selected.includes('source_history');
  const coverage={scope:'owned-local-structured-data',consistentSnapshot:!multi,selectedSections:selected,sections:Object.fromEntries(selected.map(section=>[section,section==='native_health'&&mode==='unavailable'?{status:'unavailable',reason:'owned_native_health_unavailable',tables:{}}:{status:'included',tables:section==='native_health'?nativeMetadata(data[section]):Object.fromEntries(tables[section].map(table=>[table,{rowCount:0,columns:['id'],jsonColumns:[]}]))}])),excluded,notes:['Synthetic fixture: retained original bytes, source estimates and requested-window coverage only.']};
  if(multi)Object.assign(coverage,{consistency:'per-database',sourceSnapshots:[{code:'library',source:'Saved account data',status:'included',consistentSnapshot:true,readAt:'2026-11-08T12:00:00Z'},...(selected.includes('recordings')?[{code:'recordings',source:'Saved recording archive',status:'included',consistentSnapshot:true,readAt:'2026-11-08T12:00:01Z'}]:[]),...(selected.includes('source_history')?[{code:'source_events',source:'Saved source-event journal',status:'included',consistentSnapshot:true,readAt:'2026-11-08T12:00:02Z'}]:[])]});
  return {export:{format:selected.includes('source_history')?'cupcake.account.local-export.v3':selected.includes('recordings')?'cupcake.account.local-export.v2':'cupcake.account.local-export.v1',generatedAt:'2026-11-08T12:00:03Z',accountId:owner,completePrivacyExport:false,coverage,data},filename:'cupcake-local-data-20261108T120003Z.json',mimeType:'application/json'};
}
function mutate(file,fault){
  const info=file.coverage.sections.native_health, data=file.data?.native_health;
  if(fault==='wrongOwner')file.accountId=B;
  if(fault==='missingTable')delete info.tables.native_health_heads;
  if(fault==='secretColumn')info.tables.native_installations.columns.push('access_token_hash');
  if(fault==='unknownTable')info.tables.native_authorizations={rowCount:0,columns:['id'],jsonColumns:[],chunks:[]};
  if(fault==='badJSONColumns')info.tables.native_health_batches.jsonColumns=[];
  if(fault==='badChunkPath')info.tables.native_health_batch_chunks.chunks[0].member='../private.ndjson';
  if(fault==='fakeExtraStore')Object.assign(file.coverage,{consistentSnapshot:false,consistency:'per-database',sourceSnapshots:[{code:'library',source:'Saved account data',status:'included',consistentSnapshot:true,readAt:'2026-11-08T12:00:00Z'},{code:'native_health',source:'Fake store',status:'included',consistentSnapshot:true,readAt:'2026-11-08T12:00:00Z'}]});
  if(fault==='unavailableData'){info.status='unavailable';info.reason='owned_native_health_unavailable';info.tables={};}
  if(fault==='rowSecret')data.native_installations[0].refresh_token='synthetic forbidden field';
  if(fault==='chunkSHA')data.native_health_batch_chunks[0].sha256='0'.repeat(64);
  if(fault==='chunkOffset')data.native_health_batch_chunks[0].byte_offset++;
  if(fault==='chunkIndex')data.native_health_batch_chunks[0].chunk_index=1;
  if(fault==='chunkBase64')data.native_health_batch_chunks[0].data_base64='!invalid!';
  if(fault==='bodySHA')data.native_health_batches[0].body_sha256='0'.repeat(64);
  if(fault==='bodyBytes')data.native_health_batches[0].body_bytes++;
  if(fault==='bodyChunks')data.native_health_batches[0].body_chunk_count++;
  if(fault==='orphanChunk')data.native_health_batch_chunks[0].request_id='orphan_synthetic';
}
function archive(owner,selected,originals=false){
  const key=JSON.stringify([owner,selected,originals,mode==='zipLarge']);if(archives.has(key))return archives.get(key);
  if(mode==='zipLarge')loadLarge();
  if(mode==='zipLarge'&&selected.length===1&&selected[0]==='native_health'&&!originals&&owner===largeFixture.manifest.accountId){const value={data:largeZIP,manifest:largeFixture.manifest,bytes:largeZIP.length,sha256:createHash('sha256').update(largeZIP).digest('hex')};archives.set(key,value);return value;}
  if(selected.length===1&&selected[0]==='native_health'&&!originals&&owner===actualZIPManifest.accountId){const value={data:actualZIP,manifest:actualZIPManifest,bytes:actualZIP.length,sha256:createHash('sha256').update(actualZIP).digest('hex')};archives.set(key,value);return value;}
  const file=result(owner,selected).export;
  const python=`import base64,hashlib,io,json,sys,zipfile
p=json.loads(sys.stdin.read());f=p['file'];coverage=f['coverage'];raw=io.BytesIO();size=0
with zipfile.ZipFile(raw,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for section,entry in coverage['sections'].items():
  for table,info in entry['tables'].items():
   rows=f['data'][section][table];info['chunks']=[]
   if rows:
    b=b''.join((json.dumps(row,separators=(',',':'))+'\\n').encode() for row in rows);member=f'data/{section}/{table}/000001.ndjson';z.writestr(member,b);size+=len(b);info['chunks']=[{'member':member,'rowCount':len(rows),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}]
 if 'sourceSnapshots' not in coverage:coverage.update(consistency='single-database',sourceSnapshots=[{'code':'library','source':'Saved account data','status':'included','consistentSnapshot':True,'readAt':'2026-11-08T12:00:00Z'}])
 coverage['noRowTruncation']=True;m={'format':'cupcake.account.structured-bundle.v1','generatedAt':f['generatedAt'],'accountId':f['accountId'],'completePrivacyExport':False,'recordBytes':size,'coverage':coverage}
 if p['originals']:
  coverage['scope']='owned-local-structured-data-and-selected-originals';coverage['excluded']=[e for e in coverage['excluded'] if e['section']!='binary_originals'];m['originals']={'requested':True,'status':'included','files':[],'includedBytes':0,'unavailableCount':0,'sectionFailures':[]}
 z.writestr('manifest.json',json.dumps(m,separators=(',',':')))
b=raw.getvalue();print(json.dumps({'manifest':m,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'base64':base64.b64encode(b).decode()}))`;
  const value=JSON.parse(execFileSync('python3',['-c',python],{input:JSON.stringify({file,originals}),maxBuffer:24*1024*1024}).toString());value.data=Buffer.from(value.base64,'base64');archives.set(key,value);return value;
}
async function jsonServer(owner,body){calls.push({owner,route:'data',body});if(mode.startsWith('zip'))return{status:413,value:{ok:false,error:'export_too_large'}};const value=result(owner,body.sections);if(mode.startsWith('json:'))mutate(value.export,mode.slice(5));if(mode==='hold')await new Promise(resolve=>{release=resolve;});return{status:200,value:{ok:true,...value}};}
function status(owner,id){const job=jobs.get(owner+':'+id),file=archive(owner,job.sections,job.originals);return{ok:true,id,requestId:id,state:'ready',createdAt:'2026-11-08T12:00:00Z',expiresAt:new Date(Date.now()+3600000).toISOString(),selectedSections:job.sections,...(job.originals?{includeOriginals:true}:{}),error:null,filename:`cupcake-structured-data-${id}.zip`,mimeType:'application/zip',bytes:file.bytes,sha256:file.sha256,manifest:structuredClone(file.manifest)};}
async function bundleServer(owner,route,body){
  calls.push({owner,route,body});const key=owner+':'+body.request_id;
  if(route==='exports/prepare'){assert.ok(!jobs.has(key));jobs.set(key,{sections:body.sections,originals:body.include_originals===true});return{status:202,value:{...status(owner,body.request_id),state:'building',bytes:null,sha256:null,manifest:null},dropResponse:mode==='zipLost'};}
  assert.deepEqual(Object.keys(body),['request_id']);if(!jobs.has(key))return{status:404,value:{ok:false,error:'export_not_found'}};
  if(route==='exports/status'){const value=status(owner,body.request_id);if(mode.startsWith('zip:'))mutate(value.manifest,mode.slice(4));return{status:200,value};}
  assert.equal(route,'exports/download');if(mode==='zipDenied')return{status:401,value:{ok:false,error:'unauthenticated'}};
  const job=jobs.get(key),file=archive(owner,job.sections,job.originals),data=Buffer.from(file.data);if(mode==='zipCorrupt')data[data.length-1]^=1;
  return{status:200,bytes:[...data],headers:{'Content-Type':'application/zip','Content-Length':String(file.bytes),'X-Cupcake-Export-SHA256':file.sha256,'X-Cupcake-Export-Request':body.request_id,'X-Cupcake-Account-Context':owner}};
}
const ui=page=>page.getByRole('region',{name:'Download your data',exact:true});
async function open(browser,width=390){const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});await context.exposeFunction('syntheticExportServer',jsonServer);await context.exposeFunction('syntheticExportBundleServer',bundleServer);// Export acceptance does not repeat the unrelated legacy IndexedDB migration fixture.
await context.addInitScript(()=>sessionStorage.setItem('synthetic-legacy-seeded','1'));const page=await context.newPage();page.setDefaultTimeout(12000);page.on('dialog',dialog=>dialog.accept());const downloads=[],errors=[];page.on('download',download=>downloads.push(download));page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await page.goto(base+'/cupcake/account');try{await page.getByRole('heading',{name:'Sign in to Cupcake',exact:true}).waitFor();}catch(error){console.error(JSON.stringify({errors,body:await page.locator('body').innerText()}));throw error;}return{context,page,downloads,errors};}
async function login(page,owner='a'){await page.getByLabel('Email',{exact:true}).fill(owner+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+owner.toUpperCase(),{exact:true}).first().waitFor();}
async function settings(page){await page.locator('summary[aria-label="Settings"]').click();await page.locator('.cc-settings-group > summary').filter({hasText:'Download my data'}).click();await ui(page).waitFor();}
async function choose(page,selected){await ui(page).locator('.cc-export-picker > summary').filter({hasText:/^Choose sections/}).click();await ui(page).getByRole('button',{name:'Clear selection',exact:true}).click();for(const section of selected)await ui(page).getByRole('checkbox',{name:({native_health:'Android health history',recordings:'Saved recordings and transcripts',source_history:'Saved source-event history',profile:'Account profile'})[section],exact:true}).check();}
const prepare=page=>ui(page).getByRole('button',{name:'Prepare my download',exact:true}).click();
const zipButton=page=>ui(page).getByRole('button',{name:'Download ZIP file',exact:true});
async function jsonDownload(page){const event=page.waitForEvent('download');await ui(page).getByRole('button',{name:'Download JSON file',exact:true}).click();return JSON.parse(readFileSync(await(await event).path(),'utf8'));}
async function safe(test){const state=await test.page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,legacyReads:window.accountFixture.legacyReads}));assert.deepEqual(state.blocked,[]);assert.equal(state.legacyReads,0);assert.deepEqual(test.errors,[]);for(const request of state.requests.filter(item=>item.route.startsWith('exports/')||item.body.action==='account_self_export')){assert.equal(request.credentials,'include');assert.equal(request.headers['x-cupcake-request'],'account');assert.ok([A,B].includes(request.headers['x-cupcake-account-context']));assert.equal(request.headers['x-cupcake-key'],undefined);assert.equal(request.body.owner_id,undefined);}}
const browsers=[];
try{
  for(const [name,type] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.EXPORT_TEST_BROWSER||name===process.env.EXPORT_TEST_BROWSER)){
    const browser=await type.launch({headless:true});browsers.push(browser);
    for(const width of [320,1280]){
      mode='json';const test=await open(browser,width),p=test.page;await login(p);await settings(p);assert.equal(test.downloads.length,0);
      await ui(p).locator('.cc-export-picker > summary').filter({hasText:/^Choose sections/}).click();assert.equal(await ui(p).getByRole('checkbox',{checked:true}).count(),16);
      for(const label of ['Saved recordings and transcripts','Saved voice conversations','Invitations and sharing','Saved source-event history','Android health history','Include original photos and audio'])await ui(p).getByRole('checkbox',{name:label,exact:true}).waitFor();
      await ui(p).getByText('Download originals individually',{exact:true}).waitFor();
      const bounds=await ui(p).evaluate(el=>({content:el.scrollWidth,width:el.clientWidth,page:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(bounds.content<=bounds.width&&bounds.page<=bounds.viewport);
      await prepare(p);await ui(p).getByRole('button',{name:'Download JSON file',exact:true}).waitFor();const file=await jsonDownload(p);assert.equal(file.format,'cupcake.account.local-export.v3');assert.deepEqual(file.coverage.sourceSnapshots.map(source=>source.code),['library','recordings','source_events']);assert.equal(file.coverage.selectedSections.length,16);assert.deepEqual(file.data.native_health,actualData);assert.equal(file.completePrivacyExport,false);
      if(process.env.EXPORT_EVIDENCE_DIR){mkdirSync(process.env.EXPORT_EVIDENCE_DIR,{recursive:true});await ui(p).screenshot({path:path.join(process.env.EXPORT_EVIDENCE_DIR,`${name}-${width}.png`)});}
      await safe(test);await test.context.close();
    }
    console.log(`PASS ${name}: mobile320/desktop1280 retain16-default sections, original/photo/audio controls, same3-store v3 semantics, native byte rows and no horizontal overflow.`);
  }
  const browser=browsers[0];
  for(const [current,selected] of [['json',['native_health']],['json',['recordings','native_health']],['empty',['native_health']],['unavailable',['native_health']]]){
    mode=current;const test=await open(browser),p=test.page;await login(p);await settings(p);await choose(p,selected);await prepare(p);await ui(p).getByRole('button',{name:'Download JSON file',exact:true}).waitFor();const file=await jsonDownload(p);assert.equal(file.format,selected.includes('recordings')?'cupcake.account.local-export.v2':'cupcake.account.local-export.v1');assert.equal(file.coverage.consistentSnapshot,!selected.includes('recordings'));assert.deepEqual(file.coverage.sourceSnapshots?.map(source=>source.code),selected.includes('recordings')?['library','recordings']:undefined);
    if(current==='unavailable'){assert.equal(file.data.native_health,undefined);assert.equal(file.coverage.sections.native_health.status,'unavailable');}else assert.deepEqual(file.data.native_health,current==='empty'?emptyNativeData():actualData);
    await safe(test);await test.context.close();
  }
  console.log('PASS: native-only JSON stays v1/same Library snapshot; included-empty, unavailable and selected records remain distinct.');
  const model=await open(browser);
  const integrity=await model.page.evaluate(async({metadata,data})=>{const m=await import('/src/components/cupcake/accountExportBundle.ts');const valid=await m.validNativeHealthRows(metadata,data),bad=[];for(const [table,field,value]of [['native_health_batch_chunks','sha256','0'.repeat(64)],['native_health_batch_chunks','byte_offset',1],['native_health_batch_chunks','chunk_index',1],['native_health_batch_chunks','data_base64','!invalid!'],['native_health_batches','body_sha256','0'.repeat(64)],['native_health_batches','body_bytes',1],['native_health_batches','body_chunk_count',0],['native_health_batch_chunks','request_id','orphan'],['native_health_record_chunks','sha256','0'.repeat(64)]]){const copy=structuredClone(data);copy[table][0][field]=value;bad.push(await m.validNativeHealthRows(metadata,copy));}return{valid,bad};},{metadata:actualMetadata,data:actualData});assert.equal(integrity.valid,true);assert.ok(integrity.bad.every(value=>value===false));await model.context.close();
  for(const fault of ['wrongOwner','missingTable','secretColumn','unknownTable','badJSONColumns','fakeExtraStore','unavailableData','rowSecret','chunkSHA']){mode='json:'+fault;const test=await open(browser),p=test.page;await login(p);await settings(p);await choose(p,['native_health']);await prepare(p);await ui(p).getByRole('alert').waitFor();assert.equal(test.downloads.length,0);assert.equal(await ui(p).getByRole('button',{name:'Download JSON file',exact:true}).count(),0);await safe(test);await test.context.close();}
  console.log('PASS: actual source byte chunks reassemble; malformed fields/rows/chunk hash-offset-index-base64/body totals/orphans, credential columns, wrong account and invented stores fail closed.');
  for(const [current,selected] of [['zip',['native_health']],['zip',['recordings','native_health']],['zipLarge',['native_health']]]){mode=current;const test=await open(browser),p=test.page;await login(p);await settings(p);await choose(p,selected);await prepare(p);await zipButton(p).waitFor();assert.equal(test.downloads.length,0);const event=p.waitForEvent('download');await zipButton(p).click();const file=await(await event).path();assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),archive(A,selected).sha256);const rows=JSON.parse(execFileSync('python3',['-c',"import hashlib,json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);m=json.loads(z.read('manifest.json'));d={t:[json.loads(l) for c in i['chunks'] for l in z.read(c['member']).splitlines()] for t,i in m['coverage']['sections']['native_health']['tables'].items()};print(json.dumps(d))",file],{maxBuffer:64*1024*1024}).toString());assert.deepEqual(rows,current==='zipLarge'?largeFixture.data:actualData);await safe(test);await test.context.close();}
  for(const fault of ['missingTable','secretColumn','unknownTable','badJSONColumns','badChunkPath']){mode='zip:'+fault;const test=await open(browser),p=test.page;await login(p);await settings(p);await choose(p,['native_health']);await prepare(p);await ui(p).getByRole('alert').waitFor();assert.equal(await zipButton(p).count(),0);await safe(test);await test.context.close();}
  console.log('PASS: JSON overflow prepares explicit verified ZIP; actual source-produced/native-plus-recording archives preserve all7 tables; malformed ZIP native metadata never exposes download.');
  for(const length of [13,14,15])for(const originals of [false,true]){mode='zip';const test=await open(browser),p=test.page;await login(p);const selected=sections.slice(0,length),id=`00000000-0000-4000-8000-00000000${length}${originals?'01':'00'}`;jobs.set(A+':'+id,{sections:selected,originals});const intent={request_id:id,sections:selected,...(originals?{include_originals:true}:{})};await p.evaluate(({owner,intent})=>sessionStorage.setItem('cupcake-account-export-intent-v1:'+owner,JSON.stringify(intent)),{owner:A,intent});const before=calls.length;await p.reload();await p.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await settings(p);await zipButton(p).waitFor();const recovered=calls.slice(before).filter(call=>call.route.startsWith('exports/'));assert.ok(recovered.length>0);assert.ok(recovered.every(call=>call.route==='exports/status'&&call.body.request_id===id));await ui(p).locator('.cc-export-picker > summary').filter({hasText:/^Choose sections/}).click();assert.equal(await ui(p).getByRole('checkbox',{name:'Android health history',exact:true}).isChecked(),false);assert.equal(await ui(p).getByRole('checkbox',{name:'Include original photos and audio',exact:true}).isChecked(),originals);assert.equal(test.downloads.length,0);await safe(test);await test.context.close();}
  console.log('PASS: old13/14/15 intents with either originals option retain exact UUID/selection/option and status-only recovery without native history expansion.');
  mode='hold';const switchTest=await open(browser),s=switchTest.page;await login(s);await settings(s);await choose(s,['native_health']);await prepare(s);await s.getByRole('button',{name:'Close settings',exact:true}).click();await s.getByRole('button',{name:'Sign out of Cupcake',exact:true}).click();await s.getByRole('heading',{name:'Sign in to Cupcake',exact:true}).waitFor();await login(s,'b');release();await settings(s);assert.equal(await ui(s).getByRole('button',{name:'Download JSON file',exact:true}).count(),0);assert.equal(switchTest.downloads.length,0);await safe(switchTest);await switchTest.context.close();
  for(const current of ['zipDenied','zipCorrupt']){mode='zip';const test=await open(browser),p=test.page;await login(p);await settings(p);await choose(p,['native_health']);await prepare(p);await zipButton(p).waitFor();mode=current;await zipButton(p).click();if(current==='zipDenied')await p.getByRole('heading',{name:'Sign in to Cupcake',exact:true}).waitFor();else await ui(p).getByRole('alert').waitFor();assert.equal(test.downloads.length,0);await safe(test);await test.context.close();}
  console.log('PASS: account switch, revoked download and corrupted archive never create a stale or unverifiable file.');
}finally{release?.();await Promise.all(browsers.map(browser=>browser.close()));await server.close();rmSync(cacheDir,{recursive:true,force:true});}
