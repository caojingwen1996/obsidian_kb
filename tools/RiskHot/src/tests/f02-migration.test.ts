import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {eventSnapshot} from '../event-management/snapshot.js';
import {f02Storage} from '../event-management/storage-layout.js';
import {inspectF02Migration,applyF02Migration} from '../platform/f02-migration.js';

import {fixture} from './f02-fixture.js';
for(const target of [false,true])test(`schema5${target?'+007':''}增量迁移保留数据、幂等且新检查点可写`,async()=>{
 const x=await fixture(target);try{
 assert.equal((await f02Storage(x.db)).current,false);
 const oldSnapshot=await eventSnapshot(x.db,x.e);
 const before=await inspectF02Migration(x.db);assert.deepEqual(before.anomalies,[]);
 const migrated=await applyF02Migration(x.db);
 const snapshot=await eventSnapshot(x.db,x.e);assert.deepEqual(snapshot.evidence,oldSnapshot.evidence);assert.equal(snapshot.facts.length,oldSnapshot.facts.length);assert.equal((await f02Storage(x.db)).current,true);assert.ok(migrated.applied_versions.includes(8));
 assert.equal((await x.db.query("SELECT to_regclass('information.event_fact') AS t")).rows[0].t,null);
 assert.equal((await x.db.query('SELECT event_id,object,event_relation_note FROM information.fact WHERE id=$1',[x.f])).rows[0].event_id,x.e);
 assert.equal((await x.db.query('SELECT object FROM information.fact WHERE id=$1',[x.f])).rows[0].object,null);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.fact_material')).rows[0].n,1);
 await x.db.query("INSERT INTO information.candidate_step_results(candidate_id,generation,node_key,state,manifest_ref,input_digest,context) VALUES($1,1,'target-identify','running','manifest-v1','test','{}')",[x.c]);
 assert.equal((await x.db.query("SELECT node_key FROM information.candidate_step_results WHERE step_no=2")).rows[0].node_key,'legacy-step-2');
 await x.db.query("INSERT INTO information.candidate_step_results(candidate_id,step_no,generation,input_digest,context,state) VALUES($1,2,1,'legacy-upsert','{}','pending') ON CONFLICT(candidate_id,step_no,generation) DO UPDATE SET input_digest=EXCLUDED.input_digest",[x.c]);
 assert.equal((await x.db.query("SELECT input_digest FROM information.candidate_step_results WHERE candidate_id=$1 AND node_key='legacy-step-2'",[x.c])).rows[0].input_digest,'legacy-upsert');
 assert.deepEqual((await applyF02Migration(x.db)).counts,(await inspectF02Migration(x.db)).counts);
 await assert.rejects(()=>x.db.query("UPDATE information.fact SET event_relation_note=NULL WHERE id=$1",[x.f]));
 await assert.rejects(()=>x.db.query('DELETE FROM information.fact_evidence WHERE fact_id=$1',[x.f]),/FACT_EVIDENCE_REQUIRED/);
 }finally{await x.close();}
});
test('迁移末尾故障回滚DDL和所有归属',async()=>{const x=await fixture(false);try{
 await assert.rejects(()=>applyF02Migration(x.db,{beforeCommit:async()=>{throw new Error('INJECTED_FAILURE');}}),/INJECTED_FAILURE/);
 assert.equal((await x.db.query("SELECT to_regclass('information.event_fact') AS t")).rows[0].t,'information.event_fact');
 assert.equal((await inspectF02Migration(x.db)).applied_versions.includes(8),false);
}finally{await x.close();}});

test('跨事件观测依据、反向证据破坏及无输入依据计算均被数据库拒绝',async()=>{const x=await fixture(true);try{
 await applyF02Migration(x.db);
 const target=randomUUID(),variable=randomUUID();
 const definition=(await x.db.query("INSERT INTO information.definition_snapshots(kind,definition_id,definition_version,payload,digest) VALUES('variable',$1,'1','{}','test') RETURNING id",[variable])).rows[0].id;
 await x.db.query("INSERT INTO information.event_target(event_id,target_id,relation_note) VALUES($1,$2,'直接关联')",[x.e,target]);
 await x.db.query("INSERT INTO information.event_target_variable(event_id,target_id,variable_id,relation_type,change_direction,impact_status,description) VALUES($1,$2,$3,'direct_change','increase','effective','取值')",[x.e,target,variable]);
 await x.db.query('INSERT INTO information.event_variable_definition VALUES($1,$2,$3,$4)',[x.e,target,variable,definition]);
 const fe=(await x.db.query('SELECT * FROM information.fact_evidence WHERE fact_id=$1',[x.f])).rows[0];
 const basis=[{fact_id:x.f,fact_evidence_id:fe.id,material_id:x.m,version:1,content_digest:'a'.repeat(64),input_ref:null}];
 const insert=(evidence= basis,method='extracted',derivation:unknown=null)=>x.db.query("INSERT INTO information.variable_observation_records(event_id,target_id,variable_id,definition_snapshot_id,value,value_nature,value_time,acquisition_method,derivation_basis,basis) VALUES($1,$2,$3,$4,'75','actual',$5,$6,$7,$8) RETURNING id",[x.e,target,variable,definition,{kind:'unknown',precision:'unknown',start:null,end:null,raw_text:null},method,derivation,JSON.stringify(evidence)]);
 const first=(await insert()).rows[0];assert.ok(first.id);
 await assert.rejects(()=>insert([{...basis[0]!,fact_id:randomUUID()}]),/OBSERVATION_BASIS_MISMATCH/);
 await assert.rejects(()=>insert(basis,'calculated',{method:'sum',inputs:[]}),/OBSERVATION_INPUT_INVALID|OBSERVATION_DERIVATION_REQUIRED/);
 await assert.rejects(()=>x.db.query("UPDATE information.fact_evidence SET material_digest=repeat('b',64) WHERE id=$1",[fe.id]));
 assert.equal((await x.db.query('SELECT basis FROM information.variable_observation_records WHERE id=$1',[first.id])).rows[0].basis[0].fact_evidence_id,fe.id);
}finally{await x.close();}});
test('旧多归属与孤立证据在迁移前明确拒绝，原数据保留',async()=>{const x=await fixture(false);try{
 await x.db.query('ALTER TABLE information.event_fact DROP CONSTRAINT event_fact_fact_id_key');
 await x.db.query('ALTER TABLE information.event_fact DROP CONSTRAINT event_fact_event_id_fact_id_key').catch(()=>{});
 await x.db.query("WITH e AS (INSERT INTO information.event(title,description,subject,action,event_status) VALUES('另一个','说明','主体','行动','announced') RETURNING id) INSERT INTO information.event_fact SELECT e.id,$1,'initial','重复归组' FROM e",[x.f]);
 assert.ok((await inspectF02Migration(x.db)).anomalies.includes('MULTIPLE_FACT_OWNERS'));
 await x.db.query('ALTER TABLE information.fact_evidence DISABLE TRIGGER ALL');
 await x.db.query('UPDATE information.fact_evidence SET information_id=$1',[randomUUID()]);
 assert.ok((await inspectF02Migration(x.db)).anomalies.includes('ORPHAN_EVIDENCE'));
 await assert.rejects(()=>applyF02Migration(x.db),/ORPHAN_EVIDENCE/);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.fact_evidence')).rows[0].n,1);
}finally{await x.close();}});

test('schema8当前事件接口查询与来源撤权结果一致',async()=>{const x=await fixture(true);let app:import('fastify').FastifyInstance|undefined;try{
 await applyF02Migration(x.db);
 await x.db.query("UPDATE platform.actors SET subject='riskhot-local-operator' WHERE subject='operator'").catch(()=>{});
 await x.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','event_submit'],ARRAY['*']) ON CONFLICT DO NOTHING");
 const {ExecutionStore}=await import('../information-ingestion/processing/execution.js');
 const {ArtifactStore}=await import('../platform/artifacts.js');
 const {buildServer}=await import('../runtime/server.js');
 app=await buildServer(new ExecutionStore(x.db,new ArtifactStore('/tmp/riskhot-f02-unused')),{mode:'local',origin:'http://127.0.0.1:18081'});
 const headers={host:'127.0.0.1:18081',origin:'http://127.0.0.1:18081'};
 const list=await app.inject({url:'/api/v1/events',headers});assert.equal(list.statusCode,200,list.body);assert.equal(list.json().items.length,1);
 assert.equal((await app.inject({url:`/api/v1/events/${x.e}`,headers})).statusCode,200);
 await x.db.query("UPDATE platform.actors SET source_keys=ARRAY[]::text[] WHERE subject='riskhot-local-operator'");
 assert.equal((await app.inject({url:`/api/v1/events/${x.e}`,headers})).statusCode,403);
 assert.equal((await app.inject({url:'/api/v1/events',headers})).json().items.length,0);
}finally{await app?.close();await x.close();}});
