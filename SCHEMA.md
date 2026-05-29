# LLM Wiki Schema

本文件定义当前 `llmwiki` 知识库的静态结构规则。  
它回答“这个知识库允许沉淀什么、放在哪里、页面应如何命名和链接”。  
具体执行流程、ingest 步骤、索引更新和日志记录要求，以 `AGENTS.md` 与 `page-types.md` 为准。

---

## 1. 知识库边界

当前知识库服务于两条长期主线：

1. 投资、宏观、市场结构、风险控制、资产配置、交易纪律等可复用知识；
2. 对长期跟踪对象的观点、判断框架、推导方式和决策风格的持续学习。

可以进入正式知识层的内容必须至少满足一项：

1. 直接属于上述知识边界；
2. 虽然不是直接领域主题，但能服务已有长期主题、人物学习线、观点演化或推导链；
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
  sources/
    articles/
    assets/
    manual/
    screenshots/
    transcripts/
  wiki/
    concepts/
    people/
    events/
    views/
    timelines/
    reasoning/
    queries/
    topics/
```

说明：

- `AGENTS.md`：Agent 全局工作说明和维护流程入口。
- `schema.md`：当前文件，只定义静态结构和质量约束。
- `page-types.md`：页面类型定义、页面结构和类型选择规则。
- `index.md`：正式知识页总索引。
- `log.md`：知识库维护日志。
- `rules/`：补充写作规则，例如 reasoning page 生成规则。
- `templates/`：正式知识页模板，每类页面一个可复制模板。
- `sources/`：原始资料层，只保存来源和原始输入。
- `wiki/`：正式知识层，只保存结构化知识页。

`wiki/queries/` 保存问题驱动的综合回答、检索结果和待归档问题。Query Page 只沉淀可复用问题，不替代 Topic Page、View Page 或 Reasoning Page。

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
4. 从 `sources/` 提炼出的正式知识必须写入 `wiki/`，并在 `sources:` 中可追踪回原始资料。

---

## 4. wiki 正式页面类型

当前正式知识层只使用以下八类页面，与 `page-types.md` 保持一致：

| type | 页面类型 | 推荐目录 | 核心问题 |
|---|---|---|---|
| `concept` | Concept Page / 概念页 | `wiki/concepts/` | 这是什么 |
| `person` | People Page / 人物页 | `wiki/people/` | 谁提出、谁参与、谁影响 |
| `event` | Event Page / 事件页 | `wiki/events/` | 发生了什么 |
| `view` | View Page / 观点页 | `wiki/views/` | 谁怎么看 |
| `timeline` | Timeline Page / 时间线页 | `wiki/timelines/` | 先后顺序是什么 |
| `reasoning` | Reasoning Page / 推导链页 | `wiki/reasoning/` | 为什么这样推导 |
| `query` | Query Page / 问题页 | `wiki/queries/` | 这个问题当前如何回答 |
| `topic` | Topic Page / 主题聚合页 | `wiki/topics/` | 相关页面如何组织 |

不得把 `summary`、`comparison`、`output` 作为新的正式页面类型。
若未来确需新增页面类型，必须先同步修改 `page-types.md`、`schema.md` 和 `AGENTS.md`，再迁移索引与日志规则。

页面模板统一放在 `templates/` 目录下。创建新正式知识页时，应先根据本节确定页面类型，再复制对应模板，并按实际内容补齐 frontmatter、来源、相关页面和不确定性。

---

## 5. 页面类型语义

- `concept`：稳定概念、方法、框架、模型、变量或术语，是可复用的知识原子。
- `person`：长期跟踪的人物、作者、投资人、博主、研究者或事件主体，不写成百科页，而是写其与本知识库的关系。
- `event`：单个政策、市场节点、产业节点、公司动作、会议、交易行为或风险节点。
- `view`：某个主体对某个问题的具体看法、判断、立场或阶段性观点。
- `timeline`：多个事件的时间顺序，只表达先后关系，不承担完整因果推导。
- `reasoning`：前提、变量、传导机制、结论、风险点和不确定性组成的推导链。
- `query`：围绕一个真实问题保存当前回答、推导逻辑、相关页面和归档状态，适合承接问答式学习记录。
- `topic`：主题聚合页或 Hub 页，用于组织概念、人物、事件、观点、时间线、推导链和问题页。

View Page 与 Reasoning Page 必须区分：

- 重点是“谁怎么看”时，写入 `wiki/views/`。
- 重点是“为什么这样推”时，写入 `wiki/reasoning/`。
- 两者都重要时，可以分别建页并互相链接。

Timeline Page 与 Reasoning Page 必须区分：

- 时间线只记录顺序和节点。
- 因果解释、传导机制和条件失效要写入推导链页。

---

## 6. Frontmatter 契约

所有 `wiki/` 页面必须包含基础 frontmatter：

```yaml
---
title: ""
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: ""
status: active
tags: []
sources: []
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
- `sources`：指向原始资料或可靠来源，推荐使用 `[[sources/path|显示名称]]`。
- `related`：页面的核心相关链接，推荐使用 `[[页面路径|显示名称]]`。
- `summary`：一到两句话概括页面内容，便于索引和检索。

允许根据页面类型增加扩展字段：

- `concept`：`definition`、`key_variables`、`common_misunderstandings`
- `person`：`people_type`、`core_topics`、`principles`、`reasoning_style`
- `event`：`event_date`、`participants`、`time_scope`、`certainty`
- `view`：`person`、`topic_refs`、`stance`、`time_scope`、`confidence`
- `timeline`：`subject`、`timeline_type`、`period_start`、`period_end`
- `reasoning`：`conclusion`、`premises`、`key_variables`、`confidence`
- `query`：`original_question`、`query_context`、`answer_status`
- `topic`：`topic_scope`、`key_questions`、`related_concepts`

扩展字段不是强制字段，但一旦使用，必须与正文内容一致。

---

## 7. 标签体系

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

## 8. 页面创建阈值

只有满足以下条件之一，才应创建新的 `wiki/` 页面：

1. 某个概念、框架或变量具有长期复用价值。
2. 某个人物值得持续跟踪，且其观点会被多次引用。
3. 某个事件是事实节点，可被观点、时间线或推导链引用。
4. 某条观点有明确主体、来源、时间或上下文，并能服务现有主题。
5. 某个推导链包含明确前提、变量、传导机制、结论和不确定性。
6. 某个主题需要聚合多个概念、人物、事件、观点或推导链。
7. 某条时间线能显著提升对多个事件先后关系的理解。
8. 某个问题具有复用价值，需要保留原始问题、当前答案、推导逻辑和归档状态。

以下情况不要新建正式页面：

- 内容过于零碎、临时或一次性。
- 可以补入已有页面而不损害结构清晰度。
- 只是原始摘录，尚未形成稳定知识。
- 只能制造孤立页面，无法接入现有双链。
- 来源不足，无法区分事实、观点和推测。

---

## 9. 命名规则

页面命名应清晰、稳定、可复用。

通用规则：

- 优先使用中文语义文件名。
- 人物来源明确的观点页、推导页、人物专属概念页或人物专属主题页，优先使用 `人物名-主题.md`。
- 公共主题页可使用不带人物前缀的稳定名称，例如 `宏观经济.md`、`概率化决策与风险控制.md`。
- 不使用 `新建文档.md`、`总结1.md`、`临时.md` 等无语义名称。
- 不随意重命名已被广泛链接的页面；确需重命名时，必须同步更新全库链接、`index.md` 和 `log.md`。

推荐示例：

```text
wiki/people/冰冰小美.md
wiki/concepts/冰冰小美-风险转弱节点框架.md
wiki/views/碧树西风-仓位管理要先匹配承受力.md
wiki/reasoning/冰冰小美-有色金属拐点推导.md
wiki/timelines/冰冰小美-2026一季度宏观阶段时间线.md
wiki/topics/宏观经济.md
```

---

## 10. 双链规则

正式知识页必须使用 Obsidian 双链维护关系。

规则：

1. 核心概念、人物、事件、观点、时间线、推导链和主题应链接到已有页面。
2. 已存在页面时，优先链接已有页面，不重复建页。
3. 不为无意义词汇或一次性短语创建链接。
4. 不制造大量空页面。
5. 每个 `wiki/` 页面底部必须包含“相关页面”部分。
6. 当链接目标使用路径时，正文和相关列表都应使用 `[[页面路径|显示名称]]`，避免直接把路径暴露给读者。
7. 相关列表推荐写成 `- [[页面路径|显示名称]]：说明为什么相关。`

最低链接要求：

- `view` 页面至少链接观点来源人物，以及相关 topic、concept 或 reasoning。
- `reasoning` 页面至少链接相关 view、concept、topic；涉及时间时链接 timeline 或 event。
- `person` 页面应链接代表性 view、相关 topic、相关 reasoning 或 concept。
- `concept` 页面应链接相关 topic，必要时链接提出者、相关 view 或 reasoning。
- `timeline` 页面应链接相关 event、view、reasoning 或 topic。
- `query` 页面应链接回答所依据的 concept、view、reasoning、topic 或 source，并标注是否已补入正式页面。
- `topic` 页面应组织相关 concept、person、event、view、timeline、reasoning、query。

---

## 11. 事实、观点、推测与不确定性

正式知识页必须区分：

- 事实：可由来源验证的信息。
- 观点：某个主体的判断、立场或解释。
- 推测：基于现有信息的推导，但尚未被验证。
- 不确定性：来源不完整、条件未满足、未来尚未发生或推导依赖多个假设。

不得把观点写成事实。  
不得把推测写成结论。  
金融、政策、市场、医疗、法律等高变动领域必须保留不确定性说明。

推荐写法：

```markdown
## 不确定性

- 该判断依赖于“流动性继续改善”这一前提。
- 当前资料未提供完整数据来源。
- 该结论属于作者推测，需后续事件验证。
```

---

## 12. 冲突处理

当新信息与旧信息不一致时：

1. 不直接覆盖旧内容。
2. 同时记录旧说法与新说法。
3. 标注各自日期、来源和主体。
4. 判断属于信息修正、观点变化、表达变化还是明确冲突。
5. 人物观点变化优先保留在 `wiki/views/`，再回写到 `wiki/people/` 的观点演化。
6. 主题认知变化优先更新 `wiki/topics/`，并链接对应 view、event 或 reasoning 作为证据。

---

## 13. 索引与日志约束

新增、迁移、重命名或删除正式知识页时，必须同步维护：

1. `index.md`：正式知识页导航入口，按页面类型和主题组织。
2. `log.md`：追加记录维护动作，不覆盖旧日志。

不新增正式知识页、只修改规则文件或页面内部结构时，通常不需要调整 `index.md`，但仍应追加 `log.md`。

日志应说明：

- 操作类型；
- 修改文件；
- 是否新增正式知识页；
- 是否更新索引；
- 重要说明或后续待办。

---

## 14. 禁止行为

Agent 不得：

1. 删除或覆盖 `sources/` 中原始资料。
2. 未检查已有页面就新建重复页面。
3. 把原文摘要直接放入 `wiki/` 当作知识沉淀。
4. 把 Topic Page 当成所有内容的默认归宿。
5. 混用 View Page、Reasoning Page 和 Timeline Page。
6. 使用旧页面类型新建 `summary`、`comparison` 或 `output` 页面。
7. 省略来源、相关页面、不确定性和必要双链。
8. 修改与当前任务无关的大量文件。
9. 在没有计划和确认的情况下做大规模重构。
10. 让 `schema.md`、`page-types.md`、`AGENTS.md` 和实际目录结构长期不一致。

---

## 15. 当前维护目标

当前知识库的目标是：

```text
把零散资料沉淀为可复用、可追踪、可推理、可持续演进的个人知识系统。
```

因此，`schema.md` 的职责不是扩展写作流程，而是保持结构边界清楚：

- 原始资料归 `sources/`；
- 正式知识归 `wiki/`；
- 页面类型只使用当前八类；
- 来源、双链、索引和日志必须可追踪；
- 事实、观点、推测和不确定性必须分清。
