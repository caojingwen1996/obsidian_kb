import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateDividendMonthlyReturns, storedDividendMonthlyReturns, renderDividendMonthlyCards, renderDividendAnnualPerformance } from '../src/app.mjs';

const annual = { year: 2026, startDate: '2026-01-05', endDate: '2026-03-03', annualReturn: 32, maxDrawdown: -10, status: '年内' };
const points = [
  { date: '2026-01-05', close: 100 }, { date: '2026-01-30', close: 110 },
  { date: '2026-02-27', close: 99 }, { date: '2026-03-03', close: 132 },
];

test('saved monthly data can be read synchronously without requesting daily prices', () => {
  const monthlyReturns = calculateDividendMonthlyReturns(points, annual);
  assert.equal(storedDividendMonthlyReturns({ ...annual, monthlyReturns }), monthlyReturns);
  assert.equal(storedDividendMonthlyReturns(annual), null);
  assert.equal(storedDividendMonthlyReturns({ ...annual, monthlyReturns: [] }), null);
  assert.equal(storedDividendMonthlyReturns({ ...annual, monthlyReturns, annualReturn: 99 }), null);
  assert.equal(storedDividendMonthlyReturns({ ...annual, monthlyReturns, endDate: '2026-03-04' }), null);
  const incomplete = structuredClone(monthlyReturns);
  incomplete[1].value = null;
  assert.equal(storedDividendMonthlyReturns({ ...annual, monthlyReturns: incomplete }), null);
});

test('all persisted annual rows include valid monthly returns using the annual baseline', async () => {
  const data = JSON.parse(await readFile(new URL('../../../sources/automations/中证红利信号/中证红利年度表现.json', import.meta.url), 'utf8'));
  assert.ok(data.rows.length >= 19);
  for (const row of data.rows) {
    const saved = storedDividendMonthlyReturns({
      year: row.year, startDate: row.start_date, endDate: row.end_date,
      annualReturn: row.annual_return, monthlyReturns: row.monthly_returns,
    });
    assert.ok(saved, `Invalid or missing monthly data: ${row.year}`);
    assert.equal((renderDividendMonthlyCards(saved).match(/<article/g) ?? []).length, 12);
  }
});

test('built dashboard embeds every year and renders saved cards before any network request', async () => {
  const html = await readFile(new URL('../a-share-market-dashboard.html', import.meta.url), 'utf8');
  const match = html.match(/const CSI_DIVIDEND_ANNUAL_PERFORMANCE = Object\.freeze\(\s*([\s\S]*?)\n\);/);
  assert.ok(match);
  const history = JSON.parse(match[1]);
  assert.ok(history.rows.length >= 19);
  for (const row of history.rows) assert.ok(storedDividendMonthlyReturns(row), `Missing embedded months: ${row.year}`);
  const savedBranch = html.slice(html.indexOf('const saved = storedDividendMonthlyReturns(annual)'), html.indexOf("monthlyStatus.textContent = '正在读取中证红利日线…'"));
  assert.match(savedBranch, /renderDividendMonthlyCards\(saved\)/);
  assert.match(savedBranch, /monthlyDialog\.showModal\(\);\s*return;/);
  assert.doesNotMatch(savedBranch, /await|fetchJson/);
});

test('monthly returns compound to the annual return using the same initial baseline', () => {
  const months = calculateDividendMonthlyReturns([...points].reverse(), annual);
  assert.equal(months.length, 12);
  assert.ok(Math.abs(months[0].value - 10) < 1e-10);
  assert.ok(Math.abs(months[1].value + 10) < 1e-10);
  assert.ok(Math.abs(months.slice(0, 3).reduce((v, m) => v * (1 + m.value / 100), 1) - 1.32) < 1e-10);
  assert.equal(months[2].status, '月内累计');
  assert.equal(months[3].value, null);
  assert.equal(months[3].status, '未开始');
});

test('missing endpoints or annual mismatch never generate monthly numbers', () => {
  assert.throws(() => calculateDividendMonthlyReturns(points.slice(1), annual), /起止日期/);
  assert.throws(() => calculateDividendMonthlyReturns(points.slice(0, -1), annual), /起止日期/);
  assert.throws(() => calculateDividendMonthlyReturns(points, { ...annual, annualReturn: 99 }), /不一致/);
});

test('missing intervening month is not mislabeled as a single-month return', () => {
  const months = calculateDividendMonthlyReturns(points.filter(p => !p.date.startsWith('2026-02')), annual);
  assert.equal(months[1].value, null);
  assert.equal(months[2].value, null);
  assert.equal(months[2].status, '数据不足');
});

test('inception year keeps unavailable months empty and starts at the first actual close', () => {
  const months = calculateDividendMonthlyReturns([{ date: '2008-05-26', close: 100 }, { date: '2008-05-30', close: 90 }],
    { year: 2008, startDate: '2008-05-26', endDate: '2008-05-30', annualReturn: -10, status: '成立首年' });
  assert.equal(months[0].value, null);
  assert.equal(months[0].status, '数据不足');
  assert.ok(Math.abs(months[4].value + 10) < 1e-10);
});

test('annual rows are keyboard accessible and monthly cards distinguish missing, gain and loss', () => {
  const html = renderDividendAnnualPerformance({ rows: [annual] }, { mode: 'year' });
  assert.match(html, /<tr data-dividend-year="2026"/);
  assert.match(html, /<button[^>]*aria-haspopup="dialog"[^>]*aria-label="查看2026年月收益率"/);
  const cards = renderDividendMonthlyCards(calculateDividendMonthlyReturns(points, annual));
  assert.equal((cards.match(/<article/g) ?? []).length, 12);
  assert.match(cards, /is-gain/);
  assert.match(cards, /is-loss/);
  assert.match(cards, /<strong>—<\/strong>/);
  assert.match(cards, /月内累计 · 截至 03-03/);
  assert.doesNotMatch(cards, /NaN|Infinity/);
});

test('return calendar defaults to the latest year monthly view regardless of row order', () => {
  const current = { ...annual, monthlyReturns: calculateDividendMonthlyReturns(points, annual) };
  const previous = { ...annual, year: 2025 };
  for (const rows of [[previous, current], [current, previous]]) {
    const html = renderDividendAnnualPerformance({ rows });
    assert.match(html, /data-dividend-calendar-mode="month" aria-pressed="true"/);
    assert.match(html, /data-dividend-calendar-mode="year" aria-pressed="false"/);
    assert.match(html, /<option value="2026" selected>/);
    assert.match(html, /aria-label="2026年月收益率"/);
    assert.equal((html.match(/class="dividend-month-card /g) ?? []).length, 12);
    assert.match(html, /年内累计收益/);
    assert.doesNotMatch(html, /dividend-annual-table|NaN|Infinity/);
  }
});

test('return calendar still supports explicit annual returns with year/month selection', () => {
  const html = renderDividendAnnualPerformance({ rows: [annual] }, { mode: 'year' });
  assert.match(html, /收益日历：/);
  assert.match(html, /data-dividend-calendar-mode="year" aria-pressed="true"/);
  assert.match(html, /data-dividend-calendar-mode="month" aria-pressed="false"/);
  assert.match(html, /全年收益率/);
  assert.match(html, /年内最大回撤/);
  assert.doesNotMatch(html, /打开年度数据|dividend-calendar-months/);
});

test('monthly calendar selects a year from validated saved returns without replacing missing months by zero', () => {
  const previous = { year: 2025, startDate: '2025-05-26', endDate: '2025-05-30', annualReturn: -10, maxDrawdown: -10, status: '成立首年' };
  previous.monthlyReturns = calculateDividendMonthlyReturns([{ date: previous.startDate, close: 100 }, { date: previous.endDate, close: 90 }], previous);
  const current = { ...annual, monthlyReturns: calculateDividendMonthlyReturns(points, annual) };
  const history = { rows: [previous, current] };
  const html = renderDividendAnnualPerformance(history, { mode: 'month', year: 2025 });
  assert.match(html, /data-dividend-calendar-mode="month" aria-pressed="true"/);
  assert.match(html, /<option value="2025" selected>/);
  assert.match(html, /aria-label="2025年月收益率"/);
  assert.equal((html.match(/class="dividend-month-card /g) ?? []).length, 12);
  assert.match(html, /-10%/);
  assert.match(html, /<strong>—<\/strong>/);
  assert.doesNotMatch(html, /dividend-annual-table|NaN|Infinity/);
  const fallback = renderDividendAnnualPerformance(history, { mode: 'month', year: 1900 });
  assert.match(fallback, /<option value="2026" selected>/);
  assert.match(fallback, /月内累计 · 截至 03-03/);
  assert.match(fallback, /未开始/);
});

test('monthly calendar reports missing or inconsistent data without inventing monthly returns', () => {
  for (const row of [annual, { ...annual, monthlyReturns: calculateDividendMonthlyReturns(points, annual), annualReturn: 99 }]) {
    const html = renderDividendAnnualPerformance({ rows: [row] }, { mode: 'month' });
    assert.match(html, /role="status">该年份的月度数据缺失或校验未通过/);
    assert.doesNotMatch(html, /class="dividend-month-card /);
  }
  assert.match(renderDividendAnnualPerformance({ rows: [] }, { mode: 'month' }), /年度历史数据暂未生成/);
});

test('calendar year arrows disable unavailable years and enable both directions for an interior year', () => {
  const history = { rows: [2024, 2025, 2026].map(year => ({ ...annual, year })) };
  const button = (year, direction) => renderDividendAnnualPerformance(history, { mode: 'month', year })
    .match(new RegExp(`<button[^>]*data-dividend-calendar-step="${direction}"[^>]*>`))?.[0];
  assert.match(button(2026, 1), /aria-label="下一年"[^>]* disabled/);
  assert.doesNotMatch(button(2026, -1), /disabled/);
  assert.match(button(2024, -1), /aria-label="上一年"[^>]* disabled/);
  assert.doesNotMatch(button(2024, 1), /disabled/);
  for (const direction of [-1, 1]) assert.doesNotMatch(button(2025, direction), /disabled/);
  const single = renderDividendAnnualPerformance({ rows: [annual] }, { mode: 'month' });
  assert.equal((single.match(/aria-controls="dividend-calendar-content" disabled/g) ?? []).length, 2);
});

test('monthly calendar shows the selected annual return with precise partial-year labels', () => {
  const history = { rows: [
    { ...annual, year: 2024, annualReturn: -20.66, status: '完整年度' },
    { ...annual, year: 2025, annualReturn: 0, status: '成立首年' },
    { ...annual, year: 2026, annualReturn: 0.19, status: '年内' },
  ] };
  const summary = year => renderDividendAnnualPerformance(history, { mode: 'month', year })
    .match(/<p class="dividend-calendar-total">([\s\S]*?)<\/p>/)?.[1];
  assert.match(summary(2024), /年度总体收益<\/span><strong class="is-loss">-20.66%/);
  assert.match(summary(2025), /成立首年收益<\/span><strong class="is-flat">0%/);
  assert.match(summary(2026), /年内累计收益<\/span><strong class="is-gain">\+0.19%/);
});
