import assert from 'node:assert/strict';
import { hasAudibleSignal, microphoneConstraints, microphoneMessage, readInputDevice, saveInputDevice } from '../src/components/cupcake/voiceInput.ts';
import { archiveTalk, continuationContext, readTalks, saveTalk } from '../src/components/cupcake/voiceHistory.ts';

const memory = new Map();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem:key=>memory.get(key)||null, setItem:(key,value)=>memory.set(key,value) } });

assert.deepEqual(microphoneConstraints('synthetic-device'), {audio:{deviceId:{exact:'synthetic-device'},echoCancellation:true,noiseSuppression:true}});
assert.match(microphoneMessage({name:'NotAllowedError'}), /System Settings/);
assert.match(microphoneMessage({name:'NotReadableError'}), /allowed but could not start/);
assert.equal(hasAudibleSignal(new Uint8Array(32).fill(128)).heard, false);
const audible=new Uint8Array(32).fill(128);audible[0]=180;assert.equal(hasAudibleSignal(audible).heard,true);
saveInputDevice('synthetic-device');assert.equal(readInputDevice(),'synthetic-device');

const talk={id:'synthetic',title:'Synthetic Talk',startedAt:'2026-09-07T00:00:00Z',endedAt:'2026-09-07T00:01:00Z',lines:Array.from({length:45},(_,i)=>({role:i%2?'Cupcake':'You',text:`line ${i}`}))};
saveTalk(talk);assert.equal(readTalks()[0].lines.length,45);
const context=continuationContext(talk);assert.equal(context.lines.length,40);assert.ok(JSON.stringify(context).length<12000);
archiveTalk(talk.id);assert.equal(readTalks()[0].archived,true);
console.log('PASS voice input diagnostics and bounded local Talk recovery history');
