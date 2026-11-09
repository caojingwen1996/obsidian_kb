import type {FastifyInstance} from 'fastify';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {TargetQueries,type TargetQuery} from '../event-management/target-queries.js';
import {targetCategories} from '../event-management/target-identity-contracts.js';
import {TargetCatalog,type TargetDraft,type TargetEdit} from '../event-management/target-catalog.js';
import {DomainError} from '../platform/types.js';
const pagination={offset:{type:'string',pattern:'^\\d{1,12}$'},limit:{type:'string',pattern:'^\\d{1,3}$'}};
const uuid={type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'};
const text=(maxLength:number)=>({type:'string',minLength:1,maxLength,pattern:'\\S'});
const fields={target_name:text(200),aliases:{type:'array',maxItems:40,uniqueItems:true,items:text(200)},categories:{type:'array',minItems:1,maxItems:33,uniqueItems:true,items:{type:'object',additionalProperties:false,required:['primary_category','secondary_category'],properties:{primary_category:{enum:Object.keys(targetCategories)},secondary_category:text(100)}}},jurisdiction:{anyOf:[text(200),{type:'null'}]},scope_definition:text(8000),is_active:{type:'boolean'},reason:text(2000)};
const idParams={type:'object',additionalProperties:false,required:['id'],properties:{id:uuid}};
const key=(headers:Record<string,unknown>)=>{const value=headers['idempotency-key'];if(typeof value!=='string'||!/^\S{1,128}$/.test(value))throw new DomainError('IDEMPOTENCY_KEY_INVALID',400);return value;};
export function registerTargets(app:FastifyInstance,repo:Repository){
 const queries=new TargetQueries(repo),catalog=new TargetCatalog(repo);
 app.get('/api/v1/targets',{schema:{querystring:{type:'object',additionalProperties:false,properties:{...pagination,q:{type:'string',maxLength:200},category:{enum:['',...Object.keys(targetCategories)]},status:{enum:['all','active','inactive']}}}}},request=>queries.list(request.actor,request.query as TargetQuery));
 app.get('/api/v1/targets/:id',{schema:{params:{type:'object',additionalProperties:false,required:['id'],properties:{id:{type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'}}},querystring:{type:'object',additionalProperties:false,properties:pagination}}},request=>queries.detail(request.actor,(request.params as {id:string}).id,request.query as TargetQuery));
 app.post('/api/v1/targets',{schema:{body:{type:'object',additionalProperties:false,required:Object.keys(fields),properties:fields}}},async(request,reply)=>reply.code(201).send(await catalog.save(request.actor,request.body as TargetDraft,key(request.headers))));
 app.put('/api/v1/targets/:id',{schema:{params:idParams,body:{type:'object',additionalProperties:false,required:[...Object.keys(fields),'expected_version'],properties:{...fields,expected_version:{type:'integer',minimum:1}}}}},request=>catalog.save(request.actor,request.body as TargetEdit,key(request.headers),(request.params as {id:string}).id));
}
