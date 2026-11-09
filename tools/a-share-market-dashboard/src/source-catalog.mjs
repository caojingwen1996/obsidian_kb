import { liquiditySourceCatalog } from './liquidity-dashboard.mjs';
import { riskIndicatorRows } from './risk-indicators.mjs';

export const sourceCatalogGroups = [
  ['overview', '市场总览'], ['macro', '宏观与风险'], ['dividend', '红利信号'],
  ['liquidity', '资金面日报'], ['content', '跟踪与主题'], ['legacy', '历史计算模块'], ['pending', '风险大屏指标'],
];

// This is an implementation inventory, not a claim that every upstream is available.
const catalogBaseRows = [
  ['temperature', 'overview', '有知有行市场温度', '有知有行公开温度计 youzhiyouxing.cn/data', '页面读取', '读取源页温度及更新时间；沿用上游指标，不以本地位置／估值／情绪分数替代。'],
  ['nasdaq', 'overview', '纳斯达克100点位、涨跌幅与均线', 'Yahoo Finance chart · ^NDX', '日线＋本地计算', '日／周／月涨跌幅、MA200及偏离、年内回撤由有效日线计算；以美股交易日为准。'],
  ['nasdaq-history', 'overview', '纳指年度／月度收益、最大回撤与回撤次数', 'Yahoo Finance chart · ^NDX明确起止日期日线（1996年起）', '历史数据＋本地计算', '按各年有效样本计算；回撤次数每年重置，累计为表内年度次数相加。缺年、暂估及不同阈值分别披露。'],
  ['nasdaq-pe', 'overview', '纳指PE-TTM与近十年估值分位', '理杏仁 · 美股指数基本面', 'Python接口 · 缓存1小时', '纳斯达克100，市值加权PE-TTM及同口径十年分位；需配置理杏仁Token并核验权限，缺失不填零，数据日期单独展示。'],
  ['turnover-total', 'overview', '沪深每日成交额', 'Tushare daily_info：SH_MARKET + SZ_MARKET', '日度统计', '同日两市相加，单位亿元，含A/B股；缺少单边的日期剔除。不同于盘中成交额。'],
  ['nasdaq-etf', 'overview', '159941 ETF前高、回撤与网格参考价', 'Tushare-data Python fund_daily + fund_adj', '行情＋本地计算', '广发纳指100ETF：前高取已收盘前复权日线最高价，不含盘中行情；触发状态用最新已收盘日线。网格页可见时每分钟刷新。'],
  ['margin-total', 'macro', '融资余额及变化', 'Tushare margin，经本机tushare-data读取', '日度汇总', '用于总览与风险观察；与资金面日报的东财融资序列分开，实际日期以对应页面为准。'],
  ['us10y', 'macro', '美国10年国债收益率', 'Tushare us_tycr，经本机tushare-data读取', '日度收益率', '用于总览风险观察；资金面日报另用FRED及东财备用。'],
  ['dollar', 'macro', '美元指数', 'Tushare fx_daily，经本机tushare-data读取', '日度行情', '用于总览风险观察；资金面日报另用新浪DXY，不混用两条序列。'],
  ['usdjpy', 'macro', '美元兑日元', 'Tushare USDJPY fx_daily，经本机tushare-data读取', '日度行情', '1美元折合日元。保留来源日期，不将本机刷新时间当作行情日期。'],
  ['risk-level', 'macro', '总览风险等级', '上述美债、美元指数及美元兑日元读数', '本地规则', '美债10Y > 4.5%、美元指数 > 100或美元兑日元 ≥ 160时提示高风险；其余暂空，暂空不代表低风险。'],
  ['dividend-yield', 'dividend', '中证红利股息率2', 'AKShare stock_zh_index_value_csindex(000922) → 本地每日记录', '日度采集产物', '读取股息率2及估值日；页面读取既有信号与Excel，不因打开页面重跑每日评分。'],
  ['dividend-bond', 'dividend', '中国10年国债收益率', 'AKShare bond_zh_us_rate → 本地每日记录', '日度采集产物', 'Wind S0059749返回无权限，暂保留原来源。用于股债倍数与股债利差；国债数据日期与估值日期对齐。'],
  ['dividend-score', 'dividend', '股债倍数、股债利差、综合分及等级', '本地股息率、国债收益率与已保存策略参数', '本地计算', '倍数＝股息率÷国债收益率；利差＝股息率−国债收益率。综合分使用绝对股息率和股债倍数，权重与阈值以当前策略为准；历史分位不参与现行评分。'],
  ['dividend-price', 'dividend', '中证红利点位、日线与收益统计', 'Yahoo Finance chart参考报价；Tushare-data Python index_daily(000922.CSI)日线；区间外保留既有历史', '行情＋本地历史', '指数代码000922；日线、年度及月度统计、回撤使用各自已核验历史覆盖，不把采集日期当作交易日。'],
  ['dividend-boll', 'dividend', '中证红利周线布林带与%B', '上述中证红利日线聚合周线', '本地计算', '20周均线±2倍总体标准差；%B为相对上下轨位置。未结束周按页面注明暂估。'],
  ['etf-dividend-price', 'dividend', '515450 ETF价格、收益与布林带', 'Tushare-data Python fund_daily + fund_adj', '行情＋本地计算', '前复权价格用于走势图和收益；ETF数据独立于中证红利指数，不等同于跟踪指数行情。'],
  ['etf-dividend-yield', 'dividend', '515450 ETF现金分红率', 'Yahoo Finance chart分红事件＋Tushare-data Python未复权收盘价', '分红记录＋本地计算', '近365天已除息现金分红合计÷ETF未复权收盘价；不是跟踪指数股息率。'],
  ['dividend-task', 'dividend', '每日评分任务状态', '本地执行记录、评分记录与产物校验', '本地执行记录', '区分真实执行凭证、历史产物与查询缓存；查询过行情不等于当天评分任务已完成。'],
  ['daily-digest', 'content', '每日跟踪文章与汇总', '本地sources/automations/BBXM每日汇总', '本地归档', '随归档与面板构建更新；文章日期不代表行情更新时间。'],
  ['calendar', 'content', '事件日历', '本地data/市场总览/event-calendar.json', '本地维护', '计划事件按日期展示；已列入日历不代表已经发生。'],
  ['topics', 'content', '主题清单', '本地wiki/topics主题页', '构建时读取', '知识库导航内容，不是行情指标或实时资讯接口。'],
  ['positions', 'legacy', '上证综指、沪深300、中证全指MA250位置分位', 'Tushare-data Python index_daily；本地代理模式', '历史计算模块', '相对MA250偏离的历史分位；相关旧页面已不在侧栏，仍保留计算代码。不是有知有行温度的构成说明。'],
  ['valuation', 'legacy', '沪深300 TTM-PE及历史分位', '中证指数官网index-perf', '历史计算模块', '旧估值模块用有效历史样本计算；不作为官方温度计的本地复刻。'],
  ['forward', 'legacy', '预期PE、预期盈利收益率与ERP', '预期PE当前没有配置取数源；国债来自东财中美国债收益率', '未接入完整输入', '预期盈利收益率＝100÷预期PE；ERP再减10年国债收益率。缺少预期PE时不补造数值。'],
  ['emotion', 'legacy', '市场宽度、涨跌停平衡及成交额分位', '东方财富全市场行情 → 新浪备用；中证全指成交额历史来自中证官网', '历史计算模块', '旧情绪模块，区别于资金面日报乐咕乐股市场涨跌分布及总览Tushare成交额。'],
];

const liquidityUse = {
  curve: '同日10Y−2Y；倒挂−1，正利差较20个观测日前走阔+1。',
  yield: '20个观测日下降≥10bp计+1，上升≥10bp计−1。',
  vix: '>25计−2；<20计+1；其余0。', rrp: '仅展示余额与历史，评分规则留空，不计分。',
  walcl: '较上期周度观测扩表+1、缩表−1。', usd: '20个观测日下跌为弱美元+1，上涨为强美元−1。',
  dxy: '盘中参考，不混入日收盘趋势评分。', spx: '收盘高于200日均线+1，低于−1。',
  margin: '5个观测日变化≥+0.5%计+1，≤−0.5%计−1。', flow: '近5个交易日净额合计正+1、负−1；不可用时隐藏。',
  shibor: '5个观测日下降≥5bp计+1，上升≥5bp计−1。', south: '参考项，不计分。',
  csi300: '收盘高于250日均线+1，低于−1。',
  cn_margin_net: '观察项；展示前次净额与累积满60次后的分位。',
  cn_margin_ratio: '观察融资占流通市值比例，不预设正常或过热区间。',
  cn_super_flow: '按订单规模估算，不能确认交易者为机构；仅观察。',
  cn_small_flow: '按订单规模估算，不能确认交易者为散户；仅观察。',
  cn_etf_flow: '份额变动×当日单位净值估算；股票型含港股通、排除QDII。覆盖和异常名单可查，样本不代表全市场；旧Wind及09:00任务保持停用。',
  cn_breadth_ratio: '上涨比例及上涨／下跌／平盘／总家数、涨停／跌停；仅观察，不参与资金面评分。',
};

export function sourceCatalogRows() {
  const base = catalogBaseRows.map(([id, group, name, source, mode, note]) => ({id, group, name, source, mode, note}));
  const liquidity = liquiditySourceCatalog.map(([id, name, source]) => ({
    id: `liquidity-${id}`, group: 'liquidity', name, source,
    mode: id === 'cn_etf_flow' ? 'Python估算 · 缓存1小时' : source.startsWith('Yahoo') ? 'Yahoo Python · 资金面缓存1小时' : source.startsWith('Tushare') ? 'Python日线 · 缓存1小时' : '公开源 · 缓存1小时', note: liquidityUse[id],
  }));
  const pending = ['macro', 'commodity', 'money', 'fiscal', 'credit', 'capital', 'structure', 'event'].flatMap(category =>
    riskIndicatorRows(category).map((row, index) => ({ id: `pending-${category}-${index}`, group: 'pending',
      name: row.name, source: row.connected ? row.provider : `拟接入：${row.provider}`, mode: row.connected ? 'Yahoo Python · 缓存60秒' : '待接入',
      note: `${row.category} · ${row.scope}。${row.connected ? '已接入，实际可用状态、数据期及成功取数时间见风险大屏；失败保留旧值并标注。' : '监控模式无真实观测；设计示例中的读数和日期为虚构。'}`,
    })));
  return [...base, ...liquidity, ...pending];
}

export function filterSourceCatalog(query = '', group = 'all') {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return sourceCatalogRows().filter(row => (group === 'all' || row.group === group)
    && terms.every(term => [row.name, row.source, row.mode, row.note,
      sourceCatalogGroups.find(([id]) => id === row.group)?.[1]].join(' ').toLocaleLowerCase().includes(term)));
}

const catalogEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function renderSourceCatalog(query = '', group = 'all') {
  const rows = filterSourceCatalog(query, group);
  if (!rows.length) return '<p class="source-catalog-empty">没有匹配项。可缩短关键词，或将栏目切换为“全部栏目”。</p>';
  return sourceCatalogGroups.map(([key, title]) => {
    const items = rows.filter(row => row.group === key);
    if (!items.length) return '';
    const table = `<table><caption class="visually-hidden">${catalogEscape(title)}指标与数据源</caption><thead><tr><th scope="col">指标 / 用途</th><th scope="col">数据来源</th><th scope="col">读取与更新</th><th scope="col">口径与边界</th></tr></thead><tbody>${items.map(row => `<tr data-catalog-id="${catalogEscape(row.id)}"><th scope="row">${catalogEscape(row.name)}</th><td data-label="数据来源">${catalogEscape(row.source)}</td><td data-label="读取与更新">${catalogEscape(row.mode)}</td><td data-label="口径与边界">${catalogEscape(row.note)}</td></tr>`).join('')}</tbody></table>`;
    return key === 'pending' || key === 'legacy'
      ? `<details class="source-catalog-group"${query.trim() || group !== 'all' ? ' open' : ''}><summary>${title}<span>${items.length} 项 · ${key === 'pending' ? '接入状态见各项说明' : '保留模块，非官方温度构成'}</span></summary>${table}</details>`
      : `<section class="source-catalog-group" aria-labelledby="catalog-${key}"><h2 id="catalog-${key}">${title}<span>${items.length} 项</span></h2>${table}</section>`;
  }).join('');
}

export function initSourceCatalog(document) {
  const search = document.getElementById('source-catalog-search');
  const group = document.getElementById('source-catalog-group');
  const results = document.getElementById('source-catalog-results');
  search.form.addEventListener('submit', event => event.preventDefault());
  group.innerHTML = '<option value="all">全部栏目</option>' + sourceCatalogGroups.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
  const render = () => {
    results.innerHTML = renderSourceCatalog(search.value, group.value);
    document.getElementById('source-catalog-count').textContent = `显示 ${filterSourceCatalog(search.value, group.value).length} / ${sourceCatalogRows().length} 项`;
  };
  search.addEventListener('input', render);
  group.addEventListener('change', render);
  document.getElementById('source-catalog-reset').addEventListener('click', () => { search.value = ''; group.value = 'all'; render(); search.focus(); });
  render();
}
