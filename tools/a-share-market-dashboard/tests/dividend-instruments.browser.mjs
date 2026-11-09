import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
assert.ok(executablePath && !executablePath.includes('/Google Chrome.app/'));
const output = new URL('../.impeccable/review/dividend-query/', import.meta.url);
await mkdir(output, { recursive: true });
const actual = JSON.parse(await readFile(new URL('../data/红利信号/南方红利低波50ETF.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], mutations = [];
  let sourceOverride = null;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/api/dividend-signal' && url.searchParams.get('code') === '515450') return route.fulfill({ json: sourceOverride ?? actual });
    if (request.method() !== 'GET') mutations.push(url.pathname);
    if (url.pathname.startsWith('/api/') || url.hostname !== '127.0.0.1') return route.fulfill({ status: 503, json: { error: 'Unrelated request blocked' } });
    return route.continue();
  });
  await page.goto('http://127.0.0.1:49888/');
  await page.waitForFunction(() => !document.getElementById('startup-enter').disabled, {}, { timeout: 70000 });
  await page.locator('#startup-enter').click();
  await page.locator('.nav-item[data-view="dividend-signal-view"]').click();
  const view = page.locator('#dividend-signal-view');
  assert.equal(await view.locator('[data-dividend-instrument-select]').inputValue(), '000922');
  await view.locator('[data-dividend-instrument-select]').selectOption('515450');
  const sp = view.locator('[data-dividend-alternate-content="view"]');
  await sp.locator('[data-sp-index-view]').waitFor();
  assert.equal(await view.locator('[data-dividend-csi-content]').isVisible(), false);
  const copy = await sp.innerText();
  for (const value of ['515450', 'ETF现金分红率', 'ETF收盘价', actual.lastPoint.date]) assert.ok(copy.includes(value), value);
  assert.doesNotMatch(copy, /000922|H30269|中证红利/);
  assert.equal(await sp.locator('.spdividend-point strong').innerText(), actual.lastPoint.close.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '元');
  await view.screenshot({ path: new URL('desktop.png', output).pathname });
  const layouts = [];
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 390) await view.screenshot({ path: new URL('mobile.png', output).pathname });
    layouts.push({ width, overflow: false });
  }
  await view.locator('[data-dividend-view="dividend-management-view"]').click();
  const manager = page.locator('#dividend-management-view');
  assert.equal(await manager.locator('[data-dividend-instrument-select]').inputValue(), '515450');
  const originalWeight = await manager.locator('[data-dividend-param="weights.absolute"]').inputValue();
  const settings = manager.locator('[data-dividend-alternate-content="management"]');
  await settings.locator('[data-sp-param="weights.absolute"]').fill('90');
  assert.equal(await settings.locator('[data-sp-save]').isDisabled(), true);
  await settings.locator('[data-sp-param="weights.ratio"]').fill('10');
  await settings.locator('[data-sp-save]').click();
  assert.match(await settings.innerText(), /已保存515450 ETF独立参数/);
  assert.equal(await settings.locator('[data-sp-backtest]').isDisabled(), true);
  await manager.locator('[data-dividend-instrument-select]').selectOption('000922');
  assert.equal(await manager.locator('[data-dividend-param="weights.absolute"]').inputValue(), originalWeight);
  assert.equal(await manager.locator('[data-dividend-csi-content]').isVisible(), true);
  await manager.locator('[data-dividend-instrument-select]').selectOption('515450');
  assert.equal(await settings.locator('[data-sp-param="weights.absolute"]').inputValue(), '90');
  await manager.locator('[data-dividend-view="dividend-task-monitor-view"]').click();
  const monitor = page.locator('#dividend-task-monitor-view');
  assert.match(await monitor.locator('[data-dividend-alternate-content="monitor"]').innerText(), /尚未配置/);
  assert.equal(await monitor.locator('[data-dividend-csi-content]').isVisible(), false);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('startup-enter').disabled, {}, { timeout: 70000 });
  await page.locator('#startup-enter').click();
  assert.equal(await monitor.locator('[data-dividend-instrument-select]').inputValue(), '515450');
  assert.equal(await monitor.locator('[data-dividend-alternate-content="monitor"]').isVisible(), true);
  // Synthetic series exercise ready-state controls; production data stays untouched.
  const daily = [];
  for (let day = new Date('2025-01-02T00:00:00Z'); day <= new Date('2026-10-30T00:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
    if (![0, 6].includes(day.getUTCDay())) daily.push({ date: day.toISOString().slice(0, 10), close: 1 + daily.length / 1000 });
  }
  sourceOverride = { ...actual, source: '测试用合成ETF序列', sourceStatus: {}, daily,
    lastPoint: { ...daily.at(-1), instrumentId: '515450' },
    valuation: { basis: 'fund-distribution-yield-ttm', date: '2026-10-30', dividendYield: 5.2, sourceUrl: 'https://example.test/sp' },
    records: ['2026-01-05', '2026-06-01', '2026-10-30'].map(date => ({ instrumentId: '515450', recordDate: date, dates: { index: date, bond: date },
      input: { dividendYield: 5.2, bondYield: 1.65 }, sourceKey: 'Synthetic 515450 test', kind: 'daily' })) };
  await monitor.locator('[data-sp-source-refresh]').click();
  await page.waitForFunction(() => document.querySelector('[data-dividend-alternate-content="monitor"]')?.textContent.includes('5.2%'));
  await monitor.locator('[data-dividend-view="dividend-signal-view"]').click();
  await sp.locator('[data-spdividend-calendar-mode="year"]').click();
  assert.equal(await sp.locator('.dividend-year-card').count(), 2);
  await sp.locator('[data-spdividend-calendar-metric="drawdown"]').click();
  assert.equal(await sp.locator('[data-spdividend-calendar-metric="drawdown"]').getAttribute('aria-pressed'), 'true');
  await sp.locator('[data-spdividend-year="2025"]').click();
  assert.equal(await sp.locator('[data-spdividend-calendar-year]').inputValue(), '2025');
  await view.locator('[data-dividend-view="dividend-management-view"]').click();
  await settings.locator('[data-sp-backtest]').click();
  assert.match(await settings.innerText(), /本标的回测结果/);
  sourceOverride = null;
  await manager.locator('[data-dividend-view="dividend-signal-view"]').click();
  await sp.locator('[data-sp-source-refresh]').click();
  await page.waitForFunction(() => document.querySelector('[data-sp-index-view]')?.textContent.includes('HTTP 403'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await view.screenshot({ path: new URL('desktop.png', output).pathname });
  await page.setViewportSize({ width: 390, height: 1000 });
  await view.screenshot({ path: new URL('mobile.png', output).pathname });
  assert.deepEqual(errors, []);
  assert.deepEqual(mutations, []);
  const result = { selectedIndex: '515450', correspondingEtf: '515450', missingEvidenceExplicit: true,
    csiDataHiddenWhenSpSelected: true, independentParameters: true, noDailyTaskMutations: true,
    taskStatusIndependent: true, restoredSelection: true, readyStateCalendarAndBacktest: 'synthetic isolated fixture passed', layouts, pageErrors: errors };
  await writeFile(new URL('browser.json', output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
