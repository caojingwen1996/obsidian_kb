import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ArtifactStore, type ArtifactRef } from '../../platform/artifacts.js';
import { transaction } from '../../platform/db.js';
import { DomainError, type CatalogEntry, type ExtractionResult, type NormalizedMaterial, type SourceItem } from '../../platform/types.js';
import { assertPbcUrl } from './pbc.js';
import { connectorFor, sourceEntryUrl, type SourceConnector } from '../sources/connectors.js';
import { assertSourceUrl, requireConnector } from './sources.js';

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
  review_attempt_id?: string | null;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const first = <T>(rows: T[]): T => { if (!rows[0]) throw new DomainError('NOT_FOUND', 404); return rows[0]; };

export class Repository {
  constructor(public db: Pool, public artifacts: ArtifactStore) {}

  async artifact(ref: ArtifactRef, client: Pool | PoolClient = this.db): Promise<string> {
    const result = await client.query<{ id: string }>('INSERT INTO platform.artifact_objects(sha256,size,kind) VALUES($1,$2,$3) ON CONFLICT(sha256) DO NOTHING RETURNING id', [ref.sha256, ref.size, ref.kind]);
    return result.rows[0]?.id ?? first((await client.query<{ id: string }>('SELECT id FROM platform.artifact_objects WHERE sha256=$1', [ref.sha256])).rows).id;
  }
  async bytes(id: string): Promise<Buffer> {
    const row = first((await this.db.query<{ sha256: string }>('SELECT sha256 FROM platform.artifact_objects WHERE id=$1', [id])).rows);
    return this.artifacts.read(row.sha256);
  }
  async json<T>(id: string): Promise<T> { return JSON.parse((await this.bytes(id)).toString('utf8')) as T; }
  async putJson(value: unknown, kind: string): Promise<string> { return this.artifact(await this.artifacts.put(Buffer.from(JSON.stringify(value)), kind)); }

  async authorize(subject: string, permission: string, key?: string, client: Pool | PoolClient = this.db): Promise<void> {
    const result = await client.query<{ allowed: boolean }>('SELECT platform.authorize_actor($1,$2,$3) AS allowed', [subject, permission, key ?? null]);
    if (!result.rows[0]?.allowed) throw new DomainError('FORBIDDEN', 403);
  }
  async action<T>(actor: string, kind: string, key: string, input: unknown, authorize: (client: PoolClient) => Promise<void>, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!/^[\x21-\x7e]{1,128}$/.test(key)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
    return transaction(this.db, async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${actor}:${kind}:${key}`]);
      await authorize(client);
      const prior = (await client.query<{ digest: string; result: T }>('SELECT digest,result FROM platform.action_receipts WHERE actor=$1 AND kind=$2 AND key=$3', [actor, kind, key])).rows[0];
      if (prior) { if (prior.digest !== digest(input)) throw new DomainError('IDEMPOTENCY_CONFLICT', 409); return prior.result; }
      const result = await work(client);
      await client.query('INSERT INTO platform.action_receipts(actor,kind,key,digest,result) VALUES($1,$2,$3,$4,$5)', [actor, kind, key, digest(input), JSON.stringify(result)]);
      return result;
    });
  }
  async seedCatalog(rows: CatalogEntry[]): Promise<void> {
    await transaction(this.db, async client => {
      for (const row of rows) {
        const connection = connectorFor(row.id);
        let source = (await client.query<{ id:string;version:number;state:string }>('SELECT id,version,state FROM m1.sources WHERE catalog_key=$1 FOR UPDATE',[row.id])).rows[0];
        if (!source) source = first((await client.query<{ id:string;version:number;state:string }>('INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES($1,$2,$3,$4,$5) RETURNING id,version,state',[row.id,row.name,row.url,row,connection.readiness==='ready'?'ACTIVE':'DISABLED'])).rows);
        const previous = (await client.query<{config:{connection?:SourceConnector;connector?:string|null}}>('SELECT config FROM m1.source_versions WHERE source_id=$1 AND version=$2',[source.id,source.version])).rows[0]?.config;
        const previouslyConfigured = previous?.connection?.readiness === 'ready' || previous?.connector === 'pbc-html-1.0.0';
        const state = previous && !previouslyConfigured && connection.readiness === 'ready' ? 'ACTIVE' : source.state;
        const config = {catalog:row,connector:connection.id,connection,state};
        if (previous && digest(previous) === digest(config)) continue;
        const version = previous ? source.version+1 : source.version;
        await client.query('INSERT INTO m1.source_versions(source_id,version,config) VALUES($1,$2,$3)',[source.id,version,config]);
        await client.query('UPDATE m1.sources SET name=$2,url=$3,metadata=$4,state=$5,version=$6 WHERE id=$1',[source.id,row.name,row.url,row,state,version]);
      }
    });
  }
  async connectionFor(op: Pick<OperationRow,'source_id'|'source_version'>, client: Pool | PoolClient = this.db): Promise<SourceConnector> {
    const row = first((await client.query<{config:{connection?:SourceConnector;connector?:string};catalog_key:string}>('SELECT v.config,s.catalog_key FROM m1.source_versions v JOIN m1.sources s ON s.id=v.source_id WHERE v.source_id=$1 AND v.version=$2',[op.source_id,op.source_version])).rows);
    if (row.config.connection) return row.config.connection;
    if (row.catalog_key === 'wiki-source-001' && row.config.connector === 'pbc-html-1.0.0') return connectorFor(row.catalog_key);
    throw new DomainError('CONNECTOR_NOT_CONFIGURED',409);
  }
  async checkSource(op: OperationRow, client: Pool | PoolClient = this.db): Promise<void> {
    const source = first((await client.query<{ catalog_key: string; state: string }>('SELECT * FROM platform.lock_source($1)', [op.source_id])).rows);
    await this.authorize(op.actor, 'submit', source.catalog_key, client);
    if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
  }
  async intent(client: PoolClient, kind: string, owner: string, generation: number): Promise<void> {
    await client.query('INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [kind, owner, generation, `l0/${kind}/${owner}/${generation}`]);
  }
  async submit(command: FetchCommand, actor: string, key: string): Promise<OperationRow> {
    if (!/^[\x21-\x7e]{1,128}$/.test(key)) throw new DomainError('IDEMPOTENCY_KEY_INVALID', 400);
    const requestedUrl = command.url ?? null;
    await this.authorize(actor, 'submit', command.source_key);
    const snapshot = first((await this.db.query<{ id: string; version: number }>('SELECT id,version FROM m1.sources WHERE catalog_key=$1', [command.source_key])).rows);
    const connection = await this.connectionFor({source_id:snapshot.id,source_version:snapshot.version}); requireConnector(connection);
    command = { ...command, ...(command.url ? { url: connection.kind==='pbc' ? assertPbcUrl(command.url).href : assertSourceUrl(connection,command.url).href } : {}) };
    const input = { type: 'SOURCE_FETCH', ...command };
    const entryUrl = assertSourceUrl(connection,sourceEntryUrl(connection)).href;
    const ref = await this.artifacts.put(Buffer.from(JSON.stringify({ ...input, entry_url:entryUrl, requested_url: requestedUrl, source_id: snapshot.id, source_version: snapshot.version })), 'intake-command');
    return transaction(this.db, async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${actor}:source-fetch:${key}`]);
      const prior = (await client.query<{ digest: string; operation_id: string }>('SELECT digest,operation_id FROM platform.command_receipts WHERE actor=$1 AND kind=\'source-fetch\' AND key=$2', [actor, key])).rows[0];
      if (prior) {
        if (prior.digest !== digest(input)) throw new DomainError('IDEMPOTENCY_CONFLICT', 409);
        await this.authorize(actor, 'submit', command.source_key, client);
        return first((await client.query<OperationRow>('SELECT * FROM information.operations WHERE id=$1', [prior.operation_id])).rows);
      }
      await this.authorize(actor, 'submit', command.source_key, client);
      const source = first((await client.query<{ id: string; version: number; state: string }>('SELECT * FROM platform.source_for_submit($1)', [command.source_key])).rows);
      if (source.state !== 'ACTIVE') throw new DomainError('SOURCE_DISABLED', 409);
      if (source.id !== snapshot.id || source.version !== snapshot.version) throw new DomainError('SOURCE_VERSION_CHANGED', 409);
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
    const snapshot = await this.rawOperation(id); this.guard(snapshot, generation);
    const connection = await this.connectionFor(snapshot);
    const itemUrl = (value:string) => connection.kind==='pbc' ? assertPbcUrl(value).href : assertSourceUrl(connection,value).href;
    items = items.map(item => ({ ...item, url:itemUrl(item.url) }));
    const captured = await this.artifacts.capture(id, 'discovery', Buffer.from(JSON.stringify({ items, raw: raw.toString('base64') })));
    const fixed = JSON.parse((await this.artifacts.read(captured.sha256)).toString('utf8')) as { items: SourceItem[]; raw: string };
    if (!Array.isArray(fixed.items) || !fixed.items.length || fixed.items.length > 5 || typeof fixed.raw !== 'string') throw new DomainError('CAPTURE_INTEGRITY', 503);
    items = fixed.items.map(item => ({ ...item, url:itemUrl(item.url) }));
    raw = Buffer.from(fixed.raw, 'base64');
    const list = await this.artifact(await this.artifacts.put(raw, 'source-list'));
    const commands = await Promise.all(items.map(async item => ({ item, artifact: await this.putJson({ type: 'SOURCE_REFERENCE', source_id: snapshot.source_id, source_version: snapshot.source_version, actor: snapshot.actor, parent_operation_id: id, url: item.url, connector:connection.id,scope:connection.scope }, 'intake-command') })));
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
  async recoverDiscovery(id: string, generation: number): Promise<string[] | null> {
    const op = await this.rawOperation(id); this.guard(op, generation);
    if (op.raw_artifact_id) return (await this.db.query<{ id: string }>('SELECT id FROM information.operations WHERE parent_id=$1 ORDER BY id', [id])).rows.map(row => row.id);
    const captured = await this.artifacts.recoverCapture(id, 'discovery');
    if (!captured) return null;
    const fixed = JSON.parse((await this.artifacts.read(captured.sha256)).toString('utf8')) as { items: SourceItem[]; raw: string };
    return this.recordDiscovery(id, generation, fixed.items, Buffer.from(fixed.raw, 'base64'));
  }
  async recordRaw(id: string, generation: number, raw: Buffer): Promise<void> {
    if (await this.recoverRaw(id, generation)) return;
    const artifact = await this.artifact(await this.artifacts.capture(id, 'raw', raw));
    await transaction(this.db, async client => {
      const op = await this.rawOperation(id, client, true); this.guard(op, generation); await this.checkSource(op, client);
      if (op.raw_artifact_id || (await client.query('SELECT 1 FROM information.acquisitions WHERE operation_id=$1', [id])).rowCount) return;
      await client.query('INSERT INTO information.acquisitions(operation_id,raw_artifact_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, artifact]);
    });
    await this.recoverRaw(id, generation);
  }
  async recoverRaw(id: string, generation: number): Promise<boolean> {
    const op = await this.rawOperation(id); this.guard(op, generation);
    let receipt = (await this.db.query<{ raw_artifact_id: string }>('SELECT raw_artifact_id FROM information.acquisitions WHERE operation_id=$1 ORDER BY acquired_at,id LIMIT 1', [id])).rows[0];
    if (!op.raw_artifact_id && !receipt) {
      const captured = await this.artifacts.recoverCapture(id, 'raw');
      if (captured) {
        const artifact = await this.artifact(captured);
        await transaction(this.db, async client => {
          const current = await this.rawOperation(id, client, true); this.guard(current, generation); await this.checkSource(current, client);
          await client.query('INSERT INTO information.acquisitions(operation_id,raw_artifact_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, artifact]);
        });
        receipt = (await this.db.query<{ raw_artifact_id: string }>('SELECT raw_artifact_id FROM information.acquisitions WHERE operation_id=$1', [id])).rows[0];
      }
    }
    const artifact = op.raw_artifact_id || receipt?.raw_artifact_id;
    if (!artifact) return false;
    await this.bytes(artifact);
    await transaction(this.db, async client => {
      const current = await this.rawOperation(id, client, true); this.guard(current, generation); await this.checkSource(current, client);
      if (current.raw_artifact_id) return;
      await client.query('UPDATE information.operations SET raw_artifact_id=$2,status=\'running\',stage=\'acquired\',reason_code=NULL,updated_at=now() WHERE id=$1', [id, artifact]);
    });
    return true;
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
      const identity = first((await client.query<{ id: string; current_version_id: string | null }>('INSERT INTO information.materials(source_id,identity) VALUES($1,$2) ON CONFLICT(source_id,identity) DO UPDATE SET identity=EXCLUDED.identity RETURNING id,current_version_id', [op.source_id, material.sourceIdentity ?? op.url])).rows);
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
    const messages = await this.db.query<{ id: string }>('SELECT id FROM platform.messages WHERE state IN (\'pending\',\'blocked\') AND next_attempt_at<=now() ORDER BY id LIMIT 20');
    for (const pending of messages.rows) {
      await transaction(this.db, async client => {
        const message = (await client.query<{ id: string; version_id: string }>('SELECT id,version_id FROM platform.messages WHERE id=$1 AND state IN (\'pending\',\'blocked\') FOR UPDATE SKIP LOCKED', [pending.id])).rows[0];
        if (!message) return;
        const owner = first((await client.query<OperationRow>('SELECT * FROM information.operations WHERE version_id=$1 ORDER BY created_at LIMIT 1', [message.version_id])).rows);
        try { await this.checkSource(owner, client); }
        catch (error) {
          if (!(error instanceof DomainError)) throw error;
          await client.query('UPDATE platform.messages SET state=\'blocked\' WHERE id=$1', [message.id]);
          await client.query('UPDATE information.operations SET status=\'recoverable\',reason_code=$2 WHERE version_id=$1 AND processing_id IS NULL', [message.version_id, error.code]);
          return;
        }
        const processing = first((await client.query<{ id: string; generation: number }>('INSERT INTO information.processing_runs(version_id) VALUES($1) ON CONFLICT(version_id,analysis_key) DO UPDATE SET version_id=EXCLUDED.version_id RETURNING id,generation', [message.version_id])).rows);
        await client.query('INSERT INTO platform.inbox(message_id,processing_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [message.id, processing.id]);
        await this.intent(client, 'extract', processing.id, Number(processing.generation));
        await client.query('UPDATE platform.messages SET state=\'received\',receipt_processing_id=$2,attempts=attempts+1 WHERE id=$1', [message.id, processing.id]);
        await this.attachProcessing(client, message.version_id);
      });
    }
    await this.attachProcessing(this.db);
  }
  private async attachProcessing(client: Pool | PoolClient, versionId: string | null = null): Promise<void> {
    await client.query(`UPDATE information.operations o SET processing_id=p.id,
      status=CASE WHEN p.extraction_status='completed' THEN 'completed'
        WHEN p.extraction_status='review' THEN 'review'
        WHEN p.extraction_status='recoverable' AND p.error_code='MODEL_NOT_CONFIGURED' THEN 'waiting_config'
        WHEN p.extraction_status='recoverable' THEN 'recoverable' ELSE 'running' END,
      stage=CASE WHEN p.extraction_status='completed' THEN 'candidates_saved' ELSE 'extract' END,
      reason_code=p.error_code,updated_at=now()
      FROM platform.messages m JOIN information.processing_runs p ON p.id=m.receipt_processing_id
      WHERE o.version_id=m.version_id AND m.state='received' AND o.processing_id IS NULL AND ($1::uuid IS NULL OR o.version_id=$1)`, [versionId]);
  }
  async processing(id: string, client: Pool | PoolClient = this.db, lock = false): Promise<ProcessingRow> {
    return first((await client.query<ProcessingRow>(`SELECT * FROM information.processing_runs WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows);
  }
  async acceptSet(id: string, generation: number, data: ExtractionResult): Promise<void> {
    await transaction(this.db, async client => {
      const processing = await this.processing(id, client, true); this.guard(processing, generation);
      if (processing.extraction_status === 'completed') return;
      if (processing.extraction_status === 'review') throw new DomainError('OUTPUT_REVIEW_REQUIRED', 409);
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
      op.slice_status = !statuses.length ? op.status : statuses.every(s => s === 'completed') ? 'completed' : statuses.includes('completed') ? 'partial' : statuses.includes('review') ? 'review' : statuses.includes('recoverable') ? 'recoverable' : statuses.includes('waiting_config') ? 'waiting_config' : 'running';
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
