const reviewErrors = new Set(['MODEL_SCHEMA_INVALID', 'MODEL_EVIDENCE_INVALID', 'MODEL_EVIDENCE_AMBIGUOUS', 'MODEL_COVERAGE_INVALID', 'MODEL_JSON_INVALID', 'MODEL_RESPONSE_INVALID', 'MODEL_INCOMPLETE', 'NO_EVENT_REASON_MISSING', 'MODEL_RESPONSE_TOO_LARGE', 'MODEL_EMPTY_RESPONSE']);
export const requiresOutputReview = (code: string) => reviewErrors.has(code);
export const retryableModelFailure = (code: string) => code === 'MODEL_NETWORK_ERROR' || code === 'IO_UNAVAILABLE' || /^MODEL_HTTP_(429|5\d\d)$/.test(code);
