import {renderEvent} from './event-view.js';
import {createClient} from './api.js';
import {escape as e,badge,dateTime,explain} from './model.js';
const api=createClient(),content=document.querySelector('#event-content'),feedback=document.querySelector('#event-feedback');
content.classList.add('current-view');
let serial=0,offset=0,page=null;
function message(error){feedback.hidden=false;feedback.textContent=error.status===401?'请先登录后查看事件。':`读取失败：${explain(error)}。请点击刷新状态重试。`;}
async function render(){
 const run=++serial,id=location.hash.startsWith('#event/')?location.hash.slice(7):null;
 try{
  if(id){const [result,deliveries,session]=await Promise.all([api.get(`/api/v1/events/${encodeURIComponent(id)}`),api.get(`/api/v1/l0/events/${encodeURIComponent(id)}/deliveries`),api.get('/api/v1/session')]);if(run!==serial)return;content.innerHTML=renderEvent(result,deliveries.items,session.permissions,'#events');return;}
  const result=await api.get(`/api/v1/events?offset=${offset}`);if(run!==serial)return;page=result;offset=result.offset;
  content.innerHTML=`<section class="panel"><div class="table-heading"><h2>正式事件</h2><span>${result.total??result.items.length} 条</span></div>${result.items.length?result.items.map(event=>`<article class="history-item"><div class="section-heading"><h3><a href="#event/${e(event.id)}">${e(event.title)}</a></h3>${badge(event.event_status)}</div><p class="material-text">${e(event.description)}</p><p class="muted">${e(event.display_time?dateTime(event.display_time):'展示时间待核实')} · ${e((event.sources||[]).map(s=>s.name).join('、')||'来源待核对')}</p><p class="muted">${e(event.display_time_reason||'')}</p></article>`).join(''):'<p class="empty">尚无已确认的正式事件。资料抽取和候选复核完成后，已批准的结果将在此显示。</p>'}${result.offset?'<button class="secondary" data-first>首页</button><button class="secondary" data-prev>上一页</button>':''}${result.next_offset!==null&&result.next_offset!==undefined?`<p class="muted">当前展示第 ${result.offset+1} 至 ${result.offset+result.items.length} 条。</p><button class="secondary" data-next>下一页</button>`:''}</section>`;
 }catch(error){message(error);}
}
content.addEventListener('click',event=>{if(event.target.closest('[data-back]'))location.hash='#events';if(event.target.closest('[data-next]')){offset=page.next_offset;render();}if(event.target.closest('[data-prev]')){offset=Math.max(0,page.offset-page.limit);render();}if(event.target.closest('[data-first]')){offset=0;render();}});
document.querySelector('#event-refresh').addEventListener('click',()=>{offset=0;render();});
window.addEventListener('hashchange',()=>{offset=0;render();});render();

let pendingDelivery=null;
content.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-delivery]');if(!form)return;event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;
 try{const data=new FormData(form),id=form.dataset.delivery;const command=api.command(`/api/v1/l0/event-deliveries/${id}/${form.dataset.files==='true'?'files/retry':'retry'}`,'POST',{consumer_id:form.dataset.consumer,expected_generation:Number(form.dataset.generation),reason:data.get('reason')});
 if(pendingDelivery&&(pendingDelivery.url!==command.url||pendingDelivery.body!==command.body))throw new Error('请先按原内容重试未确认的交付操作。');pendingDelivery=pendingDelivery||command;await api.send(pendingDelivery);pendingDelivery=null;feedback.hidden=false;feedback.textContent='恢复请求已受理。';await render();
 }catch(error){if(error.status&&error.status<500)pendingDelivery=null;feedback.hidden=false;feedback.textContent=`操作未完成：${explain(error)}。结果未确认时请保留原内容重试。`;}finally{button.disabled=false;}
});
