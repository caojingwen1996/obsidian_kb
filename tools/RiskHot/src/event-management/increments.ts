import {randomUUID} from 'node:crypto';import {DomainError} from '../platform/types.js';import {canonical,type Change,type IncrementProposal} from './contracts.js';
export interface HistoricalUpdate {id:string;business_change_key:string;update_type:string;summary:string;previous_status:string|null;current_status:string|null;effective_time:unknown}
export interface IncrementContext {is_new:boolean;updates:HistoricalUpdate[]}
export interface IncrementPlan extends Omit<IncrementProposal,'changes'> {changes:(Change&{business_change_key:string})[];needs_rating:boolean;review_required:boolean}
export function validateIncrement(context:IncrementContext,p:IncrementProposal):IncrementPlan {
 if(['SOURCE_ADDITION','DUPLICATE'].includes(p.classification)&&p.changes.length)throw new DomainError('INCREMENT_INVALID');
 if(p.classification==='NEW_EVENT'&&!context.is_new||context.is_new&&!['NEW_EVENT','UNRESOLVED'].includes(p.classification))throw new DomainError('IDENTITY_RECHECK_REQUIRED',409);
 if(['NEW_EVENT','EVENT_PROGRESS','MATERIAL_ADDITION','CORRECTION'].includes(p.classification)&&!p.changes.length)throw new DomainError('INCREMENT_CHANGES_REQUIRED');
 const changes=p.changes.map(change=>{if(change.supersedes_update_ids.some(id=>!context.updates.some(u=>u.id===id)))throw new DomainError('UNKNOWN_UPDATE_REFERENCE');if(p.classification==='CORRECTION'&&!change.supersedes_update_ids.length)throw new DomainError('CORRECTION_BASIS_REQUIRED');
  const existing=context.updates.find(u=>u.update_type===change.update_type&&u.summary===change.summary&&u.previous_status===change.previous_status&&u.current_status===change.current_status&&canonical(u.effective_time)===canonical(change.effective_time));
  return {...change,business_change_key:existing?.business_change_key??randomUUID()};
 });return {...p,changes,needs_rating:!['SOURCE_ADDITION','DUPLICATE','UNRESOLVED'].includes(p.classification),review_required:p.classification==='UNRESOLVED'||p.unresolved_issues.length>0};
}
