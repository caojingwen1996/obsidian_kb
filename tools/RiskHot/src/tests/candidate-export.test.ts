import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { savedFixture } from './handoff-fixture.js';

test('exports all 50 fixed candidates and repairs missing aliases without a second model call', async () => {
  const c=await savedFixture();
  try {
    const receipt=await c.delivery.accept(c.message),p=receipt.processing_id,segment=c.material.segments[0]!;
    const data={covered_segment_ids:c.material.segments.map(x=>x.id),candidates:Array.from({length:50},(_,i)=>({title:`候选${i}`,description:segment.text,subject_name:null,action:'宣布',stage:null,time:null,uncertainties:[],evidence:[{segment_id:segment.id,start_cp:0,end_cp:Array.from(segment.text).length,quote:segment.text}]})),no_event_reason:null,warnings:['测试覆盖']};
    await c.repo.acceptSet(p,1,data); await c.delivery.publishResult(p);
    const view=await c.delivery.view(c.version,'review-operator'),path=join(c.folder,view.files.candidates!.relative_path);
    const result=JSON.parse(await readFile(path,'utf8'));
    assert.equal(result.candidate_count,50);assert.equal(result.candidates.length,50);
    assert.deepEqual(result.candidates.map((x:{candidate_key:string})=>x.candidate_key),(await c.repo.candidates(p) as {candidate_key:string}[]).map(x=>x.candidate_key));
    assert.equal(result.next_step,2);
    await unlink(path); await c.delivery.publishResult(p);
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),result);
    await c.delivery.accept(c.message);assert.equal((await c.db.query('SELECT * FROM information.event_candidates')).rowCount,50);
    assert.equal((await c.db.query('SELECT * FROM platform.model_attempts')).rowCount,0);
  }finally{await c.dispose();}
});

test('persists explicit no-event reason and coverage; unfinished extraction never exports zero candidates',async()=>{
  const c=await savedFixture();
  try{
    const {processing_id:p}=await c.delivery.accept(c.message);
    await assert.rejects(()=>c.delivery.publishResult(p),/EXTRACTION_NOT_COMPLETED/);
    const data={covered_segment_ids:c.material.segments.map(x=>x.id),candidates:[],no_event_reason:'只有背景说明，没有具体事件',warnings:[]};
    await c.repo.acceptSet(p,1,data);await c.delivery.publishResult(p);
    const result=JSON.parse(await readFile(join(c.folder,(await c.delivery.view(c.version,'review-operator')).files.candidates!.relative_path),'utf8'));
    assert.equal(result.result_status,'NO_EVENT');assert.equal(result.no_event_reason,data.no_event_reason);assert.deepEqual(result.covered_segment_ids,data.covered_segment_ids);
  }finally{await c.dispose();}
});

test('file failure preserves committed extraction and can be repaired independently',async()=>{
  const c=await savedFixture();
  try{
    const {processing_id:p}=await c.delivery.accept(c.message);
    await c.repo.acceptSet(p,1,{covered_segment_ids:c.material.segments.map(x=>x.id),candidates:[],no_event_reason:'无事件',warnings:[]});
    const publish=c.delivery.files.publish.bind(c.delivery.files);
    c.delivery.files.publish=async()=>{throw new Error('controlled disk failure');};
    await assert.rejects(()=>c.delivery.publishResult(p));
    assert.equal((await c.repo.processing(p)).extraction_status,'completed');
    c.delivery.files.publish=publish;await c.delivery.publishResult(p);
    assert.ok((await c.delivery.view(c.version,'review-operator')).files.candidates);
  }finally{await c.dispose();}
});
