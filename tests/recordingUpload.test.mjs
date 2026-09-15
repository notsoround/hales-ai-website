import assert from 'node:assert/strict';
import { uploadRecording, RecordingRequestError, UPLOAD_PART_BYTES } from '../src/components/cupcake/recordingUpload.ts';
const id='a'.repeat(32), draft={id:'stable-upload-123',title:'Synthetic recording',mime:'audio/wav'};
async function scenario({failPart=false,failFinish=false,deny=false,resume=false,badReceipt=false}={}) {
  const calls=[],progress=[],seen=new Set();let failures=0,finishes=0;
  const blob=new Blob([new Uint8Array(UPLOAD_PART_BYTES+10)],{type:'audio/wav'});
  const request=async(path,init)=>{
    calls.push(path);
    if(path.endsWith('start')) {
      assert.equal(JSON.parse(init.body).uploadId,draft.id);
      if(deny)throw new RecordingRequestError('Access expired',403);
      return {recording:{id,status:'uploading',receivedParts:resume?[{index:0,size:UPLOAD_PART_BYTES}]:[]}};
    }
    if(path.endsWith('part')) {
      const index=Number(init.body.get('index'));assert.equal(init.body.get('id'),id);
      seen.add(index);
      if(failPart && failures++===0)throw new TypeError('Lost reply after server saved the part');
      return badReceipt?{}:{id,part:index,received:true};
    }
    finishes++;if(failFinish && finishes===1)throw new RecordingRequestError('Gateway lost reply',502);
    return {recording:{id,status:'processing'}};
  };
  let error;try{await uploadRecording({draft,blob,request,onProgress:p=>progress.push(p),wait:async()=>{}});}catch(e){error=e;}
  return {calls,progress,seen,error,finishes};
}
const good=await scenario();assert.equal(good.error,undefined);assert.equal(good.finishes,1);assert.equal(good.progress.at(-1).received,UPLOAD_PART_BYTES+10);
const lost=await scenario({failPart:true,failFinish:true});assert.equal(lost.error,undefined);assert.equal(lost.finishes,2);assert.ok(lost.progress.some(p=>p.retryAttempt===1));assert.equal(lost.progress.find(p=>p.retryAttempt).received,0,'lost acknowledgment cannot count as received');
const resume=await scenario({resume:true});assert.deepEqual([...resume.seen],[1],'resume skips only a server-confirmed matching part');
const denied=await scenario({deny:true});assert.equal(denied.calls.length,1,'never retry authentication failures');assert.equal(denied.error.status,403);
const bad=await scenario({badReceipt:true});assert.ok(bad.error);assert.equal(bad.finishes,0,'a 200 without a part receipt cannot mark an upload complete');
console.log('PASS: upload receipts, stable-ID retries, server-ledger resume, auth failure, lost finish reply');
