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
const valuationBubbleReference = fs.readFileSync(path.join(skillRoot, 'references', 'valuation-bubble-trigger-scan.md'), 'utf8');
const inflationReference = fs.readFileSync(path.join(skillRoot, 'references', 'inflation-transmission.md'), 'utf8');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-report-html-'));
const input = path.join(tempDir, '测试公司机构级决策研报.md');
const output = path.join(tempDir, '测试公司机构级决策研报.html');
const inputLegacyRiskField = path.join(tempDir, '旧风险字段机构级决策研报.md');
const outputLegacyRiskField = path.join(tempDir, '旧风险字段机构级决策研报.html');

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
  '公允价值区间计算',
  '市场价格分解与估值泡沫判断',
  '最终结论',
  '后续监控指标',
  '未获取到的数据与研究局限',
  '来源清单',
  '声明',
];

const sectionBody = sections.map((name, index) => {
  if (index === 0) {
    return `## 1. ${name}\n\n| 项目 | 结论 |\n|---|---|\n| 估值状态 | 高估 |\n| 操作建议 | 观望 |\n| 冰冰小美动作 | wait / review |\n| 当前价格及时间 | 15.14 CNY，2026-07-21 收盘 |\n| 公允价值区间 | 7.5—11.5 CNY |\n| 相对现价空间 | -50.5% 至 -24.0% |\n| 估值泡沫判断 | 严重估值泡沫；三项核心门槛成立 |\n| 结论置信度 | 中高 |\n| 基本面状态 | 持平。盈利、收入和毛利率改善，但现金转化明显恶化。 |\n| 宏观价格环境 | 高暴露；输入性通胀抬高能源和材料成本，但毛利率尚未受到全面挤压；2026-07-21，观察产品提价与新订单 |\n| 关键经营变化 | 收入增长但现金转化转弱 |\n| 资金状态 | 结构性流出 |\n| 风险状态 | 风险新增，尚未形成放大链。经营现金净流出扩大、应收账款与合同资产增长；同时通胀暴露高，但毛利率尚未受到全面挤压。股价、融资和估值暂未形成同向恶化。 |\n| 每日跟踪时间 | 2026-07-21 15:00（Asia/Shanghai，收盘） |\n| 资金面分析链接 | 2026-07-21-航天电子资金面分析.html |`;
  }
  return `## ${index + 1}. ${name}\n\n中文内容与 [[wiki/queries/相关页面|相关页面]]。`;
}).join('\n\n');

assert.ok(reportTemplate.includes('## 4. 商业模式与竞争格局'), 'chapter 4 must retain standalone business-model analysis');
assert.ok(reportTemplate.includes('### 4.1 事实'), 'chapter 4 must retain its factual analysis');
assert.ok(reportTemplate.includes('### 4.2 我的判断'), 'chapter 4 must retain its competition judgment');
assert.doesNotMatch(reportTemplate, /冰冰小美框架判断|三要素状态总表/);
assert.match(skillContract, /不设置独立的“冰冰小美框架判断”章节/);
assert.match(skillContract, /16 个编号模块/);
assert.match(skillContract, /Step 4\.5：建立分部级估值成熟度路由/);
assert.match(skillContract, /Step 4\.4：判断企业价值类型与主估值锚/);
assert.match(skillContract, /Step 4\.3：筛查通胀暴露并建立经营传导/);
assert.match(skillContract, /高暴露 \/ 中等暴露 \/ 低暴露 \/ 证据不足/);
assert.match(skillContract, /不得仅凭 CPI 高低判断影响/);
assert.match(skillContract, /Step 6：按企业类型与分部成熟度计算公允价值区间/);
assert.match(skillContract, /稳定盈利、周期资源、重资产、成长企业、前沿科技五类/);
assert.match(skillContract, /Step 7：计算市场价格偏离并判断估值泡沫/);
assert.match(skillContract, /前沿科技路线/);
assert.match(skillContract, /仅有试点、意向订单或首批付费订单不自动升级/);
assert.match(skillContract, /当前股东保留比例/);
assert.match(skillContract, /不得把同一笔资金同时作为未来投入和融资稀释重复扣除/);
assert.match(skillContract, /终值占企业价值超过 70%/);
assert.match(reportTemplate, /### 4\.3 宏观价格环境与通胀传导/);
assert.match(reportTemplate, /### 4\.4 企业价值类型与主估值锚/);
assert.match(reportTemplate, /\| 宏观价格环境 \| 通胀暴露/);
assert.match(reportTemplate, /### 6\.1 盈利、现金流与资产质量检查/);
assert.match(reportTemplate, /### 10\.0 企业类型、分部成熟度与估值路线/);
assert.match(reportTemplate, /## 10\. 公允价值区间计算/);
assert.match(reportTemplate, /\| 公允价值区间 \|/);
assert.match(reportTemplate, /### 10\.4 前沿科技价值桥（适用时）/);
assert.match(reportTemplate, /#### 当前股东价值桥/);
assert.match(reportTemplate, /是否存在“投入＋稀释”重复扣除/);
assert.match(skillContract, /市场价格\s*\n= 公允价值\s*\n\+ 可解释的估值溢价\s*\n\+ 交易定价偏离/);
assert.match(skillContract, /相对上沿偏离率 = 当前价格 ÷ 公允价值上沿 - 1/);
assert.match(skillContract, /严重估值泡沫.*三项核心门槛全部成立，并至少一个放大器显著/);
assert.match(skillContract, /泡沫程度与泡沫是否正在出清必须分开/);
assert.match(skillContract, /#### 三表逐项扫描/);
assert.match(skillContract, /基本面触发表（9项）/);
assert.match(skillContract, /流动性触发表（14项）/);
assert.match(skillContract, /预期触发表（9项）/);
assert.match(skillContract, /三张表的标题或行名存在不能证明扫描完成/);
assert.match(skillContract, /基本面、流动性、预期三表均出现能够相互传导的关键逆转/);
assert.match(skillContract, /面板只生成两张卡片/);
assert.match(skillContract, /状态短句。核心依据。/);
assert.match(skillContract, /具体风险类型＋方向＋关键证据/);
assert.match(skillContract, /不同风险方向不一致时必须拆开写/);
assert.match(skillContract, /风险重新增强不自动等于出清观察/);
assert.match(reportTemplate, /\| 风险状态 \| 风险阶段＋是否形成放大链＋核心依据/);
assert.match(reportTemplate, /\| 估值泡沫判断 \| 公允价值内 \/ 可解释估值溢价 \/ 普通高估 \/ 估值泡沫 \/ 严重估值泡沫 \/ 证据不足/);
assert.match(reportTemplate, /## 11\. 市场价格分解与估值泡沫判断/);
assert.doesNotMatch(reportTemplate, /### 10\.6 市场价格分解与估值泡沫判断/);
assert.match(reportTemplate, /#### 七问审计/);
assert.match(reportTemplate, /#### 泡沫证据门槛/);
assert.match(reportTemplate, /#### 三表逐项扫描/);
assert.match(reportTemplate, /##### 一、基本面触发/);
assert.match(reportTemplate, /##### 二、流动性触发/);
assert.match(reportTemplate, /##### 三、预期触发/);
assert.match(reportTemplate, /##### 三表扫描汇总/);
assert.match(reportTemplate, /泡沫出清状态：未见出清触发 \/ 出清观察 \/ 出清中 \/ 证据不足/);
assert.match(reportTemplate, /### 10\.6 企业类型与估值锚匹配/);
assert.match(reportTemplate, /## 12\. 最终结论/);
assert.match(reportTemplate, /估值锚失效后的退出条件/);
assert.doesNotMatch(skillContract, /彼得·林奇|林奇框架|一句话投资故事|PEG = PE ÷ 盈利增长率/);
assert.doesNotMatch(reportTemplate, /彼得·林奇|林奇框架|一句话投资故事|PEG = PE ÷ 盈利增长率/);
assert.match(frontierValuationReference, /TAM 只用于约束收入上限，不能直接乘市场份额后当作企业价值/);
assert.match(frontierValuationReference, /同一笔融资不能既全额扣作未来投入，又通过股权稀释再次扣除/);
assert.match(frontierValuationReference, /首批付费订单只提高对应客户里程碑的条件概率/);
assert.match(frontierValuationReference, /实物期权成立条件/);
assert.match(valuationBubbleReference, /## 一、基本面触发/);
assert.match(valuationBubbleReference, /## 二、流动性触发/);
assert.match(inflationReference, /所有公司先筛查/);
assert.match(inflationReference, /不得只看 CPI/);
assert.match(inflationReference, /输入性 \/ 供给冲击型通胀/);
assert.match(inflationReference, /经营层通胀关注成本、需求、定价权和现金流/);
assert.match(valuationBubbleReference, /## 三、预期触发/);
assert.match(valuationBubbleReference, /逆转项数量用于检查完整性，不用于机械打分/);
const bubbleReferenceRows = valuationBubbleReference
  .split('\n')
  .filter((line) => /^\| (?:现金流断点|盈利不匹配|宏观：货币条件收缩|中观：政策与主线资金迁移|微观：杠杆和承接逆转|叙事耗尽|财报与真实经营接管定价) \|/.test(line));
assert.equal(bubbleReferenceRows.length, 32, 'valuation-bubble reference must retain all 32 observation rows');

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
const dailyPanel = html.match(/<!-- DAILY_TRACKING_START -->([\s\S]*?)<!-- DAILY_TRACKING_END -->/)?.[1] || '';
assert.match(dailyPanel, /data-tracking-key="fundamental-status"/);
assert.match(dailyPanel, /data-tracking-key="risk-status"/);
assert.equal((dailyPanel.match(/class="tracking-card"/g) || []).length, 2);
assert.ok(dailyPanel.indexOf('data-tracking-key="fundamental-status"') < dailyPanel.indexOf('data-tracking-key="risk-status"'));
assert.match(dailyPanel, /持平。盈利、收入和毛利率改善，但现金转化明显恶化。/);
assert.match(dailyPanel, /风险新增，尚未形成放大链。经营现金净流出扩大、应收账款与合同资产增长/);
assert.doesNotMatch(dailyPanel, /宏观价格环境|关键经营变化|下一验证点|失效条件/);
assert.doesNotMatch(dailyPanel, /公允价值区间|交易定价偏离|盘中实时|盈亏比|动作与置信度|资金面分析/);
assert.doesNotMatch(html, /\/api\/stock-quote|setInterval\(|intraday-price|risk-reward-value/);
assert.equal((html.match(/class="toc-link"/g) || []).length, 16);
assert.doesNotMatch(html, /\[\[/);
assert.doesNotMatch(html, /�|12\?24|\?\?/);
assert.match(html, /href=".*相关页面\.md"/);
assert.match(html, /lang="zh-CN"/);
assert.match(html, /BBXM EQUITY RESEARCH · 600879\.SH/);
assert.doesNotMatch(html, /BBXM EQUITY RESEARCH · 600879\.SH&amp;lt;br/);
assert.doesNotMatch(html, /冰冰小美框架判断|三要素状态总表/);

fs.writeFileSync(
  inputLegacyRiskField,
  fs.readFileSync(input, 'utf8')
    .replace('| 风险状态 |', '| 风险方向 |'),
  'utf8',
);
const legacyRiskFieldResult = spawnSync(process.execPath, [renderer, '--input', inputLegacyRiskField, '--output', outputLegacyRiskField, '--vault-root', tempDir], {
  encoding: 'utf8',
});
assert.equal(legacyRiskFieldResult.status, 0, `legacy risk field renderer failed:\n${legacyRiskFieldResult.stderr || legacyRiskFieldResult.stdout}`);
const legacyRiskFieldHtml = fs.readFileSync(outputLegacyRiskField, 'utf8');
const legacyDailyPanel = legacyRiskFieldHtml.match(/<!-- DAILY_TRACKING_START -->([\s\S]*?)<!-- DAILY_TRACKING_END -->/)?.[1] || '';
assert.match(legacyDailyPanel, /data-tracking-key="risk-status"/);
assert.match(legacyDailyPanel, /风险新增，尚未形成放大链/);

console.log('PASS: report HTML renderer');
