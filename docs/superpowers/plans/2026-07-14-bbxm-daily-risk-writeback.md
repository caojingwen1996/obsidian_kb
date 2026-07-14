# BBXM 每日风险提示自动写入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让冰冰小美每日抓取任务在完整分析当天全部已保存帖子后，将 R1/R2/R3 风险提示幂等写入固定 Excel，并保留可重试的结构化状态。

**Architecture:** 每日任务负责生成 `processing/risk-analysis.json`，独立 Python 更新器只负责校验该契约并原子更新 Excel 中带固定标记的自动行。更新器不读取自然语言 `summary.md`，也不修改同日人工行；所有结果都写入 `risk-write-status.json`。

**Tech Stack:** Python 3.11、openpyxl、pytest、Markdown 自动化提示词。

---

## 文件结构

- Create: `tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py` — JSON 校验、自动行格式化、Excel 幂等更新、状态文件写入和 CLI。
- Create: `tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py` — 更新器成功、无风险、阻断、去重、人工行保留和替换失败测试。
- Create: `tools/bbxm-risk-dashboard/tests/test_automation_prompt.py` — 自动化提示词关键契约测试。
- Modify: `.agents/automations/bbxm_daliy_brief.md` — 增加完整性门禁、逐帖风险分析、更新器调用和收尾报告。
- Modify: `tools/bbxm-risk-dashboard/README.md` — 说明自动行标记、输入输出文件和占用重试行为。
- Modify: `log.md` — 记录本次 automation/tool 维护动作。

### Task 1: 更新器核心成功路径

**Files:**
- Create: `tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py`
- Create: `tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py`

- [ ] **Step 1: 写入首次写入、同日重跑和人工行保留的失败测试**

测试使用 `importlib.util.spec_from_file_location` 加载脚本，并构造真实临时 Excel：

```python
def test_upsert_writes_one_automatic_row_and_preserves_manual_row(tmp_path):
    workbook_path = make_book(tmp_path, [["2026-07-14", 1, "人工记录"]])
    analysis_path = write_analysis(tmp_path, qualified=[risk("post-1", "R2"), risk("post-2", "R1")])
    status_path = tmp_path / "risk-write-status.json"

    result = updater.update_workbook(analysis_path, workbook_path, status_path)

    assert result["status"] == "written"
    assert result["count"] == 2
    assert read_rows(workbook_path) == [
        ["2026-07-14", 1, "人工记录"],
        ["2026-07-14", 2, pytest.helpers.automatic_reason],
    ]
```

另写一条同日重跑测试：第二次分析只包含一个新结果，断言自动行更新为 1 且总行数不增加。

- [ ] **Step 2: 运行测试并确认因脚本不存在而失败**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py -v`

Expected: FAIL/ERROR，原因是 `scripts/upsert_automated_risk.py` 尚不存在。

- [ ] **Step 3: 实现最小成功路径**

脚本定义以下稳定接口和常量（函数体按本步骤下方算法一次实现）：

```python
AUTOMATED_PREFIX = "[自动分析｜冰冰小美每日任务]"
REQUIRED_COLUMNS = ("日期", "当日累计风险提示次数", "风险原因")

load_and_validate_analysis(path: Path) -> dict
format_automatic_reason(items: list[dict]) -> str
update_workbook(analysis_path: Path, workbook_path: Path, status_path: Path, *, replace_file=os.replace) -> dict
main(argv: list[str] | None = None) -> int
```

`update_workbook` 加载工作簿，定位三列，删除目标日期且原因以 `AUTOMATED_PREFIX` 开头的旧行，保留其他行；有合格风险时追加一行。保存到同目录临时 `.xlsx` 后调用 `replace_file(temp_path, workbook_path)`。

- [ ] **Step 4: 运行测试确认成功路径通过**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py -v`

Expected: 新增成功路径测试 PASS。

### Task 2: 数据契约、无风险和失败状态

**Files:**
- Modify: `tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py`
- Modify: `tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py`

- [ ] **Step 1: 写入数据契约和结果分支的失败测试**

增加参数化测试：

```python
@pytest.mark.parametrize("mutation", [
    lambda data: data.update(analysis_complete=False),
    lambda data: data["coverage"].update(saved_post_count=3),
    lambda data: data["qualified"][0].update(level="N"),
    lambda data: data["qualified"][0].update(source_file="", url=""),
])
def test_invalid_or_incomplete_analysis_is_blocked_without_excel_change(
    tmp_path, mutation
):
    workbook_path = make_book(tmp_path, [["2026-07-14", 1, "人工记录"]])
    original = workbook_path.read_bytes()
    data = valid_analysis(qualified=[risk("post-1", "R2")])
    mutation(data)
    analysis_path = write_json(tmp_path / "risk-analysis.json", data)
    status_path = tmp_path / "risk-write-status.json"

    result = updater.update_workbook(analysis_path, workbook_path, status_path)

    assert result["status"] == "blocked"
    assert workbook_path.read_bytes() == original
    assert json.loads(status_path.read_text(encoding="utf-8"))["status"] == "blocked"
```

另写五个具名测试：`test_empty_qualified_removes_only_existing_automatic_row`、`test_empty_qualified_without_existing_row_returns_no_risk`、`test_duplicate_equal_post_keys_count_once`、`test_duplicate_conflicting_post_keys_are_blocked`、`test_replace_failure_returns_pending_and_preserves_original`。每个测试都读取 `risk-write-status.json`，断言其 `status`、`count`、`target_date`、`analysis_file` 和 `workbook` 与返回值一致。

- [ ] **Step 2: 运行新增测试并确认预期失败**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py -v`

Expected: FAIL，失败点分别对应缺少契约校验、`removed/no_risk/blocked/pending` 分支或重复键处理。

- [ ] **Step 3: 实现完整校验和状态分支**

实现以下约束：

```python
ALLOWED_LEVELS = {"R1", "R2", "R3"}
ALLOWED_STATUSES = {"written", "no_risk", "removed", "pending", "blocked"}

def write_status(status_path: Path, payload: dict) -> None:
    status_path.parent.mkdir(parents=True, exist_ok=True)
    temp = status_path.with_suffix(status_path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, status_path)
```

校验 schema version、ISO 日期、author、coverage 算术、完整性、等级、必填风险字段、来源和重复键；分析不完整或契约无效写 `blocked`，替换失败写 `pending`，两者均保持原 Excel 字节不变。无风险时，有旧自动行返回 `removed`，无旧自动行返回 `no_risk`。

- [ ] **Step 4: 运行更新器全测试**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py -v`

Expected: 全部 PASS。

### Task 3: 自动化提示词契约

**Files:**
- Create: `tools/bbxm-risk-dashboard/tests/test_automation_prompt.py`
- Modify: `.agents/automations/bbxm_daliy_brief.md`

- [ ] **Step 1: 写入提示词失败测试**

```python
def test_daily_prompt_contains_risk_writeback_contract():
    text = PROMPT.read_text(encoding="utf-8")
    required = [
        "risk-analysis.json",
        "risk-write-status.json",
        "R1 / R2 / R3",
        "W1 / W2 / W3",
        "当天全部已保存帖子",
        "analysis_complete",
        "upsert_automated_risk.py",
        "pending",
        "## 风险提示判定",
    ]
    assert not [item for item in required if item not in text]
```

再断言提示词明确“不得额外联网”“不得把抓取不完整写成零风险”“不得结束 Excel 进程或删除锁文件”。

- [ ] **Step 2: 运行测试并确认缺少契约而失败**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_automation_prompt.py -v`

Expected: FAIL，列出当前提示词缺少的风险写入契约文本。

- [ ] **Step 3: 按设计扩展提示词**

在现有抓取规则之后新增“风险分析与写入”章节，包含：完整性门禁、当天完整集合重算、每帖最多一次、R1/R2/R3 写入、N/W/待验证不写、JSON 数据契约、更新器命令、状态分支、Excel 占用重试。把 `summary.md` 模板补充：

```markdown
## 风险提示判定

- 分析覆盖：已分析 X / 已保存 Y，未解决 Z
- 是否写入风险工具：是 / 否 / 待补写 / 已阻断
- 当日累计风险提示次数：N
- 风险等级分布：R1 × A，R2 × B，R3 × C
- 写入文件：`tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx`
- 待验证边界：无 / 具体说明
```

收尾要求报告目标日期、输出目录、原帖保存状态、summary 路径、分析覆盖、Excel 写入状态、失败和人工跟进项。

- [ ] **Step 4: 运行提示词契约测试**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_automation_prompt.py -v`

Expected: 全部 PASS。

### Task 4: 文档和维护日志

**Files:**
- Modify: `tools/bbxm-risk-dashboard/README.md`
- Modify: `log.md`

- [ ] **Step 1: 更新 README**

把“不自动生成风险判断”改为“网页本身不生成判断；每日任务可通过结构化分析写入带固定前缀的自动行”，并说明：

```markdown
## 每日任务自动写入

- 输入：`processing/risk-analysis.json`
- 状态：`processing/risk-write-status.json`
- 自动行标记：`[自动分析｜冰冰小美每日任务]`
- 同日重跑只替换自动行，人工行保持不变。
- Excel 被占用时状态为 `pending`，关闭占用后同日重跑。
```

- [ ] **Step 2: 追加 log.md 维护记录**

只追加一个 `2026-07-14` 的 `automation / tool` 条目，列出提示词、更新器、测试、README、设计与计划文件，并说明完整性门禁、幂等自动行和 pending 重试边界。

- [ ] **Step 3: 检查中文与 diff**

Run: `rg -n "鍐|鐭|鎯|灏|�" .agents/automations/bbxm_daliy_brief.md tools/bbxm-risk-dashboard/scripts tools/bbxm-risk-dashboard/tests tools/bbxm-risk-dashboard/README.md docs/superpowers/plans/2026-07-14-bbxm-daily-risk-writeback.md`

Expected: 无输出。

Run: `git diff --check -- .agents/automations/bbxm_daliy_brief.md tools/bbxm-risk-dashboard docs/superpowers/plans/2026-07-14-bbxm-daily-risk-writeback.md log.md`

Expected: exit 0。

### Task 5: 全量验证与提交

**Files:**
- Verify only: all task files above

- [ ] **Step 1: 运行专项测试**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests/test_automated_risk_updater.py tools/bbxm-risk-dashboard/tests/test_automation_prompt.py -v`

Expected: 全部 PASS。

- [ ] **Step 2: 运行仪表盘回归测试和编译检查**

Run: `python -m pytest tools/bbxm-risk-dashboard/tests -v`

Expected: 全部 PASS。

Run: `python -m compileall tools/bbxm-risk-dashboard/bbxm_dashboard tools/bbxm-risk-dashboard/scripts tools/bbxm-risk-dashboard/run.py`

Expected: exit 0，无编译错误。

- [ ] **Step 3: 验证 CLI 不接触真实 Excel**

在临时目录复制 Excel 并生成最小合格分析 JSON，然后运行：

```powershell
python tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py --analysis-file <temp-analysis> --workbook <temp-workbook> --status-file <temp-status>
```

Expected: exit 0，临时状态文件为 `written`；项目真实 Excel 和打开中的锁文件不变。

- [ ] **Step 4: 只暂存本任务文件并提交**

先确认 cached 为空，再逐个 `git add -- <task-file>`；检查 `git diff --cached --name-only` 只包含本计划列出的文件。提交信息：

```text
feat: write bbxm daily risk alerts to dashboard
```
