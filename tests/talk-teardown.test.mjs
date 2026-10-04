import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {TalkCheckpointRecovery} from '../src/components/cupcake/talkCheckpoints.ts';
import {TalkLineDrain,VoiceEndingCoordinator,closeVoiceTransport,persistTalk,startingContextFor,continuationContext} from '../src/components/cupcake/voiceHistory.ts';

const source=readFileSync(new URL('../src/components/cupcake/CupcakeStudio.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('studio.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),bodies=[];
function visit(n){
 if(ts.isFunctionDeclaration(n)&&['startVoice','mergeTalks'].includes(n.name?.text))bodies.push(n.getText(ast));
 if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='endVoice')bodies.push(`var ${n.getText(ast)};`);
 ts.forEachChild(n,visit);
}visit(ast);
const executable=ts.transpileModule(bodies.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const tick=()=>new Promise(r=>setTimeout(r,0));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function harness(){
 const map=new Map(),storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 globalThis.localStorage=storage;
 const sent=[],transports=[],requests=[];let id=0;
 const recovery=new TalkCheckpointRecovery(storage,async p=>{sent.push(JSON.parse(JSON.stringify(p)));return {session:{id:p.sessionId,version:p.version,documentId:'doc_'+p.sessionId,...(p.startingContext?{startingContext:p.startingContext}:{})},libraryStatus:'indexed'}});
 const ref=current=>({current});
 const scope={callSeed:null,setCallSeed:v=>{scope.callSeed=v},TALK_SEED_KEY:'seed',sessionStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},startingContextFor,continuationContext,useCallback:f=>f,recording:false,busy:false,micTesting:false,voice:'idle',stoppingVoice:ref(false),voiceAcquisition:ref(null),voiceGeneration:ref(0),mounted:ref(true),inputDevice:'',
  lineDrain:ref(new TalkLineDrain()),talkCapture:ref(null),linesRef:ref([]),talkStarted:ref(''),talkLocalId:ref(''),checkpointRecovery:ref(recovery),endingVoice:ref(new VoiceEndingCoordinator()),voiceMic:ref(null),call:ref(null),remoteId:ref(null),players:ref(new Map()),
  setError:()=>{},setPreview:()=>{},setOpenedTalk:()=>{},setSpeaking:()=>{},setMuted:()=>{},setCheckpointStatus:()=>{},setTalks:()=>{},
  setVoice:v=>{scope.voice=v},setLines:lines=>{scope.visibleLines=lines},visibleLines:[],
  crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`},Date,AbortController,TalkLineDrain,
  navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}],getAudioTracks:()=>[{}]})}},
  acquireMicrophone:async fn=>fn({}),microphoneConstraints:()=>({}),mediaError:e=>e.message,
  request:async()=>{requests.push('explicit start');return {callId:'synthetic-call',webCallUrl:'synthetic://no-network'}},
  Daily:{createCallObject(){const handlers=new Map(),left=deferred(),destroyed=deferred();const transport={left,destroyed,on:(name,fn)=>handlers.set(name,fn),join:async()=>{},leave:()=>left.promise,destroy:()=>destroyed.promise,emit:(text,eventId)=>handlers.get('app-message')({data:{type:'transcript',transcriptType:'final',role:'user',transcript:text,id:eventId}})};transports.push(transport);return transport}},
  closeVoiceTransport:(transport,confirmed)=>closeVoiceTransport(transport,confirmed,3),persistTalk,flushTalk:id=>recovery.flush(id),endRemote:async()=>{},
 };
 vm.createContext(scope);vm.runInContext(executable,scope);
 return {scope,recovery,storage,sent,transports,requests};
}
for(const unmounted of [false,true])test(`late final events survive timeout ${unmounted?'and unmount':'and a new overlapping call'}`,async()=>{
 const h=harness();await h.scope.startVoice();const oldId=h.scope.talkLocalId.current,old=h.transports[0];old.emit('Before stop','old1');
 if(unmounted)h.scope.mounted.current=false;
 await h.scope.endVoice();await h.recovery.flush(oldId);
 assert.equal(h.recovery.get(oldId).final,false,'timeout must never finalize');
 let newId;
 if(!unmounted){await h.scope.startVoice();newId=h.scope.talkLocalId.current;h.transports[1].emit('New call original','new1');}
 old.emit('Late final transcript after UI teardown','old2');await h.recovery.flush(oldId);
 assert.deepEqual(h.recovery.get(oldId).lines.map(l=>l.text),['Before stop','Late final transcript after UI teardown']);
 assert.equal(h.recovery.get(oldId).final,false);
 old.left.resolve();old.destroyed.resolve();await tick();await h.recovery.flush(oldId);
 assert.equal(h.recovery.get(oldId).final,true);assert.equal(h.sent.filter(p=>p.sessionId===oldId).at(-1).lines.length,2);
 const reopened=new TalkCheckpointRecovery(h.storage,async()=>{throw Error('Recovery must not call a provider')});assert.equal(reopened.get(oldId).lines.length,2);
 if(!unmounted){assert.equal(h.scope.call.current,h.transports[1]);assert.equal(h.scope.voice,'live');assert.equal(h.recovery.get(newId).lines[0].text,'New call original');assert.equal(h.scope.visibleLines[0].text,'New call original');}
 assert.equal(h.requests.length,unmounted?1:2,'only explicit starts request sessions');
});
test('rejected teardown stays nonfinal and still saves received lines',async()=>{
 const h=harness();await h.scope.startVoice();const id=h.scope.talkLocalId.current,t=h.transports[0];t.emit('Original','first');
 const ending=h.scope.endVoice();t.left.reject(Error('synthetic leave failure'));t.destroyed.resolve();await ending;
 t.emit('Received after rejected teardown','late');await h.recovery.flush(id);
 assert.equal(h.recovery.get(id).final,false);assert.equal(h.recovery.get(id).lines.length,2);assert.equal(h.requests.length,1);
});

test('actual startup keeps selected context after microphone denial and clears only after joined retry',async()=>{
 const h=harness(),seed={id:'intervention-seed-owned',title:'Selected call',startedAt:'2026-10-03T00:00:00Z',endedAt:'2026-10-03T00:00:00Z',lines:[{role:'Cupcake',text:'Original reason'}]};
 h.scope.acquireMicrophone=async()=>{throw Error('Denied')};await h.scope.startVoice(seed);
 assert.equal(h.scope.callSeed,seed);assert.equal(JSON.parse(h.scope.sessionStorage.getItem('seed')).id,seed.id);assert.equal(h.requests.length,0);
 h.scope.acquireMicrophone=async fn=>fn({});await h.scope.startVoice();
 assert.equal(h.scope.callSeed,null);assert.equal(h.scope.sessionStorage.getItem('seed'),null);
 const state=h.recovery.get(h.scope.talkLocalId.current);assert.equal(state.startingContext.lines[0].text,'Original reason');assert.deepEqual(state.lines,[]);
});

test('room creation rejection preserves explicit previous Talk selection for retry',async()=>{
 const h=harness(),previous={id:'prior-talk',title:'Earlier Talk',startedAt:'2026-10-03T00:00:00Z',endedAt:'2026-10-03T00:00:00Z',lines:[{role:'You',text:'Continue this question'}]};
 h.scope.request=async()=>{throw Error('Room unavailable')};await h.scope.startVoice(previous);
 assert.equal(h.scope.callSeed,previous);assert.equal(JSON.parse(h.scope.sessionStorage.getItem('seed')).id,previous.id);assert.equal(h.transports.length,0);
});
