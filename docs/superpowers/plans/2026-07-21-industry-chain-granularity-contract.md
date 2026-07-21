# Industry Chain Granularity Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `bbxm-industry-analysis` from compressing economically and technically distinct industry-chain links into one panorama row.

**Architecture:** Extend the existing contract at three synchronized layers: the Python validator states the required behavior, `SKILL.md` defines the execution rules and coverage audit, and `template.md` exposes the same row-granularity contract at output time. Preserve the framework as the only source of module names and avoid fixed industry-specific classifications.

**Tech Stack:** Markdown skill contracts, Python contract validation, Node.js HTML renderer tests, Git.

---

### Task 1: Add the failing chain-granularity contract test

**Files:**
- Modify: `tests/validate_bbxm_industry_company_mapping.py`
- Test: `tests/validate_bbxm_industry_company_mapping.py`

- [ ] **Step 1: Add required markers for the execution and template contracts**

Add assertions after the existing company-map marker checks:

```python
    for marker in (
        "导航层级，不是每层一行的压缩配额",
        "一个表格行只表达一个可比较子环节",
        "证据不足不能成为合并理由",
        "双向覆盖审计",
        "AI 芯片、存储、光模块、交换机、液冷供电",
    ):
        require(
            marker in skill,
            f"industry skill is missing chain-granularity contract: {marker}",
        )

    for marker in (
        "导航层级，不是每层一行的压缩配额",
        "同一层级可以重复多行",
        "证据不足不能成为合并理由",
        "双向覆盖审计",
    ):
        require(
            marker in template,
            f"industry template is missing chain-granularity contract: {marker}",
        )
```

- [ ] **Step 2: Run the validator and confirm the expected RED state**

Run:

```powershell
python tests/validate_bbxm_industry_company_mapping.py
```

Expected: `FAIL` with `industry skill is missing chain-granularity contract` because neither runtime contract contains the new rules yet.

- [ ] **Step 3: Commit the failing test only**

```powershell
git add tests/validate_bbxm_industry_company_mapping.py
git commit -m "test: require industry chain granularity contract"
```

### Task 2: Implement the execution contract in `SKILL.md`

**Files:**
- Modify: `.agents/skills/bbxm-industry-analysis/SKILL.md`
- Test: `tests/validate_bbxm_industry_company_mapping.py`

- [ ] **Step 1: Increment the skill version**

Change:

```yaml
version: 2.0.0
```

to:

```yaml
version: 2.1.0
```

- [ ] **Step 2: Add the panorama row-granularity rules after the unique output contract**

Add a new subsection that states:

```markdown
### 7.2 产业链拆分粒度强制口径

上游、中游、下游是导航层级，不是每层一行的压缩配额。同一层级可以重复多行；一个表格行只表达一个可比较子环节。

候选内容在产品或服务、技术路线或标准、客户或付费主体、所解决约束、价值量或利润池、竞争格局或代表主体中任一项存在实质差异时，拆成独立子环节。只有这些维度基本一致且合并后仍能准确填写价值量、壁垒、竞争格局和参与者时，才允许合并。

证据不足不能成为合并理由。关键子环节仍需独立保留并标记“待验证”或“未获取到”。不得使用固定行数，也不得无边界穷举。
```

Include the compressed counterexample `AI 芯片、存储、光模块、交换机、液冷供电` and explain that it must be split when the products, standards, customers, profit mechanisms, or participants differ. State explicitly that the example demonstrates method and is not a fixed intelligent-computing taxonomy.

- [ ] **Step 3: Add subsegment inventory to evidence planning**

Before building the company list, require a `chain_subsegment_inventory` with:

```yaml
chain_subsegment_inventory:
  chain_level:
  subsegment:
  product_or_service:
  customer_or_payer:
  constraint_solved:
  technology_or_standard:
  value_and_profit_mechanism:
  representative_participant_types:
  split_or_merge_rationale:
```

State that company mapping begins only after this inventory passes the split criteria.

- [ ] **Step 4: Add the panorama object and bidirectional coverage audit to module execution**

Add the internal object:

```yaml
chain_panorama_item:
  chain_level:
  subsegment:
  product_or_service:
  value_level:
  technical_barrier:
  competition_pattern:
  representative_participants:
  evidence_status:
```

Add `双向覆盖审计` requiring technology routes, constraints, value/profit links, increments, tracking links, and company-map subsegments to resolve to the panorama; each key panorama subsegment must have a verified subject or `未获取到`.

- [ ] **Step 5: Extend quality checks**

Add checklist items under analysis completeness and expression quality:

```markdown
- [ ] 上游、中游、下游只作为导航层级，同一层级已按重要子环节重复多行。
- [ ] 不存在产品、标准、客户、约束、利润机制和代表主体明显不同却共用一行的过度压缩。
- [ ] 已完成产业链全景与技术路线、约束、价值量、主要增量、跟踪环节和公司映射的双向覆盖审计。
- [ ] 证据不足的关键子环节被独立保留并标记缺口，没有通过合并隐藏。
```

- [ ] **Step 6: Run the validator and confirm it still fails only on the template contract**

Run:

```powershell
python tests/validate_bbxm_industry_company_mapping.py
```

Expected: `FAIL` with `industry template is missing chain-granularity contract`, demonstrating that the skill half is present while the template half remains RED.

### Task 3: Implement the display contract in `template.md`

**Files:**
- Modify: `.agents/skills/bbxm-industry-analysis/template.md`
- Test: `tests/validate_bbxm_industry_company_mapping.py`

- [ ] **Step 1: Increment the template version**

Change:

```yaml
version: 1.1.0
```

to:

```yaml
version: 1.2.0
```

- [ ] **Step 2: Add panorama filling rules below the `3.1` table**

Add concise instructions containing these exact behaviors:

```markdown
产业链全景填写规则：

- 上游、中游、下游是导航层级，不是每层一行的压缩配额；同一层级可以重复多行。
- 一个表格行只表达一个可比较子环节。产品或服务、技术或标准、客户、约束、价值与利润机制、竞争格局或代表主体任一项存在实质差异时必须拆行。
- 证据不足不能成为合并理由；关键子环节保留独立行并写“待验证”或“未获取到”。
- 不设固定最小行数；拆分深度以能否独立判断价值量、瓶颈、利润和竞争格局为准。
```

- [ ] **Step 3: Add the bidirectional coverage audit below the panorama rules**

Add:

```markdown
双向覆盖审计：技术路线、核心约束、价值量与利润池、主要增量、最值得跟踪环节及公司映射中的重要子环节，都应能回指产业链全景；产业链全景中的关键子环节也应在公司映射中有可核验主体，缺失时明确写“未获取到”。
```

- [ ] **Step 4: Add one compact anti-compression example**

State that `AI 芯片、存储、光模块、交换机、液冷供电` cannot share a row when their products, standards, customers, bottlenecks, profit mechanisms, and participants differ. Mark the example as methodological rather than a fixed industry taxonomy.

- [ ] **Step 5: Run the validator and confirm GREEN**

Run:

```powershell
python tests/validate_bbxm_industry_company_mapping.py
```

Expected: `PASS: industry company mapping contract is present`.

- [ ] **Step 6: Commit the skill and template implementation**

```powershell
git add .agents/skills/bbxm-industry-analysis/SKILL.md .agents/skills/bbxm-industry-analysis/template.md
git commit -m "fix: preserve industry chain subsegment granularity"
```

### Task 4: Run regression and rendering verification

**Files:**
- Verify: `.agents/skills/bbxm-industry-analysis/SKILL.md`
- Verify: `.agents/skills/bbxm-industry-analysis/template.md`
- Verify: `tests/validate_bbxm_industry_company_mapping.py`
- Verify: `.agents/skills/bbxm-industry-analysis/scripts/test-render-industry-report-html.cjs`

- [ ] **Step 1: Run the industry and project contract validators**

```powershell
python tests/validate_bbxm_industry_company_mapping.py
python tests/validate_bbxm_project_skills.py
```

Expected: both commands print `PASS` and exit with code `0`.

- [ ] **Step 2: Run the dedicated HTML renderer test**

```powershell
node .agents/skills/bbxm-industry-analysis/scripts/test-render-industry-report-html.cjs
```

Expected: exit code `0` and renderer assertions pass.

- [ ] **Step 3: Check encoding, replacement characters, and whitespace**

```powershell
rg -n "�|鍐|鐭|鎯|灏" .agents/skills/bbxm-industry-analysis/SKILL.md .agents/skills/bbxm-industry-analysis/template.md tests/validate_bbxm_industry_company_mapping.py
git diff --check
```

Expected: the mojibake scan returns no matches and `git diff --check` returns no errors attributable to task files.

- [ ] **Step 4: Inspect the task-only diff**

```powershell
git diff HEAD~2 -- .agents/skills/bbxm-industry-analysis/SKILL.md .agents/skills/bbxm-industry-analysis/template.md tests/validate_bbxm_industry_company_mapping.py docs/superpowers/plans/2026-07-21-industry-chain-granularity-contract.md
```

Expected: every changed line traces to the approved granularity contract; no framework modules or unrelated report sections change.

- [ ] **Step 5: Commit the implementation plan if it remains uncommitted**

```powershell
git add docs/superpowers/plans/2026-07-21-industry-chain-granularity-contract.md
git commit -m "docs: plan industry chain granularity contract"
```
