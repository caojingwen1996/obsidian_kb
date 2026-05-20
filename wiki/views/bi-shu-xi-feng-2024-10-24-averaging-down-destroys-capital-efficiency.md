---
title: "碧树西风：越跌越加仓会吞噬资金使用率"
aliases: []
created: 2026-04-18
updated: 2026-04-18
type: "view"
status: active
tags:
  - "strategy/risk-control"
  - "strategy/position-sizing"
  - "strategy/drawdown"
sources:
  - "[[raw/articles/2024-10-24-jiyi-chengzai-mid-2247516066-idx-2]]"
related:
  - "[[people/bi-shu-xi-feng]]"
  - "[[topics/probabilistic-decision-and-risk-control]]"
  - "[[concepts/expected-value-stop-loss-and-backstop]]"
summary: "作者把“越跌越加仓救仓位”拆成资金使用率与最大回撤问题：若一套策略需要指数级备用金去拯救极小初始仓位，那么它的真实回报、真实风险和系统意义都很差。"
person: "[[people/bi-shu-xi-feng]]"
topic_refs:
  - "[[topics/probabilistic-decision-and-risk-control]]"
stance: "越跌越加仓并不自动等于好策略；若要靠巨额闲置备用金去解救很小的初始仓位，这套系统往往同时败坏资金使用率、盈亏比与最大回撤约束。"
time_scope: "long-term"
confidence: "high"
---

# 碧树西风：越跌越加仓会吞噬资金使用率

## 核心判断

在 [[raw/articles/2024-10-24-jiyi-chengzai-mid-2247516066-idx-2]] 中，[[people/bi-shu-xi-feng]] 的核心判断是：很多人以为“跌了就不断加仓，反弹一次就能解套”是一种稳赚思路，但只要把备用金、最大回撤和真实资金占用一起算进去，这类方法通常既不高效，也不安全。

## 观点展开

### 1. 救援型加仓会让备用金需求指数级膨胀

文章用 `1 -> 1 -> 2 -> 4` 的加仓结构说明，只要行情继续朝错误方向走，后续需要投入的资金就会呈倍数扩张。表面上看是在“救前面的仓位”，实质上是在用越来越大的本金去挽救一个最初很小的头寸。

### 2. 名义高收益不能脱离真实资金占用讨论

作者特别强调，若一套策略需要长期预留巨额备用金，那些没有被动用的现金同样属于本金。此时就算最初的小仓位账面回报惊人，放回全部资金口径后，真实回报也可能极低。

### 3. 成熟系统要看最大回撤，而不是表演型收益

文中把交易大赛式的夸张收益称作“表演艺术”。真正值得复用的系统，不是看它某次赚了多少倍，而是看它以什么最大回撤、什么盈亏比、什么整体仓位结构拿到这些收益。

## 与现有主题的关系

- [[topics/probabilistic-decision-and-risk-control]] 已经强调收益目标不能脱离回撤约束单独讨论
- 本页进一步把这条规则落到资金使用率层面：若一套方法要靠巨额备用金托底，它即便偶尔赚钱，也未必值得写进长期系统

## 相关页面

- 人物页：[[people/bi-shu-xi-feng]]
- 主题页：[[topics/probabilistic-decision-and-risk-control]]
- 概念页：[[concepts/expected-value-stop-loss-and-backstop]]
