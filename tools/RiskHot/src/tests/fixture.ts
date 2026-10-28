import {applyEventMigration,grantEventRoles} from '../platform/event-migration.js';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grantRuntimeRoles } from '../platform/grants.js';
import { ExecutionStore } from '../information-ingestion/processing/execution.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { parsePbc } from '../information-ingestion/processing/pbc.js';
import { setTimeout } from 'node:timers/promises';
import { applyHandoffMigration } from '../platform/handoff-migration.js';

export async function openFixture(options?:{legacyEvents?:boolean}) {
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const name = `riskhot_review_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const urlFor = (variable: string) => { const url = new URL(process.env[variable]!); url.pathname = `/${name}`; return url.href; };
  const db = new Pool({ connectionString: urlFor('ADMIN_DATABASE_URL') });
  const folder = await mkdtemp(join(tmpdir(), 'riskhot-review-'));
  const artifacts = new ArtifactStore(folder);
  const repo = new ExecutionStore(db, artifacts);
  await db.query(await readFile('src/db/001-init.sql', 'utf8')); await applyHandoffMigration(db); if(options?.legacyEvents)await db.query(await readFile('src/db/003-event-management.sql','utf8'));else await applyEventMigration(db); await grantRuntimeRoles(db); if(!options?.legacyEvents)await grantEventRoles(db);
  await repo.seedCatalog([{ id: 'wiki-source-001', name: '中国人民银行', url: 'https://www.pbc.gov.cn/', tier: 'T1', group: '受控测试', focus: '受控测试', context: '受控测试' }]);
  await db.query("INSERT INTO platform.actors VALUES('review-operator',ARRAY['read','submit','retry','model_budget'],ARRAY['wiki-source-001'])");
  const parent = await repo.submit({ source_key: 'wiki-source-001', limit: 1 }, 'review-operator', randomUUID());
  const url = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/9999999999999999/index.html';
  const raw = Buffer.from('<meta name="ArticleTitle" content="受控测试"><div id="zoom"><p>虚构机构宣布一项措施。</p></div>');
  const model = new Pool({ connectionString: urlFor('MODEL_DATABASE_URL') });
  return { admin, db, model, folder, artifacts, repo, parent, url, raw, urlFor,
    async processing(rawOverride?:Buffer) {
      const [child] = await repo.recordDiscovery(parent.id, 1, [{ url, title: '受控测试' }], Buffer.from('controlled list'));
      const content=rawOverride??raw;await repo.recordRaw(child!, 1, content); const material = parsePbc(content, url);
      await repo.recordNormalized(child!, 1, material); const version = await repo.saveMaterial(child!, 1); await repo.deliverPending();
      const id = (await repo.operation(child!)).processing_id!;
      await repo.prepare(id, 1, { version_id: version, material, manifest: { prompt: '仅用于受控机制测试', provider: { protocol: 'openai-chat', model: 'controlled-test-model', endpoint: 'http://127.0.0.1:1' } } });
      return { id, child: child!, material, version };
    },
    async dispose() {
      await model.end(); await db.end();
      const deadline = Date.now() + 2000;
      while ((await admin.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1', [name])).rowCount && Date.now() < deadline) await setTimeout(20);
      await admin.query(`DROP DATABASE ${name}`); await admin.end(); await rm(folder, { recursive: true, force: true });
    },
  };
}
