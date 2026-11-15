// Light theme audit: finds dark islands (opaque dark backgrounds) and text below AA on its real background,
// per screen, grouped by class. Run: SCHEME=light RICH=1 W=390 T=caribbean ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/light-audit.mjs
import {signedIn,nav,browser,server,out} from './lib.mjs';import{writeFileSync}from'node:fs';
const widths=(process.env.W||'390').split(',').map(Number),themes=(process.env.T||'caribbean,rose').split(',');
const scan=p=>p.evaluate(()=>{const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return{r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1};};
const lin=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4},lum=c=>.2126*lin(c.r)+.7152*lin(c.g)+.0722*lin(c.b);
const over=(t,b)=>({r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1});
const bgOf=e=>{const stack=[];for(let n=e;n&&n.nodeType===1;n=n.parentElement){const s=getComputedStyle(n),c=parse(s.backgroundColor);if(c&&c.a>0)stack.push(c);if(c&&c.a>=.99)break;}let b={r:244,g:246,b:247,a:1};for(const c of stack.reverse())b=over(c,b);return b;};
const name=e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,3).join('.'):'');
const vis=e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.opacity!=='0'&&!e.closest('[hidden],details:not([open])>:not(summary)');};
const dark=[],low=[];for(const e of document.querySelectorAll('.cc-app *')){if(!vis(e))continue;const s=getComputedStyle(e),c=parse(s.backgroundColor);
if(c&&c.a>.4&&lum(c)<.12&&!e.closest('.cc-cam,video,img,.cc-assistant-portrait'))dark.push(name(e)+' bg '+s.backgroundColor);
if(s.backgroundImage&&/gradient/.test(s.backgroundImage)&&/rgba?\((?:[0-9]{1,2}|1[0-9]{2}),\s*(?:[0-9]{1,2}),/.test(s.backgroundImage)&&!/rgba\([^)]*,\s*0\)/.test(s.backgroundImage.split('rgb')[1]||''))dark.push(name(e)+' gradient '+s.backgroundImage.slice(0,90));
const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!own)continue;const f=parse(s.color);if(!f)continue;const bg=bgOf(e),fg=over({...f,a:f.a*Number(s.opacity||1)},bg);const L1=lum(fg),L2=lum(bg),cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);const big=parseFloat(s.fontSize)>=24||parseFloat(s.fontSize)>=18.6&&+s.fontWeight>=700;
if(cr<(big?3:4.5))low.push(name(e)+' '+cr.toFixed(2)+' "'+e.textContent.trim().slice(0,30)+'"');}
const u=a=>[...new Set(a)];return{dark:u(dark),low:u(low)};});
const report={};
for(const w of widths)for(const t of themes){const v=await signedIn(w,t),{p}=v;await p.waitForTimeout(400);
 for(const tab of ['Today','Food','Assistant','Reports']){if(tab!=='Today')await nav(p,tab);await p.waitForTimeout(500);report[`${t}-${w}-${tab}`]=await scan(p);}
 await nav(p,'Today');await p.locator('.cc-settings>summary').first().click({force:true}).catch(e=>console.log('settings',e.message.split('\n')[0]));await p.waitForTimeout(300);await p.locator('.cc-settings-group summary').evaluateAll(s=>s.forEach(x=>x.click()));await p.waitForTimeout(300);report[`${t}-${w}-Settings`]=await scan(p);await p.screenshot({path:`${out}/${t}-settings-${w}.png`,fullPage:true});
 await v.c.close();}
writeFileSync(`${out}/light-audit.json`,JSON.stringify(report,null,1));for(const[k,r]of Object.entries(report))console.log(k,'dark',r.dark.length,'low',r.low.length);
await browser.close();await server.close();
