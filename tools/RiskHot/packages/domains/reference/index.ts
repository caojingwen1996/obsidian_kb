import { returnOrReject } from '../../platform/core/review.js';
import {
  active,
  array,
  ensure,
  expected,
  object,
  permit,
  records,
  text,
  type CommandHandler,
  type Context,
  type Data,
  type RecordRow,
} from '../../platform/core/types.js';
const kinds = [
  'target',
  'variable',
  'risk_source',
  'dimension',
  'rule',
  'prompt',
  'model',
  'market',
  'variable_candidate',
];
const targetTypes = [
  'economy',
  'macro_institution',
  'financial_system',
  'financial_market',
  'economic_sector',
];
export async function validateConfig(ctx: Context, kind: string, d: Data, id?: string) {
  ensure(kinds.includes(kind), 'INVALID_KIND', '不支持的配置类型');
  text(d, 'name');
  text(d, 'code');
  const same = (await ctx.db.list('reference', kind)).find((r) => r.id !== id && r.data.code === d.code);
  ensure(!same, 'CODE_CONFLICT', '该类型下编码已存在', 409);
  if (kind === 'target') {
    ensure(targetTypes.includes(text(d, 'type')), 'INVALID_TARGET', '首版事件的观测主体只允许五类宏观类型');
    text(d, 'jurisdiction');
    text(d, 'scope');
  }
  if (kind === 'variable') {
    text(d, 'definition');
    text(d, 'boundary');
    text(d, 'unit');
  }
  if (kind === 'risk_source') {
    text(d, 'definition');
    ensure(['macro', 'meso', 'micro'].includes(text(d, 'analysis_level')), 'INVALID_LEVEL', '分析层次无效');
  }
  if (kind === 'dimension') text(d, 'definition');
  if (d.parent_id) {
    let next = text(d, 'parent_id');
    const seen = new Set<string>(id ? [id] : []);
    while (next) {
      ensure(!seen.has(next), 'PARENT_CYCLE', '父级关系不能循环');
      seen.add(next);
      const parent = await ctx.db.get('reference', next);
      ensure(parent.kind === kind, 'PARENT_KIND', '父级类型不同');
      if (kind === 'risk_source')
        ensure(parent.data.analysis_level === d.analysis_level, 'PARENT_LEVEL', '父级分析层次不同');
      next = typeof parent.data.parent_id === 'string' ? parent.data.parent_id : '';
    }
  }
  if (kind === 'rule') {
    ensure(
      ['m', 'risk_level', 'weakening', 'freshness'].includes(text(d, 'category')),
      'INVALID_RULE',
      '规则类型无效',
    );
    text(d, 'definition');
    text(d, 'scope');
    if (d.category === 'm') {
      const weights = records(d, 'weights');
      ensure(
        weights.length > 0 && weights.every((w) => typeof w.weight === 'number' && w.weight >= 0),
        'INVALID_WEIGHTS',
        '权重必须非负',
      );
      ensure(
        Math.abs(weights.reduce((a, w) => a + Number(w.weight), 0) - 1) < 1e-6,
        'INVALID_WEIGHTS',
        '权重总和必须为1',
      );
    }
    if (d.category === 'risk_level') {
      const levels = records(d, 'levels');
      ensure(levels.length > 0, 'INVALID_LEVELS', '至少配置一个等级');
      ensure(
        new Set(levels.map((l) => text(l, 'code'))).size === levels.length,
        'DUPLICATE_LEVEL',
        '等级编码重复',
      );
      for (const l of levels) ensure(typeof l.order === 'number', 'INVALID_LEVELS', '等级需严重度顺序');
    }
    if (d.category === 'weakening') {
      text(d, 'confirmation_criteria');
      text(d, 'calibration_evidence');
    }
  }
  if (kind === 'prompt') {
    text(d, 'content');
    text(d, 'purpose');
  }
  if (kind === 'model') {
    text(d, 'provider');
    text(d, 'model_id');
    ensure(
      !Object.keys(d).some((k) => /key|token|password|secret/i.test(k)),
      'SECRET_FIELD',
      '配置不得保存模型凭据',
    );
  }
  if (kind === 'market') {
    text(d, 'target_id');
    const target = await ctx.db.get('reference', text(d, 'target_id'));
    active(target);
  }
}
const save: CommandHandler = async (ctx, i) => {
  permit(ctx, 'researcher', 'reviewer');
  const kind = text(i, 'kind'),
    data = object(i, 'data');
  await validateConfig(ctx, kind, data, typeof i.id === 'string' ? i.id : undefined);
  if (i.id) {
    const old = await ctx.db.get('reference', text(i, 'id'), true);
    ensure(old.status === 'draft', 'IMMUTABLE_VERSION', '已生效版本不可直接编辑，请创建新代码版本或修订申请');
    return asJson(await ctx.db.update('reference', old.id, expected(i), data));
  }
  return asJson(await ctx.db.create('reference', kind, data));
};
export function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as import('../../platform/core/types.js').Json;
}
const approve: CommandHandler = async (ctx, i) => {
  permit(ctx, 'reviewer');
  const r = await ctx.db.get('reference', text(i, 'id'), true);
  ensure(r.status === 'draft', 'INVALID_STATE', '只能批准草稿');
  await validateConfig(ctx, r.kind, r.data, r.id);
  const result = await ctx.db.update(
    'reference',
    r.id,
    expected(i),
    { ...r.data, approved_by: ctx.actor.id, approved_at: ctx.now, approval_reason: text(i, 'reason') },
    'approved',
  );
  await ctx.db.emit('reference.approved', r.id, { version: result.version });
  return asJson(result);
};
const disable: CommandHandler = async (ctx, i) => {
  permit(ctx, 'reviewer');
  const r = await ctx.db.get('reference', text(i, 'id'), true);
  active(r);
  return asJson(
    await ctx.db.update(
      'reference',
      r.id,
      expected(i),
      { ...r.data, disabled_reason: text(i, 'reason') },
      'disabled',
    ),
  );
};
const resolve: CommandHandler = async (ctx, i) => {
  permit(ctx, 'reviewer');
  const r = await ctx.db.get('reference', text(i, 'id'), true);
  ensure(r.kind === 'variable_candidate' && r.status === 'draft', 'INVALID_STATE', '变量候选已处理');
  const decision = text(i, 'decision');
  let variable: RecordRow | undefined;
  if (decision === 'reuse') {
    variable = await ctx.db.get('reference', text(i, 'target_id'));
    ensure(variable.kind === 'variable', 'INVALID_REFERENCE', '必须选择变量');
    active(variable);
  } else if (decision === 'create') {
    const d = object(i, 'data');
    await validateConfig(ctx, 'variable', d);
    variable = await ctx.db.create('reference', 'variable', { ...d, approved_by: ctx.actor.id }, 'approved');
  } else ensure(decision === 'reject', 'INVALID_DECISION', '选择复用、新增或驳回');
  return asJson(
    await ctx.db.update(
      'reference',
      r.id,
      expected(i),
      { ...r.data, resolution: decision, variable_id: variable?.id ?? null, reason: text(i, 'reason') },
      'resolved',
    ),
  );
};
export const referenceCommands: Record<string, CommandHandler> = {
  'reference.save': save,
  'reference.approve': approve,
  'reference.disable': disable,
  'reference.resolve_variable': resolve,
};

export const referenceReview = (
  c: import('../../platform/core/types.js').Context,
  id: string,
  version: number,
  decision: string,
  reason: string,
) =>
  returnOrReject(
    c,
    'reference',
    id,
    version,
    decision,
    reason,
    [
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
    ['draft', 'pending'],
  );
