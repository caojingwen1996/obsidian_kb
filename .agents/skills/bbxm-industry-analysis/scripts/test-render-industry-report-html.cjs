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

const numberedSections = [...html.matchAll(/<h2 id="section-\d+">([0-7])\./g)];
if (numberedSections.length !== 8) {
  throw new Error(`expected 8 numbered modules, got ${numberedSections.length}`);
}

console.log('PASS: industry report HTML renderer');
