# 来源到事件候选：执行验证记录

后续40条来源扩展与41项测试见[[tools/RiskHot/docs/verification/all-sources|全部信源接入记录]]；本页保留首次单源阶段证据。真实模型配置缺口不变。

> 2026-10-24 · 工程验证 21/21 通过；真实信源前半链路通过；真实模型验收待配置。不能据此签署完整 L0 验收。

输入依据为[[tools/RiskHot/docs/superpowers/specs/2026-10-24-source-to-candidates-design|已批准设计]]；实施契约见[[tools/RiskHot/docs/system-design/04-系统架构设计/04-公共技术契约/来源候选切片实现契约|当前实现映射]]，启动和恢复步骤见[[tools/RiskHot/README|README]]。本次在独立工作树及 `codex/source-candidate-loop` 分支实施，没有合并、推送或导入旧运行数据。

## 1. 本地环境与检查结果

Node 22.22.1、PostgreSQL 18.6、Temporal Server 1.29.0 / TypeScript SDK 1.24.0、Keycloak 26.8.1；依赖由 package-lock 固定。专用 Compose 服务、持久卷、数据库角色与 OIDC realm，全部端口绑定回环地址。工件和私有配置不提交。

实际运行命令：

```sh
npm run setup
npm run setup:identity
npm run setup:temporal
npm run typecheck
npm test
```

类型检查通过。完整测试 **21 项通过、0 失败、0 跳过**，耗时约 42 秒；其中真实 Temporal 重启恢复约 33 秒。测试使用真实本地数据库/身份/编排服务；模型响应来自明确标注的本地受控 HTTP 服务，不能作为真实供应商调用或抽取质量证据。

| 测试文件 | 数量 | 已执行的验证 |
| --- | --- | --- |
| `tests/content.test.ts` | 6 | 40 条清单安全读取、有限同域发现、零值/表格/码点、正文及输入上限、完整空集合/覆盖、伪引用及集合整体拒绝 |
| `tests/storage.test.ts` | 2 | 不可变对象/损坏检测、并发幂等、固定版本与处理复用、候选集合一次接纳 |
| `tests/pipeline.test.ts` | 2 | 实际 HTTP 传输的完整/截断/无效 JSON/错误状态；持久预算、授权窗口、迟到结果围栏 |
| `tests/api.test.ts` | 2 | 真实 OIDC Bearer 及 PKCE 会话、权限/Origin/登出、严格请求/幂等、来源资格、日期和状态筛选、原件读取；数据库角色不能越权写候选/自授权 |
| `tests/review-fixes.test.ts` | 8 | 子进程环境隔离、真实模型数据库角色工件登记、数据库事务前发布恢复、HTTP 剩余预算、排队调用资格、URL 规范化、200 登录/验证拦截、依据绑定的输出复核 |
| `tests/temporal.test.ts` | 1 | 首次 HTTP 503 后杀死 Workflow Worker，重启后从持久 30 秒退避续接；共 2 次调用、2 个候选、只接纳一个集合、完整事件结果仍 pending；IO/Model/Relay 使用部署等效受限角色 |

上述用例不等于所有生产故障组合均已覆盖。当前没有生产负载/容量、安全攻防、跨机文件系统或全故障矩阵的通过证据。

文档检查：本次 20 份新增/修改 Markdown 均通过 `rules/check_markdown_tables.py`；54 处新增 Wiki 链接目标有效，新增内容 UTF-8/替换字符/私用区检查通过，`git diff --check` 通过。根日志中的历史乱码示例保持原样，没有据终端显示改写历史资料。

## 2. 真实中国人民银行公告

用户提供的[[tools/RiskHot/src/data/source-catalog.js|来源主清单]]已导入 40 条元数据；实际连接器只启用 `wiki-source-001`。从[公开市场公告首页](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/index.html)获取首条[官方详情公告](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026102308535522110/index.html)，公开访问无需登录。

先运行 `npm run run:real -- --key first-real-pbc-loop`；完成审查修正并停止/重启本任务全部 Node 子进程后，执行：

```sh
npm run run:real -- --key reviewed-real-pbc-loop
```

API 持久受理、列表发现、真实正文抓取、解析、标准化、版本保存、交付接收及状态查询均已实际执行。CLI 在 waiting_config 退出码为 2，符合当前配置缺失语义。数据库和摘要读取结果：

| 项目 | 实际结果 |
| --- | --- |
| 初次批次 | `8ff33890-94c6-4b4c-9e1d-49b6b5bae34e` |
| 重启后新批次 | `52a57008-c806-42f0-9780-a90b61747ebd` |
| 重启后资料操作 | `d901beb4-a222-4ad4-bbea-29e2c9687e2a` |
| 两次共用的固定资料版本 | `7514f269-e848-4b9a-aecd-09ecb4bd3ab5` |
| 两次共用的 processing | `f5a5022f-eecd-4225-9a9b-280003502916` |
| 标题 / 来源发布时间 | 公开市场业务交易公告 [2026]第205号 / 2026-10-23 |
| 固定原件 | 29,886 字节；SHA-256 `c0f431ac9ccb5093c9b3183fc224787d1e96cccd322988c2a042c6e3d3afb0dc` |
| 固定标准化工件 SHA-256 | `bfee5469facb027f9e6cc60b28debdec455636d3757d588423d7bddfb8fa26dd` |
| 正文与版本复用 | 6 个分段；实际运行库共 1 个资料版本、1 个 processing |
| 当前状态 | slice=waiting_config；child 原因 MODEL_NOT_CONFIGURED；extraction=recoverable；result=pending |
| 候选及模型调用 | candidate_count=null；实际模型尝试=0 |

已检查规范化表格内容为：

```text
期限 | 投标量 | 中标量
7天 | 0亿元 | 0亿元
```

新的资料命令工件包含 actor、connector、parent_operation_id、source_id、source_version、type、url，来源引用可恢复。私有运行快照位于 `.riskhot/runs/<batch_id>.json`；工件可通过受权限保护的版本/raw API 读取，未公开挂载原件目录。

## 3. 独立审查与修复

对完整工程变更做过一次独立代码审查，发现 6 项重要问题，未报告严重或轻微项。统一修复后运行完整测试；每项均先观察针对性用例失败，再验证修复通过：

1. 模型进程工件登记依赖未授予的 UPDATE：改为 INSERT 冲突忽略再 SELECT，以实际受限角色验证。
2. 原件/列表发布后数据库回执提交前的恢复缺口：增加不可变 owner/phase 发布目录和收据；注入事务失败后复用原输入，不重新取变化内容。
3. 排队调用越过预算或资格变化：增加真实发 HTTP 前的一次性领取、来源/操作者/代次/截止复查，以及剩余时间限制和接纳围栏。
4. 等价 URL 产生不同身份：接入、发现和解析统一规范化；同版只保存一次。
5. 200 登录/访问验证页面混入资料：在保留正文容器的情形下仍明确拒绝。
6. 结构/证据错误被普通重试绕过：增加持久 review 状态、当前响应绑定依据、独立复核权限及显式固定输入重试决定。

另外收紧了子进程环境，集成测试采用部署等效数据库角色，避免管理权限掩盖运行权限错误。审查未判断的真实模型质量保留为验收缺口；UI、多站点、定时任务、PDF、正式事件、生产容量及网络隔离不纳入本切片通过结论。

## 4. 验收状态与续接

MVP-02～09 的对应机制已取得上述测试证据；MVP-01 的真实网站获取与保存通过，**真实模型调用和逐候选人工核对未执行**。完整真实业务闭环仍未验收，不将受控模型的两个候选记作真实公告抽取结果。

需要补充模型服务名称、模型名及实际 API 端点，并在私有环境中设置凭据。当前实现的 `openai-chat` 协议仍须对指定服务实际核验；已冻结任务包不会随环境变化改写。对目前尚未冻结模型输入的 processing，可在补齐配置并重启进程后执行：

```sh
npm run run:real -- --watch 52a57008-c806-42f0-9780-a90b61747ebd --retry f5a5022f-eecd-4225-9a9b-280003502916 --reason "模型配置已补齐"
```

届时须记录服务可见版本、任务/输入摘要、实际响应及完成原因，并逐候选检查是否漏抽/误抽、时间语义和原文引用；即使真实样本通过，也不能由单样本推断普遍质量。已有固定版本不会因抽取恢复而重新抓取。
