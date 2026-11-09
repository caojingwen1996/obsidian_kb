import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
assert.ok(executablePath && !executablePath.includes('/Google Chrome.app/'), 'Use a dedicated Chromium executable');
const output = new URL('../.impeccable/review/annual-calendar/', import.meta.url);
await mkdir(output, { recursive: true });
const history = JSON.parse(await readFile(new URL('../../../sources/automations/中证红利信号/中证红利年度表现.json', import.meta.url), 'utf8'));
const rows = [...history.rows].sort((a, b) => b.year - a.year);
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const blockedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/') || url.hostname !== '127.0.0.1') {
      blockedRequests.push(url.pathname);
      return route.fulfill({ status: 503, json: { error: 'Offline calendar verification' } });
    }
    return route.continue();
  });
  await page.goto(process.env.DASHBOARD_URL || 'http://127.0.0.1:49888/');
  await page.waitForFunction(() => !document.getElementById('startup-enter').disabled, {}, { timeout: 70000 });
  await page.locator('#startup-enter').click();
  await page.locator('.nav-item[data-view="dividend-signal-view"]').click();
  const calendar = page.locator('#dividend-annual-detail');
  const details = calendar.locator('xpath=ancestor::details[1]');
  if (await details.count() && !(await details.evaluate(element => element.open))) await details.locator('summary').click();
  await calendar.locator('[data-dividend-calendar-mode="year"]').click();
  const cards = calendar.locator('.dividend-year-card');
  assert.equal(await cards.count(), rows.length);
  assert.equal(await calendar.locator('table').count(), 0);
  const readPercent = async locator => Number((await locator.innerText()).replace('−', '-').replace('%', ''));
  for (const row of rows) {
    const card = calendar.locator(`[data-index-year="${row.year}"]`);
    assert.ok(Math.abs(await readPercent(card.locator('strong')) - row.annual_return) < 0.011);
    assert.deepEqual(await card.locator('time').allTextContents(), [row.start_date, row.end_date]);
    assert.ok((await card.innerText()).includes(row.status));
  }
  await calendar.screenshot({ path: new URL('desktop-returns.png', output).pathname });
  await calendar.locator('[data-dividend-calendar-metric="drawdown"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await calendar.locator('[data-dividend-calendar-metric="drawdown"]').getAttribute('aria-pressed'), 'true');
  for (const row of rows) {
    assert.ok(Math.abs(await readPercent(calendar.locator(`[data-index-year="${row.year}"] strong`)) - row.max_drawdown) < 0.011);
  }
  await calendar.screenshot({ path: new URL('desktop-drawdowns.png', output).pathname });
  const layouts = [];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await calendar.evaluate(element => element.scrollWidth <= element.clientWidth), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const gridColumns = await calendar.locator('.dividend-monthly-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    assert.equal(gridColumns, width <= 700 ? 2 : width <= 1200 ? 4 : 3);
    layouts.push({ width, gridColumns, overflow: false });
    if (width === 390) await calendar.screenshot({ path: new URL('mobile-drawdowns.png', output).pathname });
  }
  await calendar.locator(`[data-index-year="${rows[0].year}"]`).focus();
  await page.keyboard.press('Enter');
  await calendar.locator('[data-dividend-year]').click();
  const dialog = page.locator('#dividend-monthly-dialog');
  assert.equal(await dialog.evaluate(element => element.open), true);
  assert.equal(await dialog.locator('.dividend-month-card').count(), 12);
  await page.keyboard.press('Escape');
  assert.equal(await calendar.locator(`[data-index-year="${rows[0].year}"]`).evaluate(element => element === document.activeElement), true);
  await calendar.locator('[data-dividend-calendar-mode="month"]').click();
  assert.equal(await calendar.locator('[data-dividend-calendar-metric="drawdown"]').getAttribute('aria-pressed'), 'true');
  await calendar.locator('[data-dividend-calendar-metric="return"]').click();
  assert.equal(await calendar.locator('.dividend-month-card').count(), 12);
  await calendar.locator('select').selectOption(String(rows[1].year));
  await calendar.locator('[data-dividend-calendar-mode="year"]').click();
  await calendar.locator('[data-dividend-calendar-mode="month"]').click();
  assert.equal(await calendar.locator('select').inputValue(), String(rows[1].year));
  assert.equal(await page.locator('#nasdaq-annual-detail').getAttribute('data-calendar-metric'), null);
  assert.deepEqual(errors, []);
  const result = { annualRows: rows.length, allSavedReturnsAndDrawdownsMatch: true, layouts, keyboardAndDialogFocus: true, modeAndYearPreserved: true, independentNasdaqState: true, pageErrors: errors, network: 'External and API requests blocked; calendar uses saved local data', blockedRequestCount: blockedRequests.length };
  await writeFile(new URL('verification.json', output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
