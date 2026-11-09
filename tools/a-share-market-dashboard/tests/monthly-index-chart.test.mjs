import test from 'node:test';
import assert from 'node:assert/strict';
import { indexYearPoints, renderMonthlyIndexChart } from '../src/monthly-index-chart.mjs';
import { buildDividendLiveReturnHistory, renderNasdaqAnnualPerformance } from '../src/app.mjs';
const points = [{date:'2026-01-02',close:100},{date:'2026-01-05',close:110},{date:'2026-02-02',close:90},{date:'2026-02-03',close:105}];
const annual = {year:2026,startDate:'2026-01-02',endDate:'2026-02-03',annualReturn:5};
test('curve requires matching endpoints and returns, sorts and validates daily prices', () => {
  assert.deepEqual(indexYearPoints([...points].reverse(), annual),points);
  for (const input of [points.slice(1),points.slice(0,-1),[...points,{...points[0],close:99}],points.map(p=>({...p,close:p.close+30}))]) assert.deepEqual(indexYearPoints(input,annual),[]);
  assert.deepEqual(indexYearPoints([...points,{date:'2026-02-30',close:99},{date:'2026-01-08',close:NaN}],annual),points);
});
test('live dividends retain the same annual daily series and quote replacement as the monthly calendar', () => {
  const result = buildDividendLiveReturnHistory({rows:[annual]},points,{asOf:new Date('2026-02-03T09:00:00Z')});
  assert.deepEqual(result.rows[0].daily,points);
  assert.deepEqual(indexYearPoints(result.rows[0].daily,result.rows[0]),points);
  const envelope = {data:{returnHistory:result}};
  assert.match(renderNasdaqAnnualPerformance(envelope),/monthly-index-row/);
  assert.match(renderNasdaqAnnualPerformance(envelope),/data-index-month="1"/);
  assert.match(renderNasdaqAnnualPerformance(envelope,{mode:'year'}),/data-index-chart/);
});
test('unavailable data renders an explicit state, never a synthetic line', () => {
  const html = renderMonthlyIndexChart(annual,{namespace:'dividend',points:[],error:'<failed>'});
  assert.match(html,/&lt;failed&gt;/);
  assert.match(html,/重新读取日线/);
  assert.doesNotMatch(html,/<svg/);
});

test('annual chart combines only independently validated years and exposes year selection', () => {
  const valid={...annual,daily:points};
  const missing={...annual,year:2025,startDate:'2025-01-02',endDate:'2025-12-31'};
  const html=renderNasdaqAnnualPerformance({data:{returnHistory:{rows:[valid,missing],firstDate:missing.startDate,lastDate:annual.endDate}}},{mode:'year'});
  assert.match(html,/data-index-year="2026" aria-pressed="false"\s+aria-label/);
  assert.match(html,/data-index-year="2025" aria-pressed="false" disabled/);
  assert.match(html,/已核验日线覆盖1\/2个年度/);
  assert.match(html,/annual-index-row/);
});
