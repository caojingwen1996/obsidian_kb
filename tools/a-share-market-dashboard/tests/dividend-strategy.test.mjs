import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { openDividendSignalSource, renderDividendSignalDetail, renderDividendManagement, renderDividendManagementSource, renderDividendStrategyDetails, applyDailyDividendStrategy, loadDailyDividendStrategy, resolveTreeNavigation, dividendViewFromData } from '../src/app.mjs';
import { DIVIDEND_DEFAULT_STRATEGY, scoreDividendInput } from '../src/dividend-scoring.mjs';

const signal = {
  absoluteSignal: 'C（小额定投）', spreadSignal: 'C（小额定投）', percentileSignal: '待验证',
  dividendYield2: 4.28, bond10yYield: 1.67, spread: 2.61,
  headline: '历史分位点待验证，暂不判定加大买入区间', indexDate: '2026-09-29', status: 'latest',
};

test('view page keeps recorded results and charts without editing or management tools', () => {
  const html = renderDividendSignalDetail(signal);
  assert.match(html, /红利信号核心指标/);
  assert.doesNotMatch(html, /data-dividend-param|data-dividend-apply|data-open-dividend-source|策略回测|来源与验证边界/);
  assert.match(html, /<\/section>\s*<article class="dividend-yield-chart-card">/);
  assert.ok(html.indexOf('dividend-detail-summary') < html.indexOf('dividend-yield-chart-card'));
  assert.ok(html.indexOf('dividend-yield-chart-card') < html.indexOf('每日记录结果'));
  assert.doesNotMatch(html, /年度收益与最大回撤/);
  assert.doesNotMatch(html, /<h3>历史分位点<\/h3>|<small>市值加权股息率<\/small>/);
});

test('buy decision groups dividend scoring before the weekly Bollinger strategy with explicit missing data', () => {
  for (const currentSignal of [signal, null]) {
    const html = renderDividendSignalDetail(currentSignal);
    assert.match(html, /aria-labelledby="dividend-buy-decision-heading"/);
    assert.match(html, />买入判断<\/h3>/);
    assert.match(html, /<div class="dividend-buy-strategies">\s*<section class="dividend-detail-summary"/);
    assert.match(html, /<\/section>\s*<\/div>\s*<\/section>/);
    assert.ok(html.indexOf('股息率策略评分') < html.indexOf('布林线策略'));
    const bollinger = html.match(/<section class="dividend-bollinger-strategy"[\s\S]*?<\/section>/)?.[0];
    assert.ok(bollinger);
    assert.match(bollinger, /data-status="missing"/);
    assert.match(bollinger, /数据不足/);
    for (const label of ['周线上轨', '周线中轨', '周线下轨']) {
      assert.ok(bollinger.includes(`<small>${label}</small><strong>—</strong>`));
    }
    assert.match(bollinger, /<small>当前轨道位置<\/small><strong>待判断<\/strong>/);
    assert.match(bollinger, /暂不生成轨道判断/);
    assert.doesNotMatch(bollinger, /<button|<svg|\d+\.\d+|买入信号已触发/);
  }
  assert.match(renderDividendSignalDetail(signal), /综合分 <strong>\d+\.\d+～\d+\.\d+<\/strong>/);
  const completeSignal = { ...signal, lixingerPercentile10y: '80%' };
  assert.match(renderDividendSignalDetail(completeSignal), /综合分 <strong>\d+\.\d+<\/strong>/);
});

test('buy decision strategy cards use two desktop columns with a narrow-screen fallback', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.dividend-buy-strategies \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 900px\) \{ \.dividend-buy-strategies \{ grid-template-columns: minmax\(0, 1fr\)/);
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
  assert.match(html, /立即重算当前Excel/);
  assert.doesNotMatch(html, /data-dividend-trial-preview|实时试算|本地试算结果/);
  assert.doesNotMatch(html, /至少两项/);
});

test('management page owns parameter editing, source actions and source verification', () => {
  const html = renderDividendManagement(signal, { strategy: DIVIDEND_DEFAULT_STRATEGY, dailyOptions: { ready: true, notice: '每日配置已读取' } });
  assert.match(html, /data-dividend-param|data-dividend-apply/);
  assert.match(html, /<button[^>]+data-dividend-apply>保存并应用到每日测算/);
  assert.match(html, /每日配置已读取/);
  assert.match(html, /<button[^>]+data-open-dividend-source[^>]*>打开信号源（Excel）<\/button>/);
  assert.match(html, /data-open-dividend-backtest aria-controls="dividend-backtest-panel">策略回测/);
  const actions = html.match(/<div class="dividend-param-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(actions);
  assert.match(actions, /data-dividend-reset[\s\S]*data-open-dividend-backtest[\s\S]*data-open-dividend-source/);
  assert.equal((html.match(/data-open-dividend-backtest/g) ?? []).length, 1);
  assert.equal((html.match(/data-open-dividend-source/g) ?? []).length, 1);
  assert.doesNotMatch(html, /dividend-management-tools|信号源与策略工具/);
  assert.doesNotMatch(html, /策略回测待开发/);
  assert.match(renderDividendManagementSource(signal), /来源与验证边界/);
  assert.doesNotMatch(html, /obsidian:\/\/open|dividend-yield-chart-card|每日记录结果|年度收益与最大回撤/);
  assert.doesNotMatch(html, /data-dividend-trial-preview|dividend-strategy-preview|本地试算结果|实时试算/);
  const filePath = 'sources/automations/中证红利信号/中证红利每日信号.xlsx';
  assert.ok(existsSync(new URL(`../../${filePath}`, new URL('../a-share-market-dashboard.html', import.meta.url))));
});

test('parameter help explains score ranges, confirmation and interpolation using edited values', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  strategy.thresholds = { C: 35, B: 65, A: 85 };
  strategy.confirmationDays = 5;
  const html = renderDividendStrategyDetails(strategy);
  assert.match(html, /D ＜ 35分/);
  assert.match(html, /C 为 35～＜65分/);
  assert.match(html, /B 为 65～＜85分/);
  assert.match(html, /A 为 85～100分/);
  assert.match(html, /连续出现 5 个有效交易日/);
  assert.match(html, /缺失或无效的交易日记录会中断计数/);
  assert.match(html, /不使用连续确认天数筛选/);
  assert.match(html, /分数的平均值/);
  strategy.thresholds.B = NaN;
  strategy.confirmationDays = NaN;
  const invalidHtml = renderDividendStrategyDetails(strategy);
  assert.match(invalidHtml, /请先填写有效且依次递增/);
  assert.match(invalidHtml, /请填写1～20的整数/);
  assert.doesNotMatch(invalidHtml, /NaN/);
});

test('management remains available before the first signal is generated', () => {
  const html = renderDividendManagement(null);
  assert.match(html, /data-dividend-param/);
  assert.match(html, /data-dividend-apply disabled/);
  assert.match(renderDividendManagementSource(null), /暂无信号记录/);
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.match(renderDividendSignalDetail(null), /未找到本地最新信号记录/);
});

test('view and management have separate navigation destinations and rendering containers', () => {
  const source = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const view = source.match(/<section class="view" id="dividend-signal-view"[\s\S]*?<\/section>/)?.[0];
  const management = source.match(/<section class="view" id="dividend-management-view"[\s\S]*?<\/section>/)?.[0];
  assert.ok(view);
  assert.ok(management);
  assert.match(view, /id="dividend-signal-detail"/);
  assert.match(view, /DIVIDEND_DAY_CHART/);
  assert.match(view, /id="dividend-annual-detail"/);
  assert.doesNotMatch(management, /dividend-signal-detail|dividend-annual-detail|DIVIDEND_DAY_CHART/);
  assert.match(management, /data-shell-content="strategy"/);
  assert.match(management, /id="dividend-management-detail"/);
  assert.ok(management.indexOf('id="dividend-management-detail"') < management.indexOf('id="dividend-backtest-panel"'));
  assert.ok(management.indexOf('id="dividend-backtest-panel"') < management.indexOf('id="dividend-management-source"'));
  assert.match(management, /<article id="dividend-backtest-panel"/);
  assert.match(management, /id="dividend-backtest-result"/);
  assert.doesNotMatch(source, /dividend-backtest-dialog/);
  for (const html of [view, management]) {
    assert.match(html, /data-dividend-view="dividend-signal-view"/);
    assert.match(html, /data-dividend-view="dividend-management-view"/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  }
  assert.deepEqual(resolveTreeNavigation({}, 'strategy', 'dividend-management-view'), { domain: 'strategy', viewId: 'dividend-management-view' });
  assert.deepEqual(resolveTreeNavigation({ strategy: 'dividend-management-view' }, 'strategy'), { domain: 'strategy', viewId: 'dividend-management-view' });
});

test('daily apply posts parameters and expected revision, while loading fetches configuration', async () => {
  const settings = { revision: 1, strategy: { ...DIVIDEND_DEFAULT_STRATEGY, version: 'dividend-weighted-v1-r1' }, changed: true };
  const latest = scoreDividendInput({ percentile: 100, dividendYield: 7, bondYield: 1 }, settings.strategy, { index: '2026-01-05', percentile: '2026-01-05', bond: '2026-01-05' }, 'source', false, 'legacy');
  settings.recalculation = { updatedRows: 1, view: { schemaVersion: 1, payload: { schemaVersion: 1, strategy: settings.strategy, latest, records: [latest], tradingDates: ['2026-01-05'], recalculatedAt: '2026-10-15T17:00:00+08:00' }, yieldHistory: [{ date: '2026-01-05', value: 7, headline: 'A · 重点配置区间' }], indexHistory: [{ date: '2026-01-05', close: 100 }] } };
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
  const view = dividendViewFromData(settings.recalculation.view);
  const html = renderDividendSignalDetail(view.signal, { yieldHistory: view.yieldHistory, indexHistory: view.indexHistory });
  assert.match(html, /当前策略重算结果/);
  assert.match(html, /data-buy-grade="A"/);
  assert.match(html, /dividend-weighted-v1-r1/);
});

test('daily apply reports conflicts, invalid values and standalone-file restrictions', async () => {
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, async () => ({ ok: false, status: 409, json: async () => ({ error: '版本冲突' }) }), localLocation), /409.*版本冲突/);
  await assert.rejects(applyDailyDividendStrategy({ ...DIVIDEND_DEFAULT_STRATEGY, confirmationDays: 0 }, 0, () => assert.fail('unexpected request'), localLocation), /参数无效/);
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, () => assert.fail('unexpected request'), { protocol: 'file:' }), /启动面板/);
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, async () => ({ ok: true, json: async () => ({ revision: 1, strategy: DIVIDEND_DEFAULT_STRATEGY }) }), localLocation), /未完成Excel重算/);
});
