# 聚类参考（Clustering）

## 1. 目的

定义如何将**当前 feed 运行**中的多个相关 Signal 组织成连贯的 Cluster。

**Cluster** 是对当前 feed 中 Signal 的结构化聚合，能够将这些信号归纳为一个可解释的事件过程、共同驱动因素、共同问题或传导结构。

聚类是无状态的，不检索或更新此前运行中的 Cluster。

正式对象结构定义见：

`schemas/cluster.schema.json`

---

## 2. 核心模型

```text
当前 feed 中的 Signal
        ↓
关系识别
        ↓
候选分组
        ↓
连贯性 / 解释性压缩检查
        ↓
   ┌────┴────┐
   ↓         ↓
Cluster    孤立信号
```

对于通过检查的 Cluster：

```text
Cluster
  ├── 结构视图
  └── 时间轴视图（有证据支持时）
```

核心问题：

> 当前 feed 中哪些 Signal 可以合理地解释为一个连贯的信息结构？

---

## 3. 无状态边界

聚类只能比较本次运行产生的 Signal。

不得要求使用：

```text
历史 Cluster
历史 Signal
跨轮次 Cluster 匹配
跨轮次 Cluster 更新 / 合并
跨轮次 Cluster 成熟度跟踪
跨时间的持续性跟踪
```

Cluster 的所有强度与置信度判断，都限定在当前 feed 的证据范围内。

---

## 4. Cluster 的职责边界

Cluster 应紧贴可观察的信息结构。

它应组织：

```text
相关 Signal
支撑它们的 Event 引用
关系
当前 feed 的时间范围
有时间戳支持时形成的时间轴
```

它本身不应执行：

```text
事件前预期分析
实际结果与预期对比分析
预期差分析
事件后的再定价分析
历史趋势分析
```

其中，事件层面的分析属于 `Event.event_analysis`。

---

## 5. 主要成簇条件

一组 Signal 具有连贯的解释结构时，应形成 Cluster。

评估以下主要问题。

### 5.1 同一问题

询问：

> 这些 Signal 是否描述了同一个底层问题或事件过程的不同部分？

示例：

```text
Meta债务融资 ↑
甲骨文债务融资 ↑
微软AI资本开支 ↑
Meta AI资本开支 ↑
```

可能的共同问题：

```text
AI基础设施扩张是如何融资的？
```

### 5.2 共同驱动因素

询问：

> 是否有证据表明这些 Signal 具有共同驱动因素？

示例：

```text
AI基础设施资本开支 ↑
    ↓
外部融资需求 ↑
```

共同驱动因素必须由当前 feed 的证据或可追溯的 Event 上下文支持。

### 5.3 共同传导结构

询问：

> 这些 Signal 能否通过一条有证据支持的传导结构连接起来？

示例：

```text
石油供给收紧
    ↓
油价 ↑
    ↓
通胀预期 ↑
```

### 5.4 解释性压缩

询问：

> 将这些 Signal 归为一组，是否比逐条列出更清晰、更有解释价值？

有效的 Cluster 应在保留重要差异的同时降低复杂度。

---

## 6. 辅助关系检查

以下检查可以辅助分组判断：

```text
same_variable?
same_direction?
same_subject?
same_time_window?
common_scope?
evidence_diversity?
```

这些是辅助线索，不是强制规则。

仅仅时间接近，不足以成簇。

仅仅方向相同，也不足以成簇。

---

## 7. 形成逻辑

```text
INPUT current_feed_signals

candidate_groups = DetectRelationships(current_feed_signals)

FOR group IN candidate_groups:

    IF group 包含多个有意义的 Signal
       AND HasCoherentStructure(group)
       AND ImprovesExplanatoryCompression(group):

        创建 Cluster

    ELSE:
        将成员保留为孤立信号
```

单个 Signal 通常应保持孤立。

不要仅为容纳一个 Signal 而创建占位 Cluster 或弱 Cluster。

只有当某个 Signal 确实参与多个不同结构，而且重复归属有助于解释时，才可以将它放入多个 Cluster。

---

## 8. 支撑事件

通过 Signal 的追溯关系使用 Event，它们可以提供：

- 事实起点；
- 驱动因素证据；
- 转折点上下文；
- 解释 Signal 所需的来源上下文。

每个 Cluster 都应支持以下追溯链：

```text
Cluster
→ Signal
→ Event
→ Source
```

Event 不会独立触发历史匹配。

---

## 9. Cluster 强度

建议使用以下本次运行证据强度：

```text
weak
moderate
strong
```

可以考虑：

- 当前 feed 中独立 Signal 的数量；
- 支撑 Event 的数量；
- 来源多样性；
- 证据类型多样性；
- 方向一致性；
- 当前 feed 中可见的跨市场确认；
- 传导连贯性；
- 解释性压缩的程度。

除非经过明确校准，否则避免使用固定数值阈值。

强度描述的是本次运行可获得的支持程度。

---

## 10. 独立性

对同一事实的重复报道，可以增强该 Event 的置信度，但仍只计为一个底层事实。

示例：

```text
路透社报道OPEC减产
彭博社报道同一次OPEC减产
CNBC转述路透社的报道
```

这可能提高 Event 的置信度。

但不应据此创建三个独立 Signal。

---

## 11. 相互冲突的信号

相关 Signal 可以指向不同方向。

示例：

```text
oil_price ↑
freight_cost ↓
inflation_expectation 持平
```

如果这些 Signal 仍围绕同一个连贯问题，Cluster 可以明确保留冲突。

可能的表达：

```text
common_question = "成本压力是否正在扩散？"
directional_relationship = mixed
strength = weak
```

如果机制存在实质差异，应拆成不同结构，或继续保留为孤立信号。

---

## 12. Cluster 边界质量

优先形成范围较窄、易于解释的 Cluster。

较弱的命名：

```text
全球宏观环境
```

更好的命名：

```text
energy_price_pressure
long_term_rate_repricing
ai_capex_financing
credit_tightening
```

Cluster 名称应反映当前 feed 中可见的具体解释结构。

---

## 13. 结构视图

结构视图解释这些 Signal 为什么属于同一组。

示例：

```text
OPEC减产
   ↓
石油供给收紧
   ↓
油价 ↑
   ↓
通胀预期 ↑
```

结构视图回答：

> 当前 feed 中这些 Signal 为什么相关？

结构中必须区分已经观察到的联系和推断的联系。

---

## 14. 时间轴视图

当当前 feed 中存在有效时间戳时，Cluster 应提供按时间排序的时间轴。

生成过程：

```text
Cluster 中的 Signal
    ↓
解析 Event 引用
    ↓
提取时间戳
    ↓
标准化时间
    ↓
按时间先后排序
    ↓
时间轴
```

当前事件窗口有证据支持时，建议使用以下阶段标签：

```text
background
pre_event
key_event
immediate_reaction
repricing
confirmation
reversal
follow_up
```

这些标签描述当前证据集合内部的先后顺序。

它们不意味着跨轮次的 Cluster 生命周期。

时间轴视图回答：

> 本次 feed 中的支撑性观察，按时间如何排列？

---

## 15. 跨市场确认

当前 feed 中可见的跨市场观察，可以增强 Cluster。

示例：

```text
油价 ↓
盈亏平衡通胀率 ↓
10年期收益率 ↓
成长股 ↑
```

跨市场确认可能提高：

```text
strength
confidence
```

它不会自动形成 Theme。

---

## 16. 孤立信号

以下情况应将 Signal 保留为孤立信号：

- 当前 feed 中没有其他与之具有实质关联的 Signal；
- 关系过于松散；
- 共同驱动因素不清楚；
- 分组严重依赖推测；
- 主要联系仅是时间接近；
- 分组没有改善解释性压缩。

孤立信号仍是有效输出，也仍可直接为 Core Findings 提供信息。

---

## 17. 质量检查

接受一个 Cluster 前，检查：

- 是否包含至少两个来自当前 feed 的有意义 Signal？
- 什么共同问题把它们联系起来？
- 是否存在共同驱动因素或传导结构？
- 关系是观察所得还是推断所得？
- 分组是否改善了解释性压缩？
- 来源是否足够独立？
- 是否保留了冲突？
- 是否应拆分该组？
- Cluster 范围是否足够聚焦，仍能清楚解释？
- 每项 Cluster 主张能否追溯到本次运行的 Signal 和 Event？
- Cluster 是否避免依赖历史存储？

---

## 18. 输出原则

好的 Cluster 回答：

> 当前 feed 中哪些变化应归在一起，为什么？

概念流程：

```text
Signal
    ↓
关系
    ↓
共同问题 / 驱动因素 / 传导
    ↓
解释性压缩
    ↓
Cluster
```
