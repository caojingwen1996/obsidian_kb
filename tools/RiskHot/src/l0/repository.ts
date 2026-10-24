import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ArtifactStore, type ArtifactRef } from '../platform/artifacts.js';
import { transaction } from '../platform/db.js';
import { DomainError, type CatalogEntry, type ExtractionResult, type NormalizedMaterial, type SourceItem } from '../platform/types.js';

export interface FetchCommand { source_key: string; limit: number; url?: string }
export interface OperationRow {
  id: string; parent_id: string | null; kind: 'batch' | 'material'; source_id: string; source_version: number;
  actor: string; command_artifact_id: string; url: string | null; status: string; stage: string; generation: string | number;
  raw_artifact_id: string | null; normalized_artifact_id: string | null; version_id: string | null; processing_id: string | null;
  reason_code: string | null; scheduled_at: Date; source_key?: string; slice_status?: string; children?: OperationRow[];
}
export interface ProcessingRow {
  id: string; version_id: string; extraction_status: string; candidate_count: number | null; generation: string | number;
  processing_scope: string; result_status: string; input_artifact_id: string | null; manifest_artifact_id: string | null; error_code: string | null;
}
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const first = <T>(rows: T[]): T => { if (!rows[0]) throw new DomainError('NOT_FOUND', 404); return rows[0]; };

export class Repository {
  constructor(public db: Pool, public artifacts: ArtifactStore) {}

  async artifact(ref: ArtifactRef, client: Pool | PoolClient = this.db): Promise<string> {
    const result = await client.query<{ id: string }>('INSERT INTO platform.artifact_objects(sha256,size,kind) VALUES($1,$2,$3) ON CONFLICT(sha256) DO UPDATE SET sha256=EXCLUDED.sha256 RETURNING id', [ref.sha256, ref.size, ref.kind]);
    return first(result.rows).id;
  }
  async bytes(id: string): Promise<Buffer> {
    const row = first((await this.db.query<{ sha256: string }>('SELECT sha256 FROM platform.artifact_objects WHERE id=$1', [id])).rows);
    return this.artifacts.read(row.sha256);
  }
  async json<T>(id: string): Promise<T> { return JSON.parse((await this.bytes(id)).toString('utf8')) as T; }
  async putJson(value: unknown, kind: string): Promise<string> { return this.artifact(await this.artifacts.put(Buffer.from(JSON.stringify(value)), kind)); }

  async authorize(subject: string, permission: string, key?: string, client: Pool | PoolClient = this.db): Promise<void> {
    const result = await client.query('SELECT 1 FROM platform.actors WHERE subject=$1 AND $2=ANY(permissions) AND ($3::text IS NULL OR $3=ANY(source_keys) OR \'*\'=ANY(source_keys))', [subject, permission, key ?? null]);
    if (!result.rowCount) throw new DomainError('FORBIDDEN', 403);
  }
  async seedCatalog(rows: CatalogEntry[]): Promise<void> {
    await transaction(this.db, async client => {
      for (const row of rows) {
        const source = first((await client.query<{ id: string; version: number }>('INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES($1,$2,$3,$4,$5) ON CONFLICT(catalog_key) DO UPDATE SET catalog_key=EXCLUDED.catalog_key RETURNING id,version', [row.id, row.name, row.url, row, row.id === 'wiki-source-001' ? 'ACTIVE' : 'DISABLED'])).rows);
        await client.query('INSERT INTO m1.source_versions(source_id,version,config) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.id, source.version, { catalog: row, connector: row.id === 'wiki-source-001' ? 'pbc-html-1.0.0' : null }]);
      }
    });
  }
  async checkSource(op: OperationRow, client: Pool | PoolClient = this.db): Promise<void> {
    const source = first((await client.query<{ catalog_key: string; state: string }>('SELECT catalog_key,state FROM m1.sources WHERE id=$1 FOR SHARE', [op.source_id])).rows);
    await this.authorize(op.actor, 'submit', source.catalog_key, client);
    if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
  }
  async intent(client: PoolClient, kind: string, owner: string, generation: number): Promise<void> {
    await client.query('INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [kind, owner, generation, `l0/${kind}/${owner}/${generation}`]);
  }
  async submit(command: FetchCommand, actor: string, key: string): Promise<OperationRow> {
    if (!/^[\x21-\x7e]{1,128}$/.test(key)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
    const input = { type: 'SOURCE_FETCH', ...command };
    const ref = await this.artifacts.put(Buffer.from(JSON.stringify(input)), 'intake-command');
    return transaction(this.db, async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${actor}:source-fetch:${key}`]);
      const prior = (await client.query<{ digest: string; operation_id: string }>('SELECT digest,operation_id FROM platform.command_receipts WHERE actor=$1 AND kind=\'source-fetch\' AND key=$2', [actor, key])).rows[0];
      if (prior) {
        if (prior.digest !== digest(input)) throw new DomainError('IDEMPOTENCY_CONFLICT', 409);
        await this.authorize(actor, 'submit', command.source_key, client);
        return first((await client.query<OperationRow>('SELECT * FROM information.operations WHERE id=$1', [prior.operation_id])).rows);
      }
      await this.authorize(actor, 'submit', command.source_key, client);
      const source = first((await client.query<{ id: string; version: number; state: string }>('SELECT id,version,state FROM m1.sources WHERE catalog_key=$1 FOR SHARE', [command.source_key])).rows);
      if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
      if (command.source_key !== 'wiki-source-001') throw new DomainError('CONNECTOR_NOT_CONFIGURED', 409);
      const artifact = await this.artifact(ref, client);
      const op = first((await client.query<OperationRow>('INSERT INTO information.operations(kind,source_id,source_version,actor,command_artifact_id) VALUES(\'batch\',$1,$2,$3,$4) RETURNING *', [source.id, source.version, actor, artifact])).rows);
      await client.query('INSERT INTO platform.command_receipts(actor,kind,key,digest,operation_id) VALUES($1,\'source-fetch\',$2,$3,$4)', [actor, key, digest(input), op.id]);
      await this.intent(client, 'discovery', op.id, 1);
      return op;
    });
  }
  async rawOperation(id: string, client: Pool | PoolClient = this.db, lock = false): Promise<OperationRow> {
    return first((await client.query<OperationRow>(`SELECT * FROM information.operations WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows);
  }
  guard(row: OperationRow | ProcessingRow, generation: number): void {
    if (Number(row.generation) !== generation) throw new DomainError('STALE_EXECUTION', 409);
  }
  async recordDiscovery(id: string, generation: number, items: SourceItem[], raw: Buffer): Promise<string[]> {
    const list = await this.artifact(await this.artifacts.put(raw, 'source-list'));
    const commands = await Promise.all(items.map(async item => ({ item, artifact: await this.putJson({ type: 'SOURCE_REFERENCE', url: item.url, connector: 'pbc-html-1.0.0' }, 'intake-command') })));
    return transaction(this.db, async client => {
      const parent = await this.rawOperation(id, client, true);
      this.guard(parent, generation); await this.checkSource(parent, client);
      if (parent.raw_artifact_id) return (await client.query<{ id: string }>('SELECT id FROM information.operations WHERE parent_id=$1 ORDER BY id', [id])).rows.map(row => row.id);
      const ids: string[] = [];
      for (const { item, artifact } of commands) {
        const child = first((await client.query<OperationRow>('INSERT INTO information.operations(parent_id,kind,source_id,source_version,actor,command_artifact_id,url,scheduled_at) VALUES($1,\'material\',$2,$3,$4,$5,$6,$7) ON CONFLICT(parent_id,url) DO UPDATE SET url=EXCLUDED.url RETURNING *', [id, parent.source_id, parent.source_version, parent.actor, artifact, item.url, parent.scheduled_at])).rows);
        await this.intent(client, 'material', child.id, Number(child.generation)); ids.push(child.id);
      }
      await client.query('UPDATE information.operations SET raw_artifact_id=COALESCE(raw_artifact_id,$2),stage=\'discovered\',status=\'running\',updated_at=now() WHERE id=$1', [id, list]);
      return ids.sort();
    });
  }
  async recordRaw(id: string, generation: number, raw: Buffer): Promise<void> {
    const artifact = await this.artifact(await this.artifacts.put(raw, 'raw'));
    await transaction(this.db, async client => {
      const op = await this.rawOperation(id, client, true); this.guard(op, generation); await this.checkSource(op, client);
      if (op.raw_artifact_id) return;
      await client.query('INSERT INTO information.acquisitions(operation_id,raw_artifact_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, artifact]);
      await client.query('UPDATE information.operations SET raw_artifact_id=$2,status=\'running\',stage=\'acquired\',reason_code=NULL,updated_at=now() WHERE id=$1', [id, artifact]);
    });
  }
  async recordNormalized(id: string, generation: number, material: NormalizedMaterial): Promise<void> {
    const artifact = await this.putJson(material, 'normalized');
    await transaction(this.db, async client => {
      const op = await this.rawOperation(id, client, true); this.guard(op, generation); await this.checkSource(op, client);
      if (!op.raw_artifact_id) throw new DomainError('RAW_REQUIRED');
      await client.query('UPDATE information.operations SET normalized_artifact_id=COALESCE(normalized_artifact_id,$2),stage=\'normalized\',updated_at=now() WHERE id=$1', [id, artifact]);
    });
  }
  async saveMaterial(id: string, generation: number): Promise<string> {
    const initial = await this.rawOperation(id);
    if (!initial.normalized_artifact_id || !initial.raw_artifact_id) throw new DomainError('NORMALIZED_REQUIRED');
    const material = await this.json<NormalizedMaterial>(initial.normalized_artifact_id);
    await this.bytes(initial.raw_artifact_id);
    const contentDigest = digest({ title: material.title, published: material.publishedAtText, segments: material.segments.map(x => ({ kind: x.kind, text: x.text })) });
    return transaction(this.db, async client => {
      const op = await this.rawOperation(id, client, true); this.guard(op, generation); await this.checkSource(op, client);
      if (op.version_id) return op.version_id;
      const identity = first((await client.query<{ id: string; current_version_id: string | null }>('INSERT INTO information.materials(source_id,identity) VALUES($1,$2) ON CONFLICT(source_id,identity) DO UPDATE SET identity=EXCLUDED.identity RETURNING id,current_version_id', [op.source_id, op.url])).rows);
      let version = (await client.query<{ id: string }>('SELECT id FROM information.material_versions WHERE material_id=$1 AND content_digest=$2', [identity.id, contentDigest])).rows[0];
      if (!version) {
        if (identity.current_version_id) {
          const current = first((await client.query<{ published_at_text: string | null }>('SELECT published_at_text FROM information.material_versions WHERE id=$1', [identity.current_version_id])).rows);
          if (!material.publishedAtText || !current.published_at_text || !/^\d{4}-\d{2}-\d{2}$/.test(material.publishedAtText) || material.publishedAtText <= current.published_at_text) throw new DomainError('VERSION_REVIEW_REQUIRED', 409);
        }
        version = first((await client.query<{ id: string }>('INSERT INTO information.material_versions(material_id,version_no,raw_artifact_id,normalized_artifact_id,content_digest,normalizer_version,title,published_at_text) SELECT $1,COALESCE(MAX(version_no),0)+1,$2,$3,$4,$5,$6,$7 FROM information.material_versions WHERE material_id=$1 RETURNING id', [identity.id, op.raw_artifact_id, op.normalized_artifact_id, contentDigest, material.normalizerVersion, material.title, material.publishedAtText])).rows);
        for (const [ordinal, segment] of material.segments.entries()) await client.query('INSERT INTO information.material_segments(version_id,id,ordinal,text,raw_locator,kind) VALUES($1,$2,$3,$4,$5,$6)', [version.id, segment.id, ordinal, segment.text, segment.rawLocator, segment.kind]);
        await client.query('UPDATE information.materials SET current_version_id=$2,row_version=row_version+1 WHERE id=$1', [identity.id, version.id]);
      }
      await client.query('INSERT INTO platform.messages(version_id) VALUES($1) ON CONFLICT DO NOTHING', [version.id]);
      await client.query('UPDATE information.operations SET version_id=$2,stage=\'saved\',status=\'running\',reason_code=NULL,updated_at=now() WHERE id=$1', [id, version.id]);
      return version.id;
    });
  }
  async deliverPending(): Promise<void> {
    await transaction(this.db, async client => {
      const messages = await client.query<{ id: string; version_id: string }>('SELECT id,version_id FROM platform.messages WHERE state=\'pending\' AND next_attempt_at<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 20');
      for (const message of messages.rows) {
        const processing = first((await client.query<{ id: string; generation: number }>('INSERT INTO information.processing_runs(version_id) VALUES($1) ON CONFLICT(version_id,analysis_key) DO UPDATE SET version_id=EXCLUDED.version_id RETURNING id,generation', [message.version_id])).rows);
        await client.query('INSERT INTO platform.inbox(message_id,processing_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [message.id, processing.id]);
        await this.intent(client, 'extract', processing.id, Number(processing.generation));
        await client.query('UPDATE platform.messages SET state=\'received\',receipt_processing_id=$2,attempts=attempts+1 WHERE id=$1', [message.id, processing.id]);
      }
      await client.query('UPDATE information.operations o SET processing_id=m.receipt_processing_id,stage=\'extract\',updated_at=now() FROM platform.messages m WHERE o.version_id=m.version_id AND m.state=\'received\' AND o.processing_id IS NULL');
    });
  }
  async processing(id: string, client: Pool | PoolClient = this.db, lock = false): Promise<ProcessingRow> {
    return first((await client.query<ProcessingRow>(`SELECT * FROM information.processing_runs WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows);
  }
  async acceptSet(id: string, generation: number, data: ExtractionResult): Promise<void> {
    await transaction(this.db, async client => {
      const processing = await this.processing(id, client, true); this.guard(processing, generation);
      if (processing.extraction_status === 'completed') return;
      const op = first((await client.query<OperationRow>('SELECT * FROM information.operations WHERE processing_id=$1 ORDER BY created_at LIMIT 1', [id])).rows);
      await this.checkSource(op, client);
      for (const [ordinal, candidate] of data.candidates.entries()) await client.query('INSERT INTO information.event_candidates(processing_id,ordinal,payload) VALUES($1,$2,$3)', [id, ordinal, candidate]);
      await client.query('UPDATE information.processing_runs SET extraction_status=\'completed\',candidate_count=$2,result_status=$3,error_code=NULL,completed_at=now() WHERE id=$1', [id, data.candidates.length, data.candidates.length ? 'pending' : 'NO_EVENT']);
      await client.query('UPDATE information.operations SET status=\'completed\',stage=\'candidates_saved\',reason_code=NULL,updated_at=now() WHERE processing_id=$1', [id]);
    });
  }
  async failOperation(id: string, generation: number, code: string, waiting = false): Promise<void> {
    await this.db.query('UPDATE information.operations SET status=$3,reason_code=$4,updated_at=now() WHERE id=$1 AND generation=$2 AND status<>\'completed\'', [id, generation, waiting ? 'waiting_config' : 'recoverable', code]);
  }
  async operation(id: string): Promise<OperationRow> {
    const op = first((await this.db.query<OperationRow>('SELECT o.*,s.catalog_key AS source_key FROM information.operations o JOIN m1.sources s ON s.id=o.source_id WHERE o.id=$1', [id])).rows);
    if (op.kind === 'batch') {
      op.children = (await this.db.query<OperationRow>('SELECT * FROM information.operations WHERE parent_id=$1 ORDER BY created_at,id', [id])).rows;
      const statuses = await Promise.all(op.children.map(async child => (await this.operation(child.id)).slice_status));
      op.slice_status = !statuses.length ? op.status : statuses.every(s => s === 'completed') ? 'completed' : statuses.includes('completed') ? 'partial' : statuses.includes('recoverable') ? 'recoverable' : statuses.includes('waiting_config') ? 'waiting_config' : 'running';
    } else if (op.processing_id) {
      const processing = await this.processing(op.processing_id);
      op.slice_status = processing.extraction_status === 'completed' ? 'completed' : op.status;
    } else op.slice_status = op.status;
    return op;
  }
  async candidates(id: string): Promise<unknown[]> {
    return (await this.db.query('SELECT id,candidate_key,status,ordinal,payload FROM information.event_candidates WHERE processing_id=$1 ORDER BY ordinal', [id])).rows;
  }
}
