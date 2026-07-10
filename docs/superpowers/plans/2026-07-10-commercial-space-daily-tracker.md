# Commercial Space Daily Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a daily 09:45 Beijing-time commercial-space automation that writes a source-grounded daily report and maintains a deduplicated rolling industry-progress dashboard.

**Architecture:** Keep the complete research contract in one repo-local prompt file and keep the Codex automation prompt short, so scheduling configuration cannot drift from project rules. The automation writes only to `sources/automations/商业航天每日跟踪/` plus a maintenance-log entry; formal wiki pages remain human-reviewed promotion targets.

**Tech Stack:** Markdown, Codex desktop cron automations, PowerShell verification, web research using primary or authoritative sources.

---

## File map

- Create `.agents/automations/commercial_space_daily_brief.md`: authoritative retrieval, evidence, analysis, deduplication, and output contract.
- Create `sources/automations/商业航天每日跟踪/YYYY-MM-DD.md`: one daily evidence report per target date.
- Create `sources/automations/商业航天每日跟踪/产业进度看板.md`: rolling slow-variable baseline and delta table.
- Modify `log.md`: append one automation-creation record and one first-run record without rewriting existing entries.
- External state: create Codex automation `商业航天产业每日跟踪` at 09:45 Asia/Shanghai.
- Do not modify `index.md`, `.manifest.json`, or formal pages under `wiki/` during the automated run.

### Task 1: Create the authoritative project prompt

**Files:**
- Create: `.agents/automations/commercial_space_daily_brief.md`
- Reference: `docs/superpowers/specs/2026-07-10-commercial-space-daily-tracker-design.md`
- Reference: `.agents/automations/root_daliy_brief.md`

- [ ] **Step 1: Verify the prompt does not already exist**

Run:

```powershell
Test-Path -LiteralPath '.agents\automations\commercial_space_daily_brief.md'
```

Expected: `False`. If it is `True`, read the existing file and update it in place rather than creating a duplicate.

- [ ] **Step 2: Create the prompt with the fixed contract**

Create `.agents/automations/commercial_space_daily_brief.md` with these required sections and rules:

```markdown
# 商业航天产业每日跟踪任务

## 一、任务目标

按冰冰小美体系三要素中的“竞争格局比较优势”持续跟踪商业航天产业进度。任务只判断产业方向资格、产业进度与相对优势变化，不把单条产业信息直接写成买入信号。

## 二、日期与增量规则

- `{RUN_DATE}` 是自动任务运行日。
- `{DATE}` 是 `{RUN_DATE}` 的前一自然日。
- 检索窗口为 `{DATE} 00:00` 至 `{RUN_DATE} 09:30`，时区为 Asia/Shanghai。
- 先读取 `sources/automations/商业航天每日跟踪/产业进度看板.md` 和已有日期日报。
- 只把相对既有记录的新事实、新数值、新阶段或修正写成当日增量。
- 无法完成有效核验时写“未确认新增”，不得写成“没有新增”。

## 三、四个固定跟踪维度

### 1. 中国星网与卫星组网

跟踪中国星网、卫星互联网国家队星座、千帆等国内大型星座的规划数量、累计入轨、单次发射数量、组网速度、完成比例、执行火箭、发射场、批量造星、频率许可、终端与运营进展。

### 2. 产业规划与投资增速

跟踪国家与地方规划、产业标准、产业基金、IPO、定增、并购、资本开支、实际投资额、项目进度、项目终止、发射场、火箭基地、卫星工厂、测运控及地面基础设施。规划金额、签约金额、计划投资、实际投资和形成产能必须分开。

### 3. 细分领域核心关键技术

跟踪可重复使用火箭、发动机、回收检修复飞、批量造星、星间激光、相控阵、卫星芯片、空间计算、测运控、地面终端、频轨资源、空间安全、关键材料和电子元器件。技术阶段必须使用：方案或规划、地面试验、飞行试验、成功入轨、成功回收、同一产品复飞、批量交付、规模商用。

### 4. 全球竞争份额变化

分别跟踪全球及主要国家发射次数、入轨卫星数量、有效载荷规模、低轨卫星存量与新增量、发射运力、发射服务订单与收入、卫星制造交付量、卫星通信用户与收入、频率轨道和大型星座部署。不得把不同统计口径拼成单一确定份额。

## 四、来源与证据纪律

来源优先级：政府部门及监管披露；国家航天机构、交易所公告和企业正式披露；企业官网与行业协会；权威媒体与具名访谈；券商或咨询报告；社交媒体和市场传言。关键数值必须记录统计日期、口径和原始链接。低等级来源只能作为待核实线索。

四个维度必须分别检索，不能用一次泛新闻搜索代替：

- 中国星网与卫星组网关键词：`中国星网 卫星互联网`、`卫星互联网低轨组网卫星`、`千帆星座`、`国网星座`、`一箭多星`、`卫星累计入轨`、`空间无线电台执照`。优先检查国家航天局、工业和信息化部、中国航天科技集团、发射场及星座运营主体。
- 产业规划与投资增速关键词：`商业航天 行动计划`、`商业航天 标准体系`、`商业航天 产业基金`、`商业航天 投资`、`商业航天 固定资产`、`卫星工厂 扩产`、`火箭基地 建设`、`发射场 建设`、`商业航天 定增 并购 IPO`。优先检查国务院及部委、地方政府、交易所公告、公司公告和投资者关系记录。
- 核心技术关键词：`可重复使用火箭 回收 复飞`、`液氧甲烷 发动机`、`液氧煤油 可复用发动机`、`火箭健康监测`、`批量造星 柔性产线`、`星间激光通信`、`卫星相控阵`、`卫星芯片`、`太空计算`、`测运控 地面终端`。优先检查国家航天局、中国载人航天工程网、航天科技、航天科工、科研院所和企业正式发布。
- 全球竞争份额关键词：`orbital launch statistics`、`payloads launched by country`、`LEO satellites in orbit`、`commercial launch revenue`、`satellite manufacturing deliveries`、`satellite broadband subscribers`、`constellation deployment`、`ITU satellite filings`。优先检查各国航天机构、监管机构、运营商财报、ITU、UNOOSA 和具名统计机构。

每一类如果未确认新增，必须在日报中列出实际检索过的关键词和来源。

## 五、竞争格局评级

- 增强：真实发射、回收复飞、批量交付、订单、资本开支、收入或全球相对份额出现可核验改善。
- 未变：只有旧规划重复传播、一般性表态或没有改变产业变量的消息。
- 减弱：延期失败、项目终止、投资放缓、关键技术受阻、需求不及预期或全球相对位置下降。

## 六、每日输出

写入 `sources/automations/商业航天每日跟踪/{DATE}.md`，包含：一句话结论、四维产业进度表、三至五条重点增量、竞争格局评级、接近订单收入利润的环节、仍处于规划试验概念的环节、后续验证与失效条件、来源覆盖、失败数据源和人工跟进项。

## 七、滚动看板

更新 `sources/automations/商业航天每日跟踪/产业进度看板.md`。每项指标保存当前值或阶段、上次记录、本次变化、数据日期、来源、可信度和待验证边界。只更新发生变化的指标，不用当天新闻覆盖更高等级的历史来源。

## 八、写入边界

自动任务只写入上述 source 目录并在 `log.md` 追加维护记录。不得自动修改 `wiki/`、`index.md` 或 `.manifest.json`。不得覆盖用户已有日报；同日重跑时只补充净新增并刷新结论。

## 九、完成报告

完成后报告目标日期、日报路径、看板路径、四维覆盖情况、竞争格局评级、失败数据源和待人工跟进项。
```

- [ ] **Step 3: Validate required sections and forbidden write targets**

Run:

```powershell
rg -n '中国星网与卫星组网|产业规划与投资增速|细分领域核心关键技术|全球竞争份额变化|产业进度看板|未确认新增|竞争格局评级' '.agents\automations\commercial_space_daily_brief.md'
rg -n '不得自动修改.*wiki|不得自动修改.*index.md|不得自动修改.*manifest' '.agents\automations\commercial_space_daily_brief.md'
```

Expected: every required phrase appears, and the write-boundary rule is present.

- [ ] **Step 4: Check UTF-8 content and mojibake**

Run:

```powershell
Get-Content -Raw -Encoding UTF8 '.agents\automations\commercial_space_daily_brief.md' | Out-Null
rg -n '鍐|鐭|鎯|灏|�' '.agents\automations\commercial_space_daily_brief.md'
```

Expected: the read succeeds and the second command returns no matches.

- [ ] **Step 5: Commit only the prompt**

Run:

```powershell
git add -- '.agents/automations/commercial_space_daily_brief.md'
git diff --cached --check
git commit -m 'feat: add commercial space daily brief contract'
```

Expected: one commit containing only the new prompt file.

### Task 2: Create the 09:45 Codex automation

**Files:**
- Read: `$HOME/.codex/automations/*/automation.toml`
- External state: Codex desktop automation registry

- [ ] **Step 1: Confirm no duplicate automation exists**

Run:

```powershell
rg -n 'name = "商业航天产业每日跟踪"|commercial_space_daily_brief.md' "$HOME\.codex\automations" --glob 'automation.toml'
```

Expected: no result. If a result exists, resolve its id and update it instead of creating a duplicate.

- [ ] **Step 2: Create the automation**

Call the Codex automation update tool in create mode with these exact values:

```text
name: 商业航天产业每日跟踪
kind: cron
status: ACTIVE
rrule: FREQ=DAILY;BYHOUR=9;BYMINUTE=45;BYSECOND=0
projectId: E:\caojingwen\obsidian\llmwiki
executionEnvironment: local
destination: local
model: gpt-5.5
reasoningEffort: high
prompt: |
  请按运行日的前一自然日生成商业航天产业日报。

  先读取项目文件 `.agents/automations/commercial_space_daily_brief.md`，将其作为本任务唯一的检索、证据、分析、增量去重和输出格式来源。

  `{RUN_DATE}` 使用运行当天的北京时间，`{DATE}` 使用前一自然日；检索窗口为 `{DATE} 00:00` 至 `{RUN_DATE} 09:30`。先读取既有产业进度看板和日期日报，只写净新增。

  完成后列出：目标日期、日报路径、产业进度看板路径、四维覆盖情况、竞争格局评级、失败数据源和待人工跟进事项。

  工作区运行在 Windows / PowerShell。所有中文文件按 UTF-8 处理，不得把终端乱码写回文件。
```

Expected: the tool returns a new automation id and active status.

- [ ] **Step 3: View and verify the created automation**

Call the automation tool in view mode using the returned id.

Expected:

```text
name = 商业航天产业每日跟踪
status = ACTIVE
schedule = daily at 09:45
project = E:\caojingwen\obsidian\llmwiki
prompt references .agents/automations/commercial_space_daily_brief.md
```

### Task 3: Perform the first manual validation run

**Files:**
- Create: `sources/automations/商业航天每日跟踪/2026-07-09.md`
- Create: `sources/automations/商业航天每日跟踪/产业进度看板.md`
- Modify: `log.md`

- [ ] **Step 1: Establish the first-run window**

Use:

```text
RUN_DATE = 2026-07-10
DATE = 2026-07-09
window = 2026-07-09 00:00 through 2026-07-10 09:30 Asia/Shanghai
```

If execution occurs after this plan's date and the user wants a current validation instead, use the actual previous natural day and record the substituted dates explicitly.

- [ ] **Step 2: Research all four dimensions**

Search primary and authoritative sources separately for:

```text
中国星网 卫星互联网 组网 发射 累计入轨
千帆星座 组网 卫星 发射
商业航天 规划 标准 产业基金 投资 扩产 项目
可重复使用火箭 回收 复飞 发动机
批量造星 星间激光 相控阵 卫星芯片 太空计算
全球 发射次数 入轨卫星 低轨星座 发射服务 市场份额
```

Record source URL, publication time, statistical date, scope, and whether the item is new inside the target window. Do not use later publications as target-date facts unless clearly labeled as post-window verification.

- [ ] **Step 3: Write the daily report**

Create the target-date Markdown with these headings:

```markdown
# YYYY-MM-DD 商业航天产业进度日报

## 一、一句话结论
## 二、四维产业进度表
## 三、重点增量信息
## 四、竞争格局判断
## 五、订单、收入与利润距离
## 六、后续验证与失效条件
## 七、来源覆盖与失败边界
```

The four-dimensional table must contain one row for each fixed dimension. If there is no verified increment, state `未确认新增` and list searched keywords or sources.

- [ ] **Step 4: Write the rolling dashboard**

Create the dashboard with these headings:

```markdown
# 商业航天产业进度看板

## 使用规则
## 中国星网与卫星组网
## 产业规划与投资增速
## 细分领域核心关键技术
## 全球竞争份额代理指标
## 关键里程碑变更记录
## 数据缺口与待验证项
```

Every metric row must include current value or stage, data date, source, confidence, and next verification condition.

- [ ] **Step 5: Append the first-run log entry**

Append without rewriting existing entries:

```markdown
## YYYY-MM-DD

### 操作类型

automation / source-refresh

### 修改文件

- `sources/automations/商业航天每日跟踪/YYYY-MM-DD.md`
- `sources/automations/商业航天每日跟踪/产业进度看板.md`
- `log.md`

### 操作说明

完成商业航天产业每日跟踪首次验证运行，覆盖中国星网与卫星组网、产业规划与投资增速、细分领域核心关键技术、全球竞争份额代理指标，并保留失败数据源和待验证边界。
```

- [ ] **Step 6: Validate structure, sources, encoding, and scope**

Run:

```powershell
rg -n '^## (中国星网与卫星组网|产业规划与投资增速|细分领域核心关键技术|全球竞争份额代理指标)' 'sources\automations\商业航天每日跟踪\产业进度看板.md'
rg -n '^## (一、一句话结论|二、四维产业进度表|三、重点增量信息|四、竞争格局判断|五、订单、收入与利润距离|六、后续验证与失效条件|七、来源覆盖与失败边界)' 'sources\automations\商业航天每日跟踪\2026-07-09.md'
rg -n '鍐|鐭|鎯|灏|�' '.agents\automations\commercial_space_daily_brief.md' 'sources\automations\商业航天每日跟踪'
git diff --check
```

Expected: all required headings are found, no mojibake is found, and `git diff --check` reports no whitespace errors attributable to this task.

- [ ] **Step 7: Commit only first-run source files if safe**

Run:

```powershell
git add -- 'sources/automations/商业航天每日跟踪/2026-07-09.md' 'sources/automations/商业航天每日跟踪/产业进度看板.md'
git diff --cached --check
git commit -m 'docs: add initial commercial space industry baseline'
```

Do not stage `log.md` if it contains unrelated user changes. Leave its required appended entry unstaged and report that boundary explicitly.

### Task 4: Final verification and handoff

**Files:**
- Read: `.agents/automations/commercial_space_daily_brief.md`
- Read: `sources/automations/商业航天每日跟踪/产业进度看板.md`
- Read: first-run daily report
- Read: created automation configuration

- [ ] **Step 1: Verify repository artifacts**

Run:

```powershell
Test-Path -LiteralPath '.agents\automations\commercial_space_daily_brief.md'
Test-Path -LiteralPath 'sources\automations\商业航天每日跟踪\产业进度看板.md'
Get-ChildItem -LiteralPath 'sources\automations\商业航天每日跟踪' -Filter '*.md' | Select-Object -ExpandProperty Name
```

Expected: all results are present and at least one date-named report exists.

- [ ] **Step 2: Verify the automation one last time**

View the automation by id.

Expected: active, daily, 09:45, local project target, and the short prompt points to the repo-local contract.

- [ ] **Step 3: Inspect task-only git state**

Run:

```powershell
git status --short
git log -3 --oneline
```

Expected: task commits are visible; unrelated pre-existing modifications remain untouched.

- [ ] **Step 4: Report completion**

Report:

```text
Automation name and id
Schedule: daily 09:45 Asia/Shanghai
Project prompt path
Daily output directory
Rolling dashboard path
First validation target date
Four-dimension coverage
Failed sources or manual follow-up items
Files intentionally left unstaged because they contain unrelated user changes
```
