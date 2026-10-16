import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('M3策略管理中心交互原型.html',root),'utf8');
const elements=new Map(),listeners=new Map(),checks=[];
const element=selector=>{
 if(!elements.has(selector))elements.set(selector,{hidden:true,innerHTML:'',style:{},addEventListener(){},focus(){},scrollIntoView(){}});
 return elements.get(selector);
};
const context=vm.createContext({
 document:{querySelector:element,querySelectorAll:()=>[],getElementById:element,addEventListener(type,handler){listeners.set(type,handler);}},
 setTimeout:()=>0,clearTimeout(){},matchMedia:()=>({matches:false})
});
const run=code=>vm.runInContext(code,context);
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
let original;
for(const [,file] of html.matchAll(/<script defer src="([^"]+)"/g)){
 if(file==='../原型资源/top-actions.js')continue;
 vm.runInContext(readFileSync(new URL(file,root),'utf8'),context,{filename:file});
 if(file==='原型资源/flow-data.js')original=run('JSON.stringify(DOMAIN_FLOWS)');
}
check('独立菜单显示流水线全景',html.includes('data-action="panorama">流水线全景</button>'));
check('全景组合不修改六条策略蓝图',original===run('JSON.stringify(DOMAIN_FLOWS)'));
const snapshot=run('JSON.stringify({strategies,tasks})');
const click=dataset=>listeners.get('click')({target:{closest:()=>({dataset,disabled:false})}});
click({action:'panorama'});
check('菜单直接进入系统全景',run("state.view==='panorama' && blueprint()===SYSTEM_PANORAMA"));
check('全景顶部不显示选择、版本和检查工具',element('#page-tools').innerHTML===''&&element('#top-back').hidden);
check('初始不预选隐藏步骤且详情显示操作提示',run("state.node===''")&&element('#content').innerHTML.includes('panorama-empty')&&!element('#content').innerHTML.includes('node-detail-head'));
check('全景没有旧切换器或笼统折叠分组',!element('#content').innerHTML.includes('panorama-strategy')&&!element('#content').innerHTML.includes('stage-extra'));
const graph=run('SYSTEM_PANORAMA'),sources=run('FLOW_SOURCES');
const nodes=Array.from(graph.nodes),ids=new Set(nodes.map(n=>n.id));
check('全景节点标识唯一',ids.size===nodes.length);
check('按L0至L3及横向支撑组织',Array.from(graph.stages,s=>s.code).join()==='L0,L1,L2,L3,M');
const displayed=Array.from(graph.stages).flatMap(s=>Array.from(run(`stageNodes(SYSTEM_PANORAMA.stages.find(s=>s.code==='${s.code}'))`)));
check('每个全景节点恰好展示一次',displayed.length===nodes.length&&new Set(displayed).size===nodes.length&&displayed.every(id=>ids.has(id)));
const modules=Array.from(graph.stages).flatMap(stage=>Array.from(stage.modules||[]));
check('全景按F01到F08划为八张模块卡片',modules.map(module=>module.code).join()==='F01,F02,F03,F04,F05,F06,F07,F08');
const moduleIds=modules.flatMap(module=>Array.from(module.nodeIds));
check('四层114个业务节点均归入唯一F模块',moduleIds.length===114&&new Set(moduleIds).size===114);
const actualIds=[...element('#content').innerHTML.matchAll(/data-node="([^"]+)"/g)].map(match=>match[1]);
check('实际卡片渲染仍完整呈现118个唯一节点',actualIds.length===118&&new Set(actualIds).size===118);
for(const module of modules){
 check(module.code+'节点归属正确',Array.from(module.nodeIds).every(id=>nodes.find(n=>n.id===id).module===module.code));
 check(module.code+'默认收起且保留展开时的步骤范围数据',element('#content').innerHTML.includes(`data-flow-module="${module.code}" ><summary`)&&element('#content').innerHTML.includes(module.stepRange));
}
for(const stage of graph.stages.filter(stage=>stage.kind==='business')){
 const header=run(`flowStageHeader(SYSTEM_PANORAMA.stages.find(stage=>stage.code==='${stage.code}'))`);
 check(stage.code+'层级头为弱化标签且无可见描述和步数',header.includes('stage-head-quiet')&&!header.includes('<p>')&&!header.includes('stage-count'));
}
const toggleLabel={textContent:''};
const folded={dataset:{flowModule:'F02'},open:false,isConnected:true,matches:selector=>selector==='.module-card',querySelector:()=>toggleLabel};
listeners.get('toggle')({target:folded});
run('render();');
check('收起模块后重绘保留折叠状态',run("state.panoramaCollapsed.includes('F02')")&&element('#content').innerHTML.includes('data-flow-module="F02" ><summary'));
check('折叠文案更新为展开',toggleLabel.textContent==='展开');
const linkedStep=element('[data-node="EV-S"]');
linkedStep.closest=()=>folded;
click({selectNode:'EV-S'});
check('跨模块步骤跳转自动展开目标卡片',folded.open&&!run("state.panoramaCollapsed.includes('F02')")&&run("state.node==='EV-S'"));
listeners.get('toggle')({target:folded});
check('自动展开后恢复收起文案',toggleLabel.textContent==='收起');
folded.open=false;
listeners.get('toggle')({target:folded});
click({view:'catalog'});click({action:'panorama'});
check('离开并返回全景保留模块折叠状态',element('#content').innerHTML.includes('data-flow-module="F02" ><summary'));
folded.open=true;listeners.get('toggle')({target:folded});
for(const n of nodes){
 check(`${n.id}后继可定位`,Array.from(n.next).every(edge=>edge.label&&ids.has(edge.to)));
 check(`${n.id}来源和职责完整`,sources[n.source]&&n.section&&n.rule&&n.summary&&n.inputDescription&&n.outputDescription);
 check(`${n.id}具有清晰步骤或条件出口名称`,!!n.panoramaStep);
 if(n.type==='CONDITION')check(`${n.id}保留条件出口`,n.next.length>=2);
 if(n.type==='AI')check(`${n.id}固定任务引用有效`,run(`!!referencedTask(flowRecord().flow.find(n=>n.id==='${n.id}'))`));
 if(n.requiresAll)check(`${n.id}保留实际汇合依赖`,Array.from(n.requiresAll).every(id=>nodes.find(n=>n.id===id)?.next.some(edge=>edge.to===n.id)));
 const rendered=run(`nodeDetail(SYSTEM_PANORAMA.nodes.find(n=>n.id==='${n.id}'))`);
 check(`${n.id}详情及只读表单可渲染`,rendered.includes(n.panoramaStep)&&rendered.includes('<fieldset disabled'));
}
for(const stage of graph.stages.filter(s=>s.kind==='business')){
 const labels=Array.from(stage.sections).flatMap(section=>Array.from(section.steps,step=>step.label)).filter(label=>label.startsWith('Step '));
 check(`${stage.code}从Step1连续编号`,labels.every((label,index)=>label===`Step ${index+1}`)&&labels.length===stage.stepCount&&labels.length>5);
}
for(const key of run('Object.keys(DOMAIN_FLOWS).filter(key=>key!=="system")')){
 const originalNodes=run(`DOMAIN_FLOWS['${key}'].nodes`);
 const composed=nodes.filter(n=>n.origin?.flow===key);
 check(`${key}全部业务节点进入全景`,composed.length===originalNodes.length&&originalNodes.every(n=>composed.some(copy=>copy.origin.id===n.id)));
 for(const n of originalNodes){
  const copy=composed.find(item=>item.origin.id===n.id);
  const preserved=['task','taskVersion','source','section','rule','pending',...(copy.id==='EV-RATE'?[]:['summary','ruleDetail'])];
  check(`${key}/${n.id}保留任务、文档、规则和待定事项`,preserved.every(key=>copy[key]===n[key]));
 }
}
const next=id=>Array.from(nodes.find(n=>n.id===id).next,edge=>edge.to);
check('指标实际值直接进入已纳管风险证据准备',next('IN-VALUE').includes('STATE-S')&&!next('IN-VALUE').includes('RISK-S'));
check('事件交付同时保留识别及证据用途',next('EV-E').includes('RISK-S')&&next('EV-E').includes('STATE-S'));
check('金融意义评级回到事件统一校验',next('EV-RATE').includes('RATE-S')&&next('RATE-E').includes('EV-P2'));
check('正式纳管结果交付观察',next('RISK-E').includes('STATE-S'));
check('当前快照先交历史变化并可供产品引用',next('STATE-E').includes('CHANGE-S')&&next('STATE-E').includes('VIEW-S'));
check('首次及不可比保留待判断分支',next('CHANGE-C').includes('CHANGE-UNKNOWN'));
check('发布条件与恢复未决保留',nodes.find(n=>n.id==='REPORT-CPUB').blocking&&nodes.find(n=>n.id==='RISK-RESTORE').pending);
check('全景包含全部16项AI任务',new Set(nodes.filter(n=>n.task).map(n=>n.task)).size===16);
for(const role of ['系统管理员','授权阅读者']){
 run(`state.role='${role}';render();`);
 check(role+'浏览全景始终只读',!run('editable()')&&element('#page-tools').innerHTML==='');
 click({node:'STATE-A1'});
 check(role+'可查看AI步骤五个标签',element('.node-detail').outerHTML.includes('AI-L2-01')&&(element('.node-detail').outerHTML.match(/data-node-task-tab=/g)||[]).length===5);
}
check('浏览全景不修改策略和AI任务',snapshot===run('JSON.stringify({strategies,tasks})'));
click({view:'catalog'});
click({action:'open',id:'STR-L2-01'});
run("state.role='系统管理员';render();");
check('策略编排仍使用原版本节点',run("flowRecord()===record() && flowRecord().flow.length===19 && editable()"));
check('编排页保留版本、保存和完整性工具',element('#page-tools').innerHTML.includes('id="version"')&&element('#page-tools').innerHTML.includes('data-action="save"')&&element('#page-tools').innerHTML.includes('data-action="validate"'));
if(process.argv[2]){
 const before=readFileSync(path.join(process.argv[2],'原型资源/app.js'),'utf8');
 const after=readFileSync(new URL('原型资源/app.js',root),'utf8');
 for(const [name,extract] of [
  ['全部业务写入处理',s=>s.slice(s.indexOf("document.addEventListener('submit'"))],
  ['原完整性校验',s=>s.slice(s.indexOf('function validate()'),s.indexOf('function validationView()'))],
  ['策略与AI任务定义',s=>s.slice(s.indexOf('const taskNames'),s.indexOf('let state='))]
 ])check(name+'与修改前一致',extract(before)===extract(after));
 check('原flow-data.js保持不变',readFileSync(path.join(process.argv[2],'原型资源/flow-data.js'),'utf8')===readFileSync(new URL('原型资源/flow-data.js',root),'utf8'));
 const previousPanorama=path.join(process.argv[2],'原型资源/system-panorama.js');
 if(existsSync(previousPanorama)){
  const previous=vm.createContext({});
  vm.runInContext(readFileSync(path.join(process.argv[2],'原型资源/flow-data.js'),'utf8')+'\n'+readFileSync(previousPanorama,'utf8')+'\nthis.graph=SYSTEM_PANORAMA;',previous);
  const businessView=graph=>JSON.stringify({nodes:graph.nodes.map(({module,...node})=>node),stages:graph.stages.map(({modules,...stage})=>stage)});
  check('模块卡片前后全部节点职责、后继和Step编号保持一致',businessView(previous.graph)===businessView(graph));
 }
}
const result={date:'2026-10-16',passed:checks.length,nodes:nodes.length,modules:modules.map(module=>({code:module.code,nodes:module.nodeIds.length,stepRange:module.stepRange})),layers:Array.from(graph.stages,s=>({code:s.code,steps:s.stepCount,nodes:run(`stageNodes(SYSTEM_PANORAMA.stages.find(s=>s.code==='${s.code}')).length`)})),checks};
writeFileSync(new URL('流水线全景验证结果.json',import.meta.url),JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify({passed:result.passed,nodes:result.nodes,layers:result.layers}));
