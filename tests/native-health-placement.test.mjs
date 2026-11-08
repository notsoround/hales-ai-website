// Real Gate and native health components; fictional, isolated browser responses only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-native-health-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-native-health',configureServer(s){s.middlewares.use((req,_res,next)=>{if(req.url?.split('?')[0]==='/cupcake/account')req.url=req.url.includes('actual_settings=1')?'/tests/account-browser-preview.html':'/tests/native-health-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const request={client_id:'cupcake-android-health-preview-v1',redirect_uri:'ai.hales.cupcake.health.preview:/health/callback',installation_id:'00000000-0000-4000-8000-000000000123',epoch:'1',state:'S'.repeat(43),code_challenge:'H'.repeat(43),code_challenge_method:'S256',types:'sleep,heart_rate,steps'};
const link=(body=request,query='native_health_connect=1')=>base+'/cupcake/account?'+query+'#'+new URLSearchParams(body);
let checks=0;
async function open(browser,url=link(),signedIn=true){const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());if(signedIn)await context.addInitScript(()=>sessionStorage.setItem('synthetic-native-signed-in','1'));await context.addInitScript(()=>sessionStorage.setItem('synthetic-legacy-seeded','1'));const page=await context.newPage();page.setDefaultTimeout(9000);await page.goto(url);return{context,page};}
const count=(p,route)=>p.evaluate(route=>window.nativeFixture.requests.filter(r=>r.route==='native/health/'+route).length,route);
const allow=p=>p.getByRole('button',{name:'Allow selected health uploads',exact:true});
async function permissions(page){await page.getByText('Android app connections',{exact:true}).click();await page.getByText('Android health uploads',{exact:true}).click();}
try{for(const engine of ['chromium','webkit']){const browser=await pw[engine].launch({headless:true});try{
  const actual=await open(browser,base+'/cupcake/account?actual_settings=1',false);await actual.page.getByLabel('Email',{exact:true}).fill('a@example.invalid');await actual.page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await actual.page.getByRole('button',{name:'Sign in',exact:true}).click();await actual.page.locator('summary[aria-label="Settings"]').click();await actual.page.getByText('Account & security',{exact:true}).click();await actual.page.getByLabel('Current password',{exact:true}).waitFor();await actual.page.getByText('Android app connections',{exact:true}).click();await actual.page.getByText('Android health uploads',{exact:true}).click();await actual.page.getByRole('button',{name:'Load upload permissions'}).waitFor();assert.equal(await actual.page.evaluate(()=>window.accountFixture.requests.some(row=>row.route.startsWith('native/'))),false);assert.equal(await actual.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await actual.context.close();checks++;
}finally{await browser.close();}}}finally{await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log('PASS actual Settings native controls');
