import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIVIDEND_DEFAULT_STRATEGY, DIVIDEND_TRIAL_STORAGE_KEY, scoreDividendInput, interpolateDividend,
  dividendGradeForScore, validateDividendStrategy, confirmDividendRecords, readDividendTrial, saveDividendTrial,
} from '../src/dividend-scoring.mjs';
import { dividendScoringForSignal, renderDividendScorePanel, renderDividendSignalCard, renderDividendSignalDetail, signalFromDividendPayload } from '../src/app.mjs';
import { createMemoryStorage } from '../src/data-service.mjs';

const cases = JSON.parse(readFileSync(new URL('../../../.agents/skills/zzhl-dividend-signal/tests/scoring-cases-v2.json', import.meta.url), 'utf8'));
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
  for (const [value, grade] of [[39.99999, 'D'], [40, 'C'], [47.99999, 'C'], [48, 'B'], [64.99999, 'B'], [65, 'A']]) assert.equal(dividendGradeForScore(value), grade);
  for (const value of [NaN, Infinity, true, '4', undefined]) assert.equal(scoreDividendInput({ percentile: value, dividendYield: value, bondYield: value }).score, null);
  const result = scoreDividendInput(cases[0].input, DIVIDEND_DEFAULT_STRATEGY, { ...dates, bond: '2026-10-12' }, 'proxy', true);
  assert.equal(result.eligible, false);
  assert.ok(result.quality.includes('日期未对齐'));
});

test('parameter validation and browser persistence preserve defaults', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  const original = JSON.stringify(DIVIDEND_DEFAULT_STRATEGY);
  const storage = createMemoryStorage();
  strategy.weights = { absolute: 60, ratio: 40 };
  saveDividendTrial(storage, strategy);
  assert.deepEqual(readDividendTrial(storage), strategy);
  assert.equal(JSON.stringify(DIVIDEND_DEFAULT_STRATEGY), original);
  storage.setItem(DIVIDEND_TRIAL_STORAGE_KEY, '{bad');
  assert.deepEqual(readDividendTrial(storage), DIVIDEND_DEFAULT_STRATEGY);
  assert.throws(() => saveDividendTrial({ setItem() { throw Error('blocked'); } }, strategy), /blocked/);
  for (const change of [c => { c.weights.ratio = 0; }, c => { c.thresholds.C = 80; }, c => { c.confirmationDays = 2.5; }, c => { c.anchors.ratio[1][0] = 1; }, c => { c.weights.absolute = -1; }]) {
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
  assert.match(html, /45.5/); assert.match(html, /C · 等待区间/);
  assert.doesNotMatch(html, /历史分位/); assert.match(html, /贡献/); assert.match(html, /锚点|端点|÷/);
  assert.doesNotMatch(html, /连续确认|确认状态|证据不足/);
  const card = renderDividendSignalCard(signal);
  assert.match(card, /45.5/); assert.match(card, /C · 等待区间/);
  assert.doesNotMatch(card, /未进重点买入/);
  assert.throws(() => signalFromDividendPayload({}), /格式无效/);
  const legacy = dividendScoringForSignal({ dividendYield2: 4.13, bond10yYield: 1.67, lixingerPercentile10y: '35.83%', indexDate: dates.index, lixingerDate: dates.percentile, bondDate: dates.bond });
  close(legacy.score, score.score); assert.ok(legacy.quality.includes('历史数据试算')); assert.equal(legacy.eligible, false);
});

test('only composite A is emphasized for buying and archived labels use the current policy', () => {
  const oldLabels = { A: '重点配置区间', B: '加大买入区间', C: '基础配置区间', D: '吸引力偏弱' };
  const labels = { A: '买入区间', B: '观察区间', C: '等待区间', D: '不买入' };
  const base = scoreDividendInput({ dividendYield: 5.5, bondYield: 2 }, DIVIDEND_DEFAULT_STRATEGY, dates);
  for (const grade of ['A', 'B', 'C', 'D']) {
    const archived = { ...base, grade, label: oldLabels[grade] };
    const signal = { scoring: archived, indexDate: dates.index, bondDate: dates.bond, dividendYield2: 5.5, bond10yYield: 2 };
    assert.equal(dividendScoringForSignal(signal).label, labels[grade]);
    assert.equal(archived.label, oldLabels[grade]);
    const card = renderDividendSignalCard(signal);
    assert.equal(card.includes(' is-focus'), grade === 'A');
    assert.ok(card.includes(`${grade} · ${labels[grade]}`));
    const detail = renderDividendSignalDetail(signal, { yieldHistory: [], indexHistory: [] });
    assert.match(detail, /仅 A 级可买入，B \/ C \/ D 均不买入/);
    assert.doesNotMatch(detail, /加大买入|基础配置/);
    assert.ok(renderDividendScorePanel(archived).includes(`${grade} · ${labels[grade]}`));
  }
});

test('zero-weight percentile is optional and cannot alter score, eligibility or source context', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  strategy.weights = { absolute: 92, ratio: 8 };
  const dates = { index: '2026-07-01', bond: '2026-07-01' };
  const a = scoreDividendInput({ dividendYield: 5, bondYield: 2 }, strategy, dates);
  const b = scoreDividendInput({ percentile: 100, dividendYield: 5, bondYield: 2 }, strategy, { ...dates, percentile: '2027-01-01' }, 'different');
  assert.ok(Math.abs(a.score - 61.6) < 1e-9);
  assert.equal(a.eligible, true);
  assert.equal(a.score, b.score);
  assert.equal(a.sourceKey, b.sourceKey);
  assert.deepEqual(Object.keys(a.components), ['absolute', 'ratio']);
  assert.equal(Object.hasOwn(a.input, 'percentile'), false);
  assert.equal(Object.hasOwn(b.dates, 'percentile'), false);
  assert.equal(b.eligible, true);
  const badBond = scoreDividendInput({ dividendYield: 5, bondYield: 2 }, strategy, { ...dates, bond: '2026-06-30' });
  assert.equal(badBond.eligible, false);
  assert.equal(scoreDividendInput({ dividendYield: 5 }, strategy, dates).score, null);
  strategy.weights = { absolute: -1, ratio: 101 };
  assert.ok(validateDividendStrategy(strategy).length);
});

test('retired browser drafts migrate to the adopted two-factor defaults', () => {
  const storage = createMemoryStorage();
  storage.setItem(DIVIDEND_TRIAL_STORAGE_KEY, JSON.stringify({ ...DIVIDEND_DEFAULT_STRATEGY, weights: { percentile: 15, absolute: 82, ratio: 3 } }));
  assert.deepEqual(readDividendTrial(storage), DIVIDEND_DEFAULT_STRATEGY);
});
