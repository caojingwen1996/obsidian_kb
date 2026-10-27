import type { FastifyInstance } from 'fastify';
import type { ExecutionStore } from '../information-ingestion/processing/execution.js';
import { InformationDelivery } from '../information-ingestion/processing/handoff.js';
import { DomainError } from '../platform/types.js';
import type { HandoffFileName } from '../platform/handoff-files.js';

export function registerHandoff(app:FastifyInstance,repo:ExecutionStore):void {
  const service=new InformationDelivery(repo),id={type:'string',pattern:'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'};
  const params={type:'object',additionalProperties:false,required:['id'],properties:{id}};
  app.get('/api/v1/l0/versions/:id/delivery',{schema:{params}},request=>service.view((request.params as {id:string}).id,request.actor));
  app.get('/api/v1/l0/versions/:id/delivery/files/:name',{schema:{params:{...params,required:['id','name'],properties:{id,name:{enum:['information','receipt','candidates']}}}}},async(request,reply)=>{
    const {id:version,name}=request.params as {id:string;name:HandoffFileName};
    const view=await service.view(version,request.actor),file=view.files[name];
    if(!file)throw new DomainError('HANDOFF_FILE_UNAVAILABLE',503);
    const bytes=await service.files.read(view.delivery_id,name,{sha256:file.sha256,size:file.size,kind:name},view.processing_id??undefined);
    return reply.header('content-type','application/json; charset=utf-8').header('content-disposition',`attachment; filename="${name}-${version}.json"`).header('cache-control','no-store').header('content-security-policy',"sandbox; default-src 'none'").send(bytes);
  });
  for(const files of [false,true])app.post(`/api/v1/l0/versions/:id/delivery/${files?'files/retry':'retry'}`,{schema:{params,body:{type:'object',additionalProperties:false,required:['expected_generation','reason'],properties:{expected_generation:{type:'integer',minimum:1},reason:{type:'string',minLength:1,maxLength:2000}}}}},async(request,reply)=>{
    const key=request.headers['idempotency-key'];if(typeof key!=='string')throw new DomainError('IDEMPOTENCY_KEY_INVALID',400);
    const view=await service.view((request.params as {id:string}).id,request.actor),body=request.body as {expected_generation:number;reason:string};
    return reply.code(202).send(await (files?service.retryFiles(view.delivery_id,request.actor,body,key):service.retry(view.delivery_id,request.actor,body,key)));
  });
}
