import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainError } from '../../platform/types.js';
import type { Repository } from '../processing/repository.js';
import type { Profile } from './management.js';

type Source = { id: string; catalog_key: string; name: string; url: string; state: string; metadata: Profile; financial_attributes: string[]; updated_at: Date };
export const currentSourceView=(source:Source)=>({id:source.id,catalog_key:source.catalog_key,name:source.name,url:source.url,state:source.state,financial_attributes:source.financial_attributes,metadata:{...source.metadata,dims:source.financial_attributes},updated_at:source.updated_at});
const timestamp = "GREATEST(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond')";
function attributes(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 2000)) throw new DomainError('SOURCE_FINANCIAL_ATTRIBUTES_INVALID', 400);
  return [...new Set(value.map(item => item.trim()))];
}
function canonical(value: string) {
  if (!value) return '';
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(); url.hash = ''; return url.href; }
  catch { throw new DomainError('SOURCE_URL_INVALID', 400); }
}
export class CurrentSourceManagement {
  constructor(private repo: Repository) {}
  private async source(tx: PoolClient, key: string): Promise<Source> {
    const source = (await tx.query<Source>('SELECT * FROM m1.sources WHERE catalog_key=$1 FOR UPDATE', [key])).rows[0];
    if (!source) throw new DomainError('NOT_FOUND', 404); return source;
  }
  private async unique(tx: PoolClient, profile: Profile, except?: string) {
    const sources = (await tx.query<Source>('SELECT * FROM m1.sources WHERE id IS DISTINCT FROM $1', [except ?? null])).rows;
    for (const source of sources) {
      let url = ''; try { url = canonical(source.url); } catch { /* 旧档案可能是非网页定位。 */ }
      if ((profile.url && profile.url === url) || (!profile.url && !url && source.name.normalize('NFKC').trim().toLowerCase() === profile.name.normalize('NFKC').trim().toLowerCase() && String(source.metadata.publisher ?? '') === String(profile.publisher ?? ''))) throw new DomainError('SOURCE_DUPLICATE', 409);
    }
  }
  async create(actor: string, key: string, input: Profile) {
    const profile = { ...input, name: input.name.trim(), url: canonical(input.url), dims: attributes(input.dims) };
    if (!profile.name) throw new DomainError('SOURCE_NAME_REQUIRED', 400);
    return this.repo.action(actor, 'source-create', key, input, async tx => {
      await this.repo.authorize(actor, 'source_admin', undefined, tx);
      if (!(await tx.query("SELECT 1 FROM platform.actors WHERE subject=$1 AND '*'=ANY(source_keys)", [actor])).rowCount) throw new DomainError('FORBIDDEN', 403);
    }, async tx => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('m1-profile-identities',0))");
      await this.unique(tx, profile);
      const { dims, ...metadata } = profile;
      const source = (await tx.query<Source>("INSERT INTO m1.sources(catalog_key,name,url,metadata,financial_attributes,state) VALUES($1,$2,$3,$4,$5,'DISABLED') RETURNING *", [`custom-source-${randomUUID()}`, profile.name, profile.url, metadata, dims])).rows[0]!;
      await tx.query('INSERT INTO infomation.ingestion_schedules(source_id) VALUES($1)', [source.id]);
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'source-create',$2,$3)", [actor, source.id, { state: source.state }]);
      return { ...currentSourceView(source), profile, connection: { key: source.catalog_key, id: `${source.catalog_key}-unconfigured-v1`, kind: 'blocked', readiness: 'needs_adapter', reason: 'CONNECTOR_NOT_CONFIGURED', entryUrl: null, scope: '待配置接入方式', allowed: [] }, connector_configured: false };
    });
  }
  async edit(actor: string, key: string, input: { expected_updated_at?: string; profile: Profile; reason?: string }, command: string) {
    return this.repo.action(actor, 'source-edit', command, { key, ...input }, tx => this.repo.authorize(actor, 'source_admin', key, tx), async tx => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('m1-profile-identities',0))");
      const source = await this.source(tx, key);
      if (!input.expected_updated_at || source.updated_at.getTime() !== Date.parse(input.expected_updated_at)) throw new DomainError('SOURCE_UPDATED_AT_CHANGED', 409);
      const profile: Profile = { ...source.metadata, dims: source.financial_attributes, ...input.profile, name: input.profile.name.trim(), url: canonical(input.profile.url) };
      if (!profile.name) throw new DomainError('SOURCE_NAME_REQUIRED', 400);
      await this.unique(tx, profile, source.id);
      const changed = ['name', 'url', 'publisher', 'allowed_scope', 'identity_basis'].some(field => JSON.stringify(source.metadata[field] ?? (field === 'name' ? source.name : field === 'url' ? source.url : '')) !== JSON.stringify(profile[field] ?? ''));
      const { dims, ...metadata } = profile;
      const result = (await tx.query<Source>(`UPDATE m1.sources SET name=$2,url=$3,metadata=$4,state=$5,financial_attributes=$6,updated_at=${timestamp} WHERE id=$1 RETURNING *`, [source.id, profile.name, profile.url, metadata, changed ? 'DISABLED' : source.state, attributes(dims)])).rows[0]!;
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'source-edit',$2,$3)", [actor, source.id, { reason: input.reason ?? '', previous_updated_at: source.updated_at, updated_at: result.updated_at, state: result.state }]);
      return { ...currentSourceView(result), profile: currentSourceView(result).metadata };
    });
  }
  async state(actor: string, key: string, input: { state: string; expected_updated_at?: string; reason?: string }, command: string) {
    if (!['ACTIVE', 'DISABLED'].includes(input.state)) throw new DomainError('SOURCE_STATE_INVALID', 400);
    return this.repo.action(actor, 'source-state', command, { key, ...input }, tx => this.repo.authorize(actor, 'source_admin', key, tx), async tx => {
      const source = await this.source(tx, key);
      if (!input.expected_updated_at || source.updated_at.getTime() !== Date.parse(input.expected_updated_at)) throw new DomainError('SOURCE_UPDATED_AT_CHANGED', 409);
      if (input.state === 'ACTIVE' && key.startsWith('custom-source-') && ['publisher', 'identity_basis', 'allowed_scope'].some(field => !String(source.metadata[field] ?? '').trim())) throw new DomainError('SOURCE_VERIFICATION_REQUIRED', 409);
      const result = (await tx.query<Source>(`UPDATE m1.sources SET state=$2,updated_at=${timestamp} WHERE id=$1 RETURNING *`, [source.id, input.state])).rows[0]!;
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'source-state',$2,$3)", [actor, source.id, { reason: input.reason ?? '', previous_state: source.state, state: input.state }]);
      return { ...currentSourceView(result), profile: currentSourceView(result).metadata };
    });
  }
}
