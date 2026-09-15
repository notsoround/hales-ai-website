import assert from 'node:assert/strict';
import { confirmedLibraryRequest } from '../src/components/cupcake/libraryApproval.ts';
const id='act_'+'a'.repeat(32);
const initial={ok:true,pending:true,status:'pending',action_id:id,action:'ask_start',description:'Start the selected analysis'};
for(const approve of [true,false]) {
 const calls=[];let prompted=0;
 const send=async body=>{calls.push(body);return calls.length===1?initial:approve?{ok:true,pending:false,status:'completed',action_id:id,result:{ok:true,job:{id:'job_one',status:'queued'}}}:{ok:true,status:'cancelled',action_id:id};};
 if(approve){const result=await confirmedLibraryRequest({action:'ask_start'},send,()=>{prompted++;return true});assert.equal(result.job.id,'job_one');assert.deepEqual(calls[1],{action:'approve',action_id:id});}
 else{await assert.rejects(confirmedLibraryRequest({action:'ask_start'},send,()=>{prompted++;return false}),/Cancelled/);assert.deepEqual(calls[1],{action:'cancel',action_id:id});}
 assert.equal(prompted,1);assert.equal(calls.length,2);
}
let confirmations=0;
assert.deepEqual(await confirmedLibraryRequest({action:'list'},async()=>({ok:true,documents:[]}),()=>{confirmations++;return true}),{ok:true,documents:[]});assert.equal(confirmations,0);
await assert.rejects(confirmedLibraryRequest({action:'ask_start'},async()=>({...initial,action:'connector_revoke'}),()=>{throw Error('Must not prompt')}),/does not match/);
let count=0;await assert.rejects(confirmedLibraryRequest({action:'ask_start'},async()=>++count===1?initial:{ok:true,pending:true,status:'executing',action_id:id},()=>true),/not confirmed completion/);
console.log('PASS: confirmation review, exact action binding, cancellation, completed-result unwrapping, no false success');
