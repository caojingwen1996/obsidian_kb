import { chromium } from '/Users/cjw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(dir),shots=path.join(dir,'三中心截图');
const modules={M1:'06-2-M1信源管理中心UI设计',M2:'06-3-M2风险源管理中心UI设计',M3:'06-4-M3策略管理中心UI设计'};
const entries={M1:'M1信源管理中心交互原型.html',M2:'M2风险源管理中心交互原型.html',M3:'M3策略管理中心交互原型.html'};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN',colorScheme:'light',reducedMotion:'reduce'});
const errors=[],network=[],captures=[],viewports=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>route.request().url().startsWith('file:')?route.continue():(network.push(route.request().url()),route.abort()));
const load=module=>page.goto(pathToFileURL(path.join(root,modules[module],entries[module])).href);
const click=selector=>page.locator(selector).first().click();
const snap=async(name,modal=false,keepDialogScroll=false)=>{
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const open=page.locator('dialog[open]');
 if(!keepDialogScroll&&await open.count())for(const sel of ['.dialog-body','.r-dialog-body','.r-governance-body'])await open.locator(sel).evaluateAll(items=>items.forEach(el=>el.scrollTop=0));
 await page.screenshot({path:path.join(shots,name+'.png'),fullPage:!modal,animations:'disabled'});captures.push(name+'.png');
};
const fit=async(name,width)=>{
 const size=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
 viewports.push({name,width,...size});assert.ok(size.content<=size.viewport,`${name} ${width}px overall overflow`);
 const open=page.locator('dialog[open]');
 if(await open.count()){
  const box=await open.last().boundingBox();assert.ok(box&&box.x>=-.5&&box.x+box.width<=width+.5,`${name} dialog outside viewport`);
  for(const selector of ['.dialog-body','.r-governance-body','.r-dialog-body']){
   const parts=open.locator(selector);for(let i=0;i<await parts.count();i++)assert.ok(await parts.nth(i).evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${name} ${width}px dialog content overflow`);
  }
 }
};
const m1Source=async()=>{await page.locator('#search').fill('国家统计局');await click('#search-form button[type=submit]');await click('.source-row');};
const m2Candidates=async()=>{await click('[data-view=variables]');await click('[data-action=governance]');};
try{
 await mkdir(shots,{recursive:true});
 await load('M1');await snap('M1-专题目录');
 for(const view of ['all','verify','monitor']){await click(`[data-view=${view}]`);await snap('M1-'+view);}
 await m1Source();await snap('M1-档案');
 for(const tab of ['tech','relations','history']){await click(`[data-tab=${tab}]`);await snap('M1-'+tab);}
 await click('[data-action=edit]');await snap('M1-编辑表单',true);await click('[data-action=close-editor]');
 await click('[data-action=status][data-target=DISABLED]');await snap('M1-停用确认',true);await click('[data-action=close-operation]');
 await load('M1');await click('#create');await snap('M1-新增表单',true);await click('[data-action=close-editor]');
 await click('#preview-toggle');await page.locator('#scene').selectOption('error');await snap('M1-读取失败');
 await load('M2');await snap('M2-风险源');
 await click('[data-detail-tab=history]');await snap('M2-风险源历史');
 await click('[data-view=types]');await snap('M2-风险类型');
 await click('[data-action=new]');await snap('M2-新增定义',true);await click('[data-action=back]');
 await click('[data-view=variables]');await snap('M2-变量定义');
 await click('[data-detail-tab=observations]');await snap('M2-变量观测指标');
 await click('[data-open-indicator=DEMO-I001]');await snap('M2-指标维护',true);await click('[data-action=close-indicator]');
 await m2Candidates();await snap('M2-候选列表');
 await click('[data-review-candidate=DEMO-C01]');await snap('M2-候选审核',true);
 await page.locator('#rh-decision').selectOption('new');await page.locator('.r-ai-observations').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await snap('M2-AI观测审核',true,true);await click('[data-action=close-governance]');
 await click('#rh-revisions');await snap('M2-修订记录');
 await load('M2');await page.emulateMedia({colorScheme:'dark'});await snap('M2-暗色目录');await m2Candidates();await click('[data-review-candidate=DEMO-C01]');await snap('M2-暗色审核',true);await page.emulateMedia({colorScheme:'light'});
 await load('M3');await snap('M3-策略目录');await click('[data-action=panorama]');await snap('M3-流水线');
 await click('[data-view=ai]');await snap('M3-AI管理');await click('[data-view=evaluation]');await snap('M3-策略评估');
 for(const width of [1920,1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});
  await load('M1');await fit('M1目录',width);await m1Source();await fit('M1详情',width);
  await click('[data-action=edit]');await fit('M1编辑',width);
  await load('M2');await fit('M2目录',width);await m2Candidates();await fit('M2候选',width);
  await click('[data-review-candidate=DEMO-C01]');await fit('M2审核',width);
  await load('M3');await fit('M3目录',width);await click('[data-action=panorama]');await fit('M3流水线',width);
 }
 await page.setViewportSize({width:390,height:844});
 await load('M1');await snap('M1-手机目录');await m1Source();await snap('M1-手机详情',true);await click('[data-action=edit]');await snap('M1-手机表单',true);
 await load('M2');await snap('M2-手机目录');await m2Candidates();await snap('M2-手机候选');await click('[data-review-candidate=DEMO-C01]');await snap('M2-手机审核',true);await page.locator('.r-ai-observations').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await snap('M2-手机AI观测审核',true,true);
 await load('M3');await snap('M3-手机目录');
 await page.setViewportSize({width:1440,height:1000});await load('M1');
 await click('a[href$="M2风险源管理中心交互原型.html"]');assert.ok(decodeURIComponent(new URL(page.url()).pathname).endsWith(entries.M2));checks.push('M1至M2');
 await click('a[href$="M3策略管理中心交互原型.html"]');assert.ok(decodeURIComponent(new URL(page.url()).pathname).endsWith(entries.M3));checks.push('M2至M3');
 await click('a[href$="M1信源管理中心交互原型.html"]');assert.ok(decodeURIComponent(new URL(page.url()).pathname).endsWith(entries.M1));checks.push('M3至M1');
 for(const module of ['M1','M2','M3']){
  await load(module);const side=page.locator(module==='M2'?'.r-side':'.sidebar');assert.equal(await side.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(25, 61, 51)');assert.equal((await side.boundingBox()).width,216);checks.push(module+'统一导航');
 }
 assert.equal(errors.length,0);assert.equal(network.length,0);
 const result={date:'2026-10-16',viewportChecks:viewports.length,captures,viewports,checks,errors,network};
 await writeFile(path.join(dir,'三中心UI验证结果.json'),JSON.stringify(result,null,2),'utf8');
 console.log(JSON.stringify({viewportChecks:viewports.length,captures:captures.length,checks:checks.length,errors,network}));
}finally{await browser.close();}
