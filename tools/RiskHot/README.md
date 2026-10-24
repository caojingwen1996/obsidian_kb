# RiskHot

当前阶段为**来源到事件候选的工程实现与验证**。已提供中国人民银行公开公告连接器、标准化、AI-01 抽取执行、持久化、授权 API 和命令式状态监测。真实公告已保存；真实模型服务、模型名及凭据尚未配置，因此完整真实链路验收仍待执行。

本次实现遵循[[tools/RiskHot/docs/superpowers/specs/2026-10-24-source-to-candidates-design|用户已批准设计]]；当前接口与存储以[[tools/RiskHot/docs/system-design/04-系统架构设计/04-公共技术契约/来源候选切片实现契约|来源候选切片实现契约]]为准，证据见[[tools/RiskHot/docs/verification/source-candidates|执行验证记录]]。候选保存后保持 `pending`，不生成正式事件。

## 启动本地环境

需要 Node.js 22、npm 和 Docker Compose；端口 55432、7238、18080、18081 须可用。所有命令在本项目目录执行。首次安装和初始化：

```sh
npm ci
npm run init:env
docker compose up -d postgres identity
npm run setup
docker compose up -d temporal
npm run setup:identity
npm run setup:temporal
npm run typecheck
npm test
npm run dev
```

数据库健康后再执行 `setup`；身份服务和 Temporal 首次启动需要时间，若初始化报连接未就绪，等待服务启动后重跑对应的 `setup:identity` 或 `setup:temporal`。初始化命令可以重复执行。`init:env` 生成随机本地凭据并保留已有 `.env`，不输出值；`.env`、`.riskhot/` 和依赖目录均被忽略。身份初始化只针对专用本地 realm，显式授予本地 operator 权限。

API 为 [localhost:18081](http://localhost:18081)，登录入口为 `/auth/login`；账号与密码从本地 `.env` 的 `OPERATOR_USERNAME`、`OPERATOR_PASSWORD` 读取。`/health/ready` 仅报告 API 的数据库/工件可用性与模型配置标记，不能据此判断整条链路完成。运行日志在 `.riskhot/logs/`。在运行终端按 Ctrl-C 停止本任务进程；`docker compose stop` 停止本任务依赖服务，保留数据卷。

`src/data/source-catalog.js` 的 40 条来源元数据会被导入；当前只为 `wiki-source-001` 配置真实连接器并启用，其余条目不表示已接入。不会导入 `source-demo.js` 演示状态或旧 `.data/`。

## 获取并查询真实公告

保持 `npm run dev` 运行，在另一个终端执行：

```sh
npm run run:real -- --key first-real-pbc-loop
```

默认读取央行公开市场公告列表首页，按站点顺序取最新 1 篇。`--url` 可指定同一公告目录下的详情 URL。命令每 5 秒查询一次，持久快照位于 `.riskhot/runs/<operation_id>.json`。同键同体返回原批次，同键异体返回冲突；不同键同版复用资料版本及 processing。

`waiting_config`、`review`、`recoverable`、`partial` 会以退出码 2 结束轮询，便于发现需要处理的状态；退出轮询不会删除任务。模型缺配置时保留资料，候选数为未知，实际模型尝试为 0。

## 配置模型并续接

请在私有 `.env` 或启动环境中设置 `MODEL_PROTOCOL`、`MODEL_ENDPOINT`、`MODEL_NAME`、`MODEL_API_KEY`，不要把密钥写入文档或聊天。当前适配协议为 `openai-chat`，端点必须是完整 Chat Completions URL；请求包含 `max_completion_tokens`，响应须提供 `choices[0].message.content` 和 `finish_reason=stop`。这只是协议名称，具体供应商是否兼容仍须按实际服务核验；其他协议需要增加适配。

补齐配置后重启 `npm run dev`，使用已有记录输出的批次和 processing 标识恢复：

```sh
npm run run:real -- --watch BATCH_ID --retry PROCESSING_ID --reason "模型配置已补齐"
```

恢复读取原固定资料与任务输入，不重新抓取。每个预算窗口最多 3 次、10 分钟；普通重试不增加额度。已耗尽时，具备 `model_budget` 权限的操作员可追加 `--open-budget true`，累计尝试仍保留。结构或证据错误进入 `review`，须先通过带当前依据摘要的授权复核；普通重试和追加预算均不能越过复核。

## 查询与操作接口

除健康检查和登录入口外均需真实 OIDC Bearer 身份或登录会话；会话写请求还需同源 `Origin`。业务写入需 `Idempotency-Key`。精确请求体和错误码见实现契约及 `src/runtime/server.ts`。

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/m1/sources`、`PATCH /api/v1/m1/sources/:key` | 查看授权来源，启停并保留配置版本 |
| `POST /api/v1/l0/source-fetches` | 持久受理获取，返回 202 和 operation_id |
| `GET /api/v1/l0/runs?from=2026-10-24&to=2026-10-24&status=waiting_config` | 按上海日期范围和派生状态筛选，最多 100 批次 |
| `GET /api/v1/l0/operations/:id` | 批次及子资料状态、原因、资料和 processing 引用 |
| `GET /api/v1/l0/processings/:id`、`GET /api/v1/l0/candidates/:id` | 抽取状态、尝试、预算、候选与固定版本证据 |
| `GET /api/v1/l0/versions/:id`、`GET /api/v1/l0/versions/:id/raw` | 标准化资料与受权限保护的原件下载 |
| `POST /api/v1/l0/operations/:id/retry`、`POST /api/v1/l0/processings/:id/retry` | 从原检查点恢复获取或抽取 |
| `POST /api/v1/l0/processings/:id/reviews` | 按固定依据复核无效输出，只允许再次尝试固定输入 |

测试需要上述本地 PostgreSQL、Keycloak 和 Temporal。`npm test` 使用隔离测试数据库/命名空间及明确标注的受控模型 HTTP 服务，包含真实 Worker 重启验证；测试通过不能替代真实模型质量验收。

## 设计入口

- [系统总体技术架构 V0.7](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/01-%E7%B3%BB%E7%BB%9F%E6%80%BB%E4%BD%93%E6%8A%80%E6%9C%AF%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1.md)：全系统十四章架构、运行与部署视图、质量与追踪，以及 L0 详细设计导航。
- [独立技术选型与设计基线](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/05-%E6%9E%B6%E6%9E%84%E6%B2%BB%E7%90%86%E4%B8%8E%E9%AA%8C%E8%AF%81/%E6%9E%B6%E6%9E%84%E5%86%B3%E7%AD%96%E8%AE%B0%E5%BD%95/ADR-L0-002-%E7%8B%AC%E7%AB%8B%E6%8A%80%E6%9C%AF%E9%80%89%E5%9E%8B%E4%B8%8E%E8%AE%BE%E8%AE%A1%E5%9F%BA%E7%BA%BF.md)：从业务要求比较方案，明确选择、代价与适用条件。
- [L0 最小业务闭环验证方案](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/05-%E6%9E%B6%E6%9E%84%E6%B2%BB%E7%90%86%E4%B8%8E%E9%AA%8C%E8%AF%81/%E6%9E%B6%E6%9E%84%E9%AA%8C%E8%AF%81/L0%E6%9C%80%E5%B0%8F%E4%B8%9A%E5%8A%A1%E9%97%AD%E7%8E%AF%E9%AA%8C%E8%AF%81%E6%96%B9%E6%A1%88.md)：多候选、无事件、幂等、原文追溯及模型故障隔离；运行验收全部待执行。
- [项目文档索引](index.md)：业务架构、功能设计、提示词与 UI 原型。

## 保留内容与边界

`docs/` 保存业务、功能、架构及 UI 原型；`aihot/` 保存参考资料与旧设计归档；项目技能和 BMAD 资料保留。`.data/` 是保留的旧运行数据，不自动导入新环境。旧架构清单、工作包、开发报告和场景报告均是历史记录，不作为新系统已实现或验收通过的证明。

旧应用恢复副本位于 `/Users/cjw/.codex/backups/RiskHot-code-removal-20261024-123733`，其中 recovery-manifest.json 记录逐文件摘要。本目录的新工程依据已批准设计建立独立数据库、工件和身份环境。当前不包含多站点、定时采集、PDF/OCR、AI-02～05、正式事件提交或产品页面对接。
