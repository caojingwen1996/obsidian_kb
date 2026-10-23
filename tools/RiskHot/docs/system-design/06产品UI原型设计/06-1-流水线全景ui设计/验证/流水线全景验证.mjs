import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=new URL('../',import.meta.url);
const sharedRoot=new URL('../06-4-M3策略管理中心UI设计/',root);
const html=readFileSync(new URL('流水线全景交互原型.html',root),'utf8');
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
 if(file.endsWith('/flow-data.js'))original=run('JSON.stringify(DOMAIN_FLOWS)');
}
check('独立菜单显示流水线全景',/data-action="panorama"[^>]*>[\s\S]*?<span>流水线全景<\/span><\/a>/.test(html));
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
check('所有业务节点均归入唯一F模块',moduleIds.length===nodes.filter(n=>/^F/.test(n.module)).length&&new Set(moduleIds).size===moduleIds.length);
check('全部模块标题不渲染说明小字',!element('#content').innerHTML.includes('module-card-description'));
check('模块内节点说明仍完整保留',element('#content').innerHTML.includes('node-caption'));
const actualIds=[...element('#content').innerHTML.matchAll(/data-node="([^"]+)"/g)].map(match=>match[1]);
check('实际卡片完整呈现所有唯一节点',actualIds.length===nodes.length&&new Set(actualIds).size===nodes.length);
for(const module of modules){
 check(module.code+'节点归属正确',Array.from(module.nodeIds).every(id=>nodes.find(n=>n.id===id).module===module.code));
 check(module.code+'默认收起且保留展开时的步骤范围数据',element('#content').innerHTML.includes(`data-flow-module="${module.code}" ><summary`)&&element('#content').innerHTML.includes(module.stepRange));
}
for(const stage of graph.stages.filter(stage=>stage.kind==='business')){
 const header=run(`flowStageHeader(SYSTEM_PANORAMA.stages.find(stage=>stage.code==='${stage.code}'))`);
 check(stage.code+'业务层使用原生折叠标题并展示一级标题及职责',header.startsWith('<summary')&&header.includes('stage-head-primary')&&header.includes(stage.description)&&!header.includes('stage-count'));
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
 check(`${n.id}详情及只读配置可渲染`,rendered.includes(n.panoramaStep)&&(['F01','F02'].includes(n.module)?rendered.includes('f01-detail-config')&&!rendered.includes('<form'):rendered.includes('<fieldset disabled')));
}
const f01DetailNodes=nodes.filter(n=>n.module==='F01');
check('F01仅应用已有四类详情，不新增AI或人工节点',new Set(f01DetailNodes.map(n=>n.type)).size===4&&f01DetailNodes.every(n=>['START','PROGRAM','CONDITION','END'].includes(n.type)));
for(const n of f01DetailNodes){
 check(n.id+'专属业务逻辑完整',n.type==='CONDITION'?!!n.panoramaDetail.question&&n.panoramaDetail.basis.length>=2:n.type==='END'?!!n.panoramaDetail.resultType:n.panoramaDetail.actions.length>=2);
}
const fixture=JSON.parse(JSON.stringify(f01DetailNodes.find(n=>n.id==='IN-CHECK')));
fixture.pending='测试待确认项';fixture.next=[{label:'测试缺失目标',to:'MISSING'}];
const invalidDetail=run(`f01NodeDetail(${JSON.stringify(fixture)})`);
check('F01待确认与目标缺失在折叠区之前直接可见',invalidDetail.indexOf('待确认：测试待确认项')<invalidDetail.indexOf('<details')&&invalidDetail.indexOf('分支目标缺失')<invalidDetail.indexOf('<details'));
fixture.next=[];
check('F01非结束节点缺失后继明确阻断',run(`f01NodeDetail(${JSON.stringify(fixture)})`).includes('未配置后继 · 将阻止审核'));
for(const stage of graph.stages.filter(s=>s.kind==='business')){
 const labels=Array.from(stage.modules).flatMap(module=>[...new Set(Array.from(module.nodeIds,id=>nodes.find(n=>n.id===id).panoramaStep.match(/^Step (\d+)/)?.[1]).filter(Boolean))].map(n=>`Step ${n}`));
 const expected=stage.code==='L0'?[...Array.from({length:6},(_,i)=>`Step ${i+1}`),...Array.from({length:7},(_,i)=>`Step ${i+1}`)]:labels.map((_,i)=>`Step ${i+1}`);
 check(`${stage.code}按既定作用域从Step1编号`,labels.join()===expected.join()&&labels.length===stage.stepCount&&labels.length>5);
}
for(const key of run('Object.keys(DOMAIN_FLOWS).filter(key=>!["system","STR-L0-01","STR-L0-02"].includes(key))')){
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
check('F01删除旧指标分支与M2接入前置',!ids.has('IN-VALUE')&&!ids.has('IN-KIND')&&!next('G-M2').includes('IN-CHECK'));
check('F01按六步连续编号',['IN-CHECK','IN-ING','IN-READ','IN-VERSION','IN-SAVE','IN-DELIVER'].every((id,i)=>nodes.find(n=>n.id===id).panoramaStep===`Step ${i+1}`));
check('F01只通过完成出口交付标准化资料',next('IN-DONE').includes('EV-S')&&nodes.filter(n=>n.module==='F01').every(n=>n.next.every(e=>nodes.find(x=>x.id===e.to).module==='F01'||e.to==='EV-S')));
check('F01重复资料分流与分阶段恢复完整',next('IN-VERSION').includes('IN-DELIVER')&&next('IN-VERSION').includes('IN-DONE')&&next('IN-SAVE-WAIT').includes('IN-SAVE')&&next('IN-SEND-WAIT').includes('IN-DELIVER'));
check('F01节点详情无指标业务残留',nodes.filter(n=>n.module==='F01').every(n=>!/指标|M2|观测|统计口径/.test(JSON.stringify(n))));
check('事件交付同时保留识别及证据用途',next('EV-E').includes('RISK-S')&&next('EV-E').includes('STATE-S'));
check('金融意义由程序判断、准备、校验、计算及整理后统一保存',next('RATE-DECIDE').includes('RATE-PREP')&&next('RATE-DECIDE').includes('EV-P2')&&next('RATE-PREP').includes('RATE-A1')&&next('RATE-A1').includes('RATE-CHECK')&&next('RATE-CHECK').includes('RATE-CALC')&&next('RATE-CALC').includes('RATE-RECORD')&&next('RATE-RECORD').includes('EV-P2')&&next('EV-DELTA-CHECK').includes('EV-P2'));
check('F02七步独立编号，五项AI固定引用', ['EV-A1','EV-A2','EV-A3','EV-A5','RATE-A1','EV-P2','EV-DELIVER'].every((id,i)=>nodes.find(n=>n.id===id).panoramaStep.startsWith(`Step ${i+1}`))&&['AI-01','AI-02','AI-03','AI-04','AI-05'].every(task=>nodes.filter(n=>n.module==='F02'&&n.task===task&&n.taskVersion==='1.0').length===1));
check('F02无事件必须经程序校验，分支编号不与执行子步骤重复',next('EV-CHECK').includes('EV-ZERO')&&!next('EV-A1').includes('EV-ZERO')&&next('EV-ZERO').includes('EV-E')&&nodes.find(n=>n.id==='EV-ZERO').panoramaStep==='Step 1A.1');
for(const [prep,ai,checkId] of [['EV-PREP','EV-A1','EV-CHECK'],['EV-MATCH-PREP','EV-A2','EV-MATCH-CHECK'],['EV-REL-PREP','EV-A3','EV-REL-CHECK'],['EV-DELTA-PREP','EV-A5','EV-DELTA-CHECK'],['RATE-PREP','RATE-A1','RATE-CHECK']]){
 check(ai+'由程序准备并接回检查',nodes.find(n=>n.id===prep).type==='PROGRAM'&&next(prep).includes(ai)&&next(ai).includes(checkId)&&nodes.find(n=>n.id===checkId).type==='CONDITION');
 check(ai+'失败与正常结果分开',next(ai).includes('EV-X')&&next(checkId).includes('EV-X'));
}
check('F02事件身份复核有真实返回线',next('EV-DELTA-CHECK').includes('EV-MATCH-PREP'));
check('F02保存与交付使用程序节点',nodes.find(n=>n.id==='EV-P2').type==='PROGRAM'&&nodes.find(n=>n.id==='EV-DELIVER').type==='PROGRAM');
check('F02节点编号唯一',new Set(nodes.filter(n=>n.module==='F02'&&n.panoramaStep.startsWith('Step ')).map(n=>n.panoramaStep)).size===21);
check('F02保存后按变化交付及单独恢复',next('EV-P2').includes('EV-E')&&next('EV-P2').includes('EV-DELIVER')&&next('EV-SAVEWAIT').includes('EV-P2')&&next('EV-SENDWAIT').includes('EV-DELIVER'));
check('F02合法空关系及M空分不被错误阻断',nodes.find(n=>n.id==='EV-A3').ruleDetail.includes('空关系')&&nodes.find(n=>n.id==='RATE-A1').ruleDetail.includes('M为空'));
for(const n of nodes.filter(n=>n.module==='F02'&&n.type==='AI')){
 const detail=run(`nodeDetail(SYSTEM_PANORAMA.nodes.find(n=>n.id==='${n.id}'))`);
 check(n.id+'保留任务标签、只读配置和可见待定事项',(detail.match(/data-node-task-tab=/g)||[]).length===4&&detail.includes('节点配置与流向')&&(!n.pending||detail.indexOf('待确认：')<detail.indexOf('<details')));
}
const missingF02=JSON.parse(JSON.stringify(nodes.find(n=>n.id==='RATE-A1')));missingF02.taskVersion='missing';
check('F02固定任务缺失禁止回退',run(`nodeDetail(${JSON.stringify(missingF02)})`).includes('引用版本不可用'));
check('正式纳管结果交付观察',next('RISK-E').includes('STATE-S'));
check('当前快照先交历史变化并可供产品引用',next('STATE-E').includes('CHANGE-S')&&next('STATE-E').includes('VIEW-S'));
check('首次及不可比保留待判断分支',next('CHANGE-C').includes('CHANGE-UNKNOWN'));
check('发布条件与恢复未决保留',nodes.find(n=>n.id==='REPORT-CPUB').blocking&&nodes.find(n=>n.id==='RISK-RESTORE').pending);
check('全景包含全部16项AI任务',new Set(nodes.filter(n=>n.task).map(n=>n.task)).size===16);
for(const role of ['系统管理员','授权阅读者']){
 run(`state.role='${role}';render();`);
 check(role+'浏览全景始终只读',!run('editable()')&&element('#page-tools').innerHTML==='');
 click({node:'STATE-A1'});
 check(role+'可查看AI步骤四个标签',element('.node-detail').outerHTML.includes('AI-L2-01')&&(element('.node-detail').outerHTML.match(/data-node-task-tab=/g)||[]).length===4);
}
check('浏览全景不修改策略和AI任务',snapshot===run('JSON.stringify({strategies,tasks})'));
click({view:'catalog'});
click({action:'open',id:'STR-L2-01'});
run("state.role='系统管理员';render();");
check('策略编排仍使用原版本节点',run("flowRecord()===record() && flowRecord().flow.length===19 && editable()"));
check('编排页保留版本、保存和完整性工具',element('#page-tools').innerHTML.includes('id="version"')&&element('#page-tools').innerHTML.includes('data-action="save"')&&element('#page-tools').innerHTML.includes('data-action="validate"'));
if(process.argv[2]){
 const before=readFileSync(path.join(process.argv[2],'原型资源/app.js'),'utf8');
 const after=readFileSync(new URL('原型资源/app.js',sharedRoot),'utf8');
 for(const [name,extract] of [
  ['全部业务写入处理',s=>s.slice(s.indexOf("document.addEventListener('submit'"))],
  ['原完整性校验',s=>s.slice(s.indexOf('function validate()'),s.indexOf('function validationView()'))],
  ['策略与AI任务定义',s=>s.slice(s.indexOf('const taskNames'),s.indexOf('let state='))]
 ])check(name+'与修改前一致',extract(before)===extract(after));
 check('原flow-data.js保持不变',readFileSync(path.join(process.argv[2],'原型资源/flow-data.js'),'utf8')===readFileSync(new URL('原型资源/flow-data.js',sharedRoot),'utf8'));
 const previousPanorama=path.join(process.argv[2],'原型资源/system-panorama.js');
 if(existsSync(previousPanorama)){
  const previous=vm.createContext({});
  vm.runInContext(readFileSync(path.join(process.argv[2],'原型资源/flow-data.js'),'utf8')+'\n'+readFileSync(previousPanorama,'utf8')+'\nthis.graph=SYSTEM_PANORAMA;',previous);
  const businessView=graph=>JSON.stringify({nodes:graph.nodes.map(({module,...node})=>node),stages:graph.stages.map(({modules,...stage})=>stage)});
  check('模块卡片前后全部节点职责、后继和Step编号保持一致',businessView(previous.graph)===businessView(graph));
 }
}
const result={date:'2026-10-23',passed:checks.length,nodes:nodes.length,modules:modules.map(module=>({code:module.code,nodes:module.nodeIds.length,stepRange:module.stepRange})),layers:Array.from(graph.stages,s=>({code:s.code,steps:s.stepCount,nodes:run(`stageNodes(SYSTEM_PANORAMA.stages.find(s=>s.code==='${s.code}')).length`)})),checks};
writeFileSync(new URL('流水线全景验证结果.json',import.meta.url),JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify({passed:result.passed,nodes:result.nodes,layers:result.layers}));
