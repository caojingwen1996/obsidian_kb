import type {Repository} from '../information-ingestion/processing/repository.js';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
import {targetCategories,type TargetDefinition} from './target-identity-contracts.js';
export interface TargetDraft {target_name:string;aliases:string[];categories:TargetDefinition['categories'];jurisdiction:string|null;scope_definition:string;is_active:boolean;reason:string}
export interface TargetEdit extends TargetDraft {expected_version:number}
export class TargetCatalog {
 constructor(private repo:Repository){}
 private normalize(input:TargetDraft){
  const value={target_name:input.target_name.trim(),aliases:input.aliases.map(a=>a.trim()),categories:[...input.categories].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),jurisdiction:input.jurisdiction?.trim()||null,scope_definition:input.scope_definition.trim(),is_active:input.is_active};
  if(!value.target_name||!value.scope_definition||!input.reason?.trim()||!value.categories.length||value.categories.some(c=>!targetCategories[c.primary_category]?.includes(c.secondary_category))||new Set(value.categories.map(c=>JSON.stringify(c))).size!==value.categories.length)throw new DomainError('TARGET_DEFINITION_INVALID',422);
  if(value.aliases.some(a=>!a)||new Set(value.aliases).size!==value.aliases.length)throw new DomainError('TARGET_ALIASES_INVALID',422);
  return value;
 }
 async save(actor:string,input:TargetDraft|TargetEdit,key:string,id?:string){
  const value=this.normalize(input);
  return this.repo.action(actor,id?'target-catalog-edit':'target-catalog-create',key,{id:id??null,input},async tx=>{
   await tx.query('SELECT platform.lock_permission_epoch()');
   if((await tx.query('SELECT 1 FROM platform.schema_versions WHERE version=10')).rowCount)throw new DomainError('M4_MANUAL_TARGET_RETIRED',409);
   await this.repo.authorize(actor,'read',undefined,tx);await this.repo.authorize(actor,'event_review',undefined,tx);
  },async tx=>{
   // 与AI-07核定共用目录锁；人工维护不重跑模型，也不改历史定义快照。
   await tx.query('LOCK TABLE information.target IN SHARE ROW EXCLUSIVE MODE');
   const previous=id?(await tx.query('SELECT * FROM information.target WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
   if(id&&!previous)throw new DomainError('NOT_FOUND',404);
   if(previous&&previous.definition_version!==(input as TargetEdit).expected_version)throw new DomainError('TARGET_VERSION_CONFLICT',409);
   const duplicate=(await tx.query("SELECT id FROM information.target WHERE lower(btrim(target_name))=lower($1) AND btrim(scope_definition)=$2 AND jurisdiction IS NOT DISTINCT FROM $3 AND ($4::uuid IS NULL OR id<>$4) LIMIT 1",[value.target_name,value.scope_definition,value.jurisdiction,id??null])).rows[0];
   if(duplicate)throw new DomainError('TARGET_ALREADY_EXISTS',409);
   if(previous&&digest(value)===digest({target_name:previous.target_name,aliases:previous.aliases,categories:[...previous.categories].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),jurisdiction:previous.jurisdiction,scope_definition:previous.scope_definition,is_active:previous.is_active}))return {target:previous,changed:false};
   const values=[value.target_name,value.aliases,JSON.stringify(value.categories),value.jurisdiction,value.scope_definition,value.is_active];
   const target=(await tx.query(id?'UPDATE information.target SET target_name=$1,aliases=$2,categories=$3,jurisdiction=$4,scope_definition=$5,is_active=$6,definition_version=definition_version+1,updated_at=now() WHERE id=$7 RETURNING *':'INSERT INTO information.target(target_name,aliases,categories,jurisdiction,scope_definition,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',id?[...values,id]:values)).rows[0];
   await tx.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,$2,$3,$4)',[actor,id?'target-catalog-edited':'target-catalog-created',target.id,{reason:input.reason.trim(),previous_version:previous?.definition_version??null,definition_version:target.definition_version,before:previous,after:target}]);
   return {target,changed:true};
  });
 }
}
