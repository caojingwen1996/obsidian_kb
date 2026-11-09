const liquidityEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const liquiditySourceName = value => String(value ?? '').replaceAll('赚钱效应', '市场涨跌分布');
const liquidityNumber = value => typeof value === 'number' && Number.isFinite(value)
  ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—';
const liquiditySigned = value => typeof value === 'number' ? `${value > 0 ? '+' : ''}${liquidityNumber(value)}` : '—';

export function liquidityUpdateTime(value) {
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(timestamp)) return '暂无成功记录';
  return new Date(timestamp).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit',
    day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
}

export const liquiditySourceCatalog = [
  ['curve', '10Y−2Y 利差', 'Tushare-data Python us_tycr；同日10年期减2年期'],
  ['yield', '10Y 收益率', 'Tushare-data Python us_tycr.y10'],
  ['vix', 'VIX', 'Yahoo Finance chart · ^VIX日收盘'],
  ['rrp', '隔夜逆回购 RRP', '纽约联储逆回购API → FRED RRPONTSYD；评分留空'],
  ['walcl', '联储总资产 WALCL', 'FRED WALCL；百万美元换算为十亿美元'],
  ['usd', '美元指数 DXY 趋势', 'Yahoo Finance chart · DX-Y.NYB已收盘日线；使用日收盘判断美元强弱'],
  ['dxy', 'DXY 盘中报价', 'Yahoo Finance chart · DX-Y.NYB参考报价，可能延迟；不混入日线评分'],
  ['spx', '标普500 / MA200', 'Tushare-data Python index_global(SPX)；使用200日收盘均线'],
  ['margin', '沪深融资余额', 'Tushare-data Python margin；沪深完整配对的融资余额，不含融券及北交所'],
  ['flow', '主力资金净流入', 'AKShare stock_market_fund_flow · 东方财富沪深主力净额；最近5个交易日合计，为数据商估算'],
  ['shibor', 'Shibor 隔夜', 'Tushare-data Python shibor.on；单位为百分比'],
  ['south', '南向资金净买入', 'Tushare ggt_daily，经共享Python读取；买入成交额减卖出成交额，沿用接口亿元单位（币种待核验），不拼接旧东财历史'],
  ['csi300', '沪深300 / 年线', 'Tushare-data Python index_daily(000300.SH)；使用250日收盘均线'],
  ['cn_margin_net', '融资净买入', 'Tushare-data Python margin：沪深RZMRE买入额 − RZCHE偿还额；元换算为亿元'],
  ['cn_margin_ratio', '融资占流通市值', 'Tushare-data Python margin + daily_info：同日沪深融资余额 ÷ 沪深股票市场流通市值（含B股、排除北交所）× 100%；缺一市场不计算'],
  ['cn_super_flow', '超大单资金', 'AKShare stock_market_fund_flow · 东方财富沪深超大单净额；订单规模估算，不代表已确认的机构账户'],
  ['cn_small_flow', '小单资金', 'AKShare stock_market_fund_flow · 东方财富沪深小单净额；订单规模估算，不代表已确认的散户账户'],
  ['cn_etf_flow', 'ETF申赎净流入（估算）', 'Tushare fund_share + fund_nav：连续交易日份额变化×当日单位净值；股票型ETF含港股通、排除QDII；异常基金单列，非现金实际到账额'],
  ['cn_breadth_ratio', '市场涨跌分布', '乐咕乐股市场涨跌分布页面：沪深上涨、下跌、平盘、总家数及涨跌停；上涨比例分母含停牌，历史从本机采集起累积'],
];

export function renderLiquiditySources(report = null) {
  const etf = report?.fundingMonitor?.cards?.find(item => item.id === 'cn_etf_flow');
  const mode = report?.provider === 'tushare' ? '已接入的Tushare日线保持不变；VIX和美元指数通过Yahoo读取；其余使用下表的非Wind来源。ETF申赎按份额变化与净值估算，Wind保持停用。' : !report ? '正在核对当前读取方式，下面先列出已接入的公开数据源。'
    : etf?.transport === 'wind-mcp' ? `ETF已启用Wind MCP后台取数；${report.provider === 'wind' ? '其余指标读取Wind导入文件' : '其余指标沿用免费公开源'}。本次成功状态与观测日期见下表。`
    : report.provider === 'wind' ? '本次读取：本地已导入的 Wind 数据文件。未在页面中实时调用 Wind MCP。'
    : report.fundingMonitor?.cards?.some(item => item.id === 'cn_etf_flow' && item.value !== null)
      ? '本次读取：公开数据源与ETF本地导入，由本机面板服务读取。单项供应商见实际来源；页面未实时调用Wind MCP。'
      : '本次读取：免费公开数据源，由本机面板服务获取或读取有效缓存。本页当前没有使用 Wind 数据。';
  const allMetrics = [...(report?.metrics ?? []), ...(report?.fundingMonitor?.cards ?? []),
    ...(report?.fundingMonitor?.breadth ?? []), ...(report?.fundingMonitor?.marginRatio ? [report.fundingMonitor.marginRatio] : [])];
  const rows = liquiditySourceCatalog.map(([id, name, pipeline]) => {
    const metric = allMetrics.find(item => item.id === id);
    const state = !metric ? '尚未取得本次结果' : ({ ok: metric.cached ? '读取有效缓存' : id === 'cn_etf_flow' && metric.transport !== 'wind-mcp' ? '读取本地导入' : '本次联网取得',
      missing: '未取得数据', stale: '旧数据，不计分', insufficient: '样本不足，不计分' }[metric.status] ?? '待核对');
    const links = (metric?.sourceUrls ?? []).filter(url => /^https:\/\//.test(url))
      .map((url, i) => `<a href="${liquidityEscape(url)}" target="_blank" rel="noopener noreferrer">查看来源${i ? ` ${i + 1}` : ''}</a>`).join(' · ');
    return `<tr><th scope="row">${liquidityEscape(name)}</th><td data-label="数据源与取数顺序">${liquidityEscape(pipeline)}</td>
      <td data-label="本次实际读取"><strong>${liquidityEscape(liquiditySourceName(metric?.source && metric.source !== '待获取' ? metric.source : '暂无实际来源'))}</strong>
      <span>${liquidityEscape(state)}${metric?.date ? ` · 观测日期 ${liquidityEscape(metric.date)}` : ''}</span>
      ${metric?.transport === 'wind-mcp' ? `<span>更新时间：${liquidityUpdateTime(metric.updatedAt)}（北京时间）；每日09:00自动更新。时间指本机成功取数，不是Wind发布时间。</span>` : ''}
      ${metric?.coverage ? `<span>当日覆盖 ${liquidityNumber(metric.coverage.received)} / ${liquidityNumber(metric.coverage.expected)} 只ETF · 名单日期 ${liquidityEscape(metric.coverage.universeDate)}</span>` : ''}
      ${metric?.coverage?.excludedNotListed?.length ? `<span>名单 ${liquidityNumber(metric.coverage.screened)} 只，按Wind上市日期排除当日尚未上市的 ${liquidityNumber(metric.coverage.excludedNotListed.length)} 只</span>` : ''}
      ${metric?.refresh?.running ? `<span>${liquidityEscape(metric.refresh.message)}，完成 ${liquidityNumber(metric.refresh.completedBatches ?? 0)} / ${liquidityNumber(metric.refresh.totalBatches ?? 0)} 批</span>` : ''}
      ${metric?.reason ? `<span>${liquidityEscape(metric.reason)}</span>` : ''}${links ? `<span>${links}</span>` : ''}</td></tr>`;
  }).join('');
  return `<p class="liquidity-source-mode">${mode}</p><p>“数据源与取数顺序”说明先查哪里、失败后换哪里；“本次实际读取”显示这一次真正使用的来源。备用源只在主源失败时尝试，不表示所有源都已成功读取。</p>
    <table class="liquidity-source-table"><caption>A股与美股全部指标，包括暂不可用及不计分的参考项</caption><thead><tr><th scope="col">指标</th><th scope="col">数据源与取数顺序</th><th scope="col">本次实际读取</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderFundingMonitor(monitor) {
  if (!monitor) return '<section class="liquidity-funding panel"><h2>各路资金最新动向</h2><p>监测数据尚未返回，请刷新；若持续缺失，请重新启动面板服务。</p></section>';
  const cards = monitor.cards.map(metric => {
    const usable = metric.status === 'ok';
    const tone = usable && metric.value > 0 ? 'is-inflow' : usable && metric.value < 0 ? 'is-outflow' : '';
    const previous = metric.previous;
    const comparison = metric.estimate ? '按有效基金样本计算，覆盖不足时不代表全市场' : previous ? `前次 ${liquiditySigned(previous.value)} 亿元 · ${previous.date}` : '前次：暂无已记录观测';
    const percentile = metric.estimate ? '每日样本可能变化，暂不计算历史分位' : metric.percentile !== null ? `近60次分位 P${metric.percentile}` : metric.status === 'stale' ? '旧数据 · 暂不判断分位' : `分位待积累 · ${metric.sampleCount} / 60`;
    const difference = usable && previous ? metric.value - previous.value : null;
    const movement = difference === null ? '' : difference > 0 ? '较前次净额增加' : difference < 0 ? '较前次净额减少' : '较前次净额持平';
    const ratio = monitor.marginRatio;
    const ratioText = metric.id === 'cn_margin_net' && ratio ? `<p class="liquidity-funding-context">融资占流通市值 <strong>${liquidityNumber(ratio.value)}%</strong>${ratio.date ? ` · ${liquidityEscape(ratio.date)}` : ''}${ratio.status !== 'ok' ? ' · 暂不可用或已过期' : ''}<br>仅观察占比，不预设正常区间</p>` : '';
    return `<article class="liquidity-funding-card ${tone}" data-funding-id="${liquidityEscape(metric.id)}">
      <div class="liquidity-funding-heading"><h3>${liquidityEscape(metric.name)}</h3><span>${usable ? liquidityEscape(metric.direction) : metric.status === 'stale' ? '旧数据' : '暂无数据'}</span></div>
      <p class="liquidity-funding-value">${liquiditySigned(metric.value)}<span> 亿元</span></p>
      <p class="liquidity-funding-date">${metric.id === 'cn_etf_flow' ? '数据日期：' : ''}${liquidityEscape(metric.date ?? '暂无观测日期')}${usable && metric.cached ? ' · 有效缓存' : ''}</p>
      ${metric.transport === 'wind-mcp' ? `<p class="liquidity-funding-date">更新时间：${liquidityUpdateTime(metric.updatedAt)}（北京时间）</p><p class="liquidity-funding-date">每日09:00自动更新 · 支持手动刷新<br>更新时间为本机最近成功取数时间</p>` : ''}
      <p class="liquidity-funding-comparison">${liquidityEscape(comparison)}<br>${liquidityEscape(percentile)}${movement ? ` · ${movement}` : ''}</p>
      ${metric.coverage ? `<p class="liquidity-funding-date">${metric.estimate ? 'Tushare样本' : 'Wind MCP'} · 覆盖 ${liquidityNumber(metric.coverage.received)} / ${liquidityNumber(metric.coverage.expected)} 只ETF</p>` : ''}
      ${metric.estimate ? `<p class="liquidity-funding-date">最近成功读取：${liquidityUpdateTime(metric.updatedAt)}（北京时间）<br>随看板刷新，缓存1小时；新上市首日不计申赎。</p>` : ''}
      ${metric.estimate && metric.coverage?.unknown_listing_date?.length ? `<details><summary>上市日期不明，未纳入（${metric.coverage.unknown_listing_date.length}只）</summary><p>${metric.coverage.unknown_listing_date.map(liquidityEscape).join('、')}</p></details>` : ''}
      ${metric.excluded?.length ? `<details><summary>查看未计入基金（${metric.excluded.length}只）</summary><ul>${metric.excluded.map(item => `<li>${liquidityEscape(item.ts_code)} ${liquidityEscape(item.name)}：${liquidityEscape(({missing_share:'缺少连续两日份额',missing_nav_or_adjustment:'缺少净值或复权校验数据',corporate_action_review:'份额折算或分红待核实'})[item.reason] ?? '数据待核实')}</li>`).join('')}</ul></details>` : ''}
      ${metric.coverage?.excludedNotListed?.length ? `<p class="liquidity-funding-date">另有 ${liquidityNumber(metric.coverage.excludedNotListed.length)} 只当日尚未上市，已按上市日期排除</p>` : ''}
      ${metric.refresh?.running ? `<p class="liquidity-data-note">${liquidityEscape(metric.refresh.message)}${metric.refresh.totalBatches ? ` · ${liquidityNumber(metric.refresh.completedBatches)} / ${liquidityNumber(metric.refresh.totalBatches)} 批` : ''}，完成后自动更新</p>` : ''}
      ${ratioText}<p class="liquidity-funding-boundary">${liquidityEscape(metric.estimate ? [metric.reason, metric.rule].filter(Boolean).join(' ') : metric.reason || metric.rule)}</p>
      <details class="liquidity-funding-history"><summary>查看口径与历史</summary>${renderLiquidityChart(metric)}</details>
    </article>`;
  }).join('');
  const breadth = monitor.breadth ?? [];
  const ratio = breadth.find(item => item.id === 'cn_breadth_ratio');
  const previous = ratio?.previous;
  const stats = [['cn_breadth_up', '上涨'], ['cn_breadth_down', '下跌'], ['cn_breadth_flat', '平盘'],
    ['cn_breadth_limit_up', '涨停'], ['cn_breadth_limit_down', '跌停'], ['cn_breadth_total', '统计总家数']].map(([id, label]) => {
    const item = breadth.find(row => row.id === id);
    const aligned = item?.date && item.date === ratio?.date && item.status === ratio?.status;
    return `<div><dt>${label}</dt><dd>${aligned ? liquidityNumber(item.value) : '—'}<span> 家</span></dd></div>`;
  }).join('');
  return `<section class="liquidity-funding panel" aria-labelledby="liquidity-funding-title">
    <div class="liquidity-funding-title"><h2 id="liquidity-funding-title">各路资金最新动向</h2><span>沪深市场 · 观察项</span></div>
    <p class="liquidity-funding-intro">${liquidityEscape(monitor.note)}</p><div class="liquidity-funding-grid">${cards}</div>
    <section class="liquidity-breadth" aria-label="市场涨跌分布"><div><h3>市场涨跌分布</h3>
      <p><strong>${liquidityNumber(ratio?.value)}%</strong> 个股上涨</p>
      <p class="liquidity-funding-date">${liquidityEscape(ratio?.date ?? '暂无观测日期')} · ${ratio?.status === 'ok' ? '收盘观测' : ratio?.status === 'stale' ? '旧数据，待更新' : '暂不可用'}</p>
      <p class="liquidity-funding-date">${previous ? `前次 ${liquidityNumber(previous.value)}% · ${liquidityEscape(previous.date)}` : '前次：首次采集尚无对比，后续按日累积'}</p></div><dl>${stats}</dl>
      <p class="liquidity-breadth-note">${liquidityEscape(ratio?.rule ?? '')}${ratio?.reason ? ` ${liquidityEscape(ratio.reason)}` : ''}</p>
    </section><p class="liquidity-funding-footnote">${liquidityEscape(monitor.percentileRule)}</p></section>`;
}

export function liquidityVerdict(market) {
  if (!market || market.score === null) return '数据不足';
  return `${market.label}${market.complete ? '' : '（部分指标）'} · ${liquiditySigned(market.score)} 分`;
}

export function renderLiquidityRows(metrics, selected) {
  return metrics.filter(metric => !metric.optional || metric.status === 'ok').map(metric => {
    const state = { ok: metric.cached ? '有效缓存' : '已更新', missing: '不可用', stale: '旧数据 · 不计分', insufficient: '样本不足' }[metric.status] ?? '待确认';
    const score = metric.pendingRule ? '— · 规则待定' : metric.reference ? '参考项' : metric.score === null ? '不计分' : `${liquiditySigned(metric.score)} 分`;
    return `<tr${metric.id === selected ? ' class="is-selected"' : ''}>
      <th scope="row"><button type="button" data-liquidity-metric="${liquidityEscape(metric.id)}" aria-pressed="${metric.id === selected}">${liquidityEscape(metric.name)}</button><span>${liquidityEscape(metric.date ?? '暂无观测日期')}</span></th>
      <td data-label="最新值"><strong>${liquidityNumber(metric.value)}</strong> <span>${liquidityEscape(metric.unit)}</span></td>
      <td data-label="信号" class="liquidity-score ${metric.score > 0 ? 'is-loose' : metric.score < 0 ? 'is-tight' : ''}">${score}</td>
      <td data-label="来源与状态"><span>${liquidityEscape(liquiditySourceName(metric.source))}</span><span>${state}</span></td>
    </tr>`;
  }).join('');
}

export function renderLiquidityChart(metric) {
  if (!metric) return '';
  const points = metric.points ?? [];
  const values = points.map(p => p.value).filter(Number.isFinite);
  const chartPoints = points.filter(p => Number.isFinite(p.value));
  const min = Math.min(...values), max = Math.max(...values), range = max - min || Math.max(Math.abs(max) * .02, 1);
  const x = i => 64 + i / Math.max(chartPoints.length - 1, 1) * 796;
  const y = value => 210 - (value - min) / range * 168;
  const path = chartPoints.map((point, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
  const guide = metric.baseline !== null && ['spx', 'csi300'].includes(metric.id) && metric.baseline >= min && metric.baseline <= max
    ? `<line x1="64" x2="860" y1="${y(metric.baseline)}" y2="${y(metric.baseline)}" class="liquidity-ma-line"/><text x="856" y="${y(metric.baseline) - 6}" text-anchor="end">最新均线 ${liquidityNumber(metric.baseline)}</text>` : '';
  const svg = points.length >= 2 ? `<svg viewBox="0 0 900 250" role="img" aria-label="${liquidityEscape(metric.name)}历史走势，${liquidityEscape(points[0].date)}至${liquidityEscape(points.at(-1).date)}">
    <line x1="64" y1="210" x2="860" y2="210" class="liquidity-axis"/>
    <text x="56" y="46" text-anchor="end">${liquidityNumber(max)}</text><text x="56" y="214" text-anchor="end">${liquidityNumber(min)}</text>
    ${guide}<path d="${path}" class="liquidity-trend-line"/>
    <text x="64" y="240">${liquidityEscape(points[0].date)}</text><text x="860" y="240" text-anchor="end">${liquidityEscape(points.at(-1).date)}</text>
    </svg>` : '<p class="liquidity-empty">历史观测不足，暂不能绘制走势。</p>';
  let comparison = '';
  if (metric.change !== null) {
    const unit = ['yield', 'shibor'].includes(metric.id) ? 'bp' : ['margin', 'rrp', 'usd', 'spx', 'csi300'].includes(metric.id) ? '%' : metric.unit;
    const label = ['spx', 'csi300'].includes(metric.id) ? '较当前均线' : metric.id === 'flow' ? '近5日合计' : '规则比较值';
    comparison = `<span>${label} <strong>${liquiditySigned(metric.change)} ${liquidityEscape(unit)}</strong></span>`;
  }
  const sourceLinks = (metric.sourceUrls ?? []).filter(url => /^https:\/\//.test(url)).map((url, i) => `<a href="${liquidityEscape(url)}" target="_blank" rel="noopener noreferrer">原始来源${i ? ` ${i + 1}` : ''}</a>`).join(' · ');
  return `<div class="liquidity-chart-heading"><div><h3>${liquidityEscape(metric.name)}</h3><p>${liquidityEscape(metric.rule)}</p></div>${comparison}</div>
    ${metric.reason ? `<p class="liquidity-data-note">${liquidityEscape(metric.reason)}</p>` : ''}
    <div class="liquidity-chart">${svg}</div>
    <div class="liquidity-chart-footer"><span>${points.length} 个观测值 · ${liquidityEscape(metric.unit)} · 按有效观测顺序绘制</span><span>${sourceLinks}</span></div>
    <details class="liquidity-history"><summary>查看历史数值${points.length ? `（${points.length} 条）` : ''}</summary><div class="liquidity-history-scroll"><table><thead><tr><th scope="col">日期</th><th scope="col">${liquidityEscape(metric.unit)}</th></tr></thead><tbody>${[...points].reverse().map(point => `<tr><td>${liquidityEscape(point.date)}</td><td>${liquidityNumber(point.value)}</td></tr>`).join('')}</tbody></table></div></details>`;
}

export function initLiquidityDashboard({ document, openView, fetcher = globalThis.fetch }) {
  const card = document.getElementById('liquidity-card');
  const content = document.getElementById('liquidity-content');
  const status = document.getElementById('liquidity-status');
  const refresh = document.getElementById('liquidity-refresh');
  const sourceContent = document.getElementById('liquidity-source-content');
  if (sourceContent) sourceContent.innerHTML = renderLiquiditySources();
  let report = null, market = 'cn', selected = 'margin', pending = null, pollTimer = null, pollFailures = 0, etfCheckPending = false;
  const render = () => {
    if (!report) return;
    const expanded = [...content.querySelectorAll('.liquidity-funding-card')].map(el => ({id: el.dataset.fundingId,
      details: [...el.querySelectorAll('details')].map(detail => detail.open)}));
    if (sourceContent) sourceContent.innerHTML = renderLiquiditySources(report);
    document.getElementById('liquidity-card-cn').textContent = `A股 ${liquidityVerdict(report.markets.cn)}`;
    document.getElementById('liquidity-card-us').textContent = `美股 ${liquidityVerdict(report.markets.us)}`;
    const metrics = report.metrics.filter(metric => metric.market === market);
    const visible = metrics.filter(metric => !metric.optional || metric.status === 'ok');
    if (!visible.some(metric => metric.id === selected)) selected = visible[0]?.id;
    const summary = report.markets[market];
    const alert = report.alerts.length ? report.alerts.join('；') : report.alertsComplete ? '当前未触发三项宏观风险阈值' : '风险警报数据不完整，暂不能排除风险';
    content.innerHTML = `<div class="liquidity-alert${report.alerts.length ? ' is-warning' : ''}" role="status"><strong>宏观风险提醒</strong><span>${liquidityEscape(alert)}${report.alerts.length && !report.alertsComplete ? '；另有警报指标缺失' : ''}</span></div>
      <div class="liquidity-market-tabs" role="group" aria-label="选择市场">${[['cn', 'A股资金面'], ['us', '美股资金面']].map(([key, name]) => `<button type="button" data-liquidity-market="${key}" aria-pressed="${key === market}">${name}<span>${liquidityEscape(liquidityVerdict(report.markets[key]))}</span></button>`).join('')}</div>
      ${market === 'cn' ? renderFundingMonitor(report.fundingMonitor) : ''}
      <section class="liquidity-market panel" aria-label="资金面指标"><div class="liquidity-market-heading"><div><h2>${market === 'cn' ? 'A股' : '美股'}资金面</h2><p>${liquidityEscape(liquidityVerdict(summary))}</p></div><div class="liquidity-coverage"><strong>${summary.valid} / ${summary.total}</strong><span>有效评分指标</span></div></div>
      ${!summary.complete ? '<p class="liquidity-data-note">结论仅汇总可用指标，未归一化。缺失、过期或样本不足的指标不计分，不代表完整市场状态。</p>' : ''}
      <table class="liquidity-table"><caption>点击指标名称查看历史走势与评分依据</caption><thead><tr><th scope="col">指标 / 观测日</th><th scope="col">最新值</th><th scope="col">信号</th><th scope="col">来源与状态</th></tr></thead><tbody>${renderLiquidityRows(metrics, selected)}</tbody></table>
      ${metrics.some(metric => metric.optional && metric.status !== 'ok') ? '<p class="liquidity-data-note">主力资金接口暂不可用，相应行与走势图已隐藏，不计入有效指标。</p>' : ''}</section>
      <section class="liquidity-detail panel" id="liquidity-detail" aria-label="指标详情">${renderLiquidityChart(metrics.find(metric => metric.id === selected))}</section>`;
    for (const item of expanded) {
      const target = [...content.querySelectorAll('.liquidity-funding-card')].find(el => el.dataset.fundingId === item.id);
      target?.querySelectorAll('details').forEach((detail, index) => { detail.open = item.details[index] ?? false; });
    }
  };
  function scheduleETFCheck() {
    clearTimeout(pollTimer);
    const etf = report?.fundingMonitor?.cards?.find(item => item.transport === 'wind-mcp');
    if (etf && pollFailures < 3) pollTimer = setTimeout(checkETF, etf.refresh?.running ? 5000 : 60000);
  }
  async function checkETF() {
    if (pending || etfCheckPending || document.hidden) { scheduleETFCheck(); return; }
    etfCheckPending = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher('/api/liquidity/etf', {signal:controller.signal, cache:'no-store'});
      if (!response.ok) throw new Error('ETF status unavailable');
      const {metric} = await response.json();
      if (metric?.id !== 'cn_etf_flow' || metric.transport !== 'wind-mcp') throw new Error('Invalid ETF status');
      const current = report.fundingMonitor.cards.find(item => item.id === metric.id);
      pollFailures = 0;
      if (JSON.stringify(current) !== JSON.stringify(metric)) {
        report.fundingMonitor.cards = report.fundingMonitor.cards.map(item => item.id === metric.id ? metric : item);
        render();
      }
    } catch {
      pollFailures += 1;
      if (pollFailures === 3) status.textContent += '；ETF更新状态检查暂不可用，可手动刷新。';
    } finally {
      clearTimeout(timer); etfCheckPending = false; scheduleETFCheck();
    }
  }
  async function load(force = false) {
    if (pending) return pending;
    if (report && !force) return;
    pollFailures = 0;
    clearTimeout(pollTimer);
    status.textContent = report ? '正在更新，以下仍为上次结果…' : '正在读取各数据源，首次加载可能需要十余秒…';
    refresh.disabled = true;
    refresh.textContent = '刷新中…';
    content.setAttribute('aria-busy', 'true');
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55000);
      try {
        if (globalThis.location?.protocol === 'file:') throw new Error('请通过“启动面板”打开后读取数据');
        const response = await fetcher(`/api/liquidity${force ? '?refresh=1' : ''}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(response.status === 404 ? '本地服务需要重新启动，才能加载资金面功能' : `数据服务暂不可用（${response.status}）`);
        const next = await response.json();
        if (next.schemaVersion !== 1 || !next.markets?.cn || !Array.isArray(next.metrics)) throw new Error('资金面数据格式不完整');
        report = next;
        pollFailures = 0;
        render();
        const time = new Date(report.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
        const windETF = report.fundingMonitor?.cards?.some(item => item.transport === 'wind-mcp');
        status.textContent = `${report.provider === 'tushare' ? 'Tushare + Yahoo及其他非Wind来源' : '公开数据源'} · 本次检查 ${time}（北京时间）；各指标日期见表内`;
      } catch (error) {
        status.textContent = `${error.name === 'AbortError' ? '读取超时，请稍后刷新' : error.message}${report ? '；当前保留上次结果，未确认最新状态。' : ''}`;
        if (report && sourceContent) sourceContent.innerHTML = '<p class="liquidity-data-note">本次刷新未成功：下表保留上次结果的来源与状态，尚未确认最新数据。</p>' + renderLiquiditySources(report);
        if (!report) content.innerHTML = '<p class="liquidity-empty panel">暂未取得资金面数据。请确认本地服务已启动，再点击右上角“刷新”。</p>';
        if (!report) {
          document.getElementById('liquidity-card-cn').textContent = '数据暂不可用';
          document.getElementById('liquidity-card-us').textContent = '进入详情查看原因';
        }
      } finally {
        clearTimeout(timer); refresh.disabled = false; refresh.textContent = '刷新';
        content.removeAttribute('aria-busy'); pending = null;
        scheduleETFCheck();
      }
    })();
    return pending;
  }
  card.addEventListener('click', () => openView('liquidity-view'));
  document.getElementById('liquidity-back').addEventListener('click', () => openView('market-summary'));
  refresh.addEventListener('click', () => load(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && report?.fundingMonitor?.cards?.some(item => item.transport === 'wind-mcp')) {
      pollFailures = 0; clearTimeout(pollTimer); void checkETF();
    }
  });
  content.addEventListener('click', event => {
    const tab = event.target.closest('[data-liquidity-market]');
    if (tab) {
      market = tab.dataset.liquidityMarket; selected = market === 'cn' ? 'margin' : 'curve'; render();
      content.querySelector(`[data-liquidity-market="${market}"]`).focus();
    }
    const button = event.target.closest('[data-liquidity-metric]');
    if (button) {
      selected = button.dataset.liquidityMetric; render();
      content.querySelector(`[data-liquidity-metric="${selected}"]`).focus();
    }
  });
  // Optional report loading does not block the existing startup checks.
  void load();
  return { load };
}
