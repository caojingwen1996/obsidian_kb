import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const dir=dirname(fileURLToPath(import.meta.url));
const root=new URL('../',import.meta.url), shared=new URL('../../06-4-M3策略管理中心UI设计/原型资源/',import.meta.url);
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const data=await readFile(new URL('flow-data.js',shared),'utf8');
async function graph(source){const c=vm.createContext({});vm.runInContext(data+'\n'+source+'\nthis.graph=SYSTEM_PANORAMA;',c);return JSON.parse(JSON.stringify(c.graph));}
const current=await graph(await readFile(new URL('原型资源/system-panorama.js',root),'utf8'));
// The optional baseline is a working-copy snapshot, so user changes are protected too.
if(process.env.RISK_HOT_PIPELINE_BASELINE){
 const before=await graph(await readFile(process.env.RISK_HOT_PIPELINE_BASELINE,'utf8'));
 const business=nodes=>nodes.map(n=>Object.fromEntries(Object.entries(n).filter(([key])=>!key.startsWith('panorama'))));
 assert.deepEqual(business(current.nodes.filter(n=>n.module!=='F02')),business(before.nodes.filter(n=>n.module!=='F02')));
 assert.deepEqual(current.nodes.filter(n=>n.module==='F01'),before.nodes.filter(n=>n.module==='F01'));
 checks.push('F01完整保留，F03～F08和横向治理业务保持');
}
const node=id=>current.nodes.find(n=>n.id===id);
const f01Steps=['IN-CHECK','IN-ING','IN-READ','IN-VERSION','IN-SAVE','IN-DELIVER'];
check('F01六步连续且内容来自V2.1',f01Steps.every((id,i)=>node(id).panoramaStep===`Step ${i+1}`&&node(id).source==='F01'));
check('F01旧指标分支已移除',!node('IN-VALUE')&&!node('IN-KIND')&&!node('G-M2').next.some(e=>e.to==='IN-CHECK'));
check('起终点不占Step',current.nodes.filter(n=>['START','END','SUPPORT'].includes(n.panoramaKind)).every(n=>!n.panoramaStep.startsWith('Step ')));
check('每个业务动作有合法主线或分支编号',current.nodes.filter(n=>['STEP','DECISION'].includes(n.panoramaKind)).every(n=>/^Step \d+(?:[A-Z]?\.\d+)?$/.test(n.panoramaStep)));
check('明确保存识别记录的结果保留实际业务动作',node('RISK-NONE').panoramaKind==='STEP');
for(const stage of current.stages.filter(s=>s.kind==='business')){
 const ids=stage.items.flatMap(i=>typeof i==='string'?[i]:i.lanes.flatMap(l=>l.nodes));
 const labels=ids.map(id=>node(id)).filter(n=>n.panoramaStep.startsWith('Step ')).map(n=>(n.module==='F02'?'F02':stage.code)+':'+n.panoramaStep);
 check(stage.code+'作用域内动作编号不重复',new Set(labels).size===labels.length);
 check(stage.code+'动作总数只统计真实业务动作',labels.length===stage.actionCount);
 check(stage.code+'每条路径有名称及分支依据',stage.items.filter(i=>typeof i!=='string').every(i=>i.lanes.every(l=>l.path&&l.basis)));
 check(stage.code+'路径容器无Step',stage.sections.every(s=>s.steps.filter(step=>typeof step.item!=='string').every(step=>step.label==='')));
}
const executablePath=process.env.RISK_HOT_TEST_BROWSER;
if(!executablePath||!/Chrome for Testing|Chromium/.test(executablePath))throw new Error('RISK_HOT_TEST_BROWSER must name isolated Chrome for Testing / Chromium.');
const profile=await mkdtemp(join(tmpdir(),'riskhot-node-visual-'));
const captures=join(dir,'节点视觉编号截图');await mkdir(captures,{recursive:true});
const errors=[],external=[];let browser;
try{
 browser=await chromium.launchPersistentContext(profile,{executablePath,headless:true,reducedMotion:'reduce'});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 const url=new URL('流水线全景交互原型.html',root).href;
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto(url);
  await expect(page.locator('[data-flow-layer][open]')).toHaveCount(4);
  await expect(page.locator('[data-flow-module][open]')).toHaveCount(0);
  check(width+'初始四层展开且八模块收起',true);
  await expect(page.locator('.flow-heading')).toHaveText('流水线全景');
  await expect(page.locator('.panorama-state,.cross-layer,.flow-heading p')).toHaveCount(0);
  check(width+'标题简洁且移除截图中的重复说明区',true);
  const heights=await page.locator('.module-card-head').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
  check(width+'模块收起高度48px',heights.every(h=>h===48));
  check(width+'页面无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const controls=await page.locator('.stage-nav button,.stage-head-primary,.module-card-head').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
  check(width+'层级导航及折叠触达至少44px',controls.every(h=>h>=44));
  const font=await page.locator('.stage-title').first().evaluate(el=>getComputedStyle(el).fontSize);
  check(width+'业务层标题16px',font==='16px');
  if([1440,390].includes(width))await page.screenshot({path:join(captures,`全景-${width}.png`),fullPage:true});
  await page.locator('[data-flow-module=F01] > summary').click();
  await page.locator('[data-flow-module=F01] [data-select-node=EV-S]').click();
  await expect(page.locator('[data-flow-module=F02]')).toHaveAttribute('open');
  await expect(page.locator('[data-node=EV-S]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.node-detail-head h2')).toContainText('L0 / F02 / 起点');
  check(width+'标准化资料交付可定位F02接收环节',true);
  if(width<=760){
   await expect(page.locator('.node-detail')).toBeInViewport();
   await page.locator('[data-action=return-step]').click();
   await expect(page.locator('[data-node=EV-S]')).toBeFocused();
   check(width+'手机详情和返回节点定位可用',true);
  }
  await page.goto(url);
  const summary=page.locator('[data-flow-layer=L0] > summary');
  await summary.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-flow-layer=L0]')).not.toHaveAttribute('open');
  await page.keyboard.press('Space');await expect(page.locator('[data-flow-layer=L0]')).toHaveAttribute('open');
  check(width+'层级折叠支持Enter和Space',true);
  await page.locator('[data-flow-module=F01] > summary').click();
  await expect(page.locator('[data-node=IN-S] .flow-step-index')).toHaveText('起点');
  await expect(page.locator('[data-node=IN-CHECK] .flow-step-index')).toHaveText('Step 1');
  const f01=page.locator('[data-flow-module=F01]');
  await expect(f01.locator('.module-card-title')).toHaveText('信息接入与标准化模块');
  await expect(f01.locator('.module-step-range')).toHaveText('Step 1～6 · 6 个动作');
  for(const n of current.nodes.filter(n=>n.module==='F01')){
   const id=n.id;
   await expect(f01.locator(`[data-node=${id}] .node-title`)).toHaveText(`${n.panoramaStep} · ${n.name}`);
   await f01.locator(`[data-node=${id}]`).click();
   const panel=page.locator('.f01-node-detail');
   await expect(panel).toHaveAttribute('data-detail-type',n.type);
   await expect(panel.locator('h2')).toHaveCount(1);
   await expect(panel.locator('h2')).toHaveText(`L0 / F01 / ${n.panoramaStep} · ${n.name}`);
   const detail=await panel.innerText();
   check(width+' '+id+'详情无旧指标信息',!/指标|M2|观测/.test(detail));
   await expect(panel.locator('.f01-definition-note')).toHaveText('流程定义 · 只读');
   await expect(panel.locator('.f01-detail-role svg')).toHaveCount(1);
   await expect(panel.locator('form,input,select,textarea,[type=submit]')).toHaveCount(0);
   await expect(panel.locator('.f01-detail-evidence')).not.toHaveAttribute('open');
   await expect(panel.locator('.f01-detail-config')).not.toHaveAttribute('open');
   await expect(panel.locator('.f01-detail-route')).toHaveCount(n.next.length);
   for(const edge of n.next){
    await expect(panel.locator(`.f01-detail-route [data-select-node="${edge.to}"]`)).toHaveCount(1);
    await expect(panel.locator('.f01-route-condition').filter({hasText:edge.label})).toHaveCount(1);
   }
   if(n.type==='CONDITION'){
    await expect(panel.locator('.f01-logic-question')).toHaveText(n.panoramaDetail.question);
    await expect(panel.locator('.f01-logic-list li')).toHaveCount(n.panoramaDetail.basis.length);
   }else if(n.type==='END'){
    await expect(panel.locator('.f01-result-type')).toHaveText(n.panoramaDetail.resultType);
    await expect(panel.locator('.f01-result-type')).toHaveClass(new RegExp(n.panoramaDetail.resultTone));
    if(n.panoramaDetail.recovery)await expect(panel).toContainText(n.panoramaDetail.recovery);
   }else await expect(panel.locator('.f01-logic-list li')).toHaveCount(n.panoramaDetail.actions.length);
   check(width+' '+id+'类型内容、真实出口、折叠及只读配置完整',true);
   if([1440,390].includes(width)&&['IN-S','IN-ING','IN-CHECK','IN-VERSION','IN-DONE','IN-SAVE-WAIT'].includes(id))await panel.screenshot({path:join(captures,`F01-详情-${id}-${width}.png`),style:'.f01-node-detail { max-height: none !important; overflow: visible !important; } .stage-nav, .support-nav { visibility: hidden !important; }'});
   const source=panel.locator('a').filter({hasText:'F01 信息接入与标准化模块功能设计 V2.1'});
   await expect(source).toHaveCount(1);
   await readFile(fileURLToPath(await source.evaluate(a=>a.href)),'utf8');
   await panel.locator('.f01-detail-evidence summary').focus();await page.keyboard.press('Enter');
   await expect(source).toBeVisible();
   await panel.locator('.f01-detail-config summary').focus();await page.keyboard.press('Space');
   await expect(panel.locator('.f01-detail-config')).toHaveAttribute('open');
   await expect(panel.locator('.f01-detail-config')).toContainText(n.id);
   check(width+' '+id+'依据与配置可键盘展开且无溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await f01.locator('[data-node=IN-CHECK]').click();
  await page.locator('.f01-detail-route [data-select-node=IN-ING]').click();
  await expect(page.locator('.f01-node-detail h2')).toContainText('Step 2');
  await expect(f01.locator('[data-node=IN-ING]')).toBeFocused();
  check(width+'F01详情后继定位且保留画布展开',await f01.evaluate(el=>el.open));
  for(const n of current.nodes.filter(n=>n.module==='F01')){
   await expect(f01.locator(`[data-node="${n.id}"]`)).toHaveCount(1);
   for(const e of n.next)await expect(f01.locator(`[data-flow-edge="${n.id}:${e.to}"]`)).toHaveCount(1);
  }
  check(width+'F01每个节点与每条真实关系只展示一次',true);
  await expect(f01.locator('.node-caption,.input-fork,.f01-path-label,.panorama-section-head')).toHaveCount(0);
  check(width+'F01无指标分支、旧3B.1或M2入口',!/指标|M2|3B\.1/.test(await f01.innerText())&&await f01.locator('[data-select-node=STATE-S]').count()===0);
  for(const [from,to] of [['IN-VERSION','IN-DELIVER'],['IN-VERSION','IN-DONE'],['IN-SAVE','IN-SAVE-WAIT'],['IN-SAVE-WAIT','IN-SAVE'],['IN-DELIVER','IN-SEND-WAIT'],['IN-SEND-WAIT','IN-DELIVER']]){
   await f01.locator(`[data-flow-edge="${from}:${to}"]`).click();
   await expect(page.locator(`[data-node="${to}"]`)).toHaveAttribute('aria-pressed','true');
  }
  check(width+'重复复用、保存恢复和交付恢复均可定位',true);
  const positions=await f01.locator('.f01-topology > .f01-step').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));
  check(width+'六步主线按顺序纵向排列',positions.every((top,i)=>i===0||top>positions[i-1]));
  const sideways=await f01.locator('.f01-branch').evaluateAll(els=>els.every(el=>{
   const origin=document.querySelector(`[data-node="${el.dataset.f01From}"]`).getBoundingClientRect();
   return el.getBoundingClientRect().left>origin.right;
  }));
  check(width+'所有条件出口位于所属主线节点右侧',sideways);
  await expect(f01.locator('.f01-recovery')).toHaveCount(0);
  check(width+'异常节点置于分支内且无底部串行恢复区',await f01.locator('.f01-branch [data-node=IN-HOLD],.f01-branch [data-node=IN-SAVE-WAIT],.f01-branch [data-node=IN-SEND-WAIT]').count()===3);
  const wireCount=current.nodes.filter(n=>n.module==='F01').reduce((sum,n)=>sum+n.next.filter(e=>node(e.to).module==='F01').length,0)+1;
  await expect(f01.locator('[data-f01-line]')).toHaveCount(wireCount);
  check(width+'主线与条件出口均有实际箭头',true);
  check(width+'F01内部无转至占位且仅保留跨模块入口',!(await f01.innerText()).includes('转至')&&await f01.locator('.f01-reference').count()===1&&await f01.locator('.f01-reference[data-select-node=EV-S]').count()===1);
  const connections=await f01.locator('[data-f01-line]').evaluateAll(groups=>{
   const diagram=document.querySelector('.f01-topology'),base=diagram.getBoundingClientRect();
   const box=el=>{const r=el.getBoundingClientRect();return {id:el.dataset.node,l:r.left-base.left,r:r.right-base.left,t:r.top-base.top,b:r.bottom-base.top};};
   const nodes=[...diagram.querySelectorAll('[data-node]')].map(box);
   return groups.filter(g=>!g.dataset.f01Line.endsWith(':EV-S')).map(g=>{
    const [from,to]=g.dataset.f01Line.split(':'),path=g.querySelector('path'),end=path.getPointAtLength(path.getTotalLength()),target=nodes.find(n=>n.id===to);
    const onEdge=(Math.min(Math.abs(end.x-target.l),Math.abs(end.x-target.r))<1&&end.y>=target.t-1&&end.y<=target.b+1)||(Math.min(Math.abs(end.y-target.t),Math.abs(end.y-target.b))<1&&end.x>=target.l-1&&end.x<=target.r+1);
    let crossing=false;
    for(let d=1;d<path.getTotalLength()-1;d+=3){
     const point=path.getPointAtLength(d);
     if(nodes.some(n=>n.id!==from&&n.id!==to&&point.x>n.l+1&&point.x<n.r-1&&point.y>n.t+1&&point.y<n.b-1)){crossing=true;break;}
    }
    return {edge:g.dataset.f01Line,onEdge,crossing};
   });
  });
  check(width+'所有模块内箭头直接落在真实目标节点边缘',connections.every(c=>c.onEdge));
  check(width+'连线不穿过其他实体节点',connections.every(c=>!c.crossing));

  for(const [from,to] of [['IN-SAVE-WAIT','IN-SAVE'],['IN-SEND-WAIT','IN-DELIVER']]){
   await expect(f01.locator(`[data-f01-line="${from}:${to}"]`)).toHaveClass('f01-recovery-line');
   const aligned=await f01.locator(`[data-f01-line="${from}:${to}"] > path`).first().evaluate((path,to)=>{
    const tip=path.getPointAtLength(path.getTotalLength()),base=path.closest('svg').getBoundingClientRect();
    const dest=document.querySelector(`[data-node="${to}"]`).getBoundingClientRect();
    return Math.abs(base.left+tip.x-dest.left)<1&&Math.abs(base.top+tip.y-dest.top-dest.height/2)<1;
   },to);
   check(width+from+'虚线回连到原步骤',aligned);
  }
  await f01.locator('[data-flow-edge="IN-VERSION:IN-DELIVER"]').focus();await page.keyboard.press('Enter');
  await expect(f01.locator('[data-node=IN-DELIVER]')).toHaveAttribute('aria-pressed','true');
  check(width+'侧向条件引用支持键盘定位',true);
  if(width===1440){
   for(const resizedWidth of [1280,1440]){
    await page.setViewportSize({width:resizedWidth,height:1000});
    await expect.poll(()=>f01.locator('[data-f01-line="IN-SAVE-WAIT:IN-SAVE"] > path').first().evaluate(path=>{
     if(!path.isConnected||!path.ownerSVGElement)return false;
     const tip=path.getPointAtLength(path.getTotalLength()),base=path.closest('svg').getBoundingClientRect();
     const dest=document.querySelector('[data-node=IN-SAVE]').getBoundingClientRect();
     return Math.abs(base.left+tip.x-dest.left)<1&&Math.abs(base.top+tip.y-dest.top-dest.height/2)<1;
    })).toBe(true);
   }
   check('展开状态缩放后恢复箭头仍准确回连',true);
  }
  check(width+'F01展开后无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await expect(f01.locator('xpath=following-sibling::*[1][contains(@class,"module-connector")]')).not.toBeVisible();
  if([1440,390].includes(width)){
   await page.goto(url);await page.locator('[data-flow-module=F01] > summary').click();
   await page.locator('[data-node=IN-VERSION]').click();
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:join(captures,`F01-${width}.png`),fullPage:true});
   await page.locator('[data-flow-module=F01]').screenshot({path:join(captures,`F01-流程-${width}.png`),style:'.stage-nav, .support-nav { visibility: hidden !important; }'});
  }
  const infoConcept=page.locator('[data-module-concepts=F01]');
  await expect(infoConcept).not.toHaveAttribute('open');
  await infoConcept.locator('summary').click();
  await expect(infoConcept).toHaveAttribute('open');
  await expect(infoConcept.locator('dt')).toHaveText('资料 Information');
  await expect(infoConcept).toContainText('以原件为依据保存的内容单元');
  await expect(infoConcept).toContainText('不同来源分别保存');
  const infoSource=infoConcept.locator('.concept-source');
  await expect(infoSource).toContainText('F01 信息接入与标准化模块功能设计 V2.1');
  await readFile(fileURLToPath(await infoSource.evaluate(a=>a.href)),'utf8');
  check(width+'F01资料定义默认收起、点击可读且来源有效',true);
  check(width+'F01概念展开无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if([1440,390].includes(width))await infoConcept.screenshot({path:join(captures,`F01-资料概念-${width}.png`),style:'.stage-nav, .support-nav { visibility: hidden !important; }'});
  await infoConcept.locator('summary').focus();await page.keyboard.press('Space');
  await expect(infoConcept).not.toHaveAttribute('open');
  await page.keyboard.press('Enter');await expect(infoConcept).toHaveAttribute('open');
  await page.keyboard.press('Space');await expect(infoConcept).not.toHaveAttribute('open');
  await expect(page.locator('[data-flow-module=F01]')).toHaveAttribute('open');
  check(width+'F01概念键盘展开收起且保留模块展开',true);
  const f02=page.locator('[data-flow-module=F02]');
  await f02.locator(':scope > summary').click();
  const concepts=f02.locator('[data-module-concepts=F02]');
  await expect(concepts).not.toHaveAttribute('open');
  await concepts.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(concepts).toHaveAttribute('open');
  await expect(concepts.locator('dt')).toHaveText(['事件 Event','事件更新 EventUpdate','观测主体 Target','变量 Variable']);
  await expect(concepts).toContainText('同一核心行为的多篇报道归为同一事件');
  await expect(concepts).toContainText('仅增加来源且无实质变化时，增加来源关联');
  const source=concepts.locator('.concept-source');
  await readFile(fileURLToPath(await source.evaluate(a=>a.href)),'utf8');
  check(width+'F02四项概念按需展开、键盘可用且来源文件有效',true);
  check(width+'概念展开无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if([1440,390].includes(width))await concepts.screenshot({path:join(captures,`F02-概念-${width}.png`),style:'.stage-nav, .support-nav { visibility: hidden !important; }'});
  await concepts.locator('summary').focus();await page.keyboard.press('Space');
  await expect(concepts).not.toHaveAttribute('open');
  await expect(f02).toHaveAttribute('open');
  check(width+'概念收起保持模块和流程展开',true);
  const f02Nodes=current.nodes.filter(n=>n.module==='F02');
  await expect(f02.locator('.module-step-range')).toHaveText('Step 1～7 · 8 个动作');
  await expect(f02.locator('.f01-reference')).toHaveCount(2);
  check(width+'F02无内部转至占位，仅跨模块交付入口',!(await f02.innerText()).includes('转至'));
  for(const n of f02Nodes){
   await expect(f02.locator(`[data-node="${n.id}"]`)).toHaveCount(1);
   for(const edge of n.next)await expect(f02.locator(`[data-flow-edge="${n.id}:${edge.to}"]`)).toHaveCount(1);
   await f02.locator(`[data-node="${n.id}"]`).click();
   const panel=page.locator('.f01-node-detail');
   await expect(panel.locator('h2')).toHaveCount(1);
   await expect(panel.locator('h2')).toHaveText(`L0 / F02 / ${n.panoramaStep} · ${n.name}`);
   await expect(panel.locator('form,input,select,textarea,[type=submit]')).toHaveCount(0);
   await expect(panel.locator('.node-config')).not.toHaveAttribute('open');
   if(n.type==='AI'){
    await expect(panel.locator('[data-node-task-tab]')).toHaveCount(5);
    await expect(panel.locator('.embedded-task-head')).toContainText(n.task+' @'+n.taskVersion);
    if(n.pending)await expect(panel.locator('.callout').filter({hasText:'待确认：'})).toBeVisible();
    for(const tab of await panel.locator('[data-node-task-tab]').evaluateAll(buttons=>buttons.map(button=>button.dataset.nodeTaskTab))){
     const button=panel.locator(`[data-node-task-tab="${tab}"]`);
     await button.click();await expect(button).toHaveAttribute('aria-selected','true');
     if(tab==='schema')await expect(panel.locator('#node-task-content')).toContainText(n.outputDescription);
    }
    await panel.locator('[data-node-task-tab=definition]').click();
    await panel.locator('.node-config summary').focus();await page.keyboard.press('Enter');
   }else{
    await expect(panel.locator('.f01-detail-evidence')).not.toHaveAttribute('open');
    if(n.type==='END')await expect(panel.locator('.f01-result-type')).toHaveText(n.panoramaDetail.resultType);
    if(n.type==='CONDITION')await expect(panel.locator('.f01-logic-question')).toHaveText(n.panoramaDetail.question);
    await panel.locator('.f01-detail-evidence summary').focus();await page.keyboard.press('Enter');
   }
   const source=panel.locator('a').filter({hasText:'F02 事件管理模块功能设计 V1.0'});
   await expect(source).toBeVisible();await readFile(fileURLToPath(await source.evaluate(a=>a.href)),'utf8');
   await expect(panel.locator('.f01-detail-route')).toHaveCount(n.next.length);
   for(const edge of n.next)await expect(panel.locator(`.f01-detail-route [data-select-node="${edge.to}"]`)).toHaveCount(1);
   check(width+' '+n.id+'类型详情、来源、固定引用与实际后继完整且只读',true);
   if([1440,390].includes(width)&&['EV-A1','RATE-A1','EV-P2','EV-X'].includes(n.id)){
    const openDetails=panel.locator('details[open] > summary');
    while(await openDetails.count())await openDetails.first().click();
    await panel.focus();
    await panel.screenshot({path:join(captures,`F02-详情-${n.id}-${width}.png`),style:'.node-detail { max-height: none !important; overflow: visible !important; } .stage-nav, .support-nav { visibility: hidden !important; }'});
   }
  }
  const f02Lines=await f02.locator('[data-f01-line]').evaluateAll(groups=>{
   const diagram=document.querySelector('[data-pipeline-module=F02]'),base=diagram.getBoundingClientRect();
   const boxes=[...diagram.querySelectorAll('[data-node]')].map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.node,l:r.left-base.left,r:r.right-base.left,t:r.top-base.top,b:r.bottom-base.top};});
   return groups.filter(g=>!g.dataset.f01Line.endsWith(':RISK-S')&&!g.dataset.f01Line.endsWith(':STATE-S')).map(g=>{
    const [from,to]=g.dataset.f01Line.split(':'),path=g.querySelector('path'),end=path.getPointAtLength(path.getTotalLength()),target=boxes.find(n=>n.id===to);
    const onEdge=(Math.min(Math.abs(end.x-target.l),Math.abs(end.x-target.r))<1&&end.y>=target.t-1&&end.y<=target.b+1)||(Math.min(Math.abs(end.y-target.t),Math.abs(end.y-target.b))<1&&end.x>=target.l-1&&end.x<=target.r+1);
    let crosses=false;for(let d=1;d<path.getTotalLength()-1;d+=3){const p=path.getPointAtLength(d);if(boxes.some(n=>n.id!==from&&n.id!==to&&p.x>n.l+1&&p.x<n.r-1&&p.y>n.t+1&&p.y<n.b-1)){crosses=true;break;}}
    return {key:g.dataset.f01Line,onEdge,crosses};
   });
  });
  check(width+'F02所有内部连线直达真实节点且不穿其他节点',f02Lines.length===f02Nodes.reduce((sum,n)=>sum+n.next.filter(e=>node(e.to).module==='F02').length,0)&&f02Lines.every(line=>line.onEdge&&!line.crosses));
  for(const [from,to] of [['EV-A5','EV-P2'],['EV-SAVEWAIT','EV-P2'],['EV-SENDWAIT','EV-DELIVER'],['EV-ZERO','EV-E']]){
   await f02.locator(`[data-flow-edge="${from}:${to}"]`).click();await expect(f02.locator(`[data-node="${to}"]`)).toHaveAttribute('aria-pressed','true');
  }
  check(width+'F02沿用评级跳步、无事件完成及分阶段恢复定位正确',true);
  await f02.locator('[data-node=EV-A1]').click();
  await expect(page.locator('[data-node-task-tab=definition]')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.node-config')).not.toHaveAttribute('open');
  await page.locator('[data-node-task-tab=definition]').focus();await page.keyboard.press('End');
  await expect(page.locator('[data-node-task-tab]').last()).toHaveAttribute('aria-selected','true');
  check(width+'F02切换AI节点重置标签与配置，键盘标签可用',true);
  check(width+'F02展开详情与全部出口后页面无溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if([1440,390].includes(width))await f02.screenshot({path:join(captures,`F02-七步流程-${width}.png`),style:'.stage-nav, .support-nav { visibility: hidden !important; }'});
  for(const code of ['F02','F03','F04','F05','F06','F07','F08'])await page.locator(`[data-flow-module=${code}]`).evaluate(el=>el.open=true);
  check(width+'全部模块展开后无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(url);
 await page.locator('[data-stage-target=flow-stage-3]').click();
 await expect(page.locator('[data-stage-target=flow-stage-3]')).toHaveAttribute('aria-current','location');
 check('顶部导航定位目标业务层',true);
 await page.evaluate(()=>scrollTo(0,0));
 await expect(page.locator('[data-stage-target=flow-stage-0]')).toHaveAttribute('aria-current','location');
 check('手动滚动同步当前阅读层',true);
 for(const code of ['F02','F03','F04','F05','F06','F07','F08']){
  const module=page.locator(`[data-flow-module=${code}]`);
  await module.locator(':scope > summary').click();
  const ids=current.nodes.filter(n=>n.module===code).map(n=>n.id);
  for(const id of ids){
   await expect(module.locator(`[data-node="${id}"]`)).toHaveCount(1);
   for(const edge of node(id).next)await expect(module.locator(`[data-flow-edge="${id}:${edge.to}"]`)).toHaveCount(1);
  }
  await expect(module.locator('.lane-basis')).toHaveCount(0);
  const exceptions=current.nodes.filter(n=>n.module===code&&n.panoramaBoundary==='待处理出口');
  for(const n of exceptions)await expect(module.locator(`${code==='F02'?'.f01-branch':'.inline-outcome'} [data-node="${n.id}"]`)).toHaveCount(1);
  check(code+'所有节点只出现一次，每条业务关系只展示一次，待处理出口接回判断',true);
  await module.screenshot({path:join(captures,`${code}-1440.png`),style:'.stage-nav, .support-nav { visibility: hidden !important; }'});
  await module.locator(':scope > summary').click();
 }
 check('F07和F08之间无虚假串行连接',await page.locator('[data-flow-layer=L3] .module-connector').count()===0);
 check('M治理区没有串行层间箭头',await page.locator('[data-stage=M] + .layer-delivery').count()===0);
 await page.locator('[data-flow-module=F05] > summary').click();await page.locator('[data-node=STATE-A1]').click();
 await expect(page.locator('[data-node-task-tab]')).toHaveCount(4);
 check('AI固定版本详情四标签保留',true);
 await page.locator('#role').selectOption('授权阅读者');
 await expect(page.locator('.node-detail')).toBeVisible();
 check('授权阅读者节点配置仍为只读',await page.locator('.node-config fieldset:disabled').count()===1);
 await page.goto(new URL('../../06-4-M3策略管理中心UI设计/M3策略管理中心交互原型.html#catalog',import.meta.url).href);
 await page.locator('[data-action=open][data-id=STR-L2-01]').click();
 await expect(page.locator('.flow-layout')).not.toHaveClass(/system-panorama/);
 check('C01策略编排保持原有业务图和编辑入口',await page.locator('[data-action=save]').count()===1);
 check('无页面脚本异常',errors.length===0);check('无外网请求',external.length===0);
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});}
await writeFile(join(dir,'节点视觉编号验证结果.json'),JSON.stringify({date:'2026-10-23',passed:checks.length,checks,errors,external},null,2)+'\n','utf8');
console.log(JSON.stringify({passed:checks.length,errors,external}));
