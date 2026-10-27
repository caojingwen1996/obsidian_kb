import { Ajv2020 } from 'ajv/dist/2020.js';
import { DomainError, type NormalizedMaterial, type ExtractionResult } from '../../platform/types.js';
export interface HandoffArtifact { artifact_id: string; sha256: string; size: number; kind: string }
export interface InformationHandoff {
  schema_version: 'riskhot.information-handoff.v1'; delivery_id: string; consumer: 'F02';
  information: { information_id: string; version_id: string; version_no: number; previous_version_id: string | null; version_kind: 'initial' | 'source_revision' };
  source: { source_id: string; source_config_version: number; catalog_key: string; name: string; connector: string; scope: string };
  provenance: { operation_id: string; acquisition_id: string; collected_at: string; url: string | null };
  material: NormalizedMaterial;
  artifacts: { raw: HandoffArtifact; normalized: HandoffArtifact };
  normalization: { version: string; content_digest: string; checks: string[]; attachment_status: 'not_collected'; limitations: string[] };
  saved: { operation_id: string; at: string };
}
export interface AcceptanceReceipt {
  schema_version: 'riskhot.information-receipt.v1'; delivery_id: string; information_id: string; version_id: string;
  payload_artifact_id: string; payload_sha256: string; processing_id: string; analysis_key: string; accepted_at: string;
  status: 'received'; acceptance_basis: 'validated_handoff' | 'legacy_inbox';
}
export interface CandidateResultFile {
  schema_version: 'riskhot.candidate-result.v1'; delivery_id: string; information_id: string; version_id: string;
  processing_id: string; analysis_key: string; processing_scope: string; completed_at: string;
  input_artifact_id: string | null; manifest_artifact_id: string | null; candidate_count: number;
  result_status: string; next_step: number | null; candidates: unknown[];
  covered_segment_ids: string[] | null; no_event_reason: string | null; warnings: string[]; limitations: string[];
}
export interface FileDescriptor { url: string; relative_path: string; sha256: string; size: number }
export interface DeliveryView {
  event_processing?:{id:string;result_status:string;extraction_status:string}|null;
  delivery_id: string; version_id: string; status: 'pending' | 'received' | 'recoverable'; generation: number;
  reason_code: string | null; received_at: string | null; processing_id: string | null;
  extraction_status: string | null; candidate_count: number | null;
  files: { status: string; generation: number; reason_code: string | null; information: FileDescriptor | null; receipt: FileDescriptor | null; candidates: FileDescriptor | null };
}
function ordered(value:unknown):unknown {
  if(Array.isArray(value))return value.map(ordered);
  if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)]));
  return value;
}
export const jsonBytes = (value: unknown) => Buffer.from(JSON.stringify(ordered(value), null, 2) + '\n', 'utf8');
const text = { type: 'string', minLength: 1 }, nullableText = { type: ['string', 'null'] };
const id = { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' }, integer = { type: 'integer', minimum: 1 };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const strings = { type: 'array', items: text };
const artifact = object({ artifact_id: id, sha256: hash, size: { type: 'integer', minimum: 0 }, kind: text });
const material = object({ title: nullableText, publishedAtText: nullableText, url: { type: 'string' }, normalizerVersion: text,
  segments: { type: 'array', minItems: 1, items: object({ id, text: { type: 'string' }, rawLocator: text, kind: { enum: ['paragraph', 'table'] } }) },
  observedAtText: text, snapshotAtText: text, sourceIdentity: text,
}, ['title', 'publishedAtText', 'url', 'normalizerVersion', 'segments']);
const check = new Ajv2020({ strict: true, coerceTypes: false }).compile<InformationHandoff>(object({
  schema_version: { const: 'riskhot.information-handoff.v1' }, delivery_id: id, consumer: { const: 'F02' },
  information: object({ information_id: id, version_id: id, version_no: integer, previous_version_id: { anyOf: [id, { type: 'null' }] }, version_kind: { enum: ['initial', 'source_revision'] } }),
  source: object({ source_id: id, source_config_version: integer, catalog_key: text, name: text, connector: text, scope: text }),
  provenance: object({ operation_id: id, acquisition_id: id, collected_at: text, url: nullableText }), material,
  artifacts: object({ raw: artifact, normalized: artifact }),
  normalization: object({ version: text, content_digest: hash, checks: strings, attachment_status: { const: 'not_collected' }, limitations: strings }),
  saved: object({ operation_id: id, at: text }),
}));
export function validateInformationHandoff(value: unknown): InformationHandoff {
  if (!check(value)) throw new DomainError('HANDOFF_SCHEMA_INVALID', 422);
  return value as InformationHandoff;
}
export type SavedExtraction = ExtractionResult;
