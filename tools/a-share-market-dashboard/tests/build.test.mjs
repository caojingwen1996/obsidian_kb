import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExampleSnapshot } from '../src/data-service.mjs';
import {
  deriveDashboard,
  normalizeTrackingItems,
  resolveStorage,
  summarizeHoldings,
  summarizeTrackingItems,
} from '../src/app.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '..', 'src', 'index.html');
const artifactPath = join(here, '..', 'a-share-market-dashboard.html');
const launcherPath = join(here, '..', '启动大盘面板.cmd');
const repoRoot = join(here, '..', '..', '..');
const hangTianElectronicsReportPath = join(
  repoRoot,
  'sources',
  'automations',
  '新兴产业',
  '商业航天',
  '2026-07-21-1650-航天电子-机构级决策研报.html',
);

function countFeedReports(directoryName) {
  return readdirSync(join(repoRoot, 'sources', 'automations', directoryName), {
    recursive: true,
    withFileTypes: true,
  }).filter(entry =>
    entry.isFile()
    && entry.name.endsWith('.html')
    && !entry.name.includes('完整分析报告')
  ).length;
}

test('dashboard shell exposes every approved navigation and rendering target', () => {
  const html = readFileSync(sourcePath, 'utf8');
  for (const id of [
    'market-summary',
    'window-controls',
    'layer-scores',
    'youzhiyouxing-temperature-card',
    'dividend-signal-card',
    'metric-list',
    'position-view',
    'valuation-view',
    'emotion-view',
    'rules-view',
    'audit-view',
    'audit-errors',
    'example-mode',
    'refresh-data',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<label class="mode-switch" for="example-mode" hidden>/);
  assert.doesNotMatch(html, /<span id="sidebar-status">示例数据<\/span>/);
  assert.doesNotMatch(html, /正在用内置示例数据初始化/);
});

test('window controls use native buttons with the four approved values', () => {
  const html = readFileSync(sourcePath, 'utf8');
  for (const years of [1, 3, 5, 10]) {
    assert.match(html, new RegExp(`<button[^>]+data-window="${years}"`));
  }
});

test('sidebar exposes the personal position workspace as a first-level tree domain', () => {
  const html = readFileSync(sourcePath, 'utf8');
  for (const domain of ['thermometer', 'industry', 'personal', 'changelog']) {
    assert.match(html, new RegExp(`<button[^>]+data-tree-domain="${domain}"`));
  }
  for (const id of ['tree-thermometer', 'tree-industry', 'tree-personal', 'changelog-view',
    'industry-strategy',
    'industry-emerging',
    'industry-pillar',
    'position-manager',
    'holding-tracker',
    'holding-form',
    'tracking-form',
    'tracking-count',
    'tracking-filter',
    'holdings-table-body',
    'holding-tracker-list',
    'holding-tracker-empty',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const status of ['持有', '观察', '计划加仓', '计划减仓']) {
    assert.match(html, new RegExp(`<option>${status}</option>`));
    assert.match(html, new RegExp(`data-status-filter="${status}"`));
  }
  const trackingForm = html.match(/<form class="tracking-form panel" id="tracking-form">[\s\S]*?<\/form>/)?.[0] ?? '';
  assert.match(trackingForm, /<label><span>标的名称<\/span><input name="name" required maxlength="30"/);
  assert.match(trackingForm, /<label><span>证券代码<\/span><input name="code" maxlength="12"/);
  assert.doesNotMatch(trackingForm, /<label><span>证券代码<\/span><input name="code" required/);
  assert.match(html, /data-tree-domain="thermometer"[^>]+aria-expanded="true"[^>]+aria-controls="tree-thermometer"/);
  assert.match(html, /data-tree-domain="industry"[^>]+aria-expanded="false"[^>]+aria-controls="tree-industry"/);
  assert.match(html, /data-tree-domain="personal"[^>]+aria-expanded="false"[^>]+aria-controls="tree-personal"/);
  assert.doesNotMatch(html, /class="shell-switcher"/);
  assert.doesNotMatch(html, /industry-sectors/);
  assert.doesNotMatch(html, />板块</);
  assert.match(html, /class="tracking-table-wrap"/);
  assert.match(html, /<table class="tracking-table">/);
  assert.match(html, /<tbody id="holding-tracker-list"><\/tbody>/);
  assert.doesNotMatch(html, /tracker-card/);
});

test('market summary renders three overview cards and includes signal sources in data audit', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const artifact = readFileSync(artifactPath, 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

  assert.match(source, /class="overview-grid"/);
  assert.match(source, /id="youzhiyouxing-temperature-card"/);
  assert.match(source, /id="dividend-signal-card"/);
  assert.match(source, /预留模块/);
  assert.match(source, /暂空/);
  for (const marker of [
    '市场温度计',
    '打开有知有行市场温度计源数据',
    '有知有行公开温度计',
    '/api/youzhiyouxing-temperature',
    '中证红利股息率信号',
    '打开中证红利最新信号源数据',
    '../../sources/automations/中证红利信号/最新信号.md',
    '未进重点买入',
    '股息率2',
    'C（小额定投）',
    '股债利差',
    'zzhl-dividend-signal 最新信号',
    '<td>中证红利股息率信号</td>',
    '<td>观察项</td>',
  ]) {
    assert.match(artifact, new RegExp(marker));
  }
  assert.match(appSource, /absolute\.grade \? `\$\{absolute\.grade\} \$\{absolute\.label\}`/);
  assert.doesNotMatch(artifact, /CSI_DIVIDEND_SIGNAL\s*=\s*Object\.freeze\(\s*\/\/ CSI_DIVIDEND_SIGNAL/);
});

test('changelog renders the approved initial entries', () => {
  const html = readFileSync(artifactPath, 'utf8');
  assert.match(html, /<p class="eyebrow">CHANGELOG<\/p>/);
  assert.match(html, /最近发生了什么——新功能、调整与修复，都写在这里。/);
  for (const title of [
    '市场总览改为三张信号卡',
    '产业研报改为目录自动加载',
    '修复本地服务器无法打开产业研报',
    '产业研报链接改为在新标签页打开',
  ]) {
    assert.match(html, new RegExp(title));
  }
  assert.match(html, /市场总览现在直接展示有知有行市场温度计、中证红利股息率信号和预留卡位/);
  assert.doesNotMatch(html, /<!-- CHANGELOG_ENTRIES -->/);
});

test('industry panels use Ice Ice Xiaomei three-industry classification', () => {
  const html = readFileSync(artifactPath, 'utf8');
  for (const term of [
    '战略资源',
    '电解铝',
    '新兴产业',
    '商业航天',
    '机器人',
    '算力',
    '支柱产业',
    '电网',
  ]) {
    assert.match(html, new RegExp(term));
  }
  assert.doesNotMatch(html, /等待你的指示|这里不预填任何内容/);
  assert.doesNotMatch(html, /银行 \/ 保险|食品饮料|电力 \/ 水务|国家安全|高成长|经济基本盘|现金流稳定器/);
  assert.doesNotMatch(html, /半导体设备|银行 \/ 保险|食品饮料|电力 \/ 水务/);
});

test('industry panels use the approved feed layout without the tracking card', () => {
  const html = readFileSync(artifactPath, 'utf8');
  for (const marker of [
    'industry-workbench',
    'industry-filter-tabs',
    'industry-research-list',
    'industry-research-item',
    'industry-research-rank',
    'industry-date-row',
    'industry-feed',
    'industry-report',
    'industry-timeline',
    '产业研报',
    '云铝股份机构级决策研报',
    '../../sources/automations/支柱产业/电解铝/2026-07-15-1921-云铝股份机构级决策研报.html',
    '云铝股份资金面分析',
    '../../sources/automations/支柱产业/电解铝/2026-07-20-云铝股份资金面分析.html',
    '商业航天产业完整分析报告',
    '../../sources/automations/新兴产业/商业航天/商业航天产业完整分析报告.html',
    '算力产业完整分析报告',
    '../../sources/automations/新兴产业/算力/2026-07-20-算力产业完整分析报告.html',
    '中国卫星-机构级决策研报',
    '中国卫通-机构级决策研报',
    '航天电子机构级决策研报',
    '十五五电网投资与电网行业完整分析报告',
    '../../sources/automations/支柱产业/电网/2026-07-17-十五五电网投资与电网行业完整分析报告.html',
    '中国中车机构级决策研报',
    '中国中车资金面分层分析',
    '中国船舶资金面分层分析',
    '../../sources/automations/支柱产业/2026-07-18-中国中车机构级决策研报.html',
    '../../sources/automations/支柱产业/2026-07-18-中国中车资金面分层分析.html',
    '../../sources/automations/支柱产业/2026-07-18-中国船舶资金面分层分析.html',
    '华明装备机构级决策研报',
    '../../sources/automations/支柱产业/电网/2026-07-15-1514-华明装备机构级决策研报.html',
    '神马电力机构级决策研报',
    '神马电力资金面分层分析',
    '../../sources/automations/支柱产业/电网/2026-07-18-神马电力机构级决策研报.html',
    '../../sources/automations/支柱产业/电网/2026-07-18-神马电力资金面分层分析.html',
    '来源目录：sources/automations/支柱产业/电解铝',
    '来源目录：sources/automations/新兴产业/商业航天',
    '来源目录：sources/automations/新兴产业/算力',
    '来源目录：sources/automations/支柱产业',
    '来源目录：sources/automations/支柱产业/电网',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /当前热点/);
  assert.doesNotMatch(html, /industry-tracking/);
  assert.doesNotMatch(html, /<h[1-6][^>]*>产业跟踪<\/h[1-6]>/);
  assert.doesNotMatch(html, /<p class="eyebrow">INDUSTRY TRACKING<\/p>/);
  assert.doesNotMatch(html, /<button type="button" data-filter="电力设备" aria-pressed="false">电力设备<\/button>/);
  assert.doesNotMatch(html, /集成电路产业链缩圈|生物医药、新型储能与智能机器人观察/);
  assert.doesNotMatch(html, /战略资源：资源安全与硬资产重估|铜与关键矿产供需周期跟踪|黄金与能源的宏观变量观察/);
  for (const directoryName of ['战略资源', '新兴产业', '支柱产业']) {
    const count = countFeedReports(directoryName);
    assert.match(html, new RegExp(`<strong>7月20日<\\/strong><span>星期一 · ${count}条<\\/span>`));
  }
  assert.match(html, /<section class="industry-research-list"[^>]*>[\s\S]*商业航天产业完整分析报告/);
  assert.match(html, /<li class="industry-research-item" data-filters="商业航天">[\s\S]*商业航天产业完整分析报告/);
  assert.match(html, /<li class="industry-research-item" data-filters="算力">[\s\S]*算力产业完整分析报告/);
  assert.match(html, /算力-存储力产业完整分析报告/);
  assert.ok(
    html.indexOf('算力产业完整分析报告') < html.indexOf('算力-存储力产业完整分析报告'),
    'parent industry report should render before subdivision reports',
  );
  assert.match(html, /<span class="industry-research-rank">1<\/span>/);
  const reportCards = [...html.matchAll(/<article class="industry-report"[\s\S]*?<\/article>/g)].map(match => match[0]);
  assert.equal(reportCards.some(card => card.includes('商业航天产业完整分析报告')), false);
  assert.equal(reportCards.some(card => card.includes('算力产业完整分析报告')), false);
  assert.match(html, /<section class="industry-research-list"[^>]*>[\s\S]*十五五电网投资与电网行业完整分析报告/);
  assert.match(html, /<li class="industry-research-item" data-filters="电网">[\s\S]*十五五电网投资与电网行业完整分析报告/);
  assert.equal(reportCards.some(card => card.includes('十五五电网投资与电网行业完整分析报告')), false);
  assert.match(html, /data-filters="电网"[\s\S]*华明装备机构级决策研报/);
  assert.match(html, /data-filters="电网"[\s\S]*神马电力机构级决策研报/);
  assert.match(html, /<article class="industry-report" data-filters="">[\s\S]*中国中车机构级决策研报/);
  assert.match(readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8'), /querySelectorAll\('\.industry-research-item'\)/);
  const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(buildSource, /scanIndustryReports/);
  assert.match(buildSource, /renderFilterTabs/);
  assert.match(buildSource, /renderResearchBoards/);
  assert.doesNotMatch(buildSource, /commercialSpaceDir|electricGridDir|pillarFilters|strategicResourceFilters/);
  assert.doesNotMatch(html, /<!-- (?:STRATEGY|EMERGING|PILLAR)_(?:FILTER_TABS|RESEARCH_BOARDS|REPORTS|REPORT_COUNT) -->/);
  assert.doesNotMatch(html, /sources\/automations\/(?:商业航天|电网产业)\//);
});

test('industry report links open safely in a new tab', () => {
  const html = readFileSync(artifactPath, 'utf8');
  const reportLinks = [...html.matchAll(/<a class="industry-report-link"[^>]*>/g)].map(match => match[0]);
  assert.ok(reportLinks.length > 0);
  for (const link of reportLinks) {
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
  }
});

test('launcher rebuilds the dashboard before starting the local proxy', () => {
  const launcher = readFileSync(launcherPath, 'utf8');
  const buildIndex = launcher.indexOf('scripts\\build.mjs');
  const proxyIndex = launcher.indexOf('scripts\\local_proxy.py');

  assert.match(launcher, /where node/i);
  assert.match(launcher, /%USERPROFILE%\\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node\.exe/i);
  assert.ok(buildIndex >= 0, 'launcher must invoke the dashboard builder');
  assert.ok(proxyIndex > buildIndex, 'launcher must build before starting the proxy');
  assert.match(launcher, /if errorlevel 1 goto :build_failed/i);
  assert.match(launcher, /:build_failed[\s\S]*goto :eof/i);
});

test('position summary calculates market value, profit and portfolio weights', () => {
  const summary = summarizeHoldings([
    { id: 'a', code: '600879', name: '航天电子', quantity: 1000, cost: 12, price: 15 },
    { id: 'b', code: '512400', name: '有色ETF', quantity: 2000, cost: 1.1, price: 1 },
  ]);

  assert.equal(summary.costValue, 14200);
  assert.equal(summary.marketValue, 17000);
  assert.equal(summary.profit, 2800);
  assert.equal(summary.items[0].weight, 88.24);
  assert.equal(summary.items[1].profitRate, -9.09);
});

test('tracking items normalize independently from actual position holdings', () => {
  const fixedNow = Date.now;
  Date.now = () => 1784601060000;
  try {
    const items = normalizeTrackingItems([
      {
        id: 'track-1',
        code: '600879',
        name: '航天电子',
        status: '观察',
        thesis: '等待产业逻辑和资金状态重新共振',
        riskLine: '跌破复核线且资金继续转弱',
        nextAction: '复核',
        reviewCondition: '出现风险转弱证据',
        updatedAt: 1784601060000,
      },
      {
        id: 'track-2',
        code: '',
        name: '有色ETF',
        status: '计划加仓',
        updatedAt: 1784602060000,
      },
      { id: '', code: '000001', name: 'invalid' },
    ]);
    const summary = summarizeTrackingItems(items);

    assert.equal(items.length, 2);
    assert.equal(summary.count, 2);
    assert.equal(summary.countByStatus['观察'], 1);
    assert.equal(summary.countByStatus['计划加仓'], 1);
    assert.equal(summary.items[0].id, 'track-2');
    assert.equal(summary.items[0].code, '');
    assert.equal(summarizeHoldings([]).items.length, 0);
  } finally {
    Date.now = fixedNow;
  }
});

test('航天电子 merges static hero metrics into daily tracking and reserves a live quote', () => {
  const report = readFileSync(hangTianElectronicsReportPath, 'utf8');

  assert.doesNotMatch(report, /class="kpis"/);
  assert.doesNotMatch(report, /class="verdict"/);
  for (const marker of [
    'data-tracking-key="daily-quote"',
    'data-tracking-key="intraday-quote"',
    'data-tracking-key="action-confidence"',
    '/api/stock-quote?secid=1.600879',
    '每 60 秒',
  ]) {
    assert.match(report, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('航天电子 local links target real source files or Obsidian pages', () => {
  const report = readFileSync(hangTianElectronicsReportPath, 'utf8');

  for (const href of [
    './2026-07-21-航天电子资金面分析.html',
    '../../../webpages/2026-07-21-航天电子机构级研报公开资料底稿.md',
    'https://dataclouds.cninfo.com.cn/shgonggao/hsomarket/2026/20260327/01fc31123b944c3396c26972e042ab76.PDF',
    'https://static.cninfo.com.cn/finalpage/2026-04-29/1225229950.PDF',
  ]) {
    assert.ok(report.includes(href), `missing corrected href: ${href}`);
  }
  assert.doesNotMatch(report, /\.pdf\.html/);
  assert.doesNotMatch(report, /href="[^\"]+\.html"[^>]*>[^<]*(?:公开资料底稿|年年度报告)/);
});

test('example state produces a complete auditable score', () => {
  const derived = deriveDashboard(createExampleSnapshot(), 5);
  assert.equal(derived.windowYears, 5);
  assert.equal(derived.score.coverage, 100);
  assert.equal(derived.metrics.length, 10);
  assert.equal(derived.conclusion.actionable, true);
  assert.ok(Number.isFinite(derived.score.score));
});

test('changing the selected window recomputes position and overall scores', () => {
  const snapshot = createExampleSnapshot();
  const oneYear = deriveDashboard(snapshot, 1);
  const tenYear = deriveDashboard(snapshot, 10);
  assert.notEqual(oneYear.positions.csi300.percentile, tenYear.positions.csi300.percentile);
  assert.notEqual(oneYear.score.score, tenYear.score.score);
});

test('built artifact is self-contained and directly openable', () => {
  assert.equal(existsSync(artifactPath), true, 'run the build before testing the artifact');
  const output = readFileSync(artifactPath, 'utf8');
  assert.match(output, /^<!doctype html>/i);
  assert.doesNotMatch(output, /<script[^>]+src=/i);
  assert.doesNotMatch(output, /<link[^>]+href=/i);
  assert.doesNotMatch(output, /from\s+['"]\.\//);
  assert.doesNotMatch(output, /DASHBOARD_(STYLES|SCRIPT)/);
  assert.match(output, /<style>[\s\S]+<\/style>/);
  assert.match(output, /<script type="module">[\s\S]+<\/script>/);
  assert.match(output, /温度计/);
  assert.ok(Buffer.byteLength(output, 'utf8') < 2_000_000);
});

test('built artifact explains that the launcher is required for stable live data', () => {
  const output = readFileSync(artifactPath, 'utf8');
  assert.match(output, /启动大盘面板\.cmd/);
});

test('file-protocol storage restrictions fall back to an in-memory cache', () => {
  const storage = resolveStorage(() => { throw new Error('SecurityError'); });
  storage.setItem('key', 'value');
  assert.equal(storage.getItem('key'), 'value');
});
