import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdtempSync,realpathSync,rmSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-invite-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-invite-root',configureServer(server){server.middlewares.use((req,_res,next)=>{if(['/cupcake/account','/cupcake/account/'].includes(req.url?.split('?')[0]))req.url='/tests/account-browser-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({headless:true});
const A='acc_synthetic_a',B='acc_synthetic_b',TOKEN='ci_'+'a'.repeat(43),NEW='ci_'+'b'.repeat(43),now=Math.floor(Date.now()/1000);
const invite=(id,email,status='pending',expires_at=now+604800)=>({id,email,status,expires_at,persona:'matthieu',created_at:now});
const invitations=[invite('expired','expired@example.invalid','pending',now-1),invite('revoked','revoked@example.invalid','revoked')];
const relationships=[],requests=[];let pendingToken,createdCount=0,grantCount=0;
const ok=value=>({status:200,value:{ok:true,...value}}),fail=(status,error)=>({status,value:{ok:false,error}});
const relation=()=>({id:'relationship-one',coach_account_id:B,coach_name:'Synthetic B',member_account_id:A,member_name:'Synthetic A',member_email_hint:'a***@example.invalid',status:'active',created_at:now,grants:[]});
const forOwner=owner=>relationships.map(item=>({...item,role:item.coach_account_id===owner?'coach':'client'}));
async function coach(owner,route,body){
  requests.push({owner,route,body});
  if(route==='coach/grants/received')return ok({grants:[]});
  if(route==='coach/grants/list')return ok({grants:[]});
  if(route==='coach/workspace')return ok({coach_enabled:owner===B,invitations_supported:true,relationships:forOwner(owner),disclosure_version:'pilot-2026-11-07',limits:{max_clients:25,max_pending_invitations:10}});
  if(route==='coach/invitations/list')return ok({invitations});
  if(route==='coach/invitations/create'){createdCount++;const row=invite('created-'+createdCount,body.email);row.persona=body.persona;invitations.push(row);pendingToken=TOKEN;return ok({invitation:row,invite_token:TOKEN});}
  if(route==='coach/invitations/revoke'){invitations.find(item=>item.id===body.invitation_id).status='revoked';return ok({revoked:true});}
  throw Error('Unexpected coach route '+route);
}
async function lifecycle(owner,route,body){
  requests.push({owner,route,body});
  if(route==='invitations/preview')return [TOKEN,NEW].includes(body.invite_token)?ok({invitation:{id:'private-invite',coach_name:'Synthetic B',email_hint:body.invite_token===NEW?'b***@example.invalid':'a***@example.invalid',persona:'matthieu',expires_at:now+604800},disclosure:{version:'pilot-2026-11-07',text:'Synthetic adult pilot disclosure; wellness estimates and local records only.'}}):fail(404,'invitation_unavailable');
  if(route==='invitations/accept'){
    if(owner!==A)return fail(403,'invitation_account_mismatch');
    assert.equal(body.disclosure_accepted,true);assert.equal(body.persona,'cupcake');assert.equal(body.disclosure_version,'pilot-2026-11-07');
    if(!relationships.length)relationships.push(relation());
    invitations.find(item=>item.id==='created-1').status='accepted';return ok({relationship:relationships[0]});
  }
  if(route==='invitations/redeem'){
    if(body.invite_token===TOKEN)return fail(409,'invitation_sign_in_required');
    assert.equal(body.email,'b@example.invalid');assert.equal(body.name,'My chosen name');assert.equal(body.password,'Synthetic password 123!');assert.equal(body.persona,'matthieu');
    return ok({relationship:relation(),sign_in_required:true});
  }
  if(route==='sharing/relationships')return ok({relationships:forOwner(owner)});
  if(route==='sharing/grant'){
    assert.equal(owner,A);assert.equal(body.relationship_id,'relationship-one');assert.ok(body.expires_at>now&&body.expires_at<=now+30*86400+60);
    const grant={id:body.grant_id,owner_id:owner,subject_id:B,scopes:body.scopes,expires_at:body.expires_at,status:'active'};grantCount++;relationships[0].grants.push(grant);return ok({grant});
  }
  if(route==='sharing/revoke'){relationships[0].grants.find(item=>item.id===body.grant_id).status='revoked';return ok({revoked:true});}
  throw Error('Unexpected invitation route '+route);
}
async function context(viewport={width:390,height:844}){
  const context=await browser.newContext({viewport});await context.exposeFunction('syntheticCoachServer',coach);await context.exposeFunction('syntheticInvitationServer',lifecycle);
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());return {context,page};
}
async function nav(page,name){await page.getByRole('navigation',{name:'Cupcake',exact:true}).getByRole('button',{name,exact:true}).click();}
async function login(page,who){await page.getByLabel('Email',{exact:true}).fill(who+'@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('MyCupcake — Synthetic '+who.toUpperCase(),{exact:true}).first().waitFor();}
async function safe(page){const state=await page.evaluate(()=>({requests:window.accountFixture.requests,blocked:window.accountFixture.blocked,reads:window.accountFixture.legacyReads,stored:[...Object.values(localStorage),...Object.values(sessionStorage)]}));assert.equal(state.reads,0);assert.deepEqual(state.blocked,[]);assert.ok(state.stored.every(value=>!value.includes('ci_'+'a'.repeat(43))&&!value.includes('ci_'+'b'.repeat(43))));for(const request of state.requests){assert.equal(request.headers['x-cupcake-key'],undefined);if(request.route.startsWith('sharing/')||request.route==='invitations/accept')assert.match(request.headers['x-cupcake-account-context'],/^acc_synthetic_[ab]$/);assert.equal(request.body.owner_id,undefined);assert.equal(request.body.account_id,undefined);}}
try{
  const coachBrowser=await context(),coachPage=coachBrowser.page;await coachPage.goto(base+'/cupcake/account');await login(coachPage,'b');await nav(coachPage,'Reports');
  await coachPage.locator('.cc-pilot-disclosure > summary').click();
  await coachPage.getByRole('button',{name:'My clients & invitations',exact:true}).click();await coachPage.getByLabel('Client email',{exact:true}).fill('a@example.invalid');
  await coachPage.getByLabel('Suggested assistant',{exact:true}).selectOption('cupcake');await coachPage.getByRole('button',{name:'Create private invitation link',exact:true}).click();
  const link=await coachPage.getByLabel('One-time invitation link',{exact:true}).inputValue();assert.equal(link,base+'/cupcake/account#invite='+TOKEN);assert.equal(pendingToken,TOKEN);
  assert.match(await coachPage.locator('.cc-invitation-secret').innerText(),/Copy invitation link/);await coachPage.getByRole('button',{name:'Copy invitation link',exact:true}).click();
  await coachPage.getByRole('button',{name:'Hide private link',exact:true}).click();assert.equal(await coachPage.getByLabel('One-time invitation link',{exact:true}).count(),0);
  assert.match(await coachPage.getByRole('region',{name:'My clients and invitations'}).innerText(),/expired/);assert.match(await coachPage.getByRole('region',{name:'My clients and invitations'}).innerText(),/revoked/);await safe(coachPage);
  console.log('PASS: enabled coach creates email-bound expiring link once, previews preset, copies/hides privately and sees invitation states');

  const clientBrowser=await context({width:320,height:800}),client=clientBrowser.page;await client.goto(link);await client.getByRole('heading',{name:'Your Cupcake invitation',exact:true}).waitFor();await client.getByText('Synthetic B',{exact:true}).waitFor();
  assert.equal(new URL(client.url()).hash,'');assert.equal(new URL(client.url()).search,'');assert.equal(relationships.length,0);assert.equal(grantCount,0);
  await client.getByRole('button',{name:'I already have an account',exact:true}).click();await client.getByLabel('Invited email',{exact:true}).fill('a@example.invalid');await client.getByLabel('Your password',{exact:true}).fill('Synthetic password 123!');await client.getByLabel('Confirm assistant preset',{exact:true}).selectOption('cupcake');await client.getByLabel('I am 18 or older and accept this pilot disclosure.',{exact:true}).check();
  await client.getByRole('button',{name:'Sign in to accept',exact:true}).click();await client.getByRole('button',{name:'Accept invitation',exact:true}).click();await client.getByRole('heading',{name:'You’re connected',exact:true}).waitFor();assert.equal(relationships.length,1);assert.equal(grantCount,0);
  assert.equal(await client.locator('form form').count(),0);assert.equal(await client.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await client.getByRole('button',{name:'Open my Cupcake',exact:true}).click();await nav(client,'Reports');await client.locator('.cc-pilot-disclosure > summary').click();await client.getByRole('button',{name:'Sharing controls',exact:true}).click();
  const recipient=client.getByLabel('Share my data with',{exact:true});await recipient.selectOption('relationship-one');
  const report=client.getByLabel('Share my clean health report',{exact:true}),photos=client.getByLabel('Share original meal photos (separate permission)',{exact:true});assert.equal(await report.isChecked(),false);assert.equal(await photos.isChecked(),false);assert.equal(await client.getByRole('button',{name:'Share selected data',exact:true}).isEnabled(),false);
  await report.check();await client.getByRole('button',{name:'Share my report',exact:true}).click();await client.getByText('Your sharing is active until the chosen expiry. You can revoke it below.',{exact:true}).waitFor();assert.deepEqual(relationships[0].grants[0].scopes,['clean-report']);assert.equal(await photos.isChecked(),false);assert.equal(await report.isChecked(),false);
  await report.check();await photos.check();await client.getByLabel('Sharing expires in',{exact:true}).selectOption('1');await client.getByRole('button',{name:'Share my report',exact:true}).click();await client.waitForFunction(()=>window.accountFixture.requests.filter(item=>item.route==='sharing/grant').length===2);assert.deepEqual(relationships[0].grants[1].scopes,['clean-report','meal-photo']);
  await client.getByRole('button',{name:'Revoke my sharing',exact:true}).first().click();await client.getByText('Your sharing was revoked.',{exact:true}).waitFor();assert.equal(relationships[0].grants[0].status,'revoked');
  await photos.check();await client.getByRole('button',{name:'Share my meal photos',exact:true}).click();await client.waitForFunction(()=>window.accountFixture.requests.filter(item=>item.route==='sharing/grant').length===3);assert.deepEqual(relationships[0].grants[2].scopes,['meal-photo']);
  mkdirSync('/tmp/cupcake-invitation-evidence',{recursive:true});for(const theme of ['caribbean','rose'])for(const width of [320,390,1280]){await client.setViewportSize({width,height:900});await client.evaluate(theme=>document.querySelector('.cc-app').setAttribute('data-appearance',theme),theme);assert.equal(await client.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await client.evaluate(()=>window.scrollTo(0,0));await client.screenshot({path:`/tmp/cupcake-invitation-evidence/sharing-${theme}-${width}.png`,fullPage:true});}
  await safe(client);console.log('PASS: anonymous POST preview strips fragment, existing intended account accepts, membership shares nothing; clean/photo scopes start off, expire and revoke independently');

  const wrongBrowser=await context(),wrong=wrongBrowser.page;await wrong.addInitScript(()=>localStorage.setItem('synthetic-account-server','acc_synthetic_b'));await wrong.goto(link);await wrong.getByText('Synthetic B',{exact:true}).waitFor();await wrong.getByLabel('Confirm assistant preset',{exact:true}).selectOption('cupcake');await wrong.getByLabel('I am 18 or older and accept this pilot disclosure.',{exact:true}).check();await wrong.getByRole('button',{name:'Accept invitation',exact:true}).click();await wrong.getByText('This invitation is for a different account. Sign in with the intended email.',{exact:true}).waitFor();assert.equal(new URL(wrong.url()).hash,'');assert.equal(grantCount,3);await safe(wrong);
  const newBrowser=await context(),fresh=newBrowser.page;await fresh.goto(base+'/cupcake/account?strict=1#invite='+NEW);await fresh.getByLabel('Invited email',{exact:true}).fill('b@example.invalid');await fresh.getByLabel('Your name',{exact:true}).fill('My chosen name');await fresh.getByLabel('Choose your own password',{exact:true}).fill('Synthetic password 123!');await fresh.getByLabel('Confirm assistant preset',{exact:true}).selectOption('matthieu');await fresh.getByLabel('I am 18 or older and accept this pilot disclosure.',{exact:true}).check();
  await fresh.evaluate(()=>{window.accountFixture.failSignIn=true;});await fresh.getByRole('button',{name:'Create account and accept',exact:true}).click();
  await fresh.getByRole('button',{name:'Sign in to my Cupcake',exact:true}).waitFor();assert.equal(await fresh.getByRole('heading',{name:'You’re connected',exact:true}).count(),0);assert.equal(await fresh.getByRole('button',{name:'Create account and accept',exact:true}).count(),0);assert.equal(await fresh.getByLabel('Your password',{exact:true}).inputValue(),'');assert.equal(await fresh.getByLabel('Created account email',{exact:true}).inputValue(),'b@example.invalid');await fresh.getByText(/If you need recovery, leave this invitation/).waitFor();
  await fresh.getByLabel('Your password',{exact:true}).fill('Synthetic password 123!');await fresh.getByRole('button',{name:'Sign in to my Cupcake',exact:true}).click();await fresh.getByRole('heading',{name:'You’re connected',exact:true}).waitFor();
  const signupRequests=await fresh.evaluate(()=>window.accountFixture.requests);assert.equal(signupRequests.filter(item=>item.route==='invitations/redeem').length,1);assert.equal(signupRequests.filter(item=>item.route==='sign-in').length,2);await safe(fresh);
  console.log('PASS: confirmed signup with failed sign-in clears password, offers sign-in/recovery and retries sign-in without redeeming again');
  const invalidBrowser=await context(),invalid=invalidBrowser.page;await invalid.goto(base+'/cupcake/account#invite=bad');await invalid.getByText('This invitation link is incomplete or invalid. Ask your coach for a new link.',{exact:true}).waitFor();assert.equal(new URL(invalid.url()).hash,'');assert.equal(await invalid.evaluate(()=>window.accountFixture.requests.filter(item=>item.route==='invitations/preview').length),0);await safe(invalid);
  for(const pair of [coachBrowser,clientBrowser,wrongBrowser,newBrowser,invalidBrowser])await pair.context.close();
  console.log('PASS: wrong signed-in account refuses; new account chooses own password and confirmed preset; invalid token clears without preview; both themes at320/390/1280 have no overflow or nested forms');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
