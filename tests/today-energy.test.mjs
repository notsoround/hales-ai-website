import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMetabolicSeries,monotonePath,sampleNetAt,SERIES_INTERVALS_PER_DAY} from '../src/components/cupcake/metabolicSeries.ts';
import {nutritionDays,nutritionDayStart} from '../src/components/cupcake/nutritionModel.ts';
import {preparedPurchases} from '../src/components/cupcake/purchases.ts';
import {chicagoHourOnDay,closestReading,loadGlucoseReadings,parseGlucoseEntries} from '../src/components/cupcake/glucoseApi.ts';
import {ExerciseUnavailableError,listExercises,logExercise,deleteExercise} from '../src/components/cupcake/exerciseApi.ts';
import {estimateExerciseBurn} from '../src/components/cupcake/exerciseEstimate.ts';
import {normalizeAccentHeat} from '../src/components/cupcake/accentHeat.ts';
import {StepsUnavailableError,latestSteps,parseStepsDay,stepsDayLabel} from '../src/components/cupcake/stepsApi.ts';

const now=new Date('2026-10-18T19:00:00Z'); // 2:00 PM Chicago
const settings={calorieTarget:2000,expenditureEstimate:2400,effectiveFrom:'2026-10-01',versions:[]};
const meal=(id,at,calories,extra={})=>({id,description:id,consumedAt:at,date:'2026-10-18',sheetLoggedAt:at,countedInTotals:true,total:{calories},...extra});
const meals=[meal('breakfast','2026-10-18T13:00:00Z',450),meal('lunch','2026-10-18T17:30:00Z',700)];

test('curve ends exactly on the Food today balance',()=>{
  const s=buildMetabolicSeries({meals,settings,now});
  const day=nutritionDays(meals,['2026-10-18'],settings,now)[0];
  assert.ok(day.balance!==null);
  assert.ok(Math.abs(s.net-day.balance)<1e-6);
  assert.equal(s.foodBalance,day.balance);
  assert.ok(Math.abs(s.samples.at(-1).net-day.balance)<1e-6);
  assert.equal(s.steps,null);
  assert.ok(s.samples.length<=SERIES_INTERVALS_PER_DAY+1+2*s.events.length);
  for(let i=1;i<s.samples.length;i++)assert.ok(s.samples[i].t>=s.samples[i-1].t);
  assert.ok(Math.abs(sampleNetAt(s.samples,Date.parse("2026-10-18T13:00:00Z"))-sampleNetAt(s.samples,Date.parse("2026-10-18T13:00:00Z")-1)-450)<0.01);
});
test('bought purchases are markers only and never change net',()=>{
  const bought=[{id:'b1',at:Date.parse('2026-10-18T15:00:00Z'),label:'Starbucks',amount:6.4,currency:'USD'}];
  const a=buildMetabolicSeries({meals,settings,now}),b=buildMetabolicSeries({meals,settings,now,bought});
  assert.equal(b.net,a.net);assert.deepEqual(b.samples,a.samples);assert.equal(b.eaten,a.eaten);assert.equal(b.bought.length,1);
});
test('exercise lowers net; food balance stays the meal-only balance',()=>{
  const s=buildMetabolicSeries({meals,settings,now,exercise:[{id:'e',at:Date.parse('2026-10-18T18:00:00Z'),kcal:200,description:'walk'}]});
  assert.equal(s.exercise,200);assert.ok(Math.abs(s.foodBalance-(s.net+200))<1e-6);
});
test('no expenditure estimate means no curve; unknown calories mark partial',()=>{
  assert.equal(buildMetabolicSeries({meals,settings:{...settings,expenditureEstimate:null},now}),null);
  const s=buildMetabolicSeries({meals:[...meals,meal('snack','2026-10-18T18:30:00Z',null)],settings,now});
  assert.equal(s.partial,true);assert.equal(s.foodBalance,null);
});
test('series starts at Chicago midnight and steps after a meal',()=>{
  const s=buildMetabolicSeries({meals,settings,now});
  assert.equal(s.dayStart,nutritionDayStart('2026-10-18'));
  const t=Date.parse('2026-10-18T13:00:00Z');
  assert.ok(sampleNetAt(s.samples,t+60000)-sampleNetAt(s.samples,t-600000)>400);
  assert.match(monotonePath([{x:0,y:0},{x:1,y:1},{x:2,y:1}]),/^M0,0C/);
});
test('only prepared-food transactions become BOUGHT markers',()=>{
  const since=Date.parse('2026-10-18T05:00:00Z');
  const tx=(id,title,category,amount=5,ts=Date.parse('2026-10-18T15:00:00Z'))=>({id,type:'transaction',title,amount,ts,details:{category}});
  const rows=[tx('cafe','Starbucks','Food and Drink: Coffee'),tx('grocery','HEB','Groceries'),tx('gas','Shell','Gas'),tx('refund','Taco Bell','Fast Food',-5),tx('old','Cafe Old','Coffee',4,since-1),{id:'meal',type:'meal',title:'Cafe',ts:since+1},tx('bakery','Sweet Bakery','Shopping')];
  assert.deepEqual(preparedPurchases(rows,since).map(p=>p.id),['cafe','bakery']);
});
test('glucose parsing, 6 PM in Chicago, closest reading',async()=>{
  assert.equal(new Date(chicagoHourOnDay('2026-10-18',18)).toISOString(),'2026-10-18T23:00:00.000Z');
  assert.equal(new Date(chicagoHourOnDay('2026-12-18',18)).toISOString(),'2026-12-19T00:00:00.000Z');
  const rows=parseGlucoseEntries([{id:'a',observedAt:'2026-10-18T22:10:00Z',glucoseMgDl:112},{id:'b',observedAt:'2026-10-18T23:20:00Z',glucoseMgDl:'98'},{id:'bad',observedAt:'nope',glucoseMgDl:100},{id:'big',observedAt:'2026-10-18T23:00:00Z',glucoseMgDl:1200}]);
  assert.deepEqual(rows.map(r=>r.id),['a','b']);
  assert.equal(closestReading(rows,chicagoHourOnDay('2026-10-18',18)).id,'b');
  assert.equal(closestReading([],0),null);
  let sent;const got=await loadGlucoseReadings(async body=>{sent=body;return {entries:[{id:'x',observedAt:'2026-10-18T14:00:00Z',glucoseMgDl:101}]};},Date.parse('2026-10-18T05:00:00Z'),Date.parse('2026-10-19T05:00:00Z'));
  assert.equal(sent.action,'glucose_manual_list');assert.equal(got.length,1);
});
test('exercise API maps an unknown library action to unavailable, never fakes data',async()=>{
  const unknown=async()=>{throw new Error('Unknown library action');};
  await assert.rejects(listExercises(unknown,0,1),ExerciseUnavailableError);
  await assert.rejects(logExercise(unknown,{requestId:'ex_1',description:'walk',performedAt:'2026-10-18T19:00:00Z',minutes:30,kcal:100,basis:'local-met'}),ExerciseUnavailableError);
  await assert.rejects(listExercises(async()=>{throw new Error('Network down');},0,1),/Network down/);
  const entry={id:'ex_1',description:'walk',performedAt:'2026-10-18T19:00:00Z',minutes:30,kcal:100,basis:'local-met'};
  const calls=[];const fake=async body=>{calls.push(body.action);return body.action==='exercise_log'?{entry}:body.action==='exercise_list'?{entries:[entry,{id:'bad'}]}:{deleted:true};};
  assert.equal((await logExercise(fake,{...entry,requestId:'ex_1'})).kcal,100);
  assert.equal((await listExercises(fake,0,1)).length,1);
  assert.equal(await deleteExercise(fake,'ex_1'),true);
  assert.deepEqual(calls,['exercise_log','exercise_list','exercise_delete']);
});
test('exercise estimate and accent heat normalisation',()=>{
  const e=estimateExerciseBurn('30 min walk');assert.ok(e.kcal>0);assert.equal(e.source,'local-met');
  assert.equal(normalizeAccentHeat('hot'),'hot');assert.equal(normalizeAccentHeat('HOT'),'calm');assert.equal(normalizeAccentHeat(null),'calm');
});

test('steps: series carries the latest daily count without changing net',()=>{
  const a=buildMetabolicSeries({meals,settings,now}),b=buildMetabolicSeries({meals,settings,now,steps:4681});
  assert.equal(a.steps,null); assert.equal(b.steps,4681); assert.equal(a.net,b.net); assert.deepEqual(a.samples,b.samples);
});
test('steps: latestSteps asks steps_list for the range and returns the newest valid day',async()=>{
  const calls=[];
  const request=async body=>{calls.push(body);return {entries:[{date:'2026-10-18',count:12208},{date:'2026-10-19',count:4681,windowBasis:'trailing_24h_previous_day'},{date:'2026-10-20',count:-5},{date:'bad',count:1}]};};
  const day=await latestSteps(request,'2026-10-08','2026-10-21');
  assert.deepEqual(calls,[{action:'steps_list',start:'2026-10-08',end:'2026-10-21'}]);
  assert.deepEqual(day,{date:'2026-10-19',count:4681,windowBasis:'trailing_24h_previous_day',source:'health_connect'});
  assert.equal(await latestSteps(async()=>({entries:[]}),'2026-10-08','2026-10-21'),null);
  await assert.rejects(latestSteps(async()=>{throw new Error('Unknown library action');},'2026-10-08','2026-10-21'),StepsUnavailableError);
  assert.equal(parseStepsDay({date:'2026-10-19',count:1.5}),null);
  assert.equal(stepsDayLabel('2026-10-19'),'Mon, Oct 19');
});
