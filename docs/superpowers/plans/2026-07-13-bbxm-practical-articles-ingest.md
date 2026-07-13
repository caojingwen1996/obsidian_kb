# 冰冰小美“实战操作”219—250 篇批量整理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将第 219—250 篇共 32 篇“套利机会与风险提示”原始文章蒸馏进现有 llmwiki，并形成完整的来源到正式页面覆盖记录。

**Architecture:** 按四个主题批次执行，每批先从原文抽取稳定断言，再优先合并进现有 Topic、Concept、View 或 Reasoning 页面。每批独立维护来源、frontmatter、双链、manifest、hot 和日志，并在最终批次统一验证覆盖、乱码和结构一致性。

**Tech Stack:** Markdown、Obsidian wikilinks、PowerShell、Git、JSON manifest。

---

## 文件结构与职责

- Modify: `wiki/topics/冰冰小美-情绪体系操作篇.md`：承载 32 篇的主题地图、阶段关系和来源入口。
- Modify: `wiki/concepts/冰冰小美-framework-复盘.md`：承载复盘顺序、亏钱效应、情绪传导、龙虎榜使用边界。
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之流动性辩证分析.md`：承载中军扩散、增量承接、套利分流和流动性撤退。
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之情绪位置的变化.md`：承载转势、共振、一致、高潮和退潮位置。
- Modify: `wiki/views/冰冰小美对假象与反人性套利的看法.md`：承载套利表象与反人性陷阱。
- Modify: `wiki/views/冰冰小美对套利与权谋反噬的看法.md`：承载套利手法、出货与反噬边界。
- Modify: `wiki/views/冰冰小美对套利分散流动性合力的看法.md`：承载套利扩散、轮动和合力分散。
- Modify: `wiki/views/冰冰小美对频繁轮动制造亏钱效应的看法.md`：承载频繁切换和亏钱效应。
- Modify: `.manifest.json`：记录 32 篇来源的哈希、时间与页面映射。
- Modify: `hot.md`：记录每批新增的体系认识。
- Modify: `log.md`：记录四批 ingest 与最终验证。
- Modify conditionally: `index.md`：只在确有新页面或导航变化时修改。
- Create conditionally: `wiki/concepts/冰冰小美-短线交易风控.md`：仅当 247—250 的稳定风控结构无法被既有交易策略或风险控制页面完整承载时创建。
- Create: `wiki/queries/冰冰小美-实战操作219至250整理覆盖.md`：记录每篇来源进入哪张正式页面、主要知识点及未决问题。

### Task 1: 建立批次基线与来源清单

**Files:**
- Read: `sources/manual/体系及案例分析/三、实战操作/1、套利机会与风险提示/219_短线的一种长青模式.md`
- Read through: `sources/manual/体系及案例分析/三、实战操作/1、套利机会与风险提示/250_四类短线投机股的亏钱逻辑与应对策略.md`
- Read: `.manifest.json`
- Create: `wiki/queries/冰冰小美-实战操作219至250整理覆盖.md`

- [ ] **Step 1: 枚举并验证 32 篇来源**

Run:

```powershell
$files = Get-ChildItem -LiteralPath 'sources/manual/体系及案例分析/三、实战操作/1、套利机会与风险提示' -File | Sort-Object Name
$files.Count
$files.Name
```

Expected: 数量为 `32`，编号连续覆盖 `219` 至 `250`。

- [ ] **Step 2: 检查 manifest 的已有 ingest 状态**

Run:

```powershell
Select-String -LiteralPath '.manifest.json' -Pattern '219_短线的一种长青模式|250_四类短线投机股的亏钱逻辑' -Encoding UTF8
```

Expected: 明确两端来源是否已有条目；即使已有条目，也按内容哈希决定是否重整。

- [ ] **Step 3: 创建覆盖 Query Page 骨架**

页面必须使用 `type: query`，包含 `summary`、`sources`、`related`、`original_question`、`answer_status`、`provenance`，正文建立 219—250 的 32 行表格，列为“编号 / 来源 / 核心问题 / 正式页面 / 状态”。初始状态统一写为“待整理”，不得提前填写结论。

- [ ] **Step 4: 验证 Query Page 结构**

Run:

```powershell
rg -n '^(title|type|summary|sources|related|original_question|answer_status|provenance):|\| 219 |\| 250 ' 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md'
```

Expected: frontmatter 字段齐全，表格包含 219 和 250 两端编号。

- [ ] **Step 5: 提交基线**

```powershell
git add -- 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md'
git commit -m 'docs: track practical articles ingest coverage'
```

### Task 2: 整理第一批 219—227

**Files:**
- Modify: `wiki/topics/冰冰小美-情绪体系操作篇.md`
- Modify: `wiki/concepts/冰冰小美-framework-复盘.md`
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之流动性辩证分析.md`
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之情绪位置的变化.md`
- Modify: `wiki/queries/冰冰小美-实战操作219至250整理覆盖.md`
- Modify: `.manifest.json`
- Modify: `hot.md`
- Modify: `log.md`

- [ ] **Step 1: 阅读 219—227 并逐篇抽取**

每篇记录：原文明确断言、跨文归纳、案例边界、可执行动作、目标正式页面。重点抽取中军扩散、空翻多、杂毛套利窗口、转势板与指数共振、复盘无效性、全面大涨复盘、龙虎榜和情绪传导。

- [ ] **Step 2: 合并稳定知识**

在 Topic Page 增加“套利机会与风险提示”系列导航；在复盘页补充“先判断环境、再看榜单”和龙虎榜仅作为行为证据的边界；在流动性页补充中军向短线扩散的成立条件；在情绪位置页补充转势与指数共振。跨文归纳句尾标 `^[inferred]`。

- [ ] **Step 3: 更新 219—227 覆盖表**

每行写入核心问题、实际更新的正式页面和“已整理”；不得只写 Topic Page，至少指出承载主要知识的 Concept 或 View Page。

- [ ] **Step 4: 更新 manifest、hot 和日志**

为 9 篇来源写入 SHA-256、文件大小、修改时间、`pages_updated`；`hot.md` 记录“中军增量流动性向短线扩散及复盘证据边界”；`log.md` 追加一条 `INGEST` 记录。

- [ ] **Step 5: 验证第一批**

Run:

```powershell
rg -n '219_|220_|221_|222_|223_|224_|225_|226_|227_' 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md'
Get-Content -LiteralPath '.manifest.json' -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
```

Expected: 9 篇均为已整理，manifest 可解析。

- [ ] **Step 6: 提交第一批**

只暂存本任务实际修改文件，提交信息：

```powershell
git commit -m 'docs: ingest practical articles 219 to 227'
```

### Task 3: 整理第二批 228—240

**Files:**
- Modify: `wiki/topics/冰冰小美-情绪体系操作篇.md`
- Modify: `wiki/concepts/冰冰小美-framework-复盘.md`
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之流动性辩证分析.md`
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之情绪位置的变化.md`
- Modify: `wiki/views/冰冰小美对假象与反人性套利的看法.md`
- Modify: `wiki/views/冰冰小美对套利与权谋反噬的看法.md`
- Modify: `wiki/views/冰冰小美对套利分散流动性合力的看法.md`
- Modify: `wiki/views/冰冰小美对频繁轮动制造亏钱效应的看法.md`
- Modify: `wiki/queries/冰冰小美-实战操作219至250整理覆盖.md`
- Modify: `.manifest.json`
- Modify: `hot.md`
- Modify: `log.md`

- [ ] **Step 1: 阅读 228—240 并逐篇抽取**

重点识别退潮套利、围魏救赵、砸盘本质、套利意义、上塘路案例、套利时机与切换、情绪一致、频繁轮动、低吸潜伏风险、胜兵先胜、龙头战法回归、溢价持续性和熊市抄底误区。

- [ ] **Step 2: 合并进四张已有套利观点页**

按作者观点边界分别写入：假象与反人性、权谋反噬、流动性合力分散、频繁轮动亏钱效应。案例人物和席位只作为当时行为样本，不上升为永久标签。

- [ ] **Step 3: 补充概念页的机制链**

在流动性页补充“套利扩散过度 → 合力分散 → 溢价下降”；在情绪位置页补充“高潮一致 → 接力收益收缩 → 退潮风险”；在复盘页补充低吸潜伏和熊市抄底的反面样本检查。

- [ ] **Step 4: 更新 228—240 覆盖表及特殊文件**

13 篇逐篇标记正式页面；manifest 写哈希和页面映射；hot 记录“套利从机会退化为流动性陷阱的条件”；log 追加批次记录。

- [ ] **Step 5: 验证第二批**

Run:

```powershell
rg -n '228_|229_|230_|231_|232_|233_|234_|235_|236_|237_|238_|239_|240_' 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md'
Get-Content -LiteralPath '.manifest.json' -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
```

Expected: 13 篇均完成路由，manifest 可解析。

- [ ] **Step 6: 提交第二批**

```powershell
git commit -m 'docs: ingest practical articles 228 to 240'
```

### Task 4: 整理第三批 241—246

**Files:**
- Modify: `wiki/topics/冰冰小美-情绪体系操作篇.md`
- Modify: `wiki/concepts/冰冰小美-framework-复盘.md`
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之流动性辩证分析.md`
- Modify: `wiki/concepts/冰冰小美-concept-体系三要素之情绪位置的变化.md`
- Modify: `wiki/views/冰冰小美对假象与反人性套利的看法.md`
- Modify: `wiki/views/冰冰小美对套利分散流动性合力的看法.md`
- Modify: `wiki/queries/冰冰小美-实战操作219至250整理覆盖.md`
- Modify: `.manifest.json`
- Modify: `hot.md`
- Modify: `log.md`

- [ ] **Step 1: 阅读 241—246 并还原案例语境**

区分永达股份、亚世光电、双主线、高潮节点和龙虎榜案例中的事实、作者观点与整理者归纳；不得用历史案例直接推出当前买卖结论。

- [ ] **Step 2: 蒸馏破局条件与失效条件**

在情绪位置页写入破局需要的风险停止、标杆确认、指数或主线共振；在流动性页写入双主线能否共存取决于增量承接；在复盘页写入龙虎榜必须回到人性、成本、卖出意愿和次日反馈。

- [ ] **Step 3: 更新 241—246 覆盖表及特殊文件**

6 篇逐篇记录主要页面；manifest 写入哈希；hot 记录“情绪破局不是形态复制，而是风险停止与流动性共振”；log 追加批次记录。

- [ ] **Step 4: 验证第三批**

Run:

```powershell
rg -n '241_|242_|243_|244_|245_|246_' 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md'
```

Expected: 6 篇均有正式页面和已整理状态。

- [ ] **Step 5: 提交第三批**

```powershell
git commit -m 'docs: ingest practical articles 241 to 246'
```

### Task 5: 整理第四批 247—250

**Files:**
- Modify: `wiki/topics/冰冰小美-情绪体系操作篇.md`
- Modify: `wiki/concepts/冰冰小美-framework-复盘.md`
- Modify conditionally: `wiki/concepts/冰冰小美-短线交易风控.md`
- Modify: `wiki/queries/冰冰小美-实战操作219至250整理覆盖.md`
- Modify conditionally: `index.md`
- Modify: `.manifest.json`
- Modify: `hot.md`
- Modify: `log.md`

- [ ] **Step 1: 阅读 247—250 并抽取风控层次**

分别提取交易者边界、2025 总体风控、交易工具带来的制度与杠杆风险、四类投机股的亏钱机制和应对动作。

- [ ] **Step 2: 决定是否创建短线交易风控概念页**

若现有页面无法同时承载“市场环境 / 标的类型 / 工具风险 / 仓位动作 / 退出规则”五层结构，则按 Concept 模板创建 `wiki/concepts/冰冰小美-短线交易风控.md`；否则把内容合并进现有交易策略和复盘页面，不创建新页。

- [ ] **Step 3: 更新 247—250 覆盖表与特殊文件**

4 篇逐篇标记主要页面；如创建新页则更新 `index.md`；manifest 写入哈希；hot 记录“短线风控从行情判断延伸到标的、工具、仓位与退出”；log 追加批次记录。

- [ ] **Step 4: 验证第四批**

Run:

```powershell
rg -n '247_|248_|249_|250_' 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md'
```

Expected: 4 篇均有正式页面和已整理状态。

- [ ] **Step 5: 提交第四批**

```powershell
git commit -m 'docs: ingest practical articles 247 to 250'
```

### Task 6: 全量质量验证与收口

**Files:**
- Modify: `wiki/queries/冰冰小美-实战操作219至250整理覆盖.md`
- Modify: `hot.md`
- Modify: `log.md`

- [ ] **Step 1: 验证 32 篇覆盖完整**

Run:

```powershell
$text = Get-Content -LiteralPath 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md' -Raw -Encoding UTF8
219..250 | ForEach-Object { if ($text -notmatch "\|\s*$_\s*\|") { "MISSING $_" } }
```

Expected: 无 `MISSING` 输出。

- [ ] **Step 2: 验证 manifest 与 frontmatter**

Run:

```powershell
Get-Content -LiteralPath '.manifest.json' -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
rg -L '^summary:' 'wiki/topics/冰冰小美-情绪体系操作篇.md' 'wiki/concepts/冰冰小美-framework-复盘.md' 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md'
```

Expected: JSON 可解析；`rg -L` 无输出。

- [ ] **Step 3: 检查乱码与差异范围**

Run:

```powershell
git diff --check
rg -n '鍐|鐭|鎯|灏|�' 'wiki/topics/冰冰小美-情绪体系操作篇.md' 'wiki/concepts/冰冰小美-framework-复盘.md' 'wiki/queries/冰冰小美-实战操作219至250整理覆盖.md' 'hot.md' 'log.md'
git status --short
```

Expected: 无 diff 格式错误；无典型乱码命中；状态列表中只将本任务文件纳入提交，其他用户修改保持未暂存。

- [ ] **Step 4: 检查来源与动作语言**

逐页确认新增断言有具体来源，历史案例保留日期语境，跨文归纳带 `^[inferred]`，操作结论明确使用买入、卖出、减仓、等待、观察、复盘或回避。

- [ ] **Step 5: 写最终日志并提交收口**

在 `log.md` 记录覆盖 32/32、修改页面、新建页面、不确定性和后续待办；在覆盖页把 `answer_status` 更新为 `complete`。

```powershell
git commit -m 'docs: complete practical articles ingest'
```

- [ ] **Step 6: 最终报告**

报告四批覆盖、主要更新页面、新建页面、QMD 刷新状态、未验证案例和工作区中未触碰的既有修改。
