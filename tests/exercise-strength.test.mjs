import {test} from 'node:test';
import {readFileSync} from 'node:fs';
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
  assert.equal(estimateExerciseBurn('30 push-ups').minutes,2); // 1 min of reps + 1 min setup
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
  assert.equal(row.tone,'exercise');assert.equal(row.value,'140 kcal');assert.match(row.sub,/^Burned · 21 min/);assert.equal(row.title,'KB circuit');assert.match(row.sub,/KB swings 3×15 @ 35 lb/);
  const feed=[{id:'f1',type:'food',title:'Lunch',date:'2026-11-01',ts:Date.parse('2026-11-01T17:00:00Z')},{id:'t1',type:'transaction',title:'Coffee',date:'2026-11-01',ts:Date.parse('2026-11-01T14:00:00Z')},{id:'y',type:'food',title:'Dinner',date:'2026-10-31'}];
  assert.deepEqual(mergeTimelineItems(feed,ex).map(i=>i.id),['f1','exercise-exe_a','t1','y']);
  assert.deepEqual(mergeTimelineItems(feed,[]).map(i=>i.id),['f1','t1','y']);
  assert.deepEqual(mergeTimelineItems([],ex).map(i=>i.id),['exercise-exe_a']);
});
test('Timeline wiring: exercise tone, Dumbbell icon, colour token, header quick action and When field',async()=>{
  const {readFileSync}=await import('node:fs');const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  assert.match(src('src/components/cupcake/pulseModel.ts'),/item\.type === 'exercise'\) return \{ key, item, tone: 'exercise'/);
  assert.match(src('src/components/cupcake/TodayPulse.tsx'),/exercise: Dumbbell/);
  assert.match(src('src/components/cupcake/pulse.css'),/\.cc-timeline li\.cc-tl-is-exercise \{ --tone: var\(--ds-exercise\); \}/);
  const page=src('src/pages/cupcake/sandbox/cupcakegpt/page.tsx');
  assert.match(page,/setLogExerciseRequest\(n=>n\+1\)\}><Dumbbell size=\{18\}\/><span>Log exercise<\/span>/);
  assert.match(page,/<Timeline items=\{timelineItems\}/);
  const energy=src('src/components/cupcake/TodayEnergy.tsx');
  assert.match(energy,/now: 'Now', earlier: 'Earlier today', yesterday: 'Yesterday'/);
  assert.match(energy,/type="time"/);
  assert.match(energy,/items\.length \? \{ items \} : \{\}/);
});

import {burnedLabel,exerciseDescription} from '../src/components/cupcake/exerciseApi.ts';
import {detectWhen,detectFraction,ROUTINES} from '../src/components/cupcake/exerciseEstimate.ts';
const MATT="yesterday I did the McGill big three so the sideways thing is switched back, forth but i only did about half of them that's called for because it's the first time i've done it";

test("Matt's McGill narrative: routine, half, first time, yesterday; nothing left as 'not counted'",()=>{
  const e=estimateExerciseBurn(MATT);
  assert.equal(e.routine,'McGill Big Three');assert.equal(e.fraction,0.5);assert.equal(e.fractionSource,'text');
  assert.deepEqual(e.notes,['partial (50%)','first time']);
  assert.deepEqual(e.unrecognized,[]);
  assert.equal(e.when.when,'yesterday');
  assert.deepEqual(e.items.map(i=>i.name),['modified curl-up','side plank','bird dog']);
  const full=estimateExerciseBurn('McGill Big Three');
  assert.equal(full.minutes,5);assert.ok(full.kcal>=10&&full.kcal<=30,`${full.kcal}`);
  assert.ok(Math.abs(e.kcal-full.kcal/2)<=1);assert.ok(Math.abs(e.minutes-2.5)<=0.2);
  // "first time" is a note only: same math as without it.
  assert.equal(estimateExerciseBurn('mcgill big 3, about half').kcal,e.kcal);
  const stored=toStoredItems(e.items);
  assert.deepEqual(stored[1],{activity:'side plank',sets:2,scheme:'5/3',holdSeconds:10,side:'each',minutes:0.9});
  assert.equal(formatExerciseItem(toStoredItems(full.items)[1]),'Side plank 3 sets (5/3/1) · 10s holds · each side');
  assert.equal(exerciseDescription('McGill Big Three',e.notes),'McGill Big Three — partial (50%), first time');
  assert.ok(ROUTINES[0].pattern.test('mcgill'));
});
test('10 kettlebell squats is ~1–2 min and 5–10 kcal (was 0.5 min, 3 kcal)',()=>{
  const e=estimateExerciseBurn('I did 10 kettlebell squats');
  assert.equal(e.items.length,1);assert.equal(e.items[0].activity,'squats');assert.equal(e.items[0].reps,10);
  assert.ok(e.minutes>=1&&e.minutes<=2,`${e.minutes}`);assert.ok(e.kcal>=5&&e.kcal<=10,`${e.kcal}`);
  assert.equal(e.items[0].name,'kettlebell squats');assert.equal(e.items[0].loadKg,undefined); // assumed KB load affects intensity only
});
test('nothing recognised means no items and zero kcal (Save stays disabled; logExercise refuses)',async()=>{
  for(const s of ['blah blah nothing here','the sideways thing is switched back, forth','']){const e=estimateExerciseBurn(s);assert.equal(e.items.length,0,s);assert.equal(e.kcal,0,s);}
  let called=false;const fake=async()=>{called=true;return {};};
  await assert.rejects(logExercise(fake,{requestId:'ex_test0002',description:'blah',performedAt:'2026-11-01T12:00:00Z',minutes:0,kcal:0,basis:'local-met'}),/Nothing recognised/);
  assert.equal(called,false);
});
test('common strength moves, holds and sides',()=>{
  const act=s=>estimateExerciseBurn(s).items.map(i=>i.activity);
  assert.deepEqual(act('kettlebell squats and swings'),['squats','kettlebell']);
  assert.deepEqual(act('goblet squats 4x10, DB press 3x12, DB rows 3x10, 20 push-ups, 1 min plank'),['squats','weights','weights','push-ups','plank']);
  const plank=estimateExerciseBurn('30 sec plank').items[0];assert.equal(plank.holdSeconds,30);assert.equal(plank.sets,1);
  const side=estimateExerciseBurn('side plank 3x10s each side').items[0];assert.deepEqual([side.activity,side.sets,side.holdSeconds,side.side],['side plank',3,10,'each']);
  assert.equal(estimateExerciseBurn('dead bugs 3x10/side').items[0].side,'each');
  // An equipment note sets loads for the moves after it and is not an exercise itself.
  const sup=estimateExerciseBurn('25 lb KB / 15 lb DBs: goblet squats 4x10, KB swing 3x15, seated DB shoulder press 4x15');
  assert.deepEqual(sup.items.map(i=>kgToLb(i.loadKg)),[25,25,15]);
  const full=estimateExerciseBurn('Full-body strength superset, 25 lb KB / 15 lb DBs: goblet squats 4x10, glute bridge march 4x15, DB floor fly 4x10, one-arm DB bent-over row 4x15, KB swing 3x15, front plank 1 min, seated DB shoulder press 4x15, seated DB hammer curl 4x15');
  assert.equal(full.items.length,8);assert.ok(full.minutes>40&&full.minutes<55,`${full.minutes}`);
});
test('partial: text and manual override scale sets, minutes and kcal',()=>{
  assert.equal(detectFraction('only did 2 of 3 sets'),2/3);assert.equal(detectFraction('60%'),0.6);assert.equal(detectFraction('partial'),0.5);assert.equal(detectFraction('half an hour'),0.5);
  assert.equal(estimateExerciseBurn('half an hour walk').fraction,1); // "half an hour" is a duration, not a partial
  const full=estimateExerciseBurn('KB swings 4x15 @ 25 lb'),half=estimateExerciseBurn('KB swings 4x15 @ 25 lb',{fraction:0.5});
  assert.equal(half.items[0].sets,2);assert.equal(half.fractionSource,'manual');assert.ok(Math.abs(half.kcal-full.kcal/2)<=1);assert.deepEqual(half.notes,['partial (50%)']);
  assert.equal(estimateExerciseBurn(MATT,{fraction:1}).fraction,1); // "All of it" overrides "about half"
});
test('When words in the text set the When field (America/Chicago)',()=>{
  assert.deepEqual(detectWhen('yesterday I did squats'),{when:'yesterday',time:null,phrase:'yesterday'});
  assert.deepEqual(detectWhen('last night 20 min rowing'),{when:'yesterday',time:'19:00',phrase:'last night'});
  assert.deepEqual(detectWhen('this morning push-ups'),{when:'earlier',time:'08:00',phrase:'this morning'});
  assert.equal(detectWhen('earlier today a walk').when,'earlier');
  assert.equal(detectWhen('yesterday at 6:30 pm KB swings').time,'18:30');
  assert.equal(detectWhen('20 push-ups'),null);
});
test('burn is always shown as a positive number',()=>{
  assert.equal(burnedLabel(9),'Burned 9 kcal');assert.equal(burnedLabel(-3),'Burned 3 kcal');
  const energy=readFileSync(new URL('../src/components/cupcake/TodayEnergy.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(energy,/−\{kcal\(e\.kcal\)\}|Logged −|About −/);
  assert.match(energy,/McGill Big Three/);assert.match(energy,/Partial \{p\}%/);
  const css=readFileSync(new URL('../src/components/cupcake/pulse.css',import.meta.url),'utf8');
  for(const k of ['food','spend','call','missed','glucose','sleep','phone','body','exercise'])assert.match(css,new RegExp(`\\.cc-timeline li\\.cc-tl-is-${k} \\{`),k);
  assert.doesNotMatch(css,/\.cc-app \.cc-tl-is-\w+ \{/);
});
