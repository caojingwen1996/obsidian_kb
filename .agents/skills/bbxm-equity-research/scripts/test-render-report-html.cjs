const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const renderer = path.join(__dirname, 'render-report-html.cjs');
const skillRoot = path.resolve(__dirname, '..');
const skillContract = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const reportTemplate = fs.readFileSync(path.join(skillRoot, 'template.md'), 'utf8');
const frontierValuationReference = fs.readFileSync(path.join(skillRoot, 'references', 'frontier-tech-valuation.md'), 'utf8');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-report-html-'));
const input = path.join(tempDir, '测试公司机构级决策研报.md');
const output = path.join(tempDir, '测试公司机构级决策研报.html');
const inputAutoSecid = path.join(tempDir, '西部矿业机构级决策研报.md');
const outputAutoSecid = path.join(tempDir, '西部矿业机构级决策研报.html');
const inputAutoFundReport = path.join(tempDir, '自动资金面机构级决策研报.md');
const outputAutoFundReport = path.join(tempDir, '自动资金面机构级决策研报.html');
const inputInRange = path.join(tempDir, '区间内价格机构级决策研报.md');
const outputInRange = path.join(tempDir, '区间内价格机构级决策研报.html');
fs.writeFileSync(path.join(tempDir, '2026-07-21-航天电子资金面分析.html'), '<!doctype html><title>资金面</title>', 'utf8');
fs.writeFileSync(path.join(tempDir, '2026-07-30-航天电子资金面分析.html'), '<!doctype html><title>最新资金面</title>', 'utf8');
fs.writeFileSync(path.join(tempDir, '2026-08-01-西部矿业资金面分析.html'), '<!doctype html><title>其他公司资金面</title>', 'utf8');

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
  return `## ${index + 1}. ${name}\n\n中文内容与 [[wiki/queries/相关页面|相关页面]]。`;
}).join('\n\n');

assert.ok(reportTemplate.includes('## 4. 商业模式与竞争格局'), 'chapter 4 must retain standalone business-model analysis');
assert.ok(reportTemplate.includes('### 4.1 事实'), 'chapter 4 must retain its factual analysis');
assert.ok(reportTemplate.includes('### 4.2 我的判断'), 'chapter 4 must retain its competition judgment');
assert.doesNotMatch(reportTemplate, /冰冰小美框架判断|三要素状态总表/);
assert.match(skillContract, /不设置独立的“冰冰小美框架判断”章节/);
assert.match(skillContract, /15 个编号模块/);
assert.match(skillContract, /Step 4\.5：建立分部级估值成熟度路由/);
assert.match(skillContract, /Step 7：交叉验证估值与动作约束/);
assert.match(skillContract, /前沿科技路线/);
assert.match(skillContract, /仅有试点、意向订单或首批付费订单不自动升级/);
assert.match(skillContract, /当前股东保留比例/);
assert.match(skillContract, /不得把同一笔资金同时作为未来投入和融资稀释重复扣除/);
assert.match(skillContract, /终值占企业价值超过 70%/);
assert.match(reportTemplate, /### 10\.0 分部估值成熟度与路线/);
assert.match(reportTemplate, /### 10\.4 前沿科技价值桥（适用时）/);
assert.match(reportTemplate, /#### 当前股东价值桥/);
assert.match(reportTemplate, /是否存在“投入＋稀释”重复扣除/);
assert.match(frontierValuationReference, /TAM 只用于约束收入上限，不能直接乘市场份额后当作企业价值/);
assert.match(frontierValuationReference, /同一笔融资不能既全额扣作未来投入，又通过股权稀释再次扣除/);
assert.match(frontierValuationReference, /首批付费订单只提高对应客户里程碑的条件概率/);
assert.match(frontierValuationReference, /实物期权成立条件/);

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
  'data-tracking-key="risk-reward"',
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
assert.match(html, /盈亏比/);
assert.match(html, /无正向盈亏比/);
assert.equal((html.match(/class="toc-link"/g) || []).length, 15);
assert.doesNotMatch(html, /\[\[/);
assert.doesNotMatch(html, /�|12\?24|\?\?/);
assert.match(html, /href=".*相关页面\.md"/);
assert.match(html, /lang="zh-CN"/);
assert.match(html, /BBXM EQUITY RESEARCH · 600879\.SH/);
assert.doesNotMatch(html, /BBXM EQUITY RESEARCH · 600879\.SH&amp;lt;br/);
assert.doesNotMatch(html, /冰冰小美框架判断|三要素状态总表/);

fs.writeFileSync(
  inputInRange,
  fs.readFileSync(input, 'utf8')
    .replace('15.14 CNY，2026-07-21 收盘', '6.07 CNY，2026-07-21 收盘')
    .replace('7.5—11.5 CNY', '3.4—7.2 CNY'),
  'utf8',
);
const inRangeResult = spawnSync(process.execPath, [renderer, '--input', inputInRange, '--output', outputInRange, '--vault-root', tempDir], {
  encoding: 'utf8',
});
assert.equal(inRangeResult.status, 0, `in-range renderer failed:\n${inRangeResult.stderr || inRangeResult.stdout}`);
const inRangeHtml = fs.readFileSync(outputInRange, 'utf8');
assert.match(inRangeHtml, /约 0\.4:1/);
assert.match(inRangeHtml, /跌至下沿 3\.40 元的风险 \+44\.0%/);

fs.writeFileSync(inputAutoSecid, fs.readFileSync(input, 'utf8').replaceAll('600879.SH', '601168.SH').replaceAll('航天电子', '西部矿业'), 'utf8');
const autoSecidResult = spawnSync(process.execPath, [renderer, '--input', inputAutoSecid, '--output', outputAutoSecid, '--vault-root', tempDir], {
  encoding: 'utf8',
});
assert.equal(autoSecidResult.status, 0, `auto secid renderer failed:\n${autoSecidResult.stderr || autoSecidResult.stdout}`);
const autoSecidHtml = fs.readFileSync(outputAutoSecid, 'utf8');
assert.match(autoSecidHtml, /\/api\/stock-quote\?secid=1\.601168/);
assert.doesNotMatch(autoSecidHtml, /未配置实时行情|当前证券未配置本地行情白名单/);
assert.match(autoSecidHtml, /等待连接|实时未连接/);

fs.writeFileSync(inputAutoFundReport, fs.readFileSync(input, 'utf8').replace('| 资金面分析链接 | 2026-07-21-航天电子资金面分析.html |', '| 资金面分析链接 | 未获取到 |'), 'utf8');
const autoFundResult = spawnSync(process.execPath, [renderer, '--input', inputAutoFundReport, '--output', outputAutoFundReport, '--vault-root', tempDir], {
  encoding: 'utf8',
});
assert.equal(autoFundResult.status, 0, `auto fund renderer failed:\n${autoFundResult.stderr || autoFundResult.stdout}`);
const autoFundHtml = fs.readFileSync(outputAutoFundReport, 'utf8');
assert.match(autoFundHtml, /2026-07-30-航天电子资金面分析\.html/);
assert.doesNotMatch(autoFundHtml, /2026-08-01-西部矿业资金面分析\.html/);
assert.doesNotMatch(autoFundHtml, /资金面分析：未单独生成/);
assert.match(skillContract, /自动匹配[^。\n]*资金面分析/);
assert.match(reportTemplate, /自动挂最新日期/);

console.log('PASS: report HTML renderer');
