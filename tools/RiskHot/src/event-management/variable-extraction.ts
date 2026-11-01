import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
import {calculateM} from './ratings.js';
import {validateObservationValue,type ObservationValue} from './observations.js';
export interface SavedFact {id:string;title:string;description:string;subject:string|null;action:string|null;object?:string|null;event_status:string;event_time:string|null}
export type EventDraft=Omit<SavedFact,'id'>;
export function confirmInitialFact(fact:SavedFact,draft:EventDraft){
 const fields=['title','description','subject','action','object','event_status','event_time'] as const;
 if(fields.some(k=>digest(fact[k]??null)!==digest(draft[k]??null)))throw new DomainError('INITIAL_FACT_MISMATCH',422);
 if(!fact.subject?.trim()||!fact.action?.trim())throw new DomainError('INITIAL_FACT_INCOMPLETE',409);
 return {classification:null,current_event:draft,reason:'新事件初始事实已核对，不比较历史。'};
}
export interface VariableInput {fact_ids:string[];evidence_ids:string[];target_ids:string[];variable_ids:string[];change_refs:string[]}
export interface VariableItem {
 local_ref:string;name:string;discovery_sources:('subject'|'action'|'target'|'semantic')[];
 source_contexts:{source:string;text:string;fact_id:string;evidence_refs:string[]}[];
 variable_id:string|null;definition_snapshot_id:string|null;match_status:'matched'|'pending_governance'|'not_applicable';reason:string;
 target_refs:{kind:'target'|'candidate';ref:string}[];relation_status:'ready'|'pending_target'|'pending_definition'|'no_target';
 values:ObservationValue[];change_refs:string[];
}
export interface VariableResult {schema_version:'riskhot.variable-extraction.v1';items:VariableItem[]}
const fail=(code:string):never=>{throw new DomainError(code,422);};
const text=(v:unknown):v is string=>typeof v==='string'&&Boolean(v.trim());
const list=(v:unknown):v is unknown[]=>Array.isArray(v);
function exact(v:unknown,keys:string[],code='VARIABLE_OUTPUT_INVALID'):asserts v is Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==keys.sort().join())fail(code);}
export function validateVariableExtraction(input:VariableInput,value:unknown):VariableResult{
 exact(value,['schema_version','items']);if(value.schema_version!=='riskhot.variable-extraction.v1'||!list(value.items)||value.items.length>100)fail('VARIABLE_OUTPUT_INVALID');
 const seen=new Set<string>();
 for(const raw of value.items as unknown[]){
  exact(raw,['local_ref','name','discovery_sources','source_contexts','variable_id','definition_snapshot_id','match_status','reason','target_refs','relation_status','values','change_refs']);
  const i=raw as unknown as VariableItem;
  if(!text(i.local_ref)||seen.has(i.local_ref)||!text(i.name)||!text(i.reason))fail('VARIABLE_OUTPUT_INVALID');seen.add(i.local_ref);
  if(!list(i.discovery_sources)||!i.discovery_sources.length||new Set(i.discovery_sources).size!==i.discovery_sources.length||i.discovery_sources.some(s=>!['subject','action','target','semantic'].includes(s))||!list(i.source_contexts)||!i.source_contexts.length)fail('VARIABLE_OUTPUT_INVALID');
  for(const c of i.source_contexts){exact(c,['source','text','fact_id','evidence_refs']);if(!i.discovery_sources.includes(c.source as VariableItem['discovery_sources'][number])||!text(c.text)||!input.fact_ids.includes(c.fact_id)||!list(c.evidence_refs)||!c.evidence_refs.length||c.evidence_refs.some(e=>!input.evidence_ids.includes(e)))fail('VARIABLE_EVIDENCE_INVALID');}
  if(i.discovery_sources.some(s=>!i.source_contexts.some(c=>c.source===s)))fail('VARIABLE_EVIDENCE_INVALID');
  if(!['matched','pending_governance','not_applicable'].includes(i.match_status)||(i.variable_id===null)!==(i.definition_snapshot_id===null)||(i.match_status==='matched'?(!i.variable_id||!text(i.definition_snapshot_id)||!input.variable_ids.includes(i.variable_id)):i.variable_id!==null))fail('VARIABLE_REFERENCE_INVALID');
  if(!list(i.target_refs)||i.target_refs.some(t=>!t||!['target','candidate'].includes(t.kind)||!text(t.ref)||t.kind==='target'&&!input.target_ids.includes(t.ref)))fail('VARIABLE_REFERENCE_INVALID');
  if(!['ready','pending_target','pending_definition','no_target'].includes(i.relation_status)||i.relation_status==='ready'&&(!i.variable_id||!i.target_refs.some(t=>t.kind==='target'))||i.relation_status==='no_target'&&i.target_refs.length)fail('VARIABLE_REFERENCE_INVALID');
  if(!list(i.change_refs)||i.change_refs.some(c=>!input.change_refs.includes(c))||!list(i.values))fail('VARIABLE_REFERENCE_INVALID');
  for(const v of i.values)validateObservationValue(v,input);
 }
 return value as unknown as VariableResult;
}
export interface MeaningInput {mode:'text-draft'|'formal';method_version:string;assessment_scope:Record<string,unknown>;research_horizon:Record<string,unknown>;evidence_ids:string[];method?:{approved:boolean;weights:Record<string,number>}}
export const meaningDimensions=['底层变量关联','影响程度','持续时间','影响范围','作用落地'] as const;
export function validateMeaning(input:MeaningInput,value:unknown){
 exact(value,['dimensions','reasoning_summary','limitations'],'MEANING_OUTPUT_INVALID');
 if(input.mode==='formal'&&!input.method?.approved)throw new DomainError('RATING_METHOD_UNAPPROVED',409);
 if(!list(value.dimensions)||!text(value.reasoning_summary)||!list(value.limitations)||value.limitations.some(v=>!text(v)))fail('MEANING_OUTPUT_INVALID');
 const scores:Record<string,number>={},seen=new Set<string>();
 for(const d of value.dimensions as unknown[]){exact(d,['dimension_key','score','reason','evidence_refs'],'MEANING_OUTPUT_INVALID');if(!meaningDimensions.includes(d.dimension_key as typeof meaningDimensions[number])||seen.has(String(d.dimension_key))||!text(d.reason)||!list(d.evidence_refs)||!d.evidence_refs.length||d.evidence_refs.some(e=>!input.evidence_ids.includes(String(e))))fail('MEANING_OUTPUT_INVALID');seen.add(String(d.dimension_key));if(input.mode==='text-draft'?d.score!==null:typeof d.score!=='number'||!Number.isFinite(d.score)||d.score<0||d.score>5)fail('MEANING_OUTPUT_INVALID');if(d.score!==null)scores[String(d.dimension_key)]=Number(d.score);}
 if(input.mode==='formal'&&(!input.method?.approved||seen.size!==5))throw new DomainError('RATING_METHOD_UNAPPROVED',409);
 if(input.mode==='text-draft'&&(input.method_version!=='text-draft-v1'||!(value.limitations as unknown[]).length))fail('MEANING_OUTPUT_INVALID');
 return {...value,assessment_scope:input.assessment_scope,research_horizon:input.research_horizon,method_version:input.method_version,m:input.mode==='formal'?calculateM(input.method!,scores):null,rating_status:input.mode==='formal'?'confirmed':'draft'};
}
