const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const renderer = path.join(__dirname, 'render-report-html.cjs');
const skillRoot = path.resolve(__dirname, '..');
const skillContract = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const reportTemplate = fs.readFileSync(path.join(skillRoot, 'template.md'), 'utf8');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-report-html-'));
const input = path.join(tempDir, '测试公司机构级决策研报.md');
const output = path.join(tempDir, '测试公司机构级决策研报.html');
const inputAutoSecid = path.join(tempDir, '西部矿业机构级决策研报.md');
const outputAutoSecid = path.join(tempDir, '西部矿业机构级决策研报.html');
fs.writeFileSync(path.join(tempDir, '2026-07-21-航天电子资金面分析.html'), '<!doctype html><title>资金面</title>', 'utf8');

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
    return `## 1. ${name}\n\n| 项目 | 结论 |\n|---|---|\n| 估值状态 | 高估 |\n| 操作建议 | 观望 |\n| 冰冰小美动作 | wait / review |\n| 当前价格及时间 | 15.14 CNY，2026-07-21 收盘 |\n| 综合估值区间 | 7.5—11.5 CNY |\n| 相对现价空间 | -50.5% 至 -24.0% |\n| 结论置信度 | 中高 |\n| 基本面状态 | 恶化 |\n| 资金状态 | 结构性流出 |\n| 风险方向 | 风险重新增强 |\n| 每日跟踪时间 | 2026-07-21 15:00（Asia/Shanghai，收盘） |\n| 资金面分析链接 | 2026-07-21-航天电子资金面分析.html |`;
  }
  if (index === 10) {
    return `## 11. ${name}

### 11.1 三要素状态总表

| 体系要素 | 状态 |
|---|---|
| 竞争格局 | 中性 |

#### 前六步证据映射

| 体系要素 | 前六步证据来源 | 已验证证据 | 反证与缺口 | 分析状态 |
|---|---|---|---|---|
| 竞争格局 | 第4—7章 | 竞争证据 | 反证 | 中性 |

### 11.2 竞争格局与比较优势

#### 证据

竞争证据。

### 11.3 流动性辩证分析

#### 宏观流动性

宏观证据。

#### 中观流动性

中观证据。

#### 微观流动性

微观证据。

#### 资金来源分类

资金来源证据。

#### 供给与抛压

供给证据。

#### 最低数据检查

最低检查证据。

#### 退出路径

退出路径证据。

### 11.4 情绪位置变化

情绪证据。

### 11.5 综合状态与主导矛盾

综合判断。

### 11.6 三要素行动映射

新增现金与已有持仓。

### 11.7 三要素数据缺口与来源

数据缺口。`;
  }
  return `## ${index + 1}. ${name}\n\n中文内容与 [[wiki/queries/相关页面|相关页面]]。`;
}).join('\n\n');

const requiredThreeFactorHeadings = [
  '### 11.1 三要素状态总表',
  '### 11.2 竞争格局与比较优势',
  '### 11.3 流动性辩证分析',
  '#### 宏观流动性',
  '#### 中观流动性',
  '#### 微观流动性',
  '#### 资金来源分类',
  '#### 供给与抛压',
  '#### 最低数据检查',
  '#### 退出路径',
  '### 11.4 情绪位置变化',
  '### 11.5 综合状态与主导矛盾',
  '### 11.6 三要素行动映射',
  '### 11.7 三要素数据缺口与来源',
];

const requiredEvidenceMappingFields = [
  '#### 前六步证据映射',
  '| 体系要素 | 前六步证据来源 | 已验证证据 | 反证与缺口 | 分析状态 |',
  '| 竞争格局 |',
  '| 流动性辩证分析 |',
  '| 情绪位置变化 |',
];

for (const heading of requiredThreeFactorHeadings) {
  assert.ok(reportTemplate.includes(heading), `template missing detailed three-factor heading: ${heading}`);
}
for (const field of requiredEvidenceMappingFields) {
  assert.ok(reportTemplate.includes(field), `template missing Step 1-6 evidence mapping field: ${field}`);
}
assert.ok(reportTemplate.includes('## 4. 商业模式与竞争格局'), 'chapter 4 must retain standalone business-model analysis');
assert.ok(reportTemplate.includes('### 4.1 事实'), 'chapter 4 must retain its factual analysis');
assert.ok(reportTemplate.includes('### 4.2 我的判断'), 'chapter 4 must retain its competition judgment');
assert.ok(!reportTemplate.includes('#### 商业模式事实底稿'), '11.2 must reference chapter 4 rather than duplicate it');
assert.match(skillContract, /状态总表[^。\n]*不能替代|不能以状态总表[^。\n]*替代/);
assert.match(skillContract, /11\.1[^。\n]*11\.7[^。\n]*硬契约/);
assert.match(skillContract, /Step 1—6[^。\n]*主要输入|前六步[^。\n]*主要输入/);
assert.match(skillContract, /引用前文章节[^。\n]*不重复/);
assert.doesNotMatch(skillContract, /第 4 章[^。\n]*不再独立/);
assert.match(skillContract, /证据充分性闸门/);
assert.match(skillContract, /证据不足[^。\n]*不得[^。\n]*有利[^。\n]*中性[^。\n]*不利/);
assert.match(skillContract, /默认不补采/);
assert.equal((reportTemplate.match(/- 证据充分性：充分 \/ 不充分；依据：/g) || []).length, 3);

fs.writeFileSync(input, `# 航天电子机构级决策研报\n\n> 证券代码：600879.SH<br>\n> 交易所 / 币种：上海证券交易所 / CNY<br>\n> 研究截止时间：2026-07-21 15:00<br>\n> 报告生成时间：2026-07-21<br>\n> 数据口径：公开信息<br>\n\n${sectionBody}\n`, 'utf8');

const result = spawnSync(process.execPath, [renderer, '--input', input, '--output', output, '--vault-root', tempDir], {
  encoding: 'utf8',
});

assert.equal(result.status, 0, `renderer failed:\n${result.stderr || result.stdout}`);
const html = fs.readFileSync(output, 'utf8');

assert.doesNotMatch(html, /class="kpis"/);
assert.doesNotMatch(html, /class="verdict"/);
assert.match(html, /<!-- DAILY_TRACKING_START -->/);
assert.match(html, /<!-- DAILY_TRACKING_END -->/);
assert.equal((html.match(/DAILY_TRACKING_START/g) || []).length, 1);
assert.equal((html.match(/DAILY_TRACKING_END/g) || []).length, 1);
for (const marker of [
  'data-tracking-key="fundamental-status"',
  'data-tracking-key="dynamic-value-range"',
  'data-tracking-key="price-deviation"',
  'data-tracking-key="daily-quote"',
  'data-tracking-key="intraday-quote"',
  'data-tracking-key="action-confidence"',
  '/api/stock-quote?secid=1.600879',
  '2026-07-21-航天电子资金面分析.html',
  '每 60 秒',
]) {
  assert.ok(html.includes(marker), `daily tracking missing marker: ${marker}`);
}
assert.match(html, /高估 · wait \/ review/);
assert.match(html, /7.5—11.5/);
assert.equal((html.match(/class="toc-link"/g) || []).length, 16);
assert.doesNotMatch(html, /\[\[/);
assert.doesNotMatch(html, /�|12\?24|\?\?/);
assert.match(html, /href=".*相关页面\.md"/);
assert.match(html, /lang="zh-CN"/);
assert.match(html, /BBXM EQUITY RESEARCH · 600879\.SH/);
assert.doesNotMatch(html, /BBXM EQUITY RESEARCH · 600879\.SH&amp;lt;br/);
assert.match(html, /宏观流动性/);
assert.match(html, /前六步证据映射/);
assert.match(html, /资金来源分类/);
assert.match(html, /供给与抛压/);
assert.match(html, /退出路径/);
assert.match(html, /三要素数据缺口与来源/);

fs.writeFileSync(inputAutoSecid, fs.readFileSync(input, 'utf8').replaceAll('600879.SH', '601168.SH').replaceAll('航天电子', '西部矿业'), 'utf8');
const autoSecidResult = spawnSync(process.execPath, [renderer, '--input', inputAutoSecid, '--output', outputAutoSecid, '--vault-root', tempDir], {
  encoding: 'utf8',
});
assert.equal(autoSecidResult.status, 0, `auto secid renderer failed:\n${autoSecidResult.stderr || autoSecidResult.stdout}`);
const autoSecidHtml = fs.readFileSync(outputAutoSecid, 'utf8');
assert.match(autoSecidHtml, /\/api\/stock-quote\?secid=1\.601168/);
assert.doesNotMatch(autoSecidHtml, /未配置实时行情|当前证券未配置本地行情白名单/);
assert.match(autoSecidHtml, /等待连接|实时未连接/);

console.log('PASS: report HTML renderer');
