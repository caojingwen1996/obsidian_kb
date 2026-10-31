import type { Pool } from 'pg';

export async function grantIngestionRoles(db: Pool): Promise<void> {
  for (const role of ['riskhot_api', 'riskhot_io', 'riskhot_relay', 'riskhot_model']) {
    await db.query(`GRANT USAGE ON SCHEMA platform TO ${role}`);
    await db.query(`REVOKE ALL ON ALL TABLES IN SCHEMA m1,platform,information,infomation FROM ${role}`);
  }
  for (const role of ['riskhot_api', 'riskhot_io', 'riskhot_relay']) {
    await db.query(`GRANT USAGE ON SCHEMA m1,information,infomation TO ${role}`);
    await db.query(`GRANT SELECT ON ALL TABLES IN SCHEMA m1,platform,information,infomation TO ${role}`);
    await db.query(`GRANT EXECUTE ON FUNCTION platform.authorize_actor(text,text,text),platform.lock_source(uuid),platform.source_for_submit(text),platform.lock_permission_epoch() TO ${role}`);
    await db.query(`GRANT INSERT,UPDATE ON platform.action_receipts,platform.execution_intents,platform.audit_log TO ${role}`);
  }
  await db.query('GRANT INSERT,UPDATE ON information.candidate_step_results,information.event_identity_snapshots,information.identity_decisions,information.definition_candidates,platform.task_proposals,platform.review_decisions TO riskhot_api');
  await db.query('GRANT INSERT,UPDATE ON information.target,information.target_object_sets,information.target_identity_runs TO riskhot_api');
  await db.query('GRANT UPDATE ON information.event_candidates TO riskhot_api');
  await db.query('GRANT UPDATE(extraction_result) ON infomation.ingestion_material TO riskhot_api');
  await db.query('GRANT INSERT,UPDATE ON platform.model_budget_windows TO riskhot_api');
  await db.query('GRANT INSERT,UPDATE ON m1.sources,infomation.ingestion_tasks,infomation.ingestion_schedules,platform.auth_states,platform.auth_sessions TO riskhot_api');
  await db.query('GRANT DELETE ON platform.auth_states,platform.auth_sessions TO riskhot_api');
  await db.query('GRANT INSERT,UPDATE ON ALL TABLES IN SCHEMA infomation,information TO riskhot_io');
  await db.query('GRANT DELETE ON infomation.ingestion_material_segments TO riskhot_io');
  await db.query('GRANT INSERT,UPDATE ON platform.artifact_objects,platform.model_attempts,platform.model_budget_windows,platform.automatic_recoveries,platform.model_service_state,platform.messages,platform.message_deliveries,platform.event_consumer_inbox,platform.event_consumer_progress,platform.event_message_dependencies,platform.task_proposals,platform.review_decisions,platform.commit_receipts,platform.runtime_alerts TO riskhot_io');
  await db.query('GRANT INSERT,UPDATE ON platform.runtime_alerts,platform.messages,platform.message_deliveries,platform.event_consumer_inbox,platform.event_consumer_progress,platform.event_message_dependencies TO riskhot_relay');
  await db.query('GRANT SELECT,INSERT ON platform.artifact_objects TO riskhot_relay');
  await db.query('GRANT INSERT,UPDATE ON information.event_file_jobs TO riskhot_relay');
  await db.query('GRANT UPDATE ON infomation.ingestion_tasks TO riskhot_relay');
  await db.query('GRANT UPDATE(extraction_result) ON infomation.ingestion_material TO riskhot_relay');
  await db.query('GRANT UPDATE(status,reason_code) ON information.event_candidates TO riskhot_relay');
  await db.query('GRANT EXECUTE ON FUNCTION platform.claim_model_call(uuid),platform.current_model_material(uuid) TO riskhot_model');
  await db.query('GRANT SELECT,INSERT ON platform.artifact_objects TO riskhot_model');
  await db.query('GRANT SELECT ON platform.model_attempts TO riskhot_model');
  await db.query('GRANT SELECT,INSERT,UPDATE ON platform.model_service_state TO riskhot_model');
  await db.query('GRANT UPDATE(status,response_artifact_id,finish_reason,error_code,completed_at) ON platform.model_attempts TO riskhot_model');
}
