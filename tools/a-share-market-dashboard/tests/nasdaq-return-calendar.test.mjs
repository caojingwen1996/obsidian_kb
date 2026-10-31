import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDividendAnnualPerformance, renderNasdaqAnnualPerformance, renderDividendMonthlyCards } from '../src/app.mjs';
const row = { year: 2026, startDate: '2026-01-02', endDate: '2026-02-27', annualReturn: -1, maxDrawdown: -20, status: '年内',
  monthlyReturns: Array.from({length:12}, (_, i) => ({month:i+1, value:i===0?10:i===1?-10:null, startDate:i===0?'2026-01-02':'2026-01-30', endDate:i===0?'2026-01-30':'2026-02-27', status:i>1?'未开始':'已统计'})) };
const history = {rows:[row], firstDate:row.startDate, lastDate:row.endDate, source:'NDX'};
test('Nasdaq calendar isolates controls and supports annual and monthly views', () => {
  const html = renderNasdaqAnnualPerformance({data:{returnHistory:history}});
  assert.match(html, /data-nasdaq-calendar-mode="year"/);
  assert.match(html, /id="nasdaq-calendar-content"/);
  assert.equal((html.match(/class="dividend-month-card /g)||[]).length,12);
  assert.doesNotMatch(html,/data-dividend-/);
  const annual = renderNasdaqAnnualPerformance({data:{returnHistory:history}}, {mode:'year'});
  assert.match(annual, /data-nasdaq-year="2026"/);
  assert.match(annual, /年内最大回撤/);
  assert.doesNotMatch(annual,/aria-haspopup="dialog"/);
  assert.match(renderDividendAnnualPerformance(history,{mode:'year'}), /aria-haspopup="dialog"/);
});
test('Loading, unavailable and inconsistent monthly data are explicit', () => {
  assert.match(renderNasdaqAnnualPerformance({status:'loading'}), /正在读取/);
  assert.match(renderNasdaqAnnualPerformance({status:'missing'}), /刷新数据/);
  assert.match(renderNasdaqAnnualPerformance({data:{returnHistory:{...history, rows:[{...row,annualReturn:100}]}}}), /校验未通过/);
});

test('monthly metric buttons switch values, preserve missing data and isolate the dividend page', () => {
  const months = [{month:1,value:10,maxDrawdown:-20,endDate:'2026-01-30',status:'已统计'},
    {month:2,value:1,maxDrawdown:0,endDate:'2026-02-27',status:'已统计'},
    {month:3,value:null,maxDrawdown:null,status:'未开始'},
    {month:4,value:5,maxDrawdown:10,endDate:'2026-04-30',status:'已统计'}];
  const returns = renderDividendMonthlyCards(months);
  const drawdowns = renderDividendMonthlyCards(months,{metric:'drawdown'});
  assert.match(returns, /<strong>\+10%<\/strong>/);
  assert.doesNotMatch(drawdowns, /\+10%/);
  assert.match(drawdowns, /<strong>-20%<\/strong>/);
  assert.match(drawdowns, /<strong>0%<\/strong>/);
  assert.equal((drawdowns.match(/<strong>—/g)||[]).length,2);
  assert.match(drawdowns,/数据不足/);
  const html = renderNasdaqAnnualPerformance({data:{returnHistory:history}},{metric:'drawdown'});
  assert.match(html,/data-nasdaq-calendar-metric="drawdown" aria-pressed="true"/);
  assert.match(html,/月度最大回撤按当月/);
  assert.doesNotMatch(renderDividendAnnualPerformance(history),/data-nasdaq-calendar-metric/);
  assert.match(renderDividendAnnualPerformance(history),/data-dividend-calendar-metric="drawdown"/);
});
