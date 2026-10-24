import { readFile } from 'node:fs/promises';
import { DomainError, type CatalogEntry } from '../platform/types.js';

export async function readCatalog(path: string): Promise<CatalogEntry[]> {
  const source = await readFile(path, 'utf8');
  const match = source.match(/^\s*(?:\/\/[^\n]*\n)*\s*window\.RISK_HOT_SOURCE_CATALOG\s*=\s*([\s\S]*);\s*$/u);
  if (!match?.[1]) throw new DomainError('CATALOG_FORMAT');
  const rows: unknown = JSON.parse(match[1]);
  const keys = ['id', 'name', 'url', 'tier', 'group', 'focus', 'context'];
  if (!Array.isArray(rows) || !rows.every(row => row && keys.every(key => typeof row[key] === 'string'))) {
    throw new DomainError('CATALOG_INVALID');
  }
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new DomainError('CATALOG_DUPLICATE_ID');
  return rows as CatalogEntry[];
}
