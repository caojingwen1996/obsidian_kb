import {
  BASE_WEIGHTS,
  calculateGreedMetrics,
  calculatePositionMetric,
  calculateValuationMetrics,
  calculateWeightedScore,
  clamp,
  conclusionForScore,
  percentileRank,
} from './core.mjs';
import {
  buildLocalProxyUrl,
  fetchJson,
  isLocalProxyLocation,
  requestTimeout,
} from './adapters.mjs';
import {
  EXAMPLE_SNAPSHOT,
  createMemoryStorage,
  createDefaultDomainDefinitions,
  refreshDomains,
} from './data-service.mjs';

const LAYER_META = Object.freeze({
  position: { label: '位置层', targetWeight: 40, description: '三大指数相对 MA250 的历史位置' },
  valuation: { label: '估值层', targetWeight: 35, description: '沪深300估值、盈利收益率与 ERP' },
  emotion: { label: '情绪层', targetWeight: 25, description: '市场宽度、涨跌停、成交额与融资' },
});

const STATUS_PRIORITY = Object.freeze({ example: 0, latest: 0, snapshot: 1, expired: 2, missing: 3 });
const STATUS_LABELS = Object.freeze({ example: '示例', latest: '最新', snapshot: '快照', expired: '已过期', missing: '缺失' });
const PORTFOLIO_STORAGE_KEY = 'a-share-market-dashboard:holdings:v1';
const FUGUI_STRATEGY_STORAGE_KEY = 'a-share-market-dashboard:fugui-strategy:v1';
const FUGUI_PANEL_COLLAPSED_STORAGE_KEY = 'a-share-market-dashboard:fugui-panel-collapsed:v1';
const FUGUI_PROVIDER_STORAGE_KEY = 'a-share-market-dashboard:fugui-provider:v1';
const MARGIN_BALANCE_CACHE_STORAGE_KEY = 'a-share-market-dashboard:margin-balance:one-year:v1';
const FEATURED_DELETED_STORAGE_KEY = 'a-share-market-dashboard:featured-deleted:v1';
const MARGIN_BALANCE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FUGUI_STRATEGY_RULES = Object.freeze({
  allowedOwnership: new Set(['央企', '国企']),
  marketCapMinYi: 1000,
  priceMax: 30,
});
const YOUZHIYOUXING_TEMPERATURE_URL = 'https://youzhiyouxing.cn/data';
const NASDAQ100_SOURCE_URL = 'https://finance.yahoo.com/quote/%5ENDX/';
const CSI_DIVIDEND_SIGNAL_SOURCE_URL = '../../sources/automations/中证红利信号/最新信号.md';
const HOLDING_STATUSES = new Set(['持有', '观察', '计划加仓', '计划减仓']);
const ALLOCATION_CATEGORIES = Object.freeze([
  { key: 'strategy', label: '战略资源', color: '#26a68f' },
  { key: 'emerging', label: '新兴', color: '#f3b42b' },
  { key: 'pillar', label: '支柱', color: '#2f7ee6' },
]);
const UNCATEGORIZED_ALLOCATION_CATEGORY = Object.freeze({ key: 'uncategorized', label: '未分类', color: '#8aa0b4' });
const STOCK_CODE_ALIASES = Object.freeze({
  宁德时代: '300750',
  西部矿业: '601168',
  三一重工: '600031',
  兴业银锡: '000426',
  三花智控: '002050',
  航天电子: '600879',
  云铝股份: '000807',
  东阳光: '600673',
  紫光股份: '000938',
  国药现代: '600420',
  中国卫星: '600118',
  中国卫通: '601698',
  中国中车: '601766',
  中国船舶: '600150',
  神马电力: '603530',
  华明装备: '002270',
  中证500ETF南方: '510500',
  有色ETF: '512400',
});
const STOCK_REPORT_LINKS = Object.freeze({
  // STOCK_REPORT_LINKS
});
const DAILY_MONITOR_LINKS = Object.freeze({
  // DAILY_MONITOR_LINKS
});
const EVENT_CALENDAR = Object.freeze(
  // EVENT_CALENDAR
);
const CSI_DIVIDEND_SIGNAL = Object.freeze(
  // CSI_DIVIDEND_SIGNAL
);
const CSI_DIVIDEND_YIELD_HISTORY = Object.freeze(
  // CSI_DIVIDEND_YIELD_HISTORY
);

function domain(snapshot, id) {
  return snapshot?.domains?.[id] ?? { data: null, source: null, status: 'missing', dataAt: null, fetchedAt: null, errors: [] };
}

function usableData(snapshot, id) {
  const entry = domain(snapshot, id);
  return ['missing', 'expired'].includes(entry.status) ? null : entry.data;
}

function combineMeta(...entries) {
  const valid = entries.filter(Boolean);
  const worst = valid.reduce((current, entry) => (
    (STATUS_PRIORITY[entry.status] ?? 3) > (STATUS_PRIORITY[current.status] ?? 3) ? entry : current
  ), valid[0] ?? { status: 'missing' });
  return {
    status: worst.status ?? 'missing',
    source: [...new Set(valid.map(entry => entry.source).filter(Boolean))].join(' + ') || '无可靠来源',
    dataAt: Math.min(...valid.map(entry => Number(entry.dataAt)).filter(Number.isFinite)),
    fetchedAt: Math.max(...valid.map(entry => Number(entry.fetchedAt)).filter(Number.isFinite)),
    errors: valid.flatMap(entry => entry.errors ?? []),
  };
}

function alignByDate(left, right) {
  const rightByDate = new Map((right ?? []).map(point => [point.date, point.value]));
  const pairs = (left ?? []).flatMap(point => (
    rightByDate.has(point.date) && Number.isFinite(point.value) && Number.isFinite(rightByDate.get(point.date))
      ? [{ date: point.date, left: point.value, right: rightByDate.get(point.date) }]
      : []
  ));
  return {
    left: pairs.map(point => point.left),
    right: pairs.map(point => point.right),
  };
}

function marginChangePercentile(points, lag = 20) {
  if (!Array.isArray(points) || points.length <= lag) return null;
  const changes = [];
  for (let index = lag; index < points.length; index += 1) {
    const current = points[index]?.value;
    const previous = points[index - lag]?.value;
    if (Number.isFinite(current) && Number.isFinite(previous) && previous !== 0) {
      changes.push((current / previous - 1) * 100);
    }
  }
  return changes.length ? percentileRank(changes, changes.at(-1)) : null;
}

function metricMeta(snapshot, ...domainIds) {
  return combineMeta(...domainIds.map(id => domain(snapshot, id)));
}

function createMetric({ id, layer, label, value = null, percentile = null, score = null, weight, formula, meta, unit = '' }) {
  return { id, layer, label, value, percentile, score, weight, formula, unit, ...meta };
}

export function deriveDashboard(snapshot, windowYears = 5) {
  const shanghai = usableData(snapshot, 'shanghaiHistory');
  const csi300 = usableData(snapshot, 'csi300History');
  const csiAll = usableData(snapshot, 'csiAllHistory');
  const positions = {
    shanghai: Array.isArray(shanghai) ? calculatePositionMetric(shanghai, windowYears) : null,
    csi300: Array.isArray(csi300) ? calculatePositionMetric(csi300, windowYears) : null,
    csiAll: Array.isArray(csiAll) ? calculatePositionMetric(csiAll, windowYears) : null,
  };

  const csi300Stats = usableData(snapshot, 'csi300Stats') ?? [];
  const forwardPePoints = usableData(snapshot, 'forwardPe') ?? [];
  const treasuryPoints = usableData(snapshot, 'treasury') ?? [];
  const alignedForward = alignByDate(forwardPePoints, treasuryPoints);
  const valuation = calculateValuationMetrics({
    ttmPeHistory: csi300Stats.map(point => point.ttmPe),
    forwardPeHistory: alignedForward.left,
    bond10yHistory: alignedForward.right,
  });

  const market = usableData(snapshot, 'market');
  const turnoverHistory = usableData(snapshot, 'turnoverHistory') ?? [];
  const turnoverValues = turnoverHistory.map(point => point.value).filter(Number.isFinite);
  const turnoverPercentile = market && Number.isFinite(market.turnover) && turnoverValues.length
    ? percentileRank([...turnoverValues, market.turnover], market.turnover)
    : null;
  const marginPercentile = marginChangePercentile(usableData(snapshot, 'margin'));
  const greed = calculateGreedMetrics({
    advancers: market?.advancers,
    decliners: market?.decliners,
    limitUp: market?.limitUp,
    limitDown: market?.limitDown,
    turnoverPercentile,
    marginChangePercentile: marginPercentile,
  });

  const metrics = [
    createMetric({ id: 'positionShanghai', layer: 'position', label: '上证指数趋势偏离', value: positions.shanghai?.deviation * 100, percentile: positions.shanghai?.percentile, score: positions.shanghai?.score, weight: BASE_WEIGHTS.positionShanghai, formula: '收盘价 ÷ MA250 - 1；得分 = 100 - 历史分位', meta: metricMeta(snapshot, 'shanghaiHistory'), unit: '%' }),
    createMetric({ id: 'positionCsi300', layer: 'position', label: '沪深300趋势偏离', value: positions.csi300?.deviation * 100, percentile: positions.csi300?.percentile, score: positions.csi300?.score, weight: BASE_WEIGHTS.positionCsi300, formula: '收盘价 ÷ MA250 - 1；得分 = 100 - 历史分位', meta: metricMeta(snapshot, 'csi300History'), unit: '%' }),
    createMetric({ id: 'positionCsiAll', layer: 'position', label: '中证全指趋势偏离', value: positions.csiAll?.deviation * 100, percentile: positions.csiAll?.percentile, score: positions.csiAll?.score, weight: BASE_WEIGHTS.positionCsiAll, formula: '收盘价 ÷ MA250 - 1；得分 = 100 - 历史分位', meta: metricMeta(snapshot, 'csiAllHistory'), unit: '%' }),
    createMetric({ id: 'ttmPe', layer: 'valuation', label: '沪深300 TTM PE', value: valuation.ttmPe?.value, percentile: valuation.ttmPe?.percentile, score: valuation.ttmPe?.score, weight: BASE_WEIGHTS.ttmPe, formula: '得分 = 100 - TTM PE 历史分位', meta: metricMeta(snapshot, 'csi300Stats'), unit: '倍' }),
    createMetric({ id: 'forwardEarningsYield', layer: 'valuation', label: '前瞻盈利收益率', value: valuation.forwardEarningsYield?.value, percentile: valuation.forwardEarningsYield?.percentile, score: valuation.forwardEarningsYield?.score, weight: BASE_WEIGHTS.forwardEarningsYield, formula: '100 ÷ 沪深300前瞻PE', meta: metricMeta(snapshot, 'forwardPe'), unit: '%' }),
    createMetric({ id: 'erp', layer: 'valuation', label: '股权风险溢价 ERP', value: valuation.erp?.value, percentile: valuation.erp?.percentile, score: valuation.erp?.score, weight: BASE_WEIGHTS.erp, formula: '前瞻盈利收益率 - 中国10年期国债收益率', meta: metricMeta(snapshot, 'forwardPe', 'treasury'), unit: '个百分点' }),
    createMetric({ id: 'breadth', layer: 'emotion', label: '上涨家数占比', value: greed.components.breadth.score, percentile: greed.components.breadth.score, score: Number.isFinite(greed.components.breadth.score) ? 100 - greed.components.breadth.score : null, weight: BASE_WEIGHTS.breadth, formula: '上涨家数 ÷ (上涨家数 + 下跌家数)', meta: metricMeta(snapshot, 'market'), unit: '%' }),
    createMetric({ id: 'limitBalance', layer: 'emotion', label: '涨停/跌停强弱', value: greed.components.limitBalance.score, percentile: greed.components.limitBalance.score, score: Number.isFinite(greed.components.limitBalance.score) ? 100 - greed.components.limitBalance.score : null, weight: BASE_WEIGHTS.limitBalance, formula: '涨停数 ÷ (涨停数 + 跌停数)', meta: metricMeta(snapshot, 'market'), unit: '%' }),
    createMetric({ id: 'turnover', layer: 'emotion', label: '全市场成交额分位', value: market?.turnover, percentile: turnoverPercentile, score: Number.isFinite(turnoverPercentile) ? 100 - turnoverPercentile : null, weight: BASE_WEIGHTS.turnover, formula: '当日沪深A股成交额的历史分位', meta: metricMeta(snapshot, 'market', 'turnoverHistory'), unit: '元' }),
    createMetric({ id: 'margin', layer: 'emotion', label: '融资余额20日变化分位', value: marginPercentile, percentile: marginPercentile, score: Number.isFinite(marginPercentile) ? 100 - marginPercentile : null, weight: BASE_WEIGHTS.margin, formula: '融资余额20日变化率的历史分位', meta: metricMeta(snapshot, 'margin'), unit: '%' }),
  ];

  const score = calculateWeightedScore(metrics.map(metric => ({ id: metric.id, score: metric.score, weight: metric.weight })));
  const scoreById = new Map(score.items.map(item => [item.id, item]));
  const enrichedMetrics = metrics.map(metric => ({ ...metric, ...scoreById.get(metric.id) }));
  const layers = Object.fromEntries(Object.entries(LAYER_META).map(([id, meta]) => {
    const layerScore = calculateWeightedScore(metrics.filter(metric => metric.layer === id).map(metric => ({ id: metric.id, score: metric.score, weight: metric.weight })));
    return [id, {
      id,
      ...meta,
      score: layerScore.score,
      coverage: meta.targetWeight ? clamp(layerScore.coverage / meta.targetWeight * 100) : 0,
    }];
  }));

  return {
    mode: snapshot?.mode ?? 'live',
    generatedAt: snapshot?.generatedAt ?? new Date().toISOString(),
    windowYears,
    positions,
    valuation,
    greed,
    metrics: enrichedMetrics,
    layers,
    score,
    margin: domain(snapshot, 'margin'),
    usTreasury10y: domain(snapshot, 'usTreasury10y'),
    usDollarIndex: domain(snapshot, 'usDollarIndex'),
    conclusion: conclusionForScore(score.score, score.coverage),
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value) : '—';
}

function formatValue(metric) {
  if (!Number.isFinite(metric.value)) return '—';
  if (metric.id === 'turnover') return `${formatNumber(metric.value / 100_000_000, 0)} 亿`;
  return `${formatNumber(metric.value, 2)}${metric.unit && metric.unit !== '元' ? ` ${metric.unit}` : ''}`;
}

function formatTime(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(timestamp) : '—';
}

function normalizeStockName(value) {
  return String(value ?? '').trim().replace(/\s+/g, '');
}

export function stockSecidFromCode(code) {
  const digits = String(code ?? '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(digits)) return '';
  if (/^[69]/.test(digits)) return `1.${digits}`;
  if (/^[023]/.test(digits)) return `0.${digits}`;
  return '';
}

function stockCodeForTrackingItem(item = {}) {
  const explicitCode = String(item.code ?? '').trim();
  if (stockSecidFromCode(explicitCode)) return explicitCode;
  const normalizedName = normalizeStockName(item.name);
  if (!normalizedName) return '';
  if (STOCK_CODE_ALIASES[normalizedName]) return STOCK_CODE_ALIASES[normalizedName];
  const partialMatch = Object.entries(STOCK_CODE_ALIASES).find(([alias]) =>
    alias.includes(normalizedName) || normalizedName.includes(alias)
  );
  return partialMatch?.[1] ?? '';
}

function secidForTrackingItem(item = {}, report = {}) {
  if (/^[01]\.\d{6}$/.test(String(report.secid ?? ''))) return report.secid;
  return stockSecidFromCode(stockCodeForTrackingItem(item));
}

function reportLinkForTrackingItem(item) {
  const candidates = [item.name, ...Object.entries(STOCK_CODE_ALIASES)
    .filter(([, code]) => code === item.code)
    .map(([name]) => name)]
    .map(normalizeStockName)
    .filter(Boolean);
  for (const candidate of candidates) {
    if (STOCK_REPORT_LINKS[candidate]) return STOCK_REPORT_LINKS[candidate];
  }
  const partial = Object.entries(STOCK_REPORT_LINKS).find(([name]) =>
    candidates.some(candidate => name.includes(candidate) || candidate.includes(name))
  );
  return partial?.[1] ?? '';
}

function dailyMonitorLinkForTrackingItem(item = {}, report = {}) {
  const code = stockCodeForTrackingItem(item);
  const secidCode = String(report.secid ?? '').match(/^[01]\.(\d{6})$/)?.[1] ?? '';
  const candidates = [
    item.code,
    code,
    secidCode,
    item.name,
    ...Object.entries(STOCK_CODE_ALIASES)
      .filter(([, aliasCode]) => [item.code, code, secidCode].includes(aliasCode))
      .map(([name]) => name),
  ].map(normalizeStockName).filter(Boolean);
  for (const candidate of candidates) {
    if (DAILY_MONITOR_LINKS[candidate]) return DAILY_MONITOR_LINKS[candidate];
  }
  const partial = Object.entries(DAILY_MONITOR_LINKS).find(([key]) =>
    candidates.some(candidate => key.includes(candidate) || candidate.includes(key))
  );
  return partial?.[1] ?? null;
}

export function allocationCategoryForReport(reportHref) {
  const href = (() => {
    try { return decodeURIComponent(reportHref); }
    catch { return reportHref; }
  })();
  if (href.includes('支柱产业')) return 'pillar';
  if (href.includes('战略资源')) return 'strategy';
  if (href.includes('新兴产业')) return 'emerging';
  return '';
}

function holdingValueForTrackingItem(item, holdings) {
  const itemCode = String(item.code ?? '').trim();
  const itemName = normalizeStockName(item.name);
  const holding = holdings.find(entry =>
    (itemCode && String(entry.code ?? '').trim() === itemCode)
    || (itemName && normalizeStockName(entry.name) === itemName)
  );
  const value = Number(holding?.quantity) * Number(holding?.price);
  if (Number.isFinite(value) && value > 0) return value;
  return item.status === '持有' ? 1 : 0;
}

function summarizeTrackingAllocation(items, holdings) {
  const buckets = Object.fromEntries(ALLOCATION_CATEGORIES.map(category => [category.key, { value: 0, targets: [] }]));
  for (const item of items) {
    if (item.status !== '持有') continue;
    const category = allocationCategoryForReport(reportLinkForTrackingItem(item));
    if (!category) continue;
    const value = holdingValueForTrackingItem(item, holdings);
    if (value <= 0) continue;
    buckets[category].value += value;
    buckets[category].targets.push({
      name: item.name,
      code: item.code,
      value,
      percent: 0,
    });
  }
  const total = Object.values(buckets).reduce((sum, bucket) => sum + bucket.value, 0);
  return ALLOCATION_CATEGORIES.map(category => {
    const bucket = buckets[category.key] ?? { value: 0, targets: [] };
    return {
      ...category,
      value: bucket.value,
      percent: total > 0 ? bucket.value / total * 100 : 0,
      targets: bucket.targets
        .map(target => ({ ...target, percent: total > 0 ? target.value / total * 100 : 0 }))
        .sort((left, right) => right.percent - left.percent),
    };
  });
}

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function nodeText(node) {
  return compactText(node?.textContent ?? '');
}

function tableValueByLabel(documentNode, labels) {
  for (const row of documentNode.querySelectorAll('tr')) {
    const cells = [...row.children].map(nodeText);
    if (cells.length < 2) continue;
    if (labels.some(label => cells[0].includes(label))) return cells[1];
  }
  return '';
}

function trackingCardValue(documentNode, key) {
  const card = documentNode.querySelector(`[data-tracking-key="${key}"]`);
  if (!card) return '';
  const value = nodeText(card.querySelector('.tracking-value'));
  const detail = nodeText(card.querySelector('.tracking-detail'));
  return [value, detail].filter(Boolean).join('；');
}

function firstTextMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return compactText(match[1]);
  }
  return '';
}

function priceRangeOnly(value) {
  const text = compactText(value);
  const match = text.match(/\d+(?:\.\d+)?\s*[—\-–至到]\s*\d+(?:\.\d+)?\s*元(?:\s*\/\s*股)?/);
  return match ? compactText(match[0]) : text;
}

export function leftEdgeFromValueRange(value) {
  const text = compactText(value);
  const match = text.match(/(\d+(?:\.\d+)?)\s*[—\-–至到]\s*\d+(?:\.\d+)?\s*元/);
  const leftEdge = match ? Number(match[1]) : NaN;
  return Number.isFinite(leftEdge) && leftEdge > 0 ? leftEdge : null;
}

export function valueRangePrices(value) {
  const text = compactText(value);
  const match = text.match(/(\d+(?:\.\d+)?)\s*[—\-–至到]\s*(\d+(?:\.\d+)?)/);
  const left = match ? Number(match[1]) : NaN;
  const right = match ? Number(match[2]) : NaN;
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0 || left >= right) return null;
  return { left, right, center: (left + right) / 2 };
}

export function trackingLeftEdgeDistance({ valueRange, livePrice, reportQuote } = {}) {
  const leftEdge = leftEdgeFromValueRange(valueRange);
  const price = Number.isFinite(Number(livePrice))
    ? Number(livePrice)
    : Number(compactText(reportQuote).match(/(\d+(?:\.\d+)?)/)?.[1]);
  if (!leftEdge || !Number.isFinite(price) || price <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(price - leftEdge) / leftEdge;
}

export function trackingSignalForQuote({ valueRange, livePrice, reportQuote, riskRewardRatio } = {}) {
  const range = valueRangePrices(valueRange);
  const price = Number.isFinite(Number(livePrice))
    ? Number(livePrice)
    : Number(compactText(reportQuote).match(/(\d+(?:\.\d+)?)/)?.[1]);
  if (!range || !Number.isFinite(price) || price <= 0) {
    return { addStars: 0, reducible: false };
  }
  const ratio = riskRewardRatio !== undefined
    ? Number(riskRewardRatio)
    : trackingRiskRewardForQuote({ valueRange, livePrice: price }).ratio;
  const isAddable = ratio > 1;
  if (price < range.left && isAddable) return { addStars: 2, reducible: false };
  if (price < range.center && isAddable) return { addStars: 1, reducible: false };
  return { addStars: 0, reducible: price > range.right };
}

export function trackingRiskRewardForQuote({ valueRange, livePrice } = {}) {
  const range = valueRangePrices(valueRange);
  const price = Number(livePrice);
  if (!range || !Number.isFinite(price) || price <= 0) {
    return { label: '等待实时', ratio: null, sortValue: Number.NEGATIVE_INFINITY };
  }
  const upside = range.right / price - 1;
  const downside = price / range.left - 1;
  if (price <= range.left) {
    return {
      label: '低于下沿',
      ratio: Number.POSITIVE_INFINITY,
      sortValue: Number.POSITIVE_INFINITY,
    };
  }
  if (price >= range.right) {
    return {
      label: '无正向盈亏比',
      ratio: 0,
      sortValue: 0,
    };
  }
  const ratio = upside / downside;
  return {
    label: `约 ${ratio.toFixed(1)}:1`,
    ratio,
    sortValue: ratio,
  };
}

export function trackingQuotePriceOnly(value) {
  const text = compactText(value);
  const price = text.match(/(\d+(?:\.\d+)?)\s*元/)?.[0];
  return price || text;
}

export function parseReportSummary(html) {
  if (typeof DOMParser === 'undefined') return {};
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const bodyText = nodeText(documentNode.body);
  const secid = documentNode.querySelector('meta[name="stock-secid"]')?.getAttribute('content')
    || firstTextMatch(html, [/stock-quote\?secid=([01]\.\d{6})/]);
  const fundamental = trackingCardValue(documentNode, 'fundamental-status')
    || [
      tableValueByLabel(documentNode, ['估值状态']),
      tableValueByLabel(documentNode, ['操作建议']),
    ].filter(Boolean).join('；')
    || firstTextMatch(bodyText, [
      /我的判断[：:]\s*([^。；]{8,120})/,
      /一句话[：:]\s*([^。；]{8,120})/,
    ]);
  const valueRange = priceRangeOnly(trackingCardValue(documentNode, 'dynamic-value-range')
    || tableValueByLabel(documentNode, ['综合估值区间', '公允价值', '估值区间'])
    || firstTextMatch(bodyText, [
      /综合公允价值(?:为|取)?\s*([0-9.]+[—\\-–至到][0-9.]+\s*元(?:\/股)?)/,
      /公允价值(?:为|取)?\s*([0-9.]+[—\\-–至到][0-9.]+\s*元(?:\/股)?)/,
      /综合估值区间\s*([0-9.]+[—\\-–至到][0-9.]+\s*元(?:\/股)?)/,
    ]));
  const reportQuote = trackingCardValue(documentNode, 'daily-quote')
    || tableValueByLabel(documentNode, ['当前价格及时间', '当前价格'])
    || firstTextMatch(bodyText, [/当前价格[：:]\s*([^。；]{3,80})/]);
  const riskDirection = firstTextMatch(bodyText, [
    /风险方向[：:]\s*([^。；，,]{2,40})/,
    /(风险重新增强)/,
    /(风险明显增强)/,
    /(风险增强)/,
    /(风险持平)/,
    /(风险减弱)/,
    /(风险释放)/,
  ]) || tableValueByLabel(documentNode, ['风险方向']);
  return {
    secid,
    fundamental,
    valueRange,
    reportQuote,
    riskDirection,
    sourceUpdated: documentNode.querySelector('#daily-tracking')?.getAttribute('data-updated-at')
      || firstTextMatch(bodyText, [/报告生成时间[：:]\s*([^。；]{6,50})/]),
  };
}

function metricStatus(metric) {
  return Number.isFinite(metric.score) ? metric.status : 'missing';
}

function normalizeSignalLevel(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^([ABCD])(?:[（(](.+)[）)])?$/);
  return match ? { grade: match[1], label: match[2] ?? '' } : { grade: '', label: text };
}

function signalDataTime(signal) {
  const date = signal?.indexDate || signal?.recordDate;
  const timestamp = date ? Date.parse(`${date}T15:00:00+08:00`) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function renderDividendSignalCard(signal) {
  if (!signal) {
    return `<button class="dividend-signal-card is-missing is-clickable-card" type="button" data-open-dividend-signal aria-label="查看红利信号详情">
      <div class="dividend-signal-main"><span>中证红利信号</span><strong>待接入</strong><p>未找到本地最新信号记录。</p></div>
    </button>`;
  }
  const absolute = normalizeSignalLevel(signal.absoluteSignal);
  const spread = normalizeSignalLevel(signal.spreadSignal);
  const percentile = normalizeSignalLevel(signal.percentileSignal);
  const isFocus = /重点买入区间|重点买入/.test(signal.headline ?? '') || [absolute, spread, percentile].some(item => item.grade === 'A');
  const displayDate = signal.indexDate || signal.recordDate || signal.runTime?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '日期待确认';
  return `<button class="dividend-signal-card is-clickable-card${isFocus ? ' is-focus' : ''}" type="button" data-open-dividend-signal aria-label="查看红利信号详情">
    <div class="dividend-signal-main">
      <span>中证红利股息率信号</span>
      <strong>${escapeHtml(isFocus ? '重点买入观察' : '未进重点买入')}</strong>
      <p>${escapeHtml(displayDate)}</p>
    </div>
    <div class="dividend-signal-grid">
      <div><small>股息率2</small><strong>${formatNumber(signal.dividendYield2, 2)}%</strong><span>${escapeHtml(absolute.grade ? `${absolute.grade} ${absolute.label}` : signal.absoluteSignal ?? '待验证')}</span></div>
      <div><small>10年国债</small><strong>${formatNumber(signal.bond10yYield, 2)}%</strong><span>${escapeHtml(signal.bondDate ?? '日期待确认')}</span></div>
      <div><small>股债利差</small><strong>${formatNumber(signal.spread, 2)}%</strong><span>${escapeHtml(spread.grade ? `${spread.grade} ${spread.label}` : signal.spreadSignal ?? '待验证')}</span></div>
      <div><small>历史分位</small><strong>${escapeHtml(percentile.grade || '待验证')}</strong><span>${escapeHtml(signal.percentileSignal ?? '待验证')}</span></div>
    </div>
  </button>`;
}

function renderDividendSignalDetail(signal) {
  if (!signal) {
    return `<article class="panel dividend-detail-empty">
      <p class="eyebrow">LOCAL SIGNAL</p>
      <h3>未找到本地最新信号记录</h3>
      <p>请先运行中证红利股息率信号检查，生成 sources/automations/中证红利信号/最新信号.md 后再查看详情。</p>
    </article>`;
  }
  const absolute = normalizeSignalLevel(signal.absoluteSignal);
  const spread = normalizeSignalLevel(signal.spreadSignal);
  const percentile = normalizeSignalLevel(signal.percentileSignal);
  const sourceNotes = String(signal.sourceNote ?? '').split(';').map(item => item.trim()).filter(Boolean);
  const sourceNoteText = sourceNotes.join('；');
  const sourceBoundary = pattern => sourceNotes.find(item => pattern.test(item)) ?? '';
  const sourceRows = [
    {
      metric: '股息率2',
      source: 'AKShare stock_zh_index_value_csindex(000922, 股息率2)',
      date: signal.indexDate || signal.recordDate || '待确认',
      note: sourceBoundary(/stock_zh_index_value_csindex|股息率2/) || '用于判断绝对股息率分档。',
    },
    {
      metric: '10年国债收益率',
      source: 'AKShare bond_zh_us_rate',
      date: signal.bondDate || '待确认',
      note: sourceBoundary(/bond_zh_us_rate|国债/) || '用于计算股债利差。',
    },
    {
      metric: '股债利差',
      source: '股息率2 - 10年国债收益率',
      date: `${signal.indexDate || '股息率日期待确认'} / ${signal.bondDate || '国债日期待确认'}`,
      note: '由上面两个指标计算，不是独立抓取字段。',
    },
    {
      metric: '历史分位',
      source: '理杏仁公开页面',
      date: signal.lixingerDate || '待确认',
      note: sourceBoundary(/理杏仁|lixinger/) || '用于检查近10年股息率分位与80%分位点。',
    },
    {
      metric: '雪球行情',
      source: '雪球实时行情接口',
      date: signal.recordDate || signal.runTime || '待确认',
      note: sourceBoundary(/雪球/) || '用于辅助记录当日涨跌幅；失败时不参与核心信号判断。',
    },
  ];
  return `<div class="dividend-detail-layout">
    <article class="panel dividend-detail-hero">
      <p class="eyebrow">CSI DIVIDEND SIGNAL</p>
      <h3>${escapeHtml(signal.headline ?? '暂无综合结论')}</h3>
      <div class="dividend-detail-actions">
        <span class="status-badge ${signal.status === 'latest' ? 'is-latest' : ''}">${signal.status === 'latest' ? '最新' : '快照'}</span>
        <a class="button-secondary" href="${CSI_DIVIDEND_SIGNAL_SOURCE_URL}" target="_blank" rel="noopener noreferrer">打开信号源</a>
      </div>
    </article>
    <div class="dividend-detail-metrics" aria-label="红利信号核心指标">
      <article><small>股息率2</small><strong>${formatNumber(signal.dividendYield2, 2)}%</strong><span>${escapeHtml(absolute.grade ? `${absolute.grade} ${absolute.label}` : signal.absoluteSignal ?? '待验证')}</span><span>${escapeHtml(signal.indexDate ?? signal.recordDate ?? '日期待确认')}</span></article>
      <article><small>10年国债</small><strong>${formatNumber(signal.bond10yYield, 2)}%</strong><span>${escapeHtml(signal.bondDate ?? '日期待确认')}</span></article>
      <article><small>股债利差</small><strong>${formatNumber(signal.spread, 2)}%</strong><span>${escapeHtml(spread.grade ? `${spread.grade} ${spread.label}` : signal.spreadSignal ?? '待验证')}</span></article>
      <article><small>历史分位</small><strong>${escapeHtml(percentile.grade || '待验证')}</strong><span>${escapeHtml(signal.percentileSignal ?? '待验证')}</span></article>
    </div>
    ${renderDividendYieldChart(CSI_DIVIDEND_YIELD_HISTORY)}
    <article class="panel dividend-detail-panel">
      <h3>历史分位点</h3>
      <div class="detail-data">
        <div><small>市值加权股息率</small><strong>${escapeHtml(signal.lixingerDividendYield || '待验证')}</strong></div>
        <div><small>近10年股息率分位</small><strong>${escapeHtml(signal.lixingerPercentile10y || '待验证')}</strong></div>
        <div><small>近10年80%分位点</small><strong>${escapeHtml(signal.lixingerPercentile80Value || '待验证')}</strong></div>
        <div><small>雪球当天涨跌幅</small><strong>${escapeHtml(signal.xueqiuChangePercent || '待验证')}</strong></div>
      </div>
    </article>
    <article class="panel dividend-detail-panel dividend-detail-source">
      <h3>来源与验证边界</h3>
      <ul>${sourceRows.map(item => `<li><strong>${escapeHtml(item.metric)}</strong>：${escapeHtml(item.source)}；日期：${escapeHtml(item.date)}；说明：${escapeHtml(item.note)}</li>`).join('')}</ul>
      ${sourceNoteText ? `<p>原始来源备注：${escapeHtml(sourceNoteText)}</p>` : ''}
    </article>
  </div>`;
}

function renderDividendYieldChart(points = []) {
  const valid = (Array.isArray(points) ? points : [])
    .map(point => ({ date: String(point.date ?? ''), value: Number(point.value) }))
    .filter(point => point.date && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!valid.length) {
    return `<article class="dividend-yield-chart-card">
      <div class="dividend-yield-chart-empty">暂无可绘制的股息率历史数据。</div>
    </article>`;
  }
  const width = 920;
  const height = 360;
  const padding = { top: 42, right: 72, bottom: 58, left: 46 };
  const values = valid.map(point => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(0.1, maxValue - minValue);
  const yMin = Math.max(0, Math.floor((minValue - span * 0.18) * 10) / 10);
  const yMax = Math.ceil((maxValue + span * 0.18) * 10) / 10;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xAt = index => padding.left + (valid.length === 1 ? plotWidth : index / (valid.length - 1) * plotWidth);
  const yAt = value => padding.top + (yMax - value) / (yMax - yMin) * plotHeight;
  const path = valid.map((point, index) => `${index ? 'L' : 'M'}${xAt(index).toFixed(2)},${yAt(point.value).toFixed(2)}`).join(' ');
  const ticks = Array.from({ length: 6 }, (_, index) => yMin + (yMax - yMin) * index / 5);
  const labelStep = Math.max(1, Math.ceil(valid.length / 8));
  const labels = valid.filter((_, index) => index % labelStep === 0 || index === valid.length - 1);
  const latest = valid.at(-1);
  const maxPoint = valid.reduce((current, point) => point.value > current.value ? point : current, valid[0]);
  const minPoint = valid.reduce((current, point) => point.value < current.value ? point : current, valid[0]);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const hoverMarkers = valid.map((point, index) => {
    const cx = xAt(index);
    const cy = yAt(point.value);
    const left = index === 0 ? padding.left : (xAt(index - 1) + cx) / 2;
    const right = index === valid.length - 1 ? width - padding.right : (cx + xAt(index + 1)) / 2;
    const tooltipWidth = 132;
    const tooltipHeight = 44;
    const tooltipX = clamp(cx + 10, padding.left, width - padding.right - tooltipWidth);
    const tooltipY = cy - tooltipHeight - 12 < 8 ? cy + 14 : cy - tooltipHeight - 12;
    const label = `${point.date} · 股息率 ${formatNumber(point.value, 2)}%`;
    return `<g class="dividend-hover-point" tabindex="0" aria-label="${escapeHtml(label)}">
        <title>${escapeHtml(label)}</title>
        <rect class="dividend-hover-hit" x="${left.toFixed(1)}" y="${padding.top}" width="${Math.max(1, right - left).toFixed(1)}" height="${height - padding.top - padding.bottom}"></rect>
        <line class="dividend-hover-line" x1="${cx.toFixed(1)}" y1="${padding.top}" x2="${cx.toFixed(1)}" y2="${height - padding.bottom}"></line>
        <circle class="dividend-hover-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5"></circle>
        <g class="dividend-hover-tooltip" transform="translate(${tooltipX.toFixed(1)} ${tooltipY.toFixed(1)})">
          <rect width="${tooltipWidth}" height="${tooltipHeight}" rx="6"></rect>
          <text x="10" y="17">${escapeHtml(point.date)}</text>
          <text x="10" y="34">股息率 ${formatNumber(point.value, 2)}%</text>
        </g>
      </g>`;
  }).join('');
  return `<article class="dividend-yield-chart-card">
    <div class="dividend-yield-chart-head">
      <div><p class="eyebrow">DIVIDEND YIELD HISTORY</p><h3>中证红利股息率走势</h3></div>
      <span>数据源：中证红利每日信号.xlsx</span>
    </div>
    <div class="dividend-yield-chart-layout">
      <svg class="dividend-yield-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="中证红利股息率折线图">
        <rect x="0" y="0" width="${width}" height="${height}" rx="0"></rect>
        ${ticks.map(tick => {
          const y = yAt(tick);
          return `<g><line x1="${padding.left}" y1="${y.toFixed(2)}" x2="${width - padding.right}" y2="${y.toFixed(2)}"></line><text x="${width - padding.right + 12}" y="${(y + 4).toFixed(2)}">${formatNumber(tick, 2)}%</text></g>`;
        }).join('')}
        <path d="${path}"></path>
        ${labels.map((point, index) => `<text class="x-label" x="${xAt(valid.indexOf(point)).toFixed(2)}" y="${height - 20}" transform="rotate(-40 ${xAt(valid.indexOf(point)).toFixed(2)} ${height - 20})">${escapeHtml(point.date.slice(5))}</text>`).join('')}
        ${hoverMarkers}
      </svg>
      <aside class="dividend-yield-chart-stats" aria-label="股息率统计">
        <div><small>最新股息率</small><strong>${formatNumber(latest.value, 2)}%</strong><span>${escapeHtml(latest.date)}</span></div>
        <div><small>区间最高</small><strong>${formatNumber(maxPoint.value, 2)}%</strong><span>${escapeHtml(maxPoint.date)}</span></div>
        <div><small>区间最低</small><strong>${formatNumber(minPoint.value, 2)}%</strong><span>${escapeHtml(minPoint.date)}</span></div>
        <div><small>区间均值</small><strong>${formatNumber(average, 2)}%</strong><span>${valid.length} 条记录</span></div>
      </aside>
    </div>
  </article>`;
}

function renderYouzhiyouxingTemperatureCard(envelope) {
  const data = envelope?.data;
  const sourceUrl = data?.sourceUrl ?? envelope?.sourceUrl ?? YOUZHIYOUXING_TEMPERATURE_URL;
  const status = envelope?.status ?? 'loading';
  if (status === 'latest' && data && Number.isFinite(data.temperature)) {
    const probabilities = data.probabilities ?? {};
    return `<a class="overview-card market-thermometer-card is-clickable-card" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="打开有知有行市场温度计源数据">
      <div class="overview-card-head"><span>市场温度计</span><strong>有知有行</strong></div>
      <div class="market-thermometer-main">
        <div class="market-temperature-value"><strong>${formatNumber(data.temperature, 0)}°</strong><span>${escapeHtml(data.band ?? '待确认')}</span></div>
        <div class="market-temperature-copy">
          <p>${escapeHtml(data.trend || '温度方向待确认')}</p>
          <small>${escapeHtml(data.updatedText || '更新时间待确认')}</small>
        </div>
      </div>
      <div class="market-temperature-scale" aria-label="有知有行全市场温度 ${formatNumber(data.temperature, 0)}°"><span style="--position:${clamp(data.temperature)}%"></span></div>
      <div class="market-temperature-bands">
        <div><small>低估</small><strong>${formatNumber(probabilities.low, 0)}%</strong></div>
        <div><small>中估</small><strong>${formatNumber(probabilities.mid, 0)}%</strong></div>
        <div><small>高估</small><strong>${formatNumber(probabilities.high, 0)}%</strong></div>
      </div>
      <span class="source-link">打开官方温度计</span>
    </a>`;
  }
  const copy = status === 'loading'
    ? '正在通过本地代理读取有知有行官方温度计。'
    : envelope?.error || '启动本地代理后读取有知有行官方温度计。';
  return `<a class="overview-card market-thermometer-card is-pending is-clickable-card" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="打开有知有行市场温度计源数据">
    <div class="overview-card-head"><span>市场温度计</span><strong>${status === 'loading' ? '读取中' : '待连接'}</strong></div>
    <p class="market-temperature-empty">${escapeHtml(copy)}</p>
    <span class="source-link">打开有知有行温度计</span>
  </a>`;
}

function renderNasdaq100Card(envelope) {
  const data = envelope?.data;
  if (envelope?.status === 'latest' && data && Number.isFinite(data.currentPoint)) {
    const drawdown = Number.isFinite(data.drawdownPercent) ? data.drawdownPercent : null;
    const drawdownText = drawdown === null ? '待验证' : `${drawdown.toFixed(2)}%`;
    const updatedText = data.updatedText || formatTime(data.updatedAt);
    return `<a class="overview-card nasdaq-card is-clickable-card" href="${NASDAQ100_SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="打开纳斯达克100指数行情">
      <div class="overview-card-head"><span>纳斯达克100指数</span><strong>NASDAQ 100</strong></div>
      <div class="nasdaq-main">
        <small>当前点位</small>
        <strong>${formatNumber(data.currentPoint, 2)}</strong>
        <span>${escapeHtml(updatedText)}</span>
      </div>
      <div class="nasdaq-drawdown ${drawdown !== null && drawdown <= -10 ? 'is-deep' : ''}">
        <small>距离历史最高点跌幅</small>
        <strong>${drawdownText}</strong>
        <span>最高点 ${formatNumber(data.highPoint, 2)}</span>
      </div>
    </a>`;
  }
  const copy = envelope?.status === 'loading'
    ? '正在读取纳斯达克100指数行情。'
    : envelope?.error || '启动本地代理后读取纳斯达克100指数。';
  return `<a class="overview-card nasdaq-card is-pending is-clickable-card" href="${NASDAQ100_SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="打开纳斯达克100指数行情">
    <div class="overview-card-head"><span>纳斯达克100指数</span><strong>待连接</strong></div>
    <p class="nasdaq-empty">${escapeHtml(copy)}</p>
  </a>`;
}

function renderMarginBalanceCard(envelope) {
  const points = Array.isArray(envelope?.data) ? envelope.data : [];
  const latest = points.at(-1);
  const previous = points.at(-2);
  const value = Number(latest?.value);
  const previousValue = Number(previous?.value);
  const change = Number.isFinite(value) && Number.isFinite(previousValue) ? value - previousValue : null;
  const changeClass = Number.isFinite(change) && change > 0 ? 'is-up' : Number.isFinite(change) && change < 0 ? 'is-down' : '';
  const status = STATUS_LABELS[envelope?.status] ?? '读取中';
  if (!Number.isFinite(value)) {
    return `<p class="eyebrow">MARGIN BALANCE</p>
      <h2 id="margin-balance-card-heading">融资余额</h2>
      <p class="shortcut-empty">${escapeHtml(envelope?.status === 'missing' ? '未获取到每日市场融资余额。' : '正在读取每日市场融资余额。')}</p>`;
  }
  return `<div>
      <p class="eyebrow">MARGIN BALANCE</p>
      <h2 id="margin-balance-card-heading">每日市场融资余额</h2>
    </div>
    <div class="margin-balance-main">
      <strong>${formatNumber(value / 100_000_000, 0)} 亿</strong>
      <span>${escapeHtml(latest.date || '日期待确认')}</span>
    </div>
    <div class="margin-balance-foot">
      <span class="${changeClass}">较前日 ${Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${formatNumber(change / 100_000_000, 0)} 亿` : '—'}</span>
      <small>${escapeHtml(status)} · ${escapeHtml(envelope?.source || 'Tushare')}</small>
    </div>`;
}

function marketMarginBalancePoints(payload) {
  const rows = Array.isArray(payload?.summary) ? payload.summary : [];
  return rows.flatMap(row => {
    const rawDate = String(row.trade_date ?? row.tradeDate ?? row.date ?? '');
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate.slice(0, 10);
    const value = Number(row.rzye);
    return date && Number.isFinite(value) ? [{ date, value }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

function renderMarginBalanceChart(points = []) {
  if (!Array.isArray(points) || points.length < 2) {
    return '<div class="margin-chart-empty">未获取到足够的融资余额数据。</div>';
  }
  const width = 760;
  const height = 280;
  const pad = { left: 58, right: 22, top: 22, bottom: 42 };
  const values = points.map(point => point.value / 1_000_000_000_000);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = index => pad.left + (index / Math.max(1, points.length - 1)) * (width - pad.left - pad.right);
  const y = value => pad.top + (max - value) / span * (height - pad.top - pad.bottom);
  const line = values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const hoverMarkers = points.map((point, index) => {
    const cx = x(index);
    const cy = y(values[index]);
    const left = index === 0 ? pad.left : (x(index - 1) + cx) / 2;
    const right = index === points.length - 1 ? width - pad.right : (cx + x(index + 1)) / 2;
    const tooltipWidth = 150;
    const tooltipHeight = 46;
    const tooltipX = clamp(cx + 10, pad.left, width - pad.right - tooltipWidth);
    const tooltipY = cy - tooltipHeight - 12 < 6 ? cy + 14 : cy - tooltipHeight - 12;
    const valueTrillion = point.value / 1_000_000_000_000;
    const label = `${point.date} · 融资余额 ${formatNumber(valueTrillion, 3)} 万亿`;
    return `<g class="margin-hover-point" tabindex="0" aria-label="${escapeHtml(label)}">
        <title>${escapeHtml(label)}</title>
        <rect class="margin-hover-hit" x="${left.toFixed(1)}" y="${pad.top}" width="${Math.max(1, right - left).toFixed(1)}" height="${height - pad.top - pad.bottom}"></rect>
        <line class="margin-hover-line" x1="${cx.toFixed(1)}" y1="${pad.top}" x2="${cx.toFixed(1)}" y2="${height - pad.bottom}"></line>
        <circle class="margin-hover-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5"></circle>
        <g class="margin-hover-tooltip" transform="translate(${tooltipX.toFixed(1)} ${tooltipY.toFixed(1)})">
          <rect width="${tooltipWidth}" height="${tooltipHeight}" rx="7"></rect>
          <text x="10" y="18">${escapeHtml(point.date)}</text>
          <text x="10" y="36">融资余额 ${formatNumber(valueTrillion, 3)} 万亿</text>
        </g>
      </g>`;
  }).join('');
  const latest = points.at(-1);
  const previous = points.at(-2);
  const latestTrillion = latest.value / 1_000_000_000_000;
  const changeTrillion = (latest.value - previous.value) / 1_000_000_000_000;
  const grid = [0, 0.5, 1].map(ratio => {
    const yy = pad.top + ratio * (height - pad.top - pad.bottom);
    const label = max - ratio * span;
    return `<line x1="${pad.left}" y1="${yy.toFixed(1)}" x2="${width - pad.right}" y2="${yy.toFixed(1)}"></line>
      <text x="${pad.left - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end">${formatNumber(label, 2)}</text>`;
  }).join('');
  const firstDate = points[0].date;
  const midDate = points[Math.floor(points.length / 2)].date;
  return `<article class="margin-chart-card">
    <div class="margin-chart-head">
      <div><p class="eyebrow">ONE YEAR</p><h4>融资余额折线</h4></div>
      <span>${escapeHtml(firstDate)} 至 ${escapeHtml(latest.date)}</span>
    </div>
    <svg class="margin-buy-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="近一年融资余额折线图">
      <rect x="0" y="0" width="${width}" height="${height}"></rect>
      ${grid}
      <path d="${line}"></path>
      <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(latestTrillion).toFixed(1)}" r="4"></circle>
      ${hoverMarkers}
      <text class="x-label" x="${pad.left}" y="${height - 14}" text-anchor="start">${escapeHtml(firstDate)}</text>
      <text class="x-label" x="${width / 2}" y="${height - 14}" text-anchor="middle">${escapeHtml(midDate)}</text>
      <text class="x-label" x="${width - pad.right}" y="${height - 14}" text-anchor="end">${escapeHtml(latest.date)}</text>
    </svg>
    <div class="margin-chart-stats">
      <div><small>最新融资余额</small><strong>${formatNumber(latestTrillion, 3)} 万亿</strong><span>${escapeHtml(latest.date)}</span></div>
      <div><small>较前日变化</small><strong class="${changeTrillion > 0 ? 'is-up' : changeTrillion < 0 ? 'is-down' : ''}">${changeTrillion >= 0 ? '+' : ''}${formatNumber(changeTrillion, 3)} 万亿</strong><span>截至收盘尚未偿还的融资负债变化</span></div>
      <div><small>指标含义</small><strong>${points.length}</strong><span>截至某个交易日收盘，投资者尚未偿还的融资负债总额。</span></div>
    </div>
  </article>`;
}

function riskLevelForDashboard(derived) {
  const usTreasuryLatest = Array.isArray(derived?.usTreasury10y?.data)
    ? derived.usTreasury10y.data.at(-1)
    : null;
  const usTreasuryYield = Number(usTreasuryLatest?.value);
  const rateRiskHigh = Number.isFinite(usTreasuryYield) && usTreasuryYield > 4.5;
  const dollarLatest = Array.isArray(derived?.usDollarIndex?.data)
    ? derived.usDollarIndex.data.at(-1)
    : null;
  const dollarIndex = Number(dollarLatest?.value);
  const dollarRiskHigh = Number.isFinite(dollarIndex) && dollarIndex > 100;
  const highRisk = rateRiskHigh || dollarRiskHigh;
  const highRiskMessages = [
    rateRiskHigh ? `美国10年国债收益率 ${formatNumber(usTreasuryYield, 2)}%，已高于 4.5% 风险线。` : '',
    dollarRiskHigh ? `美元指数 ${formatNumber(dollarIndex, 2)}，已高于 100 风险线。` : '',
  ].filter(Boolean);
  return {
    label: highRisk ? '高风险' : '暂空',
    className: highRisk ? 'is-high' : 'is-unknown',
    riskScore: highRisk ? 80 : null,
    buyScore: Number(derived?.score?.score),
    action: highRisk
      ? highRiskMessages.join(' ')
      : '风险等级计算暂未接入，当前页面先用于集中观察融资、温度计、美债利率和美元指数信号。',
    usTreasury10y: {
      date: usTreasuryLatest?.date ?? null,
      value: Number.isFinite(usTreasuryYield) ? usTreasuryYield : null,
      highRisk: rateRiskHigh,
      status: derived?.usTreasury10y?.status ?? 'missing',
    },
    usDollarIndex: {
      date: dollarLatest?.date ?? null,
      value: Number.isFinite(dollarIndex) ? dollarIndex : null,
      highRisk: dollarRiskHigh,
      status: derived?.usDollarIndex?.status ?? 'missing',
    },
  };
}

function riskWatchMissingLabel(entry) {
  if (entry?.status === 'missing') return '数据源为空';
  if (entry?.status === 'expired') return '缓存过期';
  return '等待数据';
}

function updateRiskMonitor(derived) {
  const risk = riskLevelForDashboard(derived);
  const setText = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };
  const riskLevelNodes = [
    document.getElementById('risk-level-value'),
    document.getElementById('risk-screen-level'),
  ];
  riskLevelNodes.forEach(node => {
    if (!node) return;
    node.textContent = risk.label;
    node.className = risk.className;
  });
  setText('risk-level-detail', Number.isFinite(risk.riskScore)
    ? `综合风险 ${formatNumber(risk.riskScore, 0)} / 100`
    : '风险等级计算暂未接入');
  setText('risk-score-value', Number.isFinite(risk.riskScore) ? formatNumber(risk.riskScore, 0) : '--');
  setText('risk-buy-score', Number.isFinite(risk.buyScore) ? formatNumber(risk.buyScore, 1) : '--');
  setText('risk-coverage', `${formatNumber(derived?.score?.coverage, 1)}%`);
  setText('risk-screen-summary', risk.action);
  setText('risk-monitor-updated', `统计窗口 ${derived?.windowYears ?? 5} 年 · ${formatTime(derived?.generatedAt)}`);
  const layers = Object.values(derived?.layers ?? {});
  const watchList = document.getElementById('risk-watch-list');
  if (watchList) {
    const us = risk.usTreasury10y;
    const dollar = risk.usDollarIndex;
    const usLabel = Number.isFinite(us.value)
      ? `${formatNumber(us.value, 2)}% · ${us.highRisk ? '高风险' : '未触发'}`
      : riskWatchMissingLabel(us);
    const dollarLabel = Number.isFinite(dollar.value)
      ? `${formatNumber(dollar.value, 2)} · ${dollar.highRisk ? '高风险' : '未触发'}`
      : riskWatchMissingLabel(dollar);
    watchList.innerHTML = [
      ...layers.map(layer => `<li><span>${escapeHtml(layer.label)}</span><strong>${formatNumber(layer.score, 1)}</strong></li>`),
      `<li class="${us.highRisk ? 'is-high-risk' : ''}"><span>美债10年</span><strong>${escapeHtml(usLabel)}</strong></li>`,
      `<li class="${dollar.highRisk ? 'is-high-risk' : ''}"><span>美元指数</span><strong>${escapeHtml(dollarLabel)}</strong></li>`,
    ].join('');
  }
}

function renderEventCalendar(events = EVENT_CALENDAR) {
  const list = document.getElementById('event-calendar-list');
  const count = document.getElementById('event-calendar-count');
  if (!list || !count) return;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...events]
    .filter(event => event && typeof event === 'object')
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  count.textContent = `${sorted.length} 项`;
  if (!sorted.length) {
    list.innerHTML = '<p class="event-calendar-empty">暂无事件。可在 src/event-calendar.json 中维护财报、政策、会议、解禁、复核节点等事件。</p>';
    return;
  }
  list.innerHTML = sorted.map(event => {
    const date = String(event.date ?? '');
    const isPast = date && date < today;
    const isToday = date === today;
    const badge = isToday ? '今日' : isPast ? '已过' : '待跟踪';
    return `<article class="event-calendar-item ${isToday ? 'is-today' : isPast ? 'is-past' : ''}">
      <time datetime="${escapeHtml(date)}">${escapeHtml(date || '待定')}</time>
      <div>
        <div class="event-calendar-title"><span>${escapeHtml(event.type || '事件')}</span><strong>${escapeHtml(event.title || '未命名事件')}</strong></div>
        <p>${escapeHtml(event.note || event.scope || '待补充说明')}</p>
      </div>
      <b>${badge}</b>
    </article>`;
  }).join('');
}

function detailCard(metric) {
  const status = metricStatus(metric);
  return `<article class="detail-card">
    <div class="detail-top"><h3>${escapeHtml(metric.label)}</h3><span class="status-badge is-${status}">${STATUS_LABELS[status] ?? status}</span></div>
    <div class="detail-data">
      <div><small>原始值</small><strong>${formatValue(metric)}</strong></div>
      <div><small>历史分位</small><strong>${formatNumber(metric.percentile, 1)}%</strong></div>
      <div><small>买点得分</small><strong>${formatNumber(metric.score, 1)}</strong></div>
      <div><small>有效权重</small><strong>${formatNumber(metric.effectiveWeight, 1)}%</strong></div>
      <div><small>数据来源</small><strong>${escapeHtml(metric.source)}</strong></div>
      <div><small>数据时间</small><strong>${formatTime(metric.dataAt)}</strong></div>
    </div>
    <p class="formula">${escapeHtml(metric.formula)}</p>
  </article>`;
}

function renderDerived(derived, officialTemperature = { status: 'loading' }, nasdaq100 = { status: 'loading' }) {
  const byId = id => document.getElementById(id);
  const scoreValue = derived.score.score;
  byId('conclusion-label').textContent = derived.conclusion.label;
  byId('conclusion-detail').textContent = derived.conclusion.actionable
    ? '这是历史赔率判断，不是短期涨跌预测；按既定仓位规则分批执行。'
    : '有效数据覆盖率低于 70%，当前分数仅供试算，不输出行动性结论。';
  byId('score-value').textContent = formatNumber(scoreValue, 1);
  byId('coverage-value').textContent = `覆盖率 ${formatNumber(derived.score.coverage, 1)}%`;
  byId('data-mode').textContent = derived.mode === 'example' ? '示例' : '联网';
  byId('temperature-title').textContent = derived.conclusion.label;
  byId('temperature-updated').textContent = `统计窗口 ${derived.windowYears} 年`;
  byId('temperature-marker').style.setProperty('--position', `${Number.isFinite(scoreValue) ? clamp(100 - scoreValue) : 50}%`);

  byId('layer-scores').innerHTML = Object.values(derived.layers).map(layer => `<article class="layer-card">
    <div class="layer-head"><div><strong>${layer.label}</strong><span> · ${layer.targetWeight}%</span></div><strong>${formatNumber(layer.score, 1)}</strong></div>
    <div class="layer-rule"><span style="--score:${Number.isFinite(layer.score) ? clamp(layer.score) : 0}%"></span></div>
    <p>${layer.description} · 层内覆盖 ${formatNumber(layer.coverage, 0)}%</p>
  </article>`).join('');
  byId('youzhiyouxing-temperature-card').innerHTML = renderYouzhiyouxingTemperatureCard(officialTemperature);
  byId('dividend-signal-card').innerHTML = renderDividendSignalCard(CSI_DIVIDEND_SIGNAL);
  byId('dividend-signal-detail').innerHTML = renderDividendSignalDetail(CSI_DIVIDEND_SIGNAL);
  byId('nasdaq100-card').innerHTML = renderNasdaq100Card(nasdaq100);
  if (byId('margin-balance-card')) {
    byId('margin-balance-card').innerHTML = renderMarginBalanceCard(derived.margin);
  }
  updateRiskMonitor(derived);
  renderEventCalendar();

  byId('metric-list').innerHTML = derived.metrics.map(metric => {
    const missing = !Number.isFinite(metric.score);
    return `<article class="metric-row${missing ? ' is-missing' : ''}">
      <div class="metric-name"><strong>${escapeHtml(metric.label)}</strong><small>${escapeHtml(metric.formula)}</small></div>
      <div class="metric-scale" aria-label="${escapeHtml(metric.label)}历史分位 ${formatNumber(metric.percentile, 1)}%"><span class="metric-marker" style="--position:${Number.isFinite(metric.percentile) ? clamp(metric.percentile) : 50}%"></span></div>
      <div class="metric-value"><strong>${formatValue(metric)}</strong><small>当前值</small></div>
      <div class="metric-score"><strong>${formatNumber(metric.score, 1)}</strong><small>买点得分</small></div>
    </article>`;
  }).join('');

  for (const layer of ['position', 'valuation', 'emotion']) {
    byId(`${layer}-details`).innerHTML = derived.metrics.filter(metric => metric.layer === layer).map(detailCard).join('');
  }
  byId('rules-weights').innerHTML = derived.metrics.map(metric => `<div class="weight-row"><span>${escapeHtml(metric.label)}</span><strong>${metric.weight}%</strong></div>`).join('');
  const validCount = derived.metrics.filter(metric => Number.isFinite(metric.score)).length;
  const dividendErrors = CSI_DIVIDEND_SIGNAL?.sourceNote
    ? CSI_DIVIDEND_SIGNAL.sourceNote.split(';').map(item => item.trim()).filter(item => /失败|待验证|429|空响应/.test(item))
    : [];
  const temperatureError = officialTemperature.status === 'missing' && officialTemperature.error ? [officialTemperature.error] : [];
  const errors = [...new Set([...derived.metrics.flatMap(metric => metric.errors ?? []), ...dividendErrors, ...temperatureError])];
  byId('audit-summary').innerHTML = `
    <div><small>规则版本</small><strong>v1.0</strong></div>
    <div><small>有效指标</small><strong>${validCount} / ${derived.metrics.length}</strong></div>
    <div><small>有效覆盖率</small><strong>${formatNumber(derived.score.coverage, 1)}%</strong></div>
    <div><small>接口错误</small><strong>${errors.length}</strong></div>`;
  byId('audit-errors').innerHTML = errors.length
    ? `<ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`
    : '';
  const dividendAuditRow = CSI_DIVIDEND_SIGNAL ? `<tr>
    <td>中证红利股息率信号</td><td>${CSI_DIVIDEND_SIGNAL.status === 'latest' ? '最新' : '快照'}</td><td>${escapeHtml(CSI_DIVIDEND_SIGNAL.source ?? 'zzhl-dividend-signal 最新信号')}</td>
    <td>${formatTime(signalDataTime(CSI_DIVIDEND_SIGNAL))}</td><td>观察项</td><td>—</td><td>—</td>
  </tr>` : `<tr class="is-missing">
    <td>中证红利股息率信号</td><td>缺失</td><td>本地最新信号</td><td>—</td><td>观察项</td><td>—</td><td>—</td>
  </tr>`;
  const temperatureAuditRow = `<tr${officialTemperature.status === 'missing' ? ' class="is-missing"' : ''}>
    <td>有知有行市场温度计</td><td>${officialTemperature.status === 'latest' ? '最新' : officialTemperature.status === 'loading' ? '读取中' : '缺失'}</td><td>有知有行公开温度计</td>
    <td>${escapeHtml(officialTemperature.data?.updatedText ?? '—')}</td><td>观察项</td><td>—</td><td>—</td>
  </tr>`;
  byId('audit-table-body').innerHTML = derived.metrics.map(metric => `<tr>
    <td>${escapeHtml(metric.label)}</td><td>${STATUS_LABELS[metricStatus(metric)] ?? metricStatus(metric)}</td><td>${escapeHtml(metric.source)}</td>
    <td>${formatTime(metric.dataAt)}</td><td>${metric.weight}%</td><td>${formatNumber(metric.effectiveWeight, 1)}%</td><td>${formatNumber(metric.contribution, 2)}</td>
  </tr>`).join('') + temperatureAuditRow + dividendAuditRow;
  byId('sidebar-valid').textContent = `${validCount} / ${derived.metrics.length} 项有效`;
  byId('sidebar-updated').textContent = formatTime(Math.max(...derived.metrics.map(metric => Number(metric.fetchedAt)).filter(Number.isFinite)));
  byId('sidebar-status').textContent = derived.mode === 'example' ? '等待联网' : derived.score.coverage >= 70 ? '数据可判断' : '数据不完整';
  byId('sidebar-status-dot').className = `status-dot ${derived.mode !== 'example' && derived.score.coverage >= 70 ? 'is-live' : derived.mode !== 'example' ? 'is-error' : ''}`;
}

export function isTradingSession(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
  if (['Sat', 'Sun'].includes(parts.weekday)) return false;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return (minutes >= 570 && minutes <= 690) || (minutes >= 780 && minutes <= 900);
}

export function resolveStorage(getStorage = () => globalThis.localStorage) {
  try {
    const storage = getStorage();
    const probe = '__a_share_dashboard_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

export function summarizeHoldings(holdings = []) {
  const items = holdings.map(holding => {
    const quantity = Math.max(0, Number(holding.quantity) || 0);
    const cost = Math.max(0, Number(holding.cost) || 0);
    const price = Math.max(0, Number(holding.price) || 0);
    const costValue = quantity * cost;
    const marketValue = quantity * price;
    const profit = marketValue - costValue;
    return {
      ...holding,
      quantity,
      cost,
      price,
      costValue: roundMoney(costValue),
      marketValue: roundMoney(marketValue),
      profit: roundMoney(profit),
      profitRate: costValue > 0 ? roundMoney((profit / costValue) * 100) : 0,
      weight: 0,
    };
  });
  const costValue = roundMoney(items.reduce((sum, item) => sum + item.costValue, 0));
  const marketValue = roundMoney(items.reduce((sum, item) => sum + item.marketValue, 0));
  const profit = roundMoney(marketValue - costValue);
  return {
    costValue,
    marketValue,
    profit,
    profitRate: costValue > 0 ? roundMoney((profit / costValue) * 100) : 0,
    items: items.map(item => ({
      ...item,
      weight: marketValue > 0 ? roundMoney((item.marketValue / marketValue) * 100) : 0,
    })),
  };
}

function normalizeHoldings(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && typeof item === 'object').map(item => ({
      id: String(item.id ?? ''),
      code: String(item.code ?? '').slice(0, 12),
      name: String(item.name ?? '').slice(0, 30),
      quantity: Math.max(0, Number(item.quantity) || 0),
      cost: Math.max(0, Number(item.cost) || 0),
      price: Math.max(0, Number(item.price) || 0),
      status: HOLDING_STATUSES.has(item.status) ? item.status : '持有',
      note: String(item.note ?? '').slice(0, 240),
      updatedAt: Number(item.updatedAt) || Date.now(),
    })).filter(item => item.id && item.code && item.name);
}

export function normalizeTrackingItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && typeof item === 'object').map(item => ({
      id: String(item.id ?? '').slice(0, 80),
      code: String(item.code ?? '').trim().slice(0, 12),
      name: String(item.name ?? '').trim().slice(0, 30),
      status: HOLDING_STATUSES.has(item.status) ? item.status : '观察',
      thesis: String(item.thesis ?? '').trim().slice(0, 300),
      riskLine: String(item.riskLine ?? '').trim().slice(0, 220),
      nextAction: String(item.nextAction ?? '').trim().slice(0, 80),
      reviewCondition: String(item.reviewCondition ?? '').trim().slice(0, 220),
      updatedAt: Number(item.updatedAt) || Date.now(),
    })).filter(item => item.id && item.name);
}

export function summarizeTrackingItems(items = []) {
  const normalized = normalizeTrackingItems(items);
  const countByStatus = Object.fromEntries([...HOLDING_STATUSES].map(status => [status, 0]));
  for (const item of normalized) countByStatus[item.status] += 1;
  return {
    items: normalized.sort((left, right) => right.updatedAt - left.updatedAt),
    count: normalized.length,
    countByStatus,
    latestUpdatedAt: normalized.length ? Math.max(...normalized.map(item => item.updatedAt)) : null,
  };
}

export function findDuplicateTrackingItem(items = [], candidate = {}, editingId = '') {
  const candidateCode = String(candidate.code ?? '').trim();
  const candidateName = String(candidate.name ?? '').trim();
  return normalizeTrackingItems(items).find(item =>
    item.id !== editingId
    && (
      (candidateCode && item.code === candidateCode)
      || (candidateName && item.name === candidateName)
    )
  ) ?? null;
}

function finitePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function evaluateFuguiStrategyCandidate(item = {}) {
  const ownership = String(item.ownership ?? '').trim();
  const dividendYield = finitePositiveNumber(item.dividendYield);
  const price = finitePositiveNumber(item.price);
  const bond10yYield = finitePositiveNumber(item.bond10yYield);
  const issues = [];
  if (bond10yYield === null) issues.push('10年国债利率无效');
  const dividendYieldMin = bond10yYield === null ? null : bond10yYield * 3;
  if (dividendYield === null || (dividendYieldMin !== null && dividendYield < dividendYieldMin)) {
    issues.push('股息率未达到3倍10年国债利率');
  }
  return {
    passed: issues.length === 0,
    issues,
    criteria: {
      ownership,
      marketCapMinYi: FUGUI_STRATEGY_RULES.marketCapMinYi,
      priceMax: FUGUI_STRATEGY_RULES.priceMax,
      price,
      bond10yYield,
      dividendYieldMin: dividendYieldMin === null ? null : roundMoney(dividendYieldMin),
    },
  };
}

export function normalizeFuguiStrategyItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && typeof item === 'object').map(item => {
    const marketCapYi = finitePositiveNumber(item.marketCapYi);
    const dividendYield = finitePositiveNumber(item.dividendYield);
    const expectedDividendYield = finitePositiveNumber(item.expectedDividendYield);
    const price = finitePositiveNumber(item.price);
    const bond10yYield = finitePositiveNumber(item.bond10yYield);
    const weeklyMiddle = finitePositiveNumber(item.weeklyMiddle);
    const weeklyLower = finitePositiveNumber(item.weeklyLower);
    const dailyLower = finitePositiveNumber(item.dailyLower);
    return {
      id: String(item.id ?? '').slice(0, 80),
      industry: String(item.industry ?? '').trim().slice(0, 24),
      name: String(item.name ?? '').trim().slice(0, 30),
      code: String(item.code ?? '').trim().slice(0, 12),
      ownership: String(item.ownership ?? '').trim().slice(0, 8),
      marketCapYi,
      dividendYield,
      expectedDividendYield,
      price,
      bond10yYield,
      weeklyMiddle,
      weeklyLower,
      dailyLower,
      addedAt: Number(item.addedAt) || Date.now(),
    };
  }).filter(item =>
    item.id
    && item.industry
    && item.name
    && item.marketCapYi !== null
    && item.dividendYield !== null
    && item.price !== null
    && item.bond10yYield !== null
  );
}

function normalizePortfolioPayload(payload) {
  if (Array.isArray(payload)) {
    return { holdings: normalizeHoldings(payload), trackingItems: [] };
  }
  if (!payload || typeof payload !== 'object') {
    return { holdings: [], trackingItems: [] };
  }
  return {
    holdings: normalizeHoldings(payload.holdings),
    trackingItems: normalizeTrackingItems(payload.trackingItems),
  };
}

function loadPortfolio(storage) {
  try {
    return normalizePortfolioPayload(JSON.parse(storage.getItem(PORTFOLIO_STORAGE_KEY) ?? '{}'));
  } catch {
    return { holdings: [], trackingItems: [] };
  }
}

export function resolveTreeNavigation(activeViews, requestedDomain, requestedView = null) {
  const defaults = {
    thermometer: 'market-summary',
    strategy: 'fugui-strategy',
    industry: 'industry-strategy',
    personal: 'position-manager',
    changelog: 'changelog-view',
  };
  const domain = Object.hasOwn(defaults, requestedDomain) ? requestedDomain : 'thermometer';
  return { domain, viewId: requestedView ?? activeViews[domain] ?? defaults[domain] };
}

export function shouldApplyPortfolioLoad(requestVersion, currentVersion) {
  return requestVersion === currentVersion;
}

function startApp() {
  const state = {
    snapshot: EXAMPLE_SNAPSHOT,
    windowYears: 5,
    busy: false,
    youzhiyouxingTemperature: { status: 'loading', sourceUrl: YOUZHIYOUXING_TEMPERATURE_URL },
    nasdaq100: { status: 'loading', sourceUrl: NASDAQ100_SOURCE_URL },
    fuguiStrategy: { items: [] },
  };
  const storage = resolveStorage();
  let { holdings, trackingItems } = loadPortfolio(storage);
  let portfolioVersion = 0;
  let fuguiStrategyItems = [];
  try {
    fuguiStrategyItems = normalizeFuguiStrategyItems(JSON.parse(storage.getItem(FUGUI_STRATEGY_STORAGE_KEY) ?? '[]'));
  } catch {
    fuguiStrategyItems = [];
  }
  state.fuguiStrategy.items = fuguiStrategyItems;
  let featuredDeletedIds = new Set();
  try {
    featuredDeletedIds = new Set(JSON.parse(storage.getItem(FEATURED_DELETED_STORAGE_KEY) ?? '[]'));
  } catch {
    featuredDeletedIds = new Set();
  }
  let trackingStatusFilter = 'all';
  let trackingAllocationMode = false;
  let trackingAllocationCollapsed = false;
  let trackingSortMode = 'updated';
  let fuguiStatusFilter = 'all';
  let fuguiTtmSortMode = 'none';
  const reportSummaryCache = new Map();
  const trackingQuoteCache = new Map();
  const trackingClosePerformanceCache = new Map();
  const fuguiDividendYieldCache = new Map();
  const launcherHint = globalThis.location?.protocol === 'file:'
    ? ' 稳定联网请双击“启动面板.cmd”。'
    : '';
  const notice = document.getElementById('global-notice');
  const refreshButton = document.getElementById('refresh-data');
  const fuguiProviderToggle = document.getElementById('fugui-provider-toggle');
  const exampleToggle = document.getElementById('example-mode');
  const marketActions = document.getElementById('market-actions');
  const fuguiStrategyForm = document.getElementById('fugui-strategy-form');
  const fuguiPanelCollapseButton = document.getElementById('fugui-panel-collapse');
  const fuguiPanelOpenButton = document.getElementById('fugui-panel-open');
  const fuguiStrategyStatus = document.getElementById('fugui-strategy-status');
  const fuguiStrategyBody = document.getElementById('fugui-strategy-body');
  const fuguiTtmSortButton = document.getElementById('fugui-sort-ttm');
  const topbar = document.querySelector('.topbar');
  const pageTitle = document.getElementById('page-title');
  const pageEyebrow = document.querySelector('.topbar .eyebrow');
  const sidebarFooter = document.querySelector('.sidebar-footer');
  const activeViewByShell = {
    thermometer: 'market-summary',
    strategy: 'fugui-strategy',
    industry: 'industry-strategy',
    personal: 'position-manager',
    changelog: 'changelog-view',
  };

  const formatMoney = value => `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatYi = value => Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  let fuguiDataProvider = storage.getItem(FUGUI_PROVIDER_STORAGE_KEY) === 'tushare' ? 'tushare' : 'akshare';

  const renderFuguiProviderToggle = () => {
    if (!fuguiProviderToggle) return;
    fuguiProviderToggle.textContent = fuguiDataProvider === 'akshare' ? '切换到Tushare' : '切换到AKShare';
    fuguiProviderToggle.setAttribute('aria-label', `当前富贵策略数据源：${fuguiDataProvider === 'akshare' ? 'AKShare' : 'Tushare'}`);
  };

  const setFuguiPanelCollapsed = collapsed => {
    fuguiStrategyForm?.classList.toggle('is-collapsed', collapsed);
    if (fuguiPanelOpenButton) fuguiPanelOpenButton.hidden = !collapsed;
    fuguiPanelCollapseButton?.setAttribute('aria-expanded', String(!collapsed));
    storage.setItem(FUGUI_PANEL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  };

  const renderFuguiStrategy = () => {
    const items = state.fuguiStrategy.items;
    if (!items.length) {
      fuguiStrategyBody.innerHTML = '<tr><td>待补充</td><td>待补充</td><td>待补充</td><td>待补充</td><td>待补充</td><td>待补充</td><td>—</td></tr>';
      return;
    }
    const rows = items
      .map(item => {
        const secid = stockSecidFromCode(item.code);
        let quoteEntry = secid ? trackingQuoteCache.get(secid) : null;
        let dividendEntry = secid ? fuguiDividendYieldCache.get(secid) : null;
        if (secid && isLocalProxyLocation() && !quoteEntry) {
          quoteEntry = { status: 'loading' };
          trackingQuoteCache.set(secid, quoteEntry);
          loadTrackingQuote(secid).then(() => renderFuguiStrategy());
        }
        if (secid && isLocalProxyLocation() && !dividendEntry) {
          dividendEntry = { status: 'loading' };
          fuguiDividendYieldCache.set(secid, dividendEntry);
          loadFuguiDividendYield(secid).then(() => renderFuguiStrategy());
        }
        const result = evaluateFuguiStrategyCandidate(item);
        const ttmDividendYield = dividendEntry?.status === 'loaded'
          ? finitePositiveNumber(dividendEntry.data?.dividendYieldTtm)
          : null;
        return { item, result, quoteEntry, dividendEntry, ttmDividendYield, livePrice: quoteEntry?.quote?.price };
      })
      .filter(({ result }) =>
        fuguiStatusFilter === 'all'
        || (fuguiStatusFilter === 'passed' && result.passed)
        || (fuguiStatusFilter === 'failed' && !result.passed)
      );
    if (fuguiTtmSortButton) {
      fuguiTtmSortButton.classList.toggle('is-active', fuguiTtmSortMode !== 'none');
      fuguiTtmSortButton.classList.toggle('is-asc', fuguiTtmSortMode === 'ttm-asc');
      fuguiTtmSortButton.classList.toggle('is-desc', fuguiTtmSortMode === 'ttm-desc');
      fuguiTtmSortButton.setAttribute('aria-pressed', String(fuguiTtmSortMode !== 'none'));
    }
    if (fuguiTtmSortMode !== 'none') {
      const direction = fuguiTtmSortMode === 'ttm-asc' ? 1 : -1;
      rows.sort((left, right) => {
        const leftValue = Number.isFinite(left.ttmDividendYield) ? left.ttmDividendYield : null;
        const rightValue = Number.isFinite(right.ttmDividendYield) ? right.ttmDividendYield : null;
        if (leftValue === null && rightValue === null) return 0;
        if (leftValue === null) return 1;
        if (rightValue === null) return -1;
        return (leftValue - rightValue) * direction;
      });
    }
    if (!rows.length) {
      fuguiStrategyBody.innerHTML = '<tr><td colspan="7">没有符合当前筛选的标的。</td></tr>';
      return;
    }
    fuguiStrategyBody.innerHTML = rows.map(({ item, result, quoteEntry, dividendEntry, ttmDividendYield, livePrice }) => {
      const renderGridLine = (label, value, suffix = '元', emptyText = '待接入') =>
        `<span class="fugui-grid-line"><b>${escapeHtml(label)}</b><strong>${Number.isFinite(value) ? `${formatNumber(value, 2)}${suffix}` : escapeHtml(emptyText)}</strong></span>`;
      const renderGridValue = (value, suffix = '', emptyText = '') =>
        `<span class="fugui-grid-line"><strong>${Number.isFinite(value) ? `${formatNumber(value, 2)}${suffix}` : escapeHtml(emptyText)}</strong></span>`;
      const livePriceValue = Number.isFinite(livePrice) ? livePrice : item.price;
      const livePriceSuffix = Number.isFinite(livePrice) ? '元' : quoteEntry?.status === 'loading' ? '' : '元';
      const savedPrice = finitePositiveNumber(item.price);
      const savedDividendYield = finitePositiveNumber(item.dividendYield);
      const impliedDividendPerShare = savedPrice !== null && savedDividendYield !== null
        ? savedPrice * savedDividendYield / 100
        : null;
      const expectedDividendYield = finitePositiveNumber(item.expectedDividendYield);
      const targetDividendPrice = targetYield => impliedDividendPerShare !== null && targetYield > 0
        ? impliedDividendPerShare / (targetYield / 100)
        : NaN;
      return `<tr>
      <td>${escapeHtml(item.industry)}</td>
      <td>
        ${escapeHtml(item.name)}
        <small>${escapeHtml(item.code || '未填代码')} · ${escapeHtml(item.ownership)}</small>
        <div class="fugui-symbol-meta">
          ${renderGridLine('市值', item.marketCapYi, '亿')}
          ${quoteEntry?.status === 'loading' && !Number.isFinite(livePrice) ? '<span class="fugui-grid-line"><b>现价</b><strong>读取中…</strong></span>' : renderGridLine('现价', livePriceValue, livePriceSuffix)}
        </div>
      </td>
      <td>
        ${dividendEntry?.status === 'loading'
          ? '<span class="fugui-grid-line"><strong>读取中…</strong></span>'
          : renderGridValue(ttmDividendYield, '%')}
      </td>
      <td>
        ${renderGridValue(expectedDividendYield, '%', '待接入')}
      </td>
      <td>
        <div class="fugui-grid-list is-value-anchor">
          ${renderGridLine('5%', targetDividendPrice(5))}
          ${renderGridLine('5.5%', targetDividendPrice(5.5))}
          ${renderGridLine('6%', targetDividendPrice(6))}
        </div>
      </td>
      <td>${result.passed ? '达标' : '未达标'}<small>${escapeHtml(result.passed ? '股息率达标' : result.issues.join('；'))}</small></td>
      <td><button class="fugui-remove" type="button" data-fugui-id="${escapeHtml(item.id)}" aria-label="删除 ${escapeHtml(item.name)}">删除</button></td>
    </tr>`;
    }).join('');
  };

  const saveFuguiStrategyItems = () => {
    storage.setItem(FUGUI_STRATEGY_STORAGE_KEY, JSON.stringify(fuguiStrategyItems));
  };

  const addFuguiStrategyItem = candidate => {
    const normalizedCandidate = {
      ...candidate,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      addedAt: Date.now(),
    };
    const result = evaluateFuguiStrategyCandidate(normalizedCandidate);
    const normalized = normalizeFuguiStrategyItems([normalizedCandidate])[0];
    if (!normalized) {
      fuguiStrategyStatus.textContent = '未加入：自动填写信息不完整。';
      return;
    }
    fuguiStrategyItems = [normalized, ...fuguiStrategyItems.filter(item =>
      item.code ? item.code !== normalized.code : item.name !== normalized.name
    )];
    state.fuguiStrategy.items = fuguiStrategyItems;
    saveFuguiStrategyItems();
    fuguiStrategyStatus.textContent = result.passed
      ? `已加入：${normalized.name}，当前达标。`
      : `已加入：${normalized.name}，当前未达标：${result.issues.join('；')}。`;
    renderFuguiStrategy();
  };

  const lookupAndAddFuguiStrategyItem = async form => {
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    if (!name) return;
    if (!isLocalProxyLocation()) {
      fuguiStrategyStatus.textContent = '自动填写需要通过“启动面板.cmd”打开面板。';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    const providerLabel = fuguiDataProvider === 'akshare' ? 'AKShare' : 'Tushare';
    button.disabled = true;
    button.textContent = '自动填写中…';
    fuguiStrategyStatus.textContent = `正在用 ${providerLabel} 自动填写 ${name} 的行业、性质、市值、股息率、股价和10年国债利率。`;
    try {
      const response = await fetch(`/api/fugui-candidate?name=${encodeURIComponent(name)}&provider=${encodeURIComponent(fuguiDataProvider)}`, { cache: 'no-store' });
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        if (response.status === 400) {
          detail = '本地面板服务版本过旧，请关闭旧面板后重新双击“启动面板.cmd”';
        }
        try {
          const errorPayload = await response.json();
          if (errorPayload?.source) detail = `${detail}：${errorPayload.source}`;
        } catch {
          // Keep the HTTP status when the proxy cannot return structured JSON.
        }
        throw new Error(detail);
      }
      const payload = await response.json();
      addFuguiStrategyItem(payload?.data?.candidate ?? {});
      form.reset();
    } catch (error) {
      fuguiStrategyStatus.textContent = `自动填写失败：${error instanceof Error ? error.message : String(error)}。`;
    } finally {
      button.disabled = false;
      button.textContent = '添加到跟踪清单';
    }
  };

  const findStockCodeByName = name => {
    const normalizedName = String(name ?? '').trim();
    if (!normalizedName) return '';
    const exactMatch = [...holdings, ...trackingItems].find(item => item.name === normalizedName && item.code);
    if (exactMatch) return exactMatch.code;
    if (STOCK_CODE_ALIASES[normalizedName]) return STOCK_CODE_ALIASES[normalizedName];
    const partialMatch = Object.entries(STOCK_CODE_ALIASES).find(([alias]) =>
      alias.includes(normalizedName) || normalizedName.includes(alias)
    );
    return partialMatch?.[1] ?? '';
  };

  const fillTrackingCodeFromName = (force = false) => {
    const form = document.getElementById('tracking-form');
    const codeInput = form.elements.code;
    if (!force && codeInput.value.trim()) return;
    codeInput.value = findStockCodeByName(form.elements.name.value);
  };

  const savePortfolio = () => {
    portfolioVersion += 1;
    const payload = { holdings, trackingItems };
    storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(payload));
    if (isLocalProxyLocation()) {
      fetch('/api/portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  };

  const closeReviewDiary = () => {
    const modal = document.getElementById('review-diary-modal');
    const form = document.getElementById('review-diary-form');
    modal.hidden = true;
    form.reset();
    form.elements.trackingId.value = '';
    const status = document.getElementById('review-diary-status');
    status.className = 'diary-status';
    status.textContent = '提交后会自动写入今天日期，并按标的保存为独立文件。';
  };

  const closeMarginBalanceModal = () => {
    document.getElementById('margin-balance-modal').hidden = true;
  };

  const loadMarginBuyPoints = async () => {
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    try {
      const cached = JSON.parse(storage.getItem(MARGIN_BALANCE_CACHE_STORAGE_KEY) ?? 'null');
      if (
        cached?.startDate === startDate
        && cached?.endDate === endDate
        && Array.isArray(cached.points)
        && Date.now() - Number(cached.savedAt) < MARGIN_BALANCE_CACHE_MAX_AGE_MS
      ) {
        return { points: cached.points, startDate, endDate, cached: true };
      }
    } catch {
      storage.removeItem(MARGIN_BALANCE_CACHE_STORAGE_KEY);
    }
    const payload = await fetchJson(
      buildLocalProxyUrl('/api/margin', { start_date: startDate, end_date: endDate }),
      requestTimeout(),
    );
    const points = marketMarginBalancePoints(payload);
    if (points.length) {
      storage.setItem(MARGIN_BALANCE_CACHE_STORAGE_KEY, JSON.stringify({
        startDate,
        endDate,
        savedAt: Date.now(),
        points,
      }));
    }
    return { points, startDate, endDate, cached: false };
  };

  const refreshRiskMarginChart = async () => {
    const chart = document.getElementById('risk-margin-chart');
    if (!chart) return;
    chart.innerHTML = '<div class="margin-chart-empty">正在读取近一年融资余额。</div>';
    if (!isLocalProxyLocation()) {
      chart.innerHTML = '<div class="margin-chart-empty">请通过“启动面板.cmd”打开面板后查看融资余额。</div>';
      return;
    }
    try {
      const { points } = await loadMarginBuyPoints();
      chart.innerHTML = renderMarginBalanceChart(points);
    } catch {
      chart.innerHTML = '<div class="margin-chart-empty">融资余额读取失败，请检查 Tushare token 或稍后重试。</div>';
    }
  };

  const openMarginBalanceModal = async () => {
    const modal = document.getElementById('margin-balance-modal');
    const status = document.getElementById('margin-balance-modal-status');
    const body = document.getElementById('margin-balance-modal-body');
    modal.hidden = false;
    body.innerHTML = '<div class="margin-chart-empty">正在读取最近一年融资余额。</div>';
    if (!isLocalProxyLocation()) {
      status.textContent = '请通过“启动面板.cmd”打开面板后查看融资余额。';
      body.innerHTML = '<div class="margin-chart-empty">本地代理未连接，无法读取 Tushare 融资数据。</div>';
      return;
    }
    try {
      const rangeEnd = new Date().toISOString().slice(0, 10);
      const rangeStart = new Date();
      rangeStart.setFullYear(rangeStart.getFullYear() - 1);
      status.textContent = `正在读取 ${rangeStart.toISOString().slice(0, 10)} 至 ${rangeEnd} 的融资余额。`;
      const { points, cached } = await loadMarginBuyPoints();
      body.innerHTML = renderMarginBalanceChart(points);
      status.textContent = points.length
        ? `${cached ? '已使用缓存' : '已读取'} ${points.length} 个交易日；口径为 Tushare margin 的 rzye（融资余额）。`
        : '未获取到最近一年融资余额。';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const staleProxy = /HTTP 400/.test(message);
      status.textContent = staleProxy
        ? '融资余额读取失败：本地面板服务版本过旧，请关闭旧面板后重新双击“启动面板.cmd”。'
        : `融资余额读取失败：${message}。`;
      body.innerHTML = staleProxy
        ? '<div class="margin-chart-empty">当前代理仍按旧参数处理 /api/margin。重启面板服务后会切换到 Tushare 近一年数据接口。</div>'
        : '<div class="margin-chart-empty">读取失败，请检查 Tushare token 或稍后重试。</div>';
    }
  };

  const openReviewDiary = item => {
    const modal = document.getElementById('review-diary-modal');
    const form = document.getElementById('review-diary-form');
    form.reset();
    form.elements.trackingId.value = item.id;
    document.getElementById('review-diary-title').textContent = `复盘日记：${item.name}`;
    const status = document.getElementById('review-diary-status');
    status.className = 'diary-status';
    status.textContent = '提交后会自动写入今天日期，并按标的保存为独立文件。';
    modal.hidden = false;
    form.elements.content.focus();
  };

  const saveReviewDiary = async item => {
    const form = document.getElementById('review-diary-form');
    const status = document.getElementById('review-diary-status');
    const content = form.elements.content.value.trim();
    if (!content) {
      status.className = 'diary-status is-error';
      status.textContent = '先写一点复盘内容再保存。';
      return;
    }
    if (!isLocalProxyLocation()) {
      status.className = 'diary-status is-error';
      status.textContent = '请通过“启动面板.cmd”打开本地面板后保存，直接打开 HTML 不能写入文件。';
      return;
    }
    status.className = 'diary-status';
    status.textContent = '正在保存…';
    try {
      const response = await fetch('/api/review-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingId: item.id,
          code: item.code,
          name: item.name,
          status: item.status,
          content,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      status.className = 'diary-status is-saved';
      status.textContent = `已保存到 ${payload.path}`;
      form.elements.content.value = '';
      setTimeout(closeReviewDiary, 650);
    } catch (error) {
      status.className = 'diary-status is-error';
      status.textContent = `保存失败：${error instanceof Error ? error.message : String(error)}`;
    }
  };

  const loadProxyPortfolio = async () => {
    if (!isLocalProxyLocation()) return;
    const requestVersion = portfolioVersion;
    try {
      const response = await fetch('/api/portfolio', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const proxyPortfolio = normalizePortfolioPayload(payload);
      if (!shouldApplyPortfolioLoad(requestVersion, portfolioVersion)) return;
      if (!proxyPortfolio.holdings.length && !proxyPortfolio.trackingItems.length && (holdings.length || trackingItems.length)) {
        savePortfolio();
        return;
      }
      holdings = proxyPortfolio.holdings;
      trackingItems = proxyPortfolio.trackingItems;
      storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ holdings, trackingItems }));
      renderHoldings();
      renderTrackingItems();
    } catch {
      // Browser storage remains the explicit fallback when the local file endpoint is unavailable.
    }
  };

  const resetHoldingForm = () => {
    const form = document.getElementById('holding-form');
    form.reset();
    form.elements.id.value = '';
    form.elements.status.value = '持有';
    document.getElementById('holding-form-title').textContent = '新增持仓';
    document.getElementById('cancel-holding-edit').hidden = true;
  };

  const openTrackingForm = () => {
    const form = document.getElementById('tracking-form');
    form.hidden = false;
    document.getElementById('cancel-tracking-edit').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetTrackingForm = () => {
    const form = document.getElementById('tracking-form');
    form.reset();
    form.elements.id.value = '';
    form.elements.status.value = '观察';
    const status = document.getElementById('tracking-form-status');
    status.textContent = '';
    status.className = 'tracking-form-status';
    document.getElementById('tracking-form-title').textContent = '新增跟踪';
    document.getElementById('cancel-tracking-edit').hidden = true;
    form.hidden = true;
  };

  const renderHoldings = () => {
    const summary = summarizeHoldings(holdings);
    document.getElementById('holding-count').textContent = String(summary.items.length);
    document.getElementById('portfolio-cost').textContent = formatMoney(summary.costValue);
    document.getElementById('portfolio-market-value').textContent = formatMoney(summary.marketValue);
    document.getElementById('portfolio-profit').textContent = formatMoney(summary.profit);
    document.getElementById('portfolio-profit-rate').textContent = `${summary.profitRate.toFixed(2)}%`;
    const profitCard = document.getElementById('portfolio-profit-card');
    profitCard.classList.toggle('is-profit', summary.profit > 0);
    profitCard.classList.toggle('is-loss', summary.profit < 0);
    document.getElementById('holdings-empty').hidden = summary.items.length > 0;
    document.getElementById('holdings-updated').textContent = summary.items.length
      ? `最近记录 ${new Date(Math.max(...summary.items.map(item => item.updatedAt))).toLocaleString('zh-CN', { hour12: false })}`
      : '尚未记录';

    document.getElementById('holdings-table-body').innerHTML = summary.items.map(item => `<tr>
      <td class="holding-name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)}</small></td>
      <td>${item.quantity.toLocaleString('zh-CN')}</td>
      <td>${formatMoney(item.cost)} / ${formatMoney(item.price)}</td>
      <td>${formatMoney(item.marketValue)}</td>
      <td class="holding-profit ${item.profit > 0 ? 'is-profit' : item.profit < 0 ? 'is-loss' : ''}">${formatMoney(item.profit)}<br>${item.profitRate.toFixed(2)}%</td>
      <td>${item.weight.toFixed(2)}%</td>
      <td><div class="holding-row-actions"><button type="button" data-action="edit" data-id="${escapeHtml(item.id)}">编辑</button><button type="button" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button></div></td>
    </tr>`).join('');
  };

  const renderTrackingAllocation = items => {
    const allocation = summarizeTrackingAllocation(items, holdings);
    const chart = document.getElementById('tracking-allocation-chart');
    const legend = document.getElementById('tracking-allocation-legend');
    let cursor = 0;
    const segments = allocation
      .filter(item => item.percent > 0)
      .map(item => {
        const start = cursor;
        cursor += item.percent;
        return `${item.color} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`;
      });
    chart.style.background = segments.length
      ? `conic-gradient(${segments.join(', ')})`
      : 'conic-gradient(#dfe6eb 0% 100%)';
    chart.innerHTML = `<div class="allocation-center"><small>资产配比</small><strong>${segments.length ? '100%' : '0%'}</strong></div>${allocation.map(item => {
      const angle = (allocation.slice(0, allocation.indexOf(item)).reduce((sum, entry) => sum + entry.percent, 0) + item.percent / 2) / 100 * 360 - 90;
      const radius = 39;
      const left = 50 + Math.cos(angle * Math.PI / 180) * radius;
      const top = 50 + Math.sin(angle * Math.PI / 180) * radius;
      return item.percent > 0
        ? `<span class="allocation-chart-label" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%">${item.label}<b>${item.percent.toFixed(0)}%</b></span>`
        : '';
    }).join('')}`;
    legend.innerHTML = allocation.map(item => `<div class="allocation-legend-row">
      <span class="allocation-color" style="background:${item.color}"></span>
      <div class="allocation-legend-copy">
        <strong>${item.label}</strong>
        <div class="allocation-targets">${item.targets.length
          ? item.targets.map(target => `<span><em>${escapeHtml(target.name)}</em><b>${target.percent.toFixed(0)}%</b></span>`).join('')
          : '<span><em>暂无持有标的</em><b>0%</b></span>'}</div>
      </div>
      <b>${item.percent.toFixed(0)}%</b>
    </div>`).join('');
    return allocation.some(item => item.percent > 0);
  };

  async function loadTrackingQuote(secid) {
    if (!isLocalProxyLocation() || !secid) return null;
    const previous = trackingQuoteCache.get(secid);
    trackingQuoteCache.set(secid, { status: 'loading', quote: previous?.quote ?? null, updatedAt: previous?.updatedAt ?? null });
    try {
      const quoteResponse = await fetch(`/api/stock-quote?secid=${encodeURIComponent(secid)}`, { cache: 'no-store' });
      if (!quoteResponse.ok) throw new Error(`HTTP ${quoteResponse.status}`);
      const payload = await quoteResponse.json();
      if (!payload?.data || !Number.isFinite(payload.data.price)) throw new Error('Invalid quote payload');
      const entry = { status: 'loaded', quote: payload.data, proxySource: payload.proxySource, updatedAt: Date.now() };
      trackingQuoteCache.set(secid, entry);
      return entry.quote;
    } catch {
      trackingQuoteCache.set(secid, { status: 'error', quote: previous?.quote ?? null, updatedAt: previous?.updatedAt ?? null });
      return previous?.quote ?? null;
    }
  }

  async function loadFuguiDividendYield(secid) {
    if (!isLocalProxyLocation() || !secid) return null;
    const previous = fuguiDividendYieldCache.get(secid);
    fuguiDividendYieldCache.set(secid, { status: 'loading', data: previous?.data ?? null, updatedAt: previous?.updatedAt ?? null });
    try {
      const response = await fetch(`/api/stock-dividend-yield?secid=${encodeURIComponent(secid)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const dividendYieldTtm = finitePositiveNumber(payload?.data?.dividendYieldTtm);
      if (dividendYieldTtm === null) throw new Error('Invalid dividend yield payload');
      const entry = {
        status: 'loaded',
        data: { ...payload.data, dividendYieldTtm },
        proxySource: payload.proxySource,
        updatedAt: Date.now(),
      };
      fuguiDividendYieldCache.set(secid, entry);
      return entry.data;
    } catch {
      fuguiDividendYieldCache.set(secid, { status: 'error', data: null, updatedAt: Date.now() });
      return null;
    }
  }

  async function loadTrackingClosePerformance(secid) {
    if (!isLocalProxyLocation() || !secid) return null;
    const previous = trackingClosePerformanceCache.get(secid);
    trackingClosePerformanceCache.set(secid, { status: 'loading', data: previous?.data ?? null, updatedAt: previous?.updatedAt ?? null });
    try {
      const response = await fetch(`/api/stock-close-performance?secid=${encodeURIComponent(secid)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.data || !Number.isFinite(payload.data.latestClose)) throw new Error('Invalid close performance payload');
      const entry = { status: 'loaded', data: payload.data, proxySource: payload.proxySource, updatedAt: Date.now() };
      trackingClosePerformanceCache.set(secid, entry);
      return entry.data;
    } catch {
      trackingClosePerformanceCache.set(secid, { status: 'error', data: previous?.data ?? null, updatedAt: previous?.updatedAt ?? null });
      return previous?.data ?? null;
    }
  }

  async function refreshTrackingQuotes() {
    if (!isLocalProxyLocation()) return;
    const secids = new Set();
    for (const item of summarizeTrackingItems(trackingItems).items) {
      const reportHref = reportLinkForTrackingItem(item);
      const report = reportHref ? reportSummaryCache.get(reportHref)?.data ?? {} : {};
      const secid = secidForTrackingItem(item, report);
      if (secid) secids.add(secid);
    }
    if (!secids.size) return;
    await Promise.all([...secids].flatMap(secid => [loadTrackingQuote(secid), loadTrackingClosePerformance(secid)]));
    renderTrackingItems();
  }

  async function refreshTrackingReports() {
    const button = document.getElementById('refresh-tracking-reports');
    if (!button) return;
    const idleLabel = button.textContent;
    if (!trackingItems.length) {
      button.textContent = '暂无标的';
      setTimeout(() => { button.textContent = idleLabel; }, 1400);
      return;
    }
    if (!isLocalProxyLocation()) {
      button.textContent = '需启动面板';
      setTimeout(() => { button.textContent = idleLabel; }, 1800);
      return;
    }
    button.disabled = true;
    button.textContent = '更新中…';
    try {
      const response = await fetch('/api/tracking-rerender-reports', {
        method: 'POST',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      console.info('tracking report rerender result', payload);
      const updatedCount = Array.isArray(payload.updated) ? payload.updated.length : 0;
      const skippedCount = (Array.isArray(payload.skipped) ? payload.skipped.length : 0)
        + (Array.isArray(payload.failed) ? payload.failed.length : 0);
      reportSummaryCache.clear();
      renderTrackingItems();
      refreshTrackingQuotes();
      button.textContent = skippedCount ? `已更新 ${updatedCount} 份` : '已全部更新';
    } catch (error) {
      console.error('tracking report rerender failed', error);
      button.textContent = '更新失败，看日志';
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = idleLabel;
      }, 1800);
    }
  }

  const renderTrackingItems = () => {
    const summary = summarizeTrackingItems(trackingItems);
    const enrichedItems = summary.items.map((item, index) => {
      const reportHref = reportLinkForTrackingItem(item);
      let reportEntry = reportHref ? reportSummaryCache.get(reportHref) : null;
      if (reportHref && !reportEntry) {
        reportEntry = { status: 'loading' };
        reportSummaryCache.set(reportHref, reportEntry);
        loadReportSummary(reportHref);
      }
      const report = reportEntry?.data ?? {};
      const secid = secidForTrackingItem(item, report);
      let quoteEntry = secid ? trackingQuoteCache.get(secid) : null;
      if (secid && isLocalProxyLocation() && !quoteEntry) {
        quoteEntry = { status: 'loading' };
        trackingQuoteCache.set(secid, quoteEntry);
        loadTrackingQuote(secid).then(() => renderTrackingItems());
      }
      let closePerformanceEntry = secid ? trackingClosePerformanceCache.get(secid) : null;
      if (secid && isLocalProxyLocation() && !closePerformanceEntry) {
        closePerformanceEntry = { status: 'loading' };
        trackingClosePerformanceCache.set(secid, closePerformanceEntry);
        loadTrackingClosePerformance(secid).then(() => renderTrackingItems());
      }
      const liveQuote = quoteEntry?.quote ?? reportEntry?.quote;
      const riskReward = trackingRiskRewardForQuote({
        valueRange: report.valueRange,
        livePrice: liveQuote?.price,
      });
      const signal = trackingSignalForQuote({
        valueRange: report.valueRange,
        livePrice: liveQuote?.price,
        reportQuote: report.reportQuote,
        riskRewardRatio: riskReward.ratio,
      });
      return {
        item,
        index,
        reportHref,
        reportEntry,
        report,
        quoteEntry,
        closePerformanceEntry,
        liveQuote,
        signal,
        riskReward,
        leftEdgeDistance: trackingLeftEdgeDistance({
          valueRange: report.valueRange,
          livePrice: liveQuote?.price,
          reportQuote: report.reportQuote,
        }),
      };
    });
    const filteredItems = enrichedItems.filter(({ item, signal }) => {
      if (trackingStatusFilter === 'all') return true;
      if (trackingStatusFilter === 'addable') return signal.addStars > 0;
      if (trackingStatusFilter === 'reducible') return signal.reducible;
      return item.status === trackingStatusFilter;
    });
    const visibleItems = trackingSortMode === 'near-left'
      ? [...filteredItems].sort((left, right) =>
          right.riskReward.sortValue - left.riskReward.sortValue
          || right.item.updatedAt - left.item.updatedAt
          || left.index - right.index
        )
      : filteredItems;
    const hasAllocation = renderTrackingAllocation(summary.items);
    const closeDates = visibleItems
      .map(({ closePerformanceEntry }) => closePerformanceEntry?.data?.tradeDate)
      .filter(Boolean)
      .sort();
    const trackingCloseDate = document.getElementById('tracking-close-date');
    if (trackingCloseDate) {
      trackingCloseDate.textContent = closeDates.length ? `${closeDates.at(-1)}收盘` : '';
    }
    const renderTrackingRow = ({ item, reportHref, reportEntry, report, quoteEntry, closePerformanceEntry, liveQuote, signal, riskReward }) => {
      const signalLabel = signal.addStars > 0
        ? '★'.repeat(signal.addStars)
        : signal.reducible ? '可减' : '—';
      const intraday = liveQuote
        ? `${liveQuote.price.toFixed(2)} 元`
        : report.reportQuote ? trackingQuotePriceOnly(report.reportQuote) : (quoteEntry?.status === 'loading' ? '读取行情…' : reportEntry?.status === 'loading' ? '读取研报…' : item.nextAction || '未获取到');
      const riskRewardText = riskReward.label !== '等待实时'
        ? riskReward.label
        : (quoteEntry?.status === 'loading' ? '读取行情…' : reportEntry?.status === 'loading' ? '读取研报…' : item.nextAction || '未获取到');
      const closePerformanceHtml = Number.isFinite(closePerformanceEntry?.data?.latestClose)
        ? `<div class="tracking-close-performance"><strong>${formatNumber(closePerformanceEntry.data.latestClose, 2)} 元</strong><small>近一周 ${Number.isFinite(closePerformanceEntry.data.weekChangePercent) ? `${closePerformanceEntry.data.weekChangePercent >= 0 ? '+' : ''}${formatNumber(closePerformanceEntry.data.weekChangePercent, 2)}%` : '—'}</small></div>`
        : escapeHtml(closePerformanceEntry?.status === 'loading' ? '读取中…' : '未获取到');
      const monitorLink = dailyMonitorLinkForTrackingItem(item, report);
      const monitorStatusText = report.riskDirection || item.riskLine || (reportEntry?.status === 'loading' ? '读取研报…' : '未获取到');
      const monitorStatusHtml = monitorLink
        ? `<a class="tracking-monitor-link" href="${escapeHtml(monitorLink.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(monitorLink.status || '打开监控')}</a><small class="tracking-monitor-meta">${escapeHtml(monitorLink.date ? `${monitorLink.date} · 每日监控` : '每日监控')}</small>`
        : escapeHtml(monitorStatusText);
      const nameHtml = reportHref
        ? `<a href="${escapeHtml(reportHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>`
        : escapeHtml(item.name);
      return `<tr data-tracking-id="${escapeHtml(item.id)}"${reportHref ? ` data-report-href="${escapeHtml(reportHref)}"` : ''}>
      <td class="tracking-target"><strong>${nameHtml}</strong><small>${escapeHtml(item.code || report.secid || '未填代码')}</small><span class="tracker-status">${escapeHtml(item.status)}</span></td>
      <td>${escapeHtml(report.valueRange || item.thesis || (reportEntry?.status === 'loading' ? '读取研报…' : '未获取到'))}</td>
      <td>${escapeHtml(intraday)}</td>
      <td>${closePerformanceHtml}</td>
      <td>${escapeHtml(riskRewardText)}</td>
      <td>${monitorStatusHtml}</td>
      <td><div>${reportHref ? `<a href="${escapeHtml(reportHref)}" target="_blank" rel="noopener noreferrer">打开研报</a>` : escapeHtml(item.reviewCondition || '未关联研报')}</div><small class="tracking-updated">${escapeHtml(report.sourceUpdated ? `研报：${report.sourceUpdated}` : `记录：${new Date(item.updatedAt).toLocaleString('zh-CN', { hour12: false })}`)}</small><div class="tracker-row-actions"><button type="button" data-action="edit-tracking">编辑</button><button type="button" data-action="delete-tracking">删除</button></div></td>
      <td><button class="review-diary-button" type="button" data-action="review-diary">复盘日记</button></td>
      <td>${escapeHtml(signalLabel)}</td>
    </tr>`;
    };
    const groupedRows = () => {
      const groupMetas = [...ALLOCATION_CATEGORIES, UNCATEGORIZED_ALLOCATION_CATEGORY];
      return groupMetas.map(group => {
        const groupItems = visibleItems.filter(({ reportHref }) =>
          (allocationCategoryForReport(reportHref) || UNCATEGORIZED_ALLOCATION_CATEGORY.key) === group.key
        );
        if (!groupItems.length) return '';
        return `<tr class="tracking-group-row"><th colspan="9" style="--group-color:${group.color}"><div class="tracking-group-head"><span>${escapeHtml(group.label)}</span><small>${groupItems.length} 个标的</small></div></th></tr>${groupItems.map(renderTrackingRow).join('')}`;
      }).join('');
    };
    const sortButton = document.getElementById('tracking-sort-intraday');
    if (sortButton) {
      sortButton.classList.toggle('is-active', trackingSortMode === 'near-left');
      sortButton.setAttribute('aria-pressed', String(trackingSortMode === 'near-left'));
    }
    const allocationModeButton = document.getElementById('tracking-allocation-mode');
    if (allocationModeButton) {
      allocationModeButton.classList.toggle('is-active', trackingAllocationMode);
      allocationModeButton.setAttribute('aria-pressed', String(trackingAllocationMode));
    }
    document.getElementById('tracking-count').textContent = String(summary.count);
    document.getElementById('tracking-holding-count').textContent = String(summary.countByStatus['持有']);
    document.getElementById('tracking-watch-count').textContent = String(summary.countByStatus['观察']);
    document.getElementById('tracking-updated').textContent = summary.latestUpdatedAt
      ? new Date(summary.latestUpdatedAt).toLocaleDateString('zh-CN')
      : '尚未记录';
    const allocationView = document.getElementById('tracking-allocation-view');
    allocationView.hidden = !trackingAllocationMode;
    allocationView.classList.toggle('is-collapsed', trackingAllocationCollapsed);
    const allocationCollapseButton = document.getElementById('tracking-allocation-collapse');
    if (allocationCollapseButton) {
      allocationCollapseButton.setAttribute('aria-expanded', String(!trackingAllocationCollapsed));
      document.getElementById('tracking-allocation-collapse-label').textContent = trackingAllocationCollapsed ? '展开' : '收起';
    }
    document.querySelector('#holding-tracker .tracking-table-wrap').hidden = false;
    const empty = document.getElementById('holding-tracker-empty');
    empty.textContent = trackingAllocationMode && !hasAllocation && !visibleItems.length
      ? '还没有可计算的持有配比。先在仓位管理里记录持有数量和现价，或把跟踪项设为持有。'
      : '还没有跟踪标的。先在左侧新增一条观察记录。';
    empty.hidden = visibleItems.length > 0;
    document.getElementById('holding-tracker-list').innerHTML = trackingAllocationMode
      ? groupedRows()
      : visibleItems.map(renderTrackingRow).join('');
  };

  async function loadReportSummary(reportHref) {
    try {
      const response = await fetch(reportHref, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const data = parseReportSummary(html);
      reportSummaryCache.set(reportHref, { status: 'loaded', data });
      if (data.secid && isLocalProxyLocation()) {
        try {
          const quoteResponse = await fetch(`/api/stock-quote?secid=${encodeURIComponent(data.secid)}`, { cache: 'no-store' });
          if (quoteResponse.ok) {
            const payload = await quoteResponse.json();
            if (payload?.data && Number.isFinite(payload.data.price)) {
              reportSummaryCache.set(reportHref, { status: 'loaded', data, quote: payload.data });
            }
          }
        } catch {
          reportSummaryCache.set(reportHref, { status: 'loaded', data });
        }
      }
    } catch {
      reportSummaryCache.set(reportHref, { status: 'error', data: {} });
    }
    renderTrackingItems();
  }

  const render = () => {
    const derived = deriveDashboard(state.snapshot, state.windowYears);
    renderDerived(derived, state.youzhiyouxingTemperature, state.nasdaq100);
    document.querySelectorAll('[data-window]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.window) === state.windowYears)));
  };

  const loadYouzhiyouxingTemperature = async () => {
    if (!isLocalProxyLocation()) {
      state.youzhiyouxingTemperature = {
        status: 'missing',
        error: '稳定联网请双击“启动面板.cmd”。',
        sourceUrl: YOUZHIYOUXING_TEMPERATURE_URL,
      };
      render();
      return;
    }
    state.youzhiyouxingTemperature = { status: 'loading', sourceUrl: YOUZHIYOUXING_TEMPERATURE_URL };
    render();
    try {
      const response = await fetch('/api/youzhiyouxing-temperature', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.youzhiyouxingTemperature = {
        status: 'latest',
        data: payload.data,
        proxySource: payload.proxySource,
        sourceUrl: payload.data?.sourceUrl ?? YOUZHIYOUXING_TEMPERATURE_URL,
      };
    } catch (error) {
      state.youzhiyouxingTemperature = {
        status: 'missing',
        error: `有知有行温度计读取失败：${error instanceof Error ? error.message : String(error)}`,
        sourceUrl: YOUZHIYOUXING_TEMPERATURE_URL,
      };
    }
    render();
  };

  const loadNasdaq100 = async () => {
    if (!isLocalProxyLocation()) {
      state.nasdaq100 = {
        status: 'missing',
        error: '稳定联网请双击“启动面板.cmd”。',
        sourceUrl: NASDAQ100_SOURCE_URL,
      };
      render();
      return;
    }
    state.nasdaq100 = { status: 'loading', sourceUrl: NASDAQ100_SOURCE_URL };
    render();
    try {
      const response = await fetch('/api/nasdaq100', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.nasdaq100 = {
        status: 'latest',
        data: payload.data,
        proxySource: payload.proxySource,
        sourceUrl: payload.data?.sourceUrl ?? NASDAQ100_SOURCE_URL,
      };
    } catch (error) {
      state.nasdaq100 = {
        status: 'missing',
        error: `纳斯达克100读取失败：${error instanceof Error ? error.message : String(error)}`,
        sourceUrl: NASDAQ100_SOURCE_URL,
      };
    }
    render();
  };

  const refreshLive = async (domainIds = null) => {
    if (state.busy) return;
    state.busy = true;
    refreshButton.disabled = true;
    refreshButton.textContent = '刷新中…';
    notice.className = 'notice';
    notice.textContent = `正在独立刷新行情、估值、国债、成交额与融资数据；失败项不会阻塞其他指标。${launcherHint}`;
    try {
      const definitions = createDefaultDomainDefinitions().filter(definition => !domainIds || domainIds.includes(definition.id));
      const refreshed = await refreshDomains(definitions, {
        storage,
        now: Date.now,
        concurrency: definitions.length,
      });
      const domains = state.snapshot.mode === 'live' && domainIds
        ? { ...state.snapshot.domains, ...refreshed }
        : refreshed;
      const usableCount = Object.values(domains).filter(entry => ['latest', 'snapshot'].includes(entry.status)).length;
      if (!usableCount) {
        exampleToggle.checked = true;
        notice.className = 'notice is-error';
        notice.textContent = `公开接口均不可用，继续显示初始化数据；没有把初始化值写入真实缓存。${launcherHint}`;
      } else {
        state.snapshot = { mode: 'live', generatedAt: new Date().toISOString(), domains };
        exampleToggle.checked = false;
        notice.className = usableCount === Object.keys(domains).length ? 'notice is-live' : 'notice';
        notice.textContent = `联网刷新完成：${usableCount} / ${Object.keys(domains).length} 个数据域可用。缺失项已退出评分并重算有效权重。${launcherHint}`;
        render();
      }
    } catch (error) {
      notice.className = 'notice is-error';
      notice.textContent = `刷新失败：${error instanceof Error ? error.message : String(error)}。当前显示保持不变。${launcherHint}`;
    } finally {
      state.busy = false;
      refreshButton.disabled = false;
      refreshButton.textContent = '刷新数据';
    }
  };

  const closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('nav-toggle').setAttribute('aria-expanded', 'false');
  };

  const shellForButton = button =>
    button.dataset.treeDomain
    ?? button.closest('[data-tree-group]')?.dataset.treeGroup
    ?? 'thermometer';

  const labelForView = button => button?.textContent.replace(/^\d+/, '').trim() ?? '';

  const applyIndustryFilter = section => {
    const activeFilter = section.querySelector('.industry-filter-tabs button.is-active')?.dataset.filter ?? 'all';
    const query = section.querySelector('.industry-search input')?.value.trim().toLocaleLowerCase('zh-CN') ?? '';
    let visibleCount = 0;
    section.querySelectorAll('.industry-research-list').forEach(list => {
      let visibleBoardCount = 0;
      list.querySelectorAll('.industry-research-item').forEach(board => {
        const filters = (board.dataset.filters ?? '').split(',').map(item => item.trim()).filter(Boolean);
        const matchesFilter = activeFilter === 'all' || filters.includes(activeFilter);
        const matchesQuery = !query || board.textContent.toLocaleLowerCase('zh-CN').includes(query);
        const visible = matchesFilter && matchesQuery;
        board.hidden = !visible;
        if (visible) visibleBoardCount += 1;
      });
      list.hidden = visibleBoardCount === 0;
      visibleCount += visibleBoardCount;
    });
    section.querySelectorAll('.industry-report').forEach(card => {
      const filters = (card.dataset.filters ?? '').split(',').map(item => item.trim()).filter(Boolean);
      const matchesFilter = activeFilter === 'all' || filters.includes(activeFilter);
      const matchesQuery = !query || card.textContent.toLocaleLowerCase('zh-CN').includes(query);
      const visible = matchesFilter && matchesQuery;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    const empty = section.querySelector('.industry-empty-results');
    if (empty) empty.hidden = visibleCount > 0;
  };

  const applyFeaturedFilter = () => {
    const activeFilter = document.querySelector('.featured-filter-tabs button.is-active')?.dataset.featuredFilter ?? 'all';
    let visibleCount = 0;
    document.querySelectorAll('[data-featured-filters]').forEach(item => {
      const filters = (item.dataset.featuredFilters ?? '').split(',').map(value => value.trim()).filter(Boolean);
      const deleted = featuredDeletedIds.has(item.dataset.featuredId ?? '');
      const visible = !deleted && (activeFilter === 'all' || filters.includes(activeFilter));
      item.hidden = !visible;
      if (visible && item.classList.contains('featured-card')) visibleCount += 1;
    });
    document.querySelectorAll('.featured-day').forEach(day => {
      day.hidden = day.querySelectorAll('.featured-card:not([hidden])').length === 0;
    });
    const empty = document.querySelector('.featured-empty-results');
    if (empty) empty.hidden = visibleCount > 0;
  };

  const decodeFeaturedOriginal = encoded => {
    try {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return '原文读取失败。';
    }
  };

  const applyTopicFilter = () => {
    const activeFilter = document.querySelector('.topic-filter-tabs button.is-active')?.dataset.topicFilter ?? 'all';
    let visibleCount = 0;
    document.querySelectorAll('.topic-card').forEach(card => {
      const visible = activeFilter === 'all' || card.dataset.topicCategory === activeFilter;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    const empty = document.querySelector('.topic-empty-results');
    if (empty) empty.hidden = visibleCount > 0;
  };

  const setActiveView = viewId => {
    const button = [...document.querySelectorAll('[data-view]')].find(item => item.dataset.view === viewId);
    const shell = button ? shellForButton(button) : 'thermometer';
    activeViewByShell[shell] = viewId;
    document.querySelectorAll('[data-view]').forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-active', view.id === viewId));
    pageTitle.textContent = labelForView(button) || pageTitle.textContent;
    if (viewId === 'risk-monitor') refreshRiskMarginChart();
  };

  const setShell = (shell, viewId = null) => {
    const navigation = resolveTreeNavigation(activeViewByShell, shell, viewId);
    const targetShell = navigation.domain;
    document.querySelectorAll('[data-tree-group]').forEach(group => {
      const expanded = group.dataset.treeGroup === targetShell;
      group.classList.toggle('is-expanded', expanded);
      group.querySelector('.tree-root')?.setAttribute('aria-expanded', String(expanded));
      const children = group.querySelector('.tree-children');
      if (children) children.hidden = !expanded;
    });
    marketActions.hidden = targetShell !== 'thermometer' && targetShell !== 'strategy';
    topbar.hidden = targetShell === 'changelog';
    notice.hidden = targetShell !== 'thermometer';
    sidebarFooter.hidden = targetShell !== 'thermometer';
    pageEyebrow.textContent = {
      thermometer: 'MARKET VALUATION MONITOR',
      strategy: 'STRATEGY MENU',
      industry: 'INDUSTRY MAP',
      personal: 'MY PORTFOLIO',
      changelog: 'CHANGELOG',
    }[targetShell];
    setActiveView(navigation.viewId);
    closeSidebar();
  };

  document.querySelectorAll('[data-window]').forEach(button => button.addEventListener('click', () => {
    state.windowYears = Number(button.dataset.window);
    render();
  }));
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => {
    setShell(shellForButton(button), button.dataset.view);
  }));
  document.querySelectorAll('.industry-filter-tabs button').forEach(button => button.addEventListener('click', event => {
    const section = event.currentTarget.closest('.view');
    section.querySelectorAll('.industry-filter-tabs button').forEach(item => {
      const active = item === event.currentTarget;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyIndustryFilter(section);
  }));
  document.querySelectorAll('.industry-search').forEach(form => {
    const section = form.closest('.view');
    form.addEventListener('submit', event => {
      event.preventDefault();
      applyIndustryFilter(section);
    });
    form.querySelector('input')?.addEventListener('input', () => applyIndustryFilter(section));
  });
  document.querySelectorAll('.featured-filter-tabs button').forEach(button => button.addEventListener('click', event => {
    document.querySelectorAll('.featured-filter-tabs button').forEach(item => {
      const active = item === event.currentTarget;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyFeaturedFilter();
  }));
  document.querySelectorAll('.featured-original-toggle').forEach(button => button.addEventListener('click', event => {
    const toggle = event.currentTarget;
    const original = toggle.closest('.featured-card-inner')?.querySelector('.featured-original');
    if (!original) return;
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (!expanded && original.dataset.loaded !== 'true') {
      original.querySelector('pre').textContent = decodeFeaturedOriginal(original.dataset.featuredOriginal ?? '');
      original.dataset.loaded = 'true';
    }
    original.hidden = expanded;
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.textContent = expanded ? '显示原文' : '收起原文';
  }));
  document.querySelectorAll('.featured-delete').forEach(button => button.addEventListener('click', event => {
    const card = event.currentTarget.closest('.featured-card');
    const featuredId = card?.dataset.featuredId;
    const title = card?.querySelector('h3')?.textContent?.trim() ?? '这条记录';
    if (!featuredId) return;
    if (!globalThis.confirm(`确认删除「${title}」？`)) return;
    if (!isLocalProxyLocation()) {
      globalThis.alert('删除原始 Markdown 需要通过“启动面板.cmd”打开面板。');
      return;
    }
    const deleteButton = event.currentTarget;
    deleteButton.disabled = true;
    deleteButton.textContent = '删除中...';
    fetch('/api/featured-post', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ href: featuredId }),
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      featuredDeletedIds.add(featuredId);
      storage.setItem(FEATURED_DELETED_STORAGE_KEY, JSON.stringify([...featuredDeletedIds]));
      applyFeaturedFilter();
    }).catch(() => {
      globalThis.alert('删除失败：未能删除原始 Markdown。');
      deleteButton.disabled = false;
      deleteButton.textContent = '删除';
    });
  }));
  document.querySelectorAll('.topic-filter-tabs button').forEach(button => button.addEventListener('click', event => {
    document.querySelectorAll('.topic-filter-tabs button').forEach(item => {
      const active = item === event.currentTarget;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyTopicFilter();
  }));
  document.getElementById('open-featured-digest')?.addEventListener('click', () => {
    setShell('thermometer', 'featured-digest');
  });
  document.getElementById('risk-monitor-card')?.addEventListener('click', () => {
    setShell('thermometer', 'risk-monitor');
  });
  document.getElementById('risk-monitor-card')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setShell('thermometer', 'risk-monitor');
    }
  });
  document.getElementById('dividend-signal-card')?.addEventListener('click', event => {
    if (event.target.closest('[data-open-dividend-signal]')) setShell('thermometer', 'dividend-signal-view');
  });
  document.getElementById('margin-balance-card')?.addEventListener('click', openMarginBalanceModal);
  document.getElementById('margin-balance-card')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMarginBalanceModal();
    }
  });
  fuguiStrategyForm?.addEventListener('submit', event => {
    event.preventDefault();
    lookupAndAddFuguiStrategyItem(event.currentTarget);
  });
  fuguiStrategyBody?.addEventListener('click', event => {
    const button = event.target.closest('button[data-fugui-id]');
    if (!button) return;
    fuguiStrategyItems = fuguiStrategyItems.filter(item => item.id !== button.dataset.fuguiId);
    state.fuguiStrategy.items = fuguiStrategyItems;
    saveFuguiStrategyItems();
    fuguiStrategyStatus.textContent = '已从富贵策略跟踪清单移除。';
    renderFuguiStrategy();
  });
  document.getElementById('fugui-filter')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-fugui-filter]');
    if (!button) return;
    fuguiStatusFilter = button.dataset.fuguiFilter;
    document.querySelectorAll('#fugui-filter button').forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    renderFuguiStrategy();
  });
  fuguiTtmSortButton?.addEventListener('click', () => {
    fuguiTtmSortMode = fuguiTtmSortMode === 'ttm-desc' ? 'ttm-asc' : 'ttm-desc';
    renderFuguiStrategy();
  });
  fuguiPanelCollapseButton?.addEventListener('click', () => setFuguiPanelCollapsed(true));
  fuguiPanelOpenButton?.addEventListener('click', () => setFuguiPanelCollapsed(false));
  document.querySelectorAll('[data-tree-domain]').forEach(button => button.addEventListener('click', () => {
    setShell(button.dataset.treeDomain, button.dataset.view ?? null);
  }));
  document.getElementById('holding-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = String(data.get('id') ?? '') || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = {
      id,
      code: String(data.get('code') ?? '').trim(),
      name: String(data.get('name') ?? '').trim(),
      quantity: Math.max(0, Number(data.get('quantity')) || 0),
      cost: Math.max(0, Number(data.get('cost')) || 0),
      price: Math.max(0, Number(data.get('price')) || 0),
      status: HOLDING_STATUSES.has(data.get('status')) ? data.get('status') : '持有',
      note: String(data.get('note') ?? '').trim().slice(0, 240),
      updatedAt: Date.now(),
    };
    const existingIndex = holdings.findIndex(item => item.id === id);
    if (existingIndex >= 0) holdings[existingIndex] = next;
    else holdings.push(next);
    savePortfolio();
    renderHoldings();
    resetHoldingForm();
  });
  document.getElementById('cancel-holding-edit').addEventListener('click', resetHoldingForm);
  document.getElementById('holdings-table-body').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const holding = holdings.find(item => item.id === button.dataset.id);
    if (!holding) return;
    if (button.dataset.action === 'delete') {
      if (!globalThis.confirm(`删除 ${holding.name} 的持仓记录？`)) return;
      holdings = holdings.filter(item => item.id !== holding.id);
      savePortfolio();
      renderHoldings();
      resetHoldingForm();
      return;
    }
    const form = document.getElementById('holding-form');
    for (const key of ['id', 'code', 'name', 'quantity', 'cost', 'price', 'status', 'note']) form.elements[key].value = holding[key];
    document.getElementById('holding-form-title').textContent = `编辑 ${holding.name}`;
    document.getElementById('cancel-holding-edit').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('open-tracking-form').addEventListener('click', () => {
    resetTrackingForm();
    document.getElementById('tracking-form').hidden = false;
    document.getElementById('cancel-tracking-edit').hidden = false;
    document.querySelector('#tracking-form [name="name"]').focus();
  });
  document.getElementById('refresh-tracking-reports')?.addEventListener('click', refreshTrackingReports);
  document.getElementById('tracking-form').addEventListener('submit', event => {
    event.preventDefault();
    fillTrackingCodeFromName(false);
    const data = new FormData(event.currentTarget);
    const id = String(data.get('id') ?? '') || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = {
      id,
      code: String(data.get('code') ?? '').trim(),
      name: String(data.get('name') ?? '').trim(),
      status: HOLDING_STATUSES.has(data.get('status')) ? data.get('status') : '观察',
      thesis: String(data.get('thesis') ?? '').trim().slice(0, 300),
      riskLine: String(data.get('riskLine') ?? '').trim().slice(0, 220),
      nextAction: String(data.get('nextAction') ?? '').trim().slice(0, 80),
      reviewCondition: String(data.get('reviewCondition') ?? '').trim().slice(0, 220),
      updatedAt: Date.now(),
    };
    const existingIndex = trackingItems.findIndex(item => item.id === id);
    const duplicate = findDuplicateTrackingItem(trackingItems, next, existingIndex >= 0 ? id : '');
    const status = document.getElementById('tracking-form-status');
    if (duplicate) {
      status.textContent = `未保存：${duplicate.name}${duplicate.code ? `（${duplicate.code}）` : ''} 已在跟踪清单中。`;
      status.className = 'tracking-form-status is-error';
      return;
    }
    if (existingIndex >= 0) trackingItems[existingIndex] = next;
    else trackingItems.push(next);
    savePortfolio();
    renderTrackingItems();
    resetTrackingForm();
  });
  document.querySelector('#tracking-form [name="name"]').addEventListener('input', () => fillTrackingCodeFromName(true));
  document.querySelector('#tracking-form [name="name"]').addEventListener('change', () => fillTrackingCodeFromName(false));
  document.getElementById('cancel-tracking-edit').addEventListener('click', resetTrackingForm);
  document.getElementById('tracking-filter').addEventListener('click', event => {
    const button = event.target.closest('button[data-status-filter]');
    if (!button) return;
    trackingStatusFilter = button.dataset.statusFilter;
    document.querySelectorAll('#tracking-filter button').forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    renderTrackingItems();
  });
  document.getElementById('tracking-sort-intraday')?.addEventListener('click', () => {
    trackingSortMode = trackingSortMode === 'near-left' ? 'updated' : 'near-left';
    renderTrackingItems();
  });
  document.getElementById('tracking-allocation-mode')?.addEventListener('click', () => {
    trackingAllocationMode = !trackingAllocationMode;
    renderTrackingItems();
  });
  document.getElementById('tracking-allocation-collapse')?.addEventListener('click', () => {
    trackingAllocationCollapsed = !trackingAllocationCollapsed;
    renderTrackingItems();
  });
  document.getElementById('holding-tracker-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      const clickedLink = event.target.closest('a');
      const reportHref = event.target.closest('[data-report-href]')?.dataset.reportHref;
      if (!clickedLink && reportHref) globalThis.open(reportHref, '_blank', 'noopener,noreferrer');
      return;
    }
    const row = button.closest('[data-tracking-id]');
    const item = trackingItems.find(entry => entry.id === row.dataset.trackingId);
    if (!item) return;
    if (button.dataset.action === 'delete-tracking') {
      if (!globalThis.confirm(`删除 ${item.name} 的跟踪记录？`)) return;
      trackingItems = trackingItems.filter(entry => entry.id !== item.id);
      savePortfolio();
      renderTrackingItems();
      resetTrackingForm();
      return;
    }
    if (button.dataset.action === 'review-diary') {
      openReviewDiary(item);
      return;
    }
    const form = document.getElementById('tracking-form');
    for (const key of ['id', 'code', 'name', 'status', 'thesis', 'riskLine', 'nextAction', 'reviewCondition']) {
      form.elements[key].value = item[key];
    }
    document.getElementById('tracking-form-title').textContent = `编辑 ${item.name}`;
    document.getElementById('cancel-tracking-edit').hidden = false;
    openTrackingForm();
  });
  document.getElementById('review-diary-modal').addEventListener('click', event => {
    if (event.target.closest('[data-action="close-review-diary"]')) closeReviewDiary();
  });
  document.getElementById('margin-balance-modal').addEventListener('click', event => {
    if (event.target.closest('[data-action="close-margin-balance"]')) closeMarginBalanceModal();
  });
  document.getElementById('review-diary-form').addEventListener('submit', event => {
    event.preventDefault();
    const item = trackingItems.find(entry => entry.id === event.currentTarget.elements.trackingId.value);
    if (item) saveReviewDiary(item);
  });
  document.getElementById('nav-toggle').addEventListener('click', event => {
    const open = document.getElementById('sidebar').classList.toggle('is-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  exampleToggle.addEventListener('change', () => {
    if (exampleToggle.checked) {
      state.snapshot = EXAMPLE_SNAPSHOT;
      notice.className = 'notice';
      notice.textContent = '初始化数据已开启；所有数值均为演示，不写入真实数据缓存。';
      render();
    } else {
      refreshLive();
    }
  });
  refreshButton.addEventListener('click', () => {
    refreshLive();
    loadYouzhiyouxingTemperature();
    loadNasdaq100();
    refreshTrackingQuotes();
  });
  fuguiProviderToggle?.addEventListener('click', () => {
    fuguiDataProvider = fuguiDataProvider === 'akshare' ? 'tushare' : 'akshare';
    storage.setItem(FUGUI_PROVIDER_STORAGE_KEY, fuguiDataProvider);
    renderFuguiProviderToggle();
    fuguiStrategyStatus.textContent = `富贵策略数据源已切换为 ${fuguiDataProvider === 'akshare' ? 'AKShare' : 'Tushare'}。`;
  });

  setShell('thermometer', 'market-summary');
  renderFuguiProviderToggle();
  setFuguiPanelCollapsed(storage.getItem(FUGUI_PANEL_COLLAPSED_STORAGE_KEY) === '1');
  render();
  renderFuguiStrategy();
  renderHoldings();
  renderTrackingItems();
  refreshTrackingQuotes();
  loadProxyPortfolio();
  loadYouzhiyouxingTemperature();
  loadNasdaq100();
  refreshLive();
  setInterval(() => {
    if (isTradingSession() && state.snapshot.mode === 'live') {
      refreshLive(['shanghaiHistory', 'csi300History', 'csiAllHistory']);
      refreshTrackingQuotes();
    }
  }, 60_000);
  setInterval(() => {
    if (isTradingSession() && state.snapshot.mode === 'live') refreshLive(['market']);
  }, 300_000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp, { once: true });
  else startApp();
}
