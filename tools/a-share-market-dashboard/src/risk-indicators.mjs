// Indicator categories follow wiki/topics/冰冰小美-风险来源与传导路径.md, 宏观风险来源表.
// Every observation below is invented for layout review; providers are intended integrations only.
const riskIndicatorCatalog = {
  macro: { name: '经济增长风险', rows: [
    ['实际GDP同比', '中国 · 季度', 4.2, 4.8, '%', '2026 Q2', '2026 Q1', '国家统计局', 1],
    ['制造业PMI', '中国 · 月度', 49.2, 50.1, '点', '2026-08', '2026-07', '国家统计局', 1],
    ['调查失业率', '中国 · 月度', 5.3, 5.1, '%', '2026-08', '2026-07', '国家统计局', 1],
    ['社会消费品零售同比', '中国 · 月度', 3.1, 4.2, '%', '2026-08', '2026-07', '国家统计局', 1],
  ] },
  commodity: { name: '通胀与供给风险', rows: [
    ['CPI同比', '美国 · 月度', 3.4, 3.1, '%', '2026-08', '2026-07', '美国劳工统计局', 1],
    ['核心CPI同比', '美国 · 月度', 3.7, 3.5, '%', '2026-08', '2026-07', '美国劳工统计局', 1],
    ['PPI同比', '中国 · 月度', -1.6, -2.2, '%', '2026-08', '2026-07', '国家统计局', 1],
    ['布伦特原油现货', '国际 · 日度', 92.4, 88.7, '美元/桶', '2026-09-14', '2026-09-11', '美国能源信息署', 1],
  ] },
  money: { name: '货币政策风险', rows: [
    ['政策利率目标上限', '美国 · 政策观察', 5.5, 5.25, '%', '2026-09-14', '2026-09-11', '美联储政策声明', 2, 'bp'],
    ['下次会议加息概率', '美国 · 市场隐含预期', 64, 42, '%', '2026-09-14', '2026-09-11', '利率期货隐含概率', 0],
    ['QT月度缩表规模', '美国 · 月度', 600, 450, '亿美元', '2026-08', '2026-07', '美联储资产负债表', 0],
    ['存款准备金率', '中国 · 某类机构适用口径', 7, 7, '%', '2026-09-14', '2026-09-11', '中国人民银行公告', 2, 'bp'],
  ] },
  fiscal: { name: '财政与主权债务风险', rows: [
    ['财政赤字', '美国 · 月度', 2650, 2300, '亿美元', '2026-08', '2026-07', '美国财政部月度报告', 0],
    ['国债净发行额', '美国 · 月度', 3100, 2500, '亿美元', '2026-08', '2026-07', '美国财政部发行数据', 0],
    ['联邦债务余额', '美国 · 月末', 38.4, 38.1, '万亿美元', '2026-08', '2026-07', '美国财政部债务数据', 1],
    ['主权评级展望', '虚构经济体A · 事件', '负面', '稳定', '', '2026-09-14', '2026-09-11', '评级机构原始公告', 0, '展望下调'],
  ] },
  credit: { name: '信用与金融体系风险', rows: [
    ['社融存量同比', '中国 · 月度', 8.1, 8.4, '%', '2026-08', '2026-07', '中国人民银行', 1],
    ['人民币贷款余额同比', '中国 · 月度', 6.8, 7.1, '%', '2026-08', '2026-07', '中国人民银行', 1],
    ['同期限信用利差', '中国 · AAA / 国债 · 3年', 85, 68, 'bp', '2026-09-14', '2026-09-11', '中债估值收益率', 0],
    ['商业银行不良贷款率', '中国 · 季度', 1.65, 1.58, '%', '2026 Q2', '2026 Q1', '金融监管总局', 2],
  ] },
  capital: { name: '汇率与跨境资本风险', rows: [
    ['美元指数', '美元 · 日度收盘', 104.2, 102.8, '点', '2026-09-14', '2026-09-11', '指数行情服务', 1],
    ['美元兑人民币', '在岸 · 1美元折合人民币', 7.28, 7.21, '元', '2026-09-14', '2026-09-11', '中国外汇交易中心', 2],
    ['美元兑日元', '1美元折合日元', 153.4, 150.8, '日元', '2026-09-14', '2026-09-11', '外汇行情服务', 1],
    ['海外持有美债余额', '全部海外持有人 · 月末', 8.95, 9.08, '万亿美元', '2026-08', '2026-07', '美国财政部TIC', 2],
  ] },
  structure: { name: '市场结构与资金供需风险', rows: [
    ['IPO融资额', 'A股 · 月度', 420, 260, '亿元', '2026-08', '2026-07', '沪深北交易所', 0],
    ['限售股解禁市值', 'A股 · 月度计划 · 同价基准', 3800, 2900, '亿元', '2026-09', '2026-08', '交易所及公司公告', 0],
    ['融资余额', '沪深两市 · 日末', 1.82, 1.85, '万亿元', '2026-09-14', '2026-09-11', '沪深交易所', 2],
    ['股票ETF净申购额', '固定样本 · 周度估算', -180, 65, '亿元', '2026-W37', '2026-W36', '基金份额及净值公告', 0],
  ] },
  event: { name: '地缘政治与政策事件风险', rows: [
    ['关税税率', '虚构国家A对B · 指定商品', 15, 10, '%', '2026-09-14', '2026-09-11', '海关及贸易主管部门', 0],
    ['出口管制适用范围', '虚构清单 · 事件', '新增2类设备', '现有清单', '', '2026-09-14', '2026-09-11', '主管部门原始公告', 0, '范围扩大'],
    ['监管新政进度', '虚构政策 · 事件', '正式发布', '征求意见', '', '2026-09-14', '2026-09-11', '监管部门原始公告', 0, '进入实施准备'],
    ['地缘冲突事件状态', '虚构地区 · 事件', '局部航线暂停', '航线正常', '', '2026-09-14', '2026-09-11', '官方通报及航运公告', 0, '运输受扰'],
  ] },
};

export function riskIndicatorRows(sourceId, mode = 'monitor') {
  const source = riskIndicatorCatalog[sourceId];
  if (!source) return [];
  return source.rows.map(([name, scope, value, previous, unit, period, previousPeriod, provider, digits, changeUnit]) => {
    const demo = mode === 'demo';
    const quantitative = typeof value === 'number';
    const delta = quantitative ? Number(((value - previous) * (changeUnit === 'bp' ? 100 : 1)).toFixed(6)) : null;
    const deltaUnit = changeUnit === 'bp' ? 'bp' : unit === '%' ? '个百分点' : unit;
    const deltaDigits = changeUnit === 'bp' ? 0 : digits;
    return { name, scope, category: source.name, provider, quantitative,
      latest: demo ? (quantitative ? value.toFixed(digits) + ' ' + unit : value) : '待接入',
      previous: demo ? (quantitative ? previous.toFixed(digits) + ' ' + unit : previous) : '—',
      change: !demo ? '—' : quantitative ? (delta > 0 ? '+' : '') + delta.toFixed(deltaDigits) + ' ' + deltaUnit : changeUnit,
      period: demo ? period : '待接入', previousPeriod: demo ? previousPeriod : '—', demo };
  });
}

export function renderRiskIndicatorTable(sourceId, mode) {
  const rows = riskIndicatorRows(sourceId, mode);
  if (!rows.length) return '';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const demo = mode === 'demo';
  return '<div class="rs-indicator-head"><div><h3>风险源监测指标</h3><p>' + escape(rows[0].category) + ' · 代表性指标</p></div><span class="rs-indicator-badge">' + (demo ? '虚构数据 · 仅供样式预览' : '指标待接入') + '</span></div>'
    + '<table class="rs-indicator-table"><caption class="visually-hidden">' + escape(rows[0].category) + '指标，' + (demo ? '全部为虚构数据' : '尚无观测值') + '</caption><thead><tr><th scope="col">指标 / 口径</th><th scope="col">最新值</th><th scope="col">比较值</th><th scope="col">变化</th><th scope="col">数据期</th><th scope="col">拟接入来源</th></tr></thead><tbody>'
    + rows.map(row => '<tr><th scope="row">' + escape(row.name) + '<small>' + escape(row.scope) + '</small></th><td data-label="最新值" class="rs-indicator-value">' + escape(row.latest) + '</td><td data-label="比较值">' + escape(row.previous) + '</td><td data-label="变化" class="rs-indicator-change">' + escape(row.change) + '</td><td data-label="数据期"><span>本期 ' + escape(row.period) + '</span><small>比较 ' + escape(row.previousPeriod) + '</small></td><td data-label="拟接入来源">' + escape(row.provider) + '</td></tr>').join('')
    + '</tbody></table><p class="rs-indicator-note">归类依据：《冰冰小美-风险来源与传导路径》宏观风险来源表。'
    + (demo ? '数值、日期和事件均为虚构，来源列表示拟接入渠道，未从这些机构取数。变化仅描述读数差异，不直接代表风险升降。' : '点击右上角“设计示例”查看虚构读数样式。') + '</p>';
}
