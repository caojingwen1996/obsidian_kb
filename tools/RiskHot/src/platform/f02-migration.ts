import {readFile} from 'node:fs/promises';
import type {Pool,PoolClient} from 'pg';
import {transaction} from './db.js';
import {DomainError} from './types.js';
type DB=Pool|PoolClient;
export interface MigrationReport {applied_versions:number[];counts:Record<string,number>;anomalies:string[];checkpoint_dependencies:string[]}
async function inspect(db:DB):Promise<MigrationReport>{
 const applied_versions=(await db.query('SELECT version FROM platform.schema_versions ORDER BY version')).rows.map(r=>Number(r.version));
 const migrated=applied_versions.includes(8);
 const tables=['infomation.ingestion_material','information.fact','information.fact_evidence','information.candidate_step_results','platform.commit_receipts','platform.model_attempts','platform.model_budget_windows','platform.messages',migrated?'information.fact_material':'information.fact_information'];
 const counts:Record<string,number>={};for(const table of tables)counts[table.replace('fact_information','fact_material')]=Number((await db.query(`SELECT count(*) n FROM ${table}`)).rows[0].n);
 const anomalies:string[]=[];
 if(!migrated){
  if((await db.query('SELECT fact_id FROM information.event_fact GROUP BY fact_id HAVING count(*)>1')).rowCount)anomalies.push('MULTIPLE_FACT_OWNERS');
  if((await db.query('SELECT 1 FROM information.fact_evidence fe LEFT JOIN information.fact_information fi ON fi.fact_id=fe.fact_id AND fi.information_id=fe.material_id WHERE fi.fact_id IS NULL OR fe.information_id<>fe.material_id LIMIT 1')).rowCount)anomalies.push('ORPHAN_EVIDENCE');
  if((await db.query('SELECT 1 FROM information.fact_information fi WHERE NOT EXISTS(SELECT 1 FROM information.fact_evidence fe WHERE fe.fact_id=fi.fact_id AND fe.material_id=fi.information_id) LIMIT 1')).rowCount)anomalies.push('FACT_EVIDENCE_REQUIRED');
 }
 const checkpoint_dependencies=(await db.query("SELECT conrelid::regclass::text AS name FROM pg_constraint WHERE contype='f' AND confrelid='information.candidate_step_results'::regclass")).rows.map(r=>r.name);
 if(checkpoint_dependencies.length)anomalies.push('CHECKPOINT_EXTERNAL_DEPENDENCY');
 return {applied_versions,counts,anomalies,checkpoint_dependencies};
}
export async function inspectF02Migration(db:Pool):Promise<MigrationReport>{return transaction(db,async tx=>{await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return inspect(tx);});}
export async function applyF02Migration(db:Pool,options:{beforeCommit?:(tx:PoolClient)=>Promise<void>}={}):Promise<MigrationReport>{
 return transaction(db,async tx=>{
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-schema-8',0))");
  if((await tx.query('SELECT 1 FROM platform.schema_versions WHERE version=8')).rowCount)return inspect(tx);
  if(!(await tx.query('SELECT 1 FROM platform.schema_versions WHERE version=5')).rowCount)throw new DomainError('F02_SCHEMA5_REQUIRED',409);
  await tx.query('LOCK TABLE information.fact,information.event_fact,information.fact_information,information.fact_evidence,information.candidate_step_results IN ACCESS EXCLUSIVE MODE');
  const before=await inspect(tx);if(before.anomalies.length)throw new DomainError(`F02_MIGRATION_${before.anomalies.join('_')}`,409);
  await tx.query(await readFile(new URL('../db/007-target-identity.sql',import.meta.url),'utf8'));
  await tx.query(await readFile(new URL('../db/008-f02.sql',import.meta.url),'utf8'));
  const after=await inspect(tx);if(JSON.stringify(before.counts)!==JSON.stringify(after.counts))throw new DomainError('F02_PRESERVATION_FAILED',409);
  await options.beforeCommit?.(tx);return after;
 });
}
