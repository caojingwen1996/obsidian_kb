import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/\/Google Chrome\.app\//.test(executable))throw new Error('Independent testing browser required');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE!);
const profile=await mkdtemp(join(tmpdir(),'riskhot-navigation-')),output=resolve('.riskhot/m1-navigation');await mkdir(output,{recursive:true});
const origin=process.env.API_ORIGIN!;
let browser:any;const errors:string[]=[],checks:string[]=[];
try{
 browser=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,viewport:{width:1440,height:1000}});
 const page=await browser.newPage();page.on('pageerror',(error:Error)=>errors.push(error.message));
 const ready=()=>page.locator('#connection-state').filter({hasText:'已连接'}).waitFor({state:'attached'});
 await page.goto(origin+'/m1#schedules');await ready();await page.getByRole('heading',{name:'自动接入',exact:true}).waitFor();
 assert.equal(new URL(page.url()).hash,'#sources?mode=automatic');assert.equal(await page.locator('.workspaces a').count(),3);
 assert.deepEqual(await page.locator('.sidebar .nav-label').allTextContents(),['内容','配置']);assert.deepEqual(await page.locator('.sidebar nav a').allTextContents(),['全部','信源管理中心','流水线全景']);
 assert.equal(await page.locator('.sidebar button,.sidebar [aria-expanded]').count(),0);checks.push('旧计划链接归目录自动接入，两工作区及常驻分组正确');
 await page.locator('[data-plan-view="all"]').click();
 const sourcesResponse=await page.request.get(origin+'/api/v1/m1/sources');assert.equal(sourcesResponse.status(),200);const sources=(await sourcesResponse.json()).items;
 assert.equal(await page.locator('.plan-table tbody tr').count(),sources.length);checks.push('全量计划表覆盖真实信源，无逐源配置阅读负担');
 await page.getByRole('link',{name:'信息采集任务',exact:true}).click();await page.locator('.overview-list').waitFor();await page.goBack();await page.getByRole('heading',{name:'自动接入',exact:true}).waitFor();
 await page.route('**/api/v1/l0/monitor',async(route:any)=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARY_UNAVAILABLE'}})}));
 await page.locator('#refresh').click();await page.getByRole('heading',{name:'自动计划读取失败',exact:true}).waitFor();assert.equal(await page.locator('.plan-table').count(),0);
 await page.unroute('**/api/v1/l0/monitor');await page.locator('#refresh').click();await page.locator('.plan-table').waitFor();checks.push('前进后退恢复目录模式，计划读取失败不伪装为空配置');

 await page.locator('#search').fill('中国人民银行');await page.locator('#source-search button[type="submit"]').click();
 const count=await page.locator('.plan-table tbody tr').count();assert.ok(count>0&&count<sources.length);
 await page.getByRole('link',{name:'档案',exact:true}).click();await page.locator('#result-count').waitFor();assert.equal(await page.locator('#search').inputValue(),'中国人民银行');assert.equal(await page.locator('.source-row').count(),count);
 assert.equal(await page.locator('.source-group').count(),0);assert.equal(await page.locator('#source-detail [data-action="start-batch"]').count(),0);checks.push('目录共用搜索、默认平铺，单源详情无全局启动');
 await page.locator('#search').fill('');await page.locator('#source-search button[type="submit"]').click();
 await page.locator('[data-source="wiki-source-001"]').click();await page.getByRole('tab',{name:'接入设置',exact:true}).click();await page.getByRole('heading',{name:'自动接入计划',exact:true}).waitFor();
 checks.push('接入设置显示真实技术条件与同源自动计划');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const [hash,name]of [['#sources','sources'],['#sources?mode=automatic','automatic'],['#intake-tasks','runs']]){
   await page.goto(origin+'/m1'+hash);await ready();
   await page.locator(name==='sources'?'#source-list':name==='automatic'?'.plan-table':'.run-list').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} overflow ${width}`);
   assert.equal(await page.locator('.sidebar nav a[href="/events#events"]').isVisible(),true);
   assert.equal(await page.locator('.sidebar nav a[href="/m1#sources"]').isVisible(),true);
   await page.screenshot({path:join(output,`${name}-${width}.png`)});
  }
 }
 checks.push('1440/390/320三视图无横向溢出，两个跨页入口始终可达');
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/m1#schedules');await ready();
 const latest=page.locator('[data-locate-run]').first();await latest.waitFor();const id=await latest.getAttribute('data-locate-run'),source=await latest.getAttribute('data-run-source');await latest.click();
 await page.locator('#batch-detail-title').waitFor();await page.locator('.collection-record-table,.collection-source-notes').first().waitFor();assert.ok(new URL(page.url()).hash.startsWith('#intake-task='));
 const detail=page.locator('.collection-record-table [data-operation]').first();
 if(await detail.count()){
  await detail.click();await page.getByRole('heading',{name:'资料与候选',exact:true}).waitFor();await page.locator('.reader-content').waitFor();
  await page.getByRole('button',{name:'候选抽取',exact:true}).click();assert.equal(await page.locator('[data-reader-tab="candidates"]').getAttribute('aria-current'),'page');
  await page.screenshot({path:join(output,'reader-1440.png')});await page.locator('#modal').getByRole('button',{name:'关闭',exact:true}).last().click();
  assert.equal(await detail.evaluate((el:Element)=>el===document.activeElement),true);
  checks.push('计划最近执行定位、正文候选同层切换、关闭恢复焦点');
 }else checks.push('尚无采集任务的计划执行保留，未伪造资料入口');
 await page.getByRole('link',{name:'全部',exact:true}).click();await page.locator('#event-content .event-timeline,#event-content .event-list,#event-content .empty').first().waitFor();
 assert.equal(await page.locator('.sidebar a[aria-current="page"]').textContent(),'全部');await page.screenshot({path:join(output,'events-1440.png')});checks.push('全部进入真实事件列表，侧栏一致');
 await page.goto(origin+'/m1#intake-tasks?view=history');await ready();
 const statistics=page.locator('[data-batch-detail]').first();await statistics.waitFor();await statistics.click();await page.locator('#batch-detail .task-result-counts').waitFor();
 assert.equal(await page.locator('#batch-detail .task-result-counts > div').count(),7);assert.ok(await page.locator('#batch-detail [data-collection-record],#batch-detail [data-task-source]').count()>=1);checks.push('真实任务详情中的七项统计与信源采集信息可读');
 assert.deepEqual(errors,[]);await writeFile(join(output,'result.json'),JSON.stringify({checked_at:new Date().toISOString(),source_count:sources.length,checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});}
