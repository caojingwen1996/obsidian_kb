import {grantBusinessQueueRole} from '../platform/business-grants.js';
import PgBoss from 'pg-boss';
import {readFile} from 'node:fs/promises';
import {database,required} from '../platform/db.js';
import {provisionBusinessQueues} from '../runtime/business-worker.js';

// Explicit publishing command. Runtime entry uses migrate:false and never invokes this module.
const db=database('ADMIN_DATABASE_URL');
const boss=new PgBoss({connectionString:required('ADMIN_DATABASE_URL')});
boss.on('error',()=>console.error('BUSINESS_QUEUE_PROVISION_ERROR'));
try{
 await db.query(await readFile(new URL('../db/009-business-queue.sql',import.meta.url),'utf8'));
 await boss.start();await provisionBusinessQueues(boss);
 for(const variable of ['DATABASE_URL','BUSINESS_DATABASE_URL']){
  if(process.env[variable])await grantBusinessQueueRole(db,decodeURIComponent(new URL(required(variable)).username),variable==='BUSINESS_DATABASE_URL');
 }
 console.log('Business queue schema and partitions provisioned. Engine selection unchanged.');
}finally{await boss.stop({wait:true});await db.end();}
