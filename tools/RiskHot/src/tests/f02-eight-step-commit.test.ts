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

test('M4迁移与映射采用快照后，F02 Worker仍保存事件、复用快照并投递pg-boss',async()=>{const x=await prepared();let worker:Pool|undefined,boss:PgBoss|undefined;try{
 const {applyM4Migration}=await import('../platform/m4-migration.js');const {FinancialObjects}=await import('../financial-objects/service.js');const {directory,object}=await import('./m4-fixture.js');
 const {readFile}=await import('node:fs/promises');boss=new PgBoss({connectionString:x.db.options.connectionString,schedule:false,supervise:false});boss.on('error',()=>{});await boss.start();await boss.createQueue('events.enrich');await boss.createQueue('deliveries.send');await x.db.query(await readFile('src/db/009-business-queue.sql','utf8'));
 await applyM4Migration(x.db);await grantIngestionRoles(x.db);const {grantBusinessQueueRole}=await import('../platform/business-grants.js');await grantBusinessQueueRole(x.db,'riskhot_io');await x.db.query("UPDATE platform.actors SET permissions=permissions||ARRAY['financial_config_manage','observation_manage','target_mapping_review'] WHERE subject='operator'");
 const target=(await x.db.query("INSERT INTO information.target(target_name,categories,jurisdiction,scope_definition) VALUES('美元','[{\"primary_category\":\"货币与货币形态\",\"secondary_category\":\"货币单位\"}]','美国','美元单位，不含融资市场') RETURNING *")).rows[0];
 const service=new FinancialObjects(x.repo),root=(await service.save('operator',directory(),'root')).config,config=(await service.save('operator',object(root.id),'config')).config;
 const observed=(await service.add('operator',{config_id:config.id,expected_config_version:'1',reason:'手工建立共享观察'},'add-observation')).observation;await service.changeObservation('operator',observed.id,{action:'pause',expected_version:'1',reason:'暂停期间仍允许F02保存'},'pause-observation');
 const mapping=(await service.map('operator',{config_id:config.id,target_id:target.id,expected_config_version:'1',expected_target_version:'1',decision:'approve',identity_confirmed:true,reason:'人工核定相同身份'},'map')).mapping;
 await x.db.query("INSERT INTO information.target_identity_runs(candidate_id,generation,object_ref,input_digest,input,task_version,state,target_id,target_version,approval_actor,approval_reason,approval_digest) VALUES($1,1,'m4-object','target-input','{}','test','approved',$2,1,'operator','核定','approved-digest')",[x.c,target.id]);
 const result={targets:[{target_id:target.id}],no_targets:false};await x.db.query("UPDATE information.candidate_step_results SET result=$2 WHERE candidate_id=$1 AND node_key='resolve_target'",[x.c,result]);x.steps.find(s=>s.node_key==='resolve_target')!.result=result;
 const identityStep=x.steps.find(s=>s.node_key==='resolve_event')!,identityResult=identityStep.result as {context:{permission_epoch:number}};
 const epoch=Number((await x.db.query('SELECT epoch FROM platform.permission_epochs WHERE id')).rows[0].epoch);identityResult.context.permission_epoch=epoch;
 await x.db.query('UPDATE information.event_identity_snapshots SET permission_epoch=$2 WHERE candidate_id=$1',[x.c,epoch]);await x.db.query("UPDATE information.candidate_step_results SET result=$2 WHERE candidate_id=$1 AND node_key='resolve_event'",[x.c,identityResult]);
 await x.db.query("UPDATE platform.review_decisions SET proposal_digest=$2 WHERE candidate_id=$1 AND scope='identity'",[x.c,digest({node_key:'resolve_event',input_digest:x.contextDigest,result:identityResult})]);
 await x.approve('commit',eightStepCommitReviewDigest(x.contextDigest,x.steps));worker=new Pool({connectionString:x.db.options.connectionString,options:'-c role=riskhot_io'});
 await x.db.query("INSERT INTO platform.task_runs(run_id,task_type,payload_version,owner_module,owner_ref,operation_key,execution_generation,input_digest,manifest_ref,engine,runtime_state) VALUES($1,'events.process',1,'F02',$2,'m4-test-process',1,$3,'f02-eight-step-v1','pg-boss','ready')",[randomUUID(),{id:x.c},x.contextDigest]);
 const receipt=await commitEightStep(new Repository(worker,new ArtifactStore('/tmp/riskhot-m4-f02-unused')),x.c,1,x.contextDigest,'operator');assert.equal(receipt.result_kind,'COMMITTED');assert.equal((await x.db.query("SELECT count(*)::int n FROM platform.task_runs WHERE task_type IN ('events.enrich','deliveries.send')")).rows[0].n,2);assert.equal((await x.db.query('SELECT count(*)::int n FROM pgboss.job')).rows[0].n,2);
 assert.equal((await x.db.query('SELECT definition_snapshot_id FROM information.event_target_definition WHERE event_id=$1 AND target_id=$2',[receipt.effects[0].event_id,target.id])).rows[0].definition_snapshot_id,mapping.target_snapshot_id);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.shared_observation')).rows[0].n,1);const observedAfter=await service.observationDetail('operator',observed.id);assert.equal(observedAfter.observation.state,'paused');assert.equal(observedAfter.events?.total,1);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.financial_object_config')).rows[0].n,2);
}finally{await worker?.end();await boss?.stop({wait:true});await x.close();}});

test('M4与F02并发建立首份Target快照时串行复用，双方采用内容与摘要均合法',async()=>{const x=await prepared();let worker:Pool|undefined,apiPool:Pool|undefined;let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});let saving:Promise<any>|undefined,mapping:Promise<any>|undefined;try{
 const {applyM4Migration}=await import('../platform/m4-migration.js');const {FinancialObjects}=await import('../financial-objects/service.js');const {directory,object}=await import('./m4-fixture.js');const {validateTargetSnapshot}=await import('../event-management/target-snapshots.js');
 await applyM4Migration(x.db);await grantIngestionRoles(x.db);await x.db.query("UPDATE platform.actors SET permissions=permissions||ARRAY['financial_config_manage','observation_manage','target_mapping_review'] WHERE subject='operator'");
 apiPool=new Pool({connectionString:x.db.options.connectionString,options:'-c role=riskhot_api'});const service=new FinancialObjects(new Repository(apiPool,new ArtifactStore('/tmp/riskhot-m4-concurrent-unused'))),root=(await service.save('operator',directory(),'root')).config,c=(await service.save('operator',object(root.id),'object')).config;
 const t=(await x.db.query("INSERT INTO information.target(target_name,categories,jurisdiction,scope_definition) VALUES('美元',$1,'美国','美元货币单位') RETURNING *",[JSON.stringify(c.categories)])).rows[0];
 await x.db.query("INSERT INTO information.target_identity_runs(candidate_id,generation,object_ref,input_digest,input,task_version,state,target_id,target_version,approval_actor,approval_reason,approval_digest) VALUES($1,1,'concurrent-object','target-input','{}','test','approved',$2,1,'operator','核定','approved-digest')",[x.c,t.id]);
 const result={targets:[{target_id:t.id}],no_targets:false};await x.db.query("UPDATE information.candidate_step_results SET result=$2 WHERE candidate_id=$1 AND node_key='resolve_target'",[x.c,result]);x.steps.find(s=>s.node_key==='resolve_target')!.result=result;
 const identity=x.steps.find(s=>s.node_key==='resolve_event')!.result as {context:{permission_epoch:number}},epoch=Number((await x.db.query('SELECT epoch FROM platform.permission_epochs WHERE id')).rows[0].epoch);identity.context.permission_epoch=epoch;
 await x.db.query('UPDATE information.event_identity_snapshots SET permission_epoch=$2 WHERE candidate_id=$1',[x.c,epoch]);await x.db.query("UPDATE information.candidate_step_results SET result=$2 WHERE candidate_id=$1 AND node_key='resolve_event'",[x.c,identity]);await x.db.query("UPDATE platform.review_decisions SET proposal_digest=$2 WHERE candidate_id=$1 AND scope='identity'",[x.c,digest({node_key:'resolve_event',input_digest:x.contextDigest,result:identity})]);await x.approve('commit',eightStepCommitReviewDigest(x.contextDigest,x.steps));
 worker=new Pool({connectionString:x.db.options.connectionString,options:'-c role=riskhot_io'});
 let locked!:()=>void;const hasShare=new Promise<void>(resolve=>{locked=resolve;}),connect=worker.connect.bind(worker);
 // 仅在真实SQL取得共享锁后设置测试屏障，不替换查询结果。
 worker.connect=(async()=>{const tx=await connect(),query=tx.query.bind(tx);tx.query=(async(...args:any[])=>{const value=await (query as any)(...args);if(typeof args[0]==='string'&&args[0].includes('information.target WHERE id=$1 AND is_active FOR SHARE')){locked();await blocked;}return value;}) as typeof tx.query;return tx;}) as typeof worker.connect;
 saving=commitEightStep(new Repository(worker,new ArtifactStore('/tmp/riskhot-m4-concurrent-unused')),x.c,1,x.contextDigest,'operator');await hasShare;
 mapping=service.map('operator',{config_id:c.id,target_id:t.id,expected_config_version:'1',expected_target_version:'1',decision:'approve',identity_confirmed:true,reason:'并发核定'},'concurrent-map');
 let waiting=false;for(let i=0;i<100;i++){waiting=Boolean((await x.db.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%information.target WHERE id=$1 FOR UPDATE%'")).rowCount);if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(waiting,true,'M4应等待F02已持有的Target共享锁');release();
 const [saved,mapped]=await Promise.all([saving,mapping]);assert.equal(saved.result_kind,'COMMITTED');const snapshots=(await x.db.query("SELECT * FROM information.definition_snapshots WHERE kind='target' AND definition_id=$1",[t.id])).rows;assert.equal(snapshots.length,1);assert.doesNotThrow(()=>validateTargetSnapshot(snapshots[0],t));assert.equal(mapped.mapping.target_snapshot_id,snapshots[0].id);assert.equal((await x.db.query('SELECT definition_snapshot_id FROM information.event_target_definition WHERE event_id=$1 AND target_id=$2',[saved.effects[0].event_id,t.id])).rows[0].definition_snapshot_id,snapshots[0].id);
}finally{release();await Promise.allSettled([saving,mapping].filter(Boolean));await apiPool?.end();await worker?.end();await x.close();}});
