import test from 'node:test';
import assert from 'node:assert/strict';
import { countDailyDropEvents, buildDailyDropRows, renderDrawdownStatistics, renderAnnualDrawdownFrequency, bindDrawdownStatistics, renderDividendAnnualPerformance, renderDrawdownSection } from '../src/app.mjs';
const pair = close => [{date:'2025-01-02',close:100},{date:'2025-01-03',close}];
test('strict daily thresholds, cumulative counts and floating point boundaries', () => {
  for (const [close, expected] of [[95,[0,0,0]],[92,[1,0,0]],[90,[1,1,0]],[89,[1,1,1]],[100,[0,0,0]],[101,[0,0,0]],[94.999,[1,0,0]]]) {
    assert.deepEqual(Object.values(countDailyDropEvents(pair(close)).counts), expected);
  }
  assert.deepEqual(countDailyDropEvents([...pair(89),{date:'2025-01-06',close:79}]),{counts:{5:2,8:2,10:2},comparedDays:2});
});
test('absent, invalid and distant baselines are excluded, never fabricated as zero', () => {
  assert.equal(countDailyDropEvents([]).counts,null);
  assert.equal(countDailyDropEvents(pair(89).slice(1)).counts,null);
  assert.equal(countDailyDropEvents([{date:'2025-01-01',close:100},{date:'2025-01-02',close:null},{date:'2025-01-03',close:80}]).counts,null);
  assert.equal(countDailyDropEvents([{date:'2025-02-01',close:80}],{date:'2025-01-01',close:100}).counts,null);
});
test('December baseline carries into January; intraday estimates are excluded', () => {
  const rows=[{year:2026,endDate:'2026-01-05',isIntraday:true,chartPoints:[{date:'2026-01-02',close:89},{date:'2026-01-05',close:50}]},
    {year:2025,chartPoints:[{date:'2025-12-30',close:100},{date:'2025-12-31',close:100}]}];
  const result=buildDailyDropRows(rows);
  assert.deepEqual(result[0].dailyDropCounts,{5:1,8:1,10:1});
  assert.match(result[0].status,/已比较1日 · 不含盘中/);
  assert.equal(result[0].isIntraday,false);
  assert.deepEqual(result[1].dailyDropCounts,{5:0,8:0,10:0});
  assert.equal(buildDailyDropRows([{year:2025},{year:2026,chartPoints:[{date:'2026-01-02',close:89}]}])[0].dailyDropCounts,null);
});
test('daily totals expose missing coverage and exactly three thresholds', () => {
  const html=renderAnnualDrawdownFrequency([{year:2026,dailyDropCounts:{5:2,8:1,10:0}},{year:2025,dailyDropCounts:{5:1,8:1,10:0}},{year:2024}],{daily:true});
  assert.match(html,/累计单日下跌次数/);
  assert.match(html,/已统计2\/3年/);
  assert.equal((html.match(/scope="col"/g)||[]).length,4);
  assert.match(html,/严格超过5%、8%、10%/);
  assert.match(html,/各列不可相加/);
  const total=html.match(/<tr class="drawdown-frequency-total">(.*?)<\/tr>/s)[1];
  assert.deepEqual([...total.matchAll(/<button[^>]*>(\d+)<\/button>/g)].map(m=>Number(m[1])),[3,2,0]);
});
test('disclosure defaults closed and remembers toggles separately by instrument', () => {
  let listener;
  bindDrawdownStatistics({addEventListener(type, callback, capture){assert.equal(type,'toggle');assert.equal(capture,true);listener=callback;}});
  assert.doesNotMatch(renderDrawdownStatistics([],'nasdaq'),/data-drawdown-statistics="nasdaq" open/);
  listener({target:{dataset:{drawdownStatistics:'nasdaq'},open:true}});
  assert.match(renderDrawdownStatistics([],'nasdaq'),/data-drawdown-statistics="nasdaq" open/);
  assert.doesNotMatch(renderDrawdownStatistics([],'dividend'),/data-drawdown-statistics="dividend" open/);
  listener({target:{dataset:{drawdownStatistics:'nasdaq'},open:false}});
});
test('all instruments compute daily counts from validated calendar history', () => {
  const daily=pair(89);
  const history={rows:[{year:2025,startDate:daily[0].date,endDate:daily[1].date,daily}]};
  for(const namespace of ['nasdaq','dividend','spdividend']) {
    const html=renderDrawdownSection(history,{namespace});
    assert.doesNotMatch(renderDividendAnnualPerformance(history,{mode:'year',metric:'drawdown',namespace}),/data-drawdown-statistics/);
    assert.match(html,new RegExp(`data-drawdown-statistics="${namespace}"`));
    assert.match(html,/单日跌幅>10%：1次/);
  }
});
