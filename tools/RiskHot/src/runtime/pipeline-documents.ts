import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

type DocumentReference = { path: string; title: string; sha256: string };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

export function registerPipelineDocuments(app: FastifyInstance, headers: Record<string, string>) {
  app.get('/pipeline/documents/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const references = JSON.parse(await readFile(new URL('../data/pipeline-documents.json', import.meta.url), 'utf8')) as Record<string, DocumentReference>;
    if (!/^[a-f0-9]{16}$/.test(key) || !Object.hasOwn(references, key)) return reply.headers(headers).code(404).send({ error: { code: 'NOT_FOUND' } });
    const reference = references[key]!;
    if (!reference.path.startsWith('docs/system-design/') || reference.path.includes('..') || !reference.path.endsWith('.md')) {
      return reply.headers(headers).code(404).send({ error: { code: 'NOT_FOUND' } });
    }
    let body: string;
    try { body = await readFile(new URL('../../' + reference.path, import.meta.url), 'utf8'); }
    catch { return reply.headers(headers).code(404).send({ error: { code: 'DOCUMENT_UNAVAILABLE' } }); }
    const digest = createHash('sha256').update(body).digest('hex');
    const headings = new Map<string, number>();
    let fenced = false;
    const markup = body.split('\n').map(line => {
      if (/^\s*```/.test(line)) fenced = !fenced;
      const heading = !fenced && /^#{1,6}\s+(.+)$/.exec(line);
      if (!heading) return escapeHtml(line);
      const slug = heading[1]!.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
      const count = headings.get(slug) ?? 0; headings.set(slug, count + 1);
      return `<span class="document-heading" id="${escapeHtml(slug + (count ? '-' + count : ''))}">${escapeHtml(line)}</span>`;
    }).join('\n');
    return reply.headers(headers).type('text/html; charset=utf-8').send(`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(reference.title)} · RiskHot</title><link rel="stylesheet" href="/pipeline/pipeline-document.css"></head><body><main><nav><a href="/pipeline">返回流水线全景</a></nav><h1>${escapeHtml(reference.title)}</h1><p class="document-meta">当前来源原文 · 只读${digest !== reference.sha256 ? ' · 文档已更新，流程展示副本待同步' : ''}</p><pre class="document-body">${markup}</pre></main></body></html>`);
  });
}
