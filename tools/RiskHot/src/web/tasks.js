import {escape as e,badge,statusName,steps,progressOf,dateTime,countSaved,explain,formatPeriod} from './model.js';

function controls(task,can){
  if(!can('submit')||task.scope_complete===false||task.controllable===false||!['queued','running','paused','pending'].includes(task.status))return '';
  return `<button class="quiet" data-task-control="${task.status==='paused'?'resume':'pause'}" data-task-id="${e(task.id)}">${task.status==='paused'?'继续任务':'暂停任务'}</button>`;
}
function taskRow(task,state,can){
  const open=state.selectedBatch===task.id,sources=task.sources||[];
  return `<tr class="${open?'selected-row':''}">
    <td data-label="计划时间"><strong>${dateTime(task.scheduled_at)}</strong><small title="${e(task.id)}">${e(task.id.slice(0,8))}</small></td>
    <td data-label="范围">${sources.length} 个信源<small>${sources.filter(x=>x.status==='completed').length} 个完成${task.error_sources?` · ${task.error_sources} 个待处理`:''}</small></td>
    <td data-label="状态">${badge(task.status)}</td><td data-label="保存结果"><strong>${task.saved_count??'—'} 份资料</strong></td>
    <td data-label="操作"><div class="actions"><button class="link-button" data-batch-detail="${e(task.id)}" aria-expanded="${open}" aria-controls="batch-detail">${open?'收起结果':'查看结果'}</button>${controls(task,can)}</div></td>
  </tr>${open?`<tr class="run-detail-row"><td colspan="5">${renderBatchDetail(task,state)}</td></tr>`:''}`;
}
export function renderTasks(state,can){
  const data=state.batches||{items:[],metrics:{}},metrics=data.metrics||{},query=state.taskFilters;
  const choices=[['','全部','total'],['running','运行中','running'],['attention','需处理','attention'],['queued','待执行','queued']];
  return `<section class="run-workspace"><div class="section-heading"><div><h2>信息接入任务</h2><p>每次执行的状态、资料与抽取结果。</p></div>${can('submit')?'<button class="primary" data-action="start-batch">开启任务</button>':''}</div>
    <section class="panel run-tools"><div class="run-summary" aria-label="日期范围内任务概览">${choices.map(([status,label,key])=>`<button data-task-status="${status}" aria-pressed="${query.status===status}"><span>${label}</span><strong>${metrics[key]??'—'}</strong></button>`).join('')}</div>
      <form id="task-query" class="task-query run-query">
        <label>开始日期<input id="task-from" name="from" type="date" value="${e(query.from)}" required></label>
        <label>结束日期<input id="task-to" name="to" type="date" value="${e(query.to)}" required></label>
        <label>任务编号<input id="task-search" name="q" type="search" placeholder="搜索编号" value="${e(query.q)}"></label>
        <label>状态<select id="task-status" name="status">${[['','全部状态'],['attention','需处理'],['running','运行中'],['queued','待执行'],['paused','已暂停'],['completed','已完成'],['partial','部分完成'],['recoverable','待恢复'],['review','待复核'],['waiting_config','待配置']].map(([key,name])=>`<option value="${key}" ${query.status===key?'selected':''}>${name}</option>`).join('')}</select></label>
        <button class="secondary">查询</button><button class="quiet" type="button" data-action="clear-tasks">重置</button>
      </form></section>
    <section class="panel run-list"><div class="table-heading"><h3>执行记录 <span class="muted">${data.total??data.items.length}</span></h3><span class="muted">上海时间 · 最新在前${metrics.paused?` · 已暂停 ${metrics.paused}`:''}</span></div>
      ${data.items.length?`<div class="table-wrap"><table class="task-table run-table"><thead><tr><th>计划时间</th><th>执行范围</th><th>状态</th><th>保存结果</th><th>操作</th></tr></thead><tbody>${data.items.map(task=>taskRow(task,state,can)).join('')}</tbody></table></div>`:'<div class="empty"><h3>没有符合条件的执行记录</h3><p>调整日期或筛选条件，也可以开启一次任务。</p><button class="secondary" data-action="clear-tasks">重置筛选</button></div>'}
      ${data.limit&&data.total>data.limit?`<p class="list-note">显示最近 ${data.limit} 条，请缩小日期范围查看更多记录。</p>`:''}
    </section><p class="workspace-footnote">概览按所选日期统计。开启任务将运行全部已启用信源。</p></section>`;
}
function renderBatchDetail(task,state){
  return `<section id="batch-detail" data-batch-id="${e(task.id)}" class="run-detail"><div class="run-detail-heading"><h3 id="batch-detail-title" tabindex="-1">信源执行结果</h3><button class="quiet" data-action="close-batch">收起</button></div>
    ${(task.sources||[]).map(item=>{
      const source=state.sources.find(x=>x.catalog_key===item.source_key),children=item.children||[];
      return `<details class="source-result" data-result-source="${e(item.source_key)}"><summary><strong>${e(source?.name||item.name||item.source_key)}</strong>${badge(item.status)}<span class="muted">已保存 ${item.saved_count??countSaved(item)} 份</span></summary><div class="source-result-body">
        ${item.reason_code?`<p class="run-reason">${e(explain(item.reason_code))}</p>`:''}
        ${children.some(child=>child.version_id)?`<div class="saved-materials">${children.filter(child=>child.version_id).map((child,i)=>`<div class="material-result"><span>资料 ${i+1}<small class="muted material-handoff-status">已保存 · ${child.delivery_error?'交付待恢复':child.processing_id?'F02 已接收':'待交付 F02'}</small></span><div class="actions"><button class="link-button" data-delivery="${e(child.version_id)}">交付状态与文件</button><button class="link-button" data-version="${e(child.version_id)}">查看资料</button>${child.processing_id?`<button class="link-button" data-processing="${e(child.processing_id)}">抽取结果</button>`:'<span class="muted">尚未交付抽取</span>'}</div></div>`).join('')}</div>`:`<p class="muted">${item.operation_id?'尚无已确认保存的资料。':'本次未进入采集。'}</p>`}
        <details class="progress-disclosure"><summary>处理进度</summary>${renderProgress(item)}</details>
        ${item.operation_id?`<button class="quiet" data-operation="${e(item.operation_id)}">执行记录与恢复</button>`:''}
      </div></details>`;
    }).join('')}<details class="run-identity"><summary>任务信息</summary><p class="text-wrap">${e(task.id)}</p><p>${dateTime(task.scheduled_at)} · ${e(statusName(task.status))}</p></details></section>`;
}
export function renderProgress(operation){
  const progress=progressOf(operation);
  return `<ol class="steps" aria-label="F01 六步进度">${steps.map((name,i)=>`<li class="${i<progress.completed?'step-done':i+1===progress.current?'step-current':''}"><span class="step-number">${i+1}</span><div><strong>${name}</strong><small>${i<progress.completed?'已完成':i+1===progress.current?statusName(operation.status):'未开始'}</small></div></li>`).join('')}</ol>`;
}
function planHistory(source,state){
  const history=state.planHistory;if(history?.key!==source.catalog_key)return '';
  return `<tr class="plan-history-row"><td colspan="5"><section class="plan-history" id="schedule-history-${e(source.catalog_key)}"><h3 tabindex="-1">${e(source.name)} · 运行记录</h3>
    ${history.loading?'<p class="loading" role="status">正在读取运行记录…</p>':history.error?`<p class="run-reason" role="alert">${e(explain(history.error))}</p><button class="secondary" data-reload-history="${e(source.catalog_key)}">重新读取</button>`:history.data?.items.length?`<div class="history-rows">${history.data.items.map(row=>`<div class="plan-run"><span>${dateTime(row.scheduled_at)}</span>${badge(row.status)}<span class="muted">已保存 ${row.saved_count??'—'} 份</span>${row.operation_id?`<button class="link-button" data-operation="${e(row.operation_id)}">查看结果</button>`:'<span class="muted">尚未开始采集</span>'}${row.error_code?`<p class="run-reason">${e(explain(row.error_code))}</p>`:''}</div>`).join('')}</div><p class="workspace-footnote">最近 ${history.data.limit} 条计划运行记录。</p>`:'<p class="empty">该计划尚无执行记录。</p>'}
  </section></td></tr>`;
}
export function renderSchedules(state,can){
  const schedules=state.monitor?.schedules||[],filters=state.planFilters||{q:'',view:'configured'},plans=new Map(schedules.map(plan=>[plan.catalog_key,plan]));
  const configured=state.sources.filter(source=>plans.has(source.catalog_key)),unconfigured=state.sources.filter(source=>!plans.has(source.catalog_key));
  const rows=(filters.view==='unconfigured'?unconfigured:configured).filter(source=>[source.name,source.catalog_key].join(' ').toLowerCase().includes(filters.q.toLowerCase()));
  return `<section class="plan-workspace"><div class="section-heading"><div><h2>任务计划</h2><p>管理自动接入周期，查看每次运行的结果。</p></div></div>
    <section class="panel plan-list"><div class="plan-toolbar"><div class="plan-views" aria-label="计划范围"><button data-plan-view="configured" aria-pressed="${filters.view!=='unconfigured'}">已配置 <span>${configured.length}</span></button><button data-plan-view="unconfigured" aria-pressed="${filters.view==='unconfigured'}">未配置 <span>${unconfigured.length}</span></button></div><form id="plan-search" role="search"><label class="sr-only" for="plan-query">搜索计划信源</label><input id="plan-query" name="q" type="search" value="${e(filters.q)}" placeholder="搜索信源名称或编号"><button class="quiet">搜索</button></form></div>
    ${rows.length?`<div class="table-wrap"><table class="task-table plan-table"><thead><tr><th>信源</th><th>计划状态</th><th>执行周期 / 下次触发</th><th>最近运行</th><th>管理</th></tr></thead><tbody>${rows.map(source=>{
      const plan=plans.get(source.catalog_key),open=state.planHistory?.key===source.catalog_key;
      return `<tr><td data-label="信源"><strong>${e(source.name)}</strong>${source.state!=='ACTIVE'?'<small class="muted">信源已停用</small>':''}</td>
        <td data-label="计划状态">${plan?badge(plan.enabled?'ACTIVE':'paused'):'<span class="muted">尚未配置</span>'}</td>
        <td data-label="周期 / 下次触发">${plan?`${formatPeriod(plan.interval_seconds)}<small>${plan.enabled?dateTime(plan.next_run_at):'计划已暂停'}</small>`:'—'}</td>
        <td data-label="最近运行">${plan?.latest_run_id?`${badge(plan.latest_status)}<small>${dateTime(plan.latest_scheduled_at)}</small>${plan.operation_id?`<button class="link-button" data-operation="${e(plan.operation_id)}">查看结果</button>`:''}`:'<span class="muted">尚未执行</span>'}${plan?.latest_error?`<small class="run-reason">${e(explain(plan.latest_error))}</small>`:''}</td>
        <td data-label="管理"><div class="actions">${plan?`<button class="quiet" data-schedule-history="${e(source.catalog_key)}" aria-expanded="${open}" aria-controls="schedule-history-${e(source.catalog_key)}">${open?'收起记录':'运行记录'}</button>`:''}${can('submit',source.catalog_key)?`<button class="quiet" data-schedule="${e(source.catalog_key)}">${plan?'管理计划':'配置计划'}</button>`:''}</div></td>
      </tr>${planHistory(source,state)}`;
    }).join('')}</tbody></table></div>`:`<div class="empty"><h3>${filters.q?'没有匹配的信源':filters.view==='unconfigured'?'所有信源均已配置计划':'暂无已配置计划'}</h3><p>${filters.view==='unconfigured'?'为需要自动接入的信源配置周期。':'可切换到未配置，为信源添加计划。'}</p></div>`}
    </section>${state.monitor?.alerts?.length?`<details class="workspace-alerts"><summary>${state.monitor.alerts.length} 项系统异常待处理</summary>${state.monitor.alerts.map(row=>`<div class="history-item"><strong>${e(explain(row.code))}</strong><small>${dateTime(row.opened_at)}</small></div>`).join('')}</details>`:''}
    <p class="workspace-footnote">暂停计划影响后续自动接入，已启动的任务在接入任务中管理。</p></section>`;
}
