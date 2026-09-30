# Theme Workflow

## 1. Purpose

`theme` 模式用于围绕一个已经明确的 Theme，主动查找、筛选和组织与该 Theme 相关的事实信息。

该模式的起点是一个已知的分析主题或核心问题。系统根据 Theme 中定义的核心问题、关键变量、驱动因素和传导结构，确定需要观察的信息方向，并围绕这些方向进行信息检索和证据整理。

`theme` 模式主要回答：

> 当前有哪些事实能够支持、补充、削弱或重新解释这个 Theme？

该模式重点关注当前可获得的信息和证据，不依赖历史存储，也不负责跨运行维护 Theme 状态。


---

## 2. Entry Conditions

```text
mode = theme
input = Theme
```

输入 Theme 应至少提供能够指导信息搜索的核心结构，例如：

```text
theme_name
core_question
core_variables
```

Theme 还可以包含：

```text
common_driver
transmission_structure
open_questions
```

这些信息可以进一步帮助系统确定搜索方向。

执行和结果约定见 [SKILL.md 的 theme 入口](../SKILL.md#theme-执行入口)。本模式输出 [ThemeProcessingResult](../schemas/theme-processing-result.schema.json)，由统一 `scripts/validate_result.py` 按 `mode = theme` 校验；feed 结果 Schema 继续仅用于 feed。


---

## 3. Core Idea

`theme` 模式采用自上而下的信息处理方式。

```text
Theme
  ↓
确定需要观察的问题和变量
  ↓
生成搜索方向
  ↓
获取相关信息
  ↓
提取 Event
  ↓
提取 Signal
  ↓
判断 Evidence 与 Theme 的关系
  ↓
生成 Theme Findings
```

Theme 在该模式中承担信息组织中心的作用。

Event 和 Signal 都围绕 Theme 的核心问题进行筛选和解释。


---

## 4. Theme Interpretation

首先解析输入 Theme，识别本次分析需要回答的问题。

重点关注：

```text
core_question
core_variables
common_driver
transmission_structure
open_questions
```

例如：

```text
Theme:
AI 基础设施扩张的融资可持续性

Core Question:
持续增长的 AI CapEx 是否正在对大型科技公司的融资能力形成压力？

Core Variables:
- ai_capex
- debt_financing
- free_cash_flow
- funding_cost
- credit_quality
```

系统可以据此确定需要查找的事实类型。


---

## 5. Search Planning

根据 Theme 生成信息搜索计划。

Search Planning 需要确定：

```text
需要观察哪些变量？
哪些事实可以反映这些变量？
哪些主体需要被观察？
哪些信息可以验证 Theme 的传导结构？
哪些信息可能构成反向证据？
```

例如：

```text
ai_capex
→ 查找资本开支变化

debt_financing
→ 查找发债、贷款和其他融资行为

free_cash_flow
→ 查找经营现金流、自由现金流变化

funding_cost
→ 查找债券票息、信用利差、融资成本

credit_quality
→ 查找杠杆率、评级和信用展望
```

Search Planning 只负责定义“应该寻找什么信息”。

具体信息可以来自：

```text
Web Search
News API
Research Database
Company Filing
Market Data
MCP
其他信息源
```

Theme Workflow 本身不绑定具体数据源。


---

## 6. Information Retrieval

根据 Search Planning 获取与 Theme 相关的候选信息。

```text
Search Plan
    ↓
Retrieve Information
    ↓
Candidate Information
```

这一阶段主要目标是提高召回率。

候选信息可以同时包含：

```text
supporting information
contradictory information
contextual information
irrelevant information
```

后续步骤再判断其与 Theme 的实际关系。


---

## 7. Event Extraction

从候选信息中提取可追溯的事实 Event。

```text
Candidate Information
        ↓
ExtractEvents
        ↓
Event[]
```

Event Extraction 应复用：

```text
references/event-extraction.md
```

Event 仍然回答：

> 实际发生了什么？

例如：

```text
Meta 发行 300 亿美元债券。

Microsoft 提高 AI 数据中心资本开支。

Oracle 新发行债券的平均融资成本上升。
```

与 Theme 无关的 Event 可以在后续 Evidence Mapping 阶段过滤。


---

## 8. Signal Extraction

从相关 Event 中提取变量变化。

```text
Event
  ↓
ExtractSignals
  ↓
Signal[]
```

Signal Extraction 应复用：

```text
references/signal-extraction.md
```

Signal 主要回答：

> 哪个变量发生了什么变化？

例如：

```text
ai_capex ↑

debt_financing ↑

free_cash_flow ↓

funding_cost ↑
```


---

## 9. Evidence Mapping

Evidence Mapping 用于判断 Event 和 Signal 与 Theme 之间的关系。

主要判断：

```text
这个事实与 Theme 是否相关？

它对应哪个 core_variable？

它是否支持 Theme 当前的解释结构？

它是否削弱当前解释？

它是否提供新的解释方向？

它是否只能作为背景信息？
```

建议使用以下关系：

```text
support
counter_evidence
context
unrelated
```

例如：

```text
Theme:
AI CapEx 扩张是否正在造成融资压力？

Signal:
debt_financing ↑

Relationship:
context
```

发债增加本身只能证明融资行为变化；只有结合融资需求、承接与成本等证据，才能判断它是否支持“融资压力”这一解释。关系必须针对具体问题说明依据，不能按变量方向机械赋值。

另一个例子：

```text
Signal:
free_cash_flow ↑

Relationship:
counter_evidence
```

Evidence Mapping 应保留支持性证据和反向证据。


---

## 10. Evidence Organization

相关 Signal 默认按照 Theme 已有的核心变量或核心问题进行组织。

例如：

```text
Theme
│
├── ai_capex
│   ├── Signal A
│   └── Signal B
│
├── debt_financing
│   ├── Signal C
│   └── Signal D
│
├── free_cash_flow
│   └── Signal E
│
└── funding_cost
    └── Signal F
```

由于 Theme 已经提供高层信息结构，通常无需再次进行 Cluster Formation。

当 Theme 范围较宽，相关 Signal 内部明显形成多个独立事件结构时，可以选择性调用：

```text
references/clustering.md
```

Cluster 在 Theme Workflow 中属于可选步骤。


---

## 11. Theme Findings

在完成 Evidence Mapping 后，根据当前获取的证据生成 Theme Findings。

Theme Findings 应回答：

```text
当前有哪些事实支持这个 Theme？

哪些变量已经出现明显变化？

哪些证据削弱当前 Theme？

Theme 中哪些部分已经得到事实支持？

哪些部分仍然缺少证据？

出现了哪些值得继续观察的问题？
```

Theme Finding 应保持可追溯性。

每个 Finding 应能够回溯到：

```text
Finding
  ↓
Signal
  ↓
Event
  ↓
Source
```


---

## 12. Theme Boundary

`theme` 模式负责：

```text
围绕 Theme 主动寻找信息
提取相关 Event
提取相关 Signal
整理支持证据
整理反向证据
识别证据缺口
生成 Theme Findings
```

该模式不负责：

```text
跨运行历史存储
Theme 生命周期维护
长期趋势状态更新
风险评分
投资建议
交易方向
估值结论
```

这些能力可以由后续独立模块负责。


---

## 13. Main Workflow

```text
INPUT Theme

theme_context = InterpretTheme(Theme)

clusters = []

search_plan = BuildSearchPlan(
    theme_context
)

candidate_information = RetrieveInformation(
    search_plan
)

events = ExtractEvents(
    candidate_information
)

signals = ExtractSignals(
    events
)

evidence = MapEvidenceToTheme(
    Theme,
    events,
    signals
)

IF NeedClustering(evidence):
    clusters = BuildClusters(
        evidence.signals
    )

findings = GenerateThemeFindings(
    Theme,
    evidence,
    clusters
)

result = BuildThemeProcessingResult(
    Theme,
    events,
    signals,
    evidence,
    clusters,
    findings
)

RETURN result
```

落盘时将上述过程映射为以下字段：

- `theme_context`：输入主题的名称、问题、核心变量及可选解释结构，不携带历史对象引用。
- `observation_window`、`search_log`：观察窗口，以及实际查询、来源、获取时间、成功/无结果/失败和原因。
- `events`、`signals`、可选 `clusters`：本轮可追溯信息对象，使用共享 Schema。
- `evidence`：以 `evidence_id` 标识；记录 `variable`、`relationship`、`event_refs` / `signal_refs` 和 `rationale`。`unrelated` 是筛选过程状态，不进入交付证据。
- `findings`：以 `finding_id` 标识；结论通过 `evidence_refs` 引用证据，附置信度和待观察问题。
- `gaps`：按核心变量列出缺口原因及下一步；空结果或未覆盖变量必须有缺口说明。
- `summary`：本轮事件、信号、聚类、证据、发现和缺口的实际数量；`notes` 保存范围假设及口径限制。

不得为凑齐结构生成信号、聚类或发现。只有 Event 时可以直接建立证据映射；检索失败时允许空对象数组。上述示例均为流程说明，不作为真实市场数据。


---

## 14. End-to-End Flow

```text
Theme
  ↓
Theme Interpretation
  ↓
Search Planning
  ↓
Information Retrieval
  ↓
Event Extraction
  ↓
Signal Extraction
  ↓
Evidence Mapping
  ↓
Optional Cluster Formation
  ↓
Theme Findings
  ↓
Theme Processing Result
```


---

## 15. Relationship with Feed Mode

两种模式共享相同的信息对象和基础方法。

```text
Feed Mode

Information
    ↓
Event
    ↓
Signal
    ↓
Cluster
    ↓
Theme
```

Feed Mode 的核心任务是：

> 从输入信息中发现值得关注的 Theme。


```text
Theme Mode

Theme
    ↓
Search
    ↓
Event
    ↓
Signal
    ↓
Evidence
    ↓
Finding
```

Theme Mode 的核心任务是：

> 围绕已经确定的 Theme 主动寻找和整理证据。


两种模式可以共享：

```text
Event
Signal
Cluster
Theme

references/event-extraction.md
references/signal-extraction.md
references/clustering.md
```

从而保持整个 Information Processing Skill 的对象定义和分析方法一致。

阅读版交付时执行 [SKILL.md 中的 theme 阅读版输出规范](../SKILL.md#theme-阅读版输出规范)。
