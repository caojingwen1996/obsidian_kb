import pg from 'pg';
import { randomUUID } from 'node:crypto';
import {
  BusinessError,
  type Actor,
  type Data,
  type Domain,
  type DomainStore,
  type RecordRow,
} from '../core/types.js';
export const domains: Domain[] = [
  'reference',
  'observations',
  'information',
  'registry',
  'analysis',
  'publication',
  'operations',
  'identity',
];
export const defaultDatabaseUrl = 'postgres://riskhot:riskhot-local@127.0.0.1:55432/riskhot';
export function createPool(url = process.env.DATABASE_URL || defaultDatabaseUrl) {
  return new pg.Pool({ connectionString: url, max: 12 });
}
function validId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    throw new BusinessError('INVALID_ID', '标识格式无效');
}
function schema(domain: Domain) {
  if (!domains.includes(domain)) throw new BusinessError('INVALID_DOMAIN', '模块不存在', 404);
  return domain;
}
function convert(row: Record<string, unknown>): RecordRow {
  return {
    id: String(row.id),
    kind: String(row.kind),
    version: Number(row.version),
    status: String(row.status),
    data: row.data as Data,
    created_at: new Date(row.created_at as string).toISOString(),
    updated_at: new Date(row.updated_at as string).toISOString(),
  };
}
export class Store implements DomainStore {
  constructor(public client: pg.PoolClient) {}
  async get(domain: Domain, id: string, lock = false) {
    validId(id);
    const r = await this.client.query(
      `SELECT * FROM ${schema(domain)}.records WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
      [id],
    );
    if (!r.rows[0]) throw new BusinessError('NOT_FOUND', '记录不存在', 404);
    return convert(r.rows[0]);
  }
  async maybe(domain: Domain, id: string) {
    validId(id);
    const r = await this.client.query(`SELECT * FROM ${schema(domain)}.records WHERE id=$1`, [id]);
    return r.rows[0] ? convert(r.rows[0]) : undefined;
  }
  async list(domain: Domain, kind: string, limit = 10000) {
    const r = await this.client.query(
      `SELECT * FROM ${schema(domain)}.records WHERE kind=$1 ORDER BY created_at DESC,id LIMIT $2`,
      [kind, limit],
    );
    return r.rows.map(convert);
  }
  async create(domain: Domain, kind: string, data: Data, status = 'draft', id = randomUUID()) {
    const r = await this.client.query(
      `INSERT INTO ${schema(domain)}.records(id,kind,data,status) VALUES($1,$2,$3,$4) RETURNING *`,
      [id, kind, JSON.stringify(data), status],
    );
    const row = convert(r.rows[0]);
    await this.historyInsert(domain, row);
    return row;
  }
  async update(domain: Domain, id: string, version: number, data: Data, status?: string) {
    const r = await this.client.query(
      `UPDATE ${schema(domain)}.records SET data=$3,status=COALESCE($4,status),version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING *`,
      [id, version, JSON.stringify(data), status],
    );
    if (!r.rows[0]) throw new BusinessError('VERSION_CONFLICT', '记录已变化，请刷新后比较差异', 409);
    const row = convert(r.rows[0]);
    await this.historyInsert(domain, row);
    return row;
  }
  private async historyInsert(domain: Domain, r: RecordRow) {
    await this.client.query(
      `INSERT INTO ${schema(domain)}.history(id,version,kind,status,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [r.id, r.version, r.kind, r.status, JSON.stringify(r.data), r.created_at, r.updated_at],
    );
  }
  async history(domain: Domain, id: string) {
    const r = await this.client.query(
      `SELECT * FROM ${schema(domain)}.history WHERE id=$1 ORDER BY version`,
      [id],
    );
    return r.rows.map(convert);
  }
  async audit(actor: Actor, action: string, domain: Domain, id: string, detail: Data) {
    await this.client.query(
      'INSERT INTO platform.audit(actor_id,actor_name,action,domain,object_id,detail) VALUES($1,$2,$3,$4,$5,$6)',
      [actor.id, actor.name, action, domain, id, JSON.stringify(detail)],
    );
  }
  async emit(type: string, aggregateId: string, payload: Data) {
    await this.client.query('INSERT INTO platform.outbox(id,type,aggregate_id,payload) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      type,
      aggregateId,
      JSON.stringify(payload),
    ]);
  }
  async claim(key: string, value: string) {
    const r = await this.client.query(
      'INSERT INTO platform.claims(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING key',
      [key, value],
    );
    return !!r.rowCount;
  }
  async findClaim(key: string) {
    const r = await this.client.query('SELECT value FROM platform.claims WHERE key=$1', [key]);
    return r.rows[0]?.value as string | undefined;
  }
  async relate(riskId: string, eventId: string, updateId: string | null, reason: string) {
    const r = await this.client.query(
      'INSERT INTO registry.monitored_risk_event_relation(relation_id,risk_id,event_id,event_update_id,relation_reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT(risk_id,event_id) DO UPDATE SET is_active=true,updated_at=now() RETURNING *',
      [randomUUID(), riskId, eventId, updateId, reason],
    );
    return JSON.parse(JSON.stringify(r.rows[0])) as Data;
  }
  async relations(riskId: string) {
    const r = await this.client.query(
      'SELECT * FROM registry.monitored_risk_event_relation WHERE risk_id=$1 ORDER BY created_at',
      [riskId],
    );
    return JSON.parse(JSON.stringify(r.rows)) as Data[];
  }
}
export async function transaction<T>(pool: pg.Pool, fn: (store: Store) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await fn(new Store(c));
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
