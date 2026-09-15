import { initRiskStateView } from './risk-state.mjs';
import { renderRiskIndicatorTable } from './risk-indicators.mjs';
// Source scenarios describe conditional paths; only explicit demo mode exposes example scores.
function makeRiskSourceDefinitions() {
const sources=[
{id:"money",name:"货币政策",score:92,pace:"加速",fresh:false,title:"货币政策风险",quotes:["政策利率 ↑","紧缩预期 ↑","融资成本 ↑"],nodes:[
["政策偏紧预期 ↑","来源变化","政策路径预期收紧","政策声明、利率期货隐含路径","政策转向或增长压力促使宽松"],
["短端利率预期 ↑","利率传导","预期进入同币种市场利率","短期限国债收益率、隔夜指数掉期","预期变化未被实际报价确认"],
["续融资成本 ↑","融资条件","新增和重定价债务成本上升","到期债务、实际续贷报价","固定利率或有效对冲覆盖"],
["可分配现金流 ↓","基本面","利息支出侵蚀收益","利息费用、利息保障倍数","经营现金增长覆盖新增利息"],
["成长资产估值承压","估值","现金流与要求回报率共同重估","情景现金流、折现率、现价","价格已反映冲击或盈利改善"]],
impact:[["基本面","↑↑","利息支出增加"],["流动性","↑↑↑","续融资压力"],["估值","↑↑↑","折现条件变化"],["情绪","↑","政策预期波动"]],
assets:[["科技成长","negative","高久期、盈利远期兑现"],["高杠杆企业","negative","近期再融资需求集中"],["银行","positive","资产重定价快于负债时"],["短久期现金类","positive","收益率上升、信用稳定时"]],
events:["政策表态变化","短端报价上行","续贷成本抬升","折现假设调整"]},
{id:"commodity",name:"商品供给",score:88,pace:"加速",fresh:false,title:"商品与供给风险",quotes:["原油 ↑","天然气 ↑","粮食 ↑"],nodes:[
["原油价格 ↑","来源变化","供给收缩或运输受阻","现货油价、产量、商业库存、运费","供给恢复、库存回补或需求回落"],
["通胀压力 ↑","价格传导","涨价进入成本并向更广泛品类扩散","能源分项、PPI、CPI及涨价广度","上游涨价被利润吸收，核心价格未扩散"],
["加息预期 ↑","政策预期","市场判断价格压力将引起紧缩","利率期货隐含路径、央行沟通","增长走弱或供给恢复抑制加息预期"],
["美债利率 ↑","市场定价","预期进入名义与实际收益率","美债名义收益率、实际收益率、期限溢价","避险需求或政策转向压低收益率"],
["成长估值 ↓","估值影响","要求回报率提高，远期现金流现值承压","折现率、盈利预期、现价对应的增长假设","盈利上修抵消折现影响，或价格已充分调整"]],
impact:[["基本面","↑↑","投入成本与购买力"],["流动性","↑↑↑","营运资金与融资"],["估值","↑↑","折现率与利润假设"],["情绪","↑","通胀叙事与追涨"]],
assets:[["科技成长","negative","要求回报率上升且盈利未补偿"],["创业板","negative","其中高久期、成本敏感成分"],["石油","positive","上游产量稳定、成本可控时"],["黄金","positive","避险走强或实际利率回落时"]],
events:["原油上涨","商品涨价扩散","CPI数据发布","加息预期抬升"]},
{id:"structure",name:"市场结构",score:85,pace:"加速",fresh:true,title:"市场结构风险",quotes:["集中持仓 ↑","杠杆敞口 ↑","承接深度 ↓"],nodes:[
["持仓拥挤 ↑","来源变化","资金集中于少数资产","持仓集中度、成交集中度","资金来源分散、持仓差异扩大"],
["波动放大","市场反馈","单向交易面临反转","波动率、价差、市场深度","交易深度恢复，波动不再扩散"],
["追保或赎回 ↑","资金约束","合同条款触发实际付款需求","追保通知、赎回净额、保证金","现金缓冲覆盖实际义务"],
["被动卖出 ↑","流动性","卖出需求超出承接能力","强平记录、折价成交、成交深度","新增承接吸收抛压"],
["资产折价扩大","估值与情绪","卖出反馈延长修复时间","价格修复、折溢价、亏损广度","强制卖出结束且价格修复"]],
impact:[["基本面","↑","融资反馈可能传入经营"],["流动性","↑↑↑","被动清算"],["估值","↑↑","折价扩大"],["情绪","↑↑↑","亏损反馈"]],
assets:[["拥挤成长股","negative","同向退出与高杠杆"],["小盘题材","negative","深度不足、承接脆弱"],["高流动性资产","positive","作为资金缓冲的相对作用"],["低杠杆组合","positive","较少被迫变现"]],
events:["持仓集中增加","交易深度下降","追保需求出现","被动卖出扩散"]},
{id:"fiscal",name:"财政债务",score:76,pace:"持续",fresh:false,title:"财政与债务风险",quotes:["利息负担 ↑","融资需求 ↑","财政空间 ↓"],nodes:[
["财政利息负担 ↑","来源变化","收入与债务支出失衡","利息支出／财政收入、初级收支","税收改善或支出约束落实"],
["财政空间收缩","支出约束","可用预算受挤压","实际预算、支出执行进度","调整结构但保留相关支出"],
["采购或付款放缓","需求与支付","公共订单与现金支付受影响","采购金额、项目进度、付款记录","订单未减、付款按期到账"],
["企业现金回收 ↓","基本面","公共客户收入与回款承压","政府客户敞口、应收账龄","市场化客户需求弥补缺口"],
["融资与债权价值承压","跨维度影响","缺口与回收预期进入定价","资金余缺、债权回收、风险补偿","资金缺口填补、偿付基础改善"]],
impact:[["基本面","↑↑","公共需求与回款"],["流动性","↑↑","付款与续融资"],["估值","↑↑","主权风险补偿"],["情绪","↑","财政叙事"]],
assets:[["政府订单型企业","negative","采购与回款集中"],["相关主权债","negative","风险补偿不足时"],["低公共客户敞口","positive","相对暴露较小"],["黄金","positive","信用避险需求走强时"]],
events:["利息支出上升","预算空间收缩","项目支付延后","信用补偿调整"]},
{id:"event",name:"事件行为",score:74,pace:"新增",fresh:true,title:"事件与群体行为风险",quotes:["事件冲击 ↑","单向观点 ↑","跟随交易 ↑"],nodes:[
["突发事件出现","来源变化","核实事件范围与实际生效情况","原始公告、有效政策、事件时间","消息被证伪或适用范围缩小"],
["市场叙事趋同","信息传播","不同主体差异被忽略","固定来源观点比例、消息去重","观点分化，暴露差异被识别"],
["集中追涨或避险","交易行为","交易偏离真实业务兑现","主题成交占比、订单与回款","订单兑现支撑价格变化"],
["追随交易亏损 ↑","情绪反馈","事实落空或恐慌修复失败","事件超额收益、回吐幅度","事实改善且价格修复"],
["定价偏离放大","二级市场","行为损失扩散到持仓","估值偏离、交易纪律与敞口","预期回归事实，拥挤度下降"]],
impact:[["基本面","↑","须核实实际经营影响"],["流动性","↑↑","集中退出"],["估值","↑↑","叙事透支"],["情绪","↑↑↑","一致性交易"]],
assets:[["事件主题股","negative","价格先于业务兑现"],["情绪核心股","negative","跟随拥挤与反转"],["低相关资产","positive","直接敞口较小"],["现金缓冲","positive","减少被动操作"]],
events:["原始事件披露","叙事集中传播","主题交易拥挤","兑现与价格分化"]},
{id:"capital",name:"资本流动",score:72,pace:"加速",fresh:false,title:"跨境资本与外部融资风险",quotes:["资本撤出 ↑","外币融资成本 ↑","汇率波动 ↑"],nodes:[
["外部融资收缩","来源变化","相关主体资金供给减少","跨境融资流量、实际融资报价","融资恢复或本币资金替代"],
["外币续接困难","融资条件","到期融资未获有效续作","到期外债、续作成功率","已落实融资或展期覆盖"],
["外币支付缺口","流动性","同币种现金不足以偿付","外币现金、合同付款、净敞口","自然对冲或实际回款补充"],
["资产出售或汇兑损失","损害实现","币种与期限错配放大损失","资产净回款、汇兑损益","套保有效、资金按期可用"],
["跨市场风险重估","市场反馈","资金约束经持仓关系扩散","跨资产卖出、风险补偿","资金来源分散、市场深度恢复"]],
impact:[["基本面","↑↑","汇兑与经营成本"],["流动性","↑↑↑","外币支付缺口"],["估值","↑↑","币种回报重估"],["情绪","↑","资本流动叙事"]],
assets:[["外币负债企业","negative","无自然对冲或有效套保"],["外资集中资产","negative","相关投资人退出"],["出口企业","positive","净外币收入与汇率方向匹配"],["本币融资资产","positive","外部融资依赖较低"]],
events:["跨境融资减弱","外币报价抬升","续接困难增加","跨资产出售出现"]},
{id:"macro",name:"宏观经济",score:70,pace:"持续",fresh:false,title:"全球周期与需求风险",quotes:["终端需求 ↓","新订单 ↓","库存压力 ↑"],nodes:[
["全球需求走弱","来源变化","确认相关市场与品类需求","实际消费、新订单、贸易量","替代市场需求改善"],
["企业订单 ↓","产业传导","总量变化进入企业业务","订单金额、客户与地区收入占比","份额增长抵消市场收缩"],
["产能利用率 ↓","经营反馈","生产调整慢于销售","利用率、库存周转、交付量","灵活调产及去库存改善"],
["利润与现金流 ↓","基本面","固定成本与库存占用挤压回报","毛利率、经营现金流、应收账龄","成本调整、回款恢复"],
["增长估值下修","估值","长期增长假设失去支持","正常化利润、情景估值、现价","估值已充分调整"]],
impact:[["基本面","↑↑↑","订单与经营现金流"],["流动性","↑↑","库存与回款占用"],["估值","↑↑","增长假设下修"],["情绪","↑","衰退预期"]],
assets:[["需求敏感周期股","negative","高固定成本与库存"],["出口链","negative","受损市场收入集中"],["防御性需求资产","positive","需求稳定且价格合理时"],["高质量债券","positive","利率下行且信用稳定时"]],
events:["需求调查走弱","企业订单减少","库存压力显现","盈利预期下修"]}
];

const overview=[
{id:"macro",name:"经济增长",score:58,trend:"↓",accel:3,driver:"PMI走弱"},
{id:"commodity",name:"通胀与供给",score:86,trend:"↑",accel:14,driver:"原油、天然气"},
{id:"money",name:"货币政策",score:91,trend:"↑",accel:18,driver:"加息预期"},
{id:"fiscal",name:"财政与债务",score:77,trend:"↑",accel:6,driver:"美债供给"},
{id:"credit",name:"信用与金融体系",score:62,trend:"→",accel:1,driver:"信用扩张偏弱"},
{id:"capital",name:"汇率与跨境资本",score:73,trend:"↑",accel:8,driver:"日本减持美债"},
{id:"structure",name:"市场结构与资金",score:84,trend:"↑",accel:15,driver:"IPO、资金分流"},
{id:"event",name:"地缘与政策事件",score:79,trend:"↑",accel:11,driver:"央行会议、地缘风险"}
];
sources.push({id:"credit",title:"信用与金融体系风险",quotes:["信用扩张 →","授信标准 ↑","融资需求 ↓"],nodes:[
["信用扩张偏弱","来源变化","区分信贷供给收紧与需求不足","分部门信贷增速、贷款需求调查","融资减少来自主动降杠杆，经营现金稳定"],
["相关主体获贷减少","信用传导","总量变化进入实际授信与融资","授信额度、获批率、续贷成功率","信贷流向改善且主体融资未受限"],
["续融资与现金压力","流动性","到期本息和必要支付缺乏覆盖","到期本息、可用现金、已落实融资","经营回款、展期或资金到账填补缺口"],
["信用损失暴露","基本面","逾期、坏账影响债权人回收","逾期率、不良贷款、减值与回收","实际回收改善、资本拨备足以覆盖"],
["风险补偿调整","估值","信用预期变化进入债券与股票价格","信用利差、回收假设、资本缓冲","风险补偿已充分、损失未继续扩散"]
],impact:[["基本面","↑↑","债权回收与信用损失"],["流动性","↑↑","授信与续融资"],["估值","↑","信用补偿变化"],["情绪","↑","信用事件传播"]],assets:[["融资依赖企业","negative","短债集中且现金缓冲薄"],["银行与信用债","negative","受损债权暴露较大时"],["高现金流企业","positive","外部融资依赖较低"],["低信用风险资产","positive","流动性与偿付基础稳定"]],events:["信用增速偏弱","贷款调查更新","续作压力出现","信用补偿调整"]});
overview.forEach(o=>Object.assign(sources.find(s=>s.id===o.id),o));
sources.sort((a,b)=>b.score-a.score);
Object.assign(sources.find(s=>s.id==="structure"),{title:"市场结构与资金风险",quotes:["IPO供给 ↑","资金分流 ↑","增量承接 ↓"],nodes:[
["IPO与融资供给增加","来源变化","核实实际发行、募资与时间分布","IPO募资额、再融资额、解禁与减持规模","融资供给增加同时有匹配的增量资金"],
["可交易权益供给增加","市场结构","分清新增融资与存量筹码流转","实际新增流通市值、发行与上市日期","长期资金吸收供给且无集中出售"],
["资金承接不足","资金传导","买方资金不能匹配新增供给","净申购、参与资金、成交深度","增量资金与场内轮动形成有效承接"],
["存量资产买盘减弱","流动性","资金分流进入个股与板块","盘口深度、买卖价差、成交集中度","资金扩散且流动性未恶化"],
["估值与情绪承压","市场影响","退出折价或盈利估值假设下修","估值分位、超额收益、市场广度","盈利改善或价格调整后获得承接"]
],events:["发行计划增加","募资实际落地","增量承接不足","存量资金分流"]});
Object.assign(sources.find(s=>s.id==="capital"),{title:"汇率与跨境资本风险",quotes:["日本持有美债 ↓","美债供给 ↑","汇率波动 ↑"],nodes:[
["日本持有美债减少","来源线索","先拆分交易、估值与统计变化","持有量、净交易量、估值调整","余额下降主要来自估值，不能证明主动减持"],
["净出售进入供需","供给传导","核实实际交易与其他买方承接","跨境证券净交易、国债拍卖需求","其他投资者吸收供给，净供需未趋紧"],
["美债收益率重定价","市场定价","不把单一持有变化等同利率上升","名义与实际收益率、期限溢价","货币政策或避险需求抵消供给影响"],
["汇率与外币融资变化","跨境传导","利差与融资条件改变具体币种敞口","汇率、跨币种基差、外币融资报价","自然对冲、有效套保及融资覆盖"],
["资产与持仓回报改变","影响结果","核实相关市场与主体暴露","净外币敞口、现金流、币种总回报","低外币负债或经营回报改善"]
],events:["持有量变化","交易与估值拆分","债券供需核验","利率汇率传导"]});
sources.find(s=>s.id==="event").title="地缘与政策事件风险";
sources.find(s=>s.id==="macro").title="经济增长风险";
sources.find(s=>s.id==="commodity").title="通胀与供给风险";
sources.find(s=>s.id==="fiscal").quotes=["美债供给 ↑","融资需求 ↑","利息负担 ↑"];

return sources;
}
const riskSourceDefinitions = makeRiskSourceDefinitions();
const riskSourceTopics = {
  macro: '需求、订单与库存', commodity: '能源价格与价格扩散', money: '利率与政策预期',
  fiscal: '国债供给与偿付基础', credit: '信用供需与违约', capital: '汇率与跨境资金',
  structure: '融资供给与资金承接', event: '事件落地与政策影响',
};

export function riskSourceRows(mode = 'monitor') {
  if (mode === 'demo') return riskSourceDefinitions.map(source => ({ ...source }));
  const order = ['macro', 'commodity', 'money', 'fiscal', 'credit', 'capital', 'structure', 'event'];
  return order.map(id => {
    const source = riskSourceDefinitions.find(item => item.id === id);
    return { ...source, score: null, trend: null, accel: null, driver: riskSourceTopics[id] };
  });
}

export function riskSourceReadings(risk = {}) {
  return [['usTreasury10y', '美债10年', '%'], ['usDollarIndex', '美元指数', ''], ['usdJpy', '美元兑日元', '']].map(([key, name, unit]) => {
    const entry = risk[key] ?? {};
    const usable = risk.label !== '示例' && !['example', 'missing', 'expired', 'error'].includes(entry.status)
      && Number.isFinite(entry.value) && Boolean(entry.date);
    const status = entry.status === 'example' || risk.label === '示例' ? '示例已隔离'
      : entry.status === 'expired' ? '缓存过期' : entry.status === 'missing' || entry.status === 'error' ? '数据缺失' : '待接入';
    return { key, name, value: usable ? entry.value : null,
      text: usable ? entry.value.toFixed(2) + unit : '—',
      note: usable ? String(entry.date).slice(0, 10) + ' · 指标快照' : status,
      errors: Array.isArray(entry.errors) ? entry.errors.map(String) : [] };
  });
}

let riskSourceController;
export function updateRiskSourceScreen(risk) {
  riskSourceController?.update(risk);
}

export function initRiskSourceScreen() {
  const root = document.getElementById('risk-source-center');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const state = { view: 'source', mode: 'monitor', selected: 'money', node: 0, event: 0, readings: riskSourceReadings() };
  const query = selector => root.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const current = () => riskSourceRows(state.mode).find(source => source.id === state.selected);
  const isDemo = () => state.mode === 'demo';
  const statusView = initRiskStateView(query('#risk-state-view'));
  function renderView() {
    const showState = state.view === 'state';
    query('#risk-source-view').hidden = showState;
    query('#risk-source-summary').hidden = showState;
    query('#risk-state-view').hidden = !showState;
    query('#risk-view-label').textContent = showState ? '风险状态视图' : '风险源视图';
    query('#risk-view-toggle').setAttribute('aria-label', showState ? '切换到风险源视图' : '切换到风险状态视图');
    query('.rs-titlemark h3').textContent = showState ? '市场风险状态' : '风险源监测中心';
    query('.rs-subtitle').textContent = showState ? '风险状态视图 · 从四维状态回看风险来源、联动与资产暴露' : '风险源监测中心 · 先看主要风险源，再展开传导路径';
    statusView.setMode(state.mode);
  }
  function renderStatus() {
    const demo = isDemo();
    query('.rs-priority-label').textContent = demo ? '优先关注 · 示例风险值前三' : '已有市场指标 · 不等同于风险源评分';
    query('.rs-stats').setAttribute('aria-label', demo ? '示例风险值前三' : '已有指标快照');
    query('.rs-stats').innerHTML = (demo ? riskSourceRows('demo').slice(0, 3).map(source => ({ name: source.name, text: source.score, note: '加速度 +' + source.accel })) : state.readings)
      .map(item => '<div class="rs-stat"><span class="rs-stat-label">' + escape(item.name) + '</span><span class="rs-stat-value">' + escape(item.text) + '</span><span class="rs-stat-note">' + escape(item.note) + '</span></div>').join('');
    query('.rs-demo').textContent = demo ? '设计示例 · 非实时监测' : '监测模式 · 评分待接入';
    query('.rs-overview-head .rs-small').textContent = demo ? '8 类风险源 · 按示例风险值降序' : '8 类风险源 · 分类排列，尚未评级';
    query('.rs-overview-note').textContent = demo ? '分值、趋势与加速度来自您提供的示例；计算口径与比较窗口尚未设定。' : '风险值、趋势、加速度尚无计算口径和比较窗口，暂不排名。核心驱动列列出待核验方向，点击风险源查看路径与指标。';
    query('[data-score-heading]').textContent = demo ? '风险值 ↓' : '风险值';
    query('[data-score-heading]').setAttribute('aria-sort', demo ? 'descending' : 'none');
    root.querySelectorAll('[data-risk-mode]').forEach(button => button.setAttribute('aria-pressed', button.dataset.riskMode === state.mode));
    query('.rs-footer > span').textContent = demo ? '此模式的分值、事件日期及方向为设计示例，不代表当前风险。' : '路径与资产影响为条件情景；需用实际指标逐环节确认。现有数据明细见下方。';
    root.dataset.mode = state.mode;
    renderView();
  }
  function renderEvidence() {
    const source = current(), node = source.nodes[state.node];
    query('.rs-indicator-panel').innerHTML = renderRiskIndicatorTable(source.id, state.mode);
    query('.rs-node-evidence').innerHTML = '<dt>监测指标 · 环节 ' + (state.node + 1) + '</dt><dd>' + escape(node[3]) + '</dd><dt>反证 / 传导中断条件</dt><dd>' + escape(node[4]) + '</dd>';
    root.querySelectorAll('[data-node]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.node) === state.node));
    const related = ['money', 'commodity', 'fiscal'].includes(source.id) ? state.readings.slice(0, 1) : source.id === 'capital' ? state.readings.slice(1) : [];
    query('.rs-source-evidence').innerHTML = isDemo() ? '当前展示设计情景，未将演示方向写入监测数据。' : related.length
      ? '<strong>相关市场快照</strong><span>' + related.map(item => escape(item.name + ' ' + item.text + ' · ' + item.note)).join('；') + '</span><small>仅供核验市场反馈，不能单独确认来源变化及整条路径。</small>'
      : '<strong>路径证据待接入</strong><span>目前没有该来源的连续指标与事件记录，按下列环节建立监测。</span>';
  }
  function renderEventDetail() {
    const source = current(), node = source.nodes[[0, 1, 2, 4][state.event]];
    query('.rs-event-detail').innerHTML = '<div><span>监测指标 / ' + escape(source.events[state.event]) + '</span>' + escape(node[3]) + '</div><div><span>验证状态</span>' + (isDemo() ? '演示事件；原始资料、数据期与比较窗口待接入。' : '尚无已核验事件记录；需补充事件日期、原始来源及比较窗口。') + '</div>';
    root.querySelectorAll('[data-event]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.event) === state.event));
  }
  function render() {
    const source = current(), demo = isDemo();
    renderStatus();
    query('.rs-overview-rows').innerHTML = riskSourceRows(state.mode).map((item, index) => '<tr class="' + (demo && index < 3 ? 'is-priority ' : '') + (item.id === source.id ? 'is-selected' : '') + '"><th scope="row"><button type="button" class="rs-source-link" data-source="' + item.id + '" aria-controls="rs-source-detail" aria-pressed="' + (item.id === source.id) + '"><span class="rs-rank">' + String(index + 1).padStart(2, '0') + '</span>' + item.name + '</button></th><td><div class="rs-value-cell"><strong>' + (demo ? item.score : '<span class="rs-pending">待评估</span>') + '</strong>' + (demo ? '<span class="rs-value-track" aria-hidden="true"><span class="rs-value-fill" style="width:' + item.score + '%"></span></span>' : '') + '</div></td><td><span class="rs-trend" data-trend="' + (item.trend ?? '') + '" aria-label="' + (demo ? { '↑': '上升', '↓': '下降', '→': '持平' }[item.trend] : '待评估') + '">' + (item.trend ?? '—') + '</span></td><td><span class="rs-acceleration">' + (demo ? '+' + item.accel : '—') + '</span></td><td class="rs-driver">' + item.driver + '</td></tr>').join('');
    query('#rs-drill-title').textContent = source.name + ' · 传导路径与影响';
    query('#rs-current').innerHTML = '<div class="rs-current"><div class="rs-current-title"><h2>' + source.title + '</h2><span class="rs-state">' + (demo ? '设计情景' : '待验证路径') + '</span></div><div class="rs-quote-row">' + source.quotes.map(quote => '<div class="rs-quote"><span class="rs-quote-label">' + escape(quote.slice(0, quote.lastIndexOf(' '))) + '</span><span class="rs-quote-value">' + (demo ? escape(quote.slice(quote.lastIndexOf(' ') + 1)) : '待核验') + '</span></div>').join('') + '</div><div class="rs-source-evidence"></div><div class="rs-section-line"><h3>风险传导路径</h3><span class="rs-small">条件成立时 · 逐环节验证</span></div></div>';
    query('.rs-chain').innerHTML = source.nodes.map((node, index) => '<div class="rs-node-wrap"><div class="rs-chain-rail"><span class="rs-node-index">' + (index + 1) + '</span>' + (index < source.nodes.length - 1 ? '<span class="rs-arrow" aria-hidden="true">↓</span>' : '') + '</div><button type="button" class="rs-node" data-node="' + index + '" aria-pressed="' + (index === state.node) + '"><span class="rs-node-main"><span class="rs-node-title">' + escape(node[0]) + '</span><span class="rs-node-tag">' + escape(node[1]) + '</span></span><span class="rs-node-caption">' + escape(node[2]) + '</span></button></div>').join('');
    query('.rs-impact-list').innerHTML = source.impact.map(item => '<div class="rs-impact"><div>' + item[0] + '<small>' + item[2] + '</small></div><span class="rs-impact-level">' + (demo ? item[1] : '待评估') + '</span></div>').join('');
    query('.rs-impact-note').textContent = demo ? '二级市场风险维度 · 箭头为情景示意' : '列出可能受影响的维度；强弱尚未确认。';
    query('.rs-assets').innerHTML = source.assets.map(item => '<div class="rs-asset"><div class="rs-asset-top"><span>' + item[0] + '</span><span class="rs-badge ' + item[1] + '">' + (item[1] === 'negative' ? '潜在承压' : '条件受益') + '</span></div><p>' + item[2] + '</p></div>').join('');
    query('.rs-timeline .rs-small').textContent = demo ? '演示日期 · 点击事件查看指标' : '事件待记录 · 以下为后续核验节点';
    query('.rs-events').innerHTML = source.events.map((event, index) => '<button type="button" class="rs-event" data-event="' + index + '" aria-pressed="' + (index === state.event) + '"><span class="rs-event-date">' + (demo ? ['08 / 17', '08 / 25', '09 / 11', '后续观察'][index] : '待记录') + '</span><strong>' + escape(event) + '</strong><small>' + (demo ? '演示节点' : '待核验') + ' →</small></button>').join('');
    query('#rs-selection').textContent = source.name + (demo ? ' / ' + source.score + ' · 示例分' : ' / 评分待接入');
    renderEvidence();
    renderEventDetail();
  }
  root.addEventListener('click', event => {
    const mode = event.target.closest('[data-risk-mode]'), source = event.target.closest('[data-source]'), node = event.target.closest('[data-node]'), timeline = event.target.closest('[data-event]');
    if (event.target.closest('#risk-view-toggle')) { state.view = state.view === 'source' ? 'state' : 'source'; renderView(); }
    else if (mode) { state.mode = mode.dataset.riskMode; render(); }
    else if (source) {
      state.selected = source.dataset.source; state.node = 0; state.event = 0;
      query('.rs-drill').open = true; render();
      query('.rs-drill > summary').focus({ preventScroll: true });
      query('.rs-drill').scrollIntoView({ behavior: 'auto', block: 'start' });
    } else if (node) { state.node = Number(node.dataset.node); renderEvidence(); }
    else if (timeline) { state.event = Number(timeline.dataset.event); renderEventDetail(); }
  });
  riskSourceController = { update(risk) { state.readings = riskSourceReadings(risk); renderStatus(); renderEvidence(); } };
  render();
}
