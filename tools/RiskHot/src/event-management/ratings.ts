import {randomUUID} from 'node:crypto';import {DomainError} from '../platform/types.js';import {digest,type RatingProposal,type IncrementKind} from './contracts.js';
export interface RatingInput {assessment_scope:Record<string,unknown>;research_horizon:Record<string,unknown>;method_version:string}
export interface RatingPlan extends RatingProposal {assessment_key:string;scope_key:string;m:number|null;rating_status:'draft'}
export const prepareRating=(kind:IncrementKind)=>!['SOURCE_ADDITION','DUPLICATE','UNRESOLVED'].includes(kind);
export function validateRating(input:RatingInput,p:RatingProposal):RatingPlan {
 if(digest(p.assessment_scope)!==digest(input.assessment_scope)||digest(p.research_horizon)!==digest(input.research_horizon)||p.method_version!==input.method_version)throw new DomainError('RATING_CONTEXT_MISMATCH');
 if(input.method_version!=='text-draft-v1'||p.dimensions.some(d=>d.score!==null))throw new DomainError('RATING_METHOD_UNAPPROVED');
 if(new Set(p.dimensions.map(d=>d.dimension_key)).size!==p.dimensions.length)throw new DomainError('RATING_DIMENSION_DUPLICATE');
 return {...p,assessment_key:randomUUID(),scope_key:digest({scope:p.assessment_scope,horizon:p.research_horizon}),m:null,rating_status:'draft'};
}
export function calculateM(method:{approved:boolean;weights:Record<string,number>},dimensions:Record<string,number>):number|null{
 if(!method.approved)return null;
 const keys=Object.keys(method.weights);if(keys.length!==Object.keys(dimensions).length||keys.some(k=>dimensions[k]===undefined))throw new DomainError('RATING_DIMENSIONS_MISSING');
 if(keys.some(k=>!Number.isFinite(dimensions[k])||dimensions[k]!<0||dimensions[k]!>5)||keys.some(k=>!Number.isFinite(method.weights[k])||method.weights[k]!<0)||Math.abs(Object.values(method.weights).reduce((a,b)=>a+b,0)-1)>1e-9)throw new DomainError('RATING_VALUE_INVALID');
 return Math.round(keys.reduce((sum,k)=>sum+dimensions[k]!*method.weights[k]!,0)*20*100)/100;
}
