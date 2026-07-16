# Merge BBXM Trade Review Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `bbxm-trade-review` into `trade-ticket-review` so the BBXM expert suite has one canonical trade-review skill.

**Architecture:** Keep `trade-ticket-review` as the only runtime contract and absorb the unique BBXM review constraints into it without duplicating the standalone three-factor or risk contracts. Add a focused contract test that rejects the retired directory and retired name, then delete the duplicate skill and validate the remaining skill and project routing.

**Tech Stack:** Markdown skill contracts, YAML agent metadata, Python contract tests, Codex skill validation scripts.

---

### Task 1: Add the merge contract test

**Files:**
- Create: `tests/validate_trade_ticket_review_merge.py`

- [ ] **Step 1: Write the failing contract test**

Create a Python test that:

```python
from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = REPO_ROOT / ".agents" / "skills"
CANONICAL = SKILLS_ROOT / "trade-ticket-review"
RETIRED = SKILLS_ROOT / "bbxm-trade-review"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    require(CANONICAL.is_dir(), "canonical trade-ticket-review skill is missing")
    require(not RETIRED.exists(), "retired bbxm-trade-review directory still exists")

    skill = (CANONICAL / "SKILL.md").read_text(encoding="utf-8-sig")
    metadata = (CANONICAL / "agents" / "openai.yaml").read_text(encoding="utf-8-sig")
    router = (SKILLS_ROOT / "bbxm-expert" / "SKILL.md").read_text(encoding="utf-8-sig")

    for marker in (
        "恢复原始交易意图",
        "明日谁来接",
        "仓位与性格匹配",
        "bbxm-three-factor-analysis",
        "risk-identification",
        "visible-data only",
    ):
        require(marker in skill, f"canonical skill is missing merged marker: {marker}")

    require("name: trade-ticket-review" in skill, "canonical skill name changed")
    require("冰冰小美" in metadata, "agent metadata does not expose BBXM review")
    require("`trade-ticket-review`" in router, "router lost canonical trade-review route")

    active_skill_text = "".join(
        path.read_text(encoding="utf-8-sig")
        for path in SKILLS_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".md", ".yaml", ".json", ".txt"}
    )
    retired_name = "bbxm" + "-trade-review"
    require(retired_name not in active_skill_text, "active skills still reference retired name")

    print("PASS: BBXM trade-review skills merged into trade-ticket-review")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
```

- [ ] **Step 2: Run the test and verify the pre-merge failure**

Run:

```powershell
$env:PYTHONUTF8='1'
python tests\validate_trade_ticket_review_merge.py
```

Expected: `FAIL: retired bbxm-trade-review directory still exists`.

### Task 2: Consolidate the runtime skill

**Files:**
- Modify: `.agents/skills/trade-ticket-review/SKILL.md`
- Modify: `.agents/skills/trade-ticket-review/agents/openai.yaml`
- Delete: `.agents/skills/bbxm-trade-review/SKILL.md`
- Delete: `.agents/skills/bbxm-trade-review/agents/openai.yaml`

- [ ] **Step 1: Merge the unique BBXM constraints into the canonical contract**

Keep the existing detailed review workflow, while making these boundaries explicit:

```markdown
- 先恢复原始交易意图，再评价结果。
- 明确追问“今天买入后，明日谁来接”。
- 审计仓位与性格匹配，以及仓位是否保留纠错空间。
- 明确要求三要素时，读取 `bbxm-three-factor-analysis` 并消费其状态、证据、反证和失效条件，不复制检查表。
- 需要正式风险方向时，读取 `risk-identification` 并消费其结果，不在交易复盘内维护第二套风险状态量表。
- 输入不完整时只做 `visible-data only` 分析。
```

Remove the local `R3` through `W3` risk scale and replace it with a risk-result interface owned by `risk-identification`. Deduplicate repeated liquidity, three-factor, position, attribution, and Wiki instructions.

- [ ] **Step 2: Update the canonical agent metadata**

Use:

```yaml
interface:
  display_name: "冰冰小美交割单复盘"
  short_description: "按冰冰小美体系复盘交易事实、决策质量、仓位纪律和修正规则。"
  default_prompt: "按冰冰小美体系复盘这张交割单，分析信息依据、风险、三要素、明日承接、仓位性格和下一次规则。"
```

- [ ] **Step 3: Delete the duplicate skill directory**

Delete both tracked files under `.agents/skills/bbxm-trade-review/`, leaving no compatibility pointer or second skill entry.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
$env:PYTHONUTF8='1'
python tests\validate_trade_ticket_review_merge.py
```

Expected: `PASS: BBXM trade-review skills merged into trade-ticket-review`.

### Task 3: Record and validate the merge

**Files:**
- Modify: `log.md`

- [ ] **Step 1: Append the maintenance log**

Append a `2026-07-16` `skill / refactor` entry listing the canonical skill changes, retired directory, focused test, merge rationale, and the fact that `index.md` is unchanged because no formal Wiki page was added.

- [ ] **Step 2: Validate the canonical skill**

Run:

```powershell
$env:PYTHONUTF8='1'
python .agents\skills\skill-creator\scripts\quick_validate.py .agents\skills\trade-ticket-review
```

Expected: `Skill is valid!`.

- [ ] **Step 3: Run project contract validation**

Run:

```powershell
$env:PYTHONUTF8='1'
python tests\validate_bbxm_project_skills.py
python tests\validate_bbxm_three_factor_analysis.py
```

Expected: both commands print `PASS`.

- [ ] **Step 4: Check retired references and encoding**

Run:

```powershell
rg -n "bbxm-trade-review" .agents tests
git diff --check
```

Expected: the old name appears only in the focused test as an assembled compatibility assertion or not at all; `git diff --check` emits no errors.

- [ ] **Step 5: Review the final task-only diff**

Run:

```powershell
git diff -- .agents/skills/trade-ticket-review .agents/skills/bbxm-trade-review tests/validate_trade_ticket_review_merge.py log.md
```

Expected: the diff contains only the canonical skill consolidation, duplicate deletion, focused test, and maintenance log.

