import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNasdaqEtfHistory, renderNasdaqGridStrategy, calculateNasdaqGridPlan } from '../src/app.mjs';

const now = new Date('2026-09-18T02:00:00Z');
const history = klines => ({ data: { klines }, proxySource: '测试行情' });

test('local history provides a calculated snapshot instead of a fixed anchor', () => {
  const payload = JSON.parse(readFileSync(new URL('../data/市场总览/nasdaq-etf-history.json', import.meta.url), 'utf8'));
  const data = parseNasdaqEtfHistory(payload, now);
  assert.equal(data.highPrice, 1.773);
  assert.equal(data.highDate, '2026-06-01');
  assert.equal(data.date, '2026-09-17');
});

test('new highs recalculate drawdown, all grid prices and the next level together', () => {
  const previous = parseNasdaqEtfHistory(history(['2026-09-16,1.7,1.7,1.773,1.6,1']), now);
  const current = parseNasdaqEtfHistory(history(['2026-09-16,1.7,1.7,1.773,1.6,1', '2026-09-17,1.8,1.8,2,1.7,1']), now);
  const before = calculateNasdaqGridPlan(10000, previous.drawdownPercent, previous.highPrice);
  const after = calculateNasdaqGridPlan(10000, current.drawdownPercent, current.highPrice);
  assert.equal(current.highPrice, 2);
  assert.equal(current.highDate, '2026-09-17');
  assert.ok(Math.abs(current.drawdownPercent + 10) < 1e-10);
  assert.equal(before.nextLevel.level, 1);
  assert.equal(after.nextLevel.level, 2);
  assert.deepEqual(after.levels.map(x => x.buyPrice), [1.82, 1.75, 1.68, 1.61, 1.54, 1.47, 1.4]);
  assert.equal(after.triggeredAmount, 10000);
  assert.notDeepEqual(before.levels.map(x => x.buyPrice), after.levels.map(x => x.buyPrice));
});

test('each response uses its own adjustment basis without retaining an old maximum', () => {
  const previous = parseNasdaqEtfHistory(history(['2026-09-16,2,2,2.2,1,1']), now);
  const revised = parseNasdaqEtfHistory(history(['2026-09-16,1,1,1.6,1,1']), now);
  assert.equal(previous.highPrice, 2.2);
  assert.equal(revised.highPrice, 1.6);
});

test('intraday highs participate immediately but the trigger uses a completed close', () => {
  const payload = history(['2026-09-17,1,1.5,1.6,1,1', '2026-09-18,1,1.7,1.8,1,1', '2026-09-19,1,2,9,1,1']);
  const intraday = parseNasdaqEtfHistory(payload, now);
  assert.equal(intraday.highPrice, 1.8);
  assert.equal(intraday.highDate, '2026-09-18');
  assert.equal(intraday.endDate, '2026-09-18');
  assert.equal(intraday.close, 1.5);
  assert.equal(intraday.date, '2026-09-17');
  assert.equal(intraday.drawdownPercent, (1.5 / 1.8 - 1) * 100);
  assert.equal(parseNasdaqEtfHistory(payload, new Date('2026-09-18T07:00:00Z')).close, 1.7);
});

test('loading and failed updates disclose retained calculations without trigger claims', () => {
  const data = parseNasdaqEtfHistory(history(['2026-09-17,1.7,1.7,2,1.6,1']), now);
  for (const status of ['snapshot', 'loading', 'missing']) {
    const view = renderNasdaqGridStrategy({ status, data, error: status === 'missing' ? 'HTTP 502' : '' }, 10000);
    assert.ok(view.rowsHtml.includes('<td>1.820</td>'));
    assert.doesNotMatch(view.rowsHtml, /is-triggered|is-next/);
    assert.match(view.summaryHtml, /待判断/);
    assert.match(view.referenceText, /动态前高.*沿用上次计算结果/);
    assert.doesNotMatch(view.referenceText, /固定前高|不随刷新变化/);
  }
});

test('invalid or incomplete history cannot produce a verified peak', () => {
  for (const rows of [[], ['2026-09-18,1,1.7,1.8,1,1'], ['2026-09-17,1,Infinity,2,1,1'], ['2026-09-17,1,2,1,1,1'], ['2026-02-30,1,1,2,1,1']]) {
    assert.throws(() => parseNasdaqEtfHistory(history(rows), now));
  }
});
