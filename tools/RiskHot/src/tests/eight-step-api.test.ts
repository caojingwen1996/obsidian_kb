import test from 'node:test';
import assert from 'node:assert/strict';
import {Ajv2020} from 'ajv/dist/2020.js';
import {DomainError} from '../platform/types.js';
import Fastify from 'fastify';
import {registerEightStepApi} from '../runtime/eight-step-api.js';
const id='00000000-0000-4000-8000-000000000001',hash='a'.repeat(64);
test('八步API读写分离、固定任务包、严格复核和幂等键',async()=>{
 const calls:unknown[]=[];const fake={read:async(...args:unknown[])=>{calls.push(['read',...args]);return {candidate:{id},nodes:[]};},start:async(...args:unknown[])=>{calls.push(['start',...args]);return {id};},review:async(...args:unknown[])=>{calls.push(['review',...args]);return {accepted:true};},resume:async(...args:unknown[])=>{calls.push(['resume',...args]);return {accepted:true};}};
 const app=Fastify();const validator=new Ajv2020({strict:false,removeAdditional:false});app.setValidatorCompiler(({schema})=>validator.compile(schema as object));app.setErrorHandler((error:any,_req,reply)=>reply.code(error instanceof DomainError?error.status:error.validation?400:500).send({error:{code:error.code}}));app.decorateRequest('actor','reader');registerEightStepApi(app,null as any,fake as any);await app.ready();try{
 assert.equal((await app.inject(`/api/v1/f02/candidates/${id}`)).statusCode,200);
 assert.equal((await app.inject(`/api/v1/f02/candidates/${id}/reviews`)).statusCode,404);
 const request={method:'POST' as const,url:`/api/v1/f02/candidates/${id}/reviews`,headers:{'idempotency-key':'stable'},payload:{node_key:'resolve_target',proposal_digest:hash,reason:'核对原文'}};
 assert.equal((await app.inject({...request,payload:{...request.payload,approved:true}})).statusCode,400);
 assert.equal((await app.inject({...request,headers:{}})).statusCode,400);
 assert.equal((await app.inject(request)).statusCode,202);assert.equal((calls.at(-1) as any)[3].proposal_digest,hash);
 assert.equal((await app.inject({method:'POST',url:`/api/v1/f02/material/${id}/start`,headers:request.headers,payload:{task_manifest_id:'f02-fact-draft-v2'}})).statusCode,400);
 }finally{await app.close();}
});
