import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainError } from '../../platform/types.js';
import type { ExecutionStore } from '../processing/execution.js';
import type { SourceConnector } from './connectors.js';

export type Profile = Record<string, string | string[]> & { name: string; url: string };
interface Source {
  id: string; catalog_key: string; name: string; url: string; state: string; version: number; metadata: Profile;
}
type SourceConfig = { catalog: Profile; profile?: Profile; state: string; connection?: SourceConnector; connector?: string; verification_required?: boolean };
const canonicalUrl = (value: string): string => {
  if (!value) return '';
  let url: URL;
  try { url = new URL(value); } catch { throw new DomainError('SOURCE_URL_INVALID', 400); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new DomainError('SOURCE_URL_INVALID', 400);
  url.hash = ''; return url.href;
};
const identityText = (value: unknown) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

export class SourceManagement {
  constructor(private repo: ExecutionStore) {}
  private async source(key: string, tx: PoolClient): Promise<Source> {
    const row = (await tx.query<Source>('SELECT * FROM m1.sources WHERE catalog_key=$1 FOR UPDATE', [key])).rows[0];
    if (!row) throw new DomainError('NOT_FOUND', 404); return row;
  }
  private async unique(profile: Profile, tx: PoolClient, except?: string): Promise<void> {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('m1-profile-identities',0))");
    const rows = (await tx.query<Source>('SELECT * FROM m1.sources WHERE id IS DISTINCT FROM $1', [except ?? null])).rows;
    const url = canonicalUrl(profile.url);
    for (const row of rows) {
      let prior = ''; try { prior = canonicalUrl(row.url); } catch { /* Legacy non-web locators are not URL identities. */ }
      if ((url && url === prior) || (!url && !prior && identityText(profile.name) === identityText(row.name) && identityText(profile.publisher) === identityText(row.metadata.publisher))) throw new DomainError('SOURCE_DUPLICATE', 409);
    }
  }
  async create(actor: string, key: string, profile: Profile) {
    const normalized = { ...profile, name: profile.name.trim(), url: canonicalUrl(profile.url) };
    if (!normalized.name) throw new DomainError('SOURCE_NAME_REQUIRED', 400);
    return this.repo.action(actor, 'source-create', key, profile, async tx => {
      await this.repo.authorize(actor, 'source_admin', undefined, tx);
      const access = (await tx.query<{ full: boolean }>("SELECT '*'=ANY(source_keys) AS full FROM platform.actors WHERE subject=$1", [actor])).rows[0];
      if (!access?.full) throw new DomainError('FORBIDDEN', 403);
    }, async tx => {
      await this.unique(normalized, tx);
      const catalogKey = `custom-source-${randomUUID()}`;
      const row = (await tx.query<Source>("INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES($1,$2,$3,$4,'DISABLED') RETURNING *", [catalogKey, normalized.name, normalized.url, normalized])).rows[0]!;
      const connection: SourceConnector = { key: catalogKey, id: `${catalogKey}-unconfigured-v1`, kind: 'blocked', readiness: 'needs_adapter', reason: 'CONNECTOR_NOT_CONFIGURED', entryUrl: null, scope: '待配置接入方式', allowed: [] };
      await tx.query('INSERT INTO m1.source_versions(source_id,version,config) VALUES($1,1,$2)', [row.id, { catalog: normalized, profile: normalized, connection, state: row.state }]);
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'source-create',$2,$3)", [actor, row.id, { version: 1, state: row.state }]);
      return { ...row, profile: row.metadata, connection, connector_configured: false };
    });
  }
  async edit(actor: string, key: string, input: { expected_version: number; profile: Profile; reason?: string }, commandKey: string) {
    return this.repo.action(actor, 'source-edit', commandKey, { key, ...input }, tx => this.repo.authorize(actor, 'source_admin', key, tx), async tx => {
      // Use one identity lock order for create/edit, before locking any source row.
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('m1-profile-identities',0))");
      const source = await this.source(key, tx);
      if (source.version !== input.expected_version) throw new DomainError('VERSION_CONFLICT', 409);
      const profile: Profile = { ...source.metadata, ...input.profile, name: input.profile.name.trim(), url: canonicalUrl(input.profile.url) };
      if (!profile.name) throw new DomainError('SOURCE_NAME_REQUIRED', 400);
      await this.unique(profile, tx, source.id);
      const previous = (await tx.query<{ config: SourceConfig }>('SELECT config FROM m1.source_versions WHERE source_id=$1 AND version=$2', [source.id, source.version])).rows[0]!.config;
      const materialChange = ['name', 'url', 'publisher', 'allowed_scope', 'identity_basis'].some(field => JSON.stringify(source.metadata[field] ?? (field === 'name' ? source.name : field === 'url' ? source.url : '')) !== JSON.stringify(profile[field] ?? ''));
      const state = materialChange ? 'DISABLED' : source.state;
      const next = source.version + 1;
      await tx.query('INSERT INTO m1.source_versions(source_id,version,config) VALUES($1,$2,$3)', [source.id, next, { ...previous, catalog: profile, profile, state, verification_required: materialChange || previous.verification_required || false }]);
      const result = (await tx.query<Source>('UPDATE m1.sources SET name=$2,url=$3,metadata=$4,state=$5,version=$6 WHERE id=$1 RETURNING *', [source.id, profile.name, profile.url, profile, state, next])).rows[0]!;
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'source-edit',$2,$3)", [actor, source.id, { reason: input.reason ?? '', previous_version: source.version, version: next, previous_state: source.state, state, verification_required: materialChange }]);
      return { ...result, profile, verification_required: materialChange };
    });
  }
  async state(actor: string, sourceKey: string, input: { state: string; expected_version?: number; reason?: string }, key: string) {
    return this.repo.action(actor, 'source-state', key, { key: sourceKey, ...input }, tx => this.repo.authorize(actor, 'source_admin', sourceKey, tx), async tx => {
      const source = await this.source(sourceKey, tx);
      if (input.expected_version !== undefined && source.version !== input.expected_version) throw new DomainError('VERSION_CONFLICT', 409);
      const config = (await tx.query<{ config: SourceConfig }>('SELECT config FROM m1.source_versions WHERE source_id=$1 AND version=$2', [source.id, source.version])).rows[0]!.config;
      if (input.state === 'ACTIVE' && (sourceKey.startsWith('custom-source-') || config.verification_required) && ['publisher', 'identity_basis', 'allowed_scope'].some(field => !String(source.metadata[field] ?? '').trim())) throw new DomainError('SOURCE_VERIFICATION_REQUIRED', 409);
      if (source.state === input.state) return { ...source, key: sourceKey, profile: source.metadata };
      const next = source.version + 1;
      await tx.query('INSERT INTO m1.source_versions(source_id,version,config) VALUES($1,$2,$3)', [source.id, next, { ...config, state: input.state, verification_required: input.state === 'ACTIVE' ? false : config.verification_required ?? false }]);
      await tx.query('UPDATE m1.sources SET state=$2,version=$3 WHERE id=$1', [source.id, input.state, next]);
      await tx.query("INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,'source-state',$2,$3)", [actor, source.id, { reason: input.reason ?? '', previous_version: source.version, version: next, previous_state: source.state, state: input.state }]);
      return { key: sourceKey, state: input.state, version: next };
    });
  }
  async history(actor: string, key: string) {
    await this.repo.authorize(actor, 'read', key);
    const source = (await this.repo.db.query<Source>('SELECT * FROM m1.sources WHERE catalog_key=$1', [key])).rows[0];
    if (!source) throw new DomainError('NOT_FOUND', 404);
    const items = (await this.repo.db.query<{ version: number; config: SourceConfig; created_at: Date }>('SELECT version,config,created_at FROM m1.source_versions WHERE source_id=$1 ORDER BY version DESC', [source.id])).rows;
    return { items: items.map(row => ({ ...row, profile: row.config.profile ?? row.config.catalog, state: row.config.state })), audit: (await this.repo.db.query('SELECT actor,action,detail,created_at FROM platform.audit_log WHERE owner_id=$1 ORDER BY created_at DESC', [source.id])).rows };
  }
}
