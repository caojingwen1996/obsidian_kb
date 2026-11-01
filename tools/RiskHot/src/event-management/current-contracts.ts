import { Ajv2020 } from 'ajv/dist/2020.js';
import { taskSchemas, validateTaskOutput, type ValidationContext, type ValidationReport, type FullCandidate, type TaskId } from './contracts.js';
import type { CurrentMaterial, MaterialBasis } from '../information-ingestion/processing/current-repository.js';
import { DomainError } from '../platform/types.js';

export interface MaterialEvidence extends MaterialBasis { segment_id: string; start_cp: number; end_cp: number; quote: string }
export interface MaterialCandidate extends Omit<FullCandidate, 'evidence_refs'> { evidence_refs: MaterialEvidence[] }
export function currentTaskSchema(task: TaskId): object {
  return currentizeSchema(taskSchemas[task]);
}
export function currentizeSchema(source: object): object {
  const schema = JSON.parse(JSON.stringify(source));
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    const props = node.properties as Record<string, unknown> | undefined;
    if (props?.information_version_id) {
      const uuid = props.information_version_id;
      delete props.information_version_id;
      Object.assign(props, { material_id: uuid, version: { type: 'integer', minimum: 1 }, content_digest: { type: 'string', pattern: '^[a-f0-9]{64}$' } });
      node.required = Object.keys(props);
    }
    for (const child of Object.values(node)) visit(child);
  }
  visit(schema); return schema;
}
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile(currentTaskSchema('AI-01'));
export function validateCurrentExtraction(material: CurrentMaterial, value: unknown, requireObject=false): asserts value is { candidates: MaterialCandidate[]; warnings: string[] } {
  if (!(requireObject ? ajv.compile(currentFactExtractionSchema())(value) : (validate(value)||ajv.compile(currentFactExtractionSchema())(value)))) throw new DomainError('OUTPUT_SCHEMA_INVALID', 422);
  const result = value as { candidates: MaterialCandidate[] };
  if (new Set(result.candidates.map(c => c.local_key)).size !== result.candidates.length) throw new DomainError('DUPLICATE_LOCAL_KEY', 422);
  for (const candidate of result.candidates) for (const e of candidate.evidence_refs) assertCurrentEvidence(material, e);
}
export function assertCurrentEvidence(material: CurrentMaterial, evidence: MaterialEvidence): void {
  const segment = material.content.segments.find(s => s.id === evidence.segment_id);
  if (evidence.material_id !== material.id || evidence.version !== material.version || evidence.content_digest !== material.content_digest) throw new DomainError('MATERIAL_BASIS_CHANGED', 409);
  if (!segment || evidence.start_cp < 0 || evidence.end_cp <= evidence.start_cp || evidence.end_cp > Array.from(segment.text).length || Array.from(segment.text).slice(evidence.start_cp, evidence.end_cp).join('') !== evidence.quote) throw new DomainError('EVIDENCE_MISMATCH', 422);
}

export function validateCurrentTask(task:TaskId,value:unknown,context:ValidationContext,material:CurrentMaterial):ValidationReport{
 if(!ajv.compile(currentTaskSchema(task))(value))return {valid:false,errors:['OUTPUT_SCHEMA_INVALID'],validated_payload:null};
 function legacy(node:unknown):unknown{
  if(Array.isArray(node))return node.map(legacy);
  if(!node||typeof node!=='object')return node;
  const object=node as Record<string,unknown>;
  if('quote' in object){assertCurrentEvidence(material,object as unknown as MaterialEvidence);const {material_id,version,content_digest,...rest}=object;return {...rest,information_version_id:material_id};}
  return Object.fromEntries(Object.entries(object).map(([key,child])=>[key,legacy(child)]));
 }
 const result=validateTaskOutput(task,legacy(value),context);
 return {...result,validated_payload:result.valid?value as ValidationReport['validated_payload']:null};
}

// 新八步任务包要求显式Object；旧包的Schema保持原契约。
export function currentFactExtractionSchema(): object {
 const schema=currentTaskSchema('AI-01') as {properties:{candidates:{items:{properties:Record<string,unknown>;required:string[]}}}};
 const candidate=schema.properties.candidates.items;
 candidate.properties.object={anyOf:[{type:'string',minLength:1,maxLength:8000,pattern:'\\S'},{type:'null'}]};
 candidate.required.push('object');return schema;
}
export function mapFactToEvent(fact:{title:string;description:string;subject:string|null;action:string|null;object?:string|null;event_status:string;event_time:string|null}) {
 return {title:fact.title,description:fact.description,subject:fact.subject,action:fact.action,object:fact.object??null,event_status:fact.event_status,event_time:fact.event_time};
}
