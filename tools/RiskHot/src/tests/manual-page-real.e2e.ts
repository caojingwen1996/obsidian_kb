import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/\/Google Chrome\.app\//.test(executable))throw new Error('Independent testing browser required');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE!);
const profile=await mkdtemp(join(tmpdir(),'riskhot-manual-page-')),output=resolve('.riskhot/manual-page');await mkdir(output,{recursive:true});
let browser:any;const checks:string[]=[],errors:string[]=[];
try{
 browser=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,viewport:{width:1440,height:1000}});
 const page=await browser.newPage(),origin=process.env.API_ORIGIN!;page.on('pageerror',(error:Error)=>errors.push(error.message));
 const readActivity=async()=>{const response=await page.request.get(origin+'/api/v1/l0/task-batches?status=active');assert.equal(response.status(),200);return response.json();};
 const before=await readActivity(),task=before.items[0]||before.latest_batch;assert.ok(task,'Requires an existing manual task');
 const response=await page.request.get(origin+'/api/v1/l0/task-batches?trigger=manual');assert.equal(response.status(),200);const history=await response.json();assert.ok(history.items.every((row:any)=>row.trigger==='manual'));
 for(const [hash,ready] of [['#sources','#result-count'],['#intake-tasks','.overview-list'],['#intake-tasks?view=history','.run-list']]){
  await page.goto(origin+'/m1'+hash);await page.locator(ready).waitFor();assert.equal(await page.locator('#task-activity').count(),0);assert.equal(await page.locator('[data-action="start-batch"]').count(),0);
 }
 checks.push('信源目录、执行概览、普通批次历史均无手动状态栏和开启按钮');
 await page.getByRole('link',{name:'手动任务',exact:true}).click();await page.getByRole('heading',{name:'手动采集任务',exact:true}).waitFor();await page.locator('#manual-activity-slot #activity-title').waitFor();assert.equal(await page.locator('#manual-workspace-link').getAttribute('aria-current'),'page');assert.equal(await page.locator('[data-action="start-batch"]').count(),1);checks.push('独立手动任务页面承载最新任务状态及唯一开启入口');
 await page.locator('#task-from').fill('');await page.locator('#task-to').fill('');await page.locator('#task-query').getByRole('button',{name:'查询',exact:true}).click();await page.locator(`[data-batch-detail="${task.id}"]`).waitFor();await page.waitForFunction((count:number)=>document.querySelectorAll('.run-table tbody tr').length===count,history.items.length);assert.equal(await page.locator('.run-table tbody tr').count(),history.items.length);assert.ok(!(await page.locator('.run-table').textContent())?.includes('自动计划'));checks.push('手动批次历史数量与独立筛选接口一致，不混入自动计划');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1050});await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:join(output,`manual-${width}.png`)});}
 await page.setViewportSize({width:1440,height:1050});await page.locator('#task-activity [data-action="view-current-task"]').click();await page.locator('#batch-detail').waitFor();assert.equal(await page.locator('#task-activity').count(),0);await page.getByRole('button',{name:'返回手动任务',exact:true}).click();await page.locator('#manual-activity-slot #activity-title').waitFor();assert.equal(await page.locator('#task-from').inputValue(),'');checks.push('批次详情保留逐份采集信息，返回手动页及原筛选');
 await page.reload();await page.locator('#manual-activity-slot #activity-title').waitFor();assert.equal(new URL(page.url()).hash,'#manual-tasks');checks.push('直接地址与刷新保持独立手动任务页面');
 const after=await readActivity(),same=after.items.find((row:any)=>row.id===task.id)||after.latest_batch;assert.equal(same.id,task.id);assert.equal(same.paused,task.paused);assert.equal(same.version,task.version);assert.equal(same.status,task.status);checks.push('只读验收保持真实手动任务状态、暂停标记和控制版本');
 assert.deepEqual(errors,[]);const result={task_id:task.id,status:task.status,paused:task.paused,manual_history:history.total,checks,viewports:[1440,390,320],errors};await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});}
