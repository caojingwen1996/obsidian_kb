import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExampleSnapshot } from '../src/data-service.mjs';
import { deriveDashboard, resolveStorage } from '../src/app.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '..', 'src', 'index.html');
const artifactPath = join(here, '..', 'a-share-market-dashboard.html');

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

test('sidebar switches between thermometer and industry panels', () => {
  const html = readFileSync(sourcePath, 'utf8');
  for (const shell of ['thermometer', 'industry']) {
    assert.match(html, new RegExp(`<button[^>]+data-shell="${shell}"`));
  }
  for (const id of [
    'industry-strategy',
    'industry-emerging',
    'industry-pillar',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /industry-sectors/);
  assert.doesNotMatch(html, />板块</);
});

test('industry panels use Ice Ice Xiaomei three-industry classification', () => {
  const html = readFileSync(sourcePath, 'utf8');
  for (const term of [
    '战略资源',
    '黄金',
    '铜',
    '稀土',
    '锂',
    '能源',
    '关键矿产',
    '新兴产业',
    '集成电路',
    '航空航天',
    '生物医药',
    '低空经济',
    '新型储能',
    '智能机器人',
    '支柱产业',
    '汽车',
    '新能源',
    '高端制造',
    '机械装备',
    '电力设备',
    '成熟制造业龙头',
  ]) {
    assert.match(html, new RegExp(term));
  }
  assert.doesNotMatch(html, /等待你的指示|这里不预填任何内容/);
  assert.doesNotMatch(html, /银行 \/ 保险|食品饮料|电力 \/ 水务|国家安全|高成长|经济基本盘|现金流稳定器/);
  assert.doesNotMatch(html, /半导体设备|银行 \/ 保险|食品饮料|电力 \/ 水务/);
});

test('industry panels use the approved feed layout without the tracking card', () => {
  const html = readFileSync(sourcePath, 'utf8');
  for (const marker of [
    'industry-workbench',
    'industry-filter-tabs',
    'industry-research-board',
    'industry-date-row',
    'industry-feed',
    'industry-report',
    'industry-timeline',
    '产业研报',
    '支柱产业-高端制造',
    '中国中车机构级决策研报',
    '中国中车资金面分层分析',
    '中国船舶资金面分层分析',
    '神马电力机构级决策研报',
    '神马电力资金面分层分析',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /当前热点/);
  assert.doesNotMatch(html, /industry-tracking/);
  assert.doesNotMatch(html, /产业跟踪/);
  assert.doesNotMatch(html, /<p class="eyebrow">INDUSTRY TRACKING<\/p>/);
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
