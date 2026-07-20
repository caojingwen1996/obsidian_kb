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

test('industry panels wait for user supplied content', () => {
  const html = readFileSync(sourcePath, 'utf8');
  assert.match(html, /等待你的指示/);
  assert.doesNotMatch(html, /科技自主|能源安全|国防安全|基础设施|AI 算力|机器人|低空经济|创新药|金融|消费|制造|公用事业/);
  assert.doesNotMatch(html, /国家安全|高成长|经济基本盘|现金流稳定器|产业化节奏/);
  assert.doesNotMatch(html, /半导体设备|银行 \/ 保险|食品饮料|电力 \/ 水务/);
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
