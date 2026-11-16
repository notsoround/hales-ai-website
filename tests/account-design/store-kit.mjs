// Store listing kit on synthetic data only: six 1080x1920 phone screenshots and one 1024x500 feature graphic.
// Uses the design harness (lib.mjs: fictional accounts, blocked network) with the `?rich=1` fixture (tests/account-rich-data.ts).
// Output goes OUTSIDE the repository: STORE_KIT_OUT (default /tmp/cupcake-store-kit). Run from the repository root:
//   ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/store-kit.mjs
// The camera has no real lens here (the fixture's getUserMedia is audio-only, so the app shows its "Camera off" placeholder).
// The camera shot is staged with a canvas-drawn synthetic plate; STORE_KIT_CAMERA=placeholder keeps the harness view instead.
process.env.RICH='1';delete process.env.SCHEME;
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
const kitOut=resolve(process.env.STORE_KIT_OUT||'/tmp/cupcake-store-kit'),repo=resolve(process.env.ASSESS_ROOT||process.cwd()),rel=relative(repo,kitOut);
if(!rel.startsWith('..')&&!isAbsolute(rel))throw Error('STORE_KIT_OUT must be outside the repository: '+kitOut);
mkdirSync(kitOut,{recursive:true});
const {signedIn,nav,browser,server}=await import('./lib.mjs');
// 360x640 CSS pixels at 3x = 1080x1920, a common 9:16 phone listing size. The harness opens its contexts through
// browser.newContext; while the kit runs, those contexts get the phone size, pixel ratio and touch.
const shots=[],errors=[],newContext=browser.newContext.bind(browser);
browser.newContext=o=>newContext({...o,viewport:{width:360,height:640},deviceScaleFactor:3,isMobile:true,hasTouch:true});
// Store shots drop the harness's "Local preview" ribbon; everything else is the real app on synthetic data.
async function phone(v){await v.p.addStyleTag({content:'body>aside{display:none!important}'});return v;}
async function settle(p,ms=500){await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await p.waitForTimeout(ms);}
async function shot(p,name,note){await settle(p);const path=`${kitOut}/${name}.png`;await p.screenshot({path});shots.push({file:path,note});console.log('wrote',path);}
// A synthetic stand-in for the camera: a drawn plate on a dark table, streamed from a canvas. No real image is used.
const fakeCamera=()=>{const c=document.createElement('canvas');c.width=720;c.height=1280;const g=c.getContext('2d');let t=0;
  const draw=()=>{t++;const bg=g.createRadialGradient(360,640,80,360,640,900);bg.addColorStop(0,'#3a2f28');bg.addColorStop(1,'#120e0c');g.fillStyle=bg;g.fillRect(0,0,720,1280);
    g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(372,668,270,250,0,0,7);g.fill();g.fillStyle='#f2efe9';g.beginPath();g.arc(360,640,260,0,7);g.fill();g.fillStyle='#e4e0d8';g.beginPath();g.arc(360,640,200,0,7);g.fill();
    const blob=(x,y,r,col)=>{g.fillStyle=col;g.beginPath();for(let a=0;a<6.3;a+=.5){const rr=r*(1+.12*Math.sin(a*3+x));g.lineTo(x+rr*Math.cos(a),y+rr*Math.sin(a));}g.fill();};
    blob(290,590,90,'#c9a227');blob(430,600,80,'#6b8e23');blob(360,720,95,'#b5653a');for(let i=0;i<9;i++)blob(400+30*Math.cos(i),700+25*Math.sin(i*2),12,'#3f7d3a');
    g.fillStyle='rgba(255,255,255,.04)';g.fillRect(0,(t*7)%1280,720,2);requestAnimationFrame(draw);};draw();
  const v=document.querySelector('.cc-cam-feed');v.srcObject=c.captureStream(30);void v.play();const panel=document.querySelector('.cc-cam-panel');panel.dataset.state='live';panel.dataset.track='steady';
  const status=document.querySelector('.cc-cam-status');if(status){status.dataset.empty='true';status.lastChild.textContent='';}};
// A synthetic Quick Chat server: one fictional question and answer, no medical claims.
const thread={id:'00000000-0000-4000-8000-0000000005a1',title:'What should I eat for dinner?',turns:[]};
async function chatServer(_owner,body){const ok=value=>({status:200,value:{ok:true,...structuredClone(value)}});
  if(body.action==='quick_chat_list')return ok({threads:thread.turns.length?[{id:thread.id,title:thread.title}]:[]});
  if(body.action==='quick_chat_create'){thread.id=body.threadId;return ok({thread});}
  if(body.action==='quick_chat_begin'){thread.turns.push({id:body.turnId,text:body.text,status:'queued',retryAfter:0});return ok({thread,acquired:true,execution:'server',attemptId:'00000000-0000-4000-8000-0000000005a9'});}
  if(body.action==='quick_chat_get'){for(const turn of thread.turns)if(turn.status==='queued'){turn.status='completed';turn.response={ok:true,model:'synthetic-local',reply:'You have about 980 kcal left and 78 g of protein so far. A grilled salmon plate with rice and greens (roughly 650 kcal, 40 g protein) keeps you on pace with room for a snack later.'};}return ok({thread});}
  if(body.action==='quick_chat_cancel')return ok({thread,execution:'server'});return {status:404,value:{ok:false,error:'not_found'}};}

// The rich fixture has no saved photo or portion data for its meals; answer those two reads with synthetic values in the page.
const syntheticMeal=()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const g=c.getContext('2d');g.fillStyle='#2b211b';g.fillRect(0,0,640,480);g.fillStyle='#f2efe9';g.beginPath();g.arc(320,240,200,0,7);g.fill();
  [[250,200,70,'#c9a227'],[390,210,65,'#6b8e23'],[320,310,75,'#b5653a']].forEach(([x,y,r,col])=>{g.fillStyle=col;g.beginPath();g.arc(x,y,r,0,7);g.fill();});const dataUrl=c.toDataURL('image/jpeg',.85);
  const real=window.fetch;window.fetch=async(input,init)=>{let body;try{body=JSON.parse(init?.body);}catch{return real(input,init);}
    if(body?.action!=='food_photo'&&body?.action!=='food_get')return real(input,init);
    const base=await(await real(input,{...init,body:JSON.stringify({...body,action:'food_settings_get'})})).json();delete base.settings;
    const extra=body.action==='food_photo'?{photo:{dataUrl}}:{meal:{id:body.mealId,portion:{editable:true,blockedReason:null,fraction:1,label:'full',choices:[.25,.5,.75,1],adjusted:false}}};
    return Response.json({...base,...extra});};};
const v=await phone(await signedIn(390,'caribbean')),{p,c}=v;p.on('pageerror',e=>errors.push(e.message));
await c.exposeFunction('syntheticQuickChatServer',chatServer);
// 1 Today
await nav(p,'Today');await p.evaluate(()=>scrollTo(0,0));await shot(p,'01-today','Today: calorie dial, vitals strip, spend and macros (rich synthetic fixture)');
// 2 Camera: the synthetic stream above, opened from the Food tab.
await p.locator('.cc-nav').getByRole('button',{name:'Food',exact:true}).click();
await p.locator('dialog.cc-cam .cc-cam-controls').waitFor();await p.waitForTimeout(800);const harnessState=await p.locator('.cc-cam-panel').getAttribute('data-state');
// The harness's own camera path is the fixture's audio-only getUserMedia (a generated tone, no video track), so the real
// screen shows its "Camera off" placeholder (state=blocked). For the listing shot only, a canvas-drawn synthetic plate is
// played in the viewfinder and the panel is marked live; the app's controls, reticle and labels are the real ones.
if(process.env.STORE_KIT_CAMERA!=='placeholder')await p.evaluate(fakeCamera);
await shot(p,'02-camera',process.env.STORE_KIT_CAMERA==='placeholder'?'Meal camera as the harness renders it: "Camera off" placeholder (fixture stream has no video)':'Meal camera, staged: synthetic canvas plate in the viewfinder (harness state was '+harnessState+')');
// 3 Meal detail: the first synthetic meal in the food log.
await p.evaluate(syntheticMeal);await nav(p,'Food');const meal=p.getByRole('button',{name:/Chicken grain bowl/}).first();await meal.scrollIntoViewIfNeeded();await meal.click();
const detail=p.locator('dialog[open],[role=dialog]').last();await detail.waitFor();await shot(p,'03-meal-detail','Meal detail for a synthetic logged meal');
await p.keyboard.press('Escape');await p.waitForTimeout(300);
// 4 Chat: one synthetic question and answer.
await nav(p,'Assistant');const box=p.getByLabel(/^Message /).first();await box.waitFor();await box.fill('What should I eat for dinner?');await p.getByRole('button',{name:/^Send/}).first().click();
await p.getByText(/grilled salmon plate/).first().waitFor({timeout:15000}).catch(async e=>{await p.screenshot({path:kitOut+'/debug-chat.png'});throw e;});await shot(p,'04-chat','Assistant chat with a synthetic question and reply');
// 5 Reports
await nav(p,'Reports');await p.waitForTimeout(800);await p.evaluate(()=>scrollTo(0,0));await shot(p,'05-reports','Reports tab (synthetic clients and charted report)');
const todayPng=readFileSync(`${kitOut}/01-today.png`).toString('base64');
await c.close();
// 6 Light mode Today: the saved Theme choice is set before load (same as SCHEME=light in the harness).
process.env.SCHEME='light';const l=await phone(await signedIn(390,'caribbean'));l.p.on('pageerror',e=>errors.push(e.message));delete process.env.SCHEME;
await nav(l.p,'Today');await l.p.evaluate(()=>scrollTo(0,0));await shot(l.p,'06-today-light','Today in the light theme');await l.c.close();
// Feature graphic 1024x500: app icon, name, one plain line, and the synthetic Today screenshot in a phone frame.
const icon=readFileSync(`${repo}/public/cupcake-app-512.png`).toString('base64');
const g=await newContext({viewport:{width:1024,height:500},deviceScaleFactor:1});const gp=await g.newPage();
await gp.setContent(`<!doctype html><html><body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:Inter,'Helvetica Neue',Arial,sans-serif;background:radial-gradient(120% 140% at 85% 10%,#0f3b3a 0%,#071414 45%,#050808 100%);color:#eaf6f4">
<div style="position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:520px">
<img src="data:image/png;base64,${icon}" width="88" height="88" style="border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.45)">
<div style="font-size:64px;font-weight:300;letter-spacing:-.02em;margin-top:26px">Cupcake</div>
<div style="font-size:26px;font-weight:300;line-height:1.35;margin-top:10px;color:#bfe9e2">Snap your meals. See your day.<br>A coach in your pocket.</div>
<div style="margin-top:22px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#5fd6c5">Food log · Camera · Daily dial · Reports</div></div>
<div style="position:absolute;right:86px;top:38px;width:236px;height:420px;border-radius:34px;padding:8px;background:#0b0f0f;box-shadow:0 30px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)">
<img src="data:image/png;base64,${todayPng}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:27px"></div></body></html>`);
await gp.waitForTimeout(300);const graphic=`${kitOut}/feature-graphic-1024x500.png`;await gp.screenshot({path:graphic});shots.push({file:graphic,note:'Feature graphic: icon, name, plain tagline, synthetic Today screenshot'});console.log('wrote',graphic);await g.close();
// Verify every PNG's real pixel size from its header.
const size=f=>{const b=readFileSync(f);assert.equal(b.toString('ascii',1,4),'PNG');return{width:b.readUInt32BE(16),height:b.readUInt32BE(20)};};
for(const s of shots){Object.assign(s,size(s.file));const want=s.file.includes('feature-graphic')?[1024,500]:[1080,1920];assert.deepEqual([s.width,s.height],want,s.file);}
writeFileSync(`${kitOut}/kit.json`,JSON.stringify({generated:new Date().toISOString(),data:'synthetic only (tests/account-rich-data.ts via ?rich=1; harness accounts are fictional; network blocked)',camera:process.env.STORE_KIT_CAMERA==='placeholder'?'harness placeholder (fixture getUserMedia is audio-only, screen shows Camera off)':'staged: harness shows the Camera off placeholder; a canvas-drawn synthetic plate is played in the viewfinder and the panel marked live for the shot. No real camera or photo',pageErrors:errors,shots},null,2));
console.log(JSON.stringify(shots.map(s=>`${s.file} ${s.width}x${s.height}`),null,1));assert.deepEqual(errors,[]);
await browser.close();await server.close();
