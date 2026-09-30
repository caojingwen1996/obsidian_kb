# 信号提取参考（Signal Extraction）

## 1. 目的

定义如何从当前 feed 运行中的 Event 提取标准化 Signal。

**Signal** 表示变量、条件、预期、行为或市场定价发生了有意义的变化。

信号提取是无状态的，不要求检索历史 Signal 或开展跨轮次比较。

正式对象结构定义见：

`schemas/signal.schema.json`

---

## 2. 核心模型

```text
Event
    ↓
识别有意义的变化
    ↓
变量
    ↓
方向
    ↓
幅度
    ↓
范围
    ↓
证据类型
    ↓
观测时间
    ↓
Signal
```

核心问题：

> 哪个变量发生了变化，方向是什么，可观察的强度与范围如何？

---

## 3. 无状态边界

信号提取可以使用：

```text
当前 Event
当前 Event Analysis
当前 feed 中包含的其他证据
解释当前 Event 所必需、且有来源支持的上下文
```

不要求使用：

```text
此前的 Signal
历史 Signal 存储
跨轮次延续 / 反转分类
跨轮次再次确认
跨轮次持续性估计
```

如果来源本身明确给出了历史比较，应将该比较保留为证据或上下文，不从工作流记忆中重建。

---

## 4. 信号类型

Signal 分为两种主要类型。

### 4.1 事实信号（Fact Signal）

直接从可观察的 Event 中提取。

```text
Event
    ↓
观察到的事实变化
    ↓
Fact Signal
```

示例：

```text
布伦特原油从105下跌至100
→ crude_oil_price ↓
```

### 4.2 再定价信号（Repricing Signal）

从关键 Event 的 `event_analysis` 部分提取。

```text
事件前预期
    ↓
关键事件
    ↓
事件后的再定价
    ↓
Repricing Signal
```

示例：

```text
CPI公布后，联邦基金期货反映的预期降息次数减少
→ rate_cut_expectation ↓
```

---

## 5. 变量

变量回答：

> 究竟什么发生了变化？

优先使用可复用的变量。

示例：

```text
crude_oil_price
inflation_expectation
long_term_yield
rate_cut_expectation
ai_capex_demand
credit_spread
liquidity
earnings_expectation
```

避免使用以下宽泛类别：

```text
宏观新闻
科技新闻
市场新闻
```

---

## 6. 方向

建议词汇：

```text
up
down
stable
improving
deteriorating
tightening
easing
accelerating
decelerating
widening
narrowing
mixed
unknown
```

选择与变量相匹配的表达。

示例：

```text
credit_spread → widening
liquidity → tightening
demand → improving
yield → up
```

---

## 7. 幅度

建议取值：

```text
small
moderate
large
extreme
unknown
```

可以依据本次运行中的以下证据判断幅度：

- 绝对变化量；
- 百分比变化；
- 来源给出的历史偏离程度；
- 事件分析中的预期偏离；
- 来源描述的重要程度；
- 可观察的市场反应。

不要编造任意阈值。

不要仅为划分幅度而查询历史存储。

---

## 8. 范围

建议取值：

```text
company
industry
sector
market
macro
cross_market
```

范围描述该 Signal 在哪里可以被观察到。

---

## 9. 证据类型

建议证据类型：

```text
fundamental
macro_data
policy
market_price
company_action
expectation
flow
positioning
sentiment
```

证据类型帮助聚类阶段判断：当前 feed 中的多个 Signal 是否获得不同证据的支持。

---

## 10. 信号时间

每个 Signal 都应保留观测时间。

对于事实信号：

```text
通常继承 Event 的时间
```

对于再定价信号：

```text
使用再定价变得可观察时的时间
```

时间用于解释当前 feed 内部的关系，不意味着跨轮次跟踪。

---

## 11. 一个事件产生多个信号

当多个变量直接发生变化时，一个 Event 可以产生多个 Signal。

示例：

```text
OPEC宣布额外减产。
```

可能产生的信号：

```text
oil_supply → tightening
oil_price_pressure → up
```

没有证据时，不要自动延伸整条因果链。

例如，不要自动生成：

```text
inflation → up
10年期收益率 → up
科技股 → down
```

除非这些变化已被直接观察到，或得到事件分析支持。

---

## 12. 一个事件产生多个再定价信号

一个包含事件分析的关键 Event，可以产生多个再定价信号。

示例：

```text
CPI > 市场一致预期
↓
降息预期 ↓
2年期收益率 ↑
美元 ↑
```

可能产生的信号：

```text
rate_cut_expectation ↓
short_term_yield ↑
usd_strength ↑
```

每个 Signal 都应能够单独追溯到 Event。

---

## 13. 不应生成信号的情况

以下情况不生成 Signal：

- 没有有意义的变量变化；
- 信息只是静态背景；
- 无法确定方向；
- 关系主要依赖推测；
- 观察到的价格变化无法合理关联到 Event；
- 所谓变化只是当前 feed 内对同一事实的重复报道。

---

## 14. 为当前 feed 内的关系识别做准备

信号提取不执行历史比较。

为了支持下游聚类，每个 Signal 应提供足够信息，使其能够识别当前 feed 内部的关系：

```text
variable
direction
subject
可取得时保留驱动因素证据
time
scope
evidence_type
event_ref
```

这些字段使聚类阶段能够检查：

```text
same_problem?
common_driver?
shared_transmission_structure?
same_variable?
same_direction?
same_subject?
same_time_window?
```

---

## 15. 与聚类的关系

```text
当前 feed 中的 Event
    ↓
信号提取
    ↓
当前 feed 中的 Signal
    ↓
关系识别
    ↓
Cluster 或孤立信号
```

聚类只评估本次运行产生的 Signal 之间的关系。

---

## 16. 质量检查

接受一个 Signal 前，检查：

- 哪个变量发生了变化？
- 方向是否有证据支持？
- 幅度是否基于本次运行中可观察的信息？
- 范围是否合适？
- 证据类型是否合适？
- Signal 是否能追溯到 Event？
- 是否正确区分了事实信号与再定价信号？
- 是否排除了缺乏支持的下游因果推断？
- 时间表达是否准确？
- Signal 是否避免依赖历史记忆？

---

## 17. 输出原则

信号提取将：

```text
发生了什么？
```

转换为：

```text
什么发生了变化？
```

对于关键事件分析，还可以回答：

```text
什么被重新定价？
```

Signal 应保持标准化、时间明确、可追溯，并可用于当前 feed 内的聚类。
