import { readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';
import { transaction } from './db.js';
import { DomainError } from './types.js';

const applicationSchemas = ['m1', 'platform', 'information', 'infomation', 'f02_legacy'];
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
export async function ingestionSchemaVersion(db: Pool | PoolClient): Promise<number> {
  if (!(await db.query("SELECT to_regclass('platform.schema_versions') AS table_name")).rows[0].table_name) return 0;
  return Number((await db.query('SELECT COALESCE(max(version),0) AS version FROM platform.schema_versions')).rows[0].version);
}
export async function ingestionPreflight(db: Pool) {
  const tables = (await db.query<{ schema: string; name: string }>(`SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND c.relkind='r' ORDER BY 1,2`, [applicationSchemas])).rows;
  const counts: Record<string, number> = {};
  for (const table of tables) counts[`${table.schema}.${table.name}`] = Number((await db.query(`SELECT count(*) AS n FROM ${quote(table.schema)}.${quote(table.name)}`)).rows[0].n);
  const sources = tables.some(t => t.schema === 'm1' && t.name === 'sources') ? (await db.query('SELECT * FROM m1.sources ORDER BY id')).rows : [];
  const sessions = (await db.query(`SELECT pid,application_name,usename,state FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND usename=ANY($1)`, [['riskhot_api', 'riskhot_io', 'riskhot_relay', 'riskhot_model']])).rows;
  const hasHistory = tables.some(t => t.schema === 'm1' && t.name === 'source_versions');
  const mismatches = hasHistory ? (await db.query("SELECT s.catalog_key FROM m1.sources s JOIN m1.source_versions v ON v.source_id=s.id AND v.version=s.version WHERE jsonb_typeof(v.config->'profile')='object' AND NOT s.metadata @> (v.config->'profile') ORDER BY s.catalog_key")).rows : [];
  return { schema_version: await ingestionSchemaVersion(db), sources, counts, application_sessions: sessions, source_profile_mismatches: mismatches };
}

/** 普通初始化绝不重置旧库；重建必须由停机、栅栏后的显式切换入口调用。 */
export async function applyIngestionMigration(db: Pool): Promise<void> {
  const version = await ingestionSchemaVersion(db);
  if (version === 5) { await applySourceFinancialAttributesMigration(db); await applyTargetIdentityMigration(db); return; }
  if (version !== 0) throw new DomainError('INGESTION_EXPLICIT_REBUILD_REQUIRED', 409);
  await rebuildIngestionSchema(db, { workflowFence: 'empty-database', requireEmpty: true });
}
export async function applySourceFinancialAttributesMigration(db: Pool): Promise<void> {
  const sql = await readFile(new URL('../db/006-source-financial-attributes.sql', import.meta.url), 'utf8');
  await transaction(db, async tx => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-source-financial-attributes',0))");
    await tx.query(sql);
  });
}
export async function applyTargetIdentityMigration(db: Pool): Promise<void> {
 const sql=await readFile(new URL('../db/007-target-identity.sql',import.meta.url),'utf8');
 await transaction(db,async tx=>{await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-target-identity',0))");await tx.query(sql);});
}
export interface IngestionRebuildOptions {
  workflowFence: string;
  requireEmpty?: boolean;
  // 隔离测试注入事务末尾失败，证明 DDL 与信源保护一起回滚。
  beforeCommit?: (tx: PoolClient) => Promise<void>;
}
export async function rebuildIngestionSchema(db: Pool, options: IngestionRebuildOptions): Promise<void> {
  if (!options.workflowFence.trim()) throw new DomainError('INGESTION_WORKFLOW_FENCE_REQUIRED', 409);
  const sql = await readFile(new URL('../db/005-ingestion.sql', import.meta.url), 'utf8');
  await transaction(db, async tx => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-schema-5',0))");
    const version = await ingestionSchemaVersion(tx);
    if (options.requireEmpty && version === 5) return;
    if (options.requireEmpty && version !== 0) throw new DomainError('INGESTION_EXPLICIT_REBUILD_REQUIRED', 409);
    const sessions = await tx.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND usename=ANY($1)`, [['riskhot_api', 'riskhot_io', 'riskhot_relay', 'riskhot_model']]);
    if (sessions.rowCount) throw new DomainError('INGESTION_APPLICATION_SESSIONS_ACTIVE', 409);
    // 不允许 CASCADE 静默移除应用范围以外的外键。
    const external = await tx.query(`SELECT 1 FROM pg_constraint c JOIN pg_class target ON target.oid=c.confrelid JOIN pg_namespace tn ON tn.oid=target.relnamespace JOIN pg_class owner ON owner.oid=c.conrelid JOIN pg_namespace own ON own.oid=owner.relnamespace WHERE c.contype='f' AND tn.nspname=ANY($1) AND NOT own.nspname=ANY($1) LIMIT 1`, [applicationSchemas]);
    if (external.rowCount) throw new DomainError('INGESTION_EXTERNAL_DEPENDENCY', 409);
    const exists = Boolean((await tx.query("SELECT to_regclass('m1.sources') AS table_name")).rows[0].table_name);
    let before: Record<string, unknown>[] = [];
    if (exists) {
      await tx.query('LOCK TABLE m1.sources IN ACCESS EXCLUSIVE MODE');
      before = (await tx.query('SELECT to_jsonb(s) AS value FROM m1.sources s ORDER BY id')).rows.map(r => r.value);
      if ((await tx.query("SELECT to_regclass('m1.source_versions') AS t")).rows[0].t && (await tx.query("SELECT 1 FROM m1.sources s JOIN m1.source_versions v ON v.source_id=s.id AND v.version=s.version WHERE jsonb_typeof(v.config->'profile')='object' AND NOT s.metadata @> (v.config->'profile') LIMIT 1")).rowCount) throw new DomainError('INGESTION_CURRENT_PROFILE_MISMATCH', 409);

    }
    // 仅处理当前连接数据库内的应用 schema，不触碰 Temporal 数据库或共享文件。
    for (const schema of ['information', 'infomation', 'platform', 'f02_legacy']) await tx.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    const m1Tables = (await tx.query<{ name: string }>("SELECT tablename AS name FROM pg_tables WHERE schemaname='m1' AND tablename<>'sources'")).rows;
    for (const table of m1Tables) await tx.query(`DROP TABLE m1.${quote(table.name)} CASCADE`);
    // 旧函数的 RETURNS TABLE 包含版本列，必须退出后按新契约创建。
    await tx.query(sql);
    // 本次保留信源补建的计划按已授权部署要求统一一天，未来新增仍沿用3600秒。
    if(before.length)await tx.query("UPDATE infomation.ingestion_schedules SET interval_seconds=86400,next_run_at=clock_timestamp()+interval '1 day',updated_at=date_trunc('milliseconds',clock_timestamp()) WHERE source_id=ANY($1::uuid[])",[before.map(source=>source.id)]);
    if (exists) {
      const after = (await tx.query('SELECT to_jsonb(s) AS value FROM m1.sources s ORDER BY id')).rows.map(r => r.value as Record<string, unknown>);
      if (before.length !== after.length || before.some((row, i) => Object.entries(row).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(after[i]![key])))) throw new DomainError('INGESTION_SOURCE_PRESERVATION_FAILED', 409);
    }
    await tx.query(await readFile(new URL('../db/006-source-financial-attributes.sql', import.meta.url), 'utf8'));
    await tx.query("INSERT INTO platform.audit_log(actor,action,detail) VALUES('schema-migration','ingestion-schema-rebuild',$1)", [{ schema: 5, previous_schema: version, sources_preserved: before.length, workflow_fence: options.workflowFence }]);
    await tx.query(await readFile(new URL('../db/007-target-identity.sql',import.meta.url),'utf8'));
    await options.beforeCommit?.(tx);
  });
}
