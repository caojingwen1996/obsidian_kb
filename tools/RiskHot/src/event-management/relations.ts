import {DomainError} from '../platform/types.js';import type {RelationsProposal} from './contracts.js';import type {DefinitionSnapshot} from './definitions.js';
export function validateRelations(definitions:DefinitionSnapshot,p:RelationsProposal,allowReview=false):RelationsProposal {
 for(const t of p.targets)if(!definitions.targets.some(d=>d.id===t.target_id&&d.version===t.definition_version&&d.status==='active'))throw new DomainError('DEFINITION_INVALID',422);
 for(const v of p.variables){if(!p.targets.some(t=>t.target_id===v.target_id))throw new DomainError('TARGET_REQUIRED',422);if(!definitions.variables.some(d=>d.id===v.variable_id&&d.version===v.definition_version&&d.status==='active'))throw new DomainError('DEFINITION_INVALID',422);}
 if(p.unresolved_issues.length&&!allowReview)throw new DomainError('RELATION_REVIEW_REQUIRED',409);return p;
}
