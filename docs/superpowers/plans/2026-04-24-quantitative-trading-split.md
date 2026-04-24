# Quantitative Trading Topic Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the quantitative-methodology content out of `probabilistic-decision-and-risk-control.md` into a new `quantitative-trading.md` topic page without moving high-frequency or automation-risk content.

**Architecture:** Create one new `topic` page focused on quantitative methodology, then narrow the existing probability/risk-control topic back to execution and risk structure. Update the two methodology-heavy `view` pages to point at the new topic, and leave the speed/algorithm `view` attached to the original topic.

**Tech Stack:** Obsidian Markdown, YAML frontmatter, wikilinks, ripgrep, git

---

### Task 1: Create The New Quantitative Trading Topic

**Files:**
- Create: `E:\caojingwen\obsidian\obsidian_kb\topics\quantitative-trading.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md`

- [ ] **Step 1: Confirm the source material and current topic structure**

Run:

```powershell
Get-Content -Path 'E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md'
Get-Content -Path 'E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md'
Get-Content -Path 'E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md'
```

Expected: the current topic contains the quantitative-methodology passages, and the two `view` pages both point at `[[topics/probabilistic-decision-and-risk-control]]`.

- [ ] **Step 2: Create the new topic with frontmatter and scoped body**

Add `E:\caojingwen\obsidian\obsidian_kb\topics\quantitative-trading.md` with content in this shape:

```md
---
title: "量化交易"
aliases: []
created: 2026-04-24
updated: 2026-04-24
type: "topic"
status: active
tags:
  - "strategy/timing"
  - "strategy/review"
  - "function/framework"
sources:
  - "[[raw/articles/2022-07-01-jiyi-chengzai-mid-2247506879-idx-1]]"
  - "[[raw/articles/2026-04-05-jiyi-chengzai-mid-2247532824-idx-1]]"
related:
  - "[[people/bi-shu-xi-feng]]"
  - "[[topics/probabilistic-decision-and-risk-control]]"
  - "[[views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01]]"
  - "[[views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05]]"
summary: "围绕量化思维、分布视角与可计算化表达展开的长期主题，关注如何把市场中的变化、结构、情绪与反馈转成可观察、可比较、可执行的变量，而不是把量化误解成高频系统。"
topic_scope:
  - "分布而非单点"
  - "样本总集与时间曲线"
  - "变化的可计算化表达"
  - "价格与反馈优先"
  - "量化方法的边界"
key_questions:
  - "这里所说的量化，和高频、自动化系统到底有什么区别？"
  - "为什么成熟系统更强调分布、样本总集与时间曲线，而不是单次结果？"
  - "怎样把市场中的结构、变化与情绪翻译成可观察、可比较的变量？"
  - "为什么在交易里要优先读价格与反馈，而不是先找叙事理由？"
related_concepts: []
---
```

Then write sections for:

```md
# 量化交易

## 主题说明

本页中的“量化交易”主要指量化方法论，而不是高频、自动化或纯速度竞争。

## 当前框架

- 量化首先是一种观察与压缩变化的方法
- 它更关心分布、样本总集与时间曲线
- 它强调把结构与情绪翻译成可计算变量
- 在交易里它表现为价格与反馈优先

## 关键观察轴

### 1. 分布而非单点
### 2. 样本总集与时间曲线
### 3. 把变化翻译成数字
### 4. 价格与反馈优先

## 当前边界

- 本页不处理高频是否成立
- 不处理自动化系统的算法优势
- 不处理手续费、摩擦成本与制度失效风险
- 这些内容继续留在 [[topics/probabilistic-decision-and-risk-control]]

## 相关观点

- [[views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01]]
- [[views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05]]

## 当前用途

本页先作为知识库中“量化方法论”的主入口，后续相关 view 优先回挂到这里，再视材料密度决定是否拆 concept。
```

- [ ] **Step 3: Verify the new topic contains the expected anchors**

Run:

```powershell
rg -n "量化交易|分布而非单点|价格与反馈优先|高频|自动化" 'E:\caojingwen\obsidian\obsidian_kb\topics\quantitative-trading.md'
```

Expected: hits for the new title, methodology anchors, and explicit boundary statements.

- [ ] **Step 4: Commit the new topic**

Run:

```powershell
git -C 'E:\caojingwen\obsidian\obsidian_kb' add -- 'topics/quantitative-trading.md'
git -C 'E:\caojingwen\obsidian\obsidian_kb' commit -m "Add quantitative trading topic"
```

Expected: commit succeeds with only the new topic file staged for this task.

### Task 2: Refocus The Probability And Risk-Control Topic

**Files:**
- Modify: `E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md`

- [ ] **Step 1: Find the quantitative passages that should move out**

Run:

```powershell
rg -n "量化|quant|分布|价格|反馈|高频|算法" 'E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md'
```

Expected: locate the sections and related lists that currently make the topic too wide.

- [ ] **Step 2: Narrow the frontmatter and related links**

Edit the frontmatter so the `related:` list keeps:

```md
  - "[[people/bi-shu-xi-feng]]"
  - "[[concepts/expected-value-stop-loss-and-backstop]]"
  - "[[topics/quantitative-trading]]"
  - "[[views/bi-shu-xi-feng-speed-cannot-replace-a-profitable-algorithm-2025-02-26]]"
```

Remove these two methodology views from the frontmatter `related:` list:

```md
  - "[[views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01]]"
  - "[[views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05]]"
```

- [ ] **Step 3: Replace the methodology-heavy section with a short handoff**

In the body, remove the detailed methodology subsection that currently explains:

```md
- 量化不等于高频
- 系统先看样本总集与时间曲线
- 量化是把变化翻译成数字
- 交易里优先读价格与反馈
```

Replace it with a compact handoff block such as:

```md
## 与量化方法的分工

本页现在主要处理投资系统如何活下来并执行下去，包括仓位、止损、退出、风控、复盘与纪律。

与“分布视角、可计算化表达、价格与反馈优先”更直接相关的内容，已独立整理到 [[topics/quantitative-trading]]。

若问题是在问“这里所说的量化到底是什么”，优先看 [[topics/quantitative-trading]]；若问题是在问“系统如何写成能长期执行并承受风险的结构”，继续看本页。
```

- [ ] **Step 4: Keep the speed/algorithm material inside the original topic**

Make sure the topic still references:

```md
- [[views/bi-shu-xi-feng-speed-cannot-replace-a-profitable-algorithm-2025-02-26]]
```

and still frames it as execution/risk content rather than methodology.

- [ ] **Step 5: Verify the old topic is now narrower**

Run:

```powershell
rg -n "quant-thinking|quantification-is-not-high-frequency|topics/quantitative-trading|与量化方法的分工" 'E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md'
```

Expected: the new handoff is present, the new topic link is present, and the two moved views no longer appear in the topic body/frontmatter.

- [ ] **Step 6: Commit the topic refocus**

Run:

```powershell
git -C 'E:\caojingwen\obsidian\obsidian_kb' add -- 'topics/probabilistic-decision-and-risk-control.md'
git -C 'E:\caojingwen\obsidian\obsidian_kb' commit -m "Refocus probability and risk control topic"
```

Expected: commit succeeds with only the updated original topic staged for this task.

### Task 3: Reattach The Methodology Views To The New Topic

**Files:**
- Modify: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md`
- Modify: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md`

- [ ] **Step 1: Update each view frontmatter**

Change `topic_refs:` in both files from:

```md
topic_refs:
  - "[[topics/probabilistic-decision-and-risk-control]]"
```

to:

```md
topic_refs:
  - "[[topics/quantitative-trading]]"
```

Also add the new topic to `related:` if it is not already listed.

- [ ] **Step 2: Update the relationship sections in the body**

In both files, rewrite the “与现有主题的关系” section so it points to the new topic. Use language in this shape:

```md
## 与现有主题的关系

- [[topics/quantitative-trading]] 现在承接这条方法论主线
- 这页提供该 topic 的证据节点
- 若要看仓位、止损、执行与风控结构，再回到 [[topics/probabilistic-decision-and-risk-control]]
```

- [ ] **Step 3: Verify both methodology views now point to the new topic**

Run:

```powershell
rg -n "topics/quantitative-trading|topics/probabilistic-decision-and-risk-control" 'E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md' 'E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md'
```

Expected: `topic_refs` and the relationship section point at `quantitative-trading`, while any mention of the original topic is clearly secondary and execution-oriented.

- [ ] **Step 4: Commit the view-link updates**

Run:

```powershell
git -C 'E:\caojingwen\obsidian\obsidian_kb' add -- 'views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md' 'views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md'
git -C 'E:\caojingwen\obsidian\obsidian_kb' commit -m "Retarget quant methodology views"
```

Expected: commit succeeds with only the two view files staged for this task.

### Task 4: Final Verification

**Files:**
- Verify: `E:\caojingwen\obsidian\obsidian_kb\topics\quantitative-trading.md`
- Verify: `E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md`
- Verify: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md`
- Verify: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md`
- Verify: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-speed-cannot-replace-a-profitable-algorithm-2025-02-26.md`

- [ ] **Step 1: Run link-oriented verification**

Run:

```powershell
rg -n "topics/quantitative-trading" 'E:\caojingwen\obsidian\obsidian_kb\topics' 'E:\caojingwen\obsidian\obsidian_kb\views'
rg -n "quant-thinking-looks-at-distributions-not-single-points|quantification-is-not-high-frequency" 'E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md'
rg -n "speed-cannot-replace-a-profitable-algorithm" 'E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md'
```

Expected:
- the new topic is linked from the original topic and the two methodology views
- the original topic no longer directly carries the two moved methodology views as its own main evidence
- the speed/algorithm view is still linked from the original topic

- [ ] **Step 2: Inspect the final diff**

Run:

```powershell
git -C 'E:\caojingwen\obsidian\obsidian_kb' diff -- 'topics/quantitative-trading.md' 'topics/probabilistic-decision-and-risk-control.md' 'views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md' 'views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md'
```

Expected: only the intended split appears, with no accidental edits to unrelated sections.

- [ ] **Step 3: Stage the final content set**

Run:

```powershell
git -C 'E:\caojingwen\obsidian\obsidian_kb' add -- 'topics/quantitative-trading.md' 'topics/probabilistic-decision-and-risk-control.md' 'views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md' 'views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md'
git -C 'E:\caojingwen\obsidian\obsidian_kb' status --short
```

Expected: only the four intended content files show as staged if the work has not been committed task-by-task already.
