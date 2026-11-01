# F02 A2 增量迁移验证

日期：2026-11-01。范围：实施计划 A2；依据 F02 事件存储 §5/§11、观测存储 §8。本次仅在随机 `riskhot_f02_` 临时库实施，未迁移真实业务库。

## 实现

- `008-f02.sql` 从 schema5 增量更新，必要时先应用幂等 007；不执行 005，不重建资料、来源、回执或预算。
- `fact_information` 原表及字段改名为 `fact_material.material_id`；事实归属完整回填 `fact.event_id/event_relation_role/event_relation_note/event_assigned_at` 后删除 `event_fact`，事实依据复合外键指向唯一的 `(event_id,id)`。旧 object 留空，不从标题猜值。
- 检查点主键完整替换为 `(candidate_id,generation,node_key,object_ref)`，历史节点使用 `legacy-step-N`，旧 `step_no` 可空；新状态支持 running。历史代码写入 legacy 节点，不能因此声称新八步处理器已完成。
- 新增变量提取、17列观测主表、关联快照/成员和用途结果载体。观测 basis 延迟验证证据、资料版本/摘要、事件归属、定义及计算输入；关联快照成员与 JSON 集合一致；结果正文不可变。
- `inspectF02Migration` 输出计数、异常、检查点外键依赖、已登记版本；`applyF02Migration` 使用同事务排他锁、异常拒绝、计数比对及幂等版本标记。测试支持事务末尾故障注入。
- 当前读写使用 `storage-layout.ts` 显式选择新旧权威表；不创建兼容视图。当前模型的版本门禁接受 schema5 及后续版本，避免 008/009 后误入旧模型。
- `platform.current_model_materials(uuid)` 逐份核对采用资料身份、版本、摘要、来源状态及处理权限，供多来源模型引用读取；模型角色仍无资料表 SELECT 权限。

## 验证结果

命令：`node --env-file-if-exists=.env --import tsx --test src/tests/f02-migration.test.ts`。6/6通过：

1. 原始 schema5 迁移，资料、事实来源、证据、历史回执、非零已用预算及消息保留，重复执行无变化；旧 object 为空，新节点 step_no=NULL / running 可写。
2. schema5+007 同样迁移通过。
3. 事务末尾故障，DDL、归属及版本记录一起回滚。
4. 不匹配观测依据、计算输入缺证据、证据身份破坏被拒绝。
5. 旧多归属及孤立证据明确拒绝，原证据不删除。
6. schema8 真实 HTTP 事件列表与详情可读，来源撤权后详情403、列表隐藏。

回归命令：`node --env-file-if-exists=.env --import tsx --test src/tests/current-entrypoints.test.ts src/tests/fact-model.test.ts`。4/4通过。

已运行 `npm run typecheck`，A2文件无类型错误；同轮其他任务尚在编写，出现队列 `includeArchive` 与运行环境接口错误，整体结果由主任务收敛记录。

## 运行说明与边界

只读盘点：`node --env-file-if-exists=.env --import tsx src/scripts/migrate-f02.ts`。

实际执行：`node --env-file-if-exists=.env --import tsx src/scripts/migrate-f02.ts --apply`。真实库执行仍需发布切换安排；本次没有执行。

迁移失败不删除业务数据。回退采用事务回滚或已验证备份恢复；不能重跑005，也不提供破坏性自动降级。外部检查点外键需要显式核定后迁移，当前会拒绝而非 CASCADE。正式变量规则与 M2 定义仍由发布的 DefinitionReader/定义快照供给，不创建假 M2 字典。日历、JSON业务语义及用途发布规则由受控保存层校验；DDL不冒充完整业务发布流程。
