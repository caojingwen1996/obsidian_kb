const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const skillRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(skillRoot, '..', '..', '..');
const renderer = path.join(__dirname, 'render-industry-report-html.cjs');
const input = path.join(repoRoot, 'wiki', 'queries', '2026-07-17-商业航天产业完整分析报告.md');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-industry-render-'));
const output = path.join(tempDir, 'report.html');

const markdown = fs.readFileSync(input, 'utf8');
const reportLinks = [...markdown.matchAll(/\[\[([^\]|]*机构级决策研报(?:\.html)?)\|([^\]]+)\]\]/g)];
if (reportLinks.length !== 25) {
  throw new Error(`expected 25 company report links, got ${reportLinks.length}`);
}

const uniqueTargets = new Set(reportLinks.map((match) => match[1]));
if (uniqueTargets.size !== 18) {
  throw new Error(`expected 18 unique report targets, got ${uniqueTargets.size}`);
}

for (const target of uniqueTargets) {
  const extension = path.extname(target);
  const targetPath = path.resolve(repoRoot, extension ? target : `${target}.md`);
  if (!fs.existsSync(targetPath)) throw new Error(`missing report target: ${target}`);
}

const result = spawnSync(process.execPath, [
  renderer,
  '--input', input,
  '--output', output,
  '--vault-root', repoRoot,
], { encoding: 'utf8' });

if (result.status !== 0) {
  throw new Error(`renderer failed: ${result.stderr || result.stdout}`);
}

const html = fs.readFileSync(output, 'utf8');
for (const marker of [
  '<meta charset="utf-8">',
  'INDUSTRY RESEARCH',
  '0. 基本信息',
  '7. 综合产业判断',
  '3.1.1 产业链公司映射',
  '业务占比或纯度',
  '上海格思航天',
  '中国卫星',
  '上海瀚讯',
  '电科蓝天',
  '铖昌科技',
  '航天环宇',
]) {
  if (!html.includes(marker)) throw new Error(`rendered HTML is missing: ${marker}`);
}

if (html.includes('�') || html.includes('[[')) {
  throw new Error('rendered HTML contains encoding errors or unresolved wiki links');
}

const renderedReportLinks = [...html.matchAll(/<a href="[^"]*机构级决策研报\.html">/g)];
if (renderedReportLinks.length !== 25) {
  throw new Error(`expected 25 rendered company report links, got ${renderedReportLinks.length}`);
}

const numberedSections = [...html.matchAll(/<h2 id="section-\d+">([0-7])\./g)];
if (numberedSections.length !== 8) {
  throw new Error(`expected 8 numbered modules, got ${numberedSections.length}`);
}

const fixtureInput = path.join(tempDir, 'fixture.md');
const fixtureOutput = path.join(tempDir, 'fixture.html');
fs.writeFileSync(fixtureInput, [
  '# 产业报告链接路由测试',
  '',
  '- **分析日期：** 2026-07-20',
  '- **数据截止日期：** 2026-07-20',
  '- **地域范围：** 中国',
  '',
  '## 0. 基本信息',
  '## 1. 执行摘要',
  '## 2. 战略方向',
  '## 3. 产业结构',
  '### 3.1.1 产业链公司映射',
  '| 产业链层级 | 子环节 | 公司 / 主体 | 上市属性 / 证券代码 | 具体产业位置与核心产品 | 业务占比或纯度 | 证据状态 | 数据时间 / 来源 | 备注 |',
  '|---|---|---|---|---|---|---|---|---|',
  '| 上游 | 测试 | [[sources/automations/商业航天每日跟踪/2026-07-17-1616-中国卫星-机构级决策研报.html|中国卫星]] | A股 / 600118 | 测试 | 高 | 已披露 | 2026-07-17 | 测试 |',
  '| 下游 | 测试 | [[workbench/targets/2026-07-15-1514-华明装备机构级决策研报|华明装备]] | A股 / 002270 | 测试 | 中 | 已披露 | 2026-07-15 | 测试 |',
  '## 4. 约束条件',
  '## 5. 周期与节奏',
  '## 6. 竞争格局与资本作用',
  '## 7. 综合产业判断',
].join('\n'), 'utf8');

const fixtureResult = spawnSync(process.execPath, [
  renderer,
  '--input', fixtureInput,
  '--output', fixtureOutput,
  '--vault-root', repoRoot,
], { encoding: 'utf8' });

if (fixtureResult.status !== 0) {
  throw new Error(`fixture renderer failed: ${fixtureResult.stderr || fixtureResult.stdout}`);
}

const fixtureHtml = fs.readFileSync(fixtureOutput, 'utf8');
if (!fixtureHtml.includes('2026-07-17-1616-中国卫星-机构级决策研报.html')) {
  throw new Error('explicit HTML report link was not preserved');
}
if (!fixtureHtml.includes('2026-07-15-1514-华明装备机构级决策研报.md')) {
  throw new Error('Workbench Markdown fallback was rewritten incorrectly');
}
if (fixtureHtml.includes('workbench/targets/2026-07-15-1514-华明装备机构级决策研报.html')) {
  throw new Error('Workbench Markdown fallback points to a nonexistent HTML');
}

console.log('PASS: industry report HTML renderer');
