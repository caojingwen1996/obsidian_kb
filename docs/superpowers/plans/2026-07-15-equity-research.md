# Equity Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable `equity-research` child skill to the local `bbxm-expert` plugin for source-auditable, valuation-driven, decision-ready company research.

**Architecture:** Keep the plugin router lean and add one focused skill directory. `SKILL.md` owns triggering and execution discipline; `template.md` owns the report schema; a Python validator guards routing, required sections, UTF-8 text, and preservation of neighboring routes.

**Tech Stack:** Markdown Agent Skills, Codex plugin manifest conventions, Python validation, Obsidian/llmwiki output rules.

---

### Task 1: Add a failing contract validator

**Files:**
- Create: `myplugins/bbxm-expert/tests/validate_equity_research.py`

- [ ] **Step 1: Write the failing validator**

The validator must assert that:

```python
require(SKILL_PATH.is_file(), "equity-research SKILL.md is missing")
require(TEMPLATE_PATH.is_file(), "equity-research template.md is missing")
for route in (
    "`equity-research`",
    "`information-filter-flow`",
    "`risk-identification`",
    "`trade-ticket-review`",
):
    require_contains(router, route, "router")
```

It must also check the skill and template for the required phrases `我的判断`, `未获取到`, `DCF`, `敏感性分析`, `行业特定估值`, `如果今天这是一笔现金`, `buy / sell / reduce / wait / observe / review`, and the timestamped Markdown filename rule.

- [ ] **Step 2: Run the validator and verify RED**

Run:

```powershell
python .\myplugins\bbxm-expert\tests\validate_equity_research.py
```

Expected: exit code `1` with `equity-research SKILL.md is missing` because the new skill does not exist.

### Task 2: Create the minimal skill and report template

**Files:**
- Create: `myplugins/bbxm-expert/skills/equity-research/SKILL.md`
- Create: `myplugins/bbxm-expert/skills/equity-research/template.md`
- Create: `myplugins/bbxm-expert/skills/equity-research/agents/openai.yaml`

- [ ] **Step 1: Add valid skill metadata**

Use:

```yaml
---
name: equity-research
description: Use when the user asks for institutional-grade equity research, company deep dives, fair value, DCF, target prices, valuation ranges, or a decision on whether a listed stock is worth buying.
---
```

- [ ] **Step 2: Add the research workflow**

The workflow must enforce security identity resolution, market-specific statutory filings, source hierarchy, fact/judgment separation, missing-data language, conflicting-source reconciliation, five-year history, latest quarter, catalysts, sell-side expectations, three valuation methods, reverse valuation, BBXM risk mapping, and timestamped Markdown output.

- [ ] **Step 3: Add the report template**

The template must contain the complete numbered report structure defined in `docs/superpowers/specs/2026-07-15-equity-research-design.md`, including explicit fields for valuation status, action, valuation range, upside/downside, cash decision, invalidation conditions, and 3–5 monitoring indicators.

- [ ] **Step 4: Add Codex UI metadata**

Use:

```yaml
interface:
  display_name: "机构级个股研究"
  short_description: "生成带估值、证据审计和交易结论的机构级个股研报"
  default_prompt: "Use $equity-research to research this listed company and produce a decision-ready Markdown report."
policy:
  allow_implicit_invocation: true
```

### Task 3: Route institutional company research from the plugin entrypoint

**Files:**
- Modify: `myplugins/bbxm-expert/skills/bbxm-expert/SKILL.md`

- [ ] **Step 1: Extend entrypoint trigger metadata**

Add company research, institutional research report, valuation, fair value, DCF, target price, and whether-to-buy wording to the description without removing existing triggers.

- [ ] **Step 2: Add `equity-research` to the route table**

Route complete company-research requests to `equity-research`, while preserving these precedence rules:

```text
单条信息如何处理 → information-filter-flow
交易记录或仓位行为复盘 → trade-ticket-review
纯风险状态或买入窗口识别 → risk-identification
完整公司研究、估值与现金决策 → equity-research
```

- [ ] **Step 3: Add composition rules**

When a full report includes risk-state language, `equity-research` remains the main route and may invoke `risk-identification`; when the user only asks whether one item of news matters, information filtering remains primary.

### Task 4: Verify and refactor

**Files:**
- Modify if required: `myplugins/bbxm-expert/tests/validate_equity_research.py`
- Modify if required: files created or changed in Tasks 2–3

- [ ] **Step 1: Run the validator and verify GREEN**

Run:

```powershell
python .\myplugins\bbxm-expert\tests\validate_equity_research.py
```

Expected: exit code `0` and `PASS: equity-research skill contract validated`.

- [ ] **Step 2: Validate YAML, JSON and encoding**

Parse both SKILL frontmatter blocks, parse the plugin JSON manifests, and scan changed Markdown/YAML files for replacement characters and common Chinese mojibake markers.

- [ ] **Step 3: Check the diff**

Run:

```powershell
git diff --check -- docs/superpowers myplugins/bbxm-expert
git status --short -- docs/superpowers myplugins/bbxm-expert
```

Expected: no whitespace errors; only the approved design, plan, skill, template, UI metadata, validator, and router are changed.

- [ ] **Step 4: Do not commit automatically**

Leave changes unstaged because the user requested creation and verification, not a Git commit.
