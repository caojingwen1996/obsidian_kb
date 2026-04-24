# 量化交易 Topic 拆分设计

日期：2026-04-24

## 背景

当前 [topics/probabilistic-decision-and-risk-control.md](E:/caojingwen/obsidian/obsidian_kb/topics/probabilistic-decision-and-risk-control.md) 同时承载了两条不同层级的内容：

1. 投资系统、纪律执行、仓位、止损、风控、复盘
2. 量化思维、分布视角、可计算化表达、价格与反馈优先

第二条线已经形成相对独立的长期问题域，继续留在原 topic 中会让页面边界变宽，也会削弱“概率化决策与风险控制”作为执行与风控主页面的清晰度。

## 目标

本次调整的目标是：

1. 新建一个独立的 `topic` 页面 `量化交易`
2. 将“量化思维与可计算化方法”从原 topic 中抽离
3. 保持原 topic 聚焦于纪律、仓位、止损、风控、复盘和执行
4. 保持两个 topic 之间可互链，但不互相替代

## 非目标

本次不处理以下内容：

1. 不把“高频/自动化/算法费用/制度失效风险”并入新 topic
2. 不重写相关 `view` 的核心判断，只调整其 topic 挂载和相关链接
3. 不扩展新的 `concept` 页面，除非拆分过程中发现明显缺口

## 核心设计

### 新 topic 的定位

新页面文件名为：

- `topics/quantitative-trading.md`

页面标题为：

- `量化交易`

该 topic 在本知识库中的含义，不是狭义高频交易，也不是自动化系统工程，而是：

- 如何把市场中的变化、结构、情绪与反馈翻译成可观察、可比较、可计算的对象
- 如何用分布、样本总集和时间曲线代替单点直觉
- 如何在交易中优先读取价格与反馈，而不是先寻找叙事理由

### 与原 topic 的边界

保留在 [topics/probabilistic-decision-and-risk-control.md](E:/caojingwen/obsidian/obsidian_kb/topics/probabilistic-decision-and-risk-control.md) 的内容：

- 仓位规则
- 止损与退出
- 风控结构
- 执行纪律
- 复盘机制
- 系统完整性

迁入 `量化交易` 的内容：

- 分布而非单点
- 样本总集与时间曲线
- 把变化翻译成数字
- 价格与反馈优先
- 可计算化方法的边界与适用方式

明确不迁入 `量化交易` 的内容：

- 高频是否成立
- 自动化系统是否有算法优势
- 手续费、摩擦成本、制度变化对算法的破坏
- 定期出金、系统失效、黑天鹅打断微观结构

这些内容继续留在原 topic，因为它们更接近执行系统与风险控制，而不是量化方法论本身。

## 页面级改动

### 1. 新建 topic 页面

创建 [topics/quantitative-trading.md](E:/caojingwen/obsidian/obsidian_kb/topics/quantitative-trading.md)，遵循现有 `topic` frontmatter 结构，至少包括：

- `title`
- `created`
- `updated`
- `type: "topic"`
- `tags`
- `sources`
- `related`
- `summary`
- `topic_scope`
- `key_questions`
- `related_concepts`

正文结构以“主题说明 / 当前框架 / 关键观察轴 / 当前边界 / 相关观点 / 当前用途”为主，沿用现有 topic 页面风格。

### 2. 抽离原 topic 中的量化方法论部分

对 [topics/probabilistic-decision-and-risk-control.md](E:/caojingwen/obsidian/obsidian_kb/topics/probabilistic-decision-and-risk-control.md) 做结构收窄：

- 删除或压缩量化方法论段落
- 在适当位置补一段说明，明确 `量化交易` 已独立出去
- 保留与执行和风控直接相关的少量链接

目标是让原 topic 重新聚焦“如何把系统写成能活下来的执行与风控结构”。

### 3. 调整相关 view 的挂载

以下页面改为挂到新 topic：

- [views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md](E:/caojingwen/obsidian/obsidian_kb/views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md)
- [views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md](E:/caojingwen/obsidian/obsidian_kb/views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md)

以下页面继续留在原 topic：

- [views/bi-shu-xi-feng-speed-cannot-replace-a-profitable-algorithm-2025-02-26.md](E:/caojingwen/obsidian/obsidian_kb/views/bi-shu-xi-feng-speed-cannot-replace-a-profitable-algorithm-2025-02-26.md)

### 4. 交叉链接

新旧两个 topic 都应保留对彼此的链接，但链接语义应清楚：

- `量化交易` 链到“概率化决策与风险控制”，表示方法最终要进入执行与风控
- `概率化决策与风险控制` 链到“量化交易”，表示部分方法论已独立沉淀

## 内容映射

建议按如下方式迁移：

### 迁入 `量化交易`

- “量化思维先看分布与曲线，不看单点”
- “量化不是高频，关键是把变化翻译成数字”
- 原 topic 中关于样本总集、分布、时间曲线、可计算变量、价格与反馈优先的解释

### 留在原 topic

- “速度不能替代能赚钱的算法”
- 原 topic 中关于系统完整性、仓位规则、止损、退出、执行纪律、环境约束、风控审计、复盘机制的章节

## 验收标准

完成后应满足：

1. `量化交易` 能独立回答“这里所说的量化到底是什么”
2. 原 topic 不再承担量化方法论主页面职责
3. 相关 `view` 至少各自链接到正确的主 topic
4. 两个 topic 都不是孤页，且互相可发现
5. 页面命名、frontmatter、标签与现有仓库风格一致

## 风险与约束

主要风险：

1. “量化交易”这个标题天然偏宽，正文必须明确其在本库里的含义
2. 若迁移过多，容易把执行系统内容误迁出去
3. 若迁移过少，新旧两个 topic 会继续重叠

本次以“方法论拆出、执行保留”为判断准绳；遇到边界模糊处，优先保留在原 topic，并在新 topic 中以链接引用。
