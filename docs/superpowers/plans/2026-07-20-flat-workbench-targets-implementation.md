# Flat Workbench Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 29 份权威 Markdown 个股研报扁平迁移到 `workbench/targets/`，把 25 份 HTML 和 1 份重复 Markdown 恢复到原自动化来源目录，并删除单标的目录与索引。

**Architecture:** `workbench/targets/` 只保存可继续维护的权威 Markdown 研究工件，文件名承担日期与标的识别；自动化生成的 HTML 按产业来源回到 `sources/automations/`，无法分类的产物进入 `sources/automations/temp/`。`workbench/index.md` 直接链接扁平文件，不再通过标的索引中转。

**Tech Stack:** Markdown、Obsidian 双链、Python 3 边界验证、PowerShell、Git

**Design spec:** `docs/superpowers/specs/2026-07-20-flat-workbench-targets-design.md`

---

## 实施边界

- 不改写 29 份研报正文、frontmatter 或估值结论，只改变路径。
- 不为航天电子补生成 Markdown；索引保留其 HTML 入口并标注“Markdown 待补”。
- 不清理旧维护日志和旧实施计划中的历史路径文字；“旧路径清零”针对当前有效链接、模板、技能合同和测试。
- 不处理 `bbxm-industry-analysis` 已知的“缺少 `完整读取当前版本` 合同标记”问题。
- 每个任务单独提交；若某一步验证失败，先修复该步，不把失败带入下一提交。

## Task 1：先把扁平目录规则写进边界测试

**Files:**

- Modify: `tests/validate_workbench_boundary.py`

- [ ] **Step 1：将研报清单扩充为全部 29 个文件名**

把 `REPORTS` 从“文件名 → 标的目录”改为 29 个权威文件名集合。完整清单以当前 `workbench/targets/*/reports/*.md` 枚举结果为准；测试不得再编码标的子目录。

同时从 Workbench 必需合同清单中移除即将废止的 `templates/target-index-template.md`。

- [ ] **Step 2：新增扁平结构断言**

测试至少断言：

```python
targets = workbench / "targets"
require(not [p for p in targets.iterdir() if p.is_dir()], "targets must be flat")
actual_reports = sorted(p.name for p in targets.glob("*.md"))
require(actual_reports == sorted(REPORTS), "flat report inventory mismatch")
require(not list(workbench.rglob("*.html")), "HTML leaked into Workbench")
```

逐份报告继续检查：

```python
report = targets / filename
require("artifact_type: equity_research" in content, f"missing artifact_type: {filename}")
require(not re.search(r"^type:\s*(query|event|timeline)\s*$", content, re.M), ...)
```

另外断言：

- `sources/automations/temp/README.md` 存在；
- `sources/automations/支柱产业/README.md` 存在；
- 当前技能合同包含 `workbench/targets/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md`；
- 当前技能合同不包含 `<证券代码>-<公司简称>/reports/`；
- `workbench/index.md` 不再包含 `/index`、`/reports/`、`/outputs/`。

对 `AGENTS.md`、`schema.md`、`page-types.md`、`index.md`、`hot.md`、`wiki/`、`workbench/`、`.agents/`、`tests/` 的 Markdown、Python、YAML 文件扫描旧路径；测试应拒绝当前有效内容中的 `/reports/`、`/index/`、`/outputs/` 和旧技能合同，但明确不扫描历史 `log.md` 与 `docs/superpowers/`。

- [ ] **Step 3：运行测试，确认它因当前嵌套结构失败**

Run:

```powershell
python tests/validate_workbench_boundary.py
```

Expected: FAIL，首个失败应指向 `workbench/targets/` 仍存在子目录或扁平研报清单缺失，而不是语法错误。

- [ ] **Step 4：提交测试合同**

```powershell
git add -- tests/validate_workbench_boundary.py
git diff --cached --check
git commit -m "test: require flat workbench targets"
```

## Task 2：恢复 HTML 与未分类原始产物

**Files:**

- Move: `workbench/targets/*/outputs/*.html` → `sources/automations/商业航天每日跟踪/`、`sources/automations/支柱产业/` 或 `sources/automations/temp/`
- Move: `workbench/targets/600703-三安光电/outputs/2026-07-20-1005-三安光电-机构级决策研报-原始副本.md` → `sources/automations/temp/`
- Create: `sources/automations/temp/README.md`

- [ ] **Step 1：做目标文件冲突预检**

先建立 26 项“源路径 → 目标路径”显式映射，逐项检查源文件存在、目标文件不存在；任一冲突立即停止，不覆盖文件。

商业航天目录接收以下 18 个标的的 HTML：

```text
002025 航天电器       002151 北斗星通       002405 四维图新
300136 信维通信       300593 新雷能         300627 华测导航
300672 国科微         300762 上海瀚讯       600118 中国卫星
600435 北方导航       600879 航天电子       601698 中国卫通
688333 铂力特         688375 国博电子       688521 芯原股份
688523 航天环宇       688568 中科星图       688818 电科蓝天
```

支柱产业目录接收 5 份 HTML：

```text
2026-07-18-中国船舶资金面分层分析.html
2026-07-18-中国中车机构级决策研报.html
2026-07-18-中国中车资金面分层分析.html
2026-07-18-神马电力机构级决策研报.html
2026-07-18-神马电力资金面分层分析.html
```

`temp/` 接收 2 份 HTML 和 1 份重复 Markdown：

```text
2026-07-17-1133-中国船舶机构级决策研报.html
2026-07-20-1005-三安光电-机构级决策研报.html
2026-07-20-1005-三安光电-机构级决策研报-原始副本.md
```

- [ ] **Step 2：按显式映射执行 `git mv`**

不要使用模糊分类规则；每个源文件只能迁移一次。迁移后验证：商业航天 18 份、支柱产业 5 份、temp 新增 3 份。

- [ ] **Step 3：新增 temp 说明**

`sources/automations/temp/README.md` 应明确：

```markdown
# 未分类标的产物

本目录保存暂时无法归入现有产业自动化目录的标的产物，包括历史 HTML、重复导出或待分类文件。

- 这里不是权威个股研报目录；权威 Markdown 研报统一放在 `workbench/targets/`。
- 文件完成产业归类后，应迁移到对应的 `sources/automations/<分类>/`。
```

- [ ] **Step 4：验证并提交**

Run:

```powershell
$html = Get-ChildItem -LiteralPath 'workbench' -Recurse -File -Filter '*.html'
if ($html.Count -ne 0) { throw "Workbench still contains HTML: $($html.Count)" }
Test-Path -LiteralPath 'sources/automations/temp/README.md'
```

Expected: HTML 数量为 0，README 返回 `True`。

```powershell
git add -- workbench/targets sources/automations
git diff --cached --check
git commit -m "refactor: restore generated artifacts to automation sources"
```

## Task 3：把 29 份权威 Markdown 研报迁到 targets 根层

**Files:**

- Move: `workbench/targets/*/reports/*.md` → `workbench/targets/*.md`

- [ ] **Step 1：保存迁移前正文哈希并检查重名**

```powershell
$reports = @(Get-ChildItem -LiteralPath 'workbench/targets' -Recurse -File -Filter '*.md' | Where-Object { $_.Directory.Name -eq 'reports' })
if ($reports.Count -ne 29) { throw "Expected 29 reports, got $($reports.Count)" }
$duplicates = $reports | Group-Object Name | Where-Object Count -gt 1
if ($duplicates) { throw "Duplicate report filenames detected" }
$hashFile = 'C:\tmp\llmwiki-flat-report-hashes.json'
$before = @{}
foreach ($report in $reports) { $before[$report.Name] = (Get-FileHash -LiteralPath $report.FullName -Algorithm SHA256).Hash }
$before | ConvertTo-Json | Set-Content -LiteralPath $hashFile -Encoding UTF8
```

- [ ] **Step 2：逐份执行 `git mv`**

目标统一为：

```text
workbench/targets/<原文件名>.md
```

迁移前逐项确认目标不存在；不得覆盖已有文件。

- [ ] **Step 3：验证数量和正文不变**

```powershell
$hashFile = 'C:\tmp\llmwiki-flat-report-hashes.json'
$before = Get-Content -LiteralPath $hashFile -Encoding UTF8 | ConvertFrom-Json
$afterReports = @(Get-ChildItem -LiteralPath 'workbench/targets' -File -Filter '*.md')
if ($afterReports.Count -ne 29) { throw "Expected 29 flat reports, got $($afterReports.Count)" }
foreach ($report in $afterReports) {
  $hash = (Get-FileHash -LiteralPath $report.FullName -Algorithm SHA256).Hash
  if ($hash -ne $before.($report.Name)) { throw "Content changed: $($report.Name)" }
}
Remove-Item -LiteralPath $hashFile
```

Expected: 29 份，全部哈希一致。

- [ ] **Step 4：提交纯路径迁移**

```powershell
git add -- workbench/targets
git diff --cached --check
git commit -m "refactor: flatten workbench equity reports"
```

## Task 4：删除 30 个单标的索引与空目录

**Files:**

- Delete: `workbench/targets/*/index.md`（30 份）
- Delete: `workbench/templates/target-index-template.md`

- [ ] **Step 1：确认剩余目录内容仅为 index**

```powershell
$dirs = @(Get-ChildItem -LiteralPath 'workbench/targets' -Directory)
if ($dirs.Count -ne 30) { throw "Expected 30 target directories, got $($dirs.Count)" }
foreach ($dir in $dirs) {
  $remaining = @(Get-ChildItem -LiteralPath $dir.FullName -Recurse -File)
  if ($remaining.Count -ne 1 -or $remaining[0].Name -ne 'index.md') {
    throw "Unexpected remaining content: $($dir.FullName)"
  }
}
```

- [ ] **Step 2：删除精确索引文件和已失效模板**

只删除上述预检得到的 30 个 `index.md`，并删除不再适用的 `workbench/templates/target-index-template.md`。Git 不跟踪空目录，删除文件后标的目录自然消失。

- [ ] **Step 3：验证 targets 不含目录**

```powershell
$dirs = @(Get-ChildItem -LiteralPath 'workbench/targets' -Directory)
if ($dirs.Count -ne 0) { throw "Nested target directories remain" }
```

- [ ] **Step 4：提交**

```powershell
git add -- workbench/targets workbench/templates/target-index-template.md
git diff --cached --check
git commit -m "refactor: remove per-target indexes"
```

## Task 5：重建 Workbench 直接导航

**Files:**

- Modify: `workbench/index.md`

- [ ] **Step 1：把 29 个标的索引链接改为研报直链**

每一项使用实际文件名，例如：

```markdown
- [[workbench/targets/2026-07-15-1921-云铝股份机构级决策研报|000807 云铝股份]]
```

按证券代码升序列出；链接目标省略 `.md`，显示文本保留“证券代码 公司简称”。

- [ ] **Step 2：保留航天电子的 HTML 入口**

```markdown
- [[sources/automations/商业航天每日跟踪/2026-07-17-航天电子机构级决策研报.html|600879 航天电子]]：仅有历史 HTML，Markdown 待补。
```

- [ ] **Step 3：更新使用规则**

改为：权威研报与跟踪节点直接放在 `workbench/targets/`，用 `artifact_type` 区分；不再提 `reports/` 或 `tracking/` 子目录。

- [ ] **Step 4：检查全部链接目标并提交**

使用脚本解析 `[[path|label]]`，对 30 个条目的 path 加 `.md`（Markdown 链接）或直接按 `.html` 检查存在性。Expected: 30/30 可解析。

```powershell
git add -- workbench/index.md
git diff --cached --check
git commit -m "docs: link workbench reports directly"
```

## Task 6：统一 Workbench、模板和研报技能合同

**Files:**

- Modify: `workbench/AGENTS.md`
- Modify: `workbench/templates/equity-report-template.md`
- Modify: `workbench/templates/tracking-node-template.md`
- Modify: `.agents/skills/bbxm-equity-research/SKILL.md`
- Modify: `.agents/skills/bbxm-equity-research/agents/openai.yaml`
- Modify: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1：更新 Workbench 规则**

删除“一个标的一套目录”的规定，替换为：

```text
workbench/targets/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md
workbench/targets/YYYY-MM-DD-<标的>-<事件>-跟踪.md
```

明确 `targets/` 禁止创建标的子目录；HTML 与自动化展示工件回到 `sources/automations/`。

- [ ] **Step 2：更新两个模板**

- 研报模板目标路径改为扁平路径；
- 跟踪节点模板目标路径改为扁平路径；
- 保留既有 frontmatter 字段和正文结构，不做无关重写。

- [ ] **Step 3：更新 bbxm-equity-research 输出合同**

技能正文和 `agents/openai.yaml` 都必须明确扁平落盘路径，移除“创建/更新标的 index、reports 子目录”的要求。

- [ ] **Step 4：更新项目技能验证标记**

在 `tests/validate_bbxm_project_skills.py` 中，把旧 marker：

```text
workbench/targets/<证券代码>-<公司简称>/reports/
```

替换为：

```text
workbench/targets/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md
```

- [ ] **Step 5：运行定向验证**

```powershell
python tests/validate_workbench_boundary.py
python tests/validate_bbxm_project_skills.py
```

Expected:

- 边界测试此时可能仍因 Task 7 的旧有效链接失败，除此之外结构/合同断言应通过；
- 项目技能测试若只报既有 `bbxm-industry-analysis is missing contract marker: 完整读取当前版本`，记录为已知非本任务失败；不得把它写成“全通过”。若出现 `bbxm-equity-research` 新失败，必须修复后再提交。

- [ ] **Step 6：提交**

```powershell
git add -- workbench/AGENTS.md workbench/templates .agents/skills/bbxm-equity-research tests/validate_bbxm_project_skills.py
git diff --cached --check
git commit -m "docs: adopt flat equity research output contract"
```

## Task 7：修复当前有效双链

**Files:**

- Modify: `hot.md`
- Modify: `wiki/timelines/cjw-电网设备-变压器.md`
- Modify: `wiki/queries/2026-07-16-神马电力文章逻辑下的华明装备对比分析.md`
- Modify: any additional active file found by the scan below

- [ ] **Step 1：扫描当前有效内容中的旧路径**

```powershell
rg -n 'workbench/targets/[^]]+/(reports|index|outputs)/|targets/<证券代码>-<公司简称>/reports' `
  AGENTS.md schema.md page-types.md index.md hot.md wiki workbench .agents tests `
  --glob '*.md' --glob '*.py' --glob '*.yaml'
```

Expected before repair: 至少命中华明装备的 `hot.md`、timeline、query 引用；不得用历史 `log.md` 或旧 `docs/superpowers/plans/` 的命中作为当前合同失败。

- [ ] **Step 2：把华明装备链接改为扁平路径**

统一替换为：

```markdown
[[workbench/targets/2026-07-15-1514-华明装备机构级决策研报|华明装备机构级决策研报]]
```

只改链接目标，保留原文判断和显示文本。

- [ ] **Step 3：修复扫描出的其他当前链接**

HTML 链接改到对应的 `sources/automations/` 目录；Markdown 研报链接改到 `workbench/targets/<文件名>`。

- [ ] **Step 4：重新扫描并提交**

Expected: 上述限定目录扫描 0 命中。

```powershell
git add -- hot.md wiki workbench .agents tests
git diff --cached --check
git commit -m "docs: repair links after workbench flattening"
```

## Task 8：记录维护日志并完成最终验收

**Files:**

- Modify: `log.md`

- [ ] **Step 1：追加 2026-07-20 维护日志**

记录：

- 29 份 Markdown 扁平迁移；
- 25 份 HTML 按商业航天、支柱产业、temp 恢复；
- 1 份三安光电重复 Markdown 回到 temp；
- 删除 30 个标的索引和失效模板；
- 更新 Workbench、技能、模板、测试、索引与双链；
- 航天电子 Markdown 待补；
- `bbxm-industry-analysis` 已知无关测试失败未处理。

- [ ] **Step 2：运行结构和数量检查**

```powershell
$targetDirs = @(Get-ChildItem -LiteralPath 'workbench/targets' -Directory)
$reports = @(Get-ChildItem -LiteralPath 'workbench/targets' -File -Filter '*.md')
$workbenchHtml = @(Get-ChildItem -LiteralPath 'workbench' -Recurse -File -Filter '*.html')
if ($targetDirs.Count -ne 0) { throw "Nested target directories remain" }
if ($reports.Count -ne 29) { throw "Expected 29 reports, got $($reports.Count)" }
if ($workbenchHtml.Count -ne 0) { throw "HTML remains in Workbench" }
```

- [ ] **Step 3：运行自动化验证**

```powershell
python tests/validate_workbench_boundary.py
node .agents/skills/bbxm-equity-research/scripts/test-render-report-html.cjs
python tests/validate_bbxm_project_skills.py
```

Expected:

- `validate_workbench_boundary.py` PASS；
- HTML 渲染测试通过；
- 项目技能测试只允许保留已知的 `bbxm-industry-analysis` marker 失败；任何与 `bbxm-equity-research` 有关的失败都必须修复。

- [ ] **Step 4：运行链接、编码和差异检查**

```powershell
rg -n 'workbench/targets/[^]]+/(reports|index|outputs)/|targets/<证券代码>-<公司简称>/reports' `
  AGENTS.md schema.md page-types.md index.md hot.md wiki workbench .agents tests `
  --glob '*.md' --glob '*.py' --glob '*.yaml'
rg -n '<<<<<<<|=======|>>>>>>>' --glob '*.md' --glob '*.py' --glob '*.yaml' .
rg -n '�|鍐|鐭|鎯|灏' workbench sources/automations/temp sources/automations/支柱产业
git diff --check
git status --short
```

Expected:

- 旧有效路径、冲突标记、典型乱码均 0 命中；
- `git diff --check` 无输出；
- `git status --short` 仅有本任务尚未提交的 `log.md`。

- [ ] **Step 5：提交日志**

```powershell
git add -- log.md
git diff --cached --check
git commit -m "docs: log flat workbench migration"
```

- [ ] **Step 6：检查最终提交范围**

```powershell
git status --short
git log --oneline -10
```

Expected: 工作区干净；最近提交只包含本计划列出的迁移、合同、导航、链接和日志变更。完成后再按用户指示决定是否推送或合并，不自动扩大 Git 操作范围。
