---
name: bbxm-buy-check
description: Use this skill when the user asks whether a stock, ETF, index, sector, industry chain, commodity, or other investable target is suitable to buy, add to, hold, reduce, or avoid now. Trigger on Chinese or English requests about 冰冰小美, 三要素买入判断, 买点, 买入时机, 加仓, 减仓, 仓位建议, 标的分析, ETF/指数/行业是否能买, or pre-trade checks using fundamentals, liquidity/sentiment, trading window, and risk-node logic.
---

# 冰冰小美三要素买入判断

Use this skill to run a buy-before-action checklist. The goal is not to summarize a target, but to decide whether the current setup is suitable for buying under the 冰冰小美 three-factor framework:

1. 基本面 / 产业链
2. 流动性 / 情绪
3. 交易窗口 / 风险节点

Always end with one clear action label: `可以买入`, `小仓试错`, `继续观察`, `不适合买入`, or `应该回避 / 减仓`.

## Guardrails

- Treat the output as a decision aid, not personalized financial advice.
- For current market facts, prices, policy dates, earnings dates, flows, and news, verify with current sources when the user has not supplied reliable data. State the date of the evidence used.
- Separate `事实`, `观点`, and `推测`. If evidence is missing, mark it as `待验证`.
- If the target, timeframe, or action is unclear, ask only for the missing blocker. If the target is clear, proceed with explicit assumptions.
- Do not upgrade a conclusion because the target has already risen. Price strength without a clear thesis is a warning, not a buy reason.
- If the user is already holding the target, judge both `new buy/add` and `existing position risk`.

## Evidence Pass

Before judging, identify what evidence you have:

- Target: stock / ETF / index / sector / industry / commodity / other.
- Time horizon: short-term trade, swing, medium-term, long-term allocation, or unknown.
- User state: no position, existing position, trapped position, profit position, or unknown.
- Evidence sources: user-provided material, wiki pages, public market data, company filings, policy/event calendars, analyst or media claims.
- Evidence quality: verified, partially verified, opinion-heavy, stale, or missing.

If evidence is thin, continue the checklist anyway, but the default conclusion should be `继续观察` or `不适合买入`.

## Step 1: Identify the Buy Logic

Classify the current buy logic into one or more of these labels:

- `基本面`
- `流动性`
- `情绪`
- `交易窗口`
- `事件驱动`
- `估值修复`
- `价值投机`

Then write the thesis in one sentence. If the thesis cannot be written clearly, trigger the veto item `买入逻辑写不清楚` and do not recommend buying.

## Step 2: Three-Factor Check

### 基本面 / 产业链

Judge whether the target is truly supported by fundamentals or only by price action.

Check:

1. 当前买入逻辑是什么？
2. 是产业趋势、政策变化、技术突破、供需改善，还是单纯价格上涨？
3. 企业或行业是否真正受益？
4. 业绩、订单、库存、资本开支、政策扶持是否支持？
5. 成长是否超过价值？
6. 当前是长期价值，还是阶段性价值投机？

Default rule: if the fundamental thesis cannot be explained, mark this factor as negative and do not buy.

### 流动性 / 情绪

Judge whether the market environment supports taking risk.

Check:

1. 当前市场是进攻还是防御？
2. 流动性是宽松、收紧，还是边际转弱？
3. 情绪是冰点、修复、乐观、过热，还是踩踏？
4. 是否存在杠杆、拥挤、挤兑、被迫平仓风险？
5. 当前上涨是资金推动，还是基本面推动？
6. 是否已经出现风险转弱信号？

Default rule: if liquidity and sentiment are clearly weakening, do not add. If already holding, prefer reducing risk.

### 交易窗口 / 风险节点

Judge whether now is a friendly entry window.

Check:

1. 当前是否处于重要事件窗口？
2. 是否有财报、政策、利率、外部冲击等风险节点？
3. 当前是冰点、冰点的冰点，还是高位情绪阶段？
4. 宏观、中观、微观是否出现转弱？
5. 风险释放是否充分？
6. 买入后如果判断错误，退出条件是什么？

Default rule: if the window is unfriendly, wait instead of chasing.

## Step 3: Veto Check

Check every veto item explicitly. Any triggered veto should dominate the conclusion unless there is a strong reason to downgrade only to `小仓试错`.

Veto items:

1. 买入逻辑写不清楚。
2. 只是因为上涨而想买。
3. 基本面没有验证。
4. 风险提示已经出现，但没有仓位应对。
5. 标的太多，无法跟踪。
6. 被套后补仓，而不是基于新逻辑买入。
7. 成长已经明显超过价值。
8. 宏观、中观、微观任一层明显转弱。
9. 没有退出条件。
10. 仓位已经超过自己能承受的波动。

## Decision Rules

Use these rules to force a clear conclusion:

- `可以买入`: fundamentals/industry chain are clear, liquidity/sentiment are not weakening, the trading window is friendly or risk has been released, no veto item is triggered, and exit conditions are defined.
- `小仓试错`: thesis is plausible but still partially unverified, at least two factors are neutral-to-positive, no hard veto is triggered, and the user can define a small position plus exit condition.
- `继续观察`: evidence is incomplete, the thesis is not invalid but one factor is unclear, the window is not friendly, or a near-term risk node should be watched first.
- `不适合买入`: thesis is unclear, the move is mainly price-chasing, fundamentals are unverified, liquidity/sentiment are weakening, or the risk/reward is unattractive.
- `应该回避 / 减仓`: a holder faces clear deterioration, macro/mid/micro risk turns down, leverage/crowding/forced-selling risk appears, a major risk node is ahead without a plan, or position size exceeds volatility tolerance.

Map the action to a position suggestion:

| Conclusion | Position suggestion |
|---|---|
| 可以买入 | 正常仓位 |
| 小仓试错 | 小仓试错 |
| 继续观察 | 观察仓 or 不买 |
| 不适合买入 | 不买 |
| 应该回避 / 减仓 | 降低仓位 or 清仓回避 |

Use `观察仓` only when the user has a clear tracking plan and the downside from being early is acceptable.

## Output Format

Always use this structure:

```markdown
### 1. 一句话结论

[明确回答：可以买入 / 小仓试错 / 继续观察 / 不适合买入 / 应该回避或减仓。]

### 2. 当前买入逻辑

- 逻辑类型：[基本面 / 流动性 / 情绪 / 交易窗口 / 事件驱动 / 估值修复 / 价值投机]
- 一句话买入依据：
- 证据质量：[已验证 / 部分验证 / 待验证 / 主要是观点]

### 3. 三要素检查

#### 基本面 / 产业链

支持点：
- ...

风险点：
- ...

结论：[有利 / 中性 / 不利 / 证据不足]

#### 流动性 / 情绪

支持点：
- ...

风险点：
- ...

结论：[有利 / 中性 / 不利 / 证据不足]

#### 交易窗口 / 风险节点

支持点：
- ...

风险点：
- ...

退出条件：
- ...

结论：[有利 / 中性 / 不利 / 证据不足]

### 4. 否决项检查

- 已触发：
- 未触发但需跟踪：

### 5. 仓位建议

[不买 / 观察仓 / 小仓试错 / 正常仓位 / 降低仓位 / 清仓回避]

### 6. 需要继续跟踪的指标

- 基本面：
- 流动性 / 情绪：
- 交易窗口 / 风险节点：
- 退出条件：

### 7. 最终结论

[一句话说明当前是否符合买入时机。]
```

## Style

- Be decisive, but show uncertainty where the evidence is weak.
- Prefer short, judgment-heavy bullets over long background narrative.
- Do not hide behind “看情况”; translate uncertainty into `继续观察`, `小仓试错`, or `不适合买入`.
- When a conclusion depends on a future event, name the exact event and date if known.
