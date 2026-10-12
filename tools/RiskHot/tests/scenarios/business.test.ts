import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { Scenario, assertTestDatabase, openTestDatabase } from '../fixtures/riskhot.js';
import { transaction } from '../../packages/platform/database/index.js';
import { riskProducts } from '../../packages/domains/publication/index.js';
import type { Context, Data, RecordRow } from '../../packages/platform/core/types.js';

let pool: pg.Pool;
let s: Scenario;
before(async () => {
  pool = await openTestDatabase();
});
beforeEach(async () => {
  s = await new Scenario(pool).initialize();
});
after(async () => {
  await pool?.end();
});
const rejects = (work: Promise<unknown>, code: string) =>
  assert.rejects(
    work,
    (error: unknown) => (error as { code?: string }).code === code,
    `必须拒绝并返回 ${code}`,
  );
const review = (row: RecordRow, extra: Data = {}) => ({
  id: row.id,
  expected_version: row.version,
  reason: '场景验证操作',
  ...extra,
});
const products = () =>
  transaction(pool, (db) =>
    riskProducts({
      db,
      actor: s.actors.reader,
      now: s.now,
      operationId: 'scenario-read',
      enqueue: async () => {
        throw new Error('查询不可入队');
      },
    } as Context),
  );

test('SC-001 测试数据库防误清理', async () => {
  assert.throws(() => assertTestDatabase('postgres://user:pass@127.0.0.1:55432/riskhot'), /拒绝/);
  assert.throws(() => assertTestDatabase('postgres://user:pass@database.example:5432/riskhot_test'), /拒绝/);
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'riskhot_test');
});

test('SC-002 幂等重试复用结果，同键异载荷拒绝', async () => {
  const key = randomUUID();
  const input = {
    kind: 'variable',
    data: { name: '政策利率', code: 'RATE', definition: '利率', boundary: '政策', unit: '%' },
  };
  const first = await s.command('reference.save', input, 'researcher', key);
  const again = await s.command('reference.save', input, 'researcher', key);
  assert.equal(again.id, first.id);
  await rejects(
    s.command('reference.save', { ...input, data: { ...input.data, name: '不同内容' } }, 'researcher', key),
    'IDEMPOTENCY_CONFLICT',
  );
  assert.equal((await s.list('reference', 'variable')).length, 1);
});

test('SC-003 越权写入与管理员越权审核均拒绝', async () => {
  const input = {
    kind: 'variable',
    data: { name: '利率', code: 'RATE', definition: '利率', boundary: '政策', unit: '%' },
  };
  await rejects(s.command('reference.save', input, 'reader'), 'FORBIDDEN');
  const draft = await s.command('reference.save', input, 'researcher');
  await rejects(s.command('reference.approve', review(draft), 'admin'), 'FORBIDDEN');
  assert.equal((await s.get('reference', draft.id)).status, 'draft');
});

test('SC-004 配置类型边界、批准后不可改与停用后新引用拒绝', async () => {
  await rejects(
    s.config('target', {
      name: '企业',
      code: 'COMPANY',
      type: 'company',
      jurisdiction: 'CN',
      scope: '单家公司',
    }),
    'INVALID_TARGET',
  );
  const base = await s.basics();
  await rejects(
    s.command('reference.save', {
      id: base.variable.id,
      expected_version: base.variable.version,
      kind: 'variable',
      data: { ...base.variable.data, unit: 'bp' },
    }),
    'IMMUTABLE_VERSION',
  );
  await s.command('reference.disable', review(base.target));
  const info = await s.information(base.source);
  await rejects(s.event(info, base.target, base.variable), 'REFERENCE_INACTIVE');
  assert.equal((await s.get('reference', base.target.id)).data.code, 'TEST_ECONOMY');
});

test('SC-005 原文三次重复和同URL修订保留旧值', async () => {
  const source = await s.source();
  const first = await s.information(source, '政策利率2%');
  const second = await s.information(source, '政策利率2%');
  const third = await s.information(source, '政策利率2%');
  assert.equal(second.id, first.id);
  assert.equal(third.id, first.id);
  s.advance(3600);
  const revision = await s.information(source, '政策利率3%');
  assert.notEqual(revision.id, first.id);
  assert.equal(revision.data.supersedes_id, first.id);
  assert.equal((await s.get('information', first.id)).data.content, '政策利率2%');
  assert.equal((await s.list('information', 'information')).length, 2);
});

test('SC-006 信源未准入或停用禁止新录入，历史不丢失', async () => {
  const source = await s.source();
  const info = await s.information(source);
  await s.command('information.source_status', review(source, { status: 'disabled' }));
  await rejects(s.information(source, '后续资料'), 'REFERENCE_INACTIVE');
  assert.equal((await s.get('information', info.id)).data.content, info.data.content);
  const pending = await s.command(
    'information.source',
    {
      data: {
        name: '未审核信源',
        code: 'PENDING',
        url: 'https://example.invalid/pending',
        category: 'official',
        scope: '宏观',
      },
    },
    'admin',
  );
  await rejects(s.information(pending), 'REFERENCE_INACTIVE');
});

test('SC-007 事件允许有对象无变量，拒绝捏造原文引用', async () => {
  const base = await s.basics();
  const info = await s.information(base.source);
  const result = await s.event(info, base.target);
  assert.deepEqual((result.event.data.targets as Data[])[0]!.variable_ids, []);
  await rejects(
    s.event(info, base.target, base.variable, { quote: '原文中不存在的判断' }),
    'INVALID_CITATION',
  );
  assert.equal((await s.list('information', 'event')).length, 1);
});

test('SC-008 同一事件公告到实施追加增量，重复不追加', async () => {
  const base = await s.basics();
  const info = await s.information(base.source);
  const first = await s.event(info, base.target, base.variable);
  assert.equal(first.event.data.phase, 'announced');
  s.advance(7 * 86400);
  assert.equal((await s.get('information', first.event.id)).data.phase, 'announced');
  const later = await s.information(
    base.source,
    '政策已实施，政策利率为3%。',
    'https://example.invalid/implemented',
  );
  const update = await s.event(later, base.target, base.variable, {
    event_id: first.event.id,
    increment_type: 'EVENT_PROGRESS',
    status: 'effective',
  });
  const again = await s.event(later, base.target, base.variable, {
    event_id: first.event.id,
    increment_type: 'EVENT_PROGRESS',
    status: 'effective',
  });
  assert.equal(update.event.id, first.event.id);
  assert.equal(update.event.data.phase, 'effective');
  assert.equal(again.update.id, update.update.id);
  assert.equal((await s.list('information', 'event_update')).length, 2);
});

test('SC-009 仅新增来源不生成实质进展通知', async () => {
  const base = await s.basics();
  const firstInfo = await s.information(base.source);
  const first = await s.event(firstInfo, base.target, base.variable);
  const other = await s.source('OTHER_SOURCE');
  const otherInfo = await s.information(other, String(firstInfo.data.content));
  await s.event(otherInfo, base.target, base.variable, {
    event_id: first.event.id,
    increment_type: 'SOURCE_ADDITION',
  });
  assert.equal((await s.list('information', 'event_update')).length, 1);
  assert.deepEqual(
    new Set((await s.get('information', first.event.id)).data.source_refs as string[]),
    new Set([firstInfo.id, otherInfo.id]),
  );
  assert.equal(
    Number(
      (await pool.query("SELECT count(*) FROM platform.outbox WHERE type='information.event-updated'"))
        .rows[0].count,
    ),
    1,
  );
});

test('SC-010 指标批量导入保留空值、逐行失败且重试不重复', async () => {
  const base = await s.basics();
  const indicator = await s.command(
    'observations.indicator',
    {
      data: {
        name: '政策利率',
        code: 'POLICY_RATE',
        unit: '%',
        frequency: 'event',
        target_id: base.target.id,
        time_basis: 'publication',
      },
    },
    'researcher',
  );
  const rows = Array.from({ length: 10 }, (_, i) => ({
    indicator_id: indicator.id,
    unit: i > 7 ? 'bp' : '%',
    period: '2026-10',
    published_at: s.now,
    source_id: base.source.id,
    external_key: String(i),
    value: i === 0 ? null : i,
  }));
  const first = await s.command<{ accepted: Data[]; rejected: Data[] }>(
    'observations.import',
    { rows },
    'researcher',
  );
  assert.equal(first.accepted.length, 8);
  assert.equal(first.rejected.length, 2);
  const second = await s.command<{ accepted: Data[]; rejected: Data[] }>(
    'observations.import',
    { rows },
    'researcher',
  );
  assert.ok(second.accepted.every((x) => x.reused));
  const stored = await s.list('observations', 'value');
  assert.equal(stored.length, 8);
  assert.equal(stored.find((x) => x.data.external_key === '0')!.data.value, null);
});

test('SC-011 未批准M规则保留空分，不能自动纳管', async () => {
  const base = await s.basics();
  const info = await s.information(base.source);
  const { event } = await s.event(info, base.target, base.variable);
  const rating = await s.command(
    'information.rate',
    {
      event_id: event.id,
      data: {
        assessment_scope: '测试经济体',
        horizon: '未来一个月',
        explanation: '存在金融意义，规则尚未批准',
      },
      reason: '人工复评',
    },
    'researcher',
  );
  assert.equal(rating.data.score, null);
  assert.equal(rating.status, 'draft');
  assert.equal((await s.list('registry', 'risk')).length, 0);
});

test('SC-012 完整候选先匹配再纳管，代码解析为真实配置ID', async () => {
  const fixture = await s.risk();
  assert.equal(fixture.risk.data.tracking_status, 'observing');
  assert.deepEqual(fixture.risk.data.risk_source_ids, [fixture.riskSource.id]);
  assert.deepEqual(fixture.risk.data.risk_dimension_ids, [fixture.dimension.id]);
  assert.ok(!('risk_id' in fixture.candidate.data));
  assert.equal((await s.get('registry', fixture.candidate.id)).data.admitted_risk_id, fixture.risk.id);
  const repeated = await s.command('registry.admit', review(fixture.candidate));
  assert.equal(repeated.id, fixture.risk.id);
});

test('SC-013 未确认变量及越界观察对象不能纳管', async () => {
  const base = await s.basics();
  const info = await s.information(base.source);
  const { event, update } = await s.event(info, base.target, base.variable);
  const data = s.candidateData(base, event, update);
  const variables = data.key_variables as Data[];
  variables[0]!.variable_id = null;
  const candidate = await s.candidate(data);
  await rejects(s.command('registry.admit', review(candidate)), 'UNCONFIRMED_VARIABLE');
  const sector = await s.config('target', {
    name: '经济部门',
    code: 'SECTOR',
    type: 'economic_sector',
    jurisdiction: '测试辖区',
    scope: '经济部门口径',
  });
  await rejects(s.candidate({ ...data, observation_target_id: sector.id }), 'INVALID_OBSERVATION_TARGET');
  assert.equal((await s.list('registry', 'risk')).length, 0);
});

test('SC-014 风险关联和候选均拒绝跨事件更新ID', async () => {
  const f = await s.risk();
  const otherInfo = await s.information(
    f.source,
    '测试财政部门公布另一项政策。',
    'https://example.invalid/other-event',
  );
  const other = await s.event(otherInfo, f.target, f.variable, { title: '独立财政政策' });
  await rejects(
    s.command('registry.relate', {
      risk_id: f.risk.id,
      event_id: f.event.id,
      event_update_id: other.update.id,
      reason: '错误引用必须拒绝',
    }),
    'UPDATE_MISMATCH',
  );
  await rejects(
    s.candidate({ ...s.candidateData(f, f.event, other.update), definition: '独立风险定义' }),
    'UPDATE_MISMATCH',
  );
});

test('SC-015 并发同身份纳管最多创建一个正式风险', async () => {
  const base = await s.basics();
  const info = await s.information(base.source);
  const { event, update } = await s.event(info, base.target, base.variable);
  const data = s.candidateData(base, event, update);
  const a = await s.candidate(data),
    b = await s.candidate(data);
  const outcomes = await Promise.allSettled([
    s.command('registry.admit', review(a)),
    s.command('registry.admit', review(b)),
  ]);
  assert.ok(outcomes.some((x) => x.status === 'fulfilled'));
  assert.equal((await s.list('registry', 'risk')).length, 1, '并发申请不能突破稳定身份约束');
});

test('SC-016 关闭恢复保留原风险ID与首次纳管时间', async () => {
  const f = await s.risk();
  const closed = await s.command('registry.tracking', review(f.risk, { status: 'closed' }));
  s.advance(86400);
  const restored = await s.command('registry.tracking', review(closed, { status: 'monitoring' }));
  assert.equal(restored.id, f.risk.id);
  assert.equal(restored.data.admitted_at, f.risk.data.admitted_at);
  assert.equal(restored.data.restored_at, s.now);
  assert.equal((await s.list('registry', 'risk')).length, 1);
});

test('SC-017 后续进展不改首次关联ID，观察仍能读到新证据', async () => {
  const f = await s.risk();
  s.advance(3600);
  const later = await s.information(
    f.source,
    '政策已实施，政策利率调整到3%。',
    'https://example.invalid/later',
  );
  const progress = await s.event(later, f.target, f.variable, {
    event_id: f.event.id,
    increment_type: 'EVENT_PROGRESS',
    status: 'effective',
  });
  await s.command('registry.relate', {
    risk_id: f.risk.id,
    event_id: f.event.id,
    event_update_id: progress.update.id,
    reason: '补充进展',
  });
  const relations = await transaction(pool, (db) => db.relations(f.risk.id));
  assert.equal(relations.length, 1);
  assert.equal(relations[0]!.event_update_id, f.update.id);
  const task = await s.start(f.risk);
  const evidence = (task.data.input as Data).evidence as Data[];
  assert.deepEqual(new Set(evidence.map((x) => x.id)), new Set([f.info.id, later.id]));
});

test('SC-018 证据截止隔离后发修订，显式追溯另行标记', async () => {
  const f = await s.risk();
  const cutoff = s.now;
  const original = await s.start(f.risk);
  s.advance(3600);
  const revision = await s.information(f.source, '纠正：政策利率调整为4%，前次3%信息有误。');
  await s.event(revision, f.target, f.variable, { event_id: f.event.id, increment_type: 'CORRECTION' });
  const ordinary = await s.start(f.risk, { snapshot_time: cutoff, reason: '相同历史截止复核' });
  const retrospective = await s.start(f.risk, {
    snapshot_time: cutoff,
    hindsight: true,
    reason: '显式纳入事后纠正',
  });
  const ids = (t: RecordRow) => ((t.data.input as Data).evidence as Data[]).map((x) => x.id);
  assert.deepEqual(ids(original), [f.info.id]);
  assert.deepEqual(ids(ordinary), [f.info.id]);
  assert.ok(ids(retrospective).includes(revision.id));
  assert.equal(
    ((retrospective.data.input as Data).evidence as Data[]).find((x) => x.id === revision.id)!.hindsight,
    true,
  );
});

test('SC-019 首次观察不得stable或shortening，合法未知可以批准', async () => {
  const f = await s.risk();
  const task = await s.start(f.risk);
  const invalid = s.analysisData(task);
  (invalid.change as Data).trend = 'stable';
  await rejects(
    s.command('analysis.draft', { task_id: task.id, data: invalid }, 'researcher'),
    'NO_BASELINE',
  );
  const approved = await s.approve(task);
  assert.equal(approved.status, 'approved');
  assert.equal((approved.data.change as Data).trend, 'undetermined');
  assert.equal(approved.data.risk_level, null);
});

test('SC-020 技术阶段缺项不能提交，合法业务未知不等于失败', async () => {
  const f = await s.risk();
  const firstTask = await s.start(f.risk);
  const valid = await s.approve(firstTask);
  s.advance(3600);
  const task = await s.start(f.risk);
  const data = s.analysisData(task);
  (data.stages as Data).trend = 'failed';
  const draft = await s.command('analysis.draft', { task_id: task.id, data }, 'researcher');
  await rejects(
    s.command('analysis.submit', { id: draft.id, expected_version: draft.version }, 'researcher'),
    'INCOMPLETE_ANALYSIS',
  );
  assert.equal((await s.get('analysis', draft.id)).status, 'draft');
  assert.equal(((await products())[0]!.snapshot as Data).id, valid.id);
});

test('SC-021 取消任务后旧代次不能批准且原草稿保留', async () => {
  const f = await s.risk();
  const task = await s.start(f.risk);
  const submitted = await s.submitted(task);
  await s.command('operations.cancel', review(task), 'researcher');
  await rejects(s.command('analysis.approve', review(submitted)), 'COMMIT_REVOKED');
  assert.equal((await s.get('analysis', submitted.id)).status, 'submitted');
  assert.equal((await s.list('analysis', 'snapshot')).filter((x) => x.status === 'approved').length, 0);
});

test('SC-022 发起人撤权后已排队结果不能正式提交', async () => {
  const f = await s.risk();
  const task = await s.start(f.risk);
  const submitted = await s.submitted(task);
  const owner = await s.get('identity', s.actors.researcher.id);
  await s.command(
    'identity.user',
    {
      id: owner.id,
      expected_version: owner.version,
      data: {
        username: 'researcher',
        name: 'researcher',
        roles: ['reader'],
        active: false,
        evidence_access: false,
      },
    },
    'admin',
  );
  await assert.rejects(s.command('analysis.approve', review(submitted)), /权限|撤销|授权|资格/);
  assert.equal((await s.get('analysis', submitted.id)).status, 'submitted');
});

test('SC-023 运行中暂停及定义变化阻止旧分析正式提交', async () => {
  const f = await s.risk();
  const task = await s.start(f.risk);
  const submitted = await s.submitted(task);
  const paused = await s.command('registry.tracking', review(f.risk, { status: 'paused' }));
  await rejects(s.command('analysis.approve', review(submitted)), 'TRACKING_CHANGED');
  const restored = await s.command('registry.tracking', review(paused, { status: 'monitoring' }));
  await s.command(
    'registry.revise',
    review(restored, { data: { mechanism_summary: '新增研究边界说明，需重新固定分析' } }),
  );
  await rejects(s.command('analysis.approve', review(submitted)), 'DEFINITION_CHANGED');
});

test('SC-024 旧截止运行不冒充最新，显式追溯也不改变最新选择', async () => {
  const f = await s.risk();
  const oldCutoff = s.now;
  const oldTask = await s.start(f.risk);
  const oldDraft = await s.submitted(oldTask);
  s.advance(7200);
  const newer = await s.approve(await s.start(f.risk));
  await rejects(s.command('analysis.approve', review(oldDraft)), 'STALE_RUN');
  const historicalTask = await s.start(f.risk, {
    snapshot_time: oldCutoff,
    hindsight: true,
    reason: '显式历史分析',
  });
  await s.approve(historicalTask);
  assert.equal(((await products())[0]!.snapshot as Data).id, newer.id);
});

test('SC-025 同等级可以减弱，未设节点规则不能确认节点', async () => {
  const f = await s.risk();
  const rule = await s.config('rule', {
    name: '测试等级',
    code: 'TEST_LEVEL',
    category: 'risk_level',
    scope: '测试',
    definition: '仅测试数据',
    comparison_group: 'test-only',
    levels: [{ code: 'high', order: 3 }],
  });
  const task1 = await s.start(f.risk),
    data1 = s.analysisData(task1);
  data1.risk_level = 'high';
  data1.rule_id = rule.id;
  await s.approve(task1, data1);
  s.advance(3600);
  const task2 = await s.start(f.risk),
    data2 = s.analysisData(task2);
  data2.risk_level = 'high';
  data2.rule_id = rule.id;
  (data2.change as Data).trend = 'easing';
  (data2.change as Data).change_reason = '同级内压力下降，保持等级但记录方向变化';
  const invalid = structuredClone(data2);
  (invalid.change as Data).weakening_node_status = 'confirmed';
  await assert.rejects(
    s.command('analysis.draft', { task_id: task2.id, data: invalid }, 'researcher'),
    /weakening_rule_id|节点/,
  );
  const approved = await s.approve(task2, data2);
  assert.equal(approved.data.risk_level, 'high');
  assert.equal((approved.data.change as Data).trend, 'easing');
});

test('SC-026 最新等级空值不能回取历史高等级排序', async () => {
  const f = await s.risk();
  const rule = await s.config('rule', {
    name: '测试等级',
    code: 'TEST_LEVEL',
    category: 'risk_level',
    scope: '测试',
    definition: '仅测试数据',
    levels: [{ code: 'high', order: 3 }],
  });
  const task = await s.start(f.risk),
    data = s.analysisData(task);
  data.risk_level = 'high';
  data.rule_id = rule.id;
  await s.approve(task, data);
  s.advance(3600);
  const latest = await s.approve(await s.start(f.risk));
  const product = (await products())[0]!;
  assert.equal((product.snapshot as Data).id, latest.id);
  assert.equal(product.severity, null);
  assert.equal(product.unranked_reason, '等级待判断');
});

test('SC-027 报告固定引用、禁止篡改结构化判断且重复发布只出刊一次', async () => {
  const f = await s.risk();
  const snapshot = await s.approve(await s.start(f.risk));
  const start = new Date(Date.parse(s.now) - 86400).toISOString();
  s.advance(3600);
  const report = await s.command(
    'publication.generate',
    { type: 'daily', period_start: start, period_end: s.now, cutoff: s.now },
    'researcher',
  );
  const items = structuredClone(report.data.items) as Data[];
  ((items[0]!.snapshots as Data[])[0]!.change as Data).trend = 'aggravating';
  await rejects(
    s.command('publication.edit', review(report, { data: { items } }), 'researcher'),
    'CONCLUSION_CONFLICT',
  );
  const submitted = await s.command(
    'publication.submit',
    { id: report.id, expected_version: report.version },
    'researcher',
  );
  const published = await s.command('publication.publish', review(submitted));
  const repeated = await s.command('publication.publish', review(submitted));
  assert.equal(repeated.version, published.version);
  const frozen = (published.data.items as Data[])[0]!.snapshots as Data[];
  assert.equal(frozen[0]!.id, snapshot.id);
  assert.equal(frozen[0]!.version, snapshot.version);
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM platform.outbox WHERE type='publication.published' AND aggregate_id=$1",
          [report.id],
        )
      ).rows[0].count,
    ),
    1,
  );
  s.advance(3600);
  await s.approve(await s.start(f.risk));
  assert.deepEqual((await s.get('publication', report.id)).data.items, published.data.items);
});

test('SC-028 报告发布前上游撤回必须阻断，撤回后可另建修订', async () => {
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
  await s.command('analysis.withdraw', review(snapshot));
  await rejects(s.command('publication.publish', review(submitted)), 'REFERENCE_WITHDRAWN');
  assert.equal((await s.get('publication', report.id)).status, 'submitted');
});

test('SC-029 空期报告可说明覆盖不足但不编造无风险', async () => {
  const f = await s.risk();
  const start = new Date(Date.parse(s.now) - 3600).toISOString();
  s.advance(3600);
  const report = await s.command(
    'publication.generate',
    { type: 'daily', period_start: start, period_end: s.now, cutoff: s.now },
    'researcher',
  );
  const item = (report.data.items as Data[])[0]!;
  assert.equal(item.risk_id, f.risk.id);
  assert.equal(item.reason, '新纳管、待评估');
  assert.deepEqual(item.snapshots, []);
  assert.doesNotMatch(String(report.data.summary), /市场无风险[。！]?$/);
});

test('SC-030 乐观并发拒绝旧版覆盖并保留审计', async () => {
  const draft = await s.command(
    'reference.save',
    {
      kind: 'variable',
      data: { name: '利率', code: 'RATE', definition: '利率', boundary: '政策', unit: '%' },
    },
    'researcher',
  );
  const changed = await s.command(
    'reference.save',
    {
      id: draft.id,
      expected_version: draft.version,
      kind: 'variable',
      data: { ...draft.data, name: '已确认的新名称' },
    },
    'researcher',
  );
  await rejects(
    s.command(
      'reference.save',
      {
        id: draft.id,
        expected_version: draft.version,
        kind: 'variable',
        data: { ...draft.data, name: '过期输入' },
      },
      'researcher',
    ),
    'VERSION_CONFLICT',
  );
  assert.equal((await s.get('reference', draft.id)).version, changed.version);
  const history = await transaction(pool, (db) => db.history('reference', draft.id));
  assert.equal(history.length, 2);
  const audit = await pool.query('SELECT * FROM platform.audit WHERE object_id=$1', [draft.id]);
  assert.ok(audit.rowCount! >= 2, '创建及成功修改均有审计');
});

test('SC-031 同计划窗口幂等且停用不再受理新窗口', async () => {
  const schedule = await s.command(
    'operations.schedule',
    {
      data: {
        name: '测试观察计划',
        type: 'analysis',
        timezone: 'Asia/Shanghai',
        interval_minutes: 60,
        next_at: s.now,
        input: {},
      },
    },
    'admin',
  );
  assert.equal(schedule.status, 'disabled');
  const enabled = await s.command(
    'operations.schedule_status',
    { id: schedule.id, expected_version: schedule.version, enabled: true },
    'admin',
  );
  const first = await s.command('operations.schedule_run', { id: enabled.id, run_key: s.now }, 'admin');
  const again = await s.command('operations.schedule_run', { id: enabled.id, run_key: s.now }, 'admin');
  assert.equal(again.id, first.id);
  await s.command(
    'operations.schedule_status',
    { id: enabled.id, expected_version: enabled.version, enabled: false },
    'admin',
  );
  await rejects(
    s.command('operations.schedule_run', { id: enabled.id, run_key: s.advance(3600) }, 'admin'),
    'PLAN_DISABLED',
  );
});

test('SC-032 重算生成新运行并保留原固定输入', async () => {
  const f = await s.risk();
  const task = await s.start(f.risk);
  const rerun = await s.command(
    'operations.recompute',
    { id: task.id, reason: '人工复核需重算' },
    'researcher',
  );
  assert.notEqual(rerun.id, task.id);
  assert.equal((rerun.data.input as Data).recompute_of, task.id);
  assert.deepEqual((rerun.data.input as Data).evidence, (task.data.input as Data).evidence);
  assert.deepEqual((await s.get('operations', task.id)).data, task.data);
});

test('SC-041 仅来源补充进入观察证据，但不越过历史截止', async () => {
  const f = await s.risk();
  const cutoff = s.now;
  s.advance(3600);
  const secondSource = await s.source('SECOND_SOURCE');
  const secondInfo = await s.information(secondSource, String(f.info.data.content));
  await s.event(secondInfo, f.target, f.variable, {
    event_id: f.event.id,
    increment_type: 'SOURCE_ADDITION',
  });
  const current = await s.start(f.risk);
  const historical = await s.start(f.risk, { snapshot_time: cutoff });
  const ids = (task: RecordRow) => ((task.data.input as Data).evidence as Data[]).map((x) => x.id);
  assert.deepEqual(new Set(ids(current)), new Set([f.info.id, secondInfo.id]));
  assert.deepEqual(ids(historical), [f.info.id]);
  assert.equal((await s.list('information', 'event_update')).length, 1);
});

test('SC-042 复核退回驳回推进领域状态，过期决定和正式记录拒绝', async () => {
  const f = await s.risk();
  const analysis = await s.submitted(await s.start(f.risk));
  const start = new Date(Date.parse(s.now) - 86400).toISOString();
  s.advance(3600);
  const draft = await s.command(
    'publication.generate',
    { type: 'daily', period_start: start, period_end: s.now, cutoff: s.now },
    'researcher',
  );
  const report = await s.command(
    'publication.submit',
    { id: draft.id, expected_version: draft.version },
    'researcher',
  );
  for (const [domain, row] of [
    ['analysis', analysis],
    ['publication', report],
  ] as const) {
    const input = {
      data: { domain, object_id: row.id, expected_version: row.version, decision: 'return' },
      reason: '证据或说明需补充',
    };
    await s.command('operations.review', input);
    const returned = await s.get(domain, row.id);
    assert.equal(returned.status, 'draft');
    assert.ok(returned.version > row.version);
    await assert.rejects(
      s.command('operations.review', { ...input, data: { ...input.data, decision: 'reject' } }),
      (error) => (error as { status?: number }).status === 409,
    );
    assert.equal((await s.get(domain, row.id)).status, 'draft');
    const resubmitted = await s.command(
      domain + '.submit',
      { id: returned.id, expected_version: returned.version },
      'researcher',
    );
    await s.command('operations.review', {
      data: { domain, object_id: resubmitted.id, expected_version: resubmitted.version, decision: 'reject' },
      reason: '经复核当前依据不成立',
    });
    assert.equal((await s.get(domain, row.id)).status, 'rejected');
  }
  s.advance(3600);
  const approved = await s.approve(await s.start(f.risk));
  await assert.rejects(
    s.command('operations.review', {
      data: {
        domain: 'analysis',
        object_id: approved.id,
        expected_version: approved.version,
        decision: 'return',
      },
      reason: '正式结果须走撤回修订',
    }),
  );
  assert.equal((await s.get('analysis', approved.id)).status, 'approved');
});

test('SC-045 迟到的历史批准不能越过比较基准截止边界', async () => {
  const f = await s.risk(),
    earlier = s.now;
  const submitted = await s.submitted(await s.start(f.risk));
  s.advance(3600);
  const approved = await s.command('analysis.approve', review(submitted));
  const cutoff = new Date(Date.parse(earlier) + 1800_000).toISOString();
  const historical = await s.start(f.risk, { snapshot_time: cutoff });
  assert.equal((historical.data.input as Data).comparison_snapshot_id, null);
  await rejects(
    s.start(f.risk, { snapshot_time: cutoff, comparison_snapshot_id: approved.id }),
    'INVALID_BASELINE',
  );
});

test('SC-046 技术失败任务即使草稿完整也不能批准', async () => {
  const f = await s.risk(),
    task = await s.start(f.risk),
    submitted = await s.submitted(task);
  await transaction(pool, async (db) => {
    const current = await db.get('operations', task.id, true);
    await db.update(
      'operations',
      task.id,
      current.version,
      { ...current.data, stage: 'failed', error: { code: 'ACTIVITY_FAILED' } },
      'failed',
    );
  });
  await rejects(s.command('analysis.approve', review(submitted)), 'COMMIT_REVOKED');
  assert.equal((await s.get('analysis', submitted.id)).status, 'submitted');
});
