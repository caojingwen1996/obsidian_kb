import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import {
  BusinessError,
  ensure,
  text,
  type Actor,
  type Context,
  type Data,
  type Domain,
  type Json,
  type RecordRow,
} from '../../../packages/platform/core/types.js';
import { domains, transaction, type Store } from '../../../packages/platform/database/index.js';
import { actorFrom, passwordHash, passwordMatches } from '../../../packages/domains/identity/index.js';
import { blankAnalysis } from '../../../packages/domains/analysis/index.js';
import { reportMarkdown, riskProducts } from '../../../packages/domains/publication/index.js';
import { contracts, executeCommand } from './commands.js';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const research = (actor: Actor) => actor.roles.some((r) => ['researcher', 'reviewer', 'admin'].includes(r));
const admin = (actor: Actor) => actor.roles.includes('admin');
const kinds: Record<Domain, string[]> = {
  reference: [
    'target',
    'variable',
    'risk_source',
    'dimension',
    'rule',
    'prompt',
    'model',
    'market',
    'variable_candidate',
  ],
  observations: ['indicator', 'mapping', 'value'],
  information: ['source', 'information', 'event', 'event_update', 'rating', 'grouping'],
  registry: ['risk', 'candidate'],
  analysis: ['snapshot', 'feedback'],
  publication: ['report'],
  operations: ['task', 'schedule', 'issue', 'review_assignment', 'review_decision', 'feedback_decision'],
  identity: ['user'],
};
function domainName(value: string): Domain {
  ensure(domains.includes(value as Domain), 'NOT_FOUND', '模块不存在', 404);
  return value as Domain;
}
function context(db: Store, actor: Actor, now: string): Context {
  return {
    db,
    actor,
    now,
    operationId: 'query',
    enqueue: async () => {
      throw new Error('Read only context');
    },
  };
}
function redact(value: unknown, actor: Actor): Json {
  if (Array.isArray(value)) return value.map((x) => redact(x, actor));
  if (value && typeof value === 'object') {
    const result: Data = {};
    for (const [key, child] of Object.entries(value)) {
      if (/password|secret|api_key|access_token|csrf_hash|token_hash/i.test(key)) continue;
      if (!actor.evidence_access && ['content', 'quote', 'evidence', 'proposal', 'input'].includes(key))
        continue;
      result[key] = redact(child, actor);
    }
    return result;
  }
  return (value ?? null) as Json;
}
function canRead(actor: Actor, domain: Domain, row: RecordRow) {
  if (domain === 'identity') return admin(actor);
  if (domain === 'operations')
    return (
      research(actor) &&
      (admin(actor) ||
        actor.roles.includes('reviewer') ||
        row.data.owner_id === actor.id ||
        ['issue', 'review_assignment', 'review_decision', 'feedback_decision'].includes(row.kind))
    );
  if (research(actor)) return true;
  if (domain === 'publication') return ['published', 'withdrawn'].includes(row.status);
  if (domain === 'analysis') return row.kind === 'snapshot' && row.status === 'approved';
  if (domain === 'registry') return row.kind === 'risk';
  if (domain === 'reference')
    return row.status === 'approved' && !['prompt', 'model', 'variable_candidate'].includes(row.kind);
  return false;
}
function safeRow(actor: Actor, domain: Domain, row: RecordRow): Json {
  ensure(canRead(actor, domain, row), 'FORBIDDEN', '没有此记录的读取权限', 403);
  if (domain === 'publication' && row.status === 'withdrawn')
    return {
      ...row,
      data: {
        title: row.data.title ?? '',
        report_id: row.data.report_id ?? row.id,
        withdrawn_at: row.data.withdrawn_at ?? '',
        withdrawal_reason: row.data.withdrawal_reason ?? '',
        revision: row.data.revision ?? 1,
      },
    } as unknown as Json;
  return redact(row, actor);
}
function paging<T>(items: T[], query: Record<string, unknown> = {}) {
  const offset = Number(query.offset ?? 0),
    limit = Number(query.limit ?? 100);
  ensure(
    Number.isInteger(offset) && offset >= 0 && Number.isInteger(limit) && limit >= 1 && limit <= 1000,
    'INVALID_PAGINATION',
    '分页参数无效',
    400,
  );
  return { items: items.slice(offset, offset + limit), total: items.length };
}
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function buildApp({
  pool,
  now = () => new Date().toISOString(),
}: {
  pool: pg.Pool;
  now?: () => string;
}) {
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024, trustProxy: false });
  const webOrigin = process.env.WEB_ORIGIN || 'http://127.0.0.1:4311';
  const production = process.env.NODE_ENV === 'production';
  app.register(cookie);
  app.register(cors, {
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
  });
  app.register(rateLimit, { global: false });
  app.addHook('onRequest', async (_request, reply) => {
    reply
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'same-origin');
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof BusinessError)
      return reply
        .code(error.status)
        .send({ code: error.code, detail: error.message, status: error.status, details: error.details });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500)
      return reply.code(status).send({
        code: status === 429 ? 'RATE_LIMITED' : 'INVALID_REQUEST',
        detail: status === 429 ? '请求过于频繁，请稍后再试' : '请求格式无效',
        status,
      });
    // Deliberately avoid serializing database errors, request bodies, or credentials.
    console.error('RiskHot request failed', error instanceof Error ? error.name : 'UnknownError');
    return reply
      .code(500)
      .send({ code: 'INTERNAL_ERROR', detail: '服务处理失败，请用操作记录联系管理员', status: 500 });
  });
  function checkOrigin(request: FastifyRequest) {
    const origin = request.headers.origin;
    ensure(!origin || origin === webOrigin, 'ORIGIN_REJECTED', '请求来源不允许', 403);
  }
  async function session(request: FastifyRequest, mutation = false): Promise<{ actor: Actor; csrf: string }> {
    const token = request.cookies.riskhot_session;
    ensure(token, 'UNAUTHENTICATED', '请先登录', 401);
    const result = await pool.query(
      'SELECT user_id,csrf_hash FROM platform.sessions WHERE token_hash=$1 AND expires_at>$2',
      [sha(token), now()],
    );
    ensure(result.rows[0], 'SESSION_EXPIRED', '登录已过期，请重新登录', 401);
    const actor = await transaction(pool, async (db) =>
      actorFrom(await db.get('identity', result.rows[0].user_id)),
    );
    ensure(actor.active, 'ACCOUNT_DISABLED', '账号已停用', 403);
    const csrf = request.cookies.riskhot_csrf || '';
    if (mutation) {
      checkOrigin(request);
      const header = request.headers['x-csrf-token'];
      ensure(
        typeof header === 'string' && sha(header) === result.rows[0].csrf_hash,
        'CSRF_REJECTED',
        '请求校验已失效，请刷新页面后重试',
        403,
      );
    }
    return { actor, csrf: sha(csrf) === result.rows[0].csrf_hash ? csrf : '' };
  }
  async function issueSession(user: RecordRow, reply: FastifyReply) {
    const token = randomBytes(32).toString('hex'),
      csrf = randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO platform.sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)',
      [sha(token), user.id, sha(csrf), new Date(Date.parse(now()) + 8 * 3600_000).toISOString()],
    );
    reply.setCookie('riskhot_session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      maxAge: 8 * 3600,
    });
    reply.setCookie('riskhot_csrf', csrf, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: production,
      maxAge: 8 * 3600,
    });
    return { user: actorFrom(user), csrf };
  }
  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  });
  app.get('/api/v1/auth/status', async () => ({
    initialized: !!(await pool.query("SELECT 1 FROM identity.records WHERE kind='user' LIMIT 1")).rowCount,
  }));
  app.post(
    '/api/v1/auth/setup',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      checkOrigin(request);
      ensure(
        !production || process.env.ALLOW_INITIAL_SETUP === 'true',
        'SETUP_DISABLED',
        '生产环境首次初始化需临时启用 ALLOW_INITIAL_SETUP',
        403,
      );
      ensure(
        ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip),
        'LOCAL_SETUP_REQUIRED',
        '首次管理员初始化仅允许本机访问',
        403,
      );
      const body = request.body as Data;
      ensure(body && typeof body === 'object', 'INVALID_INPUT', '请输入账号资料', 400);
      const hash = passwordHash(text(body, 'password'));
      const user = await transaction(pool, async (db) => {
        await db.client.query("SELECT pg_advisory_xact_lock(hashtextextended('riskhot-command-write', 0))");
        ensure(
          (await db.list('identity', 'user')).length === 0,
          'ALREADY_INITIALIZED',
          '系统已初始化，请登录',
          409,
        );
        const row = await db.create(
          'identity',
          'user',
          {
            name: text(body, 'name'),
            username: text(body, 'username'),
            password_hash: hash,
            roles: ['reader', 'researcher', 'reviewer', 'admin'],
            evidence_access: true,
          },
          'active',
        );
        await db.audit(actorFrom(row), 'identity.bootstrap', 'identity', row.id, {});
        return row;
      });
      return issueSession(user, reply);
    },
  );
  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      checkOrigin(request);
      const body = request.body as Data;
      ensure(body && typeof body === 'object', 'INVALID_INPUT', '请输入账号资料', 400);
      const username = text(body, 'username'),
        password = text(body, 'password');
      ensure(password.length <= 128, 'INVALID_CREDENTIALS', '账号或密码错误', 401);
      const user = await transaction(pool, async (db) =>
        (await db.list('identity', 'user')).find((u) => u.data.username === username),
      );
      const valid = user && passwordMatches(password, String(user.data.password_hash));
      ensure(valid && user.status === 'active', 'INVALID_CREDENTIALS', '账号或密码错误', 401);
      return issueSession(user, reply);
    },
  );
  app.get('/api/v1/auth/me', async (request) => {
    const s = await session(request);
    return { user: s.actor, csrf: s.csrf };
  });
  app.post('/api/v1/auth/logout', async (request, reply) => {
    await session(request, true);
    await pool.query('DELETE FROM platform.sessions WHERE token_hash=$1', [
      sha(request.cookies.riskhot_session!),
    ]);
    reply.clearCookie('riskhot_session', { path: '/' }).clearCookie('riskhot_csrf', { path: '/' });
    return { logged_out: true };
  });
  app.get('/api/v1/contracts', async (request) => {
    await session(request);
    return contracts;
  });
  app.post<{ Params: { name: string } }>('/api/v1/commands/:name', async (request) => {
    const { actor } = await session(request, true);
    const key = request.headers['idempotency-key'];
    ensure(typeof key === 'string', 'IDEMPOTENCY_REQUIRED', '缺少幂等请求标识', 400);
    const result = await executeCommand(pool, actor, request.params.name, request.body as Data, key, now());
    if (
      result &&
      !Array.isArray(result) &&
      typeof result === 'object' &&
      result.kind === 'report' &&
      typeof result.id === 'string'
    ) {
      return transaction(pool, async (db) => {
        const current = await db.get('publication', result.id as string);
        return current.status === 'withdrawn'
          ? safeRow(actor, 'publication', current)
          : redact(result, actor);
      });
    }
    return redact(result, actor);
  });
  app.get<{ Params: { domain: string; kind: string }; Querystring: Record<string, string> }>(
    '/api/v1/data/:domain/:kind',
    async (request) => {
      const { actor } = await session(request),
        domain = domainName(request.params.domain);
      ensure(kinds[domain].includes(request.params.kind), 'NOT_FOUND', '记录类型不存在', 404);
      if (domain === 'identity') ensure(admin(actor), 'FORBIDDEN', '仅管理员可管理账号', 403);
      if (['information', 'observations', 'operations'].includes(domain))
        ensure(research(actor), 'FORBIDDEN', '没有此模块的读取权限', 403);
      return transaction(pool, async (db) => {
        const rows = (await db.list(domain, request.params.kind))
          .filter((r) => canRead(actor, domain, r))
          .filter((r) => !request.query.status || r.status === request.query.status)
          .filter(
            (r) =>
              !request.query.q ||
              JSON.stringify(redact(r.data, actor))
                .toLocaleLowerCase()
                .includes(request.query.q.toLocaleLowerCase()),
          );
        return paging(
          rows.map((r) => safeRow(actor, domain, r)),
          request.query,
        );
      });
    },
  );
  app.get<{ Params: { domain: string; id: string } }>('/api/v1/record/:domain/:id', async (request) => {
    const { actor } = await session(request),
      domain = domainName(request.params.domain);
    return transaction(pool, async (db) => safeRow(actor, domain, await db.get(domain, request.params.id)));
  });
  app.get<{ Params: { domain: string; id: string } }>('/api/v1/history/:domain/:id', async (request) => {
    const { actor } = await session(request),
      domain = domainName(request.params.domain);
    return transaction(pool, async (db) => {
      const current = await db.get(domain, request.params.id);
      safeRow(actor, domain, current);
      ensure(research(actor), 'FORBIDDEN', '历史版本仅供研究与审核角色读取', 403);
      ensure(
        !(domain === 'publication' && current.status === 'withdrawn'),
        'REPORT_WITHDRAWN',
        '报告已撤回，历史正文不可下载',
        410,
      );
      return {
        items: (await db.history(domain, current.id))
          .filter((r) => canRead(actor, domain, r))
          .map((r) => redact(r, actor)),
      };
    });
  });
  app.get<{ Querystring: Record<string, string> }>('/api/v1/risks', async (request) => {
    const { actor } = await session(request);
    return transaction(pool, async (db) => {
      let items = await riskProducts(context(db, actor, now()));
      if (request.query.q)
        items = items.filter((x) =>
          JSON.stringify(redact(x, actor)).toLocaleLowerCase().includes(request.query.q.toLocaleLowerCase()),
        );
      if (request.query.status) items = items.filter((x) => x.tracking_status === request.query.status);
      if (request.query.market) items = items.filter((x) => x.market === request.query.market);
      items.sort(
        (a, b) =>
          String(a.unranked_reason ? '1' : '0').localeCompare(String(b.unranked_reason ? '1' : '0')) ||
          String(a.ranking_group).localeCompare(String(b.ranking_group)) ||
          Number(b.severity ?? -1) - Number(a.severity ?? -1) ||
          String(a.id).localeCompare(String(b.id)),
      );
      return paging(
        items.map((x) => redact(x, actor)),
        request.query,
      );
    });
  });
  app.get<{ Params: { id: string } }>('/api/v1/risks/:id', async (request) => {
    const { actor } = await session(request);
    return transaction(pool, async (db) => {
      const risk = await db.get('registry', request.params.id);
      ensure(risk.kind === 'risk', 'NOT_FOUND', '风险不存在', 404);
      const snapshots = (await db.list('analysis', 'snapshot')).filter(
        (x) => x.data.risk_id === risk.id && canRead(actor, 'analysis', x),
      );
      const relations = await db.relations(risk.id);
      const events = await Promise.all(relations.map((x) => db.get('information', String(x.event_id))));
      return {
        risk: redact(risk, actor),
        snapshots: snapshots.map((x) => redact(x, actor)),
        relations,
        events: events.map((x) => redact(x, actor)),
      };
    });
  });
  app.get('/api/v1/dashboard', async (request) => {
    const { actor } = await session(request);
    return transaction(pool, async (db) => {
      const risks = await riskProducts(context(db, actor, now()));
      const reports = (await db.list('publication', 'report')).filter((x) =>
        canRead(actor, 'publication', x),
      );
      const tasks = (await db.list('operations', 'task')).filter((x) => canRead(actor, 'operations', x));
      const snapshots = await db.list('analysis', 'snapshot');
      return {
        risk_count: risks.length,
        active_count: risks.filter((x) => ['observing', 'monitoring'].includes(String(x.tracking_status)))
          .length,
        pending_reviews: research(actor)
          ? snapshots.filter((x) => x.status === 'submitted').length +
            reports.filter((x) => x.status === 'submitted').length
          : 0,
        failed_tasks: tasks.filter((x) => x.status === 'failed').length,
        report_count: reports.filter((x) => x.status === 'published').length,
        recent_risks: risks.slice(0, 8).map((x) => redact(x, actor)),
      };
    });
  });
  app.get('/api/v1/reviews', async (request) => {
    const { actor } = await session(request);
    ensure(research(actor), 'FORBIDDEN', '没有审核队列权限', 403);
    return transaction(pool, async (db) => {
      const result: { domain: Domain; record: Json }[] = [];
      const groups: [Domain, string, string[]][] = [
        ['analysis', 'snapshot', ['submitted']],
        ['publication', 'report', ['submitted']],
        ['registry', 'candidate', ['draft']],
        ['information', 'source', ['draft']],
        ['information', 'grouping', ['pending']],
        ...kinds.reference.map(
          (kind) => ['reference', kind, ['draft', 'pending']] as [Domain, string, string[]],
        ),
      ];
      for (const [domain, kind, statuses] of groups)
        for (const row of await db.list(domain, kind))
          if (statuses.includes(row.status)) result.push({ domain, record: safeRow(actor, domain, row) });
      return { items: result };
    });
  });
  app.get<{ Params: { id: string } }>('/api/v1/tasks/:id/template', async (request) => {
    const { actor } = await session(request);
    return transaction(pool, async (db) => {
      const task = await db.get('operations', request.params.id);
      safeRow(actor, 'operations', task);
      ensure(task.kind === 'task' && task.data.type === 'analysis', 'INVALID_TASK', '任务不是风险观察');
      return { data: blankAnalysis(task.data.input as Data) };
    });
  });
  app.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/api/v1/reports/:id/export',
    async (request, reply) => {
      const { actor } = await session(request);
      return transaction(pool, async (db) => {
        const report = await db.get('publication', request.params.id);
        ensure(report.kind === 'report', 'NOT_FOUND', '报告不存在', 404);
        ensure(report.status !== 'withdrawn', 'REPORT_WITHDRAWN', '报告已撤回，无法下载', 410);
        ensure(report.status === 'published', 'REPORT_NOT_PUBLISHED', '仅已发布报告可下载', 403);
        safeRow(actor, 'publication', report);
        const md = reportMarkdown(report, webOrigin),
          format = request.query.format || 'markdown';
        ensure(
          ['markdown', 'md', 'html'].includes(format),
          'INVALID_FORMAT',
          '支持 Markdown 和 HTML 格式',
          400,
        );
        await db.audit(actor, 'publication.export', 'publication', report.id, {
          format,
          version: report.version,
        });
        if (format === 'html')
          return reply
            .type('text/html; charset=utf-8')
            .header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
            .header('Content-Disposition', `attachment; filename="riskhot-${report.id}.html"`)
            .send(
              `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(String(report.data.title))}</title><style>body{max-width:900px;margin:48px auto;font:16px/1.8 system-ui;padding:20px}pre{white-space:pre-wrap}</style><pre>${escapeHtml(md)}</pre></html>`,
            );
        return reply
          .type('text/markdown; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="riskhot-${report.id}.md"`)
          .send(md);
      });
    },
  );
  app.get('/api/v1/audit', async (request) => {
    const { actor } = await session(request);
    ensure(admin(actor) || actor.roles.includes('reviewer'), 'FORBIDDEN', '没有审计权限', 403);
    return { items: (await pool.query('SELECT * FROM platform.audit ORDER BY id DESC LIMIT 500')).rows };
  });
  return app;
}
