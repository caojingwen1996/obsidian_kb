import { load } from 'cheerio';
import type { SourceConnector } from '../m1/connectors.js';
import { DomainError, type NormalizedMaterial, type SourceItem } from '../platform/types.js';
import { parsePbc, discoverPbc } from './pbc.js';
import { clean, decodeHtml, htmlSegments, selectedText, segment } from './source-html.js';

export function assertSourceUrl(profile: SourceConnector, value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new DomainError('SOURCE_URL_NOT_ALLOWED', 400); }
  if (value.length > 2048 || url.protocol !== 'https:' || url.username || url.password || url.hash || !profile.allowed.some(rule => url.origin === rule.origin && new RegExp(rule.path).test(url.pathname) && (rule.searchPattern ? new RegExp(rule.searchPattern).test(url.search) : url.search === (rule.search ?? '')))) throw new DomainError('SOURCE_URL_NOT_ALLOWED', 400);
  return url;
}
export function requireConnector(profile: SourceConnector): void {
  if (profile.readiness !== 'ready') throw new DomainError(profile.reason ?? 'CONNECTOR_NOT_CONFIGURED', 409);
}
export async function fetchSource(profile: SourceConnector, value: string, fetcher: typeof fetch = fetch): Promise<Buffer> {
  requireConnector(profile);
  let url = assertSourceUrl(profile, value).href;
  const signal = AbortSignal.timeout(30_000);
  try {
    for (let hop = 0; hop < 4; hop++) {
      const response = await fetcher(url, { redirect: 'manual', signal, method: profile.method && url !== profile.entryUrl ? profile.method : 'GET', headers: { 'User-Agent': 'RiskHot/0.2 (public source ingestion)', accept: 'text/html,application/json,application/rss+xml,application/xml,text/xml', ...(profile.referer ? { referer: profile.referer } : {}) } });
      if ([301,302,303,307,308].includes(response.status)) {
        const next = response.headers.get('location'); await response.body?.cancel();
        if (!next) throw new DomainError('SOURCE_REDIRECT_INVALID');
        url = assertSourceUrl(profile, new URL(next, url).href).href; continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new DomainError(`SOURCE_HTTP_${response.status}`, 502, response.status === 429 || response.status >= 500); }
      if (!/text\/(html|xml|plain)|application\/(json|rss\+xml|atom\+xml|xml)/i.test(response.headers.get('content-type') ?? '')) { await response.body?.cancel(); throw new DomainError('SOURCE_MEDIA_UNSUPPORTED'); }
      if (!response.body) throw new DomainError('SOURCE_EMPTY');
      const chunks: Uint8Array[] = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength; if (size > 1_048_576) throw new DomainError('RAW_TOO_LARGE', 413); chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    throw new DomainError('SOURCE_REDIRECT_LIMIT');
  } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('SOURCE_NETWORK_ERROR', 502, true); }
}
export function discoverSource(profile: SourceConnector, raw: Buffer, baseUrl: string, limit: number): SourceItem[] {
  requireConnector(profile); assertSourceUrl(profile, baseUrl);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new DomainError('BATCH_LIMIT', 400);
  if (profile.kind === 'pbc') return discoverPbc(decodeHtml(raw), baseUrl, limit);
  if (profile.kind !== 'article' && !profile.discovery) return [{ url: baseUrl, title: profile.scope }];
  if (!profile.discovery) throw new DomainError('SOURCE_DISCOVERY_MISSING');
  const found = new Map<string, SourceItem>();
  const add = (value: string, title: string) => {
    try { const url = assertSourceUrl(profile, new URL(value, baseUrl).href).href; if (!found.has(url)) found.set(url, { url, title: clean(title) }); }
    catch { /* Do not turn unregistered resources into executable work. */ }
  };
  if (profile.discovery.format === 'json-date' || profile.discovery.format === 'json') {
    let data: unknown;
    try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { throw new DomainError('SOURCE_JSON_INVALID'); }
    const config = profile.discovery;
    if (config.format === 'json-date') {
      const date = dateValue(at(data, config.datePath!));
      add(config.template!.replace('{date}', encodeURIComponent(date)), profile.scope);
    } else {
      const records = at(data, config.records!);
      if (!Array.isArray(records)) throw new DomainError('SOURCE_SCHEMA_INVALID');
      const groups = records.filter(item => Object.entries(config.where ?? {}).every(([key,value]) => at(item,key) === value));
      const items = config.nested ? groups.flatMap(item => { const nested = at(item, config.nested!); if (!Array.isArray(nested)) throw new DomainError('SOURCE_SCHEMA_INVALID'); return nested; }) : groups;
      if (config.sortField) items.sort((a,b) => String(at(b,config.sortField!)).localeCompare(String(at(a,config.sortField!))));
      for (const item of items) {
        const identifier = at(item, config.urlField!);
        if (typeof identifier !== 'string' && typeof identifier !== 'number') throw new DomainError('SOURCE_SCHEMA_INVALID');
        const link = config.template ? config.template.replace('{id}', encodeURIComponent(String(identifier))) : String(identifier);
        add(link, String(at(item, config.titleField ?? '') ?? profile.scope));
      }
    }
    if (!found.size) throw new DomainError('SOURCE_ITEMS_MISSING');
    return [...found.values()].slice(0,limit);
  }
  const $ = load(decodeHtml(raw, profile.html?.encoding), { xmlMode: profile.discovery.format === 'rss' });
  $(profile.discovery.selector).each((_, node) => {
    if (profile.discovery!.format === 'nuxt-links') {
      const script = $(node).text();
      if (!script.startsWith('window.__NUXT__=')) return;
      for (const match of script.matchAll(/\{id:(\d+),title:("(?:\\.|[^"\\])*")/gu)) add(profile.discovery!.template!.replace('{id}',match[1]!),JSON.parse(match[2]!));
      return;
    }
    if (profile.discovery!.format === 'script-links') {
      const script = $(node).find('script').text();
      const value = script.match(/^\s*var\s+curHref\s*=\s*(['"])([^'"\r\n]+)\1/mu)?.[2];
      const title = script.match(/^\s*var\s+curTitle\s*=\s*(['"])([^'"\r\n]+)\1/mu)?.[2];
      if (value) add(value, title ?? ''); return;
    }
    const rss = profile.discovery!.format === 'rss';
    const value = rss ? $(node).find('link').first().text().trim() || $(node).find('link').first().attr('href') : $(node).attr('href');
    if (!value) return;
    add(value, rss ? $(node).find('title').text() : $(node).text());
  });
  if (!found.size) throw new DomainError('SOURCE_ITEMS_MISSING');
  return [...found.values()].slice(0, limit);
}
const at = (value: unknown, path: string): unknown => path ? path.split('.').reduce<unknown>((item, key) => item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined, value) : value;
const pointer = (path: string) => '/' + path.split('.').map(key => key.replaceAll('~','~0').replaceAll('/','~1')).join('/');
function curveRecords(data: unknown, config: { xml: string; terms: string[] }): unknown[] {
  const xml = at(data,config.xml); if (typeof xml !== 'string') throw new DomainError('SOURCE_SCHEMA_INVALID');
  const $ = load(xml,{ xmlMode:true });
  const axis = new Map($('chart > xaxis > value').toArray().map(node => [$(node).attr('xid'),$(node).text()]));
  const rows = $('chart > graphs > graph[gid="0"] > value').toArray().flatMap(node => {
    const xid = $(node).attr('xid'); const years = axis.get(xid);
    if (!years || !config.terms.some(term => Number(term) === Number(years))) return [];
    const value = $(node).text(); if (!value || !Number.isFinite(Number(value))) throw new DomainError('SOURCE_SCHEMA_INVALID');
    return [{ xid,term_years:years,yield_percent:value }];
  });
  if (rows.length !== config.terms.length) throw new DomainError('SOURCE_DATA_INCOMPLETE');
  return rows;
}
function dateValue(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || !(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|^\d{8}$|\d{1,2}\/\d{1,2}\/\d{4}/u.test(value) || Number.isFinite(Date.parse(value)))) throw new DomainError('SOURCE_DATE_MISSING');
  return clean(value);
}
export function parseSource(profile: SourceConnector, raw: Buffer, value: string): NormalizedMaterial {
  requireConnector(profile); const url = assertSourceUrl(profile, value).href;
  if (raw.byteLength > 1_048_576) throw new DomainError('RAW_TOO_LARGE', 413);
  if (profile.kind === 'pbc') return parsePbc(raw, url);
  const text = profile.kind === 'json-snapshot' || (profile.jsonArticle && !profile.jsonArticle.script) ? new TextDecoder('utf-8', { fatal: true }).decode(raw) : decodeHtml(raw, profile.html?.encoding);
  let material: NormalizedMaterial;
  if (profile.kind === 'json-snapshot') {
    if (!profile.json) throw new DomainError('SOURCE_SCHEMA_INVALID');
    let data: unknown;
    try { data = JSON.parse(profile.json.script ? load(text)(profile.json.script).text() : text); } catch { throw new DomainError('SOURCE_JSON_INVALID'); }
    const records = profile.json.curve ? curveRecords(data,profile.json.curve) : at(data, profile.json.records);
    if (!Array.isArray(records)) throw new DomainError('SOURCE_SCHEMA_INVALID');
    const selected = records.map((item: unknown, index: number) => ({ item, index })).filter(({ item }) => Object.entries(profile.json!.where ?? {}).every(([key, wanted]) => Array.isArray(wanted) ? wanted.includes(String(at(item,key))) : at(item, key) === wanted));
    if (!selected.length) throw new DomainError('SOURCE_DATA_EMPTY');
    const date = profile.json.datePath ? at(data, profile.json.datePath) : profile.json.dateParameter ? new URL(url).searchParams.get(profile.json.dateParameter) : profile.json.dateParts ? profile.json.dateParts.map(field => at(selected[0]!.item,field)).join('-') : at(selected[0]!.item, profile.json.dateField ?? '');
    const observed = dateValue(date);
    const segments = selected.map(({ item, index }) => {
      const fields = profile.json!.fields.map(field => {
        const fieldValue = at(item, field.path); if (fieldValue === undefined) { if (field.optional) return null; throw new DomainError('SOURCE_SCHEMA_INVALID'); }
        return `${field.label}: ${typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue)}`;
      });
      return segment(url, fields.filter(value => value !== null).join('\n'), profile.json!.curve ? `json:${pointer(profile.json!.curve.xml)}::xml xid=${String(at(item,'xid'))}` : `json:${pointer(profile.json!.records)}/${index}`, 'paragraph');
    });
    material = { url, title: profile.scope, publishedAtText: null, observedAtText: observed, sourceIdentity: `${url}\nobservation:${observed}`, normalizerVersion: profile.id, segments };
  } else if (profile.jsonArticle) {
    const config = profile.jsonArticle; let data: unknown;
    try { data = JSON.parse(config.script ? load(text)(config.script).text() : text); } catch { throw new DomainError('SOURCE_JSON_INVALID'); }
    if (config.free && at(data, config.free) !== true) throw new DomainError('SOURCE_AUTH_REQUIRED');
    const body = at(data, config.body), title = at(data, config.title), stamp = at(data, config.date);
    if (typeof body !== 'string' || typeof title !== 'string') throw new DomainError('SOURCE_SCHEMA_INVALID');
    const date = typeof stamp === 'number' ? new Date(stamp * 1000).toISOString() : dateValue(stamp);
    material = { url, title, publishedAtText: date, normalizerVersion: profile.id, segments: htmlSegments(`<main>${body}</main>`, 'main', url, `json:${pointer(config.body)}::html `) };
  } else {
    const config = profile.html; if (!config) throw new DomainError('SOURCE_SCHEMA_INVALID');
    const $ = load(text); let date = selectedText($, config.date);
    if (config.dateFromUrl) {
      const href = $(config.dateFromUrl.selector).first().attr('href');
      date = href ? new URL(href, url).searchParams.get(config.dateFromUrl.parameter) : null;
    }
    if (config.datePattern && date) date = date.match(new RegExp(config.datePattern))?.[1] ?? null;
    material = { url, title: selectedText($, config.title) ?? profile.scope, publishedAtText: date, normalizerVersion: profile.id, segments: htmlSegments(text, config.body, url) };
    if (profile.kind === 'html-snapshot') {
      const observed = dateValue(date); material.observedAtText = observed; material.publishedAtText = null;
      material.sourceIdentity = `${url}\nobservation:${observed}`;
    }
  }
  if (!material.segments.length) throw new DomainError('BODY_MISSING');
  if (material.segments.reduce((n,item) => n + Array.from(item.text).length, 0) > 20_000) throw new DomainError('TEXT_TOO_LARGE', 413);
  return material;
}
