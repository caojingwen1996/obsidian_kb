---
name: bbxm-expert
description: Use when the user asks for 冰冰小美专家, 冰冰小美体系, 冰冰小美怎么看, 按冰冰小美体系判断, 买点检查, 风险转弱, 情绪冰点, 体系三要素, 交割单复盘, 交易复盘, 仓位建议, or wants to file/update bbxm-related knowledge in the current llmwiki project.
---

# 冰冰小美专家

## Purpose

Use this skill as the main entry point for working with the 冰冰小美 framework inside the current `llmwiki` project.

The skill should help with four tasks:

1. Answer questions by searching existing 冰冰小美 wiki pages first.
2. Check whether a stock, ETF, index, industry, portfolio action, or market state fits the 冰冰小美 framework.
3. Review trades through information basis, three elements, liquidity, emotion, position sizing, personality fit, and exit conditions.
4. Maintain the wiki when the user explicitly asks to save, file, ingest, update, or reorganize 冰冰小美 knowledge.

This skill is not a price prediction tool and not investment advice. It is a disciplined evidence and framework tool.

## Required Project Context

When working in `E:\caojingwen\obsidian\llmwiki`, read these files before editing wiki content:

- `AGENTS.md`
- `SCHEMA.md`
- `page-types.md`
- `index.md`
- `log.md` when appending a maintenance record

For chat-only analysis, still inspect the relevant wiki pages before giving a confident conclusion.

## Core Entry Pages

Prefer existing pages before creating anything new. Start from these anchors when relevant:

- `wiki/people/冰冰小美.md`
- `wiki/topics/冰冰小美-知识地图.md`
- `wiki/topics/冰冰小美-情绪体系交易系列.md`
- `wiki/topics/冰冰小美-风险提示系列.md`
- `wiki/topics/冰冰小美-对左侧交易的理解.md`
- `wiki/topics/冰冰小美-宏观经济.md`
- `wiki/concepts/冰冰小美-体系三要素.md`
- `wiki/concepts/冰冰小美-风险转弱节点框架.md`
- `wiki/concepts/冰冰小美-流动性辩证分析.md`
- `wiki/concepts/冰冰小美-分仓.md`
- `wiki/concepts/冰冰小美-仓位承受力.md`
- `wiki/concepts/冰冰小美-交割单认知.md`
- `wiki/concepts/冰冰小美-亏钱认知.md`

Use `rg` to find newer or more specific pages by the user's target, industry, phrase, date, or concept.

## Decision Workflow

### 1. Classify The User Intent

Choose the narrowest matching task:

| User asks for | Work mode |
|---|---|
| "冰冰小美怎么看 X" | Wiki-grounded explanation |
| "现在能不能买 / 加仓 / 减仓" | Buy-check and risk-check |
| "复盘这张交割单 / 调仓记录" | Trade review |
| "整理 / 写入 / 沉淀 / 更新 wiki" | Wiki maintenance |
| "这句话是什么意思" | Concept or view explanation |

If the user asks for live market judgment, verify current market data before making current-date claims. If data cannot be verified, say which parts are wiki-derived and which parts are unverified.

### 2. Search The Wiki Before Judging

Search in this order:

1. Relevant Topic Pages for map and scope.
2. Concept Pages for reusable framework terms.
3. Reasoning Pages for causal chains.
4. View Pages for source-specific judgments.
5. Timeline Pages for sequence and verification windows.
6. Source pages only when exact provenance is needed.

Do not invent missing evidence. If the wiki lacks enough material, say so and give only a provisional framework.

### 3. Apply The Three Elements

Map the target to:

| Element | Question |
|---|---|
| 竞争格局 / 基本面 / 产业位置 | Is there real structural support, or only a story? |
| 流动性 / 承接 | Is money willing and able to carry this direction? |
| 情绪位置 / 交易窗口 | Is emotion near a favorable turn, already crowded, or retreating? |

Then check:

- Is risk weakening or strengthening?
- Is the current action left-side trial, right-side confirmation, passive holding, or emotional reaction?
- Is the position size compatible with uncertainty and personality?
- What condition would prove the judgment wrong?

### 4. Output A Clear Action Grade

Use one of these grades, with evidence and caveats:

- 不买
- 观察仓
- 小仓试错
- 分批买入
- 正常仓位
- 暂停加仓
- 降低仓位
- 清仓回避

Always include exit or invalidation conditions when any buying, holding, or trial position is discussed.

## Trade Review Checklist

For trade logs, screenshots, or portfolio adjustments, extract only visible facts:

- Date and market context.
- Instrument, direction, price, amount, position weight.
- Stated buy or sell reason.
- Original plan and exit rule, if available.
- Follow-up result and holding period, if available.

Review through:

1. Information basis: fact, view, rumor, price action, recommendation, macro thesis, or emotion.
2. Three elements: competition, liquidity, emotion position.
3. Next-day carry: whether money could continue carrying the target after the buy.
4. Position and personality fit: whether size preserved execution quality.
5. Profit or loss source: system profit, luck profit, information misread, liquidity misread, emotion misread, position loss of control, or out-of-system action.

End with one reusable filter rule for the next trade.

## Wiki Maintenance Rules

Only edit wiki files when the user asks to save, file, ingest, update, restructure, or maintain pages.

For new or changed formal wiki pages:

1. Decide page type first: concept, person, event, view, timeline, reasoning, query, or topic.
2. Prefer updating existing pages over creating duplicates.
3. Use Obsidian links with `[[path|display]]`.
4. Separate facts, views, inference, and uncertainty.
5. Update `index.md` when a formal page is added, renamed, migrated, or deleted.
6. Append `log.md` for maintenance actions.

Do not put full trade records or raw articles directly into `wiki/`. Preserve raw inputs under `sources/` when needed, then distill structured knowledge into `wiki/`.

## Response Shape

For chat answers, prefer:

```markdown
## 一句话结论
[clear grade or explanation]

## Wiki 证据
| 页面 | 用到的判断 |
|---|---|

## 三要素检查
| 要素 | 支持 | 风险 | 判断 |
|---|---|---|---|

## 行动含义
- 仓位：
- 退出条件：
- 后续观察：

## 不确定性
- ...
```

Keep answers concise. The value of this expert mode is disciplined judgment, not more words.
