# Ingest Prompt 模板

这些模板是把来源资料蒸馏为 wiki 页面时使用的思考框架。

## 知识抽取框架

阅读一份来源文档时，问自己：

1. **这份文档中最重要的 3-5 个想法是什么？**  
   它们可能成为新的 Concept Page，或用于更新已有 Concept Page。

2. **文档中提到的哪些人物或对象值得拥有自己的页面？**  
   人物、工具、组织、项目等，可能进入人物页、实体页，或当前知识库对应的 People / Topic / Concept 页面。

3. **这份文档教会了什么做法？**  
   流程、工作流、技巧、操作方法等，可能进入技能页、方法页，或当前知识库中的 Concept / Reasoning 页面。

4. **这份文档提出了哪些断言？**  
   每条断言都需要来源归因。如果它与已有 wiki 断言冲突，要记录这个冲突。

5. **它和 wiki 已经知道的内容如何连接？**  
   这是最重要的问题。wiki 的价值来自持续建立连接，而不是堆积孤立摘要。

## 综合框架

当新来源覆盖了已有页面已经讨论过的内容时：

- 不要重复新建，优先综合。
- 如果新来源同意已有内容，用它增加来源支持。
- 如果新来源不同意已有内容，创建 “Open Questions” 或 “Debate” 小节，记录双方立场。
- 如果新来源增加了细节或限定条件，把这些 nuance 编织进已有叙述。

## 交叉引用发现

抽取知识后，寻找以下连接模式：

- **Is-a**：`Transformers are a type of neural network` → 从 transformer 页面链接到 neural-network 页面。
- **Uses**：`RLHF uses reward models` → 从 RLHF 页面链接到 reward-models 页面。
- **Contrasts-with**：`CNNs vs. Transformers for vision` → 两边互相链接。
- **Part-of**：`Attention is a component of transformers` → 从 attention 页面链接到 transformers 页面。
- **Created-by**：`Transformers were introduced by Vaswani et al.` → 链接到对应人物或实体页面。
- **Applied-in**：`Transformers are used in GPT` → 从 transformers 页面链接到 GPT 页面。
