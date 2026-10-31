# 信源金融属性字段验证

2026-10-29，按用户“给信源表增加金融属性字段”的要求完成独立列、兼容读写与本机增量应用。

## 字段与兼容方式

| 项目 | 现行定义 |
| --- | --- |
| 表及字段 | m1.sources.financial_attributes |
| 类型 | TEXT[]，非空，默认空数组；不允许NULL元素 |
| 业务含义 | 信源的金融属性，可多选；常用钱的数量、钱的价格、钱的流向 |
| 未分类 | 空数组，不自动推断正式分类 |
| 写入 | 既有档案接口profile.dims写独立列，去重及裁剪空格；省略保留，空数组清空 |
| 读取 | 返回financial_attributes，并投影到兼容的metadata.dims和profile.dims；旧metadata不作为正式值 |
| 迁移 | 006增量SQL首次回填历史数组／单值，过滤空白并保留原metadata；重复执行不覆盖新列 |

初始库及现有schema5普通初始化都应用006；不改变schema5业务表和调度配置。档案新增／编辑不再向metadata写入dims，业务启停、并发更新时间与幂等机制沿用。

## 修改文件

- [[tools/RiskHot/src/db/006-source-financial-attributes.sql|增量SQL]]、[[tools/RiskHot/src/platform/ingestion-migration.ts|迁移接入]]。
- [[tools/RiskHot/src/information-ingestion/sources/current-management.ts|信源创建、编辑与投影]]、[[tools/RiskHot/src/runtime/current-management.ts|管理查询及字段校验]]。
- [[tools/RiskHot/src/tests/ingestion-migration.test.ts|迁移和接口测试]]、[[tools/RiskHot/src/tests/ingestion-migration.e2e.ts|浏览器测试数据接入新列]]。
- 同步F01数据模型、README、索引、维护日志及[[tools/RiskHot/_bmad-output/implementation-artifacts/spec-source-financial-attributes|本次工程规格]]。

## 验证与实际应用

| 检查 | 结果 |
| --- | --- |
| 数据库及接口 | 22项通过，包含新增多值保存、默认空、省略保留、清空、非法值、旧值覆盖、历史空白分类与重复迁移 |
| 页面逻辑 | 12项通过 |
| 浏览器回归 | 15组通过，分类浏览、档案编辑、任务计划和既有任务资料流程正常 |
| 类型 | npm run typecheck通过 |
| 独立审查 | 发现历史空白分类可能阻止后续编辑，已修复回填并增加用例；未留阻塞问题 |
| 本机数据库 | 已增加字段，40条信源原字段逐项一致；原1条任务、1份资料、40份计划计数不变 |
| 本机接口 | 重启服务后40条信源均返回新列，兼容属性与新列一致 |

本机40条原先无金融属性，当前新列均为空数组，未自动填入演示或推测分类。实际应用前已在私有.riskhot/backups保存信源快照；没有运行破坏式重建。

证据：[[tools/RiskHot/docs/verification/source-financial-attributes/database.json|数据库比对]]、[[tools/RiskHot/docs/verification/source-financial-attributes/live-api.json|实际接口]]、[[tools/RiskHot/docs/verification/source-financial-attributes/tests.log|22项测试]]、[[tools/RiskHot/docs/verification/source-financial-attributes/browser/results.json|15组浏览器回归]]。
