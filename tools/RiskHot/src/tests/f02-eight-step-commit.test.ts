import PgBoss from 'pg-boss';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './f02-fixture.js';
import {applyF02Migration} from '../platform/f02-migration.js';
import {Repository} from '../information-ingestion/processing/repository.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {commitEightStep,commitNodes,eightStepCommitReviewDigest} from '../event-management/eight-step-commit.js';
import {digest} from '../event-management/contracts.js';
import {Pool} from 'pg';
import {grantIngestionRoles} from '../platform/ingestion-grants.js';

async function prepared(){
 const x=await fixture(true);await applyF02Migration(x.db);
 await x.db.query('DELETE FROM platform.commit_receipts WHERE candidate_id=$1',[x.c]);
 const segment=(await x.db.query('SELECT * FROM infomation.ingestion_material_segments WHERE material_id=$1',[x.m])).rows[0];
 await x.db.query('UPDATE infomation.ingestion_material SET content=$2 WHERE id=$1',[x.m,{segments:[{id:segment.id,text:segment.text}]}]);
 const fact=(await x.db.query('SELECT * FROM information.fact WHERE id=$1',[x.f])).rows[0];
 const f=(await x.db.query("WITH f AS(INSERT INTO information.fact(title,description,subject,action,event_status) VALUES('新事实','说明','新主体','行动','announced') RETURNING id),fm AS(INSERT INTO information.fact_material SELECT f.id,$1,'supporting',now() FROM f) INSERT INTO information.fact_evidence(fact_id,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role) SELECT f.id,$1,$1,1,repeat('a',64),$2,0,2,'75','supporting' FROM f RETURNING fact_id",[x.m,segment.id])).rows[0].fact_id;
 await x.db.query('INSERT INTO information.candidate_fact VALUES($1,$2)',[x.c,f]);
 await x.db.query("UPDATE information.event_candidates SET event_options='{"+'"task_manifest_id":"f02-eight-step-v1","definition_ref":"test-defs"'+"}' WHERE id=$1",[x.c]);
 const newFact=(await x.db.query('SELECT * FROM information.fact WHERE id=$1',[f])).rows[0];
 const draft={title:newFact.title,description:newFact.description,subject:newFact.subject,action:newFact.action,object:null,event_status:newFact.event_status,event_time:null};
 await x.db.query("UPDATE platform.actors SET permissions=ARRAY['read','event_submit','event_review','event_commit'] WHERE subject='operator'");
 const definitionPayload={targets:[],variables:[]};await x.db.query("INSERT INTO information.definition_sets VALUES('test-defs','test','1','complete',$1,$2)",[definitionPayload,digest(definitionPayload)]);
 const contextDigest=digest({fact:f});
 const manifest={events:[],coverage_status:'complete'};const manifestDigest=digest(manifest);
 const snapshot=(await x.db.query("INSERT INTO information.event_identity_snapshots(candidate_id,generation,scope_key,catalog_epoch,permission_epoch,manifest,manifest_digest,retrieval_truncated,coverage_status) VALUES($1,1,'l0-event-catalog',0,(SELECT epoch FROM platform.permission_epochs WHERE id),$2,$3,false,'complete') RETURNING id",[x.c,manifest,manifestDigest])).rows[0].id;
 const identityEvidence=(await x.db.query('SELECT * FROM information.fact_evidence WHERE fact_id=$1 ORDER BY id LIMIT 1',[f])).rows[0];
 const identity={decision:'NEW',context:{retrieval_snapshot_id:snapshot,catalog_epoch:0,permission_epoch:1,manifest_digest:manifestDigest,coverage_status:'complete',retrieval_truncated:false,events:[]},proposal:{decision:'NEW',matched_event_id:null,reason:'另一行动',comparisons:[],unresolved_issues:[],evidence_refs:[{material_id:identityEvidence.material_id,version:identityEvidence.material_version,content_digest:identityEvidence.material_digest,segment_id:identityEvidence.segment_id,start_cp:identityEvidence.start_cp,end_cp:identityEvidence.end_cp,quote:identityEvidence.quote}]}};
 const values:Record<string,unknown>={map_event:{},recognize_targets:{},resolve_event:identity,resolve_target:{targets:[],no_targets:true},establish_initial:{classification:null,current_event:draft,reason:'初始事实'},extract_variables:{schema_version:'riskhot.variable-extraction.v1',items:[]},assess_meaning:{method_version:'text-draft-v1',m:null,rating_status:'draft',dimensions:[],assessment_scope:{},research_horizon:{},reasoning_summary:'文字评价',limitations:['尚无发布评分方法']},classify_usage:{state:'waiting_rules'}};
 const steps=commitNodes.map(node_key=>({node_key,input_digest:contextDigest,result:values[node_key],state:'succeeded'}));
 for(const s of steps)await x.db.query("INSERT INTO information.candidate_step_results(candidate_id,generation,node_key,input_digest,result,state,context,manifest_ref) VALUES($1,1,$2,$3,$4,$5,'{}','f02-eight-step-v1')",[x.c,s.node_key,s.input_digest,s.result,s.state]);
 const commitDigest=eightStepCommitReviewDigest(contextDigest,steps);
 const approve=async(scope:string,hash:string)=>x.db.query("INSERT INTO platform.review_decisions(candidate_id,scope,proposal_digest,generation,actor,decision,reason,policy_version) VALUES($1,$2,$3,1,'operator','APPROVE','人工核对','f02-eight-step-v1')",[x.c,scope,hash]);
 await approve('identity',digest({node_key:'resolve_event',input_digest:contextDigest,result:identity}));
 return {...x,f,contextDigest,commitDigest,approve,steps,repo:new Repository(x.db,new ArtifactStore('/tmp/riskhot-f02-commit-unused'))};
}
test('NEW分别批准后原子保存事实、评级、消息、文件意图、回执，响应丢失重试无重复',async()=>{const x=await prepared();try{
 await assert.rejects(()=>commitEightStep(x.repo,x.c,1,x.contextDigest,'operator'),/COMMIT_APPROVAL_REQUIRED/);
 await x.approve('commit',x.commitDigest);
 await x.db.query('UPDATE information.event_candidates SET execution_generation=3 WHERE id=$1',[x.c]);
 const r=await commitEightStep(x.repo,x.c,3,x.contextDigest,'operator');assert.equal(r.result_kind,'COMMITTED');
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event_file_jobs')).rows[0].n,1);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event')).rows[0].n,2);
 const repeated=await commitEightStep(x.repo,x.c,3,x.contextDigest,'operator');assert.equal(repeated.commit_key,r.commit_key);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event')).rows[0].n,2);
}finally{await x.close();}});
test('实际Worker角色经受控函数锁定信源后保存，不获得信源修改权限',async()=>{
 const x=await prepared();let worker:Pool|undefined;
 try{
  await grantIngestionRoles(x.db);await x.approve('commit',x.commitDigest);
  worker=new Pool({connectionString:x.db.options.connectionString,options:'-c role=riskhot_io'});
  assert.equal((await worker.query("SELECT has_table_privilege(current_user,'m1.sources','UPDATE') AS allowed")).rows[0].allowed,false);
  const repo=new Repository(worker,new ArtifactStore('/tmp/riskhot-f02-commit-unused'));
  const receipt=await commitEightStep(repo,x.c,1,x.contextDigest,'operator');
  assert.equal(receipt.result_kind,'COMMITTED');
  assert.equal((await worker.query('SELECT event_id FROM information.fact WHERE id=$1',[x.f])).rows[0].event_id,receipt.effects[0].event_id);
 }finally{await worker?.end();await x.close();}
});
test('批准后资料变化拒绝保存且不丢原事实',async()=>{const x=await prepared();try{
 await x.approve('commit',x.commitDigest);await x.db.query('UPDATE infomation.ingestion_material SET version=2 WHERE id=$1',[x.m]);
 await assert.rejects(()=>commitEightStep(x.repo,x.c,1,x.contextDigest,'operator'),/MATERIAL_BASIS_CHANGED/);
 assert.equal((await x.db.query('SELECT event_id FROM information.fact WHERE id=$1',[x.f])).rows[0].event_id,null);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM platform.commit_receipts WHERE candidate_id=$1',[x.c])).rows[0].n,0);
}finally{await x.close();}});

test('NEW非空Target、正式变量和具体观测与评级一同保存',async()=>{const x=await prepared();try{
 const target=randomUUID(),variable=randomUUID(),objectRef='object-1';
 await x.db.query("INSERT INTO information.target(id,target_name,categories,scope_definition) VALUES($1,'受控主体','[{\"category\":\"test\"}]','受控范围')",[target]);
 await x.db.query("INSERT INTO information.target_identity_runs(candidate_id,generation,object_ref,input_digest,input,task_version,state,target_id,target_version,approval_actor,approval_reason,approval_digest) VALUES($1,1,$2,'target-input','{}','test','approved',$3,1,'operator','核定','approved-digest')",[x.c,objectRef,target]);
 const definition={id:variable,version:'1',name:'受控比例',status:'active',data_type:'numeric',unit:'%'};
 const ds=(await x.db.query("INSERT INTO information.definition_snapshots(kind,definition_id,definition_version,payload,digest) VALUES('variable',$1,'1',$2,$3) RETURNING id",[variable,definition,digest(definition)])).rows[0].id;
 const defs={targets:[],variables:[definition]};await x.db.query("UPDATE information.definition_sets SET payload=$1,digest=$2 WHERE ref='test-defs'",[defs,digest(defs)]);
 const fe=(await x.db.query('SELECT * FROM information.fact_evidence WHERE fact_id=$1',[x.f])).rows[0];
 const values={schema_version:'riskhot.variable-extraction.v1',items:[{local_ref:'v1',name:'受控比例',discovery_sources:['action'],source_contexts:[{source:'action',text:'行动',fact_id:x.f,evidence_refs:[fe.id]}],variable_id:variable,definition_snapshot_id:ds,match_status:'matched',reason:'原文直接取值',target_refs:[{kind:'target',ref:target}],relation_status:'ready',change_refs:[],values:[{value:75,unit:'%',value_nature:'actual',value_time:{kind:'point',precision:'year',start:'2026',end:null,raw_text:'2026年'},acquisition_method:'extracted',derivation_basis:null,basis:[{fact_id:x.f,fact_evidence_id:fe.id,material_id:fe.material_id,version:fe.material_version,content_digest:fe.material_digest,input_ref:null}]}]}]};
 for(const [node,value] of [['resolve_target',{targets:[{target_id:target}],no_targets:false}],['extract_variables',values]] as const){await x.db.query('UPDATE information.candidate_step_results SET result=$3 WHERE candidate_id=$1 AND node_key=$2',[x.c,node,value]);x.steps.find(s=>s.node_key===node)!.result=value;}
 await x.approve('commit',eightStepCommitReviewDigest(x.contextDigest,x.steps));
 const receipt=await commitEightStep(x.repo,x.c,1,x.contextDigest,'operator');
 assert.equal(receipt.effects[0].observation_ids.length,1);
 const obs=(await x.db.query('SELECT * FROM information.variable_observation_records')).rows[0];assert.equal(obs.value,75);assert.equal(obs.basis[0].fact_evidence_id,fe.id);assert.equal(obs.status,'pending');
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event_variable_fact WHERE event_id=$1',[receipt.effects[0].event_id])).rows[0].n,1);
}finally{await x.close();}});
test('文件任务故障回滚Event、归属、评级、提取和消息，重试后可恢复',async()=>{const x=await prepared();try{
 await x.approve('commit',x.commitDigest);
 await x.db.query("CREATE FUNCTION information.inject_file_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_FILE_FAILURE'; END $$; CREATE TRIGGER inject_failure BEFORE INSERT ON information.event_file_jobs FOR EACH ROW EXECUTE FUNCTION information.inject_file_failure()");
 await assert.rejects(()=>commitEightStep(x.repo,x.c,1,x.contextDigest,'operator'),/INJECTED_FILE_FAILURE/);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event')).rows[0].n,1);
 assert.equal((await x.db.query('SELECT event_id FROM information.fact WHERE id=$1',[x.f])).rows[0].event_id,null);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event_rating')).rows[0].n,0);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event_variable_extractions')).rows[0].n,0);
 await x.db.query('DROP TRIGGER inject_failure ON information.event_file_jobs');
 assert.equal((await commitEightStep(x.repo,x.c,1,x.contextDigest,'operator')).result_kind,'COMMITTED');
}finally{await x.close();}});
test('pg-boss保存同事务产生关联和交付Job，取消运行不能保存',async()=>{const x=await prepared();let boss:PgBoss|undefined;try{
 const {readFile}=await import('node:fs/promises');const {default:PgBoss}=await import('pg-boss');
 boss=new PgBoss({connectionString:(x.db as unknown as {options:{connectionString:string}}).options.connectionString,schedule:false,supervise:false});boss.on('error',()=>{});await boss.start();await boss.createQueue('events.enrich');await boss.createQueue('deliveries.send');
 await x.db.query(await readFile('src/db/009-business-queue.sql','utf8'));
 const run=randomUUID();
 await x.db.query("INSERT INTO platform.task_runs(run_id,task_type,payload_version,owner_module,owner_ref,operation_key,execution_generation,input_digest,manifest_ref,engine,runtime_state) VALUES($1,'events.process',1,'F02',$2,'test-process',1,$3,'f02-eight-step-v1','pg-boss','cancelled')",[run,{id:x.c},x.contextDigest]);
 await x.approve('commit',x.commitDigest);
 await assert.rejects(()=>commitEightStep(x.repo,x.c,1,x.contextDigest,'operator'),/RUN_NOT_DISPATCHABLE/);
 await x.db.query("UPDATE platform.task_runs SET runtime_state='ready' WHERE run_id=$1",[run]);
 const receipt=await commitEightStep(x.repo,x.c,1,x.contextDigest,'operator');assert.equal(receipt.result_kind,'COMMITTED');
 assert.equal((await x.db.query("SELECT count(*)::int n FROM platform.task_runs WHERE task_type IN ('events.enrich','deliveries.send')")).rows[0].n,2);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM pgboss.job')).rows[0].n,2);
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'riskhot-f02-delivery-')),previous=process.env.ARTIFACT_ROOT;process.env.ARTIFACT_ROOT=root;
 try{
  const {createHandlers}=await import('../runtime/f02-business-handlers.js');const {executeBusinessJob}=await import('../runtime/business-worker.js');
  const handlers=await createHandlers(x.db),envelope=(await x.db.query("SELECT data FROM pgboss.job WHERE name='deliveries.send'")).rows[0].data;
  assert.equal((await executeBusinessJob(x.db,envelope,handlers.business['deliveries.send']!)).state,'succeeded');
  const status=(await x.db.query('SELECT status,files_state,receipt FROM platform.message_deliveries WHERE message_id=$1',[receipt.effects[0].message_id])).rows[0];
  assert.equal(status.status,'received');assert.equal(status.files_state,'ready');assert.equal(status.receipt.message_id,receipt.effects[0].message_id);
  assert.equal((await x.db.query('SELECT state FROM platform.messages WHERE id=$1',[receipt.effects[0].message_id])).rows[0].state,'completed');
 }finally{if(previous===undefined)delete process.env.ARTIFACT_ROOT;else process.env.ARTIFACT_ROOT=previous;await rm(root,{recursive:true,force:true});}

}finally{await boss?.stop({wait:true});await x.close();}});
test('不是事件处置优先于八步模型和保存，复核/恢复不能绕过处置决定',async()=>{const x=await prepared();try{
 const {EightStepService}=await import('../event-management/eight-step-service.js');const {Reviews}=await import('../event-management/reviews.js');
 await x.db.query("UPDATE platform.actors SET permissions=permissions||ARRAY['candidate_disposition','event_retry'] WHERE subject='operator'");
 const basis=await new Reviews(x.repo).basis(x.c,'disposition');await x.db.query("INSERT INTO platform.review_decisions(candidate_id,generation,scope,proposal_digest,actor,decision,reason,policy_version) VALUES($1,1,'disposition',$2,'operator','CONFIRM_NOT_EVENT','原文核对后确认不是事件','manual-v1')",[x.c,basis]);
 const service=new EightStepService(x.repo,async()=>{throw new Error('MODEL_MUST_NOT_RUN');});
 await assert.rejects(()=>service.resume(x.c,'operator','resume'),/DISPOSITION_PENDING/);
 await assert.rejects(()=>commitEightStep(x.repo,x.c,1,x.contextDigest,'operator'),/DISPOSITION_PENDING/);
 const result=await service.advance(x.c,1);assert.equal(result.reason,'NOT_EVENT');assert.equal((await x.db.query('SELECT status FROM information.event_candidates WHERE id=$1',[x.c])).rows[0].status,'dismissed');assert.equal((await x.db.query('SELECT event_id FROM information.fact WHERE id=$1',[x.f])).rows[0].event_id,null);
 }finally{await x.close();}});
