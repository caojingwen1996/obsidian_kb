import {renderCatalogToolbar} from './sources.js';
import {escape as e,badge,statusName,dateTime,explain,formatPeriod,profileOf} from './model.js';

export function renderTaskResults(result,batch=false){
 const title=batch?'本任务关联结果':'累计处理结果';
 if(!result||result.error)return `<section class="task-results${batch?'':' panel'}" aria-label="${title}"><h3>${title}</h3><p class="muted">${result?.error?'结果统计读取失败，请点击页面“刷新状态”重试。':'正在读取结果统计…'}</p></section>`;
 const n=key=>Number.isSafeInteger(result[key])?result[key].toLocaleString('zh-CN'):'—';
 const rows=[['已接入并保存的资料',`${n('saved_versions')} 份`],['已完成候选抽取',`${n('extraction_completed')} 份，其中 ${n('no_event')} 份未发现事件`],['待恢复 / 待复核抽取',`${n('extraction_recoverable')} 份 / ${n('extraction_review')} 份`],['尚未完成抽取',`${n('extraction_pending')} 份`],['已保存候选事实 Fact',`${n('facts')} 条`],['进入完整事件处理',`${n('full_processing_versions')} 份资料，包含 ${n('full_processing_candidates')} 个候选`],['已确认的正式事件 Event',`${n('events')} 条`]];
 return `<section class="task-results${batch?'':' panel'}" aria-label="${title}"><div class="section-heading"><h3>${title}</h3><span class="muted">更新于 ${e(dateTime(result.updated_at))}</span></div><p class="muted">${batch?'本任务保存或复用资料的当前处理结果，不等于本次新增数量。':'全部可见信源的累计结果，不随下方执行记录筛选变化。'}</p><dl class="task-result-counts">${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl><details class="task-result-rules" data-results-scope="${batch?'batch':'all'}"><summary>统计口径与数据来源</summary><p>来自已保存资料、候选抽取记录、Fact 及正式事件关联。资料按版本去重；每份资料取最新一次抽取和完整事件处理记录。Fact 与正式事件按各自标识去重，同一结果被多个任务复用时，不能累加各任务数量。仅统计当前账号可访问的数据。</p><p>“未发现事件”仅包含已成功完成且候选为零的抽取。尚未完成包括未交付、排队及处理中；Fact 不代表已确认的正式事件。</p></details></section>`;
}

function controls(task,can){
  if(!can('submit')||task.scope_complete===false||task.controllable===false||!['queued','running','paused','pending'].includes(task.status))return '';
  return `<button class="quiet" data-task-control="${task.status==='paused'?'resume':'pause'}" data-task-id="${e(task.id)}">${task.status==='paused'?'继续任务':'暂停任务'}</button>`;
}
function taskRow(task,state,can){
  const sources=task.sources||[];
  return `<tr><td data-label="计划时间"><strong>${dateTime(task.scheduled_at)}</strong><small title="${e(task.id)}">${e(task.id.slice(0,8))}</small></td>
    <td data-label="任务范围">${sources.length} 个信源<small>${({manual:'手动任务',automatic:'自动计划',direct:'单次采集'})[task.trigger]||'信息采集任务'} · ${task.completed_sources??sources.filter(x=>x.status==='completed').length} 个完成${task.error_sources?` · ${task.error_sources} 个待处理`:''}</small></td>
    <td data-label="状态">${badge(task.status)}</td><td data-label="保存结果"><strong>${task.unstarted?'尚未开始采集':`${task.saved_count??'—'} 份资料`}</strong></td>
    <td data-label="操作"><div class="actions"><button class="link-button" data-batch-detail="${e(task.id)}">查看批次详情</button>${controls(task,can)}</div></td></tr>`;
}
export function renderExecutionOverview(state){
 const data=state.overview,query=state.overviewFilters||{q:'',status:''};
 if(!data||data.error)return `<section class="panel empty" role="${data?.error?'alert':'status'}"><h3>${data?.error?'执行概览读取失败':'正在读取执行概览…'}</h3><p>${data?.error?'请刷新重试，历史批次仍可独立查看。':'正在核对各信源计划的当前执行与最近结果。'}</p>${data?.error?'<button class="secondary" data-action="refresh">重新读取概览</button>':''}</section>`;
 const attention=new Set(['partial','failed','blocked','review','recoverable','waiting_config']),running=new Set(['running','queued','pending']);
 const matching=row=>!query.status||(query.status==='running'?running.has(row.status):query.status==='attention'?attention.has(row.status):row.status===query.status);
 const searched=data.items.filter(row=>[row.name,row.catalog_key].join(' ').toLowerCase().includes(query.q.toLowerCase()));
 const rows=searched.filter(matching);
 const labels=[['','全部'],['running','执行中'],['attention','需处理'],['idle','空闲'],['never','未执行']];
 return `<section class="panel run-tools"><div class="run-summary" aria-label="信源执行概览筛选">${labels.map(([key,label])=>`<button data-overview-status="${key}" aria-pressed="${query.status===key}"><span>${label}</span><strong>${searched.filter(row=>!key||(key==='running'?running.has(row.status):key==='attention'?attention.has(row.status):row.status===key)).length}</strong></button>`).join('')}</div><form id="overview-query" class="overview-query"><label for="overview-search">信源<input id="overview-search" name="q" type="search" placeholder="搜索信源名称或编号" value="${e(query.q)}"></label><button class="secondary">查询</button><button class="quiet" type="button" data-action="clear-overview">重置</button></form></section>
 <section class="panel overview-list"><div class="table-heading"><h3 tabindex="-1">执行概览 <span class="muted">${rows.length} 个信源</span></h3><span class="muted">更新于 ${e(dateTime(data.updated_at))}</span></div>
 ${rows.length?`<div class="table-wrap"><table class="task-table overview-table"><thead><tr><th scope="col">信源 / 计划</th><th scope="col">当前执行</th><th scope="col">最近结果</th><th scope="col">下次执行</th><th scope="col">操作</th></tr></thead><tbody>${rows.map(row=>{
   const latest=row.latest,target=row.current||latest;
   const result=!latest?'尚未执行':latest.status==='completed'?(latest.material_count===0?'未发现资料':`已保存或复用 ${latest.saved_count} 份资料`):latest.reason_code?explain(latest.reason_code):statusName(latest.status);
   return `<tr data-overview-source="${e(row.catalog_key)}"><td data-label="信源 / 计划"><strong>${e(row.name)}</strong><small>${row.enabled?'计划已启用':'计划已暂停'} · 每 ${e(formatPeriod(row.interval_seconds))}${row.source_state!=='ACTIVE'?' · 信源已停用':''}</small></td><td data-label="当前执行">${row.current?badge(row.status):`<span class="status status-${e(row.status)}">${row.status==='idle'?'空闲':row.status==='never'?'尚未执行':e(statusName(row.status))}</span>`}${row.current?`<small>触发于 ${e(dateTime(row.current.scheduled_at))}</small>`:''}</td><td data-label="最近结果">${latest?badge(latest.status):''}<p class="overview-result">${e(result)}</p>${latest?`<small>${latest.finished_at?'结果更新于':'触发于'} ${e(dateTime(latest.finished_at||latest.scheduled_at))}</small>`:''}</td><td data-label="下次执行">${row.source_state!=='ACTIVE'?'信源已停用':!row.enabled?'计划已暂停':e(dateTime(row.next_run_at))}</td><td data-label="操作"><div class="actions">${target?`<button class="link-button" data-batch-detail="${e(target.id)}">${row.current?'查看当前批次':attention.has(row.status)?'查看异常批次':'查看最近批次'}</button>`:''}<button class="quiet" data-source-runs="${e(row.catalog_key)}">批次历史</button></div></td></tr>`;
 }).join('')}</tbody></table></div>`:`<div class="empty"><h3>${data.items.length?'没有符合条件的信源':'尚未配置独立采集计划'}</h3><p>${data.items.length?'调整搜索或状态筛选。':'在信源目录的任务计划中配置执行周期。'}</p>${data.items.length?'<button class="secondary" data-action="clear-overview">重置筛选</button>':'<a href="#sources?mode=automatic">配置任务计划</a>'}</div>`}</section><p class="workspace-footnote">每个已配置计划的信源一行，包含手动与自动执行。计划启停与当前执行分开显示；历史批次筛选不影响此概览。</p>`;
}
export function renderTasks(state,can){
  const data=state.batches||{items:[],metrics:{}},metrics=data.metrics||{},query=state.taskFilters;
  const manual=state.taskView==='manual';
  const choices=[['','全部','total'],['running','运行中','running'],['attention','需处理','attention'],['queued','待执行','queued']];
  const header=`<h2 class="sr-only">${manual?'手动采集任务':'信息采集任务'}</h2>${manual&&can('submit')?'<div class="workspace-actions"><div class="launch-actions"><span class="muted">全部已启用信源</span><button class="primary" data-action="start-batch">开启任务</button></div></div>':''}${manual?`<div id="manual-activity-slot">${!state.activity?'<p class="loading" role="status">正在读取手动任务状态…</p>':!state.activity.items?.length&&!state.activity.latest_batch?'<p class="empty panel">尚无手动采集任务。开启后可在此查看进度。</p>':''}</div>`:`<nav class="task-views" aria-label="任务视图"><a href="#intake-tasks" ${state.taskView!=='history'?'aria-current="page"':''}>执行概览</a><a href="#intake-tasks?view=history" ${state.taskView==='history'?'aria-current="page"':''}>批次记录</a></nav>`}`;
  if(manual&&!state.batches)return `<section class="run-workspace">${header}<p class="loading panel" role="status">正在读取手动批次记录…</p></section>`;
  if(!manual&&state.taskView!=='history')return `<section class="run-workspace">${header}${renderExecutionOverview(state)}</section>`;
  return `<section class="run-workspace">${header}
    <section class="panel run-tools"><div class="run-summary" aria-label="日期范围内任务概览">${choices.map(([status,label,key])=>`<button data-task-status="${status}" aria-pressed="${query.status===status}"><span>${label}</span><strong>${metrics[key]??'—'}</strong></button>`).join('')}</div>
      <form id="task-query" class="task-query run-query">
        <label>开始日期<input id="task-from" name="from" type="date" value="${e(query.from)}"></label>
        <label>结束日期<input id="task-to" name="to" type="date" value="${e(query.to)}"></label>
        <label>信源<select name="source" id="task-source"><option value="">全部信源</option>${state.sources.map(source=>`<option value="${e(source.catalog_key)}" ${query.source===source.catalog_key?'selected':''}>${e(source.name)}</option>`).join('')}</select></label>
        <label>批次编号<input id="task-search" name="q" type="search" placeholder="搜索编号" value="${e(query.q)}"></label>
        <label>状态<select id="task-status" name="status">${[['','全部状态'],['attention','需处理'],['running','运行中'],['queued','待执行'],['paused','已暂停'],['completed','已完成'],['partial','部分完成'],['recoverable','待恢复'],['review','待复核'],['waiting_config','待配置']].map(([key,name])=>`<option value="${key}" ${query.status===key?'selected':''}>${name}</option>`).join('')}</select></label>
        <button class="secondary">查询</button><button class="quiet" type="button" data-action="clear-tasks">重置</button>
      </form></section>
    <section class="panel run-list"><div class="table-heading"><h3 tabindex="-1">${manual?'手动批次记录':'任务批次记录'} <span class="muted">${data.total??data.items.length}</span></h3><span class="muted">上海时间 · 最新在前${metrics.paused?` · 已暂停 ${metrics.paused}`:''}</span></div>
      ${data.items.length?`<div class="table-wrap"><table class="task-table run-table"><thead><tr><th>计划时间</th><th>批次范围</th><th>状态</th><th>保存结果</th><th>操作</th></tr></thead><tbody>${data.items.map(task=>taskRow(task,state,can)).join('')}</tbody></table></div>`:'<div class="empty"><h3>没有符合条件的任务批次记录</h3><p>调整日期或筛选条件，也可以开启一次任务。</p><button class="secondary" data-action="clear-tasks">重置筛选</button></div>'}
      ${data.limit&&data.total>data.limit?`<p class="list-note">显示最近 ${data.limit} 条，请缩小日期范围查看更多记录。</p>`:''}
    </section><details class="cumulative-results panel" ${state.cumulativeOpen?'open':''}><summary>累计处理结果 <span class="muted">全部可见信源 · 展开查看七项统计</span></summary>${renderTaskResults(state.results)}</details><p class="workspace-footnote">概览按${query.from?'所选日期':'全部日期'}及信源范围统计。开启任务将运行全部已启用信源。</p></section>`;
}
export function renderTaskDetail(state,can){
  const task=state.taskDetail;
  const back=`<button class="quiet" data-action="return-tasks">${state.taskReturnView==='manual'?'返回手动任务':state.taskReturnView==='overview'?'返回执行概览':'返回任务批次记录'}</button>`;
  if(!task)return `<section class="run-workspace">${back}<h2 id="batch-detail-title" tabindex="-1">任务批次详情</h2><p class="loading" role="status">正在读取批次与实际采集记录…</p></section>`;
  if(task.error)return `<section class="run-workspace">${back}<h2 id="batch-detail-title" tabindex="-1">任务批次详情</h2><p class="feedback feedback-error" role="alert">${e(explain(task.error))}</p><button class="secondary" data-action="refresh">重新读取批次</button></section>`;
  const sources=task.sources||[],needsAttention=row=>['partial','failed','blocked','review','recoverable','waiting_config'].includes(row.status)||Boolean(row.reason_code);
  const records=sources.flatMap(source=>(source.children||[]).map(child=>({source,child})));
  const visible=state.detailAttention?records.filter(({child})=>needsAttention(child)):records;
  const notes=sources.filter(source=>!source.children?.length||source.reason_code).filter(source=>!state.detailAttention||needsAttention(source));
  return `<section id="batch-detail" data-batch-id="${e(task.id)}" class="run-workspace collection-task-detail">${back}
    <div class="run-detail-heading"><div><h2 id="batch-detail-title" tabindex="-1">任务批次详情</h2><p class="muted">${e(dateTime(task.scheduled_at))} · ${e(task.id)}</p></div><div class="actions">${badge(task.status)}${controls(task,can)}</div></div>
    <p class="task-scope-summary">${({manual:'手动任务',automatic:'自动计划',direct:'单次采集'})[task.trigger]||'信息采集任务'} · ${sources.length} 个信源 · ${task.completed_sources??0} 个完成${task.error_sources?` · ${task.error_sources} 个待处理`:''} · ${task.unstarted?'尚未开始采集':`已保存 ${task.saved_count??'—'} 份资料`}</p>
    ${task.unstarted?'<p class="notice">本次计划尚未创建采集执行，保留触发状态和原因。</p>':renderTaskResults(state.batchResults?.batch_id===task.id?state.batchResults:null,true)}
    <section id="task-sources" aria-labelledby="task-sources-title"><div class="section-heading"><div><h3 id="task-sources-title" tabindex="-1">任务实际采集记录 <span class="muted">${visible.length}${state.detailAttention?` / ${records.length}`:''}</span></h3><p>一行一份资料；记录包含已保存、处理中及失败的采集。</p></div><button class="quiet" data-action="toggle-source-attention" aria-pressed="${Boolean(state.detailAttention)}">${state.detailAttention?'显示全部记录':'仅看需处理'}</button></div>
      ${visible.length?`<div class="panel table-wrap"><table class="task-table collection-record-table"><thead><tr><th scope="col">资料入口 / 采集时间</th><th scope="col">信源</th><th scope="col">状态</th><th scope="col">保存结果</th><th scope="col">操作</th></tr></thead><tbody>${visible.map(({source,child})=>`<tr data-collection-record="${e(child.id)}"><td data-label="资料入口 / 采集时间"><p class="collection-record-url">${e(child.url||'上传文件或结构化资料')}</p><small>${e(dateTime(child.created_at))}</small><small title="${e(child.id)}">${e(child.id)}</small></td><td data-label="信源">${e(source.name)}</td><td data-label="状态">${badge(child.paused?'paused':child.status)}${child.reason_code?`<p class="run-reason">${e(explain(child.reason_code))}</p>`:''}</td><td data-label="保存结果">${child.version_id?'已保存或复用资料版本':'尚未保存'}</td><td data-label="操作"><div class="actions"><button class="link-button" data-operation="${e(child.id)}">查看采集详情</button>${child.version_id?`<button class="quiet" data-version="${e(child.version_id)}">查看资料正文</button>`:''}${child.processing_id?`<button class="quiet" data-processing="${e(child.processing_id)}">查看候选抽取</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:`<p class="empty panel">${state.detailAttention?'没有需处理的资料采集记录。':'本批次尚无资料采集记录，信源发现状态见下方。'}</p>`}
      ${notes.length?`<details class="collection-source-notes" data-source-detail="source-notes" ${!records.length?'open':''}><summary>信源发现状态与异常 <span class="muted">${notes.length}</span></summary>${notes.map(source=>`<div class="history-item" data-task-source="${e(source.source_key)}"><strong>${e(source.name)}</strong>${badge(source.status)}<p class="muted">${source.reason_code?e(explain(source.reason_code)):source.status==='completed'?'本次未发现资料。':'尚未生成资料采集记录。'}</p></div>`).join('')}</details>`:''}
    </section></section>`;
}
export function renderSchedules(state,can){
  if(state.monitor?.error)return `${renderCatalogToolbar(state)}<section class="empty panel"><h2>自动计划读取失败</h2><p>已保留信源目录，可刷新重试。</p><button class="secondary" data-action="refresh">重新读取</button></section>`;
  const schedules=state.monitor?.schedules||[],filters=state.planFilters||{view:'all'},plans=new Map(schedules.map(plan=>[plan.catalog_key,plan]));
  const configured=state.sources.filter(source=>plans.has(source.catalog_key)),unconfigured=state.sources.filter(source=>!plans.has(source.catalog_key));
  const keyword=String(state.filters?.q||'').toLowerCase();
  const rows=(filters.view==='unconfigured'?unconfigured:filters.view==='configured'?configured:state.sources).filter(source=>[source.name,source.catalog_key,profileOf(source).publisher].join(' ').toLowerCase().includes(keyword));
  return `${renderCatalogToolbar(state)}<section class="plan-workspace"><h2 class="sr-only">任务计划</h2>
    <section class="panel plan-list"><div class="plan-toolbar"><div class="plan-views" aria-label="计划范围">${[['all','全部',state.sources.length],['configured','已配置',configured.length],['unconfigured','未配置',unconfigured.length]].map(([id,label,count])=>`<button data-plan-view="${id}" aria-pressed="${filters.view===id}">${label} <span>${count}</span></button>`).join('')}</div><span class="muted">当前匹配 ${rows.length} 个信源</span></div>
    ${rows.length?`<div class="table-wrap"><table class="task-table plan-table"><thead><tr><th>信源</th><th>计划状态</th><th>执行周期 / 下次触发</th><th>最近运行</th><th>管理</th></tr></thead><tbody>${rows.map(source=>{
      const plan=plans.get(source.catalog_key);
      return `<tr><td data-label="信源"><button class="link-button" data-source-settings="${e(source.catalog_key)}">${e(source.name)}</button><small>${source.state==='ACTIVE'?'信源已启用':'信源已停用'}</small></td>
        <td data-label="计划状态">${plan?badge(plan.enabled?'ACTIVE':'paused'):'<span class="muted">尚未配置</span>'}</td>
        <td data-label="周期 / 下次触发">${plan?`${formatPeriod(plan.interval_seconds)}<small>${plan.enabled?dateTime(plan.next_run_at):'计划已暂停'}</small>`:'—'}</td>
        <td data-label="最近运行">${plan?.latest_run_id?`${badge(plan.latest_status)}<small>${dateTime(plan.latest_scheduled_at)}</small><button class="link-button" data-locate-run="${e(plan.operation_id||plan.latest_run_id)}" data-run-time="${e(plan.latest_scheduled_at)}" data-run-source="${e(source.catalog_key)}">查看执行</button>`:'<span class="muted">尚未执行</span>'}${plan?.latest_error?`<small class="run-reason">${e(explain(plan.latest_error))}</small>`:''}</td>
        <td data-label="管理"><div class="actions"><button class="quiet" data-source-runs="${e(source.catalog_key)}">执行记录</button>${can('submit',source.catalog_key)?`<button class="quiet" data-schedule="${e(source.catalog_key)}">${plan?'管理计划':'配置计划'}</button>`:''}</div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`:`<div class="empty"><h3>${keyword?'没有匹配的信源':'该范围暂无信源'}</h3><p>调整搜索或切换计划范围。</p></div>`}
    </section>${state.monitor?.alerts?.length?`<details class="workspace-alerts"><summary>${state.monitor.alerts.length} 项系统异常待处理</summary>${state.monitor.alerts.map(row=>`<div class="history-item"><strong>${e(explain(row.code))}</strong><small>${dateTime(row.created_at||row.opened_at)}</small></div>`).join('')}</details>`:''}
    <p class="workspace-footnote">暂停计划影响后续自动接入，已启动的任务在信息采集任务中管理。</p></section>`;
}
