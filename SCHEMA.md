# LLM Wiki Schema

本文件定义当前 `llmwiki` 知识库的静态结构规则。  
它回答“这个知识库允许沉淀什么、放在哪里、页面应如何命名和链接”。  
具体执行流程、ingest 步骤、索引更新和日志记录要求，以 `AGENTS.md` 与 `page-types.md` 为准。

---

## 1. 知识库边界

当前正式 Wiki 服务于一条长期主线：整理冰冰小美的概念、观点、推导、时间演化和主题地图，并将其沉淀为可复用、可追溯、可持续演进的知识框架。

具体标的研报、估值、公告跟踪、行情与资金快照、持仓和操作记录属于同级 `workbench/`，不直接进入正式 `wiki/`。

`wiki/` 与 `wiki_laomujiang/` 是两个独立知识库。下文默认的正式 Wiki 目录指 `wiki/`；老木匠知识在 `wiki_laomujiang/` 中维护，并使用自己的索引。


可以进入正式知识层的内容必须至少满足一项：

1. 直接来自或解释冰冰小美的知识框架；
2. 虽然来自具体案例，但已经 Workbench 回流规则证明可服务已有长期主题、人物学习线、观点演化或推导链；
3. 是当前知识库维护规则、页面类型、技能或索引结构本身的一部分。

不满足准入条件的材料不进入 `wiki/`。  
如果只需要留存原始材料，应放入 `sources/`，不得伪装成正式知识页。

---

## 2. 当前目录契约

当前知识库的核心目录如下：

```text
llmwiki/
  AGENTS.md
  schema.md
  page-types.md
  index.md
  log.md
  rules/
  templates/
  wiki_laomujiang/
    index.md
    concepts/
    indicators/
    timelines/
    topics/
  sources/
    articles/
    assets/
    manual/
    screenshots/
    transcripts/
  wiki/
    concepts/
    indicators/
    people/
    events/
    timelines/
    reasoning/
    queries/
    topics/
  workbench/
    AGENTS.md
    index.md
    templates/
    targets/
```

说明：

- `AGENTS.md`：Agent 全局工作说明和维护流程入口。
- `schema.md`：当前文件，只定义静态结构和质量约束。
- `page-types.md`：页面类型定义、页面结构和类型选择规则。
- `index.md`：正式知识页总索引。
- `log.md`：知识库维护日志。
- `rules/`：补充写作规则，例如 reasoning page 生成规则。
- `templates/`：正式知识页的可复制模板。
- `wiki_laomujiang/`：独立的老木匠知识库，导航使用 `wiki_laomujiang/index.md`。
- `sources/`：原始资料层，只保存来源和原始输入。
- `wiki/`：正式知识层，只保存结构化知识页。
- `workbench/`：个股研究与动态决策工作域，与 `wiki/` 同级，不属于正式知识层。

`wiki/queries/` 保存问题驱动的综合回答、检索结果和待归档问题。Query Page 只沉淀可复用问题，不替代 Topic Page 或 Reasoning Page。

`workbench/` 工件使用 `artifact_type` 表达研报或跟踪性质，不得使用本文定义的八类 `type` 冒充正式 Wiki 页面。

`wiki/summaries/` 若在本地仍存在，视为历史迁移遗留目录；新内容不得继续写入该目录。旧 summary 应迁移为 Timeline Page、Topic Page 或 Reasoning Page。

`sources/posts/`、`sources/papers/`、`sources/webpages/` 可在资料类型需要时按 `AGENTS.md` 创建，但当前已使用的来源目录以 `articles/`、`manual/`、`screenshots/`、`transcripts/` 和 `assets/` 为主。

---

## 3. sources 目录规则

`sources/` 是原始资料层，保存未被改写成正式知识页的输入材料。

当前常用子目录含义：

| 目录 | 用途 |
|---|---|
| `sources/articles/` | 网页文章、雪球帖、微信公众号文章、博客、专栏、新闻等正文归档 |
| `sources/manual/` | 用户手动提供的短材料、观点片段、未完整抓取的原始输入 |
| `sources/screenshots/` | 截图、流程图、图片转写及相关说明 |
| `sources/transcripts/` | 日汇总、访谈、播客、会议纪要、抓取汇总等转写材料 |
| `sources/assets/` | SVG、图片、图表、附件等可被 wiki 页面引用的资产 |

规则：

1. 不主动改写、覆盖或删除已有原始资料。
2. 不在 `sources/` 写深度分析或推导结论。
3. 如需补充，只追加来源信息、抓取说明、备注或转写说明。
4. 从 `sources/` 提炼出的正式知识必须写入所属知识库，并在正文中使用来源双链追溯原始资料。

---

## 4. wiki 正式页面类型

当前正式知识层只使用以下八类页面，与 `page-types.md` 保持一致：

| type | 页面类型 | 推荐目录 | 核心问题 |
|---|---|---|---|
| `concept` | Concept Page / 概念页 | `wiki/concepts/` | 这是什么 |
| `indicator` | Indicator Page / 观测指标页 | `wiki/indicators/` | 观察什么、如何计算或判定、能解释到哪里 |
| `person` | People Page / 人物页 | `wiki/people/` | 谁提出、谁参与、谁影响 |
| `event` | Event Page / 事件页 | `wiki/events/` | 发生了什么 |
| `timeline` | Timeline Page / 时间线页 | `wiki/timelines/` | 先后顺序是什么 |
| `reasoning` | Reasoning Page / 推导链页 | `wiki/reasoning/` | 为什么这样推导 |
| `query` | Query Page / 问题页 | `wiki/queries/` | 这个问题当前如何回答 |
| `topic` | Topic Page / 主题聚合页 | `wiki/topics/` | 相关页面如何组织 |

`view` 类型已取消，不再定义专属字段、子类型、模板或生成规则，也不再向 `wiki/views/` 新建页面。现存历史观点页及双链保留，其旧 `type: view` 仅作为历史兼容，不作为新增页面的可选类型；本次不批量删除或迁移历史内容。

不得把 `summary`、`comparison`、`output` 作为新的正式页面类型。
若未来确需新增页面类型，必须先同步修改 `page-types.md`、`schema.md` 和 `AGENTS.md`，再迁移索引与日志规则。

页面类型的详细语义、适用场景、选择规则和组合规则，以 `page-types.md` 为准。页面模板统一放在 `templates/` 目录下；创建新正式知识页时，应按对应模板补齐 frontmatter、来源、关系信息和不确定性。所有页面类型均不生成“相关页面”正文章节；核心关系统一维护在 frontmatter 的 `related` 字段中，正文按需保留上下文双链。

---

## 5. Frontmatter 契约

`wiki/` 与 `wiki_laomujiang/` 的新建正式知识页使用以下基础 frontmatter：

```yaml
---
title: ""
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: ""
status: active
tags: []
related: []
summary: ""
---
```

字段规则：

- `title`：页面显示标题，应与一级标题语义一致。
- `aliases`：别名列表，用于记录常见简称、旧称或同义表达。
- `created`：页面创建日期。
- `updated`：最近结构性更新日期。
- `type`：只能使用八类正式页面类型之一。
- `status`：默认 `active`；如需废弃页面，应使用明确说明和迁移链接，不直接删除。
- `tags`：使用本文件定义的标签体系。
- `related`：页面的核心相关链接，推荐使用 `[[页面路径|显示名称]]`。
- `summary`：一到两句话概括页面内容，便于索引和检索。

允许根据页面类型增加扩展字段：

- `concept`：`definition`、`key_variables`、`common_misunderstandings`
- `indicator`：必需字段见本节 5.1 的专属契约
- `person`：`people_type`、`core_topics`、`principles`、`reasoning_style`
- `event`：`event_date`、`participants`、`time_scope`、`certainty`
- `timeline`：`subject`、`timeline_type`、`period_start`、`period_end`
- `reasoning`：`conclusion`、`premises`、`key_variables`、`confidence`
- `query`：`original_question`、`query_context`、`answer_status`
- `topic`：`topic_scope`、`key_questions`、`related_concepts`、`related_indicators`

除 Indicator 专属契约规定的必需字段外，扩展字段不是强制字段；一旦使用，必须与正文内容一致。

**新建页面不生成 `source` 或 `sources` 属性**，也不以空数组、空值或可选字段保留；此规则适用于两个知识库的新建页面。来源追溯仍然必需：在正文相应论述附近、既有“来源／重要资料”章节或资料表中使用带显示名的原始资料双链，按需注明具体位置。已有页面的历史属性允许保留，除非用户另行要求迁移，不批量删除。

---

### 5.1 Indicator 专属契约与迁移入口

Indicator 必须使用 `type: indicator`，放在所属库的 `indicators/` 目录。除基础字段外，下列字段必填；不得用空值或占位符发布正式规范：

| 字段 | 类型与要求 |
|---|---|
| indicator_id | 两库合并范围内唯一、稳定的小写 ASCII 标识，使用字母数字及点、下划线、连字符；移动或重命名不改变标识 |
| spec_version | 语义版本字符串，例如 `1.0.0` |
| indicator_kind | `quantitative`、`qualitative` 或 `mixed` |
| observation_scope | 非空字符串，明确市场、对象、样本及时间尺度 |
| purpose | 非空字符串，说明指标服务的判断问题 |
| update_frequency | 非空字符串，区分数据发布节奏、建议复查节奏及过期判定 |
| required_inputs | 非空且无重复的输入字段名列表；对应正文数据表 |
| metric_fields | 非空且无重复的输出读数字段名列表；对应正文计算说明 |
| allowed_assessments | 无重复的判定状态列表，必须包含 `undetermined`；逐项说明所需证据 |
| validation_status | `draft`、`reviewed` 或 `validated`；格式检查不提升指标有效性状态 |

维度与分类需要时沿用 `dimension`、`category`，与标题和文件名保持一致。必需章节由 [[templates/indicator-page-template|指标页模板]] 定义，写作与调用过程见 [[rules/indicator-page-rules|指标生成与调用规则]]。指标不增加 source／sources 属性，原始依据在正文以双链追溯。

页面迁移可保留 `status: redirected` 的兼容入口，`redirect_to` 必须指向同库现存的正式目标，正文给出目标双链；保留旧 type，但不保留 indicator_id。兼容入口不计入有效页面数，Agent 解析到目标后使用其类型与版本。Obsidian 通过正文链接访问目标，不依赖属性自动跳转。旧页在替换前保存原样归档。

### 5.2 Indicator 的 Agent 输出契约

规范页提供一个标明“未运行”的 JSON 示例；调用方每次输出必须包含以下字段，不额外添加未约定的顶层字段：

| 字段 | 类型与规则 |
|---|---|
| indicator_id、spec_version | 非空字符串，与本次使用的规范完全一致 |
| subject | 非空字符串，明确本次市场、对象与样本 |
| observed_at、available_at、evaluated_at | ISO 8601 字符串，分别为数据统计时点、可获知时点与评估时点；未知时为 null |
| data_status | `complete`、`partial`、`unavailable`、`stale` 或 `incomparable` |
| metrics | 对象，键与 metric_fields 完全一致；每项含义、类型、单位及范围按正文定义，未知值用 null |
| assessment | allowed_assessments 中的状态；不能由缺失或格式检查直接推断安全与风险 |
| evidence | 字符串列表，记录可追溯的原始证据及其适用口径、日期；非 undetermined 结论必须有证据 |
| missing_inputs | 字符串列表，列出缺失字段，不用零代替未知 |
| limitations | 字符串列表，说明滞后、样本、阈值及解释限制 |
| requires_human_review | 布尔值，记录是否需要人工复核 |

非 complete 状态必须返回 `assessment: undetermined` 并要求人工复核，说明缺口或限制；仍可保留可计算的局部读数。complete 要求必需输入齐全、三个时点已知且无时序倒置，missing_inputs 为空，至少有一项有效读数，但不强制得出方向性结论。draft 规范的任何运行均要求人工复核。未运行示例采用 unavailable、三个 null 时点、空证据和全 null 读数。

真实结果和风险快照属于 Workbench；Wiki 指标页只保存规范。检查脚本验证页面字段、示例和通用结果结构，不代替数据获取、指标计算、证据真实性审查或有效性回测。

## 6. 标签体系

除非先修改本节，否则正式知识页应优先使用以下标签。

宏观类：

- `macro/growth`
- `macro/inflation`
- `macro/rates`
- `macro/liquidity`
- `macro/credit`
- `macro/fiscal`
- `macro/monetary-policy`
- `macro/fx`
- `macro/employment`
- `macro/cycle`

策略类：

- `strategy/allocation`
- `strategy/position-sizing`
- `strategy/timing`
- `strategy/valuation`
- `strategy/risk-control`
- `strategy/rotation`
- `strategy/review`
- `strategy/drawdown`
- `strategy/discipline`
- `strategy/portfolio`

资产类：

- `asset/equity`
- `asset/bond`
- `asset/gold`
- `asset/commodity`
- `asset/cash`
- `asset/real-estate`

功能类：

- `function/framework`
- `function/thesis`
- `function/checklist`
- `function/case-study`
- `function/query`
- `function/comparison`

人物学习类：

- `learning/reasoning`
- `learning/principle`
- `learning/worldview`
- `learning/decision-style`

标签应服务检索和聚合，不应把一句话里的每个关键词都变成标签。  
同一页面标签数量应保持克制，优先选择能表达页面主责的标签。

---

## 7. 双链规则

正式知识页必须使用 Obsidian 双链维护关系。

规则：

1. 核心概念、人物、事件、观点、时间线、推导链和主题应链接到已有页面。
2. 已存在页面时，优先链接已有页面，不重复建页。
3. 不为无意义词汇或一次性短语创建链接。
4. 不制造大量空页面。
5. 所有 `wiki/` 页面均取消“相关页面”正文章节，使用 frontmatter 的 `related` 字段维护核心关系；正文中的来源引用、主题导航和上下文双链仍按需保留。
6. 当链接目标使用路径时，正文和相关列表都应使用 `[[页面路径|显示名称]]`，避免直接把路径暴露给读者；Markdown 表格内的写法以本节“表格内双链与列数检查”为准。
7. 相关列表推荐写成 `- [[页面路径|显示名称]]：说明为什么相关。`

最低链接要求：

- `reasoning` 页面至少链接相关 concept、topic 和原始资料；涉及时间时链接 timeline 或 event。
- `person` 页面应链接代表性原始资料、相关 topic、相关 reasoning 或 concept。
- `concept` 页面应链接相关 topic，必要时链接提出者、原始资料或 reasoning。
- `indicator` 页面应链接所属 topic、必要的解释概念和原始资料；topic 的 related_indicators 与 related_concepts 分别登记两类页面。
- `timeline` 页面应链接相关 event、reasoning 或 topic。
- `query` 页面应链接回答所依据的 concept、reasoning、topic 或 source，并标注是否已补入正式页面。
- `topic` 页面应组织相关 concept、indicator、person、event、timeline、reasoning、query。

---

### 表格内双链与列数检查

此规则适用于两个知识库所有类型页面中的 Markdown 表格，包括来源、导航、判断演化及比较表。

1. 表格内双链的显示名分隔符必须转义：写成 `[[页面路径\|显示名称]]`；带章节的链接写成 `[[页面路径#章节\|显示名称]]`，嵌入式双链同样适用。不得使用未转义的 `[[页面路径|显示名称]]`。
2. 表格外的正文及 frontmatter 仍使用普通 `|`，不得对全文做统一替换。已有正确的 `\|` 不再追加反斜杠；两个反斜杠后接 `|` 会使该竖线重新成为分列符。
3. 单元格中的其他字面量竖线也必须转义，包括行内代码中的竖线。仅列与列之间使用未转义的 `|`；表头、分隔行和每一数据行的列数必须一致。
4. 每次生成或修改页面后，必须对本次涉及的 Markdown 文件执行只读检查脚本；发现错误时修复并重跑，通过后才能交付。跳过 frontmatter 与围栏代码块中的示例，不以肉眼检查代替脚本检查。

在知识库根目录运行（文件路径替换为本次实际修改文件，可一次传入多个）：

```sh
python3 rules/check_markdown_tables.py "页面一.md" "页面二.md"
```

脚本返回非零退出码表示检查失败，并报告文件、行号、未转义双链或列数异常。脚本不改写文件；无需为此扫描或批量修复无关历史页面。

---

## 8. 事实、观点、推测与不确定性

正式知识页必须区分：

- 事实：可由来源验证的信息。
- 观点：某个主体的判断、立场或解释。
- 推测：基于现有信息的推导，但尚未被验证。
- 不确定性：来源不完整、条件未满足、未来尚未发生或推导依赖多个假设。

不得把观点写成事实。  
不得把推测写成结论。  
金融、政策、市场、医疗、法律等高变动领域必须保留不确定性说明。

具体标注方式和写作示例，以 `AGENTS.md`、`page-types.md`、`templates/` 和 `rules/` 中的对应规则为准。

---

## 9. 索引与日志文件

`index.md` 和 `log.md` 是根目录必备维护文件：

- `index.md`：正式知识页导航入口，按页面类型和主题组织。
- `log.md`：知识库维护日志，记录新增、迁移、重命名、删除、修复和规则调整等动作。

具体更新流程和日志格式以 `AGENTS.md` 为准。

---

## 10. 禁止行为

Agent 不得：

1. 删除或覆盖 `sources/` 中原始资料。
2. 未检查已有页面就新建重复页面。
3. 把原文摘要直接放入 `wiki/` 当作知识沉淀。
4. 把 Topic Page 当成所有内容的默认归宿。
5. 混用 Reasoning Page 和 Timeline Page，或把单篇观点伪装成稳定知识。
6. 使用旧页面类型新建 `summary`、`comparison` 或 `output` 页面。
7. 省略来源、关系信息、不确定性和必要双链。
8. 修改与当前任务无关的大量文件。
9. 在没有计划和确认的情况下做大规模重构。
10. 让 `schema.md`、`page-types.md`、`AGENTS.md` 和实际目录结构长期不一致。
