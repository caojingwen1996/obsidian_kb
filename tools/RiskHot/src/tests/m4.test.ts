import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prepared,directory,object} from './m4-fixture.js';
import {values,type Config} from '../financial-objects/contracts.js';
import {applyM4Migration,inspectM4Migration} from '../platform/m4-migration.js';
import {grantIngestionRoles} from '../platform/ingestion-grants.js';
import {transaction} from '../platform/db.js';
const snapshotPayload=(s:{payload:unknown})=>s.payload as {change:{reason:string};target_name:string;jurisdiction:string;scope_definition:string};
const code=(expected:string)=>(e:unknown)=>e instanceof Error&&e.message===expected;
async function setup(){const x=await prepared();try{const root=(await x.save(directory())).config,config=(await x.save(object(root.id))).config;return {...x,root,config};}catch(error){await x.close();throw error;}}
const add=(x:Awaited<ReturnType<typeof setup>>,config=x.config,actor='operator',key:string=randomUUID())=>x.service.add(actor,{config_id:config.id,expected_config_version:config.config_version,reason:'建立共享关注'},key);
async function edit(x:Awaited<ReturnType<typeof setup>>,c:Config,patch:object){const input={...values(c),...patch,expected_config_version:c.config_version,reason:'调整定义',same_identity:true};const impact=await x.service.preview('operator',c.id,input);return x.save({...input,impact_token:impact.impact_token},c.id);}
test('AC01–08/23/24/29：空目录手工配置，跨账号共享唯一，部分失败稳定重试',async()=>{const x=await setup();try{
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.target')).rows[0].n,0);
 assert.equal((await x.service.observations('reader')).total,0);
 const results=await Promise.all([add(x),add(x,x.config,'other')]);assert.deepEqual(results.map(r=>r.outcome).sort(),['added','exists']);assert.equal(results[0]!.observation.id,results[1]!.observation.id);
 const o=results[0]!.observation;assert.equal((await x.service.observations('reader')).items[0]!.id,o.id);
 const detail=await x.service.observationDetail('reader',o.id);assert.equal(detail.dynamics_state,'unmapped');assert.equal(detail.events,null);
 await assert.rejects(()=>add(x,x.root),code('M4_CONFIG_UNAVAILABLE'));
 const draft=(await x.save({...object(x.root.id,'草稿'),status:'draft',scope_definition:null})).config;await assert.rejects(()=>add(x,draft),code('M4_CONFIG_UNAVAILABLE'));
 const sameName=(await x.save({...object(x.root.id),scope_definition:'另一货币研究范围'})).config;assert.notEqual(sameName.id,x.config.id);
 await assert.rejects(()=>x.save(object(x.root.id)),code('M4_OBJECT_EXISTS'));
 const paused=await x.service.changeObservation('operator',o.id,{action:'pause',expected_version:o.version,reason:'手工暂停'},randomUUID());assert.equal((await add(x)).outcome,'restore_required');
 await x.service.changeObservation('operator',o.id,{action:'restore',expected_version:paused.observation.version,expected_config_version:x.config.config_version,reason:'核对后恢复'},randomUUID());
 const stale={config_id:sameName.id,expected_config_version:'999',reason:'失效项'},good={config_id:draft.id,expected_config_version:draft.config_version,reason:'草稿项'};
 const batch=await x.service.batch('operator',[{config_id:x.config.id,expected_config_version:x.config.config_version,reason:'已有'},stale,good],'batch');assert.deepEqual(batch.results.map(r=>r.outcome),['exists','failed','failed']);
 assert.deepEqual(JSON.parse(JSON.stringify(await x.service.batch('operator',[{config_id:x.config.id,expected_config_version:x.config.config_version,reason:'已有'},stale,good],'batch'))),JSON.parse(JSON.stringify(batch)));
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.shared_observation')).rows[0].n,1);
}finally{await x.close();}});
test('AC09–15/31：影响凭据、配置暂停、历史快照、显式恢复、合法树与双版本',async()=>{const x=await setup();try{
 const manualConfig=(await x.save(object(x.root.id,'手工暂停对象'))).config,manual=(await add(x,manualConfig)).observation;await x.service.changeObservation('operator',manual.id,{action:'pause',expected_version:'1',reason:'保持手工原因'},randomUUID());
 const o=(await add(x)).observation,disabled={...values(x.root),status:'disabled' as const,expected_config_version:x.root.config_version,reason:'停用分支'};
 const impact=await x.service.preview('operator',x.root.id,disabled);assert.equal(impact.observations.length,1);
 await assert.rejects(()=>x.save(disabled,x.root.id),code('M4_IMPACT_CONFIRMATION_REQUIRED'));
 const root=(await x.save({...disabled,impact_token:impact.impact_token},x.root.id)).config;
 assert.equal((await x.service.observationDetail('reader',manual.id)).observation.state_reason,'manual');assert.equal((await x.service.observationDetail('reader',manual.id)).observation.version,'2');
 let observed=(await x.service.observationDetail('reader',o.id)).observation;assert.equal(observed.state_reason,'config_unavailable');
 await edit(x,root,{status:'active'});observed=(await x.service.observationDetail('reader',o.id)).observation;assert.equal(observed.state,'paused');
 const resumed=await x.service.changeObservation('operator',o.id,{action:'restore',expected_version:observed.version,expected_config_version:x.config.config_version,reason:'显式恢复'},randomUUID());
 const revised=(await edit(x,x.config,{scope_definition:'澄清美元单位范围，不包括融资、证券与衍生品。'})).config;assert.equal(revised.identity_version,'2');
 const d=await x.service.observationDetail('reader',o.id);assert.equal(d.observation.state_reason,'definition_changed');assert.equal(d.adopted_snapshot.id,x.config.current_snapshot_id);assert.equal(d.history.length,4);
 await assert.rejects(()=>x.save({...values(revised),scope_definition:'另一个身份',expected_config_version:revised.config_version,reason:'身份变化'},revised.id),code('M4_NEW_IDENTITY_REQUIRED'));
 const rootNow=(await x.service.configDetail('reader',root.id)).config;
 const child=(await x.save({...directory('子目录'),parent_id:root.id})).config;
 await assert.rejects(()=>edit(x,rootNow,{parent_id:child.id}),code('M4_TREE_CYCLE'));
 const sorted=(await edit(x,revised,{sort_order:'20'})).config;assert.equal(sorted.identity_version,'2');
 const ended=await x.service.changeObservation('operator',o.id,{action:'end',expected_version:d.observation.version,reason:'结束关注'},randomUUID());await edit(x,sorted,{status:'disabled'});assert.equal((await x.service.observationDetail('reader',o.id)).observation.version,ended.observation.version);
 assert.equal(resumed.observation.id,o.id);
}finally{await x.close();}});
test('AC25/26/30：职责隔离，权限撤销后不能重放回执，DML与快照历史不可变',async()=>{const x=await setup();try{
 await assert.rejects(()=>add(x,x.config,'configurer'),code('FORBIDDEN'));await assert.rejects(()=>x.service.save('observer',directory('无权'),'no'),code('FORBIDDEN'));
 await add(x,x.config,'other','replay');await x.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='other'");await assert.rejects(()=>add(x,x.config,'other','replay'),code('FORBIDDEN'));
 for(const table of ['financial_object_config','shared_observation','target_config_mapping','m4_history'])await assert.rejects(()=>x.role.query(`DELETE FROM information.${table}`),/permission denied/);
 await grantIngestionRoles(x.db);await assert.rejects(()=>x.role.query("UPDATE information.financial_object_config SET name='越权'"),/permission denied/);
 await assert.rejects(()=>x.db.query("UPDATE information.definition_snapshots SET digest='tampered' WHERE id=$1",[x.config.current_snapshot_id]),/M4_HISTORY_IMMUTABLE/);
 await assert.rejects(()=>x.db.query('UPDATE information.financial_object_config SET current_snapshot_id=$1,config_version=config_version+1 WHERE id=$2',[x.root.current_snapshot_id,x.config.id]),/M4_SNAPSHOT_MISMATCH/);
 const before=await inspectM4Migration(x.db);assert.deepEqual((await applyM4Migration(x.db)).counts,before.counts);assert.equal((await x.service.configs('reader')).total,2);
}finally{await x.close();}});
test('AC16–22/27/28：人工映射、全来源权限、历史事件去重和Target版本即时失效',async()=>{const x=await setup();try{
 const o=(await add(x)).observation;const t=(await x.db.query("INSERT INTO information.target(target_name,aliases,categories,jurisdiction,scope_definition,is_active) VALUES('美元',ARRAY['USD'],$1,'美国','美元货币单位，不含融资',true) RETURNING *",[JSON.stringify(x.config.categories)])).rows[0];
 await x.db.query("INSERT INTO information.event_target(event_id,target_id,relation_note) VALUES($1,$2,'直接事实关联')",[x.e,t.id]);
 const input={config_id:x.config.id,target_id:t.id,expected_config_version:x.config.config_version,expected_target_version:'1',decision:'approve' as const,identity_confirmed:true,reason:'人工逐项核对范围和辖区相同'};
 await assert.rejects(()=>x.service.map('operator',{...input,identity_confirmed:false},randomUUID()),code('M4_IDENTITY_UNCONFIRMED'));
 await x.service.map('operator',input,randomUUID());let detail=await x.service.observationDetail('reader',o.id);assert.equal(detail.events?.total,1);assert.equal(detail.events?.items[0].id,x.e);
 const material=(await x.db.query("WITH s AS(INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES('private-source','受限','','{}','ACTIVE') RETURNING id) INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) SELECT id,'private','{}',repeat('b',64),'test' FROM s RETURNING id")).rows[0].id;
 await transaction(x.db,async tx=>{const segment=randomUUID();await tx.query("INSERT INTO infomation.ingestion_material_segments VALUES($1,$2,0,'受限证据','{}')",[material,segment]);await tx.query("INSERT INTO information.fact_material(fact_id,material_id,relation_role) VALUES($1,$2,'supporting')",[x.f,material]);await tx.query("INSERT INTO information.fact_evidence(fact_id,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$2,1,repeat('b',64),$3,0,4,'受限证据','supporting')",[x.f,material,segment]);});
 detail=await x.service.observationDetail('reader',o.id);assert.equal(detail.events?.total,0);assert.ok(!JSON.stringify(detail).includes(x.e));assert.equal((await x.service.observations('reader')).items[0]!.event_count,0);assert.equal((await x.service.observationDetail('operator',o.id)).events?.total,1);
 await x.service.changeObservation('operator',o.id,{action:'pause',expected_version:o.version,reason:'暂停后仍可读'},randomUUID());assert.equal((await x.service.observationDetail('operator',o.id)).events?.total,1);
 await x.db.query('UPDATE information.target SET definition_version=definition_version+1 WHERE id=$1',[t.id]);assert.equal((await x.service.observationDetail('operator',o.id)).dynamics_state,'stale');assert.equal((await x.service.observationDetail('operator',o.id)).events,null);
 await x.service.map('operator',{...input,expected_target_version:'2'},randomUUID());assert.equal((await x.service.observationDetail('operator',o.id)).events?.total,1);
 await x.service.map('operator',{...input,expected_target_version:'2',decision:'conflict',identity_confirmed:false,reason:'发现范围存在待核对冲突'},randomUUID());assert.equal((await x.service.observationDetail('operator',o.id)).events,null);
}finally{await x.close();}});

test('批次摘要绑定完整输入，修改同key批次不会新增对象，撤权后重验',async()=>{const x=await setup();try{
 const second=(await x.save(object(x.root.id,'批次第二项'))).config;
 const first={config_id:x.config.id,expected_config_version:'1',reason:'批次原项'},extra={config_id:second.id,expected_config_version:'1',reason:'批次新增项'};
 assert.equal((await x.service.batch('operator',[first],'fixed-batch')).results[0]!.outcome,'added');
 await assert.rejects(()=>x.service.batch('operator',[first,extra],'fixed-batch'),code('IDEMPOTENCY_CONFLICT'));
 await assert.rejects(()=>x.service.batch('operator',[{...first,reason:'换说明'}],'fixed-batch'),code('IDEMPOTENCY_CONFLICT'));
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.shared_observation')).rows[0].n,1);
 await x.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='operator'");
 await assert.rejects(()=>x.service.batch('operator',[first],'fixed-batch'),code('FORBIDDEN'));
}finally{await x.close();}});

test('规范化说明贯穿配置快照、映射与观察历史；错误两端不能撤销其他映射',async()=>{const x=await setup();try{
 const created=(await x.save({...object(x.root.id,'带空白说明'),reason:' \n 新建说明 \n '})).config;
 assert.equal(snapshotPayload((await x.service.configDetail('reader',created.id)).snapshots[0]!).change.reason,'新建说明');
 const t=(await x.db.query("INSERT INTO information.target(target_name,categories,jurisdiction,scope_definition) VALUES('美元',$1,'美国','美元单位') RETURNING *",[JSON.stringify(created.categories)])).rows[0];
 const input={config_id:created.id,target_id:t.id,expected_config_version:'1',expected_target_version:'1',decision:'approve' as const,identity_confirmed:true,reason:' \n 人工核定 \n '};
 const mapped=(await x.service.map('operator',input,'normalize-map')).mapping;assert.equal(mapped.reason,'人工核定');
 const detail=await x.service.configDetail('reader',created.id);assert.equal(snapshotPayload(detail.mappings[0]!.target_snapshot!).target_name,'美元');assert.equal(snapshotPayload(detail.mappings[0]!.target_snapshot!).jurisdiction,'美国');assert.equal(snapshotPayload(detail.mappings[0]!.target_snapshot!).scope_definition,'美元单位');
 await assert.rejects(()=>x.service.map('operator',{...input,config_id:x.config.id,decision:'revoke',mapping_id:mapped.id,expected_version:'1'},'wrong-config'),code('M4_VERSION_CONFLICT'));
 const t2=(await x.db.query("INSERT INTO information.target(target_name,categories,jurisdiction,scope_definition) VALUES('另一美元',$1,'美国','另一范围') RETURNING *",[JSON.stringify(created.categories)])).rows[0];
 await assert.rejects(()=>x.service.map('operator',{...input,target_id:t2.id,decision:'revoke',mapping_id:mapped.id,expected_version:'1'},'wrong-target'),code('M4_VERSION_CONFLICT'));
 assert.equal((await x.service.configDetail('reader',created.id)).mappings[0]!.version,'1');assert.equal((await x.service.configDetail('reader',created.id)).mapping_history.length,1);
 const o=(await x.service.add('operator',{config_id:created.id,expected_config_version:'1',reason:' \n 添加说明 \n '},'normalize-add')).observation;
 const revision={...values(created),scope_definition:'同一美元的范围澄清',expected_config_version:'1',same_identity:true,reason:' \n 修订说明 \n '};
 const preview=await x.service.preview('operator',created.id,revision);await x.save({...revision,impact_token:preview.impact_token},created.id);
 const after=await x.service.configDetail('reader',created.id);assert.equal(snapshotPayload(after.snapshots[0]!).change.reason,'修订说明');assert.equal(after.mappings[0]!.reason,'修订说明');assert.equal(after.mapping_history[0]!.reason,'修订说明');assert.equal((await x.service.observationDetail('reader',o.id)).history[0]!.reason,'修订说明');
}finally{await x.close();}});

test('已核定且有动态的口径修订原子暂停观察、保留旧采用定义并使映射待核定',async()=>{const x=await setup();try{
 const o=(await add(x)).observation,t=(await x.db.query("INSERT INTO information.target(target_name,categories,jurisdiction,scope_definition) VALUES('美元',$1,'美国','美元货币单位') RETURNING *",[JSON.stringify(x.config.categories)])).rows[0];
 await x.db.query("INSERT INTO information.event_target(event_id,target_id,relation_note) VALUES($1,$2,'直接关联')",[x.e,t.id]);
 const m=(await x.service.map('operator',{config_id:x.config.id,target_id:t.id,expected_config_version:'1',expected_target_version:'1',decision:'approve',identity_confirmed:true,reason:'人工核定'},'combined-map')).mapping;
 assert.equal((await x.service.observationDetail('reader',o.id)).events!.total,1);
 const input={...values(x.config),scope_definition:'澄清同一美元货币单位，排除融资市场及资产',expected_config_version:'1',same_identity:true,reason:'口径澄清联动'};
 const impact=await x.service.preview('operator',x.config.id,input);assert.deepEqual(impact.mappings.map(m=>m.id),[m.id]);assert.deepEqual(impact.observations.map(o=>o.id),[o.id]);
 await x.save({...input,impact_token:impact.impact_token},x.config.id);
 const result=await x.service.observationDetail('reader',o.id),config=await x.service.configDetail('reader',x.config.id);
 assert.equal(result.observation.state,'paused');assert.equal(result.observation.state_reason,'definition_changed');assert.equal(result.adopted_snapshot.id,x.config.current_snapshot_id);assert.equal(result.adopted_snapshot.payload.config.scope_definition,x.config.scope_definition);assert.equal(result.events,null);assert.equal(result.dynamics_state,'pending');
 assert.equal(config.mappings[0]!.id,m.id);assert.equal(config.mappings[0]!.state,'pending');assert.equal(config.mappings[0]!.config_snapshot_id,x.config.current_snapshot_id);assert.equal(config.mapping_history.length,2);assert.equal(config.mapping_history[0]!.before_value.state,'approved');assert.equal(config.mapping_history[0]!.after_value.state,'pending');assert.equal(result.history.length,2);
 assert.equal((await x.role.query('SELECT current_user')).rows[0].current_user,'riskhot_api');
}finally{await x.close();}});
