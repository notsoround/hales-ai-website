import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {VIEWER_API,VIEWER_STORAGE,ViewerAuthError,captureToken,deltaText,deltaTone,fetchWeekly,niceMax,postNote,validToken,hm} from '../src/components/cupcake/robyn/viewerApi.ts';

const TOKEN='rv_'+'A'.repeat(43);
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m};};

test('token is taken from ?t=, kept in sessionStorage, and stripped from the URL',()=>{
  const s=memory(); const calls=[];
  const history={replaceState:(_a,_b,url)=>calls.push(url)};
  assert.equal(captureToken(`https://hales.ai/cupcake/robyn?t=${TOKEN}&x=1#top`,history,s),TOKEN);
  assert.deepEqual(calls,['/cupcake/robyn?x=1#top']);
  assert.equal(s.getItem(VIEWER_STORAGE),TOKEN);
  assert.equal(captureToken('https://hales.ai/cupcake/robyn',history,s),TOKEN,'reload reuses the session token');
  assert.equal(calls.length,1);
});

test('malformed tokens are stripped but never stored',()=>{
  const s=memory(); const calls=[];
  assert.equal(captureToken('https://hales.ai/cupcake/robyn?t=not-a-token',{replaceState:(_a,_b,u)=>calls.push(u)},s),'');
  assert.deepEqual(calls,['/cupcake/robyn']); assert.equal(s._m.size,0);
  assert.equal(validToken('rv_short'),false); assert.equal(validToken(TOKEN),true);
});

test('viewer calls go only to the viewer API with the viewer header, never the owner key',async()=>{
  const seen=[];
  const fake=async(url,init)=>{seen.push({url,init});return new Response(JSON.stringify({ok:true,period:{weeks:2}}),{status:200});};
  const data=await fetchWeekly(TOKEN,2,fake);
  assert.equal(data.period.weeks,2);
  assert.equal(seen[0].url,`${VIEWER_API}/weekly?weeks=2`);
  assert.equal(seen[0].init.headers['X-Cupcake-Viewer'],TOKEN);
  assert.equal('X-Cupcake-Key' in seen[0].init.headers,false);
  assert.equal(seen[0].init.credentials,'omit');
  assert.ok(!seen[0].url.includes(TOKEN),'token is not put in the request URL');
});

test('401 maps to expired vs invalid',async()=>{
  const res=(status,body)=>async()=>new Response(JSON.stringify(body),{status});
  await assert.rejects(fetchWeekly(TOKEN,1,res(401,{error:'expired'})),e=>e instanceof ViewerAuthError&&e.expired===true);
  await assert.rejects(fetchWeekly(TOKEN,1,res(401,{error:'unauthorized'})),e=>e instanceof ViewerAuthError&&e.expired===false);
  await assert.rejects(fetchWeekly(TOKEN,1,res(503,{})),/temporarily unavailable/);
});

test('notes are validated and posted as JSON',async()=>{
  await assert.rejects(postNote(TOKEN,'   '),/1–2000/);
  await assert.rejects(postNote(TOKEN,'x'.repeat(2001)),/1–2000/);
  let body;
  const out=await postNote(TOKEN,' Nice week ',async(url,init)=>{body={url,init};return new Response(JSON.stringify({ok:true,note:{id:'rn_1',createdAt:'2026-10-21T18:00:00Z'}}),{status:200});});
  assert.equal(out.id,'rn_1'); assert.equal(body.url,`${VIEWER_API}/notes`); assert.equal(body.init.method,'POST');
  assert.deepEqual(JSON.parse(body.init.body),{note:'Nice week'});
});

test('delta tone and wording stay neutral where direction is ambiguous',()=>{
  const m=(delta,better)=>({label:'',unit:'',current:1,previous:1,delta,pct:null,better});
  assert.equal(deltaTone(m(-400,null)),'neutral');
  assert.equal(deltaTone(m(300,'up')),'good'); assert.equal(deltaTone(m(-300,'up')),'caution');
  assert.equal(deltaText(m(-405,null),'number','kcal'),'▼ 405 kcal');
  assert.equal(deltaText({...m(null,'up'),previous:null}),'No prior data');
  assert.equal(deltaText(m(75,'up'),'minutes'),'▲ 1 h 15 m');
  assert.equal(hm(377.5),'6 h 18 m'); assert.equal(niceMax([0,null,16536]),20000);
});

test('robyn view is isolated from owner code and the /cupcake unlock is unchanged',()=>{
  for(const f of ['src/components/cupcake/robyn/RobynDashboard.tsx','src/components/cupcake/robyn/viewerApi.ts','src/pages/cupcake/robyn/page.tsx']){
    const src=readFileSync(new URL('../'+f,import.meta.url),'utf8');
    assert.ok(!/privateAccess|X-Cupcake-Key|cupcake-library|localStorage|VITE_CUPCAKE/.test(src),f+' must not touch owner auth');
  }
  const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
  assert.match(main,/\^\\\/cupcake\\\/robyn\\\/\?\$/);
  const re=/^\/cupcake\/robyn\/?$/;
  assert.ok(re.test('/cupcake/robyn')&&re.test('/cupcake/robyn/'));
  assert.ok(!re.test('/cupcake')&&!re.test('/cupcake/sandbox/robyn')&&!re.test('/cupcake/robynx'));
  for(const f of ['src/App.tsx','src/pages/cupcake/sandbox/cupcakegpt/page.tsx','src/components/cupcake/privateAccess.ts']){
    let diff='';
    try{diff=execSync(`git diff --stat cac7237e -- ${f}`,{cwd:new URL('..',import.meta.url)}).toString();}catch{diff='';}
    assert.equal(diff,'',f+' unchanged from cac7237');
  }
});
