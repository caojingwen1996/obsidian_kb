# RiskHot 系统场景验证测试案例 V1.0

状态：可执行场景与本次真实结果。开始时间：2026-10-12T02:03:59.572Z；完成时间：2026-10-12T02:04:10.749Z。

## 1. 验证结论与范围

本次共 46 个场景：**46 通过、0 失败、0 未执行**；进程退出码 0。结果来自 Node 测试运行器输出，未按文档预期填写。

关联 34/51 项功能需求、54 个验收编号。**关联不等于整项需求或整条 AC 全部通过**：例如 HTTP 导出测试不替代浏览器可访问性验收，命令层计划幂等不替代 Temporal 恢复演练，人工结构化判断不替代真实模型金融语义评测。只有用例中明确断言的行为有自动化证据。

依据：[业务功能需求规格](../03-业务功能需求/RiskHot_系统业务功能需求规格说明书_V1.0.md)、[系统架构设计](../04-系统架构设计/RiskHot_系统架构设计_V1.0.md)、[命令契约](../packages/contracts/commands.json)。

## 2. 环境与执行

后端采用真实 PostgreSQL，本套数据库固定为本机 `riskhot_test`。测试前检查连接 URL 及数据库实际名称；拒绝开发库 `riskhot` 或任何远端地址。每个场景重新准备账号、配置及业务资料，不依赖场景执行顺序。原文使用 example.invalid 定位符，不访问网络；密码是隔离环境专用测试夹具。

`pnpm report:scenarios` 运行全部场景并重写此文档与结果工件。直接运行测试可用：

`node --import tsx --test --test-concurrency=1 tests/scenarios/*.test.ts`

需要本地 PostgreSQL 可连接且项目依赖已安装；不要将 TEST_DATABASE_URL 指向开发或生产数据库。HTTP 场景使用 Fastify inject，覆盖真实请求校验、认证、CSRF、领域命令及数据库，但没有模拟浏览器渲染。

结果工件：[JSON](scenario-results.json)、[原始 TAP](scenario-results.tap.txt)。失败时进程返回非零；用例未产出结果会标记 NOT_RUN，不推算为成功。

## 3. 场景总览

| 场景 | 本次状态 | 关联需求 | 名称 |
| --- | --- | --- | --- |
| SC-001 | PASS | FR-OPS-04 | 测试数据库防误清理 |
| SC-002 | PASS | FR-OPS-02 | 幂等重试复用结果，同键异载荷拒绝 |
| SC-003 | PASS | FR-OPS-01 | 越权写入与管理员越权审核均拒绝 |
| SC-004 | PASS | FR-CFG-01、FR-CFG-06 | 配置类型边界、批准后不可改与停用后新引用拒绝 |
| SC-005 | PASS | FR-L0-03 | 原文三次重复和同URL修订保留旧值 |
| SC-006 | PASS | FR-L0-01 | 信源未准入或停用禁止新录入，历史不丢失 |
| SC-007 | PASS | FR-L0-04、FR-L0-06 | 事件允许有对象无变量，拒绝捏造原文引用 |
| SC-008 | PASS | FR-L0-07 | 同一事件公告到实施追加增量，重复不追加 |
| SC-009 | PASS | FR-L0-05、FR-L0-07 | 仅新增来源不生成实质进展通知 |
| SC-010 | PASS | FR-CFG-04 | 指标批量导入保留空值、逐行失败且重试不重复 |
| SC-011 | PASS | FR-CFG-05、FR-L0-08 | 未批准M规则保留空分，不能自动纳管 |
| SC-012 | PASS | FR-L1-02、FR-L1-03、FR-L1-04 | 完整候选先匹配再纳管，代码解析为真实配置ID |
| SC-013 | PASS | FR-L1-04、FR-CFG-01 | 未确认变量及越界观察对象不能纳管 |
| SC-014 | PASS | FR-L1-06 | 风险关联和候选均拒绝跨事件更新ID |
| SC-015 | PASS | FR-L1-03、FR-L1-04 | 并发同身份纳管最多创建一个正式风险 |
| SC-016 | PASS | FR-L1-07、FR-PUB-02 | 关闭恢复保留原风险ID与首次纳管时间 |
| SC-017 | PASS | FR-L1-06、FR-L2-02 | 后续进展不改首次关联ID，观察仍能读到新证据 |
| SC-018 | PASS | FR-L2-02、FR-L2-12、FR-OPS-04 | 证据截止隔离后发修订，显式追溯另行标记 |
| SC-019 | PASS | FR-L2-01、FR-L2-08、FR-L2-09 | 首次观察不得stable或shortening，合法未知可以批准 |
| SC-020 | PASS | FR-L2-12、FR-OPS-02 | 技术阶段缺项不能提交，合法业务未知不等于失败 |
| SC-021 | PASS | FR-OPS-02、FR-L2-12 | 取消任务后旧代次不能批准且原草稿保留 |
| SC-022 | PASS | FR-OPS-01 | 发起人撤权后已排队结果不能正式提交 |
| SC-023 | PASS | FR-L1-05、FR-L1-07、FR-L2-12 | 运行中暂停及定义变化阻止旧分析正式提交 |
| SC-024 | PASS | FR-PUB-02、FR-L2-12 | 旧截止运行不冒充最新，显式追溯也不改变最新选择 |
| SC-025 | PASS | FR-L2-09、FR-L2-11 | 同等级可以减弱，未设节点规则不能确认节点 |
| SC-026 | PASS | FR-PUB-03 | 最新等级空值不能回取历史高等级排序 |
| SC-027 | PASS | FR-PUB-06、FR-PUB-07、FR-OPS-04 | 报告固定引用、禁止篡改结构化判断且重复发布只出刊一次 |
| SC-028 | PASS | FR-PUB-06、FR-PUB-07 | 报告发布前上游撤回必须阻断，撤回后可另建修订 |
| SC-029 | PASS | FR-PUB-05、FR-PUB-06 | 空期报告可说明覆盖不足但不编造无风险 |
| SC-030 | PASS | FR-OPS-03、FR-OPS-04 | 乐观并发拒绝旧版覆盖并保留审计 |
| SC-031 | PASS | FR-OPS-05 | 同计划窗口幂等且停用不再受理新窗口 |
| SC-032 | PASS | FR-OPS-02、FR-OPS-04 | 重算生成新运行并保留原固定输入 |
| SC-033 | PASS | FR-OPS-01 | 首次初始化只允许一次且登录不泄露密码摘要 |
| SC-034 | PASS | FR-OPS-01 | 匿名、CSRF缺失及额外契约字段均被HTTP边界拒绝 |
| SC-035 | PASS | FR-OPS-01、FR-PUB-07 | 阅读者不能写入或读取内部原文，研究员不能发布 |
| SC-036 | PASS | FR-OPS-01 | 撤权后旧登录会话立即失效 |
| SC-037 | PASS | FR-PUB-08 | 已发布报告两种导出保留版本截止和固定引用 |
| SC-038 | PASS | FR-PUB-07、FR-PUB-08 | 撤回报告的列表直达与导出均不提供正文 |
| SC-039 | PASS | FR-OPS-02 | HTTP同键重放返回同一结果并拒绝同键内容变化 |
| SC-040 | PASS | FR-OPS-01、FR-OPS-04 | 阅读者不能利用列表和分析清单绕过原文权限 |
| SC-041 | PASS | FR-L0-07、FR-L2-02 | 仅来源补充进入观察证据，但不越过历史截止 |
| SC-042 | PASS | FR-OPS-03、FR-L2-12、FR-PUB-07 | 复核退回驳回推进领域状态，过期决定和正式记录拒绝 |
| SC-043 | PASS | FR-OPS-01 | 原文权限过滤先于搜索，避免检索命中泄露隐藏内容 |
| SC-044 | PASS | FR-PUB-07、FR-OPS-04 | 撤回后的旧命令回执不能重新暴露报告正文 |
| SC-045 | PASS | FR-L2-02、FR-L2-08 | 迟到的历史批准不能越过比较基准截止边界 |
| SC-046 | PASS | FR-L2-12、FR-OPS-02 | 技术失败任务即使草稿完整也不能批准 |

## 4. 详细案例

### SC-001 测试数据库防误清理

- 关联需求：FR-OPS-04。
- 关联验收：测试环境隔离专项；无对应业务 AC。
- 前置数据：本机专用 riskhot_test；无需业务资料。
- 操作：分别传入开发库 URL、远端 URL，并查询当前数据库名。
- 期望：拒绝非本机专用测试库；真实连接名为 riskhot_test。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-001` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-002 幂等重试复用结果，同键异载荷拒绝

- 关联需求：FR-OPS-02。
- 关联验收：AC-OPS-02-1。
- 前置数据：研究员和一个合法变量草稿请求。
- 操作：同幂等键提交同内容两次，再提交不同内容。
- 期望：前两次返回同 ID；内容冲突返回 IDEMPOTENCY_CONFLICT；仅一条变量。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-002` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-003 越权写入与管理员越权审核均拒绝

- 关联需求：FR-OPS-01。
- 关联验收：AC-OPS-01-1、AC-OPS-01-3。
- 前置数据：分别只有 reader、admin 角色的账号。
- 操作：阅读者写配置；管理员批准研究员草稿。
- 期望：两次服务端拒绝；草稿状态不变。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-003` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-004 配置类型边界、批准后不可改与停用后新引用拒绝

- 关联需求：FR-CFG-01、FR-CFG-06。
- 关联验收：AC-CFG-01-2、AC-CFG-01-3。
- 前置数据：已批准的宏观对象、变量、信源。
- 操作：新建 company；修改已批准变量；停用对象后创建事件。
- 期望：越界对象、直接改生效版、新引用停用对象均拒绝；原对象仍可查询。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-004` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-005 原文三次重复和同URL修订保留旧值

- 关联需求：FR-L0-03。
- 关联验收：AC-L0-03-1、AC-L0-03-2。
- 前置数据：已准入的单一信源和同一原始 URL。
- 操作：三次录入政策利率2%；后来录入修订3%。
- 期望：重复复用原 ID；修订新 ID 指向旧版；旧正文2%仍在。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-005` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-006 信源未准入或停用禁止新录入，历史不丢失

- 关联需求：FR-L0-01。
- 关联验收：AC-L0-01-1、AC-L0-01-2。
- 前置数据：已准入信源及一份历史原文；另一信源未审核。
- 操作：停用后新增原文；从未审核信源新增原文。
- 期望：两次均拒绝；历史原文可读且内容不变。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-006` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-007 事件允许有对象无变量，拒绝捏造原文引用

- 关联需求：FR-L0-04、FR-L0-06。
- 关联验收：AC-L0-06-3。
- 前置数据：原文、已批准对象；不提供变量。
- 操作：保存对象无变量事件；另填原文不存在的引用。
- 期望：第一事件成功且变量列表为空；假引用拒绝，无半成品事件。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-007` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-008 同一事件公告到实施追加增量，重复不追加

- 关联需求：FR-L0-07。
- 关联验收：AC-L0-07-2、AC-L0-07-3、AC-L0-07-4。
- 前置数据：已宣布、计划将来实施的政策事件。
- 操作：时间推进一周而不补资料，再录实施证据并重交同增量。
- 期望：仅时间流逝状态不变；实施追加同一事件更新；重交不增加更新。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-008` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-009 仅新增来源不生成实质进展通知

- 关联需求：FR-L0-05、FR-L0-07。
- 关联验收：AC-L0-05-1、AC-L0-07-1。
- 前置数据：一条已有政策事件与两个已准入信源。
- 操作：第二来源以 SOURCE_ADDITION 确认归入已有事件。
- 期望：一个 Event、两个来源、一条 EventUpdate；不新增实质进展通知。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-009` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-010 指标批量导入保留空值、逐行失败且重试不重复

- 关联需求：FR-CFG-04。
- 关联验收：AC-CFG-04-2。
- 前置数据：指标单位为%；10行数据含2行不同单位和1行明确空值。
- 操作：导入整批并重复导入。
- 期望：8成功2失败；重复复用；空值保留为 null 而非0。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-010` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-011 未批准M规则保留空分，不能自动纳管

- 关联需求：FR-CFG-05、FR-L0-08。
- 关联验收：AC-CFG-05-1、AC-L0-08-1、AC-L0-08-3。
- 前置数据：事件存在，未批准M规则。
- 操作：按明确范围和期限提交人工金融意义评价。
- 期望：score=null、状态draft；不产生正式风险。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-011` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-012 完整候选先匹配再纳管，代码解析为真实配置ID

- 关联需求：FR-L1-02、FR-L1-03、FR-L1-04。
- 关联验收：AC-L1-04-1。
- 前置数据：对象、变量、宏观风险源、维度及事件均有效。
- 操作：创建完整候选、确认new并纳管，再重试纳管。
- 期望：只有一个正式风险；代码解析为配置ID；候选无预分配risk_id；首次纳管时间可查。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-012` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-013 未确认变量及越界观察对象不能纳管

- 关联需求：FR-L1-04、FR-CFG-01。
- 关联验收：AC-L1-04-3、AC-CFG-01-2。
- 前置数据：一项变量未确认的完整候选，以及economic_sector对象。
- 操作：尝试纳管未确认变量；尝试以经济部门作为L1观察对象。
- 期望：明确拒绝原因；候选保留且没有正式风险。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-013` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-014 风险关联和候选均拒绝跨事件更新ID

- 关联需求：FR-L1-06。
- 关联验收：AC-L1-06-2。
- 前置数据：两个不同事件及各自更新；一项正式风险。
- 操作：直接关联及候选入口均使用另一个事件的update_id。
- 期望：两条入口均以UPDATE_MISMATCH拒绝错误引用。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-014` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-015 并发同身份纳管最多创建一个正式风险

- 关联需求：FR-L1-03、FR-L1-04。
- 关联验收：AC-L1-04-2。
- 前置数据：两份definition、对象与scope相同的候选，均已完成匹配。
- 操作：并发执行两个纳管命令。
- 期望：至少一项成功；数据库最多一个正式风险，不因并发重复身份。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-015` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-016 关闭恢复保留原风险ID与首次纳管时间

- 关联需求：FR-L1-07、FR-PUB-02。
- 关联验收：AC-L1-07-2。
- 前置数据：一项已纳管风险。
- 操作：关闭，时间推进一天，人工审核恢复monitoring。
- 期望：ID及原admitted_at不变，单独记录restored_at；不新建风险。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-016` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-017 后续进展不改首次关联ID，观察仍能读到新证据

- 关联需求：FR-L1-06、FR-L2-02。
- 关联验收：AC-L1-06-1、AC-L1-06-3、AC-L2-02-1。
- 前置数据：已纳管风险已有事件首次关联。
- 操作：追加实施更新、重复关联，并发起观察。
- 期望：只有一条业务关系，首次event_update_id不变；输入证据含初始与进展两份原文。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-017` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-018 证据截止隔离后发修订，显式追溯另行标记

- 关联需求：FR-L2-02、FR-L2-12、FR-OPS-04。
- 关联验收：AC-L2-02-2。
- 前置数据：T1已有原文、风险与固定任务；T2补采纠正。
- 操作：以T1普通复核及显式hindsight再运行。
- 期望：普通包和旧包不含后发修订；追溯包包含且显式标记事后资料。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-018` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-019 首次观察不得stable或shortening，合法未知可以批准

- 关联需求：FR-L2-01、FR-L2-08、FR-L2-09。
- 关联验收：AC-L2-01-1、AC-L2-09-1。
- 前置数据：新风险无历史快照，具备完整人工分析。
- 操作：尝试首次trend=stable；再以undetermined完成审核。
- 期望：stable被拒绝；合法业务未知可批准，风险等级仍可为null。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-019` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-020 技术阶段缺项不能提交，合法业务未知不等于失败

- 关联需求：FR-L2-12、FR-OPS-02。
- 关联验收：AC-L2-12-2。
- 前置数据：已有一项正式快照；新任务只有trend技术阶段失败。
- 操作：保存新草稿并提交审核。
- 期望：提交INCOMPLETE_ANALYSIS；草稿保留，产品当前结果仍为旧正式快照。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-020` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-021 取消任务后旧代次不能批准且原草稿保留

- 关联需求：FR-OPS-02、FR-L2-12。
- 关联验收：AC-OPS-02-3。
- 前置数据：任务已生成待审核分析。
- 操作：取消任务后批准原待审核结果。
- 期望：提交资格/代次失效；不产生批准结果，已有待审核记录保留。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-021` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-022 发起人撤权后已排队结果不能正式提交

- 关联需求：FR-OPS-01。
- 关联验收：AC-OPS-01-2。
- 前置数据：研究员发起分析并提交；审核员会话仍正常。
- 操作：管理员禁用任务发起人，审核员尝试批准已排队分析。
- 期望：最终提交再次校验发起人授权并拒绝，避免借审核员绕过撤权。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-022` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-023 运行中暂停及定义变化阻止旧分析正式提交

- 关联需求：FR-L1-05、FR-L1-07、FR-L2-12。
- 关联验收：AC-L1-05-1。
- 前置数据：待审核分析固定风险定义版本。
- 操作：运行中暂停后批准；恢复后修改机制再批准。
- 期望：分别返回TRACKING_CHANGED、DEFINITION_CHANGED；旧输出不成为当前结论。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-023` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-024 旧截止运行不冒充最新，显式追溯也不改变最新选择

- 关联需求：FR-PUB-02、FR-L2-12。
- 关联验收：AC-PUB-02-3。
- 前置数据：旧截止任务尚未批准，新截止任务已批准。
- 操作：延迟批准旧任务；显式追溯旧截止并批准。
- 期望：普通旧任务STALE_RUN；追溯可保存，但最新仍按snapshot_time选择较新快照。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-024` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-025 同等级可以减弱，未设节点规则不能确认节点

- 关联需求：FR-L2-09、FR-L2-11。
- 关联验收：AC-L2-09-2、AC-L2-11-1、AC-L2-11-2。
- 前置数据：测试等级规则已批准，前后均high；第二次有可比基准。
- 操作：尝试无节点规则confirmed，再以easing且节点待判断批准。
- 期望：无规则确认被阻止；同级方向可减弱且不自动确认节点。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-025` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-026 最新等级空值不能回取历史高等级排序

- 关联需求：FR-PUB-03。
- 关联验收：AC-PUB-03-3。
- 前置数据：前一快照high，后一快照等级待判断。
- 操作：查询风险产品投影。
- 期望：选择后一快照；severity为空且显示等级待判断，不回取旧高等级。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-026` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-027 报告固定引用、禁止篡改结构化判断且重复发布只出刊一次

- 关联需求：FR-PUB-06、FR-PUB-07、FR-OPS-04。
- 关联验收：AC-PUB-06-3、AC-PUB-07-1、AC-OPS-04-2。
- 前置数据：一份已批准快照及固定报告草稿。
- 操作：篡改报告引用内的趋势；正常发布两次；上游再新增快照。
- 期望：判断篡改拒绝；一次发布事件；固定快照ID/版本不随上游变化。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-027` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-028 报告发布前上游撤回必须阻断，撤回后可另建修订

- 关联需求：FR-PUB-06、FR-PUB-07。
- 关联验收：AC-PUB-06-3。
- 前置数据：报告已提交，引用快照仍可独立撤回。
- 操作：先撤回快照，再发布报告。
- 期望：REFERENCE_WITHDRAWN阻止发布；报告保持submitted。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-028` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-029 空期报告可说明覆盖不足但不编造无风险

- 关联需求：FR-PUB-05、FR-PUB-06。
- 关联验收：AC-PUB-05-4、AC-PUB-06-2。
- 前置数据：报告期内有新风险但无已批准快照。
- 操作：生成日报草稿。
- 期望：条目为新纳管待评估、快照为空；不虚构等级或无风险结论。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-029` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-030 乐观并发拒绝旧版覆盖并保留审计

- 关联需求：FR-OPS-03、FR-OPS-04。
- 关联验收：AC-OPS-03-3。
- 前置数据：两位操作者持有同一配置草稿旧版本。
- 操作：成功修改一次后以旧expected_version再改。
- 期望：VERSION_CONFLICT拒绝覆盖；只保存两版，成功修改有审计。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-030` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-031 同计划窗口幂等且停用不再受理新窗口

- 关联需求：FR-OPS-05。
- 关联验收：AC-OPS-05-1、AC-OPS-05-2。
- 前置数据：管理员创建默认停用的本机测试计划。
- 操作：启用后同run_key补跑两次；停用后新窗口补跑。
- 期望：窗口请求复用；停用后不受理新任务。仅验证计划命令，不等于时钟恢复演练。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-031` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-032 重算生成新运行并保留原固定输入

- 关联需求：FR-OPS-02、FR-OPS-04。
- 关联验收：AC-OPS-04-3。
- 前置数据：已固定输入的观察任务。
- 操作：提出有理由的重算。
- 期望：新任务ID及recompute_of，原证据包和旧任务数据不变。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-032` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-033 首次初始化只允许一次且登录不泄露密码摘要

- 关联需求：FR-OPS-01。
- 关联验收：AC-OPS-01-1。
- 前置数据：空的专用测试库及强测试密码。
- 操作：HTTP首次初始化、再次初始化、正确及错误密码登录。
- 期望：只创建一个初始管理员；错误密码401；会话HttpOnly；响应无密码摘要。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-033` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-034 匿名、CSRF缺失及额外契约字段均被HTTP边界拒绝

- 关联需求：FR-OPS-01。
- 关联验收：AC-OPS-01-1。
- 前置数据：有效研究员会话及变量保存契约。
- 操作：匿名调用、缺CSRF调用、额外bypass_approval字段调用。
- 期望：分别鉴权/CSRF/Schema拒绝；数据库不新增变量。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-034` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-035 阅读者不能写入或读取内部原文，研究员不能发布

- 关联需求：FR-OPS-01、FR-PUB-07。
- 关联验收：AC-OPS-01-1、AC-PUB-07-4。
- 前置数据：已发布报告、内部原文、阅读者和研究员会话。
- 操作：阅读者写配置及读取原文，研究员发布报告。
- 期望：均403，无原文泄露或越权发布。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-035` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-036 撤权后旧登录会话立即失效

- 关联需求：FR-OPS-01。
- 关联验收：AC-OPS-01-2。
- 前置数据：审核员已登录。
- 操作：管理员禁用账号，旧会话继续写配置。
- 期望：401/403，数据库无写入；无需等待会话自然到期。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-036` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-037 已发布报告两种导出保留版本截止和固定引用

- 关联需求：FR-PUB-08。
- 关联验收：AC-PUB-08-1、AC-PUB-08-2。
- 前置数据：带固定快照引用的已发布报告。
- 操作：阅读者导出Markdown和可打印HTML。
- 期望：两者含报告ID、快照ID、数据截止；无内部原文和密码摘要。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-037` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-038 撤回报告的列表直达与导出均不提供正文

- 关联需求：FR-PUB-07、FR-PUB-08。
- 关联验收：AC-PUB-07-2、AC-PUB-08-3。
- 前置数据：阅读者持有曾发布报告直达地址。
- 操作：撤回后读列表、直达、两种导出。
- 期望：正文不再暴露；直达可见撤回说明；下载拒绝。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-038` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-039 HTTP同键重放返回同一结果并拒绝同键内容变化

- 关联需求：FR-OPS-02。
- 关联验收：AC-OPS-02-1。
- 前置数据：研究员会话和固定幂等键。
- 操作：通过HTTP同键同载荷两次、同键异载荷一次。
- 期望：同结果ID；异载荷409；边界没有丢失幂等语义。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-039` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-040 阅读者不能利用列表和分析清单绕过原文权限

- 关联需求：FR-OPS-01、FR-OPS-04。
- 关联验收：AC-OPS-01-1。
- 前置数据：阅读者没有evidence_access；正式快照内有固定原文清单。
- 操作：读取原文列表与分析快照详情。
- 期望：任何列表或嵌套manifest均不泄露原文content；公开分析仍可读。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-040` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-041 仅来源补充进入观察证据，但不越过历史截止

- 关联需求：FR-L0-07、FR-L2-02。
- 关联验收：AC-L0-07-1、AC-L2-02-2。
- 前置数据：已纳管风险及第一信源；截止后另一信源补充相同事件。
- 操作：SOURCE_ADDITION后分别发起当前观察和旧截止观察。
- 期望：当前包含两个出处；旧截止不含新取得的出处；没有新增实质进展。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-041` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-042 复核退回驳回推进领域状态，过期决定和正式记录拒绝

- 关联需求：FR-OPS-03、FR-L2-12、FR-PUB-07。
- 关联验收：AC-OPS-03-3。
- 前置数据：分析和报告均已提交待审核。
- 操作：复核退回、旧版本再决定、重新提交后驳回；尝试退回正式分析。
- 期望：退回恢复draft、驳回进入rejected；旧版409；正式分析拒绝退回且保持approved。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-042` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-043 原文权限过滤先于搜索，避免检索命中泄露隐藏内容

- 关联需求：FR-OPS-01。
- 关联验收：AC-OPS-01-1。
- 前置数据：原文有仅隐藏证据包包含的稀有标记；公开判断不包含该词。
- 操作：阅读者及有原文权限的研究员分别搜索该标记。
- 期望：阅读者零命中；研究员可以找到风险；查询匹配先应用权限过滤。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-043` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-044 撤回后的旧命令回执不能重新暴露报告正文

- 关联需求：FR-PUB-07、FR-OPS-04。
- 关联验收：AC-PUB-07-2。
- 前置数据：已发布报告且操作者持有旧发布请求键。
- 操作：撤回后重放旧发布请求。
- 期望：返回当前撤回元数据，不通过幂等回执泄露旧正文。
- 自动化：[tests/scenarios/http.test.ts](../tests/scenarios/http.test.ts)；测试名以 `SC-044` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-045 迟到的历史批准不能越过比较基准截止边界

- 关联需求：FR-L2-02、FR-L2-08。
- 关联验收：AC-L2-02-2。
- 前置数据：早期观察到后续时间才批准。
- 操作：以中间截止时间观察，并显式选择该早期快照作基准。
- 期望：默认基准为空；显式选择拒绝，防止迟到批准形成未来信息。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-045` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

### SC-046 技术失败任务即使草稿完整也不能批准

- 关联需求：FR-L2-12、FR-OPS-02。
- 关联验收：AC-L2-12-1。
- 前置数据：研究内容完整且已提交，执行任务随后技术失败。
- 操作：请求正式批准。
- 期望：COMMIT_REVOKED，草稿内容保留但未生成正式快照。
- 自动化：[tests/scenarios/business.test.ts](../tests/scenarios/business.test.ts)；测试名以 `SC-046` 开头。
- 实际状态：**PASS**，以本次执行记录为准。

## 5. 覆盖差距与生产验收

未关联独立自动化场景的 FR：FR-CFG-02、FR-CFG-03、FR-L0-02、FR-L0-09、FR-L0-10、FR-L1-01、FR-L1-08、FR-L2-03、FR-L2-04、FR-L2-05、FR-L2-06、FR-L2-07、FR-L2-10、FR-L2-13、FR-PUB-01、FR-PUB-04、FR-OPS-06。这些编号不应因为相邻流程通过而标记通过。

以下项目没有由本测试套件证明，应作为独立验收保留：

| 项目 | 当前证据边界 | 后续验收 |
| --- | --- | --- |
| 真实模型与语义质量 | 本套固定人工 JSON；验证结构和业务硬约束 | 真实供应商拒绝、截断、限流、引用和语义盲评；D-12 阈值获批 |
| 分阶段 Agent 分析 | 判断来源/缓冲/损害/力量字段由人工夹具提供 | 公告不等于效果、局部不等于整体、时间流逝不等于持续性缩短等对抗样本 |
| Temporal 重试、恢复与升级 | 本套只验证任务命令、代次和提交资格 | Worker 杀进程、重复交付、执行历史 replay、版本切换、响应未知情况 |
| 浏览器真实操作 | 本套使用HTTP注入，无浏览器渲染 | 完整登录到报告流程、表单错误、键盘操作、窄屏和撤回缓存 |
| 异步采集与批次 | 本套人工原文录入及指标批量导入 | 正式来源适配、附件定位、子项部分失败、缺正文和补采恢复 |
| 复核中心和影响传播 | 本套验证部分领域决定与版本冲突 | 认领/转派/退回后的流程恢复；修订原文对既有快照/报告的影响队列 |
| 灾备和性能 | 本套隔离数据库功能测试 | 需求 NFR 容量、P95、RPO/RTO；备份恢复、对象工件一致性及权限配置 |
| OIDC与生产凭据 | 本地账号与Cookie权限路径 | 外部身份提供者、TLS/代理配置、凭据轮换与部署检查 |

架构场景 AT-03、06、07、08、09、14 有对应局部工程证据；AT-01、02、04、05、10—13、15—16 不因本套通过而视为全量验收。尤其 AT-09 尚需真实浏览器缓存路径；AT-08 的不可比历史仍需补充语义样本。

## 6. impl-validator 核验

| 检查 | 判定 | 证据 |
| --- | --- | --- |
| 真实执行记录 | PASS | 原始 TAP 与进程退出码；46/46 通过 |
| 案例可定位 | PASS | 场景 ID 对应测试文件及真实测试名 |
| 不污染开发库 | PASS | 连接 URL 白名单与 current_database 双校验；SC-001 |
| 不扩大测试结论 | WARN | 只报告已执行硬约束，生产、AI、浏览器和耐久运行另有验收项 |

总体：**WARN**。全部自动化通过也只代表本套范围通过，不能代替需求第16.4节与架构第20.3节的系统上线验收。
