import { saveCurrentFact } from '../../event-management/current-facts.js';
import { validateCurrentExtraction, type MaterialCandidate } from '../../event-management/current-contracts.js';
import type { PoolClient } from 'pg';
import { transaction } from '../../platform/db.js';
import { DomainError, type CatalogEntry, type NormalizedMaterial } from '../../platform/types.js';
import { connectorFor } from '../sources/connectors.js';
import { requireConnector, assertSourceUrl } from './sources.js';
import { Repository, digest } from './repository.js';

export interface IngestionTask {
  id: string; source_id: string; actor: string; trigger_type: 'manual' | 'automatic';
  status: string; stage: string; paused: boolean; control_revision: string; reason_code: string | null;
  result_summary: Record<string, unknown>; scheduled_at: Date; created_at: Date; updated_at: Date;
}
export interface CurrentMaterial {
  id: string; source_id: string; identity: string; version: number; content_digest: string;
  content: NormalizedMaterial; metadata: Record<string, unknown>; title: string | null;
  availability_state: string | null; extraction_result: Record<string, unknown> | null;
}
export interface MaterialBasis { material_id: string; version: number; content_digest: string }
export class IngestionRepository {
  constructor(readonly repo: Repository) {}
  async seedCatalog(entries: CatalogEntry[]): Promise<void> {
    await transaction(this.repo.db, async tx => {
      for (const entry of entries) {
        const connection = connectorFor(entry.id);
        const source = (await tx.query("INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES($1,$2,$3,$4,$5) ON CONFLICT(catalog_key) DO UPDATE SET catalog_key=EXCLUDED.catalog_key RETURNING id", [entry.id, entry.name, entry.url, entry, connection.readiness === 'ready' ? 'ACTIVE' : 'DISABLED'])).rows[0]!;
        await tx.query('INSERT INTO infomation.ingestion_schedules(source_id) VALUES($1) ON CONFLICT DO NOTHING', [source.id]);
      }
    });
  }
  async task(id: string, tx = this.repo.db as typeof this.repo.db | PoolClient, lock = false): Promise<IngestionTask> {
    const row = (await tx.query<IngestionTask>(`SELECT * FROM infomation.ingestion_tasks WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
    if (!row) throw new DomainError('NOT_FOUND', 404); return row;
  }
  async checkTask(id: string, revision: number, tx: typeof this.repo.db | PoolClient = this.repo.db, allowPaused = false): Promise<IngestionTask> {
    const task = await this.task(id, tx, tx !== this.repo.db);
    if (Number(task.control_revision) !== revision || (task.paused && !allowPaused)) throw new DomainError('STALE_EXECUTION', 409);
    const source = (await tx.query('SELECT * FROM platform.lock_source($1)', [task.source_id])).rows[0];
    if (!source) throw new DomainError('NOT_FOUND', 404);
    await this.repo.authorize(task.actor, 'submit', source.catalog_key, tx);
    if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
    return task;
  }
  async submit(actor: string, key: string, input: { source_key: string; limit: number; url?: string }, automatic?: { scheduled_at: Date }): Promise<IngestionTask> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 5) throw new DomainError('LIMIT_INVALID', 400);
    const connection = connectorFor(input.source_key); requireConnector(connection);
    if (input.url) input = { ...input, url: assertSourceUrl(connection, input.url).href };
    return this.repo.action(actor, 'ingestion-submit', key, { ...input, automatic: automatic?.scheduled_at.toISOString() ?? null }, tx => this.repo.authorize(actor, 'submit', input.source_key, tx), async tx => {
      const source = (await tx.query('SELECT id,state FROM platform.source_for_submit($1)', [input.source_key])).rows[0];
      if (!source) throw new DomainError('NOT_FOUND', 404);
      if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
      const plan = (await tx.query('SELECT enabled FROM infomation.ingestion_schedules WHERE source_id=$1 FOR SHARE', [source.id])).rows[0];
      if (automatic && !plan?.enabled) throw new DomainError('SCHEDULE_DISABLED', 409);
      let task: IngestionTask;
      if (automatic) task = (await tx.query<IngestionTask>(`INSERT INTO infomation.ingestion_tasks(source_id,trigger_type,schedule_source_id,scheduled_at,actor) VALUES($1,'automatic',$1,$2,$3) ON CONFLICT(source_id,scheduled_at) WHERE trigger_type='automatic' DO UPDATE SET source_id=EXCLUDED.source_id RETURNING *`, [source.id, automatic.scheduled_at, actor])).rows[0]!;
      else task = (await tx.query<IngestionTask>("INSERT INTO infomation.ingestion_tasks(source_id,trigger_type,actor) VALUES($1,'manual',$2) RETURNING *", [source.id, actor])).rows[0]!;
      await tx.query("INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id,input) VALUES('ingestion',$1,$2,$3,$4) ON CONFLICT DO NOTHING", [task.id, Number(task.control_revision), `ingestion/${task.id}/${task.control_revision}`, input]);
      return task;
    });
  }
  async submitMany(actor: string, key: string, input: { source_keys: string[]; limit: number; url?: string }) {
    if (!input.source_keys.length || input.source_keys.length > 40 || new Set(input.source_keys).size !== input.source_keys.length || input.url && input.source_keys.length !== 1) throw new DomainError('SOURCE_SELECTION_INVALID', 400);
    if (!/^[\x21-\x7e]{1,128}$/.test(key)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
    // Register the complete command before per-source work; never hold a pool connection while submit acquires another.
    await this.repo.action(actor, 'ingestion-submit-many', key, input, tx => this.repo.authorize(actor, 'submit', undefined, tx), async () => ({ registered: true }));
    const items = [];
    for (const source of input.source_keys) {
      try { items.push({ source_key: source, accepted: true, task: await this.submit(actor, digest({ key, source }), { source_key: source, limit: input.limit, ...(input.url ? {url:input.url} : {}) }) }); }
      catch (error) { if (!(error instanceof DomainError)) throw error; items.push({ source_key: source, accepted: false, error: { code: error.code } }); }
    }
    return { items };
  }

  async saveMaterial(taskId: string, revision: number, material: NormalizedMaterial): Promise<CurrentMaterial> {
    if (!material.segments.length || !material.normalizerVersion) throw new DomainError('MATERIAL_CONTENT_REQUIRED', 422);
    const identity = material.sourceIdentity ?? material.url;
    if (!identity) throw new DomainError('MATERIAL_IDENTITY_REQUIRED', 422);
    return transaction(this.repo.db, async tx => {
      const task = await this.checkTask(taskId, revision, tx);
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`material:${task.source_id}:${identity}`]);
      const hash = digest({ title: material.title, published_at_text: material.publishedAtText, observed_at_text: material.observedAtText ?? null, snapshot_at_text: material.snapshotAtText ?? null, segments: material.segments.map(segment => ({ text: segment.text, kind: segment.kind })) });
      let row = (await tx.query<CurrentMaterial>('SELECT * FROM infomation.ingestion_material WHERE source_id=$1 AND identity=$2 FOR UPDATE', [task.source_id, identity])).rows[0];
      const changed = !row || row.content_digest !== hash;
      if (!row) row = (await tx.query<CurrentMaterial>('INSERT INTO infomation.ingestion_material(source_id,identity,canonical_url,title,content,content_digest,normalizer_rule,published_at_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [task.source_id, identity, material.url, material.title, material, hash, material.normalizerVersion, material.publishedAtText])).rows[0]!;
      else if (changed) row = (await tx.query<CurrentMaterial>("UPDATE infomation.ingestion_material SET canonical_url=$2,title=$3,content=$4,version=version+1,content_digest=$5,normalizer_rule=$6,published_at_text=$7,collected_at=clock_timestamp(),updated_at=clock_timestamp(),availability_state=NULL,availability_error=NULL,extraction_result=NULL WHERE id=$1 RETURNING *", [row.id, material.url, material.title, material, hash, material.normalizerVersion, material.publishedAtText])).rows[0]!;
      else row = (await tx.query<CurrentMaterial>("UPDATE infomation.ingestion_material SET normalizer_rule=$2,content=jsonb_set(content,'{normalizerVersion}',to_jsonb($2::text)) WHERE id=$1 RETURNING *", [row.id, material.normalizerVersion])).rows[0]!;
      if (changed) {
        await tx.query('DELETE FROM infomation.ingestion_material_segments WHERE material_id=$1', [row.id]);
        for (const [ordinal, segment] of material.segments.entries()) await tx.query('INSERT INTO infomation.ingestion_material_segments(material_id,id,ordinal,text,locator) VALUES($1,$2,$3,$4,$5)', [row.id, segment.id, ordinal, segment.text, { raw_locator: segment.rawLocator, kind: segment.kind }]);
        await tx.query("UPDATE information.event_candidates SET status='review',reason_code='MATERIAL_BASIS_CHANGED',execution_generation=execution_generation+1 WHERE material_id=$1 AND material_version<>$2 AND status NOT IN ('completed','dismissed')", [row.id, row.version]);
      }
      const linked = await tx.query('INSERT INTO infomation.ingestion_task_material(task_id,material_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [taskId, row.id]);
      if (linked.rowCount) await tx.query("UPDATE infomation.ingestion_tasks SET status='running',stage='provide',result_summary=jsonb_set(result_summary,'{saved_count}',to_jsonb(COALESCE((result_summary->>'saved_count')::integer,0)+1)),updated_at=clock_timestamp() WHERE id=$1", [taskId]);
      return row;
    });
  }
  async material(actor: string, id: string): Promise<CurrentMaterial> {
    const row = (await this.repo.db.query<CurrentMaterial & { catalog_key: string }>('SELECT m.*,s.catalog_key FROM infomation.ingestion_material m JOIN m1.sources s ON s.id=m.source_id WHERE m.id=$1', [id])).rows[0];
    if (!row) throw new DomainError('NOT_FOUND', 404);
    await this.repo.authorize(actor, 'read', row.catalog_key); return row;
  }
  async assertBasis(tx: PoolClient, actor: string, basis: MaterialBasis, permission = 'event_submit'): Promise<CurrentMaterial> {
    await tx.query('SELECT platform.lock_permission_epoch()');
    const row = (await tx.query<CurrentMaterial & { catalog_key: string; state: string }>('SELECT m.*,s.catalog_key,s.state FROM infomation.ingestion_material m CROSS JOIN LATERAL platform.lock_source(m.source_id) s WHERE m.id=$1 FOR SHARE OF m', [basis.material_id])).rows[0];
    if (!row) throw new DomainError('NOT_FOUND', 404);
    await this.repo.authorize(actor, permission, row.catalog_key, tx);
    if (row.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
    if (row.version !== basis.version || row.content_digest !== basis.content_digest) throw new DomainError('MATERIAL_BASIS_CHANGED', 409);
    return row;
  }
  async extractionFailed(actor: string, basis: MaterialBasis, code: string): Promise<void> {
    await transaction(this.repo.db, async tx => {
      const material = await this.assertBasis(tx, actor, basis, 'submit');
      if (material.extraction_result?.candidate_count !== undefined) return;
      await tx.query('UPDATE infomation.ingestion_material SET extraction_result=$2 WHERE id=$1', [basis.material_id, { version: basis.version, content_digest: basis.content_digest, status: code.startsWith('OUTPUT_') ? 'review' : 'recoverable', error_code: code }]);
    });
  }
  async acceptExtraction(actor: string, basis: MaterialBasis, result: { candidates: MaterialCandidate[]; no_event_reason?: string | null; warnings?: string[] }): Promise<void> {
    if (!Array.isArray(result.candidates) || result.candidates.length > 50 || (!result.candidates.length && !result.no_event_reason?.trim())) throw new DomainError('OUTPUT_INCOMPLETE', 422);
    await transaction(this.repo.db, async tx => {
      const material = await this.assertBasis(tx, actor, basis, 'submit');
      validateCurrentExtraction(material, { candidates: result.candidates, warnings: result.warnings ?? [] });
      if (material.extraction_result?.candidate_count !== undefined && material.extraction_result.version === basis.version && material.extraction_result.content_digest === basis.content_digest) return;
      for (const [ordinal,payload] of result.candidates.entries()) {
        const candidate = (await tx.query('INSERT INTO information.event_candidates(material_id,material_version,material_digest,actor,ordinal,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id', [basis.material_id,basis.version,basis.content_digest,actor,ordinal,payload])).rows[0];
        if(candidate) await saveCurrentFact(tx,candidate.id,payload);
      }
      await tx.query("UPDATE infomation.ingestion_material SET extraction_result=$2,availability_state='available',availability_error=NULL WHERE id=$1", [basis.material_id, { version: basis.version, content_digest: basis.content_digest, candidate_count: result.candidates.length, no_event_reason: result.no_event_reason ?? null, warnings: result.warnings ?? [] }]);
    });
  }
}
