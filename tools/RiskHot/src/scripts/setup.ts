import { applyIngestionMigration } from '../platform/ingestion-migration.js';
import { IngestionRepository } from '../information-ingestion/processing/current-repository.js';
import {grantEventRoles} from '../platform/event-migration.js';
import { grantRuntimeRoles } from '../platform/grants.js';
import { database, required } from '../platform/db.js';
import { Repository } from '../information-ingestion/processing/repository.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { readCatalog } from '../information-ingestion/sources/catalog.js';
import { LOCAL_OPERATOR } from '../platform/auth.js';
import { seedLocalDefinitions } from '../event-management/definition-seed.js';

const admin = database('ADMIN_DATABASE_URL');
try {
  for (const [role, variable] of Object.entries({ riskhot_api: 'DATABASE_URL', riskhot_io: 'IO_DATABASE_URL', riskhot_model: 'MODEL_DATABASE_URL', riskhot_relay: 'RELAY_DATABASE_URL' })) {
    const password = decodeURIComponent(new URL(required(variable)).password);
    const exists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
    const sql = await admin.query<{ sql: string }>(`SELECT format('${exists.rowCount ? 'ALTER' : 'CREATE'} ROLE %I WITH LOGIN PASSWORD %L', $1::text,$2::text) AS sql`, [role, password]);
    await admin.query(sql.rows[0]!.sql);
  }
  await applyIngestionMigration(admin);
  await grantRuntimeRoles(admin); await grantEventRoles(admin);
  const repo = new Repository(admin, new ArtifactStore(required('ARTIFACT_ROOT')));
  await new IngestionRepository(repo).seedCatalog(await readCatalog('src/data/source-catalog.js'));
  await seedLocalDefinitions(admin);
  await admin.query("INSERT INTO platform.actors(subject,permissions,source_keys) VALUES($1,ARRAY['read','submit','source_admin','retry','model_budget','model_review','event_submit','event_review','event_commit','candidate_disposition','event_retry','event_recompute'],ARRAY['*']) ON CONFLICT(subject) DO NOTHING", [LOCAL_OPERATOR]);
  await admin.query("INSERT INTO platform.actors(subject,permissions,source_keys) VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*']) ON CONFLICT(subject) DO NOTHING");
  console.log('Database schema, isolated roles, and source catalog initialized.');
} finally { await admin.end(); }
