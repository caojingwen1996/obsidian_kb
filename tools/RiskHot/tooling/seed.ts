import 'dotenv/config';
import { createPool, transaction, defaultDatabaseUrl } from '../packages/platform/database/index.js';
import { actorFrom } from '../packages/domains/identity/index.js';
import { executeCommand } from '../packages/application/commands.js';
import type { Data, RecordRow } from '../packages/platform/core/types.js';
const url = process.env.DATABASE_URL || defaultDatabaseUrl;
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('演示资料只允许写入本机开发数据库');
const pool = createPool(url);
try {
  const user = await transaction(pool, async (db) =>
    (await db.list('identity', 'user')).find(
      (x) =>
        x.status === 'active' &&
        ['admin', 'researcher', 'reviewer'].every((role) => (x.data.roles as string[]).includes(role)),
    ),
  );
  if (!user)
    throw new Error('先打开 RiskHot 并创建本机管理员，再执行 pnpm db:seed；本脚本不生成账号或默认密码。');
  const actor = actorFrom(user);
  const command = async (name: string, input: Data, key: string) =>
    (await executeCommand(pool, actor, name, input, 'demo-v1:' + key)) as unknown as RecordRow;
  const config = async (kind: string, data: Data) => {
    const draft = await command('reference.save', { kind, data }, String(data.code));
    return command(
      'reference.approve',
      { id: draft.id, expected_version: draft.version, reason: '演示夹具；非真实市场资料' },
      'approve:' + String(data.code),
    );
  };
  const target = await config('target', {
    name: '【演示】虚构经济体',
    code: 'DEMO_ECONOMY',
    type: 'economy',
    jurisdiction: '演示辖区',
    scope: '仅用于软件演示，不对应实际市场',
  });
  const variable = await config('variable', {
    name: '【演示】政策利率',
    code: 'DEMO_RATE',
    definition: '虚构政策利率',
    boundary: '软件演示',
    unit: '%',
  });
  await config('risk_source', {
    name: '【演示】货币条件',
    code: 'DEMO_MONETARY',
    definition: '虚构货币条件压力',
    analysis_level: 'macro',
  });
  await config('dimension', {
    name: '【演示】流动性',
    code: 'DEMO_LIQUIDITY',
    definition: '演示流动性风险分类',
  });
  const source = await command(
    'information.source',
    {
      data: {
        name: '【演示】虚构政策信源',
        code: 'DEMO_SOURCE',
        url: 'https://example.invalid/riskhot-demo',
        category: 'demo',
        scope: '合成软件测试资料',
      },
    },
    'source',
  );
  await command(
    'information.source_status',
    { id: source.id, expected_version: source.version, status: 'active', reason: '仅演示；没有外部采集' },
    'source-approve',
  );
  const content = '【演示资料】虚构央行宣布调整政策利率。该资料仅用于验证软件操作，不描述真实政策或市场。';
  // Keep seed inputs stable across reruns, including publication time.
  const info = await command(
    'information.ingest',
    {
      source_id: source.id,
      url: 'https://example.invalid/riskhot-demo/policy',
      content,
      published_at: '2026-01-01T00:00:00.000Z',
    },
    'information',
  );
  const event = (await command(
    'information.event',
    {
      data: {
        information_id: info.id,
        quote: content,
        title: '【演示】政策利率调整公告',
        subject: '虚构央行',
        action: '调整利率',
        time_semantics: '虚构公告时点',
        status: 'announced',
        increment_type: 'NEW_EVENT',
        targets: [{ target_id: target.id, variable_ids: [variable.id] }],
      },
    },
    'event',
  )) as unknown as { event: RecordRow };
  const candidate = await command(
    'registry.candidate',
    {
      data: {
        name: '【演示】宏观融资压力',
        definition: '虚构货币条件变化可能增加融资压力',
        observation_target_id: target.id,
        scope_boundary: '仅虚构经济体',
        mechanism_summary: '演示利率通过融资渠道形成压力的观察逻辑',
        damage_targets: [],
        dimension_code: 'DEMO_LIQUIDITY',
        risk_source_codes: ['DEMO_MONETARY'],
        event_id: event.event.id,
        key_variables: [
          {
            variable_id: variable.id,
            name: '虚构政策利率',
            role: 'risk_driver',
            impact_mechanism: '演示传导路径，未作实际风险判断',
            risk_source_code: 'DEMO_MONETARY',
          },
        ],
      },
    },
    'candidate',
  );
  const matched = await command(
    'registry.match',
    { id: candidate.id, expected_version: candidate.version, decision: 'new', reason: '演示独立虚构对象' },
    'match',
  );
  await command(
    'registry.admit',
    { id: matched.id, expected_version: matched.version, reason: '合成软件演示，待人工观察' },
    'admit',
  );
  console.log('演示配置、原文、事件与一条未评估风险已就绪。可从风险目录发起观察；没有生成任何真实市场判断。');
} finally {
  await pool.end();
}
