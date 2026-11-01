import PgBoss from 'pg-boss';
import type {Pool} from 'pg';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { database, required } from '../platform/db.js';
import { executionEngine } from '../platform/current-dispatch.js';
import { registerBusinessWorker, cancelActiveBusinessJobs, type BusinessHandler, type PeriodicHandler } from './business-worker.js';
import type { BUSINESS_QUEUES } from '../platform/business-queue.js';

if(executionEngine()!=='pg-boss')throw new Error('BUSINESS_ENGINE_NOT_SELECTED');
const modulePath=resolve(process.env.BUSINESS_HANDLERS_MODULE??'src/runtime/f02-business-handlers.ts');
const within=relative(resolve('src/runtime'),modulePath);
if(within.startsWith('..') || !within.endsWith('.ts'))throw new Error('BUSINESS_HANDLERS_MODULE_INVALID');
const db=database('BUSINESS_DATABASE_URL');
const boss=new PgBoss({connectionString:required('BUSINESS_DATABASE_URL'),migrate:false,supervise:true,schedule:true});
boss.on('error',()=>{console.error('BUSINESS_QUEUE_RUNTIME_ERROR');});
let stopWork:(()=>Promise<void>)|undefined;
let stopping=false;
const stop=async()=>{
 if(stopping)return;stopping=true;cancelActiveBusinessJobs();
 try{await stopWork?.();await boss.stop({wait:true,timeout:30_000});}finally{await db.end();}
};
process.once('SIGTERM',()=>{void stop();});process.once('SIGINT',()=>{void stop();});
try{
 const module=await import(pathToFileURL(modulePath).href) as {createHandlers:(db:Pool)=>Promise<{
  business:Partial<Record<typeof BUSINESS_QUEUES[number],BusinessHandler>>;
  periodic:Record<'sources.schedule'|'ops.recover'|'ops.alerts',PeriodicHandler>;
 }>};
 if(typeof module.createHandlers!=='function')throw new Error('BUSINESS_HANDLERS_MODULE_INVALID');
 const handlers=await module.createHandlers(db);
 for(const name of ['sources.fetch','information.extract','events.process','events.commit','events.enrich','deliveries.send','ops.recover','ops.alerts'])if(typeof handlers.business[name as typeof BUSINESS_QUEUES[number]]!=='function')throw new Error(`BUSINESS_HANDLER_REQUIRED:${name}`);
 await boss.start();stopWork=await registerBusinessWorker(boss,db,handlers.business,handlers.periodic);
 console.log('Business Worker started; engine ownership is not migrated by startup.');
}catch(error){await stop();throw error;}
