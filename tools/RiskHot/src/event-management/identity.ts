import {eventDigest} from './snapshot.js';
import {transaction} from '../platform/db.js';import {DomainError} from '../platform/types.js';import type {Repository} from '../information-ingestion/processing/repository.js';import {candidate,processing,permission,guard,candidateGuard,materialTable} from './store.js';import {digest,type IdentityProposal} from './contracts.js';
export interface IdentityContext {retrieval_snapshot_id:string;catalog_epoch:number;permission_epoch:number;manifest_digest:string;coverage_status:'complete'|'truncated';retrieval_truncated:boolean;events:{id:string;content_digest:string;title:string;description:string;event_status:string;subject:string|null;action:string|null}[]}
export async function prepareIdentity(repo:Repository,candidateId:string,generation:number):Promise<IdentityContext>{
 return transaction(repo.db,async tx=>{const pre=await candidate(tx,candidateId);const p=await processing(tx,pre.processing_id);await permission(repo,tx,p.version_id,p.actor,'event_submit',true);await processing(tx,p.id,true);const c=await candidate(tx,candidateId,true);guard(p);await candidateGuard(tx,c,generation);
  const epoch=Number((await tx.query("SELECT catalog_epoch FROM information.event_identity_catalog WHERE scope_key='l0-event-catalog' FOR SHARE")).rows[0]?.catalog_epoch);if(!Number.isFinite(epoch))throw new DomainError('IDENTITY_CATALOG_REQUIRED',503);
  const permissionEpoch=Number((await tx.query('SELECT epoch FROM platform.permission_epochs WHERE id')).rows[0].epoch);
  const escaped=c.payload.action.replace(/[\\%_]/g,'\\$&');
  const events=(await tx.query<IdentityContext['events'][number]>(`SELECT e.id,e.title,e.description,e.event_status,e.subject,e.action FROM information.event e WHERE (e.subject=$2 OR e.action=$3 OR e.title ILIKE $4 ESCAPE '\\') AND NOT EXISTS(SELECT 1 FROM information.event_fact es JOIN information.fact_information fi ON fi.fact_id=es.fact_id JOIN ${await materialTable(tx)} m ON m.id=fi.information_id JOIN m1.sources s ON s.id=m.source_id JOIN platform.actors a ON a.subject=$1 WHERE es.event_id=e.id AND NOT('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))) ORDER BY e.updated_at,e.id LIMIT 101`,[p.actor,c.payload.subject,c.payload.action,`%${escaped}%`])).rows;
  for(const event of events)event.content_digest=await eventDigest(tx,event.id);
  const manifest={events:events.slice(0,100),rule:'subject-action-literal-title-v1',actor:p.actor,source_scope:(await tx.query('SELECT source_keys FROM platform.actors WHERE subject=$1',[p.actor])).rows[0].source_keys,coverage_status:events.length>100?'truncated':'complete'};
  const hash=digest(manifest);const row=(await tx.query("INSERT INTO information.event_identity_snapshots(candidate_id,generation,scope_key,catalog_epoch,permission_epoch,manifest,manifest_digest,retrieval_truncated,coverage_status) VALUES($1,$2,'l0-event-catalog',$3,$4,$5,$6,$7,$8) RETURNING id",[c.id,c.proposal_generation,epoch,permissionEpoch,manifest,hash,events.length>100,manifest.coverage_status])).rows[0];
  return {retrieval_snapshot_id:row.id,catalog_epoch:epoch,permission_epoch:permissionEpoch,manifest_digest:hash,coverage_status:manifest.coverage_status as 'complete'|'truncated',retrieval_truncated:events.length>100,events:manifest.events};
 });
}
export function validateIdentity(context:IdentityContext,proposal:IdentityProposal):IdentityProposal{
 if(proposal.decision==='NEW'&&(context.retrieval_truncated||context.coverage_status!=='complete'))throw new DomainError('IDENTITY_COVERAGE_INCOMPLETE',409);
 if(proposal.decision==='REUSE'&&!context.events.some(e=>e.id===proposal.matched_event_id))throw new DomainError('UNKNOWN_REFERENCE',422);
 if(proposal.decision!=='REUSE'&&proposal.matched_event_id!==null)throw new DomainError('IDENTITY_INVALID',422);return proposal;
}
