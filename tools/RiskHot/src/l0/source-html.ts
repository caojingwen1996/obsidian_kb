import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { DomainError, type Segment } from '../platform/types.js';

export const clean = (value: string) => value.replace(/[\s\u00a0]+/gu, ' ').trim();
export function decodeHtml(raw: Buffer, encoding?: string): string {
  const declared = raw.subarray(0, 4096).toString('latin1').match(/charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i)?.[1];
  try { return new TextDecoder(encoding || declared || 'utf-8', { fatal: true }).decode(raw); }
  catch { throw new DomainError('ENCODING_UNSUPPORTED'); }
}
export function segment(url: string, text: string, rawLocator: string, kind: Segment['kind']): Segment {
  const hex = createHash('sha256').update(`${url}\n${rawLocator}\n${text}`).digest('hex');
  return { id: `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`, text, rawLocator, kind };
}
export function selectedText($: ReturnType<typeof load>, selector?: string): string | null {
  if (!selector) return null;
  const [css, attr] = selector.split('@');
  const node = $(css!).first();
  return clean(attr ? node.attr(attr) ?? '' : node.attr('content') ?? node.attr('datetime') ?? node.text()) || null;
}
export function htmlSegments(html: string, selector: string, url: string, locatorPrefix = ''): Segment[] {
  const $ = load(html); const body = $(selector);
  if (!body.length) throw new DomainError('BODY_MISSING');
  const title = $('title').text(); const bodyText = clean(body.text());
  if (body.find('input[type="password"],form').length || /^(登录|用户登录|sign in|log ?in)/iu.test(title)) throw new DomainError('SOURCE_AUTH_REQUIRED');
  if (/(access denied|captcha|安全验证|人机验证|访问受限)/iu.test(title) || (bodyText.length < 500 && /请先登录|请登录后|安全验证|请输入验证码|访问被拒绝|access denied|please sign in/iu.test(bodyText))) throw new DomainError('SOURCE_ACCESS_BLOCKED');
  body.find('script,style,noscript,nav,button').remove();
  const result: Segment[] = [];
  const add = (text: string, path: string, kind: Segment['kind']) => { if (text) result.push(segment(url, text, locatorPrefix + path, kind)); };
  const walk = (node: AnyNode, path: string) => {
    if (node.type === 'text') { add(clean(node.data), path, 'paragraph'); return; }
    if (!('tagName' in node)) return;
    const element = node as Element;
    if (element.tagName === 'table') {
      if ($(element).find('table').length) throw new DomainError('TABLE_UNSUPPORTED');
      const rows = $(element).find('tr').toArray().map(row => $(row).children('td,th').toArray().map(cell => {
        const spans = ['rowspan','colspan'].flatMap(attr => {
          const value = $(cell).attr(attr); return value && value !== '1' ? [`${attr}=${value}`] : [];
        });
        return clean($(cell).text()) + (spans.length ? ` [${spans.join(' ')}]` : '');
      }).join(' | '));
      if (!rows.length) throw new DomainError('TABLE_UNSUPPORTED');
      add(rows.join('\n'), path, 'table');
    } else if (/^(p|li|h[1-6])$/.test(element.tagName) && !$(element).find('table').length) add(clean($(element).text()), path, 'paragraph');
    else {
      const counts = new Map<string, number>();
      element.children.forEach((child, index) => {
        if ('tagName' in child) {
          const n = (counts.get(child.tagName) ?? 0) + 1; counts.set(child.tagName, n);
          walk(child, `${path} > ${child.tagName}:nth-of-type(${n})`);
        } else walk(child, `${path}::text(${index})`);
      });
    }
  };
  body.each((index, node) => walk(node, body.length === 1 ? selector : `${selector}:eq(${index})`));
  return result;
}
