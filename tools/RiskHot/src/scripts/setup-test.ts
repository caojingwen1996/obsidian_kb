import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { database, required } from '../platform/db.js';
import { ingestionSchemaVersion } from '../platform/ingestion-migration.js';
import { applyHandoffMigration } from '../platform/handoff-migration.js';
import { applyEventMigration, grantEventRoles } from '../platform/event-migration.js';
import { grantRuntimeRoles } from '../platform/grants.js';

const target = new URL(required('TEST_DATABASE_URL'));
const application = new URL(required('ADMIN_DATABASE_URL'));
if (target.pathname !== '/riskhot_test' || target.host !== application.host) throw new Error('DEDICATED_TEST_DATABASE_REQUIRED');
const admin = database('ADMIN_DATABASE_URL');
try {
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='riskhot_test'")).rowCount) await admin.query('CREATE DATABASE riskhot_test');
} finally { await admin.end(); }
const test = new Pool({ connectionString: target.href });
try {
  if (await ingestionSchemaVersion(test) === 5) throw new Error('LEGACY_TEST_SCHEMA_REQUIRED：此命令不重置已有schema5数据库');
  await test.query(await readFile('src/db/001-init.sql', 'utf8'));
  await applyHandoffMigration(test);
  await applyEventMigration(test);
  await grantRuntimeRoles(test);
  await grantEventRoles(test);
  console.log('独立旧回归测试库准备完成；未操作应用库或清空测试数据。');
} finally { await test.end(); }
