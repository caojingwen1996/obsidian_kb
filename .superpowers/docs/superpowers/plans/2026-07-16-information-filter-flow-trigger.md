# Information Filter Flow Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `information-filter-flow` from triggering on pure source verification, statistical explanation, growth attribution, factual research, or file-archiving tasks while preserving explicit financial-judgment triggers.

**Architecture:** Keep routing rules in the existing project-local `SKILL.md`. Encode the boundary as a two-condition decision: an eligible information object plus explicit financial-judgment intent. Protect the boundary with static contract assertions in the existing project skill validation test.

**Tech Stack:** Markdown Agent Skill instructions, YAML frontmatter, Python contract test, pytest.

---

### Task 1: Add failing trigger-boundary contract

**Files:**
- Modify: `tests/validate_bbxm_project_skills.py`
- Test: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Write the failing test**

Add assertions requiring the skill to contain the markers `金融判断意图`, `仅满足内容对象`, `不适用场景`, `增长来源`, `数据来源核验`, and `不得启用本 Skill`. Also assert that the frontmatter description contains `明确要求` and does not contain the old broad phrase `或处理金融市场中的`.

- [ ] **Step 2: Run test to verify it fails**

Run: `python tests/validate_bbxm_project_skills.py`

Expected: `FAIL` because the current skill lacks the two-condition and exclusion markers.

### Task 2: Implement the minimal routing change

**Files:**
- Modify: `.agents/skills/information-filter-flow/SKILL.md`

- [ ] **Step 1: Tighten frontmatter description**

Replace the broad content-based description with one that begins `Use when...` and requires an explicit request to judge financial meaning, tradability, price reaction, risk state, or final treatment.

- [ ] **Step 2: Replace broad applicability rules**

Define the two conditions:

```text
内容对象属于新闻、政策、公告、研报、观点、产业、指数或个股信息
+
用户明确要求金融意义、交易价值、价格反应、风险状态或处理方式
```

State that satisfying only the content-object condition is insufficient.

- [ ] **Step 3: Add explicit exclusions and mixed-request routing**

Exclude source verification, statistical definitions, growth attribution, causal decomposition, factual research, summaries, and save/archive-only tasks. For mixed requests, finish factual verification first and apply the skill only to the explicit financial-judgment portion.

- [ ] **Step 4: Preserve strong trigger phrases**

Keep explicit phrases such as `能不能交易`, `是否已经反应`, `投资还是投机`, `配置、跟踪、归档、回避`, and explicit invocation of the information-filter framework.

### Task 3: Verify behavior and project contract

**Files:**
- Test: `tests/validate_bbxm_project_skills.py`
- Verify: `.agents/skills/information-filter-flow/SKILL.md`

- [ ] **Step 1: Run the contract test**

Run: `python tests/validate_bbxm_project_skills.py`

Expected: `PASS: bbxm-expert project-only skill contract validated`.

- [ ] **Step 2: Run prompt-classification fixtures**

Use a small read-only test script or inline assertions with three negative and three positive prompts from the approved design. Expected: all six classifications match the approved trigger boundary.

- [ ] **Step 3: Check encoding and diff**

Run: `rg -n '�|鍐|鐭|鎯|灏' .agents/skills/information-filter-flow tests/validate_bbxm_project_skills.py`

Expected: no new encoding markers.

Run: `git diff --check -- .agents/skills/information-filter-flow/SKILL.md tests/validate_bbxm_project_skills.py`

Expected: exit code 0 with no whitespace errors.
