import {createClient} from './api.js';
import {targetRoute,targetHash,renderTargets,renderTargetDetail,renderTargetError,renderTargetForm,renderCategoryRow} from './targets-view.js';
const api=createClient(),content=document.querySelector('#target-content'),refresh=document.querySelector('#target-refresh');
const notice=document.createElement('section');notice.hidden=true;notice.setAttribute('role','status');content.before(notice);
let serial=0,current=null,actor='',pending=null,dirty=false,activeHash=location.hash,categoryIndex=0;
const storageKey=()=>`riskhot-target-save:${actor}`;
function storedCommand(){try{const value=JSON.parse(sessionStorage.getItem(storageKey()));if(value&&/^\/api\/v1\/targets(?:\/[a-f0-9-]{36})?$/.test(value.url)&&['POST','PUT'].includes(value.method)&&typeof value.key==='string'&&typeof value.body==='string')return value;}catch{}return null;}
function remember(){try{if(pending)sessionStorage.setItem(storageKey(),JSON.stringify(pending));else sessionStorage.removeItem(storageKey());}catch{}}
function inform(text,error=false){notice.hidden=false;notice.className=error?'feedback error target-command-notice':'target-save-feedback';notice.textContent=text;if(pending){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='重试上次保存';button.addEventListener('click',save);notice.append(document.createElement('br'),button);}}
function disableForm(value){for(const field of content.querySelectorAll('#target-definition-form input,#target-definition-form textarea,#target-definition-form select,#target-definition-form button'))field.disabled=value;}
async function render(){
 const run=++serial,requestedHash=location.hash,route=targetRoute(requestedHash);activeHash=requestedHash;
 content.setAttribute('aria-busy','true');content.innerHTML='<div class="loading" role="status">正在读取观测对象…</div>';
 try{
  const query=new URLSearchParams();query.set('offset',String(route.id?route.event_offset:route.offset));
  if(!route.id&&route.mode!=='new'){if(route.q)query.set('q',route.q);if(route.category)query.set('category',route.category);query.set('status',route.status);}
  if(route.mode==='new'){query.set('offset','0');query.set('limit','1');}
  const [data,session]=await Promise.all([api.get(`/api/v1/targets${route.id?'/'+encodeURIComponent(route.id):''}?${query}`),api.get('/api/v1/session')]);
  if(run!==serial)return;
  if(actor!==session.actor){actor=session.actor;pending=storedCommand();}
  current=data;categoryIndex=(data.target?.categories?.length??0)+1;
  content.innerHTML=route.mode!=='read'?renderTargetForm(data,route):route.id?renderTargetDetail(data,route):renderTargets(data,route);
  document.title=`${route.id?data.target.target_name+' · ':''}观测对象 · RiskHot`;
  if(pending){inform('上次保存结果尚未确认。请按原内容重试，确认后再开始新的修改。',true);disableForm(true);}
 }catch(error){if(run!==serial)return;content.innerHTML=renderTargetError(error);if(error.status===401||error.status===403){notice.hidden=true;}}
 finally{if(run===serial){content.dataset.targetRoute=requestedHash;content.setAttribute('aria-busy','false');}}
}
function search(form){const values=Object.fromEntries(new FormData(form)),next=targetHash({...values,offset:0});if(location.hash===next)render();else location.hash=next;}
const formMessages={TARGET_ALREADY_EXISTS:'此名称、地区与范围的对象已存在。请先返回目录搜索并核对已有对象。',TARGET_VERSION_CONFLICT:'对象已被其他操作更新。你的填写内容已保留，请复制需要的内容后刷新，核对最新版本再保存。',TARGET_ALIASES_INVALID:'别名不能重复或只包含空格，请核对后保存。',TARGET_DEFINITION_INVALID:'请补齐对象名称、明确范围、有效分类及保存说明。',IDEMPOTENCY_CONFLICT:'本次保存请求与原请求内容不一致，请刷新后核对保存结果。'};
async function save(){
 if(!pending)return;
 const command=pending,owner=actor;disableForm(true);notice.hidden=true;
 try{
  const result=await api.send(command);if(actor!==owner)return;pending=null;remember();dirty=false;
  inform(result.changed===false?'对象内容没有变化，已保留当前版本。':command.method==='POST'?'观测对象已创建。':'修改已保存，对象定义已更新为 V'+result.target.definition_version+'。');
  const route=targetRoute(location.hash),next=targetHash({...route,event_offset:0},result.target.id);if(location.hash===next)await render();else location.hash=next;
 }catch(error){
  if(actor!==owner)return;
  if(error.code==='OUTCOME_UNKNOWN'||error.command||!error.status||error.status>=500){inform('保存结果尚未确认，请按原内容重试。系统会复用同一次保存请求。',true);return;}
  pending=null;remember();disableForm(false);
  if(error.status===401||error.status===403){dirty=false;await render();return;}
  const box=content.querySelector('#target-form-error');const message=formMessages[error.code]??'保存未完成，请核对输入后重试。';
  if(box){box.hidden=false;box.textContent=message;box.focus();}else inform(message,true);
 }
}
content.addEventListener('submit',event=>{
 if(event.target.id==='target-search'){event.preventDefault();search(event.target);return;}
 if(event.target.id!=='target-definition-form')return;event.preventDefault();if(pending){inform('请先重试上次保存，确认结果后再提交新修改。',true);return;}
 const form=event.target,values=new FormData(form),route=targetRoute(location.hash);
 const body={target_name:String(values.get('target_name')).trim(),aliases:String(values.get('aliases')??'').split('\n').map(x=>x.trim()).filter(Boolean),categories:values.getAll('object-category').map(value=>JSON.parse(value)),jurisdiction:String(values.get('jurisdiction')??'').trim()||null,scope_definition:String(values.get('scope_definition')).trim(),is_active:values.get('is_active')==='true',reason:String(values.get('reason')).trim(),...(route.mode==='edit'?{expected_version:current.target.definition_version}:{})};
 pending=api.command(`/api/v1/targets${route.mode==='edit'?'/'+encodeURIComponent(route.id):''}`,route.mode==='edit'?'PUT':'POST',body);remember();save();
});
content.addEventListener('input',event=>{if(event.target.closest('#target-definition-form'))dirty=true;});
content.addEventListener('change',event=>{if(event.target.matches('#target-search select'))search(event.target.form);if(event.target.closest('#target-definition-form'))dirty=true;});
content.addEventListener('click',event=>{
 if(event.target.closest('[data-target-retry]'))render();
 if(event.target.closest('[data-target-clear]')){if(location.hash==='#targets')render();else location.hash='#targets';}
 if(event.target.closest('[data-add-category]')){content.querySelector('#target-category-rows').insertAdjacentHTML('beforeend',renderCategoryRow(current.category_catalog,{},categoryIndex++));dirty=true;}
 const remove=event.target.closest('[data-remove-category]');if(remove){const rows=content.querySelectorAll('.target-category-row');if(rows.length===1)rows[0].querySelector('select').value='';else remove.closest('.target-category-row').remove();dirty=true;}
});
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||!dirty)return;if(!confirm('尚有未保存的内容，确定离开当前表单？')){event.preventDefault();event.stopImmediatePropagation();}else dirty=false;},true);
refresh.addEventListener('click',()=>{if(dirty&&!confirm('刷新会丢弃尚未保存的填写内容，确定刷新？'))return;dirty=false;render();});
window.addEventListener('beforeunload',event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',()=>{if(dirty&&!confirm('尚有未保存的内容，确定离开当前表单？')){history.replaceState(null,'',activeHash);return;}dirty=false;render();window.scrollTo(0,0);});
render();
