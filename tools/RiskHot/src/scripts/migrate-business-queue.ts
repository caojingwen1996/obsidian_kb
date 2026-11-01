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
 if(process.env.BUSINESS_DATABASE_URL){
  const role=decodeURIComponent(new URL(required('BUSINESS_DATABASE_URL')).username);
  const escaped='"'+role.replaceAll('"','""')+'"';
  if(!(await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)throw new Error('BUSINESS_RUNTIME_ROLE_NOT_FOUND');
  await db.query(`GRANT USAGE ON SCHEMA platform,pgboss TO ${escaped}`);
  await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA pgboss TO ${escaped}`);
  await db.query(`GRANT EXECUTE ON FUNCTION platform.claim_business_model_call(uuid) TO ${escaped}`);
  await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON platform.task_runs,platform.task_dispatches,platform.job_runs,platform.schedule_registrations TO ${escaped}`);
 }
 console.log('Business queue schema and partitions provisioned. Engine selection unchanged.');
}finally{await boss.stop({wait:true});await db.end();}
