import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {fixture} from './f02-fixture.js';
import {applyF02Migration} from '../platform/f02-migration.js';
import {applyM4Migration} from '../platform/m4-migration.js';
import {grantIngestionRoles} from '../platform/ingestion-grants.js';
import {Repository} from '../information-ingestion/processing/repository.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {FinancialObjects} from '../financial-objects/service.js';
import type {ConfigInput} from '../financial-objects/contracts.js';
export const directory=(name='货币目录'):ConfigInput=>({entry_kind:'directory',parent_id:null,name,sort_order:'0',aliases:[],categories:[],category_version:null,jurisdiction_mode:'unknown',jurisdiction:null,scope_definition:null,status:'active',reason:'隔离测试'});
export const object=(parent_id:string,name='美元'):ConfigInput=>({...directory(name),entry_kind:'object',parent_id,aliases:['USD'],categories:[{primary_category:'货币与货币形态',secondary_category:'货币单位'}],category_version:'financial-target-categories-v1',jurisdiction_mode:'specified',jurisdiction:'美国',scope_definition:'美元货币单位，不含美元融资市场。'});
export async function prepared(){const x=await fixture(true);try{await applyF02Migration(x.db);await applyM4Migration(x.db);await grantIngestionRoles(x.db);
 await x.db.query("UPDATE platform.actors SET permissions=ARRAY['read','event_review','financial_config_manage','observation_manage','target_mapping_review'] WHERE subject='operator'");
 await x.db.query("INSERT INTO platform.actors VALUES('other',ARRAY['read','observation_manage'],ARRAY['*']),('reader',ARRAY['read'],ARRAY['test']),('configurer',ARRAY['read','financial_config_manage'],ARRAY['*']),('observer',ARRAY['read','observation_manage'],ARRAY['*']),('reviewer',ARRAY['read','target_mapping_review'],ARRAY['*'])");
 const role=new Pool({connectionString:x.db.options.connectionString,options:'-c role=riskhot_api'}),repo=new Repository(role,new ArtifactStore('/tmp/riskhot-m4-unused')),service=new FinancialObjects(repo);
 const save=(input:ConfigInput,id?:string)=>service.save('operator',input,randomUUID(),id);
 return {...x,role,repo,service,save,async close(){await role.end();await x.close();}};
 }catch(error){await x.close();throw error;}
}
