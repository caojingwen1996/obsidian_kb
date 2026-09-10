const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const skillRoot = path.resolve(__dirname, '..');
const repoRoot = process.env.BBXM_TEST_VAULT_ROOT || path.resolve(skillRoot, '..', '..', '..');
const renderer = path.join(__dirname, 'render-industry-report-html.cjs');
const activeTemplate = path.join(skillRoot, 'template.md');
const legacyTemplate = path.join(skillRoot, 'template-old.md');
const input = path.join(repoRoot, 'wiki', 'queries', '2026-07-17-商业航天产业完整分析报告.md');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbxm-industry-render-'));
const output = path.join(tempDir, 'report.html');

const activeTemplateText = fs.readFileSync(activeTemplate, 'utf8');
for (const marker of [
  'version: 3.3.0',
  '<!-- industry-research:v3.3 -->',
  'scope: industry-and-sector-research',
  '## 1. 产业战略地位',
  '### 1.1 全球环境与中国国情',
  '### 1.2 国家战略形成与政策落地',
  '### 1.3 资源配置与国家比较优势',
  '### 1.4 战略地位结论',
  '| 战略酝酿 |',
  '| 国家战略形成 |',
  '| 产业政策落地 |',
  '| 生产要素 |',
  '**战略证据链最高确认环节：**',
  '**证据链首个断点：**',
  '## 2. 长期成长空间',
  '<!-- industry-chain:start -->',
  '## 3. 产业投资生命周期',
  '## 4. 产业维度结论',
  '## 5. 行业研究',
  '## 6. 综合判断与持续跟踪',
  '#### 6.1.1 横向比较与取舍',
  '#### 6.1.2 最终结论：行业选择与研究安排',
  '### 6.2 后续公司研究清单',
  '阅读指引：',
]) {
  if (!activeTemplateText.includes(marker)) throw new Error(`active template is missing: ${marker}`);
}

const activeSkillText = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
for (const marker of ['version: 4.3.0', 'template_version: 3.3.0', '全球环境', '中国国情', '战略酝酿不等于正式战略', '资源配置', '国家比较优势', '证据链已走到的最高环节和首个断点', '不能复制景气表后仅追加优先级标签', '证据更完整只说明结论更可验证', '经营候选深入', '关键缺口核验', '取舍代价', '选择逆转条件']) {
  if (!activeSkillText.includes(marker)) throw new Error(`skill comparison contract is missing: ${marker}`);
}
const primaryFrameworkText = fs.readFileSync(path.join(repoRoot, 'wiki', 'concepts', '冰冰小美-framework-产业思维.md'), 'utf8');
const strategicFrameworkSection = primaryFrameworkText.split('#### 产业战略地位')[1]?.split('#### 长期成长空间')[0] || '';
for (const marker of ['全球环境：', '**国情**', '战略酝酿', '国家战略形成', '产业政策落地', '资源配置：财政', '资源配置：金融', '资源配置：产业资本', '资源配置：生产要素', '国家比较优势', '是否属于未来重点发展的产业方向']) {
  if (!strategicFrameworkSection.includes(marker)) throw new Error(`primary framework strategic contract is missing: ${marker}`);
}
for (const marker of ['国家统计局', '中央政治局会议', '12371', '中国政府网政策文件库', '财政部', '人民银行', '国家级产业基金', '自然资源部']) {
  if (!activeTemplateText.includes(marker) || !activeSkillText.includes(marker)) throw new Error(`skill or template lost a strategic first-source family: ${marker}`);
}
const comparisonTemplateSection = activeTemplateText.split('### 6.1 行业比较与研究优先级')[1].split('### 6.2 ')[0];
if (comparisonTemplateSection.includes('| 景气水平 |') || comparisonTemplateSection.includes('| 变化方向 |')) {
  throw new Error('6.1 repeats the 5.3 prosperity matrix');
}
for (const forbidden of ['## 7. 公司研究', '### 6.1 主要参与者', '### 1.1 国家与时代需求', '### 1.2 战略向产业现实的传导', '最新估值观察']) {
  if (activeTemplateText.includes(forbidden)) throw new Error(`active template exceeds industry scope: ${forbidden}`);
}

const legacyTemplateText = fs.readFileSync(legacyTemplate, 'utf8');
for (const marker of ['version: 1.4.0', '## 7. 综合产业判断', '### 5.4 产业投资生命周期']) {
  if (!legacyTemplateText.includes(marker)) throw new Error(`legacy template is missing: ${marker}`);
}

const markdown = fs.readFileSync(input, 'utf8');
const reportLinks = [...markdown.matchAll(/\[\[([^\]|]*机构级决策研报(?:\.html)?)\|([^\]]+)\]\]/g)];
if (reportLinks.length !== 25) {
  throw new Error(`expected 25 company report links, got ${reportLinks.length}`);
}

const uniqueTargets = new Set(reportLinks.map((match) => match[1]));
if (uniqueTargets.size !== 18) {
  throw new Error(`expected 18 unique report targets, got ${uniqueTargets.size}`);
}

const missingTargets = [];
for (const target of uniqueTargets) {
  const extension = path.extname(target);
  const targetPath = path.resolve(repoRoot, extension ? target : `${target}.md`);
  if (!fs.existsSync(targetPath)) missingTargets.push(target);
}
if (missingTargets.length) {
  console.warn(`SKIP: ${missingTargets.length} legacy report targets are no longer present`);
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
  '- **分析日期：** 2026-07-20',
  '- **数据截止日期：** 2026-07-20',
  '- **地域范围：** 中国',
  '- **参考资料：** [[sources/automations/商业航天每日跟踪/2026-07-17-1616-中国卫星-机构级决策研报.html|中国卫星]]、[[workbench/targets/2026-07-15-1514-华明装备机构级决策研报|华明装备]]',
  '## 1. 产业战略地位',
  '### 1.1 国家与时代需求',
  '| 维度 | 当前事实 | 对产业的长期影响 | 持续性 | 数据时间 / 来源 | 证据性质 |',
  '|---|---|---|---|---|---|',
  '| 国家战略 | 测试 | 测试 | 长 | 2026-07-20 | 事实 |',
  '## 2. 长期成长空间',
  '### 2.1 产业边界与 TAM',
  '| 空间层级 | 统计口径 | 当前规模 / 状态 | 核心驱动 | 天花板约束 | 数据时间 / 来源 | 证据状态 |',
  '|---|---|---|---|---|---|---|',
  '| 当前可服务市场 | 中国 / 测试 | 未获取到 | 测试 | 测试 | 2026-07-20 | 待验证 |',
  '### 2.4 产业结构与产业链',
  '<!-- industry-chain:start -->',
  '| 层级 | 子环节 | 产品或服务 | 解决的需求或约束 | 价值分配 | 技术或资源壁垒 | 代表主体类型 | 证据状态 |',
  '|---|---|---|---|---|---|---|---|',
  '| 上游 | 核心部件 | 材料与部件 | 提供关键能力 | 高 | 高 | 专业供应商 | 已验证 |',
  '| 中游 | 系统制造 | 总装与交付 | 形成工程产品 | 高 | 高 | 制造主体 | 待验证 |',
  '| 下游 | 运营应用 | 连接与数据服务 | 形成持续服务 | 中高 | 中高 | 运营主体 | 待验证 |',
  '<!-- industry-chain:end -->',
  '## 3. 产业投资生命周期',
  '### 3.1 阶段轨道与当前定位',
  '<!-- industry-lifecycle:start -->',
  '#### 产业投资生命周期图数据',
  '| 阶段序号 | 阶段名称 | 阶段状态 | 时间范围 | 当前判断 | 核心证据 | 下一阶段条件 | 主要风险 | 置信度 |',
  '|---|---|---|---|---|---|---|---|---|',
  '| S1 | 第一阶段：关注启动期 | 已经历 | 2023—2024 | 政策关注完成 | 政策密度提高 | 资本进入 | 关注退潮 | 高 |',
  '| S2 | 第二阶段：资本引导期 | 当前 | 2025—至今 | 资本向产业投入 | 产业基金和资本开支增加 | 业绩持续兑现 | 重复建设 | 中 |',
  '| S3 | 第三阶段：泡沫与瓶颈期 | 未进入 | 待验证 | 尚未出现全面过热 | 估值与产能仍需观察 | 产能明显过剩 | 估值泡沫 | 中 |',
  '| S4 | 第四阶段：问题解决与二次成长 | 未进入 | 待验证 | 第二增长曲线待验证 | 新需求尚未形成 | 新技术解决瓶颈 | 新需求不及预期 | 低 |',
  '#### 生命周期关键证据节点',
  '| 时间 | 所属阶段 | 事件 | 证据性质 | 影响 | 来源 |',
  '|---|---|---|---|---|---|',
  '| 2024Q2 | 第一阶段：关注启动期 | 国家战略明确 | 事实 | 社会关注度提高 | [[wiki/concepts/冰冰小美-framework-产业思维|知识库框架]] |',
  '| 2025Q1 | 第二阶段：资本引导期 | 产业资本开始扩张 | 推断 | 资本开支进入验证期 | 待验证 |',
  '<!-- industry-lifecycle:end -->',
  '| 分析项 | 当前判断 | 核心证据 | 下一阶段条件 | 主要风险 |',
  '|---|---|---|---|---|',
  '| 市场关注度 | 高 | 政策和媒体热度提高 | 关注转化为订单 | 主题退潮 |',
  '| 产业资本投入 | 中高 | 资本开支增加 | 形成有效产能 | 重复建设 |',
  '| 综合生命周期 | 第二阶段：资本引导期 | 资本正在进入 | 业绩兑现 | 资本错配 |',
  '### 3.2 阶段转换与反证',
  '| 判断项目 | 当前结论 | 下一阶段必须满足的条件 | 领先指标 | 反证指标 |',
  '|---|---|---|---|---|',
  '| 阶段是否成立 | 成立 | 业绩兑现 | 利润增长 | 资本退出 |',
  '## 4. 产业维度结论',
  '# 证据与边界附录',
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
for (const marker of ['1. 产业战略地位', '2. 长期成长空间', '3. 产业投资生命周期', '4. 产业维度结论']) {
  if (!fixtureHtml.includes(marker)) throw new Error(`industry-layer structure is missing: ${marker}`);
}
if (!fixtureHtml.includes('2026-07-17-1616-中国卫星-机构级决策研报.html')) {
  throw new Error('explicit HTML report link was not preserved');
}
if (!fixtureHtml.includes('2026-07-15-1514-华明装备机构级决策研报.md')) {
  throw new Error('Workbench Markdown fallback was rewritten incorrectly');
}
if (fixtureHtml.includes('workbench/targets/2026-07-15-1514-华明装备机构级决策研报.html')) {
  throw new Error('Workbench Markdown fallback points to a nonexistent HTML');
}

for (const marker of [
  'class="industry-chain-visual"',
  'class="chain-flow"',
  '上游供给',
  '系统制造',
  'class="industry-lifecycle"',
  'class="lifecycle-stage is-current"',
  '第二阶段：资本引导期',
  'class="lifecycle-track"',
  '国家战略明确',
  'class="lifecycle-current-grid"',
  'class="lifecycle-signals"',
]) {
  if (!fixtureHtml.includes(marker)) throw new Error(`industry visualization is missing: ${marker}`);
}
if (fixtureHtml.includes('industry-chain:start') || fixtureHtml.includes('<th>层级</th>')) {
  throw new Error('industry chain source table was not replaced by the visualization');
}
if (fixtureHtml.includes('industry-lifecycle:start') || fixtureHtml.includes('产业投资生命周期图数据')) {
  throw new Error('lifecycle source tables were not replaced by the visualization');
}
if (fixtureHtml.includes('&lt;header class=&quot;lifecycle-head&quot;') || fixtureHtml.includes('<pre><code>&lt;header')) {
  throw new Error('lifecycle visualization HTML was escaped as a code block');
}

const outOfScopeInput = path.join(tempDir, 'fixture-out-of-scope.md');
const outOfScopeOutput = path.join(tempDir, 'fixture-out-of-scope.html');
fs.writeFileSync(outOfScopeInput, fs.readFileSync(fixtureInput, 'utf8').replace(
  '# 证据与边界附录',
  '### 2.7 行业景气周期\n\n此章节超出产业层范围。\n\n# 证据与边界附录',
), 'utf8');
const outOfScopeResult = spawnSync(process.execPath, [
  renderer,
  '--input', outOfScopeInput,
  '--output', outOfScopeOutput,
  '--vault-root', repoRoot,
], { encoding: 'utf8' });
if (outOfScopeResult.status === 0 || !outOfScopeResult.stderr.includes('产业维度报告包含越界章节')) {
  throw new Error('renderer accepted an industry-layer report containing an industry-research section');
}

const mismatchInput = path.join(tempDir, 'fixture-mismatch.md');
const mismatchOutput = path.join(tempDir, 'fixture-mismatch.html');
fs.writeFileSync(mismatchInput, fs.readFileSync(fixtureInput, 'utf8').replace('第二阶段：资本引导期', '第二阶段：资本扩张期'), 'utf8');
const mismatchResult = spawnSync(process.execPath, [
  renderer,
  '--input', mismatchInput,
  '--output', mismatchOutput,
  '--vault-root', repoRoot,
], { encoding: 'utf8' });
if (mismatchResult.status === 0 || !mismatchResult.stderr.includes('生命周期阶段必须与知识库详细定义表一致')) {
  throw new Error('renderer accepted a lifecycle stage name that differs from the knowledge base');
}

// Render the current template with fictional evidence in an isolated vault.
const latestVault = path.join(tempDir, 'latest-vault');
const frameworkName = '冰冰小美-framework-产业思维.md';
fs.mkdirSync(path.join(latestVault, 'wiki', 'concepts'), { recursive: true });
fs.mkdirSync(path.join(latestVault, 'sources', 'articles'), { recursive: true });
fs.mkdirSync(path.join(latestVault, 'workbench', 'targets'), { recursive: true });
fs.copyFileSync(path.join(repoRoot, 'wiki', 'concepts', frameworkName), path.join(latestVault, 'wiki', 'concepts', frameworkName));
fs.writeFileSync(path.join(latestVault, 'sources', 'articles', '测试证据.md'), '# 测试资料，仅用于渲染验证。', 'utf8');
fs.writeFileSync(path.join(latestVault, 'workbench', 'targets', '测试母稿.md'), '# 测试母稿', 'utf8');
const latestChain = [
  '<!-- industry-chain:start -->',
  '| 层级 | 子环节 | 产品或服务 | 上游投入 | 客户与付费主体 | 解决的需求或约束 | 本轮变化 | 价值分配 | 技术或资源壁垒 | 代表主体类型 | 来源与日期 | 证据状态 |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| 上游 | 核心部件 | 材料与部件 | 示例原料投入 | 示例系统厂付费 | 关键能力 | 示例认证进展 | 待验证 | 技术 | 供应商 | [[sources/articles/测试证据|测试证据]] 2026-09-04 | 假设 |',
  '| 中游 | 系统制造 | 交付系统 | 部件 | 示例运营方付费 | 系统集成 | 示例交付变化 | 待验证 | 组织能力 | 制造主体 | 测试数据 2026-09-04 | 假设 |',
  '| 下游 | 运营应用 | 数据服务 | 系统 | 示例最终客户付费 | 提供服务 | 示例需求变化 | 待验证 | 许可 | 运营主体 | 测试数据 2026-09-04 | 假设 |',
  '<!-- industry-chain:end -->',
].join('\n');
const oldFixture = fs.readFileSync(fixtureInput, 'utf8');
const lifecycleBlock = oldFixture.match(/<!-- industry-lifecycle:start -->[\s\S]*?<!-- industry-lifecycle:end -->/)[0];
let inStageTable = false;
const latestLifecycle = lifecycleBlock.split('\n').map(line => {
  if (line.startsWith('| 阶段序号')) inStageTable = true;
  if (inStageTable && !line.startsWith('|')) inStageTable = false;
  if (inStageTable) {
    const cells = line.split('|');
    cells.splice(6, 0, line.startsWith('| 阶段序号') ? ' 过渡特征 ' : line.startsWith('|---') ? '---' : line.includes('| S2 |') ? ' 示例局部瓶颈出现，尚不足改变主阶段 ' : ' 待验证 ');
    return cells.join('|');
  }
  return line.replace('| 事实 |', '| 已核实事实 |').replace('| 推断 |', '| 整理者推断 |');
}).join('\n');
let latestMarkdown = activeTemplateText.slice(activeTemplateText.indexOf('# 产业与行业研究报告'))
  .replace(/<!-- industry-chain:start -->[\s\S]*?<!-- industry-chain:end -->/, latestChain)
  .replace(/<!-- industry-lifecycle:start -->[\s\S]*?<!-- industry-lifecycle:end -->/, latestLifecycle)
  .replace('- **主要数据来源：**', '- **主要数据来源：** [[workbench/targets/测试母稿|测试母稿]]');

function fillSectorTable(markdown, heading, rows) {
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`fixture section missing: ${heading}`);
  const section = markdown.slice(start);
  const filled = section.replace(/(^\|[^\r\n]+\r?\n\|[-| ]+\r?\n)(?:\|[^\r\n]+\r?\n)+/m, (_full, header) => header + rows.join('\n') + '\n');
  if (filled === section) throw new Error(`fixture table missing: ${heading}`);
  return markdown.slice(0, start) + filled;
}
latestMarkdown = fillSectorTable(latestMarkdown, '### 5.1 行业划分与候选清单', [
  '| 示例部件／中国 | 部件与系统厂 | 需求扩张，新增供给待投产 | 模拟资料 2026-09-04 | 库存上升则降级 | 重点研究：采购关系成立 |',
  '| 示例服务／中国 | 服务与终端客户 | 更新需求开始回升 | 模拟资料 2026-09-04 | 回款未改善 | 观察：需求持续性待验证 |',
  '| 示例替代部件／中国 | 新部件与系统厂 | 采购与主营利润兑现 | 模拟资料 2026-09-04 | 新供给可能压价 | 重点研究：需求传导成立 |',
  '| 示例配套／中国 | 配套服务与系统厂 | 交付瓶颈重要 | 模拟资料 2026-09-04 | 缺订单与利润证据 | 观察：优先补证 |',
  '| 示例无关业务／中国 | 无关产品 | 不存在采购关系 | 模拟资料 2026-09-04 | 业务不在本轮范围 | 排除：无业务关系 |',
]);
latestMarkdown = fillSectorTable(latestMarkdown, '### 5.3 行业景气判断', [
  '| 示例部件／中国 | 高位分化／转弱 | 偏高 | 转弱 | 新供给开始压价 | 利润仍可维持 | 库存进一步上升 | 模拟经营证据，交付数据缺口 | 中 |',
  '| 示例服务／中国 | 复苏 | 偏低 | 改善 | 更新需求带动采购 | 客户持续付费 | 回款停滞 | 模拟采购证据，利润兑现待验证 | 低 |',
  '| 示例替代部件／中国 | 扩张／高景气 | 偏高 | 改善 | 主营利润与回款匹配 | 有效供给受约束 | 扩产压价 | 模拟经营证据，供给预测待验证 | 中 |',
  '| 示例配套／中国 | 待验证 | 待验证 | 待验证 | 约束重要但经营缺数据 | 待验证 | 未形成采购 | 模拟约束证据，订单与利润缺口 | 低 |',
]);
latestMarkdown = fillSectorTable(latestMarkdown, '#### 6.1.1 横向比较与取舍', [
  '| G1 | 示例替代部件与示例部件，先深入谁 | 中国，模拟同窗口，分别验证主营利润与现金 | 替代部件利润和现金匹配；部件受新增供给挤压，模拟资料 2026-09-04 | 替代部件优先深入；代价是放弃部件短期高利润线索 | 中；仅为样本证据，非全行业结论 | 替代部件利润优势消失，或部件供给退出、回款恢复 |',
  '| G2 | 示例部件与示例服务，观察先后 | 中国，模拟同窗口；不比较跨模式利润率大小 | 部件利润仍高但转弱，服务低位改善但利润留存待验证，模拟资料 2026-09-04 | 并列观察；证据不足以抵消各自不利项 | 低；没有决定性优势，不强排名 | 服务补齐利润回款或部件确认供给出清，再调整顺序 |',
  '| G3 | 示例配套与示例替代部件，研究任务分流 | 中国；约束重要性和经营强弱不是同一判断 | 配套只有约束证据而替代部件已有经营证据，模拟资料 2026-09-04 | 分组不排序；配套优先核验不代表经营更好 | 低；配套不能确认高景气 | 配套补齐订单、利润与回款后才纳入经营比较 |',
]);
const arrangementRows = [
  '| 示例部件／中国 | G1、G2 | 常规跟踪 | 观察；与服务并列 | 相对替代部件，利润受供给挤压；初筛降级 | 下一期有效产能与回款 |',
  '| 示例服务／中国 | G2 | 常规跟踪 | 观察；与部件并列 | 低位改善不自动优先；保留观察 | 下一期同口径主营利润与回款 |',
  '| 示例替代部件／中国 | G1、G3 | 经营候选深入 | 重点研究；经营组优先 | 利润与现金兑现证据相对较强；保留重点 | 下一期供给和价差 |',
  '| 示例配套／中国 | G3 | 关键缺口核验 | 重点研究；补证组优先，不与经营组排序 | 约束重要但经营待验证；仅提高核验优先级 | 下一披露期纯业务订单与现金回收 |',
  '| 示例无关业务／中国 | 不比较：无业务关系 | 不适用（排除） | 排除 | 保留初筛排除，不是因缺数据 | 仅业务范围变化时重新检查 |',
];
latestMarkdown = fillSectorTable(latestMarkdown, '#### 6.1.2 最终结论：行业选择与研究安排', arrangementRows);
const handoffRow = '| 示例替代部件／中国 | 拟研究公司是否有该产品收入，认证与交付能否对应到订单 | 公司产品分部披露、客户认证与订单交付材料 | 业务可归属则继续深入，仅概念关联则暂缓受益判断 |';
latestMarkdown = fillSectorTable(latestMarkdown, '### 6.2 后续公司研究清单', [handoffRow]);
const legacyHandoff = [
  '### 6.2 进入公司研究的条件', '',
  '| 重点或观察行业 | 行业结论与依据 | 公司层需验证的业务与订单关系 | 兑现条件与风险 | 下一验证节点 |',
  '|---|---|---|---|---|',
  '| 示例替代部件／中国 | 模拟行业证据 | 订单对应关系待验证 | 交付与回款风险 | 下一披露期 |', '',
].join('\n');
const legacyStrategicChapter = [
  '## 1. 产业战略地位', '',
  '回答：国家和时代为什么需要这个产业，这个产业是否值得长期跟踪。', '',
  '### 1.1 国家与时代需求', '',
  '| 维度 | 当前事实 | 对产业的长期影响 | 持续性 | 数据时间 / 来源 | 证据性质 |',
  '|---|---|---|---|---|---|',
  '| 国家战略 | 模拟事实 | 模拟影响 | 长 | 模拟来源 | 假设 |', '',
  '### 1.2 战略向产业现实的传导', '',
  '| 传导环节 | 当前状态 | 核心证据 | 尚未完成的条件 | 主要风险 |',
  '|---|---|---|---|---|',
  '| 政策与制度 | 模拟状态 | 模拟证据 | 模拟条件 | 模拟风险 |', '',
  '### 1.3 战略地位结论', '',
  '- **长期跟踪价值：** 待验证', '',
].join('\n');
const v32Markdown = latestMarkdown.replace('<!-- industry-research:v3.3 -->', '<!-- industry-research:v3.2 -->')
  .replace('template_version: "3.3.0"', 'template_version: "3.2.0"')
  .replace(/## 1\. 产业战略地位[\s\S]*?(?=## 2\. 长期成长空间)/, legacyStrategicChapter + '\n');
const v31Markdown = v32Markdown.replace('<!-- industry-research:v3.2 -->', '<!-- industry-research:v3.1 -->')
  .replace('template_version: "3.2.0"', 'template_version: "3.1.0"')
  .replace('#### 6.1.2 最终结论：行业选择与研究安排', '#### 6.1.2 研究安排与候选去向')
  .replace(/### 6\.2 后续公司研究清单[\s\S]*?(?=### 6\.3 )/, legacyHandoff);

// Keep the old comparison shape as a historical v3.0 fixture, not an active template.
const legacyComparison = [
  '### 6.1 行业比较与研究优先级', '',
  '| 行业／产品与地域 | 景气水平 | 变化方向 | 竞争与利润留存 | 持续性与反证 | 证据质量／缺口 | 研究优先级与理由 |',
  '|---|---|---|---|---|---|---|',
  '| 示例部件／中国 | 偏高 | 转弱 | 利润受新增供给挤压 | 库存上升为反证 | 模拟证据／交付缺口 | 观察：高位转弱，初筛降级 |', '',
].join('\n');
const v30Markdown = v32Markdown.replace('<!-- industry-research:v3.2 -->', '<!-- industry-research:v3.0 -->')
  .replace('template_version: "3.2.0"', 'template_version: "3.0.0"')
  .replace(/### 6\.2 后续公司研究清单[\s\S]*?(?=### 6\.3 )/, legacyHandoff)
  .replace(/### 6\.1 行业比较与研究优先级[\s\S]*?(?=### 6\.2 )/, legacyComparison);

function renderLatest(name, source) {
  const inputPath = path.join(latestVault, 'workbench', 'targets', `${name}.md`);
  const outputPath = path.join(latestVault, 'sources', 'automations', '其他产业', '测试', `${name}.html`);
  fs.writeFileSync(inputPath, source, 'utf8');
  const result = spawnSync(process.execPath, [renderer, '--input', inputPath, '--output', outputPath, '--vault-root', latestVault], { encoding: 'utf8' });
  return { ...result, html: result.status === 0 ? fs.readFileSync(outputPath, 'utf8') : '' };
}

const latestResult = renderLatest('latest', latestMarkdown);
if (latestResult.status !== 0) throw new Error(`current template render failed: ${latestResult.stderr}`);
const conclusionLink = latestResult.html.match(/<a class="toc-l4" href="#([^"]+)">6\.1\.2 最终结论：行业选择与研究安排<\/a>/);
if (!conclusionLink || !latestResult.html.includes(`<h4 id="${conclusionLink[1]}">6.1.2 最终结论：行业选择与研究安排`)) {
  throw new Error('final conclusion is not directly accessible from the HTML table of contents');
}
for (const cell of handoffRow.split('|').slice(1, -1).map(value => value.trim())) {
  if (!latestResult.html.includes(`<td>${cell}</td>`)) throw new Error(`company handoff lost content: ${cell}`);
}
for (const marker of ['示例原料投入', '示例系统厂付费', '示例最终客户付费', '示例认证进展', '示例交付变化', '来源与日期：', '过渡特征：示例局部瓶颈出现', 'class="lifecycle-event is-fact"', 'class="lifecycle-event is-inference"', '向行业研究交接', '持续跟踪与重估条件', 'articles/测试证据.md', 'concepts/冰冰小美-framework-产业思维.md', 'workbench/targets/测试母稿.md']) {
  if (!latestResult.html.includes(marker)) throw new Error(`current template lost content: ${marker}`);
}
const renderedRows = [...latestResult.html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(match => match[1]);
for (const cells of [
  ['示例部件／中国', '偏高', '转弱'],
  ['示例服务／中国', '偏低', '改善'],
]) {
  if (!renderedRows.some(row => cells.every(cell => row.includes(`<td>${cell}</td>`)))) throw new Error('5.3 lost the distinction between prosperity level and direction');
}
for (const cells of [
  ['G1', '替代部件优先深入；代价是放弃部件短期高利润线索', '替代部件利润优势消失，或部件供给退出、回款恢复'],
  ['G2', '并列观察；证据不足以抵消各自不利项'],
  ['示例替代部件／中国', '经营候选深入', '重点研究；经营组优先'],
  ['示例配套／中国', '关键缺口核验', '重点研究；补证组优先，不与经营组排序'],
  ['示例无关业务／中国', '不适用（排除）', '排除'],
]) {
  if (!renderedRows.some(row => cells.every(cell => row.includes(`<td>${cell}</td>`)))) throw new Error('6.1 lost a relative choice, tie, verification task or exclusion');
}
if ([...latestResult.html.matchAll(/<h2 id="section-\d+">[0-6]\./g)].length !== 7) {
  throw new Error('industry and sector report did not render all seven numbered chapters');
}
if (latestResult.html.includes('测试证据.html') || latestResult.html.includes('冰冰小美-framework-产业思维.html')) {
  throw new Error('existing Markdown sources were rewritten to nonexistent HTML targets');
}
const unpositionedResult = renderLatest('unpositioned', latestMarkdown.replace('| 当前 |', '| 待验证 |'));
if (unpositionedResult.status !== 0 || !unpositionedResult.html.includes('当前生命周期阶段证据不足，暂不定位。') || unpositionedResult.html.includes('aria-current="step"')) {
  throw new Error('uncertain lifecycle was forced into a current stage');
}
for (const [name, source, expectedError] of [
  ['missing-sector-research', latestMarkdown.replace(/## 5\. 行业研究[\s\S]*?(?=## 6\.)/, ''), '必须依次包含0—6章'],
  ['missing-competition', latestMarkdown.replace('### 5.4 行业竞争格局', '### 5.4 其他'), '缺少 v3.3 模板契约'],
  ['old-strategic-heading', latestMarkdown.replace('### 1.1 全球环境与中国国情', '### 1.1 国家与时代需求'), '缺少 v3.3 模板契约'],
  ['wrong-strategic-order', latestMarkdown.replace('### 1.1 全球环境与中国国情', '### TMP').replace('### 1.2 国家战略形成与政策落地', '### 1.1 全球环境与中国国情').replace('### TMP', '### 1.2 国家战略形成与政策落地'), '产业战略地位必须按'],
  ['missing-strategic-source', latestMarkdown.replace('| 数据时间／第一信息源 | 证据性质 |', '| 数据时间／来源 | 证据性质 |'), '产业战略地位缺少必填证据表'],
  ['missing-resource-layer', latestMarkdown.replace(/^\| 生产要素 \|.*\r?\n/m, ''), '产业战略地位证据链缺少固定层级'],
  ['missing-strategic-breakpoint', latestMarkdown.replace('**证据链首个断点：**', '**一般缺口：**'), '缺少 v3.3 模板契约'],
  ['missing-direction', latestMarkdown.replaceAll('| 变化方向 |', '| 合并景气判断 |'), '行业研究缺少候选、景气或比较表的必填字段'],
  ['company-research', latestMarkdown.replace('# 证据与边界附录', '### 6.4 公司研究\n公司层分析\n# 证据与边界附录'), '包含公司或投资价值层的越界章节'],
  ['stock-valuation', latestMarkdown.replace('# 证据与边界附录', '### 6.4 个股估值\n估值分析\n# 证据与边界附录'), '包含公司或投资价值层的越界章节'],
  ['missing-payer', latestMarkdown.replace('| 客户与付费主体 |', '| 客户 |'), '缺少必填字段：客户与付费主体'],
  ['missing-transition', latestMarkdown.replace('| 过渡特征 |', '| 其他特征 |'), '缺少必填字段：过渡特征'],
  ['missing-source', latestMarkdown.replace('sources/articles/测试证据', 'sources/articles/不存在'), '报告引用的本地链接不存在'],
  ['multiple-current', latestMarkdown.replace('| 已经历 |', '| 当前 |'), '最多只能有一个“当前”阶段'],
  ['repeated-prosperity', latestMarkdown.replace(/### 6\.1 行业比较与研究优先级[\s\S]*?(?=### 6\.2 )/, legacyComparison), '6.1 缺少横向比较或研究安排表'],
  ['missing-comparator', latestMarkdown.replace('| 比较对象与研究问题 |', '| 行业摘要 |'), '6.1 缺少横向比较或研究安排表'],
  ['missing-reversal', latestMarkdown.replace('| 选择逆转条件 |', '| 一般风险 |'), '6.1 缺少横向比较或研究安排表'],
  ['missing-task-type', latestMarkdown.replace('| 研究任务类型 |', '| 景气排名 |'), '6.1 缺少横向比较或研究安排表'],
  ['missing-conclusion', latestMarkdown.replace('#### 6.1.2 最终结论：行业选择与研究安排', '#### 6.1.2 研究安排'), '6.1.2 缺少最终结论标题'],
  ['old-handoff-heading', latestMarkdown.replace('### 6.2 后续公司研究清单', '### 6.2 进入公司研究的条件'), '缺少 v3.3 模板契约'],
  ['old-handoff-table', latestMarkdown.replace(/### 6\.2 后续公司研究清单[\s\S]*?(?=### 6\.3 )/, legacyHandoff.replace('进入公司研究的条件', '后续公司研究清单')), '6.2 缺少公司级研究清单'],
  ['handoff-without-company-evidence', latestMarkdown.replace(handoffRow, handoffRow.replace('公司产品分部披露、客户认证与订单交付材料', '')), '6.2 仅逐项承接'],
  ['handoff-industry-gap', latestMarkdown.replace(handoffRow, handoffRow.replace('示例替代部件／中国', '示例配套／中国')), '6.2 仅逐项承接'],
  ['duplicate-handoff', latestMarkdown.replace(handoffRow, handoffRow + '\n' + handoffRow), '6.2 仅逐项承接'],
  ['false-empty-handoff', latestMarkdown.replace(/### 6\.2 后续公司研究清单[\s\S]*?(?=### 6\.3 )/, '### 6.2 后续公司研究清单\n\n当前无公司研究交接项。\n\n'), '6.2 缺少公司级研究清单'],
  ['missing-candidate', latestMarkdown.replace(arrangementRows[4], ''), '全部初筛候选逐项对应'],
  ['duplicate-candidate', latestMarkdown.replace(arrangementRows[4], arrangementRows[0]), '全部初筛候选逐项对应'],
  ['extra-candidate', latestMarkdown.replace(arrangementRows[4], arrangementRows[4].replace('示例无关业务／中国', '未初筛业务／中国')), '全部初筛候选逐项对应'],
  ['misplaced-comparison', latestMarkdown.replace(/(#### 6\.1\.1 横向比较与取舍[\s\S]*?)(#### 6\.1\.2 最终结论：行业选择与研究安排)/, '$2').replace('# 证据与边界附录', latestMarkdown.match(/#### 6\.1\.1 横向比较与取舍[\s\S]*?(?=#### 6\.1\.2 )/)[0] + '\n# 证据与边界附录'), '6.1 缺少横向比较或研究安排表'],
]) {
  const failed = renderLatest(name, source);
  if (failed.status === 0 || !failed.stderr.includes(expectedError)) throw new Error(`${name} validation failed: ${failed.stderr}`);
}

const v30Result = renderLatest('legacy-v30', v30Markdown);
if (v30Result.status !== 0 || !v30Result.html.includes('<th>研究优先级与理由</th>')) {
  throw new Error(`legacy v3.0 compatibility failed: ${v30Result.stderr}`);
}
const v32Result = renderLatest('legacy-v32', v32Markdown);
if (v32Result.status !== 0 || !v32Result.html.includes('1.1 国家与时代需求') || !v32Result.html.includes('6.2 后续公司研究清单')) {
  throw new Error(`legacy v3.2 compatibility failed: ${v32Result.stderr}`);
}
const v31Result = renderLatest('legacy-v31', v31Markdown);
if (v31Result.status !== 0 || !v31Result.html.includes('6.1.2 研究安排与候选去向') || !v31Result.html.includes('<th>研究任务类型</th>')) {
  throw new Error(`legacy v3.1 compatibility failed: ${v31Result.stderr}`);
}
const v32HandoffAnchor = v32Result.html.match(/<h3 id="([^"]+)">6\.2 /)?.[1];
if (!v32HandoffAnchor || v32HandoffAnchor !== v31Result.html.match(/<h3 id="([^"]+)">6\.2 /)?.[1]) {
  throw new Error('adding the conclusion TOC changed an existing section anchor');
}

let singleCandidateMarkdown = fillSectorTable(
  fillSectorTable(latestMarkdown, '### 5.1 行业划分与候选清单', ['| 示例配套／中国 | 服务与系统厂 | 约束重要 | 模拟证据 | 经营待验证 | 观察 |']),
  '#### 6.1.2 最终结论：行业选择与研究安排', [arrangementRows[3].replace('G3', '无横向对象：仅一个有效候选')],
);
singleCandidateMarkdown = singleCandidateMarkdown.replace(/### 6\.2 后续公司研究清单[\s\S]*?(?=### 6\.3 )/,
  '### 6.2 后续公司研究清单\n\n当前无公司研究交接项。先完成 6.1.2 配套方向的行业经营核验。\n\n');
singleCandidateMarkdown = fillSectorTable(singleCandidateMarkdown, '### 5.3 行业景气判断', [
  '| 示例配套／中国 | 待验证 | 待验证 | 待验证 | 约束重要但缺数据 | 待验证 | 未形成采购 | 模拟约束证据，缺经营数据 | 低 |',
]);
const singleCandidateResult = renderLatest('single-candidate', fillSectorTable(singleCandidateMarkdown, '#### 6.1.1 横向比较与取舍', [
  '| 不适用 | 仅一个有效候选，无横向对象 | 中国，模拟窗口 | 缺经营证据 | 不排序，仅核验 | 低 | 出现新的可比候选再比较 |',
]));
if (singleCandidateResult.status !== 0 || !singleCandidateResult.html.includes('仅一个有效候选，无横向对象')) {
  throw new Error(`single candidate was forced into a comparison: ${singleCandidateResult.stderr}`);
}

const v21Markdown = oldFixture
  .replace('# 产业报告链接路由测试', '# 旧版产业层报告\n<!-- industry-research:v2.1 -->\n- **观察窗口：** 2026-09\n- **比较窗口：** 2025-09\n- **原文与归纳边界：** 模拟测试')
  .replace(/^- \*\*参考资料：\*\*.*$/m, '')
  .replace(/<!-- industry-chain:start -->[\s\S]*?<!-- industry-chain:end -->/, latestChain)
  .replace(/<!-- industry-lifecycle:start -->[\s\S]*?<!-- industry-lifecycle:end -->/, latestLifecycle)
  .replace('## 3. 产业投资生命周期', '### 2.7 新旧需求变化与情景\n模拟场景\n## 3. 产业投资生命周期')
  .replace('## 4. 产业维度结论', '## 4. 产业维度结论\n### 4.2 向行业研究交接\n待行业验证\n### 4.3 持续跟踪与重估条件\n待验证');
const v21Result = renderLatest('legacy-v21', v21Markdown);
if (v21Result.status !== 0 || [...v21Result.html.matchAll(/<h2 id="section-\d+">[0-4]\./g)].length !== 5) {
  throw new Error(`legacy v2.1 compatibility failed: ${v21Result.stderr}`);
}

console.log('PASS: industry report HTML renderer (legacy, v2.1, v3.0-v3.2 and v3.3 strategic status + conclusion + company handoff)');
