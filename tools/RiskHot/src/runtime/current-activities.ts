import { ApplicationFailure } from '@temporalio/common';
import { Context } from '@temporalio/activity';
import type { Repository } from '../information-ingestion/processing/repository.js';
import { IngestionRepository } from '../information-ingestion/processing/current-repository.js';
import { connectorFor, sourceEntryUrl } from '../information-ingestion/sources/connectors.js';
import { fetchSource, discoverSource, parseSource, requireConnector, assertSourceUrl } from '../information-ingestion/processing/sources.js';
import { fetchRenderedSource } from '../information-ingestion/processing/source-browser.js';
import { DomainError } from '../platform/types.js';
import { transaction } from '../platform/db.js';

export function currentIngestionActivities(repo: Repository, fetcher: typeof fetch = fetch) {
  const store = new IngestionRepository(repo);
  return {
    async ingestCurrent(id: string, revision: number): Promise<void> {
      const heartbeat = setInterval(() => Context.current().heartbeat(), 20_000);
      try {
        const task = await store.checkTask(id, revision);
        if(task.status==='completed')return;
        const source = (await repo.db.query('SELECT catalog_key FROM m1.sources WHERE id=$1', [task.source_id])).rows[0];
        const connection = connectorFor(source.catalog_key); requireConnector(connection);
        const command = (await repo.db.query("SELECT input FROM platform.execution_intents WHERE kind='ingestion' AND owner_id=$1 AND generation=$2", [id, revision])).rows[0]?.input as { limit: number; url?: string } | undefined;
        if (!command) throw new DomainError('TASK_INPUT_UNAVAILABLE', 409);
        await repo.db.query("UPDATE infomation.ingestion_tasks SET status='running',stage='discover',updated_at=clock_timestamp() WHERE id=$1 AND control_revision=$2 AND NOT paused", [id, revision]);
        let items = task.result_summary.discovery as {url:string;title:string}[] | undefined;
        if (!items) {
        if (command.url) items = [{ url: assertSourceUrl(connection, command.url).href, title: '' }];
        else if (connection.kind !== 'article' && connection.kind !== 'pbc' && !connection.discovery) items = [{ url: sourceEntryUrl(connection), title: connection.scope }];
        else {
          const url = sourceEntryUrl(connection), bytes = await fetchSource(connection, url, fetcher);
          items = discoverSource(connection, bytes, url, command.limit);
        }
          items = await transaction(repo.db,async tx=>{
            const current=await store.checkTask(id,revision,tx);
            if(current.result_summary.discovery)return current.result_summary.discovery as {url:string;title:string}[];
            await tx.query("UPDATE infomation.ingestion_tasks SET result_summary=result_summary||$2::jsonb WHERE id=$1",[id,JSON.stringify({discovery:items})]);
            return items!;
          });
        }
        const failures: { url: string; code: string }[] = [];
        for (const item of items) {
          try {
            const current=await store.checkTask(id, revision);
            const checkpoints=current.result_summary.completed_entries as Record<string,{material_id:string;version:number;content_digest:string}>|undefined;
            if(checkpoints?.[item.url]) {
              try { await transaction(repo.db,async tx=>{await store.checkTask(id,revision,tx);await store.assertBasis(tx,task.actor,checkpoints[item.url]!,'submit');});continue; }
              catch(error){if(!(error instanceof DomainError&&error.code==='MATERIAL_BASIS_CHANGED'))throw error;}
            }
            await repo.db.query("UPDATE infomation.ingestion_tasks SET stage='read',updated_at=clock_timestamp() WHERE id=$1 AND control_revision=$2 AND NOT paused", [id, revision]);
            const bytes = connection.browser ? await fetchRenderedSource(connection, item.url) : await fetchSource(connection, item.url, fetcher);
            await store.checkTask(id, revision);
            const material = await store.saveMaterial(id, revision, parseSource(connection, bytes, item.url));
            await transaction(repo.db, async tx => {
              await store.checkTask(id, revision, tx);
              await tx.query('SELECT id FROM infomation.ingestion_material WHERE id=$1 FOR UPDATE',[material.id]);
              await store.assertBasis(tx,task.actor,{material_id:material.id,version:material.version,content_digest:material.content_digest},'submit');
              // 当前正文已入库且通过受理者权限核对；下游可直接读取，模型结果独立演化。
              const basis = { material_id: material.id, version: material.version, content_digest: material.content_digest, actor: task.actor };
              await tx.query("INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id,input) SELECT 'material-extract',$1,COALESCE(MAX(generation),0)+1,$2,$3 FROM platform.execution_intents WHERE kind='material-extract' AND owner_id=$1 ON CONFLICT DO NOTHING", [material.id, `material/${material.id}/${material.version}/${material.content_digest}`, basis]);
              await tx.query("UPDATE infomation.ingestion_material SET availability_state='available',availability_error=NULL WHERE id=$1 AND version=$2 AND content_digest=$3",[material.id,material.version,material.content_digest]);
              await tx.query("UPDATE infomation.ingestion_tasks SET result_summary=jsonb_set(result_summary,'{completed_entries}',COALESCE(result_summary->'completed_entries','{}'::jsonb)||$2::jsonb) WHERE id=$1",[id,JSON.stringify({[item.url]:{material_id:material.id,version:material.version,content_digest:material.content_digest}})]);
            });
          } catch (error) {
            if (error instanceof DomainError && ['STALE_EXECUTION', 'SOURCE_DISABLED', 'FORBIDDEN'].includes(error.code)) throw error;
            failures.push({ url: item.url, code: error instanceof DomainError ? error.code : 'IO_UNAVAILABLE' });
          }
        }
        await transaction(repo.db, async tx => {
          await store.checkTask(id, revision, tx);
          const saved = Number((await tx.query('SELECT count(*) AS n FROM infomation.ingestion_task_material WHERE task_id=$1', [id])).rows[0].n);
          const pending = Number((await tx.query("SELECT count(*) AS n FROM infomation.ingestion_task_material tm JOIN infomation.ingestion_material m ON m.id=tm.material_id WHERE tm.task_id=$1 AND m.availability_state IS DISTINCT FROM 'available'", [id])).rows[0].n);
          const status = failures.length ? saved ? 'partial' : 'recoverable' : pending ? 'running' : 'completed';
          await tx.query("UPDATE infomation.ingestion_tasks SET status=$2,stage='provide',reason_code=$3,result_summary=result_summary||$4::jsonb,updated_at=clock_timestamp() WHERE id=$1", [id, status, failures[0]?.code ?? null, JSON.stringify({ discovered_count: items.length, saved_count: saved, pending_count: pending, failures })]);
        });
      } catch (error) {
        const code = error instanceof DomainError ? error.code : 'IO_UNAVAILABLE';
        await repo.db.query("UPDATE infomation.ingestion_tasks SET status=$3,reason_code=$4,updated_at=clock_timestamp() WHERE id=$1 AND control_revision=$2 AND NOT paused AND status<>'completed'", [id, revision, ['SOURCE_DISABLED', 'FORBIDDEN'].includes(code) ? 'blocked' : 'recoverable', code]);
        throw ApplicationFailure.create({ message: code, type: code, nonRetryable: error instanceof DomainError && !error.retryable });
      } finally { clearInterval(heartbeat); }
    },
  };
}
export type CurrentIngestionActivities = ReturnType<typeof currentIngestionActivities>;
