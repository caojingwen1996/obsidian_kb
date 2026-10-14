import { default as dividendDefaults } from '../../../.agents/skills/zzhl-dividend-signal/strategy-v1.json' with { type: 'json' };

export const DIVIDEND_DEFAULT_STRATEGY = Object.freeze(dividendDefaults);
export const DIVIDEND_SCORE_KEYS = ['percentile', 'absolute', 'ratio'];
export const DIVIDEND_SCORE_LABELS = { percentile: '历史分位', absolute: '绝对股息率', ratio: '股债倍数' };
export const DIVIDEND_GRADE_LABELS = { D: '吸引力偏弱', C: '基础配置区间', B: '加大买入区间', A: '重点配置区间' };
export const DIVIDEND_TRIAL_STORAGE_KEY = 'dividend-weighted-v1-trial';

function dividendFinite(value) { return typeof value === 'number' && Number.isFinite(value); }
function dividendDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateDividendStrategy(config) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (typeof config?.version !== 'string' || !config.version) add('version', '策略版本无效');
  const weights = config?.weights ?? {};
  for (const key of DIVIDEND_SCORE_KEYS) {
    if (!dividendFinite(weights[key]) || weights[key] <= 0) add(`weights.${key}`, '权重必须大于0');
  }
  if (DIVIDEND_SCORE_KEYS.every(k => dividendFinite(weights[k]))
      && Math.abs(DIVIDEND_SCORE_KEYS.reduce((sum, k) => sum + weights[k], 0) - 100) > 1e-8) add('weights', '三项权重合计必须为100%');
  for (const key of DIVIDEND_SCORE_KEYS) {
    const points = config?.anchors?.[key];
    if (!Array.isArray(points) || points.length !== 5) { add(`anchors.${key}`, '需要五个锚点'); continue; }
    points.forEach((point, i) => {
      const prefix = `anchors.${key}.${i}`;
      if (!Array.isArray(point) || point.length !== 2 || !point.every(dividendFinite)) { add(prefix, '锚点必须是有限数值'); return; }
      const [x, score] = point;
      if (x < 0 || (key === 'percentile' && x > 100) || (key === 'ratio' && x <= 0)) add(`${prefix}.0`, '输入锚点超出允许范围');
      if (score < 0 || score > 100 || (i === 0 && score !== 0) || (i === 4 && score !== 100)) add(`${prefix}.1`, '分数范围0～100，端点固定0和100');
      if (key === 'percentile' && ((i === 0 && x !== 0) || (i === 4 && x !== 100))) add(`${prefix}.0`, '分位端点固定0%和100%');
      if (i && Array.isArray(points[i - 1])) for (const axis of [0, 1]) {
        if (dividendFinite(points[i - 1][axis]) && point[axis] <= points[i - 1][axis]) add(`${prefix}.${axis}`, '锚点输入与分数必须严格递增');
      }
    });
  }
  const levels = ['C', 'B', 'A'].map(k => config?.thresholds?.[k]);
  if (!levels.every(dividendFinite) || !(0 < levels[0] && levels[0] < levels[1] && levels[1] < levels[2] && levels[2] < 100)) add('thresholds', '分界必须满足0＜C＜B＜A＜100');
  if (!Number.isInteger(config?.confirmationDays) || config.confirmationDays < 1 || config.confirmationDays > 20) add('confirmationDays', '确认天数必须为1～20的整数');
  return errors;
}

export function interpolateDividend(value, points) {
  if (value <= points[0][0]) return { score: points[0][1], interval: [points[0], points[0]], clipped: true };
  if (value >= points.at(-1)[0]) return { score: points.at(-1)[1], interval: [points.at(-1), points.at(-1)], clipped: true };
  for (let i = 1; i < points.length; i++) {
    const [left, right] = [points[i - 1], points[i]];
    if (value <= right[0]) return { score: left[1] + (value - left[0]) / (right[0] - left[0]) * (right[1] - left[1]), interval: [left, right], clipped: false };
  }
  throw new Error('无法定位锚点区间');
}

export function dividendGradeForScore(value, strategy = DIVIDEND_DEFAULT_STRATEGY) {
  return ['A', 'B', 'C'].find(g => value >= strategy.thresholds[g]) ?? 'D';
}

export function scoreDividendInput(input, strategy = DIVIDEND_DEFAULT_STRATEGY, dates = {}, sourceKey = '', reference = false, kind = 'daily') {
  const errors = validateDividendStrategy(strategy);
  if (errors.length) throw new Error(errors.map(e => e.message).join('；'));
  const p = dividendFinite(input.percentile) && input.percentile >= 0 && input.percentile <= 100 ? input.percentile : null;
  const y = dividendFinite(input.dividendYield) && input.dividendYield >= 0 ? input.dividendYield : null;
  const b = dividendFinite(input.bondYield) && input.bondYield > 0 ? input.bondYield : null;
  const rawRatio = y !== null && b !== null ? y / b : null;
  const ratio = dividendFinite(rawRatio) ? rawRatio : null;
  const components = {};
  let lower = 0, upper = 0;
  DIVIDEND_SCORE_KEYS.forEach((key, i) => {
    const value = [p, y, ratio][i];
    const detail = value !== null ? interpolateDividend(value, strategy.anchors[key]) : { score: null, interval: null, clipped: false };
    const weight = strategy.weights[key];
    const contribution = detail.score !== null ? detail.score * weight / 100 : null;
    components[key] = { ...detail, value, weight, contribution };
    lower += contribution ?? 0;
    upper += contribution ?? weight;
  });
  const complete = Object.values(components).every(c => c.score !== null);
  const grade = complete ? dividendGradeForScore(lower, strategy) : null;
  const nextGrade = ({ D: 'C', C: 'B', B: 'A' })[grade] ?? null;
  const aligned = ['index', 'percentile', 'bond'].every(k => dividendDate(dates[k])) && new Set(Object.values(dates)).size === 1;
  const quality = [];
  if (!complete) quality.push('数据不足');
  if (reference) quality.push('参考评分');
  if (!aligned) quality.push('日期未对齐');
  if (kind !== 'daily') quality.push(kind === 'legacy' ? '历史数据试算' : '本地参考快照');
  return { input: { percentile: p, dividendYield: y, bondYield: b }, dates, sourceKey, reference, kind,
    strategyVersion: strategy.version, components, score: complete ? lower : null, lower, upper, grade,
    label: DIVIDEND_GRADE_LABELS[grade] ?? '数据不足，暂不评级', nextGrade,
    nextDistance: nextGrade ? strategy.thresholds[nextGrade] - lower : null,
    quality: quality.length ? quality : ['数据完整'], eligible: complete && aligned && Boolean(sourceKey) && kind === 'daily' };
}

export function confirmDividendRecords(records, tradingDates, required = 3) {
  const byDate = new Map(records.filter(r => dividendDate(r.dates?.index)).map(r => [r.dates.index, r]));
  const last = [...byDate.keys()].sort().at(-1);
  const calendar = [...new Set(tradingDates.filter(d => dividendDate(d) && d <= last))].sort();
  const empty = { status: 'insufficient', baseline: null, candidate: null, count: 0, required, message: '证据不足' };
  if (!last || !calendar.includes(last)) return empty;
  let context = null, baseline = null, candidate = null, count = 0, status = 'insufficient';
  for (const day of calendar) {
    const r = byDate.get(day);
    if (r) {
      const key = JSON.stringify([r.sourceKey, r.strategyVersion]);
      if (context !== key) { context = key; baseline = null; candidate = null; count = 0; }
    }
    if (!r?.eligible) { candidate = null; count = 0; status = 'insufficient'; continue; }
    if (r.grade === baseline) { candidate = null; count = 0; status = 'stable'; continue; }
    count = r.grade === candidate ? count + 1 : 1;
    candidate = r.grade;
    status = 'pending';
    if (count >= required) { status = baseline === null ? 'established' : 'changed'; baseline = r.grade; candidate = null; count = 0; }
  }
  const messages = { insufficient: '证据不足', stable: `已确认 ${baseline}，策略维持`, established: `已建立 ${baseline} 基准`, changed: `策略调整已确认：${baseline}`, pending: `待确认 ${candidate}：${count}/${required}个交易日` };
  return { status, baseline, candidate, count, required, message: messages[status] };
}

export function trialDividendHistory(payload, strategy) {
  const records = (payload?.records ?? []).map(r => scoreDividendInput(r.input, strategy, r.dates, r.sourceKey, r.reference, r.kind));
  return confirmDividendRecords(records, payload?.tradingDates ?? [], strategy.confirmationDays);
}

export function readDividendTrial(storage) {
  try {
    const config = JSON.parse(storage.getItem(DIVIDEND_TRIAL_STORAGE_KEY) ?? 'null');
    if (config && !validateDividendStrategy(config).length) return structuredClone(config);
  } catch { /* A corrupt browser cache must not prevent the page from opening. */ }
  return structuredClone(DIVIDEND_DEFAULT_STRATEGY);
}

export function saveDividendTrial(storage, config) {
  if (validateDividendStrategy(config).length) throw new Error('试算参数无效');
  storage.setItem(DIVIDEND_TRIAL_STORAGE_KEY, JSON.stringify(config));
}
