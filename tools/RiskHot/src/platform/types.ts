export class DomainError extends Error {
  constructor(public code: string, public status = 422, public retryable = false) { super(code); }
}

export interface CatalogEntry {
  id: string; name: string; url: string; tier: string; group: string; focus: string; context: string;
}
export interface SourceItem { url: string; title: string }
export interface Segment { id: string; text: string; rawLocator: string; kind: 'paragraph' | 'table' }
export interface NormalizedMaterial {
  title: string | null; publishedAtText: string | null; url: string;
  normalizerVersion: string; segments: Segment[];
  observedAtText?: string; sourceIdentity?: string;
}
export interface EvidenceRef { segment_id: string; start_cp: number; end_cp: number; quote: string }
export interface Candidate {
  title: string; description: string; subject_name: string | null; action: string;
  stage: string | null; time: { text: string; kind: string; precision: string } | null;
  uncertainties: string[]; evidence: EvidenceRef[];
}
export interface ExtractionResult {
  covered_segment_ids: string[]; candidates: Candidate[]; no_event_reason: string | null; warnings: string[];
}
export interface ModelResponse { complete: boolean; data: unknown; finishReason: string; usage?: Record<string, number> }
