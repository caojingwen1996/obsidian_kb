# BBXM Daily Post Naming and Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the BBXM daily automation save each raw post as `HHMMSS_核心观点.md` and create a paired `HHMMSS_核心观点_解读.md` containing only an Ice Ice Xiaomei framework interpretation.

**Architecture:** Add a self-contained naming and per-post interpretation contract to the existing automation prompt. Extend its completeness gate and close-out report so missing interpretation files are visible and cannot be silently treated as complete.

**Tech Stack:** Markdown automation contract, PowerShell validation, Git diff inspection

---

### Task 1: Add the raw-post naming and paired-interpretation contract

**Files:**
- Modify: `.agents/automations/bbxm_daliy_brief.md`
- Reference: `docs/superpowers/specs/2026-07-15-bbxm-daily-post-naming-and-interpretation-design.md`

- [ ] **Step 1: Insert the naming and interpretation section**

After section `二、抓取与重跑规则`, insert a new section that requires:

````markdown
## 三、原帖命名与逐帖解读

每篇帖子必须生成一组一一对应的 Markdown 文件：

```text
HHMMSS_核心观点.md
HHMMSS_核心观点_解读.md
```
````

The section must also specify actual publication time, full-text core-point synthesis, Windows-safe names, collision suffixes, no overwrites on rerun, and backfilling missing interpretation files.

- [ ] **Step 2: Define the only allowed interpretation structure**

Require exactly this content shape:

```markdown
# HHMMSS 核心观点 解读

## 冰冰小美体系解读

<基于对应帖子全文和必读知识页形成的解读正文>
```

Explicitly forbid additional sections and external web data.

- [ ] **Step 3: Extend the completeness gate**

Add a gate under the analysis-completeness rules stating that any saved post without its paired `_解读.md` file makes `analysis_complete` false and must be listed as unresolved.

- [ ] **Step 4: Extend the close-out report**

Add these required report items:

```text
逐帖解读生成数量
缺失或生成失败的解读文件及原因
```

- [ ] **Step 5: Validate the prompt contract**

Run:

```powershell
rg -n --encoding UTF8 "HHMMSS_核心观点|禁止.*首句|冰冰小美体系解读|逐帖解读生成数量|缺失.*解读" .agents/automations/bbxm_daliy_brief.md
```

Expected: matches prove both filename templates, the no-first-sentence rule, the single interpretation section, and close-out coverage are present.

Run:

```powershell
git diff --check -- .agents/automations/bbxm_daliy_brief.md
git diff -- .agents/automations/bbxm_daliy_brief.md
```

Expected: no whitespace errors; the diff changes only the requested automation contract and preserves all existing risk-analysis and summary requirements.
