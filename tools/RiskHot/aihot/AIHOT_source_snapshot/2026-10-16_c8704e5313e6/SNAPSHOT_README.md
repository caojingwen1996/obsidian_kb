# AIHOT AI 任务源码参考快照

- 上游：[KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT)，分支 `main`。
- 固定提交：`c8704e5313e6b051560365226b3919d7e0ada5ea`。
- 获取时间：2026-10-16T14:31:17.630950+08:00（Asia/Shanghai）。
- 保存路径：`/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/aihot/AIHOT_source_snapshot/2026-10-16_c8704e5313e6`。
- 上游文件：成功 **103**，失败 **0**；指定 Prompt **19** 个，完整 Prompt 包 **29** 个，TS **56** 个。
- 每个文件均来自该提交的 Git blob，已核验存在、非空、Git blob SHA-1 与 SHA-256；保持原始字节及相对路径。
- 原目录的 6 个既有文件已对比 SHA-256，均未改变。
- 这是用于阅读分析的源码参考子集，不是完整可运行工程；未安装依赖、运行模型调用或验证项目构建。
- 任务编号沿用本地 V2.0 分析；编号不等于一次 API 调用或独立 worker。

## 相比旧文档的源码核验结果

1. 两次评分是两次独立请求，但 runScores 内顺序执行；整个评分流程与 runStructure 并行。
2. AI-05 实际通过 understand.md 组合 content-understanding.md 与共享规则。
3. AI-07 措辞修正和全文翻译是分开的可选操作。
4. AI-08 与 AI-10 共用 group_article 调用；relate.ts 定义输入与 Schema，group.ts 执行请求。
5. AI-09 包括报道合并复核与事件合并复核，分别位于 group.ts、consolidate.ts。GROUP_REVIEW_MODEL 只作为 models.ts 中的环境变量记录。
6. AI-12 / AI-13 在 report_weekly 或 report_monthly 同次请求中输出 overview / sections。栏目导读存在门槛及 no-sections 分支。

## AI task → 真实路径

| AI task | Prompt（含递归共享依赖） | TS 实现 | 核验说明与定位 |
|---|---|---|---|
| AI-01 行业预筛 | [`industry/prompts/prefilter.md`](industry/prompts/prefilter.md) | [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts)<br>[`packages/backend/src/editorial/writing.ts`](packages/backend/src/editorial/writing.ts) | purpose=prefilter_article；runSelectionPrefilter 包装调用。<br>[packages/backend/src/editorial/analyze.ts:239](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/analyze.ts#L239) |
| AI-02 评分 A | [`industry/prompts/selection-score.md`](industry/prompts/selection-score.md) | [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts) | purpose=score_article；SCORE_CALLS=2；score-1 为第一次独立请求。<br>[packages/backend/src/editorial/analyze.ts:276](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/analyze.ts#L276) |
| AI-03 评分 B | [`industry/prompts/selection-score.md`](industry/prompts/selection-score.md) | [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts) | 同一循环的 score-2 为第二次独立请求；与第一次顺序执行。<br>[packages/backend/src/editorial/analyze.ts:289](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/analyze.ts#L289) |
| AI-04 事实结构化 | [`industry/prompts/safety.md`](industry/prompts/safety.md)<br>[`industry/prompts/structure.md`](industry/prompts/structure.md) | [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts)<br>[`packages/backend/src/editorial/vocabulary.ts`](packages/backend/src/editorial/vocabulary.ts) | purpose=structure_article；结构化与整个评分流程并行。<br>[packages/backend/src/editorial/analyze.ts:323](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/analyze.ts#L323) |
| AI-05 内容理解与写作 | [`industry/prompts/content-understanding.md`](industry/prompts/content-understanding.md)<br>[`industry/prompts/rules-answer-first-summary.md`](industry/prompts/rules-answer-first-summary.md)<br>[`industry/prompts/rules-anti-hallucination.md`](industry/prompts/rules-anti-hallucination.md)<br>[`industry/prompts/rules-domain.md`](industry/prompts/rules-domain.md)<br>[`industry/prompts/rules-self-contained-title.md`](industry/prompts/rules-self-contained-title.md)<br>[`industry/prompts/understand.md`](industry/prompts/understand.md) | [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts)<br>[`packages/backend/src/editorial/writing.ts`](packages/backend/src/editorial/writing.ts) | purpose=understand_article；实际入口 understand.md 包含 content-understanding.md。<br>[packages/backend/src/editorial/analyze.ts:342](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/analyze.ts#L342) |
| AI-06 分场景摘要 | [`industry/prompts/identity-context.md`](industry/prompts/identity-context.md)<br>[`industry/prompts/rules-answer-first-summary.md`](industry/prompts/rules-answer-first-summary.md)<br>[`industry/prompts/rules-anti-hallucination.md`](industry/prompts/rules-anti-hallucination.md)<br>[`industry/prompts/rules-domain.md`](industry/prompts/rules-domain.md)<br>[`industry/prompts/rules-self-contained-title.md`](industry/prompts/rules-self-contained-title.md)<br>[`industry/prompts/safety.md`](industry/prompts/safety.md)<br>[`industry/prompts/summarize-article-empty.md`](industry/prompts/summarize-article-empty.md)<br>[`industry/prompts/summarize-article.md`](industry/prompts/summarize-article.md)<br>[`industry/prompts/summarize-long-post-quoted.md`](industry/prompts/summarize-long-post-quoted.md)<br>[`industry/prompts/summarize-long-post.md`](industry/prompts/summarize-long-post.md)<br>[`industry/prompts/summarize-short-post-quoted.md`](industry/prompts/summarize-short-post-quoted.md)<br>[`industry/prompts/summarize-short-post.md`](industry/prompts/summarize-short-post.md) | [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts)<br>[`packages/backend/src/editorial/writing.ts`](packages/backend/src/editorial/writing.ts) | purpose=summarize_article；文章/长帖/短帖分流，另有空文及引用片段。<br>[packages/backend/src/editorial/analyze.ts:423](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/analyze.ts#L423) |
| AI-07 措辞修正与可选翻译 | [`industry/prompts/mend-wording.md`](industry/prompts/mend-wording.md)<br>[`industry/prompts/safety.md`](industry/prompts/safety.md)<br>[`industry/prompts/translate-body.md`](industry/prompts/translate-body.md)<br>[`industry/prompts/translate-post.md`](industry/prompts/translate-post.md) | [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts)<br>[`packages/backend/src/editorial/wording.ts`](packages/backend/src/editorial/wording.ts)<br>[`packages/backend/src/editorial/translate.ts`](packages/backend/src/editorial/translate.ts) | purpose=mend_wording / translate_body；两个可选操作，全文翻译由 worker schedules 调度。<br>[packages/backend/src/editorial/analyze.ts:386](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/analyze.ts#L386)<br>[packages/backend/src/editorial/translate.ts:78](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/translate.ts#L78) |
| AI-08 事件关系判断 | [`industry/prompts/group-batch.md`](industry/prompts/group-batch.md)<br>[`industry/prompts/group-definitions.md`](industry/prompts/group-definitions.md)<br>[`industry/prompts/group-method.md`](industry/prompts/group-method.md)<br>[`industry/prompts/group-pair.md`](industry/prompts/group-pair.md)<br>[`industry/prompts/group-signal.md`](industry/prompts/group-signal.md) | [`packages/backend/src/events/relate.ts`](packages/backend/src/events/relate.ts)<br>[`packages/backend/src/events/group.ts`](packages/backend/src/events/group.ts)<br>[`packages/backend/src/events/recall.ts`](packages/backend/src/events/recall.ts)<br>[`packages/backend/src/events/consolidate.ts`](packages/backend/src/events/consolidate.ts) | purpose=group_article / group_signal；跨事件判断另有 group_story。relate.ts 定义 Prompt、Schema、输入，group.ts 发起调用。<br>[packages/backend/src/events/group.ts:77](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/events/group.ts#L77)<br>[packages/backend/src/events/group.ts:94](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/events/group.ts#L94) |
| AI-09 归组复核 | [`industry/prompts/group-definitions.md`](industry/prompts/group-definitions.md)<br>[`industry/prompts/group-method.md`](industry/prompts/group-method.md)<br>[`industry/prompts/group-pair.md`](industry/prompts/group-pair.md) | [`packages/backend/src/events/group.ts`](packages/backend/src/events/group.ts)<br>[`packages/backend/src/events/consolidate.ts`](packages/backend/src/events/consolidate.ts)<br>[`packages/backend/src/events/relate.ts`](packages/backend/src/events/relate.ts)<br>[`packages/backend/src/editorial/models.ts`](packages/backend/src/editorial/models.ts) | purpose=group_review / group_story_review；GROUP_REVIEW_MODEL 是环境配置变量，不是文件。<br>[packages/backend/src/events/group.ts:86](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/events/group.ts#L86)<br>[packages/backend/src/events/consolidate.ts:56](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/events/consolidate.ts#L56)<br>[packages/backend/src/editorial/models.ts:32](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/editorial/models.ts#L32) |
| AI-10 精选信息增量 | [`industry/prompts/group-batch.md`](industry/prompts/group-batch.md)<br>[`industry/prompts/group-definitions.md`](industry/prompts/group-definitions.md)<br>[`industry/prompts/group-method.md`](industry/prompts/group-method.md) | [`packages/backend/src/events/group.ts`](packages/backend/src/events/group.ts)<br>[`packages/backend/src/events/relate.ts`](packages/backend/src/events/relate.ts)<br>[`packages/backend/src/events/recall.ts`](packages/backend/src/events/recall.ts) | 与 AI-08 的 group_article 同次调用，输出 selection.addsValue 和 reason；不凭空新增独立调用。<br>[packages/backend/src/events/group.ts:77](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/events/group.ts#L77)<br>[packages/backend/src/events/relate.ts:73](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/events/relate.ts#L73) |
| AI-11 事件综述 | [`industry/prompts/story-digest.md`](industry/prompts/story-digest.md) | [`packages/backend/src/events/digest.ts`](packages/backend/src/events/digest.ts)<br>[`packages/backend/src/publication/story-evidence.ts`](packages/backend/src/publication/story-evidence.ts) | purpose=story_digest；jobs/events.ts 注册执行。<br>[packages/backend/src/events/digest.ts:44](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/events/digest.ts#L44) |
| AI-12 周期报告总述 | [`industry/prompts/report-period-no-sections.md`](industry/prompts/report-period-no-sections.md)<br>[`industry/prompts/report-period-sections.md`](industry/prompts/report-period-sections.md)<br>[`industry/prompts/report-period.md`](industry/prompts/report-period.md) | [`packages/backend/src/reports/compose.ts`](packages/backend/src/reports/compose.ts)<br>[`packages/backend/src/reports/edition.ts`](packages/backend/src/reports/edition.ts) | purpose=report_weekly / report_monthly；一次返回 overview 与 sections，日刊规则编排。<br>[packages/backend/src/reports/compose.ts:142](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/reports/compose.ts#L142)<br>[packages/backend/src/reports/compose.ts:212](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/reports/compose.ts#L212) |
| AI-13 周期报告栏目导读 | [`industry/prompts/report-period-no-sections.md`](industry/prompts/report-period-no-sections.md)<br>[`industry/prompts/report-period-sections.md`](industry/prompts/report-period-sections.md)<br>[`industry/prompts/report-period.md`](industry/prompts/report-period.md) | [`packages/backend/src/reports/compose.ts`](packages/backend/src/reports/compose.ts)<br>[`packages/backend/src/reports/edition.ts`](packages/backend/src/reports/edition.ts) | 是 AI-12 同次调用的 sections 部分；仅为满足栏目条目门槛的栏目生成导读，其他走 no-sections。<br>[packages/backend/src/reports/compose.ts:148](https://github.com/KKKKhazix/AIHOT/blob/c8704e5313e6b051560365226b3919d7e0ada5ea/packages/backend/src/reports/compose.ts#L148) |

## 通配符实际匹配

### summarize-*.md（6 个）

- [`industry/prompts/summarize-article-empty.md`](industry/prompts/summarize-article-empty.md)
- [`industry/prompts/summarize-article.md`](industry/prompts/summarize-article.md)
- [`industry/prompts/summarize-long-post-quoted.md`](industry/prompts/summarize-long-post-quoted.md)
- [`industry/prompts/summarize-long-post.md`](industry/prompts/summarize-long-post.md)
- [`industry/prompts/summarize-short-post-quoted.md`](industry/prompts/summarize-short-post-quoted.md)
- [`industry/prompts/summarize-short-post.md`](industry/prompts/summarize-short-post.md)

### group-*.md（5 个）

- [`industry/prompts/group-batch.md`](industry/prompts/group-batch.md)
- [`industry/prompts/group-definitions.md`](industry/prompts/group-definitions.md)
- [`industry/prompts/group-method.md`](industry/prompts/group-method.md)
- [`industry/prompts/group-pair.md`](industry/prompts/group-pair.md)
- [`industry/prompts/group-signal.md`](industry/prompts/group-signal.md)

## 共享执行链与配置

- Prompt 装配与内容版本：[`packages/backend/src/editorial/prompts.ts`](packages/backend/src/editorial/prompts.ts)
- 模型路由与服务：[`packages/backend/src/editorial/models.ts`](packages/backend/src/editorial/models.ts)、[`site/models.ts`](site/models.ts)、[`packages/backend/src/providers/llm.ts`](packages/backend/src/providers/llm.ts)
- 付费请求回执与重用：[`packages/backend/src/providers/receipts.ts`](packages/backend/src/providers/receipts.ts)
- 执行与调度：[`packages/backend/src/jobs/content.ts`](packages/backend/src/jobs/content.ts)、[`packages/backend/src/jobs/events.ts`](packages/backend/src/jobs/events.ts)、[`packages/backend/src/jobs/queue.ts`](packages/backend/src/jobs/queue.ts)、[`apps/worker/src/main.ts`](apps/worker/src/main.ts)、[`apps/worker/src/schedules.ts`](apps/worker/src/schedules.ts)
- 行业阈值、类别、措辞与主题：[`industry/selection.ts`](industry/selection.ts)、[`industry/taxonomy.ts`](industry/taxonomy.ts)、[`industry/wording.ts`](industry/wording.ts)、[`industry/topics.json`](industry/topics.json)

## 校验与完整文件清单

- [机器可读清单和任务映射](_snapshot/MANIFEST.json)
- [CSV 清单](_snapshot/FILES.csv)
- [SHA256SUMS](_snapshot/SHA256SUMS)
- [上游完整 Git tree](_snapshot/UPSTREAM_TREE.txt)
- [提交信息](_snapshot/COMMIT.txt)

在本目录重新核验：

```sh
shasum -a 256 -c _snapshot/SHA256SUMS
```

| 上游相对路径 | 字节数 | 任务 | 状态 |
|---|---:|---|---|
| [`LICENSE`](LICENSE) | 1078 | 共享支撑/配置/说明 | 已核验 |
| [`NOTICE`](NOTICE) | 570 | 共享支撑/配置/说明 | 已核验 |
| [`README.md`](README.md) | 13660 | 共享支撑/配置/说明 | 已核验 |
| [`apps/worker/src/main.ts`](apps/worker/src/main.ts) | 2128 | 共享支撑/配置/说明 | 已核验 |
| [`apps/worker/src/schedules.ts`](apps/worker/src/schedules.ts) | 5550 | 共享支撑/配置/说明 | 已核验 |
| [`docs/architecture.md`](docs/architecture.md) | 12378 | 共享支撑/配置/说明 | 已核验 |
| [`docs/customize.md`](docs/customize.md) | 19748 | 共享支撑/配置/说明 | 已核验 |
| [`docs/grouping.md`](docs/grouping.md) | 5428 | 共享支撑/配置/说明 | 已核验 |
| [`docs/selection.md`](docs/selection.md) | 13261 | 共享支撑/配置/说明 | 已核验 |
| [`docs/sources.md`](docs/sources.md) | 20980 | 共享支撑/配置/说明 | 已核验 |
| [`docs/story-digest-evaluation.md`](docs/story-digest-evaluation.md) | 3792 | 共享支撑/配置/说明 | 已核验 |
| [`industry/README.md`](industry/README.md) | 960 | 共享支撑/配置/说明 | 已核验 |
| [`industry/package.json`](industry/package.json) | 111 | 共享支撑/配置/说明 | 已核验 |
| [`industry/prompts/content-understanding.md`](industry/prompts/content-understanding.md) | 6313 | AI-05 | 已核验 |
| [`industry/prompts/group-batch.md`](industry/prompts/group-batch.md) | 2875 | AI-08, AI-10 | 已核验 |
| [`industry/prompts/group-definitions.md`](industry/prompts/group-definitions.md) | 2349 | AI-08, AI-09, AI-10 | 已核验 |
| [`industry/prompts/group-method.md`](industry/prompts/group-method.md) | 652 | AI-08, AI-09, AI-10 | 已核验 |
| [`industry/prompts/group-pair.md`](industry/prompts/group-pair.md) | 490 | AI-08, AI-09 | 已核验 |
| [`industry/prompts/group-signal.md`](industry/prompts/group-signal.md) | 701 | AI-08 | 已核验 |
| [`industry/prompts/identity-context.md`](industry/prompts/identity-context.md) | 244 | AI-06 | 已核验 |
| [`industry/prompts/mend-wording.md`](industry/prompts/mend-wording.md) | 535 | AI-07 | 已核验 |
| [`industry/prompts/prefilter.md`](industry/prompts/prefilter.md) | 1601 | AI-01 | 已核验 |
| [`industry/prompts/report-period-no-sections.md`](industry/prompts/report-period-no-sections.md) | 18 | AI-12, AI-13 | 已核验 |
| [`industry/prompts/report-period-sections.md`](industry/prompts/report-period-sections.md) | 228 | AI-12, AI-13 | 已核验 |
| [`industry/prompts/report-period.md`](industry/prompts/report-period.md) | 775 | AI-12, AI-13 | 已核验 |
| [`industry/prompts/rules-answer-first-summary.md`](industry/prompts/rules-answer-first-summary.md) | 1131 | AI-05, AI-06 | 已核验 |
| [`industry/prompts/rules-anti-hallucination.md`](industry/prompts/rules-anti-hallucination.md) | 1176 | AI-05, AI-06 | 已核验 |
| [`industry/prompts/rules-domain.md`](industry/prompts/rules-domain.md) | 3930 | AI-05, AI-06 | 已核验 |
| [`industry/prompts/rules-self-contained-title.md`](industry/prompts/rules-self-contained-title.md) | 1814 | AI-05, AI-06 | 已核验 |
| [`industry/prompts/safety.md`](industry/prompts/safety.md) | 234 | AI-04, AI-06, AI-07 | 已核验 |
| [`industry/prompts/selection-score.md`](industry/prompts/selection-score.md) | 9705 | AI-02, AI-03 | 已核验 |
| [`industry/prompts/story-digest.md`](industry/prompts/story-digest.md) | 1825 | AI-11 | 已核验 |
| [`industry/prompts/structure.md`](industry/prompts/structure.md) | 7269 | AI-04 | 已核验 |
| [`industry/prompts/summarize-article-empty.md`](industry/prompts/summarize-article-empty.md) | 84 | AI-06 | 已核验 |
| [`industry/prompts/summarize-article.md`](industry/prompts/summarize-article.md) | 1243 | AI-06 | 已核验 |
| [`industry/prompts/summarize-long-post-quoted.md`](industry/prompts/summarize-long-post-quoted.md) | 108 | AI-06 | 已核验 |
| [`industry/prompts/summarize-long-post.md`](industry/prompts/summarize-long-post.md) | 1114 | AI-06 | 已核验 |
| [`industry/prompts/summarize-short-post-quoted.md`](industry/prompts/summarize-short-post-quoted.md) | 545 | AI-06 | 已核验 |
| [`industry/prompts/summarize-short-post.md`](industry/prompts/summarize-short-post.md) | 603 | AI-06 | 已核验 |
| [`industry/prompts/translate-body.md`](industry/prompts/translate-body.md) | 878 | AI-07 | 已核验 |
| [`industry/prompts/translate-post.md`](industry/prompts/translate-post.md) | 283 | AI-07 | 已核验 |
| [`industry/prompts/understand.md`](industry/prompts/understand.md) | 324 | AI-05 | 已核验 |
| [`industry/selection.ts`](industry/selection.ts) | 1320 | 共享支撑/配置/说明 | 已核验 |
| [`industry/sources.json`](industry/sources.json) | 9069 | 共享支撑/配置/说明 | 已核验 |
| [`industry/taxonomy.ts`](industry/taxonomy.ts) | 13724 | 共享支撑/配置/说明 | 已核验 |
| [`industry/topics.json`](industry/topics.json) | 10584 | 共享支撑/配置/说明 | 已核验 |
| [`industry/tsconfig.json`](industry/tsconfig.json) | 64 | 共享支撑/配置/说明 | 已核验 |
| [`industry/wording.ts`](industry/wording.ts) | 541 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/package.json`](packages/backend/package.json) | 620 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/audit.ts`](packages/backend/src/audit.ts) | 2169 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/config.ts`](packages/backend/src/config.ts) | 5468 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/content/extract.ts`](packages/backend/src/content/extract.ts) | 12410 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/content/materials.ts`](packages/backend/src/content/materials.ts) | 17796 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/content/posts.ts`](packages/backend/src/content/posts.ts) | 752 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/content/provenance.ts`](packages/backend/src/content/provenance.ts) | 5908 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/content/sanitize.ts`](packages/backend/src/content/sanitize.ts) | 11877 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/db.ts`](packages/backend/src/db.ts) | 1800 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/editorial/analyze.ts`](packages/backend/src/editorial/analyze.ts) | 29507 | AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07 | 已核验 |
| [`packages/backend/src/editorial/input.ts`](packages/backend/src/editorial/input.ts) | 7007 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/editorial/models.ts`](packages/backend/src/editorial/models.ts) | 6626 | AI-09 | 已核验 |
| [`packages/backend/src/editorial/prompts.ts`](packages/backend/src/editorial/prompts.ts) | 3237 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/editorial/translate.ts`](packages/backend/src/editorial/translate.ts) | 21881 | AI-07 | 已核验 |
| [`packages/backend/src/editorial/vocabulary.ts`](packages/backend/src/editorial/vocabulary.ts) | 2421 | AI-04 | 已核验 |
| [`packages/backend/src/editorial/wording.ts`](packages/backend/src/editorial/wording.ts) | 1294 | AI-07 | 已核验 |
| [`packages/backend/src/editorial/writing.ts`](packages/backend/src/editorial/writing.ts) | 17890 | AI-01, AI-05, AI-06 | 已核验 |
| [`packages/backend/src/events/consolidate.ts`](packages/backend/src/events/consolidate.ts) | 9180 | AI-08, AI-09 | 已核验 |
| [`packages/backend/src/events/corrections.ts`](packages/backend/src/events/corrections.ts) | 9783 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/events/digest.ts`](packages/backend/src/events/digest.ts) | 6954 | AI-11 | 已核验 |
| [`packages/backend/src/events/group.ts`](packages/backend/src/events/group.ts) | 35832 | AI-08, AI-09, AI-10 | 已核验 |
| [`packages/backend/src/events/hot.ts`](packages/backend/src/events/hot.ts) | 19831 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/events/merge.ts`](packages/backend/src/events/merge.ts) | 2913 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/events/recall.ts`](packages/backend/src/events/recall.ts) | 15074 | AI-08, AI-10 | 已核验 |
| [`packages/backend/src/events/relate.ts`](packages/backend/src/events/relate.ts) | 10480 | AI-08, AI-09, AI-10 | 已核验 |
| [`packages/backend/src/events/related.ts`](packages/backend/src/events/related.ts) | 2136 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/jobs/content.ts`](packages/backend/src/jobs/content.ts) | 17262 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/jobs/events.ts`](packages/backend/src/jobs/events.ts) | 2339 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/jobs/publication.ts`](packages/backend/src/jobs/publication.ts) | 1691 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/jobs/queue.ts`](packages/backend/src/jobs/queue.ts) | 9508 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/lib/ids.ts`](packages/backend/src/lib/ids.ts) | 1090 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/lib/log-error.ts`](packages/backend/src/lib/log-error.ts) | 1282 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/lib/shutdown.ts`](packages/backend/src/lib/shutdown.ts) | 152 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/lib/text.ts`](packages/backend/src/lib/text.ts) | 4290 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/media/images.ts`](packages/backend/src/media/images.ts) | 14697 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/modules.ts`](packages/backend/src/modules.ts) | 14873 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/providers/embeddings.ts`](packages/backend/src/providers/embeddings.ts) | 6501 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/providers/llm.ts`](packages/backend/src/providers/llm.ts) | 9244 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/providers/receipts.ts`](packages/backend/src/providers/receipts.ts) | 12903 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/publication/coverage.ts`](packages/backend/src/publication/coverage.ts) | 989 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/publication/publish.ts`](packages/backend/src/publication/publish.ts) | 28928 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/publication/representative.ts`](packages/backend/src/publication/representative.ts) | 1745 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/publication/scope.ts`](packages/backend/src/publication/scope.ts) | 4344 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/publication/story-evidence.ts`](packages/backend/src/publication/story-evidence.ts) | 2830 | AI-11 | 已核验 |
| [`packages/backend/src/reports/compose.ts`](packages/backend/src/reports/compose.ts) | 19083 | AI-12, AI-13 | 已核验 |
| [`packages/backend/src/reports/correct.ts`](packages/backend/src/reports/correct.ts) | 4258 | 共享支撑/配置/说明 | 已核验 |
| [`packages/backend/src/reports/edition.ts`](packages/backend/src/reports/edition.ts) | 23285 | AI-12, AI-13 | 已核验 |
| [`packages/backend/src/sources/x.ts`](packages/backend/src/sources/x.ts) | 11903 | 共享支撑/配置/说明 | 已核验 |
| [`packages/contracts/package.json`](packages/contracts/package.json) | 192 | 共享支撑/配置/说明 | 已核验 |
| [`packages/contracts/src/taxonomy.ts`](packages/contracts/src/taxonomy.ts) | 2645 | 共享支撑/配置/说明 | 已核验 |
| [`packages/contracts/src/time.ts`](packages/contracts/src/time.ts) | 3430 | 共享支撑/配置/说明 | 已核验 |
| [`site/README.md`](site/README.md) | 1271 | 共享支撑/配置/说明 | 已核验 |
| [`site/models.ts`](site/models.ts) | 3412 | 共享支撑/配置/说明 | 已核验 |
| [`site/package.json`](site/package.json) | 350 | 共享支撑/配置/说明 | 已核验 |
| [`site/site.ts`](site/site.ts) | 19178 | 共享支撑/配置/说明 | 已核验 |
