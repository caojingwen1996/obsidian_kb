import test from 'node:test';
import assert from 'node:assert/strict';
import {eventFixture} from './event-fixture.js';
import {CandidateSteps} from '../event-management/candidate-steps.js';
import {Reviews,resumeToken} from '../event-management/reviews.js';
import {candidate} from '../event-management/store.js';
import {EventExecutor} from '../event-management/task-executor.js';
import {eventActivities} from '../runtime/event-activities.js';
import {EventQueries} from '../event-management/queries.js';
import {EventCommit} from '../event-management/commit.js';

async function atRelations(f:Awaited<ReturnType<typeof eventFixture>>) {
 await f.service.acceptExtraction(f.full.id,1,{candidates:[f.candidate],warnings:[]});
 const id=(await f.db.query('SELECT id FROM information.event_candidates WHERE processing_id=$1',[f.full.id])).rows[0].id;
 const steps=new CandidateSteps(f.repo),reviews=new Reviews(f.repo);
 await steps.prepare(id,2,1);
 await steps.accept(id,2,1,{decision:'NEW',matched_event_id:null,comparisons:[],reason:'受控独立事实',evidence_refs:f.candidate.evidence_refs,unresolved_issues:[]});
 await reviews.recordReview(id,'review-operator',{scope:'identity',proposal_generation:1,proposal_digest:await reviews.basis(id,'identity'),decision:'APPROVE',reason:'受控身份确认'},'identity');
 const context=await steps.prepare(id,3,2);
 const output={targets:[],variables:[],definition_candidates:[{kind:'target',name:'受控措施',definition:'原文直接涉及的措施',jurisdiction:null,unit:null,reason:'尚无正式定义',evidence_refs:f.candidate.evidence_refs}],unresolved_issues:['有效定义为空，不能关联正式ID']};
 return {id,steps,reviews,context,output};
}

test('关系未决建议持久化并等待独立复核，不自动进入增量或正式提交',async()=>{
 const f=await eventFixture();try{
  const x=await atRelations(f);await x.steps.accept(x.id,3,2,x.output);
  let row=await candidate(f.db,x.id);assert.equal(row.status,'review');assert.equal(row.resume_step,3);
  const detail=await new EventQueries(f.repo).candidate(x.id,'review-operator');
  assert.ok(detail.relation_basis_digest);assert.equal(detail.definition_candidates.length,1);
  assert.equal(detail.definition_candidates[0].status,'pending_governance');
  const command={scope:'relations',proposal_generation:1,proposal_digest:detail.relation_basis_digest,decision:'APPROVE',reason:'已核对空定义，仅保留治理候选，允许后续分析'} as any;
  await assert.rejects(x.reviews.recordReview(x.id,'review-operator',{...command,proposal_digest:'0'.repeat(64)},'stale-relations'),/STALE_PROPOSAL/);
  await f.db.query("INSERT INTO platform.actors VALUES('reader',ARRAY['read'],ARRAY['wiki-source-001'])");
  await assert.rejects(x.reviews.recordReview(x.id,'reader',command,'forbidden-relations'),/FORBIDDEN/);
  await x.reviews.recordReview(x.id,'review-operator',command,'relations-approved');
  row=await candidate(f.db,x.id);assert.equal(row.status,'processing');assert.equal(row.resume_step,4);
  assert.equal((await f.db.query('SELECT count(*) FROM information.events')).rows[0].count,'0');
  const result=(await f.db.query('SELECT result FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=3',[x.id])).rows[0].result;
  assert.deepEqual(result.unresolved_issues,x.output.unresolved_issues);
  assert.equal((await f.db.query("SELECT count(*) FROM platform.review_decisions WHERE scope='commit'")).rows[0].count,'0');
 }finally{await f.dispose();}
});

test('恢复旧关系复核响应复用固定输入，预算到期仍不新增模型调用',async()=>{
 const f=await eventFixture();try{
  const x=await atRelations(f),executor=new EventExecutor(f.repo);
  const a=await executor.reserve(f.full.id,x.id,2,'AI-03',x.context.input);
  const response=await f.repo.putJson({status:200,body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(x.output)}}]})},'controlled-response');
  await f.db.query("UPDATE platform.model_attempts SET status='rejected',error_code='RELATION_REVIEW_REQUIRED',response_artifact_id=$2,completed_at=now() WHERE id=$1",[a.id,response]);
  await f.db.query("UPDATE platform.model_budget_windows SET used=3,deadline=now()-interval '1 second' WHERE owner_id=$1 AND task_id='AI-03'",[x.id]);
  await f.db.query("UPDATE information.event_candidates SET status='recoverable',reason_code='RELATION_REVIEW_REQUIRED' WHERE id=$1",[x.id]);
  await x.reviews.resumeCandidate(x.id,'review-operator',resumeToken(await candidate(f.db,x.id)),'恢复已校验建议到人工复核','restore');
  const activities=eventActivities(f.repo);await activities.advanceEvent(x.id,3,false);
  assert.equal((await candidate(f.db,x.id)).status,'review');
  assert.equal((await f.db.query("SELECT count(*) FROM platform.model_attempts WHERE task_id='AI-03'")).rows[0].count,'1');
  assert.equal((await f.db.query("SELECT used FROM platform.model_budget_windows WHERE owner_id=$1 AND task_id='AI-03'",[x.id])).rows[0].used,3);
  assert.equal((await f.db.query("SELECT count(*) FROM platform.audit_log WHERE action='event-response-revalidated' AND owner_id=$1",[x.id])).rows[0].count,'1');
 }finally{await f.dispose();}
});

test('引用校验失败仍须恢复，不转成人工关系审批',async()=>{
 const f=await eventFixture();try{const x=await atRelations(f);
  const bad=structuredClone(x.output);bad.definition_candidates[0]!.evidence_refs[0]!.end_cp=999;
  await assert.rejects(x.steps.accept(x.id,3,2,bad),/EVIDENCE_MISMATCH/);
  assert.equal((await candidate(f.db,x.id)).status,'processing');
  assert.equal((await f.db.query('SELECT count(*) FROM information.definition_candidates')).rows[0].count,'0');
 }finally{await f.dispose();}
});

test('正式提交再次核对关系复核人的当前权限',async()=>{
 const f=await eventFixture();try{const x=await atRelations(f);await x.steps.accept(x.id,3,2,x.output);
  await f.db.query("INSERT INTO platform.actors VALUES('relation-reviewer',ARRAY['read','event_review'],ARRAY['wiki-source-001'])");
  await x.reviews.recordReview(x.id,'relation-reviewer',{scope:'relations',proposal_generation:1,proposal_digest:await x.reviews.basis(x.id,'relations'),decision:'APPROVE',reason:'受控缺口复核'} as any,'relations');
  await x.steps.prepare(x.id,4,3);await x.steps.accept(x.id,4,3,{classification:'NEW_EVENT',changes:[{local_key:'new',update_type:'NEW_EVENT',summary:f.candidate.description,previous_status:null,current_status:'announced',effective_time:null,supersedes_update_ids:[],evidence_refs:f.candidate.evidence_refs}],source_evidence_refs:f.candidate.evidence_refs,reason:'受控新事件',unresolved_issues:[]});
  await x.steps.prepare(x.id,5,3);await x.steps.accept(x.id,5,3,{assessment_scope:f.options.assessment_scope,research_horizon:f.options.research_horizon,method_version:f.options.method_version,dimensions:[],financial_usages:[],reasoning_summary:'文字观察',limitations:[]});
  const commit=new EventCommit(f.repo),proposal=await commit.prepareCommit(x.id,3);
  await x.reviews.recordReview(x.id,'review-operator',{scope:'commit',proposal_generation:1,proposal_digest:proposal.digest,decision:'APPROVE',reason:'受控最终复核'},'commit');
  await f.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='relation-reviewer'");
  await assert.rejects(commit.commitCandidate(x.id,4,proposal.commit_key),/FORBIDDEN/);
  assert.equal((await f.db.query('SELECT count(*) FROM information.events')).rows[0].count,'0');
 }finally{await f.dispose();}
});
