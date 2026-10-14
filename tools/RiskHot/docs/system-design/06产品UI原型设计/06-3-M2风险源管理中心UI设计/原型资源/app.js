
(()=>{
const root=document.getElementById('rh-m2');
const content=root.querySelector('#rh-content');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pill=(x,kind='')=>`<span class="r-pill ${kind?'r-pill-'+kind:''}">${esc(x)}</span>`;
const button=(action,text,primary=false,extra='')=>`<button type="button" class="${primary?'r-primary':'r-secondary'} cursor-interaction" data-action="${action}" ${extra}>${text}</button>`;
const section=(n,title,body)=>`<section class="r-section"><h3><span>${n}</span>${title}</h3>${body}</section>`;
const facts=rows=>`<dl class="r-facts">${rows.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;
const sourceBaselines=[
['经济增长风险','macro_economic_growth','经济是否在减速或衰退？','产出、需求与增长动能变化所形成的风险来源。','区别于单次增长数据波动；不直接表示当期风险已发生。'],
['通胀与供给风险','macro_inflation_supply','成本和物价是否出现异常？','价格水平、成本及供给约束变化所形成的风险来源。','与货币政策响应分别定义，不能用价格涨幅替代来源分类。'],
['货币政策风险','macro_monetary_policy','央行是否改变资金价格、数量及流动性条件？','央行政策立场与政策工具变化，通过资金价格、数量和流动性条件形成的风险来源。','关注政策变化本身；市场资金供需和跨境资本变化使用各自分类。'],
['财政与主权债务风险','macro_fiscal_sovereign_debt','政府财政和债务是否形成压力？','政府收支、融资与主权债务约束变化所形成的风险来源。','不以政府债券短期价格变化替代财政或债务机制定义。'],
['信用与金融体系风险','macro_credit_financial_system','银行、非银与信用体系是否出现问题？','信用供给、偿付能力和金融体系运行变化所形成的风险来源。','与单一机构事件、短期市场波动分开；具体风险在 L1 管理。'],
['汇率与跨境资本风险','macro_fx_cross_border_capital','全球资金是否发生异常流动？','汇率与跨境资本配置变化所形成的风险来源。','跨境范围与国内市场资金供需分别说明，不自动复制变量。'],
['市场结构与资金供需风险','macro_market_structure_funding','市场资金供需、跨资产配置与风险偏好是否发生不利变化？','市场结构、资金供需和配置行为变化所形成的风险来源。','与货币政策及跨境资本分类按变化机制区分。'],
['地缘政治与政策事件风险','macro_geopolitical_policy_event','是否存在突发外生冲击？','地缘政治与政策事件带来的外生变化所形成的风险来源。','事件本身由 L0 管理，本目录维护稳定分类定义。']
];
const sources=sourceBaselines.map((r,i)=>({id:'DEMO-RS'+(i+1),name:r[0],code:r[1],question:r[2],definition:r[3],boundary:r[4],level:'宏观',version:'v1.0',range:'宏观分析',evidence:'L1 风险源分类基线；本页定义文案为 UI 示例。'}));
const variables=[
{id:'DEMO-V001',name:'美元流动性',code:'DEMO_USD_LIQUIDITY',definition:'美元资金在适用市场中的可获得性及融资条件。',boundary:'区别于单一市场资金价格；不等同于美元汇率变化或当期收紧结论。',range:'全球美元融资市场',grain:'综合因素 · 跨市场',alias:'美元资金可得性',tags:'资金条件',evidence:'美元融资利差等指标；跨市场融资事件材料。',status:'Active',version:'v1.2'},
{id:'DEMO-V002',name:'信用扩张能力',code:'DEMO_CREDIT_CAPACITY',definition:'金融体系在给定约束下提供新增信用的能力。',boundary:'区别于某笔贷款规模或当期信用扩张速度。',range:'中国 · 银行与非银信用体系',grain:'综合因素 · 体系层面',alias:'信用供给能力',tags:'信用',evidence:'社会融资规模口径及信用供给事件。',status:'Active',version:'v1.0'},
{id:'DEMO-V003',name:'通胀压力',code:'DEMO_INFLATION_PRESSURE',definition:'价格与成本因素对一般物价水平形成变化压力的程度。',boundary:'不同于某一项物价指数；不以当期价格上涨直接命名变量。',range:'中国 · 总体物价',grain:'综合因素 · 宏观',alias:'物价压力',tags:'价格',evidence:'CPI 等指标及供给约束事件。',status:'Active',version:'v1.1'},
{id:'DEMO-V004',name:'政策可预期性',code:'DEMO_POLICY_PREDICTABILITY',definition:'市场主体能够理解政策规则并据此形成稳定预期的程度。',boundary:'不将某一次政策公告或特定交易情绪等同于稳定因素。',range:'宏观政策环境',grain:'事件定性因素',alias:'政策预期稳定性',tags:'未分类',evidence:'正式政策文件及实施说明的版本化事件证据；量化指标不适用。',status:'Active',version:'v1.0'},
{id:'DEMO-V005',name:'美元资金环境（旧定义）',code:'DEMO_USD_FUNDING_LEGACY',definition:'早期混合资金价格与资金可得性的观察定义。',boundary:'含义混杂，停止新增引用；历史仍按原定义读取。',range:'全球美元融资市场',grain:'旧综合因素',alias:'美元融资环境',tags:'资金条件',evidence:'保留历史材料；替代项须独立核对。',status:'Deprecated',version:'v1.0',replacement:'美元流动性 · DEMO-V001'}
];
const indicators=[
{id:'DEMO-I001',name:'美元融资利差',code:'DEMO_USD_FUNDING_SPREAD',definition:'以一致期限及可比基准衡量美元融资成本偏离的统计口径。',boundary:'期限、币种和基准不同的利差不能直接混用或取平均。',range:'美元融资市场 · USD',unit:'基点 bp',frequency:'日度',object:'可比期限的美元融资成本',time:'观测期为交易日；发布时间与可用时间分别按来源材料解释。',source:'M1 演示信源：市场数据渠道 A',sourceStatus:'启用',connection:'技术未就绪 · L0 尚无演示观测值',status:'启用',version:'v1.0',maps:[['DEMO-V001','衡量美元融资条件的一部分，辅助观察资金可得性。','全球美元市场；需同期限比较。','不能单凭利差判断整体流动性或风险作用。']]},
{id:'DEMO-I002',name:'社会融资规模增量',code:'DEMO_AGGREGATE_FINANCING',definition:'统计期内实体经济从金融体系获得资金的增量口径。',boundary:'增量与存量、同比与绝对值分别定义，不以名称相近合并。',range:'中国 · CNY',unit:'亿元',frequency:'月度',object:'实体经济融资活动',time:'观测期为统计月；发布时间为原资料公布时间，可用时间由 L0 记录。',source:'M1 演示信源：统计发布渠道 B',sourceStatus:'启用',connection:'接入状态待查询 · L0',status:'启用',version:'v1.0',maps:[['DEMO-V002','观察信用供给的实现规模，结合其他证据解释扩张能力。','中国；月度可比口径。','实现规模不等同于潜在能力。']]},
{id:'DEMO-I003',name:'居民消费价格指数',code:'DEMO_CPI',definition:'衡量居民消费商品与服务价格变化的统计指数定义。',boundary:'总体指数与分项指数、同比与环比需要独立口径说明。',range:'中国 · 全国居民消费',unit:'指数；同比转换需单独说明',frequency:'月度',object:'居民消费商品与服务',time:'观测期为统计月；保留初值与修订版本的时间依据。',source:'M1 演示信源：统计发布渠道 C',sourceStatus:'停用',connection:'来源缺口 · 不允许新接入',status:'启用',version:'v1.1',maps:[['DEMO-V003','通过消费端价格变化观察通胀压力的一部分。','中国；总体指数。','不覆盖全部资产价格与生产端成本。'],['DEMO-V002','仅作为信用供给约束的背景证据，结合其他材料。','中国；宏观背景。','不能凭 CPI 直接推断信用扩张能力。']]}
];
const typeBaselines=[['基本面风险','fundamental','经营与价值基础是否受到不利影响？','潜在损害涉及经营能力、收益基础或内在价值支撑。','区别于价格偏离、退出困难和群体预期变化。'],['流动性风险','liquidity','能否及时获得资金、履行支付义务或完成交易退出？','潜在损害涉及融资、支付或交易退出能力。','与估值高低分开；资金困难不自动证明价值基础受损。'],['估值风险','valuation','当前价格是否仍有合理的价值与定价假设支撑？','潜在损害涉及价格与价值、定价假设之间的偏离。','不以高／中／低作为类型，也不等同于基本面损害。'],['情绪风险','sentiment','群体预期和交易行为是否形成放大损失的机制？','潜在损害涉及群体预期及交易行为形成的放大机制。','与风险严重度和当期市场涨跌分别表达。']];
const types=typeBaselines.map((r,i)=>({id:'DEMO-RT'+(i+1),name:r[0],code:r[1],question:r[2],definition:r[3],boundary:r[4],range:'按损害性质分类',status:'启用',version:'v1.0',evidence:'L1 四类风险类型基线；本页定义文案为 UI 示例。'}));
const candidates=[
{id:'DEMO-C01',name:'离岸美元融资条件',definition:'离岸市场美元资金的可获得性及融资条件。',boundary:'限定离岸市场，区别于覆盖全部美元市场的综合因素。',range:'离岸美元市场',grain:'市场因素 · 离岸范围',evidence:'L2 演示反馈材料：离岸融资条件观察缺口，材料 v2。',origin:'L2 观测反馈',version:'材料 v2',match:'DEMO-V001',status:'待核对',diff:'名称与定义有重合，但范围不同：候选限定离岸市场，已有变量覆盖全球。需人工核对是否值得独立定义。'},
{id:'DEMO-C02',name:'美元资金可得性',definition:'美元资金在适用市场中的可获得性及融资条件。',boundary:'区别于单一市场资金价格和美元汇率变化。',range:'全球美元融资市场',grain:'综合因素 · 跨市场',evidence:'L1 演示风险识别提议，原提议材料 v1。',origin:'L1 风险识别',version:'材料 v1',match:'DEMO-V001',status:'待核对',diff:'候选已命中已有变量别名。定义、范围和粒度看起来一致，须确认材料和有效版本后才可复用。'},
{id:'DEMO-C03',name:'政策沟通一致性',definition:'政策发布、解释与执行沟通内容的一致程度。',boundary:'关注沟通一致性，不等同于整体政策可预期性。',range:'宏观政策沟通',grain:'事件定性因素',evidence:'L0 演示事件提议，政策文件及执行说明材料 v1。',origin:'L0 事件识别',version:'材料 v1',match:'DEMO-V004',status:'待核对',diff:'存在关联但尚不能认定同义。定性事件材料可以成为观测依据，不要求强行配置数值指标。'}
];
candidates.forEach((c,i)=>{c.createdAt=`2026-10-14T16:${30-i*10}:00+08:00`;});
// Local suggestions and audit records are demo data, not production configuration fields.
const reviewSources=indicators.map((d,i)=>({id:'DEMO-SRC-'+(i+1),name:d.source,status:d.sourceStatus}));
const suggestedDefinition={name:'离岸美元融资可得性调查',definition:'按固定样本与问卷口径统计离岸机构获得美元融资的情况。',boundary:'样本调查不覆盖全部离岸机构，不与市场利差直接合并。',object:'离岸机构的美元融资渠道',range:'离岸美元市场 · USD',unit:'百分比 %',frequency:'月度',time:'统计月、发布时间和数据可用时间分别保留。',sourceId:'DEMO-SRC-1'};
candidates[0].observations=[
 {id:'OBS-01',kind:'existing',indicatorId:'DEMO-I001',indicatorVersion:'v1.0',name:'美元融资利差',why:'用可比期限的融资成本辅助观察离岸美元资金条件。',scope:'离岸美元市场；仅使用明确属于离岸范围的同期限数据。',limit:'覆盖融资价格的一部分，不能单独证明资金可得性。',evidence:'演示观测建议材料 v2 · 融资口径说明',version:'建议 v1'},
 {id:'OBS-02',kind:'new',name:suggestedDefinition.name,definition:{...suggestedDefinition},why:'从融资渠道的可获得情况补充价格指标的观察盲区。',scope:'固定离岸机构样本；月度同口径比较。',limit:'样本覆盖和调查偏差需要核对；没有真实演示数据。',evidence:'演示调查指标提议 v1',version:'建议 v1'},
 {id:'OBS-03',kind:'existing',indicatorId:'DEMO-I003',indicatorVersion:'v1.1',name:'居民消费价格指数',why:'AI 提议作为宏观背景参考，是否适用于本变量须人工核对。',scope:'中国消费端物价；与离岸范围存在差异。',limit:'不能直接衡量离岸融资条件；允许来源已停用。',evidence:'演示待核建议 v1',version:'建议 v1'}
];
candidates[1].observations=[
 {...candidates[0].observations[0],scope:'全球美元融资市场；同期限口径。'},
 {...candidates[0].observations[1],definition:{...suggestedDefinition},why:'建议补充离岸融资渠道观察；复用变量不自动批准此额外指标。'}
];
candidates[2].observations=[{id:'OBS-E01',kind:'event',name:'政策文件与执行沟通事件',why:'比较政策发布、解释与执行材料的一致性。',scope:'同一政策及其正式发布、解释与执行说明。',limit:'文件内容一致不证明执行效果；不强配量化指标。',evidence:'演示政策文件及执行说明材料 v1',version:'建议 v1'}];
const observationFilters=['待身份确认','待确认','部分确认','部分生效','已确认','待补方案','已处理','不适用'];
let governanceStage='identity';
const observationDrafts=new Map();
function identityConfirmed(c){return ['已复用','新变量已确认'].includes(c.status)&&!!c.formalId;}
function observationStatus(c){
 if(!identityConfirmed(c))return c.status==='待核对'?'待身份确认':'不适用';
 const items=c.observations||[],pending=items.some(p=>!['approved','inherited','rejected'].includes(p.outcome)),approved=items.some(p=>['approved','inherited'].includes(p.outcome));
 if(!items.length)return indicators.some(d=>d.maps.some(m=>m[0]===c.formalId))?'已确认':'待补方案';
 return pending?(approved?'部分确认':'待确认'):approved?(items.every(p=>['approved','inherited'].includes(p.outcome))?'已确认':'部分生效'):'已处理';
}
function candidateAction(c){return c.status==='待核对'?'审核':identityConfirmed(c)&&['待确认','部分确认','待补方案'].includes(observationStatus(c))?'继续审核':'查看';}
const candidateStatuses=['待核对','已复用','新变量已确认','已转维护','已退回','已暂缓','已拒绝'];
const datasets={sources,variables,indicators,types};
const titles={sources:['风险源目录','按变化来源组织分类，为风险识别提供统一定义'],variables:['全局变量库','共享身份与稳定语义，支持跨风险与跨周期复用'],indicators:['观测指标','统一统计口径、允许信源与变量观察映射'],types:['风险类型','按损害性质分类，独立于风险来源与严重度']};
const state={view:'sources',selected:{sources:'DEMO-RS3',variables:'DEMO-V001',indicators:'DEMO-I001',types:'DEMO-RT1'},filters:{sources:{q:'',status:'all'},variables:{q:'',status:'all'},indicators:{q:'',status:'all'},types:{q:'',status:'all'}},variableMode:'formal',candidateFilters:{q:'',status:'待核对',origin:'all',observation:'all',page:1,pageSize:20},tab:'definition',candidate:'DEMO-C01',workspace:null,focus:null,drafts:[],decisions:[],density:'compact'};
let matchId=null;
let newDialog=null;
let newDialogScroll=null;
let governanceDialog=null;
let governanceScroll=null;
let governanceTrigger=null;
let indicatorDialog=null;
let indicatorContext=null;
const reviewDrafts=new Map();
let lastSavedSnapshot='';
function notify(message){const el=root.querySelector('#rh-message');el.textContent=message;el.hidden=false;}
function save(){if(!window.openai?.setWidgetState)return;const snapshot={modelContent:{page:titles[state.view][0],selected:state.selected[state.view],workspace:state.workspace,candidate:state.candidate},privateContent:{view:state.view,selected:state.selected,filters:state.filters,tab:state.tab,variableMode:state.variableMode,candidateFilters:{...state.candidateFilters},candidate:state.candidate,density:state.density}};lastSavedSnapshot=JSON.stringify(snapshot);window.openai.setWidgetState(snapshot).catch(()=>{});}
function restore(x){const p=x?.privateContent;if(!p||!datasets[p.view])return;state.view=p.view;if(p.selected)for(const v of Object.keys(datasets)){if(datasets[v].some(d=>d.id===p.selected[v]))state.selected[v]=p.selected[v];}if(p.filters)for(const v of Object.keys(datasets)){const f=p.filters[v];if(f&&typeof f.q==='string')state.filters[v]={q:f.q,status:v==='sources'?'all':typeof f.status==='string'?f.status:'all'};}state.variableMode=p.variableMode==='candidates'?'candidates':'formal';if(p.candidateFilters){const f=p.candidateFilters;state.candidateFilters={q:typeof f.q==='string'?f.q:'',status:['all',...candidateStatuses].includes(f.status)?f.status:'待核对',origin:['all',...candidates.map(c=>c.origin)].includes(f.origin)?f.origin:'all',observation:['all',...observationFilters].includes(f.observation)?f.observation:'all',page:Number.isInteger(f.page)&&f.page>0?f.page:1,pageSize:[20,50,100].includes(f.pageSize)?f.pageSize:20};}state.tab=['definition','observations','history'].includes(p.tab)?p.tab:'definition';if(p.view==='indicators'){state.view='variables';state.variableMode='formal';state.tab='observations';const owner=variables.find(v=>indicators.find(i=>i.id===state.selected.indicators)?.maps.some(m=>m[0]===v.id));if(owner)state.selected.variables=owner.id;}if(candidates.some(c=>c.id===p.candidate))state.candidate=p.candidate;state.density=p.density==='relaxed'?'relaxed':'compact';state.workspace=null;}
restore(window.openai?.widgetState);
function current(){return datasets[state.view].find(x=>x.id===state.selected[state.view])||datasets[state.view][0];}
function updateIcons(){if(globalThis.lucide)lucide.createIcons({attrs:{width:15,height:15}});}
function render(){
 if(state.view==='indicators'){state.view='variables';state.variableMode='formal';state.tab='observations';}
 root.style.setProperty('--rh-gap',state.density==='compact'?'14px':'20px');
 root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
 root.querySelector('#rh-variable-count').textContent=String(variables.length).padStart(2,'0');
 root.querySelector('#rh-revisions').textContent='修订审核'+(state.drafts.length?' · '+state.drafts.length:'');
 root.querySelector('#rh-message').hidden=true;
 if(state.workspace!=='governance'&&governanceDialog)disposeGovernanceDialog();
 if(state.workspace==='governance'){renderCandidateCatalog();openGovernanceDialog();}else if(state.workspace==='revision')renderRevision();else if(state.workspace==='revisions')renderRevisions();else if(state.workspace==='feedback')renderFeedback();else renderCatalog();
 updateIcons();
}
function renderCatalog(){
 if(state.view==='variables'&&state.variableMode==='candidates'){renderCandidateCatalog();return;}
 const [title,sub]=titles[state.view],f=state.filters[state.view];
 const options=state.view==='variables'?'<option value="Active">有效 · Active</option><option value="Deprecated">废弃 · Deprecated</option>':'<option value="启用">启用</option><option value="停用">停用</option>';
 const pending=candidates.filter(c=>c.status==='待核对').length;
 const heading=state.view==='variables'?`<div class="r-section-title r-between r-variable-heading">${variableNavigation()}</div>`:`<div class="r-section-title r-between"><div><h2>${title}</h2><p class="r-muted">${sub}</p></div>${button('new','+ 新增定义',true)}</div>`;
 content.innerHTML=`${heading}${state.view==='variables'?`<div class="r-govern-link"><div><strong>候选与语义治理 ${pill(pending+' 项待核对',pending?'warn':'neutral')}</strong><p>核对稳定语义、适用范围与粒度，再确认正式身份</p></div>${button('governance','进入候选审核 →')}</div>`:''}<div class="r-toolbar"><label class="r-search"><span hidden>搜索${title}</span><i data-lucide="search" aria-hidden="true"></i><input id="rh-search" aria-label="搜索${title}" placeholder="搜索名称、编码或定义…" value="${esc(f.q)}"></label>${state.view==='sources'?'':`<label class="r-filter"><select id="rh-status" aria-label="${state.view==='variables'?'变量生命周期':'配置使用状态'}"><option value="all">${state.view==='variables'?'全部生命周期':'全部使用状态'}</option>${options}</select></label>`}${state.view==='sources'?'<span class="r-pill r-pill-neutral">宏观基线</span>':''}</div><div class="r-list-detail"><div><div class="r-list-header r-between"><span id="rh-results"></span><span>${state.view==='sources'?'版本':state.view==='variables'?'生命周期 / 版本':'使用状态 / 版本'}</span></div><div id="rh-list"></div></div><article class="r-detail" id="rh-detail" aria-label="定义详情"></article></div>`;
 const statusFilter=content.querySelector('#rh-status');if(statusFilter)statusFilter.value=f.status;renderRows();renderDetail();
}
function variableNavigation(){return `<nav class="r-variable-nav" aria-label="全局变量视图"><button type="button" class="cursor-interaction" data-variable-mode="formal" aria-pressed="${state.variableMode==='formal'}">正式变量 <span>${variables.length}</span></button><button type="button" class="cursor-interaction" data-variable-mode="candidates" aria-pressed="${state.variableMode==='candidates'}">候选审核 <span>${candidates.filter(c=>c.status==='待核对').length}</span></button></nav>`;}
function candidateMatches(){const f=state.candidateFilters,q=f.q.trim().toLowerCase();return candidates.filter(c=>(!q||c.name.toLowerCase().includes(q))&&(f.status==='all'||c.status===f.status)&&(f.origin==='all'||c.origin===f.origin)&&(!f.observation||f.observation==='all'||observationStatus(c)===f.observation)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));}
function pendingCandidates(){return candidateMatches().filter(c=>c.status==='待核对'||candidateAction(c)==='继续审核');}
function candidateTime(c){if(!c.createdAt)return '未记录';return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(c.createdAt));}
function renderCandidateCatalog(){
 const f=state.candidateFilters,origins=[...new Set(candidates.map(c=>c.origin))];
 content.innerHTML=`<div class="r-section-title r-between r-variable-heading">${variableNavigation()}</div><div class="r-candidate-toolbar"><label class="r-field r-candidate-search">候选名称<input id="rh-candidate-search" placeholder="搜索候选名称…" value="${esc(f.q)}"></label><label class="r-field">变量身份<select id="rh-candidate-status"><option value="all">全部状态</option>${candidateStatuses.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label class="r-field">提议来源<select id="rh-candidate-origin"><option value="all">全部来源</option>${origins.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label class="r-field">观测方案<select id="rh-observation-status"><option value="all">全部观测状态</option>${observationFilters.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label>${button('clear-candidates','重置筛选')}</div><div class="r-candidate-table-wrap"><table class="r-table r-candidate-table" aria-label="候选审核列表"><thead><tr><th scope="col">候选名称</th><th scope="col">提议来源</th><th scope="col">适用范围</th><th scope="col">提交时间</th><th scope="col">变量身份</th><th scope="col">观测方案</th><th scope="col">操作</th></tr></thead><tbody id="rh-candidate-rows"></tbody></table></div><div id="rh-candidate-pagination" class="r-candidate-pagination"></div>`;
 content.querySelector('#rh-candidate-status').value=f.status;content.querySelector('#rh-candidate-origin').value=f.origin;content.querySelector('#rh-observation-status').value=f.observation||'all';renderCandidateRows();
}
function renderCandidateRows(){
 const f=state.candidateFilters,list=candidateMatches(),pages=Math.max(1,Math.ceil(list.length/f.pageSize));f.page=Math.min(f.page,pages);
 const start=(f.page-1)*f.pageSize,rows=list.slice(start,start+f.pageSize);
 content.querySelector('#rh-candidate-rows').innerHTML=rows.length?rows.map(c=>`<tr data-candidate-row="${esc(c.id)}"><td data-label="候选名称"><strong>${esc(c.name)}</strong><span class="r-code r-muted">${esc(c.id)}</span></td><td data-label="提议来源">${esc(c.origin)}</td><td data-label="适用范围">${esc(c.range)}</td><td data-label="提交时间"><time datetime="${esc(c.createdAt)}">${esc(candidateTime(c))}</time></td><td data-label="变量身份">${pill(c.status,c.status==='待核对'?'warn':'neutral')}</td><td data-label="观测方案">${pill(observationStatus(c),['待确认','部分确认','待补方案'].includes(observationStatus(c))?'warn':'neutral')}</td><td data-label="操作"><button type="button" class="r-secondary cursor-interaction" data-review-candidate="${esc(c.id)}" aria-label="${candidateAction(c)} ${esc(c.name)}">${candidateAction(c)}</button></td></tr>`).join(''):`<tr><td colspan="7" class="r-empty"><h3>没有匹配的候选</h3><p>调整名称、审核状态或提议来源后重新查询。</p>${button('clear-candidates','重置筛选')}</td></tr>`;
 content.querySelector('#rh-candidate-pagination').innerHTML=`<span class="r-muted" role="status">共 ${list.length} 项${list.length?' · '+(start+1)+'–'+Math.min(start+f.pageSize,list.length):''}</span><div class="r-flex"><label class="r-page-size">每页<select id="rh-candidate-size">${[20,50,100].map(n=>`<option value="${n}" ${f.pageSize===n?'selected':''}>${n} 条</option>`).join('')}</select></label>${button('candidate-prev','上一页',false,f.page===1?'disabled':'')}<span class="r-code">第 ${f.page} / ${pages} 页</span>${button('candidate-next','下一页',false,f.page===pages?'disabled':'')}</div>`;
}
function filtered(){const f=state.filters[state.view];const q=f.q.trim().toLowerCase();return datasets[state.view].filter(d=>(state.view==='sources'||f.status==='all'||d.status===f.status)&&[d.name,d.code,d.definition,d.range,d.alias,d.tags].join(' ').toLowerCase().includes(q));}
function renderRows(){const list=filtered();content.querySelector('#rh-results').textContent=`${list.length} 项定义${list.length!==datasets[state.view].length?' · 已筛选':''}`;content.querySelector('#rh-list').innerHTML=list.length?list.map((d,i)=>`<button type="button" class="r-row cursor-interaction" data-id="${d.id}" aria-pressed="${state.selected[state.view]===d.id}"><span class="r-row-head"><span class="r-row-name"><span class="r-index">${String(i+1).padStart(2,'0')}</span>${esc(d.name)}</span>${state.view==='sources'?'':pill(d.status==='Active'?'有效':d.status==='Deprecated'?'已废弃':d.status,d.status==='Deprecated'?'neutral':'')}</span><span class="r-row-sub">${esc(state.view==='sources'?d.question:state.view==='variables'?d.range+' · '+d.tags:state.view==='indicators'?d.frequency+' · '+d.range:d.question)}　<span class="r-code">${d.version}</span></span></button>`).join(''):`<div class="r-empty"><h3>没有匹配的定义</h3><p>${state.view==='sources'?'调整关键词后重新查询':'调整关键词或使用状态后重新查询'}</p>${button('clear','清除筛选')}</div>`;}
function renderDetail(){const d=current(),el=content.querySelector('#rh-detail');if(!filtered().some(x=>x.id===d.id)){el.innerHTML='<div class="r-empty">选择一项定义查看详情</div>';return;}
 el.innerHTML=`<div class="r-detail-head"><div class="r-between"><span class="r-code">${esc(d.id)}</span>${state.view==='sources'?'':pill(d.status==='Active'?'Active · 有效':d.status==='Deprecated'?'Deprecated · 废弃':d.status,d.status==='Deprecated'?'neutral':'')}</div><h2>${esc(d.name)}</h2><p class="r-code r-muted">${esc(d.code)}</p></div><div class="r-details-tabs" aria-label="详情内容">${(state.view==='variables'?[['definition','定义与边界'],['observations','观测指标'],['history','历史版本']]:[['definition','定义与边界'],['history','历史版本']]).map(([v,t])=>`<button type="button" class="cursor-interaction" data-detail-tab="${v}" aria-pressed="${state.tab===v}">${t}</button>`).join('')}</div><div>${state.tab==='definition'?definition(d):state.tab==='observations'&&state.view==='variables'?variableIndicators(d):history(d)}</div><div class="r-detail-footer r-between"><span class="r-muted">当前有效版本 <span class="r-code">${d.version}</span></span><div class="r-flex">${button('feedback','维护反馈')}${button('edit','修订定义')}</div></div>`;
}
function variableIndicators(v){
 const linked=indicators.filter(d=>d.maps.some(m=>m[0]===v.id));
 const eventPlans=candidates.filter(c=>c.formalId===v.id).flatMap(c=>(c.observations||[]).filter(p=>p.kind==='event'&&p.outcome==='approved'));
 return `<section class="r-variable-indicators"><div class="r-between"><h3>关联观测指标 · ${linked.length} 项</h3>${button('link-indicator','关联共享指标',false,v.status==='Active'?'':'disabled')}</div><p class="r-muted" style="margin-top:8px">指标定义在全局共享；映射解释、适用范围与局限按变量分别维护。</p>${linked.length?linked.map(d=>{const map=d.maps.find(m=>m[0]===v.id);return `<article class="r-variable-indicator" data-linked-indicator="${d.id}"><div class="r-between"><h3>${esc(d.name)}</h3>${pill(d.sourceStatus==='启用'?'来源有效':'来源缺口',d.sourceStatus==='启用'?'neutral':'warn')}</div><p class="r-code r-muted">${d.id} · ${d.version} · 关系 ${esc(d.mapReviews?.[v.id]?.version||'v1.0')}</p><p>${esc(d.unit)} · ${esc(d.frequency)}<br>${esc(map[1])}</p><p class="r-muted">范围：${esc(map[2])}<br>局限：${esc(map[3])}</p><button type="button" class="r-secondary cursor-interaction" data-open-indicator="${d.id}">查看与维护</button></article>`;}).join(''):`<div class="r-note ${v.grain.includes('定性')?'':'r-warning'}">${v.grain.includes('定性')?'采用可核验事件证据，量化指标不适用。':'尚无已生效指标映射，保留观测缺口；关联提议须审核后生效。'}</div>`}${eventPlans.length?eventPlans.map(p=>`<div class="r-map"><h3>已确认事件证据方案：${esc(p.name)}</h3><p>${esc(p.why)}</p><p class="r-muted">范围：${esc(p.scope)}<br>局限：${esc(p.limit)}</p></div>`).join(''):v.grain.includes('定性')?`<p>${esc(v.evidence)}</p>`:''}</section>`;
}
function openIndicator(id,mode='detail'){
 if(indicatorDialog)return;
 indicatorContext={id,variableId:current().id,mode,tab:'definition',historyVersion:null,scroll:{x:scrollX,y:scrollY},trigger:id?`[data-open-indicator="${id}"]`:'[data-action="link-indicator"]'};
 const dialog=document.createElement('dialog');dialog.className='r-new-dialog r-indicator-dialog';dialog.setAttribute('aria-labelledby','rh-indicator-title');root.append(dialog);indicatorDialog=dialog;renderIndicatorDialog();
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeIndicator();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeIndicator();});
 dialog.showModal();dialog.querySelector('.r-dialog-close').focus({preventScroll:true});
}
function closeIndicator(){
 if(!indicatorDialog)return;
 const context=indicatorContext;indicatorDialog.close();indicatorDialog.remove();indicatorDialog=null;indicatorContext=null;
 content.querySelector(context.trigger)?.focus({preventScroll:true});window.scrollTo(context.scroll.x,context.scroll.y);
}
function renderIndicatorDialog(){
 const context=indicatorContext,d=indicators.find(x=>x.id===context.id),v=variables.find(x=>x.id===context.variableId),mode=context.mode;
 indicatorDialog.innerHTML=`<div class="r-section-title r-dialog-header"><div><h2 id="rh-indicator-title">${mode==='link'?'关联共享指标':mode==='definition'?'修订 '+esc(d.name):esc(d.name)}</h2><p class="r-muted">${esc(v.name)} · ${mode==='link'?'从共享指标库选择，先形成待审映射':esc(d.id)+' · '+esc(d.version)+' · 共享指标'}</p></div><button type="button" class="r-dialog-close cursor-interaction" data-action="close-indicator" aria-label="关闭观测指标">×</button></div><div class="r-dialog-body"></div>`;
 const body=indicatorDialog.querySelector('.r-dialog-body');
 if(mode==='detail'){
  const previous=state.historyVersion;state.historyVersion=context.historyVersion;const historical=history(d).replaceAll('rh-history-version','rh-indicator-history-version');state.historyVersion=previous;
  body.innerHTML=`<div class="r-details-tabs" aria-label="指标详情内容"><button type="button" data-indicator-tab="definition" aria-pressed="${context.tab==='definition'}">定义与映射</button><button type="button" data-indicator-tab="history" aria-pressed="${context.tab==='history'}">历史版本</button></div>${context.tab==='history'?historical:indicatorDetail(d)}`;
  indicatorDialog.insertAdjacentHTML('beforeend',`<div class="r-form-actions r-indicator-actions r-between"><span class="r-muted">当前变量映射与共享定义分别维护</span><div class="r-flex">${button('indicator-definition','修订共享定义')}${button('indicator-source','维护允许来源')}${button('indicator-mapping','维护当前映射',false,v.status==='Active'?'':'disabled')}${button('indicator-feedback','缺口反馈')}</div></div>`);
 }else if(mode==='definition'){
  state.editing=d;state.isNew=false;renderRevision(body,'indicators');body.querySelector('.r-back').remove();body.querySelector('.r-section-title').remove();
  const form=body.querySelector('#rh-edit');form.dataset.entityView='indicators';form.dataset.indicatorId=d.id;
  form.insertAdjacentHTML('afterbegin','<div class="r-note r-warning">这是共享指标定义修订，可能影响其他变量。提交仅形成待审材料，不覆盖当前定义和历史。</div>');
  const footer=form.querySelector('.r-form-actions');for(const submit of footer.querySelectorAll('[type="submit"]'))submit.setAttribute('form','rh-edit');footer.querySelector('[data-action="back"]').dataset.action='indicator-back';footer.classList.add('r-indicator-actions');indicatorDialog.append(footer);
 }else{
  const map=d?.maps.find(m=>m[0]===v.id),kind=mode==='link'?'关联共享指标':mode==='source'?'允许来源修订':mode==='feedback'?'观测缺口反馈':'当前变量映射修订';
  body.innerHTML=`<form id="rh-indicator-maintenance" class="r-form"><h3>${kind}</h3><div class="r-note">${mode==='source'?'修改共享指标允许来源，会影响采用该指标的变量；提交后仍需审核。':mode==='feedback'?'记录缺口与主责方，不自动发送消息或补造数据。':'本次只维护 '+esc(v.name)+' 的映射，不修改其他变量关系。'}</div><div class="r-form-grid">${mode==='link'?`<label class="r-field r-field-wide">共享指标<select name="indicatorId">${indicators.filter(i=>!i.maps.some(m=>m[0]===v.id)).map(i=>`<option value="${i.id}">${esc(i.name)} · ${i.version} · 来源${i.sourceStatus}</option>`).join('')}</select></label>`:''}${mode==='source'?`<label class="r-field r-field-wide">允许来源<select name="sourceId">${reviewSources.map(source=>`<option value="${source.id}" ${source.name===d.source?'selected':''}>${esc(source.name)} · ${esc(source.status)}</option>`).join('')}</select></label>`:''}${['link','mapping'].includes(mode)?`<label class="r-field r-field-wide">映射解释<textarea name="mapWhy" required>${esc(map?.[1]||'')}</textarea></label><label class="r-field">适用范围<textarea name="mapScope" required>${esc(map?.[2]||v.range)}</textarea></label><label class="r-field">局限<textarea name="mapLimit" required>${esc(map?.[3]||'')}</textarea></label>`:''}${mode==='feedback'?'<label class="r-field r-field-wide">缺口主责方<select name="target"><option>M2</option><option>M1 / L0</option><option>L0</option><option>L2 / M3</option></select></label>':''}<label class="r-field r-field-wide">维护理由与依据 · 必填<textarea name="reason" required></textarea></label></div><label class="r-check"><input type="checkbox" name="confirm">已核对本次材料、对象及版本</label><div class="r-error" role="alert" hidden></div></form>`;
  indicatorDialog.insertAdjacentHTML('beforeend',`<div class="r-form-actions r-indicator-actions r-between">${button(mode==='link'?'close-indicator':'indicator-back','取消')}<button type="submit" form="rh-indicator-maintenance" class="r-primary cursor-interaction">${mode==='feedback'?'记录缺口反馈':'提交维护审核'}</button></div>`);
 }
}
function submitIndicatorMaintenance(form){
 const context=indicatorContext,v=variables.find(x=>x.id===context.variableId),payload=Object.fromEntries(new FormData(form)),d=indicators.find(x=>x.id===(payload.indicatorId||context.id)),mode=context.mode;
 if(!payload.reason?.trim()||!payload.confirm)return reviewError(form,'请填写维护依据，并确认本次材料与版本。');
 if(mode==='link'||mode==='mapping'){
  if(v.status!=='Active'||!d||d.status!=='启用')return reviewError(form,'变量或指标无效，不能提交新的映射使用。');
  if(mode==='link'&&d.maps.some(m=>m[0]===v.id))return reviewError(form,'已有该指标映射，请从当前关系发起维护。');
  if(d.sourceStatus!=='启用')return reviewError(form,'允许来源已停用，请先补充来源或记录缺口。');
  if(['mapWhy','mapScope','mapLimit'].some(key=>!payload[key]?.trim()))return reviewError(form,'请补全映射解释、适用范围与局限。');
 }
 if(mode==='source'){
  const source=reviewSources.find(x=>x.id===payload.sourceId);if(source?.status!=='启用')return reviewError(form,'不能新增已停用或无效的允许来源。');payload.source=source.name;
 }
 const map=d?.maps.find(m=>m[0]===v.id);
 state.drafts.push({...payload,type:mode==='feedback'?'feedback':'indicators_'+mode,name:d?.name||v.name,status:mode==='feedback'?'维护反馈':'待审核',basedOn:d?.version||v.version,indicatorId:d?.id,variableId:v.id,variableVersion:v.version,relationVersion:d?.mapReviews?.[v.id]?.version||'v1.0',before:mode==='mapping'?{mapWhy:map?.[1],mapScope:map?.[2],mapLimit:map?.[3]}:mode==='source'?{source:d.source}:null});
 closeIndicator();render();notify(mode==='feedback'?'演示缺口反馈已记录，尚未发送。':'维护材料已进入修订审核，当前共享定义及映射保持不变。');save();
}
function fieldMarker(field,kind){return `<small class="r-field-marker" data-field-name="${esc(field)}" data-field-kind="${esc(kind)}">${field?`<code>${esc(field)}</code>`:'无独立字段'} · ${esc(kind)}</small>`;}
function definition(d){
 if(state.view==='indicators')return indicatorDetail(d);
 if(state.view==='variables'){
  let out=section('01','定义 '+fieldMarker('definition','逻辑字段'),`<p>${esc(d.definition)}</p>`);
  const scope=facts([
   ['适用范围'+fieldMarker('range','原型扩展'),esc(d.range)],
   ['观察粒度'+fieldMarker('grain','原型扩展'),esc(d.grain)],
   ['别名'+fieldMarker('alias','原型扩展'),esc(d.alias||'无')],
   ['可选标签'+fieldMarker('tags','原型扩展'),esc(d.tags||'未分类')],
   ['观测方式'+fieldMarker('','界面计算'),d.grain.includes('定性')?'事件定性 · 单位不适用':'综合观察 · 单位按关联指标']
  ]).replace('class="r-facts"','class="r-facts r-variable-field-facts"');
  out+=section('02','范围与身份',scope);
  out+=section('03','观测依据 '+fieldMarker('evidence','原型扩展'),`<p>${esc(d.evidence)}</p>`);
  out+=section('04','分类与语义边界 '+fieldMarker('boundary','后端数据'),`<p>${esc(d.boundary)}</p>`);
  out+=`<p class="r-field-caption">字段名标示当前原型映射；“原型扩展”尚未定版为物理表字段，“界面计算”无独立存储字段。</p>`;
  if(d.status==='Deprecated')out+=`<div class="r-note r-warning">停止新增引用。替代参考：${esc(d.replacement)}，适用性须独立核对。</div>`;
  return out;
 }
 let out=section('01','定义',`<p>${esc(d.definition)}</p>`);
 if(d.question)out+=section('02','核心问题',`<div class="r-question">${esc(d.question)}</div>`);
 out+=section('03','分类与语义边界',`<p>${esc(d.boundary)}</p>`);
 if(state.view==='sources')out+=facts([['分析层次','宏观 macro'],['同层父分类','无 · 一级分类']]);
 return out;
}
function indicatorDetail(d){return section('01','统计定义',`<p>${esc(d.definition)}</p>`)+section('02','统计与时间口径',facts([['统计对象',esc(d.object)],['适用范围',esc(d.range)],['单位',esc(d.unit)],['频率',esc(d.frequency)]])+`<p style="margin-top:10px">${esc(d.time)}</p>`)+section('03','允许信源',`<p>${esc(d.source)} ${pill(d.sourceStatus,d.sourceStatus==='停用'?'warn':'')}</p><p class="r-muted">适用资料：同口径原始统计材料；信源身份与启停由 M1 管理。</p><div class="r-note ${d.sourceStatus==='停用'?'r-warning':''}">${esc(d.connection)}</div>`)+section('04','变量映射 · 多对多',d.maps.map(([id,why,scope,limit])=>{const v=variables.find(x=>x.id===id);return `<div class="r-map"><h3>${esc(v.name)} <span class="r-code">${id}</span></h3><p>${esc(why)}</p><p class="r-muted">范围：${esc(scope)}<br>局限：${esc(limit)}<br>依据：${esc(d.mapReviews?.[id]?.reason||'演示映射说明')} · 关系 ${esc(d.mapReviews?.[id]?.version||'v1.0')}</p></div>`;}).join(''))+`<div class="r-note">指标实际值由 L0 管理。本页维护定义与映射依据。</div>`;}
function history(d){const version=state.historyVersion||d.version;const old=version==='v0.9';return `<label class="r-field">查看定义版本<select id="rh-history-version"><option value="${d.version}" ${old?'':'selected'}>${d.version} · 当前有效</option><option value="v0.9" ${old?'selected':''}>v0.9 · 历史演示</option></select></label><div class="r-note">${old?'正在查看历史版本，当前有效定义保持 '+d.version+'。':'当前有效定义 · '+d.version}</div>${section('01','当时定义',`<p>${esc(old?'早期演示定义：'+d.definition+' 原范围及引用依据按该历史版本保留。':d.definition)}</p>`)}<div class="r-log"><strong>${old?'v0.9 建档':'修订生效至 '+d.version}</strong><p>演示理由：${old?'建立初始定义和观测依据':'补充语义边界与适用说明'}</p><p class="r-muted">演示维护人员 → 演示审核人员 · 材料版本已绑定</p></div><div class="r-log"><strong>历史保护</strong><p>旧定义及关系版本保留；新版不补写历史快照。</p></div>`;}
function renderGovernance(){const c=candidates.find(x=>x.id===state.candidate),draft=reviewDrafts.get(c.id);const v=variables.find(x=>x.id===(matchId||draft?.match||c.match))||variables[0];matchId=v.id;
 governanceDialog.innerHTML=`<div class="r-section-title r-between"><div><h2>候选审核</h2><p class="r-muted">AI 提议 · 程序校验 · 人工确认</p></div>${pill(c.status,c.status==='待核对'?'warn':'neutral')}</div><div class="r-review-steps" role="navigation" aria-label="审核步骤"><button type="button" data-review-stage="identity" aria-pressed="${governanceStage==='identity'}">1 · 变量身份</button><button type="button" data-review-stage="observation" aria-pressed="${governanceStage==='observation'}">2 · 观测方案 ${pill(observationStatus(c),'neutral')}</button></div><div class="r-identity-panel" ${governanceStage==='identity'?'':'hidden'}><div class="r-compare"><section class="r-compare-col"><div class="r-compare-label">候选提议 / ${c.id}</div><h2>${esc(c.name)}</h2>${facts([['提出方',esc(c.origin)],['材料版本',esc(c.version)],['正式身份',esc(c.formalId||'尚未分配')]])}<div style="margin-top:16px">${section('01','稳定定义',`<p>${esc(c.definition)}</p>`)}${section('02','范围与粒度',`<p>${esc(c.range)}<br>${esc(c.grain)}</p>`)}${section('03','语义边界',`<p>${esc(c.boundary)}</p>`)}${section('04','原始依据',`<p>${esc(c.evidence)}</p>`)}</div></section><section class="r-compare-col"><div class="r-compare-label">已有全局变量 / 近似检索结果</div><label class="r-field" style="margin-top:8px">对照变量<select id="rh-match">${variables.map(x=>`<option value="${x.id}" ${v.id===x.id?'selected':''}>${esc(x.name)} · ${x.status}</option>`).join('')}</select></label><h2>${esc(v.name)}</h2><div class="r-flex">${pill(v.status,v.status==='Deprecated'?'neutral':'')}<span class="r-code">${v.id} · ${v.version}</span></div><div style="margin-top:16px">${section('01','稳定定义',`<p>${esc(v.definition)}</p>`)}${section('02','范围与粒度',`<p>${esc(v.range)}<br>${esc(v.grain)}</p>`)}${section('03','语义边界',`<p>${esc(v.boundary)}</p>`)}${section('04','观测依据',`<p>${esc(v.evidence)}</p>`)}</div></section></div><div class="r-diff"><strong>语义差异核对</strong><p>${esc(v.id===c.match?c.diff:'人工选择的对照项：请逐项核对定义、范围、粒度与历史替代关系。')}</p></div>${c.status==='待核对'?`<div class="r-note">${(c.observations||[]).length} 项观测建议：${esc((c.observations||[]).map(p=>p.name).join('、')||'尚未补充')}。身份确认后逐项审核，不自动批准映射。</div><form id="rh-review" class="r-form"><h3>确认变量身份</h3><div class="r-form-grid" style="margin-top:12px"><label class="r-field">处理方式<select id="rh-decision"><option value="reuse">复用已有正式变量</option><option value="new">接受为新变量</option><option value="maintain">转已有定义维护</option><option value="return">退回补充材料</option><option value="defer" selected>暂缓核对</option><option value="reject">拒绝提议</option></select></label><label class="r-field">审核材料<input value="${esc(c.version+' / '+c.id)}" readonly></label><label class="r-field r-field-wide">审核理由 · 必填<textarea id="rh-reason" placeholder="说明语义核对结果、处理依据和后续需要补充的材料" required></textarea></label></div><label class="r-check"><input type="checkbox" id="rh-confirm">已核对当前材料、定义、范围、粒度与观测依据</label><div id="rh-review-error" role="alert" hidden></div><div class="r-form-actions r-between"><span class="r-muted">审核通过后仍由 L1 独立确认长期风险关系</span><button type="submit" class="r-primary cursor-interaction">确认变量身份</button></div></form>`:`<div class="r-note">演示处理结论：${esc(c.status)}。${esc(c.reason||'')}<br>材料及原依据保留，${c.formalId?'映射身份 '+esc(c.formalId)+'。':'未分配新的正式变量身份。'}</div>`}</div><div class="r-observation-panel" ${governanceStage==='observation'?'':'hidden'}>${renderObservations(c)}</div>`;
 const dialog=governanceDialog;
 const header=dialog.querySelector('.r-section-title');header.classList.add('r-dialog-header');
 header.querySelector('h2').id='rh-governance-title';
 header.insertAdjacentHTML('beforeend','<button type="button" class="r-dialog-close cursor-interaction" data-action="close-governance" aria-label="关闭候选审核">×</button>');
 const body=document.createElement('div');body.className='r-governance-body';
 for(const node of Array.from(dialog.children))if(node!==header)body.append(node);
 dialog.append(body);
 const form=body.querySelector('#rh-review');
 if(form&&draft){form.querySelector('#rh-decision').value=draft.decision;form.querySelector('#rh-reason').value=draft.reason;form.querySelector('#rh-confirm').checked=draft.confirm;}
 restoreObservationDrafts();
 let actions;
 if(form&&governanceStage==='identity'){actions=form.querySelector('.r-form-actions');actions.querySelector('[type="submit"]').setAttribute('form','rh-review');}
 else{form?.querySelector('.r-form-actions')?.remove();actions=document.createElement('div');const pending=pendingCandidates().filter(x=>x.id!==c.id);actions.innerHTML=`<span class="r-muted" role="status">${governanceStage==='observation'?'身份结论与观测结论分别记录 · '+observationStatus(c):pending.length?'当前筛选下还有 '+pending.length+' 项待处理':'当前筛选范围内没有待处理候选'}</span><div class="r-flex">${button('close-governance',governanceStage==='observation'?'关闭':'完成')}${pending.length?button('next-candidate','审核下一项',true):''}</div>`;}
 actions.className='r-governance-actions r-between';dialog.append(actions);
}
function captureReviewDraft(){
 const form=governanceDialog?.querySelector('#rh-review');
 if(form)reviewDrafts.set(state.candidate,{match:matchId,decision:form.querySelector('#rh-decision').value,reason:form.querySelector('#rh-reason').value,confirm:form.querySelector('#rh-confirm').checked});
 if(governanceDialog)for(const f of governanceDialog.querySelectorAll('[data-observation-form],[data-indicator-form]')){
  const values={};for(const input of f.querySelectorAll('[name]'))values[input.name]=input.type==='checkbox'?input.checked:input.value;
  observationDrafts.set(state.candidate+':'+f.dataset.draftKey,values);
 }
}
function restoreObservationDrafts(){
 for(const f of governanceDialog.querySelectorAll('[data-observation-form],[data-indicator-form]')){
  const values=observationDrafts.get(state.candidate+':'+f.dataset.draftKey);if(!values)continue;
  for(const input of f.querySelectorAll('[name]'))if(values[input.name]!==undefined){if(input.type==='checkbox')input.checked=values[input.name];else input.value=values[input.name];}
 }
}
function observationProposal(c,id){return (c.observations||[]).find(p=>p.id===id);}
function renderObservations(c){
 const confirmed=identityConfirmed(c),v=variables.find(x=>x.id===c.formalId),items=c.observations||[];
 const inherited=c.status==='已复用'?indicators.filter(d=>d.maps.some(m=>m[0]===c.formalId)):[];
 const inheritedView=inherited.length?`<div class="r-note"><strong>沿用已有配置</strong><p>${esc(inherited.map(d=>d.name+' · '+d.version).join('；'))}。额外建议仍需独立审核。</p></div>`:'';
 return `<div class="r-observation-summary"><h3>观测指标与事件证据建议</h3><p class="r-muted">${confirmed?'已确认身份 '+esc(v.name)+' · '+esc(v.id)+' · '+esc(v.version)+'；逐项确认适用依据及映射。':'先确认变量身份。以下均为 AI 建议，尚未形成有效观测映射。'}</p></div>${inheritedView}${!items.length?'<div class="r-note r-warning">尚无观测建议，保留方案缺口。</div>':''}${items.map(p=>renderObservation(c,p,confirmed)).join('')}<div class="r-note">配置获批不表示 L0 已接入数据，也不代表当期证据充分。量化指标缺口保留；定性变量可使用事件证据方案。</div>`;
}
function renderObservation(c,p,confirmed){
 const d=indicators.find(x=>x.id===p.indicatorId),terminal=['approved','inherited','rejected'].includes(p.outcome),editable=confirmed&&!terminal,labels={approved:'已确认',inherited:'已沿用',rejected:'已拒绝',returned:'已退回',deferred:'已暂缓'},locked=editable?'':'disabled';
 const type=p.kind==='event'?'事件证据方案':p.kind==='new'&&!d?'新指标建议':'已有指标';
 const details=d?facts([['正式指标',esc(d.id)+' · '+esc(d.version)],['统计口径',esc(d.object+' · '+d.unit+' · '+d.frequency)],['允许来源',esc(d.source)+' '+pill(d.sourceStatus,d.sourceStatus==='停用'?'warn':'')],['数据接入',esc(d.connection)]]):p.kind==='new'?facts([['统计口径',esc(p.definition.object+' · '+p.definition.unit+' · '+p.definition.frequency)],['适用范围',esc(p.definition.range)],['允许来源','待确认；尚无正式指标身份']]):facts([['证据材料',esc(p.evidence)],['量化指标','不适用；确认事件证据方案，不创建指标映射']]);
 const reason=p.audit?`<div class="r-note"><strong>处理记录：${esc(labels[p.outcome])}</strong><p>${esc(p.audit.reason)} · ${esc(p.audit.reviewer)} · ${esc(p.audit.time)}</p><p class="r-muted">${esc(p.audit.versions)}</p></div>`:'';
 const mappingForm=`<form data-observation-form="${p.id}" data-draft-key="${p.id}:mapping" class="r-observation-form"><div class="r-form-grid"><label class="r-field r-field-wide">${p.kind==='event'?'证据解释':'映射解释'}<textarea name="why" ${locked}>${esc(p.why)}</textarea></label><label class="r-field">适用范围<textarea name="scope" ${locked}>${esc(p.scope)}</textarea></label><label class="r-field">局限<textarea name="limit" ${locked}>${esc(p.limit)}</textarea></label><label class="r-field">处理方式<select name="decision" ${locked}><option value="hold">暂不处理</option><option value="approve">${p.kind==='event'?'确认事件证据方案':'确认指标映射'}</option><option value="defer">暂缓，保留缺口</option><option value="return">退回补充依据</option><option value="reject">拒绝本项建议</option></select></label><label class="r-field">材料版本<input readonly value="${esc(c.version+' / '+p.version)}"></label><label class="r-field r-field-wide">本项审核理由<textarea name="reason" ${locked} placeholder="说明确认依据或需补充的材料"></textarea></label></div><label class="r-check"><input type="checkbox" name="confirm" ${locked}>${p.kind==='event'?'已核对事件材料、解释、范围及局限':'已核对指标及变量版本、解释、范围、局限与允许来源'}</label><div role="alert" class="r-error" hidden></div>${editable?`<button type="submit" class="r-secondary cursor-interaction">记录本项${p.kind==='event'?'证据':'映射'}结论</button>`:''}</form>`;
 return `<section class="r-observation-item" data-observation="${p.id}"><div class="r-between"><h3>${esc(p.name)}</h3>${pill(type,'neutral')}${pill(labels[p.outcome]||'待确认',terminal?'neutral':'warn')}</div><div class="r-observation-details">${details}<p class="r-muted">依据：${esc(p.evidence)} · ${esc(p.version)}</p></div>${p.kind==='new'&&!d?renderIndicatorProposal(p,editable):''}${d?.sourceStatus==='停用'?'<div class="r-note r-warning">允许来源已停用，本项不能确认新映射；请退回或暂缓处理。</div>':''}${p.definitionAudit?`<div class="r-note">指标定义与允许来源已单独确认：${esc(p.definitionAudit.reason)} · ${esc(p.definitionAudit.reviewer)} · ${esc(p.definitionAudit.time)}。变量映射仍按本项结论处理。</div>`:''}${reason}${p.auditHistory?.length>1?`<details class="r-observation-history"><summary>查看此前处理记录</summary>${p.auditHistory.slice(0,-1).map(a=>`<p>${esc(labels[a.outcome])}：${esc(a.reason)} · ${esc(a.time)}<br>${esc(a.versions)}</p>`).join('')}</details>`:''}${p.outcome==='inherited'?`<p class="r-muted">已有生效映射保留，本次复用未创建重复关系。</p><p>${esc(d.maps.find(m=>m[0]===c.formalId)?.[1])}<br>范围：${esc(d.maps.find(m=>m[0]===c.formalId)?.[2])}<br>局限：${esc(d.maps.find(m=>m[0]===c.formalId)?.[3])}</p>`:terminal?`<p>${esc(p.why)}<br>范围：${esc(p.scope)}<br>局限：${esc(p.limit)}</p>`:mappingForm}</section>`;
}
function renderIndicatorProposal(p,editable){
 const fields={name:'指标名称',definition:'统计定义',boundary:'口径边界',object:'统计对象',range:'地域／市场／币种',unit:'单位',frequency:'频率',time:'时间语义'};
 return `<details class="r-indicator-proposal" ${editable?'open':''}><summary>先确认新指标定义与允许来源</summary><form data-indicator-form="${p.id}" data-draft-key="${p.id}:definition"><div class="r-form-grid">${Object.entries(fields).map(([key,label])=>`<label class="r-field ${['definition','boundary','time'].includes(key)?'r-field-wide':''}">${label}<${['definition','boundary','time'].includes(key)?'textarea':'input'} name="${key}" ${editable?'':'disabled'} ${['definition','boundary','time'].includes(key)?`>${esc(p.definition[key])}</textarea>`:`value="${esc(p.definition[key])}">`}</label>`).join('')}<label class="r-field r-field-wide">允许来源<select name="sourceId" ${editable?'':'disabled'}>${reviewSources.map(source=>`<option value="${source.id}" ${source.id===p.definition.sourceId?'selected':''}>${esc(source.name)} · ${esc(source.status)}</option>`).join('')}</select></label><label class="r-field r-field-wide">定义审核理由<textarea name="reason" ${editable?'':'disabled'}></textarea></label></div><label class="r-check"><input type="checkbox" name="confirm" ${editable?'':'disabled'}>已核对统计定义、口径及允许来源；本次仅确认指标定义</label><div role="alert" class="r-error" hidden></div>${editable?'<button type="submit" class="r-secondary cursor-interaction">确认指标定义与来源</button>':''}</form></details>`;
}
function reviewError(form,message){const el=form.querySelector('[role="alert"]');el.hidden=false;el.textContent=message;el.scrollIntoView({block:'nearest'});}
function refreshObservation(message){
 const body=governanceDialog.querySelector('.r-governance-body'),scroll=body.scrollTop;captureReviewDraft();render();governanceDialog.querySelector('.r-governance-body').scrollTop=scroll;
 governanceDialog.querySelector('[data-review-stage="observation"]')?.focus({preventScroll:true});notify(message);save();
}
function submitObservation(form){
 const c=candidates.find(x=>x.id===state.candidate),p=observationProposal(c,form.dataset.observationForm||form.dataset.indicatorForm),v=variables.find(x=>x.id===c.formalId),data=Object.fromEntries(new FormData(form));
 if(!identityConfirmed(c)||v?.status!=='Active')return reviewError(form,'先确认有效变量身份，再审核观测方案。');
 if(c.identityMaterialVersion!==c.version||c.identityVersion!==v.version)return reviewError(form,'变量或候选材料版本发生变化，请重新核对后再确认。');
 if(['approved','inherited','rejected'].includes(p.outcome))return;
 if(!data.reason?.trim())return reviewError(form,'请填写本项审核理由。');
 if(form.dataset.indicatorForm){
  if(p.indicatorId)return;
  const required=['name','definition','boundary','object','range','unit','frequency','time'];
  if(required.some(key=>!data[key]?.trim())||!data.confirm)return reviewError(form,'请补全指标定义并确认已核对口径及允许来源。');
  const source=reviewSources.find(x=>x.id===data.sourceId);
  if(!source||source.status!=='启用')return reviewError(form,'允许来源无效或已停用，不能确认新指标定义。');
  if(indicators.some(d=>d.name===data.name.trim()))return reviewError(form,'已有同名指标，请核对并复用正式指标，避免重复建档。');
  const id='DEMO-I'+String(indicators.length+1).padStart(3,'0');
  const definition=Object.fromEntries(required.map(key=>[key,data[key].trim()]));
  indicators.push({...definition,id,code:'DEMO_NEW_INDICATOR_'+(indicators.length+1),source:source.name,sourceStatus:source.status,sourceId:source.id,connection:'技术未就绪 · L0 尚无演示观测值',status:'启用',version:'v1.0',maps:[]});
  p.indicatorId=id;p.indicatorVersion='v1.0';p.name=definition.name;p.definitionAudit={reason:data.reason.trim(),reviewer:'演示审核人员',time:new Date().toLocaleString('zh-CN'),materialVersion:c.version,proposalVersion:p.version};
  const mappingConfirm=governanceDialog.querySelector(`[data-observation-form="${p.id}"] [name="confirm"]`);if(mappingConfirm)mappingConfirm.checked=false;
  observationDrafts.delete(c.id+':'+p.id+':definition');refreshObservation('演示指标定义与来源已确认，变量映射仍待单独确认。');return;
 }
 if(data.decision==='hold')return reviewError(form,'请选择本项处理方式；暂不处理不会生成审核结论。');
 if(!['approve','defer','return','reject'].includes(data.decision))return reviewError(form,'请选择有效处理方式。');
 if(data.decision==='approve'){
  if(!data.confirm||['why','scope','limit'].some(key=>!data[key]?.trim()))return reviewError(form,'请补全解释、适用范围与局限，并单独确认本项观测依据。');
  if(p.kind!=='event'){
   const d=indicators.find(x=>x.id===p.indicatorId);
   if(!d)return reviewError(form,'先确认新指标定义与允许来源，再确认变量映射。');
   if(d.version!==p.indicatorVersion||d.status!=='启用')return reviewError(form,'指标版本变化或已失效，请重新核对后再确认映射。');
   if(d.sourceStatus!=='启用')return reviewError(form,'允许来源已停用，不能新增有效映射。');
   if(d.maps.some(m=>m[0]===v.id))return reviewError(form,'已存在有效映射，请沿用当前配置；调整依据须转映射维护。');
   d.maps.push([v.id,data.why.trim(),data.scope.trim(),data.limit.trim()]);
   d.mapReviews??={};d.mapReviews[v.id]={version:'v1.0',variableVersion:v.version,indicatorVersion:d.version,candidate:c.id,materialVersion:c.version,proposalVersion:p.version,reason:data.reason.trim()};
  }
 }
 p.outcome={approve:'approved',defer:'deferred',return:'returned',reject:'rejected'}[data.decision];
 p.why=data.why.trim();p.scope=data.scope.trim();p.limit=data.limit.trim();
 p.audit={reason:data.reason.trim(),reviewer:'演示审核人员',time:new Date().toLocaleString('zh-CN'),versions:c.version+' / '+p.version+' / '+v.id+' '+v.version+(p.kind==='event'?' / 事件方案 v1.0':' / '+(p.indicatorId||'指标待确认')+' '+(p.indicatorVersion||'')+(p.outcome==='approved'?' / 关系 v1.0':''))};
 p.auditHistory??=[];p.auditHistory.push({...p.audit,outcome:p.outcome});
 observationDrafts.delete(c.id+':'+p.id+':mapping');refreshObservation('本项观测结论已记录；变量身份结论保持不变。');
}
function openGovernanceDialog(){
 if(governanceDialog){renderGovernance();return;}
 governanceScroll={x:window.scrollX,y:window.scrollY};governanceTrigger=state.candidate;
 const dialog=document.createElement('dialog');dialog.className='r-governance-dialog';dialog.setAttribute('aria-labelledby','rh-governance-title');
 root.append(dialog);governanceDialog=dialog;renderGovernance();
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeGovernanceDialog();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)closeGovernanceDialog();});
 dialog.showModal();dialog.querySelector('.r-dialog-close').focus({preventScroll:true});
}
function disposeGovernanceDialog(){
 if(!governanceDialog)return;
 const dialog=governanceDialog;captureReviewDraft();governanceDialog=null;dialog.close();dialog.remove();
}
function closeGovernanceDialog(){
 if(!governanceDialog)return;
 disposeGovernanceDialog();state.workspace=null;save();
 const trigger=content.querySelector(`[data-review-candidate="${governanceTrigger}"]`)||content.querySelector('#rh-candidate-search');trigger?.focus({preventScroll:true});governanceTrigger=null;
 if(governanceScroll)window.scrollTo(governanceScroll.x,governanceScroll.y);governanceScroll=null;
}
function selectCandidate(id){
 captureReviewDraft();state.candidate=id;matchId=null;governanceStage=identityConfirmed(candidates.find(c=>c.id===id))?'observation':'identity';renderGovernance();
 governanceTrigger=id;governanceDialog.querySelector('.r-dialog-close')?.focus({preventScroll:true});save();
}
function renderRevision(target=content,view=state.view){const d=state.editing||current();const fresh=state.isNew;const labels={sources:'风险源',variables:'全局变量',indicators:'指标',types:'风险类型'};
 target.innerHTML=`<button type="button" class="r-back cursor-interaction" data-action="back">← 返回${titles[view][0]}</button><div class="r-section-title"><h2>${fresh?'新增'+labels[view]+'提议':'修订'+d.name}</h2><p class="r-muted">${fresh?'先形成草稿并核对语义':'当前有效 '+d.version+' · 修订草稿单独保留'}</p></div><form id="rh-edit" class="r-form"><div class="r-form-grid"><label class="r-field">标准名称 · 必填<input name="name" required value="${esc(fresh?'':d.name)}"></label><label class="r-field">${view==='variables'?'可选分类／标签':'稳定编码 · 必填'}<input name="code" ${view==='variables'?'':'required'} value="${esc(fresh?'':view==='variables'?d.tags:d.code)}"></label>${view==='sources'?`<label class="r-field">分析层次 · 必选<select name="level" required><option value="">请选择分析层次</option><option value="macro" ${fresh?'':'selected'}>宏观 macro</option><option disabled>中观 meso · 范围待定</option><option disabled>微观 micro · 范围待定</option></select></label><label class="r-field">同层父分类<select name="parent"><option value="">无 · 一级分类</option>${sources.filter(x=>x.id!==d.id).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>`:''}<label class="r-field r-field-wide">稳定定义 · 必填<textarea name="definition" required>${esc(fresh?'':d.definition)}</textarea></label><label class="r-field r-field-wide">语义／分类边界 · 必填<textarea name="boundary" required>${esc(fresh?'':d.boundary)}</textarea></label>${d.question||['sources','types'].includes(view)?`<label class="r-field r-field-wide">核心问题 · 必填<input name="question" required value="${esc(fresh?'':d.question)}"></label>`:''}${view==='variables'?`<label class="r-field">适用范围 · 必填<input name="range" required value="${esc(fresh?'':d.range)}"></label><label class="r-field">观察粒度 · 必填<input name="grain" required value="${esc(fresh?'':d.grain)}"></label><label class="r-field r-field-wide">观测依据 · 必填<textarea name="evidence" required>${esc(fresh?'':d.evidence)}</textarea></label>`:''}${view==='indicators'?`<label class="r-field">统计对象 · 必填<input name="object" required value="${esc(fresh?'':d.object)}"></label><label class="r-field">地域／市场／币种 · 必填<input name="range" required value="${esc(fresh?'':d.range)}"></label><label class="r-field">单位 · 明确不适用或缺失<input name="unit" required value="${esc(fresh?'':d.unit)}"></label><label class="r-field">统计频率 · 必填<input name="frequency" required value="${esc(fresh?'':d.frequency)}"></label><label class="r-field r-field-wide">时间语义 · 必填<textarea name="time" required>${esc(fresh?'':d.time)}</textarea></label>`:''}<label class="r-field r-field-wide">变更／提出理由 · 必填<textarea name="reason" required placeholder="说明新增或修订依据以及适用范围"></textarea></label></div><div class="r-note">${view==='variables'?'新增先进入候选；正式身份须经语义核对与人工审核。':'本次提交形成待审修订；当前有效定义与历史版本保持可查。'}</div><div id="rh-edit-error" role="alert" hidden></div><div class="r-form-actions r-between">${button('back','取消')}<div class="r-flex"><button type="submit" class="r-secondary cursor-interaction" name="intent" value="draft" formnovalidate>保存草稿</button><button type="submit" class="r-primary cursor-interaction" name="intent" value="review">校验并提交审核</button></div></div></form>`;
}
function renderRevisions(){const labels={name:'标准名称',code:'编码／标签',definition:'定义',boundary:'边界',question:'核心问题',range:'适用范围',grain:'粒度',evidence:'观测依据',object:'统计对象',unit:'单位',frequency:'频率',time:'时间语义',source:'允许来源',mapWhy:'映射解释',mapScope:'映射适用范围',mapLimit:'映射局限'};content.innerHTML=`<button type="button" class="r-back cursor-interaction" data-action="back">← 返回目录</button><div class="r-section-title"><h2>修订审核与维护记录</h2><p class="r-muted">当前有效定义、草稿和待审修订分别保留</p></div>${state.drafts.length?state.drafts.map(d=>{const fields=Object.keys(labels).filter(k=>d[k]!==undefined&&d[k]!==(d.before?.[k]??''));return `<section class="r-form" style="margin-bottom:14px"><div class="r-between"><h3>${esc(d.name||d.id||'维护反馈')}</h3>${pill(d.status||'维护申请','warn')}</div><p class="r-muted" style="margin-top:6px">${esc(d.type)} · ${d.basedOn?'基于 '+esc(d.basedOn):'未替换当前生效定义'}</p>${fields.map(k=>`<div class="r-section" style="margin-top:15px"><h3>${labels[k]}</h3><div class="r-audit"><div class="r-audit-col"><span class="r-muted">当前定义</span><p>${esc(d.before?.[k]||'尚无正式定义')}</p></div><div class="r-audit-col"><span class="r-muted">本次提议</span><p>${esc(d[k]||'未填写')}</p></div></div></div>`).join('')}<div class="r-note">依据：${esc(d.reason||'草稿尚未补全理由')}<br>${d.target?'建议主责方：'+esc(d.target):'材料与本次修订关联，当前有效定义保持可查。'}</div></section>`;}).join(''):'<div class="r-form r-empty"><h3>尚无修订记录</h3><p>从定义详情发起修订，保存的草稿与待审材料将在这里查看。</p></div>'}<div class="r-note r-warning">真实审批角色、非变量修订审核粒度与发布方式仍待定版。这里呈现演示差异与待审材料。</div>`;}
function renderFeedback(){content.innerHTML=`<button type="button" class="r-back cursor-interaction" data-action="back">← 返回定义详情</button><div class="r-section-title"><h2>观测缺口与维护反馈</h2><p class="r-muted">${esc(current().name)} · 具体缺口交由主责模块处理</p></div><form id="rh-feedback" class="r-form"><label class="r-field">缺口类型<select id="rh-gap"><option value="M2">定义／语义或映射依据不足 → M2</option><option value="M1 / L0">允许信源不可用 → M1 / L0</option><option value="L0">本期数据缺失或原值有误 → L0</option><option value="L1">长期风险关联不适用 → L1</option><option value="L2 / M3">当前作用或判断方法无法确认 → L2 / M3</option></select></label><label class="r-field" style="margin-top:14px">依据与待补材料 · 必填<textarea id="rh-gap-reason" required placeholder="保留材料版本、具体缺口与维护建议"></textarea></label><div class="r-note">缺失不会用零值、中性状态、相似变量或默认评分填补。</div><div class="r-form-actions r-between">${button('back','取消')}<button type="submit" class="r-primary cursor-interaction">记录维护反馈</button></div></form>`;}
function openNewDialog(){
 if(newDialog||state.view==='variables')return;
 state.editing=current();state.isNew=true;
 newDialogScroll={x:window.scrollX,y:window.scrollY};
 const dialog=document.createElement('dialog');
 dialog.className='r-new-dialog';dialog.setAttribute('aria-labelledby','rh-new-dialog-title');
 root.append(dialog);newDialog=dialog;
 renderRevision(dialog);
 dialog.querySelector(':scope > .r-back').remove();
 const header=dialog.querySelector('.r-section-title');header.classList.add('r-dialog-header');
 header.querySelector('h2').id='rh-new-dialog-title';
 const close=document.createElement('button');close.type='button';close.className='r-dialog-close cursor-interaction';close.dataset.action='close-new';close.setAttribute('aria-label','关闭新增定义弹框');close.textContent='×';
 header.append(close);
 const form=dialog.querySelector('#rh-edit');form.classList.add('r-dialog-form');
 const footer=form.querySelector('.r-form-actions');
 const body=document.createElement('div');body.className='r-dialog-body';
 for(const node of Array.from(form.children))if(node!==footer)body.append(node);
 form.prepend(body);
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeNewDialog();});
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const bounds=dialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeNewDialog();
 });
 dialog.showModal();form.querySelector('input')?.focus();
}
function closeNewDialog(){
 if(!newDialog)return;
 const dialog=newDialog;newDialog=null;
 dialog.close();dialog.remove();state.isNew=false;
 render();save();
 root.querySelector('[data-action="new"]')?.focus({preventScroll:true});
 if(newDialogScroll)window.scrollTo(newDialogScroll.x,newDialogScroll.y);
 newDialogScroll=null;
}
function goBack(){if(newDialog){closeNewDialog();return;}state.workspace=null;state.historyVersion=null;render();save();const target=state.focus?content.querySelector(`[data-action="${state.focus}"]`):null;if(target)target.focus();else content.querySelector('[data-id]')?.focus();}
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.openIndicator){openIndicator(b.dataset.openIndicator);return;}
 if(b.dataset.indicatorTab){indicatorContext.tab=b.dataset.indicatorTab;indicatorContext.historyVersion=null;renderIndicatorDialog();return;}
 if(b.dataset.view){state.view=b.dataset.view;state.workspace=null;state.tab='definition';state.historyVersion=null;matchId=null;render();save();return;}
 if(b.dataset.id){state.selected[state.view]=b.dataset.id;state.tab='definition';state.historyVersion=null;renderRows();renderDetail();if(root.clientWidth<=900)content.querySelector('#rh-detail').scrollIntoView({block:'start'});save();return;}
 if(b.dataset.detailTab){state.tab=b.dataset.detailTab;state.historyVersion=null;renderDetail();save();return;}
 if(b.dataset.variableMode){state.variableMode=b.dataset.variableMode;state.workspace=null;render();save();return;}
 if(b.dataset.reviewStage){captureReviewDraft();governanceStage=b.dataset.reviewStage;renderGovernance();governanceDialog.querySelector(`[data-review-stage="${governanceStage}"]`).focus({preventScroll:true});return;}
 if(b.dataset.reviewCandidate){state.candidate=b.dataset.reviewCandidate;governanceStage=identityConfirmed(candidates.find(c=>c.id===state.candidate))?'observation':'identity';state.workspace='governance';matchId=null;openGovernanceDialog();save();return;}
 const a=b.dataset.action;if(!a)return;state.focus=a;
 if(a==='close-indicator'){closeIndicator();return;}
 if(a==='link-indicator'){openIndicator(null,'link');return;}
 if(a==='indicator-back'){indicatorContext.mode='detail';renderIndicatorDialog();return;}
 const indicatorModes={'indicator-definition':'definition','indicator-source':'source','indicator-mapping':'mapping','indicator-feedback':'feedback'};if(indicatorModes[a]){indicatorContext.mode=indicatorModes[a];renderIndicatorDialog();return;}
 if(a==='back'){goBack();return;}
 if(a==='clear'){state.filters[state.view]={q:'',status:'all'};render();save();return;}
 if(a==='governance'){state.variableMode='candidates';state.workspace=null;render();save();return;}
 if(a==='clear-candidates'){state.candidateFilters={...state.candidateFilters,q:'',status:'待核对',origin:'all',observation:'all',page:1};renderCandidateCatalog();save();content.querySelector('#rh-candidate-search').focus();return;}
 if(a==='candidate-prev'||a==='candidate-next'){state.candidateFilters.page+=a==='candidate-next'?1:-1;renderCandidateRows();save();content.querySelector(`[data-action="${a}"]`).focus({preventScroll:true});return;}
 if(a==='close-governance'){closeGovernanceDialog();return;}
 if(a==='next-candidate'){const ordered=[...candidates].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)),pending=pendingCandidates().filter(c=>c.id!==state.candidate),position=ordered.findIndex(c=>c.id===state.candidate);const next=ordered.slice(position+1).find(c=>pending.includes(c))||pending[0];if(next)selectCandidate(next.id);return;}
 if(['feedback','revisions'].includes(a)){state.workspace=a;render();save();return;}
 if(a==='close-new'){closeNewDialog();return;}
 if(a==='new'){state.focus=a;openNewDialog();save();return;}
 if(a==='edit'){state.editing=current();state.isNew=false;state.workspace='revision';render();content.querySelector('input')?.focus();save();return;}
});
root.addEventListener('input',e=>{const observationForm=e.target.closest('[data-observation-form],[data-indicator-form]');if(observationForm&&!['reason','decision','confirm'].includes(e.target.name)){const confirm=observationForm.querySelector('[name="confirm"]');if(confirm)confirm.checked=false;}if(e.target.closest('dialog.r-governance-dialog'))captureReviewDraft();if(e.target.id==='rh-candidate-search'){state.candidateFilters.q=e.target.value;state.candidateFilters.page=1;renderCandidateRows();save();}if(e.target.id==='rh-search'){state.filters[state.view].q=e.target.value;renderRows();renderDetail();save();}});
root.addEventListener('change',e=>{if(e.target.name==='sourceId'){const form=e.target.closest('form');if(form.querySelector('[name="confirm"]'))form.querySelector('[name="confirm"]').checked=false;}const candidateFields={'rh-candidate-status':'status','rh-candidate-origin':'origin','rh-observation-status':'observation','rh-candidate-size':'pageSize'};const field=candidateFields[e.target.id];if(field){state.candidateFilters[field]=field==='pageSize'?Number(e.target.value):e.target.value;state.candidateFilters.page=1;renderCandidateRows();save();}if(e.target.closest('dialog.r-governance-dialog'))captureReviewDraft();if(e.target.id==='rh-status'){state.filters[state.view].status=e.target.value;renderRows();renderDetail();save();}if(e.target.id==='rh-match'){matchId=e.target.value;const confirm=governanceDialog.querySelector('#rh-confirm');if(confirm)confirm.checked=false;captureReviewDraft();const scroll=governanceDialog.querySelector('.r-governance-body').scrollTop;renderGovernance();governanceDialog.querySelector('.r-governance-body').scrollTop=scroll;governanceDialog.querySelector('#rh-match').focus({preventScroll:true});}if(e.target.id==='rh-indicator-history-version'){indicatorContext.historyVersion=e.target.value;renderIndicatorDialog();}if(e.target.id==='rh-history-version'){state.historyVersion=e.target.value;renderDetail();}});
root.addEventListener('submit',e=>{e.preventDefault();const form=e.target;
 if(form.id==='rh-indicator-maintenance'){submitIndicatorMaintenance(form);return;}
 if(form.dataset.observationForm||form.dataset.indicatorForm){submitObservation(form);return;}
 if(form.id==='rh-review'){
 const c=candidates.find(x=>x.id===state.candidate),v=variables.find(x=>x.id===matchId),decision=form.querySelector('#rh-decision').value,reason=form.querySelector('#rh-reason').value.trim(),confirm=form.querySelector('#rh-confirm').checked;let error='';
 if(!reason)error='请填写审核理由。';else if(!confirm)error='请确认已核对当前材料、定义、范围、粒度与观测依据。';else if(['reuse','maintain'].includes(decision)&&v.status!=='Active')error='所选变量已废弃，不能建立新的正式引用；请核对有效替代项。';else if(decision==='reuse'&&(c.range!==v.range||c.grain!==v.grain))error='范围或粒度存在差异，请转维护、暂缓或补充新定义，不能直接复用。';else if(decision==='new'&&variables.some(x=>x.status==='Active'&&(x.name===c.name||x.alias===c.name)))error='候选命中已有正式名称或别名，请重新核对并考虑复用。';
 if(error){const el=form.querySelector('#rh-review-error');el.className='r-error';el.hidden=false;el.textContent=error;return;}
 if(c.status!=='待核对')return;
 const labels={reuse:'已复用',new:'新变量已确认',maintain:'已转维护',return:'已退回',defer:'已暂缓',reject:'已拒绝'};
 c.status=labels[decision];c.reason=reason;if(decision==='reuse'||decision==='maintain')c.formalId=v.id;
 if(decision==='new'){const id='DEMO-V'+String(variables.length+1).padStart(3,'0');variables.push({id,name:c.name,code:'DEMO_NEW_'+String(variables.length+1),definition:c.definition,boundary:c.boundary,range:c.range,grain:c.grain,evidence:c.evidence,tags:'未分类',alias:'',status:'Active',version:'v1.0'});c.formalId=id;}
 if(identityConfirmed(c)){c.identityMaterialVersion=c.version;c.identityVersion=variables.find(x=>x.id===c.formalId).version;c.observations=(c.observations||[]).map(p=>({...p}));if(decision==='reuse')for(const p of c.observations){if(p.indicatorId&&indicators.find(d=>d.id===p.indicatorId)?.maps.some(m=>m[0]===c.formalId))p.outcome='inherited';}governanceStage='observation';}
 reviewDrafts.delete(c.id);state.decisions.push({candidate:c.id,decision,reason});render();governanceDialog.querySelector('[data-action="next-candidate"], [data-action="close-governance"]')?.focus({preventScroll:true});notify('演示变量身份结论已记录；观测方案需分别确认，未自动创建风险或长期关系。');save();return;
 }
 if(form.id==='rh-edit'){
 const view=form.dataset.entityView||state.view;const payload=Object.fromEntries(new FormData(form)),intent=e.submitter?.value||'draft';const names={name:'标准名称',code:'稳定编码',definition:'稳定定义',boundary:'语义边界',question:'核心问题',range:'适用范围',grain:'观察粒度',evidence:'观测依据',reason:'变更理由',level:'分析层次',object:'统计对象',unit:'单位',frequency:'统计频率',time:'时间语义'};let error='';
 if(intent==='review'){for(const input of form.querySelectorAll('[required]'))if(!input.value.trim()){error='请填写'+names[input.name]+'。';input.focus();break;}if(!error&&view!=='variables'&&datasets[view].some(x=>x.code===payload.code&&(state.isNew||x.id!==state.editing.id)))error='稳定编码已存在，请核对语义后复用已有身份。';if(!error&&['sources','types','variables'].includes(view)&&/^(高|中|低|加剧|减弱|正在收紧)$/.test(payload.name.trim()))error='请使用稳定分类或因素名称，当前状态与严重度分别管理。';}
 if(error){const el=form.querySelector('#rh-edit-error');el.hidden=false;el.className='r-error';el.textContent=error;return;}
 state.drafts.push({...payload,type:view,id:form.dataset.indicatorId||state.editing?.id,status:intent==='review'?'待审核':'草稿',basedOn:state.isNew?null:state.editing.version,before:state.isNew?null:{...state.editing}});
 if(form.dataset.indicatorId){indicatorContext.mode='detail';renderIndicatorDialog();save();notify('演示共享指标修订已保存，当前有效定义保持不变。');return;}
 goBack();notify(intent==='review'?'演示材料已提交审核，当前有效定义保持不变。':'演示草稿已保存于本次预览，当前有效定义保持不变。');return;
 }
 if(form.id==='rh-feedback'){const reason=form.querySelector('#rh-gap-reason').value.trim();if(!reason)return;const target=form.querySelector('#rh-gap').value;state.drafts.push({type:'feedback',reason,target});goBack();notify('演示维护反馈已记录，建议主责方：'+target+'；尚未发送到其他模块。');}
});
window.addEventListener('openai:set_globals',e=>{const snapshot=e.detail?.globals?.widgetState;if(snapshot&&JSON.stringify(snapshot)!==lastSavedSnapshot){restore(snapshot);render();}});
const initialView=root.dataset.initialView;
if(datasets[initialView])state.view=initialView;
if(root.dataset.initialTab==='observations'){state.tab='observations';if(variables.some(v=>v.id===root.dataset.initialVariable))state.selected.variables=root.dataset.initialVariable;}
const initialWorkspace=root.dataset.initialWorkspace;
if(initialWorkspace==='governance'){state.view='variables';state.variableMode='candidates';}else if(initialWorkspace==='revision')state.workspace=initialWorkspace;
render();
if(globalThis.Tweak){const t=new Tweak({container:root,onChange:()=>{render();save();}});t.addSelect(state,'density',{label:'目录密度',options:[{label:'紧凑',value:'compact'},{label:'舒展',value:'relaxed'}],reference:'rh.density'});}
})();
