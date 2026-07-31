import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExampleSnapshot } from '../src/data-service.mjs';
import {
  deriveDashboard,
  allocationCategoryForReport,
  evaluateFuguiStrategyCandidate,
  findDuplicateTrackingItem,
  leftEdgeFromValueRange,
  normalizeFuguiStrategyItems,
  normalizeTrackingItems,
  resolveStorage,
  stockSecidFromCode,
  summarizeHoldings,
  summarizeTrackingItems,
  trackingLeftEdgeDistance,
  trackingQuotePriceOnly,
  trackingRiskRewardForQuote,
  trackingSignalForQuote,
  valueRangePrices,
} from '../src/app.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '..', 'src', 'index.html');
const artifactPath = join(here, '..', 'a-share-market-dashboard.html');
const launcherPath = join(here, '..', '启动面板.cmd');
const repoRoot = join(here, '..', '..', '..');
const hangTianElectronicsReportPath = join(
  repoRoot,
  'sources',
  'automations',
  '新兴产业',
  '商业航天',
  '2026-07-23-1427-航天电子-机构级决策研报.html',
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
    'dividend-signal-view',
    'dividend-signal-detail',
    'event-calendar-heading',
    'event-calendar-list',
    'event-calendar-count',
    'featured-entry-heading',
    'open-featured-digest',
    'metric-list',
    'position-view',
    'valuation-view',
    'emotion-view',
    'rules-view',
    'audit-view',
    'audit-errors',
    'example-mode',
    'refresh-data',
    'fugui-provider-toggle',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<label class="mode-switch" for="example-mode" hidden>/);
  assert.doesNotMatch(html, /<span id="sidebar-status">示例数据<\/span>/);
  assert.doesNotMatch(html, /正在用内置示例数据初始化/);
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="sidebar-collapse"|id="sidebar-open"/);
  assert.doesNotMatch(styles, /\.app-shell\.is-sidebar-collapsed|\.sidebar-collapse|\.sidebar-open/);
  assert.doesNotMatch(appSource, /SIDEBAR_COLLAPSED_STORAGE_KEY|setSidebarCollapsed/);
});

test('window controls use native buttons with the four approved values', () => {
  const html = readFileSync(sourcePath, 'utf8');
  for (const years of [1, 3, 5, 10]) {
    assert.match(html, new RegExp(`<button[^>]+data-window="${years}"`));
  }
});

test('sidebar exposes the personal position workspace as a first-level tree domain', () => {
  const html = readFileSync(sourcePath, 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  for (const domain of ['thermometer', 'strategy', 'industry', 'personal', 'changelog']) {
    assert.match(html, new RegExp(`<button[^>]+data-tree-domain="${domain}"`));
  }
  for (const id of ['tree-thermometer', 'tree-strategy', 'tree-industry', 'tree-personal', 'changelog-view',
    'industry-strategy',
    'industry-emerging',
    'industry-pillar',
    'position-manager',
    'holding-tracker',
    'featured-digest',
    'fugui-strategy',
    'fugui-strategy-heading',
    'fugui-strategy-form',
    'fugui-panel-collapse',
    'fugui-panel-open',
    'fugui-strategy-status',
    'fugui-strategy-body',
    'xiaomei-strategy',
    'xiaomei-strategy-heading',
    'topic-map',
    'holding-form',
    'tracking-form',
    'tracking-count',
    'tracking-filter',
    'tracking-allocation-mode',
    'tracking-allocation-collapse',
    'tracking-allocation-body',
    'holdings-table-body',
    'holding-tracker-list',
    'holding-tracker-empty',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const status of ['持有', '观察', '计划加仓', '计划减仓']) {
    assert.match(html, new RegExp(`<option>${status}</option>`));
  }
  for (const status of ['持有', '观察']) {
    assert.match(html, new RegExp(`data-status-filter="${status}"`));
  }
  assert.match(html, /data-status-filter="addable"[^>]*>可加<\/button>/);
  assert.match(html, /data-status-filter="reducible"[^>]*>可减<\/button>/);
  assert.doesNotMatch(html, /data-status-filter="allocation"/);
  assert.match(html, /id="open-tracking-form"[^>]*>新增跟踪<\/button>\s*<button class="button-secondary" id="refresh-tracking-reports"[^>]*>一键更新<\/button>\s*<button class="allocation-ribbon" id="tracking-allocation-mode"[^>]*>配比模式<\/button>/);
  assert.doesNotMatch(html, /data-status-filter="计划加仓"/);
  assert.doesNotMatch(html, /data-status-filter="计划减仓"/);
  assert.match(html, /id="tracking-allocation-view" hidden/);
  assert.match(html, /id="tracking-allocation-collapse"[^>]*aria-controls="tracking-allocation-body"[^>]*aria-expanded="true"/);
  assert.match(html, /id="tracking-allocation-chart"/);
  assert.match(html, /id="tracking-allocation-legend"/);
  assert.match(html, /<button class="button-secondary" id="open-tracking-form" type="button">新增跟踪<\/button>/);
  assert.match(html, /<button class="button-secondary" id="refresh-tracking-reports" type="button">一键更新<\/button>/);
  const trackingForm = html.match(/<form class="tracking-form panel" id="tracking-form" hidden>[\s\S]*?<\/form>/)?.[0] ?? '';
  assert.match(trackingForm, /<label><span>标的名称<\/span><input name="name" required maxlength="30"/);
  assert.match(trackingForm, /<label><span>证券代码<\/span><input name="code" maxlength="12"/);
  assert.doesNotMatch(trackingForm, /<label><span>证券代码<\/span><input name="code" required/);
  assert.match(trackingForm, /id="tracking-form-status"/);
  assert.match(appSource, /findDuplicateTrackingItem\(trackingItems, next/);
  assert.match(appSource, /已在跟踪清单中/);
  assert.match(html, /data-tree-domain="thermometer"[^>]+aria-expanded="true"[^>]+aria-controls="tree-thermometer"/);
  assert.match(html, /data-tree-domain="strategy"[^>]+aria-expanded="false"[^>]+aria-controls="tree-strategy"/);
  assert.match(html, /data-tree-domain="industry"[^>]+aria-expanded="false"[^>]+aria-controls="tree-industry"/);
  assert.match(html, /data-tree-domain="personal"[^>]+aria-expanded="false"[^>]+aria-controls="tree-personal"/);
  assert.doesNotMatch(html, /class="shell-switcher"/);
  assert.doesNotMatch(html, /industry-sectors/);
  assert.doesNotMatch(html, />板块</);
  assert.match(html, /class="tracking-table-wrap"/);
  assert.match(html, /<table class="tracking-table">/);
  assert.match(html, /id="tree-thermometer"[\s\S]*data-view="market-summary"[^>]*aria-current="page"><span>01<\/span>市场总览<\/button>\s*<button class="nav-item" type="button" data-view="dividend-signal-view"><span>02<\/span>红利信号<\/button>/);
  assert.match(html, /id="tree-thermometer"[\s\S]*<button class="nav-item" type="button" data-view="featured-digest"><span>08<\/span>每日跟踪<\/button>/);
  assert.doesNotMatch(html.match(/<div class="tree-children" id="tree-thermometer">[\s\S]*?<\/div>/)?.[0] ?? '', /data-view="fugui-strategy"/);
  assert.match(html, /id="tree-thermometer"[\s\S]*<button class="nav-item" type="button" data-view="topic-map"><span>09<\/span>主题<\/button>/);
  assert.match(html, /id="tree-strategy"[\s\S]*<button class="nav-item" type="button" data-view="fugui-strategy"><span>01<\/span>富贵策略<\/button>\s*<button class="nav-item" type="button" data-view="xiaomei-strategy"><span>02<\/span>小美策略<\/button>/);
  const personalTree = html.match(/<div class="tree-children" id="tree-personal" hidden>[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.doesNotMatch(personalTree, /data-view="featured-digest"/);
  assert.doesNotMatch(personalTree, /data-view="fugui-strategy"/);
  assert.doesNotMatch(personalTree, /data-view="topic-map"/);
  assert.match(html, /<section class="view" id="featured-digest" data-shell-content="thermometer" aria-labelledby="featured-digest-heading">/);
  assert.match(html, /<h2 class="visually-hidden" id="featured-digest-heading">每日跟踪<\/h2>/);
  assert.match(html, /<section class="view" id="fugui-strategy" data-shell-content="strategy" aria-labelledby="fugui-strategy-heading">/);
  assert.match(html, /<h2 class="visually-hidden" id="fugui-strategy-heading">富贵策略<\/h2>/);
  assert.match(html, /<section class="view" id="xiaomei-strategy" data-shell-content="strategy" aria-labelledby="xiaomei-strategy-heading">/);
  assert.match(html, /<h2 class="visually-hidden" id="xiaomei-strategy-heading">小美策略<\/h2>/);
  assert.match(html, /<p class="eyebrow">XIAOMEI STRATEGY<\/p>\s*<h3>小美策略<\/h3>/);
  assert.doesNotMatch(html, /class="section-header fugui-strategy-head"/);
  assert.match(html, /<form class="fugui-form panel" id="fugui-strategy-form">/);
  assert.match(html, /id="fugui-panel-collapse"[^>]*aria-controls="fugui-strategy-form"[^>]*>收起面板<\/button>/);
  assert.match(html, /id="fugui-panel-open"[^>]*aria-controls="fugui-strategy-form"[^>]*hidden>打开面板<\/button>/);
  assert.match(html, /id="fugui-strategy-status"[\s\S]*自动填写行业[\s\S]*10年国债利率/);
  assert.match(html, /name="name"[^>]*placeholder="例如 长江电力"/);
  const fuguiForm = html.match(/<form class="fugui-form panel" id="fugui-strategy-form">[\s\S]*?<\/form>/)?.[0] ?? '';
  assert.doesNotMatch(fuguiForm, /name="industry"|name="code"|name="ownership"|name="marketCapYi"|name="dividendYield"|name="price"|name="bond10yYield"/);
  assert.doesNotMatch(html, /scan-fugui-strategy|一键扫描/);
  assert.match(html, /<thead><tr><th>行业<\/th><th>标的<\/th><th>市值<\/th><th>股息率<\/th><th>是否达标<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody id="fugui-strategy-body">/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-table \{ width: 100%; table-layout: fixed;/);
  assert.doesNotMatch(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-table \{[^}]*min-width:/);
  assert.doesNotMatch(appSource, /\/api\/fugui-strategy|scanFuguiStrategy/);
  assert.match(html, /<button class="button-secondary" id="fugui-provider-toggle" type="button">切换到Tushare<\/button>/);
  assert.match(appSource, /\/api\/fugui-candidate\?name=.*provider=/);
  assert.match(appSource, /切换到Tushare/);
  assert.match(appSource, /切换到AKShare/);
  assert.match(appSource, /FUGUI_PANEL_COLLAPSED_STORAGE_KEY/);
  assert.match(appSource, /setFuguiPanelCollapsed/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-form\.is-collapsed \.fugui-form-body/);
  assert.match(html, /<section class="view" id="topic-map" data-shell-content="thermometer" aria-labelledby="topic-map-heading">/);
  assert.match(html, /<h2[^>]*id="topic-map-heading"[^>]*>主题<\/h2>/);
  assert.match(html, /<thead><tr><th>标的<\/th><th>动态价值区间<\/th><th>盘中实时<\/th><th><button class="table-sort-button" type="button" id="tracking-sort-intraday"[^>]*>盈亏比<\/button><\/th><th>风险方向<\/th><th>数据来自研报<\/th><th>复盘<\/th><th>星级<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody id="holding-tracker-list"><\/tbody>/);
  assert.match(html, /id="review-diary-modal"/);
  assert.match(html, /id="review-diary-form"/);
  assert.match(appSource, /\/api\/review-diary/);
  assert.match(appSource, /\/api\/tracking-rerender-reports/);
  assert.match(appSource, /data-action="review-diary"[\s\S]*复盘日记/);
  assert.doesNotMatch(html, /tracker-card/);
});

test('market summary renders three overview cards and includes signal sources in data audit', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const artifact = readFileSync(artifactPath, 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

  assert.match(source, /class="overview-grid"/);
  assert.match(source, /id="youzhiyouxing-temperature-card"/);
  assert.match(source, /id="dividend-signal-card"/);
  assert.match(source, /id="dividend-signal-view"/);
  assert.match(source, /id="dividend-signal-detail"/);
  assert.doesNotMatch(source, /id="dividend-signal-heading"/);
  assert.match(source, /id="nasdaq100-card"/);
  assert.match(source, /class="summary-shortcut-grid"/);
  assert.match(source, /融资余额/);
  assert.match(source, /每日跟踪/);
  assert.equal((source.match(/summary-shortcut-card/g) ?? []).length >= 5, true);
  assert.equal((source.match(/summary-shortcut-card-empty/g) ?? []).length, 3);
  assert.match(source, /id="open-featured-digest"[^>]*>进入每日跟踪<\/button>/);
  assert.match(source, /id="event-calendar-list"/);
  assert.doesNotMatch(source, /预留模块/);
  assert.doesNotMatch(source, /暂空/);
  for (const marker of [
    '市场温度计',
    '打开有知有行市场温度计源数据',
    '有知有行公开温度计',
    '/api/youzhiyouxing-temperature',
    '中证红利股息率信号',
    '查看红利信号详情',
    'CSI DIVIDEND SIGNAL',
    '打开信号源',
    '来源与验证边界',
    '历史分位点',
    'DIVIDEND YIELD HISTORY',
    '中证红利股息率走势',
    '中证红利每日信号.xlsx',
    'dividend-yield-chart',
    '../../sources/automations/中证红利信号/最新信号.md',
    '未进重点买入',
    '股息率2',
    '10年国债收益率',
    'AKShare bond_zh_us_rate',
    'C（小额定投）',
    '2026-07-29',
    '股债利差',
    '股息率2 - 10年国债收益率',
    '历史分位',
    '理杏仁公开页面',
    '雪球行情',
    '原始来源备注',
    'zzhl-dividend-signal 最新信号',
    '<td>中证红利股息率信号</td>',
    '<td>观察项</td>',
    '纳斯达克100指数',
    '当前点位',
    '距离历史最高点跌幅',
    '/api/nasdaq100',
    'EVENT CALENDAR',
    'BBXM DAILY DIGEST',
    '进入每日跟踪',
    '事件日历',
    'event-calendar-empty',
  ]) {
    assert.match(artifact, new RegExp(marker));
  }
  assert.doesNotMatch(artifact, /记录信息|dividend-record-list|运行时间|指数估值日期|国债收益率日期|理杏仁估值日期/);
  assert.ok(artifact.includes('AKShare stock_zh_index_value_csindex(000922, 股息率2)'));
  assert.match(appSource, /absolute\.grade \? `\$\{absolute\.grade\} \$\{absolute\.label\}`/);
  assert.match(appSource, /const displayDate = signal\.indexDate \|\| signal\.recordDate/);
  assert.match(appSource, /<p>\$\{escapeHtml\(displayDate\)\}<\/p>/);
  assert.doesNotMatch(artifact, /CSI_DIVIDEND_SIGNAL\s*=\s*Object\.freeze\(\s*\/\/ CSI_DIVIDEND_SIGNAL/);
  assert.doesNotMatch(artifact, /CSI_DIVIDEND_YIELD_HISTORY\s*=\s*Object\.freeze\(\s*\/\/ CSI_DIVIDEND_YIELD_HISTORY/);
  assert.match(artifact, /"dividendYield2": 4\.4/);
  assert.match(artifact, /"spread": 2\.67/);
  assert.match(artifact, /"spreadSignal": "C（小额定投）"/);
  assert.match(artifact, /"date": "2026-06-02"[\s\S]*"value": 4\.83/);
  assert.match(readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8'), /中证红利每日信号\.xlsx/);
});

test('changelog renders the approved initial entries', () => {
  const html = readFileSync(artifactPath, 'utf8');
  assert.match(html, /<p class="eyebrow">CHANGELOG<\/p>/);
  assert.match(html, /最近发生了什么——新功能、调整与修复，都写在这里。/);
  for (const title of [
    '市场总览改为三张信号卡',
    '温度计新增富贵策略',
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
    '航天电子-机构级决策研报',
    '十五五电网投资与电网行业完整分析报告',
    '../../sources/automations/支柱产业/电网/2026-07-17-十五五电网投资与电网行业完整分析报告.html',
    '中国中车机构级决策研报',
    '中国中车资金面分层分析',
    '中国船舶资金面分层分析',
    '../../sources/automations/支柱产业/2026-07-16-1334-中国中车机构级决策研报.html',
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
  assert.doesNotMatch(html, /industry-tracking/);
  assert.doesNotMatch(html, /<h[1-6][^>]*>产业跟踪<\/h[1-6]>/);
  assert.doesNotMatch(html, /<p class="eyebrow">INDUSTRY TRACKING<\/p>/);
  assert.doesNotMatch(html, /<button type="button" data-filter="电力设备" aria-pressed="false">电力设备<\/button>/);
  assert.doesNotMatch(html, /集成电路产业链缩圈|生物医药、新型储能与智能机器人观察/);
  assert.doesNotMatch(html, /战略资源：资源安全与硬资产重估|铜与关键矿产供需周期跟踪|黄金与能源的宏观变量观察/);
  assert.match(html, /<div class="industry-date-row"><strong>\d+月\d+日<\/strong><span>星期[一二三四五六日] · \d+条<\/span><\/div>/);
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

test('featured digest replaces book list and reads BBXM daily summaries', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const html = readFileSync(artifactPath, 'utf8');
  const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

  assert.match(source, /data-view="featured-digest"/);
  assert.match(source, /data-shell-content="thermometer" aria-labelledby="featured-digest-heading"/);
  assert.match(source, /BBXM_FEATURED_DIGEST/);
  assert.doesNotMatch(source, /READING LIST|书单入口|book-list/);
  assert.match(buildSource, /BBXM每日汇总/);
  assert.match(buildSource, /scanBbxmDailyDigest/);
  assert.match(buildSource, /metadataValue\(markdown, '标签'\)/);
  assert.match(buildSource, /digestFiltersFromPost\(markdown\)/);
  assert.match(buildSource, /digestOriginalText\(markdown, title\)/);
  assert.match(buildSource, /originalTextEncoded/);
  assert.match(buildSource, /featured-original-toggle/);
  assert.match(buildSource, /featured-delete/);
  assert.match(buildSource, /data-featured-id/);
  assert.doesNotMatch(buildSource, /digestFilters\(text\)/);
  assert.match(appSource, /applyFeaturedFilter/);
  assert.match(appSource, /featured-original-toggle/);
  assert.match(appSource, /featured-delete/);
  assert.match(appSource, /FEATURED_DELETED_STORAGE_KEY/);
  assert.match(appSource, /confirm\(`确认删除/);
  assert.match(appSource, /\/api\/featured-post/);
  assert.match(appSource, /method: 'DELETE'/);
  assert.match(appSource, /删除原始 Markdown/);
  assert.match(appSource, /decodeFeaturedOriginal/);
  assert.match(appSource, /TextDecoder/);
  assert.match(appSource, /收起原文/);
  assert.match(appSource, /setShell\('thermometer', 'featured-digest'\)/);
  for (const marker of [
    '每日跟踪',
    '当前热点',
    '来源目录：sources/automations/BBXM每日汇总',
    '投机周期',
    '../../sources/automations/BBXM每日汇总/2026-07-25/冰冰小美/135900_投机周期_40209002.md',
    '打开雪球原帖',
    '显示原文',
    '删除',
    'featured-original',
    'featured-filter-tabs',
    'featured-card',
    'data-featured-filter="macro"',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /READING LIST|这里先作为你的投资阅读书单入口|<!-- BBXM_FEATURED_DIGEST -->/);
});

test('topic map reads wiki topic pages into the thermometer navigation', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const html = readFileSync(artifactPath, 'utf8');
  const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

  assert.match(source, /data-view="topic-map"/);
  assert.match(source, /data-shell-content="thermometer" aria-labelledby="topic-map-heading"/);
  assert.match(source, /TOPIC_FILTER_TABS/);
  assert.match(source, /TOPIC_CARDS/);
  assert.match(buildSource, /wiki', 'topics'/);
  assert.match(buildSource, /scanTopicPages/);
  assert.match(buildSource, /renderTopicCards/);
  assert.match(appSource, /applyTopicFilter/);
  for (const marker of [
    '主题',
    '来源目录：wiki/topics',
    'topic-filter-tabs',
    'topic-card',
    'data-topic-filter="bbxm"',
    'data-topic-filter="bishi"',
    '../../wiki/topics/冰冰小美-知识地图.md',
    '../../wiki/topics/碧树西风-投资系统建模.md',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /<!-- TOPIC_(?:FILTER_TABS|CARDS) -->/);
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

test('tracking duplicate check blocks same code or same name while editing self', () => {
  const items = [
    { id: 'tracking-1', code: '002436', name: '兴森科技', status: '观察' },
    { id: 'tracking-2', code: '600879', name: '航天电子', status: '持有' },
  ];

  assert.equal(findDuplicateTrackingItem(items, { code: '002436', name: '兴森科技' })?.id, 'tracking-1');
  assert.equal(findDuplicateTrackingItem(items, { code: '', name: '航天电子' })?.id, 'tracking-2');
  assert.equal(findDuplicateTrackingItem(items, { code: '002436', name: '兴森科技' }, 'tracking-1'), null);
});

test('fugui strategy keeps rule results as status instead of admission gate', () => {
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const passed = evaluateFuguiStrategyCandidate({
    ownership: '央企',
    marketCapYi: 1200,
    dividendYield: 5.2,
    price: 29.8,
    bond10yYield: 1.7,
  });
  const failed = evaluateFuguiStrategyCandidate({
    ownership: '其他',
    marketCapYi: 900,
    dividendYield: 4.9,
    price: 30,
    bond10yYield: 1.7,
  });
  const normalized = normalizeFuguiStrategyItems([{
    id: 'fugui-1',
    industry: '电力',
    name: '长江电力',
    code: '600900',
    ownership: '央企',
    marketCapYi: 6200,
    dividendYield: 5.8,
    price: 28.5,
    bond10yYield: 1.73,
    addedAt: 1784601060000,
  }]);

  assert.equal(passed.passed, true);
  assert.equal(passed.criteria.dividendYieldMin, 5.1);
  assert.equal(failed.passed, false);
  assert.match(failed.issues.join('；'), /性质不是央企\/国企/);
  assert.match(failed.issues.join('；'), /市值未大于1000亿/);
  assert.match(failed.issues.join('；'), /股价未低于30元/);
  assert.match(failed.issues.join('；'), /股息率未达到3倍10年国债利率/);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].marketCapYi, 6200);
  assert.match(appSource, /result\.passed \? '达标' : '未达标'/);
  assert.doesNotMatch(appSource, /未加入：\$\{normalizedCandidate\.name/);
});

test('tracking intraday sort distance measures closeness to dynamic value left edge', () => {
  assert.equal(leftEdgeFromValueRange('16.5—20.5 元'), 16.5);
  const nearLeft = trackingLeftEdgeDistance({ valueRange: '16.5—20.5 元', livePrice: 16.8 });
  const farFromLeft = trackingLeftEdgeDistance({ valueRange: '16.5—20.5 元', livePrice: 19.58 });
  const parsedQuote = trackingLeftEdgeDistance({ valueRange: '7.5—11.5 元/股', reportQuote: '14.62 元 · -4.76%' });

  assert.ok(nearLeft < farFromLeft);
  assert.equal(Number.isFinite(parsedQuote), true);
  assert.equal(trackingLeftEdgeDistance({ valueRange: '未获取到', livePrice: 12 }), Number.POSITIVE_INFINITY);
});

test('tracking addable and reducible filters derive signals from dynamic value range', () => {
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

  assert.equal(allocationCategoryForReport('../../sources/automations/战略资源/铜/铜产业报告.html'), 'strategy');
  assert.equal(allocationCategoryForReport('../../sources/automations/新兴产业/商业航天/航天电子.html'), 'emerging');
  assert.equal(allocationCategoryForReport('../../sources/automations/支柱产业/高端制造/福田汽车.html'), 'pillar');
  assert.deepEqual(valueRangePrices('16.5—20.5 元'), { left: 16.5, right: 20.5, center: 18.5 });
  assert.deepEqual(trackingSignalForQuote({ valueRange: '16.5—20.5 元', livePrice: 18 }), { addStars: 1, reducible: false });
  assert.deepEqual(trackingSignalForQuote({ valueRange: '16.5—20.5 元', livePrice: 18.4 }), { addStars: 0, reducible: false });
  assert.deepEqual(trackingSignalForQuote({ valueRange: '16.5—20.5 元', livePrice: 16 }), { addStars: 2, reducible: false });
  assert.deepEqual(trackingSignalForQuote({ valueRange: '16.5—20.5 元', livePrice: 21 }), { addStars: 0, reducible: true });
  assert.equal(trackingRiskRewardForQuote({ valueRange: '16.5—20.5 元', livePrice: 18 }).label, '约 1.5:1');
  assert.equal(trackingRiskRewardForQuote({ valueRange: '16.5—20.5 元', livePrice: 18.4 }).ratio < 1, true);
  assert.equal(trackingRiskRewardForQuote({ valueRange: '16.5—20.5 元', livePrice: 21 }).label, '无正向盈亏比');
  assert.equal(trackingRiskRewardForQuote({ valueRange: '16.5—20.5 元', livePrice: 16 }).label, '低于下沿');
  assert.equal(trackingRiskRewardForQuote({ valueRange: '16.5—20.5 元', reportQuote: '18.00 元' }).label, '等待实时');
  assert.match(appSource, /trackingStatusFilter === 'addable'/);
  assert.match(appSource, /trackingStatusFilter === 'reducible'/);
  assert.match(appSource, /trackingAllocationMode/);
  assert.match(appSource, /trackingAllocationCollapsed/);
  assert.match(appSource, /tracking-group-row/);
  assert.match(appSource, /'★'\.repeat\(signal\.addStars\)/);
});

test('tracking risk-reward display hides quote change percentage', () => {
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

  assert.equal(trackingQuotePriceOnly('14.62 元 · -4.76%'), '14.62 元');
  assert.equal(trackingQuotePriceOnly('未获取到'), '未获取到');
  assert.match(appSource, /`\$\{liveQuote\.price\.toFixed\(2\)\} 元`/);
  assert.doesNotMatch(appSource, /`\$\{liveQuote\.price\.toFixed\(2\)\} 元\$\{signalLabel\}`/);
  assert.match(appSource, /riskRewardText/);
  assert.match(appSource, /盈亏比|riskReward/);
  assert.doesNotMatch(appSource, /riskReward\.detail/);
  assert.doesNotMatch(appSource, /liveQuote\.changePercent >= 0 \? '\+' : ''/);
});

test('tracking list refreshes intraday quotes directly from stock codes', () => {
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

  assert.equal(stockSecidFromCode('300750'), '0.300750');
  assert.equal(stockSecidFromCode('601168'), '1.601168');
  assert.equal(stockSecidFromCode('000426'), '0.000426');
  assert.equal(stockSecidFromCode('bad'), '');
  for (const marker of [
    "宁德时代: '300750'",
    "西部矿业: '601168'",
    'trackingQuoteCache',
    'refreshTrackingQuotes',
    '/api/stock-quote?secid=',
    '读取行情…',
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(appSource, /refreshTrackingQuotes\(\)/);
  assert.match(appSource, /60_000/);
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
    './2026-07-24-航天电子资金面分析.html',
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
  assert.match(output, /启动面板\.cmd/);
});

test('file-protocol storage restrictions fall back to an in-memory cache', () => {
  const storage = resolveStorage(() => { throw new Error('SecurityError'); });
  storage.setItem('key', 'value');
  assert.equal(storage.getItem('key'), 'value');
});
