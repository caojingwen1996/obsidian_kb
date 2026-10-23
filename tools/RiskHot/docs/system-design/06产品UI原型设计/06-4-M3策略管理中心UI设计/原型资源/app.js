'use strict';
const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const taskNames = ['事件抽取','事件匹配与归组','Target 与 Variable 识别','增量判定','金融意义评级','风险识别','风险同一性判断','风险来源分析','风险应对分析','两股力量比较','风险影响与损害分析','整体风险状态评估','风险方向变化分析','风险持续性变化分析','风险减弱节点识别','风险报告生成'];
const tasks = taskNames.map((name,i) => ({id:i<5?`AI-0${i+1}`:i<7?`AI-L1-0${i-4}`:i<15?`AI-L2-0${i-6}`:'AI-L3-01',name,layer:i<5?'L0':i<7?'L1':i<15?'L2':'L3',version:'1.0',draft:null,schema:''}));
for(const t of tasks){const c=TASK_CONTRACTS[t.id];if(c){t.contract=c;t.schema=contractSchema(c,t.id);}}
const strategies = [
 {id:'STR-L2-01',name:'风险状态分析策略',layer:'L2',module:'F05',scene:'对纳管风险形成当前状态判断',ai:tasks.slice(7,12).map(t=>t.id),active:'1.2',versions:['1.0','1.2','2.0'],status:'已生效',evaluation:'5 项退化候选待复核',time:'2026-10-15 16:20'},
 {id:'STR-L0-01',name:'事件处理策略',layer:'L0',module:'F02',scene:'事件抽取、归组与增量判断',ai:tasks.slice(0,4).map(t=>t.id),active:'1.0',versions:['1.0'],status:'已生效',evaluation:'尚未评估',time:'2026-10-15 11:36'},
 {id:'STR-L0-02',name:'金融意义评级策略',layer:'L0',module:'F02',scene:'金融意义及用途评价',ai:['AI-05'],active:'1.0',versions:['1.0'],status:'已生效',evaluation:'尚未评估',time:'2026-10-14 15:08'},
 {id:'STR-L1-01',name:'风险识别与纳管策略',layer:'L1',module:'F03 / F04',scene:'风险识别、同一性判断与复核',ai:['AI-L1-01','AI-L1-02'],active:'1.0',versions:['1.0'],status:'已生效',evaluation:'尚未评估',time:'2026-10-14 10:42'},
 {id:'STR-L2-02',name:'风险演化分析策略',layer:'L2',module:'F06',scene:'方向、持续性变化与减弱节点',ai:tasks.slice(12,15).map(t=>t.id),active:'1.0',versions:['1.0'],status:'已生效',evaluation:'尚未评估',time:'2026-10-13 17:05'},
 {id:'STR-L3-01',name:'风险报告生成策略',layer:'L3',module:'F08',scene:'周期报告组织与人工发布',ai:['AI-L3-01'],active:null,versions:['0.1'],status:'草稿',evaluation:'尚未评估',time:'2026-10-15 09:18'}
];
const typeNames={START:'开始',PROGRAM:'程序',AI:'AI 分析',HUMAN:'人工',CONDITION:'条件',END:'结束',MODULE:'业务模块'};
function makeFlow(s){return clone(DOMAIN_FLOWS[s.id].nodes);}
for(const s of strategies){s.records={};s.versions.forEach(v=>s.records[v]={state:v===s.active?'已生效':s.active&&v==='1.0'?'已停用':'草稿',flow:makeFlow(s),scope:s.scene,reason:'按系统总览与领域文档整理的业务蓝图（版本为演示）',audit:[]});}
const runs=[{id:'DEMO-RUN-017',version:'1.2',state:'在途',snapshot:'证据快照 E-20261015-01',model:'演示模型 A / r1'},{id:'DEMO-RUN-009',version:'1.0',state:'已完成',snapshot:'证据快照 E-20261012-03',model:'演示模型 A / r1'}];
const cases=[{id:'DEMO-C01',name:'证据缺口的受限结论',tag:'改善',input:'关键指标缺失；保留有效事件及截止时间。',before:'失败',after:'通过'},{id:'DEMO-C02',name:'风险变量身份歧义',tag:'退化候选',input:'同名变量、两组作用机制，当前风险身份已确认。',before:'通过',after:'待复核'},{id:'DEMO-C03',name:'重复证据不重复计入',tag:'持平',input:'同一证据的两次到达记录，证据版本相同。',before:'通过',after:'通过'}];
let dataset={version:'1.0',name:'风险状态分析标准案例',size:100};
const evaluations=[{id:'DEMO-EVAL-021',baseline:'1.2',candidate:'2.0',dataset:'1.0',state:'已完成',limited:false,time:'2026-10-15 16:20',refs:'AI-L2-01～05 @1.0 / Schema @1.0',model:'演示模型 A / r1',snapshot:'E-20261015-01'}];
const navigationView=()=>['panorama','catalog','ai','evaluation'].includes(globalThis.location?.hash.slice(1).split('/')[0])?globalThis.location.hash.slice(1).split('/')[0]:'catalog';
let state={panoramaLayersCollapsed:[],panoramaLayer:'L0',panoramaCollapsed:SYSTEM_PANORAMA.stages.flatMap(stage=>stage.modules?.map(module=>module.code)||[]),view:navigationView(),selected:'STR-L2-01',version:'2.0',detail:'flow',node:navigationView()==='panorama'?'':'C',nodeConfig:false,nodeRoutingKey:'',role:'系统管理员',query:'',layer:'全部',status:'全部',module:'全部',versionQuery:'',task:'AI-L2-01',taskTab:'definition',nodeTaskTab:'definition',nodeTaskKey:'',aiQuery:'',evalTab:'compare',caseFilter:'全部',compareThird:false,limited:false,checks:null};
function applyTaskRoute(){
 const route=globalThis.location?.hash.split('/')||[];
 state.taskRouteError=false;
 if(route[0]!=='#ai'||route.length===1)return;
 const target=tasks.find(t=>route.length===3&&t.id===route[1]&&t.version===route[2]);
 if(target){state.task=target.id;state.aiQuery='';state.taskTab='definition';}else state.taskRouteError=true;
}
applyTaskRoute();
const isAdmin=()=>state.role==='系统管理员';
const strategy=()=>strategies.find(s=>s.id===state.selected);
const record=()=>strategy().records[state.version];
const isSystemFlow=()=>state.view==='panorama';
const flowRecord=()=>isSystemFlow()?{state:'业务架构',flow:SYSTEM_PANORAMA.nodes}:record();
const blueprint=()=>isSystemFlow()?SYSTEM_PANORAMA:DOMAIN_FLOWS[strategy().blueprint||strategy().id];
const editable=()=>state.view!=='panorama'&&isAdmin()&&record().state==='草稿';
const badge=(text)=>`<span class="pill ${text==='已生效'||text==='通过'?'green':text.includes('退化')||text==='失败'?'red':text==='草稿'||text.includes('复核')||text==='审核中'?'amber':''}">${esc(text)}</span>`;
const btn=(text,action,primary=false,disabled=false,extra='')=>`<button data-action="${action}" ${extra} class="${primary?'primary':''}" ${disabled?'disabled':''}>${text}</button>`;
const options=(values,selected)=>values.map(v=>`<option ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4000);}
function pageTools(){
 const s=strategy(),r=record(),t=tasks.find(t=>t.id===state.task);
 if(state.view==='catalog')return `<div class="actions">${btn('＋ 新建策略','new',true,!isAdmin())}</div>`;
 if(state.view==='detail')return `<div class="actions strategy-tools"><label class="version-picker">查看版本<select id="version">${options(s.versions.map(v=>'V'+v),'V'+state.version)}</select></label>${btn('复制策略','copy',false,!isAdmin())}${r.state==='草稿'?btn('保存草稿','save',true,!isAdmin()):btn('创建新修订','revision',true,!isAdmin())}</div>${state.detail==='flow'?`<div class="actions">${btn('检查完整性','validate')}${state.view==='panorama'?'':btn('＋ 添加节点','add-node',false,!editable())}</div>`:state.detail==='history'?`<div class="actions">${r.state==='草稿'?btn('提交审核','review',true,!isAdmin()):r.state==='审核中'?btn('审核并生效','activate',true,!isAdmin()):r.state==='已生效'?btn('停用版本','disable',false,!isAdmin()):'<span class="muted small">此版本保留用于历史追溯。</span>'}${r.state==='审核中'?btn('退回修改','return-review',false,!isAdmin()):''}</div>`:''}`;
 if(state.view==='panorama')return '';
 if(state.view==='ai'&&state.taskRouteError)return '';
 if(state.view==='ai')return `${btn(t.draft?'编辑任务草稿':'创建任务修订','edit-task',true,!isAdmin())}`;
 return `${btn('＋ 新建评估','new-eval',true,!isAdmin())}${state.evalTab==='datasets'?`${btn('创建评测集修订','revise-dataset',false,!isAdmin())}`:''}`;
}
function render(){
 const panoramaActive=state.view==='panorama';
 $('#module-title').textContent=panoramaActive?'流水线全景':'策略管理中心';
 document.title='RiskHot · '+(panoramaActive?'流水线全景':'M3 策略管理中心');
 document.querySelectorAll('.support-nav').forEach(nav=>nav.dataset.section=panoramaActive?'panorama':'strategy');
 document.querySelectorAll('[data-primary-nav]').forEach(item=>{
  const active=item.dataset.primaryNav===(panoramaActive?'panorama':'strategy');
  item.classList.toggle('active',active);
  if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
 });
 const view=state.view==='detail'?'catalog':state.view;
 const viewHash=view==='ai'&&!state.taskRouteError?'#ai/'+state.task+'/'+tasks.find(t=>t.id===state.task).version:'#'+view;
 if(globalThis.location&&!state.taskRouteError&&globalThis.location.hash!==viewHash)globalThis.history?.replaceState(null,'',viewHash);
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===(state.view==='detail'?'catalog':state.view))));
 $('#top-back').hidden=state.view!=='detail';
 $('#page-tools').innerHTML=pageTools();
 $('#content').innerHTML=(state.view==='catalog'?catalog():state.view==='detail'?detail():state.view==='panorama'?panorama():state.view==='ai'?aiView():evaluationView());
 observeF01Layout();
}
function catalog(){
 // 只排序筛选副本；原数组顺序用于既有演示评估引用。
 const filtered=strategies.filter(s=>(s.name+s.id+s.module+s.scene).toLowerCase().includes(state.query.toLowerCase())&&(state.layer==='全部'||s.layer===state.layer)&&(state.status==='全部'||Object.values(s.records).some(r=>r.state===state.status))&&(state.module==='全部'||s.module.includes(state.module))&&(!state.versionQuery||s.versions.some(v=>v.includes(state.versionQuery)))).sort((a,b)=>a.layer.localeCompare(b.layer,'zh-CN',{numeric:true})||a.module.localeCompare(b.module,'zh-CN',{numeric:true})||a.id.localeCompare(b.id,'zh-CN',{numeric:true}));
 return `<div class="between section-head"><div><h2>策略设计与管理</h2><p class="muted small">策略目录 · 按业务场景组织策略，保留每次修订的依据。</p></div></div>
 <div class="toolbar"><label>名称 / 编码<input id="search" placeholder="搜索策略名称、稳定编码或业务场景" value="${esc(state.query)}"></label><label>业务层<select id="layer">${options(['全部','L0','L1','L2','L3'],state.layer)}</select></label><label>主责模块<select id="module">${options(['全部','F02','F03','F04','F05','F06','F08'],state.module)}</select></label><label>版本状态<select id="status">${options(['全部','草稿','审核中','已生效','已停用'],state.status)}</select></label><label>版本<input id="version-search" placeholder="如 1.2" value="${esc(state.versionQuery)}"></label></div>
 <div class="table-wrap"><table class="catalog-table"><thead><tr><th>策略名称 / 稳定编码</th><th>业务归属</th><th>当前生效</th><th>设计状态</th><th>AI 任务</th><th>最近评估</th><th>操作</th></tr></thead><tbody>${filtered.map(s=>`<tr data-strategy="${s.id}"><td><div class="name">${esc(s.name)}</div><div class="code muted">${esc(s.id)}</div><div class="sub">${esc(s.scene)}</div></td><td data-label="业务归属">${s.layer} · ${esc(s.module)}</td><td data-label="当前生效">${s.active?`V${s.active}`:'—'}</td><td data-label="设计状态">${badge(s.records[s.versions.at(-1)].state)}</td><td data-label="AI 任务">${s.ai.length} 项</td><td data-label="最近评估"><span class="${s.evaluation.includes('退化')?'negative':''}">${esc(s.evaluation)}</span><div class="sub">${s.time}</div></td><td>${btn('打开策略 →','open',false,false,`data-id="${s.id}"`)}</td></tr>`).join('')}</tbody></table>${!filtered.length?'<div class="empty">没有匹配的策略。请调整搜索条件。<br><button data-action="clear-filters">清空筛选</button></div>':''}</div>
 <div class="count-line"><span>共 ${filtered.length} 条策略 · 首批目录基线</span><span>修改时间：Asia/Shanghai</span></div><div class="callout">策略定义处理方式；正式业务结果由对应业务模块校验并保存。策略评估提供依据，生效由系统管理员确认。</div>`;
}
function panorama(){return `${flowHeader()}${flowView()}`;}
function detail(){const s=strategy(),r=record();return `<section class="strategy-header" aria-label="策略身份与编辑工具"><div><div class="version-title"><h2>${esc(s.name)}</h2>${badge(r.state)}</div><div class="strategy-meta"><span class="code">${s.id}</span><span>${s.layer} · ${s.module}</span><span>当前生效 ${s.active?'V'+s.active:'无'}</span></div></div></section>
 <nav class="strategy-sections" aria-label="策略设计与管理分区">${[['basic','策略基本信息与适用范围','业务目标与使用边界'],['flow','流水线编排','核心编辑区域'],['dependencies','规则与 AI Task 引用','固定引用与使用关系'],['history','版本治理与生效','审核、生效与历史追溯']].map(([key,label,hint])=>`<button data-detail="${key}" aria-pressed="${state.detail===key}"><span>${label}</span><small>${hint}</small></button>`).join('')}</nav>
 ${!isAdmin()?'<div class="callout warn strategy-notice">授权阅读者 · 当前为只读预览，维护、审核与生效操作不可用。</div>':r.state!=='草稿'?'<div class="callout strategy-notice">此版本只读。修改需创建新修订；历史运行保持原版本引用。</div>':''}
 <section class="strategy-region" aria-label="${({basic:'策略基本信息与适用范围',flow:'流水线编排',dependencies:'规则与 AI Task 引用',history:'版本治理与生效'})[state.detail]}">${state.detail==='flow'?flowView():state.detail==='basic'?basicView():state.detail==='dependencies'?dependenciesView():historyView()}</section>`;}
function stageNodes(stage){return stage.items.flatMap(item=>typeof item==='string'?[item]:item.lanes.flatMap(l=>l.nodes));}
function nodeStage(id){return blueprint()?.stages?.find(stage=>stageNodes(stage).includes(id));}
function flowNodeTitle(n){return n.name;}
function flowEdgeLabel(n,edge){return edge.label;}
function flowNode(n, selected,overview=false){
 const symbol={PROGRAM:'ƒ',AI:'AI',HUMAN:'人',CONDITION:'◇',MODULE:n.module||'F',START:'○',END:'□'}[n.type];
 const title=n.type==='MODULE'?n.name.replace(/^F[0-9]{2}\s*/,''):flowNodeTitle(n);
 const kind=isSystemFlow()?n.panoramaKind:'';
 const role=isSystemFlow()?n.panoramaRole:n.type;
 const roleName=kind==='START'?'输入 / 触发':kind==='END'?n.panoramaBoundary:kind==='SUPPORT'?'治理支撑':typeNames[role];
 const icon=kind==='START'?'<path d="m8 5 10 7-10 7Z"/>':kind==='END'?'<path d="M6 6h12v12H6z"/>':role==='CONDITION'?'<path d="m12 3 9 9-9 9-9-9Z"/>':role==='AI'?'<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/>':role==='HUMAN'?'<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>':'<path d="m8 6-5 6 5 6m8-12 5 6-5 6M14 4l-4 16"/>';
 const step=isSystemFlow()&&n.panoramaStep?`<span class="flow-step-index">${esc(n.panoramaStep)}</span>`:'';
 return `<button class="node ${n.type} ${kind?'visual-'+kind+' role-'+role:''} ${n.panoramaBoundary==='待处理出口'?'boundary-wait':''} ${n.id===selected?'selected':''}" data-node="${esc(n.id)}" aria-pressed="${n.id===selected}">${isSystemFlow()?`<svg class="node-role-icon" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`:`<span class="step-number">${esc(symbol)}</span>`}<span class="node-copy"><span class="node-title">${step}${isSystemFlow()?' · ':''}${esc(title)}</span>${overview?`<small class="node-caption">${esc(n.outputDescription||n.summary)}</small>`:''}</span><span class="node-type">${esc(roleName)}</span></button>`;
}
function flowEdge(from,to,label,content=''){
 return `<div class="module-step-connector" data-flow-edge="${esc(from)}:${esc(to)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-4-4 4 4 4-4"/></svg>${label?`<span>${esc(label)}</span>`:''}</div>${content}`;
}
function renderModulePipeline(selected,nodes,moduleCode='F01'){
 const ordered=moduleCode==='F01'?['IN-S','IN-CHECK','IN-ING','IN-READ','IN-VERSION','IN-SAVE','IN-DELIVER','IN-DONE']:blueprint().stages.flatMap(stage=>stage.modules||[]).find(module=>module.code===moduleCode).pipeline;
 const node=id=>nodes.find(n=>n.id===id),placed=new Set(ordered);
 const edgeControl=(from,edge,kind)=>`<button class="f01-edge-label ${kind}" data-flow-edge="${esc(from)}:${esc(edge.to)}" data-select-node="${esc(edge.to)}">${esc(edge.label)}</button>`;
 const rows=ordered.map((id,i)=>{
  const n=node(id),next=ordered[i+1],main=n.next.find(e=>e.to===next);
  const exits=n.next.filter(e=>e!==main);
  const branches=exits.map(edge=>{
   const target=node(edge.to),internal=target.module===moduleCode,inline=internal&&!placed.has(target.id);
   if(internal&&!inline)return `<section class="f01-branch f01-direct" data-f01-from="${esc(id)}" data-f01-to="${esc(target.id)}">${edgeControl(id,edge,'f01-condition')}</section>`;
   if(inline)placed.add(target.id);
   const edgeAttr=`data-flow-edge="${esc(id)}:${esc(target.id)}"`;
   const destination=inline?flowNode(target,selected,false).replace('data-node=',edgeAttr+' data-node='):`<button class="f01-reference" ${edgeAttr} data-select-node="${esc(target.id)}">进入 ${esc(target.module)} · ${esc(target.name)}</button>`;
   return `<section class="f01-branch" data-f01-from="${esc(id)}" data-f01-to="${esc(target.id)}"><div class="f01-edge-label f01-condition">${esc(edge.label)}</div><div class="f01-destination">${destination}</div>${inline?target.next.map(back=>edgeControl(target.id,back,target.type==='END'?'f01-return':'f01-continuation')).join(''):''}</section>`;
  }).join('');
  return `${n.panoramaGroupTitle?`<h4 class="f02-step-heading">${esc(n.panoramaGroupTitle)}</h4>`:''}<div class="f01-step" data-f01-row="${id}"><div class="f01-main">${flowNode(n,selected,false)}${main?`<div class="f01-main-edge" data-flow-edge="${id}:${next}">${n.next.length>1?`<span>${esc(main.label)}</span>`:''}</div>`:''}</div>${branches?`<div class="f01-branches" aria-label="${esc(n.name)}的条件出口">${branches}</div>`:''}</div>`;
 }).join('');
 return `<div class="f01-topology ${moduleCode==='F02'?'f02-topology':''}" data-pipeline-module="${moduleCode}" aria-label="${moduleCode} 主线向下，条件直连，虚线恢复"><svg class="f01-wires" aria-hidden="true"></svg>${rows}</div>`;
}
let f01LayoutObserver;
function observeF01Layout(){
 if(!globalThis.ResizeObserver)return;
 f01LayoutObserver?.disconnect();
 const diagrams=[...document.querySelectorAll('.f01-topology')];
 if(!diagrams.length)return;
 const markupByDiagram=new WeakMap();
 // Measure after wrapping and disclosure changes so arrows meet the actual endpoints.
 const draw=diagram=>{
  if(!diagram.isConnected||!diagram.getBoundingClientRect().width)return;
  const base=diagram.getBoundingClientRect(),svg=diagram.querySelector('.f01-wires');
  const box=el=>{const r=el.getBoundingClientRect();return {x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height};};
  const paths=[];
  const laneTargets=[...new Set([...diagram.querySelectorAll('.f01-direct')].map(branch=>branch.dataset.f01To))];
  const laneFor=id=>base.width-4-Math.max(0,laneTargets.indexOf(id))*8;
  const path=(d,x,y,direction,kind,key)=>{
   const tip=direction==='down'?`M${x-4},${y-5}L${x},${y}L${x+4},${y-5}`:direction==='left'?`M${x+5},${y-4}L${x},${y}L${x+5},${y+4}`:`M${x-5},${y-4}L${x},${y}L${x-5},${y+4}`;
   paths.push(`<g data-f01-line="${esc(key)}" class="${kind}"><path d="${d}"/><path class="f01-arrow" d="${tip}"/></g>`);
  };
  diagram.querySelectorAll('.f01-main-edge').forEach(edge=>{
   const [from,to]=edge.dataset.flowEdge.split(':');
   const a=box(diagram.querySelector(`[data-node="${from}"]`)),b=box(diagram.querySelector(`[data-node="${to}"]`));
   const x=a.x+a.w/2,y=b.y;
   path(`M${x},${a.y+a.h}V${y}`,x,y,'down','',edge.dataset.flowEdge);
  });
  diagram.querySelectorAll('.f01-branch').forEach(branch=>{
   const a=box(diagram.querySelector(`[data-node="${branch.dataset.f01From}"]`));
   const key=branch.dataset.f01From+':'+branch.dataset.f01To;
   if(branch.classList.contains('f01-direct')){
    const label=box(branch),target=box(diagram.querySelector(`[data-node="${branch.dataset.f01To}"]`));
    const rail=a.x+a.w+(label.x-a.x-a.w)/2,outY=label.y+label.h-4;
    // Separate bypass lanes from the shared hold lane; all terminate at real nodes.
    const lane=laneFor(branch.dataset.f01To);
    if(!diagram.querySelector(`[data-node="${branch.dataset.f01To}"]`).closest('.f01-main')){
     const x=target.x+target.w,y=target.y+target.h/2;
     path(`M${a.x+a.w},${a.y+a.h/2}H${rail}V${outY}H${lane}V${y}H${x}`,x,y,'left','',key);
    }else{
     const x=target.x+target.w/2,y=target.y;
     path(`M${a.x+a.w},${a.y+a.h/2}H${rail}V${outY}H${lane}V${y-12}H${x}V${y}`,x,y,'down','',key);
    }
   }else{
    const b=box(branch.querySelector('.f01-destination'));
    const x=b.x,y=b.y+b.h/2,rail=a.x+a.w+(b.x-a.x-a.w)/2;
    path(`M${a.x+a.w},${a.y+a.h/2}H${rail}V${y}H${x}`,x,y,'right','',key);
   }
   branch.querySelectorAll('.f01-return,.f01-continuation').forEach(edge=>{
    const [from,to]=edge.dataset.flowEdge.split(':');
    const start=box(diagram.querySelector(`[data-node="${from}"]`)),end=box(diagram.querySelector(`[data-node="${to}"]`)),label=box(edge);
    if(edge.classList.contains('f01-continuation')){
     const x=end.x+end.w/2,y=end.y,lane=laneFor(to),bottom=label.y+label.h+8;
     path(`M${start.x+start.w/2},${start.y+start.h}V${bottom}H${lane}V${y-12}H${x}V${y}`,x,y,'down','',edge.dataset.flowEdge);
     return;
    }
    const x=end.x,y=end.y+end.h/2,lane=end.x-8,bottom=label.y+label.h;
    path(`M${start.x+start.w/2},${start.y+start.h}V${bottom}H${lane}V${y}H${x}`,x,y,'right','f01-recovery-line',edge.dataset.flowEdge);
   });
  });
  const viewBox=`0 0 ${base.width} ${base.height}`,markup=paths.join('');
  if(svg.getAttribute('viewBox')!==viewBox)svg.setAttribute('viewBox',viewBox);
  if(markupByDiagram.get(diagram)!==markup){svg.innerHTML=markup;markupByDiagram.set(diagram,markup);}
 };
 f01LayoutObserver=new ResizeObserver(()=>diagrams.forEach(draw));
 diagrams.forEach(diagram=>{
  f01LayoutObserver.observe(diagram);
  diagram.querySelectorAll('.f01-step,.f01-branch,.f01-destination,.f01-main > .node').forEach(el=>f01LayoutObserver.observe(el));
  draw(diagram);
 });
}
function renderFlowGroup(item,selected,nodes,overview=false,context){
 if(!isSystemFlow())return `<section class="domain-group ${item.parallel?'parallel-group':'conditional-group'}" data-flow-group="${item.parallel?'parallel':'conditional'}"><div class="group-title"><span>${esc(item.title)}</span><small>${item.parallel?'并行路径 · 按必要依赖汇合':'条件路径'}</small></div><div class="domain-lanes" style="--lanes:${item.lanes.length}">${item.lanes.map(l=>`<section class="domain-lane"><div class="lane-label">${esc(l.title)}</div>${l.nodes.map((id,i)=>{const n=nodes.find(n=>n.id===id),edge=n.next.find(e=>e.to===l.nodes[i+1]);return flowNode(n,selected,overview)+(edge?`<div class="module-step-connector"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-4-4 4 4 4-4"/></svg><span>${esc(edge.label)}</span></div>`:'');}).join('')}</section>`).join('')}</div></section>`;
 const anchor=context?.groupAnchors.get(item);
 return `<section class="domain-group ${item.parallel?'parallel-group':'conditional-group'}" data-flow-group="${item.parallel?'parallel':'conditional'}"><div class="group-title">${esc(item.title)}${item.parallel?'<small>并行 · 按必要依赖汇合</small>':''}</div><div class="domain-lanes" style="--lanes:${item.lanes.length}">${item.lanes.map(l=>{const target=l.nodes[0]||l.handoffs?.[0],edge=anchor?.next.find(e=>e.to===target);return `<section class="domain-lane">${edge?flowEdge(anchor.id,target,`路径 ${l.path} · ${edge.label}`):`<div class="lane-label">路径 ${esc(l.path)} · ${esc(l.title)}</div>`}${(l.handoffs||[]).map(id=>`<button class="path-handoff link" data-select-node="${esc(id)}">交付 ${esc(nodeLocation(nodes.find(n=>n.id===id)))}</button>`).join('')}${l.nodes.map((id,i)=>renderSystemNode(nodes.find(n=>n.id===id),selected,nodes,l.nodes[i+1],context)).join('')}</section>`;}).join('')}</div></section>`;
}
function nodeExits(n,selected,nodes,excluded=[],context){
 const represented=[...excluded,...(context?.groupTargets.get(n.id)||[])];
 const remaining=n.next.filter(e=>!represented.includes(e.to));
 if(!remaining.length)return '';
 return `<div class="node-exits" aria-label="${esc(n.name)}的出口">${remaining.map(edge=>{
  const target=nodes.find(n=>n.id===edge.to);
  const inline=context?.inline.has(target.id)&&!context.placed.has(target.id);
  if(inline){context.placed.add(target.id);return `<section class="inline-outcome">${flowEdge(n.id,target.id,edge.label)}${flowNode(target,selected,false)}</section>`;}
  return `<button class="link" data-flow-edge="${esc(n.id)}:${esc(target.id)}" data-select-node="${esc(target.id)}"><span>${esc(edge.label)}</span><span>→ ${esc(nodeStage(target.id)?.code+' / '+target.module+' / '+target.panoramaStep)}</span></button>`;
 }).join('')}</div>`;
}
function renderSystemNode(n,selected,nodes,next,context){
 const targets=typeof next==='string'?[next]:next?next.lanes.flatMap(l=>[...l.nodes.slice(0,1),...(l.handoffs||[])]):[];
 const connection=typeof next==='string'&&n.next.find(e=>e.to===next);
 return `<div class="panorama-step">${flowNode(n,selected,true)}${nodeExits(n,selected,nodes,targets,context)}</div>${connection?flowEdge(n.id,next,n.type==='CONDITION'?connection.label:''):''}`;
}
function renderSystemSections(sections,selected,nodes){
 const ids=sections.flatMap(s=>s.items.flatMap(i=>typeof i==='string'?[i]:i.lanes.flatMap(l=>l.nodes)));
 const outcomes=sections.filter(s=>s.kind==='outcomes').flatMap(s=>s.items.flatMap(i=>typeof i==='string'?[i]:i.lanes.flatMap(l=>l.nodes)));
 const context={inline:new Set(outcomes.filter(id=>nodes.some(n=>ids.includes(n.id)&&n.type==='CONDITION'&&n.next.some(e=>e.to===id)))),placed:new Set(),groupAnchors:new Map(),groupTargets:new Map()};
 const filtered=sections.map(s=>({...s,steps:s.steps.flatMap(step=>{
  if(typeof step.item==='string')return context.inline.has(step.item)?[]:[step];
  const lanes=step.item.lanes.map(l=>({...l,nodes:l.nodes.filter(id=>!context.inline.has(id))})).filter(l=>l.nodes.length||l.handoffs?.length);
  return lanes.length?[{...step,item:{...step.item,lanes}}]:[];
 })})).filter(s=>s.steps.length);
 for(const section of filtered)for(const {item} of section.steps){
  if(typeof item==='string')continue;
  const targets=item.lanes.flatMap(l=>[...l.nodes.slice(0,1),...(l.handoffs||[])]);
  const anchor=nodes.find(n=>ids.includes(n.id)&&n.next.filter(e=>targets.includes(e.to)).length>=2);
  if(anchor){context.groupAnchors.set(item,anchor);context.groupTargets.set(anchor.id,targets);}
 }
 return filtered.map(section=>`<section class="panorama-section ${section.kind==='outcomes'?'panorama-outcomes':''}"><header class="panorama-section-head"><h4>${esc(section.title)}</h4>${section.kind==='followup'?'<p>发布后的独立授权动作，按需要执行。</p>':''}</header>${section.steps.map(({item},index)=>typeof item==='string'?renderSystemNode(nodes.find(n=>n.id===item),selected,nodes,section.steps[index+1]?.item,context):renderFlowGroup(item,selected,nodes,true,context)).join('')}</section>`).join('');
}
function renderModuleConcepts(module){
 if(!module.concepts?.length)return '';
 const source=FLOW_SOURCES[module.conceptSource];
 return `<details class="module-concepts" data-module-concepts="${esc(module.code)}"><summary><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/></svg><span>概念定义</span><svg class="concept-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></summary><dl class="concept-definitions">${module.concepts.map(c=>`<div><dt>${esc(c.name)} <span>${esc(c.term)}</span></dt><dd><p>${esc(c.definition)}</p><p>${esc(c.boundary)}</p></dd></div>`).join('')}</dl>${source?`<a class="concept-source" href="${esc(encodeURI('../../../../'+source.path))}" target="_blank" rel="noopener">定义依据：${esc(source.title)} ${esc(module.conceptSections)}</a>`:''}</details>`;
}
function renderSystemStage(stage,selected,nodes){
 if(!stage.modules)return renderSystemSections(stage.sections,selected,nodes);
 return stage.modules.map((module,index)=>{
  const open=!state.panoramaCollapsed.includes(module.code);
  const nextModule=stage.modules[index+1];
  const connected=nextModule&&module.nodeIds.some(id=>nodes.find(n=>n.id===id).next.some(edge=>nextModule.nodeIds.includes(edge.to)));
  return `<details class="module-card" data-flow-module="${module.code}" ${open?'open':''}><summary class="module-card-head"><span class="module-code">${module.code}</span><span class="module-card-copy"><span class="module-card-title">${esc(module.name)}</span></span><span class="module-card-meta"><span class="module-step-range">${esc(module.stepRange)}</span><span class="module-toggle"><span data-module-toggle>${open?'收起':'展开'}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></span></span></summary><div class="module-card-body">${renderModuleConcepts(module)}${['F01','F02'].includes(module.code)?renderModulePipeline(selected,nodes,module.code):renderSystemSections(module.sections,selected,nodes)}</div></details>${connected?`<div class="module-connector"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-4-4 4 4 4-4"/></svg><span>${esc(({F01:'标准化资料',F03:'风险候选 · 按条件进入身份与准入处理',F05:'当前快照 · 可比历史进入变化分析'})[module.code]||'按已确认业务条件交付')}</span></div>`:''}`;
 }).join('');
}
function renderStageBody(stage,selected,nodes){
 if(stage.sections)return renderSystemStage(stage,selected,nodes);
 if(stage.overviewNodes){
  const extra=stageNodes(stage).filter(id=>!stage.overviewNodes.includes(id));
  return `${stage.kind==='support'?'<div class="support-definitions"><span><b>M1</b> 来源资格</span><span><b>M2</b> 观察定义</span><span><b>M3</b> 分析方法</span></div>':''}<div class="overview-modules">${stage.overviewNodes.map(id=>flowNode(nodes.find(n=>n.id===id),selected,true)).join('')}</div>${extra.length?`<details class="stage-extra" ${extra.includes(selected)?'open':''}><summary>${esc(stage.extraTitle||'业务条件与其他路径')} <span>${extra.length} 个节点</span></summary><div class="extra-nodes">${extra.map(id=>flowNode(nodes.find(n=>n.id===id),selected)).join('')}</div></details>`:''}`;
 }
 return stage.items.map((item,j)=>typeof item==='string'?`<div class="stage-node-wrap">${flowNode(nodes.find(n=>n.id===item),selected)}${j<stage.items.length-1&&typeof stage.items[j+1]==='string'&&nodes.find(n=>n.id===item).next.some(e=>e.to===stage.items[j+1])?'<div class="flow-arrow" aria-hidden="true">↓</div>':''}</div>`:renderFlowGroup(item,selected,nodes)).join('');
}
function flowStageHeader(stage){
 if(isSystemFlow()&&stage.kind==='business')return `<summary class="stage-head stage-head-primary"><span class="stage-code">${esc(stage.code)}</span><span class="stage-heading-copy"><span class="stage-title">${esc(stage.title)}</span><span class="stage-description">${esc(stage.description)}</span></span><svg class="stage-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></summary>`;
 return `<header class="stage-head"><span class="stage-code">${esc(stage.code)}</span><div><h3>${esc(stage.title)}</h3><p>${esc(stage.description)}</p></div>${isSystemFlow()?'':`<span class="stage-count">${stage.stepCount?stage.stepCount+' 步':stageNodes(stage).length+' 节点'}</span>`}</header>`;
}
function panoramaDelivery(stage){
 const deliveries={L0:['RISK-S','满足触发条件的实质事件变化 → L1 / F03'],L1:['STATE-S','正式风险身份与有效观察关系 → L2 / F05'],L2:['VIEW-S','已保存结果供 L3 按需查询 / 报告引用']};
 const delivery=deliveries[stage.code];
 return delivery?`<div class="layer-delivery"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-4-4 4 4 4-4"/></svg><button class="link" data-select-node="${delivery[0]}">${esc(delivery[1])}</button></div>`:'';
}
function flowOverview(selected){
 const nodes=flowRecord().flow,definition=blueprint();
 const original=definition?.nodes;
 const sameGraph=original&&nodes.length===original.length&&nodes.every(n=>{const initial=original.find(x=>x.id===n.id);return initial&&JSON.stringify(n.next)===JSON.stringify(initial.next);});
 if(!sameGraph)return `<div class="custom-flow-note">当前为修改后的流程。点击节点核对实际后继与配置。</div>${nodes.map(n=>flowNode(n,selected)).join('<div class="flow-arrow" aria-hidden="true">·</div>')}`;
 if(isSystemFlow())return definition.stages.map((stage,i)=>{
  const business=stage.kind==='business',tag=business?'details':'section';
  return `<${tag} class="flow-stage ${business?'business-stage':'support-stage'} ${state.panoramaLayer===stage.code?'current-layer':''}" data-stage="${esc(stage.code)}" ${business?`data-flow-layer="${stage.code}" ${state.panoramaLayersCollapsed.includes(stage.code)?'':'open'}`:''} id="flow-stage-${i}">${flowStageHeader(stage)}<div class="stage-body">${renderStageBody(stage,selected,nodes)}</div></${tag}>${panoramaDelivery(stage)}`;
 }).join('');
 return definition.stages.map((stage,i)=>`<section class="flow-stage ${stage.kind==='support'?'support-stage':''}" data-stage="${esc(stage.code)}" id="flow-stage-${i}">${flowStageHeader(stage)}<div class="stage-body">${renderStageBody(stage,selected,nodes)}</div>${!isSystemFlow()&&stage.output?`<div class="stage-output"><span>交付</span>${esc(stage.output)}</div>`:''}</section>${i<definition.stages.length-1?(definition.stages[i+1].kind==='business'?'<div class="stage-connector" aria-hidden="true">↓</div>':`<div class="stage-divider">${definition.stages[i+1].kind==='support'?'横向支撑 · 跨阶段复用':definition.stages[i+1].kind==='outcomes'?'按业务条件转入的独立出口':'后续显式业务动作'}</div>`):''}`).join('');
}
function nodeExplanation(n){
 const executor=n.type==='AI'?'AI 智能分析':n.type==='CONDITION'?'程序按已确认规则判断':n.type==='END'?'业务交接 / 等待边界':n.type==='START'?'上游业务模块':n.type==='HUMAN'?'系统管理员':n.type==='MODULE'?'对应业务模块（内部程序与AI分工见分场景流水线）':'主责业务模块中的程序';
 return [n.summary||`执行“${n.name}”，以当前输入、输出与后继配置为准。`,executor,n.inputDescription||`输入映射：${n.input}`,n.outputDescription||`输出映射：${n.output}`,n.ruleDetail||'核对职责、引用和有效后继。'];
}
function sourceView(n){
 const ref=FLOW_SOURCES[n.source],compact=n.type!=='AI';
 const citation=ref?`<a href="${esc(encodeURI('../../../../'+ref.path))}" target="_blank" rel="noopener">${esc(ref.title)}</a><p class="small">${esc(n.section)}</p>`:'<p class="muted small">尚未绑定业务文档</p>';
 return `<section class="node-section source-section">${compact?`<details class="node-source"><summary>文档依据</summary>${citation}</details>`:`<h3>文档依据</h3>${citation}`}${n.pending?`<div class="callout warn">待确认：${esc(n.pending)}</div>`:''}</section>`;
}
function flowHeader(){
 if(isSystemFlow())return '<div class="flow-heading"><h2>流水线全景</h2></div>';
 const r=flowRecord();return `<div class="flow-heading"><div><h3>流水线编排</h3><p>按业务环节阅读流程，点击节点查看职责、依据与实际流向。 共 ${r.flow.length} 个节点。</p></div></div>`;
}
function flowView(){
 const r=flowRecord(),waiting=isSystemFlow()&&!state.node,n=r.flow.find(n=>n.id===state.node)||r.flow[0],selected=waiting?'':n.id;
 if(!waiting)state.node=n.id;
 return `${state.view==='panorama'?'':flowHeader()}<div class="legend">${['PROGRAM','AI','HUMAN','CONDITION'].map(t=>`<span><i class="type-dot ${t}"></i>${typeNames[t]}</span>`).join('')}<span><i class="type-dot boundary"></i>流程边界</span></div>
 <div class="flow-layout flow-overview${isSystemFlow()?' system-panorama':''}"><section class="flow-area" aria-label="${isSystemFlow()?'RiskHot 系统完整流程':'策略流水线'}">${blueprint()?.stages?`<nav class="stage-nav" aria-label="流程分层">${blueprint().stages.map((stage,i)=>`<button type="button" data-stage-target="flow-stage-${i}" class="${(isSystemFlow()?state.panoramaLayer===stage.code:stageNodes(stage).includes(selected))?'current':''}" ${isSystemFlow()&&state.panoramaLayer===stage.code?'aria-current="location"':''}>${esc(stage.code)}<span>${esc(stage.title)}</span></button>`).join('')}</nav>`:''}<div class="node-list">${flowOverview(selected)}</div></section>
 ${waiting?'<aside class="inspector node-detail panorama-empty" aria-label="步骤详情" tabindex="0"><h2>步骤详情</h2><p>展开模块并选择步骤，查看输入、产出和流向。</p></aside>':nodeDetail(n)}</div>${state.checks?validationView():''}`;
}
function nodeForm(n){const r=flowRecord();return `<form id="node-form"><fieldset ${editable()?'':'disabled'} style="border:0;padding:0;margin:0"><label class="field">节点名称<input name="name" value="${esc(flowNodeTitle(n))}" required></label><label class="field">执行主体<input value="${typeNames[n.type]}" disabled></label>${n.type==='AI'?`<label class="field">AI 任务固定版本<select name="task">${tasks.map(t=>`<option value="${t.id}" ${t.id===n.task?'selected':''}>${t.id} · ${t.name} @1.0</option>`).join('')}</select></label>`:''}<label class="field">输入映射<input name="input" value="${esc(n.input)}" required></label><label class="field">输出映射<input name="output" value="${esc(n.output)}" required></label><label class="field">领域规则引用<input name="rule" value="${esc(n.rule)}" required></label>${n.next.map((e,i)=>`<label class="field">${esc(flowEdgeLabel(n,e))} · 后继节点<select name="edge${i}"><option value="">未配置（校验阻断）</option>${r.flow.filter(x=>x.id!==n.id).map(x=>`<option value="${x.id}" ${x.id===e.to?'selected':''}>${x.id} · ${esc(x.name)}</option>`).join('')}</select></label>`).join('')}<button class="primary" type="submit">应用节点配置</button></fieldset></form>`;}
function f01NodeDetail(n){
 const nodes=flowRecord().flow,content=n.panoramaDetail||{},source=FLOW_SOURCES[n.source];
 const role={START:'开始',PROGRAM:'程序处理',CONDITION:'条件判断',END:'结束 / 出口'}[n.type];
 const icon={START:'<path d="m8 5 10 7-10 7Z"/>',PROGRAM:'<path d="m8 6-5 6 5 6m8-12 5 6-5 6M14 4l-4 16"/>',CONDITION:'<path d="m12 3 9 9-9 9-9-9Z"/>',END:'<path d="M6 6h12v12H6z"/>'}[n.type];
 const list=(items,ordered=true)=>{const tag=ordered?'ol':'ul';return `<${tag} class="f01-logic-list">${(items||[]).map(item=>`<li>${esc(item)}</li>`).join('')}</${tag}>`;};
 const section=(title,body,kind='')=>`<section class="f01-detail-section ${kind}"><h3>${title}</h3>${body}</section>`;
 const inputLabel={START:'初始输入',PROGRAM:'输入资料',CONDITION:'判断输入',END:'到达条件 / 原因'}[n.type];
 let core='';
 if(n.type==='START')core=section('触发来源',`<p>${esc(content.trigger||n.inputDescription)}</p>`)+section('初始上下文',list(content.actions),'f01-core');
 if(n.type==='PROGRAM')core=section('确定性处理',list(content.actions),'f01-core');
 if(n.type==='CONDITION')core=section('判断问题',`<p class="f01-logic-question">${esc(content.question||n.name)}</p>`,'f01-core')+section('判断依据',list(content.basis,false));
 if(n.type==='END')core=section('结束类型',`<p class="f01-result-type ${esc(content.resultTone||'pending')}">${esc(content.resultType||n.panoramaBoundary)}</p>`,'f01-core');
 const routes=n.next.map(edge=>{
  const target=nodes.find(item=>item.id===edge.to);
  return `<div class="f01-detail-route"><span class="f01-route-condition">${esc(edge.label)}</span>${target?`<button class="link" data-select-node="${esc(target.id)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg><span>${esc(nodeLocation(target))}</span></button>`:'<p class="negative">未配置 · 将阻止审核</p>'}</div>`;
 }).join('');
 const missing=n.type!=='END'&&!n.next.length;
 const issues=(n.pending?`<p class="callout warn">待确认：${esc(n.pending)}</p>`:'')+(missing?'<p class="callout warn">未配置后继 · 将阻止审核</p>':'')+(n.next.some(edge=>!nodes.some(item=>item.id===edge.to))?'<p class="callout warn">分支目标缺失 · 将阻止审核</p>':'');
 return `<aside class="inspector node-detail f01-node-detail ${n.type}" data-detail-type="${n.type}" aria-label="节点详解" tabindex="0"><button class="link panorama-return-step" data-action="return-step">← 返回当前步骤</button>
 <header class="node-detail-head"><div class="flex"><h2>${esc(nodeLocation(n))}</h2></div><span class="node-type f01-detail-role"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>${role}</span></header>
 <p class="f01-definition-note">流程定义 · 只读</p><p class="f01-detail-summary">${esc(n.summary)}</p>${issues}
 ${section(inputLabel,`<p>${esc(n.inputDescription)}</p>`)}${core}
 ${section(n.type==='END'?'本路径结果':'产出 / 结果',`<p>${esc(n.outputDescription)}</p>`,'f01-detail-output')}
 ${content.recovery?section('恢复方向',`<p>${esc(content.recovery)}</p>`):''}${content.continuation?section('后续使用',`<p>${esc(content.continuation)}</p>`):''}
 ${section(n.type==='CONDITION'?'判断结果与分支':n.type==='END'?'后续与恢复出口':'后继与处理出口',`<div class="f01-detail-routes">${routes||`<p class="${missing?'negative':'muted'}">${missing?'未配置 · 将阻止审核':'无已配置后继节点。'}</p>`}</div>`)}
 ${n.requiresAll?.length?section('必须汇合的前置分析',`<p>${n.requiresAll.map(id=>esc(nodes.find(item=>item.id===id)?.name||id)).join(' ＋ ')}</p>`):''}
 <details class="f01-detail-evidence"><summary>规则与依据</summary><p>${esc(n.ruleDetail)}</p><p>规则引用：${esc(n.rule)}</p>${source?`<a href="${esc(encodeURI('../../../../'+source.path))}" target="_blank" rel="noopener">${esc(source.title)}</a><p>${esc(n.section)}</p>`:'<p>尚未绑定业务文档</p>'}</details>
 <details class="node-config f01-detail-config"><summary>节点配置<span class="config-readonly">只读</span></summary><dl><dt>稳定节点 ID</dt><dd>${esc(n.id)}</dd><dt>输入映射</dt><dd>${esc(n.input)}</dd><dt>输出映射</dt><dd>${esc(n.output)}</dd></dl><h3>后继配置</h3><ul>${n.next.map(edge=>`<li>${esc(edge.label)} → ${esc(edge.to)}</li>`).join('')||'<li>无已配置后继</li>'}</ul></details></aside>`;
}
function f02AiNodeDetail(n){
 const nodes=flowRecord().flow,source=FLOW_SOURCES[n.source];
 return `<aside class="inspector node-detail AI f01-node-detail f02-ai-detail" data-detail-type="AI" aria-label="节点详解" tabindex="0"><button class="link panorama-return-step" data-action="return-step">← 返回当前步骤</button>
 <header class="node-detail-head"><div class="flex"><h2>${esc(nodeLocation(n))}</h2></div><span class="node-type f01-detail-role"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/></svg>AI 分析</span></header>
 <p class="f01-definition-note">流程定义 · 只读</p><p class="f01-detail-summary">${esc(n.summary)}</p>${n.pending?`<p class="callout warn">待确认：${esc(n.pending)}</p>`:''}
 ${embeddedTask(n)}
 <details class="node-config node-routing f01-detail-config"><summary>节点配置与流向<span class="config-readonly">只读</span></summary>
 <h3>上游输入映射</h3><ul>${nodes.filter(item=>item.next.some(edge=>edge.to===n.id)).map(item=>`<li>${esc(nodeLocation(item))}</li>`).join('')}</ul>
 <h3>后继与处理出口</h3><div class="f01-detail-routes">${n.next.map(edge=>{const target=nodes.find(item=>item.id===edge.to);return `<div class="f01-detail-route"><span class="f01-route-condition">${esc(edge.label)}</span>${target?`<button class="link" data-select-node="${esc(target.id)}">${esc(nodeLocation(target))}</button>`:'<p class="negative">未配置 · 将阻止审核</p>'}</div>`;}).join('')}</div>
 <h3>规则与依据</h3><p>${esc(n.ruleDetail)}</p><p>${esc(n.rule)}</p>${source?`<a href="${esc(encodeURI('../../../../'+source.path))}" target="_blank" rel="noopener">${esc(source.title)}</a><p>${esc(n.section)}</p>`:''}
 <dl><dt>稳定节点 ID</dt><dd>${esc(n.id)}</dd><dt>输入映射</dt><dd>${esc(n.input)}</dd><dt>输出映射</dt><dd>${esc(n.output)}</dd></dl></details></aside>`;
}
function nodeDetail(n){
 if(isSystemFlow()&&['F01','F02'].includes(n.module)&&n.type!=='AI')return f01NodeDetail(n);
 if(isSystemFlow()&&n.module==='F02'&&n.type==='AI')return f02AiNodeDetail(n);
 const r=flowRecord(),info=nodeExplanation(n),compact=n.type!=='AI',stage=nodeStage(n.id),step=stage?`${stage.code} · ${stage.title}`:'新增设计节点';
 const header=` <aside class="inspector node-detail ${n.type}${compact?' compact-node':''}" aria-label="节点详解" tabindex="0">${isSystemFlow()?'<button class="link panorama-return-step" data-action="return-step">← 返回当前步骤</button>':''}<header class="node-detail-head"><div class="flex"><h2 title="${esc(step)}">${isSystemFlow()?esc(stage.code+' / '+n.module+' / '+n.panoramaStep)+' · ':''}${esc(flowNodeTitle(n))}</h2></div><span class="node-type">${typeNames[n.type]}</span></header>${!compact||n.summary?`<div class="node-summary">${esc(info[0])}</div>`:''}`;
 if(n.type==='AI')return `${header}${embeddedTask(n)}${aiNodeRouting(n)}</aside>`;
 return `${header}
 <div class="node-facts">${n.type==='HUMAN'?'<section class="node-actor"><h3>处理人</h3><p>系统管理员</p></section>':''}<section><h3>需要什么输入</h3><p>${esc(info[2])}</p>${compact?'':`<span class="code muted">当前节点 · ${esc(n.id)}</span>`}</section><section><h3>产出什么</h3><p>${esc(info[3])}</p></section></div>
 <section class="node-section"><h3>流向与处理结果</h3><div class="route-list">${n.next.length?n.next.map(e=>{const target=r.flow.find(x=>x.id===e.to);return `<div class="route-row"><span>${esc(flowEdgeLabel(n,e))}</span><span class="route-arrow">→</span>${target?`<button class="link" data-select-node="${esc(target.id)}">${esc(isSystemFlow()?nodeLocation(target):target.name)}${compact?'':` <span class="code">${target.id}</span>`}</button>`:'<span class="negative">未配置 · 将阻止审核</span>'}</div>`;}).join(''):'<p class="muted">流程在此结束，无后继节点。</p>'}</div></section>
 ${n.requiresAll?.length?`<section class="node-section"><h3>必须汇合的前置分析</h3><p class="small">${n.requiresAll.map(id=>esc(r.flow.find(x=>x.id===id)?.name||id)).join(" ＋ ")}</p></section>`:""}<section class="node-section"><h3>规则与判断</h3>${info[4]!==info[0]&&(!compact||n.ruleDetail)?`<p>${esc(info[4])}</p>`:''}<div class="rule-reference">${compact?'':'<span>规则引用</span>'}<span class="code">${esc(n.rule)}</span></div></section>
 ${sourceView(n)}<details class="node-config" ${state.nodeConfig?'open':''}><summary>节点配置${compact?(editable()?'':'<span class="config-readonly">只读</span>'):`<span>${editable()?'编辑名称、引用与后继':'当前版本只读'}</span>`}</summary>${nodeForm(n)}${compact?'':'<p class="sub">映射为原型表达；完整契约、规则解析与条件表达式由后续技术设计确定。</p>'}</details>
 </aside>`;
}
function aiNodeRouting(n){
 const r=flowRecord(),key=[state.view,state.selected,state.version,n.id].join('/');
 if(state.nodeRoutingKey!==key){state.nodeRoutingKey=key;state.nodeConfig=false;}
 const incoming=r.flow.filter(source=>source.next.some(edge=>edge.to===n.id));
 return `<details class="node-config node-routing" ${state.nodeConfig?'open':''}><summary>节点配置与流向${editable()?'':'<span class="config-readonly">只读</span>'}</summary>
 <section class="node-section"><h3>上游输入映射</h3><div class="mapping-list">${incoming.length?incoming.map(source=>`<div class="mapping-row"><span>${esc(source.name)}</span><span class="mapping-values code">${esc(source.output)} → ${esc(n.input)}</span></div>`).join(''):`<p class="negative">未连接上游 · 当前输入 ${esc(n.input)}</p>`}</div>${n.requiresAll?.length?`<p class="mapping-dependency">必须汇合的前置分析：${n.requiresAll.map(id=>esc(r.flow.find(source=>source.id===id)?.name||id)).join(' ＋ ')}</p>`:''}</section>
 <section class="node-section"><h3>下游映射与分支流向</h3><div class="route-list">${n.next.length?n.next.map(edge=>{const target=r.flow.find(target=>target.id===edge.to);return `<div class="route-row"><span>${esc(edge.label)}</span><span class="route-arrow">→</span>${target?`<div><button class="link" data-select-node="${esc(target.id)}">${esc(isSystemFlow()?nodeLocation(target):target.name)}</button><span class="mapping-values code">${esc(n.output)} → ${esc(target.input)}</span></div>`:'<span class="negative">未配置 · 将阻止审核</span>'}</div>`;}).join(''):'<p class="muted">无后继节点</p>'}</div></section>
 <section class="node-section"><h3>规则引用</h3><p class="code">${esc(n.rule)}</p></section>${sourceView(n)}
 <h3 class="node-edit-title">编辑节点</h3>${nodeForm(n)}</details>`;
}
function basicView(){const s=strategy(),r=record();return `<div class="grid2"><section class="panel"><h3>策略定义</h3><dl class="meta"><dt>稳定编码</dt><dd class="code">${s.id}</dd><dt>业务归属</dt><dd>${s.layer} / ${s.module}</dd><dt>业务目标</dt><dd>${esc(s.scene)}</dd><dt>启动输入</dt><dd>业务对象、证据快照、配置版本和观察截止时间</dd><dt>交付输出</dt><dd>候选分析结果或命令意图，交由主责业务模块校验</dd></dl></section><section class="panel"><h3>适用范围与变更</h3><form id="basic-form"><fieldset ${editable()?'':'disabled'} style="border:0;padding:0"><label class="field">适用范围<textarea name="scope" required>${esc(r.scope)}</textarea></label><label class="field">变更原因<textarea name="reason" required>${esc(r.reason)}</textarea></label><button class="primary">保存范围与说明</button></fieldset></form></section></div>`;}
function dependenciesView(){const s=strategy(),r=record();return `<div class="reference-grid"><section class="panel"><h3>领域规则引用</h3><p class="muted small">规则由对应领域维护，本策略只读引用。</p><ul class="result-list rule-list">${[...new Set(r.flow.map(n=>n.rule))].map(rule=>`<li class="code">${esc(rule)}</li>`).join('')}</ul></section><section class="panel ai-reference"><h3>AI Task 固定版本</h3><p class="small">与当前所查看策略版本绑定。</p><ul class="result-list">${r.flow.filter(n=>n.type==='AI').map(n=>`<li><div><span class="code">${n.task} @${n.taskVersion}</span><div class="sub">Schema @1.0</div></div>${btn('查看任务 →','task-link',false,false,`data-id="${n.task}"`)}</li>`).join('')}</ul>${r.flow.some(n=>n.type==='AI')?'':'<p class="muted reference-empty">该版本暂无 AI Task 引用。</p>'}</section></div><section class="panel reference-usage"><h3>消费模块与历史运行</h3><p>${s.module} · ${esc(s.scene)}</p><div class="reference-runs">${s.id==='STR-L2-01'?runs.map(run=>`<div class="history-item"><div class="between"><span class="code">${run.id}</span>${badge(run.state)}</div><p>锁定 V${run.version} · ${run.snapshot}</p><div class="sub">${run.model} · AI / Schema @1.0</div></div>`).join(''):'<p class="muted">该演示策略暂无运行记录。</p>'}</div><div class="callout">新版本用于后续新运行；已开始运行保持受理时锁定的版本。</div></section>`;}
function historyView(){const s=strategy(),r=record();return `<section class="governance-bar" aria-label="版本治理与生效操作"><div><h3>当前查看 V${state.version} ${badge(r.state)}</h3><p>当前生效 ${s.active?'V'+s.active:'无'} · ${esc(s.id)}</p></div></section><div class="grid2 governance-history"><section class="panel"><h3>版本时间线</h3><div class="history">${[...s.versions].reverse().map(v=>`<div class="history-item"><div class="between"><strong>V${v} ${badge(s.records[v].state)}</strong><button class="link" data-action="history-version" data-id="${v}">查看此版本 →</button></div><p class="small">${esc(s.records[v].reason)}</p><div class="sub">${s.records[v].audit.length?s.records[v].audit.map(esc).join('<br>'):'演示初始化记录 · 系统管理员'}</div></div>`).join('')}</div></section><section class="panel"><h3>与当前生效版本比较</h3><dl class="meta"><dt>比较版本</dt><dd>V${s.active||'—'} → V${state.version}</dd><dt>基本信息</dt><dd>稳定编码与主责模块保持一致</dd><dt>流水线</dt><dd>${s.active?`${s.records[s.active].flow.length} → ${record().flow.length} 个节点`:'首次定义'}</dd><dt>节点配置</dt><dd>${s.active?`${record().flow.filter(n=>JSON.stringify(n)!==JSON.stringify(s.records[s.active].flow.find(x=>x.id===n.id))).length} 个节点存在差异`:'尚无基线'}</dd><dt>适用范围</dt><dd>${esc(record().scope)}</dd><dt>AI / 规则引用</dt><dd>参见规则与 AI Task 引用；引用固定版本。</dd></dl><div class="callout warn">状态枚举与单一生效版本规则为首版演示假设，正式方案待确认。不提供灰度或自动切换。</div></section></div>`;}
function validate(){const r=flowRecord(),nodes=r.flow,ids=new Set(nodes.map(n=>n.id));let reachable=new Set();function walk(id){if(reachable.has(id))return;reachable.add(id);nodes.find(n=>n.id===id)?.next.forEach(e=>{if(ids.has(e.to))walk(e.to);});}nodes.filter(n=>n.type==='START').forEach(n=>walk(n.id));
 const results=[['唯一入口与结束可达',nodes.filter(n=>n.type==='START').length===1&&nodes.some(n=>n.type==='END')&&nodes.every(n=>reachable.has(n.id))],['没有悬空节点',nodes.every(n=>n.type==='END'||n.next.length>0&&n.next.every(e=>ids.has(e.to)))],['AI 任务固定版本有效',nodes.filter(n=>n.type==='AI').every(n=>tasks.some(t=>t.id===n.task)&&n.taskVersion==='1.0')],['输入输出映射兼容',nodes.every(n=>n.input&&n.output&&n.next.every(e=>{const dest=nodes.find(x=>x.id===e.to);return dest&&dest.input===n.output;}))],['领域规则引用完整',nodes.every(n=>n.rule.trim()&&!/待引用|演示引用/.test(n.rule))],['人工处理出口完整',nodes.filter(n=>n.type==='HUMAN').every(n=>n.next.length>0&&n.next.every(e=>e.label&&ids.has(e.to)))],['条件分支均有出口',nodes.filter(n=>n.type==='CONDITION').every(n=>n.next.length>=2&&n.next.every(e=>e.to))],['未定准入及发布条件不得默认通过',!nodes.some(n=>n.blocking)],['汇合分析的前置依赖完整',nodes.every(n=>!n.requiresAll||n.requiresAll.every(id=>nodes.find(x=>x.id===id)?.next.some(e=>e.to===n.id)))]];
 state.checks=results;return results.every(x=>x[1]);
}
function validationView(){return `<section class="panel" id="validation" style="margin-top:17px"><h3>完整性检查 ${badge(state.checks.every(x=>x[1])?'通过':'失败')}</h3><ul class="result-list">${state.checks.map(([name,ok])=>`<li><span class="${ok?'ok':'bad'}">${ok?'✓':'×'}</span>${name}</li>`).join('')}</ul><p class="muted small">原型校验覆盖当前演示数据的图结构、固定依赖与简化映射；通过不替代领域语义评审。</p></section>`;}
const taskTabs=[['definition','任务定义'],['schema','输入输出'],['constraints','工具与约束'],['usage','引用与版本']];
// Generated presentation data is derived from the L0 chapter, never authored here.
function taskDefinitionReference(t){
 return typeof TASK_DEFINITION_REFERENCES==='undefined'?null:TASK_DEFINITION_REFERENCES[t.id];
}
function referencedTaskDefinition(t){
 const ref=taskDefinitionReference(t);if(!ref)return '';
 return `<section class="task-definition-reference" data-definition-task="${esc(t.id)}"><h3>分析职责与步骤</h3><p><a class="link task-definition-source" href="${esc(encodeURI(ref.href))}" target="_blank" rel="noopener">查看原文：${esc(ref.heading)}</a></p><p class="muted small">L0 信息处理层：业务架构与领域设计 · 原文职责与步骤</p><div class="task-definition-body">${ref.html}</div></section>`;
}
function taskPromptReference(t){return typeof TASK_PROMPT_REFERENCES==='undefined'?null:TASK_PROMPT_REFERENCES[t.id];}
function taskTabsFor(t){
 const tabs=[...taskTabs];if(taskPromptReference(t))tabs.splice(1,0,['prompt','提示词']);return tabs;
}
function referencedPromptContent(t){
 const asset=taskPromptReference(t);
 if(!asset)return '<p>暂无提示词文档。</p>';
 return `<section class="task-prompt-reference"><h3>${esc(asset.title)} · ${esc(asset.version)}</h3><dl class="meta"><dt>文档状态</dt><dd>${esc(asset.status)}</dd><dt>来源文档</dt><dd><a class="link" href="${esc(encodeURI(asset.sourceHref))}" target="_blank" rel="noopener">查看原文：${esc(asset.title)} ${esc(asset.version)}</a></dd></dl><p class="callout warn">参考草案，未绑定当前 AI 任务版本；提示词版本与任务版本分别管理。</p><pre class="pre">${esc(asset.body)}</pre></section>`;
}
function taskPromptDisclosure(t){
 const asset=taskPromptReference(t);if(!asset)return '';
 return `<details class="task-prompt-disclosure"><summary>提示词 · ${esc(asset.version)}</summary>${referencedPromptContent(t)}</details>`;
}
// Resolve only the referenced published definition; never substitute a draft or latest alias.
function referencedTask(n){return tasks.find(t=>t.id===n.task&&t.version===n.taskVersion);}
function taskCatalogLink(t){
 const label='查看 AI 任务';
 if(globalThis.RISKHOT_STANDALONE_PANORAMA){
  const href='../06-4-M3策略管理中心UI设计/M3策略管理中心交互原型.html#ai/'+t.id+'/'+t.version;
  return `<a class="link task-catalog-link" href="${esc(href)}" aria-label="查看 AI 任务 ${esc(t.id)} @${esc(t.version)}">${label}</a>`;
 }
 return `<button class="link task-catalog-link" data-action="task-link" data-id="${esc(t.id)}" data-version="${esc(t.version)}" aria-label="查看 AI 任务 ${esc(t.id)} @${esc(t.version)}">${label}</button>`;
}
function embeddedTask(n){
 const key=[state.view,state.selected,state.version,n.id,n.task,n.taskVersion].join('/');
 if(state.nodeTaskKey!==key){state.nodeTaskKey=key;state.nodeTaskTab='definition';}
 const t=referencedTask(n);
 if(!t)return `<section class="embedded-task"><h3>AI 任务 · 引用版本不可用</h3><p class="code">${esc(n.task)} @${esc(n.taskVersion)}</p><div class="callout warn">未找到此固定版本的分析定义，请核对节点引用。不会替换为最新版本或草稿。</div></section>`;
 return `<section class="embedded-task" aria-label="AI 任务内嵌详情"><div class="embedded-task-head"><span class="code" title="${esc(t.name)} · 固定引用版本">${esc(t.id)} @${esc(t.version)}</span><div class="embedded-task-actions">${taskCatalogLink(t)}<span class="badge">只读</span></div></div>${taskPromptDisclosure(t)}<nav class="subtabs" role="tablist" aria-label="AI 任务详情">${taskTabs.map(([key,label])=>`<button type="button" role="tab" id="node-task-tab-${key}" data-node-task-tab="${key}" aria-selected="${state.nodeTaskTab===key}" aria-controls="node-task-content" tabindex="${state.nodeTaskTab===key?'0':'-1'}">${label}</button>`).join('')}</nav><div id="node-task-content" role="tabpanel" tabindex="0" aria-labelledby="node-task-tab-${state.nodeTaskTab}">${taskContent(t,state.nodeTaskTab,{embedded:true})}</div></section>`;
}
function nodeLocation(n){return `${nodeStage(n.id)?.code||'M'} / ${n.module||'M'} / ${n.panoramaStep} · ${flowNodeTitle(n)}`;}
function activatePanoramaLayer(code){
 state.panoramaLayer=code;
 document.querySelectorAll('.system-panorama [data-stage-target]').forEach(el=>{
  const active=document.getElementById(el.dataset.stageTarget)?.dataset.stage===code;
  el.classList.toggle('current',active);
  if(active)el.setAttribute('aria-current','location');else el.removeAttribute('aria-current');
 });
 document.querySelectorAll('.system-panorama [data-stage]').forEach(el=>el.classList.toggle('current-layer',el.dataset.stage===code));
}
function expandNodeModule(el){
 const layer=el?.closest?.('[data-flow-layer]');
 if(layer){layer.open=true;state.panoramaLayersCollapsed=state.panoramaLayersCollapsed.filter(code=>code!==layer.dataset.flowLayer);}

 const module=el?.closest?.('.module-card');
 if(module){module.open=true;state.panoramaCollapsed=state.panoramaCollapsed.filter(code=>code!==module.dataset.flowModule);}
}
function selectFlowNode(id,reveal=false){
 const n=flowRecord().flow.find(n=>n.id===id);if(!n)return;
 if(n.type==='AI'&&state.node!==id)state.nodeConfig=false;
 state.node=id;state.nodeTaskTab='definition';
 document.querySelectorAll('[data-node]').forEach(el=>{const selected=el.dataset.node===id;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));if(selected){const extra=el.closest('.stage-extra');if(extra)extra.open=true;}});
 document.querySelectorAll('[data-stage-target]').forEach(el=>el.classList.toggle('current',!!document.getElementById(el.dataset.stageTarget)?.querySelector('.node.selected')));
 $('.node-detail').outerHTML=nodeDetail(n);
 expandNodeModule($('[data-node="'+id+'"]'));
 if(isSystemFlow())activatePanoramaLayer(nodeStage(id)?.code||'M');
 $('[data-node="'+id+'"]').focus({preventScroll:true});
 if(isSystemFlow()){
  const target=matchMedia('(max-width: 760px)').matches?$('.node-detail'):reveal?$('[data-node="'+id+'"]'):null;
  target?.scrollIntoView({block:reveal?'center':'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
}
function selectNodeTaskTab(tab){
 const n=flowRecord().flow.find(n=>n.id===state.node),t=n&&referencedTask(n);if(!t||!taskTabs.some(([key])=>key===tab))return;
 state.nodeTaskTab=tab;
 document.querySelectorAll('[data-node-task-tab]').forEach(el=>{const selected=el.dataset.nodeTaskTab===tab;el.setAttribute('aria-selected',String(selected));el.tabIndex=selected?0:-1;});
 const panel=$('#node-task-content');panel.innerHTML=taskContent(t,tab,{embedded:true});panel.setAttribute('aria-labelledby','node-task-tab-'+tab);
}
function focusTaskDetail(){
 const panel=$('#content .split > section.panel');
 panel?.scrollIntoView({block:'start'});panel?.focus({preventScroll:true});
}
function aiView(){if(state.taskRouteError)return '<section class="panel"><h2>AI 任务版本不可用</h2><p>未找到链接指定的任务版本，请从 AI 任务目录重新选择。</p><button class="link" data-action="task-directory">打开 AI 任务目录</button></section>';const t=tasks.find(t=>t.id===state.task);return `<div class="between section-head"><div><h2>AI 任务目录</h2><p class="muted small">16 项逻辑分析职责 · 独立版本管理，跨策略复用</p></div></div><div class="split"><aside><label class="field">检索 AI 任务<input id="ai-search" value="${esc(state.aiQuery)}" placeholder="名称 / AI 编码"></label><div class="task-list">${tasks.filter(x=>(x.name+x.id).toLowerCase().includes(state.aiQuery.toLowerCase())).map(x=>`<button class="list-button" data-task="${x.id}" aria-pressed="${x.id===t.id}"><span class="name">${esc(x.name)}</span><div class="sub code">${x.id}　${x.layer}　@1.0${x.draft?' · 有草稿':''}</div></button>`).join('')||'<div class="empty">没有匹配任务</div>'}</div></aside><section class="panel" tabindex="-1" aria-label="AI 任务详情"><div class="between"><div><div class="eyebrow">AI TASK DEFINITION</div><h2>${esc(t.name)}</h2><p class="code muted">${t.id} @1.0 · 当前可引用版本</p></div>${badge('已生效')}</div><nav class="subtabs">${taskTabsFor(t).map(([k,l])=>`<button data-task-tab="${k}" aria-pressed="${state.taskTab===k}">${l}</button>`).join('')}</nav>${taskContent(t)}${t.draft?'<div class="callout warn">存在 @1.1 草稿。既有策略仍引用 @1.0；任务发布流程待确认，此原型不直接发布任务修订。</div>':''}</section></div>`;}
function contractFields(title,rows,kind){
 return `<section class="contract-fields" data-contract-fields="${kind}"><h3>${title} <span class="muted small">${rows.length} 项</span></h3><table class="contract-table"><caption>${title}及内容要求、来源与待定状态</caption><thead><tr><th scope="col">字段／业务项</th><th scope="col">内容与使用要求</th><th scope="col">来源／状态</th></tr></thead><tbody>${rows.map(([field,usage,source])=>`<tr><th scope="row" class="code">${esc(field)}</th><td data-label="内容与使用要求">${esc(usage)}</td><td data-label="来源／状态">${/待定|待讨论|待确认|未定|未确认|非已定/.test(source)?'<span class="pill amber">含待定项</span>':''}<div>${esc(source)}</div></td></tr>`).join('')}</tbody></table></section>`;
}
function taskContractContent(t,{embedded=false}={}){
 const c=t.contract;
 if(!c)return '<div class="callout warn">此固定版本缺少输入输出定义，请核对任务引用。</div>';
 const n=embedded?flowRecord().flow.find(n=>n.id===state.node&&n.task===t.id&&n.taskVersion===t.version):null;
 const pending=[...c.pending,...[...c.inputs,...c.outputs].filter(row=>/待定|待讨论|待确认|未定|未确认|非已定/.test(row[2])).map(([field,usage,source])=>field+'：'+source+'；'+usage)];
 return `<div class="task-contract">${n?`<dl class="meta"><dt>输入定义</dt><dd>${esc(n.inputDescription||n.input)}</dd><dt>输出定义</dt><dd>${esc(n.outputDescription||n.output)}</dd></dl>`:''}<dl class="meta contract-source"><dt>文档依据</dt><dd>${esc(c.source)}</dd><dt>结果形态</dt><dd>${esc(c.shape)}</dd></dl><div class="callout warn">业务字段按文档逐项列示。标注待定的字段名、类型、枚举与包装尚未定稿；文档未明确的必填项不擅自补齐。</div>${contractFields('输入字段',c.inputs,'input')}${contractFields('输出字段',c.outputs,'output')}<section class="contract-pending"><h3>待定事项</h3><ul class="result-list">${pending.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section><details class="contract-schema"><summary>输出 Schema @${esc(t.version)} · 字段片段草案</summary><p class="small muted">展开查看已命名字段的结构草案。未定业务项保留说明，不生成虚构字段；顶层包装与任务级必填集合待详细设计，该片段不能直接作为完整运行校验协议。</p><pre class="pre">${esc(t.schema)}</pre></details><dl class="meta"><dt>交付边界</dt><dd>${esc(c.boundary)}</dd></dl></div>`;
}
function taskContent(t,tab=state.taskTab,{embedded=false}={}){if(tab==='prompt')return referencedPromptContent(t);const f02=embedded&&isSystemFlow()?flowRecord().flow.find(n=>n.id===state.node&&n.module==='F02'&&n.task===t.id&&n.taskVersion===t.version):null;if(tab==='definition'&&/^AI-0[1-5]$/.test(t.id))return taskDefinitionReference(t)?referencedTaskDefinition(t):'<p class="callout warn">任务定义章节未加载，请重新同步文档引用后刷新页面。</p>';if(f02&&tab==='schema')return '<p class="muted small">固定任务版本的契约字段如下；候选与版本化证据的精确Schema按F02协作待办联合落实。</p>'+taskContractContent(t,{embedded});const uses=strategies.map(s=>({s,versions:s.versions.filter(v=>s.records[v].flow.some(n=>n.type==='AI'&&n.task===t.id&&n.taskVersion===t.version))})).filter(use=>use.versions.length);if(tab==='definition')return `<dl class="meta">${embedded?'':`<dt>分析问题</dt><dd>${esc(t.name)}；在对应业务边界内输出分析建议。</dd>`}<dt>完成标准</dt><dd>结构完整、引用可追溯，证据不足时明确限制。</dd><dt>分析步骤</dt><dd>读取固定版本上下文 → 核对证据 → 分析并说明不确定性 → 返回结构化结果。</dd><dt>后续处理</dt><dd>对应业务模块进行程序校验，必要时由系统管理员复核。</dd></dl>${embedded?'':'<div class="callout">逻辑任务不等同于一次模型调用；运行方式由执行能力决定。</div>'}`;
 if(tab==='schema')return taskContractContent(t,{embedded});
 if(tab==='constraints')return `<dl class="meta"><dt>工具能力</dt><dd>内部对象查询、证据原文读取、计算与结构化转换（示例许可）</dd><dt>模型要求</dt><dd>结构化输出、证据上下文理解、工具调用；具体规模待确认。</dd><dt>禁止事项</dt><dd>禁止编造对象 ID；禁止将缺失解释为零值、低风险或稳定；禁止自行批准分析结果。</dd><dt>证据要求</dt><dd>必须返回关键证据引用及不确定性。</dd><dt>校验与兜底</dt><dd>通过 → 后继节点；受限结果 → 补齐或受限结束；身份歧义 / 证据冲突 → 人工复核。</dd></dl><div class="callout">这里只定义逻辑能力要求。凭据、真实模型调用、并发、重试与超时属于运行能力。</div>`;
 return `<h3>被引用策略</h3>${uses.map(({s,versions})=>`<div class="between" style="padding:15px 0;border-bottom:1px solid var(--line)"><div>${esc(s.name)}<div class="code muted">${esc(s.id)} · ${versions.map(v=>'V'+esc(v)).join(' / ')}</div></div>${embedded?'':btn('查看策略','open',false,false,`data-id="${s.id}"`)}</div>`).join('')}<div class="history"><div class="history-item">@1.0 可引用 · Schema @1.0</div>${t.draft?'<div class="history-item">@1.1 草稿 · 不影响历史引用</div>':''}</div>`;
}
function evaluationView(){return `<div class="between section-head"><div><h2>策略评估</h2><p class="muted small">相同案例看变化，逐项复核退化原因。</p></div></div><nav class="subtabs">${[['compare','版本对比'],['datasets','评测集'],['metrics','指标口径'],['history','评估历史']].map(([k,l])=>`<button data-eval-tab="${k}" aria-pressed="${state.evalTab===k}">${l}</button>`).join('')}</nav>${state.evalTab==='compare'?compareView():state.evalTab==='datasets'?datasetView():state.evalTab==='metrics'?metricView():evalHistory()}`;}
function compareView(){return `<div class="panel"><div class="between"><div><h3>风险状态分析策略 <span class="code muted">STR-L2-01</span></h3><p class="muted small">离线标准评测 · DEMO-EVAL-021 · 2026-10-15 16:20</p></div><span class="badge">演示评估结果</span></div><div class="flex" style="margin-top:17px"><span class="pill green">基线 V1.2${strategies[0].active==='1.2'?' · 当前生效':''}</span><span>→</span><span class="pill">候选 V2.0${strategies[0].active==='2.0'?' · 当前生效':''}</span><label class="check-row"><input type="checkbox" id="third" ${state.compareThird?'checked':''}>加入 V1.0</label><label class="check-row"><input type="checkbox" id="limited" ${state.limited?'checked':''}>预览模型不一致场景</label></div><div class="callout ${state.limited?'warn':''}">${state.limited?'比较受限：候选使用演示模型 B，基线使用模型 A；不能把模型变化直接归因为策略优化。':'可比条件一致：评测集 @1.0 · 输入快照 E-20261015-01 · 演示模型 A / r1 · 运行配置 @1.0'}</div><div class="metrics"><div class="metric"><span class="muted small">场景通过率 · 候选</span><strong>94<small>%</small></strong><span class="delta">较基线 +4 个百分点</span></div><div class="metric"><span class="muted small">改善案例</span><strong class="positive">21</strong><span class="small muted">相对基线 V1.2</span></div><div class="metric"><span class="muted small">持平案例</span><strong>74</strong><span class="small muted">输出结果维持</span></div><div class="metric"><span class="muted small">退化候选</span><strong class="negative">5</strong><span class="small negative">需逐项人工判断</span></div></div><div class="bar" aria-label="改善21、持平74、退化候选5"><span style="width:21%"></span><span style="width:74%"></span><span style="width:5%"></span></div></div>
 <div class="table-wrap" style="margin-top:18px;border-top:1px solid var(--line);border-radius:6px"><table><thead><tr><th>指标 / 分母或口径</th>${state.compareThird?'<th>V1.0</th>':''}<th>V1.2 · 基线</th><th>V2.0 · 候选</th><th>变化</th></tr></thead><tbody>${[['场景通过率','通过 / 100 个案例','86%','90%','94%','+4 pp'],['通过 / 失败 / 待复核','状态互斥，总数为100','86 / 8 / 6','90 / 6 / 4','94 / 2 / 4','通过 +4'],['证据忠实度','演示人工评分，非正式公式','89','92','96','+4'],['人工复核率','转人工 / 100 个案例','16%','12%','9%','−3 pp'],['Schema 通过率','结构通过 / 100 个案例','97%','98%','100%','+2 pp'],['平均耗时','100 个案例累计时长 / 100','21.8s','22.4s','24.1s','+1.7s'],['模型调用量','每案例平均调用次数','5.0','5.0','5.0','持平'],['Token 使用量','每案例平均输入与输出总量','8,500','9,100','9,600','+500']].map(row=>`<tr><td>${row[0]}<div class="sub">${row[1]}</div></td>${state.compareThird?`<td>${row[2]}</td>`:''}<td>${row[3]}</td><td><strong>${row[4]}</strong></td><td>${row[5]}</td></tr>`).join('')}</tbody></table></div>
 <div class="between" style="margin:22px 0 12px"><h3>案例差异 <span class="muted small">展示 3 个代表案例 / 100 个案例</span></h3><label class="flex">结果 <select id="case-filter" style="width:118px">${options(['全部','改善','持平','退化候选'],state.caseFilter)}</select></label></div><div class="table-wrap" style="border-top:1px solid var(--line);border-radius:6px"><table class="catalog-table"><thead><tr><th>案例</th><th>差异标记</th><th>V1.2 → V2.0</th><th>操作</th></tr></thead><tbody>${cases.filter(c=>!c.datasetVersion&&(state.caseFilter==='全部'||c.tag===state.caseFilter)).map(c=>`<tr data-case-row="${c.id}"><td>${c.name}<div class="code muted">${c.id}</div></td><td data-label="差异标记">${badge(c.tag)}</td><td data-label="版本结果">${c.before} → ${c.after}</td><td>${btn('查看差异 →','case',false,false,`data-id="${c.id}"`)}</td></tr>`).join('')}</tbody></table></div><div class="callout warn">评估结果不会自动生效。退化候选包含“通过转失败”“自动完成转人工”等变化，最终含义需要人工判断。生产运行统计与离线评测分开展示。</div>`;}
function datasetView(){return `<section class="panel"><div class="between"><div><h3>${dataset.name}</h3><p class="code muted">DEMO-SET-L2 · @${dataset.version} · ${dataset.size} 个案例</p></div></div><div class="callout">案例来自标准场景、固定历史快照及边界样例。原型展示 3 个代表案例，汇总数值为评审示例。</div>${cases.map(c=>`<div style="padding:15px 0;border-bottom:1px solid var(--line)"><div class="between"><strong>${c.name}</strong>${btn('查看案例','dataset-case',false,false,`data-id="${c.id}"`)}</div><p class="code muted">${c.id} @1.0 · ${c.tag==='改善'?'证据缺失':c.tag==='退化候选'?'歧义':'正常'}</p><p class="small">${c.input}</p></div>`).join('')}<p class="muted small" style="margin-top:18px">新修订不覆盖旧快照。历史评估 DEMO-EVAL-021 始终引用 @1.0。</p></section>`;}
function metricView(){return `<section class="panel"><h3>评估指标口径</h3><p class="muted small">按策略类型选择适用指标。正式公式和达标阈值尚未确认。</p><table><thead><tr><th>类别</th><th>建议指标</th><th>示例口径</th></tr></thead><tbody><tr><td>业务质量</td><td>场景通过率、证据忠实度、规则符合率</td><td>案例通过数 / 总案例数；忠实度展示人工评分</td></tr><tr><td>人机协作</td><td>自动完成、人工接受、复核、退回</td><td>相关案例数 / 适用案例数</td></tr><tr><td>稳定性</td><td>Schema、无结果、失败、重复一致性</td><td>对应校验结果占比</td></tr><tr><td>效率</td><td>平均耗时、模型调用量、Token / 成本</td><td>运行记录聚合，成本计价源待确认</td></tr></tbody></table><div class="callout warn">不预设“达到某分即生效”的阈值。指标公式、适用范围与版本由后续业务评审确认。</div></section>`;}
function evalHistory(){return `<div class="panel"><h3>离线评估记录</h3><div class="history">${[...evaluations].reverse().map(e=>`<div class="history-item"><div class="between"><strong class="code">${e.id}</strong>${badge(e.state)}</div><p>V${e.baseline} → V${e.candidate} · 评测集 @${e.dataset}</p><p class="small">${e.refs}</p><p class="small muted">${e.model} · ${e.snapshot} · ${e.time}</p>${e.limited?'<p class="negative small">比较受限：模型条件不同</p>':''}${e.state==='等待运行'?'<p class="small muted">原型只记录评估请求；未连接运行服务，未生成评估结果。</p>':''}</div>`).join('')}</div><h3>生产运行参考</h3><p class="muted small">尚未接入。此处不混入离线评测指标。</p></div>`;}
let returnFocus=null;
function modal(title,body,form='',submit='确认',wide=false){
 returnFocus=document.activeElement;
 const d=$('#modal');d.style.width=wide?'min(1000px, calc(100% - 30px))':'';
 d.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button data-action="close-modal" aria-label="关闭弹框">×</button></div>${form?`<form id="${form}">`:''}<div class="modal-body"><div id="form-error" class="error-text" role="alert"></div>${body}</div><div class="modal-foot">${btn(form?'取消':'关闭','close-modal')}${form?`<button type="submit" class="primary">${submit}</button>`:''}</div>${form?'</form>':''}`;
 d.showModal();
}
function closeModal(){const d=$('#modal');d.close();d.innerHTML='';if(returnFocus?.isConnected)returnFocus.focus();else $('[data-view="'+(state.view==='detail'?'catalog':state.view)+'"]')?.focus();}
$('#modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const box=e.target.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeModal();}});
const formError=text=>$('#form-error').textContent=text;
const timestamp=()=>new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
function openStrategy(id){state.selected=id;const s=strategy();state.version=s.versions.at(-1);state.view='detail';state.detail='flow';state.node='C';state.nodeConfig=false;state.checks=null;render();}
function openNew(copy=false){const s=copy?strategy():null;modal(copy?'复制为新策略':'新建策略',`<div class="form-grid"><label class="field">策略名称 *<input name="name" required maxlength="60" value="${s?esc(s.name)+'（副本）':''}"></label><label class="field">稳定编码 *<input name="code" required pattern="[A-Za-z0-9-]+" maxlength="50" placeholder="例如 STR-L2-03"></label><label class="field">业务层<select name="layer">${options(['L0','L1','L2','L3'],s?.layer||'L2')}</select></label><label class="field">主责模块<select name="module">${options(['F02','F03','F04','F05','F06','F08'],s?.module||'F05')}</select></label><label class="field full">业务场景与目标 *<textarea name="scene" required maxlength="500">${s?esc(s.scene):''}</textarea></label></div><div class="callout">新策略以草稿开始。${copy?'复制所查看版本的节点和固定依赖，不复制生效资格。':'初始提供入口、人工复核和结束节点；继续添加程序、AI 与条件节点。'}</div>`,copy?'copy-form':'new-form','创建草稿');}
function openGovernance(action){const s=strategy();modal(action==='activate'?'审核并生效':action==='disable'?'停用策略版本':'提交策略审核',`<dl class="meta"><dt>策略 / 版本</dt><dd>${esc(s.name)} · V${state.version}</dd><dt>当前生效</dt><dd>${s.active?'V'+s.active:'无'}</dd><dt>影响模块</dt><dd>${esc(s.module)}</dd><dt>在途任务</dt><dd>${s.id==='STR-L2-01'?'DEMO-RUN-017 继续锁定 V1.2':'暂无演示运行'}</dd><dt>后续新运行</dt><dd>${action==='activate'?'使用本次生效版本；原生效版本停止用于新运行':action==='disable'?'停止选择此版本；不删除历史记录':'审核通过并生效后才切换'}</dd></dl><div class="callout ${action==='activate'?'warn':''}">${action==='activate'?'关联评估 DEMO-EVAL-021（仅 STR-L2-01 的 V2.0 有对应结果）含 5 项退化候选。系统不依据评分自动切换；是否强制评估门槛待确认。':'定义变更不修改历史业务事实。'}</div><label class="field">${action==='activate'?'审核依据与变更摘要':'操作说明'} *<textarea name="reason" required minlength="5" maxlength="1000" placeholder="请说明判断依据，至少 5 个字"></textarea></label><label class="check-row"><input name="confirmed" type="checkbox" required>已核对依赖、适用范围与在途版本影响</label>`,action+'-form',action==='activate'?'确认审核并生效':action==='disable'?'确认停用':'提交审核');}
function openCase(id,datasetOnly=false){const c=cases.find(c=>c.id===id);const regression=c.tag==='退化候选';modal(datasetOnly?'评测案例与参考约束':'案例差异 · '+c.name,`<div class="between"><span class="code">${c.id} @1.0</span>${badge(c.tag)}</div><div class="callout"><strong>共同输入与证据</strong><br>${c.input}<br><span class="code">输入快照 E-20261015-01 · 证据 DEMO-E01 @1.0 · 领域文档 V1.0</span></div>${datasetOnly?`<dl class="meta"><dt>适用场景</dt><dd>F05 风险状态分析</dd><dt>参考约束</dt><dd>缺失不可视为低风险；身份歧义必须保留依据并转人工。</dd><dt>参考来源</dt><dd>原型构造案例，非真实人工金标。</dd><dt>标签</dt><dd>${regression?'歧义':c.tag==='改善'?'证据缺失':'正常'}</dd></dl>`:`<div class="case-columns">${['1.2','2.0'].map((v,i)=>`<section class="panel"><h3>V${v} ${badge(i?c.after:c.before)}</h3><p class="sub">AI-L2-01～05 @1.0<br>Schema @1.0</p><h3 style="margin-top:18px">实际执行路径</h3><p class="code">S → DUPCHECK → CONTEXT → CCTX → P1 → BASE → FORK → [A1 ∥ A2 ∥ A4] → A3 → A5 → P2 → C → ${regression&&i?'H':c.tag==='改善'&&!i?'H':'P3 → E'}</p><h3 style="margin-top:18px">结构化输出 · 示例</h3><pre class="pre">${esc(JSON.stringify({analysis:regression&&i?'身份有歧义，待人工判断':c.tag==='改善'&&!i?'证据不足，结果失败':'保留证据限制的分析结果',evidence_refs:['DEMO-E01'],uncertainty:regression?'变量身份需核对':'保留输入缺口'},null,2))}</pre><p class="small">程序校验：${c.tag==='改善'&&!i?'未满足证据缺口表达要求':'结构及引用通过'}</p><p class="small">人工处理：${regression&&i?'已进入复核，尚无结论':'未进入人工'}</p><p class="small">最终评估：${i?c.after:c.before}；未写入正式业务事实。</p></section>`).join('')}</div><div class="callout ${regression?'warn':''}">${regression?'退化候选原因：自动完成转人工复核，人工负担增加；但这可能纠正基线的过度自动化，需核查后判断。':'差异原因：检查证据限制、结果路径和结构校验是否符合参考约束。'} 不自动修改参考结果或历史业务输出。</div>`}`,'','',true);}
const writeActions=new Set(['new','copy','save','revision','review','activate','disable','add-node','edit-task','new-eval','revise-dataset','return-review']);
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.view&&b.dataset.view!=='panorama'){state.taskRouteError=false;state.view=b.dataset.view;render();return;}
 if(b.dataset.stageTarget){const layer=document.getElementById(b.dataset.stageTarget);if(isSystemFlow()&&layer)activatePanoramaLayer(layer.dataset.stage);layer?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
 if(b.dataset.detail){state.detail=b.dataset.detail;render();return;}
 if(b.dataset.node||b.dataset.selectNode){selectFlowNode(b.dataset.node||b.dataset.selectNode,!!b.dataset.selectNode);return;}
 if(b.dataset.nodeTaskTab){selectNodeTaskTab(b.dataset.nodeTaskTab);return;}
 if(b.dataset.task){state.task=b.dataset.task;state.taskTab='definition';state.taskRouteError=false;render();return;}
 if(b.dataset.taskTab){state.taskTab=b.dataset.taskTab;render();return;}
 if(b.dataset.evalTab){state.evalTab=b.dataset.evalTab;render();return;}
 const a=b.dataset.action;if(!a)return;
 if(writeActions.has(a)&&!isAdmin()){toast('授权阅读者仅可查看。');return;}
 if(a==='close-modal')return closeModal();
 if(a==='open'){openStrategy(b.dataset.id);if(b.dataset.version){state.version=b.dataset.version;render();}return;}
 if(a==='catalog'){state.view='catalog';render();return;}
 if(a==='panorama'){state.view='panorama';state.node='';state.nodeConfig=false;state.checks=null;render();return;}
 if(a==='return-step'){const current=$('[data-node="'+state.node+'"]');expandNodeModule(current);current?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});current?.focus({preventScroll:true});return;}
 if(a==='back'){state.view='catalog';render();return;}
 if(a==='clear-filters'){Object.assign(state,{query:'',layer:'全部',module:'全部',status:'全部',versionQuery:''});render();return;}
 if(a==='new'||a==='copy')return openNew(a==='copy');
 if(a==='task-directory'){state.taskRouteError=false;state.view='ai';state.aiQuery='';render();return;}
 if(a==='task-link'){
  const target=tasks.find(t=>t.id===b.dataset.id&&(!b.dataset.version||t.version===b.dataset.version));
  if(!target){toast('未找到此固定版本的 AI 任务。');return;}
  state.task=target.id;state.taskRouteError=false;state.aiQuery='';state.view='ai';state.taskTab='definition';render();focusTaskDetail();return;
 }
 if(a==='history-version'){state.version=b.dataset.id;state.detail='flow';state.checks=null;render();return;}
 if(a==='validate'){validate();render();$('#validation').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
 if(a==='save'){if(!editable())return;record().audit.push(`${timestamp()} · 系统管理员保存草稿`);toast('草稿已保存在本次页面会话中。');return;}
 if(a==='revision'){const s=strategy();let v=(Math.max(...s.versions.map(Number))+0.1).toFixed(1);while(s.records[v])v=(Number(v)+0.1).toFixed(1);s.records[v]={...clone(record()),state:'草稿',reason:`基于 V${state.version} 创建修订`,audit:[]};s.versions.push(v);state.version=v;state.checks=null;render();toast('已创建独立草稿，原版本保持不变。');return;}
 if(a==='review'||a==='activate'){
  if((a==='review'&&record().state!=='草稿')||(a==='activate'&&record().state!=='审核中'))return;
  if(!validate()){state.detail='flow';render();toast('完整性检查未通过，请修复后继续。');return;}
  return openGovernance(a);
 }
 if(a==='disable'){if(record().state==='已生效')openGovernance(a);return;}
 if(a==='return-review'){modal('退回修改','<label class="field">退回原因 *<textarea name="reason" required minlength="5"></textarea></label>','return-form','退回草稿');return;}
 if(a==='add-node'){if(!editable())return;modal('添加策略节点',`<label class="field">执行主体<select name="type">${['PROGRAM','AI','HUMAN','CONDITION'].map(t=>`<option value="${t}">${typeNames[t]}</option>`).join('')}</select></label><label class="field">节点名称 *<input name="name" required maxlength="60"></label><div class="callout">添加后需要配置后继路径，并在已有节点中建立通向它的连线。未连接节点会阻止提交审核。</div>`,'node-add-form','添加节点');return;}
 if(a==='edit-task'){const t=tasks.find(t=>t.id===state.task),d=t.draft||t;modal('AI 任务修订 · '+t.name,`<div class="callout">创建 @1.1 草稿。@1.0 的策略引用不变；发布流程待定。</div><label class="field">输出 Schema 片段草案 *<textarea name="schema" required>${esc(d.schema)}</textarea></label><label class="field">变更原因 *<input name="reason" required></label>`,'task-form','保存任务草稿');return;}
 if(a==='case'||a==='dataset-case')return openCase(b.dataset.id,a==='dataset-case');
 if(a==='new-eval'){modal('新建策略评估',`<label class="field">策略<input value="风险状态分析策略 · STR-L2-01" disabled></label><div class="form-grid"><label class="field">基线版本<select name="baseline">${options(strategies[0].versions,'1.2')}</select></label><label class="field">候选版本<select name="candidate">${options(strategies[0].versions,'2.0')}</select></label></div><label class="field">固定评测集<input value="DEMO-SET-L2 @${dataset.version}" disabled></label><label class="field">运行条件<select name="model"><option>演示模型 A / r1</option><option>演示模型 B / r2</option></select></label><div class="callout">保留策略、AI、Schema、输入和运行配置版本。此原型记录请求后停留“等待运行”，不调用模型。</div>`,'eval-form','记录评估请求');return;}
 if(a==='revise-dataset'){modal('创建评测集修订',`<p>当前 @${dataset.version} · ${dataset.size} 个案例。修订不覆盖历史评估所用快照。</p><label class="field" style="margin-top:17px">修订说明 *<textarea name="reason" required></textarea></label><label class="field">新增边界案例标题 *<input name="name" required></label><label class="field">固定输入与参考约束 *<textarea name="constraint" required></textarea></label>`,'dataset-form','保存新版本');return;}
});
document.addEventListener('keydown',e=>{
 const tab=e.target.closest('[data-node-task-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();const current=flowRecord().flow.find(n=>n.id===state.node),task=current&&referencedTask(current);if(!task)return;const tabs=taskTabs;const index=tabs.findIndex(([key])=>key===tab.dataset.nodeTaskTab),last=tabs.length-1;
 const next=e.key==='Home'?0:e.key==='End'?last:(index+(e.key==='ArrowRight'?1:last))%taskTabs.length;
 selectNodeTaskTab(tabs[next][0]);$('[data-node-task-tab="'+tabs[next][0]+'"]').focus({preventScroll:true});
});
document.addEventListener('toggle',e=>{
 if(e.target.matches?.('.node-config'))state.nodeConfig=e.target.open;
 const layer=e.target;
 if(layer.matches?.('[data-flow-layer]')&&layer.isConnected){
  state.panoramaLayersCollapsed=state.panoramaLayersCollapsed.filter(code=>code!==layer.dataset.flowLayer);
  if(!layer.open)state.panoramaLayersCollapsed.push(layer.dataset.flowLayer);
  return;
 }
 const module=e.target;
 if(!module.matches?.('.module-card')||!module.isConnected)return;
 state.panoramaCollapsed=state.panoramaCollapsed.filter(code=>code!==module.dataset.flowModule);
 if(!module.open)state.panoramaCollapsed.push(module.dataset.flowModule);
 module.querySelector('[data-module-toggle]').textContent=module.open?'收起':'展开';
},true);
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.id==='role'){state.role=el.value;closeModal();render();return;}
 const mapping={layer:'layer',module:'module',status:'status',version:'version','case-filter':'caseFilter'};
 if(mapping[el.id]){state[mapping[el.id]]=el.id==='version'?el.value.slice(1):el.value;state.checks=null;render();}
 if(el.id==='third'||el.id==='limited'){state[el.id==='third'?'compareThird':'limited']=el.checked;render();}
});
document.addEventListener('input',e=>{
 const map={search:'query','version-search':'versionQuery','ai-search':'aiQuery'};const key=map[e.target.id];if(!key)return;
 const id=e.target.id,start=e.target.selectionStart;state[key]=e.target.value;render();const input=$('#'+id);input.focus();input.setSelectionRange(start,start);
});
document.addEventListener('submit',e=>{
 e.preventDefault();const f=e.target;if(!isAdmin()){toast('当前角色无修改权限。');return;}const data=Object.fromEntries(new FormData(f));
 if(f.id==='node-form'){if(!editable())return;const n=record().flow.find(x=>x.id===state.node);Object.assign(n,{name:data.name.trim(),input:data.input.trim(),output:data.output.trim(),rule:data.rule.trim()});if(n.type==='AI'){n.task=data.task;n.taskVersion='1.0';}n.next.forEach((x,i)=>x.to=data['edge'+i]);state.checks=null;render();toast('节点配置已应用到草稿。');return;}
 if(f.id==='basic-form'){if(!editable())return;record().scope=data.scope.trim();record().reason=data.reason.trim();toast('适用范围与变更说明已保存。');return;}
 if(f.id==='new-form'||f.id==='copy-form'){
  const code=data.code.trim().toUpperCase();if(strategies.some(s=>s.id===code))return formError('稳定编码已存在，请使用唯一编码。');
  const allowed={L0:['F02'],L1:['F03','F04'],L2:['F05','F06'],L3:['F08']};if(!allowed[data.layer].includes(data.module))return formError('业务层与主责模块不匹配，请核对。');
  const copied=f.id==='copy-form'?clone(record().flow):[{id:'S',type:'START',name:'业务上下文',input:'business_context',output:'context',rule:'待引用领域规则',next:[{label:'成功',to:'H'}]},{id:'H',type:'HUMAN',name:'人工复核',input:'context',output:'context',rule:'待引用领域规则',next:[{label:'批准',to:'E'},{label:'退回',to:'S'},{label:'暂缓',to:'E'}]},{id:'E',type:'END',name:'交付业务模块',input:'context',output:'context',rule:'待引用领域规则',next:[]}];
  const s={id:code,blueprint:f.id==='copy-form'?(strategy().blueprint||strategy().id):null,name:data.name.trim(),layer:data.layer,module:data.module,scene:data.scene.trim(),ai:copied.filter(n=>n.task).map(n=>n.task),active:null,versions:['0.1'],status:'草稿',evaluation:'尚未评估',time:timestamp(),records:{'0.1':{state:'草稿',flow:copied,scope:data.scene.trim(),reason:'新建策略草稿',audit:[]}}};strategies.push(s);closeModal();openStrategy(s.id);toast('策略草稿已创建。');return;
 }
 if(['review-form','activate-form','disable-form'].includes(f.id)){
  const action=f.id.replace('-form',''),r=record(),s=strategy();if(data.reason.trim().length<5)return formError('请填写至少 5 个字的有效说明。');
  if(action==='review'&&r.state!=='草稿'||action==='activate'&&r.state!=='审核中'||action==='disable'&&r.state!=='已生效')return formError('版本状态已变化，请重新打开。');
  if(action!=='disable'&&!validate())return formError('当前定义未通过校验，不能继续。');
  if(action==='review')r.state='审核中';
  if(action==='activate'){if(s.active)s.records[s.active].state='已停用';s.active=state.version;r.state='已生效';}
  if(action==='disable'){r.state='已停用';if(s.active===state.version)s.active=null;}
  r.audit.push(`${timestamp()} · 系统管理员 · ${action==='review'?'提交审核':action==='activate'?'审核并生效':'停用'}：${data.reason.trim()}`);closeModal();state.checks=null;render();toast(action==='activate'?'版本已在演示中生效，在途运行仍锁定原版本。':action==='review'?'已提交审核，尚未生效。':'已停止新运行选择此版本。');return;
 }
 if(f.id==='return-form'){if(record().state!=='审核中')return;record().state='草稿';record().audit.push(`${timestamp()} · 退回：${data.reason.trim()}`);closeModal();render();return;}
 if(f.id==='node-add-form'){if(!editable())return;const flow=record().flow;let id='N'+(flow.length+1);while(flow.some(x=>x.id===id))id+='A';const type=data.type;flow.splice(flow.length-1,0,{id,type,name:data.name.trim(),input:'context',output:'context',rule:'待引用领域规则',...(type==='AI'?{task:'AI-L2-01',taskVersion:'1.0'}:{}),next:(type==='CONDITION'?['是','否']:type==='HUMAN'?['批准','退回','暂缓']:['成功','失败 / 无结果']).map(label=>({label,to:''}))});state.node=id;state.checks=null;closeModal();render();toast('节点已添加，请连接入口与后继路径。');return;}
 if(f.id==='task-form'){try{const parsed=JSON.parse(data.schema);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error();}catch{return formError('Schema 草案必须是有效 JSON 对象。');}tasks.find(t=>t.id===state.task).draft={schema:data.schema,reason:data.reason};closeModal();render();toast('任务 @1.1 草稿已保存，原策略引用保持 @1.0。');return;}
 if(f.id==='eval-form'){if(data.baseline===data.candidate)return formError('基线与候选版本不能相同。');const s=strategies[0];const r=s.records[data.candidate];evaluations.push({id:'DEMO-EVAL-'+String(21+evaluations.length).padStart(3,'0'),baseline:data.baseline,candidate:data.candidate,dataset:dataset.version,state:'等待运行',limited:data.model.includes('B'),time:timestamp(),refs:r.flow.filter(n=>n.type==='AI').map(n=>n.task+' @'+n.taskVersion).join(' / ')+' · Schema @1.0',model:data.model,snapshot:'E-20261015-01'});closeModal();state.evalTab='history';render();toast('评估请求已记录；尚未连接运行服务。');return;}
 if(f.id==='dataset-form'){dataset={...dataset,version:(Number(dataset.version)+.1).toFixed(1),size:dataset.size+1};cases.push({id:'DEMO-C'+String(cases.length+1).padStart(2,'0'),name:data.name,tag:'待评估',input:data.constraint,before:'未运行',after:'未运行',datasetVersion:dataset.version});closeModal();render();toast('评测集新版本已保存，历史评估仍引用原版。');return;}
});
globalThis.addEventListener?.('hashchange',()=>{
 state.view=navigationView();applyTaskRoute();state.node='';state.nodeConfig=false;state.checks=null;render();if(state.view==='ai'&&!state.taskRouteError)focusTaskDetail();
});
render();
if(state.view==='ai'&&!state.taskRouteError)focusTaskDetail();

// Scroll updates the reading position without rebuilding the graph or moving focus.
let panoramaScrollPending=false;
document.addEventListener('scroll',()=>{
 if(!isSystemFlow()||panoramaScrollPending||!globalThis.requestAnimationFrame)return;
 panoramaScrollPending=true;
 requestAnimationFrame(()=>{
  panoramaScrollPending=false;
  const nav=document.querySelector('.system-panorama .stage-nav');if(!nav)return;
  const threshold=nav.getBoundingClientRect().bottom+28;
  const layers=Array.from(document.querySelectorAll('.system-panorama [data-stage]'));
  const current=layers.filter(layer=>layer.getBoundingClientRect().top<=threshold).at(-1)||layers[0];
  if(current)activatePanoramaLayer(current.dataset.stage);
 });
},{passive:true,capture:true});
