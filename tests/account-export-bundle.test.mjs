import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-export-bundle-browser-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-bundle-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(req.url?.split('?')[0]==='/cupcake/account')req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const A='acc_synthetic_a',B='acc_synthetic_b';
const tableNames={profile:['accounts'],health:['weight_batches','weight_versions','weight_clients','weight_adjustments','weight_manual_requests','health_manual_observations','body_checkins'],activity:['personal_outcomes','exercise_entries'],food:['food_meals','food_items','food_nutrition_settings'],plans:['coach_plan'],phone:['phone_daily_uploads','phone_daily_heads','ringconn_night_snapshots','ringconn_night_heads'],apple_health:['health_device_grants','health_auto_export_batches','health_auto_export_points'],chat:['quick_chat_threads','quick_chat_turns','quick_chat_attempts'],preferences:['account_personas'],finance:['receipts','receipt_candidate_sets','receipt_matches','recon_events','recon_links','recon_coverage'],library:['documents','overlays','analyses','decisions','projects'],recordings:['recordings','account_audio_transcription_requests','documents'],voice:['account_voice_sessions','documents']};
const sections=Object.keys(tableNames),calls=[],jobs=new Map();let mode='normal',release;
const python=`import base64,hashlib,io,json,sys,zipfile
p=json.loads(sys.argv[1]);output={}
for owner in p['owners']:
 raw=io.BytesIO();coverage={};record_bytes=0
 with zipfile.ZipFile(raw,'w',compression=zipfile.ZIP_DEFLATED) as z:
  for section,tables in p['tables'].items():
   coverage[section]={'status':'included','tables':{}}
   for table in tables:
    chunks=[];rows=0;columns=['id'];json_columns=[]
    if table=='food_meals':
     columns=['id','body'];json_columns=['body'];lines=[];size=0
     for index in range(20137):
      line=(json.dumps({'id':'meal_'+str(index).zfill(8),'body':json.dumps({'source':'synthetic owner statement','unknown':None,'known':0,'text':'x'*500})},separators=(',',':'))+'\\n').encode()
      if size+len(line)>4*1024*1024:
       data=b''.join(lines);member=f'data/{section}/{table}/{len(chunks)+1:06}.ndjson';z.writestr(member,data);chunks.append({'member':member,'rowCount':len(lines),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});record_bytes+=len(data);lines=[];size=0
      lines.append(line);size+=len(line);rows+=1
     if lines:
      data=b''.join(lines);member=f'data/{section}/{table}/{len(chunks)+1:06}.ndjson';z.writestr(member,data);chunks.append({'member':member,'rowCount':len(lines),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});record_bytes+=len(data)
    coverage[section]['tables'][table]={'rowCount':rows,'columns':columns,'jsonColumns':json_columns,'chunks':chunks}
  manifest={'format':'cupcake.account.structured-bundle.v1','generatedAt':'2026-11-08T12:00:02Z','accountId':owner,'completePrivacyExport':False,'recordBytes':record_bytes,'coverage':{'scope':'owned-local-structured-data','consistentSnapshot':False,'consistency':'per-database','sourceSnapshots':[{'code':'library','source':'Saved account data','status':'included','consistentSnapshot':True,'readAt':'2026-11-08T12:00:00Z'},{'code':'recordings','source':'Saved recording archive','status':'included','consistentSnapshot':True,'readAt':'2026-11-08T12:00:01Z'}],'selectedSections':list(p['tables']),'sections':coverage,'excluded':[{'section':name,'reason':'excluded','note':note} for name,note in [('binary_originals','Original photo, receipt and recording bytes are excluded.'),('external_sources','External provider copies and refreshes are excluded.'),('auxiliary_history','Auxiliary stores and unsent drafts are excluded.'),('authentication_and_operations','Credentials and session controls are excluded.'),('other_accounts_and_shared_reports','Other accounts and shared reports are excluded.')]],'notes':['Synthetic structured records only; speech and AI estimates retain their meaning.'],'noRowTruncation':True}}
  z.writestr('manifest.json',json.dumps(manifest,separators=(',',':')))
 data=raw.getvalue();output[owner]={'manifest':manifest,'base64':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
print(json.dumps(output))`;
const archives=JSON.parse(execFileSync('python3',['-c',python,JSON.stringify({owners:[A,B],tables:tableNames})],{maxBuffer:4*1024*1024}).toString());
for(const archive of Object.values(archives)){archive.data=Buffer.from(archive.base64,'base64');assert.equal(archive.sha256,createHash('sha256').update(archive.data).digest('hex'));assert.ok(archive.manifest.recordBytes>8*1024*1024);}
function status(owner,id,state='ready') {
 const archive=archives[owner];return {ok:true,id,requestId:id,state,createdAt:'2026-11-08T12:00:00Z',expiresAt:new Date(Date.now()+3600000).toISOString(),selectedSections:sections,error:state==='expired'?'export_expired':state==='failed'?'export_raw_limit':null,filename:`cupcake-structured-data-${id}.zip`,mimeType:'application/zip',bytes:state==='ready'?archive.bytes:null,sha256:state==='ready'?archive.sha256:null,manifest:state==='ready'?structuredClone(archive.manifest):null};
}
function small(owner,chosen) {
 const coverage={scope:'owned-local-structured-data',consistentSnapshot:!chosen.includes('recordings'),selectedSections:chosen,sections:Object.fromEntries(chosen.map(section=>[section,{status:'included',tables:{}}])),excluded:[],notes:[]};
 if(chosen.includes('recordings'))Object.assign(coverage,{consistency:'per-database',sourceSnapshots:archives[owner].manifest.coverage.sourceSnapshots});
 return {ok:true,export:{format:chosen.includes('recordings')?'cupcake.account.local-export.v2':'cupcake.account.local-export.v1',generatedAt:'2026-11-08T12:00:00Z',accountId:owner,completePrivacyExport:false,coverage,data:Object.fromEntries(chosen.map(section=>[section,{}]))},filename:'cupcake-local-data-20261108T120000Z.json',mimeType:'application/json'};
}
async function jsonServer(owner,body){calls.push({owner,route:'data',body});return mode==='small'?{status:200,value:small(owner,body.sections)}:{status:413,value:{ok:false,error:'export_too_large'}};}
async function bundleServer(owner,route,body) {
 calls.push({owner,route,body});assert.deepEqual(Object.keys(body).sort(),route==='exports/prepare'?['request_id','sections']:['request_id']);assert.match(body.request_id,/^[a-f0-9-]{36}$/);
 const key=owner+':'+body.request_id;
 if(route==='exports/prepare') {
  assert.deepEqual(body.sections,sections);assert.ok(!jobs.has(key),'No duplicate preparation');jobs.set(key,{owner,id:body.request_id});
  if(mode==='lostPrepare')return {status:202,value:status(owner,body.request_id,'building'),dropResponse:true};
  return {status:202,value:status(owner,body.request_id,'building')};
 }
 if(!jobs.has(key))return {status:404,value:{ok:false,error:'export_not_found'}};
 if(route==='exports/status') {
  if(mode==='notFound')return {status:404,value:{ok:false,error:'export_not_found'}};
  if(mode==='holdStatus')await new Promise(resolve=>{release=resolve;});
  const result=status(owner,body.request_id,mode==='expired'?'expired':mode==='failed'?'failed':'ready');
  if(mode==='wrongManifest')result.manifest.accountId=owner===A?B:A;
  if(mode==='badMember')result.manifest.coverage.sections.food.tables.food_meals.chunks[0].member='../private.json';
  if(mode==='badCount')result.manifest.coverage.sections.food.tables.food_meals.rowCount--;
  if(mode==='badConsistency')result.manifest.coverage.consistentSnapshot=true;
  return {status:200,value:result};
 }
 assert.equal(route,'exports/download');
 if(mode==='revoked')return {status:401,value:{ok:false,error:'unauthenticated'}};
 const archive=archives[owner],bytes=Buffer.from(archive.data),headers={'Content-Type':'application/zip','Content-Length':String(archive.bytes),'X-Cupcake-Export-SHA256':archive.sha256,'X-Cupcake-Export-Request':body.request_id,'X-Cupcake-Account-Context':owner};
 if(mode==='wrongBinaryOwner')headers['X-Cupcake-Account-Context']=owner===A?B:A;
 if(mode==='wrongRequest')headers['X-Cupcake-Export-Request']='00000000-0000-4000-8000-000000000001';
 if(mode==='wrongSHA')headers['X-Cupcake-Export-SHA256']='0'.repeat(64);
 if(mode==='badLength')headers['Content-Length']=String(archive.bytes-1);
 if(mode==='corrupt')bytes[bytes.length-1]^=1;
 return {status:200,bytes:[...(mode==='truncated'?bytes.subarray(0,bytes.length-20):bytes)],headers,delayBody:mode==='slowBody'};
}
async function open() {
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.exposeFunction('syntheticExportServer',jsonServer);await context.exposeFunction('syntheticExportBundleServer',bundleServer);
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('dialog',dialog=>dialog.accept());
 const downloads=[],errors=[];page.on('download',value=>downloads.push(value));page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await page.goto(base+'/cupcake/account');await page.getByRole('heading',{name:'Sign in to Cupcake',exact:true}).waitFor();
 return {page,context,downloads,errors};
}
async function login(page,owner='a'){await page.getByLabel('Email',{exact:true}).fill(owner+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+owner.toUpperCase(),{exact:true}).first().waitFor();}
async function settings(page){await page.locator('summary[aria-label="Settings"]').click();await page.locator('.cc-settings-group > summary').filter({hasText:'Download my data'}).click();await ui(page).waitFor();}
const ui=page=>page.getByRole('region',{name:'Download your data',exact:true});
const prepare=page=>ui(page).getByRole('button',{name:'Prepare my download',exact:true}).click();
const zip=page=>ui(page).getByRole('button',{name:'Download ZIP file',exact:true});
async function safe(test){const result=await test.page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,legacyReads:window.accountFixture.legacyReads,intents:Object.entries(sessionStorage).filter(([key])=>key.startsWith('cupcake-account-export-intent-v1:'))}));assert.deepEqual(result.blocked,[]);assert.equal(result.legacyReads,0);for(const request of result.requests.filter(item=>item.route.startsWith('exports/'))){assert.equal(request.credentials,'include');assert.equal(request.headers['x-cupcake-request'],'account');assert.match(request.headers['x-cupcake-account-context'],/^acc_synthetic_[ab]$/);assert.equal(request.headers['x-cupcake-key'],undefined);}for(const[,value]of result.intents){const parsed=JSON.parse(value);assert.deepEqual(Object.keys(parsed).sort(),['request_id','sections']);assert.deepEqual(parsed.sections,sections);}assert.deepEqual(test.errors,[]);}
try {
 mode='normal';const main=await open(),p=main.page;await login(p);await settings(p);const before=calls.length;await ui(p).getByRole('button',{name:'Prepare my download',exact:true}).evaluate(button=>{button.click();button.click();});await zip(p).waitFor();assert.equal(main.downloads.length,0);assert.equal(calls.slice(before).filter(call=>call.route==='exports/prepare').length,1);
 assert.deepEqual(calls.slice(before).map(call=>call.route).slice(0,2),['data','exports/prepare']);
 await ui(p).getByText('Meals and food settings: 20,137 saved records',{exact:true}).waitFor();
 await ui(p).getByRole('list',{name:'Saved store read times'}).waitFor();
 const event=p.waitForEvent('download');await zip(p).click();const downloaded=await event;assert.match(downloaded.suggestedFilename(),/^cupcake-structured-data-[a-f0-9-]{36}\.zip$/);
 const actual=readFileSync(await downloaded.path());assert.equal(createHash('sha256').update(actual).digest('hex'),archives[A].sha256);
 const counts=JSON.parse(execFileSync('python3',['-c',"import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);m=json.loads(z.read('manifest.json'));t=m['coverage']['sections']['food']['tables']['food_meals'];rows=[json.loads(line) for c in t['chunks'] for line in z.read(c['member']).splitlines()];print(json.dumps({'count':len(rows),'last':rows[-1]['id'],'values':json.loads(rows[0]['body']),'owner':m['accountId']}))",await downloaded.path()]).toString());
 assert.equal(counts.count,20137);assert.equal(counts.last,'meal_00020136');assert.equal(counts.values.unknown,null);assert.equal(counts.values.known,0);assert.equal(counts.owner,A);
 for(const width of [320,1280]){await p.setViewportSize({width,height:900});const size=await ui(p).evaluate(el=>({width:el.scrollWidth,client:el.clientWidth,page:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.width<=size.client);assert.ok(size.page<=size.viewport);}
 await safe(main);await main.context.close();console.log('PASS: JSON413 automatically prepares all13 sections; real20,137-record ZIP >8MiB raw, explicit verified download, exact counts/null/zero/hash and responsive coverage');
 for(const failure of ['wrongManifest','badMember','badCount','badConsistency']){mode=failure;const test=await open(),q=test.page;await login(q);await settings(q);await prepare(q);await ui(q).getByRole('alert').waitFor();assert.equal(await zip(q).count(),0);assert.equal(test.downloads.length,0);await safe(test);await test.context.close();}
 console.log('PASS: wrongowner, unsafe member paths, inconsistent counts and false cross-store consistency never expose a download');
 for(const failure of ['wrongBinaryOwner','wrongRequest','wrongSHA','badLength','corrupt','truncated']){mode='normal';const test=await open(),q=test.page;await login(q);await settings(q);await prepare(q);await zip(q).waitFor();mode=failure;await zip(q).click();await ui(q).getByRole('alert').waitFor();assert.equal(test.downloads.length,0);await safe(test);await test.context.close();}
 console.log('PASS: binary owner/request/length/hash mismatch, corruption and truncated ZIP never create browser files');
 mode='lostPrepare';const lost=await open(),l=lost.page;await login(l);await settings(l);await prepare(l);await ui(l).getByRole('alert').waitFor();const savedCalls=calls.filter(call=>call.route==='exports/prepare').length;const pending=await l.evaluate(()=>JSON.parse(Object.entries(sessionStorage).find(([key])=>key.startsWith('cupcake-account-export-intent-v1:'))[1]));
 mode='normal';await l.reload();await l.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await settings(l);await zip(l).waitFor();assert.equal(calls.filter(call=>call.route==='exports/prepare').length,savedCalls);assert.equal(calls.at(-1).body.request_id,pending.request_id);assert.equal(lost.downloads.length,0);await safe(lost);await lost.context.close();
 console.log('PASS: lostprepare response and reload recover original UUID throughstatusonly, without anotherprepare orautomaticdownload');
 mode='normal';const expired=await open(),e=expired.page;await login(e);await settings(e);await prepare(e);await zip(e).waitFor();const previous=calls.filter(call=>call.route==='exports/prepare').at(-1).body.request_id;mode='expired';await ui(e).getByRole('button',{name:'Check saved status',exact:true}).click();await ui(e).getByText('This prepared ZIP has expired. You can prepare a new download.',{exact:true}).waitFor();assert.equal(await zip(e).count(),0);mode='normal';await ui(e).getByRole('button',{name:'Prepare a new download',exact:true}).click();await zip(e).waitFor();assert.notEqual(calls.filter(call=>call.route==='exports/prepare').at(-1).body.request_id,previous);await safe(expired);await expired.context.close();
 console.log('PASS: expired request stays terminal until an explicit new preparation with a new UUID');
 mode='failed';const failed=await open(),f=failed.page;await login(f);await settings(f);await prepare(f);await ui(f).getByText('These records exceed the current ZIP preparation allowance. No partial ZIP is available.',{exact:true}).waitFor();assert.equal(await zip(f).count(),0);const failedCount=calls.filter(call=>call.route==='exports/prepare').length;await f.reload();await f.getByText('MyCupcake — Synthetic A',{exact:true}).first().waitFor();await settings(f);await ui(f).getByRole('button',{name:'Prepare a new download',exact:true}).waitFor();assert.equal(calls.filter(call=>call.route==='exports/prepare').length,failedCount);mode='notFound';await ui(f).getByRole('button',{name:'Check saved status',exact:true}).click();await ui(f).getByRole('alert').waitFor();assert.equal(await zip(f).count(),0);assert.equal(calls.filter(call=>call.route==='exports/prepare').length,failedCount);await safe(failed);await failed.context.close();
 console.log('PASS: failed or unavailable old-session requests do not rebuild on reload or status recovery');
 mode='normal';const revoked=await open(),r=revoked.page;await login(r);await settings(r);await prepare(r);await zip(r).waitFor();mode='revoked';await zip(r).click();await r.getByRole('heading',{name:'Sign in to Cupcake',exact:true}).waitFor();assert.equal(revoked.downloads.length,0);await safe(revoked);await revoked.context.close();
 mode='normal';const slow=await open(),s=slow.page;await login(s);await settings(s);await prepare(s);await zip(s).waitFor();mode='slowBody';await zip(s).click();await ui(s).getByRole('button',{name:'Verifying ZIP…',exact:true}).waitFor();await s.getByRole('button',{name:'Close settings',exact:true}).click();await s.getByRole('button',{name:'Sign out of Cupcake',exact:true}).click();await s.getByRole('heading',{name:'Sign in to Cupcake',exact:true}).waitFor();await login(s,'b');await new Promise(resolve=>setTimeout(resolve,700));assert.equal(slow.downloads.length,0);await safe(slow);await slow.context.close();
 console.log('PASS: revoked login and account switch/unmount during ZIP streaming abort without a stale download');
 mode='small';const legacy=await open(),j=legacy.page;await login(j);await settings(j);const previousCalls=calls.filter(call=>call.route.startsWith('exports/')).length;await prepare(j);const jsonButton=ui(j).getByRole('button',{name:'Download JSON file',exact:true});await jsonButton.waitFor();const jsonEvent=j.waitForEvent('download');await jsonButton.click();const json=JSON.parse(readFileSync(await(await jsonEvent).path(),'utf8'));assert.equal(json.accountId,A);assert.equal(json.completePrivacyExport,false);assert.equal(calls.filter(call=>call.route.startsWith('exports/')).length,previousCalls);await safe(legacy);await legacy.context.close();console.log('PASS: existing smallJSON preparation/download remains unchanged and never creates a ZIP job');
} finally {release?.();await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
