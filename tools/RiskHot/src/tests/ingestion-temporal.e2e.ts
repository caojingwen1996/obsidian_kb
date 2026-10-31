import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {openSync,closeSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';
import {Pool} from 'pg';
import Long from 'long';
import {Client,Connection} from '@temporalio/client';
import {openFixture} from './fixture.js';
import {rebuildIngestionSchema} from '../platform/ingestion-migration.js';
import {grantIngestionRoles} from '../platform/ingestion-grants.js';
import {ExecutionStore} from '../information-ingestion/processing/execution.js';
import {IngestionRepository} from '../information-ingestion/processing/current-repository.js';
import {currentIngestionActivities} from '../runtime/current-activities.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {runtimeEnvironment,type RuntimeRole} from '../runtime/environment.js';
import {EventProcessing} from '../event-management/processing.js';
import {Reviews} from '../event-management/reviews.js';
import {digest} from '../event-management/contracts.js';
const fixture=await openFixture(),children:ChildProcess[]=[],output=resolve('docs/verification/ingestion-migration/logs');await mkdir(output,{recursive:true});
const connection=await Connection.connect({address:process.env.TEMPORAL_ADDRESS}),namespace=`riskhot-ingestion-test-${randomUUID()}`;
await connection.workflowService.registerNamespace({namespace,workflowExecutionRetentionPeriod:{seconds:Long.fromNumber(86400)}});const temporal=new Client({connection,namespace});
let requests=0,first=true,api:Pool|undefined;
const model=createServer(async(request,response)=>{
 let bytes='';for await(const chunk of request)bytes+=chunk;requests++;
 if(first){first=false;response.writeHead(503);response.end('{"error":"controlled failure"}');return;}
 const input=JSON.parse(JSON.parse(bytes).messages[1].content),context=input.context??{};let result;
 if(!input.context){const segment=input.material.segments[0];result={candidates:[{local_key:'one',title:'虚构机构宣布措施',description:segment.text,subject:'虚构机构',action:'宣布',target_clues:[],event_status:'announced',event_time:null,evidence_refs:[{material_id:input.material_id,version:input.version,content_digest:input.content_digest,segment_id:segment.id,start_cp:0,end_cp:5,quote:Array.from(segment.text).slice(0,5).join('')}],missing_fields:[]}],warnings:[]};}
 else if(context.rating)result={...context.rating,dimensions:[],financial_usages:[],reasoning_summary:'受控文字观察',limitations:['仅用于工程验证']};
 else if(context.history)result={classification:'NEW_EVENT',current_event:{title:context.candidate.title,description:context.candidate.description,subject:context.candidate.subject,action:context.candidate.action,event_status:context.candidate.event_status,event_time:null},changes:[{local_key:'change',update_type:'NEW_EVENT',summary:context.candidate.description,previous_status:null,current_status:'announced',effective_time:null,basis_fact_ids:[],evidence_refs:context.candidate.evidence_refs}],source_evidence_refs:context.candidate.evidence_refs,reason:'受控新事件',unresolved_issues:[]};
 else if(context.definitions)result={targets:[],variables:[],definition_candidates:[],unresolved_issues:[]};
 else result={decision:'NEW',matched_event_id:null,comparisons:[],reason:'受控独立事件',evidence_refs:context.candidate.evidence_refs,unresolved_issues:[]};
 response.setHeader('content-type','application/json');response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));
});
await new Promise<void>(resolve=>model.listen(0,'127.0.0.1',resolve));const address=model.address();assert.ok(address&&typeof address==='object');
const env={...process.env,DATABASE_URL:fixture.urlFor('DATABASE_URL'),IO_DATABASE_URL:fixture.urlFor('IO_DATABASE_URL'),MODEL_DATABASE_URL:fixture.urlFor('MODEL_DATABASE_URL'),RELAY_DATABASE_URL:fixture.urlFor('RELAY_DATABASE_URL'),ARTIFACT_ROOT:fixture.folder,TEMPORAL_NAMESPACE:namespace,MODEL_PROTOCOL:'openai-chat',MODEL_ENDPOINT:`http://127.0.0.1:${address.port}`,MODEL_NAME:'controlled-current-model',MODEL_API_KEY:'controlled-local-key'};
const previous=Object.fromEntries(['MODEL_PROTOCOL','MODEL_ENDPOINT','MODEL_NAME','MODEL_API_KEY'].map(key=>[key,process.env[key]]));for(const key of Object.keys(previous))process.env[key]=env[key as keyof typeof env];
const start=(role:RuntimeRole)=>{const fd=openSync(join(fixture.folder,`${role}.log`),'a');const child=spawn(process.execPath,['--import','tsx',role==='relay'?'src/runtime/relay.ts':'src/runtime/worker.ts',...(role==='relay'?[]:[role])],{env:runtimeEnvironment(role,env),stdio:['ignore',fd,fd]});closeSync(fd);children.push(child);return child;};
async function until(check:()=>Promise<boolean>,label:string,timeout=45000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await setTimeout(200);}throw new Error(`等待超时：${label}`);}
try{
 await rebuildIngestionSchema(fixture.db,{workflowFence:'isolated-temporal-fixture'});await grantIngestionRoles(fixture.db);
 await fixture.db.query("INSERT INTO platform.actors VALUES('pipeline-operator',ARRAY['read','submit','retry','event_submit','event_review','event_commit','event_retry','candidate_disposition','model_budget'],ARRAY['wiki-source-001'])");
 api=new Pool({connectionString:env.DATABASE_URL});const apiRepo=new ExecutionStore(api,new ArtifactStore(fixture.folder)),store=new IngestionRepository(apiRepo),task=await store.submit('pipeline-operator','temporal-current',{source_key:'wiki-source-001',limit:1});
 await currentIngestionActivities(fixture.repo,async(input)=>new Response(String(input).includes('/125475/')?'<meta name="ArticleTitle" content="受控全文"><div id="zoom"><p>虚构机构宣布一项新的受控措施。</p></div>':'<a href="/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html">受控公告</a>',{headers:{'content-type':'text/html'}})).ingestCurrent(task.id,1);
 let worker=start('workflow');start('io');start('model');start('relay');
 await until(async()=>Boolean((await fixture.db.query("SELECT 1 FROM infomation.ingestion_material WHERE extraction_result->>'error_code'='MODEL_HTTP_503'")).rowCount),'第一次模型调用可恢复错误');worker.kill('SIGKILL');await once(worker,'exit');worker=start('workflow');
 await until(async()=>Boolean((await fixture.db.query("SELECT 1 FROM infomation.ingestion_material WHERE extraction_result->>'candidate_count'='1'")).rowCount),'重启后抽取恢复',70000);
 assert.equal((await store.task(task.id)).status,'completed');const material=(await fixture.db.query('SELECT * FROM infomation.ingestion_material')).rows[0];
 const definitions={targets:[],variables:[]};await fixture.db.query("INSERT INTO information.definition_sets VALUES('controlled-empty','engineering-test','1','complete',$1,$2)",[definitions,digest(definitions)]);
 await new EventProcessing(apiRepo).startFullProcessing(material.id,'pipeline-operator',{task_manifest_id:'f02-fact-draft-v2',definition_ref:'controlled-empty',assessment_scope:{jurisdiction:'中国'},research_horizon:{term:'短期'},method_version:'text-draft-v1',reason:'隔离工程验证'},'start-current-event');
 await until(async()=>Boolean((await fixture.db.query("SELECT 1 FROM information.event_candidates WHERE status='review' AND resume_step=2")).rowCount),'模型归组结果进入复核');const candidate=(await fixture.db.query('SELECT * FROM information.event_candidates')).rows[0],reviews=new Reviews(apiRepo);
 await reviews.recordReview(candidate.id,'pipeline-operator',{scope:'identity',proposal_generation:1,proposal_digest:await reviews.basis(candidate.id,'identity'),decision:'APPROVE',reason:'受控核对归组'},'temporal-identity');
 await until(async()=>Boolean((await fixture.db.query("SELECT 1 FROM information.event_candidates WHERE status='review' AND resume_step=6")).rowCount),'自动步骤3至5及提交准备');
 await reviews.recordReview(candidate.id,'pipeline-operator',{scope:'commit',proposal_generation:1,proposal_digest:await reviews.basis(candidate.id,'commit'),decision:'APPROVE',reason:'受控最终审批'},'temporal-commit');
 await until(async()=>Boolean((await fixture.db.query("SELECT 1 FROM information.event_candidates WHERE status='completed'")).rowCount),'批准后事件保存');
 await until(async()=>Boolean((await fixture.db.query("SELECT 1 FROM platform.message_deliveries WHERE status='received' AND files_state='ready'")).rowCount),'正式事件可靠交付');
 assert.equal((await fixture.db.query('SELECT * FROM information.event')).rowCount,1);assert.equal(requests,6);assert.equal((await fixture.db.query("SELECT to_regclass('information.processing_runs') AS t")).rows[0].t,null);
 for(const attempt of (await fixture.db.query('SELECT request_artifact_id FROM platform.model_attempts')).rows){const ref=await fixture.repo.json<Record<string,unknown>>(attempt.request_artifact_id);assert.equal('material'in ref,false);assert.equal('version_id'in ref,false);}
 await writeFile(join(output,'temporal-results.json'),JSON.stringify({passed:true,namespace,model_requests:requests,checks:['独立schema5数据库与Temporal命名空间','实际IO/model/relay/API角色','模型临时失败后Worker重启恢复','自动抽取与完整归组后人工审批','自动步骤3至5、最终审批和正式保存','事件文件与可靠交付','审计仅保留资料引用，不恢复旧表']},null,2),'utf8');console.log('schema5真实Temporal链路通过，6次受控模型调用，正式事件已审批、保存及交付。');
}catch(error){for(const role of ['workflow','io','model','relay']){const log=await readFile(join(fixture.folder,`${role}.log`),'utf8').catch(()=>'');await writeFile(join(output,`current-${role}.log`),log,'utf8');}console.error(JSON.stringify((await fixture.db.query('SELECT id,status,reason_code,resume_step FROM information.event_candidates')).rows));console.error(JSON.stringify((await fixture.db.query('SELECT extraction_result FROM infomation.ingestion_material')).rows));throw error;
}finally{
 for await(const workflow of temporal.workflow.list({query:"ExecutionStatus = 'Running'"}))await temporal.workflow.getHandle(workflow.workflowId).terminate('隔离测试结束');
 for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');for(const child of children){if(child.exitCode!==null||child.signalCode!==null)continue;await Promise.race([once(child,'exit'),setTimeout(5000)]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
 model.closeAllConnections();await new Promise<void>(resolve=>model.close(()=>resolve()));await api?.end();await connection.close();await fixture.dispose();for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
