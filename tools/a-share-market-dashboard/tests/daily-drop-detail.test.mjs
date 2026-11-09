import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDailyDropDetail,renderDailyDropDetail} from '../src/daily-drop-detail.mjs';
import {DAILY_DROP_REFERENCE} from '../src/daily-drop-reference.mjs';
import {countDailyDropEvents,buildDailyDropRows} from '../src/app.mjs';
const row=(year,points,extra={})=>({year,chartPoints:points.map(([date,close])=>({date,close})),...extra});

test('event details and summary share strict threshold and missing baseline rules',()=>{
 const rows=[row(2025,[['2025-12-30',100],['2025-12-31',95]]),row(2026,[['2026-01-02',85.5],['2026-01-05',75]])];
 for(const threshold of [5,8,10]){
  const expected=buildDailyDropRows(rows).reduce((sum,r)=>sum+(r.dailyDropCounts?.[threshold]??0),0);
  assert.equal(buildDailyDropDetail(rows,{threshold}).length,expected);
 }
 assert.deepEqual(buildDailyDropDetail(rows,{threshold:10}).map(e=>e.date),['2026-01-05']);
 assert.equal(buildDailyDropDetail(rows,{threshold:5,year:2025}).length,0);
 assert.throws(()=>buildDailyDropDetail(rows,{threshold:6}),/不支持/);
});
test('forward returns use the 1st, 5th, 250th trading observations from event close and stay missing at end',()=>{
 const daily=[];
 for(let date=new Date('2024-01-02T00:00:00Z');daily.length<260;date.setUTCDate(date.getUTCDate()+1)){
  if([0,6].includes(date.getUTCDay()))continue;
  const i=daily.length;daily.push([date.toISOString().slice(0,10),i===0?100:80+i-1]);
 }
 const rows=[row(2024,daily.filter(p=>p[0].startsWith('2024'))),row(2025,daily.filter(p=>p[0].startsWith('2025')))];
 const event=buildDailyDropDetail(rows)[0];
 assert.equal(event.date,daily[1][0]);assert.ok(Math.abs(event.drawdown+20)<1e-9);
 for(const [i,offset] of [1,5,250].entries()){
  assert.equal(event.forward[i].date,daily[1+offset][0]);
  assert.ok(Math.abs(event.forward[i].value-(daily[1+offset][1]/80-1)*100)<1e-10);
 }
 const recent=buildDailyDropDetail([row(2026,[['2026-01-02',100],['2026-01-05',80]])])[0];
 assert.ok(recent.forward.every(r=>r.value===null&&r.reason==='后续交易日不足'));
});
test('peak uses only prior loaded prices; intraday and discontinuous future observations are excluded',()=>{
 const rows=[row(2026,[['2026-01-02',100],['2026-01-05',80],['2026-01-20',200],['2026-01-21',50]],{isIntraday:true,endDate:'2026-01-21'})];
 const events=buildDailyDropDetail(rows);
 assert.equal(events.length,1);assert.ok(Math.abs(events[0].drawdown+20)<1e-9);
 assert.equal(events[0].forward[0].value,null);assert.equal(events[0].forward[0].reason,'区间日线不连续');
});
test('reference notes have 61 unique dates, preserve estimates including percentile zero, and never leak to other instruments',()=>{
 assert.equal(DAILY_DROP_REFERENCE.rows.length,61);
 assert.equal(new Set(DAILY_DROP_REFERENCE.rows.map(r=>r.date)).size,61);
 const rows=[row(2011,[['2011-08-05',100],['2011-08-08',90]])];
 const event=buildDailyDropDetail(rows)[0];assert.equal(event.annotation.percentileEstimate,0);
 assert.equal(buildDailyDropDetail(rows,{namespace:'dividend'})[0].annotation,null);
 const html=renderDailyDropDetail({rows,namespace:'nasdaq',source:'test'},{threshold:5,year:'all'});
 assert.match(html,/参考图估算／事件归纳/);assert.match(html,/非当时可得分位/);assert.match(html,/>0<\/span>/);
 assert.match(html,/主权信用/);assert.match(html,/后续交易日不足/);
 const absent=renderDailyDropDetail({rows,namespace:'nasdaq'},{threshold:10,year:'all'});
 assert.match(absent,/暂无超过该阈值/);
 const other=renderDailyDropDetail({rows,namespace:'dividend'},{threshold:5,year:'all'});
 assert.match(other,/估值列显示“—”，事件注释显示“待补充”/);
});
test('historical reference dates and threshold counts match the saved NDX sample',()=>{
 const {daily}=JSON.parse(readFileSync(new URL('../data/市场总览/nasdaq100-historical-seed.json',import.meta.url),'utf8'));
 const rows=[...new Set(daily.map(p=>Number(p.date.slice(0,4))))].map(year=>({year,chartPoints:daily.filter(p=>Number(p.date.slice(0,4))===year)}));
 for(const threshold of [5,8,10])assert.equal(buildDailyDropDetail(rows,{threshold}).length,countDailyDropEvents(daily).counts[threshold]);
 for(const event of buildDailyDropDetail(rows))assert.ok(event.annotation,`missing reference for ${event.date}`);
});
