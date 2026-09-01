const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const skillRoot = path.resolve(__dirname, '..');
const renderer = path.join(__dirname, 'render-report-html.cjs');
const skillPath = path.join(skillRoot, 'SKILL.md');
const templatePath = path.join(skillRoot, 'template.md');
const bubbleReferencePath = path.join(skillRoot, 'references', 'valuation-bubble-trigger-scan.md');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-equity-valuation-'));
const input = path.join(tempDir, '测试公司机构级决策研报.md');
const output = path.join(tempDir, '测试公司机构级决策研报.html');
const invalidInput = path.join(tempDir, '错误目录.md');
const invalidOutput = path.join(tempDir, '错误目录.html');

const expectedSections = [
  '估值摘要',
  '估值基础',
  '估值方法与假设',
  '估值结果与交易溢价',
  '风险与结论',
];

const bubbleRowPattern = /^\| (?:现金流断点|盈利不匹配|宏观：货币条件收缩|中观：政策与主线资金迁移|微观：杠杆和承接逆转|叙事耗尽|财报与真实经营接管定价) \|/;

function bubbleScanKeys(source) {
  return source.split(/\r?\n/)
    .filter((line) => bubbleRowPattern.test(line))
    .map((line) => line.split('|').slice(1, 3).map((cell) => cell.trim()).join('::'));
}

function render(source, target) {
  return spawnSync(process.execPath, [renderer, '--input', source, '--output', target, '--vault-root', skillRoot], {
    encoding: 'utf8',
  });
}

try {
  const skill = fs.readFileSync(skillPath, 'utf8');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bubbleReference = fs.readFileSync(bubbleReferencePath, 'utf8');

  assert.match(skill, /version: 4\.2\.1/);
  assert.match(skill, /优先读取同一标的由 `个股产业思维筛选` 生成的最新权威 Markdown 报告/);
  assert.match(skill, /没有产业思维报告时允许降级运行/);
  assert.match(skill, /wiki\/concepts\/冰冰小美-framework-估值判断\.md/);
  assert.match(skill, /## References 文件作用/);
  assert.match(skill, /frontier-tech-valuation\.md.*概率加权未来价值/s);
  assert.match(skill, /valuation-bubble-trigger-scan\.md.*默认32项估值泡沫触发扫描/s);
  assert.match(skill, /inflation-transmission\.md.*所有标的先做暴露筛查/s);
  assert.match(skill, /Step 5：市场价格分解与估值泡沫判断/);
  assert.match(skill, /资金流、股东人数和交易方画像判断交易定价偏离持续性/);
  assert.match(skill, /默认报告必须读取并完整执行/);
  assert.match(skill, /基本面9项、流动性14项、预期9项/);
  assert.doesNotMatch(skill, /不在默认报告中执行32项扫描/);
  assert.match(skill, /固定四张卡片/);
  assert.doesNotMatch(skill, /Step 5：计算价格位置与安全边际|Step 7：|16 个编号模块|HTML 含 16 个/);

  const templateSections = [...template.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)].map((match) => match[2].trim());
  assert.deepEqual(templateSections, expectedSections);
  assert.match(template, /\| 基本面状态 \|/);
  assert.match(template, /\| 公允价值范围 \|/);
  assert.match(template, /\| 交易定价偏离 \|/);
  assert.match(template, /\| 资金与筹码 \|/);
  assert.match(template, /### 2\.1 产业思维前置输入/);
  assert.match(template, /### 4\.4 资金、筹码与交易方画像/);
  assert.match(template, /### 4\.5 估值泡沫32项触发扫描/);
  const referenceScanKeys = bubbleScanKeys(bubbleReference);
  const templateScanKeys = bubbleScanKeys(template);
  assert.equal(referenceScanKeys.length, 32);
  assert.equal(templateScanKeys.length, 32);
  assert.deepEqual(templateScanKeys, referenceScanKeys);
  assert.match(template, new RegExp('状态只允许：有利 / 逆转 / 证据不足 / 不适用'));
  assert.match(template, new RegExp('泡沫出清状态：未见出清触发 / 出清观察 / 出清中 / 证据不足'));
  assert.match(template, /\*\*来源清单\*\*/);
  assert.doesNotMatch(template, /^## 6\./m);

  const sectionBody = expectedSections.map((name, index) => {
    if (index === 0) {
      return `## 1. ${name}\n\n### 1.1 每日跟踪字段\n\n| 项目 | 结论 |\n|---|---|\n| 基本面状态 | 稳定；收入增长，现金流待半年报确认。 |\n| 公允价值范围 | 30—40元；中枢35元；2026-08-28。 |\n| 交易定价偏离 | 当前判断：估值溢价。现价38元；相对中枢溢价8.6%；可解释溢价由经营验证支持。 |\n| 资金与筹码 | 20日资金流出；股东人数下降；交易方以机构和产业资本为主。 |\n| 每日跟踪时间 | 2026-08-28 15:00（Asia/Shanghai，收盘） |\n\n参见 [[template|估值模板]]。`;
    }
    return `## ${index + 1}. ${name}\n\n### ${index + 1}.1 测试内容\n\n测试正文。`;
  }).join('\n\n');

  fs.writeFileSync(input, `---\nartifact_type: equity_research\nsecurity_code: "000001.SZ"\n---\n\n# 测试公司机构级决策研报\n\n> 证券代码：000001.SZ  \n> 交易所 / 币种：深圳证券交易所 / CNY  \n> 研究截止时间：2026-08-28 15:00  \n> 报告生成时间：2026-08-28  \n\n${sectionBody}\n`, 'utf8');

  const result = render(input, output);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const html = fs.readFileSync(output, 'utf8');
  assert.equal((html.match(/class="toc-link"/g) || []).length, 5);
  assert.equal((html.match(/<!-- DAILY_TRACKING_START -->/g) || []).length, 1);
  assert.equal((html.match(/<!-- DAILY_TRACKING_END -->/g) || []).length, 1);
  assert.equal((html.match(/class="tracking-card"/g) || []).length, 4);
  assert.match(html, /data-tracking-key="fundamental-status"/);
  assert.match(html, /data-tracking-key="fair-value-range"/);
  assert.match(html, /data-tracking-key="pricing-deviation"/);
  assert.match(html, /pricing-level-premium active/);
  assert.match(html, /aria-current="true">估值溢价/);
  assert.doesNotMatch(html, /data-tracking-key="trading-premium"/);
  assert.match(html, /data-tracking-key="capital-and-holders"/);
  assert.match(html, /30—40元；中枢35元；2026-08-28。/);
  assert.match(html, /相对中枢溢价8\.6%；可解释溢价由经营验证支持。/);
  assert.match(html, /股东人数下降；交易方以机构和产业资本为主。/);
  assert.match(html, /BBXM EQUITY VALUATION/);
  assert.ok(html.indexOf('DAILY_TRACKING_START') < html.indexOf('id="section-1"'));
  assert.doesNotMatch(html, /\[\[|\uFFFD/);

  const invalidSections = expectedSections.slice(0, 4).map((name, index) => `## ${index + 1}. ${name}\n\n测试。`).join('\n\n');
  fs.writeFileSync(invalidInput, `# 错误目录\n\n${invalidSections}\n`, 'utf8');
  const invalidResult = render(invalidInput, invalidOutput);
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /必须按顺序包含5个编号模块/);

  console.log('render-report-html tests passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
