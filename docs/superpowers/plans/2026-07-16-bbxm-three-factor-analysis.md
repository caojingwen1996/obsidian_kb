# BBXM Three-Factor Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an independently invokable `bbxm-three-factor-analysis` project skill, make it the single source of three-factor analysis rules, and restrict `risk-identification` to risk strengthening/weakening judgments.

**Architecture:** Add one focused skill with its own template, interface metadata, and eval prompts. Route direct three-factor requests through `bbxm-expert`; keep risk analysis and three-factor analysis parallel and mutually independent. Existing research and trade-review skills may consume three-factor results, but must not duplicate the model.

**Tech Stack:** Markdown Agent Skills, YAML interface metadata, JSON eval fixtures, Python 3 static contract tests, PowerShell verification commands.

---

## File map

**Create**

- `.agents/skills/bbxm-three-factor-analysis/SKILL.md`: canonical trigger, workflow, evidence rules, state vocabulary, and action mapping.
- `.agents/skills/bbxm-three-factor-analysis/template.md`: required analysis output structure.
- `.agents/skills/bbxm-three-factor-analysis/agents/openai.yaml`: user-facing interface metadata and default prompt.
- `.agents/skills/bbxm-three-factor-analysis/evals/evals.json`: realistic positive and boundary test prompts.
- `tests/validate_bbxm_three_factor_analysis.py`: dedicated static contract validation.

**Modify**

- `tests/validate_bbxm_project_skills.py`: register the new child skill and enforce router visibility.
- `.agents/skills/bbxm-expert/SKILL.md`: add direct three-factor routing and combined-request orchestration.
- `.agents/skills/risk-identification/SKILL.md`: remove three-factor, buy-window, and transaction-action responsibilities.
- `.agents/skills/equity-research/SKILL.md`: use the new skill for three-factor analysis and the risk skill only for risk direction.
- `.agents/skills/equity-research/template.md`: label the three-factor and risk sections as separate outputs.
- `.agents/skills/trade-ticket-review/SKILL.md`: reference the new skill when a trade review needs a three-factor audit.
- `log.md`: record the skill split and routing change.

**Workspace constraint**

The existing skill paths and `log.md` already contain user changes. Do not stage or commit those overlapping files automatically. Commits may include only files created entirely by this task; leave overlapping modified files unstaged and report them explicitly.

---

### Task 1: Add a failing standalone-skill contract test

**Files:**

- Create: `tests/validate_bbxm_three_factor_analysis.py`
- Test: `tests/validate_bbxm_three_factor_analysis.py`

- [ ] **Step 1: Write the failing static contract test**

Create the validator with these exact checks:

```python
from pathlib import Path
import json
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = REPO_ROOT / ".agents" / "skills" / "bbxm-three-factor-analysis"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read(relative_path: str) -> str:
    return (SKILL_ROOT / relative_path).read_text(encoding="utf-8-sig")


def main() -> None:
    required_files = (
        "SKILL.md",
        "template.md",
        "agents/openai.yaml",
        "evals/evals.json",
    )
    for relative_path in required_files:
        require(
            (SKILL_ROOT / relative_path).is_file(),
            f"missing standalone three-factor skill file: {relative_path}",
        )

    skill = read("SKILL.md")
    template = read("template.md")
    interface = read("agents/openai.yaml")
    evals = json.loads(read("evals/evals.json"))

    required_skill_markers = (
        "name: bbxm-three-factor-analysis",
        "竞争格局",
        "流动性辩证分析",
        "情绪位置变化",
        "有利 / 中性 / 不利 / 证据不足",
        "buy / sell / reduce / wait / observe / review",
        "不负责风险增强或减弱判断",
    )
    for marker in required_skill_markers:
        require(marker in skill, f"SKILL.md is missing contract marker: {marker}")

    required_template_markers = (
        "三要素状态总表",
        "证据",
        "反证",
        "失效条件",
        "新增现金",
        "已有持仓",
        "数据缺口",
        "置信度",
    )
    for marker in required_template_markers:
        require(marker in template, f"template.md is missing: {marker}")

    require("allow_implicit_invocation: true" in interface, "implicit invocation must be enabled")
    require(evals.get("skill_name") == "bbxm-three-factor-analysis", "wrong eval skill name")
    require(len(evals.get("evals", [])) >= 5, "at least five routing scenarios are required")

    runtime_text = skill + template + interface
    require(
        not any(marker in runtime_text for marker in ("�", "鍐", "鐭", "鎯", "灏")),
        "encoding scan found mojibake markers",
    )

    print("PASS: standalone BBXM three-factor skill contract validated")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
python tests\validate_bbxm_three_factor_analysis.py
```

Expected: exit code `1` and `FAIL: missing standalone three-factor skill file: SKILL.md`.

---

### Task 2: Create the standalone skill and make its contract pass

**Files:**

- Create: `.agents/skills/bbxm-three-factor-analysis/SKILL.md`
- Create: `.agents/skills/bbxm-three-factor-analysis/template.md`
- Create: `.agents/skills/bbxm-three-factor-analysis/agents/openai.yaml`
- Create: `.agents/skills/bbxm-three-factor-analysis/evals/evals.json`
- Test: `tests/validate_bbxm_three_factor_analysis.py`

- [ ] **Step 1: Create `SKILL.md` with the canonical responsibility boundary**

Use this structure and wording:

```markdown
---
name: bbxm-three-factor-analysis
description: Use when 用户要求按照冰冰小美体系三要素分析市场、指数、板块或个股，判断竞争格局、流动性、情绪位置、三要素共振状态，或要求把三要素结论转换为 buy / sell / reduce / wait / observe / review。
---

# 冰冰小美体系三要素分析

## 定位

本技能是体系三要素的唯一项目级分析入口。它独立分析竞争格局、流动性辩证分析和情绪位置变化，并把证据转换为综合状态与行动语言。

本技能不负责风险增强或减弱判断；风险方向由 `risk-identification` 独立处理。两个技能平行、互不调用。

## 路由边界

- 直接分析三要素：使用本技能。
- 判断风险增强、持平、减弱或重新增强：使用 `risk-identification`。
- 过滤单条信息：使用 `information-filter-flow`。
- 复盘交割单：使用 `trade-ticket-review`，需要时引用本技能的三要素结果。
- 完整个股研究、估值或 DCF：使用 `equity-research`，由其引用本技能。

## 开始前必须确认

1. 分析对象及市场；
2. 对象层级：市场、指数、板块或个股；
3. 分析截止时间；
4. 用户的核心决策问题；
5. 已提供材料与仍需核验的数据。

## 体系依据

先检索当前 wiki，至少读取与任务相关的以下页面：

- `wiki/topics/冰冰小美-情绪体系理论篇.md`
- `wiki/concepts/冰冰小美-concept-体系三要素之竞争格局的比较优势.md`
- `wiki/concepts/冰冰小美-concept-体系三要素之流动性辩证分析.md`
- `wiki/concepts/冰冰小美-concept-体系三要素之情绪位置的变化.md`

按对象补充检索相关产业、事件、观点和推导页面。涉及当前市场状态时核验最新可得数据；无法取得时写明“未获取到”、检查范围及其对置信度的影响。

## 分析流程

### Step 1：竞争格局与比较优势

检查安全与发展方向、产业链利润流向、议价权、国内外竞争位置、供给扩张或出清、比较优势持续性，并分别列出证据与反证。

### Step 2：流动性辩证分析

检查宏观、中观、微观流动性，区分真实增量、机构配置、ETF、融资盘和短期接力；检查板块内部承接、股票供给、融资减持解禁压力和退出路径，并分别列出证据与反证。

### Step 3：情绪位置变化

判断冰点、试错、扩散、拥挤、退潮或修复阶段；检查市场广度、接力、赚钱效应、亏钱效应、利好利空反应、情绪标与套利行为，并分别列出证据与反证。

### Step 4：统一评级

每项只能使用：

```text
有利 / 中性 / 不利 / 证据不足
```

综合状态只能使用：

```text
同步有利 / 部分有利 / 尚未形成有利共振 / 同步不利 / 证据不足
```

不得用一个强要素机械抵消另外两个不利要素。说明主导要素、拖累要素、下一验证节点和失效条件。

### Step 5：行动映射

行动限定为：

```text
buy / sell / reduce / wait / observe / review
```

区分新增现金与已有持仓。证据不足时使用 `observe` 或 `review`，不得用单一利好、单日涨跌或主观叙事形成确定性买卖结论。

## 输出

必须使用同目录 `template.md`。事实、判断和未获取到的数据分开表达，并列明来源、截止时间、数据缺口、置信度和失效条件。
```

- [ ] **Step 2: Create the output template**

Write `template.md` with this complete section order:

```markdown
# <分析对象>冰冰小美体系三要素分析

> 对象层级：市场 / 指数 / 板块 / 个股
> 市场：
> 分析截止时间：
> 核心问题：

## 1. 一句话结论

- 三要素综合状态：同步有利 / 部分有利 / 尚未形成有利共振 / 同步不利 / 证据不足
- 主导要素：
- 拖累要素：

## 2. 三要素状态总表

| 要素 | 状态 | 核心证据 | 核心反证 | 置信度 |
|---|---|---|---|---|
| 竞争格局 | 有利 / 中性 / 不利 / 证据不足 | | | |
| 流动性辩证分析 | 有利 / 中性 / 不利 / 证据不足 | | | |
| 情绪位置变化 | 有利 / 中性 / 不利 / 证据不足 | | | |

## 3. 竞争格局与比较优势

### 证据

### 反证

### 失效条件

## 4. 流动性辩证分析

### 证据

### 反证

### 退出路径

### 失效条件

## 5. 情绪位置变化

### 证据

### 反证

### 失效条件

## 6. 综合状态与主导矛盾

- 综合状态：
- 主导矛盾：
- 下一验证节点：

## 7. 行动映射

### 新增现金

- 动作：buy / wait / observe / review
- 条件：

### 已有持仓

- 动作：sell / reduce / wait / observe / review
- 条件：

## 8. 数据缺口与置信度

- 未获取到：
- 已检查范围：
- 对结论的影响：
- 总体置信度：高 / 中 / 低

## 9. 来源

- Wiki 依据：
- 当前数据：
```

- [ ] **Step 3: Create interface metadata**

Write `agents/openai.yaml`:

```yaml
interface:
  display_name: "冰冰小美三要素分析"
  short_description: "分析竞争格局、流动性和情绪位置并给出行动结论"
  default_prompt: "用冰冰小美体系三要素分析这个市场、指数、板块或个股。"
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 4: Create five scenario evals**

Write `evals/evals.json` with `skill_name` and five prompts covering: direct sector analysis, direct stock analysis, risk-only near miss, full-equity-research near miss, and missing-current-data behavior. Each item must include `id`, `prompt`, `expected_output`, and an empty `files` list.

- [ ] **Step 5: Run the dedicated validator and verify GREEN**

Run:

```powershell
python tests\validate_bbxm_three_factor_analysis.py
```

Expected: `PASS: standalone BBXM three-factor skill contract validated`.

- [ ] **Step 6: Preserve the existing staging state**

Do not stage or commit implementation files in this session. The index already contains pre-existing `equity-research` changes, so adding a partial implementation commit would risk mixing ownership. Report the new skill directory and validator as uncommitted task files at handoff.

---

### Task 3: Route direct three-factor requests through `bbxm-expert`

**Files:**

- Modify: `tests/validate_bbxm_project_skills.py`
- Modify: `.agents/skills/bbxm-expert/SKILL.md`
- Test: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Extend the router test and verify RED**

Add `bbxm-three-factor-analysis` with its four required files to `EXPECTED_FILES`. Add it to the router child-skill tuple. Add assertions requiring these phrases in the router:

```python
require("直接分析体系三要素" in router, "router must recognize direct three-factor analysis")
require("两个技能平行、互不调用" in router, "router must keep risk and three-factor skills independent")
require("分别调用" in router, "router must orchestrate combined requests explicitly")
```

Run:

```powershell
python tests\validate_bbxm_project_skills.py
```

Expected: failure because `bbxm-expert/SKILL.md` does not yet contain the new route.

- [ ] **Step 2: Add the new child route**

Update the routing table with:

```markdown
| 直接分析体系三要素，判断市场、指数、板块或个股的竞争格局、流动性、情绪位置及共振状态 | `bbxm-three-factor-analysis` |
| 判断风险增强、持平、减弱或重新增强 | `risk-identification` |
```

Update conflict resolution so direct three-factor analysis selects the new skill. State explicitly:

```markdown
`risk-identification` 与 `bbxm-three-factor-analysis` 平行、互不调用。用户同时要求风险方向和三要素结论时，由 `bbxm-expert` 分别调用两个技能并汇总，不让其中一个代替另一个。
```

Keep information filtering, trade review, and full equity research ahead of direct child routing when they are the user's primary action.

- [ ] **Step 3: Run the router validator and verify GREEN**

Run:

```powershell
python tests\validate_bbxm_project_skills.py
```

Expected: `PASS: bbxm-expert project-only skill contract validated`.

- [ ] **Step 4: Leave overlapping router files uncommitted**

The router directory was already untracked before this task. Do not commit it automatically; report the modified path at handoff.

---

### Task 4: Restrict `risk-identification` to risk direction

**Files:**

- Modify: `tests/validate_bbxm_three_factor_analysis.py`
- Modify: `.agents/skills/risk-identification/SKILL.md`
- Test: `tests/validate_bbxm_three_factor_analysis.py`

- [ ] **Step 1: Add risk-isolation assertions and verify RED**

Extend the validator to read the risk skill and assert:

```python
risk_skill = (
    REPO_ROOT / ".agents" / "skills" / "risk-identification" / "SKILL.md"
).read_text(encoding="utf-8-sig")

for marker in ("风险增强", "风险持平", "风险减弱", "风险重新增强", "证据不足"):
    require(marker in risk_skill, f"risk skill is missing direction marker: {marker}")

for forbidden in ("检查体系三要素", "买入窗口", "交易动作", "buy / sell / reduce"):
    require(forbidden not in risk_skill, f"risk skill still owns forbidden responsibility: {forbidden}")

require(
    "bbxm-three-factor-analysis" not in risk_skill,
    "risk skill must not invoke the three-factor skill",
)
```

Run the validator. Expected: failure on `检查体系三要素` or `买入窗口`.

- [ ] **Step 2: Narrow the risk skill**

Make these surgical changes:

1. Change frontmatter triggers to risk source, transmission, strengthening, holding steady, weakening, re-strengthening, and uncertainty. Remove buy-window language.
2. Define the sole final state vocabulary as:

   ```text
   风险增强 / 风险持平 / 风险减弱 / 风险重新增强 / 证据不足
   ```

3. Preserve source classification, four risk categories, transmission-chain construction, time-window comparison, and four-layer evidence checks because they support the direction judgment.
4. Remove `Step 6：检查体系三要素` and all three-factor questions.
5. Remove buy-window gates, transaction-action sections, position advice, and buy/sell conclusions.
6. Replace the final output with risk direction, evidence, counterevidence, propagation path, validation indicators, invalidation conditions, and confidence.
7. Simplify the Mermaid flow so it ends at the risk-direction result.
8. Ensure the skill never names or calls `bbxm-three-factor-analysis`.

- [ ] **Step 3: Run the dedicated validator and verify GREEN**

Run:

```powershell
python tests\validate_bbxm_three_factor_analysis.py
```

Expected: `PASS: standalone BBXM three-factor skill contract validated`.

- [ ] **Step 4: Leave the overlapping risk file uncommitted**

The risk skill was already untracked before this task. Do not commit it automatically; report the path at handoff.

---

### Task 5: Integrate research and trade review without duplicating rules

**Files:**

- Modify: `tests/validate_bbxm_three_factor_analysis.py`
- Modify: `.agents/skills/equity-research/SKILL.md`
- Modify: `.agents/skills/equity-research/template.md`
- Modify: `.agents/skills/trade-ticket-review/SKILL.md`
- Test: `tests/validate_bbxm_three_factor_analysis.py`
- Test: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Add integration assertions and verify RED**

Add:

```python
equity_skill = (
    REPO_ROOT / ".agents" / "skills" / "equity-research" / "SKILL.md"
).read_text(encoding="utf-8-sig")
equity_template = (
    REPO_ROOT / ".agents" / "skills" / "equity-research" / "template.md"
).read_text(encoding="utf-8-sig")
trade_skill = (
    REPO_ROOT / ".agents" / "skills" / "trade-ticket-review" / "SKILL.md"
).read_text(encoding="utf-8-sig")

require("bbxm-three-factor-analysis" in equity_skill, "equity research must use the new skill")
require("三要素结论来源" in equity_template, "equity template must identify the three-factor source")
require("风险方向结论" in equity_template, "equity template must separate risk direction")
require("bbxm-three-factor-analysis" in trade_skill, "trade review must reference the new skill")
```

Run the dedicated validator. Expected: failure because neighboring skills do not yet reference the new skill.

- [ ] **Step 2: Update equity research**

In `equity-research/SKILL.md`:

- State that Step 7 executes `bbxm-three-factor-analysis/SKILL.md` for three-factor analysis.
- State that `risk-identification` supplies only risk direction when the report needs it.
- Remove claims that risk weakening controls whether three-factor analysis may run.
- Keep valuation, cash-decision, and evidence-audit ownership in `equity-research`.

In `equity-research/template.md`, retain the report layout but add:

```markdown
- 三要素结论来源：`bbxm-three-factor-analysis`
- 风险方向结论：风险增强 / 风险持平 / 风险减弱 / 风险重新增强 / 证据不足
```

Do not duplicate the new skill's full checklist in the equity template.

- [ ] **Step 3: Update trade review**

State that the trade-review skill remains the primary route for buy/sell records. When the review needs to judge whether the original trade matched the three factors, read `bbxm-three-factor-analysis/SKILL.md` and import its result; do not copy its checklist into the trade-review skill.

- [ ] **Step 4: Run both validators and verify GREEN**

Run:

```powershell
python tests\validate_bbxm_three_factor_analysis.py
python tests\validate_bbxm_project_skills.py
```

Expected: both print `PASS` and exit with code `0`.

- [ ] **Step 5: Leave overlapping integration files uncommitted**

These files contained user changes before this task. Do not stage or commit them automatically.

---

### Task 6: Record maintenance and run final verification

**Files:**

- Modify: `log.md`
- Test: `tests/validate_bbxm_three_factor_analysis.py`
- Test: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Append the maintenance record**

Append a `2026-07-16` entry with operation type `skill / refactor / routing`, the new skill files, the modified router/risk/research/review files, and this explanation:

```text
将冰冰小美体系三要素拆分为独立项目技能；risk-identification 仅保留风险增强、持平、减弱、重新增强及证据不足判断；两个技能平行、互不调用。
```

Do not update `index.md` because no formal wiki page is added or removed.

- [ ] **Step 2: Run all focused tests**

```powershell
python tests\validate_bbxm_three_factor_analysis.py
python tests\validate_bbxm_project_skills.py
```

Expected: both validators print `PASS`.

- [ ] **Step 3: Run syntax validation**

```powershell
python -m py_compile tests\validate_bbxm_three_factor_analysis.py tests\validate_bbxm_project_skills.py
```

Expected: exit code `0` with no output.

- [ ] **Step 4: Check encoding and placeholders**

Run `rg` across only the touched task files for `TBD|TODO|鍐|鐭|鎯|灏|�`. Expected: no matches. Exclude the implementation-plan checkbox syntax from this scan.

- [ ] **Step 5: Check diff integrity**

Run:

```powershell
git diff --check
git status --short
```

Expected: no new whitespace errors in task-owned changes. Identify all pre-existing unrelated modifications separately from task files.

- [ ] **Step 6: Review the final diff against the design**

Confirm:

- direct three-factor requests route to the new skill;
- risk-only requests route to `risk-identification`;
- the two skills do not call each other;
- the risk skill contains no three-factor, buy-window, or transaction-action responsibility;
- research and trade review reference, rather than duplicate, the new model;
- current-data failures remain explicit and do not become invented conclusions.

- [ ] **Step 7: Do not commit the overlapping `log.md` automatically**

Leave it unstaged because it contained pre-existing user changes. Report the appended entry and all task paths in the final handoff.
