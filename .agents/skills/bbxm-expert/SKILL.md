---
name: bbxm-expert
description: Use when the user invokes bbxm-expert, 冰冰小美专家, 冰冰小美体系, 产业思维, 产业分析, 行业分析, 产业链分析, 三要素分析, 体系三要素, 信息过滤, 交易复盘, 风险识别, 机构级研报, 个股深度研究, 估值, 公允价值, DCF, 目标价, or asks how to route a market, company, industry, news, or trade request inside the 冰冰小美 framework.
---

# 冰冰小美专家总入口

## 定位

本技能是当前 `llmwiki` 项目的 `bbxm-expert` 总入口，用于识别用户意图，并在冰冰小美体系内选择合适的项目级分析路径。

## 入口强制规则

当用户点名 `bbxm-expert`、`冰冰小美专家` 或 `冰冰小美体系` 时，必须先读取本总入口，再按下面的分流规则读取对应子技能；不得凭印象直接使用相邻 skill。

如果用户的主动作是研究一家上市公司，并要求完整基本面、估值、目标价或“是否值得买”的决策报告，使用 `bbxm-equity-research`。完整研报中的风险阶段可引用 `bbxm-risk-identification`，但不得用风险识别替代财务、估值与证据审计。

如果用户的主动作是“过滤一条信息”，必须读取并执行 `bbxm-information-filter-flow/SKILL.md`。这里的“过滤”包括但不限于：

- “过滤这条信息”
- “帮我过滤这条新闻 / 公告 / 政策 / 研报 / 传闻”
- “这条信息有没有金融意义”
- “这个新闻有用吗”
- “这个信息能不能交易”
- “这个政策怎么影响市场”
- “判断投资 / 投机 / 噪音 / 误导”
- “该跟踪、交易、归档、回避还是过滤”

过滤类请求的优先级高于风险识别。即使信息中出现“风险”“买入”“加仓”“交易”“利好”“利空”等词，只要用户是在问这条信息本身如何处理，仍然先走 `bbxm-information-filter-flow`，不要直接跳到 `bbxm-risk-identification`。

## 子技能分流

| 用户意图 | 优先使用 |
|---|---|
| 信息出现、信息真假、信息金融意义、信息过滤、新闻/公告/政策/研报有没有用、能不能交易、该不该跟踪/归档/回避 | `bbxm-information-filter-flow` |
| 交割单复盘、买卖记录复盘、仓位行为复盘 | `bbxm-trade-ticket-review` |
| 完整公司研究、机构级研报、基本面深挖、公允价值、DCF、目标价、估值区间、是否值得买或现金是否投入 | `bbxm-equity-research` |
| 产业思维、产业分析、行业分析、赛道分析、产业链结构、产业约束、产业周期与产业行动结论 | `bbxm-industry-analysis` |
| 直接分析体系三要素，判断市场、指数、板块或个股的竞争格局、流动性、情绪位置及共振状态 | `bbxm-three-factor-analysis` |
| 判断风险增强、持平、减弱或重新增强 | `bbxm-risk-identification` |

## 冲突消解

按以下顺序判断，不得跳步：

1. 用户是否要求“过滤/判断一条信息如何处理”？是则使用 `bbxm-information-filter-flow`。
2. 用户是否提供交割单、成交记录、买卖动作、仓位变化并要求复盘？是则使用 `bbxm-trade-ticket-review`。
3. 用户是否要求完整研究一家上市公司，包含财务历史、估值、目标价或现金决策？是则使用 `bbxm-equity-research`；其中的风险状态按需引用 `bbxm-risk-identification`。
4. 用户是否要求分析一个产业、行业、赛道或产业链的时代主线、约束、完整周期与验证？是则使用 `bbxm-industry-analysis`。
5. 用户是否要求直接分析体系三要素，判断竞争格局、流动性、情绪位置或三者共振，且主动作不是信息过滤、交易复盘、完整公司研究或产业分析？是则使用 `bbxm-three-factor-analysis`。
6. 用户是否只要求判断风险增强、持平、减弱或重新增强，且不是在过滤单条信息、复盘交易、产出完整研报或分析产业路径？是则使用 `bbxm-risk-identification`。
7. 如果一句话同时满足多个条件，优先选择用户的主动作；信息过滤、交易复盘、完整公司研究分别优先于直接子技能路由。

`bbxm-risk-identification` 与 `bbxm-three-factor-analysis` 是两个技能平行、互不调用：前者判断风险状态及其变化，后者直接分析竞争格局、流动性与情绪的位置和共振。用户同时要求风险判断与三要素分析时，由 `bbxm-expert` 分别调用两个技能并汇总结论；一个技能不能替代另一个。

反例：

- 用户说“过滤这条信息：某公司公告拟投资某项目”，不能只用 `bbxm-risk-identification`；必须使用 `bbxm-information-filter-flow`。
- 用户说“这个新闻能不能交易”，不能只给风险节点评级；必须使用 `bbxm-information-filter-flow` 判断信息类型、来源可信度、价格反应、时效和最终处理方式。
- 用户说“复盘这笔买入依据是不是被消息误导”，先用 `bbxm-trade-ticket-review` 复盘交易，再按需要引用 `bbxm-information-filter-flow` 判断消息。
- 用户说“研究某上市公司并做 DCF，回答今天是否会买”，必须使用 `bbxm-equity-research`，不能只输出 `bbxm-risk-identification` 的风险等级。
- 用户说“分析航空航天产业”，进入 `bbxm-industry-analysis`，不因出现“风险”或“股票”一词自动降级为个股风险识别。
- 用户说“这条航空航天增长数据有没有金融意义”，仍进入 `bbxm-information-filter-flow`。
- 用户说“研究航天电子并给出 DCF 和目标价”，进入 `bbxm-equity-research`。
- 用户说“直接按体系三要素分析当前指数的竞争格局、流动性和情绪位置”，使用 `bbxm-three-factor-analysis`。
- 用户说“按冰冰小美体系判断该股风险是在增强还是减弱”，但没有要求完整财务和估值研报，使用 `bbxm-risk-identification`。
- 用户说“分析当前板块的三要素，同时判断风险是否重新增强”，由 `bbxm-expert` 分别调用 `bbxm-three-factor-analysis` 与 `bbxm-risk-identification`，再汇总两者结论。

## 工作原则

1. 先判断用户意图，再选择分析路径。
2. 能用子技能解决的问题，优先交给子技能。
3. 分流到子技能后，必须读取所选子技能的 `SKILL.md`；同目录存在 `template.md` 时也必须读取并遵守其输出格式。
4. 涉及冰冰小美体系判断时，必须先检索当前 wiki。
5. 实时市场判断必须核验当前数据。
6. 输出时按适用范围明确写出状态、证据、反证、缺口、失效条件和行动。
7. `bbxm-equity-research` 必须使用同目录 `template.md`，并把结论转换为 `buy / sell / reduce / wait / observe / review` 行动语言。
