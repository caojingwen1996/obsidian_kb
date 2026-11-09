import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
assert.ok(executablePath&&!executablePath.includes('/Google Chrome.app/'));
const output=new URL('../.impeccable/review/drawdown-statistics/',import.meta.url);
await mkdir(output,{recursive:true});
const {countAnnualDrawdownEvents}=await import('../src/app.mjs');
const raw=JSON.parse(await readFile(new URL('../data/市场总览/nasdaq100-daily-cache.json',import.meta.url),'utf8'));
const rows=[...new Set(raw.daily.map(p=>Number(p.date.slice(0,4))))].map(year=>{
 const daily=raw.daily.filter(p=>p.date.startsWith(`${year}-`));
 let peak=0,maxDrawdown=0;for(const p of daily){peak=Math.max(peak,p.close);maxDrawdown=Math.min(maxDrawdown,(p.close/peak-1)*100);}
 return {year,daily,startDate:daily[0].date,endDate:daily.at(-1).date,annualReturn:(daily.at(-1).close/daily[0].close-1)*100,maxDrawdown,drawdownCounts:countAnnualDrawdownEvents(daily),status:year===Number(raw.lastDate.slice(0,4))?'年内':'完整年度'};
});
const payload={status:'latest',data:{currentPoint:raw.daily.at(-1).close,updatedText:raw.lastDate,returnHistory:{rows,firstDate:raw.firstDate,lastDate:raw.lastDate,source:raw.source}}};
const html=await readFile(new URL('../a-share-market-dashboard.html',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,executablePath});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
  if(url.pathname==='/api/nasdaq100')return route.fulfill({json:payload});
  return route.fulfill({status:503,json:{error:'Unrelated data unavailable during offline verification'}});
 });
 await page.goto('http://127.0.0.1:49888/');
 await page.waitForFunction(()=>!document.getElementById('startup-enter').disabled,{}, {timeout:70000});
 await page.locator('#startup-enter').click();
 await page.locator('[data-open-nasdaq-grid]').first().click();
 const c=page.locator('#nasdaq-annual-detail');
 const parent=c.locator('xpath=ancestor::details[1]');
 if(await parent.evaluate(e=>e.open))await parent.locator(':scope > summary').click();
 const statistics=page.locator('#nasdaq-drawdown-detail');
 const section=statistics.locator('.drawdown-statistics');
 assert.equal(await section.isVisible(),true,'statistics visible while annual history is collapsed');
 assert.equal(await statistics.evaluate(e=>e.previousElementSibling.tagName==='DETAILS'&&!e.closest('details')),true,'statistics and annual history share the same level');
 await page.screenshot({path:new URL('hierarchy-desktop.png',output).pathname});
 assert.equal(await section.evaluate(e=>e.open),false);
 await section.locator(':scope > summary').focus();await page.keyboard.press('Enter');
 assert.equal(await section.evaluate(e=>e.open),true);
 assert.equal(await section.locator('.drawdown-frequency:not(.daily-drop-frequency) tbody tr').count(),rows.length+1);
 assert.equal(await section.locator('.daily-drop-frequency tbody tr').count(),rows.length+1);
 assert.deepEqual(await section.locator('.daily-drop-frequency thead th').allTextContents(),['年份 / 单日跌幅','>5%','>8%','>10%']);
 const totals=await section.locator('.daily-drop-frequency .drawdown-frequency-total td').allTextContents();
 assert.ok(totals.every(v=>/^\d+$/.test(v)));
 await parent.locator(':scope > summary').click();
 await c.locator('[data-nasdaq-calendar-mode="year"]').click();
 await c.locator('[data-nasdaq-calendar-metric="return"]').click();
 await c.locator('[data-nasdaq-calendar-metric="drawdown"]').click();
 assert.equal(await section.evaluate(e=>e.open),true,'open state survives calendar rerender');
 await parent.locator(':scope > summary').click();
 assert.equal(await section.isVisible(),true);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:950});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await section.locator('.daily-drop-frequency .drawdown-frequency-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth),true,'all three thresholds fit without scrolling');
  if(width<700){const scroll=section.locator('.drawdown-frequency-scroll').first();await scroll.evaluate(e=>e.scrollLeft=e.scrollWidth);assert.ok(await scroll.evaluate(e=>e.scrollLeft)>0);await scroll.evaluate(e=>e.scrollLeft=0);}
  if(width!==320){await section.screenshot({path:new URL(width===1440?'desktop.png':'mobile.png',output).pathname});await section.locator('.daily-drop-frequency').screenshot({path:new URL(width===1440?'daily-desktop.png':'daily-mobile.png',output).pathname});}
 }
 await page.setViewportSize({width:1920,height:1080});
 const detail=statistics.locator('[data-daily-drop-detail]');
 const entry=section.locator('[data-daily-drop-threshold="5"][data-daily-drop-scope="all"]');
 await entry.focus();await page.keyboard.press('Enter');
 assert.equal(await detail.isVisible(),true);
 assert.equal(await detail.locator('[data-daily-drop-date]').count(),Number(totals[0]));
 assert.match(await detail.innerText(),/参考图估算／事件归纳/);
 assert.equal(await statistics.locator('[data-daily-drop-overview]').isVisible(),false);
 for(const [i,threshold] of [5,8,10].entries()){
  await detail.locator(`[data-daily-drop-filter="${threshold}"]`).click();
  assert.equal(await detail.locator('[data-daily-drop-date]').count(),Number(totals[i]));
 }
 await detail.locator('[data-daily-drop-filter="5"]').click();
 for(const width of [1920,390,320]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(width===1920||width===390)await statistics.screenshot({path:new URL(width===1920?'detail-desktop.png':'detail-mobile.png',output).pathname});
  const scroll=detail.locator('.daily-drop-detail-scroll');
  await scroll.focus();await page.keyboard.press('ArrowRight');
  if(width<700){await scroll.evaluate(e=>e.scrollLeft=e.scrollWidth);assert.ok(await scroll.evaluate(e=>e.scrollLeft)>0);}
  if(width===1920||width===390){await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);await statistics.screenshot({path:new URL(width===1920?'detail-desktop-bottom.png':'detail-mobile-bottom.png',output).pathname});}
  await scroll.evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});
 }
 await detail.locator('[data-daily-drop-year]').selectOption('2026');
 assert.equal(await detail.locator('[data-daily-drop-date]').count(),1);
 const recent=detail.locator('[data-daily-drop-date="2026-11-05"]');
 assert.deepEqual((await recent.locator('td').allTextContents()).slice(5,8),['—','—','—']);
 await detail.locator('[data-daily-drop-filter="10"]').click();
 assert.equal(await detail.locator('[data-daily-drop-date]').count(),0);
 assert.match(await detail.innerText(),/暂无超过该阈值/);
 await detail.locator('[data-daily-drop-back]').click();
 assert.equal(await detail.isVisible(),false);assert.equal(await entry.evaluate(e=>e===document.activeElement),true);
 await section.locator('[data-daily-drop-threshold="8"][data-daily-drop-scope="2008"]').click();
 assert.equal(await detail.locator('[data-daily-drop-date]').count(),2);
 assert.equal(await detail.locator('[data-daily-drop-year]').inputValue(),'2008');
 await detail.locator('[data-daily-drop-back]').click();
 await section.locator(':scope > summary').click();assert.equal(await section.evaluate(e=>e.open),false);
 assert.equal(await section.locator('.daily-drop-frequency').isVisible(),false);
 assert.deepEqual(errors,[]);
 await writeFile(new URL('verification.json',output),JSON.stringify({years:rows.length,totals,widths:[1440,390,320],keyboard:true,collapse:true,statePersistence:true,errors},null,2));
 console.log(JSON.stringify({years:rows.length,totals,widths:[1440,390,320],errors}));
}finally{await browser.close();}
