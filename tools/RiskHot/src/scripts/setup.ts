import { grantRuntimeRoles } from '../platform/grants.js';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { database, required } from '../platform/db.js';
import { Repository } from '../l0/repository.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { readCatalog } from '../m1/catalog.js';

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
  const sql = await readFile('src/db/001-init.sql', 'utf8');
  await admin.query(sql);
  const test = new Pool({ connectionString: required('TEST_DATABASE_URL') });
  try { await test.query(sql); } finally { await test.end(); }
  await grantRuntimeRoles(admin);
  const repo = new Repository(admin, new ArtifactStore(required('ARTIFACT_ROOT')));
  await repo.seedCatalog(await readCatalog('src/data/source-catalog.js'));
  await admin.query("INSERT INTO platform.actors(subject,permissions,source_keys) VALUES('riskhot-scheduler',ARRAY['read','submit','retry','auto_retry'],ARRAY['*']) ON CONFLICT(subject) DO NOTHING");
  console.log('Database schema, isolated roles, and source catalog initialized.');
} finally { await admin.end(); }
