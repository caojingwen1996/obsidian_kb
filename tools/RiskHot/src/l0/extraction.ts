import { Ajv2020 } from 'ajv/dist/2020.js';
import { DomainError, type ExtractionResult, type ModelResponse, type NormalizedMaterial } from '../platform/types.js';

const string = { type: 'string', minLength: 1, maxLength: 8000 };
const optionalString = { anyOf: [string, { type: 'null' }] };
export const extractionSchema = {
  $id: 'riskhot.ai01.extraction-only.v1', type: 'object', additionalProperties: false,
  required: ['covered_segment_ids', 'candidates', 'no_event_reason', 'warnings'],
  properties: {
    covered_segment_ids: { type: 'array', uniqueItems: true, items: string },
    no_event_reason: optionalString, warnings: { type: 'array', maxItems: 50, items: string },
    candidates: { type: 'array', maxItems: 50, items: {
      type: 'object', additionalProperties: false,
      required: ['title', 'description', 'subject_name', 'action', 'stage', 'time', 'uncertainties', 'evidence'],
      properties: {
        title: string, description: string, subject_name: optionalString, action: string, stage: optionalString,
        time: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['text', 'kind', 'precision'], properties: { text: string, kind: string, precision: string } }] },
        uncertainties: { type: 'array', maxItems: 30, items: string },
        evidence: { type: 'array', minItems: 1, maxItems: 50, items: {
          type: 'object', additionalProperties: false, required: ['segment_id', 'start_cp', 'end_cp', 'quote'],
          properties: { segment_id: string, start_cp: { type: 'integer', minimum: 0 }, end_cp: { type: 'integer', minimum: 1 }, quote: string },
        } },
      },
    } },
  },
} as const;
const check = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false, removeAdditional: false }).compile(extractionSchema);

export function validateExtraction(response: ModelResponse, material: NormalizedMaterial): ExtractionResult {
  if (!response.complete) throw new DomainError('MODEL_INCOMPLETE');
  if (!check(response.data)) throw new DomainError('MODEL_SCHEMA_INVALID');
  const data = response.data as ExtractionResult;
  const segments = new Map(material.segments.map(x => [x.id, x]));
  if (data.covered_segment_ids.length !== segments.size || data.covered_segment_ids.some(id => !segments.has(id))) throw new DomainError('MODEL_COVERAGE_INVALID');
  if (!data.candidates.length && !data.no_event_reason) throw new DomainError('NO_EVENT_REASON_MISSING');
  for (const candidate of data.candidates) for (const evidence of candidate.evidence) {
    const segment = segments.get(evidence.segment_id);
    const codepoints = Array.from(segment?.text ?? '');
    if (!segment || evidence.start_cp >= evidence.end_cp || evidence.end_cp > codepoints.length || codepoints.slice(evidence.start_cp, evidence.end_cp).join('') !== evidence.quote) {
      throw new DomainError('MODEL_EVIDENCE_INVALID');
    }
  }
  return data;
}
