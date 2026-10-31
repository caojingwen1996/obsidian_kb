import {createClient} from './api.js';
import {escape as e} from './model.js';
export async function resolveEventRoute(api,hash){
 const params=new URLSearchParams(hash.replace(/^#/,''));
 if(params.has('candidate')){
  const candidate=await api.get(`/api/v1/l0/candidates/${encodeURIComponent(params.get('candidate'))}`);
  if(candidate.fact_id){
   const fact=await api.get(`/api/v1/l0/facts/${encodeURIComponent(candidate.fact_id)}`);
   return fact.events.length?`#event=${encodeURIComponent(fact.events[0].event_id)}`:`#fact=${encodeURIComponent(candidate.fact_id)}`;
  }
  return '#events';
 }
 if(params.has('processing')){
  const processing=await api.get(`/api/v1/l0/event-processings/${encodeURIComponent(params.get('processing'))}`);
  return `#information=${encodeURIComponent(processing.version_id)}`;
 }
 if(params.has('version'))return `#information=${encodeURIComponent(params.get('version'))}`;
 if(params.has('queue'))return '#events';
 return hash;
}
const stageName=value=>({expected:'预计发生',announced:'已宣布',in_progress:'实施中',effective:'已生效',completed:'已完成',cancelled:'已取消',unknown:'阶段未知'})[value]??'阶段未知';
export function renderFact(data){const f=data.fact;return `<section class="event-detail"><div class="section-heading"><h2>${e(f.title)}</h2><a href="#events">返回正式事件</a></div><p>${e(f.subject??'主体待确认')} · ${e(f.action??'行动待确认')} · ${e(stageName(f.event_status))}</p><p>发生时间：${e(f.event_time??'原文未明确')}</p><p class="event-description">${e(f.description)}</p><h3>事件归属</h3>${data.events.map(x=>`<a class="link-button" href="#event=${e(x.event_id)}">查看所属正式事件</a>`).join('')||'<p>尚未确认归属，保留为候选事实。</p>'}<h3>来源证据</h3>${data.evidence.map(x=>`<blockquote>${e(x.quote)}${Number.isInteger(x.material_version)?`<a class="link-button" href="/m1#material/${e(x.material_id)}">查看当前资料并核对版本（依据版本 ${x.material_version}）</a>`:`<a class="link-button" href="/api/v1/l0/versions/${e(x.information_version_id)}/raw" target="_blank" rel="noopener">查看对应版本原文</a>`}</blockquote>`).join('')}</section>`;}
function renderFinancialMeaning(r){const status=({draft:'草案',confirmed:'已确认',needs_reassessment:'待重新评价'})[r.rating_status]??'状态待确认';return `<article class="event-assessment">
 <div class="event-assessment-meta"><span>${e(Object.values(r.assessment_scope??{}).join(' / ')||'范围待确认')} · ${e(Object.values(r.research_horizon??{}).join(' / ')||'期限待确认')}</span><span>${e(status)} · ${r.m==null?'文字评价，未量化':`M ${e(r.m)}`}</span></div>
 <p class="event-meaning-summary">${e(r.reasoning_summary)}</p>
 ${(r.dimension_scores??[]).length?`<dl class="event-dimensions">${r.dimension_scores.map(d=>`<div><dt>${e(d.dimension_key)}</dt><dd>${e(d.reason)}</dd></div>`).join('')}</dl>`:''}
 ${(r.financial_usages??[]).length?`<h4>研究用途</h4><ul class="event-usages">${r.financial_usages.map(u=>`<li>${e(u)}</li>`).join('')}</ul>`:''}
 ${(r.limitations??[]).length?`<details class="event-limitations" data-disclosure="limitations-${e(r.id??'rating')}"><summary>评价依据与限制（${r.limitations.length}）</summary>${r.limitations.map(l=>`<p>${e(l)}</p>`).join('')}</details>`:''}</article>`;}
export function renderEvent(s,deliveries=[],permissions=[],returnHref='#events'){const v=s.event;return `<article class="event-detail event-record">
 <nav class="event-detail-nav" aria-label="事件详情导航"><a class="secondary" href="${e(returnHref)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7M5 12h14"/></svg>返回事件列表</a></nav>
 <section class="event-overview" aria-labelledby="formal-event-title"><h2 id="formal-event-title">${e(v.title)}</h2><p class="event-abstract" aria-label="事件摘要">${e(v.description)}</p><div class="event-overview-meta"><span>发生时间：${e(v.event_time??'原文未明确')}</span><span>${e(stageName(v.event_status))}</span></div></section>
 <section class="event-analysis" aria-label="主体、观测对象与金融意义"><div class="event-participants"><section aria-labelledby="event-subject-heading"><h3 id="event-subject-heading">主体 <span lang="en">Subject</span></h3><p class="event-subject">${e(v.subject??'主体待确认')}</p><p class="muted">实施行动的主体</p></section><section aria-labelledby="event-target-heading"><h3 id="event-target-heading">观测对象 <span lang="en">Target</span></h3>${s.targets.length?s.targets.map(t=>`<div class="event-target"><h4>${e((s.definitions??[]).find(d=>d.id===t.definition_snapshot_id)?.payload.name??'正式观测对象')}</h4><p>${e(t.relation_note)}</p></div>`).join(''):'<p class="event-target-empty">尚未确认观测对象</p><p class="muted">当前没有已保存的正式观测对象关联。</p>'}${s.variables.length?`<details data-disclosure="direct-variables"><summary>直接变量（${s.variables.length}）</summary>${s.variables.map(x=>`<p>${e((s.definitions??[]).find(d=>d.id===x.definition_snapshot_id)?.payload.name??'正式变量')} · ${e(x.description)}</p>`).join('')}</details>`:''}</section></div>
 <section class="event-meaning" aria-labelledby="event-meaning-heading"><h3 id="event-meaning-heading">金融意义</h3>${(s.ratings??[]).map(renderFinancialMeaning).join('')||'<p class="muted">尚无已保存的金融意义评价。</p>'}</section></section>
 <section class="event-related" aria-labelledby="event-related-heading"><h3 id="event-related-heading">关联候选事件 <span class="muted">（${(s.facts??[]).length}）</span></h3><p class="muted">已确认归入本事件的候选事实及其来源。</p>
 ${(s.facts??[]).map(f=>`<article class="event-related-item" data-fact-id="${e(f.id)}"><h4>${e(f.title)}</h4><p>${e(f.description)}</p><p class="muted">${e(({initial:'初始事实',progress:'进展',supplement:'补充',correction:'纠正',corroboration:'佐证'})[f.relation_role]??'关联事实')}${f.relation_note?' · '+e(f.relation_note):''}</p><details data-disclosure="fact-${e(f.id)}"><summary>查看候选详情与原文</summary><p>主体：${e(f.subject??'待确认')} · 行动：${e(f.action??'待确认')}</p><p>发生时间：${e(f.event_time??'原文未明确')} · ${e(stageName(f.event_status)??'阶段未知')}</p>${(s.evidence??[]).filter(x=>x.fact_id===f.id).map(x=>`<blockquote>${e(x.quote)}${Number.isInteger(x.material_version)?`<a class="link-button" href="/m1#material/${e(x.material_id)}">查看当前资料并核对版本（依据版本 ${x.material_version}）</a>`:`<a class="link-button" href="/api/v1/l0/versions/${e(x.information_version_id)}/raw" target="_blank" rel="noopener">查看对应版本原文</a>`}</blockquote>`).join('')||'<p class="muted">暂无可展示的原文证据。</p>'}</details></article>`).join('')||'<p class="muted">尚无已关联的候选事件。</p>'}</section>
 <details class="event-support" data-disclosure="delivery"><summary>结果交付与下载</summary><a class="link-button" href="/api/v1/l0/events/${e(v.id)}/file" download>下载当前结果</a> <section><h3>结果交付</h3><p class="muted">验收接收端用于验证可靠交付；F03/F05 风险分析尚未接入。</p>${deliveries.map(d=>`<div class="event-step-result"><strong>${d.status==='received'?(d.application_status==='waiting_gap'?'已接收，等待前序交付':d.application_status==='applied'?'已接收并采用':'已接收'):'等待交付'}</strong><p>${e(d.consumer_id)} · 文件${d.files_state==='ready'?'可读取':'待恢复'}</p>${d.files_state==='ready'?`<a class="link-button" href="/api/v1/l0/event-deliveries/${e(d.message_id)}/files/event" download>下载当次交付结果</a>`:''}${d.status==='received'?`<a class="link-button" href="/api/v1/l0/event-deliveries/${e(d.message_id)}/files/receipt?consumer_id=${e(d.consumer_id)}" download>下载接收回执</a>`:''}${permissions.includes('event_retry')&&(d.status==='recoverable'||d.files_state==='recoverable')?`<form data-delivery="${e(d.message_id)}" data-consumer="${e(d.consumer_id)}" data-files="${d.status==='received'}" data-generation="${e(d.status==='received'?d.file_generation:d.generation)}"><label>恢复说明<input name="reason" required maxlength="2000"></label><button class="secondary">${d.status==='received'?'重新生成文件':'重新交付'}</button></form>`:''}</div>`).join('')||'<p>当前没有待交付结果。</p>'}</section></details></article>`;}

export function renderPaging(data,kind,cursor){return `<nav class="event-pagination" aria-label="列表分页">${cursor>0?`<a class="secondary" href="#${e(kind)}&amp;cursor=${Math.max(0,cursor-20)}">上一页</a>`:''}${data.next_cursor!==null?`<a class="secondary" href="#${e(kind)}&amp;cursor=${e(data.next_cursor)}">下一页</a>`:''}</nav>`;}

export function listCursor(params){const value=Number(params.get('cursor')??0);return Number.isSafeInteger(value)&&value>=0?value:0;}
export function eventListReturn(hash){
 const params=new URLSearchParams(hash.replace(/^#/,''));
 const raw=params.get('list_cursor'),cursor=Number(raw);
 if(raw===null||!Number.isSafeInteger(cursor)||cursor<0)return '#events';
 const anchor=params.get('list_anchor');
 return `#events&cursor=${cursor}${anchor&&/^[a-zA-Z0-9-]{1,80}$/.test(anchor)?`&anchor=${encodeURIComponent(anchor)}`:''}`;
}
const calendar=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',weekday:'long'});
const clock=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function timelineDate(item){
 const value=item.display_time,precision=item.display_time_precision;
 if(!value)return {key:'unknown',label:'展示时间未明确',time:'时刻未明确',datetime:null};
 if(precision==='instant'&&!Number.isNaN(Date.parse(value))){
  const parts=Object.fromEntries(calendar.formatToParts(new Date(value)).map(x=>[x.type,x.value]));
  return {key:`${parts.year}-${parts.month}-${parts.day}`,label:`${parts.year}年${Number(parts.month)}月${Number(parts.day)}日`,weekday:parts.weekday,time:clock.format(new Date(value)),datetime:value};
 }
 if(precision==='day')return {key:value,weekday:new Intl.DateTimeFormat('zh-CN',{timeZone:'UTC',weekday:'long'}).format(new Date(value)),label:`${value.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日')}`,time:'时刻未明确',datetime:value};
 return {key:`partial-${value}`,label:`展示日期不完整 · ${value}`,time:precision==='year'?'精确到年':'精确到月',datetime:value};
}
export function renderTimeline(data,cursor=0){
 const groups=new Map();
 for(const item of data.items){const date=timelineDate(item);if(!groups.has(date.key))groups.set(date.key,{date,items:[]});groups.get(date.key).items.push(item);}
 return `<div class="section-heading event-timeline-heading"><h2 id="event-list-heading" tabindex="-1">正式事件</h2><p>按展示时间 · 最新在前</p></div>${data.items.length?`<div class="event-timeline">${[...groups].map(([key,{date,items}])=>`<details class="timeline-day" data-disclosure="day-${e(key)}" open><summary><h3>${e(date.label)}${date.weekday?` <span>${e(date.weekday)}</span>`:''}</h3><span>本页${items.length}条</span><span class="timeline-fold" aria-hidden="true"></span></summary><ol>${items.map(item=>{
 const t=timelineDate(item),sources=item.sources??[],basis=sources.find(s=>s.id===item.time_source_id),basisLabel=item.display_time_basis==='first_collected'?'首次收录':item.display_time_basis==='published'?'原文发布':'时间待核实';
 const link=`#event=${encodeURIComponent(item.id)}&list_cursor=${cursor}&list_anchor=${encodeURIComponent(item.id)}`;
 return `<li class="timeline-item" id="timeline-${e(item.id)}" data-event-id="${e(item.id)}"><div class="timeline-clock">${t.datetime?`<time datetime="${e(t.datetime)}">${e(t.time)}</time>`:e(t.time)}</div><article class="timeline-card"><div class="timeline-meta"><span class="timeline-source">${e(sources[0]?.name??'信源信息暂缺')}</span><span>${e(stageName(item.event_status)??'阶段未知')}</span></div><h4><a data-event-link="${e(item.id)}" href="${e(link)}">${e(item.title)}</a></h4><p class="timeline-description">${e(item.description)}</p><div class="timeline-support">${sources.length>1?`<details data-disclosure="sources-${e(item.id)}"><summary>另${sources.length-1}个关联信源</summary><ul>${sources.slice(1).map(s=>`<li>${e(s.name)}</li>`).join('')}</ul></details>`:''}<details data-disclosure="time-${e(item.id)}"><summary>${e(basisLabel)} · 时间说明</summary><dl><div><dt>依据原文信源</dt><dd>${e(basis?.name??'信源信息暂缺')}</dd></div><div><dt>原文发布时间</dt><dd>${e(item.published_at_text??'待核实')}</dd></div><div><dt>首次收录时间</dt><dd>${item.first_collected_at?e(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'medium',hourCycle:'h23'}).format(new Date(item.first_collected_at))):'待核实'}</dd></div></dl><p>${e(item.display_time_reason??'时间依据待核实')}</p></details></div></article></li>`;
 }).join('')}</ol></details>`).join('')}</div>`:'<div class="empty">还没有正式事件。已抽取的候选可从信息接入任务查看。</div>'}${renderPaging(data,'events',cursor)}`;
}

async function mount(){
 const api=createClient(),content=document.querySelector('#event-content'),feedback=document.querySelector('#event-feedback');
 let busy=false,pending=null,refreshing=false,renderedRoute=null,renderedHtml=null,pageNavigation=false;
 const memory=new Map();
 const paramsOf=hash=>new URLSearchParams(hash.replace(/^#/,''));
 const isList=hash=>!['event','fact','information','candidate','processing','version'].some(k=>paramsOf(hash).has(k));
 const stateKey=hash=>`riskhot-event-list-${listCursor(paramsOf(hash))}`;
 const getState=hash=>{const key=stateKey(hash);try{const state=memory.get(key)??JSON.parse(sessionStorage.getItem(key)??'null');return state&&Array.isArray(state.details)&&state.details.every(x=>Array.isArray(x)&&typeof x[0]==='string'&&typeof x[1]==='boolean')&&(state.top==null||Number.isFinite(state.top))?state:null;}catch{return memory.get(key);}};
 const capture=()=>{
  const details=[...content.querySelectorAll('details[data-disclosure]')].map(d=>[d.dataset.disclosure,d.open]);
  const visible=[...content.querySelectorAll('[data-event-id]')].find(x=>x.getBoundingClientRect().height>0&&x.getBoundingClientRect().bottom>80);
  const day=[...content.querySelectorAll('.timeline-day>summary')].find(x=>x.getBoundingClientRect().bottom>80);
  const active=document.activeElement;
  return {details,anchor:visible?.dataset.eventId,top:visible?.getBoundingClientRect().top,day:day?.parentElement.dataset.disclosure,dayTop:day?.getBoundingClientRect().top,scroll:scrollY,focus:active?.dataset.eventLink??null,focusDisclosure:active?.matches('summary')?active.parentElement.dataset.disclosure:null};
 };
 const saveList=()=>{if(renderedHtml!==null&&renderedRoute!==null&&isList(renderedRoute)&&content.querySelector('.event-timeline-heading')){const key=stateKey(renderedRoute),state=capture();memory.set(key,state);try{sessionStorage.setItem(key,JSON.stringify(state));}catch{}}};
 const restore=(state,anchor)=>{
  for(const [key,open] of state?.details??[]){const d=[...content.querySelectorAll('details[data-disclosure]')].find(x=>x.dataset.disclosure===key);if(d)d.open=open;}
  const target=[...content.querySelectorAll('[data-event-id]')].find(x=>x.dataset.eventId===(state?state.anchor:anchor));
  if(state?.focus){const link=[...content.querySelectorAll('[data-event-link]')].find(x=>x.dataset.eventLink===state.focus);link?.focus({preventScroll:true});}
  if(state?.focusDisclosure){const summary=[...content.querySelectorAll('details[data-disclosure]')].find(x=>x.dataset.disclosure===state.focusDisclosure)?.querySelector(':scope>summary');summary?.focus({preventScroll:true});}
  const day=[...content.querySelectorAll('.timeline-day')].find(x=>x.dataset.disclosure===state?.day)?.querySelector(':scope>summary');
  if(target){const parent=target.closest('.timeline-day');if(!state&&anchor&&parent)parent.open=true;window.scrollBy(0,target.getBoundingClientRect().top-(state?.top??100));}
  else if(day&&Number.isFinite(state?.dayTop))window.scrollBy(0,day.getBoundingClientRect().top-state.dayTop);
  else if(Number.isFinite(state?.scroll))window.scrollTo(0,state.scroll);
  else document.querySelector('#event-list-heading')?.scrollIntoView({block:'start'});
 };
 const tell=(message,error=false)=>{feedback.hidden=false;feedback.textContent=message;feedback.classList.toggle('error',error);};
 const refresh=async()=>{
  if(refreshing)return;
  refreshing=true;
  const requestedRoute=location.hash,retained=renderedHtml!==null&&renderedRoute===requestedRoute,paging=pageNavigation;pageNavigation=false;
  if(!retained){saveList();renderedRoute=null;renderedHtml=null;content.innerHTML='<div class="loading" role="status">正在读取…</div>';feedback.hidden=true;}
  try{
   const session=await api.get('/api/v1/session'),route=await resolveEventRoute(api,requestedRoute);
   if(location.hash!==requestedRoute)return;
   if(route!==requestedRoute)history.replaceState(null,'',route);
   const params=paramsOf(route),information=params.get('information'),fact=params.get('fact'),event=params.get('event');
   let html;
   if(information){
    const data=await api.get(`/api/v1/l0/versions/${encodeURIComponent(information)}/facts`);
    html=`<section class="event-detail"><div class="section-heading"><h2>资料的候选事实</h2><a href="/m1#intake-tasks">返回信息接入任务</a></div><p>查看抽取结果及已确认的事件归属。未归组的候选保留在资料中。</p>${data.items.map(x=>`<a class="event-row" href="#${x.events.length?`event=${e(x.events[0].event_id)}`:`fact=${e(x.fact.id)}`}"><strong>${e(x.fact.title)}</strong><span>${x.events.length?'查看正式事件':'查看未归组候选'}</span></a>`).join('')||'<p>尚无候选事实，请查看接入任务的抽取状态。</p>'}</section>`;
   }else if(fact){html=renderFact(await api.get(`/api/v1/l0/facts/${encodeURIComponent(fact)}`));}
   else if(event){
    const [snapshot,messages]=await Promise.all([api.get(`/api/v1/l0/events/${encodeURIComponent(event)}`),api.get(`/api/v1/l0/events/${encodeURIComponent(event)}/deliveries`)]);
    html=renderEvent(snapshot,messages.items,session.permissions,eventListReturn(route));
   }else{
    const cursor=listCursor(params),data=await api.get(`/api/v1/l0/events?cursor=${cursor}`);
    html=renderTimeline(data,cursor);
   }
   if(location.hash!==route)return;
   if(html!==renderedHtml){
    const state=renderedHtml!==null&&renderedRoute===route?capture():null;
    content.innerHTML=html;renderedHtml=html;
    if(isList(route))restore(state??(paging?null:getState(route)),paging?null:params.get('anchor'));
    else if(state)for(const [key,open] of state.details){const d=[...content.querySelectorAll('details[data-disclosure]')].find(x=>x.dataset.disclosure===key);if(d)d.open=open;}
   }
   if(feedback.classList.contains('error'))feedback.hidden=true;
   renderedRoute=route;
  }catch(error){
   if(location.hash===requestedRoute){
    const restricted=error.status===401||error.status===403;
    if(!retained||restricted){renderedRoute=null;renderedHtml=null;content.innerHTML=`<div class="empty">暂时无法读取此内容，请使用上方“刷新状态”重试。${paramsOf(requestedRoute).has('event')?`<a class="secondary" href="${e(eventListReturn(requestedRoute))}">返回事件列表</a>`:''}</div>`;}
    tell(error.status===401?'登录状态已失效，请重新登录后刷新重试。':error.status===403?'当前账号无权查看此内容。':retained?'刷新失败，已保留当前列表。请使用上方“刷新状态”重试。':'读取失败，请使用上方“刷新状态”重试。',true);
   }
  }finally{
   refreshing=false;
   if(location.hash!==requestedRoute&&renderedRoute!==location.hash)void refresh();
  }
 };
 content.addEventListener('click',event=>{if(event.target.closest('[data-event-link],.event-pagination a'))saveList();if(event.target.closest('.event-pagination a'))pageNavigation=true;});
 window.addEventListener('pagehide',saveList);
 const send=async(command)=>{
  if(busy)return;
  if(pending&&pending!==command){tell('上一项操作结果尚未确认，请重试原操作。',true);return;}
  busy=true;pending=command;content.setAttribute('aria-busy','true');content.querySelectorAll('button').forEach(x=>x.disabled=true);tell('操作正在提交…');
  try{await api.send(command);pending=null;tell('已受理，正在读取交付状态。');await refresh();}
  catch(error){tell(error.code==='OUTCOME_UNKNOWN'?'结果暂未确认，请重试本次原操作。':`操作未完成：${error.code}`,true);if(error.code!=='OUTCOME_UNKNOWN')pending=null;}
  finally{busy=false;content.removeAttribute('aria-busy');content.querySelectorAll('button').forEach(x=>x.disabled=false);document.querySelector('#retry-event-command').hidden=!pending;}
 };
 content.addEventListener('input',event=>event.target.closest('form')?.setAttribute('data-dirty','true'));
 content.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;if(!form.hasAttribute('data-delivery'))return;
  const data=new FormData(form);
  void send(api.command(`/api/v1/l0/event-deliveries/${form.dataset.delivery}/${form.dataset.files==='true'?'files/retry':'retry'}`,'POST',{consumer_id:form.dataset.consumer,expected_generation:Number(form.dataset.generation),reason:data.get('reason')}));
 });
 document.querySelector('#event-refresh').onclick=()=>refresh();
 document.querySelector('#retry-event-command').onclick=()=>pending&&send(pending);
 window.addEventListener('hashchange',refresh);
 setInterval(()=>{if(!busy&&!document.hidden&&!content.querySelector('form[data-dirty="true"],textarea:focus,input:focus,select:focus,summary:focus,a:focus,button:focus'))void refresh();},5000);
 await refresh();
}
// schema5通过独立资源别名复用纯渲染函数，由current-events统一挂载页面。
if(typeof document!=='undefined'&&!new URL(import.meta.url).pathname.endsWith('/event-view.js')&&document.querySelector('#event-content'))void mount();
