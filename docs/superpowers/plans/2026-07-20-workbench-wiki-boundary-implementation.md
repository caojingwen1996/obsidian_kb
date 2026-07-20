# Workbench 与 Wiki 边界迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仓库根目录建立与 `wiki/` 同级的 `workbench/`，迁出个股研报与动态研究产物，恢复冰冰小美 Wiki 的知识边界，并把未来个股研究默认输出改到 Workbench。

**Architecture:** `wiki/` 继续使用八类正式页面承载冰冰小美框架；`workbench/targets/<证券代码>-<公司简称>/` 按标的承载研报、跟踪、来源、模型和输出。根索引与工作台索引分离，Workbench 可以引用 Wiki 框架，但只有经过回流门槛的可复用规律才进入 Wiki。

**Tech Stack:** Obsidian Markdown、YAML frontmatter、PowerShell、Python 3 静态契约测试、Git。

**Design:** `docs/superpowers/specs/2026-07-20-workbench-wiki-boundary-design.md`

---

## 执行前约束

当前主工作区包含用户未提交内容，其中 `index.md`、`log.md`、中国船舶研报和三安光电研报与迁移范围重叠。执行时必须遵守：

1. 不从干净 worktree 覆盖当前工作区版本；除非用户先独立提交这些修改，否则在当前工作区执行。
2. 每次提交只暂存本任务列出的文件；使用 `git diff --cached --name-only` 审核。
3. 移动前记录源文件哈希，移动后验证哈希一致。
4. 不使用 `git reset --hard`、`git checkout --` 或批量覆盖。
5. `index.md` 和 `log.md` 以当前工作区内容为基线做增量编辑。

## 文件结构锁定

### 新建

- `workbench/AGENTS.md`：工作台总合同与知识回流门槛。
- `workbench/index.md`：全部标的导航。
- `workbench/templates/target-index-template.md`：标的入口模板。
- `workbench/templates/equity-report-template.md`：工作台研报模板入口说明。
- `workbench/templates/tracking-node-template.md`：操作逻辑变化节点模板。
- `tests/validate_workbench_boundary.py`：目录、路由、迁移和编码契约测试。

### 修改

- `AGENTS.md`：增加任务进入 Wiki 或 Workbench 的第一路由判断。
- `schema.md`：收紧正式 Wiki 边界，并声明 Workbench 不是正式页面类型。
- `page-types.md`：禁止把个股研报和动态跟踪默认建成 Query/Event/Timeline。
- `templates/README.md`：声明本目录仅服务正式 Wiki，个股模板在 Workbench。
- `.agents/skills/bbxm-equity-research/SKILL.md`：默认落盘改到 Workbench。
- `.agents/skills/bbxm-equity-research/template.md`：增加 Workbench frontmatter。
- `.agents/skills/bbxm-equity-research/agents/openai.yaml`：默认提示包含 Workbench 路由。
- `tests/validate_bbxm_project_skills.py`：校验个股研究输出合同。
- `index.md`：移除个股研报导航。
- `hot.md`：更新仍需保留的历史链接，不把个股研报作为 Wiki 热点入口。
- `.obsidian/graph.json`：默认过滤 `workbench`。
- `log.md`：记录边界调整、迁移数量和遗留项。

### 移动

正式 `wiki/queries/` 中14份研报移动到对应标的 `reports/`；目标路径见 Task 5。历史自动化研报和 HTML 按 Task 8 迁入对应标的目录。

---

### Task 1: 建立失败的边界契约测试

**Files:**
- Create: `tests/validate_workbench_boundary.py`

- [ ] **Step 1: 写入静态契约测试**

创建以下测试脚本。报告映射必须使用精确路径：

```python
from pathlib import Path
import json
import re
import sys


ROOT = Path(__file__).resolve().parents[1]

REPORTS = {
    "2026-07-15-1514-华明装备机构级决策研报.md": "002270-华明装备",
    "2026-07-15-1921-云铝股份机构级决策研报.md": "000807-云铝股份",
    "2026-07-16-1021-神马电力-机构级决策研报.md": "603530-神马电力",
    "2026-07-16-1117-紫光股份-机构级决策研报.md": "000938-紫光股份",
    "2026-07-16-1136-浪潮信息-机构级决策研报.md": "000977-浪潮信息",
    "2026-07-16-1138-东阳光-机构级决策研报.md": "600673-东阳光",
    "2026-07-16-1334-中国中车机构级决策研报.md": "601766-中国中车",
    "2026-07-16-1336-中材科技-机构级决策研报.md": "002080-中材科技",
    "2026-07-17-1133-中国船舶机构级决策研报.md": "600150-中国船舶",
    "2026-07-17-1134-三花智控-机构级决策研报.md": "002050-三花智控",
    "2026-07-17-1450-东材科技-机构级决策研报.md": "601208-东材科技",
    "2026-07-17-1521-电科蓝天-机构级决策研报.md": "688818-电科蓝天",
    "2026-07-17-1539-上海瀚讯-机构级决策研报.md": "300762-上海瀚讯",
    "2026-07-20-1005-三安光电-机构级决策研报.md": "600703-三安光电",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    workbench = ROOT / "workbench"
    for relative in (
        "AGENTS.md",
        "index.md",
        "templates/target-index-template.md",
        "templates/equity-report-template.md",
        "templates/tracking-node-template.md",
    ):
        require((workbench / relative).is_file(), f"missing Workbench contract: {relative}")

    query_dir = ROOT / "wiki" / "queries"
    remaining = sorted(path.name for path in query_dir.glob("*机构级决策研报.md"))
    require(not remaining, f"equity reports remain in wiki/queries: {remaining}")

    for filename, target in REPORTS.items():
        report = workbench / "targets" / target / "reports" / filename
        require(report.is_file(), f"migrated report missing: {report.relative_to(ROOT)}")
        text = report.read_text(encoding="utf-8-sig")
        require("artifact_type: equity_research" in text, f"missing artifact_type: {filename}")
        require(not re.search(r"^type:\s*(query|event|timeline)\s*$", text, re.M), f"wiki type leaked into Workbench: {filename}")

    root_index = (ROOT / "index.md").read_text(encoding="utf-8-sig")
    require("机构级决策研报" not in root_index, "root index still lists equity reports")

    equity_skill = (ROOT / ".agents/skills/bbxm-equity-research/SKILL.md").read_text(encoding="utf-8-sig")
    require("workbench/targets/<证券代码>-<公司简称>/reports/" in equity_skill, "equity skill lacks Workbench output contract")
    require("正式研报放入合适的 `wiki/` 页面类型" not in equity_skill, "equity skill keeps stale Wiki output contract")

    graph = json.loads((ROOT / ".obsidian/graph.json").read_text(encoding="utf-8-sig"))
    require(graph.get("search") == '-path:"workbench"', "graph does not exclude Workbench")

    runtime = "".join(path.read_text(encoding="utf-8-sig") for path in (workbench / "templates").glob("*.md"))
    require(not any(marker in runtime for marker in ("�", "鍐", "鐭", "鎯", "灏")), "Workbench templates contain mojibake")

    print("PASS: Workbench and Wiki boundary validated")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
```

- [ ] **Step 2: 运行测试并确认红灯**

Run:

```powershell
python tests/validate_workbench_boundary.py
```

Expected: exit code `1`，首个错误为 `missing Workbench contract: AGENTS.md`。

- [ ] **Step 3: 仅提交测试**

```powershell
git add -- tests/validate_workbench_boundary.py
git diff --cached --name-only
git commit -m "test: define workbench wiki boundary"
```

Expected staged file: only `tests/validate_workbench_boundary.py`。

---

### Task 2: 创建 Workbench 合同与模板

**Files:**
- Create: `workbench/AGENTS.md`
- Create: `workbench/index.md`
- Create: `workbench/templates/target-index-template.md`
- Create: `workbench/templates/equity-report-template.md`
- Create: `workbench/templates/tracking-node-template.md`

- [ ] **Step 1: 创建 `workbench/AGENTS.md`**

文件必须明确以下不可变规则：

```markdown
# Investment Workbench 工作说明

## 定位

`workbench/` 与 `wiki/` 同级，承载具体标的研究、估值、跟踪和操作记录。这里的内容具有时效性，不属于冰冰小美正式知识页。

## 路由

- 具体公司研报、DCF、公告跟踪、价格变化、持仓动作进入 `workbench/`。
- 冰冰小美概念、观点、推导和框架演化进入 `wiki/`。
- Workbench 工件不得使用 `type: query`、`type: event` 或 `type: timeline`。

## 标的目录

使用 `targets/<证券代码>-<公司简称>/`，其下固定为 `index.md`、`reports/`、`tracking/`、`sources/`、`models/`、`outputs/`。

## 知识回流

只有直接解释冰冰小美原文、在多个标的重复验证、能说明既有框架变量，或经用户明确批准的规律，才能回流 `wiki/`。回流只提炼规律和必要案例，不复制整份研报。

## 更新规则

同一标的的当前权威研报原地更新；影响操作逻辑的增量进入 `tracking/YYYY-MM-DD-事件.md`。所有关键断言必须链接来源并保留抓取时间、口径和不确定性。
```

- [ ] **Step 2: 创建根工作台索引**

`workbench/index.md` 使用以下固定结构，Task 6 再填入全部标的链接：

```markdown
# Investment Workbench Index

本页只导航个股研究与动态决策工件，不属于冰冰小美正式知识索引。

## 标的

## 使用规则

- 当前判断以各标的 `reports/` 中的权威研报为准。
- 判断变化记录在 `tracking/`。
- 可复用规律满足回流门槛后，才进入根目录 `wiki/`。
```

- [ ] **Step 3: 创建三个模板**

`target-index-template.md` 必须包含：证券身份、当前研报、当前动作、估值区间、最近跟踪节点、下一验证点、框架引用。

`equity-report-template.md` 不复制16模块正文，只声明：

````markdown
# Workbench 个股研报模板

正式正文使用 `.agents/skills/bbxm-equity-research/template.md`。保存时增加：

```yaml
---
artifact_type: equity_research
security_code: ""
market: ""
created: YYYY-MM-DDTHH:mm:ss+08:00
updated: YYYY-MM-DDTHH:mm:ss+08:00
as_of: YYYY-MM-DDTHH:mm:ss+08:00
framework_refs: []
---
```

目标路径：`workbench/targets/<证券代码>-<公司简称>/reports/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md`。
````

`tracking-node-template.md` 必须包含：触发事件、新增证据、原逻辑状态、估值影响、操作影响、下一验证节点、来源和不确定性；状态只允许 `强化 / 不变 / 减弱 / 证伪 / 证据不足`。

- [ ] **Step 4: 运行测试确认失败点推进**

```powershell
python tests/validate_workbench_boundary.py
```

Expected: 不再报 `missing Workbench contract`，下一失败为仍有研报位于 `wiki/queries/`。

- [ ] **Step 5: 提交 Workbench 骨架**

```powershell
git add -- workbench/AGENTS.md workbench/index.md workbench/templates
git commit -m "feat: add investment workbench structure"
```

---

### Task 3: 收紧根 Wiki 路由契约

**Files:**
- Modify: `AGENTS.md`
- Modify: `schema.md`
- Modify: `page-types.md`
- Modify: `templates/README.md`

- [ ] **Step 1: 在 `AGENTS.md` 增加第一路由判断**

在目录结构和 ingest 流程之前增加：

```markdown
### Wiki / Workbench 前置路由

任何写入前先判断内容主责：

- 冰冰小美概念、观点、推导、时间演化和主题地图进入 `wiki/`；
- 具体标的研报、估值、公告跟踪、行情变化、资金快照和操作记录进入同级 `workbench/`；
- 具体标的材料只有被提炼为可复用框架规律并满足 Workbench 回流门槛时，才更新正式 Wiki；
- 不得为个股研报在 `wiki/queries/` 新建页面，也不得为普通个股公告在 `wiki/events/` 新建页面。
```

- [ ] **Step 2: 修改 `schema.md` 知识库边界**

将“两条长期主线”收紧为冰冰小美知识框架，并增加 `workbench/` 同级目录说明。明确八类 `type` 只适用于 `wiki/`；Workbench 使用 `artifact_type`。

- [ ] **Step 3: 修改 `page-types.md` 选择规则**

在 Query、Event、Timeline 的选择规则加入三个反例：

```text
个股完整研报 → Workbench equity_research，不是 Query Page
普通公司公告及其价格反应 → Workbench tracking，不是 Event Page
单一标的持续操作记录 → Workbench tracking，不是 Timeline Page
```

- [ ] **Step 4: 修改模板索引**

在 `templates/README.md` 声明这里仅保存正式 Wiki 八类模板，并链接 `workbench/templates/`。

- [ ] **Step 5: 定向检查规则一致性并提交**

```powershell
rg -n "workbench|个股研报|普通公司公告" AGENTS.md schema.md page-types.md templates/README.md
git diff --check -- AGENTS.md schema.md page-types.md templates/README.md
git add -- AGENTS.md schema.md page-types.md templates/README.md
git commit -m "docs: separate wiki from investment workbench"
```

Expected: 四个文件都出现 Workbench 路由，`git diff --check` 无输出。

---

### Task 4: 改写个股研究技能的输出合同

**Files:**
- Modify: `.agents/skills/bbxm-equity-research/SKILL.md`
- Modify: `.agents/skills/bbxm-equity-research/template.md`
- Modify: `.agents/skills/bbxm-equity-research/agents/openai.yaml`
- Modify: `tests/validate_bbxm_project_skills.py`

- [ ] **Step 1: 先扩展技能契约测试**

在 `tests/validate_bbxm_project_skills.py` 的 `equity_skill` 检查后加入：

```python
    for marker in (
        "workbench/targets/<证券代码>-<公司简称>/reports/",
        "artifact_type: equity_research",
        "workbench/index.md",
        "不更新根 index.md",
    ):
        require(marker in equity_skill, f"bbxm-equity-research is missing Workbench contract: {marker}")
    require(
        "正式研报放入合适的 `wiki/` 页面类型" not in equity_skill,
        "bbxm-equity-research still routes reports into formal Wiki",
    )
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
python tests/validate_bbxm_project_skills.py
```

Expected: FAIL，提示缺少 `workbench/targets/<证券代码>-<公司简称>/reports/`。

- [ ] **Step 3: 修改 `SKILL.md` Step 8**

将旧的 llmwiki 落盘段落替换为：

```markdown
在 llmwiki 中，个股研报不是正式 Wiki 页面。默认保存到：

`workbench/targets/<证券代码>-<公司简称>/reports/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md`

frontmatter 必须包含 `artifact_type: equity_research`。标的首次建立时同步创建或更新该标的 `index.md` 和 `workbench/index.md`，但不更新根 `index.md`。具体标的原始材料优先进入同一标的 `sources/`；已被正式 Wiki 使用的共享来源保留根 `sources/`。只有满足 `workbench/AGENTS.md` 回流门槛的可复用规律才更新正式 Wiki。
```

- [ ] **Step 4: 修改研报模板与 UI 提示**

在 `.agents/skills/bbxm-equity-research/template.md` 顶部加入 Workbench frontmatter；在 `openai.yaml` 的 `default_prompt` 中追加 `Save the report under the target's workbench directory.`。

- [ ] **Step 5: 运行技能测试和 HTML 回归测试**

```powershell
python tests/validate_bbxm_project_skills.py
node .agents/skills/bbxm-equity-research/scripts/test-render-report-html.cjs
```

Expected:

```text
PASS: bbxm-expert project-only skill contract validated
```

HTML 测试 exit code `0`。

- [ ] **Step 6: 提交技能合同**

```powershell
git add -- .agents/skills/bbxm-equity-research tests/validate_bbxm_project_skills.py
git commit -m "fix: route equity research to workbench"
```

---

### Task 5: 迁移14份正式个股研报

**Files:**
- Move: `wiki/queries/*机构级决策研报.md` → `workbench/targets/*/reports/`
- Modify: moved reports' frontmatter

- [ ] **Step 1: 记录迁移前哈希和状态**

```powershell
git status --short --branch
Get-ChildItem -LiteralPath 'wiki\queries' -File | Where-Object { $_.Name -match '机构级决策研报' } | Sort-Object Name | Get-FileHash -Algorithm SHA256
```

Expected: 14 files；中国船舶可能为已修改，三安光电可能为未跟踪，必须以当前工作区版本为迁移源。

- [ ] **Step 2: 创建14个标的目录**

对 Task 1 `REPORTS` 中的每个目标创建 `reports/`、`tracking/`、`sources/`、`models/`、`outputs/`。不得创建 `wiki/workbench/`。

- [ ] **Step 3: 按精确映射移动文件**

对已跟踪的13份报告使用 `git mv`；对未跟踪的三安光电报告使用 PowerShell `Move-Item -LiteralPath`。目标为：

```text
workbench/targets/002270-华明装备/reports/2026-07-15-1514-华明装备机构级决策研报.md
workbench/targets/000807-云铝股份/reports/2026-07-15-1921-云铝股份机构级决策研报.md
workbench/targets/603530-神马电力/reports/2026-07-16-1021-神马电力-机构级决策研报.md
workbench/targets/000938-紫光股份/reports/2026-07-16-1117-紫光股份-机构级决策研报.md
workbench/targets/000977-浪潮信息/reports/2026-07-16-1136-浪潮信息-机构级决策研报.md
workbench/targets/600673-东阳光/reports/2026-07-16-1138-东阳光-机构级决策研报.md
workbench/targets/601766-中国中车/reports/2026-07-16-1334-中国中车机构级决策研报.md
workbench/targets/002080-中材科技/reports/2026-07-16-1336-中材科技-机构级决策研报.md
workbench/targets/600150-中国船舶/reports/2026-07-17-1133-中国船舶机构级决策研报.md
workbench/targets/002050-三花智控/reports/2026-07-17-1134-三花智控-机构级决策研报.md
workbench/targets/601208-东材科技/reports/2026-07-17-1450-东材科技-机构级决策研报.md
workbench/targets/688818-电科蓝天/reports/2026-07-17-1521-电科蓝天-机构级决策研报.md
workbench/targets/300762-上海瀚讯/reports/2026-07-17-1539-上海瀚讯-机构级决策研报.md
workbench/targets/600703-三安光电/reports/2026-07-20-1005-三安光电-机构级决策研报.md
```

- [ ] **Step 4: 修改 Workbench frontmatter**

逐份把 `type: query` 替换为 `artifact_type: equity_research`；没有 `type: query` 的报告在 frontmatter 增加 `artifact_type: equity_research`。保留 `created`、`updated`、`sources`、`related` 和正文结论。

- [ ] **Step 5: 验证内容哈希变化仅来自 frontmatter**

使用 `git diff --no-renames` 检查14份报告：除路径和 frontmatter 类型字段外，不得改写正文。中国船舶与三安光电原有未提交内容必须仍存在。

- [ ] **Step 6: 运行边界测试确认进入下一失败点**

```powershell
python tests/validate_workbench_boundary.py
```

Expected: 14份报告路径和 `artifact_type` 检查通过；下一失败为根 `index.md` 仍列出研报。

- [ ] **Step 7: 提交报告迁移**

仅暂存14份源路径删除和14份目标路径新增，确认没有 `index.md`、`log.md` 或自动化文件混入。

```powershell
git diff --cached --name-only
git commit -m "refactor: move equity reports into workbench"
```

---

### Task 6: 创建标的入口与 Workbench 索引

**Files:**
- Create: `workbench/targets/*/index.md` for 14 migrated targets
- Modify: `workbench/index.md`

- [ ] **Step 1: 为14个标的创建 `index.md`**

每页使用真实证券代码、公司简称和迁移后的研报链接。固定结构：

```markdown
# <公司简称>研究工作台

## 证券身份

- 证券代码：<代码>
- 当前权威研报：[[workbench/targets/<代码>-<公司>/reports/<文件名>|<公司>机构级决策研报]]

## 当前动作与估值

以当前权威研报的“决策摘要”和“最终结论”为准。

## 跟踪节点

- 暂无新增跟踪节点。

## 下一验证点

- 读取当前权威研报“后续监控指标”。

## 框架引用

- 后续按实际使用的冰冰小美 Concept / Reasoning Page 补充，不制造空链接。
```

- [ ] **Step 2: 填充 `workbench/index.md`**

按证券代码排序列出14个入口，格式为：

```markdown
- [[workbench/targets/000807-云铝股份/index|云铝股份（000807.SZ）]]
```

其余13个标的使用 Task 1 的代码和公司简称生成同格式链接。

- [ ] **Step 3: 检查链接目标并提交**

```powershell
python -c "from pathlib import Path; p=Path('workbench/index.md').read_text(encoding='utf-8-sig'); assert p.count('/index|') == 14"
git add -- workbench/index.md workbench/targets/*/index.md
git commit -m "docs: index workbench research targets"
```

Expected: assertion passes；提交只包含15个索引文件。

---

### Task 7: 修复根索引、历史热点和反向链接

**Files:**
- Modify: `index.md`
- Modify: `hot.md`
- Modify: `wiki/timelines/cjw-电网设备-变压器.md`
- Modify: `wiki/queries/2026-07-16-神马电力文章逻辑下的华明装备对比分析.md`
- Modify: moved `workbench/targets/688818-电科蓝天/reports/2026-07-17-1521-电科蓝天-机构级决策研报.md`
- Modify: source snapshot pages containing moved paths

- [ ] **Step 1: 移除根索引中的个股研报入口**

从 `index.md` 删除14份已迁移研报及不存在的 `2026-07-15-1433-航天电子机构级决策研报` 条目。保留同一分区内所有非个股 Query Page。

- [ ] **Step 2: 修复华明装备反向链接**

将以下文件中的旧链接：

```text
[[wiki/queries/2026-07-15-1514-华明装备机构级决策研报|华明装备机构级决策研报]]
```

替换为：

```text
[[workbench/targets/002270-华明装备/reports/2026-07-15-1514-华明装备机构级决策研报|华明装备机构级决策研报]]
```

目标文件为 `wiki/timelines/cjw-电网设备-变压器.md` 和 `wiki/queries/2026-07-16-神马电力文章逻辑下的华明装备对比分析.md`。

- [ ] **Step 3: 处理已不存在的航天电子 Markdown 链接**

不恢复历史已删除文件。删除根 `index.md` 和 `hot.md` 的失效入口；在电科蓝天迁移后研报中，将失效 Wikilink 改为普通文字“航天电子对照研究（原 Markdown 当前不在工作区，待后续从已有 HTML 归档恢复）”，保留对照语义。

- [ ] **Step 4: 更新其他精确旧路径**

运行：

```powershell
rg -n "wiki/queries/.*机构级决策研报|\[\[queries/.*机构级决策研报" --glob "*.md" .
```

对结果中的14份已迁移研报逐一替换成 Workbench 路径；`log.md` 中的历史操作记录不回写旧文本，除非其链接需要保持可点击。

- [ ] **Step 5: 运行测试并提交链接修复**

```powershell
python tests/validate_workbench_boundary.py
rg -n "wiki/queries/.*机构级决策研报|\[\[queries/.*机构级决策研报" --glob "*.md" --glob "!log.md" .
git diff --check -- index.md hot.md wiki workbench
```

Expected: 边界测试只剩图谱或技能相关失败；排除 `log.md` 后没有旧研报路径。

提交：

```powershell
git add -- index.md hot.md wiki/timelines/cjw-电网设备-变压器.md wiki/queries/2026-07-16-神马电力文章逻辑下的华明装备对比分析.md workbench/targets/688818-电科蓝天/reports
git commit -m "fix: update links after workbench migration"
```

---

### Task 8: 归位历史自动化个股研报与输出

**Files:**
- Move: individual report Markdown/HTML from `sources/automations/支柱产业/`
- Move: individual report Markdown/HTML from `sources/automations/temp/`
- Move: individual report Markdown/HTML from `sources/automations/商业航天每日跟踪/`
- Modify: `workbench/index.md`

- [ ] **Step 1: 迁移已知支柱产业与临时输出**

精确映射：

```text
中国中车两份 HTML → workbench/targets/601766-中国中车/outputs/
中国船舶资金面 HTML 与研报 HTML → workbench/targets/600150-中国船舶/outputs/
神马电力两份 HTML → workbench/targets/603530-神马电力/outputs/
三安光电 HTML 与重复 Markdown 成品 → workbench/targets/600703-三安光电/outputs/
```

源文件名保持不变。若自动化脚本仍依赖旧路径，先在 `log.md` 记录为遗留项，不移动该文件；不得让自动化静默失效。

- [ ] **Step 2: 迁移商业航天批量研报**

按以下证券代码建立标的目录；Markdown 进入 `reports/`，HTML 进入 `outputs/`：

```text
600118-中国卫星
601698-中国卫通
300627-华测导航
688375-国博电子
600435-北方导航
688333-铂力特
002025-航天电器
300672-国科微
688568-中科星图
300136-信维通信
002151-北斗星通
002405-四维图新
300593-新雷能
688523-航天环宇
600879-航天电子
688521-芯原股份
300762-上海瀚讯
688818-电科蓝天
```

文件名公司简称与目标目录必须一致。只有 HTML、没有 Markdown 的标的把 HTML 放入 `outputs/`，并在标的 `index.md` 写“当前仅有 HTML 归档，Markdown 待恢复”，不得伪造 Markdown。

- [ ] **Step 3: 为新增标的创建入口并更新总索引**

沿用 Task 6 的标的入口结构；没有 Markdown 的标的把“当前权威研报”改为现有 HTML 输出链接并明确格式。

- [ ] **Step 4: 验证 `sources/automations` 不再承担研报正文目录**

```powershell
Get-ChildItem -LiteralPath 'sources\automations' -Recurse -File | Where-Object { $_.Name -match '机构级决策研报|资金面分层分析' } | Select-Object FullName
```

Expected: 无结果；如因自动化合同保留文件，输出必须逐项记录在 `log.md` 的“后续待办”。

- [ ] **Step 5: 提交历史产物迁移**

只暂存 Workbench 目标文件、对应源文件删除和 `workbench/index.md`，提交：

```powershell
git commit -m "refactor: consolidate legacy equity research outputs"
```

---

### Task 9: 配置图谱隔离并完成总验证

**Files:**
- Modify: `.obsidian/graph.json`
- Modify: `log.md`

- [ ] **Step 1: 设置图谱默认过滤**

将 `.obsidian/graph.json` 的：

```json
"search": ""
```

改为：

```json
"search": "-path:\"workbench\""
```

- [ ] **Step 2: 追加迁移日志**

在 `log.md` 追加 `refactor / migrate / link / rule` 记录，列明：

- `workbench/` 与 `wiki/` 同级建立；
- 迁移的正式研报数量；
- 迁移的历史 Markdown、HTML 和资金面输出数量；
- 已修改的技能输出合同；
- 已修复的反向链接；
- 因自动化依赖未移动的文件清单；
- 未恢复的航天电子 Markdown 历史缺口。

- [ ] **Step 3: 运行完整验证**

```powershell
python tests/validate_workbench_boundary.py
python tests/validate_bbxm_project_skills.py
node .agents/skills/bbxm-equity-research/scripts/test-render-report-html.cjs
rg -n "^(<<<<<<<|=======|>>>>>>>)" workbench AGENTS.md schema.md page-types.md index.md hot.md
rg -n "鍐|鐭|鎯|灏|�" workbench AGENTS.md schema.md page-types.md
git diff --check
```

Expected:

```text
PASS: Workbench and Wiki boundary validated
PASS: bbxm-expert project-only skill contract validated
```

HTML 测试 exit code `0`；冲突标记、乱码扫描和 `git diff --check` 无输出。

- [ ] **Step 4: 验证用户原有修改仍存在**

核对拉取后已存在的中证红利文件、`sources/automations/BBXM每日汇总/2026-07-20/`、中国船舶当前研报内容和三安光电研究文件。不得以“迁移完成”为由丢弃或覆盖这些内容。

- [ ] **Step 5: 最终提交**

```powershell
git add -- .obsidian/graph.json log.md
git diff --cached --name-only
git commit -m "docs: record workbench boundary migration"
```

Expected staged files: only `.obsidian/graph.json` and `log.md`。

- [ ] **Step 6: 生成完成报告**

报告必须包含：

- 迁移的正式研报数量；
- Workbench 标的数量；
- Markdown / HTML / 模型迁移数量；
- 未迁移文件及原因；
- 断链、编码和测试结果；
- 当前分支和提交列表；
- 用户原有未提交修改状态。
