import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;assert.ok(executablePath&&!executablePath.includes('/Google Chrome.app/'));
const payload=JSON.parse(await readFile(process.env.NASDAQ_REAL_FIXTURE,'utf8'));
const output=new URL('../.impeccable/review/annual-index-linkage/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname==='/api/nasdaq100')return r.fulfill({json:payload});if(u.pathname.startsWith('/api/')||u.hostname!=='127.0.0.1')return r.fulfill({status:503,json:{error:'Unrelated request blocked'}});return r.continue();});
 await page.goto('http://127.0.0.1:49888/');await page.waitForFunction(()=>!document.getElementById('startup-enter').disabled,{}, {timeout:70000});
 await page.locator('#startup-enter').click();await page.locator('[data-open-nasdaq-grid]').first().click();
 const c=page.locator('#nasdaq-annual-detail'),details=c.locator('xpath=ancestor::details[1]');if(await details.count()&&!await details.evaluate(e=>e.open))await details.locator('summary').click();
 await c.locator('[data-nasdaq-calendar-mode="year"]').click();await c.locator('.monthly-index-line').waitFor();
 const input=await c.locator('[data-index-chart]').evaluate(e=>JSON.parse(e.dataset.indexChart));assert.equal(input.period,'year');
 assert.deepEqual(input.points,payload.data.returnHistory.rows.flatMap(r=>r.daily).sort((a,b)=>a.date.localeCompare(b.date)));
 const before=await c.locator('.monthly-index-line').getAttribute('d');
 await c.locator('[data-index-year="2000"]').click();assert.equal(await c.locator('.monthly-index-highlight').count(),1);
 assert.equal(await c.locator('.monthly-index-line').getAttribute('d'),before);
 assert.match(await c.locator('.monthly-index-summary').innerText(),/2000年已高亮/);
 assert.equal(await c.locator('[data-nasdaq-calendar-mode="year"]').getAttribute('aria-pressed'),'true');
 await c.screenshot({path:new URL('desktop.png',output).pathname});
 await c.locator('[data-nasdaq-calendar-metric="drawdown"]').click();assert.equal(await c.locator('[data-index-year="2000"]').getAttribute('aria-pressed'),'true');
 assert.equal(await c.locator('.drawdown-frequency-table tbody tr').count(),31);
 await c.locator('[data-index-year="2000"]').click();assert.equal(await c.locator('.monthly-index-highlight').count(),0);
 await c.locator('[data-index-year="2008"]').focus();await page.keyboard.press('Enter');assert.match(await c.locator('.monthly-index-summary').innerText(),/2008年已高亮/);
 await c.locator('[data-nasdaq-year="2008"]').click();assert.equal(await c.locator('select').inputValue(),'2008');
 await c.locator('[data-index-month="4"]').click();assert.equal(await c.locator('.monthly-index-highlight').count(),1);
 await c.locator('[data-nasdaq-calendar-mode="year"]').click();assert.equal(await c.locator('[data-index-year="2008"]').getAttribute('aria-pressed'),'true');
 for(const width of [1000,390,320]){await page.setViewportSize({width,height:900});await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(width===390)await c.screenshot({path:new URL('mobile.png',output).pathname});}
 await c.locator('[data-index-clear]').click();assert.equal(await c.locator('.monthly-index-highlight').count(),0);
 assert.deepEqual(errors,[]);await writeFile(new URL('verification.json',output),JSON.stringify({points:input.points.length,years:31,exactData:true,yearHighlight:true,fixedScale:true,metricAndModePersistence:true,monthlyDetail:true,keyboard:true,widths:[1600,1000,390,320],errors},null,2));
 console.log('PASS: annual real points, year highlight/cancel, fixed axes, metric/mode persistence, monthly entry, keyboard, responsive widths');
}finally{await browser.close();}
