import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
assert.ok(executablePath&&!executablePath.includes('/Google Chrome.app/'));
const payload=JSON.parse(await readFile(process.env.NASDAQ_REAL_FIXTURE,'utf8'));
const history=payload.data.returnHistory;
assert.equal(history.firstDate,'1996-01-02');assert.equal(history.rows.length,31);
const output=new URL('../.impeccable/review/nasdaq-history/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname==='/api/nasdaq100')return r.fulfill({json:payload});if(u.pathname.startsWith('/api/')||u.hostname!=='127.0.0.1')return r.fulfill({status:503,json:{error:'Unrelated request blocked'}});return r.continue();});
 await page.goto('http://127.0.0.1:49888/');await page.waitForFunction(()=>!document.getElementById('startup-enter').disabled,{}, {timeout:70000});
 await page.locator('#startup-enter').click();await page.locator('[data-open-nasdaq-grid]').first().click();
 const c=page.locator('#nasdaq-annual-detail');const details=c.locator('xpath=ancestor::details[1]');if(await details.count()&&!await details.evaluate(e=>e.open))await details.locator('summary').click();
 assert.equal(await c.locator('select option').count(),31);
 for(const year of [1996,1999,2000,2001,2002,2008,2016,2020,2021]){
  await c.locator('select').selectOption(String(year));await c.locator('.monthly-index-line').waitFor();
  const actual=await c.locator('[data-index-chart]').evaluate(e=>JSON.parse(e.dataset.indexChart));
  assert.deepEqual(actual.points,history.rows.find(r=>r.year===year).daily);
  assert.equal(await c.locator('[data-index-month]:disabled').count(),0);
  await c.locator('[data-index-month="4"]').click();assert.equal(await c.locator('.monthly-index-highlight').count(),1);
  if([1996,2000,2008].includes(year))await c.screenshot({path:new URL(`${year}.png`,output).pathname});
 }
 await c.locator('[data-nasdaq-calendar-mode="year"]').click();await c.locator('[data-nasdaq-calendar-metric="drawdown"]').click();
 assert.equal(await c.locator('.dividend-year-card').count(),31);assert.equal(await c.locator('.drawdown-frequency-table tbody tr').count(),31);
 await c.screenshot({path:new URL('annual-drawdowns.png',output).pathname});assert.deepEqual(errors,[]);
 await writeFile(new URL('verification.json',output),JSON.stringify({start:history.firstDate,end:history.lastDate,years:31,dailyRows:history.rows.reduce((n,r)=>n+r.daily.length,0),verifiedYears:[1996,1999,2000,2001,2002,2008,2016,2020,2021],allMonthsSelectable:true,drawdownRows:31,errors},null,2));
 console.log('PASS: 1996–2021 sampled daily points match API; all months available, highlight works; 31 annual rows and drawdown frequency rows');
}finally{await browser.close();}
