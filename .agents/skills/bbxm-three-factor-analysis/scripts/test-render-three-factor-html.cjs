const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const renderer = path.join(__dirname, 'render-three-factor-html.cjs');
const skillRoot = path.resolve(__dirname, '..');
const skillContract = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const reportTemplate = fs.readFileSync(path.join(skillRoot, 'template.md'), 'utf8');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-three-factor-html-'));
const input = path.join(tempDir, '测试公司三要素分析.md');
const output = path.join(tempDir, '测试公司三要素分析.html');
const sections = [
  '一句话结论',
  '三要素状态总表',
  '竞争格局的比较优势',
  '流动性辩证分析',
  '情绪位置变化',
  '综合状态与主导矛盾',
  '行动映射',
  '数据缺口与置信度',
  '来源',
];

assert.match(skillContract, /workbench\/targets\//);
assert.match(skillContract, /sources\/automations\/<分类>\//);
assert.match(skillContract, /render-three-factor-html\.cjs/);
assert.match(skillContract, /3 层 × 5 问模型/);
assert.match(skillContract, /> \[!note\] 研究提示/);
assert.match(reportTemplate, /artifact_type: three_factor_analysis/);
assert.equal((reportTemplate.match(/^> \[!note\] 研究提示$/gm) || []).length, 4);
assert.equal((reportTemplate.match(/^- 核心证据：/gm) || []).length, 3);
assert.equal((reportTemplate.match(/^- 核心反证：/gm) || []).length, 3);
assert.doesNotMatch(reportTemplate, /^> - 核心证据：/m);
assert.doesNotMatch(reportTemplate, /^> - 核心反证：/m);
assert.equal((reportTemplate.match(/^## \d+\./gm) || []).length, 9);

const bodies = sections.map((name, index) => {
  if (index === 0) return `## 1. ${name}\n\n- 综合状态：部分有利\n- 主导要素：竞争格局\n- 拖累要素：流动性`;
  if (index === 1) return `## 2. ${name}\n\n| 要素 | 状态 | 核心证据 | 核心反证 | 置信度 |\n|---|---|---|---|---|\n| 竞争格局 | 有利 | 证据 | 反证 | 高 |\n| 流动性辩证分析 | 中性 | 证据 | 反证 | 中 |\n| 情绪位置变化 | 不利 | 证据 | 反证 | 中 |`;
  if (index === 7) return `## 8. ${name}\n\n- 数据缺口：无\n- 已检查范围：公开资料\n- 影响：有限\n- 总体置信度：中`;
  if (index === 8) return `## 9. ${name}\n\n- [[wiki/topics/冰冰小美-情绪体系认知篇|体系依据]]`;
  if (index === 2) return `## 3. ${name}\n\n### 国家层：方向与资源配置\n\n- 结论：有利\n- 核心证据：测试证据\n- 核心反证：测试反证\n\n> [!note] 研究提示\n> - 数据缺口：测试缺口`;
  return `## ${index + 1}. ${name}\n\n测试内容。`;
}).join('\n\n');

fs.writeFileSync(input, `---\nartifact_type: three_factor_analysis\nobject_name: 测试公司\nobject_level: 个股\nmarket: A股\nas_of: 2026-08-17 10:00\n---\n\n# 测试公司冰冰小美体系三要素分析\n\n> 对象层级：个股  \n> 市场：A股  \n> 分析截止时间：2026-08-17 10:00 Asia/Shanghai  \n> 报告生成时间：2026-08-17 10:10 Asia/Shanghai  \n> 核心问题：是否形成三要素共振\n\n${bodies}\n`, 'utf8');

const result = spawnSync(process.execPath, [renderer, '--input', input, '--output', output, '--vault-root', tempDir], { encoding: 'utf8' });
assert.equal(result.status, 0, `renderer failed:\n${result.stderr || result.stdout}`);
const html = fs.readFileSync(output, 'utf8');
assert.equal((html.match(/class="toc-link"/g) || []).length, 9);
assert.equal((html.match(/class="factor-card /g) || []).length, 5);
assert.match(html, /BBXM THREE-FACTOR ANALYSIS/);
assert.match(html, /部分有利/);
assert.match(html, /factor-card neutral[^>]*><p>综合状态<\/p><strong>部分有利<\/strong>/);
assert.match(html, /竞争格局/);
assert.match(html, /流动性/);
assert.match(html, /情绪位置/);
assert.match(html, /总体置信度/);
assert.match(html, /class="research-note"/);
assert.match(html, /class="research-note-title">研究提示<\/p>/);
assert.ok(html.indexOf('<li>核心证据：测试证据</li>') < html.indexOf('<aside class="research-note"'), '核心证据应位于研究提示卡之前的正文中');
assert.ok(html.indexOf('<li>核心反证：测试反证</li>') < html.indexOf('<aside class="research-note"'), '核心反证应位于研究提示卡之前的正文中');
assert.doesNotMatch(html, /\[!note\]/);
assert.match(html, /href=".*冰冰小美-情绪体系认知篇\.md"/);
assert.doesNotMatch(html, /\[\[|\uFFFD|12\?24|\?\?/);
assert.match(html, /lang="zh-CN"/);

console.log('three-factor HTML renderer tests passed');
