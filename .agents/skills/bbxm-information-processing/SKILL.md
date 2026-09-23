---
name: information-processing
description: 根据“信息的金融处理”框架，将用户提供的文章、晨报、研报、新闻或混合材料加工为 Event、Signal、Cluster、Theme，输出可追溯的 InformationProcessingResult、总结与 Core Findings。用于材料事件提取、变量变化整理与主题归纳。目前仅实现 feed；monitor 和 target 待实现，不执行风险、估值或交易判断。
metadata:
  version: "2.0.0"
---

# 信息处理

## 定位

`bbxm-information-processing` 是通用的信息处理 Skill，保留调用名 `$information-processing`。依据 [[wiki/concepts/冰冰小美-framework-信息的金融处理|信息的金融处理]] 中的“信息处理skill的开发”章节，将外部信息加工为可追溯、结构化、可归纳、可供下游 Skill 继续分析的机器可读结果。

本技能不执行具体领域判断。信息结论、Theme 方向和下游移交资格，均不等于风险判断、投资建议或交易结论。

## 核心能力

1. **信息获取**：接收已有材料，围绕观察目标进行必要的回源补充和核验。
2. **信息组织**：提取 Event，组织时间、观察对象和来源关系；关键事件可追加 Event Analysis。
3. **信息归纳**：从 Event 提取 Signal，将相关 Event / Signal 组织为 Cluster，再归纳 Theme 与 Core Findings，保留完整证据链。

## 工作模式

| 模式 | 适用场景 | 当前状态与入口 |
|---|---|---|
| `feed` | 用户已有材料，需要提取事件、变量变化和共同问题 | 已实现；执行 [feed-workflow.md](workflows/feed-workflow.md) |
| `monitor` | 按固定观察对象与预设来源扫描当期新增信息 | 待实现；当前不执行扫描，不创建周期任务 |
| `target` | 输入具体对象或问题，动态路由来源并获取相关信息 | 待实现；当前不执行对象信息搜集 |

当前 Schema 将 `mode` 固定为 `feed`。遇到 monitor / target 请求，说明入口尚未实现；用户提供材料后可进入 feed。不得把主动扫描或标的搜集伪装成 feed，也不得输出不符合 Schema 的模式值。

## feed 执行入口

开始前读取完整 [feed 工作流](workflows/feed-workflow.md) 与 [结果 Schema](schemas/information-processing-result.schema.json)，按以下顺序加载方法和对象定义：

| 阶段 | 方法依据：如何处理 | Schema：结果结构 |
|---|---|---|
| Event 提取及可选 Event Analysis | [event-extraction.md](references/event-extraction.md) | [event.schema.json](schemas/event.schema.json) |
| Fact / Repricing Signal 提取 | [signal-extraction.md](references/signal-extraction.md) | [signal.schema.json](schemas/signal.schema.json) |
| Cluster 的关系结构与时间轴 | [clustering.md](references/clustering.md) | [cluster.schema.json](schemas/cluster.schema.json) |
| Theme 的共同问题与持续解释结构 | [theme-synthesis.md](references/theme-synthesis.md) | [theme.schema.json](schemas/theme.schema.json) |

流程为：材料标准化 → Event → 可选 Event Analysis → Signal → Cluster → Theme → Core Findings → 移交资格 → InformationProcessingResult → 展示。

工作流规定步骤，references 规定方法，schemas 规定字段、类型与枚举。文档概念简称不直接当作 JSON 字段，例如 Cluster 成员使用 `member_events` / `member_signals`。不恢复旧版 `context / timeline / induction` 顶层结构。

### 执行约定

- 以提供材料为范围，确认观察目标与可识别的时间窗口；未给目标时围绕材料主要对象处理。相对日期缺少锚点时保留未知，不用运行日代替事件日；在 `notes` 说明窗口、时区假设和缺口。
- 仅为关键事实缺失、冲突、时间或数值歧义、必要上下文进行补充核验，不扩展为全市场扫描。获取失败保留原因与待验证项，不编造事实或数值。
- 来源可追溯到 URL、库内来源路径或用户原文片段标识；以 `source_refs[].source_id` 保存定位信息，必要时保留 `original_text`。观点只可记录为“某来源发表了该观点”，不得把观点内容当成已证实事实。
- 不要求每个 Event 都产生 Signal，也不要求每次运行都形成 Theme。无变量变化时保留 Event；弱 Cluster 可以只有一个有效成员，单一 Cluster 支撑的 Theme 只能标记 `emerging`。
- Event Analysis 留在 Event 内；预期、实际结果和再定价必须有材料支持。Repricing Signal 要引用包含可观察再定价的 Event；不能仅凭事实变化补出市场反应。
- Theme 状态和方向描述信息结构。缺少比较基准时不声称持续强化、减弱或反转，保留 `uncertain` 和待观察问题。
- 对象 ID 在各自类型内唯一。跨层引用须在本结果中可解析；引用历史对象时纳入必要对象及证据链，复用稳定 ID，不把旧对象重计为本轮新增。

## 标准输出

标准输出为 `InformationProcessingResult`，唯一结构依据是 [information-processing-result.schema.json](schemas/information-processing-result.schema.json)：

- `result_id`、`mode`、`generated_at`、`observation_window`：本轮标识与时间范围。
- `events`、`signals`、`clusters`、`themes`：事实、变化、事件集合与共同核心问题。
- `summary`：本轮数量概览与对象引用。
- `core_findings`：最值得保留的信息结论及支撑证据。
- `risk_identification_handoff`：是否适合移交风险识别及其原因。
- `notes`：范围假设、证据缺口和运行说明。

未知值按对应 Schema 使用 `null`、`unknown`、空数组或省略可选字段，不将所有标量统一置空。没有合格对象时保留空数组，不为填满层级制造证据。Core Finding 至少引用一个 Cluster；没有合格 Cluster 时 `core_findings` 为 `[]`。

### Summary 与移交约定

先生成对象和引用，再汇总数量。默认显式输出四类对象数组与 Summary 引用数组，便于核对：

- 新增 Event / Signal 按去重后的本轮新增对象计数。首次处理以本轮对象为基准；带历史上下文时在 `notes` 列明新增 ID 和比较基准，不把 Signal 的 `novelty` 当作入库新增标记。
- `forming_theme_refs` 收录当前 `emerging / forming` 的 Theme；`updated_existing_theme_refs` 只收录存在历史基准且本轮获得新证据的 Theme。二者可重叠，各自数量等于各自引用数。
- `isolated_signal_refs` 收录尚未与其他独立变化形成有效关联的 Signal；即使放入单成员弱 Cluster，仍可列为孤立信号。
- `insufficient_for_theme_refs` 用 `ref_type + ref_id` 指向暂不足以形成 Theme 的 Signal / Cluster，并记录原因；避免对同一证据链重复列入 Signal 及其弱 Cluster。数量为列表项数，与孤立信号统计可以重叠，不可简单相加作为总信息数。
- `risk_identification_handoff_count` 仅统计 `eligible = true` 的记录；保留 `eligible = false` 及证据不足的理由。可选 `theme_state_changes` 只有在历史比较可核验时填写，不机械复制当前方向分布。

移交记录引用 Theme 或 Core Finding，说明证据成熟度、相关 Cluster、缺口及原因。持续性、多 Cluster 支撑和明确下行传导可以支持移交；没有依据时标记 `eligible = false`，不推导风险等级。仅在用户要求下游分析时衔接风险识别技能；建议移交不等于已执行识别。

### 交付检查

保存 JSON 后运行 [校验脚本](scripts/validate_result.py)（依赖 Python 的 `jsonschema`、`referencing`）：

```text
python .agents/skills/bbxm-information-processing/scripts/validate_result.py <结果文件.json>
```

脚本检查五份 Schema、对象 ID、跨层引用及可核验计数，拒绝旧版契约与非 feed 模式。结构校验通过不代表事实、来源独立性、时间演化、归纳或移交判断正确；还须按四份方法文档的 Quality Check 复核。使用历史对象时另核新增计数、比较基准和 Theme 更新依据。

默认在对话中交付标准 JSON 与总结，较长结果可按任务要求保存 JSON 并提供链接。只要求 JSON 时只交付 JSON，不附加总结或 HTML。落盘遵守项目 Wiki / Workbench 路由；具体标的结果进入 Workbench，不自动创建正式 Wiki 页面。

## 面向用户的回答

从标准结果生成两部分，不另造一套结论：

1. **总结**：本轮新增 Event / Signal、正在形成的 Theme、获得新证据的已有 Theme、孤立 Signal、暂不足以形成 Theme 的信息，以及建议移交 Risk Identification 的对象与原因。
2. **Core Findings**：本轮最值得保留的结论、支撑 Cluster 与证据链、对应 Theme（如有）、状态、置信度和后续观察问题。没有合格结论时明确说明原因。

## 可视化输出

先完成并验证 `InformationProcessingResult`。结果包含适合展示的结构，且任务需要阅读版报告时，将完整结果与对象关系交给 Agent 的可视化输出 Skill；项目 HTML 阅读版使用 [bbxm-html-report](../bbxm-html-report/SKILL.md)。

| 对象 | 推荐表达 |
|---|---|
| Signal | 信号列表或状态表 |
| Cluster | 事件时间轴、Event / Signal 关系链 |
| Theme | Cluster → Theme 归纳结构、核心变量与传导结构 |
| Summary | 数量概览 |
| Core Finding | 结论与支撑证据链 |

这里只描述信息结构；具体图表、HTML、样式和布局由可视化输出 Skill 决定。可视化不得替代完整标准结果或补造关系。

## 维护

修改说明、工作流、资源、脚本、测试或界面元数据后，在 [log.md](log.md) 追加日期、版本变化、原因、涉及文件、具体变更与实际验证结果，并在项目根 `log.md` 记录概况。[退役技能日志](history/retired-information-filter-log.md) 仅供审计，不作为执行依据。
