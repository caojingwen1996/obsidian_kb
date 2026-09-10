import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExampleSnapshot } from '../src/data-service.mjs';
import { parseUsdJpy, parseUsDollarIndex, parseUsTreasuryYield } from '../src/adapters.mjs';
import {
  calculateNasdaqGridPlan,
  parseNasdaqEtfHistory,
  renderNasdaqGridStrategy,
  deriveDashboard,
  allocationCategoryForReport,
  evaluateFuguiStrategyCandidate,
  fetchTodoAction,
  findDuplicateTrackingItem,
  leftEdgeFromValueRange,
  NASDAQ_GRID_LEVELS,
  normalizeNasdaqGridUnitAmount,
  normalizeFuguiStrategyItems,
  normalizeTrackingItems,
  pricingDeviationFromText,
  pricingDeviationToneClass,
  parseThreeFactorSummary,
  resolveStorage,
  stockSecidFromCode,
  summarizeHoldings,
  summarizeTrackingItems,
  todoActionUrl,
  trackingLeftEdgeDistance,
  trackingQuotePriceOnly,
  trackingRiskRewardForQuote,
  trackingSignalForQuote,
  valuationDispositionPresentation,
  valueRangePrices,
} from '../src/app.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '..', 'src', 'index.html');
const artifactPath = join(here, '..', 'a-share-market-dashboard.html');
const launcherPath = join(here, '..', '启动面板.cmd');
const todoDataPath = join(here, '..', 'data', 'todo.json');
const repoRoot = join(here, '..', '..', '..');
const hangTianElectronicsReportPath = join(
  repoRoot,
  'sources',
  'automations',
  '新兴产业',
  '商业航天',
  '2026-07-23-1427-航天电子-机构级决策研报.html',
);
const xingWangRuijieThreeFactorReportPath = join(
  repoRoot,
  'sources',
  'automations',
  '新兴产业',
  '算力',
  '中游-数据中心网络',
  '2026-08-17-1454-星网锐捷-三要素分析.html',
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

test('generated dashboard contains one document and a parseable runtime', () => {
  const html = readFileSync(artifactPath, 'utf8');
  const documents = html.match(/<!doctype html>/gi) ?? [];
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/i)?.[1];

  assert.equal(documents.length, 1);
  assert.ok(script, 'generated dashboard must contain its inline runtime');
  assert.doesNotThrow(() => new Function(script));
});

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
    'risk-monitor-card',
    'risk-level-value',
    'risk-level-detail',
    'risk-monitor',
    'risk-monitor-heading',
    'risk-screen-level',
    'risk-margin-chart',
    'risk-watch-list',
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

test('sidebar exposes the personal workspace as a first-level tree domain', () => {
  const html = readFileSync(sourcePath, 'utf8');
  const artifact = readFileSync(artifactPath, 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
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
    'todo-summary',
    'todo-board',
    'todo-matrix',
    'tracking-form',
    'tracking-count',
    'tracking-filter',
    'tracking-allocation-mode',
    'tracking-allocation-collapse',
    'tracking-allocation-body',
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
  assert.match(html, /id="open-tracking-form"[^>]*>新增跟踪<\/button>\s*<button class="button-secondary" id="refresh-tracking-reports"[^>]*>一键更新<\/button>\s*<button class="allocation-ribbon is-active" id="tracking-allocation-mode"[^>]*>配比模式<\/button>\s*<!-- DAILY_MONITOR_BUTTON -->/);
  assert.doesNotMatch(html, /data-status-filter="计划加仓"/);
  assert.doesNotMatch(html, /data-status-filter="计划减仓"/);
  assert.match(html, /class="allocation-ribbon is-active" id="tracking-allocation-mode"[^>]*aria-pressed="true"/);
  assert.match(html, /<div class="allocation-view" id="tracking-allocation-view">/);
  assert.match(appSource, /let trackingAllocationMode = true;/);
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
  assert.match(appSource, /紫光股份: '000938'/);
  assert.match(appSource, /国药现代: '600420'/);
  assert.match(appSource, /STOCK_THREE_FACTOR_REPORT_LINKS/);
  assert.match(appSource, /threeFactorReportLinkForTrackingItem/);
  assert.match(appSource, />三要素研报<\/a>/);
  assert.match(appSource, />个股研报<\/a>/);
  assert.match(artifact, /"东阳光": "\.\.\/\.\.\/sources\/automations\/新兴产业\/算力\/中游-算力基础设施与能源\/2026-07-16-1138-东阳光-机构级决策研报\.html"/);
  assert.match(artifact, /"紫光股份": "\.\.\/\.\.\/sources\/automations\/新兴产业\/算力\/中游-计算系统与集群\/2026-08-03-1638-紫光股份-机构级决策研报\.html"/);
  assert.match(artifact, /"国药现代": "\.\.\/\.\.\/sources\/automations\/temp\/2026-08-03-1128-国药现代-机构级决策研报\.html"/);
  assert.match(artifact, /"星网锐捷": "\.\.\/\.\.\/sources\/automations\/新兴产业\/算力\/中游-数据中心网络\/2026-08-17-1454-星网锐捷-三要素分析\.html"/);
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
  assert.match(html, /id="tree-thermometer"[\s\S]*<button class="nav-item" type="button" data-view="risk-monitor"><span>09<\/span>风险发现系统<\/button>/);
  assert.match(html, /id="tree-thermometer"[\s\S]*<button class="nav-item" type="button" data-view="topic-map"><span>10<\/span>主题<\/button>/);
  assert.match(html, /id="tree-strategy"[\s\S]*<button class="nav-item" type="button" data-view="fugui-strategy"><span>01<\/span>富贵策略<\/button>\s*<button class="nav-item" type="button" data-view="xiaomei-strategy"><span>02<\/span>小美策略<\/button>/);
  const personalTree = html.match(/<div class="tree-children" id="tree-personal" hidden>[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.match(personalTree, /data-view="position-manager"><span>01<\/span>需求清单<\/button>/);
  assert.match(personalTree, /data-view="holding-tracker"><span>02<\/span>持仓跟踪<\/button>/);
  assert.match(personalTree, /data-view="review-diary-view"><span>03<\/span>复盘日记<\/button>/);
  assert.doesNotMatch(personalTree, /data-view="featured-digest"/);
  assert.doesNotMatch(personalTree, /data-view="fugui-strategy"/);
  assert.doesNotMatch(personalTree, /data-view="topic-map"/);
  assert.ok(existsSync(todoDataPath));
  assert.doesNotMatch(html, /id="holding-form"/);
  assert.doesNotMatch(html, /id="holdings-table-body"/);
  assert.match(html, /<h2 class="visually-hidden" id="position-manager-heading">需求清单<\/h2>/);
  assert.match(buildSource, /todoDataPath/);
  assert.match(buildSource, /parseTodoListFromJson/);
  assert.match(buildSource, /todoQuadrantFromFlags/);
  assert.match(buildSource, /renderTodoMatrix/);
  assert.match(buildSource, /createdAt/);
  assert.match(buildSource, /draggable="true"/);
  assert.match(buildSource, /data-action="cycle-todo-status"/);
  assert.match(buildSource, /data-action="delete-todo"/);
  assert.match(appSource, /document\.getElementById\('holding-form'\)\?\./);
  assert.match(appSource, /handleTodoCreate/);
  assert.match(appSource, /insertTodoCard/);
  assert.match(appSource, /moveTodoCard/);
  assert.match(appSource, /moveTodoCardImmediately/);
  assert.match(appSource, /updateTodoCounts/);
  assert.match(appSource, /TODO_STATUSES/);
  assert.match(appSource, /updateTodoStatus/);
  assert.match(appSource, /payload\?\.archived/);
  assert.match(appSource, /已归档/);
  assert.match(appSource, /todoArchiveItemsFromPayload/);
  assert.match(appSource, /renderTodoArchiveList/);
  assert.match(appSource, /insertTodoArchiveItem/);
  assert.match(appSource, /method: 'PATCH'/);
  assert.match(appSource, /refreshTodoList/);
  assert.match(appSource, /fetchTodoAction\(todoActionUrl\('\/api\/todos'\)\)/);
  assert.match(appSource, /renderTodoList/);
  assert.doesNotMatch(appSource, /deferRebuild/);
  assert.match(appSource, /ACTIVE_VIEW_STORAGE_KEY/);
  assert.match(appSource, /readStoredActiveView/);
  assert.match(appSource, /setShell\(initialView\.domain, initialView\.viewId\)/);
  assert.match(appSource, /application\/x-todo-id/);
  assert.match(appSource, /document\.addEventListener\('drop'/);
  assert.match(appSource, /dragstart/);
  assert.match(appSource, /dragover/);
  assert.match(appSource, /drop/);
  assert.match(appSource, /toggleTodoQuadrant/);
  assert.match(appSource, /parseTodoActionResponse/);
  assert.match(appSource, /fetchTodoAction\(todoActionUrl\('\/api\/todo-item'\)/);
  assert.match(appSource, /AbortError/);
  assert.match(appSource, /本地面板服务版本过旧/);
  assert.match(appSource, /\/api\/todo-item/);
  assert.doesNotMatch(appSource, /globalThis\.location\.reload\(\)/);
  assert.match(styles, /\.todo-item-actions/);
  assert.match(styles, /\.todo-create-form/);
  assert.match(styles, /\.todo-status-button/);
  assert.match(styles, /\.todo-quadrant\.is-drop-target/);
  assert.match(styles, /\.todo-item\.is-dragging/);
  assert.match(styles, /\.todo-quadrant\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /\.todo-quadrant-header\s*\{[^}]*position:\s*sticky/s);
  assert.match(styles, /\.todo-item\s*\{[^}]*border:\s*1px solid[^}]*background:\s*var\(--card\)/s);
  assert.match(styles, /\.todo-matrix\s*\{[^}]*align-items:\s*stretch/s);
  assert.doesNotMatch(styles, /todo-move-select/);
  assert.match(artifact, /href="data\/todo\.json"[^>]*>打开 todo\.json<\/a>/);
  assert.match(artifact, /id="todo-source-status"/);
  assert.match(artifact, /id="todo-archive-toggle"[^>]*aria-controls="todo-archive-panel"[^>]*>已归档<\/button>/);
  assert.match(artifact, /id="todo-archive-panel"[^>]*hidden/);
  assert.match(artifact, /id="todo-archive-list"/);
  assert.match(artifact, /按归档时间倒序/);
  assert.match(artifact, /id="todo-create-open"[^>]*>新增需求<\/button>/);
  assert.match(artifact, /<form class="todo-create-form" id="todo-create-form" hidden>/);
  assert.match(artifact, /name="title"[^>]*placeholder="输入待办事项"/);
  const renderedTodoIds = [...new Set([...artifact.matchAll(/<article class="todo-item"[^>]*data-todo-id="(TODO-\d+)"/g)].map(match => match[1]))];
  const todoTotalCount = artifact.match(/id="todo-total-count">(\d+)项<\/strong>/);
  assert.ok(todoTotalCount);
  assert.equal(Number(todoTotalCount[1]), renderedTodoIds.length);
  assert.ok(renderedTodoIds.length > 0);
  assert.match(artifact, /data-todo-summary-quadrant="重要且紧急"/);
  assert.match(artifact, /class="todo-item" draggable="true"/);
  assert.match(artifact, /class="todo-quadrant-header"/);
  assert.match(artifact, /class="todo-quadrant-toggle"[^>]*data-action="toggle-todo-quadrant"[^>]*aria-expanded="true"/);
  assert.match(artifact, /class="todo-quadrant[^>]*tabindex="0"/);
  assert.match(artifact, /class="todo-item-kicker"[^>]*>\s*<span>TODO-\d+<\/span>/);
  assert.match(artifact, /class="todo-action-button is-status todo-status-button"[^>]*data-action="cycle-todo-status"[^>]*>状态 · 未开始<\/button>/);
  assert.match(artifact, /class="todo-item-actions"/);
  assert.match(artifact, /class="todo-item-time">创建 2026-08-27<\/span>/);
  assert.doesNotMatch(artifact, /class="todo-item-meta"/);
  assert.doesNotMatch(artifact, /<span>无截止日期<\/span>/);
  assert.doesNotMatch(artifact, /负责人 User/);
  assert.doesNotMatch(artifact, /<p>User<\/p>/);
  assert.doesNotMatch(artifact, /重要 是/);
  assert.doesNotMatch(artifact, /紧急 是/);
  assert.doesNotMatch(artifact, /<small>用户补充<\/small>/);
  assert.doesNotMatch(artifact, /class="todo-move-select"/);
  assert.doesNotMatch(artifact, /data-action="move-todo"/);
  assert.match(artifact, /data-action="delete-todo"/);
  assert.doesNotMatch(artifact, /data-todo-status="已完成"/);
  const q1TodoOrder = [
    artifact.indexOf('data-todo-id="TODO-009"'),
    artifact.indexOf('data-todo-id="TODO-008"'),
  ];
  assert.ok(q1TodoOrder.every(index => index >= 0));
  assert.deepStrictEqual([...q1TodoOrder].sort((left, right) => left - right), q1TodoOrder);
  assert.doesNotMatch(artifact, /data-todo-id="TODO-00[67]"/);
  assert.match(artifact, /data-todo-archive-id="TODO-006"/);
  assert.match(artifact, /data-todo-archive-id="TODO-007"/);
  assert.match(artifact, /<div class="todo-archive-row">\s*<span class="todo-archive-id">TODO-006<\/span>\s*<div class="todo-item-head todo-archive-title"><strong>整理知识库-产业思维<\/strong><\/div>[\s\S]*class="todo-archive-completed"/);
  assert.match(styles, /\.todo-archive-row\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s);
  assert.doesNotMatch(artifact, /<div class="todo-item-kicker"><span>TODO-006<\/span>/);
  for (const marker of [
    'TODO-005',
    'TODO-006',
    'TODO-007',
    'TODO-008',
    'TODO-009',
    '阅读《两次全球大危机的比较研究》',
    '整理知识库-产业思维',
    '产业思维与竞争格局的比较优势如何联合',
    '重要且紧急',
    '重要不紧急',
    '紧急不重要',
    '不重要且不紧急',
  ]) {
    assert.match(artifact, new RegExp(marker));
  }
  assert.match(html, /<section class="view" id="featured-digest" data-shell-content="thermometer" aria-labelledby="featured-digest-heading">/);
  assert.match(html, /<h2 class="visually-hidden" id="featured-digest-heading">每日跟踪<\/h2>/);
  assert.match(html, /<section class="view" id="risk-monitor" data-shell-content="thermometer" aria-labelledby="risk-monitor-heading">/);
  assert.match(html, /<h2 class="visually-hidden" id="risk-monitor-heading">风险发现系统<\/h2>/);
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
  assert.match(html, /<thead><tr><th>行业<\/th><th>标的<\/th><th><button class="table-sort-button" type="button" id="fugui-sort-ttm"[^>]*>TTM股息率<\/button><\/th><th>预期股息率<\/th><th>价值锚<\/th><th>是否达标<\/th><th>操作<\/th><\/tr><\/thead>/);
  assert.match(html, /id="fugui-filter"[\s\S]*data-fugui-filter="all"[\s\S]*全部/);
  assert.match(html, /data-fugui-filter="passed"[^>]*>达标<\/button>/);
  assert.match(html, /data-fugui-filter="failed"[^>]*>未达标<\/button>/);
  assert.match(html, /<tbody id="fugui-strategy-body">/);
  assert.match(appSource, /const impliedDividendPerShare = savedPrice !== null && savedDividendYield !== null/);
  assert.doesNotMatch(appSource, /const displayDividendYield = impliedDividendPerShare !== null && Number\.isFinite\(livePriceValue\)/);
  assert.doesNotMatch(appSource, /impliedDividendPerShare \/ livePriceValue \* 100/);
  assert.match(appSource, /const targetDividendPrice = targetYield => impliedDividendPerShare !== null && targetYield > 0/);
  assert.match(appSource, /targetDividendPrice\(5\.5\)/);
  assert.match(appSource, /renderGridLine\('市值', item\.marketCapYi, '亿'\)/);
  assert.match(appSource, /loadFuguiDividendYield\(secid\)\.then\(\(\) => renderFuguiStrategy\(\)\)/);
  assert.match(appSource, /\/api\/stock-dividend-yield\?secid=/);
  assert.match(appSource, /renderGridValue\(ttmDividendYield, '%'\)/);
  assert.doesNotMatch(appSource, /renderGridLine\('TTM', ttmDividendYield/);
  assert.match(appSource, /renderGridValue\(expectedDividendYield, '%', '待接入'\)/);
  assert.doesNotMatch(appSource, /renderGridLine\('预期', expectedDividendYield/);
  assert.match(appSource, /fuguiTtmSortMode === 'ttm-desc' \? 'ttm-asc' : 'ttm-desc'/);
  assert.match(appSource, /rows\.sort\(\(left, right\) =>/);
  assert.doesNotMatch(appSource, /renderGridLine\('周中', item\.weeklyMiddle\)/);
  assert.doesNotMatch(appSource, /renderGridLine\('周下', item\.weeklyLower\)/);
  assert.doesNotMatch(appSource, /renderGridLine\('日下', item\.dailyLower\)/);
  assert.match(appSource, /stockSecidFromCode\(item\.code\)/);
  assert.match(appSource, /loadTrackingQuote\(secid\)\.then\(\(\) => renderFuguiStrategy\(\)\)/);
  assert.match(appSource, /fuguiStatusFilter === 'passed'/);
  assert.match(appSource, /button\.dataset\.fuguiFilter/);
  assert.match(appSource, /<td><button class="fugui-remove" type="button" data-fugui-id=/);
  assert.doesNotMatch(appSource, /元<button class="fugui-remove"/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-table \{ width: 100%; min-width: 1180px; table-layout: fixed;/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-table-head \{ display: flex;/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-grid-list \{ display: grid;/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-remove \{ min-height: 30px;/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.fugui-table-wrap \{ overflow-x: auto;/);
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
  assert.match(html, /<thead><tr><th>标的<\/th><th>公允价值区间<\/th><th>交易定价偏离<small>盘中实时<\/small><\/th><th><button class="table-sort-button" type="button" id="tracking-sort-close-performance"[^>]*>收盘表现<\/button><small id="tracking-close-date"><\/small><\/th><th>每日估值监控<\/th><th>三要素判断<\/th><th>基本面状态<\/th><th>复盘<\/th><th>星级<\/th><th>操作<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody id="holding-tracker-list"><\/tbody>/);
  assert.match(appSource, /DAILY_MONITOR_LINKS/);
  assert.match(appSource, /dailyMonitorLinkForTrackingItem/);
  assert.doesNotMatch(appSource, /tracking-monitor-link/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.tracking-report-links \{ display: flex; flex-direction: column;/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.tracking-three-factor/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.tracking-three-factor > a/);
  assert.doesNotMatch(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.tracking-three-factor > strong/);
  assert.match(appSource, /parseThreeFactorSummary/);
  assert.match(appSource, /threeFactorSummaryCache/);
  assert.doesNotMatch(appSource, /threeFactor\.overall/);
  assert.match(artifact, /id="open-daily-monitor" href="data\/持仓今日监控汇总-\d{4}-\d{2}-\d{2}\.html"/);
  assert.doesNotMatch(artifact, /id="open-daily-monitor"[^>]*disabled/);
  assert.match(artifact, /"601208": \{"href":"data\/601208-东材科技-每日监控-\d{4}-\d{2}-\d{2}\.html"/);
  assert.match(artifact, /"601208": \{"href":"data\/601208-东材科技-每日监控-\d{4}-\d{2}-\d{2}\.html"[^\n]+"valuationReason":"[^"]+"/);
  assert.match(appSource, /valuationDispositionPresentation/);
  assert.match(appSource, /trackingCardValue\(documentNode, 'fair-value-range'\)/);
  assert.match(appSource, /data-tracking-key="pricing-deviation"/);
  assert.match(appSource, /report\.pricingDeviation/);
  assert.match(appSource, /report\.fundamental/);
  assert.match(appSource, /tracking-fundamental-status/);
  assert.match(appSource, /<td><div class="tracking-pricing-summary">\$\{pricingDeviationHtml\}<strong>\$\{escapeHtml\(intraday\)\}<\/strong><\/div><\/td>/);
  assert.match(appSource, /colspan="10"/);
  assert.match(appSource, /<td><div class="tracker-row-actions">[\s\S]*data-action="edit-tracking"[\s\S]*data-action="delete-tracking"/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.tracker-row-actions button \{ min-height: 30px; border: 1px solid/);
  assert.match(appSource, /tracking-valuation-disposition/);
  assert.match(appSource, /valuationStatusHtml = monitorLink[\s\S]*?<a class=/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /\.tracking-valuation-disposition/);
  assert.match(readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8'), /持仓今日监控汇总-/);
  assert.match(readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8'), /descriptor\.kind === 'single'/);
  assert.match(html, /id="review-diary-modal"/);
  assert.match(html, /id="review-diary-form"/);
  assert.match(html, /<section class="view" id="review-diary-view" data-shell-content="personal" aria-labelledby="review-diary-view-heading">/);
  const reviewDiarySection = html.match(/<section class="view" id="review-diary-view"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(reviewDiarySection, /<h2 class="visually-hidden" id="review-diary-view-heading">复盘日记<\/h2>/);
  assert.match(reviewDiarySection, /id="create-review-diary"[^>]*>新增日记<\/button>/);
  assert.doesNotMatch(reviewDiarySection, /<p class="eyebrow">REVIEW DIARY<\/p>\s*<h2/);
  assert.match(html, /id="review-diary-list"/);
  assert.match(reviewDiarySection, /id="review-diary-calendar-title"/);
  assert.match(reviewDiarySection, /id="review-diary-prev-month"/);
  assert.match(reviewDiarySection, /id="review-diary-current-month"[^>]*>本月<\/button>/);
  assert.match(reviewDiarySection, /id="review-diary-next-month"/);
  assert.match(reviewDiarySection, /aria-label="复盘日记月历"/);
  assert.match(html, /name="trackingTarget"/);
  assert.match(appSource, /REVIEW_DIARY_MARKET_TARGET/);
  assert.match(appSource, /REVIEW_DIARY_WEEKDAYS/);
  assert.match(appSource, /REVIEW_DIARY_SAVE_TIMEOUT_MS/);
  assert.match(appSource, /reviewDiaryCalendarMonth/);
  assert.match(appSource, /reviewDiarySaving/);
  assert.match(appSource, /reviewDiaryEntryItems/);
  assert.match(appSource, /reviewDiaryCalendarItems/);
  assert.match(appSource, /dailyEntryCount/);
  assert.match(appSource, /code:\s*'market-index'/);
  assert.match(appSource, /name:\s*'大盘指数'/);
  assert.match(appSource, /openNewReviewDiary/);
  assert.match(appSource, /\[REVIEW_DIARY_MARKET_TARGET,\s*...trackingItems\]/);
  assert.match(appSource, /obsidianUrl/);
  assert.match(appSource, /OBSIDIAN_VAULT_NAME/);
  assert.match(appSource, /obsidian:\/\/open\?vault=/);
  assert.ok(appSource.includes('workbench\\/targets\\/'));
  assert.ok(appSource.includes('workbench/journal/$1'));
  assert.match(appSource, /review-diary-calendar-entry/);
  assert.match(appSource, /review-diary-calendar-entry-head/);
  assert.match(appSource, /controller\.abort\(\)/);
  assert.match(appSource, /保存超时/);
  assert.match(appSource, /打开日记/);
  assert.doesNotMatch(appSource, /`\/\$\{String\(item\.path/);
  assert.match(appSource, /\/api\/review-diaries/);
  assert.match(appSource, /\/api\/review-diary/);
  assert.match(appSource, /\/api\/tracking-rerender-reports/);
  assert.match(appSource, /data-action="review-diary"[\s\S]*复盘日记/);
  const reviewDiaryStyles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(reviewDiaryStyles, /\.review-diary-calendar/);
  assert.match(reviewDiaryStyles, /\.review-diary-weekday/);
  assert.match(reviewDiaryStyles, /\.review-diary-day/);
  assert.doesNotMatch(html, /tracker-card/);
});

test('pricing deviation uses the concise judgement stored in the stock report', () => {
  assert.equal(pricingDeviationFromText('当前判断：严重估值泡沫。'), '严重估值泡沫');
  assert.equal(pricingDeviationFromText('普通高估，置信度中'), '普通高估');
  assert.equal(pricingDeviationFromText('可解释估值溢价'), '估值溢价');
  assert.equal(pricingDeviationFromText('合理溢价'), '估值溢价');
  assert.equal(pricingDeviationFromText('高溢价'), '普通高估');
  assert.equal(pricingDeviationFromText('价格脱锚'), '估值泡沫');
  assert.equal(pricingDeviationFromText('当前判断：折价。'), '折价');
  assert.equal(pricingDeviationFromText('当前判断：公允价值内；四级均未高亮。'), '公允价值内');
  assert.equal(pricingDeviationFromText('没有相关判断'), '');
  assert.equal(pricingDeviationToneClass('估值溢价'), 'is-premium');
  assert.equal(pricingDeviationToneClass('普通高估'), 'is-overvalued');
  assert.equal(pricingDeviationToneClass('估值泡沫'), 'is-bubble');
  assert.equal(pricingDeviationToneClass('严重估值泡沫'), 'is-severe');
  assert.equal(pricingDeviationToneClass('公允价值内'), 'is-neutral');
  assert.equal(pricingDeviationToneClass('未获取到'), 'is-neutral');
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.tracking-pricing-deviation\.is-premium \{ color: #17604e; background: #dff3eb; \}/);
  assert.match(styles, /\.tracking-pricing-deviation\.is-overvalued \{ color: #86610d; background: #fff0bd; \}/);
  assert.match(styles, /\.tracking-pricing-deviation\.is-bubble \{ color: #9b4d10; background: #ffe3c9; \}/);
  assert.match(styles, /\.tracking-pricing-deviation\.is-severe \{ color: #a82828; background: #ffe1df; \}/);
});

test('valuation disposition states have plain-language primary labels', () => {
  assert.deepEqual(valuationDispositionPresentation('NO_REVALUE'), { label: '维持估值', tone: 'no-revalue' });
  assert.deepEqual(valuationDispositionPresentation('LIGHT_REVALUE'), { label: '局部重算', tone: 'light-revalue' });
  assert.deepEqual(valuationDispositionPresentation('FULL_REVALUE'), { label: '完整重估', tone: 'full-revalue' });
  assert.deepEqual(valuationDispositionPresentation('MANUAL_REVIEW'), { label: '人工判断', tone: 'manual-review' });
  assert.deepEqual(valuationDispositionPresentation(''), { label: '未提供', tone: 'missing' });
});

test('three-factor report summary exposes the overall and each factor judgement', () => {
  const html = `<section class="factor-summary" aria-label="三要素摘要">
    <div class="factor-card neutral"><p>综合状态</p><strong>尚未形成有利共振</strong></div>
    <div class="factor-card positive"><p>竞争格局</p><strong>有利</strong></div>
    <div class="factor-card neutral"><p>流动性</p><strong>中性</strong></div>
    <div class="factor-card negative"><p>情绪位置</p><strong>不利</strong></div>
  </section>`;

  assert.deepEqual(parseThreeFactorSummary(html), {
    overall: { value: '尚未形成有利共振', tone: 'neutral' },
    competition: { value: '有利', tone: 'positive' },
    liquidity: { value: '中性', tone: 'neutral' },
    emotion: { value: '不利', tone: 'negative' },
  });
  assert.deepEqual(parseThreeFactorSummary('<p>没有摘要</p>'), {});
  assert.deepEqual(parseThreeFactorSummary(readFileSync(xingWangRuijieThreeFactorReportPath, 'utf8')), {
    overall: { value: '尚未形成有利共振', tone: 'neutral' },
    competition: { value: '中性', tone: 'neutral' },
    liquidity: { value: '中性', tone: 'neutral' },
    emotion: { value: '不利', tone: 'negative' },
  });
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
  assert.doesNotMatch(source, /id="margin-balance-card"/);
  assert.match(source, /每日跟踪/);
  assert.match(source, /id="risk-monitor-card"/);
  assert.match(source, /id="risk-level-value"/);
  assert.match(source, /风险等级/);
  assert.match(source, /进入风险发现系统/);
  assert.equal((source.match(/class="summary-shortcut-card/g) ?? []).length, 4);
  assert.equal((source.match(/summary-shortcut-card-empty/g) ?? []).length, 1);
  assert.match(source, /id="market-turnover-card"/);
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
    'parseDividendSignalMarkdown',
    'refreshDividendSignalFromSource',
    'cache: \'no-store\'',
    '未进重点买入',
    'dividend-detail-date',
    '股息率2',
    '全年收益率',
    '年内最大回撤',
    '年度收益与最大回撤',
    '成立首年',
    '完整年度',
    '2008-05-26',
    '中证红利年度表现.json',
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
  assert.match(artifact, /"indexDate": "\d{4}-\d{2}-\d{2}"/);
  assert.match(artifact, /"bondDate": "\d{4}-\d{2}-\d{2}"/);
  assert.doesNotMatch(artifact, /记录信息|dividend-record-list/);
  assert.ok(artifact.includes('AKShare stock_zh_index_value_csindex(000922, 股息率2)'));
  assert.ok(appSource.includes('数据日期：${displayDate}'));
  assert.match(appSource, /state\.dividendSignal = signal/);
  assert.match(appSource, /renderDerived\(derived, state\.youzhiyouxingTemperature, state\.nasdaq100, state\.dividendSignal\)/);
  assert.match(appSource, /viewId === 'market-summary' \|\| viewId === 'dividend-signal-view'/);
  assert.match(appSource, /absolute\.grade \? `\$\{absolute\.grade\} \$\{absolute\.label\}`/);
  assert.match(appSource, /const displayDate = signal\.indexDate \|\| signal\.recordDate/);
  assert.match(appSource, /class="dividend-detail-date"/);
  assert.doesNotMatch(appSource, /<div><small>10年国债<\/small><strong>\$\{formatNumber\(signal\.bond10yYield, 2\)\}%<\/strong><span>/);
  assert.doesNotMatch(appSource, /<article><small>股息率2<\/small><strong>\$\{formatNumber\(signal\.dividendYield2, 2\)\}%<\/strong><span>[\s\S]*signal\.indexDate/);
  assert.match(appSource, /dividend-hover-point/);
  assert.match(appSource, /股息率 \$\{formatNumber\(point\.value, 2\)\}%/);
  assert.match(appSource, /aria-label="\$\{escapeHtml\(label\)\}"/);
  assert.match(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'), /dividend-hover-tooltip/);
  assert.doesNotMatch(artifact, /CSI_DIVIDEND_SIGNAL\s*=\s*Object\.freeze\(\s*\/\/ CSI_DIVIDEND_SIGNAL/);
  assert.doesNotMatch(artifact, /CSI_DIVIDEND_YIELD_HISTORY\s*=\s*Object\.freeze\(\s*\/\/ CSI_DIVIDEND_YIELD_HISTORY/);
  assert.match(artifact, /"dividendYield2": \d+(?:\.\d+)?/);
  assert.match(artifact, /"ytdReturn": -?\d+(?:\.\d+)?/);
  assert.match(artifact, /"ytdMaxDrawdown": -?\d+(?:\.\d+)?/);
  assert.match(artifact, /"firstDate": "2008-05-26"/);
  assert.match(artifact, /"year": 2008[\s\S]*"status": "成立首年"/);
  assert.match(artifact, /"year": 2026[\s\S]*"status": "年内"/);
  assert.match(artifact, /"spread": \d+(?:\.\d+)?/);
  assert.match(artifact, /"spreadSignal": "C（小额定投）"/);
  assert.match(artifact, /"date": "2026-06-02"[\s\S]*"value": 4\.83/);
  assert.doesNotMatch(artifact, /<circle class="is-(?:high|low)"/);
  assert.match(readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8'), /中证红利每日信号\.xlsx/);
});

test('Nasdaq grid strategy keeps the approved seven levels and amount math', () => {
  assert.deepEqual(
    NASDAQ_GRID_LEVELS.map(level => [level.drawdownPercent, level.assumedPrice, level.multiplier]),
    [[-9, 91, 1], [-12.5, 87.5, 1], [-16, 84, 1.5], [-19.5, 80.5, 1.5], [-23, 77, 2], [-26.5, 73.5, 2], [-30, 70, 3]],
  );
  const plan = calculateNasdaqGridPlan(10_000, -17);
  assert.equal(plan.totalAmount, 120_000);
  assert.equal(plan.triggeredAmount, 35_000);
  assert.equal(plan.nextLevel.level, 4);
  assert.deepEqual(plan.levels.map(level => level.levelAmount), [10_000, 10_000, 15_000, 15_000, 20_000, 20_000, 30_000]);
  assert.equal(normalizeNasdaqGridUnitAmount(0), 10_000);
});

test('Nasdaq ETF buy prices use the ETF high and three-decimal price steps', () => {
  const data = parseNasdaqEtfHistory({ data: { klines: [
    '2026-09-03,4.8,4.7,4.9,4.6,100',
    '2026-08-01,5.1,5.2,5.637,5,100',
  ] }, proxySource: '测试行情' });
  assert.equal(data.highPrice, 5.637);
  assert.equal(data.highDate, '2026-08-01');
  assert.equal(data.date, '2026-09-03');
  assert.equal(data.close, 4.7);
  const plan = calculateNasdaqGridPlan(10_000, data.drawdownPercent, data.highPrice);
  assert.deepEqual(plan.levels.map(level => level.buyPrice), [5.129, 4.932, 4.735, 4.537, 4.340, 4.143, 3.945]);
  assert.equal(plan.nextLevel.level, 4);
  assert.equal(plan.totalAmount, 120_000);
  const view = renderNasdaqGridStrategy({ status: 'latest', data }, 10_000);
  assert.match(view.referenceText, /159941/);
  assert.match(view.referenceText, /5\.637（2026-08-01）/);
  assert.match(view.rowsHtml, /<td>4\.340<\/td>/);
  assert.equal((view.rowsHtml.match(/<td>/g) || []).length, 49);
});

test('Nasdaq ETF missing or invalid history never produces invented buy prices', () => {
  assert.throws(() => parseNasdaqEtfHistory({ data: { klines: [] } }));
  assert.throws(() => parseNasdaqEtfHistory({ data: { klines: ['2026-09-03,4,4,-,3,100'] } }));
  assert.throws(() => parseNasdaqEtfHistory({ data: { klines: ['2026-09-03,4,5,4,3,100'] } }));
  for (const high of [null, 0, -1, NaN, Infinity]) {
    assert.ok(calculateNasdaqGridPlan(10_000, null, high).levels.every(level => level.buyPrice === null));
  }
  const view = renderNasdaqGridStrategy({ status: 'missing', error: 'HTTP 400' }, 10_000);
  assert.match(view.referenceText, /HTTP 400/);
  assert.doesNotMatch(view.rowsHtml, /is-triggered|is-next/);
});

test('Nasdaq overview card opens the internal grid strategy view', () => {
  const source = readFileSync(sourcePath, 'utf8');
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /假设价格/);
  assert.doesNotMatch(source, /NASDAQ GRID STRATEGY|id="nasdaq-grid-heading"|分批规划加仓金额/);
  assert.match(source, /id="nasdaq-grid-view"[^>]*aria-label="广发纳指ETF网格策略"/);
  assert.doesNotMatch(appSource, /<td>\$\{formatNumber\(level\.assumedPrice/);
  assert.match(source, /<th>档位<\/th><th>相对前高跌幅<\/th><th>买入参考价（元）<\/th><th>加仓倍数<\/th><th>本档金额<\/th><th>累计投入<\/th><th>状态<\/th>/);
  for (const id of ['nasdaq-grid-view', 'nasdaq-grid-unit-amount', 'nasdaq-grid-summary', 'nasdaq-grid-table-body']) {
    assert.match(source, new RegExp(`id="${id}"`));
  }
  assert.match(appSource, /data-open-nasdaq-grid/);
  assert.match(appSource, /setShell\('thermometer', 'nasdaq-grid-view'\)/);
  assert.doesNotMatch(appSource, /<a class="overview-card nasdaq-card/);
});

test('changelog renders the approved initial entries', () => {
  const html = readFileSync(artifactPath, 'utf8');
  assert.match(html, /<p class="eyebrow">CHANGELOG<\/p>/);
  assert.match(html, /最近发生了什么——新功能、调整与修复，都写在这里。/);
  for (const title of [
    '需求清单升级为分层四象限看板',
    '持仓跟踪增加三要素研报入口',
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

test('industry report panels use the holdings-list table layout', () => {
  const html = readFileSync(artifactPath, 'utf8');
  for (const marker of [
    'industry-workbench',
    'industry-filter-tabs',
    'industry-research-list',
    'industry-research-item',
    'industry-research-rank',
    'industry-report-panel',
    'industry-report-table',
    'industry-report',
    '标的研报',

    '产业研报',
    '云铝股份-机构级决策研报',
    '../../sources/automations/支柱产业/电解铝/2026-07-23-1421-云铝股份-机构级决策研报.html',
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
    '中国中车资金面分析',
    '中国船舶资金面分层分析',
    '../../sources/automations/支柱产业/2026-07-16-1334-中国中车机构级决策研报.html',
    '../../sources/automations/支柱产业/高端制造/轨交装备/2026-08-04-中国中车资金面分析.html',
    '../../sources/automations/支柱产业/2026-07-18-中国船舶资金面分层分析.html',
    '华明装备-机构级决策研报',
    '../../sources/automations/支柱产业/电网/2026-07-30-华明装备-机构级决策研报.html',
    '神马电力-机构级决策研报',
    '神马电力资金面分层分析',
    '../../sources/automations/新兴产业/电网/神马电力-机构级决策研报.html',
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
  assert.match(html, /<section class="industry-report-panel holdings-panel panel"[^>]*>[\s\S]*<table class="industry-report-table tracking-table">/);
  assert.match(html, /<thead><tr><th>标的<\/th><th>公允价值区间<\/th><th>交易定价偏离<\/th><th>盘中实时<\/th><th>收盘表现<\/th><th>三要素判断<\/th><th>资金面分析<\/th><th>基本面状态<\/th><th>星级<\/th><\/tr><\/thead>/);
  assert.match(html, /<tr class="industry-report"[^>]*data-report-href="[^"]+"[^>]*data-stock-name="[^"]+"/);
  assert.match(html, /data-equity-report-href="[^"]*"/);
  assert.match(html, /data-three-factor-href="[^"]*"/);
  assert.match(html, /data-fund-flow-href="[^"]*"/);
  assert.match(html, /<section class="industry-research-list"[^>]*>[\s\S]*商业航天产业完整分析报告/);
  assert.match(html, /<li class="industry-research-item" data-filters="商业航天">[\s\S]*商业航天产业完整分析报告/);
  assert.match(html, /<li class="industry-research-item" data-filters="算力">[\s\S]*算力产业完整分析报告/);
  assert.match(html, /算力-中游-存储力产业完整分析报告/);
  assert.ok(
    html.indexOf('算力产业完整分析报告') < html.indexOf('算力-中游-存储力产业完整分析报告'),
    'parent industry report should render before subdivision reports',
  );
  assert.match(html, /<span class="industry-research-rank">1<\/span>/);
  const reportRows = [...html.matchAll(/<tr class="industry-report"[\s\S]*?<\/tr>/g)].map(match => match[0]);
  const reportPanels = [...html.matchAll(/<section class="industry-report-panel holdings-panel panel"[\s\S]*?<\/section>/g)].map(match => match[0]);
  for (const panel of reportPanels) {
    const tableHeader = panel.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? '';
    assert.doesNotMatch(tableHeader, /盈亏比|每日估值监控|复盘/);
    const stockNames = [...panel.matchAll(/data-stock-name="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(stockNames).size, stockNames.length, 'each industry panel should render one row per stock');
  }
  assert.equal(reportRows.filter(row => row.includes('data-stock-name="兴业银锡"')).length, 1);
  assert.match(reportRows.find(row => row.includes('data-stock-name="兴业银锡"')) ?? '', /data-fund-flow-href="[^"]*2026-07-30-兴业银锡资金面分析\.html"/);
  assert.equal(reportRows.some(row => row.includes('商业航天产业完整分析报告')), false);
  assert.equal(reportRows.some(row => row.includes('算力产业完整分析报告')), false);
  assert.match(html, /<section class="industry-research-list"[^>]*>[\s\S]*十五五电网投资与电网行业完整分析报告/);
  assert.match(html, /<li class="industry-research-item" data-filters="电网">[\s\S]*十五五电网投资与电网行业完整分析报告/);
  assert.equal(reportRows.some(row => row.includes('十五五电网投资与电网行业完整分析报告')), false);
  assert.match(html, /data-filters="电网"[\s\S]*华明装备-机构级决策研报/);
  assert.match(html, /data-filters="电网"[\s\S]*神马电力-机构级决策研报/);
  assert.doesNotMatch(html, /sources\/automations\/支柱产业\/电网\/神马电力-机构级决策研报\.html/);
  assert.match(html, /<tr class="industry-report"[^>]*data-filters=""[^>]*>[\s\S]*中国中车机构级决策研报/);
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(appSource, /querySelectorAll\('\.industry-research-item'\)/);
  assert.match(appSource, /querySelectorAll\('\.industry-report-panel'\)/);
  assert.match(appSource, /panel\.hidden = visibleReportCount === 0/);
  assert.match(appSource, /function hydrateIndustryReportRows/);
  assert.match(appSource, /trackingRiskRewardForQuote/);
  assert.match(appSource, /dailyMonitorLinkForTrackingItem/);
  assert.match(appSource, /threeFactorReportLinkForTrackingItem/);
  assert.match(appSource, /const fundFlowHtml = fundFlowHref/);
  const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(buildSource, /scanIndustryReports/);
  assert.match(buildSource, /renderFilterTabs/);
  assert.match(buildSource, /renderResearchBoards/);
  assert.match(buildSource, /groupFeedReportsByStock/);
  assert.doesNotMatch(buildSource, /commercialSpaceDir|electricGridDir|pillarFilters|strategicResourceFilters/);
  assert.doesNotMatch(html, /<!-- (?:STRATEGY|EMERGING|PILLAR)_(?:FILTER_TABS|RESEARCH_BOARDS|REPORTS|REPORT_COUNT) -->/);
  assert.doesNotMatch(html, /sources\/automations\/(?:商业航天|电网产业)\//);
  assert.doesNotMatch(html, /sources\/automations\/[^"']*\/archive\//);
  assert.match(html, /"云铝股份": "\.\.\/\.\.\/sources\/automations\/支柱产业\/电解铝\/2026-07-23-1421-云铝股份-机构级决策研报\.html"/);
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
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(source, /data-view="featured-digest"/);
  assert.match(source, /data-shell-content="thermometer" aria-labelledby="featured-digest-heading"/);
  assert.match(source, /data-view="risk-monitor"/);
  assert.match(source, /data-shell-content="thermometer" aria-labelledby="risk-monitor-heading"/);
  assert.match(source, /id="risk-margin-chart"/);
  assert.match(source, /SECOND SCREEN/);
  assert.match(appSource, /margin-hover-point/);
  assert.match(appSource, /const value = Number\(row\.rzye\)/);
  assert.match(appSource, /融资余额 \$\{formatNumber\(valueTrillion, 3\)\} 万亿/);
  assert.match(appSource, /截至某个交易日收盘，投资者尚未偿还的融资负债总额。/);
  assert.match(source, /美债10年/);
  assert.match(source, /美元指数/);
  assert.match(source, /美元兑日元/);
  assert.match(appSource, /usTreasury10y/);
  assert.match(appSource, /usDollarIndex/);
  assert.match(appSource, /usdJpy/);
  assert.match(appSource, /> 4\.5/);
  assert.match(appSource, /> 100/);
  assert.match(appSource, />= 160/);
  assert.match(appSource, /日元贬值风险线/);
  assert.match(appSource, /riskWatchMissingLabel/);
  assert.match(appSource, /riskWatchValueLabel/);
  assert.match(appSource, /datedRiskLabel/);
  assert.match(appSource, /日线/);
  assert.match(appSource, /当前显示内置示例数据/);
  assert.match(appSource, /entry\?\.status === 'example'/);
  assert.match(appSource, /上游返回空/);
  assert.doesNotMatch(appSource, /layerWatchLabel/);
  assert.doesNotMatch(appSource, /\.\.\.layers\.map/);
  assert.match(appSource, /高风险/);
  assert.match(styles, /margin-hover-tooltip/);
  assert.match(styles, /risk-watch-list li\.is-high-risk/);
  assert.match(styles, /cursor: crosshair/);
  assert.match(readFileSync(new URL('../src/adapters.mjs', import.meta.url), 'utf8'), /\/api\/us-treasury-yield/);
  assert.match(readFileSync(new URL('../src/adapters.mjs', import.meta.url), 'utf8'), /\/api\/us-dollar-index/);
  assert.match(readFileSync(new URL('../src/adapters.mjs', import.meta.url), 'utf8'), /\/api\/usd-jpy/);
  assert.match(readFileSync(new URL('../scripts/local_proxy.py', import.meta.url), 'utf8'), /fetch_us_treasury_yield/);
  assert.match(readFileSync(new URL('../scripts/local_proxy.py', import.meta.url), 'utf8'), /fetch_us_dollar_index/);
  assert.match(readFileSync(new URL('../scripts/local_proxy.py', import.meta.url), 'utf8'), /fetch_usd_jpy/);
  assert.match(source, /BBXM_FEATURED_DIGEST/);
  assert.doesNotMatch(source, /READING LIST|书单入口|book-list/);
  assert.match(buildSource, /BBXM每日汇总/);
  assert.match(buildSource, /scanBbxmDailyDigest/);
  assert.match(buildSource, /metadataValue\(markdown, '标签'\)/);
  assert.match(buildSource, /digestFiltersFromPost\(markdown\)/);
  assert.match(buildSource, /file\.name === '操作\.md'/);
  assert.match(buildSource, /markdownSection\(summary, '总观点'\)/);
  assert.match(buildSource, /markdownSection\(summary, '解析今天文章的观点'\)/);
  assert.match(buildSource, /obsidianOpenPathHref\(summaryPath\)/);
  assert.match(buildSource, /featured-summary-card/);
  assert.match(styles, /featured-summary-card/);
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
  assert.match(appSource, /setShell\('thermometer', 'risk-monitor'\)/);
  assert.match(appSource, /refreshRiskMarginChart/);
  assert.match(appSource, /riskLevelForDashboard/);
  assert.match(appSource, /风险等级计算暂未接入/);
  for (const marker of [
    '每日跟踪',
    '当前热点',
    '来源目录：sources/automations/BBXM每日汇总',
    '打开雪球原帖',
    '打开 summary.md',
    '当日汇总',
    '显示原文',
    '删除',
    'featured-original',
    'featured-summary-card',
    'featured-filter-tabs',
    'featured-card',
    'data-featured-filters="macro,market,industry,trade"',
    'data-featured-filter="macro"',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(html, /obsidian:\/\/open\?path=[^"]+summary\.md/);
  assert.doesNotMatch(html, /\/操作\.md/);
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
    'obsidian://open?path=',
    encodeURIComponent(join(repoRoot, 'wiki', 'topics', '冰冰小美-月报地图.md')),
    encodeURIComponent(join(repoRoot, 'wiki', 'topics', '碧树西风-投资系统建模.md')),
  ]) {
    assert.ok(html.includes(marker), marker);
  }
  assert.doesNotMatch(html, /<!-- TOPIC_(?:FILTER_TABS|CARDS) -->/);
});

test('local proxy allows wiki markdown links generated by topic cards', () => {
  const proxySource = readFileSync(new URL('../scripts/local_proxy.py', import.meta.url), 'utf8');

  assert.match(proxySource, /"\/wiki\/": \(vault_root \/ "wiki"\)\.resolve\(\)/);
  assert.match(proxySource, /parsed\.path\.startswith\("\/sources\/"\) or parsed\.path\.startswith\("\/wiki\/"\) or parsed\.path\.startswith\("\/workbench\/"\)/);
  assert.match(proxySource, /vault_root \/ "workbench" \/ "journal"/);
  assert.match(proxySource, /obsidian:\/\/open\?path=/);
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
  const dividendOnlyPassed = evaluateFuguiStrategyCandidate({
    ownership: '其他',
    marketCapYi: 100,
    dividendYield: 5.2,
    price: 99,
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
    expectedDividendYield: 4.8,
    price: 28.5,
    bond10yYield: 1.73,
    weeklyMiddle: 29.2,
    weeklyLower: 26.8,
    dailyLower: 27.4,
    addedAt: 1784601060000,
  }]);

  assert.equal(passed.passed, true);
  assert.equal(passed.criteria.dividendYieldMin, 5.1);
  assert.equal(dividendOnlyPassed.passed, true);
  assert.equal(failed.passed, false);
  assert.doesNotMatch(failed.issues.join('；'), /性质不是央企\/国企|市值未大于1000亿|股价未低于30元/);
  assert.match(failed.issues.join('；'), /股息率未达到3倍10年国债利率/);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].marketCapYi, 6200);
  assert.equal(normalized[0].expectedDividendYield, 4.8);
  assert.equal(normalized[0].weeklyMiddle, 29.2);
  assert.equal(normalized[0].weeklyLower, 26.8);
  assert.equal(normalized[0].dailyLower, 27.4);
  assert.match(appSource, /const result = evaluateFuguiStrategyCandidate\(item\)/);
  assert.match(appSource, /fuguiDividendYieldCache/);
  assert.match(appSource, /payload\?\.data\?\.dividendYieldTtm/);
  assert.match(appSource, /result\.passed \? '达标' : '未达标'/);
  assert.doesNotMatch(appSource, /未加入：\$\{normalizedCandidate\.name/);
});

test('tracking intraday sort distance measures closeness to dynamic value left edge', () => {
  assert.equal(leftEdgeFromValueRange('16.5—20.5 元'), 16.5);
  const nearLeft = trackingLeftEdgeDistance({ valueRange: '16.5—20.5 元', livePrice: 16.8 });
  const farFromLeft = trackingLeftEdgeDistance({ valueRange: '16.5—20.5 元', livePrice: 19.58 });

  assert.ok(nearLeft < farFromLeft);
  assert.equal(trackingLeftEdgeDistance({ valueRange: '7.5—11.5 元/股', reportQuote: '14.62 元 · -4.76%' }), Number.POSITIVE_INFINITY);
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
  assert.deepEqual(trackingSignalForQuote({ valueRange: '16.5—20.5 元', reportQuote: '18.00 元' }), { addStars: 0, reducible: false });
  assert.match(appSource, /trackingStatusFilter === 'addable'/);
  assert.match(appSource, /trackingStatusFilter === 'reducible'/);
  assert.match(appSource, /trackingAllocationMode/);
  assert.match(appSource, /trackingAllocationCollapsed/);
  assert.match(appSource, /tracking-group-row/);
  assert.match(appSource, /'★'\.repeat\(signal\.addStars\)/);
});

test('tracking list omits risk-reward display and keeps live price concise', () => {
  const appSource = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

  assert.equal(trackingQuotePriceOnly('14.62 元 · -4.76%'), '14.62 元');
  assert.equal(trackingQuotePriceOnly('未获取到'), '未获取到');
  assert.match(appSource, /`\$\{liveQuote\.price\.toFixed\(2\)\} 元`/);
  assert.match(appSource, /const intraday = liveQuote[\s\S]*: '';/);
  assert.doesNotMatch(appSource, /`\$\{liveQuote\.price\.toFixed\(2\)\} 元\$\{signalLabel\}`/);
  assert.doesNotMatch(appSource, /report\.reportQuote \? trackingQuotePriceOnly\(report\.reportQuote\)/);
  assert.doesNotMatch(html, /tracking-sort-intraday|>盈亏比<\/button>/);
  assert.doesNotMatch(appSource, /riskRewardText|tracking-sort-intraday/);
  assert.match(appSource, /trackingRiskRewardForQuote/);
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
    'trackingClosePerformanceCache',
    'refreshTrackingQuotes',
    '/api/stock-quote?secid=',
    '/api/stock-close-performance?secid=',
    'tracking-sort-close-performance',
    "trackingSortMode === 'close-desc' ? 'close-asc' : 'close-desc'",
    "trackingSortMode === 'close-asc' ? 1 : -1",
    'tracking-close-performance',
    'latestClose',
    'tradeDate',
    'tracking-close-date',
    '收盘',
  ]) {
    assert.match(appSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(appSource, /读取行情…/);
  assert.doesNotMatch(appSource, /stock-decline-streak|trackingDeclineCache|declineStreakText/);
  assert.doesNotMatch(appSource, /closePerformanceEntry\.data\.tradeDate \? `\$\{closePerformanceEntry\.data\.tradeDate\}收盘`/);
  assert.doesNotMatch(appSource, /formatNumber\(closePerformanceEntry\.data\.latestClose, 2\)} 元/);
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
  assert.ok(Number.isFinite(derived.usTreasury10y.data.at(-1).value));
  assert.ok(Number.isFinite(derived.usDollarIndex.data.at(-1).value));
  assert.ok(Number.isFinite(derived.usdJpy.data.at(-1).value));
});

test('us treasury yield parser keeps 10 year rate sorted by date', () => {
  const rows = parseUsTreasuryYield({
    rows: [
      { date: '20260730', y10: '4.51' },
      { date: '2026-07-29', y10: '4.48' },
      { date: '2026-07-28', y10: null },
    ],
  });

  assert.deepEqual(rows, [
    { date: '2026-07-29', value: 4.48 },
    { date: '2026-07-30', value: 4.51 },
  ]);
});

test('us dollar index parser keeps close values sorted by date', () => {
  const rows = parseUsDollarIndex({
    rows: [
      { trade_date: '20260730', close: '100.2' },
      { trade_date: '2026-07-29', bid_close: '99.8' },
      { trade_date: '2026-07-28', bid_close: null },
    ],
  });

  assert.deepEqual(rows, [
    { date: '2026-07-29', value: 99.8 },
    { date: '2026-07-30', value: 100.2 },
  ]);
});

test('usd jpy parser keeps close values sorted by date', () => {
  const rows = parseUsdJpy({
    rows: [
      { trade_date: '20260730', close: '160.2' },
      { trade_date: '2026-07-29', bid_close: '159.8' },
      { trade_date: '2026-07-28', bid_close: null },
    ],
  });

  assert.deepEqual(rows, [
    { date: '2026-07-29', value: 159.8 },
    { date: '2026-07-30', value: 160.2 },
  ]);
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

test('todo action requests abort instead of leaving the UI busy forever', async () => {
  let aborted = false;
  await assert.rejects(
    fetchTodoAction('/api/todo-item', { method: 'PATCH' }, (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        aborted = true;
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }), 5),
    error => error.name === 'AbortError',
  );
  assert.equal(aborted, true);
});

test('todo actions use the independent local service origin', () => {
  assert.equal(todoActionUrl('/api/todos', { protocol: 'http:', hostname: '127.0.0.1' }), 'http://127.0.0.1:49889/api/todos');
  assert.equal(todoActionUrl('/api/todos', { protocol: 'file:', hostname: '' }), '/api/todos');
});
