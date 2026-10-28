import {DomainError} from '../platform/types.js';
import type {TimeValue} from './contracts.js';

// A partial date remains partial; JavaScript Date must never fill in missing precision.
export function normalizeEventTime(value:string|null):string|null {
 if(value===null)return null;
 if(typeof value!=='string')throw new DomainError('TIME_INVALID');
 if(/^\d{4}(-\d{2})?(-\d{2})?$/.test(value)){
  const [year,month,day]=value.split('-').map(Number);
  if(!year||month!==undefined&&(month<1||month>12)||day!==undefined&&(day<1||day>[31,(year!%4===0&&(year!%100!==0||year!%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][month!-1]!))throw new DomainError('TIME_INVALID');
  return value;
 }
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value))throw new DomainError('TIME_INVALID');
 normalizeEventTime(value.slice(0,10));if(Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||Number(value.slice(17,19))>59)throw new DomainError('TIME_INVALID');const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new DomainError('TIME_INVALID');return date.toISOString();
}
export function legacyEventTime(value:TimeValue|null|undefined,action?:string):string|null {
 if(!value||!['occurred','announced'].includes(value.kind))return null;
 if(value.kind==='announced'&&!/宣布|发布|公告|披露|公示/.test(action??''))return null;
 const raw=value.precision==='timestamp'?value.start:value.start??value.text;
 if(!raw)return null;
 const partial=raw.replace(/年/g,'-').replace(/月/g,'-').replace(/日/g,'').replace(/-$/,'');
 try{return normalizeEventTime(value.precision==='day'?partial.slice(0,10):partial);}catch{return null;}
}
export function mayProjectTime(previous:string|null,next:string|null):boolean{
 if(!next)return previous===null;
 if(!previous)return true;
 const a=normalizeEventTime(previous)!,b=normalizeEventTime(next)!;
 return a.length===b.length&&b>=a;
}
