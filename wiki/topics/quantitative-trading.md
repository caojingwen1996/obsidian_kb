---
title: "量化交易"
aliases: []
created: 2026-04-24
updated: 2026-04-24
type: "topic"
status: active
tags:
  - "strategy/timing"
  - "strategy/review"
  - "function/framework"
sources:
  - "[[raw/articles/2022-07-01-jiyi-chengzai-mid-2247506879-idx-1]]"
  - "[[raw/articles/2026-04-05-jiyi-chengzai-mid-2247532824-idx-1]]"
related:
  - "[[people/bi-shu-xi-feng]]"
  - "[[topics/probabilistic-decision-and-risk-control]]"
  - "[[views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01]]"
  - "[[views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05]]"
summary: "围绕量化思维、分布视角与可计算化表达展开的长期主题，关注如何把市场中的变化、结构、情绪与反馈转成可观察、可比较、可执行的变量，而不是把量化误解成高频系统。"
topic_scope:
  - "分布而非单点"
  - "样本总集与时间曲线"
  - "变化的可计算化表达"
  - "价格与反馈优先"
  - "量化方法的边界"
key_questions:
  - "这里所说的量化，和高频、自动化系统到底有什么区别？"
  - "为什么成熟系统更强调分布、样本总集与时间曲线，而不是单次结果？"
  - "怎样把市场中的结构、变化与情绪翻译成可观察、可比较的变量？"
  - "为什么在交易里要优先读价格与反馈，而不是先找叙事理由？"
related_concepts: []
---

# 量化交易

## 主题说明

本页中的“量化交易”主要指量化方法论，而不是高频、自动化或纯速度竞争。

它关注的不是“把交易做得更快”，而是“把原本凭感觉理解的变化压成可观察、可比较、可执行的变量”。在这个知识库里，它更像是一种观察市场、压缩变化和组织决策的方法。

## 当前框架

按当前材料，这条主线至少有四个基础判断：

- 量化首先是一种观察与压缩变化的方法，而不是交易频率标签
- 成熟系统更关心分布、样本总集与时间曲线，而不是单个样本与单次输赢
- 量化要把结构、变化与情绪翻译成可计算变量，而不是停留在模糊叙事
- 在交易里，量化方法更强调价格与反馈优先，再决定是否接受那套解释

## 关键观察轴

### 1. 分布而非单点

[[views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01]] 把量化思维压回一个最底层的习惯：不要被单条样本、单次交易和单一结果牵着走，而要回到样本总集与概率分布里看问题。

这意味着量化不是“记住几个名词”，而是训练自己不用单点直觉替代整体结构。

### 2. 样本总集与时间曲线

同一篇材料还强调，系统判断不能只抓某一个时间点，而要看时间曲线本身。过去、现在和未来是连续轨迹，不是几张孤立截图。

因此，量化方法天然偏向看轨迹、看曲线、看重复选择之后的总体结构，而不是只看某一次局部最亮眼的结果。

### 3. 把变化翻译成数字

[[views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05]] 进一步说明，量化的核心不是狭义金融术语，而是把原本说不清、算不清的变化压缩成可观察、可比较、可计算的对象。

这条线在交易里成立，在其他复杂场景里也成立。关键不是先有一套宏大叙事，而是先把变化中的结构抽成变量。

### 4. 价格与反馈优先

当这种方法放回交易里，它表现为优先读取价格与反馈，而不是先找一个足以说服自己的理由。

也就是说，量化并不取消解释，但它要求解释服从观察与反馈更新，而不是反过来让价格替叙事背书。

## 当前边界

本页目前明确不处理以下内容：

- 高频交易是否成立
- 自动化系统是否具备算法优势
- 手续费、摩擦成本与制度变化对系统的破坏
- 黑天鹅、系统失效与定期出金的风险管理

这些问题继续留在 [[topics/probabilistic-decision-and-risk-control]]，因为它们更接近执行系统与风控结构，而不是量化方法论本身。

## 相关观点

- [[views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01]]
- [[views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05]]

## 当前用途

本页先作为知识库里“量化方法论”的主入口使用。

后续新增相关 `view` 时，优先回挂到这里；若材料继续增厚，再决定是否从中拆出更细的 `concept` 页面。
