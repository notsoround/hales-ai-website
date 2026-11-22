// Native-feel checks on synthetic data: installs as its own app, Back closes layers, the offline line, touch behaviour.
import assert from 'node:assert/strict';
import {signedIn,nav,browser,server,base} from './lib.mjs';
const v=await signedIn(390,'caribbean'),{p,c}=v;
// Install metadata: the named Cupcake link carries its own manifest and touch icon; shortcuts stay inside the account app.
assert.equal(await p.locator('link[rel="manifest"]').getAttribute('href'),'/cupcake-account.webmanifest');
assert.equal(await p.locator('link[rel="apple-touch-icon"]').getAttribute('href'),'/cupcake-app-touch-180.png');
for(const file of ['cupcake-account','matthieu-account']){const m=await p.evaluate(async f=>(await fetch('/'+f+'.webmanifest')).json(),file);
  assert.equal(m.display,'standalone');assert.equal(m.scope,'/cupcake/account');assert.ok(m.start_url.startsWith('/cupcake/account?assistant='));assert.equal(m.share_target,undefined);
  for(const size of ['192x192','512x512'])assert.ok(m.icons.some(i=>i.sizes===size&&i.type==='image/png'),file+' has a '+size+' icon');assert.ok(m.icons.some(i=>i.purpose==='maskable'));
  for(const icon of m.icons){const r=await p.evaluate(async src=>{const x=await fetch(src);return{ok:x.ok,type:x.headers.get('content-type')};},icon.src);assert.ok(r.ok&&/image\/png/.test(r.type),icon.src);}
  assert.equal(m.shortcuts.length,3);for(const s of m.shortcuts)assert.ok(s.url.startsWith(m.start_url+'&tab='),s.url);}
console.log('PASS: Cupcake and Matthieu account links install as their own apps with 192/512/maskable icons and three shortcuts');
// Touch: controls are not selectable, do not open the long-press sheet, and compact controls accept a 44px touch.
const touch=await p.evaluate(()=>{const b=document.querySelector('.cc-nav button'),s=getComputedStyle(b),d=document.querySelector('.nx-md-drill'),a=d&&getComputedStyle(d,'::after');return{select:s.userSelect,action:s.touchAction,drill:d?d.getBoundingClientRect().height+12:null,after:a?a.content:null};});
assert.equal(touch.select,'none');assert.equal(touch.action,'manipulation');assert.ok(touch.drill>=44&&touch.after==='""',JSON.stringify(touch));
console.log('PASS: controls press instead of select, and the dial Details control takes a 44px touch');
// Back: opening Settings arms one close request; a close request (Android Back, Escape) closes it and the tab stays.
await p.evaluate(()=>{const Real=window.CloseWatcher;window.watchers=[];if(Real)window.CloseWatcher=function(...a){const w=new Real(...a);window.watchers.push(w);return w;};});
const tabBefore=new URL(p.url()).searchParams.get('tab');
await p.locator('summary[aria-label="Settings"]').click();await p.getByRole('dialog',{name:'Settings'}).waitFor();
const supported=await p.evaluate(()=>'CloseWatcher'in window);
if(supported){await p.waitForFunction(()=>window.watchers.length===1);await p.evaluate(()=>window.watchers[0].requestClose());}else await p.keyboard.press('Escape');
await p.waitForFunction(()=>!document.querySelector('details.cc-settings')?.open);assert.equal(new URL(p.url()).searchParams.get('tab'),tabBefore);
console.log('PASS: a Back request closes Settings and leaves the tab alone'+(supported?'':' (CloseWatcher unavailable here; Escape path checked)'));
// Offline line appears, then confirms the return and refreshes once.
await p.evaluate(()=>{window.refreshes=0;window.addEventListener('cupcake-account-data-changed',e=>{if(e.detail==='*')window.refreshes++;});});
await c.setOffline(true);await p.locator('.nx-net[data-state=off]').waitFor();if(process.env.SHOT)await p.screenshot({path:process.env.SHOT.replace('.png','-offline.png')});assert.match(await p.locator('.nx-net').innerText(),/No signal/);
await c.setOffline(false);await p.locator('.nx-net[data-state=back]').waitFor();assert.equal(await p.evaluate(()=>window.refreshes),1);
await p.locator('.nx-net').waitFor({state:'detached',timeout:6000});
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
console.log('PASS: losing the connection shows one quiet line; its return says so, refreshes once and clears');
// Pull to refresh on Today, installed app only: one pull at the top refreshes every screen once; nothing in a browser tab,
// nothing while Settings, the camera or another layer is open. Synthetic touches on the Today section.
await nav(p,'Today');await p.evaluate(()=>scrollTo(0,0));
const pull=()=>p.evaluate(async()=>{const el=document.querySelector('.nx-today'),r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+60,frame=()=>new Promise(f=>requestAnimationFrame(()=>f()));
  const touch=yy=>new Touch({identifier:7,target:el,clientX:x,clientY:yy}),fire=(type,yy)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch(yy)],targetTouches:type==='touchend'?[]:[touch(yy)],changedTouches:[touch(yy)]}));
  window.refreshes=0;fire('touchstart',y);for(let d=12;d<=204;d+=12){fire('touchmove',y+d);await frame();}
  const ptr=document.querySelector('.nx-ptr'),shown=ptr?.dataset.phase||null,svg=ptr&&getComputedStyle(ptr.querySelector('.nx-ptr-icon'));
  fire('touchend',y+204);await frame();await frame();const after=document.querySelector('.nx-ptr');
  return{refreshes:window.refreshes,shown,svgTransform:svg?.transform??null,after:after?.dataset.phase||null,spin:after?after.querySelector('.nx-ptr-icon').getAnimations().length:null,motion:after?.dataset.motion||null};});
let pr=await pull();assert.deepEqual([pr.refreshes,pr.shown],[0,null],'a browser tab keeps the browser\'s own refresh: '+JSON.stringify(pr));
await p.evaluate(()=>{const real=window.matchMedia.bind(window);window.realMatchMedia=real;window.matchMedia=q=>/display-mode:\s*standalone/.test(q)?{matches:true,media:q,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent:()=>false}:real(q);});
pr=await pull();assert.equal(pr.shown,'armed',JSON.stringify(pr));assert.equal(pr.refreshes,1,JSON.stringify(pr));assert.equal(pr.after,'refreshing');
assert.equal(pr.svgTransform,'none','reduced motion: the arrow does not turn with the finger');assert.equal(pr.spin,0,'reduced motion: no spinning');assert.equal(pr.motion,'reduce');
await p.locator('.nx-ptr').waitFor({state:'detached',timeout:3000});
await p.locator('summary[aria-label="Settings"]').click();await p.getByRole('dialog',{name:'Settings'}).waitFor();
pr=await pull();assert.deepEqual([pr.refreshes,pr.shown],[0,null],'Settings open: '+JSON.stringify(pr));
await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('details.cc-settings')?.open);
const camButton=p.locator('.nx-today .nx-cam').first(),realCamera=await camButton.isVisible().catch(()=>false);
if(realCamera){await camButton.click();await p.locator('dialog.cc-cam[open]').waitFor();
  pr=await pull();assert.deepEqual([pr.refreshes,pr.shown],[0,null],'camera open: '+JSON.stringify(pr));
  await p.keyboard.press('Escape');await p.locator('dialog.cc-cam[open]').waitFor({state:'detached'});}
else{await p.evaluate(()=>{const d=document.createElement('dialog');d.id='synthetic-layer';document.querySelector('.cc-app').append(d);d.showModal();});
  pr=await pull();assert.deepEqual([pr.refreshes,pr.shown],[0,null],'modal dialog open: '+JSON.stringify(pr));await p.evaluate(()=>document.getElementById('synthetic-layer').remove());}
pr=await pull();assert.equal(pr.refreshes,1,'pull works again once the layers are closed');await p.locator('.nx-ptr').waitFor({state:'detached',timeout:3000});
await p.evaluate(()=>{window.matchMedia=window.realMatchMedia;});
console.log('PASS: pull to refresh on Today works only in the installed app, refreshes once, honours reduced motion, and stays off while Settings or the camera is open'+(realCamera?'':' (Log a meal hidden here; an open modal dialog stood in for the camera)'));
// Sign out asks in the app's own sheet (no browser popup); Escape or Back answers No and nothing changes.
let popups=0;p.on('dialog',d=>{popups++;void d.dismiss();});
await p.locator('summary[aria-label="Settings"]').click();await p.getByRole('dialog',{name:'Settings'}).waitFor();
await p.locator('.cc-settings .cc-lock').click();const sheet=p.locator('dialog.nx-confirm');await sheet.waitFor();
assert.equal(await sheet.getAttribute('role'),'alertdialog');assert.equal(await sheet.locator('.nx-confirm-title').innerText(),'Sign out?');
assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('data-answer')),'no','a destructive question rests on Cancel');
for(const b of await sheet.locator('button').all())assert.ok((await b.boundingBox()).height>=48);
if(process.env.SHOT)await p.screenshot({path:process.env.SHOT});
await p.keyboard.press('Escape');await sheet.waitFor({state:'detached'});await p.locator('.cc-nav').waitFor();assert.equal(popups,0);
assert.equal(await p.evaluate(()=>document.activeElement?.classList.contains('cc-lock')),true,'focus returns to the control that asked');
await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('details.cc-settings')?.open);
console.log('PASS: sign out asks in an in-app sheet with 48px buttons, rests on Cancel, and Escape/Back cancels with focus restored');
// The camera shortcut opens Food with the camera request and leaves no marker in the address.
const s=await c.newPage();await s.goto(base+'/cupcake/account?assistant=cupcake&tab=snap&shortcut=camera'+(process.env.RICH?'&rich=1':''));
await s.waitForFunction(()=>new URL(location.href).searchParams.get('tab')==='snap'&&!new URL(location.href).searchParams.has('shortcut'),null,{timeout:10000});
console.log('PASS: the camera shortcut lands on Food and its marker is removed from the address');
assert.deepEqual(v.errors,[]);
await browser.close();await server.close();
