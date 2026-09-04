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
  'version: 3.0.0',
  'scope: industry-and-sector-research',
  '## 1. 产业战略地位',
  '## 2. 长期成长空间',
  '<!-- industry-chain:start -->',
  '## 3. 产业投资生命周期',
  '## 4. 产业维度结论',
  '## 5. 行业研究',
  '## 6. 综合判断与持续跟踪',
]) {
  if (!activeTemplateText.includes(marker)) throw new Error(`active template is missing: ${marker}`);
}
for (const forbidden of ['## 7. 公司研究', '### 6.1 主要参与者', '最新估值观察']) {
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
]);
latestMarkdown = fillSectorTable(latestMarkdown, '### 5.3 行业景气判断', [
  '| 示例部件／中国 | 高位分化／转弱 | 偏高 | 转弱 | 新供给开始压价 | 利润仍可维持 | 库存进一步上升 | 模拟经营证据，交付数据缺口 | 中 |',
  '| 示例服务／中国 | 复苏 | 偏低 | 改善 | 更新需求带动采购 | 客户持续付费 | 回款停滞 | 模拟采购证据，利润兑现待验证 | 低 |',
]);
latestMarkdown = fillSectorTable(latestMarkdown, '### 6.1 行业比较与研究优先级', [
  '| 示例部件／中国 | 偏高 | 转弱 | 利润受新增供给挤压 | 库存上升为反证 | 模拟证据／交付缺口 | 观察：高位转弱，初筛降级 |',
  '| 示例服务／中国 | 偏低 | 改善 | 利润留存待验证 | 持续采购与回款 | 模拟证据／回款缺口 | 重点研究：低位改善，待后续验证 |',
]);

function renderLatest(name, source) {
  const inputPath = path.join(latestVault, 'workbench', 'targets', `${name}.md`);
  const outputPath = path.join(latestVault, 'sources', 'automations', '其他产业', '测试', `${name}.html`);
  fs.writeFileSync(inputPath, source, 'utf8');
  const result = spawnSync(process.execPath, [renderer, '--input', inputPath, '--output', outputPath, '--vault-root', latestVault], { encoding: 'utf8' });
  return { ...result, html: result.status === 0 ? fs.readFileSync(outputPath, 'utf8') : '' };
}

const latestResult = renderLatest('latest', latestMarkdown);
if (latestResult.status !== 0) throw new Error(`current template render failed: ${latestResult.stderr}`);
for (const marker of ['示例原料投入', '示例系统厂付费', '示例最终客户付费', '示例认证进展', '示例交付变化', '来源与日期：', '过渡特征：示例局部瓶颈出现', 'class="lifecycle-event is-fact"', 'class="lifecycle-event is-inference"', '向行业研究交接', '持续跟踪与重估条件', 'articles/测试证据.md', 'concepts/冰冰小美-framework-产业思维.md', 'workbench/targets/测试母稿.md']) {
  if (!latestResult.html.includes(marker)) throw new Error(`current template lost content: ${marker}`);
}
const renderedRows = [...latestResult.html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(match => match[1]);
for (const cells of [
  ['示例部件／中国', '偏高', '转弱', '观察：高位转弱，初筛降级'],
  ['示例服务／中国', '偏低', '改善', '重点研究：低位改善，待后续验证'],
]) {
  if (!renderedRows.some(row => cells.every(cell => row.includes(`<td>${cell}</td>`)))) throw new Error('sector comparison lost the distinction between prosperity level and direction');
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
  ['missing-competition', latestMarkdown.replace('### 5.4 行业竞争格局', '### 5.4 其他'), '缺少 v3.0 模板契约'],
  ['missing-direction', latestMarkdown.replaceAll('| 变化方向 |', '| 合并景气判断 |'), '行业研究缺少候选、景气或比较表的必填字段'],
  ['company-research', latestMarkdown.replace('# 证据与边界附录', '### 6.4 公司研究\n公司层分析\n# 证据与边界附录'), '包含公司或投资价值层的越界章节'],
  ['stock-valuation', latestMarkdown.replace('# 证据与边界附录', '### 6.4 个股估值\n估值分析\n# 证据与边界附录'), '包含公司或投资价值层的越界章节'],
  ['missing-payer', latestMarkdown.replace('| 客户与付费主体 |', '| 客户 |'), '缺少必填字段：客户与付费主体'],
  ['missing-transition', latestMarkdown.replace('| 过渡特征 |', '| 其他特征 |'), '缺少必填字段：过渡特征'],
  ['missing-source', latestMarkdown.replace('sources/articles/测试证据', 'sources/articles/不存在'), '报告引用的本地链接不存在'],
  ['multiple-current', latestMarkdown.replace('| 已经历 |', '| 当前 |'), '最多只能有一个“当前”阶段'],
]) {
  const failed = renderLatest(name, source);
  if (failed.status === 0 || !failed.stderr.includes(expectedError)) throw new Error(`${name} validation failed: ${failed.stderr}`);
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

console.log('PASS: industry report HTML renderer (legacy, v2.1 and industry + sector v3.0)');
