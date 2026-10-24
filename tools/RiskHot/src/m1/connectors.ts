import { DomainError } from '../platform/types.js';
import { PBC_LIST } from '../l0/pbc.js';
import connections from '../data/source-connections.json' with { type: 'json' };

export interface SourceConnector {
  key: string; id: string; kind: 'pbc' | 'article' | 'html-snapshot' | 'json-snapshot' | 'blocked';
  readiness: 'ready' | 'missing_url' | 'authentication_required' | 'access_blocked' | 'needs_adapter';
  reason?: string; entryUrl: string | null; scope: string;
  allowed: { origin: string; path: string; search?: string; searchPattern?: string }[];
  method?: 'POST'; referer?: string;
  dateQueries?: Record<string, 'month' | 'monthStart' | 'day'>;
  dateMeaning?: 'observation' | 'release' | 'snapshot';
  browser?: { waitFor: string; resourceOrigins?: string[] };
  discovery?: { format: 'html' | 'rss' | 'script-links' | 'nuxt-links' | 'json' | 'json-date'; selector: string; records?: string; nested?: string; where?: Record<string, string | number>; urlField?: string; titleField?: string; sortField?: string; datePath?: string; template?: string };
  html?: { body: string; title?: string; date?: string; datePattern?: string; encoding?: string; dateFromUrl?: { selector: string; parameter: string } };
  json?: { records: string; fields: { path: string; label: string; optional?: boolean }[]; dateField?: string; datePath?: string; dateParts?: string[]; dateParameter?: string; where?: Record<string, string | number | string[]>; script?: string; curve?: { xml: string; terms: string[] }; requirements?: {path:string;equals?:string;pattern?:string}[] };
  jsonArticle?: { script?: string; title: string; body: string; date: string; free?: string };
}

const profiles: SourceConnector[] = [{
  key: 'wiki-source-001', id: 'pbc-html-1.0.0', kind: 'pbc', readiness: 'ready',
  entryUrl: PBC_LIST, scope: '公开市场业务交易公告首页，最多5篇详情',
  allowed: [{ origin: 'https://www.pbc.gov.cn', path: '^/zhengcehuobisi/125207/125213/125431/(?:index\\.html|125475/\\d+/index\\.html)$' }],
}, ...connections as SourceConnector[]];

export function sourceEntryUrl(profile: SourceConnector, now = new Date()): string {
  if (!profile.entryUrl) throw new DomainError(profile.reason ?? 'SOURCE_URL_MISSING', 409);
  const url = new URL(profile.entryUrl);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(value => value.type === name)!.value;
  for (const [name,kind] of Object.entries(profile.dateQueries ?? {})) url.searchParams.set(name, part('year')+part('month')+(kind === 'monthStart' ? '01' : kind === 'day' ? part('day') : ''));
  return url.href;
}

export function connectorFor(key: string): SourceConnector {
  const configured = profiles.find(profile => profile.key === key);
  if (configured) return structuredClone(configured);
  const number = Number(key.replace('wiki-source-', ''));
  if (!/^wiki-source-\d{3}$/.test(key) || number < 1 || number > 40) throw new DomainError('SOURCE_UNKNOWN', 404);
  const missing = number === 17 || (number >= 28 && number <= 32);
  return { key, id: `${key}-pending-v1`, kind: 'blocked', readiness: missing ? 'missing_url' : 'needs_adapter', reason: missing ? 'SOURCE_URL_MISSING' : 'CONNECTOR_NOT_VERIFIED', entryUrl: null, scope: '待实际内容核验', allowed: [] };
}
