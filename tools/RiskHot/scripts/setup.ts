import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { database, required } from '../src/platform/db.js';
import { Repository } from '../src/l0/repository.js';
import { ArtifactStore } from '../src/platform/artifacts.js';
import { readCatalog } from '../src/m1/catalog.js';

const admin = database('ADMIN_DATABASE_URL');
try {
  for (const [role, variable] of Object.entries({ riskhot_api: 'DATABASE_URL', riskhot_io: 'IO_DATABASE_URL', riskhot_model: 'MODEL_DATABASE_URL', riskhot_relay: 'RELAY_DATABASE_URL', temporal: 'TEMPORAL_DB_PASSWORD' })) {
    const password = variable === 'TEMPORAL_DB_PASSWORD' ? required(variable) : decodeURIComponent(new URL(required(variable)).password);
    const exists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
    const sql = await admin.query<{ sql: string }>(`SELECT format('${exists.rowCount ? 'ALTER' : 'CREATE'} ROLE %I WITH LOGIN PASSWORD %L${role === 'temporal' ? ' CREATEDB' : ''}', $1::text,$2::text) AS sql`, [role, password]);
    await admin.query(sql.rows[0]!.sql);
  }
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='riskhot_test'")).rowCount) await admin.query('CREATE DATABASE riskhot_test');
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='temporal'")).rowCount) await admin.query('CREATE DATABASE temporal OWNER temporal');
  const sql = await readFile('db/001-init.sql', 'utf8');
  await admin.query(sql);
  const test = new Pool({ connectionString: required('TEST_DATABASE_URL') });
  try { await test.query(sql); } finally { await test.end(); }
  for (const role of ['riskhot_api', 'riskhot_io', 'riskhot_relay']) {
    await admin.query(`GRANT USAGE ON SCHEMA m1,platform,information TO ${role}`);
    await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA m1,platform,information FROM ${role}`);
    await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA m1,platform,information TO ${role}`);
    await admin.query(`GRANT EXECUTE ON FUNCTION platform.authorize_actor(text,text,text),platform.lock_source(uuid) TO ${role}`);
  }
  await admin.query('GRANT INSERT,UPDATE ON ALL TABLES IN SCHEMA information TO riskhot_io');
  await admin.query('GRANT INSERT,UPDATE ON platform.artifact_objects,platform.execution_intents,platform.messages,platform.inbox,platform.model_attempts,platform.model_budget_windows,platform.audit_log,platform.action_receipts TO riskhot_io');
  await admin.query('GRANT INSERT,UPDATE ON m1.sources,m1.source_versions,information.operations,platform.command_receipts,platform.action_receipts,platform.execution_intents,platform.artifact_objects,platform.audit_log,platform.auth_states,platform.auth_sessions,platform.model_budget_windows TO riskhot_api');
  await admin.query('GRANT UPDATE(generation,extraction_status,error_code) ON information.processing_runs TO riskhot_api');
  await admin.query('GRANT DELETE ON platform.auth_states,platform.auth_sessions TO riskhot_api');
  await admin.query('GRANT INSERT,UPDATE ON platform.execution_intents,platform.messages,platform.inbox,information.processing_runs,information.operations TO riskhot_relay');
  await admin.query('GRANT USAGE ON SCHEMA platform TO riskhot_model');
  await admin.query('GRANT SELECT,INSERT ON platform.artifact_objects TO riskhot_model');
  await admin.query('GRANT SELECT ON platform.model_attempts TO riskhot_model');
  await admin.query('GRANT UPDATE(status,response_artifact_id,finish_reason,error_code,completed_at) ON platform.model_attempts TO riskhot_model');
  const repo = new Repository(admin, new ArtifactStore(required('ARTIFACT_ROOT')));
  await repo.seedCatalog(await readCatalog('src/data/source-catalog.js'));
  console.log('Database schema, isolated roles, and source catalog initialized.');
} finally { await admin.end(); }
