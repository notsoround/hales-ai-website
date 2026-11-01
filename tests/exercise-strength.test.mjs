import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimateExerciseBurn,MINUTES_PER_SET} from '../src/components/cupcake/exerciseEstimate.ts';
import {chicagoWallTime,exercisePerformedAt,formatExerciseItem,kgToLb,logExercise,parseExerciseEntry,toStoredItems,EXERCISE_MAX_AGE_MS} from '../src/components/cupcake/exerciseApi.ts';
import {exerciseRowParts,exerciseTimelineItems,mergeTimelineItems} from '../src/components/cupcake/exerciseTimeline.ts';

test('rowing, rowed and row count as the rowing machine; strength rows stay strength',()=>{
  for(const s of ['rowing 20 min','rowed 20 min','row 20 min','20 min rower','20 min on the erg']){const e=estimateExerciseBurn(s);assert.equal(e.items[0]?.activity,'rowing',s);assert.equal(e.minutes,20,s);assert.ok(e.kcal>0,s);}
  assert.equal(estimateExerciseBurn('rowing').items[0].minutes,15);
  assert.equal(estimateExerciseBurn('rowed 2000m').items[0].activity,'rowing');
  assert.ok(Math.abs(estimateExerciseBurn('rowed 2000m').minutes-2*0.621371*9)<0.1);
  for(const s of ['dumbbell rows 3x10 at 15 lb','bent-over row 4x8','rows 3x12'])assert.equal(estimateExerciseBurn(s).items[0].activity,'weights',s);
  assert.equal(estimateExerciseBurn('kettlebell rows 3x10').items[0].activity,'kettlebell');
  assert.equal(estimateExerciseBurn('throw a ball and grow').items.length,0);
});
test('sets without a total time use ~1.75 min per set including rest, not reps x 3s',()=>{
  const e=estimateExerciseBurn('kettlebell swings 3x15 at 35 lb');const i=e.items[0];
  assert.equal(i.name,'kettlebell swings');assert.equal(i.sets,3);assert.equal(i.reps,45);
  assert.ok(Math.abs(i.minutes-3*MINUTES_PER_SET)<0.11,`${i.minutes}`);
  assert.ok(i.kcal>15&&i.kcal<40,`${i.kcal}`);
  const deadlift=estimateExerciseBurn('4 sets of 8 deadlifts @ 135 lb').items[0];
  assert.equal(deadlift.minutes,7);assert.equal(kgToLb(deadlift.loadKg),135);
  // Explicit time still wins; bare counts keep reps x seconds.
  assert.equal(estimateExerciseBurn('45 min strength workout').minutes,45);
  assert.equal(estimateExerciseBurn('30 push-ups').minutes,1);
  const two=estimateExerciseBurn('goblet squats 3x10 with 25 lb kettlebell, dumbbell bench press 3x12 at 15 lb');
  assert.deepEqual(two.items.map(x=>x.name),['goblet squats','dumbbell bench press']);
  assert.ok(Math.abs(two.minutes-6*MINUTES_PER_SET)<0.2);
});
test('stored items are per-set reps in kg and render in lb',()=>{
  const items=toStoredItems(estimateExerciseBurn('kettlebell swings 3x15 at 35 lb, 20 min rowing').items);
  assert.deepEqual(items[0],{activity:'kettlebell swings',sets:3,reps:15,loadKg:15.88,minutes:5.3});
  assert.deepEqual(items[1],{activity:'rowing',minutes:20});
  assert.equal(formatExerciseItem(items[0]),'KB swings 3×15 @ 35 lb');
  assert.equal(formatExerciseItem(items[1]),'Rowing · 20 min');
  assert.equal(formatExerciseItem({activity:'dumbbell curls',sets:3,reps:12,loadKg:6.8}),'DB curls 3×12 @ 15 lb');
  assert.equal(formatExerciseItem({activity:'kb swings',sets:3,reps:15,loadKg:15.88}),'KB swings 3×15 @ 35 lb');
  assert.equal(toStoredItems(Array.from({length:25},()=>({activity:'x',name:'x',minutes:1,kcal:1,assumed:false}))).length,20);
});
test('entries parse items defensively; old entries have none',()=>{
  const base={id:'exe_1',description:'walk',performedAt:'2026-10-18T14:00:00Z',minutes:30,kcal:111};
  assert.deepEqual(parseExerciseEntry(base).items,[]);
  assert.deepEqual(parseExerciseEntry({...base,items:null}).items,[]);
  assert.deepEqual(parseExerciseEntry({...base,items:[{activity:'goblet squats',sets:3,reps:10,loadKg:11.34},{nope:1},{activity:'x',sets:-1}]}).items,[{activity:'goblet squats',sets:3,reps:10,loadKg:11.34},{activity:'x'}]);
});
test('log sends items and the chosen performedAt to the library',async()=>{
  const sent=[];const fake=async body=>{sent.push(body);return {entry:{id:'exe_1',description:body.description,performedAt:body.performedAt,minutes:body.minutes,kcal:body.kcal,basis:body.basis,items:body.items}};};
  const items=[{activity:'kettlebell swings',sets:3,reps:15,loadKg:15.88}];
  const entry=await logExercise(fake,{requestId:'ex_test0001',description:'KB swings',performedAt:'2026-10-18T14:00:00.000Z',minutes:5.3,kcal:21,basis:'local-met',items});
  assert.deepEqual(sent[0].items,items);assert.equal(sent[0].action,'exercise_log');assert.deepEqual(entry.items,items);
});
test('When: Now, Earlier today and Yesterday become Chicago instants with a timezone, never future, within 31 days',()=>{
  const now=Date.parse('2026-11-01T18:30:00Z'); // 12:30 PM CST (Nov 1 is after DST ends)
  assert.deepEqual(exercisePerformedAt('now','',now),{performedAt:'2026-11-01T18:30:00.000Z',at:now});
  assert.equal(exercisePerformedAt('earlier','07:15',now).performedAt,'2026-11-01T13:15:00.000Z');
  assert.match(exercisePerformedAt('earlier','23:00',now).error,/not happened yet/);
  assert.match(exercisePerformedAt('earlier','',now).error,/Pick a time/);
  assert.equal(exercisePerformedAt('yesterday','18:00',now).performedAt,'2026-10-31T23:00:00.000Z'); // Oct 31 was CDT (UTC-5)
  assert.ok(now-exercisePerformedAt('yesterday','00:00',now).at<EXERCISE_MAX_AGE_MS);
  for(const r of [exercisePerformedAt('earlier','07:15',now),exercisePerformedAt('yesterday','18:00',now)])assert.match(r.performedAt,/Z$/);
  // Just after midnight Chicago, yesterday is the previous calendar day.
  const early=Date.parse('2026-11-02T06:10:00Z'); // 12:10 AM CST Nov 2
  assert.equal(exercisePerformedAt('yesterday','21:00',early).performedAt,'2026-11-02T03:00:00.000Z');
  assert.equal(chicagoWallTime('2026-03-08','12:00'),Date.parse('2026-03-08T17:00:00Z'));
});
test('workouts join the Timeline as their own kind without reordering the feed',()=>{
  const entries=[{id:'exe_a',description:'KB circuit',performedAt:'2026-11-01T15:00:00Z',at:Date.parse('2026-11-01T15:00:00Z'),minutes:21,kcal:140,basis:'local-met',items:[{activity:'kettlebell swings',sets:3,reps:15,loadKg:15.88}]}];
  const ex=exerciseTimelineItems(entries);
  assert.equal(ex[0].type,'exercise');assert.equal(ex[0].date,'2026-11-01');
  const row={tone:'exercise',...exerciseRowParts(ex[0])};
  assert.equal(row.tone,'exercise');assert.equal(row.value,'−140 kcal');assert.equal(row.title,'KB circuit');assert.match(row.sub,/KB swings 3×15 @ 35 lb/);
  const feed=[{id:'f1',type:'food',title:'Lunch',date:'2026-11-01',ts:Date.parse('2026-11-01T17:00:00Z')},{id:'t1',type:'transaction',title:'Coffee',date:'2026-11-01',ts:Date.parse('2026-11-01T14:00:00Z')},{id:'y',type:'food',title:'Dinner',date:'2026-10-31'}];
  assert.deepEqual(mergeTimelineItems(feed,ex).map(i=>i.id),['f1','exercise-exe_a','t1','y']);
  assert.deepEqual(mergeTimelineItems(feed,[]).map(i=>i.id),['f1','t1','y']);
  assert.deepEqual(mergeTimelineItems([],ex).map(i=>i.id),['exercise-exe_a']);
});
test('Timeline wiring: exercise tone, Dumbbell icon, colour token, header quick action and When field',async()=>{
  const {readFileSync}=await import('node:fs');const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  assert.match(src('src/components/cupcake/pulseModel.ts'),/item\.type === 'exercise'\) return \{ key, item, tone: 'exercise'/);
  assert.match(src('src/components/cupcake/TodayPulse.tsx'),/exercise: Dumbbell/);
  assert.match(src('src/components/cupcake/pulse.css'),/li\.cc-tl-is-exercise \{ --tone: var\(--ds-exercise\); \}/);
  const page=src('src/pages/cupcake/sandbox/cupcakegpt/page.tsx');
  assert.match(page,/setLogExerciseRequest\(n=>n\+1\)\}><Dumbbell size=\{18\}\/><span>Log exercise<\/span>/);
  assert.match(page,/<Timeline items=\{timelineItems\}/);
  const energy=src('src/components/cupcake/TodayEnergy.tsx');
  assert.match(energy,/now: 'Now', earlier: 'Earlier today', yesterday: 'Yesterday'/);
  assert.match(energy,/type="time"/);
  assert.match(energy,/items\.length \? \{ items \} : \{\}/);
});
