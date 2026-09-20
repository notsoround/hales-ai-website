import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weightMeasurements,weightTime} from '../src/components/cupcake/weightHistoryModel.ts';
const entry=(id,kind,at,lb=201)=>({id,type:'activity',details:{weightKind:kind,measuredAt:at,weightLb:lb}});
test('only real timestamped measurements enter chart, sorted by measurement time',()=>{
const rows=[entry('later','measurement','2026-09-20T19:00:00Z'),entry('avg','aggregate','2026-09-20T20:00:00Z',197.8),entry('unknown','unknown','2026-09-20T21:00:00Z'),entry('invalid','measurement','not-time'),entry('earlier','measurement','2026-09-19T19:00:00Z',202),entry('bad','measurement','2026-09-20T22:00:00Z',NaN)];
assert.deepEqual(weightMeasurements(rows).map(p=>p.entry.id),['earlier','later']);assert.equal(weightMeasurements(rows).at(-1).lb,201);
});
test('average-only history has no claimed latest weigh-in',()=>assert.deepEqual(weightMeasurements([entry('avg','aggregate',null,197.8)]),[]));
test('original measurement time displayed in Central time',()=>assert.match(weightTime('2026-09-20T19:00:00Z'),/2:00 PM/));
import ts from 'typescript';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('reading buttons select chart value and range controls remain real buttons',()=>{
let state='';const element=(type,props)=>({type,props});const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/components/cupcake/WeightHistory.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>id==='react'?{useState:()=>[state,v=>{state=v;}]}:id==='react/jsx-runtime'?{jsx:element,jsxs:element}:id==='./weightHistoryModel'?{weightMeasurements,weightTime}:{},Date,Intl});
const props={entries:[entry('a','measurement','2026-09-19T19:00:00Z',202),entry('b','measurement','2026-09-20T19:00:00Z',201)],range:{preset:'week',start:'2026-09-14',end:'2026-09-20'},onRange(){},onBack(){},onRefresh(){},onSelect(){}};
const walk=e=>!e||typeof e!=='object'?[]:Array.isArray(e)?e.flatMap(walk):[e,...walk(e.props?.children)];
let tree=exports.WeightHistory(props);const button=walk(tree).find(e=>e.type==='button'&&e.props['aria-pressed']===false&&walk(e.props.children).some(c=>c.type==='strong'&&c.props.children.includes('202.0')));assert.ok(button);button.props.onClick();tree=exports.WeightHistory(props);assert.equal(state,'a');assert.ok(walk(tree).some(e=>e.type==='button'&&e.props['aria-pressed']===true&&walk(e.props.children).some(c=>c.type==='strong'&&c.props.children.includes('202.0'))));
});
