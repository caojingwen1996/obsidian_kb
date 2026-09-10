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
const invalidFundamentalInput = path.join(tempDir, '基本面顺序错误.md');
const invalidFundamentalOutput = path.join(tempDir, '基本面顺序错误.html');

const expectedSections = [
  '估值摘要',
  '估值基础',
  '估值方法与假设',
  '估值结果与交易溢价',
  '仓位测算与网格交易',
  '风险与结论',
];

const expectedFundamentalOrder = [
  '负债',
  '净现金',
  '现金流',
  '开销合理性',
  '真实利润',
  '扣除商誉的净资产',
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

  assert.match(skill, /version: 4\.5\.0/);
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
  assert.match(template, /\| 心理面 \| 公允价值范围：/);
  assert.match(template, /\| 情绪面 \| 交易偏离定价：/);
  assert.match(template, /\| 资金面 \|/);
  assert.match(template, /### 2\.1 产业思维前置输入/);
  assert.match(template, /固定顺序同时代表判断权重由高到低/);
  const fundamentalSection = template.match(/^### 2\.5 基本面判断：六项核验\s*$([\s\S]*?)(?=^## 3\.)/m)?.[1] ?? '';
  const templateFundamentalOrder = fundamentalSection.split(/\r?\n/)
    .map((line) => line.split('|').slice(1, -1)[0]?.trim())
    .filter((dimension) => expectedFundamentalOrder.includes(dimension));
  assert.deepEqual(templateFundamentalOrder, expectedFundamentalOrder);
  assert.match(template, /### 4\.4 资金、筹码与交易方画像/);
  assert.match(template, /### 4\.5 估值泡沫32项触发扫描/);
  assert.match(template, /### 5\.1 凯利仓位情景测算/);
  assert.match(template, /### 5\.2 网格交易适用性与参数/);
  assert.match(template, /### 5\.3 执行边界与停止条件/);
  assert.doesNotMatch(template, /### 4\.6 凯利/);
  const referenceScanKeys = bubbleScanKeys(bubbleReference);
  const templateScanKeys = bubbleScanKeys(template);
  assert.equal(referenceScanKeys.length, 32);
  assert.equal(templateScanKeys.length, 32);
  assert.deepEqual(templateScanKeys, referenceScanKeys);
  assert.match(template, new RegExp('状态只允许：有利 / 当期恶化，持续性待确认 / 不利信号出现 / 证据不足 / 不适用'));
  assert.match(template, new RegExp('泡沫出清状态：未见出清触发 / 出清观察 / 出清中 / 证据不足'));
  assert.match(template, /\*\*来源清单\*\*/);
  assert.doesNotMatch(template, /^## 7\./m);

  const sectionBody = expectedSections.map((name, index) => {
    if (index === 0) {
      return `## 1. ${name}\n\n### 1.1 每日跟踪字段\n\n| 项目 | 结论 |\n|---|---|\n| 基本面状态 | 稳定；收入增长，现金流待半年报确认。 |\n| 公允价值范围 | 30—40元；中枢35元；2026-08-28。 |\n| 交易定价偏离 | 当前判断：估值溢价。现价38元；相对中枢溢价8.6%；可解释溢价由经营验证支持。 |\n| 资金面 | 20日资金流出；股东人数下降；交易方以机构和产业资本为主。 |\n| 每日跟踪时间 | 2026-08-28 15:00（Asia/Shanghai，收盘） |\n\n参见 [[template|估值模板]]。`;
    }
    if (index === 1) {
      return `## 2. ${name}\n\n### 2.1 测试内容\n\n测试正文。\n\n### 2.5 基本面判断：六项核验\n\n> 固定顺序同时代表判断权重由高到低。\n\n| 维度 | 当前判断 |\n|---|---|\n| 负债 | 有息负债低 |\n| 净现金 | 净现金为正 |\n| 现金流 | 经营现金流为正 |\n| 开销合理性 | 费用率稳定 |\n| 真实利润 | 扣非利润稳定 |\n| 扣除商誉的净资产 | 净资产稳定 |`;
    }
    return `## ${index + 1}. ${name}\n\n### ${index + 1}.1 测试内容\n\n测试正文。`;
  }).join('\n\n');

  fs.writeFileSync(input, `---\nartifact_type: equity_research\nsecurity_code: "000001.SZ"\n---\n\n# 测试公司机构级决策研报\n\n> 证券代码：000001.SZ  \n> 交易所 / 币种：深圳证券交易所 / CNY  \n> 研究截止时间：2026-08-28 15:00  \n> 报告生成时间：2026-08-28  \n\n${sectionBody}\n`, 'utf8');

  const result = render(input, output);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /class="tracking-label">资金面<\/p>/);
  const legacyCapitalInput = path.join(tempDir, 'legacy-capital.md');
  fs.writeFileSync(legacyCapitalInput, fs.readFileSync(input, 'utf8').replace('| 资金面 |', '| 资金与筹码 |'), 'utf8');
  const legacyCapitalResult = render(legacyCapitalInput, output);
  assert.equal(legacyCapitalResult.status, 0, legacyCapitalResult.stderr);
  const legacyCapitalHtml = fs.readFileSync(output, 'utf8');
  assert.match(legacyCapitalHtml, /class="tracking-label">资金面<\/p>/);
  assert.match(legacyCapitalHtml, /20日资金流出；股东人数下降/);
  assert.equal((html.match(/class="toc-link"/g) || []).length, 6);
  assert.equal((html.match(/<!-- DAILY_TRACKING_START -->/g) || []).length, 1);
  assert.equal((html.match(/<!-- DAILY_TRACKING_END -->/g) || []).length, 1);
  assert.equal((html.match(/class="tracking-card"/g) || []).length, 4);
  assert.match(html, /data-tracking-key="fundamental-status"/);
  assert.match(html, /data-tracking-key="fair-value-range"/);
  assert.match(html, /data-tracking-key="fair-value-range"><p class="tracking-title">心理面<\/p><p class="tracking-label">公允价值范围<\/p>/);
  assert.match(html, /data-tracking-key="pricing-deviation"/);
  assert.match(html, /data-tracking-key="pricing-deviation"><p class="tracking-title">情绪面<\/p><p class="tracking-label">交易偏离定价<\/p><div class="pricing-levels">/);
  assert.equal((html.match(/class="tracking-title">情绪面<\/p>/g) || []).length, 1);
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

  const metricsInput = path.join(tempDir, '指标卡片.md');
  const metricLines = expectedFundamentalOrder.map((label) => `${label}：测试数值 < 待验证`);
  fs.writeFileSync(metricsInput, fs.readFileSync(input, 'utf8').replace('稳定；收入增长，现金流待半年报确认。', `${metricLines.join('<br>')}<br>综合：待确认；2026年上半年`), 'utf8');
  const metricsResult = render(metricsInput, output);
  assert.equal(metricsResult.status, 0, metricsResult.stderr || metricsResult.stdout);
  const metricsHtml = fs.readFileSync(output, 'utf8');
  const renderedMetrics = [...metricsHtml.matchAll(/class="fundamental-metric">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.deepEqual(renderedMetrics, metricLines.map((line) => line.replace('<', '&lt;')));
  assert.match(metricsHtml, /class="tracking-detail">综合：待确认；2026年上半年/);
  const kellyInput = path.join(tempDir, '凯利卡片.md');
  fs.writeFileSync(kellyInput, fs.readFileSync(metricsInput, 'utf8').replace('| 公允价值范围 |', '| 凯利测算 | 假设概率60%：全凯利40%<br>真实概率 < 待验证 |\n| 公允价值范围 |'), 'utf8');
  const kellyResult = render(kellyInput, output);
  assert.equal(kellyResult.status, 0, kellyResult.stderr || kellyResult.stdout);
  const kellyHtml = fs.readFileSync(output, 'utf8');
  assert.match(kellyHtml, /data-tracking-key="fair-value-range"[\s\S]*?class="kelly-summary"[\s\S]*?假设概率60%：全凯利40%/);
  assert.equal((kellyHtml.match(/class="tracking-title">心理面<\/p>/g) || []).length, 1);
  assert.match(kellyHtml, /class="kelly-metric">真实概率 &lt; 待验证/);
  assert.equal((kellyHtml.match(/class="tracking-card"/g) || []).length, 4);
  const combinedInput = path.join(tempDir, '新版跟踪字段.md');
  const combinedSource = fs.readFileSync(input, 'utf8')
    .replace('| 公允价值范围 | 30—40元；中枢35元；2026-08-28。 |', '| 心理面 | 公允价值范围：30—40元；中枢35元；2026-08-28。<br>凯利测算：现价38元<br>假设概率60%：全凯利40%<br>真实概率待验证 |')
    .replace('| 交易定价偏离 | 当前判断：', '| 情绪面 | 交易偏离定价：当前判断：');
  fs.writeFileSync(combinedInput, combinedSource, 'utf8');
  assert.equal(render(combinedInput, output).status, 0);
  const combinedPanel = fs.readFileSync(output, 'utf8').split('<!-- DAILY_TRACKING_START -->')[1].split('<!-- DAILY_TRACKING_END -->')[0];
  assert.match(combinedPanel, /30—40元；中枢35元/);
  assert.match(combinedPanel, /class="kelly-metric">现价38元/);
  assert.match(combinedPanel, /假设概率60%：全凯利40%/);
  assert.match(combinedPanel, /pricing-level-premium active/);
  assert.equal((combinedPanel.match(/class="tracking-card"/g) || []).length, 4);
  fs.writeFileSync(metricsInput, fs.readFileSync(metricsInput, 'utf8').replace(`${metricLines[0]}<br>${metricLines[1]}`, `${metricLines[1]}<br>${metricLines[0]}`), 'utf8');
  const invalidMetricsResult = render(metricsInput, output);
  assert.notEqual(invalidMetricsResult.status, 0);
  assert.match(invalidMetricsResult.stderr, /基本面状态卡片须按固定权重顺序/);

  const invalidSections = expectedSections.slice(0, 4).map((name, index) => `## ${index + 1}. ${name}\n\n测试。`).join('\n\n');
  fs.writeFileSync(invalidInput, `# 错误目录\n\n${invalidSections}\n`, 'utf8');
  const invalidResult = render(invalidInput, invalidOutput);
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /必须按顺序包含6个编号模块/);

  const invalidFundamentalSource = fs.readFileSync(input, 'utf8').replace(
    '| 净现金 | 净现金为正 |\n| 现金流 | 经营现金流为正 |',
    '| 现金流 | 经营现金流为正 |\n| 净现金 | 净现金为正 |',
  );
  fs.writeFileSync(invalidFundamentalInput, invalidFundamentalSource, 'utf8');
  const invalidFundamentalResult = render(invalidFundamentalInput, invalidFundamentalOutput);
  assert.notEqual(invalidFundamentalResult.status, 0);
  assert.match(invalidFundamentalResult.stderr, /六项基本面必须严格按权重顺序展示/);

  console.log('render-report-html tests passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
