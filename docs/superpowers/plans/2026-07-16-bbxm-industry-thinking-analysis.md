# BBXM Industry Thinking Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-local `industry-thinking-analysis` skill that analyzes industries through the Ice Ice Xiaomei framework and Howard Marks's complete ten-cycle matrix, then route matching `bbxm-expert` requests to it.

**Architecture:** Keep the framework's durable knowledge in `wiki/concepts/冰冰小美-framework-产业思维.md` and make the new skill read that page at runtime instead of duplicating it. Add static contracts to the existing BBXM validator first, then create the skill, update the router, and record the maintenance action without touching the legacy plugin migration or unrelated working-tree changes.

**Tech Stack:** Markdown Agent Skills, YAML frontmatter, Python 3 static contract test, PowerShell, Git.

---

## File map

- Create `.agents/skills/industry-thinking-analysis/SKILL.md`: trigger metadata, analysis workflow, complete cycle matrix, output contract, routing boundaries, and persistence boundary.
- Create `.agents/skills/industry-thinking-analysis/agents/openai.yaml`: project skill display metadata matching the skill frontmatter.
- Modify `.agents/skills/bbxm-expert/SKILL.md`: add industry-analysis routing and conflict resolution.
- Modify `tests/validate_bbxm_project_skills.py`: make the new skill and its required contracts regression-tested.
- Modify `log.md`: append the project maintenance record.

### Task 1: Add failing discovery and contract tests

**Files:**
- Modify: `tests/validate_bbxm_project_skills.py`
- Test: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Add the new skill to the expected file map**

Add this entry to `EXPECTED_FILES`:

```python
    "industry-thinking-analysis": (
        "SKILL.md",
        "agents/openai.yaml",
    ),
```

- [ ] **Step 2: Add routing and skill-content assertions**

After the existing router child-skill loop, add:

```python
    require(
        "industry-thinking-analysis" in router,
        "bbxm-expert router is missing industry-thinking-analysis",
    )

    industry_skill = (
        SKILLS_ROOT / "industry-thinking-analysis" / "SKILL.md"
    ).read_text(encoding="utf-8-sig")
    for marker in (
        "wiki/concepts/冰冰小美-framework-产业思维.md",
        "经济周期",
        "政府干预经济周期",
        "企业盈利周期",
        "投资人心理与情绪钟摆",
        "风险态度周期",
        "信贷周期",
        "不良债权周期",
        "房地产周期",
        "市场周期",
        "成功周期",
        "当前阶段",
        "产业证据",
        "传导关系",
        "验证信号",
        "证据不足",
        "配置 / 跟踪 / 等待 / 回避",
        "明确要求保存",
    ):
        require(
            marker in industry_skill,
            f"industry-thinking-analysis is missing contract marker: {marker}",
        )
```

- [ ] **Step 3: Run the validator and verify the RED state**

Run:

```powershell
python tests/validate_bbxm_project_skills.py
```

Expected: `FAIL: project skill file is missing: industry-thinking-analysis/SKILL.md`.

- [ ] **Step 4: Commit the failing contract test only**

```powershell
git add -- tests/validate_bbxm_project_skills.py
git commit --only -m "test: define BBXM industry thinking contract" -- tests/validate_bbxm_project_skills.py
```

### Task 2: Create the minimal industry-thinking skill

**Files:**
- Create: `.agents/skills/industry-thinking-analysis/SKILL.md`
- Create: `.agents/skills/industry-thinking-analysis/agents/openai.yaml`
- Test: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Create the skill frontmatter and purpose**

Start `SKILL.md` with:

```markdown
---
name: industry-thinking-analysis
description: Use when 用户要求按冰冰小美产业思维、产业模型或中观框架分析某个产业、行业、赛道、产业链、传统产业升级或新兴产业路径，包括航空航天、商业航天、AI、机器人、新能源、半导体、化工、有色、汽车和养殖等方向。
---

# 冰冰小美产业思维分析模型

## 定位

用于产业层级的中观分析。先判断时代主线与产业链约束，再检查资本如何解决约束、企业能否兑现，最后用完整周期矩阵、利润证据与风险边界形成 `配置 / 跟踪 / 等待 / 回避` 结论。
```

- [ ] **Step 2: Add mandatory sources and boundaries**

Add instructions that require:

```markdown
## 强制来源

1. 先读取 `wiki/concepts/冰冰小美-framework-产业思维.md`，把它作为产业模型的唯一知识源。
2. 检索目标产业已有的 concept、topic、timeline、reasoning、view 和 source，优先复用已有产业边界与推导链。
3. 涉及当前政策、信贷、价格、订单、库存、融资、估值或市场状态时，核验最新可靠数据并标注数据日期。
4. 数据不可得时写“证据不足”，不得用历史结论冒充当前状态。

## 分析边界

- 产业方向正确不等于所有相关股票可以买。
- 默认不做个股 DCF、目标价或仓位建议。
- 用户明确要求保存、归档或写入 Wiki 时才执行写入流程；普通分析不得自动创建页面。
- 单条信息的金融意义交给 `information-filter-flow`；完整公司研究交给 `equity-research`；买入窗口和风险转弱判断交给 `risk-identification`。
```

- [ ] **Step 3: Add the industry workflow**

Require the following ordered analysis:

```markdown
## 分析流程

1. 定义产业边界与相邻产业排除项。
2. 判断国家战略、技术革命、全球格局与社会需求形成的时代主线。
3. 拆分资源、材料、设备、零部件、制造、应用、渠道、标准与基础设施。
4. 找出资金、信贷、技术、资源、能源、产能、库存、需求、标准、人才和定价权约束。
5. 分析政策、信贷、价格与全部周期。
6. 判断资本市场是否导向研发、扩产、替代、并购、出海和生态建设。
7. 判断企业战略与组织能力能否转成产品、订单、成本、质量、服务、客户和现金流。
8. 用财报、订单、价格、库存、份额、资本开支和现金流验证叙事。
9. 给出风险边界、失效条件、行动结论和后续验证清单。
```

- [ ] **Step 4: Add the complete cycle matrix**

The skill must list all ten cycles:

```markdown
## 霍华德·马克斯完整周期矩阵

逐项分析，不得用单一“产业周期”代替：

1. 经济周期
2. 政府干预经济周期
3. 企业盈利周期
4. 投资人心理与情绪钟摆
5. 风险态度周期
6. 信贷周期
7. 不良债权周期
8. 房地产周期
9. 市场周期
10. 成功周期

每个周期都填写：当前阶段、产业证据、对产业链/盈利/估值的影响、与其他周期的传导关系、下一阶段验证信号。无法判断时保留该行并写“证据不足”。

最后判断多周期属于：顺风共振、冷热错位、过热透支、下行出清或复苏验证。
```

- [ ] **Step 5: Add the exact report structure**

```markdown
## 输出结构

# [产业名称]产业思维分析

## 1. 分析对象与产业边界
## 2. 一句话结论
## 3. 时代主线
## 4. 产业链地图
## 5. 核心约束
## 6. 政策、信贷与价格
## 7. 霍华德·马克斯完整周期矩阵
## 8. 多周期传导与叠加状态
## 9. 资本市场作用
## 10. 企业战略与组织能力
## 11. 利润验证
## 12. 风险边界与失效条件
## 13. 行动结论

- 结论：配置 / 跟踪 / 等待 / 回避
- 理由：
- 当前不应做什么：

## 14. 后续验证清单
```

- [ ] **Step 6: Create the UI metadata**

Create `agents/openai.yaml`:

```yaml
interface:
  display_name: "产业思维分析模型"
  short_description: "按冰冰小美框架分析产业链、完整周期与验证信号"
  default_prompt: "请按冰冰小美产业思维分析一个产业，覆盖霍华德·马克斯的完整周期矩阵。"
```

- [ ] **Step 7: Validate skill structure**

Run:

```powershell
python .agents/skills/skill-creator/scripts/quick_validate.py .agents/skills/industry-thinking-analysis
```

Expected: validator exits with code `0` and reports the skill as valid.

- [ ] **Step 8: Run the project contract and observe the remaining router failure**

Run:

```powershell
python tests/validate_bbxm_project_skills.py
```

Expected: `FAIL: bbxm-expert router is missing industry-thinking-analysis`.

- [ ] **Step 9: Commit the new skill files only**

```powershell
git add -- .agents/skills/industry-thinking-analysis/SKILL.md .agents/skills/industry-thinking-analysis/agents/openai.yaml
git commit --only -m "feat: add BBXM industry thinking skill" -- .agents/skills/industry-thinking-analysis/SKILL.md .agents/skills/industry-thinking-analysis/agents/openai.yaml
```

### Task 3: Route industry requests through bbxm-expert

**Files:**
- Modify: `.agents/skills/bbxm-expert/SKILL.md`
- Test: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Extend the router description**

Add `产业思维、产业分析、行业分析、产业链分析` to the frontmatter trigger phrases.

- [ ] **Step 2: Add the child routing row**

Add this row to `## 子技能分流`:

```markdown
| 产业思维、产业分析、行业分析、赛道分析、产业链结构、产业约束、产业周期与产业行动结论 | `industry-thinking-analysis` |
```

- [ ] **Step 3: Add conflict-resolution rules**

Before the existing company and risk checks, add:

```markdown
3. 用户是否要求分析一个产业、行业、赛道或产业链的时代主线、约束、周期与验证？是则使用 `industry-thinking-analysis`。
```

Renumber the following steps and add explicit near-miss examples:

```markdown
- “分析航空航天产业”进入 `industry-thinking-analysis`，不因出现“风险”或“股票”一词自动降级为个股风险识别。
- “这条航空航天增长数据有没有金融意义”仍进入 `information-filter-flow`。
- “研究航天电子并给出 DCF 和目标价”进入 `equity-research`。
```

- [ ] **Step 4: Run the full contract test and verify GREEN**

Run:

```powershell
python tests/validate_bbxm_project_skills.py
```

Expected: `PASS: bbxm-expert project-only skill contract validated`.

- [ ] **Step 5: Commit the router change only**

```powershell
git add -- .agents/skills/bbxm-expert/SKILL.md
git commit --only -m "feat: route BBXM industry analysis" -- .agents/skills/bbxm-expert/SKILL.md
```

### Task 4: Record maintenance and run final verification

**Files:**
- Modify: `log.md`
- Verify: `.agents/skills/industry-thinking-analysis/SKILL.md`
- Verify: `.agents/skills/industry-thinking-analysis/agents/openai.yaml`
- Verify: `.agents/skills/bbxm-expert/SKILL.md`
- Verify: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: Append the maintenance log**

Append under `## 2026-07-16` or create that date heading if absent:

```markdown
### skill / route

### 修改文件

- `.agents/skills/industry-thinking-analysis/SKILL.md`
- `.agents/skills/industry-thinking-analysis/agents/openai.yaml`
- `.agents/skills/bbxm-expert/SKILL.md`
- `tests/validate_bbxm_project_skills.py`
- `log.md`

### 操作说明

新增冰冰小美“产业思维分析模型”项目技能，以 `wiki/concepts/冰冰小美-framework-产业思维.md` 为唯一框架来源；加入霍华德·马克斯十类完整周期矩阵、产业分析输出契约与默认不自动写入 Wiki 的边界，并接入 `bbxm-expert` 分流。
```

- [ ] **Step 2: Run the project validator**

```powershell
python tests/validate_bbxm_project_skills.py
```

Expected: `PASS: bbxm-expert project-only skill contract validated`.

- [ ] **Step 3: Run the skill validator**

```powershell
python .agents/skills/skill-creator/scripts/quick_validate.py .agents/skills/industry-thinking-analysis
```

Expected: exit code `0`.

- [ ] **Step 4: Run an explicit UTF-8 mojibake scan**

```powershell
$files = @(
  '.agents/skills/industry-thinking-analysis/SKILL.md',
  '.agents/skills/industry-thinking-analysis/agents/openai.yaml',
  '.agents/skills/bbxm-expert/SKILL.md',
  'tests/validate_bbxm_project_skills.py',
  'log.md'
)
Select-String -LiteralPath $files -Pattern '鍐|鐭|鎯|灏|�|[\uE000-\uF8FF]' -Encoding UTF8
```

Expected: no matches.

- [ ] **Step 5: Inspect only task-related diffs**

```powershell
git diff -- .agents/skills/industry-thinking-analysis .agents/skills/bbxm-expert/SKILL.md tests/validate_bbxm_project_skills.py log.md
git status --short
```

Expected: every changed line in the scoped diff traces to the approved skill; unrelated pre-existing changes remain untouched.

- [ ] **Step 6: Commit the maintenance log only**

```powershell
git add -- log.md
git commit --only -m "docs: log BBXM industry thinking skill" -- log.md
```

- [ ] **Step 7: Report completion**

Report the new skill path, router path, tests run and exact results, ten-cycle coverage, default no-write boundary, and any pre-existing dirty-worktree items that were deliberately left untouched.
