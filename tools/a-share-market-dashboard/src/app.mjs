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

function metricStatus(metric) {
  return Number.isFinite(metric.score) ? metric.status : 'missing';
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

function renderDerived(derived) {
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
  const errors = [...new Set(derived.metrics.flatMap(metric => metric.errors ?? []))];
  byId('audit-summary').innerHTML = `
    <div><small>规则版本</small><strong>v1.0</strong></div>
    <div><small>有效指标</small><strong>${validCount} / ${derived.metrics.length}</strong></div>
    <div><small>有效覆盖率</small><strong>${formatNumber(derived.score.coverage, 1)}%</strong></div>
    <div><small>接口错误</small><strong>${errors.length}</strong></div>`;
  byId('audit-errors').innerHTML = errors.length
    ? `<ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`
    : '';
  byId('audit-table-body').innerHTML = derived.metrics.map(metric => `<tr>
    <td>${escapeHtml(metric.label)}</td><td>${STATUS_LABELS[metricStatus(metric)] ?? metricStatus(metric)}</td><td>${escapeHtml(metric.source)}</td>
    <td>${formatTime(metric.dataAt)}</td><td>${metric.weight}%</td><td>${formatNumber(metric.effectiveWeight, 1)}%</td><td>${formatNumber(metric.contribution, 2)}</td>
  </tr>`).join('');
  byId('sidebar-valid').textContent = `${validCount} / ${derived.metrics.length} 项有效`;
  byId('sidebar-updated').textContent = formatTime(Math.max(...derived.metrics.map(metric => Number(metric.fetchedAt)).filter(Number.isFinite)));
  byId('sidebar-status').textContent = derived.mode === 'example' ? '示例数据' : derived.score.coverage >= 70 ? '数据可判断' : '数据不完整';
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

function startApp() {
  const state = { snapshot: EXAMPLE_SNAPSHOT, windowYears: 5, busy: false };
  const storage = resolveStorage();
  const launcherHint = globalThis.location?.protocol === 'file:'
    ? ' 稳定联网请双击“启动A股大盘面板.cmd”。'
    : '';
  const notice = document.getElementById('global-notice');
  const refreshButton = document.getElementById('refresh-data');
  const exampleToggle = document.getElementById('example-mode');

  const render = () => {
    const derived = deriveDashboard(state.snapshot, state.windowYears);
    renderDerived(derived);
    document.querySelectorAll('[data-window]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.window) === state.windowYears)));
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
        notice.textContent = `公开接口均不可用，继续显示明确标记的示例数据；没有把示例值写入真实缓存。${launcherHint}`;
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

  document.querySelectorAll('[data-window]').forEach(button => button.addEventListener('click', () => {
    state.windowYears = Number(button.dataset.window);
    render();
  }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(item => { item.classList.toggle('is-active', item === button); item.removeAttribute('aria-current'); });
    button.setAttribute('aria-current', 'page');
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-active', view.id === button.dataset.view));
    document.getElementById('page-title').textContent = button.textContent.replace(/^\d+/, '').trim();
    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('nav-toggle').setAttribute('aria-expanded', 'false');
  }));
  document.getElementById('nav-toggle').addEventListener('click', event => {
    const open = document.getElementById('sidebar').classList.toggle('is-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  exampleToggle.addEventListener('change', () => {
    if (exampleToggle.checked) {
      state.snapshot = EXAMPLE_SNAPSHOT;
      notice.className = 'notice';
      notice.textContent = '示例数据模式已开启；所有数值均为演示，不写入真实数据缓存。';
      render();
    } else {
      refreshLive();
    }
  });
  refreshButton.addEventListener('click', () => refreshLive());

  render();
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
