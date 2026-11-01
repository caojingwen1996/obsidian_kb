import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './f02-fixture.js';
import {applyF02Migration} from '../platform/f02-migration.js';
import {transaction} from '../platform/db.js';
import {eventDigest} from '../event-management/snapshot.js';
import {saveAssociationSnapshot,type AssociationPayload} from '../event-management/associations.js';
async function prepared(){const x=await fixture(true);await applyF02Migration(x.db);
 const other=await transaction(x.db,async tx=>{
  const e=(await tx.query("INSERT INTO information.event(title,description,subject,action,event_status) VALUES('另一事件','第二行动','主体','行动','announced') RETURNING id")).rows[0].id;
  const f=(await tx.query("INSERT INTO information.fact(title,description,subject,action,event_status,event_id,event_relation_role,event_relation_note,event_assigned_at) VALUES('另一事实','第二行动','主体','行动','announced',$1,'initial','初始事实',now()) RETURNING id",[e])).rows[0].id;
  await tx.query("INSERT INTO information.fact_material(fact_id,material_id,relation_role) VALUES($1,$2,'supporting')",[f,x.m]);
  await tx.query("INSERT INTO information.fact_evidence(fact_id,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role) SELECT $1,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role FROM information.fact_evidence WHERE fact_id=$2",[f,x.f]);return {e,f};
 });
 const p:AssociationPayload={scope:'受控范围',window:{start:'2026-01-01',end:'2026-12-31'},retrieval:{complete:true,truncated:false,digest:'catalog'},members:[{event_id:x.e,fact_ids:[x.f],basis_digest:await eventDigest(x.db,x.e)},{event_id:other.e,fact_ids:[other.f],basis_digest:await eventDigest(x.db,other.e)}],groups:[{local_ref:'g1',event_ids:[x.e,other.e],dimensions:{same_entity:'原文同主体',same_variable:'受控变量',same_direction:'方向一致',same_magnitude:'数量可比',same_time_window:'同窗'},continuity:'受控连续关系',basis:[{event_id:x.e,fact_id:x.f},{event_id:other.e,fact_id:other.f}]}],unresolved:[],coverage:{complete:true,reason:'两事件完整核对'}};
 const input={event_id:x.e,actor:'operator',operation_key:randomUUID(),manifest_ref:'f02-eight-step-v1',input_digest:'input',payload:p};return {...x,other,input};}
test('关联真实保存与消息同事务，确认丢失后按原快照幂等；事件变化不改历史消息',async()=>{const x=await prepared();try{
 const first=await transaction(x.db,tx=>saveAssociationSnapshot(tx,x.input));
 await x.db.query("UPDATE information.event SET description='事件后续发生变化' WHERE id=$1",[x.e]);
 assert.deepEqual(await transaction(x.db,tx=>saveAssociationSnapshot(tx,x.input)),first);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event_association_snapshots')).rows[0].n,1);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event_association_members')).rows[0].n,2);
 assert.equal((await x.db.query("SELECT count(*)::int n FROM platform.messages WHERE message_type='event.association.saved.v1'")).rows[0].n,1);
 await assert.rejects(()=>transaction(x.db,tx=>saveAssociationSnapshot(tx,{...x.input,input_digest:'different'})),/IDEMPOTENCY_CONFLICT/);
 await x.db.query("UPDATE platform.actors SET source_keys=ARRAY[]::text[] WHERE subject='operator'");
 await assert.rejects(()=>transaction(x.db,tx=>saveAssociationSnapshot(tx,x.input)),/FORBIDDEN/);
}finally{await x.close();}});
test('缺触发成员、错误事件依据、消息失败不产生有效快照',async()=>{const x=await prepared();try{
 await assert.rejects(()=>transaction(x.db,tx=>saveAssociationSnapshot(tx,{...x.input,payload:{...x.input.payload,members:x.input.payload.members.slice(1),groups:[]}})),/ASSOCIATION_TRIGGER_REQUIRED/);
 await assert.rejects(()=>transaction(x.db,tx=>saveAssociationSnapshot(tx,{...x.input,payload:{...x.input.payload,members:x.input.payload.members.map(m=>({...m,basis_digest:'stale'}))}})),/ASSOCIATION_BASIS_CHANGED/);
 await x.db.query("CREATE FUNCTION platform.inject_association_message_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'MESSAGE_FAILED';END $$;CREATE TRIGGER inject_assoc_message BEFORE INSERT ON platform.messages FOR EACH ROW EXECUTE FUNCTION platform.inject_association_message_failure()");
 await assert.rejects(()=>transaction(x.db,tx=>saveAssociationSnapshot(tx,x.input)),/MESSAGE_FAILED/);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.event_association_snapshots')).rows[0].n,0);
}finally{await x.close();}});
