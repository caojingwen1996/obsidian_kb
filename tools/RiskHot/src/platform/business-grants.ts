import type {Pool} from 'pg';
/** Grant only queue DML; schema/partition creation remains a publishing operation. */
export async function grantBusinessQueueRole(db:Pool,role:string,modelCalls=false):Promise<void>{
 if(!(await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)throw new Error('BUSINESS_RUNTIME_ROLE_NOT_FOUND');
 const escaped='"'+role.replaceAll('"','""')+'"';
 await db.query(`GRANT USAGE ON SCHEMA platform,pgboss TO ${escaped}`);
 await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA pgboss TO ${escaped}`);
 await db.query(`GRANT SELECT,INSERT,UPDATE ON platform.task_runs,platform.task_dispatches,platform.job_runs,platform.schedule_registrations TO ${escaped}`);
 if(modelCalls){
  await db.query(`GRANT EXECUTE ON FUNCTION platform.claim_business_model_call(uuid),platform.current_model_material(uuid) TO ${escaped}`);
  if((await db.query("SELECT to_regprocedure('platform.current_model_materials(uuid)') AS f")).rows[0].f)await db.query(`GRANT EXECUTE ON FUNCTION platform.current_model_materials(uuid) TO ${escaped}`);
 }
}
