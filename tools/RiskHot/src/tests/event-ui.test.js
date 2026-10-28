import test from 'node:test';import assert from 'node:assert/strict';import {renderEvent,resolveEventRoute,renderPaging} from '../web/events.js';
test('事件详情左上角提供固定列表入口，直接打开也不依赖浏览历史',()=>{
 const html=renderEvent({event:{id:'e',title:'标题',description:'摘要'},targets:[],variables:[],ratings:[]});
 assert.match(html,/<nav class="event-detail-nav" aria-label="事件详情导航"><a class="secondary" href="#events">[\s\S]*?返回事件列表<\/a><\/nav>/);
 assert.ok(html.indexOf('event-detail-nav')<html.indexOf('event-overview'));
});
test('正式结果与候选区分，草案空分与未接下游明确可见，原文转义',()=>{const s={event:{id:'e',title:'<script>test</script>',description:'事实',event_status:'announced',revision_no:1},evidence:[],updates:[],ratings:[{m:null,rating_status:'draft',reasoning_summary:'文字',limitations:[]}],targets:[],variables:[],sources:[]};const html=renderEvent(s);assert.match(html,/文字评价，未量化/);assert.match(html,/风险分析尚未接入/);assert.doesNotMatch(html,/<script>/);});
test('正式事件优先展示摘要、主体、观测对象和金融意义，追溯默认收起',()=>{
 const s={event:{id:'e',title:'措施标题',description:'措施摘要',subject:'行动机构',event_status:'completed',event_time:'2026-10-26'},facts:[],targets:[{target_id:'t',definition_snapshot_id:'d',relation_note:'直接影响流动性'}],definitions:[{id:'d',payload:{name:'观测市场'}}],variables:[],evidence:[],ratings:[{id:'r',rating_status:'draft',m:null,reasoning_summary:'意义概要',dimension_scores:[{dimension_key:'供给',reason:'有原文依据的供给变化'}],financial_usages:['支持流动性观察'],limitations:['不可推断净投放']}]};
 const html=renderEvent(s);
 for(const text of ['措施摘要','主体 <span lang="en">Subject','观测对象 <span lang="en">Target','行动机构','观测市场','意义概要','有原文依据的供给变化','支持流动性观察'])assert.ok(html.includes(text),text);
 assert.ok(html.indexOf('措施摘要')<html.indexOf('event-subject-heading'));
 assert.ok(html.indexOf('意义概要')<html.indexOf('event-related-heading'));
 assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
});
test('没有Target不将Subject冒充观测对象，未知评价状态不显示已确认',()=>{
 const html=renderEvent({event:{id:'e',title:'标题',description:'摘要',subject:'中国人民银行'},targets:[],variables:[],ratings:[{rating_status:'needs_reassessment',reasoning_summary:'待核对',limitations:[]}]});
 assert.match(html,/尚未确认观测对象/);assert.match(html,/待重新评价/);assert.doesNotMatch(html,/<span>已确认|0 个主体/);
 const empty=renderEvent({event:{id:'e',title:'标题',description:'摘要'},targets:[],variables:[],ratings:[]});assert.match(empty,/尚无已保存的金融意义评价/);
});
test('关联候选直接展示，证据按Fact隔离，不展示其他候选证据',()=>{
 const html=renderEvent({event:{id:'e',title:'正式事件'},targets:[],variables:[],facts:[{id:'f1',title:'<候选一>',description:'候选摘要',relation_role:'initial',relation_note:'同一行动'},{id:'f2',title:'候选二',description:'补充内容',relation_role:'supplement'}],evidence:[{fact_id:'f1',information_version_id:'v1',quote:'<第一份原文>'},{fact_id:'f2',information_version_id:'v2',quote:'第二份原文'},{fact_id:'other',quote:'不属于本事件'}]});
 assert.match(html,/关联候选事件/);assert.match(html,/（2）/);assert.match(html,/&lt;候选一&gt;/);assert.match(html,/候选摘要/);
 const first=html.slice(html.indexOf('data-fact-id="f1"'),html.indexOf('data-fact-id="f2"'));
 assert.match(first,/&lt;第一份原文&gt;/);assert.doesNotMatch(first,/第二份原文|不属于本事件/);assert.doesNotMatch(html,/href="#candidate=|href="#processing=|确认保存正式事件/);
 assert.match(renderPaging({next_cursor:20},'events',0),/#events&amp;cursor=20/);
});
test('旧候选入口按真实归属跳转，不把待归组候选塞进正式事件',async()=>{
 const mock=events=>({get:async path=>path.includes('/candidates/')?{fact_id:'f'}:{events}});
 assert.equal(await resolveEventRoute(mock([{event_id:'e'}]),'#candidate=c'),'#event=e');
 assert.equal(await resolveEventRoute(mock([]),'#candidate=c'),'#fact=f');
 assert.equal(await resolveEventRoute({get:async()=>({version_id:'v'})},'#processing=p'),'#information=v');
 assert.equal(await resolveEventRoute({},'#version=v'),'#information=v');
 assert.equal(await resolveEventRoute({},'#queue&cursor=20'),'#events');
 assert.equal(await resolveEventRoute({},'#events&cursor=20'),'#events&cursor=20');
 assert.equal(await resolveEventRoute({},''),'');
 await assert.rejects(()=>resolveEventRoute({get:async()=>{throw new Error('forbidden');}},'#candidate=c'),/forbidden/);
});

test('日期时间线按上海归日，正文完整转义，来源与时间说明独立展开',async()=>{
 const {renderTimeline,timelineDate,eventListReturn}=await import('../web/events.js');
 const item={id:'e',title:'<script>标题</script>',description:'第一段\n第二段完整内容 <img onerror="x">',event_status:'something',display_time:'2026-10-26T20:15:00Z',display_time_precision:'instant',display_time_basis:'first_collected',first_collected_at:'2026-10-26T20:15:00Z',published_at_text:'2026-10-26',display_time_reason:'范围已判定',time_source_id:'s',sources:[{id:'s',name:'信源 <a>'},{id:'s2',name:'另一来源'}]};
 assert.equal(timelineDate(item).key,'2026-10-27');assert.equal(timelineDate(item).time,'04:15');
 const html=renderTimeline({items:[item,{...item,id:'e2'}],next_cursor:40},20);
 assert.match(html,/本页2条/);assert.match(html,/另1个关联信源/);assert.match(html,/阶段未知/);assert.match(html,/第一段\n第二段完整内容/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img/);
 assert.match(html,/#event=e&amp;list_cursor=20&amp;list_anchor=e/);assert.equal(eventListReturn('#event=e&list_cursor=20&list_anchor=e'),'#events&cursor=20&anchor=e');
 for(const bad of ['-1','NaN','Infinity','1.2','9007199254740992'])assert.equal(eventListReturn(`#event=e&list_cursor=${bad}`),'#events');
 assert.equal(eventListReturn('#event=e'),'#events');assert.equal(eventListReturn('#event=e&list_cursor=0&list_anchor=%22'),'#events&cursor=0');
});
test('不完整日期独立精度组，缺失日期明确归组，不补造午夜',async()=>{
 const {renderTimeline}=await import('../web/events.js');
 const items=[{id:'d',display_time:'2026-10-01',display_time_precision:'day'},{id:'m',display_time:'2026-09',display_time_precision:'month'},{id:'y',display_time:'2025',display_time_precision:'year'},{id:'u',display_time:null,display_time_precision:'unknown'}].map(x=>({...x,title:'标题',description:'描述'}));
 const html=renderTimeline({items,next_cursor:null});
 for(const label of ['时刻未明确','展示日期不完整 · 2026-09','精确到年','展示时间未明确'])assert.ok(html.includes(label));
 assert.doesNotMatch(html,/00:00|T00/);assert.equal((html.match(/class="timeline-day"/g)??[]).length,4);
});

test('日精度分组根据原日期显示星期，时刻仍未明确',async()=>{
 const {timelineDate,renderTimeline}=await import('../web/events.js');
 const item={id:'day',title:'日期事件',description:'保留日期',display_time:'2026-10-26',display_time_precision:'day'};
 assert.equal(timelineDate(item).weekday,'星期一');assert.equal(timelineDate(item).time,'时刻未明确');
 const html=renderTimeline({items:[item],next_cursor:null});assert.match(html,/星期一/);assert.doesNotMatch(html,/00:00|T00/);
});
