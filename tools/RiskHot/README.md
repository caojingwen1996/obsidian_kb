# RiskHot

当前阶段为**来源到事件候选的工程实现与验证**。来源清单 40 条均已纳入接入状态管理，26 条已在明确栏目/序列范围内完成真实抓取、标准化与持久化；6 条待补地址，8 条受登录、风控或网络访问限制。逐项范围和证据见[[tools/RiskHot/docs/verification/all-sources|全部信源接入验证记录]]。新增本机 Codex 订阅执行、持久计划和安静异常提醒，当前证据见[[tools/RiskHot/docs/verification/codex-subscription|订阅闭环验证记录]]。

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

`src/data/source-catalog.js` 保留 40 条来源身份与参考元数据，`src/data/source-connections.json` 保存已核验的连接器范围。初始化启用就绪来源；重复初始化保留人工暂停。配置变更生成来源版本，在途操作继续使用受理时版本。不会导入 `source-demo.js` 演示状态或旧 `.data/`。

## 运行全部来源

```sh
npm run sources:run -- --key my-next-source-batch
```

命令逐条报告全部 40 个来源，最多同时推进两个；每条使用独立幂等键。已保存但模型缺配置显示 waiting_config，缺地址/需登录/访问受阻分别显示明确原因，不算采集成功。结果写入 `.riskhot/runs/sources-<timestamp>.json`，有未完成项时退出码为 2。重新开始一轮使用新的 key；同一 key 复用原操作。

可限定来源，例如 `npm run sources:run -- --key my-rate-batch --sources wiki-source-005,wiki-source-021`。单源命令也支持 `npm run run:real -- --source wiki-source-004 --key my-safe-batch`，默认仍为央行。

华尔街见闻使用公开浏览器渲染，在私有环境配置 `SOURCE_BROWSER_EXECUTABLE` 指向独立 Chrome for Testing 或 Chromium；不接受日常 Google Chrome。每次创建临时任务目录并在 finally 关闭/清理，文档和普通子资源请求均按允许范围拦截；当前只需来源域和官方 `static.wscn.net`。这一规则不等同于操作系统或容器级网络隔离。

日期化快照区分观测日、发布日期和列表更新时间；仅采集窗口变化不生成新资料。DR007 只接日终 17:00，FR007 检查实际曲线及收盘口径；不满足时保留原件并明确拒绝。巨潮和披露易当前保存公告索引，不能视为 PDF 正文；中债日评、国债曲线、名义美债和 FRED DPRIME 均按验证记录中的实际范围提供。

## 获取并查询真实公告

保持 `npm run dev` 运行，在另一个终端执行：

```sh
npm run run:real -- --key first-real-pbc-loop
```

默认读取央行公开市场公告列表首页，按站点顺序取最新 1 篇。`--url` 可指定同一公告目录下的详情 URL。命令每 5 秒查询一次，持久快照位于 `.riskhot/runs/<operation_id>.json`。同键同体返回原批次，同键异体返回冲突；不同键同版复用资料版本及 processing。

`waiting_config`、`review`、`recoverable`、`partial` 会以退出码 2 结束轮询，便于发现需要处理的状态；退出轮询不会删除任务。模型缺配置时保留资料，候选数为未知，实际模型尝试为 0。

## 配置模型并续接

订阅模式先运行 `codex login`，然后以 `codex login status` 确认使用 ChatGPT 登录。在私有 `.env` 设置以下非密钥参数：

```dotenv
MODEL_PROTOCOL=codex-exec
MODEL_ENDPOINT=codex://local
MODEL_NAME=gpt-6.1-sol
CODEX_EXECUTABLE=codex
SCHEDULE_ENABLED=true
SCHEDULE_INTERVAL_SECONDS=3600
SCHEDULE_SOURCES=
```

`CODEX_EXECUTABLE` 推荐填本机 `command -v codex` 返回的绝对路径；无需配置 MODEL_API_KEY。Codex 在独立临时目录运行，忽略用户配置并关闭工具，接收固定资料及结构格式。模型别名和 CLI 版本不等于可证明的底层模型权重版本，实际账号权限须由成功调用验证。

HTTP 模式仍可在私有环境设置 `MODEL_PROTOCOL=openai-chat`、完整 Chat Completions `MODEL_ENDPOINT`、`MODEL_NAME`、`MODEL_API_KEY`。请求包含 `max_completion_tokens`，响应须提供单一 `choices[0].message.content` 和 `finish_reason=stop`；具体供应商兼容性须单独核验。

补齐配置后重启 `npm run dev`，使用已有记录输出的批次和 processing 标识恢复：

```sh
npm run run:real -- --watch BATCH_ID --retry PROCESSING_ID --reason "模型配置已补齐"
```

恢复读取原固定资料与任务输入，不重新抓取。每个预算窗口最多 3 次、10 分钟；普通重试不增加额度。已耗尽时，具备 `model_budget` 权限的操作员可追加 `--open-budget true`，累计尝试仍保留。结构或证据错误进入 `review`，须先通过带当前依据摘要的授权复核；普通重试和追加预算均不能越过复核。

### 后台计划与异常提醒

启用 SCHEDULE_ENABLED 后，scheduler 每 30 秒推进持久计划；默认每小时检查每个已启用且就绪来源的最新 1 条，最多 2 条在途，模型串行。SCHEDULE_SOURCES 留空选择全部就绪来源，也可填写逗号分隔的来源 key。首次创建计划安排在一个周期之后；暂停来源不继续提交，休眠后不补齐每一个漏掉的小时。该有限栏目检查不是全站或全历史同步。

已有尚未冻结输入的 MODEL_NOT_CONFIGURED 资料会优先自动续接；已冻结的 HTTP 任务不随环境改为订阅。订阅额度不足暂停整个执行通道至少 6 小时，登录失效保持暂停直到检查成功。临时故障的自动预算恢复每个 processing 每 24 小时最多 1 个窗口，保留累计尝试及专用身份审计；复核和业务资格错误不会自动放行。

正常开始、完成、无新资料均不通知。异常按问题持续期去重，恢复后关闭；再次发生可提醒。本机系统通知只含固定文案，通知交付失败最多重试 3 次；状态 submitted 只说明已提交系统，不证明用户看到（受系统通知权限和专注模式影响）。服务自身退出另保留私有本地故障记录，避免数据库不可用时丢失提醒。

使用当前工作树专属 LaunchAgent 常驻运行；安装前先停止同目录手工运行的 dev：

```sh
npm run service -- install
npm run service -- status
npm run monitor
```

修改私有环境后用 `npm run service -- restart` 请求平稳重启；重复 install 会复用已加载服务。`npm run service -- uninstall` 停止并移除本项目专属常驻配置，保留数据。登录后自动启动、异常退出重启；电脑需开机联网，Docker 与依赖服务须可用。当前不自动启动 Docker Desktop 或阻止电脑休眠。日志为 `.riskhot/logs/`；服务级异常记录在 `.riskhot/service-alert.json`。

## 查询与操作接口

除健康检查和登录入口外均需真实 OIDC Bearer 身份或登录会话；会话写请求还需同源 `Origin`。业务写入需 `Idempotency-Key`。精确请求体和错误码见实现契约及 `src/runtime/server.ts`。

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/m1/sources`、`PATCH /api/v1/m1/sources/:key` | 查看授权来源、连接器就绪原因和最新批次结果，启停并保留配置版本 |
| `POST /api/v1/l0/source-fetches` | 持久受理获取，返回 202 和 operation_id |
| `GET /api/v1/l0/runs?from=2026-10-24&to=2026-10-24&status=waiting_config` | 按上海日期范围和派生状态筛选，最多 100 批次 |
| `GET /api/v1/l0/operations/:id` | 批次及子资料状态、原因、资料和 processing 引用 |
| `GET /api/v1/l0/processings/:id`、`GET /api/v1/l0/candidates/:id` | 抽取状态、尝试、预算、候选与固定版本证据 |
| `GET /api/v1/l0/versions/:id`、`GET /api/v1/l0/versions/:id/raw` | 标准化资料与受权限保护的原件下载 |
| `POST /api/v1/l0/operations/:id/retry`、`POST /api/v1/l0/processings/:id/retry` | 从原检查点恢复获取或抽取 |
| `POST /api/v1/l0/processings/:id/reviews` | 按固定依据复核无效输出，只允许再次尝试固定输入 |
| `GET /api/v1/l0/monitor` | 授权来源的计划、最近运行、未解除异常和通知交付状态 |

测试需要上述本地 PostgreSQL、Keycloak 和 Temporal。`npm test` 使用隔离测试数据库/命名空间及明确标注的受控模型 HTTP 服务，包含真实 Worker 重启验证；测试通过不能替代真实模型质量验收。

## 设计入口

- [系统总体技术架构 V0.7](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/01-%E7%B3%BB%E7%BB%9F%E6%80%BB%E4%BD%93%E6%8A%80%E6%9C%AF%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1.md)：全系统十四章架构、运行与部署视图、质量与追踪，以及 L0 详细设计导航。
- [独立技术选型与设计基线](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/05-%E6%9E%B6%E6%9E%84%E6%B2%BB%E7%90%86%E4%B8%8E%E9%AA%8C%E8%AF%81/%E6%9E%B6%E6%9E%84%E5%86%B3%E7%AD%96%E8%AE%B0%E5%BD%95/ADR-L0-002-%E7%8B%AC%E7%AB%8B%E6%8A%80%E6%9C%AF%E9%80%89%E5%9E%8B%E4%B8%8E%E8%AE%BE%E8%AE%A1%E5%9F%BA%E7%BA%BF.md)：从业务要求比较方案，明确选择、代价与适用条件。
- [L0 最小业务闭环验证方案](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/05-%E6%9E%B6%E6%9E%84%E6%B2%BB%E7%90%86%E4%B8%8E%E9%AA%8C%E8%AF%81/%E6%9E%B6%E6%9E%84%E9%AA%8C%E8%AF%81/L0%E6%9C%80%E5%B0%8F%E4%B8%9A%E5%8A%A1%E9%97%AD%E7%8E%AF%E9%AA%8C%E8%AF%81%E6%96%B9%E6%A1%88.md)：多候选、无事件、幂等、原文追溯及模型故障隔离；运行验收全部待执行。
- [项目文档索引](index.md)：业务架构、功能设计、提示词与 UI 原型。

## 保留内容与边界

`docs/` 保存业务、功能、架构及 UI 原型；`aihot/` 保存参考资料与旧设计归档；项目技能和 BMAD 资料保留。`.data/` 是保留的旧运行数据，不自动导入新环境。旧架构清单、工作包、开发报告和场景报告均是历史记录，不作为新系统已实现或验收通过的证明。

旧应用恢复副本位于 `/Users/cjw/.codex/backups/RiskHot-code-removal-20261024-123733`，其中 recovery-manifest.json 记录逐文件摘要。本目录的新工程依据已批准设计建立独立数据库、工件和身份环境。当前不包含 PDF/OCR、AI-02～05、正式事件提交或产品页面对接。
