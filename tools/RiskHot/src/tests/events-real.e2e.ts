import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';
const target=JSON.parse(await readFile('.riskhot/f02-events/real-target.json','utf8')) as {processing_id:string};
const executable=process.env.SOURCE_BROWSER_EXECUTABLE??'';
if(!/Chrome for Testing|Chromium/.test(executable)||/\/Google Chrome\.app\//.test(executable))throw new Error('Independent testing browser required');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE!);
const profile=await mkdtemp(join(tmpdir(),'riskhot-real-events-')),output=resolve('.riskhot/f02-events/real-page');await mkdir(output,{recursive:true});
let browser:any;const errors:string[]=[];
try{
 browser=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,args:['--no-first-run'],viewport:{width:1440,height:1000}});
 const page=await browser.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));const origin=process.env.API_ORIGIN!;
 const response=await page.request.get(origin+`/api/v1/l0/event-processings/${target.processing_id}`);assert.equal(response.status(),200);const processing=await response.json();
 const candidate=processing.candidates.find((c:any)=>c.saved_result_refs?.effects?.[0]);assert.ok(candidate,'Real saved event required');const effect=candidate.saved_result_refs.effects[0];
 const snapshot=await (await page.request.get(origin+`/api/v1/l0/events/${effect.event_id}`)).json();
 await page.goto(origin+`/events#candidate=${candidate.id}`);await page.getByRole('heading',{name:'金融意义',exact:true}).waitFor();assert.equal(new URL(page.url()).hash,`#event=${effect.event_id}`);
 assert.equal(await page.getByRole('link',{name:'候选处理',exact:true}).count(),0);
 await page.getByRole('heading',{name:'主体 Subject',exact:true}).waitFor();await page.getByRole('heading',{name:'观测对象 Target',exact:true}).waitFor();
 const related=page.locator('.event-related');assert.equal(await related.locator('[data-fact-id]').count(),snapshot.facts.length);
 for(const fact of snapshot.facts){const item=related.locator(`[data-fact-id="${fact.id}"]`);assert.equal(await item.locator('h4').textContent(),fact.title);}
 await related.getByText('查看候选详情与原文',{exact:true}).first().click();
 const raw=related.getByRole('link',{name:'查看对应版本原文'}).first();await raw.waitFor();assert.equal((await page.request.get(origin+await raw.getAttribute('href'))).status(),200);
 await page.getByRole('heading',{name:'金融意义',exact:true}).click();await page.waitForTimeout(5500);assert.equal(await related.locator('details').first().getAttribute('open'),'');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:join(output,`正式事件关联候选-${width}.png`),fullPage:true});
 }
 const download=await page.request.get(origin+`/api/v1/l0/events/${effect.event_id}/file`);assert.equal(download.status(),200);assert.equal((await download.json()).event.id,effect.event_id);
 await page.goto(origin+`/events#event=${effect.event_id}`);
 const back=page.getByRole('link',{name:'返回事件列表',exact:true});await back.waitFor();await back.focus();await page.keyboard.press('Enter');
 await page.getByRole('heading',{name:'正式事件',exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'#events');
 const listed=await (await page.request.get(origin+'/api/v1/l0/events')).json();assert.ok(listed.items.length>0);
 const entry=listed.items.find((x:any)=>x.id===effect.event_id);assert.ok(entry);assert.ok(entry.sources.length>0);assert.ok(entry.time_version_id);assert.ok(entry.first_collected_at);
 assert.equal(await page.locator(`[data-event-id="${entry.id}"] .timeline-description`).textContent(),snapshot.event.description);
 assert.equal(await page.locator(`[data-event-id="${entry.id}"] .timeline-source`).textContent(),entry.sources[0].name);
 await page.locator(`[data-event-id="${entry.id}"]`).getByText(/时间说明/).click();
 assert.ok((await page.locator(`[data-event-id="${entry.id}"] .timeline-support`).innerText()).includes(entry.published_at_text));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:join(output,`event-timeline-${width}.png`),fullPage:false});
 }
 assert.deepEqual(errors,[]);const result={page_verified:true,timeline_verified:true,list_count:listed.items.length,source_count:entry.sources.length,display_time_basis:entry.display_time_basis,event_id:effect.event_id,fact_count:snapshot.facts.length,viewports:[1440,390,320],errors};await writeFile(join(output,'related-candidates-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});}
