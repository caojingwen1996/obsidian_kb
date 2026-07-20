# Industry Report Equity Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在商业航天产业报告的公司映射表中加入 25 处可解析研报链接，并把“HTML 优先、Markdown 回退、无研报不链接”固化为以后所有产业报告的生成合同。

**Architecture:** Markdown 产业报告继续作为唯一内容源，公司单元格显式写入已核验的 Obsidian 链接；产业渲染器只负责确定性地转换链接，不根据公司名猜测文件。当前 Markdown 同时生成 Wiki 与自动化目录两份 HTML，测试验证 18 个唯一标的、25 处链接及所有目标文件。

**Tech Stack:** Markdown、Obsidian 双链、Node.js、marked、Python 项目合同验证、Git

**Design spec:** `docs/superpowers/specs/2026-07-20-industry-report-equity-links-design.md`

---

## 文件职责

- `wiki/queries/2026-07-17-商业航天产业完整分析报告.md`：唯一可维护报告源，写入公司研报链接。
- `wiki/queries/2026-07-17-商业航天产业完整分析报告.html`：Wiki 阅读版，由 Markdown 生成。
- `sources/automations/商业航天每日跟踪/商业航天产业完整分析报告.html`：自动化目录阅读版，由同一 Markdown 生成。
- `.agents/skills/bbxm-industry-analysis/scripts/render-industry-report-html.cjs`：将 Obsidian 链接转换为相对文件链接；对 Workbench Markdown 使用特殊回退规则。
- `.agents/skills/bbxm-industry-analysis/scripts/test-render-industry-report-html.cjs`：验证当前报告覆盖数量、链接存在性、HTML 与 Markdown 回退行为。
- `.agents/skills/bbxm-industry-analysis/SKILL.md`：定义未来产业报告的研报链接选择流程。
- `.agents/skills/bbxm-industry-analysis/template.md`：定义公司映射表的链接填写规则。
- `tests/validate_bbxm_project_skills.py`：验证 Skill 与模板合同一致。
- `log.md`：记录维护行为和验收结果。

## Task 1：先建立链接覆盖和渲染回归测试

**Files:**

- Modify: `.agents/skills/bbxm-industry-analysis/scripts/test-render-industry-report-html.cjs`

- [ ] **Step 1：加入当前报告链接清单验证**

在测试中读取原始 Markdown，并提取公司研报链接：

```javascript
const markdown = fs.readFileSync(input, 'utf8');
const reportLinks = [...markdown.matchAll(/\[\[([^\]|]+(?:机构级决策研报|机构级决策研报\.html))\|([^\]]+)\]\]/g)];
if (reportLinks.length !== 25) {
  throw new Error(`expected 25 company report links, got ${reportLinks.length}`);
}

const uniqueTargets = new Set(reportLinks.map((match) => match[1]));
if (uniqueTargets.size !== 18) {
  throw new Error(`expected 18 unique report targets, got ${uniqueTargets.size}`);
}

for (const target of uniqueTargets) {
  const extension = path.extname(target);
  const targetPath = path.resolve(repoRoot, extension ? target : `${target}.md`);
  if (!fs.existsSync(targetPath)) throw new Error(`missing report target: ${target}`);
}
```

- [ ] **Step 2：加入 HTML 优先与 Markdown 回退集成用例**

在临时目录写入一份满足 0—7 章和公司映射合同的最小 Markdown。公司映射中放入：

```markdown
| 上游 | 测试 | [[sources/automations/商业航天每日跟踪/2026-07-17-1616-中国卫星-机构级决策研报.html|中国卫星]] | A股 / 600118 | 测试 | 高 | 已披露 | 2026-07-17 | 测试 |
| 下游 | 测试 | [[workbench/targets/2026-07-15-1514-华明装备机构级决策研报|华明装备]] | A股 / 002270 | 测试 | 中 | 已披露 | 2026-07-15 | 测试 |
```

渲染后断言：

```javascript
if (!fixtureHtml.includes('2026-07-17-1616-中国卫星-机构级决策研报.html')) {
  throw new Error('explicit HTML report link was not preserved');
}
if (!fixtureHtml.includes('2026-07-15-1514-华明装备机构级决策研报.md')) {
  throw new Error('Workbench Markdown fallback was rewritten incorrectly');
}
if (fixtureHtml.includes('workbench/targets/2026-07-15-1514-华明装备机构级决策研报.html')) {
  throw new Error('Workbench Markdown fallback points to a nonexistent HTML');
}
```

- [ ] **Step 3：运行测试并确认红灯**

Run:

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.agents/skills/bbxm-industry-analysis/scripts/test-render-industry-report-html.cjs'
```

Expected: FAIL，首先报告当前 Markdown 的公司研报链接数量不是 25；不得因 JavaScript 语法或临时文件结构错误失败。

- [ ] **Step 4：提交测试**

```powershell
git add -- .agents/skills/bbxm-industry-analysis/scripts/test-render-industry-report-html.cjs
git diff --cached --check
git commit -m "test: cover industry report equity links"
```

## Task 2：实现 Workbench Markdown 回退规则

**Files:**

- Modify: `.agents/skills/bbxm-industry-analysis/scripts/render-industry-report-html.cjs`

- [ ] **Step 1：修改链接目标选择**

在 `normalizeObsidianLinks` 中用明确的路径类型决定目标：

```javascript
const sourcePath = path.resolve(vaultRoot, extension ? normalized : `${normalized}.md`);
const isWorkbenchReport = normalized.startsWith('workbench/targets/');
const linkedPath = isWorkbenchReport ? sourcePath : sourcePath.replace(/\.md$/i, '.html');
```

显式 `.html` 目标不受影响；其他 Wiki Markdown 仍转换为 HTML。

- [ ] **Step 2：运行渲染测试**

Run the Task 1 test command.

Expected: 仍 FAIL 于当前商业航天 Markdown 缺少 25 处链接，但临时 fixture 的 HTML/Markdown 路由断言通过。

- [ ] **Step 3：提交渲染器修改**

```powershell
git add -- .agents/skills/bbxm-industry-analysis/scripts/render-industry-report-html.cjs
git diff --cached --check
git commit -m "fix: preserve workbench markdown report links"
```

## Task 3：在商业航天 Markdown 中加入 25 处链接

**Files:**

- Modify: `wiki/queries/2026-07-17-商业航天产业完整分析报告.md`

- [ ] **Step 1：更新核心任务与订单承载主体表的 9 处链接**

按证券代码核对后链接以下公司：

```text
电科蓝天
航天电器
国博电子
新雷能
中国卫星
上海瀚讯
航天环宇
中国卫通
中科星图
```

公司全称单元格保留全称作为显示文本；“航天电器、国博电子、新雷能等”改成三个独立链接加普通文本“等”。

- [ ] **Step 2：更新 159218 成分股表的 16 处链接**

链接以下已存在 HTML 研报的公司：

```text
中国卫星、中国卫通、航天电子、华测导航、国博电子、中科星图、北斗星通、铂力特、
北方导航、新雷能、芯原股份、航天电器、信维通信、国科微、四维图新、航天环宇
```

其余 34 家公司保持普通文本和原有“待研报核验”状态。

- [ ] **Step 3：运行测试并确认绿灯**

Run the Task 1 test command.

Expected: `PASS: industry report HTML renderer`，并且 25 处链接、18 个唯一目标和两类路由断言全部通过。

- [ ] **Step 4：提交 Markdown 链接**

```powershell
git add -- wiki/queries/2026-07-17-商业航天产业完整分析报告.md
git diff --cached --check
git commit -m "docs: link commercial space companies to reports"
```

## Task 4：固化未来产业报告链接合同

**Files:**

- Modify: `.agents/skills/bbxm-industry-analysis/SKILL.md`
- Modify: `.agents/skills/bbxm-industry-analysis/template.md`
- Modify: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1：更新 Skill 的公司映射流程**

在产业链公司映射规则和 HTML 导出质量检查中加入：

```text
以证券代码唯一匹配已有研报；HTML 优先，Markdown 回退，无研报不链接。
多公司单元格逐家公司链接；导出前验证显式目标存在。
研报链接只提供企业研究入口，不把产业报告改写成个股推荐。
```

将现有“每次执行产业分析任务时，必须重新读取”表述明确为“必须完整读取当前版本”，使现有项目合同与 Skill 的既有语义一致。

- [ ] **Step 2：更新模板填写规则**

在 `3.1.1 产业链公司映射` 的填写规则中加入同样三个精确标记：

```text
HTML 优先
Markdown 回退
无研报不链接
```

- [ ] **Step 3：扩充项目技能验证**

将 `template.md` 加入 `bbxm-industry-analysis` 的必需文件，并读取 `industry_template`。增加：

```python
for marker in ("HTML 优先", "Markdown 回退", "无研报不链接"):
    require(
        marker in industry_skill and marker in industry_template,
        f"bbxm-industry-analysis report-link contract is missing: {marker}",
    )
```

- [ ] **Step 4：运行项目技能验证**

```powershell
python tests/validate_bbxm_project_skills.py
```

Expected: `PASS: bbxm-expert project-only skill contract validated`。

- [ ] **Step 5：提交合同更新**

```powershell
git add -- .agents/skills/bbxm-industry-analysis/SKILL.md .agents/skills/bbxm-industry-analysis/template.md tests/validate_bbxm_project_skills.py
git diff --cached --check
git commit -m "docs: require equity links in industry reports"
```

## Task 5：从同一 Markdown 重建两份 HTML

**Files:**

- Modify: `wiki/queries/2026-07-17-商业航天产业完整分析报告.html`
- Modify: `sources/automations/商业航天每日跟踪/商业航天产业完整分析报告.html`

- [ ] **Step 1：生成 Wiki HTML**

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.agents/skills/bbxm-industry-analysis/scripts/render-industry-report-html.cjs' --input 'wiki/queries/2026-07-17-商业航天产业完整分析报告.md' --output 'wiki/queries/2026-07-17-商业航天产业完整分析报告.html' --vault-root '.'
```

Expected: 输出 `Generated ...2026-07-17-商业航天产业完整分析报告.html`。

- [ ] **Step 2：生成自动化目录 HTML**

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.agents/skills/bbxm-industry-analysis/scripts/render-industry-report-html.cjs' --input 'wiki/queries/2026-07-17-商业航天产业完整分析报告.md' --output 'sources/automations/商业航天每日跟踪/商业航天产业完整分析报告.html' --vault-root '.'
```

Expected: 输出 `Generated ...商业航天产业完整分析报告.html`。

- [ ] **Step 3：验证两份 HTML 的报告正文一致**

读取两个 HTML 的 `<main class="report">...</main>`，要求内容完全相同；外部相对链接因输出目录不同可以不同，因此比较时先把 `href` 解析成仓库绝对目标再比较目标集合。

两份 HTML 都必须满足：

```text
0—7 章齐全
25 处公司研报链接
18 个唯一研报目标
没有 [[、替换字符或失效目标
```

- [ ] **Step 4：提交 HTML**

```powershell
git add -- wiki/queries/2026-07-17-商业航天产业完整分析报告.html sources/automations/商业航天每日跟踪/商业航天产业完整分析报告.html
git diff --cached --check
git commit -m "docs: rebuild commercial space industry report html"
```

## Task 6：记录日志并完成验收

**Files:**

- Modify: `log.md`

- [ ] **Step 1：追加 2026-07-20 维护日志**

记录 25 处链接、18 个唯一标的、两份 HTML 重建、Skill/模板合同、WorkBench Markdown 回退规则和测试结果；不改写旧日志。

- [ ] **Step 2：运行完整定向验证**

```powershell
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.agents/skills/bbxm-industry-analysis/scripts/test-render-industry-report-html.cjs'
python tests/validate_bbxm_project_skills.py
python tests/validate_workbench_boundary.py
git diff --check
git status --short
```

Expected:

- 产业报告渲染测试 PASS；
- 项目技能合同测试 PASS；
- Workbench 边界测试 PASS；
- `git diff --check` 无输出；
- 提交日志前 `git status --short` 只显示 `log.md`。

- [ ] **Step 3：执行编码与失效链接检查**

```powershell
rg -n '�|鍐|鐭|鎯|灏|\[\[' 'wiki/queries/2026-07-17-商业航天产业完整分析报告.html' 'sources/automations/商业航天每日跟踪/商业航天产业完整分析报告.html'
```

Expected: 0 命中。

- [ ] **Step 4：提交日志**

```powershell
git add -- log.md
git diff --cached --check
git commit -m "docs: log industry report equity links"
```

- [ ] **Step 5：最终检查**

```powershell
git status --short
git log --oneline -8
```

Expected: 隔离工作区干净，最近提交只包含本计划涉及的测试、渲染器、报告、Skill、模板、HTML 和日志。随后按收尾流程合并到 `main`、复验并推送。
