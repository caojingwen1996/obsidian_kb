import {DomainError} from '../platform/types.js';
import {type FullCandidate,type IncrementProposal} from './contracts.js';
import {normalizeEventTime,mayProjectTime} from './time.js';
export interface IncrementContext {is_new:boolean;facts:{id:string;description:string}[];event?:Record<string,any>|null;candidate?:FullCandidate}
export interface IncrementPlan extends IncrementProposal {needs_rating:boolean;review_required:boolean}
export function validateIncrement(context:IncrementContext,p:IncrementProposal):IncrementPlan {
 const substantive=['NEW_EVENT','EVENT_PROGRESS','MATERIAL_ADDITION','CORRECTION'].includes(p.classification);
 if(['SOURCE_ADDITION','DUPLICATE'].includes(p.classification)&&(p.changes.length||p.current_event))throw new DomainError('INCREMENT_INVALID');
 if(p.classification==='NEW_EVENT'&&!context.is_new||context.is_new&&!['NEW_EVENT','UNRESOLVED'].includes(p.classification))throw new DomainError('IDENTITY_RECHECK_REQUIRED',409);
 if(substantive&&!p.changes.length)throw new DomainError('INCREMENT_CHANGES_REQUIRED');
 if(context.is_new&&!p.current_event||p.classification==='CORRECTION'&&!p.current_event)throw new DomainError('CURRENT_FACTS_REQUIRED');
 for(const change of p.changes){
  if(change.basis_fact_ids.some(id=>!context.facts.some(f=>f.id===id)))throw new DomainError('UNKNOWN_FACT_REFERENCE');
  if(p.classification==='CORRECTION'&&!change.basis_fact_ids.length)throw new DomainError('CORRECTION_BASIS_REQUIRED');
 }
 if(p.current_event){
  if(!p.current_event.subject.trim()||!p.current_event.action.trim())throw new DomainError('EVENT_IDENTITY_REQUIRED');
  p={...p,current_event:{...p.current_event,event_time:normalizeEventTime(p.current_event.event_time)}};
  if(context.event&&p.classification!=='CORRECTION'&&!mayProjectTime(context.event.event_time,p.current_event!.event_time))throw new DomainError('CURRENT_FACTS_TIME_REVIEW_REQUIRED',409);
 }
 return {...p,needs_rating:substantive,review_required:p.classification==='UNRESOLVED'||p.unresolved_issues.length>0};
}
