import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { migrate } from '../../tooling/migrate.js';
import { domains } from '../../packages/platform/database/index.js';
export default async function setup() {
  const base = 'postgres://riskhot:riskhot-local@127.0.0.1:55432/';
  const admin = new pg.Pool({ connectionString: base + 'postgres' });
  try {
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='riskhot_e2e'")).rowCount)
      await admin.query('CREATE DATABASE riskhot_e2e');
  } finally {
    await admin.end();
  }
  await migrate(base + 'riskhot_e2e');
  const pool = new pg.Pool({ connectionString: base + 'riskhot_e2e' });
  try {
    if ((await pool.query('SELECT current_database() AS name')).rows[0]?.name !== 'riskhot_e2e')
      throw new Error('Refusing to clear non-E2E database');
    const tables = domains.flatMap((d) => [`${d}.records`, `${d}.history`]);
    tables.push(
      'registry.monitored_risk_event_relation',
      'platform.operations',
      'platform.claims',
      'platform.audit',
      'platform.outbox',
      'platform.sessions',
    );
    await pool.query('TRUNCATE ' + tables.join(',') + ' RESTART IDENTITY CASCADE');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await setup();
