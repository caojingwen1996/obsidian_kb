import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/src/app.js';
import { Scenario, clearTestDatabase, fixturePassword, openTestDatabase } from '../fixtures/riskhot.js';
import type { Data, RecordRow } from '../../packages/platform/core/types.js';

let pool: pg.Pool;
let app: FastifyInstance;
let s: Scenario;
before(async () => {
  pool = await openTestDatabase();
});
beforeEach(async () => {
  await app?.close();
  s = await new Scenario(pool).initialize();
  app = await buildApp({ pool, now: () => s.now });
  await app.ready();
});
after(async () => {
  await app?.close();
  await pool?.end();
});
async function login(username: keyof Scenario['actors']) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username, password: fixturePassword },
  });
  assert.equal(response.statusCode, 200, response.body);
  return {
    cookie: response.cookies.map((x) => `${x.name}=${x.value}`).join('; '),
    csrf: response.json().csrf as string,
    response,
  };
}
async function apiCommand(
  session: Awaited<ReturnType<typeof login>>,
  command: string,
  payload: Data,
  extra: Record<string, string> = {},
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/commands/' + command,
    headers: {
      cookie: session.cookie,
      'x-csrf-token': session.csrf,
      'idempotency-key': randomUUID(),
      ...extra,
    },
    payload,
  });
}
async function publishedReport() {
  const f = await s.risk();
  const snapshot = await s.approve(await s.start(f.risk));
  const start = new Date(Date.parse(s.now) - 86400).toISOString();
  s.advance(3600);
  const report = await s.command(
    'publication.generate',
    { type: 'daily', period_start: start, period_end: s.now, cutoff: s.now },
    'researcher',
  );
  const submitted = await s.command(
    'publication.submit',
    { id: report.id, expected_version: report.version },
    'researcher',
  );
  const published = await s.command('publication.publish', {
    id: submitted.id,
    expected_version: submitted.version,
    reason: '人工审核通过',
  });
  return { ...f, snapshot, report: published };
}

test('SC-033 首次初始化只允许一次且登录不泄露密码摘要', async () => {
  await clearTestDatabase(pool);
  const payload = { username: 'first-admin', name: '首位管理员', password: fixturePassword };
  const setup = await app.inject({ method: 'POST', url: '/api/v1/auth/setup', payload });
  assert.ok([200, 201].includes(setup.statusCode), setup.body);
  assert.equal(setup.json().user.name, '首位管理员');
  assert.doesNotMatch(setup.body, /password_hash|scrypt/);
  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/setup',
    payload: { ...payload, username: 'second-admin' },
  });
  assert.ok([403, 409].includes(duplicate.statusCode), duplicate.body);
  assert.equal((await s.list('identity', 'user')).length, 1);
  const logged = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username: payload.username, password: payload.password },
  });
  assert.equal(logged.statusCode, 200, logged.body);
  assert.ok(logged.cookies.find((c) => c.name === 'riskhot_session')?.httpOnly);
  assert.doesNotMatch(logged.body, /password_hash|scrypt/);
  const wrong = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username: payload.username, password: 'incorrect-password' },
  });
  assert.equal(wrong.statusCode, 401);
});

test('SC-034 匿名、CSRF缺失及额外契约字段均被HTTP边界拒绝', async () => {
  const input = {
    kind: 'variable',
    data: { name: '利率', code: 'RATE', definition: '利率', boundary: '政策', unit: '%' },
  };
  const anonymous = await app.inject({
    method: 'POST',
    url: '/api/v1/commands/reference.save',
    payload: input,
  });
  assert.equal(anonymous.statusCode, 401, anonymous.body);
  const session = await login('researcher');
  const csrf = await app.inject({
    method: 'POST',
    url: '/api/v1/commands/reference.save',
    headers: { cookie: session.cookie, 'idempotency-key': randomUUID() },
    payload: input,
  });
  assert.equal(csrf.statusCode, 403, csrf.body);
  const extra = await apiCommand(session, 'reference.save', { ...input, bypass_approval: true });
  assert.ok([400, 422].includes(extra.statusCode), extra.body);
  assert.equal((await s.list('reference', 'variable')).length, 0);
});

test('SC-035 阅读者不能写入或读取内部原文，研究员不能发布', async () => {
  const f = await publishedReport();
  const reader = await login('reader');
  const write = await apiCommand(reader, 'reference.save', {
    kind: 'variable',
    data: { name: 'X', code: 'X', definition: 'X', boundary: 'X', unit: '%' },
  });
  assert.equal(write.statusCode, 403);
  const raw = await app.inject({
    url: `/api/v1/record/information/${f.info.id}`,
    headers: { cookie: reader.cookie },
  });
  assert.equal(raw.statusCode, 403, raw.body);
  assert.doesNotMatch(raw.body, /测试央行宣布/);
  const researcher = await login('researcher');
  const publish = await apiCommand(researcher, 'publication.publish', {
    id: f.report.id,
    expected_version: f.report.version,
    reason: '越权重复发布应仍被拒绝',
  });
  assert.equal(publish.statusCode, 403);
});

test('SC-036 撤权后旧登录会话立即失效', async () => {
  const session = await login('reviewer');
  const user = await s.get('identity', s.actors.reviewer.id);
  await s.command(
    'identity.user',
    {
      id: user.id,
      expected_version: user.version,
      data: {
        username: 'reviewer',
        name: 'reviewer',
        roles: ['reader'],
        active: false,
        evidence_access: false,
      },
    },
    'admin',
  );
  const response = await apiCommand(session, 'reference.save', {
    kind: 'variable',
    data: { name: 'X', code: 'X', definition: 'X', boundary: 'X', unit: '%' },
  });
  assert.ok([401, 403].includes(response.statusCode), response.body);
  assert.equal((await s.list('reference', 'variable')).length, 0);
});

test('SC-037 已发布报告两种导出保留版本截止和固定引用', async () => {
  const f = await publishedReport();
  const session = await login('reader');
  for (const format of ['markdown', 'html']) {
    const response = await app.inject({
      url: `/api/v1/reports/${f.report.id}/export?format=${format}`,
      headers: { cookie: session.cookie },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(response.body.includes(f.report.id));
    assert.ok(response.body.includes(f.snapshot.id));
    assert.ok(response.body.includes(String(f.report.data.cutoff)));
    assert.doesNotMatch(response.body, /password_hash|测试央行宣布政策利率由2%/);
  }
});

test('SC-038 撤回报告的列表直达与导出均不提供正文', async () => {
  const f = await publishedReport();
  const reader = await login('reader');
  await s.command('publication.withdraw', {
    id: f.report.id,
    expected_version: f.report.version,
    reason: '场景：引用需修订',
  });
  for (const format of ['markdown', 'html']) {
    const response = await app.inject({
      url: `/api/v1/reports/${f.report.id}/export?format=${format}`,
      headers: { cookie: reader.cookie },
    });
    assert.ok([403, 410].includes(response.statusCode), response.body);
    assert.doesNotMatch(response.body, /宏观融资压力/);
  }
  const direct = await app.inject({
    url: `/api/v1/record/publication/${f.report.id}`,
    headers: { cookie: reader.cookie },
  });
  assert.ok([200, 410].includes(direct.statusCode), direct.body);
  assert.ok(direct.body.includes('withdrawn') || direct.body.includes('撤回'));
  assert.doesNotMatch(direct.body, /宏观融资压力/);
  const list = await app.inject({
    url: '/api/v1/data/publication/report',
    headers: { cookie: reader.cookie },
  });
  assert.equal(list.statusCode, 200, list.body);
  assert.doesNotMatch(list.body, /宏观融资压力/);
});

test('SC-039 HTTP同键重放返回同一结果并拒绝同键内容变化', async () => {
  const session = await login('researcher');
  const key = randomUUID();
  const input = {
    kind: 'variable',
    data: { name: '利率', code: 'RATE', definition: '利率', boundary: '政策', unit: '%' },
  };
  const first = await apiCommand(session, 'reference.save', input, { 'idempotency-key': key });
  const again = await apiCommand(session, 'reference.save', input, { 'idempotency-key': key });
  assert.ok([200, 201].includes(first.statusCode), first.body);
  assert.equal(again.statusCode, first.statusCode);
  assert.equal(again.json().id, first.json().id);
  const changed = await apiCommand(
    session,
    'reference.save',
    { ...input, data: { ...input.data, name: '变化' } },
    { 'idempotency-key': key },
  );
  assert.equal(changed.statusCode, 409, changed.body);
});

test('SC-040 阅读者不能利用列表和分析清单绕过原文权限', async () => {
  const f = await publishedReport();
  const session = await login('reader');
  const rawList = await app.inject({
    url: '/api/v1/data/information/information',
    headers: { cookie: session.cookie },
  });
  assert.ok([200, 403].includes(rawList.statusCode), rawList.body);
  assert.doesNotMatch(rawList.body, /测试央行宣布政策利率由2%/);
  const snapshot = await app.inject({
    url: `/api/v1/record/analysis/${f.snapshot.id}`,
    headers: { cookie: session.cookie },
  });
  assert.equal(snapshot.statusCode, 200, snapshot.body);
  assert.doesNotMatch(snapshot.body, /测试央行宣布政策利率由2%/);
  assert.ok(!snapshot.json().data?.manifest?.evidence?.some((e: Data) => 'content' in e));
});

test('SC-043 原文权限过滤先于搜索，避免检索命中泄露隐藏内容', async () => {
  const f = await s.risk();
  const secretWord = 'EVIDENCE_ONLY_MARKER_7D9Q';
  s.advance(3600);
  const source = await s.source('PRIVATE_APPEND');
  const info = await s.information(source, secretWord + '：同一事件的第二个来源');
  await s.event(info, f.target, f.variable, { event_id: f.event.id, increment_type: 'SOURCE_ADDITION' });
  await s.approve(await s.start(f.risk));
  const reader = await login('reader'),
    researcher = await login('researcher');
  const hidden = await app.inject({
    url: '/api/v1/risks?q=' + secretWord,
    headers: { cookie: reader.cookie },
  });
  assert.equal(hidden.statusCode, 200, hidden.body);
  assert.equal(hidden.json().total, 0);
  const visible = await app.inject({
    url: '/api/v1/risks?q=' + secretWord,
    headers: { cookie: researcher.cookie },
  });
  assert.equal(visible.statusCode, 200, visible.body);
  assert.equal(visible.json().total, 1);
});

test('SC-044 撤回后的旧命令回执不能重新暴露报告正文', async () => {
  const f = await publishedReport(),
    reviewer = await login('reviewer');
  const key = randomUUID();
  const input = { id: f.report.id, expected_version: f.report.version, reason: '场景发布回执' };
  const first = await apiCommand(reviewer, 'publication.publish', input, { 'idempotency-key': key });
  assert.equal(first.statusCode, 200);
  assert.ok(first.body.includes('宏观融资压力'));
  await s.command('publication.withdraw', {
    id: f.report.id,
    expected_version: f.report.version,
    reason: '场景撤回',
  });
  const replay = await apiCommand(reviewer, 'publication.publish', input, { 'idempotency-key': key });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.json().status, 'withdrawn');
  assert.doesNotMatch(replay.body, /宏观融资压力/);
});
