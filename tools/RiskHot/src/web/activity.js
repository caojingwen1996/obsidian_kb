import {escape as e,dateTime} from './model.js';

export const currentTask=activity=>activity?.items?.[0]||activity?.latest_batch||null;
export function launchState(activity,fresh){
  if(!fresh)return {disabled:true,label:'状态待确认'};
  const task=activity?.items?.[0];
  if(!task)return {disabled:false,label:'开启任务'};
  return {disabled:true,label:task.status==='paused'?'任务已暂停':task.status==='running'?'任务运行中':['queued','pending'].includes(task.status)?'任务等待执行':'任务待处理'};
}
export function renderActivity(activity,fresh,can,workspace='tasks'){
  const task=currentTask(activity);if(!task)return '';
  const active=Boolean(activity.items?.length),running=fresh&&active&&task.status==='running';
  const sources=task.sources||[],completed=sources.filter(source=>source.status==='completed').length;
  const errors=sources.filter(source=>['partial','blocked','failed','review','recoverable','waiting_config'].includes(source.status)).length;
  const title=!fresh?'任务状态待确认':task.status==='paused'?'任务已暂停':running?'任务正在运行':active?(['queued','pending'].includes(task.status)?'任务已开启 · 等待执行':'仍有信源待处理'):task.status==='completed'?'本轮任务已完成':'本轮任务已结束';
  if(fresh&&!active)return `<div class="activity-ended"><strong id="activity-title">${title}</strong><span class="muted">${dateTime(task.scheduled_at)}${errors?` · ${errors} 个信源需处理`:''}</span><button class="quiet" data-action="view-current-task">查看批次详情</button>${errors?`<button class="quiet" data-batch-errors="${e(task.id)}" data-run-time="${e(task.scheduled_at)}">查看待处理</button>`:''}</div>`;
  const subtitle=!fresh?'连接中断，保留上次状态；恢复连接后重新确认。':task.status==='paused'?'进度已保留，继续任务后接着处理。':active?'自动更新进度，本轮结束后可再次开启。':errors?'部分信源需要处理，可在执行记录查看。':'已保存的资料与抽取结果可随时查看。';
  return `<div class="activity-main"><div class="activity-heading"><svg class="activity-indicator ${running?'is-running':''}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>${!active?(errors?'<path d="M12 7v6m0 4h.01"/>':'<path d="m7 12 3 3 7-7"/>'):task.status==='paused'?'<path d="M9 8v8m6-8v8"/>':'<path class="activity-hand" d="M12 6v6l4 2"/>'}</svg><h2 id="activity-title" aria-live="polite">${title}</h2>${activity.total>1?`<span class="muted">${activity.total} 个进行中的任务</span>`:''}</div><p>${subtitle}</p><small>任务 ${e(task.id.slice(0,8))} · ${dateTime(task.scheduled_at)}</small></div>
    <div class="activity-progress"><div><strong>已完成 ${completed} / ${sources.length} 个信源</strong><span>${errors?`${errors} 个需处理`:`已保存 ${task.saved_count??'—'} 份资料`}</span></div><progress value="${completed}" max="${Math.max(1,sources.length)}" aria-label="已完成信源" aria-valuetext="${completed} / ${sources.length} 个信源"></progress></div>
    <div class="actions"><button type="button" class="secondary" data-action="view-current-task">${active?'查看进度':'查看结果'}</button>${fresh&&active&&can('submit')&&task.scope_complete!==false?`<button type="button" class="quiet" data-task-control="${task.status==='paused'?'resume':'pause'}" data-task-id="${e(task.id)}">${task.status==='paused'?'继续任务':'暂停任务'}</button>`:''}${!fresh?'<button type="button" class="quiet" data-action="refresh">重新读取状态</button>':''}</div>`;
}
