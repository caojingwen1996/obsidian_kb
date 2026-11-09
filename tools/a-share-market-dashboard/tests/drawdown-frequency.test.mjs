import test from 'node:test';
import assert from 'node:assert/strict';
import { countAnnualDrawdownEvents, renderAnnualDrawdownFrequency, renderNasdaqAnnualPerformance, renderDrawdownSection } from '../src/app.mjs';
const counts = values => countAnnualDrawdownEvents(values.map(close => ({ close })));
test('independent episodes, inclusive thresholds and repeated crossings', () => {
  const result = counts([100, 90, 91, 89, 65, 100, 90]);
  assert.deepEqual(result, {10:2,15:1,20:1,25:1,30:1,35:1,40:0,60:0,80:0});
  assert.equal(counts([100, 20])[80], 1);
  assert.equal(counts([100, 100, 110])[10], 0);
  assert.equal(counts([100]), null);
  assert.equal(counts([]), null);
});
test('heatmap distinguishes missing from zero and lives outside every calendar view', () => {
  const rows = [{year:2026,drawdownCounts:counts([100,90])},{year:2025}];
  const html = renderAnnualDrawdownFrequency(rows);
  assert.equal((html.match(/scope="col"/g)||[]).length,10);
  assert.equal((html.match(/>—<\/td>/g)||[]).length,9);
  assert.match(html,/≥80%/);
  assert.match(html,/各列不可相加/);
  const envelope = {data:{returnHistory:{rows}}};
  assert.doesNotMatch(renderNasdaqAnnualPerformance(envelope,{mode:'year',metric:'drawdown'}),/drawdown-frequency-table/);
  assert.match(renderDrawdownSection(envelope.data.returnHistory,{namespace:'nasdaq'}),/drawdown-frequency-table/);
  assert.doesNotMatch(renderNasdaqAnnualPerformance(envelope,{mode:'year'}),/drawdown-frequency-table/);
});

const totalRow = rows => renderAnnualDrawdownFrequency(rows).match(/<tr class="drawdown-frequency-total">(.*?)<\/tr>/s)[1];
const totalValues = html => [...html.matchAll(/<td[^>]*>(\d+|—)/g)].map(match => match[1]);
test('cumulative counts sum each threshold across years without changing annual scale', () => {
  const rows = [{year:2026,isIntraday:true,drawdownCounts:counts([100,90,100,65])},
    {year:2024,drawdownCounts:counts([100,20])}];
  const total = totalRow(rows);
  assert.deepEqual(totalValues(total), ['3','2','2','2','2','2','1','1','1']);
  assert.match(total,/2024—2026年 · 含暂估/);
  assert.match(total,/已统计2\/2年/);
  assert.match(renderAnnualDrawdownFrequency(rows),/0 → 2<\/span>/);
});
test('cumulative counts expose per-threshold coverage and distinguish zero from unavailable', () => {
  const total = totalRow([{year:2026,drawdownCounts:{10:0,15:2,20:-1,25:1.5,30:'2',35:NaN,40:Infinity,60:null}},
    {year:2025,drawdownCounts:{10:0,15:1}}, {year:2024}]);
  assert.deepEqual(totalValues(total), ['0','3','—','—','—','—','—','—','—']);
  assert.match(total,/>已统计2\/3年<\/small>/);
  assert.match(total,/>已统计0\/3年<\/small>/);
  assert.deepEqual(totalValues(totalRow([{year:2026}])),Array(9).fill('—'));
  assert.deepEqual(totalValues(totalRow([])),Array(9).fill('—'));
  assert.match(totalRow([]),/暂无可统计年份/);
});
