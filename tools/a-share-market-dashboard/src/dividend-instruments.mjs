import { DIVIDEND_DEFAULT_STRATEGY, validateDividendStrategy } from './dividend-scoring.mjs';
import { fetchJson, buildLocalProxyUrl } from './adapters.mjs';

export const DIVIDEND_INSTRUMENTS = Object.freeze([
  Object.freeze({ id: '000922', label: '中证红利', indexName: '中证红利指数', indexCode: '000922', kind: 'index' }),
  Object.freeze({ id: '515450', label: '南方红利低波50ETF · 515450', indexName: '南方红利低波50ETF',
    indexCode: '515450', kind: 'etf', fundCode: '515450', fundName: '南方标普中国A股大盘红利低波50ETF',
    sourceUrl: 'https://fund.eastmoney.com/515450.html',
    sourcePath: '/api/dividend-signal', launchDate: '2020-02-26' }),
]);
export const DIVIDEND_INSTRUMENT_STORAGE_KEY = 'a-share-market-dashboard:dividend-instrument:v1';
export const SP_DIVIDEND_BOOTSTRAP = Object.freeze(
  // SP_DIVIDEND_BOOTSTRAP
);

export function dividendInstrument(id) {
  // Migrate only the picker; ETF prices and saved strategy use their own identity.
  if (id === 'SPCLLHCP') id = '515450';
  return DIVIDEND_INSTRUMENTS.find(item => item.id === id || item.fundCode === id) ?? DIVIDEND_INSTRUMENTS[0];
}

export function dividendInstrumentStrategyKey(id) {
  return `a-share-market-dashboard:dividend-strategy:${dividendInstrument(id).id}:v1`;
}

export function readInstrumentStrategy(storage, id) {
  const raw = storage.getItem(dividendInstrumentStrategyKey(id));
  const strategy = raw ? JSON.parse(raw) : structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  const errors = validateDividendStrategy(strategy);
  if (errors.length) throw new Error('本标的策略参数无效：' + errors.map(error => error.message).join('；'));
  return strategy;
}

export function saveInstrumentStrategy(storage, id, strategy) {
  const errors = validateDividendStrategy(strategy);
  if (errors.length) throw new Error(errors.map(error => error.message).join('；'));
  storage.setItem(dividendInstrumentStrategyKey(id), JSON.stringify(strategy));
}

function instrumentDate(value, today) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= today ? value : null;
}

export function normalizeDividendInstrumentData(raw, id = '515450', asOf = new Date()) {
  const instrument = dividendInstrument(id);
  if (instrument.id === '000922' || raw?.schemaVersion !== 1 || raw.instrumentId !== instrument.id) {
    throw new Error('标的身份不一致：必须提供515450 ETF数据');
  }
  if (raw.priceBasis !== 'qfq') throw new Error('ETF日线必须明确为前复权口径');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(asOf);
  const source = String(raw.source ?? '').trim();
  if (!source || !raw.sourceUrl) throw new Error('缺少指数数据来源');
  const unique = new Map();
  for (const point of raw.daily ?? []) {
    const date = instrumentDate(point?.date, today);
    if (!date || [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())
        || (point.instrumentId && point.instrumentId !== instrument.id)
        || !Number.isFinite(point.close) || point.close <= 0) throw new Error('指数日线日期、代码或点位无效');
    if (unique.has(date) && unique.get(date).close !== point.close) throw new Error('同日指数点位冲突');
    unique.set(date, { date, close: point.close });
  }
  const daily = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
  let valuation = null;
  if (raw.valuation != null) {
    const value = raw.valuation;
    if (value.basis !== 'fund-distribution-yield-ttm' || !Number.isFinite(value.dividendYield) || value.dividendYield < 0
        || value.dividendYield > 100 || !instrumentDate(value.date, today) || !value.sourceUrl) {
      throw new Error('ETF现金分红率口径、日期或来源无效');
    }
    valuation = { ...value };
  }
  const lastPoint = raw.lastPoint;
  if (lastPoint && (lastPoint.instrumentId !== instrument.id || !instrumentDate(lastPoint.date, today)
      || !Number.isFinite(lastPoint.close) || lastPoint.close <= 0)) throw new Error('最新收盘不是有效的515450 ETF记录');
  const records = raw.records ?? [];
  if (!Array.isArray(records) || records.some(record => record.instrumentId !== instrument.id || !instrumentDate(record.recordDate, today)
      || !instrumentDate(record.dates?.index, today) || !record.sourceKey)) throw new Error('历史评分记录标的、日期或来源无效');
  return { instrumentId: instrument.id, priceBasis: raw.priceBasis, daily, valuation, records,
    distributions: raw.distributions ?? [], distributionsFetchedAt: raw.distributionsFetchedAt ?? null, source, sourceUrl: raw.sourceUrl,
    lastPoint: lastPoint ? { ...lastPoint } : daily.at(-1) ? { ...daily.at(-1), instrumentId: instrument.id } : null,
    sourceStatus: raw.sourceStatus ?? {}, checkedAt: raw.checkedAt ?? null,
    dataQuality: raw.dataQuality ?? null, collection: raw.collection ?? null,
    historyCoverage: raw.historyCoverage ?? null, fetchedAt: raw.fetchedAt ?? null };
}

export async function loadDividendInstrumentData(id, { fetcher = fetchJson, location = globalThis.location } = {}) {
  if (!DIVIDEND_INSTRUMENTS.some(item => item.id === id || item.fundCode === id)) throw new Error('不支持的红利代码');
  const instrument = dividendInstrument(id);
  if (!instrument.sourcePath) throw new Error('该标的使用既有中证红利数据入口');
  return normalizeDividendInstrumentData(await fetcher(buildLocalProxyUrl(instrument.sourcePath, { code: instrument.id }, location), 12_000), instrument.id);
}

export function dividendInstrumentAnnualSeed(data) {
  const years = new Map();
  for (const point of data.daily) {
    const year = Number(point.date.slice(0, 4));
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(point);
  }
  const rows = [...years].map(([year, points], index) => ({ year, startDate: points[0].date, endDate: points.at(-1).date,
    status: index === 0 ? '样本首年' : '完整年度' }));
  return { rows, firstDate: data.daily[0]?.date, lastDate: data.daily.at(-1)?.date, source: data.source,
    returnConvention: 'ETF前复权收盘价的年内首日至末日变动；采用行情商复权口径，非现金账户实际收益',
    drawdownConvention: '自然年内前复权日收盘价相对此前峰值的最大回撤' };
}

export function dividendInstrumentDayCounts(data) {
  const years = new Map();
  for (let index = 1; index < data.daily.length; index++) {
    const current = data.daily[index], previous = data.daily[index - 1];
    const year = Number(current.date.slice(0, 4));
    if (!years.has(year)) years.set(year, { year, up: 0, flat: 0, down: 0, total: 0 });
    const row = years.get(year);
    row[current.close * 200 > previous.close * 201 ? 'up' : current.close * 200 < previous.close * 199 ? 'down' : 'flat']++;
    row.total++;
  }
  return [...years.values()].sort((a, b) => b.year - a.year);
}
