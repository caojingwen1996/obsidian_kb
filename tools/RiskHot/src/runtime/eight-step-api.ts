import type {FastifyInstance} from 'fastify';
import type {Repository} from '../information-ingestion/processing/repository.js';
import type {EventOptions} from '../event-management/store.js';
import {DomainError} from '../platform/types.js';
export interface EightStepApiService {read(id:string,actor:string):Promise<unknown>;start(id:string,actor:string,options:EventOptions,key:string):Promise<unknown>;review(id:string,actor:string,body:{node_key:string;proposal_digest:string;reason:string},key:string):Promise<unknown>;resume(id:string,actor:string,key:string):Promise<unknown>}
const uuid={type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'},text={type:'string',minLength:1,maxLength:2000,pattern:'\\S'};
const object=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)}),params=object({id:uuid});
const key=(headers:Record<string,unknown>)=>{const value=headers['idempotency-key'];if(typeof value!=='string'||!/^\S{1,128}$/.test(value))throw new DomainError('IDEMPOTENCY_KEY_INVALID',400);return value;};
export function registerEightStepApi(app:FastifyInstance,repo:Repository,provided?:EightStepApiService){
 let owned:Promise<EightStepApiService>|undefined;
 const service=()=>provided?Promise.resolve(provided):owned??=import('../event-management/eight-step-service.js').then(({EightStepService})=>new EightStepService(repo));
 app.get('/api/v1/f02/candidates/:id',{schema:{params}},async request=>(await service()).read((request.params as {id:string}).id,request.actor));
 app.post('/api/v1/f02/material/:id/start',{schema:{params,body:object({task_manifest_id:{const:'f02-eight-step-v1'},definition_ref:text,assessment_scope:{type:'object',minProperties:1},research_horizon:{type:'object',minProperties:1},method_version:{const:'text-draft-v1'},reason:text})}},async(request,reply)=>reply.code(202).send(await(await service()).start((request.params as {id:string}).id,request.actor,request.body as EventOptions,key(request.headers))));
 app.post('/api/v1/f02/candidates/:id/reviews',{schema:{params,body:object({node_key:{enum:['recognize_targets','resolve_event','resolve_target','commit_event']},proposal_digest:{type:'string',pattern:'^[a-f0-9]{64}$'},reason:text})}},async(request,reply)=>reply.code(202).send(await(await service()).review((request.params as {id:string}).id,request.actor,request.body as {node_key:string;proposal_digest:string;reason:string},key(request.headers))));
 app.post('/api/v1/f02/candidates/:id/resume',{schema:{params,body:object({})}},async(request,reply)=>reply.code(202).send(await(await service()).resume((request.params as {id:string}).id,request.actor,key(request.headers))));
}
