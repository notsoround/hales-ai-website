import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const directory='src/components/cupcake/';
const source=name=>readFileSync(directory+name,'utf8');
const node=(type,props)=>({type,props:props||{}});
const text=value=>value==null||typeof value==='boolean'?'':Array.isArray(value)?value.map(text).join(' '):typeof value==='object'?text(value.props?.children):String(value);
function module(name,append=''){
  const context={exports:{},URLSearchParams,location:{search:''},require(imported){
    if(imported==='react')return {useState:initial=>[initial,()=>{}]};
    if(imported==='react/jsx-runtime')return {jsx:node,jsxs:node,Fragment:'fragment'};
    return new Proxy({}, {get:()=>()=>null});
  }};
  vm.runInNewContext(ts.transpileModule(source(name)+append,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
  return context.exports;
}
const panel=module('ConversationPanel.tsx').default;
const render=status=>text(panel({record:{id:'a'.repeat(32),title:'Synthetic audio',createdAt:'2026-11-07T12:00:00Z',status},onClose(){},onAsk:async()=>{},asking:false}));
const stored=render('stored');assert.match(stored,/Original audio saved/);assert.match(stored,/Transcription and summaries have not been started/);assert.match(stored,/has no transcript to ask about/);assert.match(stored,/has not been transcribed/);assert.doesNotMatch(stored,/Preparing your transcript|Processing continues|Commitments will appear after processing/);
assert.match(render('transcribing'),/Preparing your transcript/);assert.match(render('transcribing'),/Processing continues/);assert.match(render('failed'),/Processing needs attention/);assert.doesNotMatch(render('ready'),/Preparing your transcript|Original audio saved/);
const label=module('LibraryWorkspace.tsx','\nexport {statusName};').statusName;
assert.equal(label('stored'),'Original saved');assert.equal(label('ready'),'Ready');assert.equal(label('transcribing'),'Processing');assert.equal(label('failed'),'Needs attention');

function polling(name,marker,globals){
  const file=ts.createSourceFile(name,source(name),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
  function walk(node){if(ts.isCallExpression(node)&&node.expression.getText(file)==='useEffect'&&node.arguments[0]?.getText(file).includes(marker))callback=node.arguments[0].getText(file);ts.forEachChild(node,walk);}walk(file);assert.ok(callback,'actual polling effect exists');
  let intervals=0,cleared=0;
  const cleanup=vm.runInNewContext('('+callback+')()',{...globals,setInterval(){intervals++;return 1;},clearInterval(){cleared++;}});
  cleanup?.();return {intervals,cleared};
}
for(const status of ['stored','ready','failed','transcribing','preparing','uploading']){
  const expected=['stored','ready','failed'].includes(status)?0:1;
  assert.equal(polling('CupcakeStudio.tsx','selected.status',{selected:{id:'a'.repeat(32),status}}).intervals,expected);
  assert.equal(polling('LibraryWorkspace.tsx','documents?.some',{active:true,documents:[{status}],refresh(){}}).intervals,expected);
}
assert.equal(polling('LibraryWorkspace.tsx','documents?.some',{active:true,documents:[{status:'stored'},{status:'transcribing'}],refresh(){}}).intervals,1);
console.log('PASS: stored originals have honest legacy labels and stop polling; existing ready/failed/transcribing/uploading behavior remains. Synthetic render/effects only.');
