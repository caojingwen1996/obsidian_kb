import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/\/Google Chrome\.app\//.test(executable))throw new Error('Independent testing browser required');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE!);
const profile=await mkdtemp(join(tmpdir(),'riskhot-page-intro-')),output=resolve('.riskhot/page-intro');await mkdir(output,{recursive:true});
let browser:any;const checks:string[]=[],errors:string[]=[];
try{
 browser=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,viewport:{width:1440,height:1000}});
 const page=await browser.newPage(),origin=process.env.API_ORIGIN!;page.on('pageerror',(error:Error)=>errors.push(error.message));
 for(const [hash,ready,name] of [['#intake-tasks','.overview-list','overview'],['#intake-tasks?view=history','.run-list','history'],['#manual-tasks','.run-list','manual'],['#sources?mode=automatic','.plan-list','automatic']]){
  await page.goto(origin+'/m1'+hash);await page.locator(ready).waitFor();
  const heading=page.locator('.run-workspace > h2,.plan-workspace > h2');assert.equal(await heading.count(),1);assert.equal(await heading.getAttribute('class'),'sr-only');assert.equal(await heading.evaluate((node:Element)=>getComputedStyle(node).position),'absolute');
  assert.equal(await page.locator('.run-workspace > .section-heading,.plan-workspace > .section-heading').count(),0);
  assert.doesNotMatch(await page.locator('#content').textContent()||'',/查看信源当前执行情况，或从批次历史追溯|手动开启全部启用信源，在此查看进度|集中管理信源的自动计划/);
  assert.equal(await page.locator('[data-action="start-batch"]').count(),name==='manual'?1:0);
  if(name==='manual')assert.ok(await page.locator('#task-activity .status,#task-activity #activity-title').count());
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:join(output,`${name}-${width}.png`)});}
  checks.push(`${name}：移除重复标题说明及空白版块，保留页面语义、数据和操作`);
 }
 assert.deepEqual(errors,[]);await writeFile(join(output,'result.json'),JSON.stringify({checks,viewports:[1440,390],errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});}
