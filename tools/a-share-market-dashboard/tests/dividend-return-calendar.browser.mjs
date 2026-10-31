import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseCsindexPerformance} from '../src/adapters.mjs';
import {calculateDividendMonthlyReturns} from '../src/app.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const payload=JSON.parse(await readFile(process.env.DIVIDEND_CALENDAR_FIXTURE,'utf8'));
const history=JSON.parse(await readFile(new URL('../../../sources/automations/中证红利信号/中证红利年度表现.json',import.meta.url),'utf8'));
const last=history.rows.at(-1);
const expected=calculateDividendMonthlyReturns(parseCsindexPerformance(payload),{year:last.year,startDate:last.start_date,endDate:last.end_date,annualReturn:last.annual_return,status:last.status});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/csindex-performance') {
   const annualRequest = history.rows.some(row => url.searchParams.get('indexCode')==='000922' && url.searchParams.get('startDate')===row.start_date.replaceAll('-','') && url.searchParams.get('endDate')===row.end_date.replaceAll('-',''));
   if(annualRequest) requests++;
   if(url.searchParams.get('startDate')===last.start_date.replaceAll('-','')) return route.fulfill({json:payload});
   return route.fulfill({status:503,json:{error:'Historical year unavailable in this test'}});
  }
  if(url.pathname.startsWith('/api/') || url.hostname!=='127.0.0.1') return route.fulfill({status:503,json:{error:'Unavailable in calendar test'}});
  return route.continue();
 });
 await page.goto('http://127.0.0.1:49888/');
 await page.waitForFunction(()=>!document.getElementById('startup-enter').disabled,{},{timeout:70000});
 await page.locator('#startup-enter').click();
 await page.locator('.nav-item[data-view="dividend-signal-view"]').click();
 const calendar=page.locator('#dividend-annual-detail');
 await calendar.locator('[data-dividend-calendar-metric="drawdown"]').click();
 await calendar.locator('.dividend-month-card').first().waitFor();
 const displayed=await calendar.locator('.dividend-month-card strong').first().innerText();
 assert.ok(Math.abs(Number(displayed.replace('−','-').replace('%',''))-expected[0].maxDrawdown)<.01);
 assert.equal(await calendar.locator('.dividend-month-card').count(),12);
 assert.equal(await calendar.locator('select').inputValue(),String(last.year));
 await calendar.locator('[data-dividend-calendar-metric="return"]').focus();await page.keyboard.press('Enter');
 assert.equal(await calendar.locator('[data-dividend-calendar-metric="return"]').getAttribute('aria-pressed'),'true');
 await calendar.locator('[data-dividend-calendar-metric="drawdown"]').click();
 assert.equal(requests,1,'same year uses cached daily calculations');
 await calendar.screenshot({path:'/tmp/dividend-drawdown-desktop.png'});
 for(const width of [390,320]) {
  await page.setViewportSize({width,height:844});
  assert.equal(await calendar.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(width===390) await calendar.screenshot({path:'/tmp/dividend-drawdown-mobile.png'});
 }
 await calendar.locator('[data-dividend-calendar-step="-1"]').click();
 await calendar.locator('[data-dividend-calendar-retry]').waitFor();
 assert.equal(await calendar.locator('[data-dividend-calendar-metric="drawdown"]').getAttribute('aria-pressed'),'true');
 assert.equal(requests,2);
 await calendar.locator('[data-dividend-calendar-retry]').click();
 await calendar.locator('[data-dividend-calendar-retry]').waitFor();assert.equal(requests,3);
 await calendar.locator('[data-dividend-calendar-step="1"]').click();
 assert.equal(await calendar.locator('.dividend-month-card strong').first().innerText(),displayed);
 assert.equal(requests,3);
 assert.equal(await page.locator('#nasdaq-annual-detail').getAttribute('data-calendar-metric'),null);
 assert.deepEqual(errors,[]);
 console.log('Dividend calendar passed: real daily calculation, metric toggle, keyboard, year/cache, failure/retry, isolated state, desktop and 390/320px.');
} finally {await browser.close();}
