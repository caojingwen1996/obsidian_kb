import {readFile} from 'node:fs/promises';import type {Pool} from 'pg';import {transaction} from './db.js';
export async function applyEventMigration(db:Pool):Promise<void>{const sql=await readFile(new URL('../db/003-event-management.sql',import.meta.url),'utf8');await transaction(db,async tx=>{await tx.query(sql);});}
export async function grantEventRoles(db:Pool):Promise<void>{
 await db.query('GRANT EXECUTE ON FUNCTION platform.claim_event_model_call(uuid) TO riskhot_model');
 for(const role of ['riskhot_api','riskhot_io','riskhot_relay']){
  await db.query(`GRANT SELECT ON ALL TABLES IN SCHEMA information,platform TO ${role}`);
  await db.query(`GRANT INSERT,UPDATE ON information.processing_runs,information.event_candidates,information.candidate_step_results,information.event_identity_snapshots,information.identity_decisions,information.definition_candidates,platform.task_proposals,platform.review_decisions,platform.execution_intents,platform.action_receipts,platform.audit_log TO ${role}`);
 }
 await db.query('GRANT INSERT,UPDATE ON ALL TABLES IN SCHEMA information TO riskhot_io');
 await db.query('GRANT INSERT,UPDATE ON platform.commit_receipts,platform.messages,platform.message_deliveries,platform.event_consumer_inbox,platform.event_consumer_progress TO riskhot_io,riskhot_relay');
 await db.query('GRANT INSERT,UPDATE ON platform.model_budget_windows,platform.model_attempts,platform.artifact_objects TO riskhot_io');
 await db.query('GRANT UPDATE ON platform.message_deliveries TO riskhot_api');
}
