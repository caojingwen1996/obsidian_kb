# F02 A1 队列事务与 Worker 隔离验证

日期：2026-11-01。范围：A1及A3公共运行设施；不代表F02八步业务已接通、正式数据库已迁移或引擎已切换。

## 输入与版本

依据本轮八步闭环规格、分批计划A1/A3、T03与S01。锁定 `pg-boss@10.3.3`，其发布包声明 Node >=20，本机 Node 22.22.1；项目约束维持 >=22.0.0，未升级其他直接依赖。安装在独立worktree的实体node_modules，先解除原项目依赖目录软链接。

一手依据：[10.3.3 jobs文档](https://github.com/timgit/pg-boss/blob/10.3.3/docs/api/jobs.md)、发布包 `types.d.ts`、`src/manager.js`、`src/plans.js`、`src/index.js`。原生接口为 `send(name,data,{db:{executeSql(sql,values)}})`，executeSql委托当前PoolClient.query；Job ID可空，适配器遇空拒绝，不凭空宣称成功。队列分区创建有DDL，因此预建队列与运行消费分离，运行账号不应调用createQueue。

## 方法与真实结果

命令：`node --env-file-if-exists=.env --import tsx --test src/tests/business-queue.test.ts`。

每个数据库用例通过管理连接新建随机 `riskhot_queue_*` 数据库，所有建表、写入、队列消费仅在该临时库，结束后关闭连接并删除临时库。未修改riskhot业务库或真实服务。首先运行缺失实现的测试，补导出骨架后观察4项断言因未实现/凭据泄露失败，随后最小实现转绿；后续消费、子进程、周期注册也先观察失败再实现。

初始8项设施场景通过；随后补齐永久输入、引擎进程选择、UTF-8分块及停机取消，共13项队列/Worker专项通过：

- 业务行、运行登记、投递关联、队列Job随同一事务整体回滚。
- 确认丢失并发受理返回同一永久回执；相同操作身份不同摘要拒绝。
- 删除库原生Job后仍复用永久回执；显式新投递序号可以恢复，不依赖队列永久留存。
- Temporal归属及旧控制代次不能由新队列领取，4个并发受理只有同一运行。
- 已保存业务结果但确认丢失的再次消费，处理器只运行一次；第二次不再写副作用。
- 实际模型子进程只获得允许的运行环境/明确供应凭据，数据库和审批配置不继承，超时进程被回收。
- 8个业务队列与3个周期配置实际注册，业务Job被消费，启动补扫执行一次，扫描登记写入真实计数。
- 临时无DDL运行角色可以入队、领取、确认，但无法在platform建表。

## 接口与边界

`enqueueBusinessJob(tx,envelope,{dispatch_seq?,startAfter?})` 同事务登记并send。envelope包含T03身份以及owner_module、operation_key、payload。默认投递序号1；领域恢复端口须先验证业务资格，再显式选择后续序号。已有未结束Job时拒绝新投递。运行终态/等待不自动补投，旧代次不自动晋级。

`executeBusinessJob(db,envelope,handler)` 提供signal与commit事务端口。模型可在事务外计算，业务提交及下一Job必须放在commit回调中；成功结果登记后重投不重新调用handler。外部模型调用前的预算预留、响应工件保存与领域权限重验仍由业务模块负责。

`provisionBusinessQueues` 仅供发布账号。`registerBusinessWorker` 仅装载已预建队列，返回停止领取函数；调用方负责boss.stop及连接关闭。普通导入不会启动进程或切换引擎。周期注册持久保存期望配置版本和应用时间，补一次当前扫描而不补齐每个漏期时点；扫描有独立数据库排他锁，job_runs按周期/时点去重。

模型子进程许可为单进程并发1，仅允许部署一个会调用模型的Worker；尚未实现跨Worker模型租约。信号和提交截止检查提供15分钟控制窗口，队列过期960秒；子进程每次最多120秒且不内部重试。

## 限制与剩余验证

- 本报告验证设施；当前F01 submit/control/material交接与F02 extraction已接统一端口，全部八步业务及最终handler适配仍以主验收为准。
- 未执行真实模型服务、正式切换、实际外部交付、备份恢复或完整场景验收。
- runtime账号的精细模块授权和部署配置仍需统一发布验证；本PoC临时角色仅验证DML足够，不作为最终授权清单。
- 技术重试目前使用原生retryLimit=4、2秒指数退避；抓取/交付/模型的特定间隔和业务累计预算由各处理器明确控制，不能把设施默认值当成已满足所有T03业务政策。
- 专项命令同时运行business-queue.test.ts、business-model.test.ts、codex.test.ts，扩大至8个相关文件47项全部通过（含队列13、业务模型2、真实重试接口1、AI08、原Codex及采集/调度回归）。typecheck曾全绿；后续并行模块增加中出现f02-identity-contract.test.ts引用尚在创建的eight-step-identity模块，等待主协调器对齐。最终全套结果以总验收报告为准。

## 新引擎显式启动与模型交接补充

- `EXECUTION_ENGINE` 缺省为 `temporal`，原进程组保持；设为 `pg-boss` 时dev仅启动business Worker与API。启动不会迁移旧对象归属。
- `npm run migrate:business` 是显式发布命令，创建SQL009和pg-boss分区；`npm run worker:business` 启动运行账号。未对真实库执行这些命令。
- Worker入口需要BUSINESS_DATABASE_URL，BUSINESS_HANDLERS_MODULE缺省为src/runtime/f02-business-handlers.ts；覆盖值必须是src/runtime内的TS模块，导出createHandlers(db)。缺任意业务处理器时启动拒绝。
- `callBusinessModel` 在进程内许可取得后才保留预算，使用已有model_attempts/model_budget_windows，持久响应后可复用；失败不叠加自动重试。新增`invokeReservedBusinessModel`消费已有attempt不重复计次。material路径应在withBusinessModelPermit中准备、调用并接纳。
- Codex使用显式BUSINESS_MODEL_CODEX_HOME的auth.json副本，临时HOME不含项目配置，原认证目录只读；Http/Codex子进程均无数据库及审批变量。测试使用本地受控HTTP，没有真实模型调用。
- 实际HTTP测试覆盖响应复用、连续相同失败输入再次调用的计次、三次总预算、撤权阻断，以及material已有attempt重复invoke不重复调用。进程专项验证UTF-8跨块和停止Worker立即回收模型进程组。

2026-11-01补充验证：source周期开关仅控制sources.schedule；禁用撤销既有Cron并忽略遗留扫描任务，recover/alerts保持。business环境传递SCHEDULER_ACTOR/SCHEDULE_ENABLED/SCHEDULE_SOURCES。

资料重试真实接口已验证：新引擎202后存在information.extract下一代次Job，不增写execution_intents；旧未终态运行被替代，旧输入拒绝继续读取，新输入可完整还原固定资料。旧引擎仍走原intent路径。

AI-04正式保存后分支由SQL009的claim_business_model_call专门处理：仅新包语义、当前代次、candidate_fact已归属正式Event、全部来源仍有权限且版本有效时允许。其余任务保留原claim规则。新包task_package按task_id/version/digest引用规范化，实际prompt/schema保持，旧包摘要规则不变。

最终8文件相关回归47/47通过。其后停机增加许可等待断言：停止既杀当前模型进程，也阻断等待许可的后续调用；queue专项再次13/13通过，typecheck通过。完整npm test和pipeline:check由主协调器统一记录。

## 最后修复验证（2026-11-01）

采用用户确认的o200k_base/24000 token与96000字节双上限，固定js-tiktoken 1.0.21；编码器单例、ranks随发布包本地加载，无运行时下载。核对[库一手API](https://github.com/dqbd/tiktoken/tree/main/js)与[OpenAI官方encoding定义](https://github.com/openai/tiktoken/blob/main/tiktoken_ext/openai_public.py#L87)，o200k_base官方数据hash为446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d。测试31KB中文prompt可通过；物理不足96KB但token超过24000、物理超过96KB均拒绝。此值不表示供应模型计费token。

资料恢复真实HTTP测试：已预留且未调用的attempt复用；同gen连续两次503分别保留recoverable，下一受控恢复使用下一个workflow索引；第三次响应持久后、接纳前恢复复用工件，不再调用；预算累计3次。最终状态依据extraction_result/candidate_count，不把stop=true直接算成功。每次Job只做一轮，不自动无限重排。

关联恢复真实数据库测试：正式事件与当前代次资格成立时，30秒后允许补投；两个恢复器并发合计只补一份，未结束Job由适配器挡住；最多三份dispatch，耗尽保留recoverable且清空下次时点。

最后命令：node --env-file-if-exists=.env --import tsx --test src/tests/business-model.test.ts src/tests/business-material-retry.test.ts src/tests/business-queue.test.ts，17/17通过；随后npm run typecheck通过。更早8文件相关回归47/47通过。最终全套与pipeline检查由主协调器统一记录。
