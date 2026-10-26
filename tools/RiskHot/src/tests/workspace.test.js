import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {renderTasks,renderSchedules} from '../web/tasks.js';

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
