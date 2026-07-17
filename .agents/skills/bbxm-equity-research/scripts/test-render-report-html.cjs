const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const renderer = path.join(__dirname, 'render-report-html.cjs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-report-html-'));
const input = path.join(tempDir, '测试公司机构级决策研报.md');
const output = path.join(tempDir, '测试公司机构级决策研报.html');

const sections = [
  '决策摘要',
  '证券身份与来源矩阵',
  '行情与市场预期',
  '商业模式与竞争格局',
  '分部收入与盈利拆解',
  '五年财务历史',
  '最新季度与管理层指引',
  '近三个月新闻与催化剂',
  '多头与空头论据',
  '估值',
  '冰冰小美框架判断',
  '最终结论',
  '后续监控指标',
  '未获取到的数据与研究局限',
  '来源清单',
  '声明',
];

const sectionBody = sections.map((name, index) => {
  if (index === 0) {
    return `## 1. ${name}\n\n| 项目 | 结论 |\n|---|---|\n| 估值状态 | 高估 |\n| 操作建议 | 观望 |\n| 冰冰小美动作 | wait / observe |\n| 当前价格及时间 | 58.32 CNY |\n| 综合估值区间 | 12—24 CNY |\n| 相对现价空间 | -79.4% 至 -58.8% |\n| 结论置信度 | 中 |`;
  }
  return `## ${index + 1}. ${name}\n\n中文内容与 [[wiki/queries/相关页面|相关页面]]。`;
}).join('\n\n');

fs.writeFileSync(input, `# 测试公司（688818.SH）机构级决策研报\n\n> 证券代码：688818.SH<br>\n> 交易所 / 币种：上交所科创板 / CNY<br>\n> 研究截止时间：2026-07-17<br>\n> 报告生成时间：2026-07-17<br>\n> 数据口径：公开信息<br>\n\n${sectionBody}\n`, 'utf8');

const result = spawnSync(process.execPath, [renderer, '--input', input, '--output', output, '--vault-root', tempDir], {
  encoding: 'utf8',
});

assert.equal(result.status, 0, `renderer failed:\n${result.stderr || result.stdout}`);
const html = fs.readFileSync(output, 'utf8');

assert.match(html, /高估 · wait \/ observe/);
assert.match(html, /12—24/);
assert.equal((html.match(/class="toc-link"/g) || []).length, 16);
assert.doesNotMatch(html, /\[\[/);
assert.doesNotMatch(html, /�|12\?24|\?\?/);
assert.match(html, /href=".*相关页面\.html"/);
assert.match(html, /lang="zh-CN"/);
assert.match(html, /BBXM EQUITY RESEARCH · 688818\.SH/);
assert.doesNotMatch(html, /BBXM EQUITY RESEARCH · 688818\.SH&amp;lt;br/);

console.log('PASS: report HTML renderer');
