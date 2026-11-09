import {createClient} from './api.js';
import * as v from './m4-view.js';
const api=createClient(),content=document.querySelector('#m4-content'),notice=document.querySelector('#m4-notice'),modal=document.querySelector('#m4-dialog'),modalBody=document.querySelector('#m4-dialog-body');
const isObservation=location.pathname==='/targets';
let serial=0,dialogSerial=0,previewSerial=0,data=null,detail=null,tab='definition',dirty=false,actor='',pending=null,activeHash=location.hash,impactSave=null,selectorData=null,selectorQuery={},selected=new Map(),mappingTargets=null,mappingTarget=null,dialogContext=null;
const defaultRoute=isObservation?'observations':'configs';
const parse=()=>{const [path,query]=location.hash.slice(1).split('?');return {path:path||defaultRoute,q:Object.fromEntries(new URLSearchParams(query??''))};};
const storageKey=()=>`riskhot-m4:${actor}`;
function readPending(){try{const p=JSON.parse(sessionStorage.getItem(storageKey()));if(p&&p.command?.url?.startsWith('/api/v1/m4/')&&['POST','PUT'].includes(p.command.method)&&typeof p.command.body==='string')return p;}catch{}return null;}
function remember(){try{if(pending)sessionStorage.setItem(storageKey(),JSON.stringify(pending));else sessionStorage.removeItem(storageKey());}catch{}}
function inform(message,error=false){notice.hidden=false;notice.className='feedback'+(error?' error':'');notice.textContent=message;if(pending){const b=document.createElement('button');b.className='secondary';b.textContent='重试上次操作';b.dataset.action='retry-command';notice.append(document.createElement('br'),b);}}
function showError(error){if(error.status===401||error.status===403){dirty=false;clearSensitive();content.innerHTML='';render();return;}const target=modal.open?modal.querySelector('.dialog-error'):content.querySelector('#form-error');if(target){target.hidden=false;target.textContent=v.errorMessage(error);target.focus();}else inform(v.errorMessage(error),true);}
function commandLocked(){return Boolean(pending);}
function openDialog(title,body,footer,wide=false){dialogSerial++;modal.classList.toggle('wide',wide);modalBody.innerHTML=v.dialog(title,body,footer);if(!modal.open)modal.showModal();}
function closeDialog(){dialogSerial++;previewSerial++;modal.close();dialogContext=null;}
modal.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
function clearSensitive(){closeDialog();modalBody.innerHTML='';selected.clear();selectorData=null;mappingTargets=null;mappingTarget=null;detail=null;}
function queryString(q){return new URLSearchParams(Object.entries(q).filter(([,value])=>value!==undefined&&value!==null&&value!=='')).toString();}
function go(path,q={}){const next=v.route(path,q);if(location.hash===next)render();else location.hash=next;}
const baseValues=c=>Object.fromEntries(['entry_kind','parent_id','name','sort_order','aliases','categories','category_version','jurisdiction_mode','jurisdiction','scope_definition','status'].map(k=>[k,c[k]]));
async function render(){
 const run=++serial,r=parse();closeDialog();let nextData=null,nextDetail=null;activeHash=location.hash;content.setAttribute('aria-busy','true');content.innerHTML='<div class="empty" role="status">正在读取…</div>';detail=null;
 try{
  const session=await api.get('/api/v1/session');if(run!==serial)return;if(actor!==session.actor){actor=session.actor;pending=readPending();}
  const observationRoute=r.path.startsWith('observation');document.querySelector('#m4-module').textContent=observationRoute?'观测对象':'金融对象配置中心';document.querySelector('#m4-location').textContent=observationRoute?'RiskHot / 内容 /':'RiskHot / 配置 /';
  document.querySelectorAll('.sidebar a[aria-current]').forEach(e=>e.removeAttribute('aria-current'));document.querySelector(`.sidebar a[href="${observationRoute?'/targets':'/m4'}"]`)?.setAttribute('aria-current','page');
  if(r.path.startsWith('observation/')){nextDetail=await api.get('/api/v1/m4/observations/'+r.path.split('/')[1]+'?'+queryString(r.q));if(run!==serial)return;content.innerHTML=v.observationDetail(nextDetail,r.q);}
  else if(r.path==='observations'){nextData=await api.get('/api/v1/m4/observations?'+queryString(r.q));if(run!==serial)return;content.innerHTML=v.observations(nextData,r.q);}
  else {
   nextData=await api.get('/api/v1/m4/configs?'+queryString(r.path.startsWith('new/')||r.path.startsWith('edit/')?{limit:'1'}:r.q));if(run!==serial)return;
   if(r.path.startsWith('edit/')){nextDetail=await api.get('/api/v1/m4/configs/'+r.path.split('/')[1]);if(run!==serial)return;content.innerHTML=nextData.permissions.financial_config_manage?v.editor(nextData,nextDetail.config):v.empty('没有配置维护权限','当前账号仅可阅读。');}
   else if(r.path.startsWith('new/'))content.innerHTML=nextData.permissions.financial_config_manage?v.editor(nextData,null,r.path.split('/')[1],r.q.parent):v.empty('没有配置维护权限','当前账号仅可阅读。');
   else{if(r.path.startsWith('config/'))nextDetail=await api.get('/api/v1/m4/configs/'+r.path.split('/')[1]);if(run!==serial)return;content.innerHTML=v.catalog(nextData,r.q,nextDetail,tab);}
  }
  data=nextData;detail=nextDetail;
  if(pending)inform('上次操作结果尚未确认。请按原请求重试，确认后再开始新的修改。',true);
 }catch(error){if(run!==serial)return;const auth=error.status===401||error.status===403;content.innerHTML=`<div class="panel read-error"><h2>${auth?'无法访问此页面':'暂时无法读取'}</h2><p>${auth?'当前账号没有读取权限，请检查登录与授权。':'读取失败不会改变已保存的数据。请稍后重新读取。'}</p><button class="secondary" data-action="reload">重新读取</button></div>`;if(auth){clearSensitive();notice.hidden=true;}}
 finally{if(run===serial){content.setAttribute('aria-busy','false');content.dataset.route=location.hash;}}
}
async function execute(command,after='auto'){
 if(commandLocked()){inform('请先确认上次操作的结果，再开始新的修改。',true);return;}
 pending={command,after,...(command.url.endsWith('/observations/batch')?{selection:[...selected.values()]}:{})};remember();return sendPending();
}
async function sendPending(){
 if(!pending)return;const saved=pending,owner=actor;const buttons=[...document.querySelectorAll('#config-form button,#m4-dialog button')];buttons.forEach(b=>b.disabled=true);
 try{
  const result=await api.send(saved.command);if(owner!==actor)return;pending=null;remember();dirty=false;notice.hidden=true;
  if(result.results){
   if(result.results.some(item=>[401,403].includes(item.error?.status))){const succeeded=result.results.filter(item=>['added','exists'].includes(item.outcome)).length;clearSensitive();await render();inform(`当前权限已变化，已撤回原选择。${succeeded?`本次已有 ${succeeded} 项成功或已存在，结果已保留。`:'本次没有新增观察。'}`,true);return;}
   const submitted=new Map((saved.selection??[...selected.values()]).map(c=>[c.id,c]));
   for(const item of result.results)if(['added','exists','restore_required'].includes(item.outcome)||['M4_VERSION_CONFLICT','M4_CONFIG_UNAVAILABLE'].includes(item.error?.code))selected.delete(item.config_id);
   const rows=result.results.map(item=>{const title=submitted.get(item.config_id)?.name??item.config_id;return `<li><strong>${v.esc(title)}</strong>：${item.outcome==='added'?'已添加':item.outcome==='exists'?'已在观察':item.outcome==='restore_required'?'请恢复原观察':v.esc(v.errorMessage(item.error))}${item.outcome==='restore_required'?` <a href="/targets#observation/${item.observation.id}">查看原观察</a>`:''}</li>`;}).join('');
   await render();openDialog('本次添加结果',`<ul class="pending-list">${rows}</ul><p class="muted">成功项已保存。定义已变化或不可用的失败项已取消选择，请重新核对最新定义后重选；其他失败项保留选择。</p>`,`<button class="secondary" data-action="selector-back">返回选择</button><button class="primary" data-action="batch-finish">完成</button>`);return;
  }
  closeDialog();inform(result.outcome==='exists'?'该对象已在共享观察中。':result.outcome==='restore_required'?'已保留原观察，请核对后恢复。':result.changed===false?'内容没有变化，已保留当前版本。':'操作已保存。');
  if(result.observation)go('observation/'+result.observation.id);else if(result.config)go('config/'+result.config.id);else if(result.mapping){tab='mapping';go('config/'+result.mapping.config_id);}else await render();
 }catch(error){
  if(owner!==actor)return;
  if(error.code==='OUTCOME_UNKNOWN'||error.command||!error.status||error.status>=500){inform('操作结果尚未确认。请重试原请求，系统会避免重复写入。',true);if(modal.open){const box=modal.querySelector('.dialog-error');box.hidden=false;box.textContent='结果尚未确认，请关闭此窗口后使用页面上的“重试上次操作”。';modal.querySelector('[data-action="close-dialog"]').disabled=false;}return;}
  pending=null;remember();if(error.status===401||error.status===403){dirty=false;clearSensitive();content.innerHTML='';await render();inform('当前权限已变化，已重新读取可用操作。',true);return;}showError(error);
 }finally{if(!pending)buttons.forEach(b=>b.disabled=false);}
}
async function saveConfig(input,id){
 if(commandLocked())return inform('请先确认上次操作。',true);
 if(id){
  const run=serial,dialogRun=dialogSerial;
  try{const impact=await api.send(api.command(`/api/v1/m4/configs/${id}/impact`,'POST',input));if(run!==serial||dialogRun!==dialogSerial)return;
   if(impact.observations.length||impact.mappings.length||impact.affected_configs.length){impactSave={id,input:{...input,impact_token:impact.impact_token}};openDialog('确认本次修改影响',`<p>修改将同步处理以下记录。已经手工暂停或结束的观察保持原状态。</p><ul class="pending-list">${impact.affected_configs.map(c=>`<li>${v.esc(c.name)}：${v.esc(c.unavailable_reason??'恢复可选资格')}</li>`).join('')}${impact.observations.map(o=>`<li>${v.esc(o.name)}：暂停观察 · ${v.labels[o.pause_reason]}</li>`).join('')}${impact.mappings.map(()=>'<li>现有映射将置为待重新核定。</li>').join('')}</ul><p class="notice warning">重新启用配置不会自动恢复观察；恢复时需要重新核对。</p>`,`<button class="secondary" data-action="close-dialog">返回核对</button><button class="primary" data-action="confirm-impact">确认并保存</button>`);return;}
   await execute(api.command(`/api/v1/m4/configs/${id}`,'PUT',{...input,impact_token:impact.impact_token}));
  }catch(e){if(run===serial&&dialogRun===dialogSerial)showError(e);}
 }else await execute(api.command('/api/v1/m4/configs','POST',input));
}
async function selector(q=selectorQuery){
 const run=++dialogSerial,pageRun=serial;
 try{const result=await api.get('/api/v1/m4/configs?'+queryString({...q,limit:'20'}));if(run!==dialogSerial||pageRun!==serial)return;selectorQuery=q;selectorData=result;const items=selectorData.items;
  openDialog('从对象目录树添加观察',`<p class="muted">只选择具体金融对象。每次添加都会影响系统共享观察清单，一次最多选择100项。</p><form id="selector-search" class="query"><label>分组节点<select name="parent_id">${v.parentOptions(selectorData.directories,q.parent_id,true).replace('根节点','全部分组')}</select></label><label><span class="sr-only">搜索可选对象</span><input type="search" name="q" aria-label="搜索可选对象" placeholder="名称或别名" value="${v.esc(q.q)}"></label><button class="secondary">搜索</button></form><div class="selector-shell"><aside class="directory-pane"><div class="directory-heading"><strong>对象目录树</strong><button class="directory-mobile" data-action="toggle-tree">展开 / 收起</button></div><div class="directory-tree"><button class="tree-node" data-action="selector-directory" data-id="">全部配置</button>${v.tree(selectorData.tree_nodes,null,q.parent_id,new Set(),true)}</div></aside><div class="selector-layout"><section>${items.map(c=>`<div class="selector-row"><div><label class="check-label"><input type="checkbox" data-select="${c.id}" ${selected.has(c.id)?'checked':''} ${c.unavailable_reason||c.observation?'disabled':''}><strong>${v.esc(c.name)}</strong>${v.state(c.status)}</label><p class="scope-text">${v.esc(c.scope_definition??'分组节点')}</p><p class="muted">${v.esc(c.unavailable_reason??(c.observation?c.observation.state==='active'?'已在观察':'已有原观察，请恢复':'可添加观察'))}</p><button data-action="selector-preview" data-id="${c.id}">核对范围</button>${c.observation&&c.observation.state!=='active'?`<a href="/targets#observation/${c.observation.id}">恢复原观察</a>`:''}</div></div>`).join('')||v.empty('没有匹配的配置','可调整筛选，或到配置中心建立对象。')}${v.pager(selectorData,'selector-page')}</section><aside class="selector-preview" id="selector-preview"><h3>范围核对</h3><p class="muted">点击“核对范围”查看对象的完整定义，再勾选加入观察。</p></aside></div></div>`,`<span id="selected-count">已选 ${selected.size} 项</span><button class="secondary" data-action="close-dialog">取消</button><button class="primary" data-action="submit-selection" ${!selected.size?'disabled':''}>添加所选观察</button>`,true);
 }catch(e){if(run===dialogSerial&&pageRun===serial)showError(e);}
}
async function mapping(q={}){
 const run=++dialogSerial,pageRun=serial,config=detail.config;
 try{const result=await api.get('/api/v1/targets?'+queryString({...q,limit:'10',status:'active'}));if(run!==dialogSerial||pageRun!==serial)return;mappingTargets=result;mappingTarget=null;
 openDialog('核定事件对象同一性',`<p class="notice">核对范围与辖区，不以名称相似判定。同一映射只显示直接关联动态。</p><form id="mapping-search" class="query"><input type="search" name="q" aria-label="搜索事件对象" placeholder="事件对象名称或别名" value="${v.esc(q.q)}"><button class="secondary">搜索</button></form><div class="comparison"><section><h3>配置对象：${v.esc(detail.config.name)}</h3>${v.definition(detail.config)}</section><section><h3>选择事件对象</h3>${mappingTargets.items.map(t=>`<div class="mapping-target"><label class="check-label"><input type="radio" name="target" value="${t.id}"><strong>${v.esc(t.target_name)}</strong></label><p class="muted">${v.esc(t.jurisdiction??'辖区未限定/待核对')}</p><p class="scope-text">${v.esc(t.scope_definition)}</p></div>`).join('')||'<p class="muted">尚无匹配Target。事件可正常保存，无需自动建立配置。</p>'}${v.pager(mappingTargets,'mapping-page')}</section></div><label class="check-label"><input type="checkbox" id="identity-confirmed">我已核对双方身份、范围、辖区一致，且不存在总体/子集、期限等歧义。</label><label class="field">核定依据<textarea id="mapping-reason" maxlength="2000" placeholder="说明范围与辖区如何对应。请勿在共享说明中写入受限来源原文。"></textarea></label>`,`<button class="secondary" data-action="mapping-conflict">记录冲突</button><button class="primary" data-action="mapping-approve">核定为同一对象</button>`,true);dialogContext={mappingQuery:q,config};
 }catch(e){if(run===dialogSerial&&pageRun===serial)showError(e);}
}
function observationAction(action,source=detail){
 const o=source.observation,c=source.config;dialogContext={action,o,c};
 const name={pause:'暂停观察',end:'结束观察',restore:'恢复原观察',note:'编辑观察备注'}[action];
 openDialog(name,`${action==='restore'?`<div class="comparison"><section><h3>原采用定义</h3>${v.definition(source.adopted_snapshot.payload.config)}</section><section><h3>本次采用定义</h3>${v.definition(c)}</section></div><p class="notice warning">确认后采用当前配置 V${c.config_version}，原采用记录继续保留。</p>`:`<p>${v.esc(c.name)} · 此操作对所有账号共享生效。</p>`}${action==='note'?`<label class="field">观察备注<textarea id="observation-note" maxlength="8000">${v.esc(o.note)}</textarea></label>`:''}<label class="field">操作说明<textarea id="action-reason" required maxlength="2000"></textarea></label>`,`<button class="secondary" data-action="close-dialog">取消</button><button class="primary" data-action="confirm-observation">确认${name}</button>`,action==='restore');
}
content.addEventListener('submit',async event=>{
 event.preventDefault();const f=event.target,r=parse(),form=new FormData(f);
 if(f.id==='event-date-filter'){go(r.path,Object.fromEntries([...form].filter(([,value])=>value)));return;}
 if(f.id==='m4-search'){go(r.path,{...r.q,...Object.fromEntries(form),offset:'0'});return;}
 if(f.id!=='config-form')return;
 const c=detail?.config,kind=c?.entry_kind??r.path.split('/')[1],categories=form.getAll('categories').filter(Boolean).map(s=>JSON.parse(s));
 const input={entry_kind:kind,parent_id:c?.parent_id??(form.get('parent_id')||null),name:form.get('name'),sort_order:form.get('sort_order'),aliases:kind==='object'?String(form.get('aliases')??'').split('\n').map(s=>s.trim()).filter(Boolean):[],categories:kind==='object'?categories:[],category_version:categories.length?data.category_version:null,jurisdiction_mode:form.get('jurisdiction_mode'),jurisdiction:form.get('jurisdiction_mode')==='specified'?String(form.get('jurisdiction')).trim()||null:null,scope_definition:String(form.get('scope_definition')).trim()||null,status:form.get('status'),reason:form.get('reason'),...(c?{expected_config_version:c.config_version,same_identity:form.get('same_identity')==='on'}:{})};
 await saveConfig(input,c?.id);
});
modal.addEventListener('submit',event=>{event.preventDefault();const form=Object.fromEntries(new FormData(event.target));if(event.target.id==='selector-search')selector({...form,offset:'0'});if(event.target.id==='mapping-search')mapping({...form,offset:'0'});});
document.addEventListener('change',event=>{
 const e=event.target;if(e.name==='primary-category'||e.name==='secondary-category'){const row=e.closest('.category-line'),primary=row.querySelector('[name=primary-category]'),secondary=row.querySelector('[name=secondary-category]');if(e===primary)secondary.innerHTML=v.options(data.category_catalog[primary.value]??[],'','请选择二级分类');row.querySelector('[name=categories]').value=primary.value&&secondary.value?JSON.stringify({primary_category:primary.value,secondary_category:secondary.value}):'';}if(e.matches('[data-select]')){const c=selectorData.items.find(c=>c.id===e.dataset.select);if(e.checked&&selected.size>=100&&!selected.has(c.id)){e.checked=false;const box=modal.querySelector('.dialog-error');box.hidden=false;box.textContent='一次最多选择100项，请先提交当前选择，再添加其他对象。';return;}if(e.checked)selected.set(c.id,c);else selected.delete(c.id);modal.querySelector('#selected-count').textContent=`已选 ${selected.size} 项`;modal.querySelector('[data-action="submit-selection"]').disabled=!selected.size;}
 if(e.name==='target')mappingTarget=mappingTargets.items.find(t=>t.id===e.value);
 if(e.closest('#config-form'))dirty=true;
});
content.addEventListener('input',event=>{if(event.target.closest('#config-form'))dirty=true;});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,r=parse();
 try{
  if(action==='reload')return render();if(action==='retry-command')return sendPending();if(action==='close-dialog')return closeDialog();
  if(action==='directory'){event.preventDefault();return go('configs',{...r.q,parent_id:button.dataset.id,offset:'0'});}
  if(action==='clear-event-dates')return go(r.path);
  if(action==='select-config'){tab='definition';return go('config/'+button.dataset.id,r.q);}if(action==='clear')return go(r.path);if(action==='page'||action==='event-page')return go(r.path,{...r.q,offset:button.dataset.offset});
  if(action==='toggle-tree')return button.closest('.directory-pane').classList.toggle('collapsed');
  if(action==='tab'){tab=button.dataset.tab;content.querySelector('#config-detail').innerHTML=v.configDetail(detail,tab);content.querySelector(`#tab-${tab}`).focus();return;}
  if(action==='add-category'){content.querySelector('#category-rows').insertAdjacentHTML('beforeend',v.categoryRow(data.category_catalog));dirty=true;return;}if(action==='remove-category'){button.closest('.category-line').remove();dirty=true;return;}
  if(action==='confirm-impact'){const {id,input}=impactSave;return execute(api.command(`/api/v1/m4/configs/${id}`,'PUT',input));}
  if(action==='config-status'){dialogContext={config:detail.config};return openDialog(detail.config.status==='active'?'停用配置':'启用配置','<label class="field">操作说明<textarea id="action-reason" maxlength="2000" required></textarea></label>','<button class="secondary" data-action="close-dialog">取消</button><button class="primary" data-action="confirm-config-status">预览并确认</button>');}
  if(action==='confirm-config-status'){const c=dialogContext.config;return saveConfig({...baseValues(c),status:c.status==='active'?'disabled':'active',reason:modal.querySelector('#action-reason').value,expected_config_version:c.config_version},c.id);}
  if(action==='move'){const c=detail.config;dialogContext={config:c};return openDialog('移动与排序',`<p class="notice">移动只调整组织位置。移入未启用分支时，系统将先显示观察影响。</p><label class="field">目标分组节点<select id="move-parent">${v.parentOptions(data.directories.filter(d=>d.id!==c.id),c.parent_id,c.entry_kind==='directory')}</select></label><label class="field">排序<input id="move-order" inputmode="numeric" value="${c.sort_order}"></label><label class="field">调整说明<textarea id="action-reason" maxlength="2000"></textarea></label>`,'<button class="secondary" data-action="close-dialog">取消</button><button class="primary" data-action="confirm-move">预览并确认</button>');}
  if(action==='confirm-move'){const c=dialogContext.config;return saveConfig({...baseValues(c),parent_id:modal.querySelector('#move-parent').value||null,sort_order:modal.querySelector('#move-order').value,reason:modal.querySelector('#action-reason').value,expected_config_version:c.config_version},c.id);}
  if(action==='selector'){selected=new Map();return selector({});}if(action==='selector-back')return selector();if(action==='selector-page')return selector({...selectorQuery,offset:button.dataset.offset});
  if(action==='selector-directory')return selector({...selectorQuery,parent_id:button.dataset.id,offset:'0'});
  if(action==='selector-tree-object'){const run=++previewSerial,dialogRun=dialogSerial;const c=(await api.get('/api/v1/m4/configs/'+button.dataset.id)).config;if(run!==previewSerial||dialogRun!==dialogSerial||!modal.open)return;modal.querySelector('#selector-preview').innerHTML=`<h3>${v.esc(c.name)}</h3>${v.definition(c)}`;return;}
  if(action==='selector-preview'){previewSerial++;const c=selectorData.items.find(c=>c.id===button.dataset.id);modal.querySelector('#selector-preview').innerHTML=`<h3>${v.esc(c.name)}</h3>${v.definition(c)}`;return;}
  if(action==='submit-selection')return execute(api.command('/api/v1/m4/observations/batch','POST',{items:[...selected.values()].map(c=>({config_id:c.id,expected_config_version:c.config_version,reason:'在共享观察选择器核对范围后添加'}))}));
  if(action==='batch-finish'){closeDialog();return go('observations');}
  if(action==='quick-observe'){if(detail.observation){const run=serial,dialogRun=++dialogSerial,source=await api.get('/api/v1/m4/observations/'+detail.observation.id);if(run===serial&&dialogRun===dialogSerial)observationAction('restore',source);return;}return execute(api.command('/api/v1/m4/observations','POST',{config_id:detail.config.id,expected_config_version:detail.config.config_version,reason:'核对配置定义后添加共享观察'}));}
  if(action.startsWith('observation-'))return observationAction(action.slice(12));
  if(action==='confirm-observation'){const {o,c,action:op}=dialogContext;return execute(api.command('/api/v1/m4/observations/'+o.id,'PUT',{action:op,expected_version:o.version,reason:modal.querySelector('#action-reason').value,...(op==='restore'?{expected_config_version:c.config_version}:{}),...(op==='note'?{note:modal.querySelector('#observation-note').value}:{})}));}
  if(action==='mapping')return mapping();if(action==='mapping-page')return mapping({...dialogContext.mappingQuery,offset:button.dataset.offset});
  if(action==='mapping-approve'||action==='mapping-conflict'){if(!mappingTarget)return showError({code:'M4_IDENTITY_UNCONFIRMED'});return execute(api.command('/api/v1/m4/mappings','POST',{config_id:dialogContext.config.id,target_id:mappingTarget.id,expected_config_version:dialogContext.config.config_version,expected_target_version:String(mappingTarget.definition_version),decision:action==='mapping-approve'?'approve':'conflict',identity_confirmed:modal.querySelector('#identity-confirmed').checked,reason:modal.querySelector('#mapping-reason').value}));}
  if(action==='revoke-mapping'){const m=detail.mappings.find(m=>m.id===button.dataset.id);dialogContext={mapping:m,config:detail.config};return openDialog('撤销映射',`${v.mappingDefinition(m)}<label class="field">撤销依据<textarea id="action-reason" maxlength="2000"></textarea></label>`,'<button class="secondary" data-action="close-dialog">取消</button><button class="danger" data-action="confirm-revoke">确认撤销</button>');}
  if(action==='confirm-revoke'){const {mapping:m,config:c}=dialogContext,run=dialogSerial,reason=modal.querySelector('#action-reason').value,t=await api.get('/api/v1/targets/'+m.target_id);if(run!==dialogSerial)return;return execute(api.command('/api/v1/m4/mappings','POST',{config_id:m.config_id,target_id:m.target_id,expected_config_version:c.config_version,expected_target_version:String(t.target.definition_version),decision:'revoke',identity_confirmed:false,reason,mapping_id:m.id,expected_version:m.version}));}
 }catch(e){showError(e);}
});
content.addEventListener('keydown',event=>{if(event.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...content.querySelectorAll('[role=tab]')],i=tabs.indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();});
document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(a?.classList.contains('skip')){event.preventDefault();document.querySelector('#m4-main').focus();return;}if(a&&dirty){if(!confirm('尚有未保存的内容，确定离开？')){event.preventDefault();event.stopImmediatePropagation();}else dirty=false;}if(a&&modal.open)closeDialog();},true);
document.querySelector('#m4-refresh').addEventListener('click',()=>{if(dirty&&!confirm('刷新会丢弃尚未保存的内容，确定刷新？'))return;dirty=false;render();});
window.addEventListener('beforeunload',event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',()=>{if(dirty&&!confirm('尚有未保存的内容，确定离开？')){history.replaceState(null,'',activeHash);return;}dirty=false;render();window.scrollTo(0,0);});
render();
