// Native-feel audit: touch target sizes, tap highlight, selection, callouts, input zoom and overscroll on each main screen.
import {signedIn,nav,browser,server,out} from './lib.mjs';
import {writeFileSync} from 'node:fs';
const probe=()=>{const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&!e.closest('[hidden]')&&r.bottom>0&&r.top<document.documentElement.scrollHeight;};
 const name=e=>(e.getAttribute('aria-label')||e.textContent||e.className||e.tagName).toString().trim().replace(/\s+/g,' ').slice(0,50)+' <'+e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]+'>';
 const ctl=[...document.querySelectorAll('button,a[href],summary,[role=button],[role=tab],[role=switch],input,select,textarea')].filter(vis);
 const small=ctl.filter(e=>{const r=e.getBoundingClientRect();return (r.width<44||r.height<44)&&!['INPUT','TEXTAREA','SELECT'].includes(e.tagName)||r.height<40;}).map(e=>{const r=e.getBoundingClientRect();return name(e)+' '+Math.round(r.width)+'x'+Math.round(r.height);});
 const hl=ctl.filter(e=>{const c=getComputedStyle(e).webkitTapHighlightColor;return c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c);}).map(name);
 const sel=ctl.filter(e=>!['INPUT','TEXTAREA','SELECT'].includes(e.tagName)&&getComputedStyle(e).userSelect!=='none'&&getComputedStyle(e).webkitUserSelect!=='none').map(name);
 const zoom=ctl.filter(e=>['INPUT','TEXTAREA','SELECT'].includes(e.tagName)&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>name(e)+' '+getComputedStyle(e).fontSize);
 const img=[...document.querySelectorAll('img')].filter(vis).filter(e=>getComputedStyle(e).webkitTouchCallout!=='none'&&e.draggable!==false).length;
 const ta=ctl.filter(e=>getComputedStyle(e).touchAction==='auto').length;
 const hs=getComputedStyle(document.documentElement),bs=getComputedStyle(document.body);
 return{controls:ctl.length,small,highlight:hl.length,highlightEx:hl.slice(0,5),selectable:sel.length,selectableEx:sel.slice(0,5),zoom,imagesWithCallout:img,touchActionAuto:ta,overscroll:[hs.overscrollBehaviorY,bs.overscrollBehaviorY],textSizeAdjust:hs.webkitTextSizeAdjust};};
const v=await signedIn(390,process.env.T||'caribbean'),{p}=v,res={};
for(const t of ['Today','Food','Fitness','Library','Assistant']){await nav(p,t);await p.waitForTimeout(600);res[t]=await p.evaluate(probe);}
await nav(p,'Today');await p.locator('summary[aria-label="Settings"]').click();await p.waitForTimeout(500);res.Settings=await p.evaluate(probe);
writeFileSync(out+'/native-audit.json',JSON.stringify(res,null,1));
for(const[k,r]of Object.entries(res))console.log(k,'controls',r.controls,'small',r.small.length,'highlight',r.highlight,'selectable',r.selectable,'zoom',r.zoom.length,'imgCallout',r.imagesWithCallout,'taAuto',r.touchActionAuto,r.overscroll.join('/'),r.textSizeAdjust);
await browser.close();await server.close();
