// Actual AccountSessionGate/transport with local responses; no production requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir,tmpdir} from 'node:os';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const require=createRequire(import.meta.url),playwright=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir=mkdtempSync(path.join(tmpdir(),'cupcake-first-visit-'));
const server=await createServer({cacheDir,plugins:[{name:'synthetic-session-root',configureServer(s){s.middlewares.use((req,_res,next)=>{if(req.url?.split('?')[0]==='/cupcake/account')req.url='/tests/session-first-visit-preview.html';next();});}}],define:{'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS':'"true"'},server:{host:'127.0.0.1',port:0,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});
await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}/`,warning='Your session expired or changed. Sign in again.';let checks=0;
try {for(const engine of ['chromium','webkit']) {
  const browser=await playwright[engine].launch({headless:true});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>console.error('Fixture error:',e.message));await page.goto(base+'cupcake/account');
    const ready=async()=>{try{await page.getByRole('heading',{name:/^Sign in to /}).waitFor();}catch(error){console.error('Synthetic page headings:',await page.locator('h1,h2').allTextContents(),page.url());throw error;}await page.waitForFunction(()=>!document.querySelector('.cc-unlock button.cc-primary')?.disabled);};
    const login=async()=>{await page.getByLabel('Email',{exact:true}).fill('a@example.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic password 123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Signed in: Synthetic A',exact:true}).waitFor();};
    await ready();assert.equal(await page.getByText(warning,{exact:true}).count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('cupcake-account-lock-v1')),null);checks++;
    await login();
    // A second unsigned tab's initial401 must not sign out the known first tab.
    const firstLock=await page.evaluate(()=>localStorage.getItem('cupcake-account-lock-v1'));
    const sibling=await context.newPage();
    await sibling.goto(base+'cupcake/account');await sibling.waitForFunction(()=>!document.querySelector('.cc-unlock button.cc-primary')?.disabled);
    assert.equal(await sibling.getByText(warning,{exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('cupcake-account-lock-v1')),firstLock);assert.equal(await page.getByRole('heading',{name:'Signed in: Synthetic A',exact:true}).isVisible(),true);await sibling.close();checks++;
    await page.evaluate(async()=>{window.sessionFixture.expire();const s=await import('/src/components/cupcake/accountSession.ts');await s.verifySession();});
    await ready();await page.getByText(warning,{exact:true}).waitFor();checks++;
    await login();await page.evaluate(async()=>{window.sessionFixture.expire();const s=await import('/src/components/cupcake/accountSession.ts');await s.restoreSession();});
    await ready();await page.getByText(warning,{exact:true}).waitFor();checks++;
    await login();await page.evaluate(async()=>{window.sessionFixture.mismatch();const s=await import('/src/components/cupcake/accountSession.ts');await s.accountData({action:'projects'}).catch(()=>{});});
    await ready();await page.getByText(warning,{exact:true}).waitFor();checks++;
    await context.close();
  }finally{await browser.close();}
}}finally{await server.close();rmSync(cacheDir,{recursive:true,force:true});}
console.log(`PASS: ${checks} Chromium/WebKit session cases; neutral first visit/no sibling lock; known-session verify/restore401 and context409 still lock; no real credentials or requests`);
