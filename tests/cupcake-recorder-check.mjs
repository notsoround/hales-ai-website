import ts from 'typescript';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/components/cupcake/CupcakeStudio.tsx','utf8');
const ast=ts.createSourceFile('studio.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let fn;
function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='startRecording')fn=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);
assert.ok(fn);
const js=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
async function scenario({failStorage=false,auto=true,sample=128}={}){
 const events=[];let instance;const frames=[];
 class AudioContext{async resume(){} createAnalyser(){return {fftSize:512,getByteTimeDomainData:a=>a.fill(sample)}} createMediaStreamSource(){return {connect(){}}}}
 class Recorder{static isTypeSupported(){return true;}constructor(){instance=this;this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['final audio'])});this.onstop();}}
 const scope={AudioContext,meterFrame:{current:0},requestAnimationFrame:f=>{frames.push(f);return frames.length;},recording:false,voice:'idle',busy:false,autoAnalyze:auto,title:'Synthetic',finishing:{current:false},mounted:{current:true},recorder:{current:null},streams:{current:[]},started:{current:0},context:{current:null},window:{MediaRecorder:Recorder},MediaRecorder:Recorder,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[],getAudioTracks:()=>[{label:"Synthetic microphone"}]})}},crypto:{randomUUID:()=> 'test-id'},setPreview:()=>{},setHeardAudio:v=>events.push(["audio",v]),setLevel:()=>{},setInputName:()=>{},setBusy:()=>{},setError:e=>events.push(['error',e]),setRecording:()=>{},setSeconds:()=>{},cleanupTracks:()=>{},putDraft:async d=>events.push(['draft',d.complete]),putChunk:async()=>{await new Promise(r=>setTimeout(r,5));if(failStorage)throw Error('quota');events.push(['chunk']);},refreshDrafts:async()=>events.push(['refresh']),upload:async d=>events.push(['upload',d.complete]),Blob,Date};
 vm.createContext(scope);vm.runInContext(js,scope);await scope.startRecording(false);frames.shift()?.(200);instance.stop();await new Promise(r=>setTimeout(r,35));return events;
}
const normal=await scenario();assert.equal(normal.filter(x=>x[0]==='upload').length,1);assert.ok(normal.findIndex(x=>x[0]==='chunk')<normal.findIndex(x=>x[0]==='upload'));assert.ok(normal.some(x=>x[0]==='draft'&&x[1]===true));
assert.equal((await scenario({auto:false})).filter(x=>x[0]==='upload').length,0);
assert.equal((await scenario({failStorage:true})).filter(x=>x[0]==='upload').length,0);
assert.ok(!/elapsed\s*[>=]+\s*\d/.test(source));
assert.equal((await scenario({sample:128})).some(e=>e[0]==='audio'&&e[1]===true),false);
assert.equal((await scenario({sample:148})).some(e=>e[0]==='audio'&&e[1]===true),true);
console.log('PASS: live meter distinguishes silence from signal; final chunk saved before automatic upload; local-only respected; storage failure never uploads; no timer cutoff.');
