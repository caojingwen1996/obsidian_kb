import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';

const assets: Record<string, string> = { 'app.js': 'text/javascript', 'api.js': 'text/javascript', 'model.js': 'text/javascript', 'sources.js': 'text/javascript', 'tasks.js': 'text/javascript', 'styles.css': 'text/css' };
export function registerWeb(app: FastifyInstance) {
  const headers = { 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'cache-control': 'no-store' };
  app.get('/', async (_request, reply) => reply.redirect('/m1'));
  app.get('/m1', async (_request, reply) => reply.headers(headers).type('text/html; charset=utf-8').send(await readFile(new URL('../web/index.html', import.meta.url))));
  app.get('/m1/:asset', async (request, reply) => {
    const { asset } = request.params as { asset: string };
    if (!Object.hasOwn(assets, asset)) return reply.code(404).send({ error: { code: 'NOT_FOUND' } });
    return reply.headers(headers).type(`${assets[asset]}; charset=utf-8`).send(await readFile(new URL(`../web/${asset}`, import.meta.url)));
  });
}
