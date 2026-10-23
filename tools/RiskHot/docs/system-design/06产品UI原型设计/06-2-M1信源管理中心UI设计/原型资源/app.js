'use strict';
// 独立本地原型：所有身份、分类、技术结果、引用与操作记录均为演示，刷新重置。
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => structuredClone(value);
const D = {
 tier:{label:'信源等级',values:{T1:'T1',T1_5:'T1.5',T2:'T2',AUX:'辅助入口'}},
 dims:{label:'金融属性',values:{QUANTITY:'钱的数量',PRICE:'钱的价格',FLOW:'钱的流向'}},
 levels:{label:'观察层级',values:{MACRO:'宏观',MESO:'中观',MICRO:'微观'}},
 priority:{label:'关注优先级',values:{CORE:'核心',HIGH:'重点',NORMAL:'一般'}},
 frequency:{label:'监测频率',values:{REALTIME:'实时',DAILY:'每日',WEEKLY:'每周',MONTHLY:'每月',IRREGULAR:'不定期'}},
 functions:{label:'信息功能',values:{RAW_DATA:'原始数据',POLICY:'政策',EVENT:'事件',ANALYSIS:'观点分析'}},
 status:{label:'业务状态',values:{ACTIVE:'启用',DISABLED:'停用'}}
};
const V = {all:{name:'全部',rule:'全部信源 · 平铺显示',keys:[]},verify:{name:'信源等级',rule:'信源等级 → 来源类别',keys:['tier','category']},monitor:{name:'日常监测',rule:'关注优先级 → 监测频率 → 信源等级',keys:['priority','frequency','tier']},research:{name:'专题研究',rule:'金融属性 → 观察层级 → 关注优先级',keys:['dims','levels','priority']}};
// 六维为独立演示配置；不依据正文、优先级或等级推导其他维度。
const overrides = {
 'wiki-source-001':{dims:['QUANTITY','PRICE','FLOW'],levels:['MACRO'],priority:'CORE',frequency:'MONTHLY',functions:['POLICY','RAW_DATA']},
 'wiki-source-002':{dims:['QUANTITY'],levels:['MACRO'],priority:'CORE',frequency:'MONTHLY',functions:['POLICY','RAW_DATA']},
 'wiki-source-004':{dims:['FLOW'],levels:['MACRO'],priority:'HIGH',frequency:'MONTHLY',functions:['RAW_DATA']},
 'wiki-source-005':{dims:['PRICE','FLOW'],levels:['MESO'],priority:'HIGH',frequency:'DAILY',functions:['RAW_DATA']},
 'wiki-source-018':{dims:['QUANTITY'],levels:['MACRO'],priority:'CORE',frequency:'MONTHLY',functions:['RAW_DATA']},
 'wiki-source-027':{dims:[],levels:['MICRO'],priority:'HIGH',frequency:'IRREGULAR',functions:['RAW_DATA','EVENT']},
 'wiki-source-028':{publisher:'中国人民银行',dims:['QUANTITY','PRICE'],levels:['MACRO'],priority:'HIGH',frequency:'IRREGULAR',functions:['POLICY']},
 'wiki-source-033':{dims:[],levels:['MACRO','MESO','MICRO'],priority:'NORMAL',frequency:'IRREGULAR',functions:['ANALYSIS']},
 'wiki-source-040':{dims:['QUANTITY','PRICE'],levels:['MACRO'],priority:'NORMAL',frequency:'IRREGULAR',functions:['RAW_DATA']}
};
const catalog = (window.RISK_HOT_SOURCE_CATALOG || []).map(x=>({id:x.id,refId:x.id,name:x.name,publisher:x.name,category:'官方发布（演示）',channel:'官方网站（演示）',tier:x.tier==='T1.5'?'T1_5':x.tier==='辅助入口'?'AUX':x.tier,locator:x.url,verifyLocator:x.verifyUrl||'',dims:[],levels:[],priority:'NORMAL',frequency:'IRREGULAR',functions:[],description:x.context,caliber:x.focus,purpose:'回到发布主体核对原始资料与口径。',scope:'',material:'',mode:'manual',basis:'',basisRef:'',code:'',reposter:'',...clone(overrides[x.id]||{})}));
for(const x of catalog){if(x.tier==='T2'){x.category='媒体与分析（演示）';x.channel='内容平台（演示）';}if(x.tier==='T1_5'){x.category='官方认证渠道（演示）';x.channel='认证账号（演示）';}if(x.tier==='AUX'){x.category='辅助查询入口';x.channel='聚合检索（演示）';}}
const snapshot = x => {const {history,...rest}=x;return clone(rest);};
function samples(){
 const presets={'wiki-source-018':['demo-source-1','DEMO_NBS_MACRO','ACTIVE','auto',false],'wiki-source-001':['demo-source-2','DEMO_PBC_POLICY','DISABLED','manual',false],'wiki-source-033':['demo-source-3','DEMO_RESEARCH','DISABLED','manual',false],'wiki-source-005':['demo-source-4','DEMO_MONEY','ACTIVE','auto',true]};
 return catalog.map((ref,i)=>{
  const [id,code,status,mode,ready]=presets[ref.id]||[`demo-source-${i+5}`,`DEMO_SOURCE_${String(i+1).padStart(3,'0')}`,'DISABLED','manual',false];
  const r={...clone(ref),id,code,status,mode,locator:ref.locator||`DEMO-MATERIAL-${String(i+1).padStart(3,'0')}`,tech:{ready,label:mode==='manual'?'人工接入':ready?'技术就绪':'接入未就绪',time:'2026-10-13 09:30（示例）'},version:2,scope:'宏观研究与原始材料核验（演示范围）',material:'公告／统计资料（演示）',basis:'演示资料：在册来源身份与使用范围说明。',basisRef:ref.verifyLocator||`DEMO-EVIDENCE-${i+1}`,created:'2026-10-12 10:00（示例）',updated:'2026-10-13 09:30（示例）',verified:'2026-10-13 09:30（示例）',relations:ref.id==='wiki-source-018'?{indicators:[{name:'宏观统计观察指标（示例）',id:'DEMO-IND-01',version:1}],materials:[{name:'统计公报样本（示例）',id:'DEMO-DOC-01',version:1}]}:{indicators:[],materials:[]},history:[]};
  const prior={...snapshot(r),version:1,status:'DISABLED',description:'初次保存内容（示例旧版本）'};
  r.history=[{kind:'资料修订',actor:'示例管理员',time:r.updated,reason:'保留在册信源当时版本（示例）。',before:prior,after:snapshot(r)}];return r;
 });
}
let records=samples();
const context = () => ({query:'',filters:{tier:[],dims:[],levels:[],priority:[],frequency:[],status:[]},view:'research',selected:null,collapsed:new Set()});
const state={directory:context(),role:'both',scene:'normal',tab:'archive'};
let edit=null,operation=null,pending=null,toastTimer,returnToDetail=false;
const ctx = () => state.directory;
const canEdit=()=>['both','admin'].includes(state.role);
const canOperate=()=>['both','operator'].includes(state.role);
const canWrite=()=>!['offline','denied','loading','error'].includes(state.scene);
const byId=id=>records.find(x=>x.id===id);
const selected=()=>byId(ctx().selected);
const label=(key,v)=>D[key]?.values[v]||v||'待补充';
const tags=(key,values)=>[].concat(values||[]).filter(Boolean).map(x=>`<span class="tag">${esc(label(key,x))}</span>`).join('')||'<span class="muted">待补充</span>';
const statusTag=x=>`<span class="status ${x.status==='ACTIVE'?'active':'disabled'}">● ${esc(label('status',x.status))}</span>`;
const pairs=rows=>`<dl class="facts">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v||'待补充'}</dd>`).join('')}</dl>`;
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function safeLink(value){try{const u=new URL(value);if(['http:','https:'].includes(u.protocol))return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(value)} ↗</a>`;}catch{}return `<span class="mono">${esc(value||'待补充')}</span>`;}
function showModal(id){if($('detail-modal').open){returnToDetail=true;$('detail-modal').close();}$(id).showModal();}
function restoreDetail(){if(returnToDetail&&matchMedia('(max-width:960px)').matches){$('detail-modal').showModal();$('detail-title')?.focus();}returnToDetail=false;}
function togglePreview(){const open=$('preview-controls').hidden;$('preview-controls').hidden=!open;$('preview-toggle').setAttribute('aria-expanded',String(open));}
function renderFilters(){
 $('filters').innerHTML=['tier','dims','levels','priority','frequency','status'].map(key=>`<details><summary>${D[key].label}<span id="filter-count-${key}"></span></summary><div class="filter-options"><fieldset><legend class="sr-only">${D[key].label}</legend>${Object.entries(D[key].values).map(([v,l])=>`<label class="choice"><input type="checkbox" data-filter="${key}" value="${v}" ${ctx().filters[key].includes(v)?'checked':''}>${l}</label>`).join('')}</fieldset><button type="button" class="quiet" data-action="close-filter">完成筛选</button></div></details>`).join('');
}
function renderHeader(){
 $('group-actions').hidden=ctx().view==='all';$('group-note').hidden=ctx().view==='all';
 $('create').hidden=!canEdit();$('create').disabled=!canWrite();$('search').value=ctx().query;
 document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.view===ctx().view)));
 $('view-rule').textContent=V[ctx().view].rule+(ctx().view==='monitor'?' · 频率是业务检查偏好，非采集任务时间表':'');
 renderFilters();
}
function filtered(){
 let rows=records;
 if(state.scene==='empty')return [];
 const q=ctx().query.trim().toLocaleLowerCase();
 return rows.filter(x=>{return (!q||[x.name,x.publisher,x.code].some(v=>String(v||'').toLocaleLowerCase().includes(q)))&&Object.entries(ctx().filters).every(([k,vs])=>!vs.length||vs.some(v=>[].concat(x[k]||[]).includes(v)));});
}
function rowHTML(x){return `<button class="source-row ${ctx().selected===x.id?'selected':''}" data-select="${esc(x.id)}" aria-pressed="${ctx().selected===x.id}"><span class="row-top"><strong>${esc(x.name)}</strong>${statusTag(x)}</span><small>${esc(x.publisher)} · ${esc(x.code)}</small><span class="tags">${tags('tier',x.tier)}${tags('levels',x.levels)}${tags('dims',x.dims)}<span class="tag">${x.mode==='manual'?'人工接入':esc(x.tech.label)}</span></span></button>`;}

function groupHTML(rows,keys,path='',depth=0){
 if(!keys.length)return rows.map(rowHTML).join('');const key=keys[0],groups=new Map();
 for(const x of rows){let vals=[].concat(x[key]||'待补充');if(!vals.length)vals=['待补充'];if(key==='dims'&&ctx().filters.dims.length)vals=vals.filter(v=>ctx().filters.dims.includes(v));for(const val of vals){if(!groups.has(val))groups.set(val,[]);groups.get(val).push(x);}}
 const order=Object.keys(D[key]?.values||{});
 return [...groups].sort(([a],[b])=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi);}).map(([v,xs])=>{const id=path+key+':'+v,closed=ctx().collapsed.has(id);const contentId='branch-'+encodeURIComponent(id),kind=D[key]?.label||'来源类别';return `<div class="group-node" data-depth="${depth}"><button class="group-head" data-group="${esc(id)}" aria-expanded="${!closed}" aria-controls="${contentId}"><span class="group-label"><span class="group-chevron" aria-hidden="true">${closed?'›':'⌄'}</span><span class="group-type">${esc(kind)}</span><strong>${esc(label(key,v))}</strong></span><small>${xs.length}</small></button><div id="${contentId}" class="group-children" role="group" aria-label="${esc(kind+'：'+label(key,v))}" ${closed?'hidden':''}>${groupHTML(xs,keys.slice(1),id+'/',depth+1)}</div></div>`;}).join('');
}
function renderList(){
 const list=filtered();
 $('result-count').textContent=state.scene==='denied'?'无读取权限':state.scene==='error'?'读取失败':state.scene==='loading'?'正在加载':`${list.length} 个来源 · 去重总数`;
 let chips=[];for(const [k,vals] of Object.entries(ctx().filters)){const count=$('filter-count-'+k);if(count)count.textContent=vals.length?` · ${vals.length}`:'';for(const v of vals)chips.push(`<button class="filter-chip" data-remove-filter="${k}" data-value="${v}">${D[k].label}：${esc(label(k,v))} ×</button>`);}
 $('active-filters').innerHTML=chips.join('')||'未设置筛选';
 if(state.scene==='loading'){$('list').innerHTML='<div class="skeleton"></div><div class="skeleton"></div><p class="empty">正在读取来源… <button class="quiet" data-action="retry">结束加载演示</button></p>';return;}
 if(['error','denied'].includes(state.scene)){$('list').innerHTML=`<div class="empty"><h3>${state.scene==='error'?'暂时无法读取信源':'当前账号无读取权限'}</h3><p>${state.scene==='error'?'搜索与筛选条件已保留。':'此场景不显示信源资料。'}</p><button class="secondary" data-action="retry">${state.scene==='error'?'重试':'返回正常预览'}</button></div>`;return;}
 const offline=state.scene==='offline'?'<p class="notice warning">离线演示：以下是上次读取的示例资料，只可查看，禁止保存及启停。</p>':'';
 if(!list.length){const has=ctx().query||Object.values(ctx().filters).some(x=>x.length);$('list').innerHTML=offline+`<div class="empty"><h3>${has?'暂无符合条件的信源':'信源目录暂无条目'}</h3><p>${has?'试试移除部分条件。':'可切换场景查看示例资料。'}</p><button class="secondary" data-action="clear">${has?'清空条件':'返回正常预览'}</button></div>`;return;}
 if(ctx().view==='all')$('list').innerHTML=offline+list.map(rowHTML).join('');
 else {const main=list.filter(x=>x.tier!=='AUX'),aux=list.filter(x=>x.tier==='AUX');$('list').innerHTML=offline+groupHTML(main,V[ctx().view].keys)+(aux.length?`<button class="group-head" data-group="aux" aria-expanded="${!ctx().collapsed.has('aux')}"><span>辅助入口 · 逐序列回源</span><small>${aux.length}</small></button><div ${ctx().collapsed.has('aux')?'hidden':''}>${aux.map(rowHTML).join('')}</div>`:'');}
}
function sourceArchive(x){
 const sections=[['身份',pairs([['信源身份',`<span class="mono">${esc(x.id)}</span>`],['发布主体',esc(x.publisher)],['转载主体',esc(x.reposter||'不适用')],['来源类别',esc(x.category)],['渠道',esc(x.channel)]])],['分类',pairs([['信源等级',tags('tier',x.tier)],['金融属性',tags('dims',x.dims)],['观察层级',tags('levels',x.levels)],['信息功能',tags('functions',x.functions)]])],['监测配置',pairs([['优先级',esc(label('priority',x.priority))],['监测频率',esc(label('frequency',x.frequency))]])+'<small>业务检查偏好，不等于采集任务时间表。</small>'],['信息内容',`<p>${esc(x.description||'待补充')}</p>`+pairs([['资料类型',esc(x.material)],['允许范围',esc(x.scope)],['接入方式',x.mode==='manual'?'人工':'自动']])],['观察用途与口径',pairs([['观察用途',esc(x.purpose)],['口径注意',esc(x.caliber)]])],['来源入口与依据',pairs([['来源定位',safeLink(x.locator)],...(x.verifyLocator?[['核验入口',safeLink(x.verifyLocator)]]:[]),['身份依据',esc(x.basis||'待补充')],['核验材料',esc(x.basisRef||'待补充')],['核验时间',esc(x.verified||'暂无核验记录')],['创建时间',esc(x.created)],['修改时间',esc(x.updated)]])]];
 return sections.map(([title,content],i)=>`<section><h3><span class="section-num">0${i+1}</span>${title}</h3>${content}</section>`).join('');
}
function availability(x){if(x.status!=='ACTIVE')return `业务${label('status',x.status)}，禁止新自动接入。`;if(x.mode==='manual')return '业务已启用，可按授权范围人工录入；自动采集不可用。';return x.tech.ready?'业务已启用，具备自动接入条件。':'业务已启用，自动接入尚未就绪。';}
function technical(x){return `<section><h3>技术结果 · 只读演示</h3>${pairs([['业务状态',statusTag(x)],['接入方式',x.mode==='manual'?'人工':'自动'],['技术结果',esc(x.tech.label)],['结果时间',esc(x.tech.time||'暂无检测记录')],['自动条件',esc(availability(x))]])}<p class="notice">连接可达不自动等于完整技术就绪。技术结果由 L0 提供。</p><button class="secondary" data-action="external" data-target="L0 检测记录">前往 L0 查看检测记录</button><button class="quiet" data-action="refresh-tech">刷新已读结果</button><p id="tech-feedback" class="muted"></p></section>`;}
function relationHTML(x){if(state.scene==='offline')return '<p class="notice warning">离线：关系结果仅为上次读取的示例快照。</p>'+relationsContent(x);return relationsContent(x);}
function relationsContent(x,readOnly=false){return ['indicators','materials'].map((key,i)=>`<section><h3>${i?'实际引用的原始资料':'指标允许来源配置'}</h3>${x.relations[key].length?x.relations[key].map(r=>`<div class="relation-item"><strong>${esc(r.name)}</strong><small>${esc(r.id)} · 来源版本 v${r.version}</small><button class="link-button" data-action="external" data-target="${i?'L0 原始资料':'M2 指标定义'}">查看${i?'原始资料':'指标定义'}（只读）</button></div>`).join(''):'<p class="muted">暂无引用（示例查询为空）</p>'}</section>`).join('')+(readOnly?'':'<button class="quiet" data-action="relation-error">演示查询失败</button><button class="quiet" data-action="refresh-relations">重新查询</button><div id="relation-feedback" role="status"></div>');}
function historyHTML(x){return x.history.length?x.history.slice().reverse().map((h,i)=>`<div class="history-item"><strong>${esc(h.kind)} · v${h.before?.version||'—'} → v${h.after.version}</strong><small>${esc(h.actor)} · ${esc(h.time)}</small><p>${h.before?esc(label('status',h.before.status)):'未登记'} → ${esc(label('status',h.after.status))}</p><p>理由：${esc(h.reason||'未填写')}</p><button class="link-button" data-action="view-history" data-index="${x.history.length-1-i}" data-side="after">查看 v${h.after.version} 历史版本</button>${h.before?`<button class="link-button" data-action="view-history" data-index="${x.history.length-1-i}" data-side="before">查看变更前 v${h.before.version}</button>`:''}</div>`).join(''):'<p class="muted">暂无变更记录。</p>';}
function renderDetail(){
 const x=selected();
 if(['denied','error','loading'].includes(state.scene)){$('detail').innerHTML='<div class="empty">当前读取场景不可查看详情。</div>';return;}
 if(!x){$('detail').innerHTML='<div class="empty"><h3>选择一条信源</h3><p>查看资料身份、分类与使用依据。</p></div>';return;}
 let body=`<div class="detail-heading"><div><small>在册信源 · 当前版本 v${x.version}</small><h2 tabindex="-1" id="detail-title">${esc(x.name)}</h2></div><button class="icon-button detail-close" data-action="close-detail" aria-label="返回信源目录">×</button></div><p class="mono">${esc(x.code)}</p>`;
 if(x.tier==='AUX')body+='<p class="notice warning">辅助查询用途：请逐序列核对底层发布者，平台不统一认定为 T1。该条目与其他在册信源一样通过启用／停用管理。</p>';
 body+=`<div class="status-pair"><div class="status-card"><small>业务状态</small>${statusTag(x)}</div><div class="status-card"><small>技术接入</small><strong>${esc(x.tech.label)}</strong></div></div><p class="notice ${x.status==='ACTIVE'&&!x.tech.ready&&x.mode==='auto'?'warning':''}" data-availability>${esc(availability(x))}</p><nav class="tabs" role="tablist" aria-label="信源详情页签">${[['archive','档案'],['tech','技术接入'],['relations','使用关系'],['history','变更记录']].map(([id,l])=>`<button role="tab" data-tab="${id}" aria-selected="${state.tab===id}" tabindex="${state.tab===id?0:-1}" id="tab-${id}" aria-controls="detail-panel">${l}</button>`).join('')}</nav><div id="detail-panel" role="tabpanel" aria-labelledby="tab-${state.tab}">${state.tab==='archive'?sourceArchive(x):state.tab==='tech'?technical(x):state.tab==='relations'?relationHTML(x):historyHTML(x)}</div><div class="detail-actions">${canEdit()?`<button class="secondary" data-action="edit" ${!canWrite()?'disabled':''}>编辑资料</button>`:''}${canOperate()?(x.status==='ACTIVE'?'<button class="secondary" data-action="status" data-target="DISABLED">停用</button>':'<button class="primary" data-action="status" data-target="ACTIVE">启用</button>'):'<small>当前账号没有启停权限。</small>'}</div>`;
 $('detail').innerHTML=body;
 if(!canWrite())$('detail').querySelectorAll('[data-action=status]').forEach(b=>b.disabled=true);
 if(!filtered().some(r=>r.id===x.id))$('detail').insertAdjacentHTML('afterbegin','<p class="notice">此信源已不在当前筛选结果中，详情仍保留。</p>');
}
function render(){renderHeader();renderList();renderDetail();}
function openDetail(id){ctx().selected=id;state.tab='archive';renderList();renderDetail();if(matchMedia('(max-width:960px)').matches){$('detail-modal').append($('detail'));$('detail-modal').showModal();$('detail-title')?.focus();}}

function validateEnable(x){return [['name','信源名称'],['code','稳定编码'],['category','来源类别'],['publisher','发布主体'],['locator','来源定位'],['scope','允许业务范围'],['material','资料类型'],['tier','信源等级'],['basis','身份依据']].filter(([key])=>!x[key]).map(([,l])=>l);}
const textFields=[['name','信源名称',true],['code','稳定编码',true],['publisher','原始发布主体',true],['reposter','转载主体',false],['locator','URL 或材料定位标识',true],['scope','允许业务范围',true],['basis','来源身份依据',false],['basisRef','核验材料定位',false],['description','主要信息内容',false],['caliber','口径注意事项',false],['purpose','观察用途',false]];
const longFields=new Set(['scope','basis','description','caliber','purpose']);
function fieldHTML(key,name,required=false){const value=edit.draft[key]||'';return `<div class="field ${longFields.has(key)||key==='locator'?'span2':''}"><label for="field-${key}">${name}${required?' <span class="required">*</span>':''}</label>${longFields.has(key)?`<textarea id="field-${key}" name="${key}" ${required?'required':''}>${esc(value)}</textarea>`:`<input id="field-${key}" name="${key}" value="${esc(value)}" ${required?'required':''} ${key==='code'&&edit.id?'readonly':''}>`}<small id="error-${key}" class="field-error"></small>${['basis','basisRef'].includes(key)?'<small>可先留空保存，启用前核对。</small>':''}</div>`;}
function selectHTML(key,name,options,required=false){return `<div class="field"><label for="field-${key}">${name}${required?' <span class="required">*</span>':''}</label><select id="field-${key}" name="${key}" ${required?'required':''}><option value="">${required?'请选择':'待补充'}</option>${Object.entries(options).map(([v,l])=>`<option value="${esc(v)}" ${edit.draft[key]===v?'selected':''}>${esc(l)}</option>`).join('')}</select><small id="error-${key}" class="field-error"></small></div>`;}
function multiHTML(key){return `<fieldset class="field"><legend>${D[key].label}</legend><div class="choices">${Object.entries(D[key].values).map(([v,l])=>`<label class="choice"><input type="checkbox" name="${key}" value="${v}" ${edit.draft[key]?.includes(v)?'checked':''}>${l}</label>`).join('')}</div><small>多选独立维护，不自动推导其他维度。</small></fieldset>`;}
function openEditor(x=null){if(!canEdit()||!canWrite()){toast('当前角色或场景不能登记／编辑。');return;}const blank={name:'',code:'',publisher:'',category:'',channel:'',reposter:'',locator:'',tier:'',dims:[],levels:[],priority:'',frequency:'',functions:[],scope:'',material:'',mode:'',basis:'',basisRef:'',description:'',caliber:'',purpose:''};let draft={...blank,...(x?clone(x):{})};edit={id:x?x.id:null,base:x?x.version:null,draft,original:x?snapshot(x):null,refId:x?.refId||null,dirty:false};$('editor-title').textContent=edit.id?'编辑信源资料':'新增信源';$('editor-notice').textContent='保存即纳入同一信源目录；新信源默认停用。接入定位变化需重新检测。';$('duplicate').innerHTML='';$('form-error').hidden=true;$('edit-impact').hidden=true;$('save').disabled=false;$('check-duplicate').disabled=false;$('save').textContent='保存资料';
 $('editor-fields').innerHTML='<h3 class="form-section">身份与定位</h3>'+textFields.slice(0,5).map(([k,n,r])=>fieldHTML(k,n,r)).join('')+selectHTML('category','来源类别 · 演示选项',{'官方发布（演示）':'官方发布','官方认证渠道（演示）':'官方认证渠道','媒体与分析（演示）':'媒体与分析','辅助查询入口':'辅助查询入口'},true)+selectHTML('channel','渠道 · 演示选项',{'官方网站（演示）':'官方网站','认证账号（演示）':'认证账号','内容平台（演示）':'内容平台','聚合检索（演示）':'聚合检索','人工材料（演示）':'人工材料'})+'<h3 class="form-section">六维分类 · 独立维护</h3>'+selectHTML('tier','信源等级 · 启用前补齐',{T1:'T1',T1_5:'T1.5',T2:'T2',AUX:'辅助查询用途'})+selectHTML('priority',D.priority.label,D.priority.values)+selectHTML('frequency',D.frequency.label,D.frequency.values)+multiHTML('dims')+multiHTML('levels')+multiHTML('functions')+'<h3 class="form-section">范围、资料与依据</h3>'+fieldHTML('scope','允许业务范围',true)+selectHTML('material','资料类型 · 演示选项',{'公告／统计资料（演示）':'公告／统计资料','机构研究（演示）':'机构研究','人工材料（演示）':'人工材料'},true)+selectHTML('mode','接入方式',{manual:'人工',auto:'自动'},true)+fieldHTML('basis','来源身份依据')+fieldHTML('basisRef','核验材料定位')+'<h3 class="form-section">内容与用途</h3>'+textFields.slice(8).map(([k,n,r])=>fieldHTML(k,n,r)).join('')+`<div class="field span2"><label for="field-reason">本次${edit.id?'变更':'登记'}理由 <span class="required">*</span></label><textarea id="field-reason" name="reason" required></textarea><small id="error-reason" class="field-error"></small></div>`;showModal('editor');
}
function readDraft(){const f=new FormData($('edit-form')),r={};for(const [k] of textFields)r[k]=String(f.get(k)||'').trim();for(const k of ['category','channel','tier','priority','frequency','material','mode','reason'])r[k]=String(f.get(k)||'').trim();for(const k of ['dims','levels','functions'])r[k]=f.getAll(k);return r;}
function updateImpact(){if(!edit?.id)return;const r=readDraft(),old=edit.original;let msgs=[];if(r.publisher!==old.publisher||r.scope!==old.scope||r.basis!==old.basis||validateEnable({...old,...r}).length)msgs.push('此修订将退回停用，保存后需重新核验并授权启用。');if(r.locator!==old.locator||r.mode!==old.mode)msgs.push('接入方式／定位已变化，技术结果将标为待重新检测。');$('edit-impact').hidden=!msgs.length;$('edit-impact').textContent=msgs.join(' ');}
function formError(text,fields=[]){$('form-error').hidden=false;$('form-error').textContent=text;for(const [k,l] of fields){const el=$('field-'+k);el?.setAttribute('aria-invalid','true');el?.setAttribute('aria-describedby','error-'+k);if($('error-'+k))$('error-'+k).textContent='请补齐'+l;} $('form-error').focus();}
function duplicateCheck(r=readDraft()){
 const others=records.filter(x=>x.id!==edit.id),hard=others.find(x=>x.code.toLocaleLowerCase()===r.code.toLocaleLowerCase()&&r.code)||others.find(x=>r.publisher&&r.locator&&x.publisher===r.publisher&&x.locator===r.locator&&x.channel===r.channel);
 const similar=hard||others.find(x=>r.publisher&&x.publisher===r.publisher||r.locator&&x.locator===r.locator||r.name&&x.name===r.name);
 if(!similar){$('duplicate').innerHTML='<p class="notice">未发现重复；保存时仍会重新检查。</p>';return {hard:null,similar:null};}
 $('duplicate').innerHTML=`<section class="check-result"><h3>${hard?'编码冲突／已有同一来源':'发现相似来源，请核对渠道与身份'}</h3><p class="muted">不会仅凭同名合并；本次填写已保留。</p><table class="comparison"><thead><tr><th>核对项</th><th>本次登记</th><th>已有信源</th></tr></thead><tbody>${[['code','编码'],['name','名称'],['publisher','发布主体'],['channel','渠道'],['locator','定位']].map(([k,l])=>`<tr><td>${l}</td><td>${esc(r[k])}</td><td>${esc(similar[k])}</td></tr>`).join('')}</tbody></table><button type="button" class="secondary" data-action="reuse" data-id="${similar.id}">打开已有信源</button>${hard?'':`<div class="field"><label for="difference-reason">不同渠道／身份的说明（继续登记前填写）</label><textarea id="difference-reason">${esc(edit.difference||'')}</textarea></div>`}</section>`;
 return {hard,similar};
}
function closeEditor(force=false){if(pending?.kind==='save'){toast('请先查询本次保存结果。');return;}if(edit?.dirty&&!force){if(!$('dirty-panel'))$('editor-fields').insertAdjacentHTML('afterbegin','<div id="dirty-panel" class="dirty-panel"><p>有未保存内容，是否放弃本次修改？</p><div class="actions"><button type="button" class="secondary" data-action="keep-editing">继续编辑</button><button type="button" class="danger" data-action="discard-editing">放弃修改</button></div></div>');$('dirty-panel').scrollIntoView();$('dirty-panel').querySelector('button').focus();return;}$('editor').close();edit=null;restoreDetail();}
function recordChange(r,kind,reason,before){r.updated=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（本地演示）';r.history.push({kind,reason,actor:state.role==='operator'?'示例启停人员':'示例管理员',time:r.updated,before,after:snapshot(r)});}
function getWriteMode(){const mode=$('write-mode').value;$('write-mode').value='normal';return mode;}
function saveEditor(){if(pending)return;if(!canEdit()||!canWrite()){formError('当前角色或读取场景禁止保存。');return;}$('edit-form').querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));const r=readDraft(),required=[['name','信源名称'],['code','稳定编码'],['publisher','发布主体'],['locator','来源定位'],['category','来源类别'],['scope','允许业务范围'],['material','资料类型'],['mode','接入方式'],['reason','理由']];const missing=required.filter(([k])=>!r[k]);if(missing.length){formError('请补齐保存必需资料。已填写内容仍保留。',missing);return;}
 const difference=$('difference-reason')?.value.trim()||edit.difference||'';edit.difference=difference;const dupe=duplicateCheck(r);if(dupe.hard){formError('编码冲突或已存在同一来源，请复用已有信源或修正身份。');return;}if(dupe.similar&&!difference){formError('请填写不同渠道／身份说明后再保存。');return;}
 const live=edit.id?byId(edit.id):null;const mode=getWriteMode();if(mode==='error'){formError('保存失败（演示）。内容已保留，可重新保存。');return;}if(live&&(mode==='conflict'||live.version!==edit.base)){formError(`当前记录版本冲突（本次读取 v${edit.base}）。请核对最新资料后重试。`);$('duplicate').insertAdjacentHTML('beforeend','<button type="button" class="secondary" data-action="reload-version">核对最新版本</button>');return;}if(mode==='conflict'){formError('提交时出现身份冲突（演示）。请重新检查重复后保存。');return;}
 let saved;if(live){const before=snapshot(live),major=live.publisher!==r.publisher||live.scope!==r.scope||live.basis!==r.basis||validateEnable({...live,...r}).length>0,access=live.locator!==r.locator||live.mode!==r.mode;Object.assign(live,r);delete live.reason;live.version++;if(major)live.status='DISABLED';if(access)live.tech={ready:false,label:'待重新检测',time:null};saved=live;recordChange(live,'资料修订',r.reason+(difference?'；渠道说明：'+difference:''),before);}
 else{saved={...r,id:crypto.randomUUID(),refId:edit.refId,status:'DISABLED',version:1,tech:{ready:false,label:r.mode==='manual'?'人工接入':'未检测',time:null},relations:{indicators:[],materials:[]},history:[],created:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'（本地演示）',verified:null};delete saved.reason;records.push(saved);recordChange(saved,'信源登记',r.reason+(difference?'；渠道说明：'+difference:''),null);}
 if(mode==='unknown'){pending={kind:'save',id:saved.id,isNew:!edit.id};$('save').disabled=true;$('check-duplicate').disabled=true;$('editor-fields').querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);formError('尚不能确认保存结果（响应未知演示）。请先查询结果，勿重复创建。');$('duplicate').innerHTML='<button type="button" class="primary" data-action="query-result">查询本次保存结果</button>';return;}
 finishSave(saved,!edit.id);
}
function finishSave(saved,isNew){edit.dirty=false;$('editor').close();edit=null;pending=null;ctx().selected=saved.id;state.tab='archive';render();if(returnToDetail){renderDetail();restoreDetail();}else if(!matchMedia('(max-width:960px)').matches)$('detail-title')?.focus();toast(isNew?'已加入信源目录，当前停用。':'资料已保存，版本 v'+saved.version+'，业务状态：'+label('status',saved.status));}
function openOperation(target){if(!canOperate()||!canWrite()){toast('当前角色或场景禁止启停。');return;}const x=selected();if(!x)return;operation={id:x.id,base:x.version,target};renderOperation();showModal('operation');}
function renderOperation(){const x=byId(operation.id),target=operation.target,activating=target==='ACTIVE',missing=activating?validateEnable(x):[];const verb=label('status',target);$('operation-title').textContent=verb+'此信源？';$('operation-note').textContent='确认时校验权限与当前版本。';$('operation-confirm').textContent='确认'+verb;$('operation-confirm').disabled=false;
 $('operation-body').innerHTML=`<p><strong>${esc(x.name)}</strong></p><p class="mono">${esc(x.code)} · v${x.version}</p><p class="notice">${label('status',x.status)} → ${label('status',target)}</p>${activating?`<h3>启用资料核验</h3><ul class="checklist">${['信源名称','稳定编码','来源类别','发布主体','来源定位','允许业务范围','资料类型','信源等级','身份依据'].map(l=>`<li class="${missing.includes(l)?'missing':''}">${missing.includes(l)?'✕ 缺少':'✓ 已提供'} ${l}</li>`).join('')}</ul>${missing.length?`<p class="error-box">尚缺：${esc(missing.join('、'))}。原状态不变。</p>${canEdit()?'<button class="secondary" data-action="return-edit">返回编辑补齐</button>':'<p class="muted">请由管理员维护缺项。</p>'}`:''}<p class="notice warning">${x.mode==='manual'?'人工来源不要求自动连接器；无连接器时仍不能自动采集。':x.tech.ready?'业务启用后具备自动接入条件。':'启用后仍不能自动采集，需满足技术条件。'}</p><p class="notice">启用不自动补采，需要补采请前往运行计划。</p>`:'<h3>操作影响</h3><ul class="checklist"><li>禁止启动该信源的新采集。</li><li>在途响应可保留待查，不继续自动分析。</li><li>历史资料、引用、证据与结论保留。</li><li>再次启用不自动补采。</li></ul><p class="muted">影响数量仅为示例；真实任务阻断由运行侧执行。</p>'}<div class="field"><label for="operation-reason">操作理由（选填）</label><textarea id="operation-reason"></textarea></div><div id="operation-error" class="error-box" role="alert" tabindex="-1" hidden></div>`;
}
function operationError(text){$('operation-error').hidden=false;$('operation-error').textContent=text;$('operation-error').focus();}
function confirmOperation(){if(pending)return;if(!canOperate()||!canWrite()){operationError('权限或当前场景不允许操作。');return;}const x=byId(operation.id),reason=$('operation-reason').value.trim();const allowed={ACTIVE:['DISABLED'],DISABLED:['ACTIVE']};if(!allowed[x.status].includes(operation.target)){operationError('当前状态不支持此操作，请重新读取。');return;}if(operation.target==='ACTIVE'&&validateEnable(x).length){operationError('启用资料未补齐，原状态不变。');return;}const mode=getWriteMode();if(mode==='error'){operationError('操作失败（演示），业务状态未改变。');return;}if(mode==='conflict'||x.version!==operation.base){operationError('版本已变化（冲突演示），未执行操作。请关闭后重新核对。');return;}const before=snapshot(x);x.status=operation.target;x.version++;if(x.status==='ACTIVE')x.verified=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'（本地演示核验）';recordChange(x,label('status',x.status),reason,before);
 if(mode==='unknown'){pending={kind:'operation',id:x.id};$('operation-title').textContent='操作结果暂未确认';$('operation-body').innerHTML='<div class="result-panel"><h3>尚不能确认本次操作是否完成</h3><p class="notice warning">请求可能已生效。请先查询最新状态，不要重复提交。</p><p>本次理由：'+esc(reason||'未填写')+'</p><p class="muted">未知的是操作结果，不是新增业务状态。</p></div>';$('operation-confirm').textContent='查询最新状态';$('operation-confirm').disabled=false;return;}
 finishOperation(x);
}
function finishOperation(x){const restoring=operation?.target==='ACTIVE';$('operation').close();operation=null;pending=null;renderList();renderDetail();restoreDetail();$('detail-title')?.focus();toast('已确认：'+label('status',x.status)+'，版本 v'+x.version+(restoring?'；启用不自动补采。':''));}
function queryResult(){if(!pending)return;const p=pending,x=byId(p.id);if(p.kind==='save')finishSave(x,p.isNew);else finishOperation(x);}
function closeOperation(){if(pending){toast('请先查询最新状态，再关闭结果窗口。');return;}$('operation').close();operation=null;restoreDetail();}
function viewHistory(index,side){const x=selected(),h=x.history[index],s=h[side];$('history-title').textContent='历史版本 v'+s.version+' · 只读';$('history-body').innerHTML=`<p class="mono">${esc(s.id)} · ${esc(s.code)}</p><p class="notice">${esc(s.name)} · 当时状态：${label('status',s.status)}</p>${sourceArchive(s)}<section><h3>当时引用</h3>${relationsContent(s,true)}</section>`;showModal('history');}
function clearFilters(){ctx().query='';for(const k in ctx().filters)ctx().filters[k]=[];if(state.scene==='empty')state.scene=$('scene').value='normal';render();}
$('filters').addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS'&&e.target.open){for(const d of $('filters').querySelectorAll('details'))if(d!==e.target)d.open=false;}},true);
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#filters'))$('filters').querySelectorAll('details[open]').forEach(d=>d.open=false);});
$('search-form').addEventListener('submit',e=>{e.preventDefault();ctx().query=$('search').value;renderList();renderDetail();});
$('search').addEventListener('search',()=>{ctx().query=$('search').value;renderList();renderDetail();});
$('filters').addEventListener('change',e=>{if(!e.target.dataset.filter)return;const key=e.target.dataset.filter;ctx().filters[key]=[...$('filters').querySelectorAll(`[data-filter="${key}"]:checked`)].map(x=>x.value);renderList();renderDetail();});
$('edit-form').addEventListener('submit',e=>{e.preventDefault();saveEditor();});
$('edit-form').addEventListener('input',()=>{if(edit){edit.dirty=true;edit.draft=readDraft();updateImpact();}});
$('check-duplicate').addEventListener('click',()=>{duplicateCheck();$('duplicate').scrollIntoView({block:'start'});});
$('create').addEventListener('click',()=>openEditor());$('preview-toggle').addEventListener('click',togglePreview);$('clear').addEventListener('click',clearFilters);
$('role').addEventListener('change',e=>{state.role=e.target.value;render();});$('scene').addEventListener('change',e=>{state.scene=e.target.value;render();});
$('reset').addEventListener('click',()=>{records=samples();state.directory=context();state.scene='normal';$('scene').value='normal';$('write-mode').value='normal';render();toast('示例数据已重置。');});
$('operation-confirm').addEventListener('click',()=>pending?queryResult():confirmOperation());
$('editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});$('operation').addEventListener('cancel',e=>{e.preventDefault();closeOperation();});$('history').addEventListener('close',restoreDetail);
$('detail-modal').addEventListener('close',()=>{if(!returnToDetail)document.querySelector(`[data-select="${ctx().selected}"]`)?.focus();});
window.addEventListener('resize',()=>{if(!matchMedia('(max-width:960px)').matches){if($('detail-modal').open)$('detail-modal').close();$('desktop-detail').append($('detail'));}});
document.addEventListener('keydown',e=>{const tab=e.target.closest('[role=tab]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const ids=['archive','tech','relations','history'];let index=ids.indexOf(tab.dataset.tab);index=e.key==='Home'?0:e.key==='End'?3:(index+(e.key==='ArrowRight'?1:-1)+4)%4;state.tab=ids[index];renderDetail();$('tab-'+state.tab).focus();}});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.select){openDetail(b.dataset.select);return;}
 if(b.dataset.view){ctx().view=b.dataset.view;renderHeader();renderList();renderDetail();return;}
 if(b.dataset.group){ctx().collapsed.has(b.dataset.group)?ctx().collapsed.delete(b.dataset.group):ctx().collapsed.add(b.dataset.group);const key=b.dataset.group;renderList();document.querySelector(`[data-group="${CSS.escape(key)}"]`)?.focus();return;}
 if(b.dataset.tab){state.tab=b.dataset.tab;renderDetail();$('tab-'+state.tab).focus();return;}
 if(b.dataset.removeFilter){ctx().filters[b.dataset.removeFilter]=ctx().filters[b.dataset.removeFilter].filter(x=>x!==b.dataset.value);render();return;}
 const action=b.dataset.action;
 if(action==='close-filter'){const d=b.closest('details');d.open=false;d.querySelector('summary').focus();}
 if(action==='expand-all'){ctx().collapsed.clear();renderList();}
 if(action==='collapse-all'){document.querySelectorAll('[data-group]').forEach(g=>ctx().collapsed.add(g.dataset.group));renderList();}
 if(action==='clear')clearFilters();
 if(action==='retry'){state.scene=$('scene').value='normal';render();}
 if(action==='close-detail')$('detail-modal').close();
 if(action==='edit')openEditor(selected());
 if(action==='close-editor')closeEditor();
 if(action==='keep-editing')$('dirty-panel').remove();
 if(action==='discard-editing'){edit.dirty=false;closeEditor(true);}
 if(action==='reuse'){const id=b.dataset.id;if(edit.dirty){$('duplicate').insertAdjacentHTML('beforeend',`<p class="notice">当前填写尚未保存。</p><button type="button" class="danger" data-action="confirm-reuse" data-id="${id}">放弃本次登记并查看已有信源</button>`);}else{$('editor').close();edit=null;openDetail(id);}}
 if(action==='confirm-reuse'){edit.dirty=false;$('editor').close();edit=null;returnToDetail=false;openDetail(b.dataset.id);}
 if(action==='reload-version'){const x=byId(edit.id);$('duplicate').innerHTML=`<p class="notice">最新版本 v${x.version}；本次输入仍保留。请核对以下已保存资料。</p>${pairs([['发布主体',esc(x.publisher)],['范围',esc(x.scope)],['依据',esc(x.basis)]])}<button type="button" class="secondary" data-action="accept-version">已核对，以最新版本重试</button>`;}
 if(action==='accept-version'){edit.base=byId(edit.id).version;$('form-error').hidden=true;toast('已重新核对版本；请明确保存本次填写。');}
 if(action==='status')openOperation(b.dataset.target);
 if(action==='close-operation')closeOperation();
 if(action==='return-edit'){const x=byId(operation.id);closeOperation();openEditor(x);}
 if(action==='query-result')queryResult();
 if(action==='view-history')viewHistory(Number(b.dataset.index),b.dataset.side);
 if(action==='close-history')$('history').close();
 if(action==='external')toast('本原型未接入'+b.dataset.target+'。可在业务系统中只读查看。');
 if(action==='refresh-tech'){$('tech-feedback').textContent=state.scene==='offline'?'离线无法刷新，保留上次读取结果。':'已重新读取本地示例结果，未执行真实连接检测。';}
 if(action==='relation-error'){$('relation-feedback').innerHTML='<p class="error-box">使用关系暂不可查询（失败演示），不能解释为没有引用。</p>';}
 if(action==='refresh-relations'){renderDetail();toast('已重新查询示例关系。');}
});
render();
