import { type Data, type Schema, type RecordRow } from './api';

const t = (title: string, extra: Partial<Schema> = {}): Schema => ({ type: 'string', title, ...extra });
const b = (title: string): Schema => ({ type: 'boolean', title });
const a = (title: string): Schema => ({ type: 'array', title });
const o = (title: string): Schema => ({ type: 'object', title });
const choice = (title: string, values: string[]) => t(title, { enum: values });
export interface DataFields {
  properties: Record<string, Schema>;
  required: string[];
}
const fields = (properties: Record<string, Schema>, required = Object.keys(properties)): DataFields => ({
  properties,
  required,
});

export function dataFields(command: string, kind: string): DataFields | undefined {
  if (command === 'reference.save') {
    const common = { name: t('名称'), code: t('唯一编码') };
    if (kind === 'target')
      return fields({
        ...common,
        type: choice('对象类型', [
          'economy',
          'macro_institution',
          'financial_system',
          'financial_market',
          'economic_sector',
        ]),
        jurisdiction: t('所属区域'),
        scope: t('边界与范围'),
      });
    if (kind === 'variable')
      return fields({ ...common, definition: t('变量定义'), boundary: t('适用边界'), unit: t('计量单位') });
    if (kind === 'risk_source')
      return fields({
        ...common,
        definition: t('致险类别定义'),
        analysis_level: choice('分析层次', ['macro', 'meso', 'micro']),
      });
    if (kind === 'dimension') return fields({ ...common, definition: t('风险类型定义') });
    if (kind === 'prompt') return fields({ ...common, purpose: t('分析用途'), content: t('模板正文') });
    if (kind === 'model') return fields({ ...common, provider: t('供应商'), model_id: t('实际模型 ID') });
    if (kind === 'market') return fields({ ...common, target_id: t('对应观察对象') });
    if (kind === 'rule')
      return fields(
        {
          ...common,
          category: choice('规则类别', ['m', 'risk_level', 'weakening', 'freshness']),
          definition: t('规则说明'),
          scope: t('适用范围'),
          weights: a('M 评分权重'),
          levels: a('风险等级及顺序'),
          confirmation_criteria: t('减弱节点确认条件'),
          calibration_evidence: t('校准证据'),
        },
        ['name', 'code', 'category', 'definition', 'scope'],
      );
  }
  if (command === 'information.source')
    return fields({
      name: t('来源名称'),
      code: t('唯一编码'),
      url: t('来源主页'),
      category: t('来源类别'),
      scope: t('内容范围'),
    });
  if (command === 'information.event')
    return fields(
      {
        information_id: t('原文依据'),
        title: t('事件标题'),
        subject: t('主体'),
        action: t('行为'),
        time_semantics: t('发生或计划时间的含义'),
        status: choice('事件阶段', [
          'expected',
          'announced',
          'in_progress',
          'effective',
          'completed',
          'cancelled',
          'unknown',
        ]),
        increment_type: choice('更新类型', [
          'NEW_EVENT',
          'EVENT_PROGRESS',
          'MATERIAL_ADDITION',
          'CORRECTION',
          'SOURCE_ADDITION',
          'DUPLICATE',
          'UNRESOLVED',
        ]),
        quote: t('原文引句（必须与原文一致）'),
        summary: t('事件摘要'),
        event_id: t('既有事件（非新事件时填写）'),
        targets: a('对象与变量关系'),
      },
      ['information_id', 'title', 'subject', 'action', 'time_semantics', 'status', 'increment_type', 'quote'],
    );
  if (command === 'registry.candidate')
    return fields({
      name: t('风险名称'),
      event_id: t('事件依据'),
      definition: t('完整风险定义'),
      observation_target_id: t('观察对象'),
      scope_boundary: t('风险范围与边界'),
      mechanism_summary: t('因果机制'),
      dimension_code: t('风险类型代码'),
      risk_source_codes: a('风险源代码'),
      damage_targets: a('潜在损害对象'),
      key_variables: a('关键变量与作用机制'),
    });
  if (command === 'identity.user')
    return fields(
      {
        name: t('显示名称'),
        username: t('登录名'),
        roles: a('角色权限'),
        evidence_access: b('允许阅读原文'),
        active: b('启用账号'),
      },
      ['name', 'username', 'roles', 'evidence_access'],
    );
  if (command === 'observations.indicator')
    return fields({
      name: t('指标名称'),
      code: t('唯一编码'),
      unit: t('计量单位'),
      frequency: t('采样频率'),
      target_id: t('观察对象'),
      time_basis: t('时间口径'),
    });
  if (command === 'observations.mapping')
    return fields({
      variable_id: t('全局变量'),
      indicator_id: t('指标'),
      scope: t('适用范围'),
      explanation: t('映射依据'),
    });
  if (command === 'information.rate')
    return fields(
      {
        assessment_scope: t('评价范围'),
        horizon: t('作用时段'),
        explanation: t('判断依据'),
        rule_id: t('已批准的 M 规则（可选）'),
        dimensions: a('评分维度'),
      },
      ['assessment_scope', 'horizon', 'explanation'],
    );
  if (command === 'publication.edit') return fields({ title: t('报告标题'), summary: t('报告总述') });
  if (command === 'operations.schedule')
    return fields({
      name: t('计划名称'),
      type: choice('任务类型', ['collect', 'analysis', 'report']),
      timezone: t('业务时区'),
      interval_minutes: { type: 'integer', title: '间隔分钟', minimum: 1 },
      next_at: t('下次执行时间', { format: 'date-time' }),
      input: o('执行输入'),
    });
  if (command === 'operations.assign')
    return fields({
      domain: choice('所属领域', [
        'reference',
        'information',
        'registry',
        'analysis',
        'publication',
        'operations',
      ]),
      object_id: t('待办对象 ID'),
      assignee_id: t('处理人 ID'),
    });
  if (command === 'operations.review')
    return fields({
      domain: choice('所属领域', ['reference', 'information', 'registry', 'analysis', 'publication']),
      object_id: t('待复核对象 ID'),
      expected_version: { type: 'integer', title: '待复核记录版本', minimum: 1 },
      decision: choice('复核决定', ['return', 'reject']),
    });
  return undefined;
}

export const referenceKinds = [
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
export function enumFor(command: string, key: string): string[] | undefined {
  if (key === 'kind') return referenceKinds;
  if (key === 'status') {
    if (command === 'information.source_status') return ['active', 'disabled'];
    if (command === 'registry.tracking') return ['observing', 'monitoring', 'paused', 'closed'];
    if (command === 'operations.feedback') return ['in_progress', 'handled', 'declined'];
  }
  if (key === 'decision') {
    if (command === 'registry.match') return ['new', 'reuse', 'unresolved', 'no_risk'];
    if (command === 'reference.resolve_variable') return ['reuse', 'create', 'reject'];
    if (command === 'operations.issue') return ['acknowledge', 'resolve'];
  }
  return undefined;
}

export function sampleFor(command: string, field: string, lists: Record<string, RecordRow[]>): unknown {
  const first = (key: string) =>
    lists[key]?.find((row) => ['active', 'approved', 'valid'].includes(row.status)) ?? lists[key]?.[0];
  if (field === 'targets')
    return [
      {
        target_id: first('target')?.id ?? '',
        variable_ids: first('variable') ? [first('variable')!.id] : [],
      },
    ];
  if (field === 'damage_targets') return ['请填写潜在损害对象'];
  if (field === 'risk_source_codes') return first('risk_source') ? [first('risk_source')!.data.code] : [];
  if (field === 'key_variables')
    return [
      {
        variable_id: first('variable')?.id ?? '',
        name: first('variable')?.data.name ?? '',
        role: 'risk_driver',
        impact_mechanism: '请说明变量如何改变风险',
        risk_source_code: first('risk_source')?.data.code ?? '',
      },
    ];
  if (field === 'weights') return [{ code: 'financial_significance', weight: 1 }];
  if (field === 'levels')
    return [
      {
        code: 'review_required',
        order: 1,
        description: '请根据已确认的业务规则填写，不能将示例直接作为生产标准',
      },
    ];
  if (field === 'dimensions') return [{ code: 'financial_significance', value: 0 }];
  if (field === 'rows')
    return [
      {
        indicator_id: first('indicator')?.id ?? '',
        source_id: first('source')?.id ?? '',
        unit: first('indicator')?.data.unit ?? '',
        period: '填写实际观测期',
        published_at: new Date().toISOString(),
        value: null,
        external_key: '填写来源记录的唯一编号',
      },
    ];
  if (command === 'information.correct')
    return { information_id: first('information')?.id ?? '', quote: '', title: '', summary: '' };
  if (command === 'information.grouping')
    return { proposal: 'merge', target_event_id: first('event')?.id ?? '', explanation: '' };
  if (command === 'analysis.feedback') return { title: '', description: '', next_observation: '' };
  if (command === 'reference.resolve_variable')
    return { name: '', code: '', definition: '', boundary: '', unit: '' };
  return {};
}

export function initialInput(command: string, schema: Schema, record?: RecordRow, defaults: Data = {}): Data {
  const input: Data = {};
  if (record) {
    if (schema.properties?.id) input.id = record.id;
    if (schema.properties?.expected_version) input.expected_version = record.version;
    if (command === 'reference.save') {
      input.kind = record.kind;
      input.data = record.data;
    }
    if (command === 'identity.user') input.data = { ...record.data, active: record.status === 'active' };
    if (command === 'publication.edit')
      input.data = { title: record.data.title ?? '', summary: record.data.summary ?? '' };
    if (command === 'registry.revise')
      input.data = Object.fromEntries(
        Object.entries(record.data).filter(([key]) =>
          [
            'name',
            'definition',
            'observation_target_id',
            'scope_boundary',
            'damage_targets',
            'mechanism_summary',
            'key_variables',
          ].includes(key),
        ),
      );
    if (command === 'information.correct')
      input.data = Object.fromEntries(
        Object.entries(record.data).filter(([key]) =>
          [
            'title',
            'subject',
            'action',
            'time_semantics',
            'event_time',
            'summary',
            'information_id',
            'quote',
          ].includes(key),
        ),
      );
    if (command === 'analysis.draft') {
      input.task_id = record.data.task_id ?? record.id;
      if (record.kind === 'snapshot') input.data = record.data;
      else {
        delete input.id;
        delete input.expected_version;
      }
    }
    if (command === 'information.extract') input.information_id = record.id;
    if (command === 'registry.identify' || command === 'information.rate') input.event_id = record.id;
    if (['analysis.start', 'registry.relate', 'analysis.feedback'].includes(command))
      input.risk_id = record.id;
    if (command === 'operations.schedule') input.data = record.data;
    if (command === 'operations.schedule_status') input.enabled = record.status !== 'enabled';
  }
  if (command === 'reference.save') input.kind ??= 'target';
  if (command === 'information.ingest') input.published_at = null;
  if (command === 'analysis.start') input.snapshot_time = new Date().toISOString();
  if (command === 'identity.user') input.data ??= { roles: ['reader'], evidence_access: false, active: true };
  if (command === 'publication.generate') {
    const now = new Date(),
      start = new Date(now);
    start.setHours(0, 0, 0, 0);
    input.type = 'daily';
    input.period_start = start.toISOString();
    input.period_end = now.toISOString();
    input.cutoff = now.toISOString();
  }
  if (command === 'operations.schedule')
    input.data ??= {
      timezone: 'Asia/Shanghai',
      interval_minutes: 60,
      next_at: new Date().toISOString(),
      input: {},
    };
  return { ...input, ...defaults };
}
