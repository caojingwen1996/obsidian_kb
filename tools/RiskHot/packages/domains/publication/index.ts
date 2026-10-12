import { returnOrReject } from '../../platform/core/review.js';
import {
  active,
  ensure,
  expected,
  iso,
  object,
  permit,
  records,
  text,
  type CommandHandler,
  type Context,
  type Data,
  type RecordRow,
} from '../../platform/core/types.js';
const json = (x: unknown) => JSON.parse(JSON.stringify(x));
export async function riskProducts(c: Context) {
  const risks = await c.db.list('registry', 'risk'),
    snaps = (await c.db.list('analysis', 'snapshot')).filter((x) => x.status === 'approved');
  const mappings = (await c.db.list('reference', 'market')).filter((x) => x.status === 'approved');
  const rules = (await c.db.list('reference', 'rule')).filter((x) => x.status === 'approved');
  const freshness = rules.find((x) => x.data.category === 'freshness');
  const result: Data[] = [];
  for (const r of risks) {
    const latest = snaps
      .filter((x) => x.data.risk_id === r.id)
      .sort(
        (a, b) =>
          String(b.data.snapshot_time).localeCompare(String(a.data.snapshot_time)) ||
          String(b.data.approved_at).localeCompare(String(a.data.approved_at)) ||
          b.id.localeCompare(a.id),
      )[0];
    const rule = latest ? rules.find((x) => x.id === latest.data.rule_id) : undefined;
    const hours = freshness ? Number(freshness.data.max_hours) : NaN;
    const stale =
      latest && Number.isFinite(hours)
        ? Date.parse(c.now) - Date.parse(String(latest.data.snapshot_time)) > hours * 3600000
        : null;
    const severity =
      rule && latest
        ? records(rule.data, 'levels').find((x) => x.code === latest.data.risk_level)?.order
        : null;
    const reason = !latest
      ? '未评估'
      : latest.data.risk_level === null
        ? '等级待判断'
        : !rule
          ? '等级规则不可比'
          : stale === null
            ? '时效未配置'
            : stale
              ? '陈旧结果'
              : null;
    result.push({
      id: r.id,
      version: r.version,
      ...r.data,
      market: mappings.find((x) => x.data.target_id === r.data.observation_target_id)?.data.name ?? '未分类',
      snapshot: latest ? json(latest) : null,
      severity: severity ?? null,
      ranking_group: rule?.data.comparison_group ?? rule?.id ?? null,
      unranked_reason: reason,
      stale: stale ?? null,
    });
  }
  return result;
}
async function validateReport(c: Context, r: RecordRow) {
  for (const item of records(r.data, 'items')) {
    for (const ref of records(item, 'snapshots')) {
      const s = await c.db.get('analysis', text(ref, 'id'));
      ensure(s.status === 'approved', 'REFERENCE_WITHDRAWN', '报告引用的快照已撤回');
      ensure(s.data.risk_id === item.risk_id, 'CROSS_RISK_REFERENCE', '快照不属于报告条目');
      ensure(
        String(s.data.snapshot_time) <= String(r.data.cutoff),
        'FUTURE_REFERENCE',
        '快照超过报告截止时间',
      );
      ensure(s.version === ref.version, 'REFERENCE_CHANGED', '快照版本已变化，需重新核对');
    }
  }
}
const generate: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const start = iso(text(i, 'period_start')),
    end = iso(text(i, 'period_end')),
    cutoff = iso(text(i, 'cutoff'));
  ensure(
    start < end && end <= cutoff && cutoff <= c.now,
    'INVALID_PERIOD',
    '周期必须左闭右开，截止时间不早于周期结束且不在未来',
  );
  const type = text(i, 'type');
  ensure(['daily', 'weekly', 'monthly'].includes(type), 'INVALID_REPORT_TYPE', '报告类型无效');
  const scope = text(i, 'scope', '宏观风险');
  const all = (await c.db.list('analysis', 'snapshot')).filter(
    (x) =>
      x.status === 'approved' &&
      String(x.data.snapshot_time) < end &&
      String(x.data.snapshot_time) >= start &&
      String(x.data.approved_at) <= cutoff,
  );
  const risks = await c.db.list('registry', 'risk');
  const items: Data[] = [];
  for (const risk of risks) {
    const snapshots = all
      .filter((x) => x.data.risk_id === risk.id)
      .sort((a, b) => String(a.data.snapshot_time).localeCompare(String(b.data.snapshot_time)));
    if (!snapshots.length && !(String(risk.data.admitted_at) >= start && String(risk.data.admitted_at) < end))
      continue;
    items.push({
      risk_id: risk.id,
      name: risk.data.name!,
      definition_version: risk.data.definition_version!,
      reason: snapshots.length ? '周期内有效观察' : '新纳管、待评估',
      snapshots: snapshots.map((x) => ({
        id: x.id,
        version: x.version,
        snapshot_time: x.data.snapshot_time!,
        risk_level: x.data.risk_level ?? null,
        risk_stage: x.data.risk_stage!,
        affected_scope: x.data.affected_scope!,
        persistence_outlook: x.data.persistence_outlook!,
        change: x.data.change!,
      })),
      summary: snapshots.length
        ? '以下判断逐项引用已批准快照；保留周期内各次变化。'
        : '本期新增纳管，尚无可用评估结果。',
    });
  }
  const key = `report:${type}:${start}:${end}:${scope}`;
  const stableId = await c.db.findClaim(key);
  const row = await c.db.create('publication', 'report', {
    report_id: stableId ?? null,
    report_type: type,
    scope,
    period_start: start,
    period_end: end,
    cutoff,
    title: `${type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报'} · ${start.slice(0, 10)}`,
    summary: items.length
      ? '本报告基于下列固定版本，未纳入截止时间后的结果。'
      : '本期暂无可用评估结果，不代表市场无风险。',
    items,
    created_by: c.actor.id,
    revision: stableId
      ? (await c.db.list('publication', 'report')).filter(
          (x) => x.data.report_id === stableId || x.id === stableId,
        ).length + 1
      : 1,
  });
  if (!stableId) await c.db.claim(key, row.id);
  return json(row);
};
const edit: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const r = await c.db.get('publication', text(i, 'id'), true);
  ensure(r.kind === 'report' && r.status === 'draft', 'IMMUTABLE_REPORT', '只能编辑报告草稿');
  const d = object(i, 'data');
  for (const key of Object.keys(d))
    ensure(
      ['title', 'summary', 'items'].includes(key),
      'PROTECTED_FIELD',
      '不能修改报告周期、状态或固定判断',
    );
  if (d.items) {
    const original = records(r.data, 'items');
    for (const item of records(d, 'items')) {
      const old = original.find((x) => x.risk_id === item.risk_id);
      ensure(
        old && JSON.stringify(item.snapshots) === JSON.stringify(old.snapshots),
        'CONCLUSION_CONFLICT',
        '快照、等级、趋势等判断必须保持与上游完全一致',
      );
    }
    text(i, 'reason');
  }
  const out = await c.db.update('publication', r.id, expected(i), {
    ...r.data,
    ...d,
    edit_reason: text(i, 'reason'),
  });
  await validateReport(c, out);
  return json(out);
};
const submit: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const r = await c.db.get('publication', text(i, 'id'), true);
  ensure(r.status === 'draft', 'INVALID_STATE', '只能提交草稿');
  await validateReport(c, r);
  return json(
    await c.db.update('publication', r.id, expected(i), { ...r.data, submitted_at: c.now }, 'submitted'),
  );
};
const publish: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('publication', text(i, 'id'), true);
  if (r.status === 'published') return json(r);
  ensure(r.status === 'submitted', 'INVALID_STATE', '先提交报告审核');
  await validateReport(c, r);
  const out = await c.db.update(
    'publication',
    r.id,
    expected(i),
    { ...r.data, published_at: c.now, published_by: c.actor.id, approval_reason: text(i, 'reason') },
    'published',
  );
  await c.db.emit('publication.published', r.id, { report_id: r.id, version: out.version });
  return json(out);
};
const withdraw: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('publication', text(i, 'id'), true);
  ensure(r.status === 'published', 'INVALID_STATE', '仅已发布报告可撤回');
  const out = await c.db.update(
    'publication',
    r.id,
    expected(i),
    { ...r.data, withdrawn_at: c.now, withdrawal_reason: text(i, 'reason') },
    'withdrawn',
  );
  await c.db.emit('publication.withdrawn', r.id, { report_id: r.id });
  return json(out);
};
const revise: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const r = await c.db.get('publication', text(i, 'id'));
  ensure(['published', 'withdrawn'].includes(r.status), 'INVALID_STATE', '仅正式报告可创建修订');
  return json(
    await c.db.create(
      'publication',
      'report',
      {
        ...r.data,
        report_id: r.data.report_id ?? r.id,
        revision: Number(r.data.revision) + 1,
        supersedes_id: r.id,
        revision_reason: text(i, 'reason'),
        published_at: null,
        published_by: null,
        withdrawn_at: null,
        withdrawal_reason: null,
      },
      'draft',
    ),
  );
};
export function reportMarkdown(r: RecordRow, origin: string) {
  const lines = [
    `# ${r.data.title}`,
    `状态：${r.status} · 版本：${r.data.revision} · 报告ID：${r.id}`,
    `周期：[${r.data.period_start}, ${r.data.period_end})`,
    `数据截止：${r.data.cutoff}`,
    `状态核验：${origin}/reports/${r.id}`,
    '',
    String(r.data.summary),
    '',
  ];
  for (const item of records(r.data, 'items')) {
    lines.push(`## ${item.name}`, String(item.reason), String(item.summary));
    for (const s of records(item, 'snapshots')) {
      const change = object(s, 'change');
      lines.push(
        `- 快照 ${s.id} / v${s.version} · 截止 ${s.snapshot_time}`,
        `  等级：${s.risk_level ?? '待判断'}；阶段：${s.risk_stage}；方向：${change.trend}；持续性变化：${change.persistence_change}`,
        `  持续性：${s.persistence_outlook}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
export const publicationCommands: Record<string, CommandHandler> = {
  'publication.generate': generate,
  'publication.edit': edit,
  'publication.submit': submit,
  'publication.publish': publish,
  'publication.withdraw': withdraw,
  'publication.revise': revise,
};

export const publicationReview = (
  c: import('../../platform/core/types.js').Context,
  id: string,
  version: number,
  decision: string,
  reason: string,
) => returnOrReject(c, 'publication', id, version, decision, reason, ['report'], ['submitted']);
