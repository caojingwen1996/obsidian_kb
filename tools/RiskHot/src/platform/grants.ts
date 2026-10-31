import { ingestionSchemaVersion } from './ingestion-migration.js';
import { grantIngestionRoles } from './ingestion-grants.js';
import type { Pool } from 'pg';

export async function grantRuntimeRoles(admin: Pool): Promise<void> {
 if (await ingestionSchemaVersion(admin) === 5) { await grantIngestionRoles(admin); return; }

  for (const role of ['riskhot_api', 'riskhot_io', 'riskhot_relay']) {
    await admin.query(`GRANT USAGE ON SCHEMA m1,platform,information TO ${role}`);
    await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA m1,platform,information FROM ${role}`);
    await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA m1,platform,information TO ${role}`);
    await admin.query(`GRANT EXECUTE ON FUNCTION platform.authorize_actor(text,text,text),platform.lock_source(uuid),platform.source_for_submit(text) TO ${role}`);
  }
  await admin.query('GRANT INSERT,UPDATE ON ALL TABLES IN SCHEMA information TO riskhot_io');
  await admin.query('GRANT INSERT,UPDATE ON platform.artifact_objects,platform.execution_intents,platform.messages,platform.inbox,platform.model_attempts,platform.model_budget_windows,platform.audit_log,platform.action_receipts TO riskhot_io');
  await admin.query('GRANT INSERT,UPDATE ON platform.command_receipts,platform.source_schedules,platform.schedule_runs,platform.runtime_alerts,platform.model_service_state,platform.automatic_recoveries TO riskhot_io');
  await admin.query('GRANT INSERT,UPDATE ON m1.sources,m1.source_versions,information.operations,platform.task_batches,platform.task_batch_sources,platform.source_schedules,platform.command_receipts,platform.action_receipts,platform.execution_intents,platform.artifact_objects,platform.audit_log,platform.auth_states,platform.auth_sessions,platform.model_budget_windows TO riskhot_api');
  await admin.query('GRANT UPDATE(generation,extraction_status,error_code,review_attempt_id,paused) ON information.processing_runs TO riskhot_api');
  await admin.query('GRANT DELETE ON platform.auth_states,platform.auth_sessions TO riskhot_api');
  await admin.query('GRANT INSERT,UPDATE ON platform.execution_intents,platform.messages,platform.inbox,information.processing_runs,information.operations TO riskhot_relay');
  await admin.query('GRANT INSERT,UPDATE ON information.material_deliveries,platform.artifact_objects TO riskhot_relay');
  await admin.query('GRANT UPDATE ON information.material_deliveries,platform.messages TO riskhot_api');
  await admin.query('GRANT USAGE ON SCHEMA platform TO riskhot_model');
  await admin.query('GRANT SELECT,INSERT ON platform.artifact_objects TO riskhot_model');
  await admin.query('GRANT SELECT ON platform.model_attempts TO riskhot_model');
  await admin.query('GRANT SELECT,INSERT,UPDATE ON platform.model_service_state TO riskhot_model');
  await admin.query('GRANT EXECUTE ON FUNCTION platform.claim_model_call(uuid) TO riskhot_model');
  await admin.query('GRANT UPDATE(status,response_artifact_id,finish_reason,error_code,completed_at) ON platform.model_attempts TO riskhot_model');
}
