import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { registerPipelineDocuments } from './pipeline-documents.js';
import { readPipelineTasks, pipelineRoot } from './pipeline-prompts.js';

const assets: Record<string, string> = { 'm4.js':'text/javascript','m4-view.js':'text/javascript','m4.css':'text/css','targets.js':'text/javascript','targets-view.js':'text/javascript','targets.css':'text/css','product-navigation.css':'text/css','eight-step-view.js':'text/javascript','eight-step.css':'text/css','event-view.js':'text/javascript', 'navigation.js':'text/javascript', 'reader.js':'text/javascript', 'events.js':'text/javascript', 'app.js': 'text/javascript', 'api.js': 'text/javascript', 'model.js': 'text/javascript', 'sources.js': 'text/javascript', 'tasks.js': 'text/javascript', 'activity.js': 'text/javascript', 'delivery.js': 'text/javascript', 'styles.css': 'text/css' };
export function registerWeb(app: FastifyInstance, options: { pipelineRoot?: string; schemaVersion?: number; m4?:boolean } = {}) {
  const html=async(file:string)=>{
    let source=await readFile(new URL('../web/'+file,import.meta.url),'utf8');
    if(options.m4&&file!=='m4.html')source=source.replace(/<a class="([^"]*)" href="\/pipeline"[^>]*>/, (link,classes:string)=>`<a class="${classes.includes('nav-item')?'nav-item':'nav-static'}" href="/m4"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6v12M5 10h10M5 18h10"/><circle cx="5" cy="4" r="2"/><circle cx="17" cy="10" r="2"/><circle cx="17" cy="18" r="2"/></svg><span>金融对象配置中心</span></a>${link}`);
    return source;
  };
  const headers = { 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'cache-control': 'no-store' };
  const pipelineAssets: Record<string, string> = {
    'pipeline.js': 'text/javascript', 'pipeline-state.js': 'text/javascript',
    'pipeline-view.js': 'text/javascript', 'pipeline-layout.js': 'text/javascript',
    'pipeline-data.js': 'text/javascript', 'pipeline-tasks.js': 'text/javascript',
    'pipeline.css': 'text/css', 'pipeline-document.css': 'text/css',
  };
  app.get('/pipeline', async (_request, reply) => reply.headers(headers).type('text/html; charset=utf-8').send(await html('pipeline.html')));
  app.get('/pipeline/', async (_request, reply) => reply.redirect('/pipeline'));
  app.get('/pipeline/:asset', async (request, reply) => {
    const { asset } = request.params as { asset: string };
    if (!Object.hasOwn(pipelineAssets, asset)) return reply.headers(headers).code(404).send({ error: { code: 'NOT_FOUND' } });
    if (asset === 'pipeline-tasks.js') {
      const data = await readPipelineTasks(options.pipelineRoot ?? pipelineRoot);
      return reply.headers(headers).type('text/javascript; charset=utf-8').send(`export default ${JSON.stringify(data)};\n`);
    }
    return reply.headers(headers).type(`${pipelineAssets[asset]}; charset=utf-8`).send(await readFile(new URL(`../web/${options.schemaVersion===5&&asset==='app.js'?'current-app.js':options.schemaVersion===5&&asset==='events.js'?'current-events.js':asset}`, import.meta.url)));
  });
  registerPipelineDocuments(app, headers);
  app.get('/', async (_request, reply) => reply.redirect('/m1'));
  app.get('/events',async(_request,reply)=>reply.headers(headers).type('text/html; charset=utf-8').send(await html('events.html')));
  app.get('/targets',async(_request,reply)=>reply.headers(headers).type('text/html; charset=utf-8').send(await html(options.m4?'m4.html':'targets.html')));
  if(options.m4){app.get('/m4',async(_request,reply)=>reply.headers(headers).type('text/html; charset=utf-8').send(await html('m4.html')));app.get('/m4/',async(_request,reply)=>reply.redirect('/m4'));}
  app.get('/targets/',async(_request,reply)=>reply.redirect('/targets'));
  app.get('/events/tasks/:id',async(_request,reply)=>reply.headers(headers).type('text/html; charset=utf-8').send(await html('events.html')));
  app.get('/m1', async (_request, reply) => reply.headers(headers).type('text/html; charset=utf-8').send(await html('index.html')));
  app.get('/m1/:asset', async (request, reply) => {
    const { asset } = request.params as { asset: string };
    if (!Object.hasOwn(assets, asset)) return reply.code(404).send({ error: { code: 'NOT_FOUND' } });
    return reply.headers(headers).type(`${assets[asset]}; charset=utf-8`).send(await readFile(new URL(`../web/${asset==='event-view.js'?'events.js':options.schemaVersion===5&&asset==='app.js'?'current-app.js':options.schemaVersion===5&&asset==='events.js'?'current-events.js':asset}`, import.meta.url)));
  });
}
