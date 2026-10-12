import { returnOrReject } from '../../platform/core/review.js';
import { taskCommitGate, finishTask } from '../../platform/core/task-commit.js';
import {
  active,
  ensure,
  expected,
  object,
  permit,
  records,
  strings,
  text,
  type CommandHandler,
  type Context,
  type Data,
  type RecordRow,
} from '../../platform/core/types.js';
const json = (x: unknown) => JSON.parse(JSON.stringify(x));
const roles = ['risk_driver', 'risk_transmission', 'risk_buffer', 'damage_verification'];
function identity(d: Data) {
  return [d.definition, d.observation_target_id, d.scope_boundary]
    .map((x) => String(x).trim().replace(/\s+/g, ' '))
    .join('|');
}
async function candidateValid(c: Context, d: Data, formal = false) {
  for (const key of [
    'name',
    'definition',
    'observation_target_id',
    'scope_boundary',
    'mechanism_summary',
    'dimension_code',
  ])
    text(d, key);
  const target = await c.db.get('reference', text(d, 'observation_target_id'));
  active(target);
  ensure(
    target.kind === 'target' &&
      ['economy', 'macro_institution', 'financial_system', 'financial_market'].includes(
        text(target.data, 'type'),
      ),
    'INVALID_OBSERVATION_TARGET',
    'L1 只纳管四类宏观观察对象',
  );
  strings(d, 'damage_targets');
  const event = await c.db.get('information', text(d, 'event_id'));
  ensure(event.kind === 'event', 'INVALID_REFERENCE', '候选必须有有效事件依据');
  if (d.event_update_id) {
    const update = await c.db.get('information', text(d, 'event_update_id'));
    ensure(
      update.kind === 'event_update' && update.data.event_id === event.id,
      'UPDATE_MISMATCH',
      '更新不属于候选依据事件',
    );
  }
  const configs = await c.db.list('reference', 'dimension');
  ensure(
    configs.some((x) => x.status === 'approved' && x.data.code === d.dimension_code),
    'INVALID_DIMENSION',
    '风险维度代码无效',
  );
  const sources = await c.db.list('reference', 'risk_source');
  for (const code of strings(d, 'risk_source_codes'))
    ensure(
      sources.some(
        (x) => x.status === 'approved' && x.data.code === code && x.data.analysis_level === 'macro',
      ),
      'INVALID_RISK_SOURCE',
      '风险源代码不存在或非宏观',
    );
  const vars = records(d, 'key_variables');
  for (const v of vars) {
    text(v, 'name');
    text(v, 'impact_mechanism');
    ensure(roles.includes(text(v, 'role')), 'INVALID_ROLE', '变量角色无效');
    if (typeof v.variable_id === 'string' && v.variable_id) {
      const variable = await c.db.get('reference', v.variable_id);
      ensure(variable.kind === 'variable', 'INVALID_VARIABLE', '变量 ID 无效');
      active(variable);
    } else ensure(!formal, 'UNCONFIRMED_VARIABLE', '正式纳管前必须确认变量');
  }
  if (formal) ensure(vars.length > 0, 'NO_EXECUTABLE_VARIABLE', '至少一项已确认且可沿事件观察的变量');
  ensure(!('risk_id' in d), 'CANDIDATE_HAS_ID', '候选不能预先分配正式 risk_id');
}
const identify: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const e = await c.db.get('information', text(i, 'event_id'));
  ensure(e.kind === 'event', 'INVALID_REFERENCE', '事件不存在');
  if (i.event_update_id) {
    const u = await c.db.get('information', text(i, 'event_update_id'));
    ensure(u.data.event_id === e.id, 'UPDATE_MISMATCH', '更新不属于该事件');
  }
  return json(
    await c.enqueue('identify', {
      event_id: e.id,
      event_version: e.version,
      event_data: e.data,
      event_update_id: i.event_update_id ?? e.data.latest_update_id ?? null,
      reason: i.reason ?? null,
    }),
  );
};
const candidate: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const d = object(i, 'data');
  await candidateValid(c, d);
  const task = i.task_id ? await taskCommitGate(c, text(i, 'task_id'), 'identify') : undefined;
  if (task)
    ensure(
      object(task.data, 'input').event_id === d.event_id,
      'TASK_INPUT_MISMATCH',
      '候选依据事件与任务输入不一致',
    );
  return json(
    await c.db.create(
      'registry',
      'candidate',
      {
        ...d,
        task_id: i.task_id ?? null,
        task_generation: task?.data.generation ?? null,
        match_decision: 'pending',
        created_by: c.actor.id,
      },
      'draft',
    ),
  );
};
const match: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('registry', text(i, 'id'), true);
  ensure(r.kind === 'candidate' && r.status === 'draft', 'INVALID_STATE', '候选已处理');
  const decision = text(i, 'decision');
  ensure(['new', 'reuse', 'unresolved', 'no_risk'].includes(decision), 'INVALID_DECISION', '匹配决定无效');
  let target: RecordRow | undefined;
  if (decision === 'reuse') {
    target = await c.db.get('registry', text(i, 'target_id'));
    ensure(target.kind === 'risk', 'INVALID_REFERENCE', '风险不存在');
    ensure(target.data.tracking_status !== 'closed', 'RESTORE_REVIEW_REQUIRED', '关闭风险需先执行恢复审核');
  }
  return json(
    await c.db.update(
      'registry',
      r.id,
      expected(i),
      {
        ...r.data,
        match_decision: decision,
        matched_risk_id: target?.id ?? null,
        match_reason: text(i, 'reason'),
      },
      decision === 'no_risk' ? 'resolved' : 'draft',
    ),
  );
};
const admit: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('registry', text(i, 'id'), true);
  ensure(r.kind === 'candidate', 'INVALID_REFERENCE', '不是风险候选');
  if (r.status === 'admitted') return json(await c.db.get('registry', text(r.data, 'admitted_risk_id')));
  ensure(r.version === expected(i), 'VERSION_CONFLICT', '候选已经变化', 409);
  ensure(
    ['new', 'reuse'].includes(text(r.data, 'match_decision')),
    'MATCH_REQUIRED',
    '先完整复核同一性再纳管',
  );
  await candidateValid(c, r.data, true);
  const task = r.data.task_id
    ? await taskCommitGate(c, text(r.data, 'task_id'), 'identify', Number(r.data.task_generation))
    : undefined;
  let risk: RecordRow | undefined;
  if (r.data.match_decision === 'reuse') {
    risk = await c.db.get('registry', text(r.data, 'matched_risk_id'));
    ensure(risk.data.tracking_status !== 'closed', 'RESTORE_REVIEW_REQUIRED', '关闭风险需先执行恢复审核');
  } else {
    const duplicate = (await c.db.list('registry', 'risk')).find(
      (x) => identity(x.data) === identity(r.data),
    );
    ensure(!duplicate, 'RISK_ALREADY_EXISTS', `相同定义与范围已纳管：${duplicate?.id ?? ''}`, 409);
    const srcs = await c.db.list('reference', 'risk_source'),
      dims = await c.db.list('reference', 'dimension');
    const vars = records(r.data, 'key_variables').map((v, n) => ({
      ...v,
      relation_id: `${r.id}:${n + 1}`,
      risk_source_id:
        srcs.find((s) => s.data.code === v.risk_source_code)?.id ??
        srcs.find((s) => strings(r.data, 'risk_source_codes').includes(String(s.data.code)))?.id ??
        null,
    }));
    risk = await c.db.create(
      'registry',
      'risk',
      {
        name: r.data.name!,
        definition: r.data.definition!,
        observation_target_id: r.data.observation_target_id!,
        scope_boundary: r.data.scope_boundary!,
        damage_targets: r.data.damage_targets!,
        mechanism_summary: r.data.mechanism_summary!,
        risk_dimension_ids: dims.filter((x) => x.data.code === r.data.dimension_code).map((x) => x.id),
        risk_source_ids: srcs
          .filter((x) => strings(r.data, 'risk_source_codes').includes(String(x.data.code)))
          .map((x) => x.id),
        key_variables: vars,
        tracking_status: 'observing',
        admitted_at: c.now,
        definition_version: 1,
        candidate_id: r.id,
      },
      'active',
    );
  }
  const event = await c.db.get('information', text(r.data, 'event_id'));
  await c.db.relate(
    risk.id,
    event.id,
    typeof r.data.event_update_id === 'string'
      ? r.data.event_update_id
      : typeof event.data.latest_update_id === 'string'
        ? event.data.latest_update_id
        : null,
    text(i, 'reason'),
  );
  await c.db.update(
    'registry',
    r.id,
    r.version,
    { ...r.data, admitted_risk_id: risk.id, admitted_at: c.now },
    'admitted',
  );
  if (task) await finishTask(c, task, risk.id);
  await c.db.emit('registry.risk-admitted', risk.id, {
    risk_id: risk.id,
    definition_version: risk.data.definition_version!,
  });
  return json(risk);
};
const revise: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('registry', text(i, 'id'), true);
  ensure(r.kind === 'risk', 'INVALID_REFERENCE', '风险不存在');
  const d = object(i, 'data');
  for (const k of Object.keys(d))
    ensure(
      [
        'name',
        'definition',
        'observation_target_id',
        'scope_boundary',
        'damage_targets',
        'mechanism_summary',
        'key_variables',
      ].includes(k),
      'PROTECTED_FIELD',
      '不允许修改系统身份、纳管时间与状态字段',
    );
  for (const k of ['definition', 'observation_target_id', 'scope_boundary'])
    ensure(
      !(k in d) || d[k] === r.data[k],
      'IDENTITY_REVIEW_REQUIRED',
      '核心定义/观察对象/范围变化必须重新执行同一性审查',
    );
  if (d.key_variables) {
    for (const v of records(d, 'key_variables')) {
      active(await c.db.get('reference', text(v, 'variable_id')));
      ensure(roles.includes(text(v, 'role')), 'INVALID_ROLE', '变量角色无效');
      text(v, 'impact_mechanism');
      text(v, 'relation_id');
    }
    ensure(records(d, 'key_variables').length > 0, 'NO_EXECUTABLE_VARIABLE', '不能清空观察条件');
  }
  const out = await c.db.update('registry', r.id, expected(i), {
    ...r.data,
    ...d,
    admitted_at: r.data.admitted_at!,
    tracking_status: r.data.tracking_status!,
    definition_version: Number(r.data.definition_version) + 1,
    change_reason: text(i, 'reason'),
  });
  await c.db.emit('registry.definition-changed', r.id, { version: out.data.definition_version! });
  return json(out);
};
const relate: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const risk = await c.db.get('registry', text(i, 'risk_id'));
  ensure(risk.kind === 'risk', 'INVALID_REFERENCE', '风险不存在');
  const e = await c.db.get('information', text(i, 'event_id'));
  ensure(e.kind === 'event', 'INVALID_REFERENCE', '事件不存在');
  let update: string | null = null;
  if (i.event_update_id) {
    const u = await c.db.get('information', text(i, 'event_update_id'));
    ensure(u.kind === 'event_update' && u.data.event_id === e.id, 'UPDATE_MISMATCH', '更新不属于事件');
    update = u.id;
  }
  return await c.db.relate(risk.id, e.id, update, text(i, 'reason'));
};
const tracking: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('registry', text(i, 'id'), true);
  ensure(r.kind === 'risk', 'INVALID_REFERENCE', '风险不存在');
  const status = text(i, 'status');
  ensure(['observing', 'monitoring', 'paused', 'closed'].includes(status), 'INVALID_STATE', '跟踪状态无效');
  if (['observing', 'monitoring'].includes(status)) {
    ensure(records(r.data, 'key_variables').length > 0, 'NO_EXECUTABLE_VARIABLE', '恢复前需可执行观察配置');
  }
  const out = await c.db.update('registry', r.id, expected(i), {
    ...r.data,
    tracking_status: status,
    tracking_reason: text(i, 'reason'),
    restored_at: r.data.tracking_status === 'closed' ? c.now : (r.data.restored_at ?? null),
  });
  await c.db.emit('registry.tracking-changed', r.id, { status });
  return json(out);
};
export const registryCommands: Record<string, CommandHandler> = {
  'registry.identify': identify,
  'registry.candidate': candidate,
  'registry.match': match,
  'registry.admit': admit,
  'registry.revise': revise,
  'registry.relate': relate,
  'registry.tracking': tracking,
};

export const registryReview = (
  c: import('../../platform/core/types.js').Context,
  id: string,
  version: number,
  decision: string,
  reason: string,
) => returnOrReject(c, 'registry', id, version, decision, reason, ['candidate'], ['draft']);
