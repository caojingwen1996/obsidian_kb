import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import { parseCsindexPerformance } from '../src/adapters.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
assert.ok(executablePath&&!executablePath.includes('/Google Chrome.app/'));
const payload=JSON.parse(await readFile(process.env.NASDAQ_REAL_FIXTURE,'utf8'));
const dividendPayload = process.env.DIVIDEND_REAL_FIXTURE ? JSON.parse(await readFile(process.env.DIVIDEND_REAL_FIXTURE,'utf8')) : null;
let dividendRequests = 0;
const output=new URL('../.impeccable/review/monthly-index-live/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname==='/api/csindex-performance' && dividendPayload){dividendRequests++;return r.fulfill({json:dividendPayload});}if(u.pathname==='/api/nasdaq100')return r.fulfill({json:payload});if(u.pathname.startsWith('/api/')||u.hostname!=='127.0.0.1')return r.fulfill({status:503,json:{error:'Unrelated request blocked for verification'}});return r.continue();});
 await page.goto('http://127.0.0.1:49888/');
 await page.waitForFunction(()=>!document.getElementById('startup-enter').disabled,{}, {timeout:70000});
 await page.locator('#startup-enter').click();await page.locator('[data-open-nasdaq-grid]').first().click();
 const calendar=page.locator('#nasdaq-annual-detail');
 const disclosure=calendar.locator('xpath=ancestor::details[1]');if(await disclosure.count()&&!await disclosure.evaluate(e=>e.open))await disclosure.locator('summary').click();
 await calendar.locator('.monthly-index-line').waitFor();
 const actual=await calendar.locator('[data-index-chart]').evaluate(e=>JSON.parse(e.dataset.indexChart));
 const annual=payload.data.returnHistory.rows.find(r=>r.year===actual.year);
 assert.deepEqual(actual.points,annual.daily);
 assert.equal(await calendar.locator('.monthly-index-row').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);
 const before=await calendar.locator('.monthly-index-line').getAttribute('d');
 await calendar.locator('[data-index-month="4"]').click();
 assert.equal(await calendar.locator('.monthly-index-highlight').count(),1);
 assert.equal(await calendar.locator('.monthly-index-line').getAttribute('d'),before);
 assert.match(await calendar.locator('.monthly-index-summary').innerText(),/4月已高亮/);
 await calendar.screenshot({path:new URL('desktop.png',output).pathname});
 await calendar.locator('[data-nasdaq-calendar-metric="drawdown"]').click();
 assert.equal(await calendar.locator('[data-index-month="4"]').getAttribute('aria-pressed'),'true');
 await calendar.locator('[data-index-month="4"]').click();assert.equal(await calendar.locator('.monthly-index-highlight').count(),0);
 await calendar.locator('[data-index-month="3"]').focus();await page.keyboard.press('Enter');assert.equal(await calendar.locator('.monthly-index-highlight').count(),1);
 await calendar.locator('select').selectOption('2025');await page.waitForTimeout(60);assert.equal(await calendar.locator('.monthly-index-highlight').count(),0);
 await calendar.locator('[data-index-month="4"]').click();
 for(const width of [1000,390,320]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(width===390)await calendar.screenshot({path:new URL('mobile.png',output).pathname});
 }
 await calendar.locator('[data-index-clear]').click();assert.equal(await calendar.locator('.monthly-index-highlight').count(),0);
 await calendar.locator('svg.monthly-index-svg').focus();await page.keyboard.press('ArrowRight');assert.match(await calendar.locator('.monthly-index-readout').innerText(),/收盘/);
 await calendar.locator('[data-nasdaq-calendar-mode="year"]').click();assert.equal(await calendar.locator('[data-index-chart]').count(),1);
 assert.equal(await calendar.locator('[data-index-chart]').evaluate(e=>JSON.parse(e.dataset.indexChart).period),'year');
 if(dividendPayload){
  await page.setViewportSize({width:1600,height:1100});
  await page.locator('.nav-item[data-view="dividend-signal-view"]').first().click();
  const dividend=page.locator('#dividend-annual-detail');
  const details=dividend.locator('xpath=ancestor::details[1]');if(await details.count()&&!await details.evaluate(e=>e.open))await details.locator('summary').click();
  await dividend.locator('.monthly-index-line').waitFor();
  const data=await dividend.locator('[data-index-chart]').evaluate(e=>JSON.parse(e.dataset.indexChart));
  assert.deepEqual(data.points,parseCsindexPerformance(dividendPayload).filter(p=>p.date.startsWith(String(data.year))).map(({date,close})=>({date,close})));
  await dividend.locator('[data-index-month="4"]').click();assert.equal(await dividend.locator('.monthly-index-highlight').count(),1);
  await dividend.screenshot({path:new URL('dividend-desktop.png',output).pathname});
  await dividend.locator('select').selectOption('2025');
  await dividend.locator('.monthly-index-empty').filter({hasText:'日线读取失败'}).waitFor();
  assert.equal(await dividend.locator('.monthly-index-line').count(),0);
  const oldRequests=dividendRequests;await dividend.locator('[data-dividend-calendar-retry]').click();
  await page.waitForFunction(()=>document.querySelector('#dividend-annual-detail .monthly-index-empty')?.textContent.includes('日线读取失败'));
  assert.ok(dividendRequests>oldRequests);
 }
 assert.deepEqual(errors,[]);
 await writeFile(new URL('verification.json',output),JSON.stringify({dailyPoints:actual.points.length,source:payload.data.returnHistory.source,year:actual.year,exactDailyMatch:true,dividendVerified:Boolean(dividendPayload),missingYearRetry:Boolean(dividendPayload),monthSelection:true,unchangedScale:true,yearReset:true,keyboard:true,responsiveWidths:[1600,1000,390,320],errors},null,2));
 console.log('PASS: real daily series matches API, month highlight, fixed scale, year reset, metric persistence, keyboard, annual view, 4 screen widths');
}finally{await browser.close();}
