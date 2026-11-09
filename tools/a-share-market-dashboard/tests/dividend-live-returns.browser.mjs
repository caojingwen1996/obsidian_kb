import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildDividendLiveReturnHistory } from '../src/app.mjs';
import { parseCsindexPerformance } from '../src/adapters.mjs';
import { mergeDividendIndexHistory } from '../src/dividend-bollinger.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
assert.ok(executablePath && !executablePath.includes('/Google Chrome.app/'), 'Use dedicated Chromium');
const fixture = process.env.DIVIDEND_LIVE_FIXTURE_DIR;
const daily = JSON.parse(await readFile(`${fixture}/daily.json`, 'utf8'));
const quote = JSON.parse(await readFile(`${fixture}/quote.json`, 'utf8'));
const html = await readFile(new URL('../a-share-market-dashboard.html', import.meta.url), 'utf8');
const embedded = name => JSON.parse(html.match(new RegExp(`const ${name} = Object\\.freeze\\(\\s*([\\s\\S]*?)\\n\\);`))[1]);
const expected = buildDividendLiveReturnHistory(embedded('CSI_DIVIDEND_ANNUAL_PERFORMANCE'),
  mergeDividendIndexHistory(embedded('CSI_DIVIDEND_INDEX_HISTORY'), parseCsindexPerformance(daily)), { quote: quote.data });
const latest = expected.rows.at(-1);
const output = new URL('../.impeccable/review/live-annual/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.clock.install();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let dailyCalls = 0;
  let quoteCalls = 0;
  let failure = '';
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/csindex-performance' && url.searchParams.get('indexCode') === '000922') {
      dailyCalls++;
      return failure === 'daily' ? route.fulfill({ status: 503, json: { error: 'Daily unavailable' } }) : route.fulfill({ json: daily });
    }
    if (url.pathname === '/api/stock-quote' && url.searchParams.get('secid') === '1.000922') {
      quoteCalls++;
      return failure === 'quote' ? route.fulfill({ status: 503, json: { error: 'Quote unavailable' } }) : route.fulfill({ json: quote });
    }
    if (url.pathname.startsWith('/api/') || url.hostname !== '127.0.0.1') return route.fulfill({ status: 503, json: { error: 'Unrelated request blocked' } });
    return route.continue();
  });
  await page.goto('http://127.0.0.1:49888/');
  await page.waitForFunction(() => !document.getElementById('startup-enter').disabled, {}, { timeout: 70000 });
  await page.locator('#startup-enter').click();
  await page.locator('.nav-item[data-view="dividend-signal-view"]').click();
  const calendar = page.locator('#dividend-annual-detail');
  await page.waitForFunction(() => document.querySelector('.dividend-calendar-live')?.textContent.includes('数据截至'));
  const disclosure = calendar.locator('xpath=ancestor::details[1]');
  if (await disclosure.count() && !await disclosure.evaluate(element => element.open)) await disclosure.locator('summary').click();
  await calendar.locator('[data-dividend-calendar-mode="year"]').click();
  const value = () => calendar.locator(`[data-dividend-year="${latest.year}"] strong`).innerText();
  const numeric = text => Number(text.replace('−', '-').replace('%', ''));
  assert.ok(Math.abs(numeric(await value()) - latest.annualReturn) < .011);
  assert.equal(await calendar.locator(`[data-dividend-year="${latest.year}"] time`).last().innerText(), latest.endDate);
  await calendar.locator('[data-dividend-calendar-metric="drawdown"]').click();
  assert.ok(Math.abs(numeric(await value()) - latest.maxDrawdown) < .011);
  const beforeFailure = await value();
  await page.mouse.move(0, 0);
  await calendar.screenshot({ path: new URL('desktop.png', output).pathname });
  const layouts = [];
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await calendar.evaluate(element => element.scrollWidth <= element.clientWidth), true);
    layouts.push({ width, overflow: false });
    if (width === 390) await calendar.screenshot({ path: new URL('mobile.png', output).pathname });
  }
  const callsBeforeTimer = dailyCalls;
  await page.clock.fastForward(61_000);
  await page.waitForFunction(() => document.querySelector('.dividend-calendar-live')?.textContent.includes('数据截至'));
  assert.equal(dailyCalls, callsBeforeTimer + 1, 'visible page refreshes after one minute');
  assert.equal(await calendar.locator('[data-dividend-calendar-mode="year"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await calendar.locator('[data-dividend-calendar-metric="drawdown"]').getAttribute('aria-pressed'), 'true');
  failure = 'daily';
  await calendar.locator('[data-dividend-calendar-refresh]').click();
  await page.waitForFunction(() => document.querySelector('.dividend-calendar-live')?.textContent.includes('更新失败'));
  assert.equal(await value(), beforeFailure);
  assert.equal(await calendar.locator('[data-dividend-calendar-refresh]').innerText(), '重试');
  failure = 'quote';
  await calendar.locator('[data-dividend-calendar-refresh]').click();
  await page.waitForFunction(() => document.querySelector('.dividend-calendar-live')?.textContent.includes('实时报价读取失败'));
  assert.equal(await value(), beforeFailure);
  failure = '';
  await calendar.locator('[data-dividend-calendar-refresh]').click();
  await page.waitForFunction(() => {
    const text = document.querySelector('.dividend-calendar-live')?.textContent;
    return text?.includes('数据截至') && !text.includes('失败');
  });
  await calendar.locator('[data-dividend-calendar-mode="month"]').click();
  assert.equal(await calendar.locator('.dividend-month-card').count(), 12);
  assert.equal(await calendar.locator('[data-dividend-calendar-metric="drawdown"]').getAttribute('aria-pressed'), 'true');
  await calendar.locator('[data-dividend-calendar-metric="return"]').click();
  await calendar.locator('select').selectOption('2025');
  await calendar.locator('[data-dividend-calendar-refresh]').click();
  await page.waitForFunction(() => document.querySelector('.dividend-calendar-live')?.textContent.includes('数据截至'));
  assert.equal(await calendar.locator('select').inputValue(), '2025');
  const callsBeforeReload = dailyCalls;
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('startup-enter').disabled, {}, { timeout: 70000 });
  await page.locator('#startup-enter').click();
  await page.waitForFunction(() => document.querySelector('.dividend-calendar-live')?.textContent.includes('数据截至'));
  assert.ok(dailyCalls > callsBeforeReload, 'restored dividend page refreshes immediately after startup');
  assert.deepEqual(errors, []);
  const result = { source: 'Replay of real local-proxy daily and quote responses', date: latest.endDate,
    annualReturn: latest.annualReturn, maxDrawdown: latest.maxDrawdown, quoteAt: expected.quoteAt,
    dailyCalls, quoteCalls, oneMinuteRefresh: true, failureRetainsData: true, retryRecovers: true,
    modesMetricsAndYearPreserved: true, restoredPageRefresh: true, monthlySynchronized: true, layouts, pageErrors: errors };
  await writeFile(new URL('browser.json', output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
