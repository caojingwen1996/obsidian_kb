# 知识库日志

> 按时间顺序记录知识库操作。仅追加，不覆盖。
> 格式：`## [YYYY-MM-DD] action | subject`

## [2026-04-21] ingest | bi-shu-xi-feng quantification

- 将 `2026-04-05-jiyi-chengzai-mid-2247532824-idx-1` 纳入正式知识层。
- 新增 1 篇 `raw/articles/` 原始归档，并新建 1 条观点页：量化不等于高频，关键是把变化中的结构与情绪翻译成数字。
- 将这条新证据并入 `people/bi-shu-xi-feng.md` 与 `topics/probabilistic-decision-and-risk-control.md`，同步更新 `index.md` 与 `log.md`。

## [2026-04-21] ingest | bingbing xiaomei macroeconomy 2026-04-21

- 将 `2026-04-21` 的 `冰冰小美` 雪球汇总纳入正式知识层，判定仍明确服务于 `topics/macroeconomy` 与人物学习线。
- 新增 1 份 `raw/transcripts/` 汇总归档与 1 份对应 `state.json`，并新建 1 条观点页，聚焦“新旧产业分化由全球定价与产业共识驱动”。
- 更新 `people/bingbing-xiaomei.md` 与 `topics/macroeconomy.md`，把这条新证据并回人物方法与宏观主题框架。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] topic-refactor | macroeconomy concepts split

- 从 `topics/macroeconomy.md` 中先拆出 3 个最稳定的概念页：`汇率、长期利率与流动性`、`债务、分配与增长约束`、`政策对冲与内部定价权`。
- 复用现有 `bi-shu-xi-feng` 与 `bingbing-xiaomei` 的观点证据，不新增新的 `view`，只把重复出现的宏观框架沉淀为 `concept`。
- 更新 `topics/macroeconomy.md` 的 `related_concepts` 与正文入口，让主题页更多承担导航与组合关系，而不是把所有概念解释堆在同一页。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] ingest | bingbing xiaomei macroeconomy 2026-04-13

- 继续审计 `冰冰小美` 剩余日期后，将 `2026-04-13` 这组与 `topics/macroeconomy` 明确相关的内容纳入正式知识层。
- 新增 1 份 `raw/transcripts/` 汇总归档，并新建 1 条观点页，聚焦“政策对冲外部冲击、A 股以我为主的结构性重定价”。
- 更新 `people/bingbing-xiaomei.md` 与 `topics/macroeconomy.md`，把这条新证据并回人物学习线和宏观主题页。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] ingest | bingbing xiaomei macroeconomy continuation

- 继续整理 `冰冰小美` 与 `topics/macroeconomy` 相关的已归档材料，补入 `2026-04-09` 与 `2026-04-12` 两组证据。
- 新增 1 份 `raw/transcripts/` 汇总归档，并新建 2 条宏观相关观点页，分别覆盖“宏观视角 + 市场结构”与“机构化加深后的风险定价”。
- 更新 `people/bingbing-xiaomei.md` 与 `topics/macroeconomy.md`，把这两条新证据并回人物学习线和宏观主题页。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] ingest | bingbing xiaomei macroeconomy

- 将 `cjw-xueqiu-daily-monitor` 中与 `topics/macroeconomy` 明确相关的 `2026-04-10`、`2026-04-14`、`2026-04-19` 内容整理进正式知识层。
- 新增 2 份 `raw/transcripts/` 汇总归档，并基于已存在的 `2026-04-10` 汇总新建 `people/bingbing-xiaomei.md` 与 3 条宏观观点页。
- 更新 `topics/macroeconomy.md`，补入“国家竞争与政策回应”这一组新证据，并将第二条人物学习线接入宏观主题。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] topic-create | macroeconomy

- 新建 `topics/macroeconomy.md`，作为知识库中的“宏观经济”正式 topic 页。
- 先挂接已有的宏观相关原始资料与观点页，形成“增长/债务/分配、通胀/利率、流动性、区间判断”四条观察轴。
- 同步更新 `index.md` 与 `log.md`，将该页纳入正式知识层索引。

## [2026-04-18] schema-update | summary conventions

- 在目录约定和索引中加入 `summaries/` 分区。
- 补充 `summary` 页的专属 schema 字段与最低链接要求。
- 增加 `summary` 页面建页阈值示例。

## [2026-04-18] schema-update | formal knowledge admission

- 在 page type 与建页阈值判断之前加入正式知识层准入门槛。
- 明确不符合领域的资料不得进入正式知识层。

## [2026-04-18] schema-update | out-of-domain discard

- 收紧准入规则：不符合领域的资料直接丢弃，不再保留在 `raw/`。
- 同步更新 schema 与 skill 的表述，将 `raw/` 视为仅保存已通过准入的原始资料。

## [2026-04-18] ingest | bi-shu-xi-feng probabilistic decision framework

- 将 `2026-01-13-jiyi-chengzai-mid-2247519583-idx-2` 纳入正式知识层。
- 围绕概率化决策与风险控制，新建人物、主题、概念、观点四类页面。
- 更新 `index.md`，加入 4 条正式知识页索引。

## [2026-04-18] ingest | bi-shu-xi-feng bayesian adaptation

- 将 `2026-01-14-jiyi-chengzai-mid-2247519588-idx-1` 纳入正式知识层。
- 新建一条观点页，补充“目标分层 + 贝叶斯式策略适配”的细化判断。
- 同步更新人物页、主题页与 `index.md`。

## [2026-04-18] ingest | bi-shu-xi-feng unmeasurable world

- 将 `2026-02-11-jiyi-chengzai-mid-2247519800-idx-1` 纳入正式知识层。
- 新建一条观点页，补充“世界不可测 + 完整策略 + 止损可执行性”的细化判断。
- 同步更新人物页、主题页、概念页与 `index.md`。

## [2026-04-18] topic-update | investment system merged into decision logic topic

- 将“投资系统 / 投资纪律 / 底层决策逻辑”合并收束到同一个 topic 中。
- 重写 `topics/probabilistic-decision-and-risk-control.md`，加入适用市场、目标收益与回撤约束、选资产原则、仓位、进出场、风控、复盘等栏目。
- 新建 `2026-01-31` 对应观点页，作为交易系统与不干预原则的证据节点。

## [2026-04-18] ingest | bi-shu-xi-feng bidirectional mispricing

- 将 `2026-01-26-jiyi-chengzai-mid-2247519692-idx-2` 纳入正式知识层。
- 新建一条观点页，补充“半仓结构 + 正反向乌龙指 + 环境约束”的细化判断。
- 同步更新人物页、主题页、概念页与 `index.md`。

## [2026-04-18] ingest | bi-shu-xi-feng blue ocean execution

- 将 `2026-02-03-jiyi-chengzai-mid-2247519734-idx-1` 纳入正式知识层。
- 新建一条观点页，补充“蓝海竞争 + 反人性执行”的细化判断。
- 同步更新人物页、主题页与 `index.md`。

## [2026-04-18] discarded | 2026-02-18-jiyi-chengzai-mid-2247519853-idx-1

- 判定不进入正式知识层。
- 文章虽然涉及 AI、东西方结构与就业冲击，但核心落点是个人专业选择与能力升级，不属于当前已建立的投资策略主线。
- 现有知识库也尚未建立能稳定承接这篇文章的宏观主题，因此不新建 `people/`、`concepts/`、`topics/`、`views/` 页面，也不更新 `index.md`。

## [2026-04-18] ingest | bi-shu-xi-feng information high ground

- 将 `2026-02-21-jiyi-chengzai-mid-2247519882-idx-1` 纳入正式知识层。
- 新建“信息不对称与信息高地”概念页，以及“信息高地、上位者博弈与非标路径”主题页。
- 新建一条观点页，补充“开放式游戏被改造成封闭竞争”的关键判断。
- 同步更新人物页与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 50-100

- 从 `wechat_history_links.txt` 的 `50-100` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2025-11-29`、`2025-12-09`、`2025-12-17`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 同步更新 `topics/probabilistic-decision-and-risk-control.md`、`concepts/expected-value-stop-loss-and-backstop.md`、`people/bi-shu-xi-feng.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 101-150

- 从 `wechat_history_links.txt` 的 `101-150` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2025-10-19`、`2025-10-25`、`2025-11-22`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中显式补入 3 条新规则：单位风险与单位成本核算、真实耐心约束、同口径比较与高质量收益优先。
- 同步更新 `concepts/expected-value-stop-loss-and-backstop.md`、`people/bi-shu-xi-feng.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 151-200

- 从 `wechat_history_links.txt` 的 `151-200` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 5 篇文章：`2025-09-09`、`2025-09-10`、`2025-09-11`、`2025-09-12`、`2025-09-13`。
- 新增 5 篇原始资料归档，并分别新建 5 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续显式补入新规则：固定模式优先于情绪持仓、策略与个人禀赋匹配、投资是生意、周期只负责理解而不直接负责盈利、拥挤共振会阶段性摧毁边际优势。
- 同步更新 `concepts/expected-value-stop-loss-and-backstop.md`、`people/bi-shu-xi-feng.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 201-250

- 从 `wechat_history_links.txt` 的 `201-250` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-07-04`、`2025-08-16`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续显式补入新规则：高确信不能替代退出与仓位约束，历史周期模板本身也有适用期。
- 同步更新 `concepts/expected-value-stop-loss-and-backstop.md`、`people/bi-shu-xi-feng.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 251-300

- 从 `wechat_history_links.txt` 的 `251-300` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-05-27`、`2025-06-17`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续显式补入新规则：仓位上限先匹配承受力，保本承诺先审计底层资产、偿付来源与对手盘机制。
- 同步更新 `concepts/expected-value-stop-loss-and-backstop.md`、`people/bi-shu-xi-feng.md` 与 `index.md`。

## [2026-04-18] topic-update | probabilistic decision execution rules regrouped

- 将 `topics/probabilistic-decision-and-risk-control.md` 中原本分散在补充段落里的“环境约束”和“反人性程度”并入统一的“执行规则”。
- 保留原有判断不变，只调整结构分组，使所有与持续执行有关的内容集中在同一层。

## [2026-04-18] topic-update | probabilistic decision rule list removed

- 删除 `topics/probabilistic-decision-and-risk-control.md` 中“近期新增规则”这一类总表章节。
- 将其中仍有必要保留的判断分别并回 `适用市场`、`选股或选资产原则`、`执行规则` 等对应章节，避免重复维护一份规则清单。

## [2026-04-18] topic-update | probabilistic decision supplement sections merged

- 删除 `topics/probabilistic-decision-and-risk-control.md` 中残留的 `补充：...` 小节。
- 将仍有必要保留的判断并回 `复盘机制` 等正式章节，避免页面继续以增量补丁方式生长。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 301-350

- 从 `wechat_history_links.txt` 的 `301-350` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 4 篇文章：`2025-03-18`、`2025-03-25`、`2025-04-01`、`2025-04-11`。
- 新增 4 篇原始资料归档，并分别新建 4 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续补入正式章节内容：普通投资者的大区间判断、抄作业前先看懂约束、踏空纪律、保值基准不应简单等同于 `CPI`。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。

## [2026-04-18] topic-update | probabilistic decision evidence moved inline

- 将 `topics/probabilistic-decision-and-risk-control.md` 中原先页尾平铺的 `相关观点` 列表拆散，直接并回各正式章节下方。
- 每组规则后补充对应 `view` 及其支撑点，便于直接看出某条观点在 topic 中支撑哪一句判断。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 351-410

- 从 `wechat_history_links.txt` 的 `351-410` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-02-26`、`2025-03-16`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：左侧交易只投“好学生”、不具备速度优势时不要硬做纯速度竞争、算法正期望和制度变化也属于风控。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 411-470

- 从 `wechat_history_links.txt` 的 `411-470` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2024-11-15`、`2024-12-26`、`2025-01-05`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：同一资产在不同财富阶段对应不同任务、环境桥梁决定你更容易进入哪类系统、小本金别照搬高门槛研究型价值投资。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 471-530

- 从 `wechat_history_links.txt` 的 `471-530` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2024-10-19`、`2024-10-20`、`2024-10-24`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：顶底与放量只能放回时间窗口和参与者结构中理解、止损位只能在入场前改写、资金使用率与最大回撤必须纳入同一收益口径。
- 同步补齐 `topics/probabilistic-decision-and-risk-control.md` 与 `people/bi-shu-xi-feng.md` frontmatter 中此前遗漏的 `sources / related` 条目，并更新 `index.md` 与 `log.md`。
- `2024-10-18` 与 `2024-10-07` 这两篇未并入本 topic，因为前者更偏广义“投资自己”，后者更偏宏观气候与价值投资语境，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 531-590

- 从 `wechat_history_links.txt` 的 `531-590` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2024-07-04`、`2024-07-13`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回 `选股或选资产原则`：先看自己在商业模式里扮演谁、资产价值先看资源依托而不是表面标签。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2024-08-12` 与 `2024-07-24` 这两篇未并入本 topic，因为前者更偏一般性的训练与探索方法，后者更偏宏观财富分配与共识经济，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 591-650

- 从 `wechat_history_links.txt` 的 `591-650` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2024-04-23`、`2024-05-14`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：同名资产在不同交易结构下风险完全不同、商品型结构也要拆解真实风险来源、长线系统不能临时改用波段守则、高估时更自然的动作是停杠杆与增现金。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2024-06-03` 与 `2024-05-16` 这两篇未并入本 topic，因为前者更偏宏观利率与债务判断，后者更偏价格补贴消失与个体阶层问题，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 651-710

- 从 `wechat_history_links.txt` 的 `651-710` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2024-02-19`、`2024-03-12`、`2024-03-23`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：投资要求自驱找方向、市场不会为你的牌面量身打造机会、投资先算败先找安全垫、散户与职业投资人的时机并不相同。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2024-04-08` 与 `2024-02-24` 这两篇未并入本 topic，因为前者更偏长期传承与稳定性，后者更偏社会角色与对外信号管理，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 711-770

- 从 `wechat_history_links.txt` 的 `711-770` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 1 篇文章：`2024-02-01`。
- 新增 1 篇原始资料归档，并新建 1 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回 `风控规则`：金融工具要先看原始用途；若本来只是给某套交易结构配平时间与利息风险的对冲工具，就不能脱离原组合被拿来当主盈利模式。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2024-01-12`、`2024-01-13`、`2024-01-19` 这几篇本轮未并入本 topic：前者更像长文入口页，后两者与当前投资系统主线的贴合度不够紧。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 771-830

- 从 `wechat_history_links.txt` 的 `771-830` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 4 篇文章：`2023-10-04`、`2023-10-17`、`2023-11-29`、`2023-12-01`。
- 新增 4 篇原始资料归档，并分别新建 4 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：商品先看真正的定价层与价差来源、收益目标要服从策略容量、成熟系统重在别把赚到的钱输回去、还要把平账赖账和规则外干预纳入退出预案。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2023-10-22` 与 `2023-11-16` 这两篇本轮未并入本 topic：前者更偏一般性的实践训练与信息差打破，后者更偏宏观转折判断，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 831-890

- 从 `wechat_history_links.txt` 的 `831-890` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2023-08-07`、`2023-10-01`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：学习大玩家前先识别其隐藏生态位与退出要求、账面盈利之前先确认资金能否按规则真实提取。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2023-09-29`、`2023-08-30`、`2023-08-29` 这几篇本轮未并入本 topic：前者更偏消费品品牌溢价，后两者分别更偏地产产品设计与事件表达策略，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 891-950

- 从 `wechat_history_links.txt` 的 `891-950` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2023-05-31`、`2023-06-10`、`2023-07-13`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：不要跳到自己还不会操盘的规模、长期重复选择应优先看数学期望、系统应追求“每一次”而不是“某一次”的漂亮结果。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2023-07-23` 这篇本轮未并入本 topic：更偏房地产资产配置边界，和当前投资系统主线的贴合度不如本轮纳入的三篇。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 951-1010

- 从 `wechat_history_links.txt` 的 `951-1010` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2023-05-02`、`2023-05-17`、`2023-05-28`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：依赖接盘预期的资产必须在买入前先想清楚退出、预期型资产先看共识与供需、降低持仓成本本身就是扩大安全气囊。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2023-05-08` 这篇本轮未并入本 topic：更偏财富路径与地域分布讨论，和当前投资系统主线的贴合度不如本轮纳入的三篇。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1011-1070

- 从 `wechat_history_links.txt` 的 `1011-1070` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2023-02-14`、`2023-02-23`、`2023-03-17`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：房产价值判断要同时看中心、择邻与可卖性、投资分析先看市场规模与买方承接力、全职投资还要预设家庭财务边界与最坏情形。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2023-02-20` 这篇本轮未并入本 topic：更偏婚姻财务治理与共同决策责任，和当前投资系统主线的贴合度不如本轮纳入的三篇。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1071-1130

- 从 `wechat_history_links.txt` 的 `1071-1130` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2022-12-11`、`2023-01-15`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：能对冲锁利润时就不该默认押方向、没有真实买方与真实路径的建议没有执行价值。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2023-01-08` 与 `2023-01-05` 这两篇本轮未并入本 topic：前者更偏一般人生决策与自我选择，后者更偏商业观察，不如本轮纳入的两篇贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1131-1190

- 从 `wechat_history_links.txt` 的 `1131-1190` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2022-09-14`、`2022-10-16`、`2022-10-31`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：优势来自不确定性中的确定性、同一理论机会对不同体量的人未必是同一套系统、市场结构本身也属于风控边界。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2022-10-23` 这篇本轮未并入本 topic：更偏买房观念与消费态度变化，不如本轮纳入的三篇紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1191-1250

- 从 `wechat_history_links.txt` 的 `1191-1250` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2022-07-01`、`2022-07-13`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：系统要按样本总集与时间曲线看问题、金融机构风险也要穿透看盘子大小与资产集中度。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2022-07-15`、`2022-08-13`、`2022-08-23` 这几篇本轮未并入本 topic：前者更偏现实处置与利益分配，后两篇更偏财富观与阅历判断，不如本轮纳入的两篇紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1251-1310

- 从 `wechat_history_links.txt` 的 `1251-1310` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2022-05-07`、`2022-05-15`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：同一建议只对具备对应条件的人成立、能锁利润时不该额外承担时间风险。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2022-06-01`、`2022-05-05`、`2022-06-21` 这几篇本轮未并入本 topic：前者本次抓到的正文不足以支撑稳定提炼，后两者分别更偏股民生态/流量观察与消费观念变化，不如本轮纳入的两篇紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1311-1370

- 从 `wechat_history_links.txt` 的 `1311-1370` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 1 篇文章：`2022-03-20`。
- 新增 1 篇原始资料归档，并新建 1 条观点页。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中继续把新判断并回正式章节：低利率长久期负债只有在确实存在更高收益资金去处时才成立。
- 同步更新 `people/bi-shu-xi-feng.md`、`index.md` 与 `log.md`。
- `2022-03-22`、`2022-02-16`、`2022-02-11` 这几篇本轮未并入本 topic：前者更偏住房身份与意义投射，后两者本次抓到的正文还不足以支撑稳定提炼，不如本轮纳入的这一篇紧贴当前投资系统主线。

## [2026-04-22] ingest | xueqiu daily summaries for bingbing xiaomei and mai gupiao de laomujiang

- 归档了 `2026-04-22` 的两份雪球日汇总到 `raw/transcripts/`：`冰冰小美` 与 `买股票的老木匠`，并同步保存对应 `state.json`。
- 为 `冰冰小美` 新增 1 条观点页：`views/bingbing-xiaomei-2026-04-22-ai-repricing-follows-global-industry-context-and-crowded-liquidity.md`，将其当天关于 AI 行情、关键材料路径与抱团流动性的判断并回 `people/bingbing-xiaomei.md` 与 `topics/macroeconomy.md`。
- 为 `买股票的老木匠` 正式建立人物页 `people/mai-gupiao-de-laomujiang.md`，并新增 1 条观点页：`views/mai-gupiao-de-laomujiang-2026-04-22-short-term-a-shares-move-on-themes-not-fundamentals.md`，挂接到 `topics/probabilistic-decision-and-risk-control.md`。
- 同步更新 `index.md` 与 `log.md`，让这次 ingest 进入正式知识层并可从索引直接访问。

## [2026-04-22] ingest | backfill mai gupiao de laomujiang person line from existing transcripts

- 从已归档的 `2026-04-06`、`2026-04-09`、`2026-04-10`、`2026-04-17` 四份 `raw/transcripts/` 中，补齐 `买股票的老木匠` 的正式人物学习线。
- 新增 4 条观点页，分别沉淀“高不确定环境下先降风险不先赌预测”“低买高卖的前提是安全标的”“投资结果更取决于赔率与位置”“炒概念可以但别拿基本面为错价硬找借口”。
- 在 `people/mai-gupiao-de-laomujiang.md` 中把人物画像从单点判断补成连续主线：风险暴露管理、安全边际、赔率位置、低买高卖和认知诚实。
- 在 `topics/probabilistic-decision-and-risk-control.md` 中将这组新判断并回“底层决策逻辑”“适用市场”“收益来源与系统本质”等区块。
- 同步更新 `index.md` 与 `log.md`，让老木匠这条线从单篇观点扩展成可持续追踪的人物学习线。

## [2026-04-22] query | why bingbing xiaomei is hard to read and what to learn first

- 基于 `people/bingbing-xiaomei.md`、`topics/macroeconomy.md` 与两个相关概念页，回答了“为什么看不懂冰冰小美的文章，以及需要先补什么知识”。
- 新增 `queries/why-bingbing-xiaomei-is-hard-to-read-and-what-to-learn-first.md`，将答案整理为可复用问答。
- 在答案中把阅读障碍拆成四层：宏观价格信号、市场结构、政策框架、全球产业映射，并给出最短阅读顺序。
- 同步更新 `index.md` 与 `log.md`，让这条问答可以从知识库索引直接访问。

## [2026-04-22] query | bingbing xiaomei reading map from entry to advanced

- 基于上一条“为什么难懂”的问答，继续整理出一条可执行的 `冰冰小美` 阅读地图。
- 新增 `queries/bingbing-xiaomei-reading-map-from-entry-to-advanced.md`，把阅读顺序拆成“入门 / 进阶 / 跳读顺序”三层。
- 在这条问答里明确了每一层先读哪些页面、每一步的目标是什么，以及以后读她的新文章时应该先抓哪几个问题。
- 同步更新 `index.md` 与 `log.md`，让这条阅读地图可以直接从知识库索引进入。

## [2026-04-22] lint | merge bingbing xiaomei queries into one canonical entry

- 将两条围绕 `冰冰小美` 的问答合并为一条规范入口，避免 `queries/` 中出现平行重复页面。
- 把“为什么难懂”“需要先补什么知识”“从入门到进阶怎么读”统一并回 `queries/why-bingbing-xiaomei-is-hard-to-read-and-what-to-learn-first.md`。
- 删除 `queries/bingbing-xiaomei-reading-map-from-entry-to-advanced.md`，并在 `index.md` 中只保留一个问答入口。
- 同步将页面总数从 `94` 调整回 `93`。

## [2026-04-22] ingest | xueqiu compilation 380960384 and linked bingbing xiaomei posts

- 归档了 `岜菲特` 于 `2026-03-25` 发布的雪球合集页到 `raw/articles/2026-03-25-bafeite-xueqiu-380960384.md`，保留了 41 条子帖链接清单。
- 顺着母页链接成功抓取并整理了 `冰冰小美` 在 `2026-01-04` 到 `2026-01-15` 的 18 篇原文到 `raw/articles/2026-03-25-bafeite-xueqiu-380960384-linked-posts-captured.md`。
- 另外记录了 23 篇未补齐链接到 `raw/articles/2026-03-25-bafeite-xueqiu-380960384-linked-posts-blocked.md`；这些链接不是失效，而是在本轮批量访问中触发了雪球滑块验证。
- 新增 `summaries/bingbing-xiaomei-2026-q1-macro-recap.md`，把这批材料压成五阶段复盘，补出了她把“地缘重估、汇率与流动性切换、资源与货币秩序重排”翻译成仓位动作的连续主线。
- 同步更新 `people/bingbing-xiaomei.md`、`topics/macroeconomy.md` 与 `index.md`，把这次 ingest 接入现有的人物学习线和宏观主题页。

## [2026-04-23] ingest | backfill remaining 23 linked xueqiu posts after slider verification

- 在用户完成雪球滑块验证后，补抓了合集页 `380960384` 中剩余的 23 篇 `冰冰小美` 子帖，现已把整批原文扩展到 `41/41` 完整状态。
- 将 `raw/articles/2026-03-25-bafeite-xueqiu-380960384-linked-posts-captured.md` 从首轮的 18 篇更新为完整 41 篇版本，并同步把母页清单改为全部已抓取。
- 将 `raw/articles/2026-03-25-bafeite-xueqiu-380960384-linked-posts-blocked.md` 改写为一次风控与补抓过程记录，不再保留未完成项。
- 更新 `summaries/bingbing-xiaomei-2026-q1-macro-recap.md`，把阶段三到阶段五从“主要依赖母页摘要”补成“已结合补抓原文核对”的版本。
- 同步把 `index.md` 的最近更新时间推进到 `2026-04-23`。

## [2026-04-23] ingest | bingbing xiaomei q1 views and geopolitical topic

- 基于已补齐的 `冰冰小美 2026Q1` 雪球 `41` 篇子帖，继续把阶段归纳下沉到正式知识层。
- 新建 3 条观点页，分别沉淀“治理红线改写危机脚本”“黄金与美债平价对应货币秩序竞争”“指数恐慌与真实产业强弱需拆开判断”。
- 新建 `topics/geopolitical-repricing-and-resource-monetary-order.md`，把地缘重估、资源争夺、避险资产和货币形态竞争收束为独立长期主题。
- 更新 `people/bingbing-xiaomei.md` 与 `topics/macroeconomy.md`，补入这批新观点与新 topic 的回链。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-23] ingest | xueqiu daily summaries for bingbing xiaomei and mai gupiao de laomujiang

- 归档了 `2026-04-23` 的两份雪球日汇总到 `raw/transcripts/`：`冰冰小美` 与 `买股票的老木匠`，并同步保存对应 `state.json`。
- 为 `冰冰小美` 新增 1 条观点页：`views/bingbing-xiaomei-2026-04-23-ai-global-synchrony-reprices-supply-chain-position.md`，将她当天关于 AI 全球协同、政策支撑、外资参与和产业链卡位的判断并回 `people/bingbing-xiaomei.md` 与 `topics/macroeconomy.md`。
- 为 `买股票的老木匠` 新增 1 条观点页：`views/mai-gupiao-de-laomujiang-2026-04-23-dont-force-style-drift-in-a-technology-led-bull.md`，把“技术浪潮里的结构牛市不等于你必须风格漂移”并回 `people/mai-gupiao-de-laomujiang.md` 与 `topics/probabilistic-decision-and-risk-control.md`。
- 同步更新 `index.md` 与 `log.md`，让这次 ingest 进入正式知识层并可从索引直接访问。
