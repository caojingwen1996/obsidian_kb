import type {Repository} from '../information-ingestion/processing/repository.js';import {DomainError} from '../platform/types.js';import {digest} from './contracts.js';
export interface Definition {id:string;version:string;name:string;status:string;[key:string]:unknown}
export interface DefinitionSnapshot {ref:string;owner:string;version:string;digest:string;targets:Definition[];variables:Definition[]}
export async function readDefinitions(repo:Repository,ref:string):Promise<DefinitionSnapshot>{
 const row=(await repo.db.query("SELECT * FROM information.definition_sets WHERE ref=$1 AND coverage_status='complete'",[ref])).rows[0];if(!row)throw new DomainError('DEFINITIONS_UNAVAILABLE',503);
 if(digest(row.payload)!==row.digest||!row.owner||!row.version||!Array.isArray(row.payload.targets)||!Array.isArray(row.payload.variables)||row.payload.targets.length>100||row.payload.variables.length>100)throw new DomainError('DEFINITION_INTEGRITY',503);
 for(const d of [...row.payload.targets,...row.payload.variables])if(!d.id||!d.version||!d.name||!['active','disabled'].includes(d.status))throw new DomainError('DEFINITION_INTEGRITY',503);
 return {ref,owner:row.owner,version:row.version,digest:row.digest,targets:row.payload.targets,variables:row.payload.variables};
}
