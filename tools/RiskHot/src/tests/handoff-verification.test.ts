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
