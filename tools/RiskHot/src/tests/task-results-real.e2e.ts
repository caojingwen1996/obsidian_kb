import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/\/Google Chrome\.app\//.test(executable))throw new Error('Independent testing browser required');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE!);
const profile=await mkdtemp(join(tmpdir(),'riskhot-task-results-')),output=resolve('.riskhot/task-results');await mkdir(output,{recursive:true});
let browser:any;const errors:string[]=[];
try{
 browser=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,args:['--no-first-run'],viewport:{width:1440,height:1000}});
 const page=await browser.newPage(),origin=process.env.API_ORIGIN!;page.on('pageerror',(e:Error)=>errors.push(e.message));
 const response=await page.request.get(origin+'/api/v1/l0/task-results');assert.equal(response.status(),200);const counts=await response.json();
 await page.goto(origin+'/m1#intake-tasks?view=history');await page.locator('.cumulative-results > summary').waitFor();await page.locator('.cumulative-results > summary').click();const summary=page.locator('[aria-label="累计处理结果"]');
 await summary.getByText('已接入并保存的资料',{exact:true}).waitFor();
 const values=await summary.locator('dd').allTextContents();assert.equal(values[0],`${counts.saved_versions.toLocaleString('zh-CN')} 份`);assert.equal(values[4],`${counts.facts.toLocaleString('zh-CN')} 条`);assert.equal(values[6],`${counts.events.toLocaleString('zh-CN')} 条`);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await summary.screenshot({path:join(output,`累计结果-${width}.png`)});}
 const batch=page.locator('[data-batch-detail]').first();await batch.waitFor();const id=await batch.getAttribute('data-batch-detail');await batch.click();
 const taskSummary=page.locator('[aria-label="本任务关联结果"]');await taskSummary.getByText('已接入并保存的资料',{exact:true}).waitFor();
 const detail=page.locator('#batch-detail');await detail.getByRole('heading',{name:'任务批次详情',exact:true}).waitFor();
 assert.ok(await detail.locator('.status').count()>=1);assert.equal(await detail.locator('.task-result-counts > div').count(),7);
 const taskResponse=await page.request.get(origin+`/api/v1/l0/task-batches/${id}/results`);assert.equal(taskResponse.status(),200);const task=await taskResponse.json();assert.equal((await taskSummary.locator('dd').allTextContents())[0],`${task.saved_versions.toLocaleString('zh-CN')} 份`);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await detail.screenshot({path:join(output,`本轮任务结果-${width}.png`)});
 }
 await page.getByRole('button',{name:'返回任务批次记录',exact:true}).click();await summary.waitFor();
 await page.route('**/api/v1/l0/task-results',async(route:any)=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARY_UNAVAILABLE'}})}));
 await page.getByRole('button',{name:'刷新状态',exact:true}).click();await summary.getByText('结果统计读取失败，请点击页面“刷新状态”重试。',{exact:true}).waitFor();assert.equal(await summary.locator('dd').count(),0);
 await page.unroute('**/api/v1/l0/task-results');await page.getByRole('button',{name:'刷新状态',exact:true}).click();await summary.getByText('已接入并保存的资料',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);const result={counts,task,viewports:[1440,390,320],read_failure_verified:true,errors};await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});}
