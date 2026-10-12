import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createPool, domains, transaction } from '../../packages/platform/database/index.js';
import { actorFrom, passwordHash } from '../../packages/domains/identity/index.js';
import { executeCommand } from '../../apps/api/src/commands.js';
import { migrate } from '../../tooling/migrate.js';
import type { Actor, Data, Domain, RecordRow } from '../../packages/platform/core/types.js';

// This runner deliberately cannot point at the development or a remote database.
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL || 'postgres://riskhot:riskhot-local@127.0.0.1:55432/riskhot_test';
export function assertTestDatabase(url = testDatabaseUrl) {
  const parsed = new URL(url);
  if (parsed.pathname !== '/riskhot_test' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('场景验证只允许本机 riskhot_test 数据库，拒绝清理开发库或远端数据库');
  }
  return parsed;
}
export async function openTestDatabase() {
  const parsed = assertTestDatabase();
  parsed.pathname = '/postgres';
  const admin = new pg.Pool({ connectionString: parsed.toString() });
  try {
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = 'riskhot_test'")).rowCount) {
      await admin.query('CREATE DATABASE riskhot_test');
    }
  } finally {
    await admin.end();
  }
  await migrate(testDatabaseUrl);
  return createPool(testDatabaseUrl);
}
export async function clearTestDatabase(pool: pg.Pool) {
  assertTestDatabase();
  const actual = await pool.query('SELECT current_database() AS name');
  if (actual.rows[0]?.name !== 'riskhot_test') throw new Error('数据库身份复核失败，拒绝清理');
  const tables = domains.flatMap((d) => [`${d}.records`, `${d}.history`]);
  tables.push(
    'registry.monitored_risk_event_relation',
    'platform.operations',
    'platform.claims',
    'platform.audit',
    'platform.outbox',
    'platform.sessions',
    'platform.artifacts',
  );
  await pool.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

export const fixturePassword = 'RiskHot-test-fixture-2026!';
export class Scenario {
  now = new Date(Date.now() + 60_000).toISOString();
  actors = {} as Record<'admin' | 'reviewer' | 'researcher' | 'reader', Actor>;
  constructor(public pool: pg.Pool) {}
  advance(seconds: number) {
    this.now = new Date(Date.parse(this.now) + seconds * 1000).toISOString();
    return this.now;
  }
  async initialize() {
    await clearTestDatabase(this.pool);
    await transaction(this.pool, async (db) => {
      for (const role of ['admin', 'reviewer', 'researcher', 'reader'] as const) {
        const row = await db.create(
          'identity',
          'user',
          {
            username: role,
            name: role,
            roles: [role],
            evidence_access: role !== 'reader',
            password_hash: passwordHash(fixturePassword),
          },
          'active',
        );
        this.actors[role] = actorFrom(row);
      }
    });
    return this;
  }
  async command<T = RecordRow>(
    name: string,
    input: Data,
    role: keyof Scenario['actors'] = 'reviewer',
    key = randomUUID(),
  ): Promise<T> {
    return (await executeCommand(this.pool, this.actors[role], name, input, key, this.now)) as T;
  }
  get(domain: Domain, id: string) {
    return transaction(this.pool, (db) => db.get(domain, id));
  }
  list(domain: Domain, kind: string) {
    return transaction(this.pool, (db) => db.list(domain, kind));
  }
  async config(kind: string, data: Data) {
    const draft = await this.command('reference.save', { kind, data });
    return this.command('reference.approve', {
      id: draft.id,
      expected_version: draft.version,
      reason: '场景夹具：人工审核通过',
    });
  }
  async source(code = 'TEST_SOURCE') {
    const draft = await this.command(
      'information.source',
      {
        data: {
          name: '场景政策来源',
          code,
          url: 'https://example.invalid/policy',
          category: 'official',
          scope: '场景专用宏观数据',
        },
      },
      'admin',
    );
    return this.command('information.source_status', {
      id: draft.id,
      expected_version: draft.version,
      status: 'active',
      reason: '离线夹具；不访问网络',
    });
  }
  async basics() {
    const target = await this.config('target', {
      name: '测试经济体',
      code: 'TEST_ECONOMY',
      type: 'economy',
      jurisdiction: '测试辖区',
      scope: '宏观经济体整体',
    });
    const variable = await this.config('variable', {
      name: '政策利率',
      code: 'TEST_RATE',
      definition: '政策公布的利率',
      boundary: '隔夜政策利率',
      unit: '%',
    });
    const riskSource = await this.config('risk_source', {
      name: '货币条件',
      code: 'TEST_MONETARY',
      definition: '货币条件变化形成的压力',
      analysis_level: 'macro',
    });
    const dimension = await this.config('dimension', {
      name: '流动性',
      code: 'liquidity',
      definition: '融资及市场流动性压力',
    });
    const source = await this.source();
    return { target, variable, riskSource, dimension, source };
  }
  async information(
    source: RecordRow,
    content = '测试央行宣布政策利率由2%调整为3%，计划下一周实施。',
    url = 'https://example.invalid/notice/1',
  ) {
    return this.command(
      'information.ingest',
      { source_id: source.id, url, content, published_at: this.now },
      'researcher',
    );
  }
  async event(info: RecordRow, target: RecordRow, variable?: RecordRow, extra: Data = {}) {
    return this.command<{ event: RecordRow; update: RecordRow }>('information.event', {
      data: {
        information_id: info.id,
        quote: info.data.content!,
        title: '测试政策利率调整',
        subject: '测试央行',
        action: '调整政策利率',
        time_semantics: '公告；未来实施',
        status: 'announced',
        increment_type: 'NEW_EVENT',
        targets: [{ target_id: target.id, variable_ids: variable ? [variable.id] : [] }],
        ...extra,
      },
    });
  }
  candidateData(base: Awaited<ReturnType<Scenario['basics']>>, event: RecordRow, update?: RecordRow): Data {
    return {
      name: '宏观融资压力',
      definition: '紧缩货币条件可能增加宏观再融资压力',
      observation_target_id: base.target.id,
      scope_boundary: '测试经济体全域',
      mechanism_summary: '政策利率通过融资渠道产生压力，实际效果待证实',
      damage_targets: [],
      dimension_code: 'liquidity',
      risk_source_codes: ['TEST_MONETARY'],
      event_id: event.id,
      event_update_id: update?.id ?? event.data.latest_update_id!,
      key_variables: [
        {
          variable_id: base.variable.id,
          name: '政策利率',
          role: 'risk_driver',
          impact_mechanism: '政策利率上升可能增加再融资压力',
          risk_source_code: 'TEST_MONETARY',
        },
      ],
    };
  }
  async candidate(data: Data, decision = 'new', targetId?: string) {
    const candidate = await this.command('registry.candidate', { data }, 'researcher');
    return this.command('registry.match', {
      id: candidate.id,
      expected_version: candidate.version,
      decision,
      reason: '完整定义与对象范围逐项核验',
      ...(targetId ? { target_id: targetId } : {}),
    });
  }
  async risk() {
    const base = await this.basics();
    const info = await this.information(base.source);
    const { event, update } = await this.event(info, base.target, base.variable);
    const candidate = await this.candidate(this.candidateData(base, event, update));
    const risk = await this.command('registry.admit', {
      id: candidate.id,
      expected_version: candidate.version,
      reason: '至少一项已确认变量；人工准入',
    });
    return { ...base, info, event, update, candidate, risk };
  }
  async start(risk: RecordRow, extra: Data = {}, role: keyof Scenario['actors'] = 'researcher') {
    return this.command('analysis.start', { risk_id: risk.id, snapshot_time: this.now, ...extra }, role);
  }
  analysisData(task: RecordRow): Data {
    const manifest = task.data.input as Data;
    const evidence = manifest.evidence as Data[];
    return {
      risk_level: null,
      risk_stage: 'accumulating',
      affected_scope: [],
      persistence_outlook: '依赖政策实施和融资渠道后续证据，结束时间未知',
      status_summary: {
        source_pressure: '公告显示政策利率上升',
        response_effect: '尚无实际缓冲成效证据',
        force_balance: 'undetermined',
        damage: '尚未证实，不代表无损害',
        limitations: ['只有公告证据；实际实施效果待验证'],
      },
      variable_analysis: (manifest.variables as Data[]).map((v) => ({
        relation_id: v.relation_id!,
        observed_state: '政策已宣布；实际实施待证实',
        risk_effect: 'pressure',
        source_refs: [evidence[0]!.id!],
        interpretation: '利率上升可能通过融资渠道产生压力',
        uncertainty: '实际融资效果未知',
      })),
      change: {
        comparison_snapshot_id: manifest.comparison_snapshot_id!,
        trend: 'undetermined',
        persistence_change: 'undetermined',
        change_reason: '尚无充分可比证据',
        weakening_node_status: 'undetermined',
        next_observation: '核对政策实施与融资成本变化',
      },
      stages: Object.fromEntries(
        ['source', 'buffer', 'damage', 'force', 'current', 'trend', 'persistence', 'node'].map((x) => [
          x,
          'completed',
        ]),
      ),
    };
  }
  async submitted(task: RecordRow, data = this.analysisData(task)) {
    const draft = await this.command('analysis.draft', { task_id: task.id, data }, 'researcher');
    return this.command('analysis.submit', { id: draft.id, expected_version: draft.version }, 'researcher');
  }
  async approve(task: RecordRow, data = this.analysisData(task)) {
    const submitted = await this.submitted(task, data);
    return this.command('analysis.approve', {
      id: submitted.id,
      expected_version: submitted.version,
      reason: '人工核验证据及四维判断',
    });
  }
}
