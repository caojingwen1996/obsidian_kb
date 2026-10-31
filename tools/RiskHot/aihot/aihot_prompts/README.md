# AIHOT 提示词分组导航

依据 [[tools/RiskHot/aihot/aihot_prompts/AIHOT_提示词体系与源码实现分析_V1.0#2. 当前提示词资产清单：29 个 Markdown 文件|分析文档第 2 章]]，将 29 份提示词按原章节分为以下六组。文件名和正文保持原样，分析文档保留在本目录。

本目录为分类阅读副本。提示词中的 `{{> prompt-name}}` 仍为上游模板引用语法；直接用于程序装配时，应沿用上游平铺目录或另行配置查找规则。

## 2.1 基础约束与共享规则（6 个）

- [[tools/RiskHot/aihot/aihot_prompts/2.1-基础约束与共享规则/safety|safety.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.1-基础约束与共享规则/rules-anti-hallucination|rules-anti-hallucination.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.1-基础约束与共享规则/rules-domain|rules-domain.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.1-基础约束与共享规则/rules-self-contained-title|rules-self-contained-title.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.1-基础约束与共享规则/rules-answer-first-summary|rules-answer-first-summary.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.1-基础约束与共享规则/identity-context|identity-context.md]]

## 2.2 资料预筛与价值评分（2 个）

- [[tools/RiskHot/aihot/aihot_prompts/2.2-资料预筛与价值评分/prefilter|prefilter.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.2-资料预筛与价值评分/selection-score|selection-score.md]]

## 2.3 事实抽取（1 个）

- [[tools/RiskHot/aihot/aihot_prompts/2.3-事实抽取/structure|structure.md]]

## 2.4 内容写作（11 个）
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/understand|understand.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/content-understanding|content-understanding.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/summarize-article|summarize-article.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/summarize-article-empty|summarize-article-empty.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/summarize-long-post|summarize-long-post.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/summarize-long-post-quoted|summarize-long-post-quoted.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/summarize-short-post|summarize-short-post.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/summarize-short-post-quoted|summarize-short-post-quoted.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/mend-wording|mend-wording.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/translate-body|translate-body.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.4-内容写作/translate-post|translate-post.md]]

## 2.5 事件关系与归组（5 个）

- [[tools/RiskHot/aihot/aihot_prompts/2.5-事件关系与归组/group-batch|group-batch.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.5-事件关系与归组/group-definitions|group-definitions.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.5-事件关系与归组/group-method|group-method.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.5-事件关系与归组/group-pair|group-pair.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.5-事件关系与归组/group-signal|group-signal.md]]

## 2.6 事件综述与报告（4 个）

- [[tools/RiskHot/aihot/aihot_prompts/2.6-事件综述与报告/story-digest|story-digest.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.6-事件综述与报告/report-period|report-period.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.6-事件综述与报告/report-period-sections|report-period-sections.md]]
- [[tools/RiskHot/aihot/aihot_prompts/2.6-事件综述与报告/report-period-no-sections|report-period-no-sections.md]]
