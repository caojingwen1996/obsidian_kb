---
name: trade-ticket-review
description: Use when the user asks to review, analyze, summarize, score, file, or turn into rules a 交割单, trade log, buy/sell record, portfolio adjustment, losing trade, profitable trade, continuous drawdown, or “用冰冰小美体系复盘交易” request. Trigger for phrases like 交割单复盘、复盘这笔交易、这笔为什么亏、盈利能否复制、整理交易错误、明日谁来接、仓位/性格匹配、情绪交易、流动性误判.
---

# Trade Ticket Review

## Overview

Use this skill to review trade tickets by reversing from visible trades back to decision quality. Focus on information basis, risk state, emotion, liquidity, position sizing, buy motivation, sell pressure, system fit, profit/loss source, and the next corrective rule.

Treat the trade ticket as evidence, not as investment advice or a copied order list. Review losses first because losses expose system, personality, and execution defects more clearly than lucky profits. 先恢复原始交易意图，再评价交易结果，避免以后视价格替代当时决策质量。

如果用户要求判断这笔交易是否符合冰冰小美体系三要素，交易复盘仍由本技能主导，但必须读取并执行 `bbxm-three-factor-analysis/SKILL.md`，把其三要素状态、证据、反证和失效条件作为复盘证据。本技能不复制其检查清单，也不以情绪或流动性单项检查冒充完整三要素结论。

如果复盘需要正式判断风险方向，必须读取并执行 `risk-identification/SKILL.md`，消费其“风险增强 / 风险持平 / 风险减弱 / 风险重新增强 / 证据不足”结果及证据。本技能不维护第二套风险状态量表，也不把风险减弱直接等同买点。

## First Decision

| User intent | Output |
|---|---|
| Quick review of one trade or screenshot | Chat answer using the quick template. |
| Detailed review of one complete trade | Single-trade review with score, error code, and next rule. |
| Weekly/monthly/phase trade log | Phase review with loss ranking, profit ranking, error frequency, and next-stage constraints. |
| Asks to write into `llmwiki` | Create or update a `wiki/queries/` page, then update `index.md` and `log.md`. |
| Only asks a general method question | Give the reusable checklist; do not invent trades. |
| Screenshot or partial data is incomplete | Analyze visible data only and list missing fields before conclusions. |

If editing `E:\caojingwen\obsidian\llmwiki`, first read `AGENTS.md`, `schema.md`, `page-types.md`, `index.md`, `log.md`, and relevant existing pages. Preserve wiki conventions and explicitly record uncertainty.

## Input Fields

Minimum fields to look for:

- Trade date, instrument, buy/sell action, price, position weight, and profit/loss.
- Stated reason at the time of buying and selling.
- Market/sector context, risk judgment, emotion state, liquidity state, and plan if available.
- Holding period, maximum floating profit/loss, whether execution followed the plan.
- Whether this is the user's own trade, a public portfolio, or a third-party example.

Do not fill missing fields by imagination. Mark the review as “visible-data only” when input is partial.

## Review Order

Prioritize:

1. Large losing trades.
2. Consecutive trades that caused the largest drawdown.
3. Avoidable losses.
4. Trades that gave back profits.
5. Profitable trades.

For profitable trades, separate system profit from luck. A profitable trade with weak reasoning is not “体系内收益”.

## Core Workflow

### 1. Record Facts First

Write the trade facts before interpreting them:

| Field | Content |
|---|---|
| 日期 | YYYY-MM-DD |
| 标的 | 股票/ETF/指数/板块 |
| 动作 | 买入/卖出/加仓/减仓 |
| 价格 | 成交价格 |
| 仓位 | 占总资产比例 |
| 周期 | 日内/隔日/短线/中线 |
| 盈亏 | 金额和比例 |
| 计划执行 | 是/否/未知 |
| 最大浮盈/浮亏 | 如可见 |

### 2. 恢复原始交易意图与信息依据

Ask: “我当时到底相信了什么信息？”

先还原当时的买卖理由、计划、可见信息和预期承接，再使用事后结果检验；不得因为后来上涨就把弱理由改写成体系内交易，也不得因为后来下跌就抹去当时合理但失败的计划。

Classify the trusted input:

| Type | Common mistake |
|---|---|
| 政策信息 | 把利好直接等同买点。 |
| 流动性信息 | 只看上涨，忽略承接。 |
| 情绪信息 | 情绪下降时追分时拉升。 |
| 产业/个股信息 | 用故事压过市场环境。 |
| 外部宏观信息 | 大判断压过盘面敏感度。 |
| 他人观点 | 借别人的判断掩盖自身无规则。 |
| 价格信息 | 把 K 线结果当买入逻辑。 |

Judge whether the information was close to money: did it affect quantity, price, flow, behavior, or only narrative?

### 3. Consume The Risk Direction Before Reviewing Opportunity

需要正式风险结论时，引用 `risk-identification` 的独立结果：

| 字段 | 复盘要求 |
|---|---|
| 风险方向 | 风险增强 / 风险持平 / 风险减弱 / 风险重新增强 / 证据不足 |
| 证据与反证 | 说明当时可见信号，而不是用事后行情倒推。 |
| 交易影响 | 检查仓位、频率和退出计划是否与风险方向匹配。 |
| 证据缺口 | 缺少关键数据时保留“证据不足”，不得自行补全。 |

风险增强或重新增强阶段的重仓买入应重点审计；风险减弱只表示风险方向变化，不自动构成买入依据。

### 4. Check Emotion, Liquidity And “明日谁来接”

Emotion:

| State | Meaning | Trade implication |
|---|---|---|
| E+ 情绪向上 | 龙头强、赚钱效应扩散、追高有人接 | 可顺势 |
| E0 情绪震荡 | 赚钱和亏钱效应并存 | 降仓位 |
| E- 情绪向下 | 核按钮、炸板、冲高回落、亏钱扩散 | 避免追高 |
| E? 情绪不明 | 主线混乱、轮动过快 | 等待 |

Liquidity:

| State | Meaning | Trade implication |
|---|---|---|
| L+ 充裕 | 成交活跃、板块扩散、承接强 | 容易卖出 |
| L0 一般 | 成交正常、分歧加大 | 控制仓位 |
| L- 衰竭 | 缩量、无人接、冲高回落 | 谨慎买入 |
| Lx 虚假流动性 | 分时拉升、概念热度、短期诱多 | 防追高 |

Always ask: “今天买入后，明日谁来接？” Buying pressure and selling pressure are decided together. 区分核心承载标的与边缘套利标的，并检查次日承接失败时是否仍能从容退出。

### 5. 审计仓位与性格匹配

Check whether position size preserved room to correct mistakes:

- Was the position too large for the risk state or liquidity?
- Was it concentrated in one instrument or one sector?
- Did size turn normal volatility into forced fear?
- Did the trader claim one system but execute another?
- Did the trade fit the trader’s personality and discipline?

Position review is about execution quality, not whether a larger position would have made more money.

### 6. Identify Buy Motivation And Sell Behavior

Buy motivation categories:

| Motivation | Meaning |
|---|---|
| 体系买入 | 有规则、有环境、有仓位、有退出。 |
| 风险减弱买入 | 风险释放后信号确认。 |
| 情绪顺势买入 | 情绪向上、流动性充裕。 |
| 分时诱惑买入 | 被突然拉升吸引。 |
| 利好刺激买入 | 看见消息后冲动买入。 |
| 跟风/他人观点 | 外部观点驱动。 |
| 恐惧踏空 | 怕错过行情。 |
| 不甘心/对抗市场 | 想证明自己正确。 |
| 摊低成本 | 亏损后无规则补仓。 |

Sell behavior categories:

| Sell type | Meaning |
|---|---|
| 计划卖出 | 达到预设条件。 |
| 风险卖出 | 风险增强后主动退出。 |
| 流动性卖出 | 承接变弱后退出。 |
| 情绪卖出 | 情绪转弱后降低暴露。 |
| 恐惧割肉 | 仓位过重、无计划、被动卖出。 |
| 核按钮卖出 | 无承接时恐慌出逃，通常是买入端错误。 |
| 盈利回吐卖出 | 没有卖点计划。 |

### 7. Classify Error Or Profit Source

For losses, assign at least one error code:

| Code | Type | Typical sign |
|---|---|---|
| E01 | 信息误判 | 把消息当买点。 |
| E02 | 风险忽视 | 风险增强期仍加仓。 |
| E03 | 情绪逆势 | 情绪下降时追高。 |
| E04 | 流动性误判 | 没有考虑明日接盘。 |
| E05 | 仓位失控 | 重仓、满仓、集中。 |
| E06 | 主观YY | 过度分析个股故事。 |
| E07 | 体系不匹配 | 性格与打法冲突。 |
| E08 | 高频冲动 | 管不住手。 |
| E09 | 恐惧卖出 | 买入贪婪，卖出恐惧。 |
| E10 | 无卖点计划 | 买前没想卖。 |
| E11 | 对抗市场 | 不甘心，不认错。 |
| E12 | 宏观沉迷 | 大判断压过盘面。 |
| E13 | 概念幻觉 | 概念热度误当长期逻辑。 |
| E14 | 交易阶段错误 | 博弈阶段当躺赢阶段。 |
| E15 | 复盘缺失 | 无记录，无修正。 |

For profits, classify as `体系内收益`, `风险减弱收益`, `情绪顺势收益`, `流动性收益`, or `运气收益`.

### 8. Score Only When Evidence Is Enough

Use 100 points when data supports scoring:

| Dimension | Points |
|---|---:|
| 信息依据 | 15 |
| 风险判断 | 20 |
| 情绪判断 | 15 |
| 流动性判断 | 15 |
| 仓位控制 | 15 |
| 买卖计划 | 10 |
| 执行纪律 | 10 |

Grade: A 85-100, B 70-84, C 55-69, D 40-54, F 0-39. If key fields are missing, give a qualitative grade and say scoring is unverified.

## Output Templates

### Quick Review

```markdown
## 一句话结论
[交易性质：体系交易 / 情绪交易 / 风险减弱交易 / 调仓 / 风险控制 / 证据不足]

## 可见动作
| 动作 | 标的 | 可能含义 | 证据限制 |
|---|---|---|---|

## 复盘表
| 检查项 | 判断 | 依据 | 风险 |
|---|---|---|---|
| 信息依据 |  |  |  |
| 风险状态 |  |  |  |
| 情绪状态 |  |  |  |
| 流动性/明日承接 |  |  |  |
| 仓位/性格匹配 |  |  |  |
| 买入动机/卖出行为 |  |  |  |
| 错误或收益来源 |  |  |  |

## 修正规则
- 下次禁止：
- 下次允许：
- 仓位限制：

## 不确定性
- 
```

### Single Trade Review

```markdown
# 交割单复盘：{{标的}} - {{交易日期}}

## 1. 交易事实
| 项目 | 内容 |
|---|---|
| 标的/板块 |  |
| 买入/卖出日期 |  |
| 买入/卖出价格 |  |
| 仓位/周期 |  |
| 盈亏 |  |
| 是否按计划 |  |

## 2. 决策链条
触发信息 → 买入动机 → 风险状态 → 情绪方向 → 流动性条件 → 仓位暴露 → 卖出压力 → 实际结果

## 3. 错误归因或收益来源
| 类型 | 是否存在 | 证据 |
|---|---|---|

## 4. 交易评分
| 维度 | 分数 | 说明 |
|---|---:|---|

## 5. 最终结论
- 交易质量等级：
- 主要问题：
- 最大风险：
- 是否可复制：
- 是否应纳入错误库：

## 6. 下次交易约束
- 禁止事项：
- 允许事项：
- 买入前必须确认：
- 卖出前必须确认：
```

### Phase Review

```markdown
# 阶段交割单复盘：{{时间范围}}

## 阶段概况
| 总交易次数 | 胜率 | 总收益率 | 最大回撤 | 最大单笔亏损 | 高频/重仓次数 |
|---:|---:|---:|---:|---:|---:|

## 亏损交易排名
| 排名 | 日期 | 标的 | 亏损比例 | 主要错误 | 是否可避免 |
|---|---|---|---:|---|---|

## 盈利交易排名
| 排名 | 日期 | 标的 | 盈利比例 | 盈利来源 | 是否可复制 |
|---|---|---|---:|---|---|

## 错误频率统计
| 错误代码 | 出现次数 | 占比 | 严重程度 |
|---|---:|---:|---|

## 阶段结论
- 最赚钱的交易类型：
- 最亏钱的交易类型：
- 最常见错误：
- 最危险错误：
- 下阶段核心规则：
```

## Trade Gate

Default to “禁止买入” when any condition appears:

- 情绪转折向下时被分时直线拉升诱惑。
- 风险增强或重新增强时仍想重仓。
- 只知道买入理由，没有卖出计划。
- 无法回答“明日谁来接”。
- 个股流动性不足但仓位过重。
- 板块亏钱效应正在扩散。
- 买入依据只来自他人观点。
- 连续亏损后想通过重仓翻本。
- 仓位大到影响睡眠和判断。
- 同类错误已重复出现 3 次以上。

Allow trade evaluation only when the independent risk result does not show strengthening risk, emotion is not E-, liquidity is L+ or L0, tomorrow's carry is explainable, position has room to correct, and sell conditions are written before entry. A weakening risk result permits further evaluation but is not itself a buy signal.

## Common Mistakes

- Do not judge only by final profit/loss.
- Do not call profitable but weak-reasoning trades system profit.
- Do not call a loss bad luck before checking information, risk, emotion, liquidity, position, and plan.
- Do not over-explain macro context when basic trade facts are missing.
- Do not create concrete market claims without source data.
- Do not omit uncertainty for screenshots, partial logs, or third-party records.
