import {Ajv2020} from 'ajv/dist/2020.js';
import {currentTaskSchema,assertCurrentEvidence,type MaterialEvidence} from './current-contracts.js';
import type {CurrentMaterial} from '../information-ingestion/processing/current-repository.js';
import {validateIdentity,type IdentityContext} from './identity.js';
import type {IdentityProposal} from './contracts.js';
import {DomainError} from '../platform/types.js';
const schema=new Ajv2020({strict:true,allErrors:true}).compile(currentTaskSchema('AI-02'));
export function validateEightStepIdentity(context:IdentityContext,value:unknown,materials:CurrentMaterial[]):IdentityProposal{
 if(!schema(value))throw new DomainError('IDENTITY_OUTPUT_INVALID',422);
 const p=value as IdentityProposal&{evidence_refs:MaterialEvidence[]};
 if(p.comparisons.length!==context.events.length||new Set(p.comparisons.map(c=>c.event_id)).size!==p.comparisons.length||p.comparisons.some(c=>!context.events.some(e=>e.id===c.event_id)))throw new DomainError('IDENTITY_COVERAGE_INVALID',422);
 for(const e of p.evidence_refs){const m=materials.find(m=>m.id===e.material_id);if(!m)throw new DomainError('IDENTITY_EVIDENCE_INVALID',422);assertCurrentEvidence(m,e);}
 if(p.decision==='NEW'&&(p.comparisons.some(c=>c.identity_match!==false)||p.unresolved_issues.length)||p.decision==='REUSE'&&(p.comparisons.filter(c=>c.identity_match===true).length!==1||p.comparisons.some(c=>c.identity_match===null)||p.comparisons.find(c=>c.identity_match===true)?.event_id!==p.matched_event_id||p.unresolved_issues.length)||p.decision==='UNRESOLVED'&&!p.unresolved_issues.length)throw new DomainError('IDENTITY_COVERAGE_INVALID',422);
 return validateIdentity(context,p);
}
