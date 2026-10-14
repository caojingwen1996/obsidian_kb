import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { openDividendSignalSource, renderDividendSignalDetail, renderDividendStrategyDetails, applyDailyDividendStrategy, loadDailyDividendStrategy } from '../src/app.mjs';
import { DIVIDEND_DEFAULT_STRATEGY } from '../src/dividend-scoring.mjs';

const signal = {
  absoluteSignal: 'C（小额定投）', spreadSignal: 'C（小额定投）', percentileSignal: '待验证',
  dividendYield2: 4.28, bond10yYield: 1.67, spread: 2.61,
  headline: '历史分位点待验证，暂不判定加大买入区间', indexDate: '2026-09-29', status: 'latest',
};

test('signal source uses the native application action while strategy details stay below metrics', () => {
  const html = renderDividendSignalDetail(signal);
  assert.match(html, /<button[^>]+data-open-dividend-source[^>]*>打开信号源（Excel）<\/button>/);
  assert.doesNotMatch(html, /obsidian:\/\/open/);
  const filePath = 'sources/automations/中证红利信号/中证红利每日信号.xlsx';
  assert.ok(existsSync(new URL(`../../${filePath}`, new URL('../a-share-market-dashboard.html', import.meta.url))));
  assert.ok(html.indexOf('红利信号核心指标') < html.indexOf('id="dividend-strategy-heading"'));
  assert.match(html, /<\/article>\s*<article class="dividend-yield-chart-card">/);
  assert.ok(html.indexOf('dividend-detail-summary') < html.indexOf('dividend-yield-chart-card'));
  assert.ok(html.indexOf('dividend-yield-chart-card') < html.indexOf('每日记录结果'));
  assert.doesNotMatch(html, /年度收益与最大回撤/);
  assert.doesNotMatch(html, /<h3>历史分位点<\/h3>|<small>市值加权股息率<\/small>/);
});

const localLocation = { protocol: 'http:', hostname: '127.0.0.1' };

test('opening the signal posts to the local service and confirms dispatch', async () => {
  const result = await openDividendSignalSource(async (url, options) => {
    assert.equal(url, '/api/open-dividend-source');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {});
    return { ok: true, json: async () => ({ opened: true }) };
  }, localLocation);
  assert.equal(result.opened, true);
});

test('opening the signal surfaces missing files and unsuccessful dispatch', async () => {
  await assert.rejects(openDividendSignalSource(async () => ({
    ok: false, status: 404, json: async () => ({ error: '未找到中证红利每日信号.xlsx' }),
  }), localLocation), /未找到中证红利每日信号.xlsx/);
  await assert.rejects(openDividendSignalSource(async () => ({
    ok: true, json: async () => ({}),
  }), localLocation), /信号源未能打开/);
});

test('opening a standalone file gives launcher guidance without requesting an application', async () => {
  await assert.rejects(openDividendSignalSource(() => assert.fail('unexpected request'), {
    protocol: 'file:', hostname: '',
  }), /启动面板.command.*启动面板.cmd/);
});

test('strategy editor exposes weights, anchors, thresholds and confirmation days', () => {
  const html = renderDividendStrategyDetails();
  for (const key of ['percentile', 'absolute', 'ratio']) assert.ok(html.includes(`data-dividend-param="weights.${key}"`));
  for (const grade of ['C', 'B', 'A']) assert.ok(html.includes(`data-dividend-param="thresholds.${grade}"`));
  assert.match(html, /confirmationDays/);
  assert.match(html, /readonly aria-readonly="true"/);
  assert.match(html, /策略详情 · 参数设置/);
  assert.match(html, /保存本地参数/);
  assert.match(html, /恢复V1默认值/);
  assert.match(html, /保存并应用到每日测算/);
  assert.match(html, /下一次每日运行生效/);
  assert.doesNotMatch(html, /data-dividend-trial-preview|实时试算|本地试算结果/);
  assert.doesNotMatch(html, /至少两项/);
});

test('detail retains daily results and parameter editing without a local calculation card', () => {
  const html = renderDividendSignalDetail(signal);
  const editor = html.slice(html.indexOf('<article class="panel dividend-strategy-panel">'));
  assert.match(html, /每日记录结果/);
  assert.match(editor, /data-dividend-param|data-dividend-apply/);
  assert.doesNotMatch(html, /data-dividend-trial-preview|dividend-strategy-preview|本地试算结果|实时试算/);
  assert.equal((html.match(/class="dividend-score-panel"/g) ?? []).length, 1);
});

test('daily apply posts parameters and expected revision, while loading fetches configuration', async () => {
  const settings = { revision: 1, strategy: { ...DIVIDEND_DEFAULT_STRATEGY, version: 'dividend-weighted-v1-r1' }, changed: true };
  const result = await applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, async (url, options) => {
    assert.equal(url, '/api/dividend-strategy');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { strategy: DIVIDEND_DEFAULT_STRATEGY, expectedRevision: 0 });
    return { ok: true, json: async () => settings };
  }, localLocation);
  assert.deepEqual(result, settings);
  assert.deepEqual(await loadDailyDividendStrategy(async (url, options) => {
    assert.equal(url, '/api/dividend-strategy'); assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => settings };
  }, localLocation), settings);
});

test('daily apply reports conflicts, invalid values and standalone-file restrictions', async () => {
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, async () => ({ ok: false, status: 409, json: async () => ({ error: '版本冲突' }) }), localLocation), /409.*版本冲突/);
  await assert.rejects(applyDailyDividendStrategy({ ...DIVIDEND_DEFAULT_STRATEGY, confirmationDays: 0 }, 0, () => assert.fail('unexpected request'), localLocation), /参数无效/);
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, () => assert.fail('unexpected request'), { protocol: 'file:' }), /启动面板/);
});
