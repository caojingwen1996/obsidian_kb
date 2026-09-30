---
name: information-processing
description: 根据“信息的金融处理”框架，使用 feed 模式将已有文章、研报和新闻归纳为 Event、Signal、Cluster、Theme；使用 theme 模式围绕已知主题主动搜集信息、事件和数据，整理支持证据、反证、证据缺口与 Theme Findings。不执行风险、估值或交易判断。
metadata:
  version: "2.1.2"
---

# 信息处理

## 定位

`bbxm-information-processing` 是通用的信息处理 Skill，保留调用名 `$information-processing`。依据 [[wiki/concepts/冰冰小美-framework-信息的金融处理|信息的金融处理]] 中的“信息处理skill的开发”章节，将外部信息加工为可追溯、结构化、可归纳、可供下游 Skill 继续分析的机器可读结果。

本技能不执行具体领域判断。信息结论、Theme 方向和下游移交资格，均不等于风险判断、投资建议或交易结论。

## 核心能力

1. **信息获取**：feed 接收已有材料并按需回源核验；theme 围绕指定主题、核心问题和变量主动搜集信息与数据。
2. **信息组织**：提取 Event，组织时间、观察对象和来源关系；关键事件可追加 Event Analysis。
3. **信息归纳**：从 Event 提取 Signal，将相关 Event / Signal 组织为 Cluster，再归纳 Theme 与 Core Findings，保留完整证据链。

## 工作模式

| 模式 | 适用场景 | 当前状态与入口 |
|---|---|---|
| `feed` | 用户已有材料，需要提取事件、变量变化和共同问题 | 已实现；执行 [feed-workflow.md](workflows/feed-workflow.md) |
| `theme` | 输入已知 Theme 或明确主题问题，主动搜集相关信息、事件和数据 | 执行 [theme-workflow.md](workflows/theme-workflow.md)，输出 ThemeProcessingResult |

按用户任务选择模式：处理已有材料、从信息中发现主题使用 feed；围绕已知主题搜集和验证证据使用 theme。显式指定模式时遵循用户选择。两种模式使用独立结果契约，共享 Event、Signal 及可选 Cluster 的定义。

feed 自下而上归纳 Theme；theme 从输入主题出发搜集证据，不要求重新归纳 Theme，也不强制建立 Cluster。输入 Theme 是研究上下文，不代表其解释已被证实；本轮结果不更新历史 Theme 状态。

## theme 执行入口

开始前读取 [theme 工作流](workflows/theme-workflow.md) 与 [theme 结果 Schema](schemas/theme-processing-result.schema.json)。提取事件和信号时复用 [事件提取](references/event-extraction.md)、[信号提取](references/signal-extraction.md) 及对应 Schema；只有需要聚类时才读取 [聚类方法](references/clustering.md)。

1. **确定研究上下文**：接收已有 Theme，至少明确 `theme_name`、`core_question`、`core_variables`。用户只提供主题名称时，可以将问题和变量整理为明确标注的研究假设；无法确定研究范围时先询问。输入完整 Theme 时只将研究相关字段投影到 `theme_context`，不要求重载历史 Cluster。
2. **确定搜集范围**：明确观察主体、时间窗口和截止日。未指定窗口时默认最近 30 天，在 `notes` 写明假设；必要的更早背景单独注明。围绕每个核心变量安排来源与查询，同时查找支持证据和反证。
3. **主动获取与核验**：使用可用搜索、数据连接器或公开文件，优先公告、财报、监管文件和原始统计。记录查询、来源、获取时间和访问结果；区分事件日、发布日期与数据期，核对单位、期限和比较口径。搜索摘要用于发现线索；无法核实的数值不写成确定事实。转载去重，不将同源报道当独立印证。
4. **组织本轮证据**：提取 Event 与 Signal，再按核心变量映射为 `support`、`counter_evidence` 或 `context`，逐项解释依据。排除无关材料。变量上升不自动等于支持主题，例如发债增加本身不能证明融资困难。Cluster 可选；没有变量变化时保留 Event，仍可作为证据。
5. **补查与停止**：关键缺口先做针对性补查；完成计划且无新增有效证据、来源持续不可访问或达到用户预算时停止。将未覆盖变量、口径冲突和获取失败写入 `gaps`，不能把“没有找到”当作反证。
6. **输出与检查**：生成 `ThemeProcessingResult`，保留 `theme_context`、`search_log`、`events`、`signals`、可选 `clusters`、`evidence`、`findings`、`gaps` 和数量摘要。每条 Finding 引用本轮证据，证据回溯到 Event / Signal / Source；空结果合法，缺口必须说明。

保存 JSON 后运行统一校验入口，脚本按 `mode` 选择结果 Schema：

```text
python .agents/skills/bbxm-information-processing/scripts/validate_result.py <结果文件.json>
```

面向用户先给核心结论，再按核心问题组织证据、反证、判断边界与后续观察；正文与明细附录的分工遵守 [theme 阅读版输出规范](#theme-阅读版输出规范)。不要把内部编号和对象计数放在正文主线。需 HTML 时将完整结果与阅读版母稿交给 [bbxm-html-report](../bbxm-html-report/SKILL.md)，保留同源数据与全部证据。具体研究产物按项目路由落盘；不自动新建正式 Wiki 页面。只要求 JSON 时不附加报告。

theme 模式只整理当前证据，不执行风险评分、方向跟踪、估值或交易判断。交给风险识别时附上完整主题上下文、证据链和缺口，不强塞进 feed 的结果结构。

## theme 阅读版输出规范

本节用于 theme 模式的 Markdown / HTML 阅读版，不改变 ThemeProcessingResult 字段或 feed 的输出契约。先完成结构化结果，再以 Findings 为主线组织阅读版，不按 JSON 字段逐项铺开。

### 首屏：先回答主题问题

- 标题直接使用主题名称；一句话回答核心问题，随后给出少量最重要的发现，通常为 2—3 条。证据不足时直接说当前能确认什么、还不能确认什么，不凑结论或评分。
- 给出观察对象、检索截止日和实际数据期；较早背景另行标注。少量关键数字须带单位与比较口径，事件/信号数量留在附录。
- 导航放在结论之后，使用读者关心的问题作为标签。

### 正文：每节解决一个问题

按“已观察到的关键变化 → 支持证据与反证 → 尚未证实的环节 → 后续优先观察”展开。章节标题改写为本主题的具体问题或有证据支持的发现，不机械重复字段名。每节先用一句话给出回答，再放最有解释力的数据、事件或图表，并在相邻位置给出来源与必要限制。

支持证据和关键反证放在同一问题下比较，避免先读完大量数据才看到结论。单一企业或个别交易放在对应问题下作为案例，明确其适用范围；不让个案取代主题结论。正文不再次堆叠一组重复的“核心发现”。

每张图只承担一个主要比较或解释任务，图题写清问题或发现；图旁给出简短读图结论。非同期、非同币种或不匹配期限的比较须显式说明，不将不匹配的均值画成标准线。详细数据与口径仍可查阅。

“尚未证实”优先呈现会改变当前判断的关键缺口；“后续观察”按重要性说明要补哪项信息、它能确认或否定什么，不只罗列指标名。没有有效证据时说明缺口和获取结果，不强行画图。

### 附录：保留核对依据

逐笔数据、完整事件/信号与证据映射、详细统计口径、完整缺口清单、来源与检索记录、校验记录放入附录或明确链接的完整结构化结果。HTML 的长明细默认可展开，Markdown 保留相应附录；正文中的关键断言仍直接引用来源。

影响结论的限制、关键反证、候选状态与重要来源失败摘要必须在正文可见，不能仅藏在折叠区。内部 ID、Schema 校验、对象计数不占据主要阅读位置。

### 交付前复核

- 只看标题、首屏和正文小标题，能否理解最重要的变化、判断边界和下一步？
- 各段、图表是否服务当前问题，是否存在重复结论或抢占主线的个案？
- Findings、关键反证与缺口是否完整承接；数字、时间与来源是否和 JSON / 母稿一致；详细证据是否可追溯？
- HTML 的展开、图表和窄屏阅读检查由 HTML 输出技能执行；静态检查不能替代视觉验收。

以下章节为 feed 模式的执行与输出约定，不用于约束 theme 的聚类数量、Findings 或结果字段。

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
