import type {PoolClient} from 'pg';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {transaction} from '../platform/db.js';
import {DomainError} from '../platform/types.js';
import {f02Storage} from './storage-layout.js';
import {targetCategories,type TargetDefinition} from './target-identity-contracts.js';

export interface TargetQuery {q?:string;category?:string;status?:'all'|'active'|'inactive';offset?:string;limit?:string}
function paging(query:TargetQuery){
 const offset=Number(query.offset??0),limit=Number(query.limit??20);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new DomainError('PAGINATION_INVALID',400);
 return {offset,limit};
}
const page=(items:unknown[],total:number,offset:number,limit:number)=>({items,total,offset,limit,next_offset:offset+limit<total?offset+limit:null});
export class TargetQueries {
 constructor(private repo:Repository){}
 private async access(tx:PoolClient,actor:string){
  await tx.query('SELECT platform.lock_permission_epoch()');
  await this.repo.authorize(actor,'read',undefined,tx);
 }
 private async controls(tx:PoolClient,actor:string){
  const can_manage=Boolean((await tx.query("SELECT platform.authorize_actor($1,'event_review',NULL) allowed",[actor])).rows[0].allowed);
  const retired=Boolean((await tx.query('SELECT 1 FROM platform.schema_versions WHERE version=10')).rowCount);
  return {can_manage:can_manage&&!retired,category_catalog:targetCategories};
 }
 private async visibleEvents(tx:PoolClient,actorParameter=1){
  const layout=await f02Storage(tx);
  // 数量和详情共用全部来源检查，混合来源事件不得通过单一可见来源泄漏。
  return `NOT EXISTS(SELECT 1 FROM ${layout.eventFacts} ef JOIN ${layout.factMaterials} fm ON fm.fact_id=ef.fact_id
   JOIN infomation.ingestion_material m ON m.id=fm.information_id JOIN m1.sources s ON s.id=m.source_id
   JOIN platform.actors a ON a.subject=$${actorParameter}
   WHERE ef.event_id=e.id AND NOT('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys)))`;
 }
 async list(actor:string,query:TargetQuery={}){
  const {offset,limit}=paging(query),q=query.q?.trim()??'',category=query.category??'',status=query.status??'all';
  if(q.length>200||category&&!Object.hasOwn(targetCategories,category)||!['all','active','inactive'].includes(status))throw new DomainError('TARGET_FILTER_INVALID',400);
  return transaction(this.repo.db,async tx=>{
   await this.access(tx,actor);const visible=await this.visibleEvents(tx,4);
   const search=q?'%'+q.replace(/[\\%_]/g,'\\$&')+'%':null;
   const values=[search,category||null,status==='all'?null:status==='active'];
   const where=`($1::text IS NULL OR t.target_name ILIKE $1 OR EXISTS(SELECT 1 FROM unnest(t.aliases) alias WHERE alias ILIKE $1))
    AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.categories) c WHERE c->>'primary_category'=$2))
    AND ($3::boolean IS NULL OR t.is_active=$3)`;
   const total=Number((await tx.query(`SELECT count(*)::int total FROM information.target t WHERE ${where}`,values)).rows[0].total);
   const items=(await tx.query<TargetDefinition>(`SELECT t.*,(SELECT count(*)::int FROM information.event_target et JOIN information.event e ON e.id=et.event_id WHERE et.target_id=t.id AND ${visible}) AS event_count
    FROM information.target t WHERE ${where} ORDER BY t.updated_at DESC,t.id LIMIT $5 OFFSET $6`,[...values,actor,limit,offset])).rows;
   return {...page(items,total,offset,limit),categories:Object.keys(targetCategories),...await this.controls(tx,actor)};
  });
 }
 async detail(actor:string,id:string,query:TargetQuery={}){
  const {offset,limit}=paging(query);
  return transaction(this.repo.db,async tx=>{
   await this.access(tx,actor);
   const target=(await tx.query('SELECT * FROM information.target WHERE id=$1',[id])).rows[0];
   if(!target)throw new DomainError('NOT_FOUND',404);
   const visible=await this.visibleEvents(tx),from=`FROM information.event_target et JOIN information.event e ON e.id=et.event_id WHERE et.target_id=$2 AND ${visible}`;
   const total=Number((await tx.query(`SELECT count(*)::int total ${from}`,[actor,id])).rows[0].total);
   const items=(await tx.query(`SELECT e.*,et.relation_note ${from} ORDER BY e.updated_at DESC,e.id LIMIT $3 OFFSET $4`,[actor,id,limit,offset])).rows;
   return {target,events:page(items,total,offset,limit),...await this.controls(tx,actor)};
  });
 }
}
