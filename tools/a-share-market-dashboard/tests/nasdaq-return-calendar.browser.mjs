import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const payload = JSON.parse(await readFile(process.env.NASDAQ_CALENDAR_FIXTURE, 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/nasdaq100') return route.fulfill({json:payload});
   if(url.pathname.startsWith('/api/') || url.hostname!=='127.0.0.1') return route.fulfill({status:503,json:{error:'Unavailable in calendar test'}});
   return route.continue();
 });
 await page.goto('http://127.0.0.1:49888/');
 await page.waitForFunction(()=>!document.getElementById('startup-enter').disabled,{},{timeout:70000});
 await page.locator('#startup-enter').click();
 await page.locator('[data-open-nasdaq-grid]').click();
 const calendar=page.locator('#nasdaq-annual-detail');
 await calendar.locator('[data-nasdaq-calendar-year]').waitFor();
 assert.equal(await calendar.locator('.dividend-month-card').count(),12);
 const firstReturn = await calendar.locator('.dividend-month-card strong').first().innerText();
 await calendar.locator('[data-nasdaq-calendar-metric="drawdown"]').click();
 assert.equal(await calendar.locator('[data-nasdaq-calendar-metric="drawdown"]').getAttribute('aria-pressed'),'true');
 const firstDrawdown = payload.data.returnHistory.rows.at(-1).monthlyReturns[0].maxDrawdown;
 assert.ok(Math.abs(Number((await calendar.locator('.dividend-month-card strong').first().innerText()).replace('−','-').replace('%','')) - firstDrawdown) < .01);
 assert.equal(await calendar.locator('.dividend-month-card strong').count(),12);
 await calendar.locator('[data-nasdaq-calendar-metric="return"]').focus();
 await page.keyboard.press('Enter');
 assert.equal(await calendar.locator('.dividend-month-card strong').first().innerText(),firstReturn);
 const years=payload.data.returnHistory.rows.map(row=>row.year).sort((a,b)=>a-b);
 const latest=String(years.at(-1));
 assert.equal(await calendar.locator('select').inputValue(),latest);
 await calendar.locator('[data-nasdaq-calendar-step="-1"]').click();
 assert.equal(await calendar.locator('select').inputValue(),String(Number(latest)-1));
 await calendar.locator('select').selectOption(String(years[0]));
 assert.equal(await calendar.locator('[data-nasdaq-calendar-step="-1"]').isDisabled(),true);
 await calendar.locator('[data-nasdaq-calendar-mode="year"]').focus();
 await page.keyboard.press('Enter');
 assert.equal(await calendar.locator('tbody tr').count(),years.length);
 await calendar.locator(`button[data-nasdaq-year="${latest}"]`).click();
 assert.equal(await calendar.locator('select').inputValue(),latest);
 assert.equal(await page.locator('#dividend-annual-detail').getAttribute('data-calendar-year'),null);
 await calendar.locator('[data-nasdaq-calendar-metric="drawdown"]').click();
 await calendar.screenshot({path:'/tmp/nasdaq-calendar-desktop.png'});
 for(const width of [390,320]) {
   await page.setViewportSize({width,height:844});
   assert.equal(await calendar.evaluate(e=>e.scrollWidth<=e.clientWidth),true,'calendar must fit mobile');
   assert.equal(await calendar.locator('[data-nasdaq-calendar-metric="drawdown"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page must fit mobile');
   if(width===390) await calendar.screenshot({path:'/tmp/nasdaq-calendar-mobile.png'});
   await calendar.locator('[data-nasdaq-calendar-mode="year"]').click();
   assert.equal(await calendar.evaluate(e=>e.scrollWidth<=e.clientWidth),true,'annual table scroll stays inside panel');
   await calendar.locator('[data-nasdaq-calendar-mode="month"]').click();
 }
 assert.deepEqual(errors,[]);
 console.log('Calendar checks passed: real history, year/month, year steps, keyboard, independent dividend state, 1440/390/320px, no page errors.');
} finally { await browser.close(); }
