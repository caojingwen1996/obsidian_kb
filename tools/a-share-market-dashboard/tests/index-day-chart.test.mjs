import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderIndexDayChart } from '../scripts/index-day-chart.mjs';

const csv = await readFile(new URL('../../../sources/assets/2026-09-11-index-day-distribution/yearly.csv', import.meta.url), 'utf8');

test('Each detail chart uses its own index and ten complete years', () => {
  const dividend = renderIndexDayChart(csv, 'H30269.CSI');
  const nasdaq = renderIndexDayChart(csv, 'NDX');
  assert.match(dividend, /年均 116.2 天/);
  assert.match(dividend, /并非本页股息率信号使用的中证红利 000922/);
  assert.match(nasdaq, /年均 102.8 天/);
  assert.match(nasdaq, /64 \/ 56 \/ 53/);
  for (const chart of [dividend, nasdaq]) {
    assert.equal((chart.match(/class="index-day-row"/g) || []).length, 11);
    assert.match(chart, /2026\*/);
    assert.match(chart, /静态统计快照/);
  }
  assert.throws(() => renderIndexDayChart('', 'NDX'));
});

test('Chart placeholders are inside the intended detail views', async () => {
  const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.match(template, /id="nasdaq-grid-view"[\s\S]*?<!-- NDX_DAY_CHART -->[\s\S]*?id="position-view"/);
  assert.match(template, /id="dividend-signal-view"[\s\S]*?<!-- DIVIDEND_DAY_CHART -->[\s\S]*?id="valuation-view"/);
});
