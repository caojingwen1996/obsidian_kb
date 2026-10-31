import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import Fastify from 'fastify';
import {registerCurrentEvents} from '../runtime/current-events.js';
import {grantIngestionRoles} from '../platform/ingestion-grants.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyIngestionMigration} from '../platform/ingestion-migration.js';
import {Repository} from '../information-ingestion/processing/repository.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {EventProcessing} from '../event-management/processing.js';
import {CandidateSteps} from '../event-management/candidate-steps.js';
import {Reviews} from '../event-management/reviews.js';
import {TargetIdentity,targetPackage} from '../event-management/target-identity.js';
import {EventCommit} from '../event-management/commit.js';
import {digest} from '../event-management/contracts.js';
import {categoryVersion,targetRuleVersion,validateTargetOutput,type TargetInput,type TargetObject} from '../event-management/target-identity-contracts.js';
import {eventActivities} from '../runtime/event-activities.js';
import {currentInputDigest} from '../event-management/current-model.js';

async function fixture(){
 const admin=new Pool({connectionString:process.env.ADMIN_DATABASE_URL,connectionTimeoutMillis:5000}),name=`riskhot_ai07_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.ADMIN_DATABASE_URL!);url.pathname=`/${name}`;const db=new Pool({connectionString:url.href}),folder=await mkdtemp(join(tmpdir(),'riskhot-ai07-'));await applyIngestionMigration(db);await applyIngestionMigration(db);
 const repo=new Repository(db,new ArtifactStore(folder)),store=new IngestionRepository(repo);await store.seedCatalog([{id:'wiki-source-001',name:'受控',url:'https://www.pbc.gov.cn/',tier:'T1',group:'受控',focus:'',context:''}]);await db.query("INSERT INTO platform.actors VALUES('operator',ARRAY['read','submit','event_submit','event_review','event_commit','event_retry','model_budget'],ARRAY['*']),('reader',ARRAY['read'],ARRAY['*'])");
 const task=await store.submit('operator','event-test',{source_key:'wiki-source-001',limit:1}),segment={id:randomUUID(),text:'虚构机构宣布一项措施。',rawLocator:'p:0',kind:'paragraph' as const};const material=await store.saveMaterial(task.id,1,{title:'测试事件',publishedAtText:null,url:'https://www.pbc.gov.cn/test',normalizerVersion:'v1',segments:[segment]});const basis={material_id:material.id,version:material.version,content_digest:material.content_digest},evidence={...basis,segment_id:segment.id,start_cp:0,end_cp:4,quote:'虚构机构'};
 const payload={local_key:'one',title:'机构宣布措施',description:segment.text,subject:'虚构机构',action:'宣布',target_clues:['虚构机构'],event_status:'announced',event_time:null,evidence_refs:[evidence],missing_fields:[]};await store.acceptExtraction('operator',basis,{candidates:[payload],warnings:[]});const defs={targets:[],variables:[]};await db.query("INSERT INTO information.definition_sets VALUES('empty','test','1','complete',$1,$2)",[defs,digest(defs)]);
 const options={task_manifest_id:targetPackage,definition_ref:'empty',assessment_scope:{jurisdiction:'中国'},research_horizon:{term:'短期'},method_version:'text-draft-v1',reason:'受控测试'};await new EventProcessing(repo).startFullProcessing(material.id,'operator',options,'start');const c=(await db.query('SELECT * FROM information.event_candidates')).rows[0],steps=new CandidateSteps(repo),reviews=new Reviews(repo);await steps.prepare(c.id,2,1);await steps.accept(c.id,2,1,{decision:'NEW',matched_event_id:null,comparisons:[],reason:'独立事件',evidence_refs:[evidence],unresolved_issues:[]});await reviews.recordReview(c.id,'operator',{scope:'identity',proposal_generation:1,proposal_digest:await reviews.basis(c.id,'identity'),decision:'APPROVE',reason:'核对'},'identity');
 const object:TargetObject={object_ref:'object-1',name:'虚构机构',categories:[{primary_category:'金融主体与机构',secondary_category:'非金融部门'}],jurisdiction:'中国',scope_definition:'本资料中的虚构机构，不含其关联机构',limitations:[],uncertainties:[],evidence_refs:[evidence]};
 return {db,repo,store,c,steps,reviews,evidence,payload,options,object,targets:new TargetIdentity(repo),async generation(){return Number((await db.query('SELECT execution_generation FROM information.event_candidates WHERE id=$1',[c.id])).rows[0].execution_generation);},async dispose(){await db.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();await rm(folder,{recursive:true,force:true});}};
}
const output=(input:TargetInput)=>({object_ref:input.object_ref,decision:'NEW',matched_target_id:null,comparisons:input.candidates.map(c=>({target_id:c.id,identity_match:false,reason:'范围不同',basis_refs:[input.basis_catalog[0]!.basis_ref,`target:${c.id}:${c.definition_version}`]})),reason:'对象定义完整，完整目录没有同一对象',basis_refs:input.basis_catalog.map(b=>b.basis_ref),unresolved_issues:[]});

for(const invalidateTarget of [false,true])test(`AI07逐对象真实运行分流、权限、核定、关系与最终提交闭环（失效=${invalidateTarget}）`,async()=>{const f=await fixture();try{
 await assert.rejects(()=>f.targets.setObjects(f.c.id,'reader',{objects:[f.object],explicit_no_objects:false,reason:'补证'},1,'denied'),/FORBIDDEN/);
 await assert.rejects(()=>f.targets.setObjects(f.c.id,'operator',{objects:[],explicit_no_objects:false,reason:'不完整'},1,'empty'),/TARGET_OBJECT_SET_INVALID/);
 await assert.rejects(()=>f.targets.advance(f.c.id,2),/TARGET_OBJECT_INPUT_REQUIRED/);
 await f.targets.setObjects(f.c.id,'operator',{objects:[f.object],explicit_no_objects:false,reason:'补证'},1,'objects');const generation=await f.generation();
 const activities=eventActivities(f.repo),advance=await activities.advanceEvent(f.c.id,generation,false,'first');assert.ok(advance.attempt);
 const a=(await f.db.query('SELECT * FROM platform.model_attempts WHERE id=$1',[advance.attempt!.id])).rows[0];assert.equal(a.task_id,'AI-07');assert.equal(a.object_ref,'object-1');assert.equal((await f.db.query('SELECT * FROM platform.claim_model_call($1)',[a.id])).rows[0].allowed,true);
 const prepared=await f.targets.advance(f.c.id,generation),input=prepared.input!.context as TargetInput;assert.equal(a.input_digest,currentInputDigest(prepared.input!));
 // 传输工件为受控测试响应，验证真实consume分流，不作为模型评测。
 const artifact=await f.repo.putJson({status:200,protocol:'codex-exec',body:JSON.stringify({events:[{type:'item.completed',item:{type:'agent_message',text:JSON.stringify(output(input))}},{type:'turn.completed'}]})},'model-response');
 await grantIngestionRoles(f.db);await f.db.query('SET ROLE riskhot_model');try{await f.db.query("UPDATE platform.model_attempts SET status='responded',response_artifact_id=$2 WHERE id=$1",[a.id,artifact]);}finally{await f.db.query('RESET ROLE');}
 assert.deepEqual(await activities.consumeEvent(f.c.id,generation,false,a.id),{});await f.targets.advance(f.c.id,generation);const read=await f.targets.read(f.c.id,'operator'),run=read.runs[0]!;
 const approved=await f.targets.approve(f.c.id,'operator',run.id,run.review_digest,'核对原文及范围','approve');assert.equal((await f.db.query('SELECT * FROM information.target')).rowCount,1);await f.targets.approve(f.c.id,'operator',run.id,run.review_digest,'核对原文及范围','approve');assert.equal((await f.db.query('SELECT * FROM information.target')).rowCount,1);
 const g=await f.generation(),context=await f.steps.prepare(f.c.id,3,g);assert.deepEqual(context.validation.target_ids,[approved.target_id]);await assert.rejects(()=>f.steps.accept(f.c.id,3,g,{targets:[],variables:[],definition_candidates:[],unresolved_issues:[]}),/TARGET_RELATION_COVERAGE_REQUIRED/);assert.equal((await f.db.query('SELECT resume_step FROM information.event_candidates WHERE id=$1',[f.c.id])).rows[0].resume_step,3);await f.steps.accept(f.c.id,3,g,{targets:[{target_id:approved.target_id,definition_version:'1',relation_note:'直接涉及',evidence_refs:[f.evidence]}],variables:[],definition_candidates:[],unresolved_issues:[]});
 await f.steps.prepare(f.c.id,4,g);await f.steps.accept(f.c.id,4,g,{classification:'NEW_EVENT',current_event:{title:f.payload.title,description:f.payload.description,subject:f.payload.subject,action:f.payload.action,event_status:f.payload.event_status,event_time:null},changes:[{local_key:'change',update_type:'NEW_EVENT',summary:f.payload.description,previous_status:null,current_status:'announced',effective_time:null,basis_fact_ids:[],evidence_refs:[f.evidence]}],source_evidence_refs:[f.evidence],reason:'新事件',unresolved_issues:[]});await f.steps.prepare(f.c.id,5,g);await f.steps.accept(f.c.id,5,g,{assessment_scope:f.options.assessment_scope,research_horizon:f.options.research_horizon,method_version:f.options.method_version,dimensions:[],financial_usages:[],reasoning_summary:'文字观察',limitations:['未批准量化方法']});
 const commit=new EventCommit(f.repo),proposal=await commit.prepareCommit(f.c.id,g);await f.reviews.recordReview(f.c.id,'operator',{scope:'commit',proposal_generation:1,proposal_digest:proposal.digest,decision:'APPROVE',reason:'最终核对'},'commit');if(invalidateTarget){await f.db.query('UPDATE information.target SET definition_version=definition_version+1');assert.equal((await commit.commitCandidate(f.c.id,await f.generation(),proposal.commit_key)).result_kind,'TARGET_BASIS_CHANGED');for(const table of ['information.event','information.event_target','platform.message_deliveries'])assert.equal((await f.db.query(`SELECT * FROM ${table}`)).rowCount,0);}else{assert.equal((await commit.commitCandidate(f.c.id,await f.generation(),proposal.commit_key)).result_kind,'COMMITTED');assert.equal((await f.db.query('SELECT * FROM information.event_target')).rows[0].target_id,approved.target_id);}
}finally{await f.dispose();}});

test('AI07证据/歧义矩阵、独立预算、并发新建复查及旧输入失效',async()=>{const f=await fixture();try{
 const objects=[f.object,{...f.object,object_ref:'object-2'}];await f.targets.setObjects(f.c.id,'operator',{objects,explicit_no_objects:false,reason:'两处独立Object'},1,'objects');let g=await f.generation();const first=(await f.targets.advance(f.c.id,g)).input!,input=first.context as TargetInput;
 assert.throws(()=>validateTargetOutput(input,{...output(input),basis_refs:['forged']}),/TARGET_BASIS_UNKNOWN/);assert.throws(()=>validateTargetOutput({...input,object:{...input.object,scope_definition:null}},output(input)),/TARGET_NEW_INVALID/);assert.throws(()=>validateTargetOutput({...input,retrieval:{...input.retrieval,complete:false}},output(input)),/TARGET_RETRIEVAL_INCOMPLETE/);
 await f.targets.accept(f.c.id,g,input,output(input));const second=(await f.targets.advance(f.c.id,g)).input!;assert.equal((second.context as TargetInput).object_ref,'object-2');const {EventExecutor}=await import('../event-management/task-executor.js'),executor=new EventExecutor(f.repo);
 for(let i=0;i<3;i++)await executor.reserve(f.c.material_id,f.c.id,g,'AI-07',first,`one-${i}`);assert.equal((await executor.reserve(f.c.material_id,f.c.id,g,'AI-07',second,'two')).window_used,1);
 await f.targets.accept(f.c.id,g,second.context as TargetInput,output(second.context as TargetInput));let read=await f.targets.read(f.c.id,'operator');const results=await Promise.allSettled(read.runs.map(r=>f.targets.approve(f.c.id,'operator',r.id,r.review_digest,'核对','approve-'+r.id)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await f.db.query('SELECT * FROM information.target')).rowCount,1);
 g=await f.generation();const rerun=(await f.targets.advance(f.c.id,g)).input!,newInput=rerun.context as TargetInput;assert.equal(newInput.candidates.length,1);const t=newInput.candidates[0]!,reuse={...output(newInput),decision:'REUSE',matched_target_id:t.id,comparisons:[{target_id:t.id,identity_match:true,reason:'相同范围',basis_refs:newInput.basis_catalog.map(b=>b.basis_ref)}]};validateTargetOutput(newInput,reuse);assert.throws(()=>validateTargetOutput({...newInput,candidates:[{...t,is_active:false}]},reuse),/TARGET_REUSE_INVALID/);
 await f.db.query('UPDATE information.target SET definition_version=2');await assert.rejects(()=>f.targets.accept(f.c.id,g,newInput,reuse),/TARGET_BASIS_CHANGED/);
}finally{await f.dispose();}});

test('AI07 API补证与核定输入校验、明确无对象、过期批准可重跑',async()=>{const f=await fixture(),app=Fastify();try{
 app.addHook('preHandler',async request=>{request.actor='operator';});registerCurrentEvents(app,f.repo);
 assert.equal((await app.inject('/api/v1/l0/event-settings')).json().task_manifest_id,'f02-fact-draft-v2');
 const endpoint=`/api/v1/l0/candidates/${f.c.id}/targets`;
 for(const suffix of ['objects','approve'])assert.equal((await app.inject({method:'POST',url:`${endpoint}/${suffix}`,payload:{},headers:{'idempotency-key':'bad'}})).statusCode,400);
 let response=await app.inject({method:'POST',url:`${endpoint}/objects`,payload:{generation:1,objects:{objects:[],explicit_no_objects:true,reason:'原文核定无作用对象'}},headers:{'idempotency-key':'none'}});assert.equal(response.statusCode,200);assert.deepEqual(await f.targets.advance(f.c.id,await f.generation()),{});
 response=await app.inject({method:'POST',url:`${endpoint}/objects`,payload:{generation:1,objects:{objects:[f.object],explicit_no_objects:false,reason:'补证'}},headers:{'idempotency-key':'object'}});assert.equal(response.statusCode,200);
 const input=(await f.targets.advance(f.c.id,await f.generation())).input!.context as TargetInput;await f.targets.accept(f.c.id,await f.generation(),input,output(input));const read=await f.targets.read(f.c.id,'operator'),r=read.runs[0]!;
 response=await app.inject({method:'POST',url:`${endpoint}/approve`,payload:{run_id:r.id,review_digest:r.review_digest,reason:'核定'},headers:{'idempotency-key':'approval'}});assert.equal(response.statusCode,200);
 await f.db.query('UPDATE information.target SET definition_version=definition_version+1');const rerun=await f.targets.advance(f.c.id,await f.generation());assert.ok(rerun.input);assert.equal((rerun.input!.context as TargetInput).candidates[0]!.definition_version,2);assert.equal((await f.db.query('SELECT state FROM information.target_identity_runs WHERE id=$1',[r.id])).rows[0].state,'superseded');
}finally{await app.close();await f.dispose();}});

async function approveObject(f:Awaited<ReturnType<typeof fixture>>,actor='operator'){
 const input=(await f.targets.advance(f.c.id,await f.generation())).input!.context as TargetInput;
 let proposal=output(input);if(input.candidates.length){const t=input.candidates[0]!;proposal={...proposal,decision:'REUSE',matched_target_id:t.id as any,comparisons:proposal.comparisons.map(c=>({...c,identity_match:c.target_id===t.id}))} as typeof proposal;}
 await f.targets.accept(f.c.id,await f.generation(),input,proposal);const r=(await f.targets.read(f.c.id,'operator')).runs.find(r=>r.input_digest===digest(input))!;
 await f.targets.approve(f.c.id,actor,r.id,r.review_digest,'核定','approval-'+randomUUID());return r;
}
test('Step3准备后定义失效重新核定重建上下文；原批准人撤权后新批准人保留Target身份',async()=>{const f=await fixture();try{
 await f.db.query("INSERT INTO platform.actors VALUES('reviewer',ARRAY['read','event_review'],ARRAY['*'])");
 await f.targets.setObjects(f.c.id,'operator',{objects:[f.object],explicit_no_objects:false,reason:'补证'},1,'objects');let r=await approveObject(f,'reviewer');let context=await f.steps.prepare(f.c.id,3,await f.generation());const id=context.validation.target_ids[0];
 await f.db.query('UPDATE information.target SET definition_version=2');r=await approveObject(f,'reviewer');context=await f.steps.prepare(f.c.id,3,await f.generation());assert.equal(context.definitions!.targets[0]!.version,'2');assert.equal(context.validation.target_ids[0],id);
 await f.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='reviewer'");
 await f.targets.advance(f.c.id,await f.generation());const pending=(await f.targets.read(f.c.id,'operator')).runs.find(x=>x.id===r.id)!;assert.equal(pending.state,'review');
 await f.targets.approve(f.c.id,'operator',pending.id,pending.review_digest,'替代授权复核','new-reviewer');context=await f.steps.prepare(f.c.id,3,await f.generation());assert.equal(context.validation.target_ids[0],id);assert.equal((await f.db.query('SELECT * FROM information.target')).rowCount,1);
 await f.steps.accept(f.c.id,3,await f.generation(),{targets:[{target_id:id,definition_version:'2',relation_note:'直接涉及',evidence_refs:[f.evidence]}],variables:[],definition_candidates:[],unresolved_issues:[]});assert.equal((await f.db.query('SELECT resume_step FROM information.event_candidates WHERE id=$1',[f.c.id])).rows[0].resume_step,4);
}finally{await f.dispose();}});

test('全局旧定义缺口拒绝假空召回；目录100容量拒绝新增而允许复用',async()=>{const f=await fixture();try{
 await f.targets.setObjects(f.c.id,'operator',{objects:[f.object],explicit_no_objects:false,reason:'补证'},1,'objects');const legacy={targets:[{id:randomUUID(),name:'旧目标',version:'1',status:'active'}],variables:[]};await f.db.query("INSERT INTO information.definition_sets VALUES('legacy','test','1','complete',$1,$2)",[legacy,digest(legacy)]);
 await assert.rejects(()=>f.targets.advance(f.c.id,3),/TARGET_LEGACY_MIGRATION_REQUIRED/);await f.db.query("DELETE FROM information.definition_sets WHERE ref='legacy'");
 for(let i=0;i<100;i++)await f.db.query('INSERT INTO information.target(target_name,categories,scope_definition) VALUES($1,$2,$3)',['目标'+i,JSON.stringify(f.object.categories),'范围'+i]);
 const input=(await f.targets.advance(f.c.id,await f.generation())).input!.context as TargetInput;await f.targets.accept(f.c.id,await f.generation(),input,output(input));const r=(await f.targets.read(f.c.id,'operator')).runs[0]!;await assert.rejects(()=>f.targets.approve(f.c.id,'operator',r.id,r.review_digest,'新建','full'),/TARGET_CATALOG_CAPACITY_EXCEEDED/);assert.equal((await f.db.query('SELECT * FROM information.target')).rowCount,100);assert.equal((await f.db.query('SELECT state FROM information.target_identity_runs WHERE id=$1',[r.id])).rows[0].state,'review');
 await f.targets.setObjects(f.c.id,'operator',{objects:[{...f.object,object_ref:'reuse'}],explicit_no_objects:false,reason:'复核复用'},1,'reuse');await approveObject(f);assert.equal((await f.db.query('SELECT * FROM information.target')).rowCount,100);
}finally{await f.dispose();}});

test('实际retry入口重开耗尽及到期的Object预算，保留旧窗口',async()=>{const f=await fixture(),app=Fastify();try{
 app.addHook('preHandler',async request=>{request.actor='operator';});registerCurrentEvents(app,f.repo);
 await f.targets.setObjects(f.c.id,'operator',{objects:[f.object],explicit_no_objects:false,reason:'补证'},1,'objects');const input=(await f.targets.advance(f.c.id,await f.generation())).input!;const {EventExecutor}=await import('../event-management/task-executor.js'),executor=new EventExecutor(f.repo);const {resumeToken}=await import('../event-management/reviews.js');const {candidate}=await import('../event-management/store.js');
 for(let i=0;i<3;i++)await executor.reserve(f.c.material_id,f.c.id,await f.generation(),'AI-07',input,'attempt-'+i);
 for(const expired of [false,true]){if(expired)await f.db.query("UPDATE platform.model_budget_windows SET deadline=now()-interval '1 second' WHERE task_id='AI-07'");await f.db.query("UPDATE information.event_candidates SET status='recoverable',reason_code='MODEL_BUDGET_EXHAUSTED' WHERE id=$1",[f.c.id]);const token=resumeToken(await candidate(f.db,f.c.id));const reply=await app.inject({method:'POST',url:`/api/v1/l0/candidates/${f.c.id}/retry`,headers:{'idempotency-key':randomUUID()},payload:{resume_token:token,reason:'重新授权预算',open_budget:true}});assert.equal(reply.statusCode,202,reply.body);assert.equal((await executor.reserve(f.c.material_id,f.c.id,await f.generation(),'AI-07',input,randomUUID())).window_used,1);}
 assert.equal((await f.db.query("SELECT * FROM platform.model_budget_windows WHERE task_id='AI-07'")).rowCount,3);
}finally{await app.close();await f.dispose();}});

for(const changed of ['execution','proposal'] as const)test(`失效批准清理锁内拒绝并发变化的${changed}代际`,async()=>{const f=await fixture();const db=f.db as unknown as {query:(...args:any[])=>Promise<any>},original=db.query.bind(f.db);try{
 await f.targets.setObjects(f.c.id,'operator',{objects:[f.object],explicit_no_objects:false,reason:'补证'},1,'objects');await approveObject(f);await f.steps.prepare(f.c.id,3,await f.generation());await f.db.query('UPDATE information.target SET definition_version=2');const generation=await f.generation();let injected=false;
 db.query=async(...args:any[])=>{const result=await original(...args);if(!injected&&typeof args[0]==='string'&&args[0].includes("state='approved' ORDER BY created_at DESC LIMIT 1")){injected=true;await original(`UPDATE information.event_candidates SET ${changed==='execution'?'execution_generation':'proposal_generation'}=${changed==='execution'?'execution_generation':'proposal_generation'}+1,resume_step=4 WHERE id=$1`,[f.c.id]);}return result;};
 await assert.rejects(()=>f.targets.advance(f.c.id,generation),changed==='execution'?/STALE_EXECUTION/:/STALE_PROPOSAL/);assert.ok(injected);assert.equal((await f.db.query('SELECT resume_step FROM information.event_candidates WHERE id=$1',[f.c.id])).rows[0].resume_step,4);assert.equal((await f.db.query('SELECT state FROM information.candidate_step_results WHERE candidate_id=$1 AND step_no=3 AND generation=1',[f.c.id])).rows[0].state,'pending');
}finally{db.query=original;await f.dispose();}});
