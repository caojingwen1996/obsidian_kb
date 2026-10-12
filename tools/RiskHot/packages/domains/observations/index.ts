import {
  active,
  ensure,
  iso,
  object,
  permit,
  records,
  text,
  type CommandHandler,
  type Data,
} from '../../platform/core/types.js';
const json = (x: unknown) => JSON.parse(JSON.stringify(x));
const indicator: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const d = object(i, 'data');
  for (const key of ['name', 'code', 'unit', 'frequency', 'target_id', 'time_basis']) text(d, key);
  active(await c.db.get('reference', text(d, 'target_id')));
  ensure(
    !(await c.db.list('observations', 'indicator')).some((x) => x.data.code === d.code),
    'CODE_CONFLICT',
    '指标编码重复',
    409,
  );
  return json(await c.db.create('observations', 'indicator', d, 'active'));
};
const mapping: CommandHandler = async (c, i) => {
  permit(c, 'reviewer');
  const d = object(i, 'data');
  const v = await c.db.get('reference', text(d, 'variable_id'));
  ensure(v.kind === 'variable', 'INVALID_REFERENCE', '必须引用全局变量');
  active(v);
  const ind = await c.db.get('observations', text(d, 'indicator_id'));
  ensure(ind.kind === 'indicator', 'INVALID_REFERENCE', '指标不存在');
  text(d, 'scope');
  text(d, 'explanation');
  const key = `mapping:${v.id}:${ind.id}:${d.scope}`;
  const old = await c.db.findClaim(key);
  if (old) return json(await c.db.get('observations', old));
  const row = await c.db.create('observations', 'mapping', { ...d, approved_by: c.actor.id }, 'approved');
  ensure(await c.db.claim(key, row.id), 'DUPLICATE_MAPPING', '映射已存在', 409);
  return json(row);
};
const ingest: CommandHandler = async (c, i) => {
  permit(c, 'researcher', 'reviewer');
  const rows = records(i, 'rows'),
    accepted: Data[] = [],
    rejected: Data[] = [];
  for (let n = 0; n < rows.length; n++) {
    const d = rows[n]!;
    try {
      for (const k of ['indicator_id', 'unit', 'period', 'published_at', 'source_id', 'external_key'])
        text(d, k);
      ensure(d.value === null || typeof d.value === 'number', 'INVALID_VALUE', '数值必须为数字或明确空值');
      const indicator = await c.db.get('observations', text(d, 'indicator_id'));
      ensure(indicator.kind === 'indicator', 'INVALID_REFERENCE', '指标不存在');
      ensure(d.unit === indicator.data.unit, 'UNIT_MISMATCH', '单位不一致，需要显式转换口径');
      const source = await c.db.get('information', text(d, 'source_id'));
      active(source);
      const pub = iso(text(d, 'published_at'));
      ensure(pub <= c.now, 'FUTURE_PUBLICATION', '发布时间不能在未来');
      const key = `observation:${d.indicator_id}:${d.external_key}:${JSON.stringify(d.value)}:${pub}`;
      const old = await c.db.findClaim(key);
      if (old) {
        accepted.push({ row: n + 1, id: old, reused: true });
        continue;
      }
      const record = await c.db.create(
        'observations',
        'value',
        { ...d, published_at: pub, first_obtained_at: c.now, available_at: c.now },
        'valid',
      );
      ensure(await c.db.claim(key, record.id), 'DUPLICATE_OBSERVATION', '重复观测', 409);
      accepted.push({ row: n + 1, id: record.id, reused: false });
    } catch (e) {
      rejected.push({ row: n + 1, message: e instanceof Error ? e.message : '导入失败' });
    }
  }
  return { accepted, rejected };
};
export const observationCommands: Record<string, CommandHandler> = {
  'observations.indicator': indicator,
  'observations.mapping': mapping,
  'observations.import': ingest,
};
