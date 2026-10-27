import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const evidence=JSON.parse(await readFile('.riskhot/information-handoff/real-verification.json','utf8'));
assert.equal(evidence.verified,true);
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'',modulePath=process.env.PLAYWRIGHT_MODULE;
assert.match(executable,/Chrome for Testing|Chromium/);assert.doesNotMatch(executable,/\/Google Chrome\.app\//);assert.ok(modulePath);
const {chromium}=await import(modulePath),profile=await mkdtemp(join(tmpdir(),'riskhot-real-handoff-'));
const output=resolve('.riskhot/information-handoff/real-page');await mkdir(output,{recursive:true});
const origin=process.env.API_ORIGIN!;assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
const context=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,viewport:{width:1440,height:1050}});
const errors:string[]=[];
try{
  const page=context.pages()[0]??await context.newPage();page.on('pageerror',(error:Error)=>errors.push(error.message));
  await page.goto(`${origin}/m1#intake-tasks`);
  await page.locator('#connection-state').filter({hasText:'已连接'}).waitFor();
  await page.locator('#task-search').fill(evidence.operation_id);
  await page.locator('#task-query').getByRole('button',{name:'查询',exact:true}).click();
  const row=page.locator(`[data-batch-detail="${evidence.operation_id}"]`);await row.waitFor();await row.click();
  const source=page.locator('.source-result').first();await source.locator('summary').first().click();
  await source.locator(`[data-delivery="${evidence.items[0].version_id}"]`).click();
  await page.getByRole('heading',{name:'资料交付与结果文件',exact:true}).waitFor();
  assert.match(await page.locator('.delivery-result').textContent(),/F02 已接收/);
  assert.match(await page.locator('.delivery-result').textContent(),new RegExp(`${evidence.items[0].candidate_count} 条候选`));
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'下载候选结果',exact:true}).click();
  const file=JSON.parse(await readFile(await(await download).path(),'utf8'));
  assert.equal(file.processing_id,evidence.items[0].processing_id);assert.equal(file.candidate_count,evidence.items[0].candidate_count);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1050});assert.ok(await page.locator('#modal').evaluate((element:HTMLElement)=>element.scrollWidth<=element.clientWidth+1));await page.screenshot({path:join(output,`real-handoff-${width}.png`)});}
  assert.deepEqual(errors,[]);await writeFile(join(output,'result.json'),JSON.stringify({verified:true,operation_id:evidence.operation_id,version_id:file.version_id,processing_id:file.processing_id,candidate_count:file.candidate_count,page_errors:errors,scope:'只读真实任务与下载；未开启任务或改变状态'},null,2));
  console.log(JSON.stringify({real_page_verified:true,operation_id:evidence.operation_id,candidate_count:file.candidate_count,output}));
}finally{await context.close();await rm(profile,{recursive:true,force:true});}
