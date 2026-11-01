import {enqueueBusinessJob} from '../platform/business-queue.js';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
import {eventDigest} from './snapshot.js';
export interface AssociationPayload {scope:string;window:{start:string;end:string};retrieval:{complete:boolean;truncated:boolean;digest:string};members:{event_id:string;fact_ids:string[];basis_digest:string}[];groups:{local_ref:string;event_ids:string[];dimensions:{same_entity:string;same_variable:string;same_direction:string;same_magnitude:string;same_time_window:string};continuity:string;basis:{event_id:string;fact_id:string}[]}[];unresolved:string[];coverage:{complete:boolean;reason:string}}
const fail=(code:string):never=>{throw new DomainError(code,422);};
export function validateAssociationSnapshot(value:unknown):AssociationPayload{
 if(!value||typeof value!=='object')fail('ASSOCIATION_OUTPUT_INVALID');
 const p=value as AssociationPayload;
 if(!p.scope?.trim()||!p.window?.start||!p.window.end||p.window.start>p.window.end||!Array.isArray(p.members)||!Array.isArray(p.groups)||!Array.isArray(p.unresolved)||!p.coverage?.reason?.trim())fail('ASSOCIATION_OUTPUT_INVALID');
 if(!p.retrieval?.complete||p.retrieval.truncated||!p.coverage.complete)fail('ASSOCIATION_COVERAGE_INVALID');
 if(new Set(p.members.map(m=>m.event_id)).size!==p.members.length||p.members.some(m=>!m.event_id||!m.basis_digest||!Array.isArray(m.fact_ids)||!m.fact_ids.length))fail('ASSOCIATION_REFERENCE_INVALID');
 const refs=new Set<string>();for(const g of p.groups){
  if(!g.local_ref?.trim()||refs.has(g.local_ref)||!g.continuity?.trim()||!g.dimensions||Object.keys(g.dimensions).sort().join()!==['same_entity','same_variable','same_direction','same_magnitude','same_time_window'].sort().join()||Object.values(g.dimensions).some(v=>typeof v!=='string'||!v.trim()))fail('ASSOCIATION_OUTPUT_INVALID');refs.add(g.local_ref);
  if(!Array.isArray(g.event_ids)||g.event_ids.length<2||new Set(g.event_ids).size!==g.event_ids.length||g.event_ids.some(id=>!p.members.some(m=>m.event_id===id))||!Array.isArray(g.basis)||g.event_ids.some(id=>!g.basis.some(b=>b.event_id===id))||g.basis.some(b=>!g.event_ids.includes(b.event_id)||!p.members.find(m=>m.event_id===b.event_id)?.fact_ids.includes(b.fact_id)))fail('ASSOCIATION_REFERENCE_INVALID');
 }
 return p;
}
export interface AssociationSnapshotInput {event_id:string;actor:string;operation_key:string;manifest_ref:string;input_digest:string;payload:AssociationPayload;supersedes_id?:string|null}
export async function saveAssociationSnapshot(tx:PoolClient,input:AssociationSnapshotInput):Promise<{snapshot_id:string;message_id:string}>{
 const p=validateAssociationSnapshot(input.payload);
 await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,3))',[input.operation_key]);
 const old=(await tx.query('SELECT * FROM information.event_association_snapshots WHERE operation_key=$1',[input.operation_key])).rows[0];
 await tx.query('SELECT platform.lock_permission_epoch()');
 const actor=(await tx.query('SELECT * FROM platform.actors WHERE subject=$1',[input.actor])).rows[0];if(!actor||!actor.permissions.includes('event_submit')||!actor.permissions.includes('read'))throw new DomainError('FORBIDDEN',403);
 if(!p.members.some(m=>m.event_id===input.event_id))throw new DomainError('ASSOCIATION_TRIGGER_REQUIRED',422);
 const replayPayload={schema_version:'riskhot.event-association.v1',...p};
 if(old&&(old.input_digest!==input.input_digest||old.event_id!==input.event_id||old.manifest_ref!==input.manifest_ref||digest(old.payload)!==digest(replayPayload)||old.supersedes_id!==(input.supersedes_id??null)))throw new DomainError('IDEMPOTENCY_CONFLICT',409);
 const ids=[...new Set([input.event_id,...p.members.map(m=>m.event_id)])].sort();
 for(const id of ids){
  if(!(await tx.query('SELECT id FROM information.event WHERE id=$1 FOR UPDATE',[id])).rowCount)throw new DomainError('FORMAL_EVENT_REQUIRED',409);
  const sources=(await tx.query('SELECT DISTINCT s.catalog_key FROM information.fact f JOIN information.fact_material fm ON fm.fact_id=f.id JOIN infomation.ingestion_material m ON m.id=fm.material_id JOIN m1.sources s ON s.id=m.source_id WHERE f.event_id=$1',[id])).rows;
  for(const source of sources){if(!(await tx.query("SELECT platform.authorize_actor($1,'read',$2) allowed",[input.actor,source.catalog_key])).rows[0].allowed||id===input.event_id&&!(await tx.query("SELECT platform.authorize_actor($1,'event_submit',$2) allowed",[input.actor,source.catalog_key])).rows[0].allowed)throw new DomainError('FORBIDDEN',403);}
  const member=p.members.find(m=>m.event_id===id);if(!old&&member&&await eventDigest(tx,id)!==member.basis_digest)throw new DomainError('ASSOCIATION_BASIS_CHANGED',409);
  if(!old&&member){const facts=(await tx.query('SELECT id FROM information.fact WHERE event_id=$1 AND id=ANY($2::uuid[])',[id,member.fact_ids])).rows;if(facts.length!==new Set(member.fact_ids).size)throw new DomainError('ASSOCIATION_REFERENCE_INVALID',422);}
 }
 if(old){const m=(await tx.query("SELECT id FROM platform.messages WHERE owner_id=$1 AND message_type='event.association.saved.v1'",[old.id])).rows[0];if(!m)throw new DomainError('ASSOCIATION_RECEIPT_MISSING',409);return {snapshot_id:old.id,message_id:m.id};}
 if(input.supersedes_id&&!(await tx.query('SELECT id FROM information.event_association_snapshots WHERE id=$1 AND event_id=$2',[input.supersedes_id,input.event_id])).rowCount)throw new DomainError('ASSOCIATION_REFERENCE_INVALID',422);
 const id=randomUUID(),message=randomUUID(),payload={schema_version:'riskhot.event-association.v1',...p};
 await tx.query('INSERT INTO information.event_association_snapshots(id,event_id,input_digest,manifest_ref,operation_key,payload,supersedes_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,input.event_id,input.input_digest,input.manifest_ref,input.operation_key,payload,input.supersedes_id??null]);
 for(const m of p.members)await tx.query('INSERT INTO information.event_association_members(snapshot_id,event_id,basis_digest) VALUES($1,$2,$3)',[id,m.event_id,m.basis_digest]);
 const packet={schema_version:'riskhot.event-association-message.v1',snapshot_id:id,event_id:input.event_id,content:payload};
 await tx.query("INSERT INTO platform.messages(id,message_type,owner_id,event_id,payload,payload_digest,state) VALUES($1,'event.association.saved.v1',$2,$3,$4,$5,'pending')",[message,id,input.event_id,packet,digest(packet)]);
 if((await tx.query("SELECT to_regclass('platform.task_runs') AS t")).rows[0].t)await enqueueBusinessJob(tx,{task_type:'deliveries.send',payload_version:1,run_id:randomUUID(),owner_module:'F02',owner_ref:{id:message},operation_key:`delivery/${message}`,execution_generation:1,input_digest:digest(packet),manifest_ref:'event-delivery-v2',correlation_id:randomUUID(),causation_id:null,trigger_kind:'association-saved',payload:{message_id:message}});
 return {snapshot_id:id,message_id:message};
}
