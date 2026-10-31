import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { digest } from './contracts.js';
import { DomainError } from '../platform/types.js';

/** 本地已登记范围见f02-events验收报告；不代表外部M2定义为空。 */
export async function seedLocalDefinitions(db: Pool): Promise<void> {
  const scope = JSON.parse(await readFile(new URL('../data/event-definition-scope.json', import.meta.url), 'utf8')) as {
    ref: string; owner: string; version: string; coverage_status: string; payload: { targets: unknown[]; variables: unknown[] };
  };
  const hash = digest(scope.payload);
  await db.query('INSERT INTO information.definition_sets(ref,owner,version,coverage_status,payload,digest) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(ref) DO NOTHING', [scope.ref, scope.owner, scope.version, scope.coverage_status, scope.payload, hash]);
  const saved = (await db.query('SELECT owner,version,coverage_status,digest FROM information.definition_sets WHERE ref=$1', [scope.ref])).rows[0];
  if (saved.owner !== scope.owner || saved.version !== scope.version || saved.coverage_status !== scope.coverage_status || saved.digest !== hash) throw new DomainError('DEFINITION_SEED_CONFLICT', 409);
}
