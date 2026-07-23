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
import { isLocalProxyLocation } from './adapters.mjs';
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
const YOUZHIYOUXING_TEMPERATURE_URL = 'https://youzhiyouxing.cn/data';
const CSI_DIVIDEND_SIGNAL_SOURCE_URL = '../../sources/automations/中证红利信号/最新信号.md';
const HOLDING_STATUSES = new Set(['持有', '观察', '计划加仓', '计划减仓']);
const STOCK_CODE_ALIASES = Object.freeze({
  航天电子: '600879',
  云铝股份: '000807',
  东阳光: '600673',
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
const CSI_DIVIDEND_SIGNAL = Object.freeze(
  // CSI_DIVIDEND_SIGNAL
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
    return `<a class="dividend-signal-card is-missing is-clickable-card" href="${CSI_DIVIDEND_SIGNAL_SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="打开中证红利最新信号源数据">
      <div class="dividend-signal-main"><span>中证红利信号</span><strong>待接入</strong><p>未找到本地最新信号记录。</p></div>
    </a>`;
  }
  const absolute = normalizeSignalLevel(signal.absoluteSignal);
  const spread = normalizeSignalLevel(signal.spreadSignal);
  const percentile = normalizeSignalLevel(signal.percentileSignal);
  const isFocus = /重点买入区间|重点买入/.test(signal.headline ?? '') || [absolute, spread, percentile].some(item => item.grade === 'A');
  return `<a class="dividend-signal-card is-clickable-card${isFocus ? ' is-focus' : ''}" href="${CSI_DIVIDEND_SIGNAL_SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="打开中证红利最新信号源数据">
    <div class="dividend-signal-main">
      <span>中证红利股息率信号</span>
      <strong>${escapeHtml(isFocus ? '重点买入观察' : '未进重点买入')}</strong>
      <p>${escapeHtml(signal.headline ?? '暂无综合结论')}</p>
    </div>
    <div class="dividend-signal-grid">
      <div><small>股息率2</small><strong>${formatNumber(signal.dividendYield2, 2)}%</strong><span>${escapeHtml(absolute.grade ? `${absolute.grade} ${absolute.label}` : signal.absoluteSignal ?? '待验证')}</span></div>
      <div><small>10年国债</small><strong>${formatNumber(signal.bond10yYield, 2)}%</strong><span>${escapeHtml(signal.bondDate ?? '日期待确认')}</span></div>
      <div><small>股债利差</small><strong>${formatNumber(signal.spread, 2)}%</strong><span>${escapeHtml(spread.grade ? `${spread.grade} ${spread.label}` : signal.spreadSignal ?? '待验证')}</span></div>
      <div><small>历史分位</small><strong>${escapeHtml(percentile.grade || '待验证')}</strong><span>${escapeHtml(signal.percentileSignal ?? '待验证')}</span></div>
    </div>
  </a>`;
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

function renderDerived(derived, officialTemperature = { status: 'loading' }) {
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
    industry: 'industry-strategy',
    personal: 'position-manager',
    changelog: 'changelog-view',
  };
  const domain = Object.hasOwn(defaults, requestedDomain) ? requestedDomain : 'thermometer';
  return { domain, viewId: requestedView ?? activeViews[domain] ?? defaults[domain] };
}

function startApp() {
  const state = {
    snapshot: EXAMPLE_SNAPSHOT,
    windowYears: 5,
    busy: false,
    youzhiyouxingTemperature: { status: 'loading', sourceUrl: YOUZHIYOUXING_TEMPERATURE_URL },
  };
  const storage = resolveStorage();
  let { holdings, trackingItems } = loadPortfolio(storage);
  let trackingStatusFilter = 'all';
  const launcherHint = globalThis.location?.protocol === 'file:'
    ? ' 稳定联网请双击“启动大盘面板.cmd”。'
    : '';
  const notice = document.getElementById('global-notice');
  const refreshButton = document.getElementById('refresh-data');
  const exampleToggle = document.getElementById('example-mode');
  const marketActions = document.getElementById('market-actions');
  const topbar = document.querySelector('.topbar');
  const pageTitle = document.getElementById('page-title');
  const pageEyebrow = document.querySelector('.topbar .eyebrow');
  const sidebarFooter = document.querySelector('.sidebar-footer');
  const activeViewByShell = {
    thermometer: 'market-summary',
    industry: 'industry-strategy',
    personal: 'position-manager',
    changelog: 'changelog-view',
  };

  const formatMoney = value => `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  const loadProxyPortfolio = async () => {
    if (!isLocalProxyLocation()) return;
    try {
      const response = await fetch('/api/portfolio', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const proxyPortfolio = normalizePortfolioPayload(payload);
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

  const resetTrackingForm = () => {
    const form = document.getElementById('tracking-form');
    form.reset();
    form.elements.id.value = '';
    form.elements.status.value = '观察';
    document.getElementById('tracking-form-title').textContent = '新增跟踪';
    document.getElementById('cancel-tracking-edit').hidden = true;
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

  const renderTrackingItems = () => {
    const summary = summarizeTrackingItems(trackingItems);
    const visibleItems = trackingStatusFilter === 'all'
      ? summary.items
      : summary.items.filter(item => item.status === trackingStatusFilter);
    document.getElementById('tracking-count').textContent = String(summary.count);
    document.getElementById('tracking-holding-count').textContent = String(summary.countByStatus['持有']);
    document.getElementById('tracking-watch-count').textContent = String(summary.countByStatus['观察']);
    document.getElementById('tracking-updated').textContent = summary.latestUpdatedAt
      ? new Date(summary.latestUpdatedAt).toLocaleDateString('zh-CN')
      : '尚未记录';
    document.getElementById('holding-tracker-empty').hidden = visibleItems.length > 0;
    document.getElementById('holding-tracker-list').innerHTML = visibleItems.map(item => {
      const reportHref = reportLinkForTrackingItem(item);
      const nameHtml = reportHref
        ? `<a href="${escapeHtml(reportHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>`
        : escapeHtml(item.name);
      return `<tr data-tracking-id="${escapeHtml(item.id)}"${reportHref ? ` data-report-href="${escapeHtml(reportHref)}"` : ''}>
      <td class="tracking-target"><strong>${nameHtml}</strong><small>${escapeHtml(item.code) || '未填代码'}</small></td>
      <td><span class="tracker-status">${escapeHtml(item.status)}</span></td>
      <td>${escapeHtml(item.thesis) || '未记录'}</td>
      <td>${escapeHtml(item.riskLine) || '未记录'}</td>
      <td>${escapeHtml(item.nextAction) || '未记录'}</td>
      <td>${escapeHtml(item.reviewCondition) || '未记录'}</td>
      <td class="tracking-updated">${new Date(item.updatedAt).toLocaleString('zh-CN', { hour12: false })}</td>
      <td><div class="tracker-row-actions"><button type="button" data-action="edit-tracking">编辑</button><button type="button" data-action="delete-tracking">删除</button></div></td>
    </tr>`;
    }).join('');
  };

  const render = () => {
    const derived = deriveDashboard(state.snapshot, state.windowYears);
    renderDerived(derived, state.youzhiyouxingTemperature);
    document.querySelectorAll('[data-window]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.window) === state.windowYears)));
  };

  const loadYouzhiyouxingTemperature = async () => {
    if (!isLocalProxyLocation()) {
      state.youzhiyouxingTemperature = {
        status: 'missing',
        error: '稳定联网请双击“启动大盘面板.cmd”。',
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
        concurrency: isLocalProxyLocation() ? 1 : definitions.length,
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
    marketActions.hidden = targetShell !== 'thermometer';
    topbar.hidden = targetShell === 'changelog';
    notice.hidden = targetShell !== 'thermometer';
    sidebarFooter.hidden = targetShell !== 'thermometer';
    pageEyebrow.textContent = {
      thermometer: 'MARKET VALUATION MONITOR',
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
    const form = document.getElementById('tracking-form');
    for (const key of ['id', 'code', 'name', 'status', 'thesis', 'riskLine', 'nextAction', 'reviewCondition']) {
      form.elements[key].value = item[key];
    }
    document.getElementById('tracking-form-title').textContent = `编辑 ${item.name}`;
    document.getElementById('cancel-tracking-edit').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  });

  setShell('thermometer', 'market-summary');
  render();
  renderHoldings();
  renderTrackingItems();
  loadProxyPortfolio();
  loadYouzhiyouxingTemperature();
  refreshLive();
  setInterval(() => {
    if (isTradingSession() && state.snapshot.mode === 'live') {
      refreshLive(['shanghaiHistory', 'csi300History', 'csiAllHistory']);
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
