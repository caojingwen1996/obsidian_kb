import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Connection, Client } from '@temporalio/client';
import { database, required } from '../platform/db.js';
import { ingestionPreflight, rebuildIngestionSchema } from '../platform/ingestion-migration.js';
import { grantIngestionRoles } from '../platform/ingestion-grants.js';

const db = database('ADMIN_DATABASE_URL');
try {
  const preflight = await ingestionPreflight(db);
  if (!process.argv.includes('--rebuild')) {
    console.log(JSON.stringify({ schema_version: preflight.schema_version, source_count: preflight.sources.length, counts: preflight.counts, application_sessions: preflight.application_sessions, source_profile_mismatches: preflight.source_profile_mismatches }, null, 2));
  } else {
    if (!process.argv.includes('--application-stopped')) throw new Error('APPLICATION_STOP_REQUIRED：先停止应用进程，再传入 --application-stopped');
    if (preflight.application_sessions.length) throw new Error('APPLICATION_SESSIONS_ACTIVE');
    const connection = await Connection.connect({ address: required('TEMPORAL_ADDRESS') });
    try {
      const namespace = process.env.TEMPORAL_NAMESPACE || 'riskhot-l0';
      const temporal = new Client({ connection, namespace });
      for await (const _execution of temporal.workflow.list({ query: "ExecutionStatus = 'Running'" })) throw new Error('TEMPORAL_RUNNING_WORKFLOW：先终止旧执行，不能仅停止Worker');
      await mkdir('.riskhot/backups', { recursive: true, mode: 0o700 });
      const backup = `.riskhot/backups/ingestion-preflight-${new Date().toISOString().replaceAll(':', '-')}.json`;
      const bytes = JSON.stringify({ ...preflight, temporal_namespace: namespace, running_workflows: 0 }, null, 2);
      await writeFile(backup, bytes, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      console.log(JSON.stringify({ backup, sha256: createHash('sha256').update(bytes).digest('hex'), source_count: preflight.sources.length }));
      await rebuildIngestionSchema(db, { workflowFence: `namespace:${namespace};running:0;application:stopped` });
      await grantIngestionRoles(db);
      console.log('schema5重建完成，信源保留。请先完成初始化，再启动新版本应用。');
    } finally { await connection.close(); }
  }
} finally { await db.end(); }
