import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEastmoneyKlineUrl,
  parseEastmoneyKlines,
  parseCsindexPerformance,
  parseTreasuryYield,
  parseMarketSnapshot,
  parseMarginReport,
} from '../src/adapters.mjs';

test('Eastmoney kline URL encodes the selected index and requested history', () => {
  const url = new URL(buildEastmoneyKlineUrl('1.000300', 3000));
  assert.equal(url.hostname, 'push2his.eastmoney.com');
  assert.equal(url.searchParams.get('secid'), '1.000300');
  assert.equal(url.searchParams.get('lmt'), '3000');
  assert.equal(url.searchParams.get('klt'), '101');
});

test('Eastmoney kline parser maps date and close', () => {
  assert.deepEqual(
    parseEastmoneyKlines({ data: { klines: ['2026-07-17,3500,3510,0,0,0,0,0,0,0,0'] } }),
    [{ date: '2026-07-17', close: 3510 }],
  );
});

test('CSI index performance parser keeps close, rolling PE, and turnover from object rows', () => {
  const row = { tradeDate: '2026-07-17', close: '4000', rollingPES: '12.5', tradingAmount: '123456' };
  assert.deepEqual(parseCsindexPerformance({ data: [row] }), [
    { date: '2026-07-17', close: 4000, ttmPe: 12.5, turnover: 123456 },
  ]);
});

test('CSI index performance parser supports the documented positional rows', () => {
  const row = ['2026-07-17', '000300', '', '', '', '', '', '', '', '4000', '', '', '', '123456', '', '12.5'];
  assert.deepEqual(parseCsindexPerformance({ data: [row] }), [
    { date: '2026-07-17', close: 4000, ttmPe: 12.5, turnover: 12_345_600_000_000 },
  ]);
});

test('CSI index performance parser supports the current live peg and tradingValue fields', () => {
  const row = {
    tradeDate: '20260701',
    close: 4958.98,
    peg: 14.75,
    tradingValue: 11017.18,
  };
  assert.deepEqual(parseCsindexPerformance({ data: [row] }), [
    { date: '2026-07-01', close: 4958.98, ttmPe: 14.75, turnover: 1_101_718_000_000 },
  ]);
});

test('treasury parser extracts China 10-year yield', () => {
  const payload = { result: { data: [{ SOLAR_DATE: '2026-07-17', EMM00166466: '1.75' }] } };
  assert.deepEqual(parseTreasuryYield(payload), [{ date: '2026-07-17', value: 1.75 }]);
});

test('market snapshot counts breadth, limit status, and turnover', () => {
  const payload = { data: { diff: [
    { f3: 10.1, f6: 100, f12: '600000', f14: '甲', f18: 10 },
    { f3: -10.1, f6: 200, f12: '000001', f14: '乙', f18: 10 },
    { f3: 0, f6: 50, f12: '300001', f14: '丙', f18: 20 },
  ] } };
  assert.deepEqual(parseMarketSnapshot(payload), {
    advancers: 1,
    decliners: 1,
    unchanged: 1,
    limitUp: 1,
    limitDown: 1,
    turnover: 350,
    universe: 3,
  });
});

test('market snapshot applies ST and growth-board limit thresholds', () => {
  const payload = { data: { diff: [
    { f3: 5.02, f6: 10, f12: '600001', f14: 'ST甲' },
    { f3: 19.95, f6: 10, f12: '300001', f14: '创业甲' },
    { f3: -19.95, f6: 10, f12: '688001', f14: '科创甲' },
  ] } };
  const result = parseMarketSnapshot(payload);
  assert.equal(result.limitUp, 2);
  assert.equal(result.limitDown, 1);
});

test('margin report parser extracts financing balance by date', () => {
  const payload = { values: {
    '2026-07-16': [1, 100, 0, 0, 0, 0],
    '2026-07-17': [2, 110, 0, 0, 0, 0],
  } };
  assert.deepEqual(parseMarginReport(payload), [
    { date: '2026-07-16', value: 100 },
    { date: '2026-07-17', value: 110 },
  ]);
});
