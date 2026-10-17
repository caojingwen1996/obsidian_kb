import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { openDividendSignalSource, renderDividendSignalDetail, renderDividendManagement, renderDividendManagementSource, renderDividendStrategyDetails, applyDailyDividendStrategy, loadDailyDividendStrategy, resolveTreeNavigation, dividendViewFromData } from '../src/app.mjs';
import { DIVIDEND_DEFAULT_STRATEGY, scoreDividendInput, shouldSyncDividendTrial, resolveDividendManagementStrategy } from '../src/dividend-scoring.mjs';

test('daily settings replace a cached applied revision but preserve independent trials and active edits', () => {
  const old = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  old.weights = { percentile: 33, absolute: 34, ratio: 33 };
  const current = structuredClone(old);
  current.weights = { percentile: 5, absolute: 90, ratio: 5 };
  const settings = { strategy: current, history: [{ strategy: old }, { strategy: current }] };
  assert.equal(shouldSyncDividendTrial(old, settings, { hasLocalTrial: true }), true);
  assert.equal(shouldSyncDividendTrial(old, settings, { hasLocalTrial: true, edited: true }), false);
  const trial = structuredClone(old);
  trial.thresholds.B = 67;
  assert.equal(shouldSyncDividendTrial(trial, settings, { hasLocalTrial: true }), false);
  assert.equal(shouldSyncDividendTrial(trial, settings), true);
  assert.equal(shouldSyncDividendTrial(current, settings, { hasLocalTrial: true }), true);
  assert.equal(shouldSyncDividendTrial(old, { strategy: current }, { hasLocalTrial: true }), false);
});

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
    assert.match(html, />当前信号<\/h3>/);
    assert.match(html, /<div class="dividend-buy-strategies">\s*<section class="dividend-detail-summary"/);
    assert.match(html, /<\/section>\s*<\/div>\s*<\/section>/);
    assert.ok(html.indexOf('信号1：股息率') < html.indexOf('信号2：布林线'));
    const bollinger = html.match(/<section class="dividend-bollinger-strategy"[\s\S]*?<\/section>/)?.[0];
    assert.ok(bollinger);
    assert.match(bollinger, /data-status="missing"/);
    assert.match(bollinger, /数据不足/);
    for (const label of ['周线上轨', '周线中轨', '周线下轨']) {
      assert.ok(bollinger.includes(`<small>${label}</small><strong>—</strong>`));
    }
    assert.match(bollinger, /<small>轨道位置 %B<\/small><strong>—<\/strong>/);
    assert.doesNotMatch(bollinger, /class="dividend-band-position"/);
    assert.match(bollinger, /暂不生成轨道判断/);
    assert.doesNotMatch(bollinger, /<button|<svg|\d+\.\d+|买入信号已触发/);
  }
  assert.match(renderDividendSignalDetail({ ...signal, bond10yYield: null }), /综合分 <strong>\d+\.\d+～\d+\.\d+<\/strong>/);
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

test('strategy editor exposes weights, anchors and three grade thresholds without confirmation days', () => {
  const html = renderDividendStrategyDetails();
  for (const key of ['absolute', 'ratio']) assert.ok(html.includes(`data-dividend-param="weights.${key}"`));
  for (const grade of ['C', 'B', 'A']) assert.ok(html.includes(`data-dividend-param="thresholds.${grade}"`));
  assert.doesNotMatch(html, /confirmationDays|连续确认|确认天数/);
  assert.equal((html.match(/data-strategy-grade=/g) ?? []).length, 3);
  assert.match(html, /readonly aria-readonly="true"/);
  assert.match(html, /评分参数/);
  assert.match(html, /<details[^>]+data-dividend-disclosure="settings">/);
  assert.doesNotMatch(html, /<details[^>]+data-dividend-disclosure="settings"[^>]*\bopen\b/);
  assert.match(html, /保存本地参数/);
  assert.match(html, /恢复双指标默认值/);
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
  assert.match(html, /data-open-dividend-backtest aria-controls="dividend-backtest-panel">用这些参数回测/);
  assert.equal((html.match(/data-open-dividend-backtest/g) ?? []).length, 1);
  assert.match(html, /<details[^>]+data-dividend-disclosure="local-tools">/);
  const sources = renderDividendManagementSource(signal);
  assert.match(sources, /<details[^>]+data-dividend-disclosure="sources">/);
  assert.match(sources, /<button[^>]+data-open-dividend-source[^>]*>打开信号源（Excel）<\/button>/);
  assert.equal((sources.match(/data-open-dividend-source/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-open-dividend-source/);
  assert.doesNotMatch(html, /dividend-management-tools|信号源与策略工具/);
  assert.doesNotMatch(html, /策略回测待开发/);
  assert.match(renderDividendManagementSource(signal), /来源与验证边界/);
  assert.doesNotMatch(html, /obsidian:\/\/open|dividend-yield-chart-card|每日记录结果|年度收益与最大回撤/);
  assert.doesNotMatch(html, /data-dividend-trial-preview|dividend-strategy-preview|本地试算结果|实时试算/);
  const filePath = 'sources/automations/中证红利信号/中证红利每日信号.xlsx';
  assert.ok(existsSync(new URL(`../../${filePath}`, new URL('../a-share-market-dashboard.html', import.meta.url))));
});

test('parameter help explains score ranges and interpolation without confirmation settings', () => {
  const strategy = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  strategy.thresholds = { C: 35, B: 65, A: 85 };
  strategy.confirmationDays = 5;
  const html = renderDividendStrategyDetails(strategy);
  assert.match(html, /D ＜ 35分/);
  assert.match(html, /C 为 35～＜65分/);
  assert.match(html, /B 为 65～＜85分/);
  assert.match(html, /A 为 85～100分/);
  assert.match(html, /C · 等待区间起点/);
  assert.match(html, /B · 观察区间起点/);
  assert.match(html, /A · 买入区间起点/);
  assert.match(html, /仅 A 级可买入，B \/ C \/ D 均不买入/);
  assert.doesNotMatch(html, /加大买入|基础配置|重点配置/);
  assert.doesNotMatch(html, /连续确认|确认天数|confirmationDays/);
  assert.match(html, /分数的平均值/);
  strategy.thresholds.B = NaN;
  strategy.confirmationDays = NaN;
  const invalidHtml = renderDividendStrategyDetails(strategy);
  assert.match(invalidHtml, /请先填写有效且依次递增/);
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
  settings.recalculation = { updatedRows: 1, view: { schemaVersion: 1, payload: { schemaVersion: 1, strategy: settings.strategy, latest, records: [latest], tradingDates: ['2026-01-05'], recalculatedAt: '2026-10-15T17:00:00+08:00' }, yieldHistory: [{ date: '2026-01-05', recordDate: '2026-01-05', value: 7, headline: 'A · 重点配置区间' }], indexHistory: [{ date: '2026-01-05', close: 100 }] } };
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
  assert.doesNotMatch(html, /data-buy-grade="A"/);
  assert.match(html, /1条尚无区间内下一交易日/);
  assert.match(html, /dividend-weighted-v1-r1/);
});

test('daily apply reports conflicts, invalid values and standalone-file restrictions', async () => {
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, async () => ({ ok: false, status: 409, json: async () => ({ error: '版本冲突' }) }), localLocation), /409.*版本冲突/);
  await assert.rejects(applyDailyDividendStrategy({ ...DIVIDEND_DEFAULT_STRATEGY, confirmationDays: 0 }, 0, () => assert.fail('unexpected request'), localLocation), /参数无效/);
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, () => assert.fail('unexpected request'), { protocol: 'file:' }), /启动面板/);
  await assert.rejects(applyDailyDividendStrategy(DIVIDEND_DEFAULT_STRATEGY, 0, async () => ({ ok: true, json: async () => ({ revision: 1, strategy: DIVIDEND_DEFAULT_STRATEGY }) }), localLocation), /未完成Excel重算/);
});


test('signal reader keeps recorded scores and explanations while deferring the detailed breakdown', () => {
  const html = renderDividendSignalDetail({ ...signal, lixingerPercentile10y: '80%' });
  const disclosure = html.match(/<details class="dividend-view-disclosure"[^>]*>[\s\S]*?<\/details>/)?.[0];
  assert.ok(disclosure);
  assert.match(disclosure, /评分拆解/);
  assert.doesNotMatch(html, /连续确认|确认状态/);
  assert.doesNotMatch(disclosure.split('>')[0], /\bopen\b/);
  assert.match(disclosure, /各项贡献|dividend-score-table/);
  assert.match(disclosure, /每日记录结果/);
  assert.ok(html.indexOf('dividend-yield-chart-card') < html.indexOf('data-dividend-disclosure="score-breakdown"'));
  assert.match(html, /估值日 2026-09-29/);
  assert.match(html, /dividend-signal-quality/);
  assert.doesNotMatch(html, /BUY DECISION|DIVIDEND YIELD HISTORY|data-dividend-param|data-dividend-apply/);
  const source = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.match(source, /<details class="dividend-history-disclosure" open><summary>年度收益与历史统计/);
  assert.match(source, /id="market-refresh-details"/);
});

test('current signal defers explanatory text while keeping values, dates and historical status visible', () => {
  const html = renderDividendSignalDetail({ ...signal, recordDate: '2026-09-30', status: 'recalculated', recalculatedAt: '2026-10-17T19:10:51+08:00' });
  const summary = html.match(/<section class="dividend-detail-summary"[\s\S]*?<\/section>/)[0];
  const details = summary.match(/<details[^>]+data-dividend-disclosure="signal-method"[^>]*>[\s\S]*?<\/details>/)[0];
  const primary = summary.replace(details, '');
  for (const value of ['4.28%', '1.67%', '2.61个百分点', '估值日 2026-09-29', '仅A级买入', '历史试算']) assert.ok(primary.includes(value), value);
  assert.doesNotMatch(primary, /用于绝对|评分使用|÷|重算时间|当前策略重算|最新记录|历史数据试算/);
  assert.match(details, /<summary>详情<\/summary>/);
  assert.doesNotMatch(details.split('>')[0], /\bopen\b/);
  assert.match(details, /记录日 2026-09-30/);
  assert.match(details, /重算时间：[\s\S]*历史重算不作为当时已发布/);
  assert.match(details, /股债倍数 = 股息率 ÷ 10年国债收益率/);
  assert.match(details, /仅 A 级可买入/);
});

test('shared management trial loads across browsers without applying it to the daily strategy', () => {
  const daily = structuredClone(DIVIDEND_DEFAULT_STRATEGY);
  daily.version = 'r4';
  const candidate = structuredClone(daily);
  candidate.weights = { percentile: 15, absolute: 82, ratio: 3 };
  candidate.thresholds = { C: 40, B: 48, A: 65 };
  const settings = { strategy: daily, history: [] };
  const shared = { basedOnDailyVersion: 'r4', strategy: candidate };
  assert.deepEqual(resolveDividendManagementStrategy(daily, settings, shared), candidate);
  assert.deepEqual(resolveDividendManagementStrategy(daily, settings, shared, { hasLocalTrial: true }), candidate);
  const personal = structuredClone(candidate); personal.weights = { percentile: 20, absolute: 70, ratio: 10 };
  assert.deepEqual(resolveDividendManagementStrategy(personal, settings, shared, { hasLocalTrial: true }), personal);
  assert.deepEqual(resolveDividendManagementStrategy(daily, settings, shared, { edited: true }), daily);
  assert.deepEqual(resolveDividendManagementStrategy(daily, settings, { ...shared, basedOnDailyVersion: 'r3' }), daily);
  assert.deepEqual(resolveDividendManagementStrategy(daily, settings, { ...shared, strategy: {} }), daily);
  assert.deepEqual(settings.strategy, daily);
});

test('previous shared trial migrates to the two-factor trial but unsaved edits remain intact', () => {
  const daily = structuredClone(DIVIDEND_DEFAULT_STRATEGY); daily.version = 'r4';
  const previous = structuredClone(daily); previous.weights = { percentile: 15, absolute: 82, ratio: 3 };
  const next = structuredClone(previous); next.weights = { percentile: 0, absolute: 92, ratio: 8 };
  const shared = { basedOnDailyVersion: 'r4', previousStrategy: previous, strategy: next };
  assert.deepEqual(resolveDividendManagementStrategy(previous, { strategy: daily }, shared, { hasLocalTrial: true }), next);
  assert.deepEqual(resolveDividendManagementStrategy(previous, { strategy: daily }, shared, { hasLocalTrial: true, edited: true }), previous);
});

test('all dividend surfaces omit percentile fields, provenance and score controls', () => {
  const archived = { ...signal, lixingerPercentile10y: '80%', sourceNote: 'AKShare 股息率2; 理杏仁: 近10年分位80%; 000922价格指数×H00922推算滚动股息率分位' };
  for (const html of [renderDividendSignalDetail(archived), renderDividendManagement(archived), renderDividendManagementSource(archived)]) {
    assert.doesNotMatch(html, /历史分位|近10年分位|理杏仁|H00922|weights\.percentile|anchors\.percentile/);
  }
});
