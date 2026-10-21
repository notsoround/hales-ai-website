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

// ---- v2: details, export, chat, voice, coach, RP app link ----
import {fetchDetails,fetchExport,sendChat,startVoice,endVoice,fetchCoach,trimHistory,markdownLight,rpAppLink,adherence,dailyActuals,exportName,RP_APP,CHAT_MAX} from '../src/components/cupcake/robyn/viewerApi.ts';

const ok=(body)=>async(url,init)=>{ok.seen.push({url,init});return new Response(typeof body==='string'?body:JSON.stringify(body),{status:200});};
ok.seen=[];

test('v2 viewer calls use only viewer endpoints with the viewer header',async()=>{
  ok.seen=[];
  await fetchDetails(TOKEN,4,ok({ok:true,days:[]}));
  await fetchExport(TOKEN,2,'csv','meals',ok('date,time\n'));
  await fetchExport(TOKEN,1,'json','days',ok({schema:'x'}));
  await fetchCoach(TOKEN,ok({ok:true,has_data:false}));
  assert.equal(await sendChat(TOKEN,' hi ',[{role:'assistant',content:'Hello'}],ok({answer:'Yes'})),'Yes');
  await startVoice(TOKEN,ok({session:'rv_s_1',webCall:{id:'c',webCallUrl:'https://x.daily.co/r'}}));
  await endVoice(TOKEN,'rv_s_1',ok({ended:true}));
  assert.deepEqual(ok.seen.map(s=>s.url.replace(VIEWER_API,'')),['/details?weeks=4','/export?weeks=2&format=csv&section=meals','/export?weeks=1&format=json','/coach','/chat','/voice/start','/voice/end']);
  for(const s of ok.seen){assert.equal(s.init.headers['X-Cupcake-Viewer'],TOKEN);assert.equal(s.init.credentials,'omit');assert.ok(!('X-Cupcake-Key' in s.init.headers));}
  assert.deepEqual(JSON.parse(ok.seen[4].init.body),{message:'hi',history:[{role:'assistant',content:'Hello'}]});
  await assert.rejects(sendChat(TOKEN,'x'.repeat(CHAT_MAX+1),[],ok({})));
  assert.equal(exportName(2,'2026-10-21','csv','meals'),'matt-hales-2w-2026-10-21-meals.csv');
});

test('chat history is trimmed client-side and markdown-light never yields HTML',()=>{
  const turns=Array.from({length:14},(_,i)=>({role:i%2?'assistant':'user',content:'m'+i}));
  assert.equal(trimHistory(turns).length,10); assert.equal(trimHistory(turns)[0].content,'m4');
  const md=markdownLight('**Sessions**: 8 vs 5\n- <b>steps</b> up');
  assert.deepEqual(md[0].segs,[{bold:true,text:'Sessions'},{bold:false,text:': 8 vs 5'}]);
  assert.equal(md[1].bullet,true); assert.equal(md[1].segs[0].text,'<b>steps</b> up');
});

test('RP app link: universal link with the store as fallback by platform',()=>{
  assert.deepEqual(rpAppLink('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'),{href:RP_APP.web,fallback:RP_APP.ios});
  assert.deepEqual(rpAppLink('Mozilla/5.0 (Linux; Android 15)'),{href:RP_APP.web,fallback:RP_APP.android});
  assert.deepEqual(rpAppLink('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'),{href:'https://robynpeck.fitbudd.com/app',fallback:null});
});

test('plan adherence and daily actuals from day details',()=>{
  const day=(date,mins,meals=[],steps=null)=>({date,meals,workouts:mins?[{time:'09:00',description:'x',minutes:mins,kcal:100}]:[],sleep:null,steps,weight:[],wins:0,losses:0,food_kcal:meals.length?meals.reduce((a,m)=>a+m.kcal,0):null,exercise_minutes:mins,exercise_kcal:mins?100:0});
  const tpl={days:{mon:[{name:'Strength',minutes:47},{name:'Treadmill',minutes:30}],tue:[{name:'Treadmill',minutes:30}]}};
  const rows=adherence(tpl,[day('2026-10-19',77),day('2026-10-20',10),day('2026-10-21',0),day('2026-10-18',20)]);
  assert.deepEqual(rows.map(r=>r.state),['done','partial','rest','extra']);
  assert.equal(rows[0].planned,77);
  const a=dailyActuals([day('2026-10-19',0,[{kcal:1000,protein_g:50,fat_g:null,carbs_g:100}],8000),day('2026-10-20',0,[],4000)]);
  assert.deepEqual([a.days,a.kcal,a.protein_g,a.fat_g,a.steps,a.water_fl_oz],[1,1000,50,0,6000,null]);
});

test('v2 dashboard modules carry no owner key, private key or unsupported claims',()=>{
  for(const f of ['RobynDashboard.tsx','DaySheet.tsx','CupcakePanel.tsx','CoachSections.tsx','viewerApi.ts']){
    const src=readFileSync(new URL('../src/components/cupcake/robyn/'+f,import.meta.url),'utf8');
    assert.ok(!/X-Cupcake-Key|CUPCAKE_VAPI_API_KEY|cupcake-private-access|sk-[A-Za-z0-9]/.test(src),f);
    assert.ok(!/synced with|beautiful|amazing/i.test(src),f);
  }
});
