import type {PoolClient} from 'pg';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {IngestionRepository,type MaterialBasis} from '../information-ingestion/processing/current-repository.js';
import {transaction} from '../platform/db.js';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
import {addCurrentFactEvidence} from './current-facts.js';
import type {MaterialEvidence} from './current-contracts.js';
import {categoryVersion,targetCategories,type TargetObject} from './target-identity-contracts.js';
import {recognitionRuleVersion,recognitionEvidenceRef,validateRecognitionInput,validateTargetRecognition,type FactFields,type FactField,type RecognitionInput,type RecognitionOutput} from './target-recognition-contracts.js';
export interface RecognitionSource extends MaterialBasis {segments:{id:string;text:string}[]}
export function buildRecognitionInput(args:{fact_id:string;fact:FactFields;materials:RecognitionSource[];evidence:MaterialEvidence[];manifest_ref:string;maxBytes?:number}):RecognitionInput{
 const fact_digest=digest(args.fact),catalog=new Map<string,RecognitionInput['evidence_catalog'][number]>();
 for(const e of [...args.evidence,...args.materials.flatMap(m=>m.segments.filter(s=>s.text.length).map(s=>({material_id:m.material_id,version:m.version,content_digest:m.content_digest,segment_id:s.id,start_cp:0,end_cp:Array.from(s.text).length,quote:s.text})))]){const evidence_ref=recognitionEvidenceRef(e);catalog.set(evidence_ref,{...e,evidence_ref,fact_id:args.fact_id});}
 const evidence_catalog=[...catalog.values()].sort((a,b)=>a.evidence_ref.localeCompare(b.evidence_ref));
 const clues:RecognitionInput['clues']=[];
 for(const field of ['subject','action','object','description'] as FactField[]){const raw=args.fact[field];if(raw?.trim())clues.push({clue_ref:`clue:${digest({fact_digest,field,raw})}`,raw_text:raw,fact_field:field,evidence_refs:evidence_catalog.filter(e=>e.quote.includes(raw)).map(e=>e.evidence_ref)});}
 const input:RecognitionInput={schema_version:'riskhot.target-recognition.input.v1',fact_id:args.fact_id,fact_digest,fact:args.fact,material_refs:args.materials.map(({material_id,version,content_digest})=>({material_id,version,content_digest})).sort((a,b)=>a.material_id.localeCompare(b.material_id)),evidence_catalog,clues,contexts:args.materials.map(m=>({...m,segments:m.segments.map(({id,text})=>({id,text}))})).sort((a,b)=>a.material_id.localeCompare(b.material_id)),rule_version:recognitionRuleVersion,category_version:categoryVersion,category_catalog:structuredClone(targetCategories),manifest_ref:args.manifest_ref};
 validateRecognitionInput(input);if(Buffer.byteLength(JSON.stringify(input))>(args.maxBytes??24000))throw new DomainError('INPUT_BUDGET_EXCEEDED',422);return input;
}
export function recognitionObjects(input:RecognitionInput,value:RecognitionOutput,runIdentity:string):TargetObject[]{
 const {output}=validateTargetRecognition(input,value);return output.candidates.map(c=>({object_ref:`object:${digest({runIdentity,input:digest(input),candidate_ref:c.candidate_ref})}`,name:c.suggested_name,categories:c.categories,jurisdiction:c.jurisdiction,scope_definition:c.scope_definition,limitations:[],uncertainties:[...c.gaps],evidence_refs:c.evidence_refs.map(r=>{const {fact_id,evidence_ref,...e}=input.evidence_catalog.find(e=>e.evidence_ref===r)!;return e;})}));
}
export async function prepareTargetRecognition(repo:Repository,actor:string,factId:string,manifestRef:string,tx?:PoolClient):Promise<RecognitionInput>{
 const prepare=async(db:PoolClient)=>{
  const fact=(await db.query('SELECT title,description,subject,action,object,event_status,event_time FROM information.fact WHERE id=$1 FOR SHARE',[factId])).rows[0];if(!fact)throw new DomainError('NOT_FOUND',404);
  const rows=(await db.query('SELECT m.id AS material_id,m.version,m.content_digest FROM information.fact_material fm JOIN infomation.ingestion_material m ON m.id=fm.material_id WHERE fm.fact_id=$1 ORDER BY m.id',[factId])).rows;
  if(!rows.length)throw new DomainError('MATERIAL_BASIS_CHANGED',409);
  const materials:RecognitionSource[]=[];for(const basis of rows){const material=await new IngestionRepository(repo).assertBasis(db,actor,basis);materials.push({...basis,segments:material.content.segments.map(({id,text})=>({id,text}))});}
  const evidence=(await db.query('SELECT material_id,material_version AS version,material_digest AS content_digest,segment_id,start_cp,end_cp,quote FROM information.fact_evidence WHERE fact_id=$1',[factId])).rows;
  if(evidence.some(e=>!materials.some(m=>m.material_id===e.material_id&&m.version===e.version&&m.content_digest===e.content_digest)))throw new DomainError('MATERIAL_BASIS_CHANGED',409);
  return buildRecognitionInput({fact_id:factId,fact:{...fact,object:fact.object??null,event_time:fact.event_time instanceof Date?fact.event_time.toISOString():fact.event_time},materials,evidence,manifest_ref:manifestRef});
 };return tx?prepare(tx):transaction(repo.db,prepare);
}
// 调用者在同一事务内持久化运行结果/对象集；语义审查通过的目录项才可关联到Fact。
export async function acceptTargetRecognition(repo:Repository,actor:string,input:RecognitionInput,payload:unknown,options:{tx:PoolClient;runIdentity:string;semanticEvidenceRefs?:string[]}){
 const result=validateTargetRecognition(input,payload),fresh=await prepareTargetRecognition(repo,actor,input.fact_id,input.manifest_ref,options.tx);
 // 接纳新增的同一目录证据不改变原运行；完整语境与Fact变化仍使输入失效。
 if(digest({...fresh,evidence_catalog:undefined,clues:undefined})!==digest({...input,evidence_catalog:undefined,clues:undefined}))throw new DomainError('MATERIAL_BASIS_CHANGED',409);
 const used=[...new Set(result.output.candidates.flatMap(c=>c.evidence_refs))];
 const known=(await options.tx.query('SELECT material_id,material_version AS version,material_digest AS content_digest,segment_id,start_cp,end_cp,quote FROM information.fact_evidence WHERE fact_id=$1',[input.fact_id])).rows as MaterialEvidence[];
 const appended=used.filter(r=>!known.some(e=>recognitionEvidenceRef(e)===r));
 if(appended.some(r=>!options.semanticEvidenceRefs?.includes(r)))return {...result,status:'review' as const,objects:[],needs_semantic_review:appended};
 if(result.status==='ready')await addCurrentFactEvidence(options.tx,input.fact_id,appended.map(r=>{const {fact_id,evidence_ref,...e}=input.evidence_catalog.find(e=>e.evidence_ref===r)!;return e;}));
 return {...result,objects:recognitionObjects(input,result.output,options.runIdentity),needs_semantic_review:[]};
}
