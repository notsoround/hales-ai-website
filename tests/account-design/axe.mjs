import {signedIn,nav,browser,server} from './lib.mjs';import {readFileSync,writeFileSync} from 'node:fs';
const axe=readFileSync(process.env.AXE,'utf8');const all=[];
async function run(p,name){await p.waitForTimeout(400);await p.addScriptTag({content:axe});const r=await p.evaluate(async()=>{const res=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']},resultTypes:['violations']});return res.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,help:v.help,targets:v.nodes.slice(0,4).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').split('\n').slice(1,2).join(''))}));});all.push({name,r});}
for(const t of ['caribbean','rose']){const v=await signedIn(390,t);const {p}=v;
await run(p,t+' today');await nav(p,'Food');await run(p,t+' food');
for(const tab of ['Meal plan','Groceries']){await p.getByRole('tab',{name:tab,exact:true}).click();await p.waitForTimeout(500);await run(p,t+' '+tab);}
await nav(p,'Library');await run(p,t+' library');await nav(p,'Reports');await run(p,t+' reports');
await nav(p,'Assistant');await run(p,t+' assistant');await nav(p,'Assistant');
await p.locator('.cc-settings>summary').click();await run(p,t+' settings');await v.c.close();}
writeFileSync(process.env.OUT,JSON.stringify(all,null,1));
const agg={};for(const x of all)for(const v of x.r){agg[v.id]=agg[v.id]||{help:v.help,impact:v.impact,pages:[],ex:v.targets};agg[v.id].pages.push(x.name+'('+v.n+')');}
console.log(JSON.stringify(agg,null,1));await browser.close();await server.close();
