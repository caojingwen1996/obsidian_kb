import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {renderTasks,renderSchedules} from '../web/tasks.js';
import {launchState,renderActivity} from '../web/activity.js';

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
  const state={sources:[{catalog_key:'a',name:'已有计划',state:'ACTIVE'},{catalog_key:'b',name:'待配置来源',state:'DISABLED'}],planFilters:{q:'',view:'configured'},monitor:{schedules:[{catalog_key:'a',enabled:true,interval_seconds:3600,next_run_at:'2026-10-27T00:00:00Z'}],alerts:[]}};
  let $=load(renderSchedules(state,()=>true));
  assert.equal($('[data-schedule="b"]').length,0);
  assert.equal($('[data-schedule-history="a"]').length,1);
  assert.match($('tbody').text(),/尚未执行/);
  state.planFilters.view='unconfigured';$=load(renderSchedules(state,()=>true));
  assert.equal($('[data-schedule="b"]').length,1);assert.equal($('[data-schedule="a"]').length,0);
  $=load(renderSchedules(state,()=>false));assert.equal($('[data-schedule]').length,0);
});

test('compact task overview keeps date metrics separate from filtered rows and exposes status filters',()=>{
  const state={sources:[],taskFilters:{from:'2026-10-26',to:'2026-10-26',q:'missing',status:''},batches:{items:[],total:0,metrics:{total:8,running:2,attention:3,queued:1,paused:1}}};
  const $=load(renderTasks(state,()=>true));
  const overview=$('[aria-label="日期范围内任务概览"]');
  assert.equal(overview.find('button').length,4);
  assert.match(overview.text(),/8/);assert.match(overview.text(),/3/);
  assert.equal($('[data-task-status="attention"]').length,1);
  assert.match($('body').text(),/没有符合条件的/);
});
