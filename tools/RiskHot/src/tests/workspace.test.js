import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {renderTasks,renderTaskDetail,renderSchedules,renderExecutionOverview} from '../web/tasks.js';
import {launchState,renderActivity} from '../web/activity.js';
import {renderDelivery} from '../web/delivery.js';

test('delivery UI separates saved, received and extraction state and exposes only available files',()=>{
  let $=load(renderDelivery({status:'received',generation:1,candidate_count:null,extraction_status:'recoverable',files:{status:'ready',generation:1,information:{url:'/information'},receipt:{url:'/receipt'},candidates:null}},true));
  assert.match($('body').text(),/F02 已接收/);assert.match($('body').text(),/数量待确认/);assert.equal($('a').length,2);assert.doesNotMatch($('body').text(),/候选 0/);
  $=load(renderDelivery({version_id:'v',status:'recoverable',reason_code:'HANDOFF_CONTENT_MISMATCH',generation:2,files:{status:'recoverable',generation:3}},true));
  assert.equal($('[data-retry-delivery]').length,1);assert.equal($('[data-retry-files]').length,1);
  $=load(renderDelivery({version_id:'v',status:'recoverable',generation:2,files:{status:'recoverable',generation:3}},false));assert.equal($('button').length,0);
});

test('launch remains locked through queue, running and pause, and uncertain reads cannot unlock it',()=>{
  for(const status of ['queued','running','paused'])assert.equal(launchState({items:[{status}]},true).disabled,true);
  assert.equal(launchState({items:[]},false).disabled,true);
  assert.equal(launchState({items:[],latest_batch:{status:'completed'}},true).disabled,false);
});

test('activity uses actual completed sources and makes pause, stale state and errors visible without simulated progress',()=>{
  const task={id:'task-123',scheduled_at:'2026-10-26T10:00:00Z',status:'running',sources:[{status:'completed'},{status:'running'},{status:'blocked'}],saved_count:1};
  const activity={items:[task],total:1,latest_batch:task};
  let $=load(renderActivity(activity,true,()=>true));
  assert.equal($('progress').attr('value'),'1');assert.equal($('progress').attr('max'),'3');assert.match($('body').text(),/1 个需处理/);assert.equal($('.is-running').length,1);
  task.status='paused';$=load(renderActivity(activity,true,()=>true));
  assert.equal($('.is-running').length,0);assert.match($('body').text(),/继续任务/);
  task.status='running';$=load(renderActivity(activity,false,()=>true));
  assert.equal($('.is-running').length,0);assert.equal($('[data-task-control]').length,0);assert.match($('body').text(),/状态待确认/);
  $=load(renderActivity(activity,true,()=>false));assert.equal($('[data-task-control]').length,0);
});

test('plan workspace separates configured plans and keeps unconfigured sources reachable',()=>{
  const state={sources:[{catalog_key:'a',name:'已有计划',state:'ACTIVE'},{catalog_key:'b',name:'待配置来源',state:'DISABLED'}],filters:{q:''},planFilters:{view:'configured'},monitor:{schedules:[{catalog_key:'a',enabled:true,interval_seconds:3600,next_run_at:'2026-10-27T00:00:00Z'}],alerts:[]}};
  let $=load(renderSchedules(state,()=>true));
  assert.equal($('[data-schedule="b"]').length,0);
  assert.equal($('[data-source-runs="a"]').length,1);
  assert.match($('tbody').text(),/尚未执行/);
  state.planFilters.view='unconfigured';$=load(renderSchedules(state,()=>true));
  assert.equal($('[data-schedule="b"]').length,1);assert.equal($('[data-schedule="a"]').length,0);
  $=load(renderSchedules(state,()=>false));assert.equal($('[data-schedule]').length,0);
});

test('compact task overview keeps date metrics separate from filtered rows and exposes status filters',()=>{
  const state={sources:[],taskFilters:{from:'2026-10-26',to:'2026-10-26',q:'missing',status:''},batches:{items:[],total:0,metrics:{total:8,running:2,attention:3,queued:1,paused:1}}};
  const $=load(renderTasks({...state,taskView:'history'},()=>true));
  const overview=$('[aria-label="日期范围内任务概览"]');
  assert.equal(overview.find('button').length,4);
  assert.match(overview.text(),/8/);assert.match(overview.text(),/3/);
  assert.equal($('[data-task-status="attention"]').length,1);
  assert.match($('body').text(),/没有符合条件的/);
});

test('任务结果区分累计和本任务，显示零与未知并保留统计口径',async()=>{
 const {renderTaskResults}=await import('../web/tasks.js');
 const result={saved_versions:114,extraction_completed:104,no_event:23,extraction_recoverable:3,extraction_review:7,extraction_pending:0,facts:1078,full_processing_versions:1,full_processing_candidates:2,events:1,updated_at:'2026-10-27T01:00:00Z'};
 let $=load(renderTaskResults(result));assert.equal($('dt').length,7);assert.match($('body').text(),/1,078 条/);assert.match($('body').text(),/104 份，其中 23 份未发现事件/);assert.match($('body').text(),/不随下方执行记录筛选变化/);
 $=load(renderTaskResults(result,true));assert.match($('body').text(),/本任务关联结果/);assert.match($('body').text(),/不等于本次新增数量/);
 $=load(renderTaskResults({error:true}));assert.match($('body').text(),/读取失败/);assert.doesNotMatch($('body').text(),/0 份/);
 $=load(renderTaskResults({...result,facts:null}));assert.match($('body').text(),/— 条/);
});

test('批次列表一行一批次，详情一行一份实际资料并保留未发现资料的信源原因',()=>{
 const task={id:'round-123',trigger:'manual',scheduled_at:'2026-10-27T00:00:00Z',status:'partial',completed_sources:1,error_sources:1,sources:[{source_key:'a',name:'来源甲',operation_id:'op-a',status:'partial',saved_count:1,children:[{id:'material-a',url:'https://example.test/a?<正文>',version_id:'v',status:'completed',stage:'saved'},{id:'material-b',url:'https://example.test/b',status:'recoverable',reason_code:'FETCH_FAILED',stage:'source'}]},{source_key:'b',name:'来源乙',operation_id:null,status:'blocked',reason_code:'SOURCE_DISABLED',children:[]}],saved_count:1};
 const state={sources:[],taskFilters:{from:'2026-10-27',to:'2026-10-27',q:'',status:''},batches:{items:[task],metrics:{}},taskDetail:task,batchResults:{batch_id:task.id,saved_versions:1,facts:3,events:0}};
 let $=load(renderTasks({...state,taskView:'history'},()=>true));assert.equal($('.run-table tbody tr').length,1);assert.match($('h2').text(),/信息采集任务/);assert.match($('.run-list h3').text(),/任务批次记录/);assert.doesNotMatch($('.run-table').text(),/来源甲|来源乙|查看资料/);assert.equal($('[data-batch-detail]').text(),'查看批次详情');assert.equal($('#batch-detail').length,0);
 $=load(renderTaskDetail(state,()=>true));assert.equal($('#batch-detail-title').text(),'任务批次详情');assert.equal($('[data-collection-record]').length,2);assert.equal($('[data-task-source]').length,1);assert.match($('#task-sources').text(),/任务实际采集记录/);assert.equal($('[data-operation="op-a"]').length,0);assert.equal($('[data-operation="material-a"]').length,1);assert.equal($('[data-operation="material-b"]').length,1);assert.match($('[data-collection-record="material-a"]').text(),/https:\/\/example.test\/a\?<正文>/);assert.equal($('.collection-record-table 正文').length,0);assert.equal($('.task-result-counts dd').length,7);assert.equal($('[data-action="return-tasks"]').text(),'返回任务批次记录');assert.equal($('.steps,.collection-record-progress').length,0);assert.equal($('.collection-record-table th').last().text(),'操作');assert.doesNotMatch($('.collection-record-table').text(),/处理进度|操作与进度/);
 state.detailAttention=true;$=load(renderTaskDetail(state,()=>true));assert.equal($('[data-collection-record]').length,1);assert.equal($('[data-collection-record="material-b"]').length,1);assert.equal($('[data-task-source]').length,1);assert.match($('#task-sources').text(),/来源乙/);assert.equal($('[data-action="toggle-source-attention"]').text(),'显示全部记录');
});

test('零资料批次不创建伪采集行，区分未发现资料和发现失败',()=>{
 const task={id:'round',status:'partial',sources:[{source_key:'empty',name:'空结果来源',status:'completed',children:[]},{source_key:'failed',name:'失败来源',status:'failed',reason_code:'FETCH_FAILED',children:[]}]};
 const $=load(renderTaskDetail({taskDetail:task},()=>false));assert.equal($('[data-collection-record]').length,0);assert.equal($('[data-operation]').length,0);assert.equal($('[data-task-source]').length,2);assert.match($('[data-task-source="empty"]').text(),/本次未发现资料/);assert.doesNotMatch($('[data-task-source="failed"]').text(),/本次未发现资料/);assert.equal($('.collection-source-notes[open]').length,1);
});

test('默认执行概览一源一行，分开显示计划暂停、执行状态、空结果与异常',()=>{
 const items=[{catalog_key:'a',name:'来源甲',enabled:false,source_state:'ACTIVE',interval_seconds:3600,status:'running',current:{id:'current',scheduled_at:'2026-10-27T01:00:00Z'},latest:{id:'latest',status:'completed',material_count:0,saved_count:0,scheduled_at:'2026-10-27T00:00:00Z'}},{catalog_key:'b',name:'来源乙',enabled:true,source_state:'ACTIVE',interval_seconds:3600,status:'recoverable',latest:{id:'failed',status:'recoverable',reason_code:'FETCH_FAILED',scheduled_at:'2026-10-27T00:00:00Z'}}];
 const state={overview:{items,updated_at:'2026-10-27T01:00:00Z'},overviewFilters:{q:'',status:''}};
 let $=load(renderTasks(state,()=>true));assert.equal($('.run-list').length,0);assert.equal($('.task-views a[aria-current]').text(),'执行概览');assert.equal($('[data-overview-source]').length,2);assert.match($('[data-overview-source="a"]').text(),/计划已暂停/);assert.match($('[data-overview-source="a"]').text(),/运行中/);assert.match($('[data-overview-source="a"]').text(),/未发现资料/);assert.equal($('[data-batch-detail="current"]').text(),'查看当前批次');assert.equal($('[data-batch-detail="failed"]').text(),'查看异常批次');
 state.overviewFilters.status='attention';$=load(renderExecutionOverview(state));assert.equal($('[data-overview-source]').length,1);assert.match($('.overview-list').text(),/来源乙/);
 $=load(renderExecutionOverview({overview:{error:true}}));assert.equal($('[role="alert"]').length,1);assert.doesNotMatch($('body').text(),/尚未配置独立采集计划/);
 $=load(renderExecutionOverview({overview:{items:[]}}));assert.match($('body').text(),/尚未配置独立采集计划/);
});

test('手动任务独立承载开启与进度入口，概览和普通历史不提供开启',async()=>{
 const {workspaceRoute,taskView}=await import('../web/navigation.js');
 assert.equal(workspaceRoute('#manual-tasks'),'manual');assert.equal(taskView('#manual-tasks'),'manual');
 const state={sources:[],taskFilters:{from:'',to:'',q:'',status:''},batches:{items:[],metrics:{}},activity:{items:[]}};
 for(const view of ['overview','history']){const $=load(renderTasks({...state,taskView:view},()=>true));assert.equal($('[data-action="start-batch"]').length,0);assert.equal($('#manual-activity-slot').length,0);}
 let $=load(renderTasks({...state,taskView:'manual'},()=>true));assert.equal($('h2').text(),'手动采集任务');assert.equal($('[data-action="start-batch"]').length,1);assert.equal($('#manual-activity-slot').length,1);assert.match($('#manual-activity-slot').text(),/尚无手动采集任务/);assert.equal($('.task-views').length,0);assert.match($('.run-list h3').text(),/手动批次记录/);
 $=load(renderTasks({...state,batches:null,taskView:'manual'},()=>true));assert.match($('[role="status"]').text(),/正在读取手动批次记录/);assert.equal($('#task-query').length,0);
 $=load(renderTasks({...state,taskView:'manual'},()=>false));assert.equal($('[data-action="start-batch"]').length,0);
 $=load(renderTaskDetail({taskDetail:{id:'task',status:'completed',sources:[]},taskReturnView:'manual'},()=>true));assert.equal($('[data-action="return-tasks"]').text(),'返回手动任务');
});

test('任务详情未启动及读取失败均不伪装为空结果',()=>{
 const task={id:'slot',status:'blocked',unstarted:true,sources:[{source_key:'a',name:'待启动来源',status:'blocked',children:[]}]};
 let $=load(renderTaskDetail({taskDetail:task},()=>true));assert.match($('body').text(),/尚未开始采集/);assert.equal($('.task-result-counts').length,0);
 $=load(renderTaskDetail({taskDetail:{id:'missing',error:{code:'NOT_FOUND'}}},()=>true));assert.equal($('[role="alert"]').length,1);assert.equal($('[data-task-source]').length,0);
});

test('两工作区兼容旧计划链接，计划共用搜索且保留全部范围',async()=>{
 const {workspaceRoute,catalogMode}=await import('../web/navigation.js');
 assert.equal(workspaceRoute('#intake-task=153a896a-2a29-4904-bb2b-cd31371a8ee4'),'tasks');assert.equal(workspaceRoute('#schedules'),'sources');assert.equal(catalogMode('#schedules'),'automatic');assert.equal(catalogMode('#sources?mode=automatic'),'automatic');assert.equal(workspaceRoute('#intake-tasks'),'tasks');
 const state={catalogMode:'automatic',sources:[{catalog_key:'a',name:'来源甲',state:'ACTIVE'},{catalog_key:'b',name:'来源乙',state:'DISABLED'}],filters:{q:'乙'},planFilters:{view:'all'},monitor:{schedules:[{catalog_key:'a'}],alerts:[]}};
 const $=load(renderSchedules(state,()=>true));assert.equal($('tbody tr').length,1);assert.equal($('[data-schedule="b"]').length,1);assert.equal($('[data-plan-view]').length,3);assert.equal($('#source-search').length,1);assert.equal($('[data-schedule-history]').length,0);
});

test('目录压平连续待补充分组，单信源详情不提供全局启动',async()=>{
 const {renderSources}=await import('../web/sources.js');
 const sources=[{catalog_key:'a',name:'来源甲',state:'ACTIVE',profile:{dims:[],levels:[]}},{catalog_key:'b',name:'来源乙',state:'ACTIVE',profile:{dims:[],levels:[]}}];
 const state={sources,filters:{q:''},selected:'a',view:'research',detailTab:'technical',monitor:{schedules:[]}};
 const $=load(renderSources(state,()=>true));assert.equal($('.source-group').length,0);assert.equal($('.source-row').length,2);assert.equal($('[data-action="start-batch"]').length,0);assert.equal($('[data-schedule="a"]').length,1);assert.match($('.detail-tabs').text(),/接入设置.*关联资料/);
});

test('结束任务压缩为摘要且提供独立诊断，整轮详情保持统计',()=>{
 const task={id:'round',scheduled_at:'2026-10-27T00:00:00Z',status:'partial',sources:[{status:'blocked'}]};
 const $=load(renderActivity({items:[],latest_batch:task},true,()=>true));assert.equal($('progress').length,0);assert.equal($('.activity-ended').length,1);assert.equal($('[data-batch-errors]').length,1);
});

test('资料阅读在同一层区分正文、零候选与未知，保留文件和恢复',async()=>{
 const {renderReader}=await import('../web/reader.js');
 const reader={root:{id:'run-a'},children:[{version_id:'v',processing_id:'p'}],index:0,mode:'material',version:{material:{title:'真实标题',segments:[{text:'正文<&'}]},raw_url:'/raw'},processing:{id:'p',extraction_status:'completed',candidate_count:0,candidates:[],no_event_reason:'背景资料'}};
 let $=load(renderReader(reader,()=>true));assert.match($('.reader-content').text(),/真实标题.*正文<&/s);assert.equal($('[data-reader-tab]').length,2);assert.equal($('a[download]').length,1);assert.equal($('.steps,.progress-disclosure').length,0);assert.equal($('.run-identity summary').text(),'运行信息');assert.match($('.run-identity').text(),/run-a/);assert.doesNotMatch($('body').text(),/处理进度/);
 reader.mode='candidates';$=load(renderReader(reader,()=>true));assert.match($('.reader-content').text(),/未提取到事件候选/);
 reader.processing=null;$=load(renderReader(reader,()=>true));assert.match($('.reader-content').text(),/数量待确认/);assert.doesNotMatch($('.reader-content').text(),/0 条/);
});


test('导航已标明页面时移除重复标题说明，保留可访问名称与必要操作',()=>{
 const base={sources:[],taskFilters:{from:'',to:'',q:'',status:''},batches:{items:[],metrics:{}},activity:{items:[]},overview:{items:[]}};
 for(const view of ['overview','history','manual']){
  const $=load(renderTasks({...base,taskView:view},()=>true));assert.equal($('h2.sr-only').length,1);assert.equal($('.section-heading h2').length,0);assert.doesNotMatch($('body').text(),/查看信源当前执行情况，或从批次历史追溯|手动开启全部启用信源，在此查看进度/);assert.equal($('.workspace-actions').length,view==='manual'?1:0);assert.equal($('[data-action="start-batch"]').length,view==='manual'?1:0);
 }
 let $=load(renderTasks({...base,taskView:'manual'},()=>false));assert.equal($('.workspace-actions').length,0);
 $=load(renderSchedules({...base,catalogMode:'automatic',filters:{},monitor:{schedules:[]}},()=>true));assert.equal($('h2.sr-only').text(),'任务计划');assert.doesNotMatch($('body').text(),/集中管理信源的自动计划/);
});
