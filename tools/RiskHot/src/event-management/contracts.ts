import {createHash} from 'node:crypto';
import {normalizeEventTime} from './time.js';
import {Ajv2020} from 'ajv/dist/2020.js';
export type TaskId='AI-01'|'AI-02'|'AI-03'|'AI-04'|'AI-05';
export type Step=2|3|4|5;
export interface Evidence {information_version_id:string;segment_id:string;start_cp:number;end_cp:number;quote:string}
export interface TimeValue {text:string;start:string|null;end:string|null;precision:'timestamp'|'day'|'month'|'year'|'range'|'unknown';kind:'occurred'|'announced'|'expected'|'unknown';timezone:string|null}
export interface FullCandidate {local_key:string;title:string;description:string;subject:string|null;action:string;target_clues:string[];event_status:string;event_time:string|null;evidence_refs:Evidence[];missing_fields:string[]}
export interface IdentityProposal {decision:'NEW'|'REUSE'|'UNRESOLVED';matched_event_id:string|null;comparisons:{event_id:string;identity_match:boolean|null;reason:string}[];reason:string;evidence_refs:Evidence[];unresolved_issues:string[]}
export interface TargetRelation {target_id:string;definition_version:string;relation_note:string;evidence_refs:Evidence[]}
export interface VariableRelation {target_id:string;variable_id:string;definition_version:string;relation_type:string;change_direction:string;impact_status:string;description:string;evidence_refs:Evidence[]}
export interface DefinitionCandidate {kind:'target'|'variable';name:string;definition:string;jurisdiction:string|null;unit:string|null;reason:string;evidence_refs:Evidence[]}
export interface RelationsProposal {targets:TargetRelation[];variables:VariableRelation[];definition_candidates:DefinitionCandidate[];unresolved_issues:string[]}
export type IncrementKind='NEW_EVENT'|'EVENT_PROGRESS'|'MATERIAL_ADDITION'|'SOURCE_ADDITION'|'CORRECTION'|'DUPLICATE'|'UNRESOLVED';
export interface Change {local_key:string;update_type:string;summary:string;previous_status:string|null;current_status:string|null;effective_time:string|null;basis_fact_ids:string[];evidence_refs:Evidence[]}
export interface CurrentEvent {title:string;description:string;subject:string;action:string;event_status:string;event_time:string|null}
export interface IncrementProposal {classification:IncrementKind;current_event:CurrentEvent|null;changes:Change[];source_evidence_refs:Evidence[];reason:string;unresolved_issues:string[]}
export interface RatingProposal {assessment_scope:Record<string,unknown>;research_horizon:Record<string,unknown>;method_version:string;dimensions:{dimension_key:string;score:number|null;reason:string;evidence_refs:Evidence[]}[];financial_usages:string[];reasoning_summary:string;limitations:string[]}
export interface ValidationContext {version_id:string;segments:{id:string;text:string}[];event_ids:string[];target_ids:string[];variable_ids:string[]}
export interface GenerationContext {processing_id:string;candidate_id:string|null;execution_generation:number;proposal_generation:number;input_digest:string;manifest_ref:string}
export type Payload={candidates:FullCandidate[];warnings:string[]}|IdentityProposal|RelationsProposal|IncrementProposal|RatingProposal;
export interface ValidationReport {valid:boolean;errors:string[];validated_payload:Payload|null}
export const canonical=(v:unknown):string=>JSON.stringify(sort(v));
function sort(v:unknown):unknown {if(v instanceof Date)return v.toISOString();return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sort(x)])):v;}
export const digest=(v:unknown):string=>createHash('sha256').update(canonical(v)).digest('hex');
const string={type:'string',minLength:1,maxLength:8000};
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const nullable=(v:object)=>({anyOf:[v,{type:'null'}]});
const object=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const list=(items:object,maxItems=100,minItems=0)=>({type:'array',items,maxItems,minItems});
const enumOf=(values:readonly string[])=>({type:'string',enum:values});
const strings=list(string);
export const stages=['expected','announced','in_progress','effective','completed','cancelled','unknown'] as const;
const evidence=object({information_version_id:uuid,segment_id:uuid,start_cp:{type:'integer',minimum:0},end_cp:{type:'integer',minimum:1},quote:{...string,maxLength:4000}});
const refs=list(evidence,20,1);
const time=nullable(string);
const candidate=object({local_key:string,title:string,description:string,subject:nullable(string),action:string,target_clues:strings,event_status:enumOf(stages),event_time:time,evidence_refs:refs,missing_fields:strings});
const dimension=object({dimension_key:string,score:nullable({type:'number',minimum:0,maximum:5}),reason:string,evidence_refs:refs});
export const taskSchemas:Record<TaskId,object>={
 'AI-01':object({candidates:list(candidate,50),warnings:strings}),
 'AI-02':object({decision:enumOf(['NEW','REUSE','UNRESOLVED']),matched_event_id:nullable(uuid),comparisons:list(object({event_id:uuid,identity_match:nullable({type:'boolean'}),reason:string})),reason:string,evidence_refs:refs,unresolved_issues:strings}),
 'AI-03':object({targets:list(object({target_id:uuid,definition_version:string,relation_note:string,evidence_refs:refs})),variables:list(object({target_id:uuid,variable_id:uuid,definition_version:string,relation_type:enumOf(['direct_change','direct_involvement','observed_change']),change_direction:enumOf(['increase','decrease','unchanged','unknown']),impact_status:enumOf(['expected','announced','effective','unknown']),description:string,evidence_refs:refs})),definition_candidates:list(object({kind:enumOf(['target','variable']),name:string,definition:string,jurisdiction:nullable(string),unit:nullable(string),reason:string,evidence_refs:refs})),unresolved_issues:strings}),
 'AI-04':object({current_event:nullable(object({title:string,description:string,subject:string,action:string,event_status:enumOf(stages),event_time:time})),classification:enumOf(['NEW_EVENT','EVENT_PROGRESS','MATERIAL_ADDITION','SOURCE_ADDITION','CORRECTION','DUPLICATE','UNRESOLVED']),changes:list(object({local_key:string,update_type:string,summary:string,previous_status:nullable(enumOf(stages)),current_status:nullable(enumOf(stages)),effective_time:time,basis_fact_ids:list(uuid),evidence_refs:refs})),source_evidence_refs:refs,reason:string,unresolved_issues:strings}),
 'AI-05':object({assessment_scope:{type:'object'},research_horizon:{type:'object'},method_version:string,dimensions:list(dimension),financial_usages:strings,reasoning_summary:string,limitations:strings}),
};
const ajv=new Ajv2020({strict:true,allErrors:true,coerceTypes:false,useDefaults:false,removeAdditional:false});
const validators=Object.fromEntries(Object.entries(taskSchemas).map(([k,s])=>[k,ajv.compile(s)]));
export function validateTaskOutput(taskId:TaskId,response:unknown,context:ValidationContext):ValidationReport {
 const errors:string[]=[];const check=validators[taskId]!;
 if(!check(response))return {valid:false,errors:['OUTPUT_SCHEMA_INVALID'],validated_payload:null};
 const walk=(value:unknown):void=>{
  if(Array.isArray(value)){for(const x of value)walk(x);return;}
  if(!value||typeof value!=='object')return;
  const o=value as Record<string,unknown>;
  if('quote' in o){const e=o as unknown as Evidence;const s=context.segments.find(s=>s.id===e.segment_id);if(e.information_version_id!==context.version_id||!s||e.start_cp<0||e.end_cp>Array.from(s.text).length||e.start_cp>=e.end_cp||Array.from(s.text).slice(e.start_cp,e.end_cp).join('')!==e.quote)errors.push('EVIDENCE_MISMATCH');}
  for(const [key,ids] of [['event_id',context.event_ids],['target_id',context.target_ids],['variable_id',context.variable_ids]] as const)if(o[key]&&!ids.includes(String(o[key])))errors.push('UNKNOWN_REFERENCE');
  for(const key of ['event_time','effective_time'])if(key in o){try{normalizeEventTime(o[key] as string|null);}catch{errors.push('TIME_INVALID');}}
  for(const x of Object.values(o))walk(x);
 };walk(response);
 if(taskId==='AI-01'){const {candidates}=response as {candidates:FullCandidate[]};if(new Set(candidates.map(x=>x.local_key)).size!==candidates.length)errors.push('DUPLICATE_LOCAL_KEY');}
 if(taskId==='AI-02'){const p=response as IdentityProposal;if(p.decision==='REUSE'?(!p.matched_event_id||!context.event_ids.includes(p.matched_event_id)):p.matched_event_id!==null)errors.push('IDENTITY_INVALID');if(p.decision==='UNRESOLVED'&&!p.unresolved_issues.length)errors.push('UNRESOLVED_WITHOUT_REASON');}
 if(taskId==='AI-03'){const p=response as RelationsProposal;if(p.variables.some(v=>!p.targets.some(t=>t.target_id===v.target_id)))errors.push('TARGET_REQUIRED');}
 if(taskId==='AI-04'){const p=response as IncrementProposal;if(['SOURCE_ADDITION','DUPLICATE'].includes(p.classification)&&p.changes.length)errors.push('INCREMENT_INVALID');if(new Set(p.changes.map(c=>c.local_key)).size!==p.changes.length)errors.push('DUPLICATE_LOCAL_KEY');}
 return {valid:!errors.length,errors,validated_payload:errors.length?null:response as Payload};
}
