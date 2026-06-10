---
name: bbxm-trade-review
description: Use when the user asks to review, analyze, file, or turn into a wiki page a 交割单, trade log, portfolio adjustment, buy/sell record, Xueqiu combination screenshot, or “按冰冰小美体系复盘” request. Trigger for phrases like 交割单复盘、复盘这张单、分析调仓、买卖记录、亏损来源、体系三要素、情绪/流动性/仓位/性格匹配.
---

# Bbxm Trade Review

## Overview

Use this skill to review a trade record through the [[people/冰冰小美|冰冰小美]] framework. Treat the trade record as evidence for decision quality, information use, emotion/liquidity state, position structure, and repeatable failure modes; do not treat it as a trophy, a copied order list, or investment advice.

This skill is especially useful inside `llmwiki`, where trade-review outputs should connect to existing pages such as:

- `wiki/queries/冰冰小美的交割单如何复盘.md`
- `wiki/concepts/冰冰小美-交割单认知.md`
- `wiki/views/冰冰小美：金融信息归纳服务风险识别的判断框架.md`
- `wiki/concepts/冰冰小美-亏钱认知.md`
- `wiki/concepts/冰冰小美-体系三要素.md`
- `wiki/concepts/冰冰小美-流动性辩证分析.md`
- `wiki/concepts/冰冰小美-性格匹配.md`
- `wiki/concepts/冰冰小美-分仓.md`

## First Decision

Before writing, decide the output shape:

| User intent | Output |
|---|---|
| Asks “帮我分析 / 复盘这张交割单” | Chat answer with a structured table and clear caveats. |
| Asks “新建 query 页面 / 写入 wiki / 沉淀为页面” | Create or update a `wiki/queries/` page, then update `index.md` and `log.md`. |
| Provides only a general question, no concrete trades | Link back to `wiki/queries/冰冰小美的交割单如何复盘.md` and give the reusable checklist. |
| Provides incomplete screenshot or partial data | Analyze only visible actions; explicitly list missing fields before drawing conclusions. |

If working in `E:\caojingwen\obsidian\llmwiki`, read `AGENTS.md`, `schema.md`, `page-types.md`, `index.md`, and the relevant existing pages before editing wiki files.

## Minimum Input To Look For

Extract these fields from the user’s data when available:

- Trade date and market context.
- Buy/sell direction, instrument, amount, price, and position weight.
- Stated reason at the time of trade.
- Original plan, stop/exit rule, and target if provided.
- Follow-up result: profit/loss, holding period, and later price behavior.
- Whether this is the user’s own trade, a public portfolio, or a third-party example.

If fields are missing, do not invent them. Mark the review as “visible-data only” and keep conclusions tentative.

## Review Workflow

### 1. Restore The Trade Intent

For each visible trade, answer:

- Why was it bought or sold at the time?
- Was the stated basis a fact, an author view, a news stimulus, price action, external recommendation, macro judgment, sector rotation, risk weakening, or valuation?
- Was the action planned, reactive, or compensatory?

This step connects to `金融信息归纳服务风险识别`: every trade should reveal what information the trader trusted.

### 2. Check The Three Elements

Use [[concepts/冰冰小美-体系三要素|体系三要素]] as the main filter:

| Element | Review question |
|---|---|
| 竞争格局 | Was the trade in a direction with real strategic/sector advantage, or only a short-term story? |
| 流动性 | Was money still willing to carry the direction, or was there only a one-day price move? |
| 情绪位置 | Was emotion at a favorable turn, or already in greed, consensus, retreat, or loss-effect expansion? |

If a trade cannot be mapped to these three elements, classify it as “体系外理由” unless the user provides a better original plan.

### 3. Check Liquidity And Next-Day Carry

Apply the rule from [[concepts/冰冰小美-交割单认知|交割单认知]]:

```text
买入发生在当日氛围里，卖出取决于次日是否还有承接。
```

Ask:

- Did the buyer consider next-day carry before buying?
- Was the instrument a core carrier or an edge/arbitrage name?
- Did liquidity concentrate in the main line or scatter into side trades?
- If carry failed, did the plan have room to exit calmly?

Avoid judging only by whether the price later rose or fell.

### 4. Audit Position And Personality Fit

Use [[concepts/冰冰小美-分仓|分仓]] and [[concepts/冰冰小美-性格匹配|性格匹配]]:

- Was position size too large for the trader’s psychological tolerance?
- Did concentration turn a normal fluctuation into forced fear?
- Did the trader claim one system but actually buy edge names, chase, panic sell, or compensate for a missed opportunity?
- Did the trade preserve the ability to correct mistakes?

Position review should focus on whether the size preserved execution quality, not whether bigger size would have made more money.

### 5. Classify Profit Or Loss Source

Do not stop at “赚了 / 亏了 / 看错了.” Classify the source:

| Type | Meaning |
|---|---|
| 信息误读 | News, policy, research, social media, or another person’s view was treated as certainty. |
| 情绪误判 | The trade occurred during retreat, excessive consensus, or spreading loss effect. |
| 流动性误判 | The trader saw volume or a pull-up but missed real carrying capacity. |
| 仓位失控 | Size removed room for correction. |
| 性格不匹配 | Actual behavior contradicted the claimed system. |
| 体系外操作 | The trade cannot be explained through three elements, risk weakening, emotion position, or the original plan. |
| 体系内收益 | Profit came from a planned, explainable trade inside the framework. |
| 运气收益 | Profit came despite weak reasoning; record it as luck, not skill. |

Use [[concepts/冰冰小美-亏钱认知|亏钱认知]] when the trade was driven by phrases, charts, “懂的都懂”,涨停板, institutions, A50, rotation, or other external authority.

### 6. Convert Findings Into A Filter Rule

The useful output of a review is a rule for the next trade, not a paragraph of regret.

Good rule examples:

- If the buy reason cannot be written before the order, do not trade.
- If next-day carry cannot be explained, do not use heavy position.
- If the trade is only because price is rising or someone recommends it, do not treat it as a system trade.
- If the same loss type repeats three times, reduce frequency and capital before changing strategy.
- If emotion is retreating, observe first; do not let intraday pull-ups create false confidence.

## Chat Output Template

When answering in chat, prefer this concise structure:

```markdown
## 一句话结论
[Is this system trade, adjustment, risk reduction, emotional trade, or unclear?]

## 可见动作
| 动作 | 标的 | 可能含义 | 证据限制 |
|---|---|---|---|

## 冰冰小美框架复盘
| 检查项 | 判断 | 依据 | 风险 |
|---|---|---|---|
| 信息依据 |  |  |  |
| 三要素 |  |  |  |
| 流动性与次日承接 |  |  |  |
| 仓位与性格匹配 |  |  |  |
| 亏损/收益来源 |  |  |  |

## 下一次过滤规则
- ...

## 不确定性
- ...
```

## Wiki Page Rules

When creating a `wiki/queries/` page:

1. Use `type: query`.
2. Put the original question in `original_question`.
3. Link existing pages with `[[path|display]]`; do not create empty links casually.
4. Include “当前状态”, “相关页面”, “不确定性”, and “来源”.
5. Update `index.md` under `## 问题`.
6. Append `log.md` with date, operation type, changed files, summary, and follow-up.

If the review becomes a specific trade case rather than a reusable question, keep it as a Query Page unless the source contains a stable view, concept, event, timeline, or reasoning chain that clearly deserves another page type.

## Common Mistakes

- Do not copy someone else’s order list as a recommendation.
- Do not call a profitable but poorly reasoned trade “体系内收益”.
- Do not call a loss “bad luck” before checking information basis, three elements, liquidity, position, and personality fit.
- Do not over-explain macro context when the trade record lacks basic buy/sell and position data.
- Do not write concrete market claims as facts unless the source data supports them.
- Do not omit uncertainty for screenshots, partial trade logs, or third-party portfolio records.
