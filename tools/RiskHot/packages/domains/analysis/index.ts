import { returnOrReject } from '../../platform/core/review.js';
import {
  active,
  array,
  ensure,
  expected,
  iso,
  object,
  permit,
  records,
  strings,
  text,
  type CommandHandler,
  type Context,
  type Data,
  type Json,
  type RecordRow,
} from '../../platform/core/types.js';
const json = (x: unknown) => JSON.parse(JSON.stringify(x));
export async function prepareObservation(c: Context, i: Data): Promise<Data> {
  const risk = await c.db.get('registry', text(i, 'risk_id'));
  ensure(risk.kind === 'risk', 'INVALID_REFERENCE', '风险不存在');
  const cutoff = iso(text(i, 'snapshot_time'));
  ensure(cutoff <= c.now, 'FUTURE_CUTOFF', '观察截止时间不能在未来');
  if (!['observing', 'monitoring'].includes(String(risk.data.tracking_status))) {
    permit(c, 'reviewer');
    ensure(i.allow_inactive === true, 'INACTIVE_RISK', '暂停/关闭风险仅允许审核员显式回溯观察');
    text(i, 'reason');
  }
  const hindsight = i.hindsight === true;
  if (hindsight) text(i, 'reason');
  else
    ensure(
      String(risk.data.admitted_at) <= cutoff,
      'RISK_NOT_YET_ADMITTED',
      '风险在截止时间尚未纳管；历史追溯须显式标记',
    );
  const histories = await c.db.history('registry', risk.id);
  const definition = hindsight
    ? risk
    : ([...histories].reverse().find((r) => r.updated_at <= cutoff) ?? risk);
  const snapshots = (await c.db.list('analysis', 'snapshot')).filter(
    (x) =>
      x.status === 'approved' &&
      x.data.risk_id === risk.id &&
      String(x.data.snapshot_time) < cutoff &&
      (hindsight || String(x.data.approved_at) <= cutoff),
  );
  let baseline: RecordRow | undefined;
  if (i.comparison_snapshot_id) {
    baseline = await c.db.get('analysis', text(i, 'comparison_snapshot_id'));
    ensure(
      baseline.kind === 'snapshot' &&
        baseline.status === 'approved' &&
        baseline.data.risk_id === risk.id &&
        String(baseline.data.snapshot_time) < cutoff &&
        (hindsight || String(baseline.data.approved_at) <= cutoff),
      'INVALID_BASELINE',
      '比较基准必须是同风险、更早且有效的快照',
    );
  } else
    baseline = snapshots
      .filter((x) => x.data.definition_version === definition.data.definition_version)
      .sort((a, b) => String(b.data.snapshot_time).localeCompare(String(a.data.snapshot_time)))[0];
  const relations = await c.db.relations(risk.id);
  const updates = await c.db.list('information', 'event_update');
  const evidence: Data[] = [];
  for (const rel of relations.filter((x) => x.is_active === true)) {
    for (const u of updates.filter((x) => x.data.event_id === rel.event_id)) {
      const info = await c.db.get('information', text(u.data, 'information_id'));
      const available = info.data.available_at;
      if (
        available &&
        (hindsight || String(available) <= cutoff) &&
        !evidence.some((x) => x.id === info.id)
      ) {
        evidence.push({
          id: info.id,
          version: info.version,
          kind: 'information',
          available_at: available,
          hindsight: String(available) > cutoff,
          content: info.data.content!,
          source_id: info.data.source_id!,
          event_id: rel.event_id!,
        });
      }
    }
  }
  for (const rel of relations.filter((x) => x.is_active === true)) {
    const event = await c.db.get('information', String(rel.event_id));
    for (const id of (event.data.source_refs ?? []) as string[]) {
      if (evidence.some((e) => e.id === id)) continue;
      const info = await c.db.get('information', id);
      const available = info.data.available_at;
      if (available && (hindsight || String(available) <= cutoff))
        evidence.push({
          id: info.id,
          version: info.version,
          kind: 'information',
          available_at: available,
          hindsight: String(available) > cutoff,
          content: info.data.content!,
          source_id: info.data.source_id!,
          event_id: event.id,
        });
    }
  }
  const vars = records(definition.data, 'key_variables');
  const mappings = (await c.db.list('observations', 'mapping')).filter((x) => x.status === 'approved');
  for (const v of vars) {
    for (const m of mappings.filter((x) => x.data.variable_id === v.variable_id)) {
      for (const value of (await c.db.list('observations', 'value')).filter(
        (x) =>
          x.data.indicator_id === m.data.indicator_id && (hindsight || String(x.data.available_at) <= cutoff),
      )) {
        if (!evidence.some((e) => e.id === value.id))
          evidence.push({
            id: value.id,
            version: value.version,
            kind: 'observation',
            ...value.data,
            hindsight: String(value.data.available_at) > cutoff,
          });
      }
    }
  }
  ensure(evidence.length > 0, 'EVIDENCE_MISSING', '截止时间内没有可定位证据，请补齐或显式追溯重算');
  const configs = (await c.db.list('reference', 'prompt')).filter((x) => x.status === 'approved');
  const models = (await c.db.list('reference', 'model')).filter((x) => x.status === 'approved');
  return {
    risk_id: risk.id,
    risk_record_version: risk.version,
    definition_version: definition.data.definition_version!,
    definition: definition.data,
    snapshot_time: cutoff,
    comparison_snapshot_id: baseline?.id ?? null,
    comparison_version: baseline?.version ?? null,
    comparison: baseline?.data ?? null,
    evidence,
    variables: vars,
    hindsight,
    reason: i.reason ?? null,
    allow_inactive: i.allow_inactive ?? false,
    created_by: c.actor.id,
    prompt_versions: configs.map((x) => ({ id: x.id, version: x.version, content: x.data.content ?? '' })),
    model_versions: models.map((x) => ({
      id: x.id,
      version: x.version,
      model_id: x.data.model_id!,
      provider: x.data.provider!,
    })),
    schema_version: '1.0.0',
    frozen_at: c.now,
  };
}
const start: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  return json(await c.enqueue('analysis', await prepareObservation(c, i)));
};
export function blankAnalysis(manifest: Data): Data {
  return {
    risk_level: null,
    risk_stage: 'undetermined',
    affected_scope: [],
    persistence_outlook: '待研究人员根据持续条件补充',
    status_summary: {
      source_pressure: '待判断',
      response_effect: '待验证',
      force_balance: 'undetermined',
      damage: '尚未证实',
      limitations: ['人工研究草稿，尚未完成核验'],
    },
    variable_analysis: records(manifest, 'variables').map((v) => ({
      relation_id: v.relation_id!,
      observed_state: '待判断',
      risk_effect: 'undetermined',
      source_refs: [],
      interpretation: '待补充',
      uncertainty: '证据及作用条件需人工核验',
    })),
    change: {
      comparison_snapshot_id: manifest.comparison_snapshot_id ?? null,
      trend: 'undetermined',
      persistence_change: 'undetermined',
      change_reason: '尚未完成比较',
      weakening_node_status: 'undetermined',
      next_observation: '待补充',
    },
    stages: {
      source: 'pending',
      buffer: 'pending',
      damage: 'pending',
      force: 'pending',
      current: 'pending',
      trend: 'pending',
      persistence: 'pending',
      node: 'pending',
    },
  };
}
export async function validateAnalysis(c: Context, d: Data, manifest: Data, complete: boolean) {
  ensure(
    !('realization_degree' in d || 'evidence_confidence' in d || 'persistence_status' in d),
    'REMOVED_FIELD',
    '不允许恢复旧状态维度',
  );
  ensure(
    ['accumulating', 'transmitting', 'realizing', 'repairing', 'mixed', 'undetermined'].includes(
      text(d, 'risk_stage'),
    ),
    'INVALID_STAGE',
    '阶段编码无效',
  );
  array(d, 'affected_scope');
  text(d, 'persistence_outlook');
  const summary = object(d, 'status_summary');
  for (const k of ['source_pressure', 'response_effect', 'force_balance', 'damage']) text(summary, k);
  strings(summary, 'limitations');
  const vars = records(manifest, 'variables'),
    analyses = records(d, 'variable_analysis');
  ensure(
    analyses.length === vars.length && new Set(analyses.map((x) => x.relation_id)).size === analyses.length,
    'VARIABLES_INCOMPLETE',
    '每个变量关系都必须有且仅有一条分析',
  );
  const evidence = records(manifest, 'evidence');
  for (const v of analyses) {
    ensure(
      vars.some((x) => x.relation_id === v.relation_id),
      'CROSS_RISK_RELATION',
      '变量关系不属于本轮风险',
    );
    text(v, 'observed_state');
    text(v, 'interpretation');
    text(v, 'uncertainty');
    ensure(
      ['pressure', 'relief', 'neutral', 'undetermined'].includes(text(v, 'risk_effect')),
      'INVALID_EFFECT',
      '风险作用编码无效',
    );
    const refs = strings(v, 'source_refs');
    for (const ref of refs)
      ensure(
        evidence.some((x) => x.id === ref),
        'INVALID_CITATION',
        '引用不在本轮固定证据包中',
      );
    if (v.risk_effect !== 'undetermined')
      ensure(refs.length > 0, 'EVIDENCE_REQUIRED', '明确风险作用必须有依据');
  }
  if (d.risk_level !== null) {
    ensure(typeof d.risk_level === 'string', 'INVALID_LEVEL', '风险等级必须为空或编码');
    const rule = await c.db.get('reference', text(d, 'rule_id'));
    active(rule);
    ensure(
      rule.kind === 'rule' && rule.data.category === 'risk_level',
      'INVALID_RULE',
      '风险等级必须使用已批准规则',
    );
    ensure(
      records(rule.data, 'levels').some((l) => l.code === d.risk_level),
      'INVALID_LEVEL',
      '等级不在规则中',
    );
    d.rule_version = rule.version;
  }
  const change = object(d, 'change');
  ensure(
    change.comparison_snapshot_id === manifest.comparison_snapshot_id,
    'BASELINE_DRIFT',
    '比较基准必须与运行清单一致',
  );
  ensure(
    ['aggravating', 'stable', 'easing', 'undetermined'].includes(text(change, 'trend')),
    'INVALID_TREND',
    '趋势无效',
  );
  ensure(
    ['lengthening', 'shortening', 'unchanged', 'undetermined'].includes(text(change, 'persistence_change')),
    'INVALID_PERSISTENCE',
    '持续性变化无效',
  );
  text(change, 'change_reason');
  text(change, 'next_observation');
  ensure(
    ['none', 'candidate', 'confirmed', 'undetermined'].includes(text(change, 'weakening_node_status')),
    'INVALID_NODE',
    '减弱节点状态无效',
  );
  if (!manifest.comparison_snapshot_id) {
    ensure(
      change.trend === 'undetermined' && change.persistence_change === 'undetermined',
      'NO_BASELINE',
      '首次观察变化必须待判断',
    );
    ensure(change.weakening_node_status !== 'confirmed', 'NO_BASELINE', '没有可比基准不能确认减弱节点');
  } else {
    const baseline = await c.db.get('analysis', String(manifest.comparison_snapshot_id));
    ensure(baseline.status === 'approved', 'BASELINE_WITHDRAWN', '基准已撤回');
    if (baseline.data.definition_version !== manifest.definition_version)
      ensure(
        change.trend === 'undetermined' && change.persistence_change === 'undetermined',
        'INCOMPARABLE',
        '定义版本不同，整体变化须待判断',
      );
  }
  if (change.weakening_node_status === 'confirmed') {
    const rule = await c.db.get('reference', text(d, 'weakening_rule_id'));
    active(rule);
    ensure(
      rule.kind === 'rule' && rule.data.category === 'weakening',
      'NODE_RULE_MISSING',
      '节点确认规则未批准',
    );
    text(d, 'node_verification');
  }
  if (complete) {
    const stages = object(d, 'stages');
    for (const name of ['source', 'buffer', 'damage', 'force', 'current', 'trend', 'persistence', 'node'])
      ensure(
        stages[name] === 'completed',
        'INCOMPLETE_ANALYSIS',
        `${name} 阶段未完成，不能把技术缺项当作待判断`,
      );
  }
}
const draft: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const task = await c.db.get('operations', text(i, 'task_id'), true);
  ensure(task.kind === 'task' && task.data.type === 'analysis', 'INVALID_TASK', '不是分析任务');
  ensure(!['cancelled', 'completed'].includes(task.status), 'TASK_TERMINAL', '任务已经结束');
  const manifest = object(task.data, 'input'),
    d = object(i, 'data');
  await validateAnalysis(c, d, manifest, false);
  const content = {
    ...d,
    risk_id: manifest.risk_id!,
    snapshot_time: manifest.snapshot_time!,
    definition_version: manifest.definition_version!,
    manifest,
    task_id: task.id,
    task_generation: task.data.generation!,
    rule_id: d.rule_id ?? null,
  };
  if (i.id) {
    const old = await c.db.get('analysis', text(i, 'id'), true);
    ensure(old.status === 'draft' && old.data.task_id === task.id, 'IMMUTABLE_RESULT', '只能编辑同任务草稿');
    return json(await c.db.update('analysis', old.id, expected(i), content));
  }
  const key = 'snapshot-draft:' + task.id;
  const old = await c.db.findClaim(key);
  if (old) return json(await c.db.get('analysis', old));
  const row = await c.db.create('analysis', 'snapshot', content);
  ensure(await c.db.claim(key, row.id), 'DUPLICATE_DRAFT', '同任务草稿已存在', 409);
  return json(row);
};
const submit: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const r = await c.db.get('analysis', text(i, 'id'), true);
  ensure(r.status === 'draft', 'INVALID_STATE', '只能提交草稿');
  await validateAnalysis(c, r.data, object(r.data, 'manifest'), true);
  return json(
    await c.db.update('analysis', r.id, expected(i), { ...r.data, submitted_at: c.now }, 'submitted'),
  );
};
const approve: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('analysis', text(i, 'id'), true);
  if (r.status === 'approved') return json(r);
  ensure(r.status === 'submitted', 'INVALID_STATE', '先提交分析审核');
  const manifest = object(r.data, 'manifest');
  await validateAnalysis(c, r.data, manifest, true);
  const task = await c.db.get('operations', text(r.data, 'task_id'), true);
  ensure(
    !['cancelled', 'failed', 'completed'].includes(task.status) &&
      task.data.commit_eligible === true &&
      task.data.generation === r.data.task_generation,
    'COMMIT_REVOKED',
    '执行资格已取消或代次失效',
  );
  const owner = await c.db.get('identity', text(task.data, 'owner_id'));
  ensure(
    owner.status === 'active' &&
      strings(owner.data, 'roles').some((role) => ['researcher', 'reviewer'].includes(role)),
    'COMMIT_REVOKED',
    '任务发起人权限已撤销',
  );
  const risk = await c.db.get('registry', text(r.data, 'risk_id'), true);
  ensure(
    risk.data.definition_version === r.data.definition_version,
    'DEFINITION_CHANGED',
    '风险定义已变化，需要重新分析',
  );
  ensure(
    ['observing', 'monitoring'].includes(String(risk.data.tracking_status)) ||
      manifest.allow_inactive === true,
    'TRACKING_CHANGED',
    '跟踪状态已变化，需要回溯许可',
  );
  const recent = (await c.db.list('analysis', 'snapshot')).filter(
    (x) =>
      x.status === 'approved' &&
      x.data.risk_id === risk.id &&
      String(x.data.snapshot_time) > String(r.data.snapshot_time),
  );
  if (recent.length)
    ensure(manifest.hindsight === true, 'STALE_RUN', '已有更新的正式观察，请显式执行追溯修订');
  const out = await c.db.update(
    'analysis',
    r.id,
    expected(i),
    { ...r.data, approved_at: c.now, approved_by: c.actor.id, approval_reason: text(i, 'reason') },
    'approved',
  );
  await c.db.update(
    'operations',
    task.id,
    task.version,
    {
      ...task.data,
      commit_eligible: false,
      approved_snapshot_id: r.id,
      progress: 100,
      stage: 'completed',
      completed_at: c.now,
    },
    'completed',
  );
  await c.db.emit('analysis.approved', r.id, { task_id: task.id, risk_id: risk.id, snapshot_id: r.id });
  return json(out);
};
const withdraw: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('analysis', text(i, 'id'), true);
  ensure(r.status === 'approved', 'INVALID_STATE', '仅正式分析可撤回');
  const out = await c.db.update(
    'analysis',
    r.id,
    expected(i),
    { ...r.data, withdrawn_at: c.now, withdrawal_reason: text(i, 'reason') },
    'withdrawn',
  );
  await c.db.emit('analysis.withdrawn', r.id, { snapshot_id: r.id });
  return json(out);
};
const revise: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const r = await c.db.get('analysis', text(i, 'id'));
  ensure(['approved', 'withdrawn'].includes(r.status), 'INVALID_STATE', '只有正式结果可创建修订');
  return json(
    await c.enqueue('analysis', {
      ...object(r.data, 'manifest'),
      supersedes_snapshot_id: r.id,
      reason: text(i, 'reason'),
      revision_of: r.id,
    }),
  );
};
const feedback: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const r = await c.db.get('registry', text(i, 'risk_id'));
  ensure(r.kind === 'risk', 'INVALID_REFERENCE', '风险不存在');
  return json(
    await c.db.create(
      'analysis',
      'feedback',
      { ...object(i, 'data'), risk_id: r.id, reason: text(i, 'reason'), created_by: c.actor.id },
      'pending',
    ),
  );
};
export const analysisCommands: Record<string, CommandHandler> = {
  'analysis.start': start,
  'analysis.draft': draft,
  'analysis.submit': submit,
  'analysis.approve': approve,
  'analysis.withdraw': withdraw,
  'analysis.revise': revise,
  'analysis.feedback': feedback,
};

export const analysisReview = (
  c: import('../../platform/core/types.js').Context,
  id: string,
  version: number,
  decision: string,
  reason: string,
) => returnOrReject(c, 'analysis', id, version, decision, reason, ['snapshot'], ['submitted']);
