# RiskHot

当前阶段为**来源接入与事件处理的工程实现及分阶段验证**。来源清单 40 条均已纳入接入状态管理，26 条已在明确栏目/序列范围内完成真实抓取、标准化与持久化；6 条待补地址，8 条受登录、风控或网络访问限制。逐项范围和证据见[[tools/RiskHot/docs/verification/all-sources|全部信源接入验证记录]]。新增本机 Codex 订阅执行、持久计划和安静异常提醒，当前证据见[[tools/RiskHot/docs/verification/codex-subscription|订阅闭环验证记录]]。

本次实现遵循[[tools/RiskHot/docs/superpowers/specs/2026-10-24-source-to-candidates-design|用户已批准设计]]；当前接口与存储以[[tools/RiskHot/docs/system-design/04-系统架构设计/04-公共技术契约/来源候选切片实现契约|来源候选切片实现契约]]为准，证据见[[tools/RiskHot/docs/verification/source-candidates|执行验证记录]]。旧 EXTRACTION_ONLY 切片的候选保存后保持 `pending`；完整事件模式在 `/events` 独立推进，按身份与最终内容复核后才提交。

M1 实际管理页面已按[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/02. 交互原型说明|现行交互原型]]接入真实服务，支持信源档案、接入任务和计划管理。代码和本机后台均使用 `main`；最新验证见[[tools/RiskHot/docs/verification/m1-management|M1 实现与运行记录]]。

## 代码目录

工程代码统一在 `src/` 下维护：

```text
src/
  data/       信源清单与连接配置
  db/         数据库建库 SQL
  information-ingestion/  信息采集
    sources/     信源目录与连接配置
    processing/  获取、解析、标准化与候选抽取
  event-management/  完整事件：归组、关系、增量、评价、复核、提交与交付
  platform/   身份、存储、权限与通知
  runtime/    API、工作流与调度进程
  web/        M1 管理页面与真实接口调用
  scripts/    启动、初始化和操作命令
  tests/      自动化测试及辅助代码
```

`information-ingestion/` 组织从信源配置到候选入库的业务流程；`sources/` 对应 M1，`processing/` 对应当前 L0 候选处理切片。已有接口和持久化标识继续使用架构编号。

`package.json`、`tsconfig.json`、`compose.yaml` 和环境配置保留在项目根目录；命令仍在项目根目录执行。`docs/` 内的设计原型与 `aihot/` 内的参考快照保持各自的资料归属。

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

API 为 [localhost:18081](http://localhost:18081)，本机默认 `AUTH_MODE=local`，无需账号密码或登录服务。`/health/ready` 仅报告 API 的数据库/工件可用性与模型配置标记，不能据此判断整条链路完成。运行日志在 `.riskhot/logs/`。在运行终端按 Ctrl-C 停止本任务进程；`docker compose stop` 停止本任务依赖服务，保留数据卷。

仅运行本机免登录工作台时，可跳过上述 identity 容器与 `setup:identity`；完整回归仍测试可选 OIDC 模式，需要这两步。设置 `AUTH_MODE=oidc` 可启用账号模式，使用私有 `.env` 的 `OPERATOR_USERNAME`、`OPERATOR_PASSWORD`。本机免登录以固定本地操作员保留权限与审计，服务仅绑定回环地址；写请求继续验证同源。

## 使用 M1 管理页面

直接打开 [M1 信源管理中心](http://localhost:18081/m1)，无需登录。保持使用 `localhost`，请求按配置地址及同源规则校验。现有常驻服务运行目录是 `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot`；已安装时直接打开页面即可。

1. **信源目录**：按名称、发布主体或编号搜索，组合等级、专题、渠道、维度等筛选；详情内查看档案、技术资格、资料引用和历史版本。新增默认停用；编辑与启停均记录操作者及版本。
2. **开启任务**：无进行中的手动任务时，在信源详情或任务页点击即可运行当前有操作权限的全部已启用信源，无需重新配置。排队、运行和暂停期间开启入口保持锁定；顶部持续展示真实进度、查看进度及暂停／继续，本轮结束后恢复开启。状态不受列表筛选影响，刷新页面仍可恢复；断网时保留进度并等待重新确认。运行中每5秒更新，无进行中任务时每15秒更新，减少动态效果模式停止动画。沿用既有连接配置，每源读取最新1条；暂不可采集的启用信源在批次中说明原因。任务页按上海日期查询；概览只随日期变化，编号和状态过滤只影响列表。保存数量只统计已确认资料。
3. **查看结果、暂停与继续**：在任务行点“查看结果”原地展开信源结果，直接查看资料与抽取；六步进度按需展开。任务行保留暂停/继续，刷新页面后仍保留。继续沿原检查点推进，保留原计划时间、已保存资料和失败结果；失败、待复核等结果在执行记录中单独处置。
4. **任务计划**：按信源设置周期数值、单位（分钟／小时／天）和启停，例如30分钟、2小时、1天；有效范围仍为1分钟至1天。已有计划自动显示合适单位。停用信源、暂停计划和暂停某次任务分别保存；暂停计划控制后续周期，已启动批次单独管理。

任务计划默认显示已配置项，通过“未配置”添加计划。计划行的“查看结果”直达最近一次接入结果，“运行记录”在原行展开历史；资料和候选阅读支持返回。页面组织见[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/信息接入任务与计划页面设计|信息接入任务与计划页面设计]]。

提交后若响应丢失，页面保留原请求和回执查询/重试入口，使用同一幂等键，不应另开一个重复批次。可选账号模式保留登录失效草稿恢复及只读用户控制；本机模式不显示登录、退出入口。

业务启用不等于采集就绪。新增档案还需发布主体、身份依据和允许采集范围；自定义来源没有自动连接器配置入口，技术资格未就绪时不能开启自动采集。清单缺失的分类显示待补，6条缺地址仍待补充。资料引用来自真实保存记录；M2 指标绑定尚未接入，显示不可用，数量未知。

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

本机默认自动使用本地操作员，无需令牌；检查回环连接、配置 Host 及写入同源 `Origin`。可选 OIDC 模式使用真实 Bearer 身份或登录会话。所有业务写入仍需 `Idempotency-Key`。精确请求体和错误码见实现契约及 `src/runtime/server.ts`。

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/session` | 当前身份、权限与来源范围 |
| `GET /api/v1/m1/sources`、`PATCH /api/v1/m1/sources/:key` | 查看授权来源、连接器就绪原因和最新批次结果，启停并保留配置版本 |
| `POST /api/v1/m1/sources`、`PUT /api/v1/m1/sources/:key` | 创建默认停用档案、按预期版本修订 |
| `GET /api/v1/m1/sources/:key/history`、`GET /api/v1/m1/sources/:key/relations` | 版本审计与实际资料引用；M2 引用明确返回不可用 |
| `GET /api/v1/l0/task-batches`、`POST /api/v1/l0/task-batches` | 查询时间批次及日期概览、开启多信源批次 |
| `POST /api/v1/l0/task-batches/:id/control` | 按当前版本暂停或继续批次 |
| `PATCH /api/v1/l0/schedules/:key` | 独立管理后续采集计划 |
| `GET /api/v1/l0/schedules/:key/runs` | 授权信源最近最多50条计划运行、实际状态及保存数量 |
| `POST /api/v1/l0/source-fetches` | 持久受理获取，返回 202 和 operation_id |
| `GET /api/v1/l0/runs?from=2026-10-24&to=2026-10-24&status=waiting_config` | 按上海日期范围和派生状态筛选，最多 100 批次 |
| `GET /api/v1/l0/operations/:id` | 批次及子资料状态、原因、资料和 processing 引用 |
| `GET /api/v1/l0/processings/:id`、`GET /api/v1/l0/candidates/:id` | 抽取状态、尝试、预算、候选与固定版本证据 |
| `GET /api/v1/l0/versions/:id`、`GET /api/v1/l0/versions/:id/raw` | 标准化资料与受权限保护的原件下载 |
| `POST /api/v1/l0/operations/:id/retry`、`POST /api/v1/l0/processings/:id/retry` | 从原检查点恢复获取或抽取 |
| `POST /api/v1/l0/processings/:id/reviews` | 按固定依据复核无效输出，只允许再次尝试固定输入 |
| `GET /api/v1/l0/monitor` | 授权来源的计划、最近运行、未解除异常和通知交付状态 |

测试需要上述本地 PostgreSQL、Keycloak 和 Temporal。`npm test` 使用隔离测试数据库/命名空间及明确标注的受控模型 HTTP 服务，包含真实 Worker 重启验证；测试通过不能替代真实模型质量验收。

浏览器专项位于 `src/tests/browser.e2e.ts`，设置 `PLAYWRIGHT_MODULE` 为本机 Playwright 模块绝对路径，`SOURCE_BROWSER_EXECUTABLE` 指向独立 Chrome for Testing/Chromium 后执行 `node --env-file=.env --import tsx src/tests/browser.e2e.ts`。检查使用独立测试数据及临时浏览器目录，结束自动关闭；不调用真实网站或订阅模型。

## 设计入口

- [系统总体技术架构 V0.7](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/01-%E7%B3%BB%E7%BB%9F%E6%80%BB%E4%BD%93%E6%8A%80%E6%9C%AF%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1.md)：全系统十四章架构、运行与部署视图、质量与追踪，以及 L0 详细设计导航。
- [独立技术选型与设计基线](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/05-%E6%9E%B6%E6%9E%84%E6%B2%BB%E7%90%86%E4%B8%8E%E9%AA%8C%E8%AF%81/%E6%9E%B6%E6%9E%84%E5%86%B3%E7%AD%96%E8%AE%B0%E5%BD%95/ADR-L0-002-%E7%8B%AC%E7%AB%8B%E6%8A%80%E6%9C%AF%E9%80%89%E5%9E%8B%E4%B8%8E%E8%AE%BE%E8%AE%A1%E5%9F%BA%E7%BA%BF.md)：从业务要求比较方案，明确选择、代价与适用条件。
- [L0 最小业务闭环验证方案](docs/system-design/04-%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/05-%E6%9E%B6%E6%9E%84%E6%B2%BB%E7%90%86%E4%B8%8E%E9%AA%8C%E8%AF%81/%E6%9E%B6%E6%9E%84%E9%AA%8C%E8%AF%81/L0%E6%9C%80%E5%B0%8F%E4%B8%9A%E5%8A%A1%E9%97%AD%E7%8E%AF%E9%AA%8C%E8%AF%81%E6%96%B9%E6%A1%88.md)：多候选、无事件、幂等、原文追溯及模型故障隔离；运行验收全部待执行。
- [项目文档索引](index.md)：业务架构、功能设计、提示词与 UI 原型。

## 保留内容与边界

`docs/` 保存业务、功能、架构及 UI 原型；`aihot/` 保存参考资料与旧设计归档；项目技能和 BMAD 资料保留。`.data/` 是保留的旧运行数据，不自动导入新环境。旧架构清单、工作包、开发报告和场景报告均是历史记录，不作为新系统已实现或验收通过的证明。

旧应用恢复副本位于 `/Users/cjw/.codex/backups/RiskHot-code-removal-20261024-123733`，其中 recovery-manifest.json 记录逐文件摘要。本目录的新工程依据已批准设计建立独立数据库、工件和身份环境。当前未包含 PDF/OCR、完整 M2/M3 实际管理服务或全量历史同步。AI-02～05、正式提交及可靠交付已实现并完成受控验证，真实验收当前停在 Step 2 身份复核。


## 标准化资料交付与候选文件

信息接入任务展开信源后，点击“交付状态与文件”，或进入“查看资料”。页面分别显示资料保存、F02 接收和候选抽取状态；接收不等于抽取完成。已具备的文件提供下载，抽取失败时数量为待确认。

文件保存在既有 ARTIFACT_ROOT 下：`handoffs/f01-f02/<消息ID>/information.json` 为固定版本交付资料，`receipt.json` 为固定接收回执，`analyses/<处理ID>/candidates.json` 为完整候选结果。文件内容也登记在摘要工件库中；原件只引用 F01 已保存对象。候选文件包含稳定身份、版本化证据、覆盖清单、警告和无事件原因。

“重新交付”只补发原消息，“重新生成文件”只修复文件；模型失败沿用“重试固定资料”。交付和文件窗口各最多 10 次，失败间隔 30 秒，耗尽后需带理由恢复；均不消耗模型调用窗口。历史来源依据不足时进入待核对，不能使用当前配置或导出时间补齐。

只读验收命令：`node --env-file=.env --import tsx src/scripts/verify-handoff.ts --operation <接入操作ID>`。它核对落盘文件与下载字节、接收/版本身份、完整候选及真实 Codex 尝试和下游读取依据；失败退出非零。可附加 `--since <ISO时间>` 限定本次真实模型尝试。

上述既有文件维持 EXTRACTION_ONLY 语义；完整模式另建 INITIAL，不覆盖旧候选或原文件。后续步骤与页面见下节。


## 完整事件处理

打开 [事件工作区](http://localhost:18081/events)，或从 M1 已接收资料进入“处理为正式事件”。已有 INITIAL 时直接查看当前任务，不重复开启。首次选择已登记定义快照、评价范围与期限。新环境需由管理员明确登记定义读取范围并分配事件业务权限，不能把外部 M2 未接入当作空字典。本机已登记项目范围快照，缺定义项继续保留。

候选页展示 Step 2～7、原文、逐步结果及待保存内容。身份复核使用 event_review 权限，最终保存使用 event_commit；非事件处置、恢复与重算分别授权。当前未发布自动通过政策，身份与最终保存是两项业务复核。技术恢复保持原输入与方法，新预算需显式授权，历史次数不清零。

完整模式只使用本机 Codex 订阅，范围与期限为非空文本对象；方法未批准时只有文字评价、空 M、draft。正式事件提供不可变修订、时间轴、直接关系、评价历史和下载。交付区分持久接收、顺序应用与缺口，event-audit 不是 F03/F05 风险分析。

文件在 ARTIFACT_ROOT：`events/processings/<处理ID>/candidates.json`、`events/candidates/<候选ID>/generations/<代次>/steps/<步骤>/proposal.json` 和 `commit.json`；正式结果是 `events/<事件ID>/revisions/<修订>/event.json`，事件交付及回执在 `handoffs/f02-events/<消息ID>/`。业务、文件、模型与交付恢复各自独立。

升级：`node --env-file=.env --import tsx src/scripts/migrate-events.ts --target runtime`，随后 `npm run service -- restart`。只读验收：`node --env-file=.env --import tsx src/scripts/verify-events.ts --processing <完整处理ID>`；未完成或证据不一致会退出非零。

本轮180项测试、事件浏览器14项、原M1浏览器53项通过。真实人民银行任务已得到两条候选和两份AI-02建议，当前等待身份复核，尚无真实正式事件与事件交付。详见[[tools/RiskHot/docs/verification/f02-events|实施与验证报告]]。
