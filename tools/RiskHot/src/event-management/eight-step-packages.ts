import {readFileSync} from 'node:fs';
import {digest} from './contracts.js';
import {currentFactExtractionSchema,currentTaskSchema} from './current-contracts.js';
import {recognitionOutputSchema,targetRecognitionPrompt} from './target-recognition-contracts.js';
import {targetOutputSchema,targetIdentityPrompt} from './target-identity-contracts.js';
import {DomainError} from '../platform/types.js';
const str={type:'string',minLength:1};const strings={type:'array',items:str};const nullable=(s:object)=>({anyOf:[s,{type:'null'}]});
const obj=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const array=(items:object)=>({type:'array',items,maxItems:100});
const basis=obj({fact_id:str,fact_evidence_id:str,material_id:str,version:{type:'integer',minimum:1},content_digest:str,input_ref:nullable(str)});
const time=obj({kind:{enum:['point','period','range','unknown']},precision:{enum:['second','day','month','quarter','year','unknown']},start:nullable(str),end:nullable(str),raw_text:nullable(str)});
export const variableExtractionSchema=obj({schema_version:{const:'riskhot.variable-extraction.v1'},items:array(obj({local_ref:str,name:str,discovery_sources:array({enum:['subject','action','target','semantic']}),source_contexts:array(obj({source:{enum:['subject','action','target','semantic']},text:str,fact_id:str,evidence_refs:strings})),variable_id:nullable(str),definition_snapshot_id:nullable(str),match_status:{enum:['matched','pending_governance','not_applicable']},reason:str,target_refs:array(obj({kind:{enum:['target','candidate']},ref:str})),relation_status:{enum:['ready','pending_target','pending_definition','no_target']},values:array(obj({value:{type:['string','number','boolean']},unit:nullable(str),value_nature:nullable({enum:['actual','historical','planned','expected','predicted']}),value_time:time,acquisition_method:{enum:['extracted','calculated','inferred']},derivation_basis:nullable(obj({method:str,rule_ref:nullable(str),inputs:array(obj({local_ref:str,value:{type:['string','number','boolean']},unit:nullable(str),basis_refs:strings}))})),basis:array(basis)})),change_refs:strings}))});
export const meaningSchema=obj({dimensions:array(obj({dimension_key:{enum:['底层变量关联','影响程度','持续时间','影响范围','作用落地']},score:nullable({type:'number',minimum:0,maximum:5}),reason:str,evidence_refs:strings})),reasoning_summary:str,limitations:strings});
export const associationSchema=obj({scope:str,window:obj({start:str,end:str}),retrieval:obj({complete:{type:'boolean'},truncated:{type:'boolean'},digest:str}),members:array(obj({event_id:str,fact_ids:strings,basis_digest:str})),groups:array(obj({local_ref:str,event_ids:strings,dimensions:obj({same_entity:str,same_variable:str,same_direction:str,same_magnitude:str,same_time_window:str}),continuity:str,basis:array(obj({event_id:str,fact_id:str}))})),unresolved:strings,coverage:obj({complete:{type:'boolean'},reason:str})});
export function loadEightStepTask(taskId:string){
 const promptFile=(name:string)=>readFileSync(new URL(`../prompts/${name}`,import.meta.url),'utf8');
 const registry:Record<string,{schema:object;prompt:()=>string}>={
  'AI-01':{schema:currentFactExtractionSchema(),prompt:()=>promptFile('01.knowledge-extraction.md')},
  'AI-02':{schema:currentTaskSchema('AI-02'),prompt:()=>promptFile('02.event-identity-judgment.md')},
  'AI-08':{schema:recognitionOutputSchema,prompt:()=>targetRecognitionPrompt},
  'AI-07':{schema:targetOutputSchema,prompt:()=>targetIdentityPrompt},
  'AI-05':{schema:variableExtractionSchema,prompt:()=>readFileSync(new URL('../../docs/system-design/03-系统功能架构/AI任务与提示词/AI-05 从事件提取风险变量.md',import.meta.url),'utf8')},
  'AI-09':{schema:meaningSchema,prompt:()=> '你负责金融意义五维评价，只使用给定事实、证据与范围；每维给依据。text-draft-v1所有score为null，limitations明确未批准量化方法。不输出M，不分类金融用途，不改变范围、期限或任务状态。只返回给定Schema。'},
  'AI-04':{schema:associationSchema,prompt:()=>promptFile('04.event-association.md')+'\n按本次机器Schema的五维字段输出。保留所有Event和Fact身份，只引用输入成员与依据；无关联须完整覆盖，失败不能返回合法空。'}
 };
 const entry=registry[taskId];if(!entry)throw new DomainError('TASK_PACKAGE_NOT_BOUND',409);
 const data={task_id:taskId,version:'f02-eight-step-v1',publication_status:'draft',prompt:entry.prompt(),schema:entry.schema,policy:{max_attempts:3,budget_ms:600000,max_input_tokens:24000,input_encoding:'o200k_base',max_input_bytes:96000,max_output_tokens:8000}};
 return {...data,digest:digest(data)};
}
