import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { registerPipelineDocuments } from './pipeline-documents.js';

const assets: Record<string, string> = { 'navigation.js':'text/javascript', 'reader.js':'text/javascript', 'events.js':'text/javascript', 'app.js': 'text/javascript', 'api.js': 'text/javascript', 'model.js': 'text/javascript', 'sources.js': 'text/javascript', 'tasks.js': 'text/javascript', 'activity.js': 'text/javascript', 'delivery.js': 'text/javascript', 'styles.css': 'text/css' };
export function registerWeb(app: FastifyInstance) {
  const headers = { 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'cache-control': 'no-store' };
  const pipelineAssets: Record<string, string> = {
    'pipeline.js': 'text/javascript', 'pipeline-state.js': 'text/javascript',
    'pipeline-view.js': 'text/javascript', 'pipeline-layout.js': 'text/javascript',
    'pipeline-data.js': 'text/javascript', 'pipeline-tasks.js': 'text/javascript',
    'pipeline.css': 'text/css', 'pipeline-document.css': 'text/css',
  };
  app.get('/pipeline', async (_request, reply) => reply.headers(headers).type('text/html; charset=utf-8').send(await readFile(new URL('../web/pipeline.html', import.meta.url))));
  app.get('/pipeline/', async (_request, reply) => reply.redirect('/pipeline'));
  app.get('/pipeline/:asset', async (request, reply) => {
    const { asset } = request.params as { asset: string };
    if (!Object.hasOwn(pipelineAssets, asset)) return reply.headers(headers).code(404).send({ error: { code: 'NOT_FOUND' } });
    return reply.headers(headers).type(`${pipelineAssets[asset]}; charset=utf-8`).send(await readFile(new URL(`../web/${asset}`, import.meta.url)));
  });
  registerPipelineDocuments(app, headers);
  app.get('/', async (_request, reply) => reply.redirect('/m1'));
  app.get('/events',async(_request,reply)=>reply.headers(headers).type('text/html; charset=utf-8').send(await readFile(new URL('../web/events.html',import.meta.url))));
  app.get('/m1', async (_request, reply) => reply.headers(headers).type('text/html; charset=utf-8').send(await readFile(new URL('../web/index.html', import.meta.url))));
  app.get('/m1/:asset', async (request, reply) => {
    const { asset } = request.params as { asset: string };
    if (!Object.hasOwn(assets, asset)) return reply.code(404).send({ error: { code: 'NOT_FOUND' } });
    return reply.headers(headers).type(`${assets[asset]}; charset=utf-8`).send(await readFile(new URL(`../web/${asset}`, import.meta.url)));
  });
}
