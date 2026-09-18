import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNasdaqEtfHistory, applyNasdaqEtfAnchor, renderNasdaqGridStrategy, calculateNasdaqGridPlan } from '../src/app.mjs';
const anchor = JSON.parse(readFileSync(new URL('../data/nasdaq-etf-anchor.json', import.meta.url), 'utf8'));
test('saved ETF anchor matches captured completed history', () => {
 const payload = JSON.parse(readFileSync(new URL('../data/nasdaq-etf-history.json', import.meta.url), 'utf8'));
 const data = parseNasdaqEtfHistory(payload, new Date('2026-09-17T02:59:00Z'));
 assert.equal(data.highPrice, anchor.highPrice);
 assert.equal(data.highDate, anchor.highDate);
 assert.equal(data.date, anchor.anchorEndDate);
});
test('later higher prices cannot move fixed grid prices', () => {
 const data = applyNasdaqEtfAnchor({highPrice:9,highDate:'2026-09-18',close:2,date:'2026-09-18'},anchor);
 assert.equal(data.highPrice,anchor.highPrice);
 assert.equal(data.drawdownPercent,(2/anchor.highPrice-1)*100);
 assert.deepEqual(calculateNasdaqGridPlan(10000,null,data.highPrice).levels.map(x=>x.buyPrice),[1.613,1.551,1.489,1.427,1.365,1.303,1.241]);
});
test('loading and network failures preserve fixed prices without trigger claims', () => {
 for(const status of ['loading','missing']) {
  const view = renderNasdaqGridStrategy({status,data:anchor,error:'HTTP 502'},10000);
  assert.match(view.rowsHtml,/<td>1\.613<\/td>/);
  assert.doesNotMatch(view.rowsHtml,/is-triggered|is-next/);
  assert.match(view.summaryHtml,/待判断/);
  assert.match(view.referenceText,/固定前高/);
 }
});
test('intraday ETF candle is not described as a completed close', () => {
 const payload={data:{klines:['2026-09-16,1,1.5,1.6,1,1','2026-09-17,1,1.7,1.8,1,1']}};
 assert.equal(parseNasdaqEtfHistory(payload,new Date('2026-09-17T02:00:00Z')).close,1.5);
 assert.equal(parseNasdaqEtfHistory(payload,new Date('2026-09-17T08:00:00Z')).close,1.7);
});
