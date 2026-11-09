import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { renderDrawdownSection, countAnnualDrawdownEvents } from '../src/app.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
assert.ok(executablePath && !executablePath.includes('/Google Chrome.app/'));
const output = new URL('../.impeccable/review/drawdown-frequency/', import.meta.url);
await mkdir(output, {recursive:true});
const rows = [2026,2025,2024,2023,2022,2021].map((year,i) => ({year, startDate:`${year}-01-02`,endDate:`${year}-11-03`,status:i===0?'年内':i===5?'样本首年':'完整年度',maxDrawdown:-35,
  drawdownCounts:countAnnualDrawdownEvents((i===1?[100,65,100,80]:i===4?[100,20]:[100,90]).map(close=>({close})))}));
const html = renderDrawdownSection({rows, firstDate:'2021-01-02',lastDate:'2026-11-03',source:'测试数据，仅用于布局验证'},{namespace:'nasdaq'});
const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,executablePath});
try {
 const page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1100});
  await page.setContent(`<style>${css}body{padding:20px;display:block}</style><main>${html}</main>`);
  const disclosure = page.locator('.drawdown-statistics');
  assert.equal(await disclosure.evaluate(e=>e.open),false);
  await disclosure.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await disclosure.evaluate(e=>e.open),true);
  assert.equal(await page.locator('.drawdown-frequency:not(.daily-drop-frequency) .drawdown-frequency-table td').count(),63);
  assert.equal(await page.locator('.daily-drop-frequency th[scope=col]').count(),4);
  assert.equal(await page.locator('.drawdown-frequency:not(.daily-drop-frequency) .drawdown-frequency-total td').count(),9);
  assert.deepEqual(await page.locator('.drawdown-frequency:not(.daily-drop-frequency) .drawdown-frequency-total td').allTextContents(),['7','3','3','2','2','2','1','1','1']);
  assert.match(await page.locator('.drawdown-frequency:not(.daily-drop-frequency) .drawdown-frequency-total th').innerText(),/累计回撤次数/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const scroll=page.locator('.drawdown-frequency:not(.daily-drop-frequency) .drawdown-frequency-scroll');
  await scroll.focus();
  if(width<700){await page.keyboard.press('End');await scroll.evaluate(e=>e.scrollLeft=e.scrollWidth);assert.ok(await scroll.evaluate(e=>e.scrollLeft)>0);await scroll.evaluate(e=>e.scrollLeft=0);}
  await page.screenshot({path:new URL(`${width}.png`,output).pathname,fullPage:true});
 }
 console.log('Heatmap: 54 annual cells and 9 cumulative cells, desktop / 390 / 320 px, no page overflow, focusable horizontal scroll passed.');
}finally{await browser.close();}
