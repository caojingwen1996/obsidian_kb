# RiskHot

当前阶段为**来源接入与事件处理的工程实现及分阶段验证**。来源清单 40 条均已纳入接入状态管理；既有验证确认26条具备有限栏目/序列的抓取能力，6条待补地址，8条受登录、风控或网络限制。这些是连接器历史验证范围，不代表重建后已有采集资料。逐项范围和证据见[[tools/RiskHot/docs/verification/all-sources|全部信源接入验证记录]]。新增本机 Codex 订阅执行、持久计划和安静异常提醒，当前证据见[[tools/RiskHot/docs/verification/codex-subscription|订阅闭环验证记录]]。

现行工程按[[tools/RiskHot/docs/superpowers/specs/2026-10-29-f01-material-migration|F01迁移规格]]与[[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F01信息接入模块数据模型与存储设计|F01数据模型]]实现。资料、单信源任务和候选使用schema5；早期切片报告只保留历史证据。

M1 实际管理页面已按[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/02. 交互原型说明|现行交互原型]]接入真实服务，顶部采用“信源目录／信息采集任务／事件处理任务”三个工作区，其中事件处理任务为用户指定的空白预留页；信息采集任务下依次为“任务计划设置／手动发起采集／任务执行记录”，原顶部手动任务已移入子分组。信源目录仅管理档案与分类。侧栏为不可折叠的“内容 → 全部”“配置 → 信源管理中心／流水线全景”，仅显示已实现入口。代码和本机后台均使用 `main`；最新验证见[[tools/RiskHot/docs/verification/m1-management|M1 实现与运行记录]]及[[tools/RiskHot/docs/verification/pipeline-panorama|流水线全景验证记录]]。

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
  web/        M1 管理、事件阅读、流水线全景及同源接口调用
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
npm run setup:dependencies
docker compose up -d temporal
npm run setup:identity
npm run setup:temporal
npm run typecheck
npm run setup:test
npm test
npm run dev
```

数据库健康后再执行 `setup`；身份服务和 Temporal 首次启动需要时间，若初始化报连接未就绪，等待服务启动后重跑对应的 `setup:identity` 或 `setup:temporal`。应用 `setup` 可以重复执行且不清空新资料；它不再初始化共享测试库或Temporal数据库。`setup:dependencies`仅用于首次准备Temporal专用身份与数据库，`setup:test`显式准备独立旧回归测试库，均不属于日常应用初始化。`init:env` 生成随机本地凭据并保留已有 `.env`，不输出值；`.env`、`.riskhot/` 和依赖目录均被忽略。身份初始化只针对专用本地 realm，显式授予本地 operator 权限。

API 为 [localhost:18081](http://localhost:18081)，本机默认 `AUTH_MODE=local`，无需账号密码或登录服务。`/health/ready` 仅报告 API 的数据库/工件可用性与模型配置标记，不能据此判断整条链路完成。运行日志在 `.riskhot/logs/`。在运行终端按 Ctrl-C 停止本任务进程；`docker compose stop` 停止本任务依赖服务，保留数据卷。

仅运行本机免登录工作台时，可跳过上述 identity 容器与 `setup:identity`；完整回归仍测试可选 OIDC 模式，需要这两步。设置 `AUTH_MODE=oidc` 可启用账号模式，使用私有 `.env` 的 `OPERATOR_USERNAME`、`OPERATOR_PASSWORD`。本机免登录以固定本地操作员保留权限与审计，服务仅绑定回环地址；写请求继续验证同源。

## 使用流水线全景

从左侧“配置 → 流水线全景”进入，或直接打开[流水线全景](http://localhost:18081/pipeline)。L0～L3默认展开，F01～F08默认收起；点击节点查看详情，点击后继定位对应步骤。手机详情提供“返回当前步骤”。AI节点提供四个信息标签及有来源的提示词折叠区，“查看AI任务”打开固定版本的只读资料，返回时保留全景开合与阅读位置。

全景展示115个业务定义节点，不表示下游模块已经实现运行。流程出口只用于阅读定位，来源文档可直接打开；任务引用版本与提示词草案版本分别显示。页面实现及原型适配范围见[[tools/RiskHot/docs/verification/pipeline-panorama|全景工程验证]]。

流水线页面每次打开或刷新时，服务端自动读取已登记提示词文档的最新正文、标题、版本及状态，不再使用生成的正文副本。修改这些内容后直接刷新页面即可，无需运行同步命令或重启服务；已打开页面不会后台轮询。文档缺失、格式错误或任务编号不匹配时，对应提示词显示读取失败，不回退到旧正文，修复文档后刷新恢复。此过程只读取展示资料，不修改、发布或执行 AI 任务包，固定任务版本保持独立。

第 3 节支持单个 `text` 或 `markdown` 代码块；正文含 JSON 围栏时，外层使用四个反引号，内部标题及 JSON 会完整保留。新增、删除、重命名提示词文档或修改 `task_id` 时，仍需运行 `npm run pipeline:sync` 更新来源登记；流程图及固定任务定义的调整也沿用该命令。`npm run pipeline:check` 检查生成数据和来源登记，不再因已登记提示词的正文、版本或状态修改而要求同步。

基础验证为 `npm run test:pipeline`。F02 八步流程浏览器专项为 `npm run test:pipeline:f02`，沿用下述独立浏览器与 Playwright 环境配置；默认启动临时只读页面，指定 `PIPELINE_VERIFY_ORIGIN` 可核对本机正在运行的页面。自动读取浏览器专项设置既有 `SOURCE_BROWSER_EXECUTABLE`、`PLAYWRIGHT_MODULE` 后运行 `node --env-file-if-exists=.env --import tsx src/tests/pipeline-live-prompts.e2e.ts`；全景浏览器回归仍使用 `npm run test:pipeline:browser`。仅使用独立 Chrome for Testing／Chromium 和隔离测试目录。

## 使用 M1 管理页面

直接打开 [M1 信源管理中心](http://localhost:18081/m1)，无需登录。保持使用 `localhost`，请求按配置地址及同源规则校验。现有常驻服务运行目录是 `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot`；已安装时直接打开页面即可。

1. **信源目录**：搜索名称、编号或分组，按信源等级筛选；等级与分组独立显示；可切换全部、信源等级、日常监测、专题研究，分层分组支持展开／收起并保留选择。专题研究固定保留钱的数量、钱的价格、钱的流向，未维护分类的来源显示为待分类，不自动引用原型示例。登记、编辑与启停使用当前档案及更新时间校验，不再建立配置历史或信源版本。
2. **手动发起采集**：在信息采集任务的同名分组中，选择有权限且启用的信源，每个信源分别创建一个独立信息采集任务；同一操作重试复用原幂等键。每源默认取最新1条。
3. **任务执行记录**：在信息采集任务的同名分组中查看自动与手动任务、状态、保存结果和当前资料正文。暂停／继续通过任务代际阻止旧执行写入；恢复沿原任务入口推进。资料显示当前内容，修订后版本字段递增，不提供旧正文回放。
4. **任务计划设置**：从“信息采集任务”进入“任务计划设置”（#intake-tasks?view=plans），计划页高亮信息采集任务，旧地址自动跳转；每行可直接启用／暂停计划，填写数值并选择分钟／小时／天后点击“保存周期”，并查看任务执行记录。信源目录不展示任务内容。每源一份计划，周期1分钟至1天。业务停用、计划暂停和本轮暂停分别生效。本次保留信源补建的计划统一一天且停用；未来新增默认一小时且停用，需明确启用。

5. **资料与事件**：资料保存和下游可读确认后采集完成，模型异常另行显示。正文页查看候选并启动事件处理，在候选页复核归组、必要的直接关系和最终保存内容；正式事件在“内容 → 全部”阅读。

信源金融属性独立存储在m1.sources.financial_attributes（文本数组），可在“编辑档案 → 金融属性”维护钱的数量、钱的价格、钱的流向，支持多值；空数组表示未分类。已接入增量初始化，详见[[tools/RiskHot/docs/verification/source-financial-attributes|字段与迁移验证]]。

结果未知时先按原操作重试，不能另建新键重复提交。本机免登录使用固定本地操作员；账号模式保留同源与权限校验。业务启用不等于连接器就绪，自定义信源仍需配置受允许的连接器范围。

`src/data/source-catalog.js` 保存来源身份及参考分类，`src/data/source-connections.json` 保存连接器范围；重复初始化不覆盖人工维护档案。连接器是运行参数，不是信源配置版本。旧`#material/<资料ID>`可读取当前资料；已取消的版本、接入操作、处理记录、任务批次ID返回已重置，不重新解释为新对象。

## 运行全部来源

```sh
npm run sources:run -- --key my-next-source-batch
```

命令逐条报告全部 40 个来源，最多同时推进两个；每条使用独立幂等键。缺地址、需登录或访问受阻分别显示原因；模型未配置不反转已经完成的采集，需从资料页继续候选抽取。schema5输出task_id及material资料身份，结果写入 `.riskhot/runs/sources-<timestamp>.json`，有未完成项时退出码为2。重新开始一轮使用新的 key；同一 key 复用原操作。

可限定来源，例如 `npm run sources:run -- --key my-rate-batch --sources wiki-source-005,wiki-source-021`。单源命令也支持 `npm run run:real -- --source wiki-source-004 --key my-safe-batch`，默认仍为央行。

华尔街见闻使用公开浏览器渲染，在私有环境配置 `SOURCE_BROWSER_EXECUTABLE` 指向独立 Chrome for Testing 或 Chromium；不接受日常 Google Chrome。每次创建临时任务目录并在 finally 关闭/清理，文档和普通子资源请求均按允许范围拦截；当前只需来源域和官方 `static.wscn.net`。这一规则不等同于操作系统或容器级网络隔离。

日期化快照区分观测日、发布日期和列表更新时间；仅采集窗口变化不生成新资料。DR007 只接日终 17:00，FR007 检查实际曲线及收盘口径；不满足时明确拒绝，不保存独立原件。巨潮和披露易当前保存公告索引，不能视为 PDF 正文；中债日评、国债曲线、名义美债和 FRED DPRIME 均按验证记录中的实际范围提供。

## 获取并查询真实公告

保持 `npm run dev` 运行，在另一个终端执行：

```sh
npm run run:real -- --key first-real-pbc-loop
```

默认读取央行公开市场公告列表首页，按站点顺序取最新 1 篇。`--url` 可指定同一公告目录下的详情 URL。命令每 5 秒查询一次，当前查询结果位于 `.riskhot/runs/<task_id>.json`。同键同体返回原任务，同键异体返回冲突；不同任务遇到同内容复用material及版本字段，不另建版本表。

`review`、`recoverable`、`partial`、`blocked`、`failed`以退出码2结束轮询；退出查询不会删除任务。完成只表示采集和资料可读，不表示候选或正式事件已经完成。

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

补齐配置后重启 `npm run dev`，使用已有输出的任务和资料标识恢复候选抽取：

```sh
npm run run:real -- --watch TASK_ID --retry MATERIAL_ID --reason "模型配置已补齐"
```

恢复核对当前资料版本与摘要，旧依据不能读取成新版正文。每个预算窗口最多 3 次、10 分钟；普通重试不增加额度。已耗尽时，具备 `model_budget` 权限的操作员可追加 `--open-budget true`，累计尝试仍保留。结构或证据错误进入 `review`，须先通过带当前依据摘要的授权复核；普通重试和追加预算均不能越过复核。

### 后台计划与异常提醒

启用SCHEDULE_ENABLED后，scheduler每30秒检查到期且已启用的计划，最多同时推进两个单信源采集任务。SCHEDULE_SOURCES可限定信源；实际周期以各计划保存的值为准，休眠后不逐次补齐漏掉的时点。

模型异常从资料或候选页按当前依据授权恢复；每个预算窗口最多3次、10分钟，同版普通重试不会刷新额度。新正文有独立初始预算。需要复核的结果不能由普通重试越过；追加预算仍须model_budget权限。

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
| `GET /api/v1/l0/task-batches`、`POST /api/v1/l0/task-batches` | 统一查询执行与日期／信源概览（source限定来源、batch限定本轮任务、trigger=manual限定手动批次）、开启多信源批次 |
| `GET /api/v1/l0/task-overview` | 每源独立计划的当前执行与最近结果，不受历史筛选和100条上限影响 |
| `GET /api/v1/l0/task-batches/:id` | 读取独立任务详情及各信源采集信息；旧信源根执行ID解析到所属手动任务 |
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

旧应用恢复副本位于 `/Users/cjw/.codex/backups/RiskHot-code-removal-20261024-123733`，其中 recovery-manifest.json 记录逐文件摘要。本目录的新工程依据已批准设计建立独立数据库、工件和身份环境。当前未包含 PDF/OCR、完整 M2/M3 实际管理服务或全量历史同步。AI-02～05、正式提交及可靠交付已实现并完成受控验证，第一条真实候选已完成正式保存与交付验收，整份资料仍部分完成。


## 资料与完整事件处理

schema5只保存material当前标准化正文和当前片段；原件、版本表、资料接入、获取、分析与交付四类独立记录已退出。采集完成后F02直接按 `(material_id, version, content_digest)` 读取并校验资料，不另建资料交付包。模型审计保存输入引用，调用时临时读取正文；旧证据保留必要引文，资料变化后必须重新核验。

从资料页启动事件处理；首次选择已登记定义范围、评价范围与期限。初始化登记 `riskhot-local-formal-inventory-20261027-v1`，来自此前已确认的本地正式定义范围；它不代表外部M2字典为空。其他定义集由管理员明确登记，不能凭模型输出制造正式定义ID。

候选处理沿用归组、关系、增量、文字评价、人工复核与最终保存。身份复核使用event_review，最终保存使用event_commit；未决关系须独立复核。正式事件保留Fact、引文、直接关系和评价；可靠事件消息及文件仍归公共执行能力，不是被取消的资料交付记录。

新模型验证、实际切换结果及限制见[[tools/RiskHot/docs/verification/ingestion-migration|迁移验证记录]]。[[tools/RiskHot/docs/verification/fact-model|schema4 Fact验收]]与[[tools/RiskHot/docs/verification/f02-events|早期F02验收]]保留历史证据，不代表清库后仍有这些业务数据。

### F01 schema5工程迁移状态

本机已于2026-10-29切换schema5，保留40条信源原字段与ID，重建其余应用表。实际央行采集保存1份资料并成功抽取2个候选；正式事件仍待人工复核。23项新模型集成、10组浏览器及真实Temporal链路通过。`npm run migrate:ingestion` 仅输出只读预检；显式重建需要先静默应用并核对无活动旧工作流，保留信源补建计划为一天且停用，未来新增默认一小时。应用setup已与共享测试库分离；完整回归的既有提示词引用问题单独记录。完整证据与交接事项见[[tools/RiskHot/docs/verification/ingestion-migration|迁移验证记录]]。

### AI-07 Target 同一性判断

新包 `f02-target-identity-v3` 已接入逐Object判断，旧页面默认继续使用 `f02-fact-draft-v2`。启动接口显式传入新task_manifest_id后，在Event身份批准后通过授权接口补证：

- `GET /api/v1/l0/candidates/:id/targets` 查看对象及运行结果。
- `POST .../targets/objects` 提交 `{generation, objects:{objects:[TargetObject], explicit_no_objects:false, reason}}`。
- `POST .../targets/approve` 提交 `{run_id, review_digest, reason}`，仅接受可核定的NEW/REUSE。

写操作需原登录会话、event_review权限及唯一 `idempotency-key`。generation取proposal_generation；TargetObject字段及原文定位要求见[[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F02-事件管理/AI任务技术详细设计/AI-07-Target同一性判断|技术说明]]。明确无对象需空数组、explicit_no_objects=true及理由；target_clues不足以代替完整Object。UNRESOLVED补证重跑，禁止直接批准。

旧目录尚未映射主表会返回TARGET_LEGACY_MIGRATION_REQUIRED；目录最多100项，满额新建返回TARGET_CATALOG_CAPACITY_EXCEEDED。保留旧包可用，不猜迁身份。新迁移为 `src/db/007-target-identity.sql`，已接入增量迁移函数；本轮没有部署正式库或重启服务，禁止用重建业务库部署。

验证命令：`node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/ai07*.test.ts`。真实模型评测命令：`node --env-file-if-exists=.env --import tsx src/scripts/evaluate-ai07.ts`，使用已有模型配置并保存新时间戳目录，不写业务库；已有10项结果见[[tools/RiskHot/docs/verification/ai07-target-identity|验证记录]]。
