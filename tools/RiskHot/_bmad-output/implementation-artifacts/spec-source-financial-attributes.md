---
title: '信源表增加金融属性字段'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="用户已授权增加信源字段">

## Intent

为现有信源表增加独立金融属性字段，承接此前以钱的数量、钱的价格、钱的流向组织信源的分类需求。保留一源多属性和未分类状态，保持档案编辑及专题研究读取可用，不自动推断40条信源的分类值。

</frozen-after-approval>

## Implementation Notes

- 延续当前main工作区中已授权的连续开发，保留既有未提交修改，不提交混合工作区。
- 新列为m1.sources.financial_attributes TEXT[] NOT NULL DEFAULT '{}'。006增量迁移只在首次增加列时从metadata.dims回填，重复运行不覆盖正式值；保持schema5及所有业务数据。
- 当前信源管理服务新增、编辑写新列；查询将正式值映射到兼容的profile.dims与metadata.dims，旧metadata残值不参与判断。旧表字段不因迁移删除。
- 修改位置：src/db/006-source-financial-attributes.sql、src/platform/ingestion-migration.ts、src/information-ingestion/sources/current-management.ts、src/runtime/current-management.ts、src/tests/ingestion-migration.test.ts。新增信源清单仍为空分类；已有页面无交互改版。
- 验证：npm run typecheck；隔离数据库迁移与管理接口测试；实际数据库增量应用与前后原字段/任务计数比较。同步F01数据模型、README、索引与维护日志。

- 完成：22项隔离数据库及接口测试、12项页面单元和15组浏览器回归通过，类型检查通过。实际40条信源原字段保留，原任务1、资料1、计划40计数未变，新列存在且实际接口已返回。
- 迁移首次回填会裁剪空格并过滤空白项，旧metadata保持原样；修复后重复迁移和历史空白分类用例通过。
- 保留整个连续开发工作区，未将此前多任务修改混合提交。

## Review Triage Log

- medium／patch：历史空白metadata.dims可回填为空字符串，省略分类编辑时被校验拒绝。006已过滤空白并裁剪空格，数组与单值历史空白均有测试，22项回归通过；实际40条原先均无dims，不受影响。其他指定路径未发现明确缺陷，无遗留阻塞。
