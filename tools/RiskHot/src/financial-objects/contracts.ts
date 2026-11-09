import {DomainError} from '../platform/types.js';
import {categoryVersion,targetCategories} from './categories.js';
export type Category={primary_category:string;secondary_category:string};
export interface ConfigValues {entry_kind:'directory'|'object';parent_id:string|null;name:string;sort_order:string;aliases:string[];categories:Category[];category_version:string|null;jurisdiction_mode:'unknown'|'specified'|'unrestricted';jurisdiction:string|null;scope_definition:string|null;status:'draft'|'active'|'disabled'}
export interface Config extends ConfigValues {id:string;config_version:string;identity_version:string;current_snapshot_id:string;created_by:string;updated_by:string;created_at:Date|string;updated_at:Date|string}
export interface ConfigInput extends ConfigValues {reason:string;expected_config_version?:string;same_identity?:boolean;impact_token?:string}
export interface Observation {id:string;config_id:string;adopted_snapshot_id:string;adopted_identity_version:string;state:'active'|'paused'|'ended';state_reason:'manual'|'config_unavailable'|'definition_changed';note:string;version:string;created_by:string;updated_by:string;created_at:Date|string;updated_at:Date|string}
export interface Mapping {id:string;config_id:string;target_id:string;config_snapshot_id:string;config_identity_version:string;target_snapshot_id:string;target_version:string;state:'approved'|'conflict'|'pending'|'revoked';reason:string;version:string;reviewed_by:string;reviewed_at:Date|string}
export interface History {id:string;entity_kind:'observation'|'mapping';observation_id:string|null;mapping_id:string|null;actor:string;action:string;reason:string;before_value:unknown;after_value:unknown;created_at:string}
export interface Snapshot {id:string;kind:string;definition_id:string;definition_version:string;payload:unknown;digest:string}
export interface Bundle {same_identity?:boolean;identity_confirmed?:boolean;reason?:string;config?:Config;snapshots?:Snapshot[];observations?:Observation[];mappings?:Mapping[];history?:History[]}
export interface Query {q?:string;category?:string;jurisdiction?:string;status?:string;parent_id?:string;offset?:string;limit?:string;from?:string;to?:string}
export function fail(code:string,status=422):never {throw new DomainError(code,status);}
export const reason=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.length>2000)fail('M4_REASON_REQUIRED');return (value as string).trim();};
export const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const version=(value:unknown)=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
export function normalize(input:ConfigInput):ConfigValues{
 if(!input||typeof input!=='object')fail('M4_DEFINITION_INVALID');reason(input.reason);
 if(!['directory','object'].includes(input.entry_kind)||!['draft','active','disabled'].includes(input.status)||!['unknown','specified','unrestricted'].includes(input.jurisdiction_mode))fail('M4_DEFINITION_INVALID');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>200||input.parent_id!==null&&!uuid(input.parent_id)||typeof input.sort_order!=='string'||!/^\d{1,19}$/.test(input.sort_order)||BigInt(input.sort_order)>9223372036854775807n)fail('M4_DEFINITION_INVALID');
 if(!Array.isArray(input.aliases)||input.aliases.length>200||input.aliases.some(a=>typeof a!=='string'||!a.trim()||a.trim().length>200)||!Array.isArray(input.categories)||input.categories.length>33)fail('M4_DEFINITION_INVALID');
 if(input.categories.some(c=>!c||Object.keys(c).sort().join(',')!=='primary_category,secondary_category'||!Object.hasOwn(targetCategories,c.primary_category)||!targetCategories[c.primary_category]?.includes(c.secondary_category)))fail('M4_CATEGORY_INVALID');
 const aliases=[...new Set(input.aliases.map(a=>a.trim()))].sort(),categories=[...input.categories].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 if(new Set(categories.map(c=>JSON.stringify(c))).size!==categories.length||categories.length&&input.category_version!==categoryVersion||!categories.length&&input.category_version!==null)fail('M4_CATEGORY_INVALID');
 const scope=input.scope_definition===null?null:typeof input.scope_definition==='string'?input.scope_definition.trim()||null:fail('M4_DEFINITION_INVALID');
 const jurisdiction=input.jurisdiction===null?null:typeof input.jurisdiction==='string'?input.jurisdiction.trim()||null:fail('M4_JURISDICTION_INVALID');
 if(scope&&scope.length>8000||jurisdiction&&jurisdiction.length>200||(input.jurisdiction_mode==='specified'?!jurisdiction:jurisdiction!==null))fail('M4_JURISDICTION_INVALID');
 if(input.entry_kind==='directory'&&(aliases.length||categories.length)||input.entry_kind==='object'&&!input.parent_id)fail('M4_DEFINITION_INVALID');
 if(input.entry_kind==='object'&&input.status==='active'&&(!scope||!categories.length||input.jurisdiction_mode==='unknown'))fail('M4_DEFINITION_INCOMPLETE');
 return {entry_kind:input.entry_kind,parent_id:input.parent_id,name:input.name.trim(),sort_order:String(BigInt(input.sort_order)),aliases,categories,category_version:input.category_version,jurisdiction_mode:input.jurisdiction_mode,jurisdiction,scope_definition:scope,status:input.status};
}
export function values(c:Config):ConfigValues{return {entry_kind:c.entry_kind,parent_id:c.parent_id,name:c.name,sort_order:c.sort_order,aliases:c.aliases,categories:c.categories,category_version:c.category_version,jurisdiction_mode:c.jurisdiction_mode,jurisdiction:c.jurisdiction,scope_definition:c.scope_definition,status:c.status};}
export function selectable(c:Config,configs:Config[]):string|null{
 if(c.entry_kind!=='object')return '分组节点不能建立观察';
 let node:Config|undefined=c;const seen=new Set<string>();
 while(node){if(seen.has(node.id))return '节点关系异常';seen.add(node.id);if(node.status!=='active')return node.id===c.id?'对象尚未启用':`上级分组节点「${node.name}」尚未启用`;node=node.parent_id?configs.find(p=>p.id===node!.parent_id):undefined;}
 return null;
}
export function paging(query:Query){const offset=Number(query.offset??0),limit=Number(query.limit??20);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)fail('PAGINATION_INVALID',400);return {offset,limit};}
export const page=<T>(all:T[],query:Query)=>{const {offset,limit}=paging(query);return {items:all.slice(offset,offset+limit),total:all.length,offset,limit,next_offset:offset+limit<all.length?offset+limit:null};};
