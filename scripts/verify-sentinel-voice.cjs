const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('public/lab/sentinel/index.html','utf8');
const script=html.match(/<script type="module" id="sentinel-voice">([\s\S]*?)<\/script>/)[1];
const unit=script.slice(script.indexOf('const voiceConfig='),script.indexOf('const voiceLink='));
function setup({delayImport=false,resolveStart=false}={}){
 const states=[],levels=[],timers=new Map();let seq=0,api,finish,finishImport;
 class FakeVapi{constructor(key){assert.ok(key);this.handlers={};this.stops=0;api=this;}on(name,handler){this.handlers[name]=handler;}emit(name,value){this.handlers[name]?.(value);}start(id,overrides){assert.equal(overrides.voice.voiceId,'Sid');assert.equal(overrides.voice.version,2);assert.equal(overrides.model.tools.length,0);assert.ok(id);return resolveStart?Promise.resolve({}):new Promise(resolve=>finish=resolve);}stop(){this.stops++;}}
 const context={setTimeout:fn=>{timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(unit+'\nglobalThis.make=createVoiceLink;',context);
 const link=context.make({loadVapi:()=>delayImport?new Promise(resolve=>finishImport=()=>resolve(FakeVapi)):Promise.resolve(FakeVapi),onState:(...args)=>states.push(args),onLevel:(...args)=>levels.push(args)});
 return{link,states,levels,timers,get api(){return api;},get completeStart(){return finish;},finish:value=>finish(value),finishImport:()=>finishImport()};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 {
  const s=setup(),p=s.link.toggle();await tick();s.api.emit('call-start');s.api.emit('volume-level',7);s.finish({});await p;
  assert.equal(s.link.phase,'connected');assert.equal(s.levels.at(-1)[1],1);await s.link.toggle();assert.equal(s.link.phase,'idle');assert.ok(s.api.stops);
 }
 {
  const s=setup(),p=s.link.toggle();await tick();s.finish(null);await p;
  assert.equal(s.link.phase,'idle');assert.ok(s.states.some(([,message])=>message?.includes('could not connect')));
 }
 {
  const s=setup(),p=s.link.toggle();await tick();s.api.emit('error');s.finish({});await p;
  assert.equal(s.link.phase,'idle');assert.ok(s.api.stops>=2);
 }
 {
  const s=setup(),p=s.link.toggle();await tick();void s.link.toggle();s.api.emit('call-start');s.finish({});await p;
  assert.equal(s.link.phase,'idle');assert.ok(s.api.stops>=3);
 }
 {
  const s=setup(),p=s.link.toggle();await tick();s.link.dispose();const count=s.states.length;s.api.emit('call-start');s.finish({});await p;
  assert.equal(s.states.length,count);assert.ok(s.api.stops>=3);
 }
 {
  const s=setup({delayImport:true}),p=s.link.toggle();void s.link.toggle();s.finishImport();await p;
  assert.equal(s.api,undefined);assert.equal(s.link.phase,'idle');
 }
 {
  const s=setup({resolveStart:true}),p=s.link.toggle();await p;
  assert.equal(s.link.phase,'connecting');assert.equal(s.timers.size,1);[...s.timers.values()][0]();
  assert.equal(s.link.phase,'idle');assert.ok(s.api.stops);
 }
 {
  const s=setup({delayImport:true}),p=s.link.toggle();const finishOld=s.finishImport;
  [...s.timers.values()][0]();assert.equal(s.link.phase,'idle');
  // A cancelled unresolved import must leave the button actionable immediately.
  assert.ok(s.states.some(([,message])=>message?.includes('took too long')));
  finishOld();await p;assert.equal(s.api,undefined);
 }
 {
  const s=setup(),old=s.link.toggle();await tick();const oldApi=s.api,finishOld=s.completeStart;
  await s.link.toggle();const fresh=s.link.toggle();await tick();const newApi=s.api,finishNew=s.completeStart;
  newApi.emit('call-start');finishOld({});await old;
  assert.equal(s.link.phase,'connected');assert.equal(newApi.stops,0);assert.ok(oldApi.stops>=2);
  finishNew({});await fresh;
 }
 const page=fs.readFileSync('src/components/experience/HalesExperience.tsx','utf8');
 assert.match(page,/allow="microphone; autoplay"/);assert.doesNotMatch(page,/<VoiceButton/);
 assert.match(html,/voiceButton\.addEventListener\('click',talk\)/);
 console.log('PASS: 9 synthetic Sentinel voice lifecycle cases, voice-button binding, and single iframe owner. No network or microphone access.');
})().catch(error=>{console.error(error);process.exitCode=1;});
