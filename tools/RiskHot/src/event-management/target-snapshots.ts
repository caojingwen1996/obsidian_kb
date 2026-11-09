import {categoryVersion} from '../financial-objects/categories.js';
import {canonical,digest} from './contracts.js';
import {DomainError} from '../platform/types.js';
/** plain Target历史快照与AI-07扩展快照共用身份核验，不把元数据形状差异当成身份变化。 */
export function targetSnapshotPayload(target:Record<string,unknown>){
 return JSON.parse(canonical({category_version:categoryVersion,version:String(target.definition_version),name:target.target_name,status:target.is_active?'active':'disabled',...target})) as Record<string,unknown>;
}
export function validateTargetSnapshot(snapshot:{kind?:string;definition_id?:string;definition_version?:string;payload:unknown;digest:string},target:Record<string,unknown>){
 const payload=snapshot.payload;
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new DomainError('DEFINITION_VERSION_CONFLICT',409);
 const p=payload as Record<string,unknown>,expected=targetSnapshotPayload(target);
 if(snapshot.kind!==undefined&&snapshot.kind!=='target'||snapshot.definition_id!==undefined&&snapshot.definition_id!==target.id||snapshot.definition_version!==undefined&&snapshot.definition_version!==String(target.definition_version)||snapshot.digest!==digest(payload))throw new DomainError('DEFINITION_VERSION_CONFLICT',409);
 for(const k of ['id','target_name','aliases','categories','jurisdiction','scope_definition','is_active','definition_version']){
  if(!Object.hasOwn(p,k)||digest(p[k])!==digest(target[k]))throw new DomainError('DEFINITION_VERSION_CONFLICT',409);
 }
 for(const k of ['category_version','version','name','status'])if(Object.hasOwn(p,k)&&p[k]!==expected[k])throw new DomainError('DEFINITION_VERSION_CONFLICT',409);
 return snapshot;
}
