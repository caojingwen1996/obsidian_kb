import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=new URL('../',import.meta.url);
const profile=await mkdtemp(join(tmpdir(),'riskhot-f02-program-profile-'));
const captures=await mkdtemp(join(tmpdir(),'riskhot-f02-program-captures-'));
const executablePath=process.env.RISKHOT_TEST_BROWSER;
assert.ok(executablePath?.includes('Google Chrome for Testing.app/'),'Use isolated Chrome for Testing');
const browser=await chromium.launchPersistentContext(profile,{headless:true,executablePath,reducedMotion:'reduce'});
const checks=[],errors=[],external=[];
const check=(name,result)=>{assert.ok(result,name);checks.push(name);};
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await browser.route('**/*',route=>{if(route.request().url().startsWith('file:'))return route.continue();external.push(route.request().url());return route.abort();});
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1100});
  await page.goto(new URL('流水线全景交互原型.html',root).href+'#panorama');
  if(!await page.locator('[data-flow-module="F02"]').evaluate(el=>el.open))await page.locator('[data-flow-module="F02"] > summary').click();
  const graph=page.locator('.f02-topology');
  check(width+' F02所有26个节点唯一展示',await graph.locator('[data-node]').count()===26);
  check(width+' 五组复合步骤标题',await graph.locator('.f02-step-heading').count()===5);
  check(width+' 程序与AI执行角色可见',await graph.locator('[data-node="RATE-CALC"] .node-type').isVisible()&&await graph.locator('[data-node="RATE-A1"] .node-type').isVisible());
  await page.waitForFunction(()=>document.querySelectorAll('.f02-topology [data-f01-line]').length>0);
  const missing=await page.evaluate(()=>SYSTEM_PANORAMA.nodes.filter(n=>n.module==='F02').flatMap(n=>n.next.filter(e=>SYSTEM_PANORAMA.nodes.find(t=>t.id===e.to).module==='F02'&&!document.querySelector(`.f02-topology [data-f01-line="${n.id}:${e.to}"]`)).map(e=>n.id+':'+e.to)));
  check(width+' 所有模块内路由实际绘制连线',missing.length===0);
  check(width+' 连线路径坐标有效',await graph.locator('svg path').evaluateAll(paths=>paths.every(p=>!/(NaN|undefined)/.test(p.getAttribute('d')))));
  check(width+' 节点与标题无横向溢出',await graph.evaluate(el=>[...el.querySelectorAll('.node,.f02-step-heading')].every(n=>n.scrollWidth<=n.clientWidth+1)));
  for(const id of ['EV-PREP','EV-CHECK','EV-MATCH-PREP','EV-MATCH-CHECK','EV-REL-PREP','EV-REL-CHECK','EV-DELTA-PREP','EV-DELTA-CHECK','RATE-DECIDE','RATE-PREP','RATE-CHECK','RATE-CALC','RATE-RECORD','EV-P2','EV-DELIVER']) {
   await graph.locator(`[data-node="${id}"]`).click();
   const detail=page.locator('.node-detail');
   const isCondition=await page.evaluate(id=>SYSTEM_PANORAMA.nodes.find(n=>n.id===id).type==='CONDITION',id);
   check(width+' '+id+'节点类型与职责一致',(await detail.innerText()).includes(isCondition?'判断依据':'确定性处理'));
   check(width+' '+id+'有具体动作与后继',await detail.locator('.f01-logic-list li').count()>=2&&await detail.locator('.f01-detail-routes [data-select-node]').count()>0);
  }
  await graph.locator('[data-node="RATE-CALC"]').click();
  check(width+' M由程序计算且规则未定允许空分',/确定性加权计算/.test(await page.locator('.node-detail').innerText())&&/空分/.test(await page.locator('.node-detail').innerText()));
  await page.locator('.node-detail').screenshot({path:join(captures,'程序计算详情-'+width+'.png')});
  await graph.locator('[data-node="RATE-A1"]').click();
  check(width+' AI任务定义继续只展示L0职责',await page.locator('.task-definition-body ol li').count()===6&&await page.locator('.task-definition-body table').count()===0);
  await graph.locator('[data-flow-edge="RATE-DECIDE:EV-P2"]').click();
  check(width+' 沿用评级直接定位保存节点',await page.evaluate(()=>state.node==='EV-P2'));
  await graph.locator('[data-flow-edge="EV-DELTA-CHECK:EV-MATCH-PREP"]').click();
  check(width+' 身份复核返回真实召回节点',await page.evaluate(()=>state.node==='EV-MATCH-PREP'));
  await graph.locator('[data-node="RATE-DECIDE"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:join(captures,'Step5流程-'+width+'.png')});
  check(width+' 页面无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 check('无脚本错误',errors.length===0);check('无外部请求',external.length===0);
 const result={date:'2026-10-23',passed:checks.length,screenshots:captures,checks};
 await writeFile(new URL('F02程序与AI协作验证结果.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.passed,screenshots:captures}));
} finally {await browser.close();await rm(profile,{recursive:true,force:true});}
