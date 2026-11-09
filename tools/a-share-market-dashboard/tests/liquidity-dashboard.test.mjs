import test from 'node:test';
import assert from 'node:assert/strict';
import { liquidityVerdict, renderLiquidityRows, renderLiquidityChart, renderLiquiditySources, renderFundingMonitor, liquidityUpdateTime } from '../src/liquidity-dashboard.mjs';

test('missing and partial coverage are explicit; zero is a valid score', () => {
  assert.equal(liquidityVerdict({score: null}), '数据不足');
  assert.match(liquidityVerdict({score: 0, label: '中性', complete: false}), /部分指标.*0 分/);
});
test('optional unavailable flow is hidden, ordinary unavailable metrics remain visible', () => {
  const html=renderLiquidityRows([
    {id:'flow',name:'主力',status:'missing',optional:true},
    {id:'vix',name:'VIX',status:'missing',score:null},
    {id:'south',name:'南向',status:'ok',reference:true,score:null,value:0}
  ],'vix');
  assert.doesNotMatch(html,/主力/);assert.match(html,/VIX/);assert.match(html,/不计分/);assert.match(html,/参考项/);assert.match(html,/>0<\/strong>/);
});
test('source strings are escaped and non-https links are not rendered', () => {
  const html=renderLiquidityChart({name:'<img onerror=x>',rule:'<script>',reason:'<error>',points:[],sourceUrls:['javascript:alert(1)']});
  assert.doesNotMatch(html,/<img|<script|javascript:/);assert.match(html,/&lt;img/);assert.match(html,/历史观测不足/);
});
test('flat data has finite geometry and history exposes actual observations', () => {
  const html=renderLiquidityChart({id:'vix',name:'VIX',rule:'',unit:'点',change:null,baseline:null,points:[{date:'2026-11-03',value:20},{date:'2026-11-04',value:20}]});
  assert.doesNotMatch(html,/NaN|Infinity/);assert.match(html,/2026-11-04/);assert.match(html,/2 条/);
});

test('source disclosure separates configured fallback from actual cached or missing source', () => {
  const html=renderLiquiditySources({provider:'free',metrics:[
    {id:'yield',source:'东财 · 美国国债收益率',date:'2026-11-04',status:'ok',cached:true,sourceUrls:['https://data.eastmoney.com/cjsj/zmgzsyl.html']},
    {id:'walcl',source:'待获取',status:'missing',reason:'取数失败 <error>',sourceUrls:[]},
    {id:'flow',source:'待获取',status:'missing',optional:true}
  ]});
  assert.match(html,/Tushare-data Python us_tycr/);
  assert.match(html,/东财 · 美国国债收益率/);
  assert.match(html,/读取有效缓存 · 观测日期 2026-11-04/);
  assert.match(html,/未取得数据/);
  assert.match(html,/取数失败 &lt;error&gt;/);
  assert.match(html,/主力资金净流入/);
  assert.match(html,/本页当前没有使用 Wind 数据/);
  assert.doesNotMatch(renderLiquiditySources({provider:'wind',metrics:[]}),/本页当前没有使用 Wind 数据/);
});

test('funding monitoring distinguishes missing, stale, zero and actual prior dates', () => {
  const base = {unit:'亿元',rule:'订单代理 <说明>',points:[],change:null,baseline:null,previous:null,percentile:null,sampleCount:0};
  const monitor = {cards:[
    {...base,id:'cn_margin_net',name:'融资',value:0,date:'2026-11-04',status:'ok',direction:'净额为零',percentile:50,sampleCount:60,previous:{date:'2026-10-30',value:1}},
    {...base,id:'cn_super_flow',name:'超大单',value:2,status:'stale',reason:'旧数据'},
    {...base,id:'cn_etf_flow',name:'ETF配置盘',value:null,status:'missing',reason:'尚未接入申赎数据'},
  ],breadth:[],note:'观察项，不计分',percentileRule:'不足60个不计算'};
  const html=renderFundingMonitor(monitor);
  assert.match(html,/前次 \+1 亿元 · 2026-10-30/);
  assert.match(html,/近60次分位 P50/);
  assert.match(html,/净额为零/);
  assert.match(html,/旧数据 · 暂不判断分位/);
  assert.match(html,/尚未接入申赎数据/);
  assert.match(html,/&lt;说明&gt;/);
  assert.doesNotMatch(html,/NaN|undefined|Infinity/);
  const source=renderLiquiditySources({provider:'free',metrics:[],fundingMonitor:monitor});
  assert.match(source,/fund_share \+ fund_nav/);
  assert.match(source,/尚未接入申赎数据/);
});

test('Wind ETF source, coverage and background progress are explicit', () => {
  const metric={id:'cn_etf_flow',name:'ETF配置盘',value:12,status:'ok',date:'2026-11-04',
    transport:'wind-mcp',source:'Wind MCP',updatedAt:'2026-11-06T01:03:00Z',cached:true,percentile:null,sampleCount:2,points:[],
    change:null,baseline:null,coverage:{received:1370,expected:1370,universeDate:'2026-11-05'},
    refresh:{running:true,message:'正在读取Wind申赎数据',completedBatches:5,totalBatches:28}};
  const monitor={cards:[metric],breadth:[]};
  const sources=renderLiquiditySources({provider:'free',metrics:[],fundingMonitor:monitor});
  assert.match(sources,/ETF已启用Wind MCP后台取数/);
  assert.match(sources,/1,370 \/ 1,370 只ETF/);
  assert.match(sources,/完成 5 \/ 28 批/);
  assert.doesNotMatch(sources,/本页当前没有使用 Wind 数据|读取本地导入/);
  const card=renderFundingMonitor(monitor);
  assert.match(card,/完成后自动更新/);
  assert.match(card,/分位待积累 · 2 \/ 60/);
  assert.match(card,/数据日期：2026-11-04/);
  assert.match(card,/更新时间：2026\/11\/06 09:03:00（北京时间）/);
  assert.match(card,/每日09:00自动更新/);
  assert.match(sources,/不是Wind发布时间/);
});

test('successful update time is formatted in Shanghai, missing times are not invented', () => {
  assert.equal(liquidityUpdateTime('2026-11-05T16:05:00Z'),'2026/11/06 00:05:00');
  assert.equal(liquidityUpdateTime(null),'暂无成功记录');
  assert.equal(liquidityUpdateTime('bad'),'暂无成功记录');
});

test('breadth does not silently combine counts from different observation dates', () => {
  const html=renderFundingMonitor({cards:[],breadth:[
    {id:'cn_breadth_ratio',value:80,date:'2026-11-05',status:'ok'},
    {id:'cn_breadth_limit_up',value:123,date:'2026-11-04',status:'ok'},
    {id:'cn_breadth_limit_down',value:0,date:'2026-11-05',status:'ok'},
  ]});
  assert.match(html,/>80%<\/strong>/);
  assert.doesNotMatch(html,/>123</);
  assert.match(html,/跌停<\/dt><dd>0/);
  assert.match(html,/首次采集尚无对比/);
});

test('legacy breadth source labels display plain wording without changing cached data', () => {
  const metric={id:'cn_breadth_ratio',source:'乐咕乐股 · 沪深赚钱效应 <来源>',status:'ok',value:50};
  const report={metrics:[],fundingMonitor:{cards:[],breadth:[metric]}};
  const html=renderLiquiditySources(report)+renderLiquidityRows([metric],'cn_breadth_ratio')+renderFundingMonitor(report.fundingMonitor);
  assert.match(html,/市场涨跌分布/);
  assert.match(html,/&lt;来源&gt;/);
  assert.doesNotMatch(html,/赚钱效应/);
  assert.equal(metric.source,'乐咕乐股 · 沪深赚钱效应 <来源>');
});


test('ETF sample estimate exposes coverage and exclusions without a percentile claim', () => {
  const html=renderFundingMonitor({cards:[{id:'cn_etf_flow',name:'ETF申赎净流入（样本估算）',estimate:true,value:12,status:'ok',direction:'净流入',percentile:null,sampleCount:0,coverage:{received:1530,expected:1531,unknown_listing_date:['158905.SZ']},excluded:[{ts_code:'512220.SH',name:'<ETF>',reason:'corporate_action_review'}],rule:'份额变化×净值',reason:'样本非全市场'}],breadth:[]});
  assert.match(html,/1,530 \/ 1,531/);
  assert.match(html,/份额折算或分红待核实/);
  assert.match(html,/&lt;ETF&gt;/);
  assert.match(html,/158905.SZ/);
  assert.match(html,/份额变化×净值/);
  assert.doesNotMatch(html,/近60次分位|Wind MCP|每日09:00/);
});
