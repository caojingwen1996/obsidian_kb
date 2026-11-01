# F02 A7 首批 NEW 提交核心验证

日期：2026-11-01。实现入口：`src/event-management/eight-step-commit.ts`。本报告覆盖提交事务核心，不代表真实模型、业务规则发布、关联分析或整批发布已完成。

## 接口与约束

`commitEightStep(repo,id,executionGeneration,contextDigest,actor,reviewDigest?)` 依据候选当前 proposal_generation 读取八个前置语义检查点；执行代次单独校验，复核引起 execution_generation 增长不会误换业务结果代次。`eightStepCommitReviewDigest` 固定按八个节点顺序计算最终提交批准摘要。

只接受 NEW、完整身份召回、现行目录/权限 epoch、分别有效的 identity 与 commit 批准。批准使用现有大写 `APPROVE`，策略为 `f02-eight-step-v1`；identity 审核者按 event_review、最终提交审核者按 event_commit 检查全部采用来源。调用者及资料处理者按 event_submit 核对。Target 要求现行主表版本与已批准的对象比较运行一致，变量快照必须对应当前 definition_ref 中 active 的正式定义及版本摘要。

首批只支持 text-draft-v1，评级保持 draft/m=NULL；具体观测保留 pending，不代替逐条人工核验。变量缺定义只保留提取结果，不能写三元关系。具体观测按正式 data_type、单位及逐条证据核对；不用变量名称推导定义身份，不为无值变量制造空观测。

事务内同存 Event、Fact 归属、对象/变量/定义采用引用、变量提取、观测、文字评级、不可变消息、消费者投递、文件发布任务、审计和永久提交回执。文件实际生成在事务外恢复。提交响应丢失后按 candidate/proposal_generation 复用回执，同时核对输入摘要及当前来源权限。旧 Fact 和原文不删除。

## 实际执行结果

命令：`node --env-file-if-exists=.env --import tsx --test src/tests/f02-eight-step-commit.test.ts src/tests/f02-migration.test.ts`。

10/10通过，其中A7四项：

- 缺最终批准拒绝；execution_generation=3、proposal_generation=1 能按各自主责完成提交；回执重放不重复建立事件。
- 批准后资料版本变化拒绝提交，原候选 Fact 保留未归组状态。
- 非空已批准 Target、正式 numeric 变量及原文 `75` 的观测同时保存；观测basis保留确切证据身份，三元事实引用完整。
- 注入文件发布任务写入失败，事件、事实归属、评级、变量提取、消息和回执一起回滚；移除故障后重试成功。

全部使用随机临时数据库，不操作真实业务库。A2六项结果见 `f02-migration.md`。

## 边界

REUSE增量、正式评分方法、用途发布规则和真正的人工批准不在本核心函数内实现。关联分析由正式 Event 保存后单独执行。完整运行、模型调用、队列、API与浏览器覆盖由主任务记录，不能由这四项事务测试替代。

## 后续整合验证与修复

新增第5项真实队列测试：取消的当前运行拒绝提交；允许保存后，同事务形成关联和交付两条pg-boss Job；直接执行真实 `deliveries.send` Handler，验证消费者 receipt、投递 received、文件 ready 与消息 completed。

新增 `f02-association-storage.test.ts` 两项数据库测试：关联快照/成员/消息同事务写入，确认丢失时原回执幂等；输入或内容不一致拒绝，历史成员事件变化不改写原快照，撤权后拒绝重放；触发事件缺席、依据过期或消息故障不产生有效快照。

Handler修复：交付调用限定消息的既有reconcile逻辑，保留文件和消费者回执；到期恢复为同一业务运行增加新的dispatch_seq，不重复投递活跃Job；预算耗尽停止自动恢复，人工重试重新登记恢复时点。恢复扫描同时处理文件发布任务。八步候选的Target批准恢复按manifest选择队列，不受进程默认引擎影响。

关联保存先核全部成员及触发事件来源权限再返回历史回执；新快照、消息和交付Job同事务。未连接的结果接收方保持waiting，不能冒充成功采用。

最终专项：`node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/f02-eight-step-commit.test.ts src/tests/f02-association-storage.test.ts src/tests/f02-migration.test.ts`，13/13通过。`npm run typecheck`通过。两份报告表格检查通过。

测试清理仅关闭自己创建的精确数据库连接，等待服务端会话退出后普通DROP；不使用按前缀清库或强制终止连接。曾出现清理阶段连接终止竞态，改为等待自身会话退出后最终专项全部通过。

## 多来源复核入口修复

独立复核发现旧候选GET和Target读取只核主资料来源。新增 `candidateSourcesPermission`，候选与目标结果返回前同时核对主资料及Fact全部采用资料，阻断经旧入口读取副来源引文。Target对象补证及输入按每条证据自己的material_id读取当前资料并复核版本、摘要、码点引文；限定为该候选Fact已采用资料，不能转为任意资料读取。fact_context和模型引用携带全部material_refs，basis_catalog逐条记录真实版本。

`f02-target-multisource.test.ts`先验证两项失败：副来源撤权仍被旧读取放行、合法副来源对象被错误套用主资料版本而拒绝。修复后2/2通过，并在副来源版本变化时明确拒绝。与真实八步Service合跑3/3通过，`npm run typecheck`通过。
