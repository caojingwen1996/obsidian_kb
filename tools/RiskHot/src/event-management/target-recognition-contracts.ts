import {readFileSync} from 'node:fs';
import {Ajv2020} from 'ajv/dist/2020.js';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
import {categoryVersion,targetCategories,targetEvidenceSchema} from './target-identity-contracts.js';
import type {MaterialBasis} from '../information-ingestion/processing/current-repository.js';
import type {MaterialEvidence} from './current-contracts.js';
export const recognitionRuleVersion='target-recognition-v2';
export type FactField='subject'|'action'|'object'|'description';
export interface FactFields {title:string;description:string;subject:string|null;action:string|null;object:string|null;event_status:'expected'|'announced'|'in_progress'|'effective'|'completed'|'cancelled'|'unknown';event_time:string|null}
export interface RecognitionInput {schema_version:'riskhot.target-recognition.input.v1';fact_id:string;fact_digest:string;fact:FactFields;material_refs:MaterialBasis[];evidence_catalog:(MaterialEvidence&{evidence_ref:string;fact_id:string})[];clues:{clue_ref:string;raw_text:string;fact_field:FactField;evidence_refs:string[]}[];contexts:(MaterialBasis&{segments:{id:string;text:string}[]})[];rule_version:string;category_version:string;category_catalog:Record<string,string[]>;manifest_ref:string}
export interface RecognitionCandidate {candidate_ref:string;raw_name:string;suggested_name:string|null;identity_attributes:{name:string;value:string;evidence_refs:string[]}[];jurisdiction:string|null;scope_definition:string|null;categories:{primary_category:string;secondary_category:string}[];observation_meaning:string;action_relation:string;clue_refs:string[];fact_fields:FactField[];evidence_refs:string[];gaps:string[]}
export interface RecognitionOutput {schema_version:'riskhot.target-recognition.output.v1';fact_id:string;fact_digest:string;candidates:RecognitionCandidate[];clue_results:{clue_ref:string;status:'identified'|'unresolved'|'excluded'|'fact_correction';candidate_refs:string[];reason:string;evidence_refs:string[]}[];unresolved:{ref:string;candidate_ref:string|null;clue_ref:string|null;reason:string;needed_evidence:string;resume_step:1|2|3;evidence_refs:string[]}[];coverage:{context_reviewed:boolean;complete:boolean;uncovered_refs:string[];reason:string}}
export interface RecognitionResult {output:RecognitionOutput;status:'ready'|'no_targets'|'review'|'fact_correction'}
const str={type:'string',minLength:1,maxLength:8000,pattern:'\\S'},uuid={type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'},hash={type:'string',pattern:'^[a-f0-9]{64}$'};
const obj=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const arr=(items:object,minItems=0)=>({type:'array',items,minItems,maxItems:200,uniqueItems:true});
const refs=arr(str),nullable=(s:object)=>({anyOf:[s,{type:'null'}]}),field={enum:['subject','action','object','description']};
const basis={material_id:uuid,version:{type:'integer',minimum:1},content_digest:hash};
export const recognitionFactSchema=obj({title:str,description:str,subject:nullable(str),action:nullable(str),object:nullable(str),event_status:{enum:['expected','announced','in_progress','effective','completed','cancelled','unknown']},event_time:nullable(str)});
export const recognitionInputSchema=obj({schema_version:{const:'riskhot.target-recognition.input.v1'},fact_id:uuid,fact_digest:hash,fact:recognitionFactSchema,material_refs:arr(obj(basis),1),evidence_catalog:arr(obj({...targetEvidenceSchema.properties,quote:{type:'string',minLength:1,maxLength:24000},evidence_ref:str,fact_id:uuid})),clues:arr(obj({clue_ref:str,raw_text:str,fact_field:field,evidence_refs:refs})),contexts:arr(obj({...basis,segments:arr(obj({id:uuid,text:{type:'string'}}))}),1),rule_version:{const:recognitionRuleVersion},category_version:{const:categoryVersion},category_catalog:{const:targetCategories},manifest_ref:str});
export const recognitionOutputSchema=obj({schema_version:{const:'riskhot.target-recognition.output.v1'},fact_id:uuid,fact_digest:hash,candidates:arr(obj({candidate_ref:str,raw_name:str,suggested_name:nullable(str),identity_attributes:arr(obj({name:str,value:str,evidence_refs:arr(str,1)})),jurisdiction:nullable(str),scope_definition:nullable(str),categories:arr(obj({primary_category:str,secondary_category:str})),observation_meaning:str,action_relation:str,clue_refs:refs,fact_fields:arr(field),evidence_refs:arr(str,1),gaps:refs})),clue_results:arr(obj({clue_ref:str,status:{enum:['identified','unresolved','excluded','fact_correction']},candidate_refs:refs,reason:str,evidence_refs:refs})),unresolved:arr(obj({ref:str,candidate_ref:nullable(str),clue_ref:nullable(str),reason:str,needed_evidence:str,resume_step:{enum:[1,2,3]},evidence_refs:refs})),coverage:obj({context_reviewed:{type:'boolean'},complete:{type:'boolean'},uncovered_refs:refs,reason:str})});
const ajv=new Ajv2020({allErrors:true,strict:false}),inputCheck=ajv.compile(recognitionInputSchema),outputCheck=ajv.compile(recognitionOutputSchema);
const fail=(suffix:string):never=>{throw new DomainError(`TARGET_RECOGNITION_${suffix}_INVALID`,422);};
const unique=(values:string[])=>new Set(values).size===values.length;
export const recognitionEvidenceRef=(e:MaterialEvidence)=>`evidence:${digest({material_id:e.material_id,version:e.version,content_digest:e.content_digest,segment_id:e.segment_id,start_cp:e.start_cp,end_cp:e.end_cp})}`;
export function validateRecognitionInput(input:RecognitionInput):void{
 if(!inputCheck(input))fail('SCHEMA');
 if(digest(input.category_catalog)!==digest(targetCategories))fail('REFERENCE');
 if(input.fact_digest!==digest(input.fact))fail('REFERENCE');
 if(!unique(input.material_refs.map(m=>m.material_id))||!unique(input.contexts.map(m=>m.material_id))||!unique(input.evidence_catalog.map(e=>e.evidence_ref))||!unique(input.clues.map(c=>c.clue_ref)))fail('REFERENCE');
 const basis=(m:MaterialBasis)=>JSON.stringify([m.material_id,m.version,m.content_digest]);
 if(digest(input.material_refs.map(basis).sort())!==digest(input.contexts.map(basis).sort()))fail('REFERENCE');
 for(const e of input.evidence_catalog){const context=input.contexts.find(m=>basis(m)===basis(e)),s=context?.segments.find(s=>s.id===e.segment_id);if(!s||e.fact_id!==input.fact_id||e.evidence_ref!==recognitionEvidenceRef(e))fail('REFERENCE');const chars=Array.from(s!.text);if(e.end_cp<=e.start_cp||e.end_cp>chars.length||chars.slice(e.start_cp,e.end_cp).join('')!==e.quote)throw new DomainError('EVIDENCE_MISMATCH',422);}
 for(const context of input.contexts){if(!unique(context.segments.map(s=>s.id)))fail('REFERENCE');for(const s of context.segments)if(s.text.length&&!input.evidence_catalog.some(e=>basis(e)===basis(context)&&e.segment_id===s.id&&e.start_cp===0&&e.end_cp===Array.from(s.text).length))fail('COVERAGE');}
 const expectedFields=(['subject','action','object','description'] as FactField[]).filter(f=>input.fact[f]?.trim());
 if(input.clues.length!==expectedFields.length||!unique(input.clues.map(c=>c.fact_field))||expectedFields.some(f=>!input.clues.some(c=>c.fact_field===f)))fail('COVERAGE');
 for(const clue of input.clues)if(clue.clue_ref!==`clue:${digest({fact_digest:input.fact_digest,field:clue.fact_field,raw:clue.raw_text})}`||input.fact[clue.fact_field]!==clue.raw_text||clue.evidence_refs.some(r=>!input.evidence_catalog.some(e=>e.evidence_ref===r)))fail('REFERENCE');
}
export function validateTargetRecognition(input:RecognitionInput,value:unknown):RecognitionResult{
 validateRecognitionInput(input);if(Buffer.byteLength(JSON.stringify(value)??'')>64000)throw new DomainError('MODEL_OUTPUT_BUDGET_EXCEEDED',422);if(!outputCheck(value))fail('SCHEMA');const o=value as RecognitionOutput;
 if(o.fact_id!==input.fact_id||o.fact_digest!==input.fact_digest||!unique(o.candidates.map(c=>c.candidate_ref))||!unique(o.unresolved.map(u=>u.ref)))fail('REFERENCE');
 const evidence=(refs:string[])=>{if(refs.some(r=>!input.evidence_catalog.some(e=>e.evidence_ref===r)))fail('REFERENCE');};
 const clues=new Set(input.clues.map(c=>c.clue_ref)),candidates=new Map(o.candidates.map(c=>[c.candidate_ref,c]));
 if(o.clue_results.length!==clues.size||!unique(o.clue_results.map(c=>c.clue_ref))||o.clue_results.some(c=>!clues.has(c.clue_ref)))fail('COVERAGE');
 for(const c of o.candidates){evidence(c.evidence_refs);if(c.clue_refs.some(r=>!clues.has(r))||(!c.clue_refs.length&&!c.fact_fields.length)||c.fact_fields.some(f=>!input.fact[f])||(!c.categories.length&&!c.gaps.length)||c.categories.some(p=>!targetCategories[p.primary_category]?.includes(p.secondary_category)))fail('REFERENCE');for(const a of c.identity_attributes){evidence(a.evidence_refs);if(a.evidence_refs.some(e=>!c.evidence_refs.includes(e)))fail('REFERENCE');}}
 for(const r of o.clue_results){evidence(r.evidence_refs);if(r.candidate_refs.some(ref=>!candidates.get(ref)?.clue_refs.includes(r.clue_ref)))fail('REFERENCE');if(r.status==='identified'?!r.candidate_refs.length:r.status!=='unresolved'&&r.candidate_refs.length>0)fail('COVERAGE');if(['unresolved','fact_correction'].includes(r.status)&&!o.unresolved.some(u=>u.clue_ref===r.clue_ref&&(r.status!=='fact_correction'||u.resume_step===1)))fail('COVERAGE');}
 for(const c of o.candidates)for(const ref of c.clue_refs)if(!o.clue_results.some(r=>r.clue_ref===ref&&r.candidate_refs.includes(c.candidate_ref)))fail('COVERAGE');
 for(const u of o.unresolved){evidence(u.evidence_refs);if(u.candidate_ref&&!candidates.has(u.candidate_ref)||u.clue_ref&&!clues.has(u.clue_ref))fail('REFERENCE');if(u.resume_step===1&&(!u.clue_ref||!o.clue_results.some(r=>r.clue_ref===u.clue_ref&&r.status==='fact_correction')))fail('COVERAGE');}
 if(!o.coverage.context_reviewed||o.coverage.complete===Boolean(o.coverage.uncovered_refs.length))fail('COVERAGE');
 if(o.coverage.uncovered_refs.some(r=>!clues.has(r)&&!input.evidence_catalog.some(e=>e.evidence_ref===r)))fail('REFERENCE');
 const correction=o.unresolved.some(u=>u.resume_step===1),review=!o.coverage.complete||o.unresolved.some(u=>u.resume_step===2)||o.clue_results.some(c=>c.status==='unresolved'&&!o.unresolved.some(u=>u.clue_ref===c.clue_ref&&u.resume_step===3));
 return {output:o,status:correction?'fact_correction':review?'review':!o.candidates.length&&!o.unresolved.length?'no_targets':o.candidates.length?'ready':'review'};
}
export const targetRecognitionPrompt=readFileSync(new URL('../prompts/08.target-recognition.md',import.meta.url),'utf8');
