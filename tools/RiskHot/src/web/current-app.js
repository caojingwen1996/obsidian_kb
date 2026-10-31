import {createClient} from './api.js';
import {escape as e,badge,dateTime,explain,statusName,groupSources,groupFields,researchGroups,schedulePeriod,periodSeconds,formatPeriod,periodUnits} from './model.js';
import {sourceForm,profileFields} from './sources.js';
const api=createClient(),content=document.querySelector('#content'),feedback=document.querySelector('#feedback'),modal=document.querySelector('#modal');
content.classList.add('current-view');
const sourceViews={all:'全部',verify:'信源等级',monitor:'日常监测',research:'专题研究'};
const state={sources:[],tasks:[],plans:[],selected:new Set(),session:null,query:'',tier:'',sourceView:'all',detail:null,material:null,candidate:null,taskPage:null};
try{const saved=sessionStorage.getItem('riskhot-source-grouping')??JSON.parse(sessionStorage.getItem('riskhot-view'))?.view;if(Object.hasOwn(sourceViews,saved))state.sourceView=saved;}catch{}
const planDrafts=new Map();
let busy=false,pending=null,dialog=null,returnFocus=null,serial=0;
try{pending=JSON.parse(sessionStorage.getItem('riskhot-current-command'));}catch{}
function persistPending(){try{if(pending)sessionStorage.setItem('riskhot-current-command',JSON.stringify(pending));else sessionStorage.removeItem('riskhot-current-command');}catch{}}
const can=(permission,key)=>Boolean(state.session?.permissions.includes(permission)&&(!key||state.session.source_keys.includes('*')||state.session.source_keys.includes(key)));
const notice=(message,error=false)=>{feedback.hidden=false;feedback.classList.toggle('feedback-error',error);feedback.textContent=message;if(pending){const retry=document.createElement('button');retry.className='secondary';retry.textContent='按原操作重试';retry.dataset.replay='true';feedback.append(' ',retry);}};
const route=()=>location.hash.split('?')[0]||'#sources';
const taskQuery=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const isPlanPage=()=>route()==='#intake-tasks'&&taskQuery().get('view')==='plans';
const isManualPage=()=>route()==='#intake-tasks'&&taskQuery().get('view')==='manual';
function redirectLegacyPlan(){
 if(route()==='#manual-tasks'){const query=taskQuery();query.set('view','manual');location.replace(`#intake-tasks?${query}`);return true;}
 if(route()!=='#sources'||taskQuery().get('mode')!=='automatic')return false;
 location.replace('#intake-tasks?view=plans');return true;
}
function status(task){return task.paused?'paused':task.status;}
function sourceName(id){return state.sources.find(s=>s.id===id)?.name||'信源';}
function planStatus(source,plan){
 if(!plan)return '<span class="muted">计划未读取，请刷新</span>';
 return `<div class="inline-plan-status"><span class="status ${plan.enabled?'status-ACTIVE':'status-paused'}">${plan.enabled?'已启用':'已暂停'}</span>${can('submit',source.catalog_key)?`<button type="button" class="secondary" data-plan-toggle="${e(source.catalog_key)}" data-enabled="${!plan.enabled}" data-revision="${e(plan.updated_at)}">${plan.enabled?'暂停计划':'启用计划'}</button>`:''}</div>`;
}
function planPeriod(source,plan){
 if(!plan)return '<span class="muted">尚未读取</span>';
 if(!can('submit',source.catalog_key))return e(formatPeriod(plan.interval_seconds));
 const saved=schedulePeriod(plan.interval_seconds),draft=planDrafts.get(source.catalog_key),value=draft?.value??saved.value,unit=draft?.unit??saved.unit;
 return `<form class="inline-plan-period" data-inline-plan="${e(source.catalog_key)}" data-revision="${e(draft?.revision??plan.updated_at)}"><div class="inline-plan-fields"><input name="period" type="number" min="0" step="any" required value="${e(value)}" aria-label="${e(source.name)}的执行周期"><select name="unit" aria-label="${e(source.name)}的周期单位">${Object.entries(periodUnits).map(([key,item])=>`<option value="${key}" ${key===unit?'selected':''}>${item.label}</option>`).join('')}</select><button type="submit" class="secondary">保存周期</button></div><small>已保存：${e(formatPeriod(plan.interval_seconds))} · 1分钟～1天</small><p class="inline-plan-error" data-plan-error role="alert" hidden></p></form>`;
}
function capturePlanDraft(form){
 const data=new FormData(form),key=form.dataset.inlinePlan;
 const draft={value:String(data.get('period')||''),unit:String(data.get('unit')),revision:form.dataset.revision};planDrafts.set(key,draft);
 for(const other of content.querySelectorAll('form[data-inline-plan]'))if(other!==form&&other.dataset.inlinePlan===key){other.elements.period.value=draft.value;other.elements.unit.value=draft.unit;}
 return draft;
}
function acceptPlanReceipt(command,value){
 const match=command.method==='PATCH'&&command.url.match(/^\/api\/v1\/l0\/schedules\/([^/]+)$/);if(!match)return;
 const key=decodeURIComponent(match[1]),body=JSON.parse(command.body),draft=planDrafts.get(key);
 state.plans=state.plans.map(plan=>plan.source_id===value.source_id?{...plan,...value}:plan);
 if(draft&&draft.revision===body.expected_updated_at){
  let seconds;try{seconds=periodSeconds(draft.value,draft.unit);}catch{}
  if(seconds===body.interval_seconds)planDrafts.delete(key);else draft.revision=value.updated_at;
 }
}
function renderSources(plans=false){
 const views=sourceViews;
 const tiers=[...new Set(state.sources.map(s=>s.metadata.tier).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));
 const rows=state.sources.filter(s=>(!state.tier||s.metadata.tier===state.tier)&&[s.name,s.catalog_key,s.metadata.publisher,s.metadata.group].join(' ').toLowerCase().includes(state.query.toLowerCase()));
 const research=state.sourceView==='research'&&!plans,researchRoots=research?researchGroups(rows):[],unclassified=researchRoots.find(group=>group.unclassified)?.items.length||0;
 const viewSwitch=`<div class="view-switch" role="group" aria-label="档案分组方式">${Object.entries(views).map(([id,label])=>`<button type="button" data-source-view="${id}" aria-pressed="${state.sourceView===id}">${label}</button>`).join('')}</div>`;
 const row=source=>{
  const plan=state.plans.find(p=>p.source_id===source.id);
  return `<tr data-source-key="${e(source.catalog_key)}"><td data-label="信源"><strong>${e(source.name)}</strong><small>${e(source.catalog_key)} · ${badge(source.state)}</small></td>${plans?'':`<td data-label="信源等级">${e(source.metadata.tier||'未分级')}</td><td data-label="信源分组">${e(source.metadata.group||'未分组')}</td>`}${plans?`<td data-label="任务计划">${planStatus(source,plan)}</td><td data-label="执行周期">${planPeriod(source,plan)}</td>`:''}<td data-label="${plans?'下一时点':'接入条件'}">${plans?plan?.enabled?e(dateTime(plan.next_run_at)):'计划已暂停':e(statusName(source.connection?.readiness||'needs_adapter'))}</td><td data-label="操作"><div class="actions">${!plans&&can('source_admin',source.catalog_key)?`<button class="secondary" data-edit-source="${e(source.catalog_key)}">编辑档案</button><button class="quiet" data-source-state="${e(source.catalog_key)}">${source.state==='ACTIVE'?'停用信源':'启用信源'}</button>`:''}${plans?`<button class="quiet" data-source-tasks="${e(source.catalog_key)}">任务执行记录</button>`:''}</div></td></tr>`;
 };
 const table=items=>`<div class="table-wrap"><table class="task-table"><thead><tr><th>信源</th>${plans?'<th>任务计划</th><th>执行周期</th>':'<th>信源等级</th><th>信源分组</th>'}<th>${plans?'下一时点':'接入条件'}</th><th>操作</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table></div>`;
 const tree=(items,depth=0)=>{
  const researchRoot=research&&depth===0,groups=researchRoot?researchRoots:groupSources(items,state.sourceView,depth),last=depth+1>=groupFields[state.sourceView].length;
  if(!researchRoot&&groups.length===1&&groups[0].name===`待补充${groups[0].label}`)return last?table(items):tree(items,depth+1);
  return groups.map(group=>`<details class="source-group" ${researchRoot?`data-research-group="${e(group.name)}"`:''} ${group.items.length?'open':''}><summary><span>${e(group.label)}</span><strong>${e(group.name)}</strong> <span>${group.items.length} 个信源</span></summary><div class="group-children">${group.items.length?(last?table(group.items):tree(group.items,depth+1)):'<p class="source-group-empty">暂无已维护此金融属性的信源。</p>'}</div></details>`).join('');
 };
 return `<section class="panel"><div class="table-heading"><h2>${plans?'任务计划设置':'信源目录'}</h2><div class="actions">${!plans&&can('source_admin')?'<button class="primary" data-create-source>登记信源</button>':''}</div></div>
 <form id="source-query" class="task-query ${plans?'':'source-toolbar'}"><label>搜索信源<input name="query" value="${e(state.query)}" type="search" placeholder="名称、编号或分组"></label><label><span id="source-tier-label">信源等级</span><select name="tier" aria-labelledby="source-tier-label"><option value="">全部等级</option>${tiers.map(tier=>`<option value="${e(tier)}" ${state.tier===tier?'selected':''}>${e(tier)}</option>`).join('')}</select></label><button class="secondary">查询</button>${plans?'':viewSwitch}</form>
 ${plans?'':`<div class="source-catalog-views"><div class="section-heading"><p id="source-visible-count" role="status">共 ${rows.length} 个信源</p><span class="muted">${state.sourceView==='all'?'全部信源 · 平铺显示':groupFields[state.sourceView].map(field=>field[1]).join(' → ')}</span>${state.sourceView!=='all'?'<div class="actions"><button class="quiet" data-source-groups="expand">展开全部</button><button class="quiet" data-source-groups="collapse">收起全部</button></div>':''}</div>${state.sourceView!=='all'?'<p class="muted">总数按信源去重，多标签分组计数可重叠；未维护的连续分类层级自动压平。</p>':''}</div>`}
 ${unclassified?`<p class="notice">${unclassified} 个信源尚未维护金融属性，已列入“待分类信源”。请在“编辑档案”中维护金融属性、观察层级和关注优先级。</p>`:''}
 ${rows.length?(plans||state.sourceView==='all'?table(rows):tree(rows)):'<p class="empty">没有匹配的信源，请调整搜索或等级筛选。</p>'}</section>`;
}
function renderTasks(){
 const manual=isManualPage();
 const available=state.sources.filter(s=>s.state==='ACTIVE'&&can('submit',s.catalog_key));
 const tasks=state.tasks.filter(t=>!manual||t.trigger_type==='manual');
 return `${manual&&can('submit')?`<section class="panel"><div class="table-heading"><h2>手动发起采集</h2><button class="primary" data-start ${busy||!state.selected.size?'disabled':''}>开启 ${state.selected.size} 个独立任务</button></div><p class="muted">每个信源分别受理，资料保存与后续模型分析分别显示。</p><div class="form-grid">${available.map(s=>`<label class="field"><span><input type="checkbox" data-select="${e(s.catalog_key)}" ${state.selected.has(s.catalog_key)?'checked':''}> ${e(s.name)}</span></label>`).join('')}</div>${available.length?'':'<p class="empty">没有可采集信源。请先核对信源资格和接入条件。</p>'}</section>`:''}<section class="panel"><div class="table-heading"><h2>${manual?'手动采集记录':'任务执行记录'}</h2></div><div class="table-wrap"><table class="task-table"><thead><tr><th>触发时间 / 信源</th><th>状态与阶段</th><th>保存结果</th><th>操作</th></tr></thead><tbody>${tasks.map(task=>`<tr><td data-label="触发时间 / 信源"><strong>${e(sourceName(task.source_id))}</strong><small>${e(dateTime(task.scheduled_at))} · ${task.trigger_type==='automatic'?'自动':'手动'}</small></td><td data-label="状态与阶段">${badge(status(task))}<small>${e(({discover:'发现资料',read:'读取正文',normalize:'标准化',compare:'核对重复',save:'保存资料',provide:'下游可读'})[task.stage]||task.stage)}</small>${task.reason_code?`<p>${e(explain(task.reason_code))}</p>`:''}</td><td data-label="保存结果">${task.result_summary.saved_count??0} 份资料</td><td data-label="操作"><button class="link-button" data-task="${e(task.id)}">查看任务</button></td></tr>`).join('')}</tbody></table></div>${tasks.length?'':'<p class="empty">尚无采集任务。</p>'}<p class="muted">共 ${state.taskPage?.total??0} 条，当前从第 ${(state.taskPage?.offset??0)+1} 条开始</p><div class="actions">${state.taskPage?.offset?'<button class="secondary" data-task-first>首页</button><button class="secondary" data-task-prev>上一页</button>':''}${state.taskPage?.next_offset!==null&&state.taskPage?.next_offset!==undefined?'<button class="secondary" data-task-next>下一页</button>':''}</div></section>`;
}
function renderDetail(){
 const {task,materials,content_notice}=state.detail;
 return `<section class="run-workspace"><button class="quiet" data-back>返回</button><div class="run-detail-heading"><div><h2>${e(sourceName(task.source_id))}</h2><p class="muted">${e(dateTime(task.scheduled_at))} · ${task.trigger_type==='automatic'?'自动采集':'手动采集'}</p></div>${badge(status(task))}</div><p>${e(content_notice)}</p>${task.reason_code?`<p class="notice">${e(explain(task.reason_code))}</p>`:''}<div class="actions">${can('submit')&&!['completed','failed'].includes(task.status)?`<button class="secondary" data-control="${task.paused?'resume':'pause'}">${task.paused?'继续任务':'暂停任务'}</button>`:''}${can('retry')&&['recoverable','partial','blocked'].includes(task.status)?'<button class="secondary" data-control="retry">恢复采集</button>':''}</div><section class="panel"><div class="table-heading"><h3>本任务关联资料</h3><span>${materials.length} 份</span></div>${materials.length?`<div class="table-wrap"><table class="task-table"><thead><tr><th>资料</th><th>当前版本</th><th>下游读取</th><th>操作</th></tr></thead><tbody>${materials.map(m=>`<tr><td data-label="资料">${e(m.title||'未提供标题')}<small>${e(dateTime(m.collected_at))}</small></td><td data-label="当前版本">${m.version}</td><td data-label="下游读取">${m.availability_state==='available'?'正文可读':'等待确认'}</td><td data-label="操作"><button class="link-button" data-material="${e(m.material_id)}">阅读正文与候选</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">本任务尚无已保存资料；发现数量为零与采集失败分别记录在任务状态中。</p>'}</section>${task.result_summary.failures?.length?`<section class="panel"><h3>待处理入口</h3>${task.result_summary.failures.map(f=>`<p class="material-text">${e(f.url)} · ${e(explain(f.code))}</p>`).join('')}</section>`:''}</section>`;
}
function renderMaterial(){
 const {material,candidates}=state.material,result=material.extraction_result;
 return `<section class="run-workspace"><button class="quiet" data-back>返回</button><article class="panel"><div class="table-heading"><h2>${e(material.title||'资料正文')}</h2><span>当前版本 ${material.version}</span></div><p class="muted">${e(material.content.publishedAtText||'发布时间待确认')} · 当前保存的正文；后续修订会递增版本。</p>${material.content.segments.map(s=>`<p class="material-text">${e(s.text)}</p>`).join('')}</article><section class="panel"><div class="table-heading"><h3>候选抽取与事件处理</h3>${can('event_submit')&&candidates.items.length?'<button class="secondary" data-start-events>启动事件处理</button>':''}</div><p>${result?.candidate_count!==undefined?`抽取完成，共 ${result.candidate_count} 个候选。`:result?.error_code?`抽取需处理：${e(explain(result.error_code))}`:'资料已保存，正在等待候选抽取。'}</p>${result?.no_event_reason?`<p class="muted">${e(result.no_event_reason)}</p>`:''}${can('retry')&&['recoverable','review'].includes(result?.status)?'<button class="secondary" data-retry-extraction>恢复候选抽取</button>':''}${candidates.items.map(c=>`<article class="history-item"><h4>${e(c.payload.title)}</h4><p class="material-text">${e(c.payload.description)}</p>${badge(c.status)}<button class="link-button" data-candidate="${e(c.id)}">查看步骤与复核</button></article>`).join('')}</section></section>`;
}
function renderCandidate(){
 const {candidate,steps,review_bases,pending_disposition}=state.candidate;
 return `<section class="run-workspace"><button class="quiet" data-back>返回</button><section class="panel"><div class="table-heading"><h2>${e(candidate.payload.title)}</h2>${badge(candidate.status)}</div><p class="material-text">${e(candidate.payload.description)}</p>${candidate.reason_code?`<p class="notice">${e(explain(candidate.reason_code))}</p>`:''}${steps.map(step=>`<details class="history-item"><summary>步骤 ${step.step_no} · ${e(statusName(step.state))}</summary><pre class="material-text">${e(JSON.stringify(step.result,null,2))}</pre></details>`).join('')}<div class="actions">${candidate.status==='review'&&!pending_disposition&&steps.find(s=>s.step_no===2)?.result?.decision!=='UNRESOLVED'&&Number(candidate.resume_step)===2&&review_bases.identity&&can('event_review')?'<button class="primary" data-review="identity">复核归组建议</button>':''}${candidate.status==='review'&&Number(candidate.resume_step)===3&&review_bases.relations&&can('event_review')?'<button class="primary" data-review="relations">复核直接关系</button>':''}${candidate.status==='review'&&Number(candidate.resume_step)===6&&review_bases.commit&&can('event_commit')?'<button class="primary" data-review="commit">最终审批并保存</button>':''}${(candidate.status==='recoverable'||candidate.status==='review'&&['IDENTITY_SNAPSHOT_STALE','EVENT_CONTEXT_CHANGED','MODEL_CHANGED_REVIEW_REQUIRED'].includes(candidate.reason_code))&&can('event_retry')?'<button class="secondary" data-retry-candidate>恢复本候选</button>':''}${candidate.status==='review'&&!pending_disposition&&can('event_review')&&(review_bases.identity||review_bases.commit)?`<button class="secondary" data-review="${review_bases.identity?'identity':'commit'}" data-decision="REPREPARE">重新准备候选</button>`:''}${pending_disposition&&can('candidate_disposition')?'<button class="secondary" data-review="disposition" data-decision="RECONFIRM_NOT_EVENT">重新确认不构成事件</button>':''}${!['completed','dismissed'].includes(candidate.status)&&can('candidate_disposition')?'<button class="quiet" data-review="disposition">确认不构成事件</button>':''}</div></section></section>`;
}
function render(){
 document.querySelector('#connection-state').textContent='已连接 · 实时数据';
 document.querySelector('#logout').hidden=state.session?.authentication!=='oidc';
 const eventPage=route()==='#event-tasks',taskWorkspace=route()!=='#sources'&&!eventPage;
 for(const link of document.querySelectorAll('.workspaces a')){if(link.id===(eventPage?'event-workspace-link':taskWorkspace?'intake-workspace-link':'source-workspace-link'))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 const taskViews=[['plans','任务计划设置','#intake-tasks?view=plans'],['manual','手动发起采集','#intake-tasks?view=manual'],['records','任务执行记录','#intake-tasks']];
 const selectedView=isPlanPage()?'plans':isManualPage()?'manual':'records';
 const navigation=taskWorkspace?`<nav class="task-subviews" aria-label="信息采集任务分组">${taskViews.map(([view,label,href])=>`<a href="${href}" ${view===selectedView?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`:'';
 if(eventPage&&!pending)feedback.hidden=true;
 content.innerHTML=eventPage?'':navigation+(state.candidate?renderCandidate():state.material?renderMaterial():state.detail?renderDetail():route()==='#sources'?renderSources():isPlanPage()?renderSources(true):renderTasks());
}
async function refresh(){
 if(redirectLegacyPlan())return;
 const run=++serial,hash=location.hash,query=taskQuery(),sourcePage=route()==='#sources',planPage=isPlanPage(),eventPage=route()==='#event-tasks';query.delete('view');if(isManualPage())query.set('trigger','manual');
 try{
  const [session,sources,tasks,plans]=await Promise.all([api.get('/api/v1/session'),eventPage?Promise.resolve({items:state.sources}):api.get('/api/v1/m1/sources'),sourcePage||planPage||eventPage?Promise.resolve(state.taskPage??{items:state.tasks}):api.get(`/api/v1/l0/tasks?${query}`),planPage?api.get('/api/v1/l0/schedules'):Promise.resolve({items:state.plans})]);
  let candidate=state.candidate,material=state.material,detail=state.detail;
  if(hash.startsWith('#material/')){const id=hash.slice(10).split('?')[0];const [body,candidates]=await Promise.all([api.get(`/api/v1/l0/material/${id}`),api.get(`/api/v1/l0/material/${id}/candidates`)]);material={material:body,candidates};if(candidate?.candidate.material_id!==id)candidate=null;else if(candidate)candidate=await api.get(`/api/v1/l0/candidates/${candidate.candidate.id}`);detail=null;}
  else if(candidate)candidate=await api.get(`/api/v1/l0/candidates/${candidate.candidate.id}`);
  else if(material){const id=material.material.id;const [body,candidates]=await Promise.all([api.get(`/api/v1/l0/material/${id}`),api.get(`/api/v1/l0/material/${id}/candidates`)]);material={material:body,candidates};}
  else if(detail)detail=await api.get(`/api/v1/l0/tasks/${detail.task.id}`);
  if(run!==serial||hash!==location.hash)return;
  Object.assign(state,{session,sources:sources.items,tasks:tasks.items,plans:plans.items,taskPage:tasks,candidate,material,detail});
  render();if(pending&&feedback.hidden)notice('上次操作的结果尚未确认，请按原操作重试。',true);
 }catch(error){if(run!==serial||hash!==location.hash)return;notice(error.status===401?'请先登录后读取工作台。':`读取失败：${explain(error)}。可点击刷新重试。`,true);document.querySelector('#login').hidden=error.status!==401;}
}
async function send(command){
 if(busy)throw new Error('正在提交，请稍候。');if(pending&&(command.key!==pending.key||command.url!==pending.url||command.method!==pending.method||command.body!==pending.body)){notice('上次操作结果尚未确认，请先按原操作重试。',true);throw new Error('请先确认上次操作。');}if(command.actor&&command.actor!==state.session.actor)throw new Error('请使用发起原操作的账号重试。');busy=true;pending={...command,actor:state.session.actor};persistPending();
 try{const value=await api.send(command);acceptPlanReceipt(command,value);pending=null;persistPending();return value;}
 catch(error){if(error.code!=='OUTCOME_UNKNOWN'&&error.status<500){pending=null;persistPending();}notice(`操作未完成：${explain(error)}。${pending?'请按原操作重试以避免重复任务。':'请核对输入或刷新后重试。'}`,true);throw error;}
 finally{busy=false;}
}
function openDialog(title,html,context){returnFocus=document.activeElement;dialog=context;modal.innerHTML=`<form id="current-dialog"><h2 id="modal-title">${e(title)}</h2>${html}<p id="dialog-error" role="alert" hidden></p><div class="actions"><button class="primary" type="submit">确认</button><button class="quiet" type="button" data-close>取消</button></div></form>`;modal.showModal();modal.querySelector('input,select,button')?.focus();}
function closeDialog(){modal.close();dialog=null;returnFocus?.focus();}
async function readMaterial(id){location.hash=`#material/${id}`;await refresh();}
content.addEventListener('change',event=>{if(event.target.dataset.select){if(event.target.checked)state.selected.add(event.target.dataset.select);else state.selected.delete(event.target.dataset.select);const button=content.querySelector('[data-start]');button.textContent=`开启 ${state.selected.size} 个独立任务`;button.disabled=!state.selected.size;}});
content.addEventListener('input',event=>{const form=event.target.closest('form[data-inline-plan]');if(form)capturePlanDraft(form);});
content.addEventListener('change',event=>{const form=event.target.closest('form[data-inline-plan]');if(form)capturePlanDraft(form);});
content.addEventListener('submit',async event=>{
 const form=event.target.closest('form[data-inline-plan]');if(!form)return;event.preventDefault();if(busy)return;
 const key=form.dataset.inlinePlan,draft=capturePlanDraft(form),errorView=form.querySelector('[data-plan-error]'),buttons=form.querySelectorAll('button');errorView.hidden=true;
 try{
  const seconds=periodSeconds(draft.value,draft.unit),plan=state.plans.find(item=>item.catalog_key===key);if(!plan)throw new Error('计划尚未读取，请刷新后重试。');
  buttons.forEach(button=>button.disabled=true);
  await send(api.command(`/api/v1/l0/schedules/${encodeURIComponent(key)}`,'PATCH',{enabled:plan.enabled,interval_seconds:seconds,expected_updated_at:draft.revision}));notice(`执行周期已保存为 ${formatPeriod(seconds)}。`);await refresh();
 }catch(error){
  errorView.hidden=false;errorView.textContent=error instanceof RangeError?error.message:error.code?explain(error):error.message;
  if(error.code==='SCHEDULE_VERSION_CHANGED'){const reset=document.createElement('button');reset.type='button';reset.className='link-button';reset.dataset.planReset=key;reset.textContent='重新读取计划';errorView.append(' ',reset);}
 }finally{buttons.forEach(button=>button.disabled=false);}
});
content.addEventListener('submit',event=>{if(event.target.id==='source-query'){event.preventDefault();const data=new FormData(event.target);state.query=String(data.get('query')||'');state.tier=String(data.get('tier')||'');render();}});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button||busy)return;const d=button.dataset;
 try{
  if('close'in d){closeDialog();return;}
  if('replay'in d&&pending){await send(pending);notice('原操作已核对。');await refresh();return;}
  if(button.id==='refresh'){await refresh();return;}
  if('taskFirst'in d||'taskPrev'in d||'taskNext'in d){const q=taskQuery();q.set('offset',String('taskFirst'in d?0:'taskPrev'in d?Math.max(0,state.taskPage.offset-state.taskPage.limit):state.taskPage.next_offset));location.hash=`${route()}?${q}`;return;}
  if('back'in d){if(state.candidate)state.candidate=null;else if(state.material){state.material=null;location.hash='#intake-tasks';}else state.detail=null;++serial;render();return;}
  if(d.planReset){planDrafts.delete(d.planReset);await refresh();return;}
  if(d.planToggle){const plan=state.plans.find(item=>item.catalog_key===d.planToggle);if(!plan)throw new Error('计划尚未读取，请刷新后重试。');button.disabled=true;await send(api.command(`/api/v1/l0/schedules/${encodeURIComponent(d.planToggle)}`,'PATCH',{enabled:d.enabled==='true',interval_seconds:plan.interval_seconds,expected_updated_at:d.revision}));notice(d.enabled==='true'?'任务计划已启用。':'任务计划已暂停。');await refresh();return;}
  if(d.sourceView){state.sourceView=d.sourceView;try{sessionStorage.setItem('riskhot-source-grouping',state.sourceView);}catch{}render();return;}
  if(d.sourceGroups){for(const group of content.querySelectorAll('details.source-group'))group.open=d.sourceGroups==='expand';return;}
  if(d.sourceTasks){state.detail=null;state.material=null;state.candidate=null;location.hash=`#intake-tasks?source=${encodeURIComponent(d.sourceTasks)}`;return;}
  if(d.task){const run=++serial,value=await api.get(`/api/v1/l0/tasks/${d.task}`);if(run!==serial)return;state.detail=value;state.material=null;render();return;}
  if(d.material){await readMaterial(d.material);return;}
  if(d.candidate){const run=++serial,value=await api.get(`/api/v1/l0/candidates/${d.candidate}`);if(run!==serial)return;state.candidate=value;render();return;}
  if('start'in d){button.disabled=true;const result=await send(api.command('/api/v1/l0/tasks','POST',{source_keys:[...state.selected],limit:1}));notice(result.items.map(item=>`${state.sources.find(s=>s.catalog_key===item.source_key)?.name||item.source_key}：${item.accepted?'已受理':explain(item.error.code)}`).join('；'));await refresh();return;}
  if('createSource'in d||d.editSource){const source=state.sources.find(s=>s.catalog_key===d.editSource);openDialog(source?'编辑信源档案':'登记信源',sourceForm(source),{kind:'source',source});return;}
  if(d.sourceState){const source=state.sources.find(s=>s.catalog_key===d.sourceState);openDialog(source.state==='ACTIVE'?'停用信源':'启用信源','<label class="field">变更理由<input name="reason" required maxlength="2000"></label>',{kind:'source-state',source});return;}
  if(d.control){openDialog('调整当前任务','<label class="field">操作理由<input name="reason" required maxlength="2000"></label>',{kind:'control',action:d.control});return;}
  if('retryExtraction'in d||'retryCandidate'in d){openDialog('授权恢复',`<label class="field">恢复依据<input name="reason" required maxlength="2000"></label>${can('model_budget')?'<label><input name="open_budget" type="checkbox">预算耗尽时授权新窗口</label>':''}`,{kind:'retry',candidate:'retryCandidate'in d});return;}
  if(d.review){const scope=d.review;openDialog(scope==='commit'?'最终审批并保存':scope==='disposition'?'确认不构成事件':'复核当前建议','<p>请先阅读该候选的步骤结果与引文依据，提交后按当前版本执行。</p><label class="field">核对理由<input name="reason" required maxlength="2000"></label>',{kind:'review',scope,decision:d.decision});return;}
  if('startEvents'in d){const settings=await api.get('/api/v1/l0/event-settings');if(!settings.definitions.length){notice('尚无可用的观测定义集，请先完成定义配置。',true);return;}openDialog('启动当前资料的事件处理',`<label class="field">观测定义集<select name="definition_ref">${settings.definitions.map(x=>`<option value="${e(x.ref)}">${e(x.ref)} · ${e(x.version)}</option>`).join('')}</select></label><label class="field">观察范围<input name="jurisdiction" required maxlength="200"></label><label class="field">研究期限<input name="term" required maxlength="200"></label><label class="field">处理依据<input name="reason" required maxlength="2000"></label>`,{kind:'start-events',settings});}
 }catch(error){if(!pending)notice(explain(error),true);}finally{button.disabled=false;}
});
modal.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!dialog)return;const form=event.target,data=new FormData(form),context=dialog;const confirm=form.querySelector('[type="submit"]');confirm.disabled=true;
 try{
  let command;
  if(context.kind==='source'){const profile={};for(const [field]of profileFields){const value=String(data.get(field)||'').trim();profile[field]=['dims','levels'].includes(field)?value.split(/[、,]/).map(x=>x.trim()).filter(Boolean):value;}command=api.command(context.source?`/api/v1/m1/sources/${context.source.catalog_key}`:'/api/v1/m1/sources',context.source?'PUT':'POST',{profile,...(context.source?{expected_updated_at:context.source.updated_at}:{})});}
  if(context.kind==='source-state')command=api.command(`/api/v1/m1/sources/${context.source.catalog_key}`,'PATCH',{state:context.source.state==='ACTIVE'?'DISABLED':'ACTIVE',expected_updated_at:context.source.updated_at,reason:data.get('reason')});
  if(context.kind==='control')command=api.command(`/api/v1/l0/tasks/${state.detail.task.id}/control`,'POST',{action:context.action,control_revision:Number(state.detail.task.control_revision),reason:data.get('reason')});
  if(context.kind==='retry'){if(context.candidate)command=api.command(`/api/v1/l0/candidates/${state.candidate.candidate.id}/retry`,'POST',{resume_token:state.candidate.resume_token,reason:data.get('reason'),open_budget:data.has('open_budget')});else command=api.command(`/api/v1/l0/material/${state.material.material.id}/extraction/retry`,'POST',{version:state.material.material.version,content_digest:state.material.material.content_digest,reason:data.get('reason'),open_budget:data.has('open_budget')});}
  if(context.kind==='review'){const c=state.candidate;command=api.command(`/api/v1/l0/candidates/${c.candidate.id}/reviews`,'POST',{scope:context.scope,proposal_generation:Number(c.candidate.proposal_generation),proposal_digest:c.review_bases[context.scope],decision:context.decision||(context.scope==='disposition'?'CONFIRM_NOT_EVENT':'APPROVE'),reason:data.get('reason')});}
  if(context.kind==='start-events')command=api.command(`/api/v1/l0/material/${state.material.material.id}/events/start`,'POST',{task_manifest_id:context.settings.task_manifest_id,definition_ref:data.get('definition_ref'),assessment_scope:{jurisdiction:data.get('jurisdiction')},research_horizon:{term:data.get('term')},method_version:context.settings.method_version,reason:data.get('reason')});
  await send(command);closeDialog();notice('操作已受理。');await refresh();
 }catch(error){const target=modal.querySelector('#dialog-error');target.hidden=false;target.textContent=explain(error);}finally{confirm.disabled=false;}
});
modal.addEventListener('cancel',()=>{dialog=null;returnFocus?.focus();});
window.addEventListener('hashchange',()=>{state.detail=null;state.material=null;state.candidate=null;++serial;refresh();});
document.querySelector('#logout')?.addEventListener('click',async()=>{await fetch('/auth/logout',{method:'POST',credentials:'same-origin'});location.reload();});
setInterval(()=>{if(!document.hidden&&!modal.open&&!busy&&!content.contains(document.activeElement))refresh();},15000);
refresh();
