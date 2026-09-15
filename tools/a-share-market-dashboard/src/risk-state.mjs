// Conditional examples adapted from prototypes/market-risk.html; no live scoring model is implied.
const riskStateExamples = [
 {name:'流动性',score:90,color:'var(--red)',history:[62,68,75,84,90],state:['全球资金成本高','A股增量资金不足'],sources:[['货币政策',35],['美债供需',25],['市场结构',20],['资本流动',12],['国内信用',8]],flow:['CPI ↑','加息预期 ↑','美债收益率 ↑','流动性 ↓'],note:'通胀压力经利率与融资条件传导，压缩市场资金承接能力。',links:[['估值','强 ↑↑↑'],['情绪','中 ↑↑'],['基本面','弱 ↑']],assets:[['科技成长','高'],['创业板','高'],['小盘股','高'],['银行','低']],events:['资金条件开始收紧','融资成本压力延续','增量资金承接走弱','资金供需矛盾扩大','流动性风险升至90']},
 {name:'估值',score:82,color:'var(--red)',history:[66,69,73,79,82],state:['高估值资产的折现率压力上升','盈利兑现尚未覆盖定价预期'],sources:[['货币政策',30],['经济增长',25],['市场结构',20],['信用环境',15],['资本流动',10]],flow:['资金成本 ↑','折现率 ↑','估值支撑 ↓','重定价压力 ↑'],note:'资金成本与盈利预期共同影响估值支撑，不把高估值等同于必然下跌。',links:[['情绪','强 ↑↑↑'],['流动性','中 ↑↑'],['基本面','弱 ↑']],assets:[['科技成长','高'],['高估值消费','高'],['宽基指数','中'],['低估值银行','低']],events:['估值支撑开始承压','利率预期抬升','盈利预期修正','重定价压力扩大','估值风险升至82']},
 {name:'情绪',score:78,color:'var(--amber)',history:[55,62,69,74,78],state:['风险偏好回落，亏钱效应扩散','拥挤交易的退出意愿增强'],sources:[['市场结构',35],['政策事件',25],['资本流动',20],['经济增长',12],['信用环境',8]],flow:['负面冲击 ↑','亏钱效应 ↑','集中卖出 ↑','风险偏好 ↓'],note:'关注恐慌是否得到成交与承接证据确认，情绪变化并非固定因果顺序。',links:[['流动性','强 ↑↑↑'],['估值','中 ↑↑'],['基本面','弱 ↑']],assets:[['题材股','高'],['小盘股','高'],['创业板','中'],['银行','低']],events:['风险偏好出现分歧','拥挤交易波动加大','亏钱效应扩散','退出意愿增强','情绪风险升至78']},
 {name:'基本面',score:65,color:'var(--amber)',history:[60,63,67,65,65],state:['需求与盈利修复仍有分化','经营压力延续，近期风险持平'],sources:[['经济增长',35],['通胀与供给',25],['信用环境',20],['财政与债务',12],['政策事件',8]],flow:['需求走弱','收入承压','利润率下降','现金流承压'],note:'需按行业与企业验证需求、成本及现金回款，不能由总量指标直接推断个股。',links:[['估值','强 ↑↑↑'],['情绪','中 ↑↑'],['流动性','中 ↑↑']],assets:[['周期制造','高'],['可选消费','中'],['银行','中'],['公用事业','低']],events:['需求修复偏弱','经营压力上升','盈利分化扩大','部分压力缓和','基本面风险持平于65']}
];
const riskStateDates = ['08/17', '08/25', '09/01', '09/11', '09/14'];

export function riskStateModel(mode = 'monitor') {
  const demo = mode === 'demo';
  const dimensions = riskStateExamples.map(item => ({ ...item,
    score: demo ? item.score : null,
    history: demo ? [...item.history] : [],
    state: demo ? [...item.state] : ['状态待评估', '需补充当前与比较窗口的监测证据'],
    sources: item.sources.map(([name, value]) => [name, demo ? value : null]),
    links: item.links.map(([name, level]) => [name, demo ? level : '待评估']),
    assets: item.assets.map(([name, level]) => [name, demo ? level : '待核验']),
    events: demo ? [...item.events] : [],
  }));
  return { demo, dimensions, dates: demo ? [...riskStateDates] : [], aggregate: demo ? 82 : null,
    highCount: demo ? dimensions.filter(item => item.score >= 80).length : null,
    risingCount: demo ? dimensions.filter(item => item.score > item.history.at(-2)).length : null,
    largest: demo ? dimensions.reduce((largest, item) => item.score > largest.score ? item : largest).name : null };
}

export function initRiskStateView(root) {
  const state = { mode: null, selected: 0, point: 4 };
  const query = id => root.querySelector('#rsv-' + id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function renderChart() {
    const model = riskStateModel(state.mode), dimension = model.dimensions[state.selected];
    query('chart').toggleAttribute('hidden', !model.demo);
    query('empty').hidden = model.demo;
    query('accessible-data').hidden = !model.demo;
    if (!model.demo) {
      query('chart').innerHTML = '';
      query('chart').setAttribute('aria-label', '风险历史评分尚未接入');
      query('dates').innerHTML = '';
      query('event-note').textContent = '等待同口径历史评分、观察日期与原始证据。';
      query('accessible-data').querySelector('tbody').innerHTML = '';
      return;
    }
    const chart = query('chart');
    const width = Math.max(280, chart.clientWidth || 1200);
    const xs = [0.1, 0.3, 0.5, 0.7, 0.9].map(ratio => width * ratio), y = value => 108 - (value - 50) * 1.8;
    const points = xs.map((x, index) => x + ',' + y(dimension.history[index])).join(' ');
    chart.setAttribute('viewBox', '0 0 ' + width + ' 130');
    chart.setAttribute('aria-label', dimension.name + '风险示例：' + model.dates.map((date, index) => date + ' ' + dimension.history[index] + '分').join('，'));
    chart.innerHTML = [60, 80, 100].map(value => '<line x1="28" y1="' + y(value) + '" x2="' + width + '" y2="' + y(value) + '" stroke="var(--line)" stroke-dasharray="3 5"/><text x="0" y="' + (y(value) + 4) + '" fill="var(--muted)" font-size="11">' + value + '</text>').join('')
      + '<polyline points="' + points + '" stroke="' + dimension.color + '" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/>'
      + xs.map((x, index) => '<circle cx="' + x + '" cy="' + y(dimension.history[index]) + '" r="' + (index === state.point ? 6 : 4) + '" fill="' + (index === state.point ? dimension.color : 'var(--panel)') + '" stroke="' + dimension.color + '" stroke-width="2"/>').join('');
    query('dates').innerHTML = model.dates.map((date, index) => '<button type="button" class="time-btn" data-risk-point="' + index + '" aria-pressed="' + (index === state.point) + '" aria-label="' + date + '，' + dimension.history[index] + '分">' + date + '<b>' + dimension.history[index] + '</b></button>').join('');
    query('event-note').textContent = model.dates[state.point] + ' · ' + dimension.events[state.point] + '（演示节点）';
    query('accessible-data').querySelector('tbody').innerHTML = model.dates.map((date, index) => '<tr><td>' + date + '</td><td>' + dimension.history[index] + '</td></tr>').join('');
  }
  function render() {
    const model = riskStateModel(state.mode), dimension = model.dimensions[state.selected], demo = model.demo;
    root.dataset.mode = demo ? 'demo' : 'monitor';
    root.style.setProperty('--accent', demo ? dimension.color : 'var(--blue)');
    query('summary').innerHTML = [
      ['综合风险指数', model.aggregate ?? '—', demo ? '高风险 · 示例 / 100' : '评分待接入'],
      ['高风险维度', model.highCount ?? '—', demo ? '/ 04 维度' : '尚未评级'],
      ['风险上升维度', model.risingCount ?? '—', demo ? '09/11 → 09/14' : '比较窗口待建立'],
      ['当前最大风险', model.largest ?? '待评估', demo ? '90 ↗ · 示例' : '四维证据尚不完整'],
    ].map(([name, value, note], index) => '<div class="stat"><div class="label">' + name + '</div><div class="stat-line"><strong class="num ' + (index === 3 ? 'dimension-name' : '') + '">' + value + '</strong><span class="small">' + note + '</span></div></div>').join('');
    query('tabs').innerHTML = model.dimensions.map((item, index) => '<button type="button" class="risk-tab" data-risk-dimension="' + index + '" aria-pressed="' + (index === state.selected) + '" style="--accent:' + (demo ? item.color : 'var(--blue)') + '"><div class="tab-top"><span>' + item.name + '</span><strong class="tab-num">' + (item.score ?? '—') + '</strong></div><div class="tab-bottom"><span>' + (demo ? item.score >= 80 ? '高风险' : '偏高' : '待评估') + '</span><span>' + (demo ? item.score > item.history.at(-2) ? '↗ +' + (item.score - item.history.at(-2)) : '→ 持平' : '趋势待验证') + '</span></div></button>').join('');
    query('legend').textContent = demo ? '演示分级：≥80 高风险；60–79 偏高。分数越高，风险程度越高。' : '四维风险按基本面、估值、流动性与情绪分别核验，尚无统一评分。';
    query('dimension-no').textContent = String(state.selected + 1).padStart(2, '0');
    query('detail-title').textContent = dimension.name + '风险';
    query('score').textContent = dimension.score ?? '—';
    query('level').textContent = demo ? dimension.score >= 80 ? '高风险' : '偏高' : '待评估';
    query('state1').textContent = dimension.state[0];
    query('state2').textContent = dimension.state[1];
    query('contribution-note').textContent = demo ? '维度内相对贡献 · 演示' : '候选来源 · 贡献待评估';
    query('contributions').innerHTML = dimension.sources.map(([name, value]) => '<div class="contrib"><span>' + escape(name) + '</span><div class="bar" aria-hidden="true">' + (demo ? '<span style="width:' + value + '%"></span>' : '') + '</div><span class="percent">' + (demo ? value + '%' : '—') + '</span></div>').join('');
    query('flow').innerHTML = dimension.flow.map(text => '<div class="node">' + escape(text) + '</div>').join('<span class="arrow" aria-hidden="true">→</span>');
    query('flow-note').textContent = '条件路径：' + dimension.note;
    query('links').innerHTML = dimension.links.map(([name, strength]) => '<div class="link-row"><span>→ ' + name + '</span><span class="strength">' + strength + '</span></div>').join('');
    query('assets').innerHTML = dimension.assets.map(([name, level]) => '<div class="asset"><span>' + name + '</span><small class="' + (demo ? level === '高' ? 'red' : level === '中' ? 'amber' : 'green' : 'small') + '"><span class="dot"></span>' + (demo ? level + '暴露' : level) + '</small></div>').join('');
    query('trend-change').textContent = demo ? '+' + (dimension.score - dimension.history[0]) + ' 分' : '待接入';
    query('trend-label').textContent = dimension.name + (demo ? ' · 2026年五次示例观察' : ' · 历史评分待接入');
    query('method').textContent = demo ? '本视图按 market-risk.html 原型展示设计示例，未连接风险评分。综合指数 82 为独立示例值，尚无聚合公式；贡献比例尚无归因模型，联动强弱为假设。上升维度按 09/11 与 09/14 比较。资产暴露不代表交易结论。' : '尚未接入四维风险评分、来源归因和历史观察序列。当前保留候选来源、条件路径及暴露对象供核验，分数和贡献比例不以示例值填充。';
    renderChart();
  }
  root.addEventListener('click', event => {
    const dimension = event.target.closest('[data-risk-dimension]'), point = event.target.closest('[data-risk-point]');
    if (dimension) {
      state.selected = Number(dimension.dataset.riskDimension); state.point = 4; render();
      root.querySelector('[data-risk-dimension="' + state.selected + '"]').focus({ preventScroll: true });
    } else if (point) {
      state.point = Number(point.dataset.riskPoint); renderChart();
      root.querySelector('[data-risk-point="' + state.point + '"]').focus({ preventScroll: true });
    }
  });
  let chartWidth = 0;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width > 0 && width !== chartWidth) { chartWidth = width; renderChart(); }
  }).observe(root);
  return { setMode(mode) { if (state.mode === mode) return; state.mode = mode; render(); } };
}
