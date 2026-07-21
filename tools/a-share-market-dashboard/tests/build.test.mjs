import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExampleSnapshot } from '../src/data-service.mjs';
import {
  deriveDashboard,
  resolveStorage,
  summarizeHoldings,
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
  '2026-07-17-航天电子机构级决策研报.html',
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
    'holdings-table-body',
    'holding-tracker-list',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-tree-domain="thermometer"[^>]+aria-expanded="true"[^>]+aria-controls="tree-thermometer"/);
  assert.match(html, /data-tree-domain="industry"[^>]+aria-expanded="false"[^>]+aria-controls="tree-industry"/);
  assert.match(html, /data-tree-domain="personal"[^>]+aria-expanded="false"[^>]+aria-controls="tree-personal"/);
  assert.doesNotMatch(html, /class="shell-switcher"/);
  assert.doesNotMatch(html, /industry-sectors/);
  assert.doesNotMatch(html, />板块</);
});

test('changelog renders the approved initial entries', () => {
  const html = readFileSync(artifactPath, 'utf8');
  assert.match(html, /<p class="eyebrow">CHANGELOG<\/p>/);
  assert.match(html, /最近发生了什么——新功能、调整与修复，都写在这里。/);
  for (const title of [
    '产业研报改为目录自动加载',
    '修复本地服务器无法打开产业研报',
    '产业研报链接改为在新标签页打开',
  ]) {
    assert.match(html, new RegExp(title));
  }
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
    'industry-research-board',
    'industry-date-row',
    'industry-feed',
    'industry-report',
    'industry-timeline',
    '产业研报',
    '云铝股份机构级决策研报',
    '../../sources/automations/战略资源/电解铝/2026-07-15-1921-云铝股份机构级决策研报.html',
    '云铝股份资金面分析',
    '../../sources/automations/战略资源/电解铝/2026-07-20-云铝股份资金面分析.html',
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
    '来源目录：sources/automations/战略资源/电解铝',
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
  assert.match(html, /<section class="industry-research-board"[^>]*>[\s\S]*商业航天产业完整分析报告/);
  assert.match(html, /<section class="industry-research-board" data-filters="商业航天">[\s\S]*商业航天产业完整分析报告/);
  assert.match(html, /<section class="industry-research-board" data-filters="算力">[\s\S]*算力产业完整分析报告/);
  const reportCards = [...html.matchAll(/<article class="industry-report"[\s\S]*?<\/article>/g)].map(match => match[0]);
  assert.equal(reportCards.some(card => card.includes('商业航天产业完整分析报告')), false);
  assert.equal(reportCards.some(card => card.includes('算力产业完整分析报告')), false);
  assert.match(html, /<section class="industry-research-board"[^>]*>[\s\S]*十五五电网投资与电网行业完整分析报告/);
  assert.match(html, /<section class="industry-research-board" data-filters="电网">[\s\S]*十五五电网投资与电网行业完整分析报告/);
  assert.equal(reportCards.some(card => card.includes('十五五电网投资与电网行业完整分析报告')), false);
  assert.match(html, /data-filters="电网"[\s\S]*华明装备机构级决策研报/);
  assert.match(html, /data-filters="电网"[\s\S]*神马电力机构级决策研报/);
  assert.match(html, /<article class="industry-report" data-filters="">[\s\S]*中国中车机构级决策研报/);
  assert.match(readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8'), /querySelectorAll\('\.industry-research-board'\)/);
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
    '../../../webpages/2026-07-15-航天电子卖方评级与近期催化剂检索记录.md',
    '../../../papers/航天电子机构研报-2026-07-15/2025年年度报告.pdf',
    '商业航天产业完整分析报告.html',
    'obsidian://open?vault=llmwiki&amp;file=wiki%2Freasoning%2F',
    'obsidian://open?vault=llmwiki&amp;file=wiki%2Ftimelines%2F',
  ]) {
    assert.ok(report.includes(href), `missing corrected href: ${href}`);
  }
  assert.doesNotMatch(report, /\.pdf\.html/);
  assert.doesNotMatch(report, /href="\.\.\/\.\.\/(?:webpages|papers)\//);
  assert.doesNotMatch(report, /href="\.\.\/\.\.\/\.\.\/(?:queries|reasoning|timelines)\//);
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
