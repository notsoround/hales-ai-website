import test from 'node:test';
import assert from 'node:assert/strict';
import {TalkCheckpointRecovery} from '../src/components/cupcake/talkCheckpoints.ts';
import {TalkLineDrain,VoiceEndingCoordinator,closeVoiceTransport,persistTalk,readTalks,saveTalk} from '../src/components/cupcake/voiceHistory.ts';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
function storage(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}}
const line=text=>({role:'You',text});
const response=p=>({session:{id:p.sessionId,version:p.version,documentId:'doc_synthetic'},libraryStatus:'indexed'});
test('lost response retries exact version after page reopen; no duplicate import',async()=>{
 const disk=storage(),sent=[];const a=new TalkCheckpointRecovery(disk,async p=>{sent.push(JSON.stringify(p));throw Error('response lost')});
 a.create('synthetic','2026-09-19T00:00:00Z');a.capture('synthetic',[line('Original')]);await assert.rejects(a.flush('synthetic'));
 const reopened=new TalkCheckpointRecovery(disk,async p=>{sent.push(JSON.stringify(p));return response(p)});await reopened.flush('synthetic');assert.equal(sent[0],sent[1]);assert.equal(reopened.pending().length,0);
});
test('events arriving during queued flush retain full immutable prefix and final',async()=>{
 const disk=storage(),sent=[];let release;const gate=new Promise(r=>release=r);
 const a=new TalkCheckpointRecovery(disk,async p=>{sent.push(p);if(sent.length===1)await gate;return response(p)});
 a.create('synthetic','2026-09-19T00:00:00Z');a.capture('synthetic',[line('First')]);const work=a.flush('synthetic');
 a.capture('synthetic',[line('First'),line('Late final event')],true);const duplicate=a.flush('synthetic');assert.equal(work,duplicate);release();await work;
 assert.deepEqual(sent.map(p=>[p.version,p.lines.length,p.final]),[[1,1,false],[2,2,true]]);
 assert.equal(a.pending().length,0);assert.equal(a.talks()[0].lines.length,2);
});
test('server rejection retains original and pending checkpoint without silent truncation',async()=>{
 const a=new TalkCheckpointRecovery(storage(),async()=>{throw Error('size limit')});a.create('synthetic','2026-09-19T00:00:00Z');
 const lines=Array.from({length:125},(_,i)=>line('x'.repeat(3000)+i));a.capture('synthetic',lines,true);await assert.rejects(a.flush('synthetic'));assert.deepEqual(a.talks()[0].lines,lines);assert.equal(a.pending().length,1);
 const drain=new TalkLineDrain();for(const l of lines)drain.append(l);assert.deepEqual(drain.snapshot(),lines);
});
test('legacy history untouched by checkpoint initialization and full transcripts preserved',()=>{
 globalThis.localStorage=storage();saveTalk({id:'legacy',title:'Legacy',startedAt:'synthetic',endedAt:'synthetic',lines:[line('original')]});
 const before=JSON.stringify(readTalks());const a=new TalkCheckpointRecovery(localStorage,async p=>response(p));assert.equal(a.list().length,0);assert.equal(JSON.stringify(readTalks()),before);
});
test('actual Studio path captures only final events, periodic flush, drain-before-final, explicit legacy import',()=>{
 const s=readFileSync(new URL('../src/components/cupcake/CupcakeStudio.tsx',import.meta.url),'utf8');
 assert.match(s,/d.transcriptType\s*===\s*'final'/);assert.match(s,/capture\(checkpointId,next\)/);assert.match(s,/setInterval\(recover,5000\)/);
 assert.match(s,/closeVoiceTransport\(c,\(\)=>saveCaptured\(true\)\)/);
 assert(s.indexOf('if(checkpointRecovery.current!.get(talk.id))')<s.indexOf("action:'import'"));
});
test('full or denied device storage never blocks exact pending server flush',async()=>{
 const disk=storage();disk.setItem=()=>{throw Error('quota')};const sent=[];
 const a=new TalkCheckpointRecovery(disk,async p=>{sent.push(JSON.stringify(p));if(sent.length===1)throw Error('lost reply');return response(p)});
 a.create('synthetic','2026-09-19T00:00:00Z');a.capture('synthetic',[line('No durable local copy')],true);
 await assert.rejects(a.flush('synthetic'));await a.flush('synthetic');
 assert.equal(sent[0],sent[1]);assert.equal(a.pending().length,0);assert.match(a.warning(),/No durable device copy/);
 const unavailable=new TalkCheckpointRecovery(null,async p=>response(p));
 unavailable.create('memory','2026-09-19T00:00:00Z');unavailable.capture('memory',[line('Kept in memory')]);await unavailable.flush('memory');assert.equal(unavailable.exportOriginals().records[0].lines[0].text,'Kept in memory');
});
test('one malformed local record does not block healthy recovery or raw export',async()=>{
 const disk=storage();disk.setItem('cupcake-talk-checkpoint-v1:broken','{original malformed bytes');
 disk.setItem('cupcake-talk-checkpoint-v1:invalid',JSON.stringify({id:'invalid',title:'Incomplete state',lines:[line('Preserve original')],version:0,ackCount:0}));
 const a=new TalkCheckpointRecovery(disk,async p=>response(p));a.create('healthy','2026-09-19T00:00:00Z');a.capture('healthy',[line('Healthy original')]);
 assert.equal(a.pending().length,1);await a.flush('healthy');
 assert.equal(a.talks()[0].lines[0].text,'Healthy original');
 assert.equal(a.exportOriginals().rawRecords.find(r=>r.key.endsWith(':broken')).value,'{original malformed bytes');
 assert.equal(JSON.parse(a.exportOriginals().rawRecords.find(r=>r.key.endsWith(':invalid')).value).lines[0].text,'Preserve original');
 assert.match(a.warning(),/unreadable saved Talk/);
});
test('remote history opens as acknowledged read-only state and archive survives reopen',async()=>{
 const disk=storage();let sends=0;const send=async()=>{sends++;throw Error('Hydration must never write')};
 const a=new TalkCheckpointRecovery(disk,send);
 const remote={id:'remote',title:'Other device',createdAt:1000,updatedAt:2000,version:4,final:true,documentId:'doc_remote',lines:[{...line('Whole remote transcript'),transcriptType:'final'}]};
 assert.equal(a.adoptRemote(remote).lines[0].text,'Whole remote transcript');assert.equal(a.pending().length,0);
 a.setArchived('remote',true);const b=new TalkCheckpointRecovery(disk,send);assert.equal(b.talks()[0].archived,true);
 assert.equal(b.adoptRemote(remote).archived,true);await b.flush('remote');assert.equal(sends,0);
 b.setArchived('remote',false);assert.equal(new TalkCheckpointRecovery(disk,send).isArchived('remote'),false);
});
test('remote hydration cannot overwrite an unacknowledged device suffix',()=>{
 const a=new TalkCheckpointRecovery(storage(),async p=>response(p));a.create('shared','2026-09-19T00:00:00Z');a.capture('shared',[line('Original'),line('Unsaved suffix')]);
 const loaded=a.adoptRemote({id:'shared',title:'Remote',createdAt:1,updatedAt:2,version:1,final:false,documentId:'doc_shared',lines:[{...line('Original'),transcriptType:'final'}]});
 assert.deepEqual(loaded.lines.map(l=>l.text),['Original','Unsaved suffix']);assert.equal(a.pending().length,1);
});
test('replayed response from a newer server revision advances without reusing that revision',async()=>{
 const sent=[],lines=[line('First'),line('Second')];
 const a=new TalkCheckpointRecovery(storage(),async p=>{sent.push(p);return {session:{id:p.sessionId,version:2,documentId:'doc_shared',final:true,lines:lines.map(l=>({...l,transcriptType:'final'}))},libraryStatus:'indexed'}});
 a.create('shared','2026-09-19T00:00:00Z');a.capture('shared',[lines[0]]);await a.flush('shared');
 assert.equal(sent.length,1);assert.deepEqual(a.talks()[0].lines,lines);assert.equal(a.pending().length,0);
});
test('actual Studio teardown still flushes newest final lines after quota failure and unmount',async()=>{
 const source=readFileSync(new URL('../src/components/cupcake/CupcakeStudio.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('studio.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let declaration;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='endVoice')declaration=`var ${n.getText(ast)};`;ts.forEachChild(n,visit)}visit(ast);
 const disk=storage(),sent=[];globalThis.localStorage=disk;
 const recovery=new TalkCheckpointRecovery(disk,async p=>{sent.push(p);return response(p)});
 recovery.create('ending','2026-09-19T00:00:00Z');recovery.capture('ending',[line('Earlier')]);await recovery.flush('ending');
 disk.setItem=()=>{throw Error('quota')};const latest=[line('Earlier'),line('Final phrase received before teardown')];recovery.capture('ending',latest);
 const drain=new TalkLineDrain();for(const l of latest)drain.append(l);const ref=current=>({current});
 const scope={useCallback:f=>f,stoppingVoice:ref(false),voiceAcquisition:ref(null),endingVoice:ref(new VoiceEndingCoordinator()),call:ref({leave:async()=>{},destroy:async()=>{}}),remoteId:ref(null),talkLocalId:ref('ending'),talkStarted:ref('2026-09-19T00:00:00Z'),voiceMic:ref(null),players:ref(new Map()),lineDrain:ref(drain),talkCapture:ref({id:'ending',startedAt:'2026-09-19T00:00:00Z',drain,closing:false}),linesRef:ref(latest),checkpointRecovery:ref(recovery),mounted:ref(false),voiceGeneration:ref(0),closeVoiceTransport,persistTalk,flushTalk:id=>recovery.flush(id),syncTalk:async()=>{},endRemote:async()=>{}};
 vm.createContext(scope);vm.runInContext(ts.transpileModule(declaration,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
 await scope.endVoice();await recovery.flush('ending');assert.equal(sent.at(-1).final,true);assert.equal(sent.at(-1).lines.length,2);assert.equal(recovery.pending().length,0);
});
