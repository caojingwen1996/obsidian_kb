import { returnOrReject } from '../../platform/core/review.js';
import { taskCommitGate, finishTask } from '../../platform/core/task-commit.js';
import { createHash } from 'node:crypto';
import {
  active,
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
} from '../../platform/core/types.js';
const json = (x: unknown) => JSON.parse(JSON.stringify(x));
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const source: CommandHandler = async (c, i) => {
  permit(c, 'admin');
  const d = object(i, 'data');
  for (const k of ['name', 'code', 'url', 'category', 'scope']) text(d, k);
  ensure(
    !(await c.db.list('information', 'source')).some((x) => x.data.code === d.code),
    'CODE_CONFLICT',
    '信源编码已存在',
    409,
  );
  return json(await c.db.create('information', 'source', d));
};
const sourceStatus: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('information', text(i, 'id'), true);
  ensure(r.kind === 'source', 'INVALID_REFERENCE', '不是信源');
  ensure(['active', 'disabled'].includes(text(i, 'status')), 'INVALID_STATE', '信源状态无效');
  return json(
    await c.db.update(
      'information',
      r.id,
      expected(i),
      { ...r.data, reason: text(i, 'reason'), reviewer_id: c.actor.id },
      text(i, 'status'),
    ),
  );
};
const ingest: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer', 'admin');
  const src = await c.db.get('information', text(i, 'source_id'));
  ensure(src.kind === 'source', 'INVALID_REFERENCE', '来源类型错误');
  active(src);
  const content = text(i, 'content'),
    url = text(i, 'url');
  const pub = i.published_at === null ? null : iso(text(i, 'published_at'));
  ensure(!pub || pub <= c.now, 'FUTURE_PUBLICATION', '原文发布时间不能在未来');
  const digest = hash(content);
  const key = `information:${src.id}:${url}:${digest}`;
  const existing = await c.db.findClaim(key);
  if (existing) return json({ ...(await c.db.get('information', existing)), reused: true });
  const previous = (await c.db.list('information', 'information')).find(
    (x) => x.data.source_id === src.id && x.data.url === url,
  );
  const row = await c.db.create(
    'information',
    'information',
    {
      source_id: src.id,
      source_version: src.version,
      url,
      content,
      content_hash: digest,
      published_at: pub,
      first_obtained_at: c.now,
      available_at: pub ? c.now : null,
      supersedes_id: previous?.id ?? null,
      title: content.split('\n')[0]!.slice(0, 100),
    },
    'valid',
  );
  ensure(await c.db.claim(key, row.id), 'DUPLICATE_INPUT', '资料已登记', 409);
  await c.db.emit('information.ingested', row.id, { id: row.id });
  return json(row);
};
const extract: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const r = await c.db.get('information', text(i, 'information_id'));
  ensure(r.kind === 'information', 'INVALID_REFERENCE', '原文不存在');
  return json(
    await c.enqueue('extract', {
      information_id: r.id,
      information_version: r.version,
      content: r.data.content ?? '',
      source_id: r.data.source_id ?? null,
    }),
  );
};
async function citation(c: Context, id: string, quote: string) {
  const info = await c.db.get('information', id);
  ensure(info.kind === 'information', 'INVALID_REFERENCE', '引用必须为原文');
  ensure(text(info.data, 'content').includes(quote), 'INVALID_CITATION', '引用片段不在所选原文中');
  return info;
}
const event: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const d = object(i, 'data');
  const info = await citation(c, text(d, 'information_id'), text(d, 'quote'));
  for (const k of ['title', 'subject', 'action', 'time_semantics', 'status', 'increment_type']) text(d, k);
  ensure(
    ['expected', 'announced', 'in_progress', 'effective', 'completed', 'cancelled', 'unknown'].includes(
      text(d, 'status'),
    ),
    'INVALID_STATE',
    '事件阶段无效',
  );
  const task = i.task_id ? await taskCommitGate(c, text(i, 'task_id'), 'extract') : undefined;
  if (task)
    ensure(
      object(task.data, 'input').information_id === info.id,
      'TASK_INPUT_MISMATCH',
      '事件依据原文与任务输入不一致',
    );
  const increment = text(d, 'increment_type');
  ensure(
    [
      'NEW_EVENT',
      'EVENT_PROGRESS',
      'MATERIAL_ADDITION',
      'CORRECTION',
      'SOURCE_ADDITION',
      'DUPLICATE',
      'UNRESOLVED',
    ].includes(increment),
    'INVALID_INCREMENT',
    '增量类型无效',
  );
  if (increment === 'UNRESOLVED')
    return json(await c.db.create('information', 'grouping', { ...d, reason: '事件身份待复核' }, 'pending'));
  let e = typeof d.event_id === 'string' ? await c.db.get('information', d.event_id, true) : undefined;
  if (e) ensure(e.kind === 'event', 'INVALID_REFERENCE', '事件 ID 无效');
  else ensure(increment === 'NEW_EVENT', 'EVENT_REQUIRED', '非新事件必须选取既有事件');
  const triples = d.targets ? records(d, 'targets') : [];
  for (const t of triples) {
    const target = await c.db.get('reference', text(t, 'target_id'));
    ensure(target.kind === 'target', 'INVALID_TARGET', '对象必须来自对象库');
    active(target);
    t.target_version = target.version;
    for (const variableId of t.variable_ids ? strings(t, 'variable_ids') : []) {
      const v = await c.db.get('reference', variableId);
      ensure(v.kind === 'variable', 'INVALID_VARIABLE', '变量必须来自全局变量库');
      active(v);
    }
  }
  if (e && increment === 'DUPLICATE') {
    if (task) await finishTask(c, task, e.id);
    return json({ event: e, reused: true });
  }
  if (!e)
    e = await c.db.create(
      'information',
      'event',
      {
        title: d.title!,
        subject: d.subject!,
        action: d.action!,
        time_semantics: d.time_semantics!,
        event_time: d.event_time ?? null,
        phase: d.status!,
        targets: triples,
        source_refs: [info.id],
        summary: d.summary ?? d.quote!,
        latest_available_at: info.data.available_at ?? null,
      },
      'active',
    );
  const key = `event-update:${e.id}:${info.id}:${increment}`;
  const old = await c.db.findClaim(key);
  if (old) {
    if (task) await finishTask(c, task, e.id);
    return json(
      increment === 'SOURCE_ADDITION'
        ? { event: e, source_only: true, reused: true }
        : { event: e, update: await c.db.get('information', old), reused: true },
    );
  }
  if (increment === 'SOURCE_ADDITION') {
    const refs = [...new Set([...(e.data.source_refs as string[]), info.id])];
    const updated = await c.db.update('information', e.id, e.version, { ...e.data, source_refs: refs });
    await c.db.claim(key, e.id);
    if (task) await finishTask(c, task, e.id);
    await c.db.emit('information.source-added', e.id, { information_id: info.id });
    return json({ event: updated, source_only: true });
  }
  const update = await c.db.create(
    'information',
    'event_update',
    {
      ...d,
      event_id: e.id,
      information_version: info.version,
      available_at: info.data.available_at ?? null,
      recorded_at: c.now,
    },
    'valid',
  );
  ensure(await c.db.claim(key, update.id), 'DUPLICATE_UPDATE', '增量已保存', 409);
  if (increment !== 'NEW_EVENT') {
    const late =
      !!e.data.latest_available_at &&
      !!info.data.available_at &&
      String(info.data.available_at) < String(e.data.latest_available_at);
    e = await c.db.update('information', e.id, e.version, {
      ...e.data,
      ...(!late
        ? {
            phase: d.status!,
            summary: d.summary ?? d.quote!,
            targets: triples.length ? triples : e.data.targets!,
            latest_available_at: info.data.available_at ?? null,
          }
        : {}),
      source_refs: [...new Set([...(e.data.source_refs as string[]), info.id])],
      latest_update_id: update.id,
    });
  } else e = await c.db.update('information', e.id, e.version, { ...e.data, latest_update_id: update.id });
  if (task) await finishTask(c, task, e.id);
  await c.db.emit('information.event-updated', e.id, {
    event_id: e.id,
    event_update_id: update.id,
    increment_type: increment,
  });
  return json({ event: e, update });
};
const correct: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const r = await c.db.get('information', text(i, 'id'), true);
  ensure(r.kind === 'event', 'INVALID_REFERENCE', '不是事件');
  const d = object(i, 'data');
  for (const key of Object.keys(d))
    ensure(
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
      'PROTECTED_FIELD',
      '校正只能修改事实描述；阶段变化请追加事件增量',
    );
  await citation(c, text(d, 'information_id'), text(d, 'quote'));
  return json(
    await c.db.update('information', r.id, expected(i), {
      ...r.data,
      ...d,
      correction_reason: text(i, 'reason'),
    }),
  );
};
const rate: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const e = await c.db.get('information', text(i, 'event_id'));
  ensure(e.kind === 'event', 'INVALID_REFERENCE', '事件不存在');
  const d = object(i, 'data');
  text(d, 'assessment_scope');
  text(d, 'horizon');
  text(d, 'explanation');
  let score: null | number = null,
    method: null | string = null;
  if (typeof d.rule_id === 'string') {
    const rule = await c.db.get('reference', d.rule_id);
    active(rule);
    ensure(rule.kind === 'rule' && rule.data.category === 'm', 'INVALID_RULE', '必须为已批准 M 规则');
    const values = records(d, 'dimensions'),
      weights = records(rule.data, 'weights');
    ensure(values.length === weights.length, 'DIMENSION_MISSING', '维度不完整');
    score = 0;
    for (const w of weights) {
      const v = values.find((x) => x.code === w.code);
      ensure(
        v && typeof v.value === 'number' && v.value >= 0 && v.value <= 100,
        'INVALID_SCORE',
        '维度分值必须为0到100',
      );
      score += Number(w.weight) * v.value;
    }
    method = rule.id;
  }
  const row = await c.db.create(
    'information',
    'rating',
    { ...d, event_id: e.id, score, method_version: method, reason: text(i, 'reason') },
    score === null ? 'draft' : 'valid',
  );
  await c.db.emit('information.rated', e.id, { rating_id: row.id });
  return json(row);
};
const grouping: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const e = await c.db.get('information', text(i, 'id'));
  ensure(e.kind === 'event', 'INVALID_REFERENCE', '事件不存在');
  return json(
    await c.db.create(
      'information',
      'grouping',
      {
        ...object(i, 'data'),
        event_id: e.id,
        reason: text(i, 'reason'),
        execution_enabled: false,
        limitation: 'D-07 未定；只保存建议和影响复核，不迁移正式引用',
      },
      'pending',
    ),
  );
};
export const informationCommands: Record<string, CommandHandler> = {
  'information.source': source,
  'information.source_status': sourceStatus,
  'information.ingest': ingest,
  'information.extract': extract,
  'information.event': event,
  'information.correct': correct,
  'information.rate': rate,
  'information.grouping': grouping,
};

export const informationReview = (
  c: import('../../platform/core/types.js').Context,
  id: string,
  version: number,
  decision: string,
  reason: string,
) =>
  returnOrReject(
    c,
    'information',
    id,
    version,
    decision,
    reason,
    ['source', 'grouping'],
    ['draft', 'pending'],
  );
