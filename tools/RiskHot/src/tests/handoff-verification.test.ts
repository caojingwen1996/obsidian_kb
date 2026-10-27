import test from 'node:test';
import assert from 'node:assert/strict';
import { savedFixture } from './handoff-fixture.js';
import { verifyHandoffSnapshot } from '../scripts/verify-handoff.js';

test('acceptance verifier rejects unfinished or inconsistent results instead of reporting a closed loop',async()=>{
  const c=await savedFixture();
  try{
    const receipt=await c.delivery.accept(c.message),packet=await c.delivery.readAccepted(receipt.processing_id);
    await c.repo.acceptSet(receipt.processing_id,1,{covered_segment_ids:c.material.segments.map(x=>x.id),candidates:[],no_event_reason:'仅有背景',warnings:[]});await c.delivery.publishResult(receipt.processing_id);
    const p=(await c.db.query('SELECT * FROM information.processing_runs WHERE id=$1',[receipt.processing_id])).rows[0]!;
    const result=await c.repo.json(p.result_artifact_id),view=await c.delivery.view(c.version,'review-operator');
    const snapshot={packet,receipt,result,delivery:view,processing:{...p,candidates:[],attempts:[]}};
    assert.equal(verifyHandoffSnapshot(snapshot,{requireModelAttempt:false}).candidate_count,0);
    assert.throws(()=>verifyHandoffSnapshot({...snapshot,processing:{...snapshot.processing,extraction_status:'recoverable'}},{requireModelAttempt:false}),/VERIFICATION_INCOMPLETE/);
    assert.throws(()=>verifyHandoffSnapshot({...snapshot,result:{...(result as object),candidate_count:1}},{requireModelAttempt:false}),/VERIFICATION_COUNT_MISMATCH/);
    assert.throws(()=>verifyHandoffSnapshot(snapshot),/VERIFICATION_MODEL_EVIDENCE_REQUIRED/);
    assert.throws(()=>verifyHandoffSnapshot({...snapshot,receipt:{...receipt,payload_sha256:'a'.repeat(64)}},{requireModelAttempt:false}),/VERIFICATION_INPUT_MISMATCH/);
  }finally{await c.dispose();}
});

test('acceptance verifier compares full fixed candidate payload, order, status and input references',async()=>{
  const c=await savedFixture();
  try{
    const receipt=await c.delivery.accept(c.message),packet=await c.delivery.readAccepted(receipt.processing_id),segment=c.material.segments[0]!;
    const candidate={title:'原始标题',description:segment.text,subject_name:null,action:'宣布',stage:null,time:null,uncertainties:[],evidence:[{segment_id:segment.id,start_cp:0,end_cp:Array.from(segment.text).length,quote:segment.text}]};
    await c.repo.acceptSet(receipt.processing_id,1,{covered_segment_ids:c.material.segments.map(x=>x.id),candidates:[candidate],no_event_reason:null,warnings:[]});await c.delivery.publishResult(receipt.processing_id);
    const p=(await c.db.query('SELECT * FROM information.processing_runs WHERE id=$1',[receipt.processing_id])).rows[0]!,result=await c.repo.json<Record<string,unknown>>(p.result_artifact_id);
    const snapshot={packet,receipt,result,delivery:await c.delivery.view(c.version,'review-operator'),processing:{...p,candidates:await c.repo.candidates(p.id),attempts:[]}};
    assert.equal(verifyHandoffSnapshot(snapshot,{requireModelAttempt:false}).candidate_count,1);
    for(const patch of [{payload:{...candidate,title:'另一个仍然合法的标题'}},{ordinal:99},{status:'completed'}]){
      const rows=structuredClone(result.candidates) as object[];rows[0]={...rows[0],...patch};
      assert.throws(()=>verifyHandoffSnapshot({...snapshot,result:{...result,candidates:rows}},{requireModelAttempt:false}),/VERIFICATION_CANDIDATE_CONTENT_MISMATCH/);
    }
    for(const patch of [{manifest_artifact_id:'00000000-0000-0000-0000-000000000000'},{input_artifact_id:'00000000-0000-0000-0000-000000000000'},{result_status:'NO_EVENT'}])assert.throws(()=>verifyHandoffSnapshot({...snapshot,result:{...result,...patch}},{requireModelAttempt:false}),/VERIFICATION_INPUT_MISMATCH/);
  }finally{await c.dispose();}
});
