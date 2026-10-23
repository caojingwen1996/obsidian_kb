import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const panorama=new URL('../06-1-流水线全景ui设计/流水线全景交互原型.html',root).href;
const m3=new URL('M3策略管理中心交互原型.html',root).href;
const sourceUrl=new URL('../../02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0.md',root);
const source=await readFile(sourceUrl,'utf8');
const headings=[...source.matchAll(/^#### (6\.1\.[1-5] AI-0[1-5] .+ 定义)$/gm)].map(m=>m[1]);
assert.equal(headings.length,5);
const captures=await mkdtemp(join(tmpdir(),'riskhot-definition-references-'));
const profile=await mkdtemp(join(tmpdir(),'riskhot-definition-profile-'));
const browser=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.RISKHOT_TEST_BROWSER,reducedMotion:'reduce'});
const checks=[],errors=[],external=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await browser.route('**/*',route=>{if(route.request().url().startsWith('file:'))return route.continue();external.push(route.request().url());return route.abort();});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(panorama+'#panorama');
  for(const [i,id] of ['EV-A1','EV-A2','EV-A3','EV-A5','RATE-A1'].entries()){
   await page.evaluate(id=>{state.node=id;state.nodeTaskTab='definition';state.panoramaCollapsed=state.panoramaCollapsed.filter(x=>x!=='F02');render();},id);
   const section=page.locator('.node-detail .task-definition-reference');
   const link=section.locator('.task-definition-source');
   check(width+' '+id+'原文章节标题',await link.innerText()==='查看原文：'+headings[i]);
   const fullChapter=source.split('#### '+headings[i]+'\n')[1].split(/^#{1,4} /m)[0].trim();
   const chapter=fullChapter.split('**分析职责与步骤**')[1].split(/^\*\*/m)[0].trim();
   check(width+' '+id+'逐字匹配原文职责与步骤',await page.evaluate(({id,chapter})=>TASK_DEFINITION_REFERENCES[id].body===chapter,{id:'AI-0'+(i+1),chapter}));
   const body=section.locator('.task-definition-body');
   check(width+' '+id+'任务定义不展示输入输出',await body.locator('table').count()===0&&!/输入字段|输出字段|任务编号|触发条件|交付边界|提示词资产草案/.test(await body.innerText()));
   const steps=[...chapter.matchAll(/^\d+\. (.+)$/gm)].map(m=>m[1].replace(/`/g,''));
   check(width+' '+id+'分析职责逐条展示',JSON.stringify(await body.locator('ol li').allTextContents())===JSON.stringify(steps));
   check(width+' '+id+'无未解析双链',!(await body.innerText()).includes('[['));
   const href=await link.evaluate(a=>a.href),url=new URL(href);
   check(width+' '+id+'真实文档路径',fileURLToPath(url)===fileURLToPath(sourceUrl));
   check(width+' '+id+'章节锚点',decodeURIComponent(url.hash.slice(1))===headings[i].toLowerCase().replace(/\./g,'').replace(/ /g,'-'));
   check(width+' '+id+'无手写职责摘要',await page.locator('.node-detail .f01-logic-list').count()===0&&!await section.evaluate(el=>el.textContent.includes('本步骤的分析职责')));
   check(width+' '+id+'节点不手写职责',await page.evaluate(id=>!SYSTEM_PANORAMA.nodes.find(n=>n.id===id).panoramaDetail?.actions,id));
   await link.scrollIntoViewIfNeeded();
   check(width+' '+id+'链接不溢出',await link.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.node-detail').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right;}));
   if(i===0){await page.locator('.node-detail').screenshot({path:join(captures,'AI-01-'+width+'.png')});await body.locator('ol').screenshot({path:join(captures,'AI-01-职责-'+width+'.png')});}
  }
  for(const [i,heading] of headings.entries()){
   await page.goto(m3+'#ai/AI-0'+(i+1)+'/1.0');
   check(width+' AI-0'+(i+1)+' M3与全景章节一致',await page.locator('.task-definition-source').innerText()==='查看原文：'+heading);
  }
 }
 check('无脚本异常',errors.length===0);check('无外部请求',external.length===0);
 console.log(JSON.stringify({passed:checks.length,screenshots:captures},null,2));
}finally{await browser.close();await rm(profile,{recursive:true,force:true});}
