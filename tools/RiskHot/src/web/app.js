import {createClient} from './api.js';
import {escape as e,profileOf,shanghaiDate,validRange,dateTime,statusName,explain,candidateCount} from './model.js';
import {renderSources,sourceForm,profileFields} from './sources.js';
import {renderTasks,renderSchedules,renderProgress} from './tasks.js';

const api=createClient(),content=document.querySelector('#content'),modal=document.querySelector('#modal'),feedback=document.querySelector('#feedback');
const readStored=key=>{try{return JSON.parse(sessionStorage.getItem(key));}catch{return null;}};
const store=(key,value)=>{try{value==null?sessionStorage.removeItem(key):sessionStorage.setItem(key,JSON.stringify(value));}catch{/* The page remains usable when private storage is unavailable. */}};
const today=shanghaiDate(),saved=readStored('riskhot-view');
const state={sources:[],session:null,view:'research',selected:null,detailTab:'archive',mobileDetail:false,history:null,batches:null,monitor:null,
  filters:{q:'',tier:'',category:'',dims:'',levels:'',group:'',state:'',readiness:'',priority:'',frequency:''},taskFilters:{from:today,to:today,q:'',status:''},selectedBatch:null,...saved};
state.pending=readStored('riskhot-command');state.sources=[];state.session=null;
let connected=false,loading=false,busy=false,startingBatch=false,dialogContext=null,returnFocus=null,historyRequest=0,refreshRequest=0,refreshPromise=null;
const can=(permission,key)=>Boolean(state.session?.permissions.includes(permission)&&(!key||state.session.source_keys.includes('*')||state.session.source_keys.includes(key)));
const route=()=>location.hash==='#intake-tasks'?'tasks':location.hash==='#schedules'?'schedules':'sources';
function remember(){store('riskhot-view',{view:state.view,selected:state.selected,detailTab:state.detailTab,filters:state.filters,taskFilters:state.taskFilters,selectedBatch:state.selectedBatch});}
function notice(message,error=false){feedback.hidden=false;feedback.className=`feedback ${error?'feedback-error':''}`;feedback.setAttribute('role',error?'alert':'status');feedback.textContent=message;}
function render(){
  remember();
  for(const [id,name] of [['source-workspace-link','sources'],['intake-workspace-link','tasks'],['schedules-workspace-link','schedules']]){
    const link=document.getElementById(id);name===route()?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current');
  }
  document.querySelector('#login').hidden=!state.loginRequired;document.querySelector('#logout').hidden=!state.session||state.session.authentication!=='oidc';
  document.querySelector('#connection-state').textContent=state.session?(connected?'已连接 · 实时数据':'连接中断 · 保留已读数据'):state.loginRequired?'尚未登录':'正在读取工作台';
  if(!state.session){content.innerHTML=state.loginRequired?'<section class="empty panel"><h2>登录后查看信源与接入任务</h2><p>使用项目账号登录，操作范围由服务端权限决定。</p><a class="primary" href="/auth/login">登录工作台</a></section>':'<section class="loading panel" role="status">正在读取信源与接入任务…</section>';return;}
  if(route()==='tasks')content.innerHTML=state.batches?renderTasks(state,can):'<div class="loading" role="status">正在读取接入批次…</div>';
  else if(route()==='schedules')content.innerHTML=state.monitor?renderSchedules(state,can):'<div class="loading" role="status">正在读取计划…</div>';
  else content.innerHTML=renderSources(state,can);
  updateStartButtons();
  if(state.pending)notice('上一项操作的结果尚未确认。请先查询状态，或重试原操作。',true);
  if(state.pending&&!document.querySelector('#pending-controls'))feedback.insertAdjacentHTML('beforeend','<span id="pending-controls" class="actions"><button class="secondary" data-action="retry-pending">重试原操作</button><button class="quiet" data-action="refresh">查询当前状态</button></span>');
}
async function loadHistory(){
  const key=state.selected,serial=++historyRequest;
  try{const data=await api.get(`/api/v1/m1/sources/${encodeURIComponent(key)}/history`);if(serial===historyRequest&&state.selected===key){state.history={key,data};render();}}
  catch(error){notice(explain(error),true);}
}
async function loadRelations(){
  const key=state.selected;
  try{const data=await api.get(`/api/v1/m1/sources/${key}/relations`);if(state.selected===key){state.relations={key,data};render();}}catch(error){notice(explain(error),true);}
}
async function refresh(silent=false){
  if(refreshPromise){if(silent)return refreshPromise;await refreshPromise;return refresh(false);}
  refreshPromise=performRefresh();
  try{return await refreshPromise;}finally{refreshPromise=null;}
}
async function performRefresh(){
  loading=true;const serial=++refreshRequest;
  try{
    const session=await api.get('/api/v1/session');
    const sources=await api.get('/api/v1/m1/sources');
    const next={session,sources:sources.items};
    if(route()==='tasks'){
      if(!validRange(state.taskFilters.from,state.taskFilters.to))throw {code:'DATE_RANGE_INVALID'};
      next.batches=await api.get(`/api/v1/l0/task-batches?${new URLSearchParams(Object.entries(state.taskFilters).filter(([,v])=>v))}`);
    }
    if(route()==='schedules')next.monitor=await api.get('/api/v1/l0/monitor');
    if(serial!==refreshRequest)return;
    Object.assign(state,next);state.loginRequired=false;connected=true;feedback.hidden=true;
    if(!state.selected||!state.sources.some(x=>x.catalog_key===state.selected))state.selected=state.sources[0]?.catalog_key??null;
    render();if(route()==='sources'&&state.detailTab==='history'&&state.selected)await loadHistory();
  }catch(error){
    connected=false;
    if(error.status===401){state.session=null;state.loginRequired=true;render();}
    else if(!state.sources.length&&!state.session){content.innerHTML='<section class="empty panel"><h2>暂时无法读取工作台</h2><p>请检查服务连接后重试。</p><button class="secondary" data-action="refresh">重新读取</button></section>';}
    notice(error.code==='DATE_RANGE_INVALID'?'日期范围无效，请核对开始与结束日期。':explain(error),true);
  }finally{loading=false;document.querySelector('#refresh').disabled=false;}
}
function closeDialog(force=false){
  if(busy)return;
  if(!force&&dialogContext?.dirty){
    const area=modal.querySelector('#modal-error');area.hidden=false;area.innerHTML='资料尚未保存。<button type="button" class="secondary" data-action="discard-dialog">放弃修改并关闭</button><button type="button" class="quiet" data-action="keep-editing">继续编辑</button>';return;
  }
  modal.close();dialogContext=null;if(state.pending)render();returnFocus?.isConnected?returnFocus.focus():document.querySelector('#main').focus();
}
function openDialog(title,body,context={},submit='确认'){
  returnFocus=document.activeElement;dialogContext=context;
  modal.innerHTML=`<form id="dialog-form"><header class="dialog-header"><h2 id="modal-title">${e(title)}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="关闭">×</button></header><div class="dialog-body"><div id="modal-error" class="feedback feedback-error" role="alert" hidden></div>${body}</div><footer class="dialog-footer"><span class="muted">${context.kind==='source-create'||context.kind==='source-edit'?'保存不自动启用':''}</span><div class="actions"><button type="button" class="secondary" data-action="close-dialog">${submit?'取消':'关闭'}</button>${submit?`<button class="primary" type="submit">${e(submit)}</button>`:''}</div></footer></form>`;
  if(!modal.open)modal.showModal();(modal.querySelector('input:not([disabled]),select')||modal.querySelector('button'))?.focus();
}
function openSourceForm(key){
  const source=state.sources.find(x=>x.catalog_key===key),draft=readStored('riskhot-draft');
  openDialog(source?'编辑信源资料':'新增信源',sourceForm(source),{kind:source?'source-edit':'source-create',source,dirty:false},'保存资料');
  if(draft&&draft.source===(key||null)&&draft.actor===state.session.actor){for(const [field,value]of Object.entries(draft.values)){const input=modal.querySelector(`[name="${field}"]`);if(input)input.value=value;}dialogContext.dirty=true;}
}
function updateStartButtons(){
  const enabled=state.sources.some(source=>source.state==='ACTIVE'&&can('submit',source.catalog_key));
  document.querySelectorAll('[data-action="start-batch"]').forEach(button=>button.disabled=startingBatch||busy||!enabled);
}
async function startBatch(){
  if(startingBatch||busy)return;
  if(state.pending){render();return;}
  startingBatch=true;updateStartButtons();
  try{
    const sources=await api.get('/api/v1/m1/sources');state.sources=sources.items;
    const keys=state.sources.filter(source=>source.state==='ACTIVE'&&can('submit',source.catalog_key)).map(source=>source.catalog_key);
    if(!keys.length){notice('暂无已启用的信源，请先启用信源。',true);return;}
    await execute(api.command('/api/v1/l0/task-batches','POST',{source_keys:keys,limit:1}),{kind:'batch-create'});
  }catch(error){notice(explain(error),true);}
  finally{startingBatch=false;updateStartButtons();}
}
function openControl(id,action){
  const task=state.batches?.items.find(x=>x.id===id);if(!task)return;
  const label=action==='pause'?'暂停任务':task.status==='queued'?'开启任务':'继续任务';
  openDialog(label,`<p>${e(dateTime(task.scheduled_at))} · ${e(task.id)}</p><p>${action==='pause'?'暂停后保留已保存资料、原计划时间和已有失败记录。':'从可恢复检查点继续，已保存结果不会重复采集。待复核和失败结果仍需分别处理。'}</p><label class="field">操作说明<input name="reason" maxlength="2000" value="${e(label)}" required></label>`,{kind:'batch-control',task,action},label);
}
function openSchedule(key){
  const source=state.sources.find(x=>x.catalog_key===key),plan=state.monitor?.schedules.find(x=>x.catalog_key===key);
  openDialog('管理接入计划',`<p>${e(source?.name)}</p><p class="notice">计划与信源资格分别管理；实际运行时会再次核对信源。新的周期从保存后开始计算。</p><label class="field">计划状态<select name="enabled"><option value="true" ${plan?.enabled?'selected':''}>启用计划</option><option value="false" ${!plan?.enabled?'selected':''}>暂停计划</option></select></label><label class="field">执行周期（分钟）<input name="minutes" type="number" min="1" max="1440" value="${plan?plan.interval_seconds/60:60}" required></label>`,{kind:'schedule',source,plan},'保存计划');
}
async function execute(command,context){
  if(busy)return;
  if(state.pending&&state.pending.command.key!==command.key){const area=modal.open?modal.querySelector('#modal-error'):feedback;area.hidden=false;area.textContent='请先确认上一项操作的结果，再开始新的操作。';return;}
  if(state.pending&&state.pending.actor!==state.session?.actor){notice('请使用发起原操作的账号登录后核对结果。',true);return;}
  state.pending={command,actor:state.session.actor,context:{kind:context.kind,target:context.source?.catalog_key}};store('riskhot-command',state.pending);
  busy=true;feedback.hidden=true;modal.querySelectorAll('button').forEach(x=>x.disabled=true);
  try{
    const value=await api.send(command);state.pending=null;store('riskhot-command',null);busy=false;
    if(context.kind==='source-create')Object.keys(state.filters).forEach(key=>state.filters[key]='');
    if(context.kind.startsWith('source-')){store('riskhot-draft',null);state.selected=value.catalog_key||value.key||context.source?.catalog_key;state.detailTab='archive';}
    if(context.kind==='batch-create'){state.selectedBatch=value.id;state.mobileDetail=false;state.taskFilters={from:shanghaiDate(new Date(value.scheduled_at)),to:shanghaiDate(new Date(value.scheduled_at)),q:value.id,status:''};if(location.hash!=='#intake-tasks')history.pushState(null,'','#intake-tasks');}
    closeDialog(true);await refresh();notice('操作已确认，当前状态已重新读取。');
  }catch(error){
    const unknown=Boolean(error.command);if(!unknown){state.pending=null;store('riskhot-command',null);}
    const area=modal.open?modal.querySelector('#modal-error'):feedback;area.hidden=false;area.textContent=explain(error);
    if(unknown){area.insertAdjacentHTML('beforeend',`<p>提交内容已保留，重试将使用原请求。</p><span ${modal.open?'':'id="pending-controls"'} class="actions"><button type="button" class="secondary" data-action="retry-pending">重试原操作</button><button type="button" class="quiet" data-action="refresh">查询当前状态</button></span>`);modal.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=true);}
    if(error.status===401){document.querySelector('#login').hidden=false;area.insertAdjacentHTML('beforeend','<p><a href="/auth/login">重新登录后继续</a></p>');}
  }finally{busy=false;modal.querySelectorAll('button').forEach(x=>x.disabled=false);if(state.pending)modal.querySelector('[type="submit"]')?.setAttribute('disabled','');}
}
async function submitDialog(form){
  if(busy||!dialogContext||!form.reportValidity())return;
  const ctx=dialogContext,data=new FormData(form);let command;
  if(ctx.kind==='source-create'||ctx.kind==='source-edit'){
    const profile=Object.fromEntries(profileFields.map(([key])=>[key,['dims','levels'].includes(key)?[...new Set(String(data.get(key)||'').split(/[、,，]/).map(x=>x.trim()).filter(Boolean))]:String(data.get(key)||'').trim()]));
    command=api.command(ctx.source?`/api/v1/m1/sources/${ctx.source.catalog_key}`:'/api/v1/m1/sources',ctx.source?'PUT':'POST',ctx.source?{expected_version:ctx.source.version,profile,reason:'在信源管理中心更新档案'}:{profile});
  }else if(ctx.kind==='source-state')command=api.command(`/api/v1/m1/sources/${ctx.source.catalog_key}`,'PATCH',{state:ctx.source.state==='ACTIVE'?'DISABLED':'ACTIVE',expected_version:ctx.source.version,reason:String(data.get('reason')||'')});
  else if(ctx.kind==='batch-control')command=api.command(`/api/v1/l0/task-batches/${ctx.task.id}/control`,'POST',{action:ctx.action,expected_version:ctx.task.version,reason:String(data.get('reason'))});
  else if(ctx.kind==='schedule')command=api.command(`/api/v1/l0/schedules/${ctx.source.catalog_key}`,'PATCH',{enabled:data.get('enabled')==='true',interval_seconds:Number(data.get('minutes'))*60,expected_updated_at:ctx.plan?.updated_at??null});
  else if(ctx.kind==='retry-operation')command=api.command(`/api/v1/l0/operations/${ctx.row.id}/retry`,'POST',{expected_generation:Number(ctx.row.generation),reason:String(data.get('reason'))});
  else if(ctx.kind==='retry-processing')command=api.command(`/api/v1/l0/processings/${ctx.row.id}/retry`,'POST',{expected_generation:Number(ctx.row.generation),reason:String(data.get('reason')),open_budget:data.get('budget')==='on'});
  else if(ctx.kind==='review-processing')command=api.command(`/api/v1/l0/processings/${ctx.row.id}/reviews`,'POST',{expected_generation:Number(ctx.row.generation),basis_digest:ctx.row.output_review_basis.digest,decision:'RETRY_FIXED_INPUT',reason:String(data.get('reason'))});
  if(command)await execute(command,ctx);
}
async function showOperation(id){
  try{
    const row=await api.get(`/api/v1/l0/operations/${id}`),children=row.children?.length?row.children:[row];
    openDialog('资料接入详情',`<p class="text-wrap">${e(row.id)} · ${e(statusName(row.slice_status||row.status))}</p>${children.map(child=>`<section class="detail-section"><h3>${e(child.url||'信源接入')}</h3>${renderProgress(child)}${child.reason_code?`<p class="notice">${e(explain(child.reason_code))}</p>`:''}<div class="actions">${child.version_id?`<button type="button" class="secondary" data-version="${e(child.version_id)}">查看已保存资料</button>`:''}${child.processing_id?`<button type="button" class="secondary" data-processing="${e(child.processing_id)}">查看候选抽取</button>`:''}${can('retry')&&!child.processing_id&&['recoverable','waiting_config'].includes(child.status)?`<button type="button" class="secondary" data-retry-operation="${e(child.id)}">从检查点重试</button>`:''}</div></section>`).join('')}`,{kind:'read'},'');
  }catch(error){notice(explain(error),true);}
}
async function showVersion(id){
  try{const row=await api.get(`/api/v1/l0/versions/${id}`);openDialog('已保存的标准化资料',`<h3>${e(row.material.title)}</h3><p>${e(row.material.publishedAtText||'发布时间待确认')}</p>${row.material.segments.map(x=>`<p class="material-text">${e(x.text)}</p>`).join('')}<a class="secondary" href="${e(row.raw_url)}" download>下载原件</a>`,{kind:'read'},'');}catch(error){notice(explain(error),true);}
}
async function showProcessing(id){
  try{
    const row=await api.get(`/api/v1/l0/processings/${id}`);state.processing=row;
    openDialog('事件候选抽取',`<p>抽取状态：${e(statusName(row.extraction_status))} · 候选数量：${e(candidateCount(row))}</p><p>候选保持待处理状态。</p>${row.error_code?`<p class="notice">${e(explain(row.error_code))}</p>`:''}${(row.candidates||[]).map(x=>`<article class="history-item"><h3>${e(x.payload.title||x.payload.candidate_title||'事件候选')}</h3><p>${e(x.payload.summary||x.payload.description||'')}</p><pre class="material-text">${e(JSON.stringify(x.payload,null,2))}</pre></article>`).join('')}<div class="actions">${can('retry')&&row.extraction_status==='recoverable'?`<button type="button" class="secondary" data-retry-processing="${e(row.id)}">重试固定资料</button>`:''}${can('model_review')&&row.extraction_status==='review'&&row.output_review_basis?`<button type="button" class="secondary" data-review-processing="${e(row.id)}">复核后重试固定资料</button>`:''}</div>${row.next_cursor?'<p class="notice">当前显示首批候选，其余可在后续分页中查询。</p>':''}`,{kind:'read'},'');
  }catch(error){notice(explain(error),true);}
}
document.addEventListener('submit',event=>{
  if(event.target.id==='dialog-form'){event.preventDefault();submitDialog(event.target);return;}
  if(event.target.id==='source-search'){event.preventDefault();state.filters.q=new FormData(event.target).get('q')||'';render();}
  if(event.target.id==='task-query'){event.preventDefault();const data=Object.fromEntries(new FormData(event.target));if(!validRange(data.from,data.to)){notice('日期范围无效，请核对开始与结束日期。',true);return;}state.taskFilters=data;refresh();}
});
document.addEventListener('change',event=>{const key=event.target.dataset.sourceFilter;if(key){const id=event.target.id;state.filters[key]=event.target.multiple?[...event.target.selectedOptions].map(x=>x.value).filter(Boolean):event.target.value;render();document.getElementById(id)?.focus();}});
modal.addEventListener('input',()=>{
  if(!dialogContext?.kind.startsWith('source-')||dialogContext.kind==='source-state')return;
  dialogContext.dirty=true;store('riskhot-draft',{actor:state.session.actor,source:dialogContext.source?.catalog_key??null,values:Object.fromEntries(new FormData(modal.querySelector('form')))});
  const data=new FormData(modal.querySelector('form')),url=String(data.get('url')||'').replace(/#.*$/,'').replace(/\/$/,'').toLowerCase();
  const match=url&&state.sources.find(x=>x.catalog_key!==dialogContext.source?.catalog_key&&x.url.replace(/#.*$/,'').replace(/\/$/,'').toLowerCase()===url);
  const box=modal.querySelector('#duplicate-check');if(box){box.hidden=!match;box.textContent=match?`可能已登记：${match.name}（${match.catalog_key}）。请核对后再保存。`:'';}
});
document.addEventListener('click',async event=>{
  try{
  const button=event.target.closest('button,[data-view]');if(!button||button.disabled)return;
  const d=button.dataset;
  if(d.source){state.selected=d.source;state.mobileDetail=true;state.detailTab='archive';render();document.querySelector('#detail-title')?.focus();}
  if(d.view){state.view=d.view;render();}
  if(d.tab){state.detailTab=d.tab;render();document.querySelector(`[data-tab="${d.tab}"]`)?.focus();if(d.tab==='history')loadHistory();if(d.tab==='relations')loadRelations();}
  if(d.editSource!==undefined)openSourceForm(d.editSource);
  if(d.sourceState){const source=state.sources.find(x=>x.catalog_key===d.sourceState);openDialog(source.state==='ACTIVE'?'停用信源':'启用信源',`<p>${e(source.name)} · 当前版本 v${source.version}</p><p>${source.state==='ACTIVE'?'停用后阻断新的采集与后续处理，已保存资料保留。':'启用前请核对身份、发布主体与允许范围。业务启用不代表具备自动连接条件，也不会自动补采。'}</p><label class="field">操作理由（选填）<input name="reason" maxlength="2000"></label>`,{kind:'source-state',source},source.state==='ACTIVE'?'确认停用':'确认启用');}
  if(d.taskControl)openControl(d.taskId,d.taskControl);
  if(d.batchDetail){state.selectedBatch=state.selectedBatch===d.batchDetail?null:d.batchDetail;render();document.querySelector('#batch-detail-title')?.focus();}
  if(d.schedule)openSchedule(d.schedule);
  if(d.operation)showOperation(d.operation);
  if(d.version)showVersion(d.version);
  if(d.processing)showProcessing(d.processing);
  if(d.historyVersion){const row=(state.history?.data.items||[]).find(x=>String(x.version)===d.historyVersion);if(row)openDialog(`历史版本 v${row.version} · 只读`,`<dl class="facts">${profileFields.map(([key,name])=>`<dt>${e(name)}</dt><dd>${e(Array.isArray(row.profile?.[key])?row.profile[key].join('、'):row.profile?.[key]||'待补充')}</dd>`).join('')}</dl>`,{kind:'read'},'');}
  if(d.retryOperation){const row=await api.get(`/api/v1/l0/operations/${d.retryOperation}`);openDialog('重试接入资料','<label class="field">恢复原因<input name="reason" required maxlength="2000"></label>',{kind:'retry-operation',row},'重试');}
  if(d.retryProcessing||d.reviewProcessing){const row=state.processing;openDialog(d.reviewProcessing?'复核固定输出':'重试固定资料',`<label class="field">处理依据<input name="reason" required maxlength="2000"></label>${!d.reviewProcessing&&can('model_budget')?'<label><input name="budget" type="checkbox">预算确已耗尽时，申请新的授权窗口</label>':''}`,{kind:d.reviewProcessing?'review-processing':'retry-processing',row},d.reviewProcessing?'允许重试固定资料':'重试');}
  const action=d.action;
  if(action==='refresh'){button.disabled=true;await refresh();button.disabled=false;}
  if(action==='create-source')openSourceForm();
  if(action==='close-detail'){state.mobileDetail=false;render();document.querySelector(`[data-source="${state.selected}"]`)?.focus();}
  if(action==='clear-sources'){Object.keys(state.filters).forEach(key=>state.filters[key]='');render();}
  if(action==='expand'||action==='collapse')content.querySelectorAll('details.source-group').forEach(x=>x.open=action==='expand');
  if(action==='start-batch')startBatch();
  if(action==='close-batch'){state.selectedBatch=null;render();}
  if(action==='clear-tasks'){state.taskFilters={from:today,to:today,q:'',status:''};refresh();}
  if(action==='attention'){state.taskFilters.status='attention';refresh();}
  if(action==='close-dialog')closeDialog();
  if(action==='discard-dialog'){store('riskhot-draft',null);closeDialog(true);}
  if(action==='keep-editing'){modal.querySelector('#modal-error').hidden=true;modal.querySelector('input')?.focus();}
  if(action==='retry-pending'&&state.pending)execute(state.pending.command,{...state.pending.context,source:{catalog_key:state.pending.context.target}});
  if(button.id==='logout'){try{await fetch('/auth/logout',{method:'POST',credentials:'same-origin'});state.session=null;render();}catch{notice('退出登录未确认，请重试。',true);}}
  }catch(error){notice(explain(error),true);}
});
modal.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
document.addEventListener('keydown',event=>{if(event.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=[...content.querySelectorAll('[role="tab"]')],index=tabs.indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();}});
window.addEventListener('hashchange',()=>{render();refresh();});
window.addEventListener('offline',()=>{connected=false;notice('当前离线，保留已读取状态；恢复连接后可刷新。',true);});
window.addEventListener('online',()=>refresh(true));
setInterval(()=>{if(!document.hidden&&!modal.open&&navigator.onLine)refresh(true);},15000);
refresh();
