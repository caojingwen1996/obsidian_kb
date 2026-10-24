import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { DomainError, type NormalizedMaterial, type SourceItem, type Segment } from '../platform/types.js';

export const PBC_LIST = 'https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/index.html';
const ITEM_PATH = /^\/zhengcehuobisi\/125207\/125213\/125431\/125475\/\d+\/index\.html$/;
const clean = (value: string) => value.replace(/[\s\u00a0]+/gu, ' ').trim();

export function assertPbcUrl(value: string, list = false): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new DomainError('SOURCE_URL_NOT_ALLOWED', 400); }
  if (url.origin !== 'https://www.pbc.gov.cn' || url.username || url.password || url.search || url.hash || (!ITEM_PATH.test(url.pathname) && !(list && url.href === PBC_LIST))) {
    throw new DomainError('SOURCE_URL_NOT_ALLOWED', 400);
  }
  return url;
}

export function discoverPbc(html: string, baseUrl: string, limit: number): SourceItem[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new DomainError('BATCH_LIMIT', 400);
  const $ = load(html);
  const found = new Map<string, SourceItem>();
  $('a[href]').each((_, node) => {
    try {
      const url = new URL($(node).attr('href')!, baseUrl).href;
      assertPbcUrl(url);
      if (!found.has(url)) found.set(url, { url, title: clean($(node).text()) });
    } catch { /* Non-article links do not belong to this finite discovery scope. */ }
  });
  const items = [...found.values()].slice(0, limit);
  if (!items.length) throw new DomainError('SOURCE_ITEMS_MISSING');
  return items;
}

export function parsePbc(raw: Buffer, url: string): NormalizedMaterial {
  url = assertPbcUrl(url).href;
  if (raw.byteLength > 1_048_576) throw new DomainError('RAW_TOO_LARGE', 413);
  let html: string;
  try { html = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
  catch { throw new DomainError('ENCODING_UNSUPPORTED'); }
  const $ = load(html);
  const body = $('#zoom');
  if (body.length !== 1) throw new DomainError('BODY_MISSING');
  const articleTitle = $('meta[name="ArticleTitle"]').attr('content')?.trim() || null;
  const pageTitle = articleTitle || $('title').text().trim();
  if ($('input[type="password"]').length || body.find('form').length || /^(用户登录|登录|sign in|log ?in)/iu.test(pageTitle)) throw new DomainError('SOURCE_AUTH_REQUIRED');
  if (/(安全验证|人机验证|access denied|captcha)/iu.test(pageTitle) || (!articleTitle && /请先登录|请登录后|请输入验证码|访问过于频繁|访问被拒绝|access denied|please sign in/iu.test(body.text()))) throw new DomainError('SOURCE_ACCESS_BLOCKED');
  body.find('script,style,noscript').remove();
  const segments: Segment[] = [];
  const add = (text: string, rawLocator: string, kind: Segment['kind']) => {
    if (!text.trim()) return;
    const hex = createHash('sha256').update(`${url}\n${rawLocator}\n${text}`).digest('hex');
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    segments.push({ id, text, rawLocator, kind });
  };
  const walk = (node: AnyNode, path: string) => {
    if (node.type === 'text') { add(clean(node.data), path, 'paragraph'); return; }
    if (!('tagName' in node)) return;
    const element = node as Element;
    if (element.tagName === 'table') {
      if ($(element).find('table').length || $(element).find('[rowspan],[colspan]').toArray().some(cell => Number($(cell).attr('rowspan') ?? 1) !== 1 || Number($(cell).attr('colspan') ?? 1) !== 1)) {
        throw new DomainError('TABLE_UNSUPPORTED');
      }
      const rows = $(element).find('tr').toArray().map(row => $(row).children('td,th').toArray().map(cell => clean($(cell).text())).join(' | '));
      if (!rows.length) throw new DomainError('TABLE_UNSUPPORTED');
      add(rows.join('\n'), path, 'table');
    } else if (/^(p|li|h[1-6])$/.test(element.tagName) && !$(element).find('table').length) {
      add(clean($(element).text()), path, 'paragraph');
    } else {
      const counts = new Map<string, number>();
      element.children.forEach((child, index) => {
        if ('tagName' in child) {
          const n = (counts.get(child.tagName) ?? 0) + 1;
          counts.set(child.tagName, n);
          walk(child, `${path} > ${child.tagName}:nth-of-type(${n})`);
        } else walk(child, `${path}::text(${index})`);
      });
    }
  };
  walk(body[0]!, '#zoom');
  if (!segments.length) throw new DomainError('BODY_MISSING');
  if (segments.reduce((n, item) => n + Array.from(item.text).length, 0) > 20_000) throw new DomainError('TEXT_TOO_LARGE', 413);
  return {
    title: articleTitle,
    publishedAtText: $('meta[name="PubDate"]').attr('content')?.trim() || null,
    url, normalizerVersion: 'pbc-html-1.0.0', segments,
  };
}

export async function fetchPbc(value: string, list = false): Promise<Buffer> {
  const url = assertPbcUrl(value, list).href;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'RiskHot/0.1 (+source verification)' } });
  if (!response.ok) throw new DomainError(`SOURCE_HTTP_${response.status}`, 502, response.status === 429 || response.status >= 500);
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new DomainError('SOURCE_MEDIA_UNSUPPORTED');
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (!response.body) throw new DomainError('SOURCE_EMPTY');
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 1_048_576) throw new DomainError('RAW_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
