# Fund Flow Analysis Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an independent project skill that analyzes capital-flow structure, validates F3/F5/F7 proxies, and maps evidence to conditional trading actions.

**Architecture:** Keep execution rules in `SKILL.md`, the immutable report layout in `template.md`, and detailed funding taxonomy and metric caveats in two focused references. Use JSON eval cases and the project validator to test structure, routing, missing-data behavior, and proxy boundaries.

**Tech Stack:** Markdown skill contracts, YAML metadata, JSON eval cases, Python `quick_validate.py`, Git checks.

---

### Task 1: Establish RED evaluation cases

**Files:**
- Create: `.agents/skills/fund-flow-analysis/evals/evals.json`
- Create: `.agents/skills/fund-flow-analysis-workspace/iteration-1/*/eval_metadata.json`

- [x] Write realistic prompts for market divergence, sector flows, stock price-flow conflict, missing data, and near-miss routing.
- [x] Run baseline agents without the skill and save their outputs.
- [x] Record which required boundaries are absent or violated in the baseline outputs.

### Task 2: Implement the skill contract

**Files:**
- Create: `.agents/skills/fund-flow-analysis/SKILL.md`
- Create: `.agents/skills/fund-flow-analysis/references/fund-source-framework.md`
- Create: `.agents/skills/fund-flow-analysis/references/indicator-boundaries.md`

- [x] Define triggering and routing boundaries in YAML frontmatter and the opening sections.
- [x] Define the input contract, three-window comparison, source audit, funding taxonomy, F3/F5/F7 panel, cross-validation, state vocabulary, and action rules.
- [x] State that large orders and ETF groups are proxies, that overlapping indicators cannot be summed mechanically, and that missing current data lowers confidence.

### Task 3: Implement the fixed output contract and metadata

**Files:**
- Create: `.agents/skills/fund-flow-analysis/template.md`
- Create: `.agents/skills/fund-flow-analysis/agents/openai.yaml`

- [x] Add every approved report section in the fixed order.
- [x] Separate new-cash and existing-position actions and include conditional position ranges.
- [x] Add display name, description, default prompt, and implicit invocation policy.

### Task 4: Validate behavior and structure

**Files:**
- Create: `.agents/skills/fund-flow-analysis-workspace/iteration-1/*/with_skill/outputs/report.md`
- Create: `.agents/skills/fund-flow-analysis-workspace/iteration-1/review.html`

- [x] Run with-skill agents on the same RED scenarios.
- [x] Check outputs for template coverage, state vocabulary, action conditions, proxy caveats, and missing-data handling.
- [x] On Windows, set `PYTHONUTF8=1`, then run `python .agents/skills/skill-creator/scripts/quick_validate.py .agents/skills/fund-flow-analysis` and require exit code 0.
- [x] Run a UTF-8/mojibake scan, JSON parsing, YAML/frontmatter checks, and `git diff --check`.
- [x] Generate a static evaluation viewer with the bundled `generate_review.py`.

### Task 5: Record and commit the result

**Files:**
- Modify: `log.md`

- [x] Append a 2026-07-17 `skill / create` maintenance record listing only this task's files.
- [x] Re-run all validations after the log update.
- [x] Audit Git integration and preserve unrelated staged work. Commit intentionally skipped: the index already contained files from other tasks and `.git/index.lock` was not writable, so a task-only commit could not be made safely without altering user state.
