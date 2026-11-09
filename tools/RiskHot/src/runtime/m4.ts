import type {FastifyInstance} from 'fastify';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {FinancialObjects,type ObservationInput,type ObservationChange,type MappingInput} from '../financial-objects/service.js';
import type {ConfigInput,Query} from '../financial-objects/contracts.js';
import {DomainError} from '../platform/types.js';
const uuid={type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'},version={type:'string',pattern:'^[1-9][0-9]{0,18}$'};
const nullable=(s:object)=>({anyOf:[s,{type:'null'}]}),text=(maxLength:number)=>({type:'string',maxLength});
const reason={...text(2000),minLength:1,pattern:'\\S'};
const obj=(properties:Record<string,unknown>,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const params=obj({id:uuid});
const configFields={entry_kind:{enum:['directory','object']},parent_id:nullable(uuid),name:{...text(200),minLength:1},sort_order:{type:'string',pattern:'^[0-9]{1,19}$'},aliases:{type:'array',maxItems:200,items:text(200)},categories:{type:'array',maxItems:33,items:obj({primary_category:text(100),secondary_category:text(100)})},category_version:nullable(text(100)),jurisdiction_mode:{enum:['unknown','specified','unrestricted']},jurisdiction:nullable(text(200)),scope_definition:nullable(text(8000)),status:{enum:['draft','active','disabled']},reason};
const configSchema=obj({...configFields,expected_config_version:version,same_identity:{type:'boolean'},impact_token:{type:'string',pattern:'^[a-f0-9]{64}$'}},Object.keys(configFields));
const query=obj({q:text(200),category:text(100),jurisdiction:text(200),status:text(20),parent_id:{anyOf:[uuid,{const:'root'}]},offset:{type:'string',pattern:'^[0-9]{1,12}$'},limit:{type:'string',pattern:'^[0-9]{1,3}$'},from:{type:'string',pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'},to:{type:'string',pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'}},[]);
const observation=obj({config_id:uuid,expected_config_version:version,reason,note:text(8000)},['config_id','expected_config_version','reason']);
const key=(h:Record<string,unknown>)=>{const k=h['idempotency-key'];if(typeof k!=='string'||!(/^[\x21-\x7e]{1,128}$/).test(k))throw new DomainError('IDEMPOTENCY_KEY_INVALID',400);return k;};
export function registerM4(app:FastifyInstance,repo:Repository){
 const service=new FinancialObjects(repo);
 app.get('/api/v1/m4/configs',{schema:{querystring:query}},r=>service.configs(r.actor,r.query as Query));
 app.get('/api/v1/m4/configs/:id',{schema:{params}},r=>service.configDetail(r.actor,(r.params as {id:string}).id));
 app.post('/api/v1/m4/configs',{schema:{body:configSchema}},async(r,reply)=>reply.code(201).send(await service.save(r.actor,r.body as ConfigInput,key(r.headers))));
 app.put('/api/v1/m4/configs/:id',{schema:{params,body:configSchema}},r=>service.save(r.actor,r.body as ConfigInput,key(r.headers),(r.params as {id:string}).id));
 app.post('/api/v1/m4/configs/:id/impact',{schema:{params,body:configSchema}},r=>service.preview(r.actor,(r.params as {id:string}).id,r.body as ConfigInput));
 app.get('/api/v1/m4/observations',{schema:{querystring:query}},r=>service.observations(r.actor,r.query as Query));
 app.get('/api/v1/m4/observations/:id',{schema:{params,querystring:query}},r=>service.observationDetail(r.actor,(r.params as {id:string}).id,r.query as Query));
 app.post('/api/v1/m4/observations',{schema:{body:observation}},async(r,reply)=>reply.code(201).send(await service.add(r.actor,r.body as ObservationInput,key(r.headers))));
 app.post('/api/v1/m4/observations/batch',{schema:{body:obj({items:{type:'array',minItems:1,maxItems:100,items:observation}})}},r=>service.batch(r.actor,(r.body as {items:ObservationInput[]}).items,key(r.headers)));
 app.put('/api/v1/m4/observations/:id',{schema:{params,body:obj({action:{enum:['pause','end','restore','note']},expected_version:version,expected_config_version:version,reason,note:text(8000)},['action','expected_version','reason'])}},r=>service.changeObservation(r.actor,(r.params as {id:string}).id,r.body as ObservationChange,key(r.headers)));
 app.post('/api/v1/m4/mappings',{schema:{body:obj({config_id:uuid,target_id:uuid,expected_config_version:version,expected_target_version:version,decision:{enum:['approve','conflict','revoke']},identity_confirmed:{type:'boolean'},reason,mapping_id:uuid,expected_version:version},['config_id','target_id','expected_config_version','expected_target_version','decision','identity_confirmed','reason'])}},r=>service.map(r.actor,r.body as MappingInput,key(r.headers)));
}
