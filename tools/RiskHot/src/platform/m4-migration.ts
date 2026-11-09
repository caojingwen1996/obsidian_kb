import {readFile} from 'node:fs/promises';
import type {Pool,PoolClient} from 'pg';
import {transaction} from './db.js';
import {DomainError} from './types.js';
const tables=['information.target','information.event','information.fact','information.event_target','information.fact_evidence'];
async function inspect(db:Pool|PoolClient){
 const versions=(await db.query('SELECT version FROM platform.schema_versions ORDER BY version')).rows.map(r=>Number(r.version));
 const counts:Record<string,number>={};for(const table of tables)counts[table]=Number((await db.query(`SELECT count(*) n FROM ${table}`)).rows[0].n);
 return {versions,counts,m4_applied:versions.includes(10)};
}
export async function grantM4Roles(db:Pool|PoolClient){
 if(!(await db.query('SELECT 1 FROM platform.schema_versions WHERE version=10')).rowCount)return;
 for(const role of ['riskhot_api','riskhot_io','riskhot_relay','riskhot_model']){
  if(!(await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)continue;
  await db.query(`REVOKE ALL ON information.financial_object_config,information.shared_observation,information.target_config_mapping,information.m4_history FROM ${role}`);
  await db.query(`REVOKE UPDATE,DELETE ON information.definition_snapshots FROM ${role}`);
  await db.query(`REVOKE ALL ON FUNCTION platform.m4_lock(text,text),platform.m4_persist(text,text,jsonb) FROM ${role}`);
  if(role!=='riskhot_model')await db.query(`GRANT SELECT ON information.financial_object_config,information.shared_observation,information.target_config_mapping,information.m4_history TO ${role}`);
 }
 if((await db.query("SELECT 1 FROM pg_roles WHERE rolname='riskhot_api'")).rowCount)await db.query('GRANT EXECUTE ON FUNCTION platform.m4_lock(text,text),platform.m4_persist(text,text,jsonb) TO riskhot_api');
}
export async function inspectM4Migration(db:Pool){return transaction(db,async tx=>{await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return inspect(tx);});}
export async function applyM4Migration(db:Pool,options:{beforeCommit?:(tx:PoolClient)=>Promise<void>}={}){
 return transaction(db,async tx=>{
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-schema-10',0))");
  const before=await inspect(tx);if(!before.versions.includes(8))throw new DomainError('M4_SCHEMA8_REQUIRED',409);
  if(!before.m4_applied)await tx.query(await readFile(new URL('../db/010-m4.sql',import.meta.url),'utf8'));
  await grantM4Roles(tx);const after=await inspect(tx);
  if(JSON.stringify(before.counts)!==JSON.stringify(after.counts))throw new DomainError('M4_PRESERVATION_FAILED',409);
  await options.beforeCommit?.(tx);return after;
 });
}
