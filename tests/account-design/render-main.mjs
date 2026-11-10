import {signedIn,nav,snap,browser,server,out} from './lib.mjs';
const widths=(process.env.W||'390,1280').split(',').map(Number),themes=(process.env.T||'caribbean,rose').split(',');
for(const w of widths)for(const t of themes){const v=await signedIn(w,t);const {p}=v;const pre=t==='rose'?'violet':'cupcake';await p.waitForTimeout(400);
await p.screenshot({path:`${out}/${pre}-today-fold-${w}.png`});await snap(v,`${pre}-today-${w}`);
await nav(p,'Food');await p.waitForTimeout(300);await p.screenshot({path:`${out}/${pre}-food-fold-${w}.png`});
await nav(p,'Assistant');await p.waitForTimeout(300);await p.screenshot({path:`${out}/${pre}-assistant-fold-${w}.png`});
await nav(p,'Reports');await p.waitForTimeout(500);await p.screenshot({path:`${out}/${pre}-reports-fold-${w}.png`});
await v.c.close();}
await browser.close();await server.close();
