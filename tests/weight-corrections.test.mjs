// Synthetic weights only; no owner health records.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {weightMeasurements,weightTime} from '../src/components/cupcake/weightHistoryModel.ts';

const element=(type,props)=>({type,props});
const jsx={jsx:element,jsxs:element};
const walk=e=>!e||typeof e!=='object'?[]:Array.isArray(e)?e.flatMap(walk):[e,...walk(e.props?.children)];
const text=e=>e==null?'':typeof e!=='object'?String(e):Array.isArray(e)?e.map(text).join(''):text(e.props?.children);
function moduleAt(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>imports[id]||{},Date,Intl});return exports;}
const api=moduleAt('src/components/cupcake/weightApi.ts',{'./library':{libraryRequest(){}}});
const record=(id,changes={})=>({id,kind:'measurement',weightLb:175.2,measuredAt:'2026-09-20T19:00:00Z',source:'fixture.scale',recordId:'record-'+id,basis:'health_connect',...changes});
const corrected=record('corrected',{weightLb:173.6,basis:'owner_corrected',correction:{operation:'replace',originalLb:178.46,reportedLb:173.6,reason:'Owner clarified clothing affected the scale reading.',recordedAt:'2026-09-21T02:00:00Z'}});
const excluded=record('excluded',{weightLb:179.36,correction:{operation:'exclude',originalLb:179.36,reason:'Clothing affected this reading.',recordedAt:'2026-09-21T02:00:00Z'}});
const props={range:{preset:'week',start:'2026-09-14',end:'2026-09-20'},loading:false,error:'',onRange(){},onBack(){},onRefresh(){},onSelect(){}};

test('correction keeps original measurement time and explains provenance in detail body',()=>{
 const entry=api.weightEntry(corrected);
 assert.equal(entry.amount,173.6);assert.equal(entry.details.measuredAt,corrected.measuredAt);
 assert.equal(entry.details.weightBasis,'owner_corrected');assert.equal(entry.details.originalWeightLb,178.46);
 assert.match(entry.body,/173\.6 lb · corrected by you/);assert.match(entry.body,/Original scale reading: 178\.5 lb/);
 assert.match(entry.body,/original measurement time is unchanged/);assert.match(entry.body,/Owner clarified clothing/);
 assert.equal(entry.date,'2026-09-20');
});

test('excluded original remains available but cannot enter measurements or their trend',()=>{
 const entries=[api.weightEntry(record('normal')),api.weightEntry(corrected),api.weightEntry(excluded)];
 const points=weightMeasurements(entries);
 assert.equal(points.length,2);assert.deepEqual(points.map(p=>p.lb).sort(),[173.6,175.2]);
 const original=entries.at(-1);assert.equal(original.details.weightKind,'excluded');assert.equal(original.amount,179.36);
 assert.match(original.body,/excluded by you/);assert.match(original.body,/does not affect your weight graph or totals/);
});

test('weight history labels owner correction and keeps exclusions in a closed disclosure',()=>{
 const mod=moduleAt('src/components/cupcake/WeightHistory.tsx',{'react':{useState:()=>['',()=>{}]},'react/jsx-runtime':jsx,'./weightHistoryModel':{weightMeasurements,weightTime}});
 let selected;
 const tree=mod.WeightHistory({...props,entries:[api.weightEntry(corrected)],excludedEntries:[api.weightEntry(excluded)],excludedTotal:1,onSelect:e=>{selected=e;}});
 assert.match(text(tree),/Corrected by you/);
 const disclosure=walk(tree).find(e=>e.type==='details');assert.ok(disclosure);assert.equal(disclosure.props.open,undefined);
 assert.match(text(disclosure),/Excluded readings \(1\)/);assert.match(text(disclosure),/179\.4 lb · excluded by you/);
 walk(disclosure).find(e=>e.type==='button').props.onClick();assert.equal(selected.id,'weight:excluded');
 const chart=walk(tree).find(e=>e.type==='svg');assert.match(chart.props['aria-label'],/^1 timestamped/);
 assert.equal(walk(chart).filter(e=>e.type==='circle').length,1);
});

test('connected history separates canonical exclusions from chart and stale feed measurements',()=>{
 const page={measurements:[corrected],latestMeasurement:corrected,excludedMeasurements:[excluded],excludedTotal:1,nextCursor:null,total:1,coverage:{initialSince:null,lastSyncAt:null,lastObservedAt:null,resetCount:0}};
 let stateIndex=0;
 const react={useState:initial=>[stateIndex++===0?page:initial,()=>{}],useCallback:fn=>fn,useEffect(){},useRef:value=>({current:value})};
 function History(){}
 const mod=moduleAt('src/components/cupcake/WeightHistoryConnected.tsx',{'react':react,'react/jsx-runtime':jsx,'./WeightHistory':{WeightHistory:History},'./weightApi':api});
 const tree=mod.WeightHistoryConnected({...props,entries:[api.weightEntry(record('stale-feed')),api.weightEntry(excluded),{id:'aggregate',type:'activity',details:{weightKind:'aggregate'}}]});
 const view=walk(tree).find(e=>e.type===History);
 assert.deepEqual(Array.from(view.props.entries,e=>e.id),['weight:corrected','aggregate']);
 assert.deepEqual(Array.from(view.props.excludedEntries,e=>e.id),['weight:excluded']);
 assert.equal(view.props.excludedTotal,1);
});

test('old weight responses without correction metadata remain readable',()=>{
 const {basis,...legacy}=record('legacy');void basis;
 const entry=api.weightEntry(legacy);assert.equal(entry.details.weightBasis,'health_connect');assert.equal(entry.title,'Weight measurement');
 assert.equal(weightMeasurements([entry]).length,1);assert.doesNotMatch(entry.body,/corrected|excluded/);
});
