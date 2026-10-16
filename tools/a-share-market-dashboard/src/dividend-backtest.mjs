import { scoreDividendInput, confirmDividendRecords, validateDividendStrategy } from './dividend-scoring.mjs';

function backtestDate(value) {
  if ((typeof value === 'number' && Number.isFinite(value)) || /^\d{5}(?:\.0+)?$/.test(String(value ?? ''))) {
    const serial = Number(value);
    return serial > 0 && serial < 100000 ? new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10) : null;
  }
  const match = String(value ?? '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[ T])/);
  if (!match) return null;
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : null;
}

export function dividendWorkbookPayload(rows, indexPoints) {
  if (!Array.isArray(rows) || rows.length < 3) throw new Error('Excel没有可用的历史数据。');
  const headers = rows[0];
  const required = ['run_date__record_date', 'index_date__index_valuation_date', 'akshare_dividend_yield_2', 'bond_10y_yield', 'bond_date__china_10y_yield_date', 'lixinger_percentile_10y', 'lixinger_date__percentile_source_date', 'lixinger_source'];
  if (required.some(name => !headers.includes(name))) throw new Error('Excel缺少回测必需的指标或日期列。');
  const number = value => value === null || value === undefined || String(value).trim() === '' || typeof value === 'boolean' || !Number.isFinite(Number(value)) ? null : Number(value);
  return { records: rows.slice(2).map((row, i) => ({ row, i })).filter(({ row }) => row.some(value => value !== null && value !== undefined && value !== '')).map(({ row, i }) => {
    const get = name => row[headers.indexOf(name)];
    const source = String(get('lixinger_source') ?? '').trim();
    return { workbookRow: i + 3, recordDate: backtestDate(get('run_date__record_date')),
      dates: { index: backtestDate(get('index_date__index_valuation_date')), percentile: backtestDate(get('lixinger_date__percentile_source_date')), bond: backtestDate(get('bond_date__china_10y_yield_date')) },
      input: { percentile: number(get('lixinger_percentile_10y')), dividendYield: number(get('akshare_dividend_yield_2')), bondYield: number(get('bond_10y_yield')) },
      sourceKey: source, reference: /推算/.test(source), kind: 'legacy' };
  }), tradingDates: indexPoints.map(point => backtestDate(point.date)).filter(Boolean) };
}

function backtestObservation(calendar, closes, availableDate) {
  const entryIndex = calendar.findIndex(date => date > availableDate);
  if (entryIndex < 0 || entryIndex === calendar.length - 1) return { status: '后续交易日不足' };
  const dates = calendar.slice(entryIndex);
  if (dates.some(date => !closes.has(date))) return { status: '价格缺失' };
  const values = dates.map(date => closes.get(date));
  let peak = values[0], drawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, (value / peak - 1) * 100);
  }
  return { status: '已完成', entryDate: dates[0], exitDate: dates.at(-1), entryClose: values[0],
    exitClose: values.at(-1), returnPct: (values.at(-1) / values[0] - 1) * 100, drawdownPct: drawdown };
}

function summarizeBacktestRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.grade, row.sourceKey, row.kind]);
    if (!groups.has(key)) groups.set(key, { grade: row.grade, sourceKey: row.sourceKey, kind: row.kind, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].map(group => {
    const completed = group.rows.map(row => row.observation).filter(item => item.status === '已完成');
    const values = completed.map(item => item.returnPct).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return { grade: group.grade, sourceKey: group.sourceKey, kind: group.kind, signals: group.rows.length,
      completed: values.length, pending: group.rows.filter(row => row.observation.status === '后续交易日不足').length,
      priceGaps: group.rows.filter(row => row.observation.status === '价格缺失').length,
      meanReturnPct: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      medianReturnPct: values.length ? (values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2) : null,
      positiveRatePct: values.length ? values.filter(value => value > 0).length / values.length * 100 : null,
      worstDrawdownPct: values.length ? Math.min(...completed.map(item => item.drawdownPct)) : null };
  });
}

export function runDividendBacktest(payload, indexPoints, strategy) {
  const errors = validateDividendStrategy(strategy);
  if (errors.length) throw new Error(errors.map(error => error.message).join('；'));
  if (!Array.isArray(payload?.records) || !Array.isArray(payload?.tradingDates)) throw new Error('缺少结构化评分历史或交易日历，无法回测。');
  if (!Array.isArray(indexPoints)) throw new Error('指数价格历史格式无效。');
  const excelDates = payload.records.map(record => backtestDate(record?.dates?.index)).filter(Boolean).sort();
  const startDate = excelDates[0], endDate = excelDates.at(-1);
  if (!endDate) throw new Error('Excel没有有效估值日期，无法确定回测范围。');
  const calendar = [...new Set(payload.tradingDates.map(backtestDate).filter(date => date && date >= startDate && date <= endDate))].sort();
  if (!calendar.length) throw new Error('Excel日期范围内交易日历为空，无法回测。');
  if (calendar.at(-1) !== endDate) throw new Error(`本地指数日线未覆盖Excel最后估值日 ${endDate}，请先补齐价格数据。`);
  const closes = new Map();
  const conflictingPrices = new Set();
  for (const point of indexPoints) {
    const date = backtestDate(point?.date);
    if (!date || date < startDate || date > endDate || typeof point.close !== 'number' || !Number.isFinite(point.close) || point.close <= 0) continue;
    if (closes.has(date) && closes.get(date) !== point.close) conflictingPrices.add(date);
    closes.set(date, point.close);
  }
  for (const date of conflictingPrices) closes.delete(date);
  // Availability comes from the archived collection date, never from the valuation date.
  const candidates = payload.records.map((record, order) => ({ record, order,
    date: backtestDate(record?.dates?.index), availableDate: backtestDate(record?.recordDate) }))
    .sort((a, b) => (a.availableDate ?? '9999').localeCompare(b.availableDate ?? '9999') || a.order - b.order);
  const seen = new Set(), rows = [];
  let duplicates = 0;
  for (const candidate of candidates) {
    const { record, date, availableDate } = candidate;
    if (date && seen.has(date)) { duplicates += 1; continue; }
    if (date) seen.add(date);
    const dates = Object.fromEntries(['index', 'percentile', 'bond'].map(key => [key, backtestDate(record?.dates?.[key])]));
    const score = scoreDividendInput(record?.input ?? {}, strategy, dates, record?.sourceKey ?? '', Boolean(record?.reference), record?.kind ?? 'legacy');
    const reasons = [];
    if (score.score === null) reasons.push('指标缺失或无效');
    if (!date || !dates.percentile || !dates.bond || new Set(Object.values(dates)).size !== 1) reasons.push('指标日期未对齐');
    if (date && !calendar.includes(date)) reasons.push('估值日缺少交易日证据');
    if (!availableDate) reasons.push('记录日期缺失');
    else if (Object.values(dates).some(day => day && day > availableDate)) reasons.push('输入晚于记录日期');
    if (!score.sourceKey) reasons.push('来源缺失');
    const row = { date, availableDate, workbookRow: record.workbookRow, grade: score.grade, score: score.score, lower: score.lower, upper: score.upper,
      input: score.input, components: score.components, sourceKey: score.sourceKey, kind: score.kind, reference: score.reference,
      eligible: score.eligible && reasons.length === 0, reasons, observation: null, confirmation: null, confirmedChange: false };
    if (!reasons.length) row.observation = backtestObservation(calendar, closes, availableDate);
    rows.push(row);
  }
  rows.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const scored = [];
  for (const row of rows) {
    scored.push({ dates: { index: row.date }, sourceKey: row.sourceKey, strategyVersion: strategy.version,
      grade: row.grade, eligible: row.eligible });
    row.confirmation = confirmDividendRecords(scored, calendar.filter(date => date <= row.date), strategy.confirmationDays);
    row.confirmedChange = row.eligible && ['established', 'changed'].includes(row.confirmation.status);
  }
  const samples = rows.filter(row => !row.reasons.length);
  const confirmed = samples.filter(row => row.confirmedChange);
  const priceDates = [...closes.keys()].sort();
  const reasonCounts = {};
  for (const row of rows) for (const reason of row.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  const gradeCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map(grade => [grade, samples.filter(row => row.grade === grade).length]));
  return { schemaVersion: 2, type: 'dividend-signal-backtest', strategy: structuredClone(strategy), period: { startDate, endDate, tradingDays: calendar.length },
    coverage: { rawRecords: payload.records.length, uniqueRecords: rows.length, duplicates,
      completeInputs: rows.filter(row => row.score !== null).length, usableSamples: samples.length,
      dailyEligible: rows.filter(row => row.eligible).length, confirmedChanges: confirmed.length,
      confirmedBuyChanges: confirmed.filter(row => ['A', 'B'].includes(row.grade)).length,
      signalFirstDate: [...seen].sort()[0] ?? null, signalLastDate: [...seen].sort().at(-1) ?? null,
      priceCount: closes.size, priceFirstDate: priceDates[0] ?? null, priceLastDate: priceDates.at(-1) ?? null,
      conflictingPrices: conflictingPrices.size, reasonCounts, gradeCounts },
    confirmedSummary: summarizeBacktestRows(confirmed), referenceSummary: summarizeBacktestRows(samples), rows,
    methodology: [
      '固定使用本次参数重算历史输入，原有分数、等级和每日文件不改写；不同来源与记录类型分别统计。',
      '缺失指标不补零、不重新分配权重；日期未对齐、来源或记录日期缺失的记录退出观察样本。',
      '同一估值日期保留最早收集的记录，避免将后来修订或补齐的数据提前使用。',
      '使用Excel全部历史记录，以Excel最后估值日为统一截止日；本地价格超出Excel范围的部分不参与计算。',
      '以记录日期为可知日，从其后首个交易日收盘起计算到统一截止日；后续不足两个收盘价或价格断档时不计收益，不填零。',
      'Excel历史记录（含事后补齐）仅做信号效果回看，不升级为当时已发布或已连续确认的每日信号。',
      '统计中证红利000922价格指数收益与计算区间内收盘最大回撤，不含分红再投资、交易成本或资金收益；上涨比例仅指收益大于0的样本占比。',
      '各信号到截止日的区间长短不同且相互重叠，样本不独立，分组均值不代表策略资金收益；参数为事后固定，结果属于样本内回看，不构成样本外验证。',
    ] };
}
