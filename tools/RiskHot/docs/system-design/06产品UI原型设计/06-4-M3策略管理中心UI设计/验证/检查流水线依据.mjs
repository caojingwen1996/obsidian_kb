import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dir=path.dirname(fileURLToPath(import.meta.url));
const base=path.dirname(dir),root=path.resolve(base,'../../../..');
const source=await readFile(path.join(base,'原型资源/flow-data.js'),'utf8');
const {sources,flows}=vm.runInNewContext(source+'\n({sources:FLOW_SOURCES,flows:DOMAIN_FLOWS})');
const findings=[];
for(const ref of Object.values(sources))await access(path.join(root,ref.path));
for(const [id,flow] of Object.entries(flows)){
 const ids=new Set(flow.nodes.map(n=>n.id));
 assert.equal(ids.size,flow.nodes.length,id+'节点ID唯一');
 assert.equal(flow.nodes.filter(n=>n.type==='START').length,1,id+'唯一入口');
 assert.ok(flow.nodes.some(n=>n.type==='END'),id+'存在业务结束或交接');
 for(const n of flow.nodes){
  assert.ok(sources[n.source]&&n.section&&n.summary&&n.rule&&n.inputDescription&&n.outputDescription,id+'/'+n.id+'有完整来源与职责');
  for(const e of n.next)assert.ok(ids.has(e.to)&&e.label,id+'/'+n.id+'后继有效');
  if(n.type==='AI')assert.ok(n.task&&n.taskVersion,id+'/'+n.id+'固定任务引用');
  for(const dependency of n.requiresAll||[])assert.ok(flow.nodes.find(x=>x.id===dependency)?.next.some(e=>e.to===n.id),id+'/'+n.id+'汇合依赖');
 }
 const reachable=new Set();
 const visit=id=>{if(reachable.has(id))return;reachable.add(id);flow.nodes.find(n=>n.id===id).next.forEach(e=>visit(e.to));};
 visit(flow.nodes.find(n=>n.type==='START').id);
 assert.equal(reachable.size,ids.size,id+'所有节点可达');
 const laidOut=flow.layout.flatMap(part=>typeof part==='string'?[part]:part.lanes.flatMap(l=>l.nodes));
 assert.equal(laidOut.length,ids.size,id+'布局节点数');
 assert.equal(new Set(laidOut).size,ids.size,id+'布局无重复');
 assert.ok(laidOut.every(x=>ids.has(x)),id+'布局只引用真实节点');
 const staged=flow.stages.flatMap(stage=>stage.items.flatMap(part=>typeof part==='string'?[part]:part.lanes.flatMap(l=>l.nodes)));
 assert.equal(staged.length,ids.size,id+'阶段覆盖所有节点');
 assert.equal(new Set(staged).size,ids.size,id+'阶段节点不重复');
 assert.ok(staged.every(x=>ids.has(x)),id+'阶段只引用真实节点');
 for(const stage of flow.stages)assert.ok(!stage.overviewNodes||stage.overviewNodes.every(x=>staged.includes(x)),id+'阶段概览节点存在');
 findings.push({id,nodes:flow.nodes.length,source:sources[flow.source].title,unresolved:flow.nodes.filter(n=>n.pending).map(n=>({id:n.id,reason:n.pending}))});
}
const find=(flow,id)=>flows[flow].nodes.find(n=>n.id===id);
const successors=(flow,id)=>find(flow,id).next.map(e=>e.to);
assert.ok(successors('system','KIND').includes('EVENT')&&successors('system','KIND').includes('VALUE'),'资料与指标分流');
assert.equal(new Set(flows['STR-L0-01'].nodes.filter(n=>n.task).map(n=>n.task)).size,4,'L0事件流程只复用AI-01～04');
assert.ok(successors('STR-L0-01','DELTA').includes('DUP')&&successors('STR-L0-01','DELTA').includes('SOURCE'),'重复与仅来源增加分别处理');
assert.ok(successors('STR-L0-02','C').includes('KEEP'),'评级允许沿用');
assert.ok(successors('STR-L1-01','CRESULT').includes('SEARCH')&&successors('STR-L1-01','SEARCH').includes('A2'),'先候选后检索再匹配');
assert.ok(find('STR-L1-01','ADMIT').blocking&&find('STR-L1-01','RESTORE').pending,'准入和恢复未决保留');
assert.deepEqual(Array.from(successors('STR-L2-01','FORK')).sort(),['A1','A2','A4'],'三类当前分析并行依赖');
assert.deepEqual(Array.from(find('STR-L2-01','A3').requiresAll),['A1','A2'],'力量比较依赖来源和应对');
assert.deepEqual(Array.from(find('STR-L2-01','A5').requiresAll),['A1','A2','A3','A4'],'整体状态汇总四项');
assert.ok(successors('STR-L2-02','C').includes('UNKNOWN'),'首次不可比转待判断');
assert.deepEqual(Array.from(find('STR-L2-02','A3').requiresAll),['A1','A2'],'减弱节点依赖方向和持续性');
assert.ok(find('STR-L3-01','CPUB').blocking&&find('STR-L3-01','WITHDRAW').pending,'发布及撤回条件不伪造定稿');
assert.ok(flows.system.nodes.filter(n=>n.module).every(n=>n.type==='MODULE'||n.module==='F01'),'系统模块与内部执行主体区分');
const result={date:'2026-10-15',blueprints:findings.length,nodes:findings.reduce((a,b)=>a+b.nodes,0),sourceFiles:Object.values(sources).map(s=>s.path),findings,errors:[]};
await writeFile(path.join(dir,'流水线依据检查结果.json'),JSON.stringify(result,null,2),'utf8');
console.log(JSON.stringify({blueprints:result.blueprints,nodes:result.nodes,sourceFiles:result.sourceFiles.length,errors:[]}));
