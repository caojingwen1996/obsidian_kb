// Viewer primitives ported from the approved panorama prototype; business commands are excluded.
import graph from './pipeline-data.js';
import taskData from './pipeline-tasks.js';
import {state, esc} from './pipeline-state.js';
const FLOW_SOURCES=graph.sources, SYSTEM_PANORAMA=graph.system;
const tasks=taskData.tasks, TASK_DEFINITION_REFERENCES=taskData.definitions, TASK_PROMPT_REFERENCES=taskData.prompts;
const $=(selector,root=document)=>root.querySelector(selector);
const typeNames={START:'开始',PROGRAM:'程序',AI:'AI 分析',HUMAN:'人工',CONDITION:'条件',END:'结束',MODULE:'业务模块'};
const isSystemFlow=()=>true, editable=()=>false;
const flowRecord=()=>({state:'业务定义',flow:SYSTEM_PANORAMA.nodes});
const blueprint=()=>SYSTEM_PANORAMA;
export const taskTabs=[['definition','任务定义'],['schema','输入输出'],['constraints','工具与约束'],['usage','引用与版本']];
function flowEdge(from,to,label,content=''){
 return `<div class="module-step-connector" data-flow-edge="${esc(from)}:${esc(to)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-4-4 4 4 4-4"/></svg>${label?`<span>${esc(label)}</span>`:''}</div>${content}`;
}
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

function renderFlowGroup(item,selected,nodes,overview=false,context){
 if(!isSystemFlow())return `<section class="domain-group ${item.parallel?'parallel-group':'conditional-group'}" data-flow-group="${item.parallel?'parallel':'conditional'}"><div class="group-title"><span>${esc(item.title)}</span><small>${item.parallel?'并行路径 · 按必要依赖汇合':'条件路径'}</small></div><div class="domain-lanes lanes-${item.lanes.length}">${item.lanes.map(l=>`<section class="domain-lane"><div class="lane-label">${esc(l.title)}</div>${l.nodes.map((id,i)=>{const n=nodes.find(n=>n.id===id),edge=n.next.find(e=>e.to===l.nodes[i+1]);return flowNode(n,selected,overview)+(edge?`<div class="module-step-connector"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-4-4 4 4 4-4"/></svg><span>${esc(edge.label)}</span></div>`:'');}).join('')}</section>`).join('')}</div></section>`;
 const anchor=context?.groupAnchors.get(item);
 return `<section class="domain-group ${item.parallel?'parallel-group':'conditional-group'}" data-flow-group="${item.parallel?'parallel':'conditional'}"><div class="group-title">${esc(item.title)}${item.parallel?'<small>并行 · 按必要依赖汇合</small>':''}</div><div class="domain-lanes lanes-${item.lanes.length}">${item.lanes.map(l=>{const target=l.nodes[0]||l.handoffs?.[0],edge=anchor?.next.find(e=>e.to===target);return `<section class="domain-lane">${edge?flowEdge(anchor.id,target,`路径 ${l.path} · ${edge.label}`):`<div class="lane-label">路径 ${esc(l.path)} · ${esc(l.title)}</div>`}${(l.handoffs||[]).map(id=>`<button class="path-handoff link" data-select-node="${esc(id)}">交付 ${esc(nodeLocation(nodes.find(n=>n.id===id)))}</button>`).join('')}${l.nodes.map((id,i)=>renderSystemNode(nodes.find(n=>n.id===id),selected,nodes,l.nodes[i+1],context)).join('')}</section>`;}).join('')}</div></section>`;
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
 return `<details class="module-concepts" data-module-concepts="${esc(module.code)}"><summary><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/></svg><span>概念定义</span><svg class="concept-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></summary><dl class="concept-definitions">${module.concepts.map(c=>`<div><dt>${esc(c.name)} <span>${esc(c.term)}</span></dt><dd><p>${esc(c.definition)}</p><p>${esc(c.boundary)}</p></dd></div>`).join('')}</dl>${source?`<a class="concept-source" href="${esc(source.path)}" target="_blank" rel="noopener">定义依据：${esc(source.title)} ${esc(module.conceptSections)}</a>`:''}</details>`;
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
 const citation=ref?`<a href="${esc(ref.path)}" target="_blank" rel="noopener">${esc(ref.title)}</a><p class="small">${esc(n.section)}</p>`:'<p class="muted small">尚未绑定业务文档</p>';
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
 ${waiting?'<aside class="inspector node-detail panorama-empty" aria-label="步骤详情" tabindex="0"><h2>步骤详情</h2><p>展开模块并选择步骤，查看输入、产出和流向。</p></aside>':nodeDetail(n)}</div>`;
}

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
 <details class="f01-detail-evidence"><summary>规则与依据</summary><p>${esc(n.ruleDetail)}</p><p>规则引用：${esc(n.rule)}</p>${source?`<a href="${esc(source.path)}" target="_blank" rel="noopener">${esc(source.title)}</a><p>${esc(n.section)}</p>`:'<p>尚未绑定业务文档</p>'}</details>
 <details class="node-config f01-detail-config"><summary>节点配置<span class="config-readonly">只读</span></summary><dl><dt>稳定节点 ID</dt><dd>${esc(n.id)}</dd><dt>输入映射</dt><dd>${esc(n.input)}</dd><dt>输出映射</dt><dd>${esc(n.output)}</dd></dl><h3>后继配置</h3><ul>${n.next.map(edge=>`<li>${esc(edge.label)} → ${esc(edge.to)}</li>`).join('')||'<li>无已配置后继</li>'}</ul></details></aside>`;
}

function f02AiNodeDetail(n){
 const nodes=flowRecord().flow,source=FLOW_SOURCES[n.source];
 return `<aside class="inspector node-detail AI f01-node-detail f02-ai-detail" data-detail-type="AI" aria-label="节点详解" tabindex="0"><button class="link panorama-return-step" data-action="return-step">← 返回当前步骤</button>
 <header class="node-detail-head"><div class="flex"><h2>${esc(nodeLocation(n))}</h2></div><span class="node-type f01-detail-role"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/></svg>AI 分析</span></header>
 <p class="f01-definition-note">流程定义 · 只读</p><p class="f01-detail-summary">${esc(n.summary)}</p>${n.pending?`<p class="callout warn">待确认：${esc(n.pending)}</p>`:''}
 ${n.reviewed&&!n.task?`<section class="f01-detail-section"><h3>输入与产出</h3><dl><dt>输入</dt><dd>${esc(n.inputDescription)}</dd><dt>产出</dt><dd>${esc(n.outputDescription)}</dd></dl><p>任务编号待定，职责见金融意义文档。</p></section>`:embeddedTask(n)}
 <details class="node-config node-routing f01-detail-config"><summary>节点配置与流向<span class="config-readonly">只读</span></summary>
 <h3>上游输入映射</h3><ul>${nodes.filter(item=>item.next.some(edge=>edge.to===n.id)).map(item=>`<li>${esc(nodeLocation(item))}</li>`).join('')}</ul>
 <h3>后继与处理出口</h3><div class="f01-detail-routes">${n.next.map(edge=>{const target=nodes.find(item=>item.id===edge.to);return `<div class="f01-detail-route"><span class="f01-route-condition">${esc(edge.label)}</span>${target?`<button class="link" data-select-node="${esc(target.id)}">${esc(nodeLocation(target))}</button>`:'<p class="negative">未配置 · 将阻止审核</p>'}</div>`;}).join('')}</div>
 <h3>规则与依据</h3><p>${esc(n.ruleDetail)}</p><p>${esc(n.rule)}</p>${source?`<a href="${esc(source.path)}" target="_blank" rel="noopener">${esc(source.title)}</a><p>${esc(n.section)}</p>`:''}
 <dl><dt>稳定节点 ID</dt><dd>${esc(n.id)}</dd><dt>输入映射</dt><dd>${esc(n.input)}</dd><dt>输出映射</dt><dd>${esc(n.output)}</dd></dl></details></aside>`;
}

function nodeDetail(n){
 if(isSystemFlow()&&['F01','F02'].includes(n.module)&&n.type!=='AI')return f01NodeDetail(n);
 if(isSystemFlow()&&n.module==='F02'&&n.type==='AI')return f02AiNodeDetail(n);
 const r=flowRecord(),info=nodeExplanation(n),compact=n.type!=='AI',stage=nodeStage(n.id),step=stage?`${stage.code} · ${stage.title}`:'新增设计节点';
 const header=` <aside class="inspector node-detail ${n.type}${compact?' compact-node':''}" aria-label="节点详解" tabindex="0">${isSystemFlow()?'<button class="link panorama-return-step" data-action="return-step">← 返回当前步骤</button>':''}<header class="node-detail-head"><div class="flex"><h2 title="${esc(step)}">${isSystemFlow()?esc(stage.code+' / '+n.module+' / '+n.panoramaStep)+' · ':''}${esc(flowNodeTitle(n))}</h2></div><span class="node-type">${typeNames[n.type]}</span></header>${!compact||n.summary?`<div class="node-summary">${esc(info[0])}</div>`:''}`;
 if(n.type==='AI')return `${header}${n.reviewed&&!n.task?`<section class="f01-detail-section"><h3>输入与产出</h3><dl><dt>输入</dt><dd>${esc(n.inputDescription)}</dd><dt>产出</dt><dd>${esc(n.outputDescription)}</dd></dl><p>任务编号待定，职责见金融意义文档。</p></section>`:embeddedTask(n)}${aiNodeRouting(n)}</aside>`;
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
 <h3 class="node-edit-title">只读节点配置</h3>${nodeForm(n)}</details>`;
}

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

function referencedTask(n){return tasks.find(t=>t.id===n.task&&t.version===n.taskVersion);}

function embeddedTask(n){
 const key=[state.view,state.selected,state.version,n.id,n.task,n.taskVersion].join('/');
 if(state.nodeTaskKey!==key){state.nodeTaskKey=key;state.nodeTaskTab='definition';}
 const t=referencedTask(n);
 if(!t)return `<section class="embedded-task"><h3>AI 任务 · 引用版本不可用</h3><p class="code">${esc(n.task)} @${esc(n.taskVersion)}</p><div class="callout warn">未找到此固定版本的分析定义，请核对节点引用。不会替换为最新版本或草稿。</div></section>`;
 return `<section class="embedded-task" aria-label="AI 任务内嵌详情"><div class="embedded-task-head"><span class="code" title="${esc(t.name)} · 固定引用版本">${esc(t.id)} · ${t.reviewed?'已审核业务定义':'@'+esc(t.version)}</span><div class="embedded-task-actions">${taskCatalogLink(t)}<span class="badge">只读</span></div></div>${taskPromptDisclosure(t)}<nav class="subtabs" role="tablist" aria-label="AI 任务详情">${taskTabs.map(([key,label])=>`<button type="button" role="tab" id="node-task-tab-${key}" data-node-task-tab="${key}" aria-selected="${state.nodeTaskTab===key}" aria-controls="node-task-content" tabindex="${state.nodeTaskTab===key?'0':'-1'}">${label}</button>`).join('')}</nav><div id="node-task-content" role="tabpanel" tabindex="0" aria-labelledby="node-task-tab-${state.nodeTaskTab}">${taskContent(t,state.nodeTaskTab,{embedded:true})}</div></section>`;
}

function nodeLocation(n){return `${nodeStage(n.id)?.code||'M'} / ${n.module||'M'} / ${n.panoramaStep} · ${flowNodeTitle(n)}`;}

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

function reviewedTaskContent(t,tab){
 const source=`<a href="${esc(t.sourceHref)}" target="_blank" rel="noopener">${esc(t.sourceTitle)} · ${esc(t.section)}</a>`;
 if(tab==='prompt')return referencedPromptContent(t);
 if(tab==='schema')return `<section class="task-contract"><h3>业务输入与产出</h3><dl class="meta"><dt>输入</dt><dd>${esc(t.inputDescription)}</dd><dt>产出</dt><dd>${esc(t.outputDescription)}</dd></dl><p class="muted">业务定义已审核；机器字段与运行契约以对应任务文档的适配状态为准。</p>${source}</section>`;
 if(tab==='constraints')return `<h3>处理约束</h3><p>${esc(t.ruleDetail)}</p><p>仅使用本次获准的事实、原文与定义依据；工具和执行配置不由展示页修改。</p>${source}`;
 if(tab==='usage')return `<h3>引用与状态</h3><p>F02 已审核流程 · 2026-10-31。此处为业务定义阅读版本，不是已发布运行任务包。</p><p>${esc(t.pending)}</p>${source}`;
 return `<section class="task-definition-reference"><h3>分析职责与步骤</h3><p>${esc(t.summary)}</p>${source}</section>`;
}
function taskContent(t,tab=state.taskTab,{embedded=false}={}){if(t.reviewed)return reviewedTaskContent(t,tab);if(tab==='prompt')return referencedPromptContent(t);const f02=embedded&&isSystemFlow()?flowRecord().flow.find(n=>n.id===state.node&&n.module==='F02'&&n.task===t.id&&n.taskVersion===t.version):null;if(tab==='definition'&&/^AI-0[1-5]$/.test(t.id))return taskDefinitionReference(t)?referencedTaskDefinition(t):'<p class="callout warn">任务定义章节未加载，请重新同步文档引用后刷新页面。</p>';if(f02&&tab==='schema')return '<p class="muted small">固定任务版本的契约字段如下；候选与版本化证据的精确Schema按F02协作待办联合落实。</p>'+taskContractContent(t,{embedded});const uses=taskData.usage.filter(use=>use.tasks.includes(t.id));if(tab==='definition')return `<dl class="meta">${embedded?'':`<dt>分析问题</dt><dd>${esc(t.name)}；在对应业务边界内输出分析建议。</dd>`}<dt>完成标准</dt><dd>结构完整、引用可追溯，证据不足时明确限制。</dd><dt>分析步骤</dt><dd>读取固定版本上下文 → 核对证据 → 分析并说明不确定性 → 返回结构化结果。</dd><dt>后续处理</dt><dd>对应业务模块进行程序校验，必要时由系统管理员复核。</dd></dl>${embedded?'':'<div class="callout">逻辑任务不等同于一次模型调用；运行方式由执行能力决定。</div>'}`;
 if(tab==='schema')return taskContractContent(t,{embedded});
 if(tab==='constraints')return `<dl class="meta"><dt>工具能力</dt><dd>内部对象查询、证据原文读取、计算与结构化转换（示例许可）</dd><dt>模型要求</dt><dd>结构化输出、证据上下文理解、工具调用；具体规模待确认。</dd><dt>禁止事项</dt><dd>禁止编造对象 ID；禁止将缺失解释为零值、低风险或稳定；禁止自行批准分析结果。</dd><dt>证据要求</dt><dd>必须返回关键证据引用及不确定性。</dd><dt>校验与兜底</dt><dd>通过 → 后继节点；受限结果 → 补齐或受限结束；身份歧义 / 证据冲突 → 人工复核。</dd></dl><div class="callout">这里只定义逻辑能力要求。凭据、真实模型调用、并发、重试与超时属于运行能力。</div>`;
 return '<h3>业务蓝图引用</h3>'+uses.map(use=>'<div class="task-usage"><span class="code">'+esc(use.id)+'</span><p class="muted small">固定任务引用 @'+esc(t.version)+'</p></div>').join('')+'<div class="callout">业务蓝图引用用于阅读，不表示运行版本已发布。</div>';
}

function nodeForm(n){return '<dl class="meta readonly-node"><dt>稳定节点 ID</dt><dd>'+esc(n.id)+'</dd><dt>执行主体</dt><dd>'+esc(typeNames[n.type])+'</dd><dt>输入映射</dt><dd>'+esc(n.input)+'</dd><dt>输出映射</dt><dd>'+esc(n.output)+'</dd><dt>领域规则</dt><dd>'+esc(n.rule)+'</dd></dl>';}
function taskCatalogLink(t){return '<a class="link task-catalog-link" href="#ai/'+esc(t.id)+'/'+esc(t.version)+'" aria-label="查看 AI 任务 '+esc(t.id)+' @'+esc(t.version)+'">查看 AI 任务</a>';}
export function panoramaView(){return flowHeader()+flowView();}
export function taskPage(id,version,tab='definition'){
 const task=tasks.find(t=>t.id===id&&t.version===version);
 if(!task)return '<section class="panel" tabindex="-1"><h2>AI 任务版本不可用</h2><p>未找到指定的固定任务版本，请返回流水线核对引用。</p><a class="link" href="#panorama">返回流水线全景</a></section>';
 state.taskTab=taskTabsFor(task).some(([key])=>key===tab)?tab:'definition';
 return '<section class="panel task-page" tabindex="-1" aria-label="AI 任务详情"><a class="link" href="#panorama">← 返回流水线全景</a><h2>'+esc(task.name)+'</h2><p class="code">'+esc(task.id)+' @'+esc(task.version)+' · 只读定义</p><nav class="subtabs" role="tablist" aria-label="固定任务资料">'+taskTabsFor(task).map(([key,label])=>'<button role="tab" data-task-tab="'+key+'" aria-selected="'+(state.taskTab===key)+'" tabindex="'+(state.taskTab===key?0:-1)+'" id="task-tab-'+key+'" aria-controls="task-page-content">'+label+'</button>').join('')+'</nav><div id="task-page-content" role="tabpanel" aria-labelledby="task-tab-'+state.taskTab+'">'+taskContent(task,state.taskTab)+'</div></section>';
}
export {nodeDetail, nodeLocation, taskContent, referencedTask, taskTabsFor};
