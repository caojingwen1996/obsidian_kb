import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIVIDEND_DEFAULT_STRATEGY, DIVIDEND_TRIAL_STORAGE_KEY, scoreDividendInput, interpolateDividend,
  dividendGradeForScore, validateDividendStrategy, confirmDividendRecords, readDividendTrial, saveDividendTrial,
} from '../src/dividend-scoring.mjs';
import { dividendScoringForSignal, renderDividendScorePanel, renderDividendSignalCard, signalFromDividendPayload } from '../src/app.mjs';
import { createMemoryStorage } from '../src/data-service.mjs';

const cases = JSON.parse(readFileSync(new URL('../../../.agents/skills/zzhl-dividend-signal/tests/scoring-cases.json', import.meta.url), 'utf8'));
const dates = { index: '2026-10-13', percentile: '2026-10-13', bond: '2026-10-13' };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('shared Python/JS scoring cases', () => {
  for (const fixture of cases) {
    const result = scoreDividendInput(fixture.input, DIVIDEND_DEFAULT_STRATEGY, dates, 'official');
    assert.equal(result.grade, fixture.grade, fixture.name);
    if (fixture.score === null) {
      assert.equal(result.score, null);
      close(result.lower, fixture.lower); close(result.upper, fixture.upper);
    } else close(result.score, fixture.score);
    Object.values(result.components).forEach((c, i) => fixture.components[i] === null
      ? assert.equal(c.score, null) : close(c.score, fixture.components[i]));
  }
});

test('anchors, interpolation, unrounded grading and invalid inputs', () => {
  for (const anchors of Object.values(DIVIDEND_DEFAULT_STRATEGY.anchors)) {
    for (const [x, score] of anchors) assert.equal(interpolateDividend(x, anchors).score, score);
    const left = anchors[1], right = anchors[2];
    close(interpolateDividend((left[0] + right[0]) / 2, anchors).score, (left[1] + right[1]) / 2);
  }
  for (const [value, grade] of [[39.99999, 'D'], [40, 'C'], [59.99999, 'C'], [60, 'B'], [79.99999, 'B'], [80, 'A']]) assert.equal(dividendGradeForScore(value), grade);
  for (const value of [NaN, Infinity, true, '4', undefined]) assert.equal(scoreDividendInput({ percentile: value, dividendYield: value, bondYield: value }).score, null);
  const result = scoreDividendInput(cases[0].input, DIVIDEND_DEFAULT_STRATEGY, { ...dates, bond: '2026-10-12' }, 'proxy', true);
  assert.equal(result.eligible, false);
  assert.ok(result.quality.includes('参考评分')); assert.ok(result.quality.includes('日期未对齐'));
});

test('parameter validation and browser persistence preserve defaults', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  const original = JSON.stringify(DIVIDEND_DEFAULT_STRATEGY);
  const storage = createMemoryStorage();
  strategy.weights = { percentile: 50, absolute: 30, ratio: 20 };
  saveDividendTrial(storage, strategy);
  assert.deepEqual(readDividendTrial(storage), strategy);
  assert.equal(JSON.stringify(DIVIDEND_DEFAULT_STRATEGY), original);
  storage.setItem(DIVIDEND_TRIAL_STORAGE_KEY, '{bad');
  assert.deepEqual(readDividendTrial(storage), DIVIDEND_DEFAULT_STRATEGY);
  assert.throws(() => saveDividendTrial({ setItem() { throw Error('blocked'); } }, strategy), /blocked/);
  for (const change of [c => { c.weights.ratio = 0; }, c => { c.thresholds.C = 80; }, c => { c.confirmationDays = 2.5; }, c => { c.anchors.ratio[1][0] = 1; }, c => { c.anchors.percentile[4][0] = 99; }]) {
    const bad = structuredClone(strategy); change(bad); assert.ok(validateDividendStrategy(bad).length);
    assert.throws(() => scoreDividendInput(cases[0].input, bad));
  }
});

test('confirmation counts actual trading dates, gaps and changes in evidence', () => {
  const calendar = ['2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
  const make = (day, grade = 'B', sourceKey = 'official', eligible = true, strategyVersion = 'v1') => ({ dates: { index: day }, grade, sourceKey, eligible, strategyVersion });
  const base = calendar.slice(0, 3).map(day => make(day));
  assert.equal(confirmDividendRecords(base, calendar).status, 'established');
  assert.equal(confirmDividendRecords([...base, make(calendar[2])], calendar).status, 'established');
  assert.equal(confirmDividendRecords([base[0], base[2]], calendar).count, 1);
  assert.equal(confirmDividendRecords([...base, ...calendar.slice(3).map(day => make(day, 'A'))], calendar).status, 'changed');
  assert.equal(confirmDividendRecords([...base, make(calendar[3], 'A'), make(calendar[4], 'C')], calendar).count, 1);
  assert.equal(confirmDividendRecords([...base, make(calendar[3], 'B', 'proxy')], calendar).baseline, null);
  assert.equal(confirmDividendRecords([...base, make(calendar[3], 'B', 'official', true, 'v2')], calendar).baseline, null);
  assert.equal(confirmDividendRecords([...base, make(calendar[3], 'A', 'official', false)], calendar).status, 'insufficient');
  assert.equal(confirmDividendRecords([...base, make(calendar[3], 'A', 'proxy', false)], calendar).baseline, null);
  assert.equal(confirmDividendRecords(base, [calendar[0]]).status, 'insufficient');
});

test('structured and legacy signals show numbers, contribution reasons and real provenance', () => {
  const score = scoreDividendInput(cases[0].input, DIVIDEND_DEFAULT_STRATEGY, dates, 'proxy', true, 'snapshot');
  const payload = { schemaVersion: 1, strategy: DIVIDEND_DEFAULT_STRATEGY, latest: { ...score, raw: { source_note: '中证官方指数推算' } }, records: [score], tradingDates: [] };
  const signal = signalFromDividendPayload(payload);
  const html = renderDividendScorePanel(signal.scoring);
  assert.match(html, /38.0/); assert.match(html, /D · 吸引力偏弱/);
  assert.match(html, /历史分位/); assert.match(html, /贡献/); assert.match(html, /锚点|端点|÷/);
  assert.match(html, /参考评分/); assert.match(html, /证据不足/);
  const card = renderDividendSignalCard(signal);
  assert.match(card, /38.0/); assert.match(card, /D · 吸引力偏弱/);
  assert.doesNotMatch(card, /未进重点买入/);
  assert.throws(() => signalFromDividendPayload({}), /格式无效/);
  const legacy = dividendScoringForSignal({ dividendYield2: 4.13, bond10yYield: 1.67, lixingerPercentile10y: '35.83%', indexDate: dates.index, lixingerDate: dates.percentile, bondDate: dates.bond });
  close(legacy.score, score.score); assert.ok(legacy.quality.includes('历史数据试算')); assert.equal(legacy.eligible, false);
});
