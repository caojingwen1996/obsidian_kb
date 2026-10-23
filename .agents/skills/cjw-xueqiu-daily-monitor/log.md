# cjw-xueqiu-daily-monitor 变更日志

本文件记录技能本身的变更；每次修改在文件末尾追加。既有历史可查 Git 和项目根目录 log.md，本次不追溯补写未经核实的历史。

## 2026-09-09 — 建立技能变更日志

- 版本：未设版本号；本次版本号不变。
- 修改原因：用户要求每个 skill 增加独立 log.md，用于持续记录技能变更。
- 涉及文件：SKILL.md、log.md。
- 具体变更：新增本日志；在 SKILL.md 增加日志入口和修改后追加记录的要求。
- 验证结果：已核验日志存在、SKILL.md 日志链接有效、原有说明完整保留，以及新增内容 UTF-8 编码正常。
- 历史边界：这是日志启用记录，不代表技能首次创建或新版本发布；不将工作区已有修改归入本次变更。

## 后续记录格式

每次在文件末尾追加以下字段，填写实际内容：

- 日期与变更标题：
- 版本：旧版本 → 新版本；未升级写“版本号不变”，无版本字段写“未设版本号”。
- 修改原因：
- 涉及文件：
- 具体变更：
- 验证结果：写明实际执行的检查；未验证时说明原因。

## 2026-09-14 — 修复公开雪球主页登录误判

- 版本：未设版本号；本次版本号不变。
- 修改原因：BBXM 每日汇总抓取时，公开可读的雪球作者主页因顶部导航含“登录”入口被误判为需要登录，导致抓取器进入人工登录等待。
- 涉及文件：scripts/extract_xueqiu_posts.mjs、scripts/tests/test_extract_xueqiu_posts.py、log.md。
- 具体变更：`classifyManualActionPayload` 在识别登录文案时增加可读帖子内容反证；若 payload 已含发布时间、帖子计数或来自客户端标识，且标题不是登录页标题，则不视为登录阻断。
- 验证结果：`python -m unittest .agents/skills/cjw-xueqiu-daily-monitor/scripts/tests/test_extract_xueqiu_posts.py` 通过，22 项测试全部 OK；随后 BBXM 抓取成功进入 23 条详情解析。

## 2026-09-20 — 修复主页时间线候选漏采与时间线日期误判

- 版本：未设版本号；本次版本号不变。
- 修改原因：BBXM 每日汇总 2026-09-20 运行核验时发现，雪球作者主页时间线条目的 `href` 为相对路径，解析后带 `www.` 前缀，而主页提取脚本的 `postUrlPattern` 与模块内 `isXueqiuPostUrl` 只匹配不带 `www.` 的地址，导致真实时间线帖子被整体漏采；同一轮只采到正文内嵌的非 `www.` 链接（含他人帖子和旧帖），并在日期推断时把裸时间（如 `17:05`）回退成目标日期，产生“目标日期有帖”的假候选。该缺陷会使自动任务在作者确有当日发帖时仍判定为空结果。
- 涉及文件：scripts/extract_xueqiu_posts.mjs、log.md。
- 具体变更：
  1. 主页提取脚本 `postUrlPattern` 与模块 `isXueqiuPostUrl` 允许可选 `www.` 前缀。
  2. 主页 `inferPublishedAt` 的时间线日期模式新增 `MM-DD HH:MM` 形态，并置于裸时间回退之前，使主页展示的 `09-18 17:05` 能被正确解析为绝对日期，而不再回退到目标日期。
- 验证结果：`node --check` 语法通过；`python tests/test_extract_xueqiu_posts.py` 22 项测试全部 OK；实测 `--date 2026-09-18` 候选数由 3 提升为 10，并正确解析出该日 17:05、16:59、16:56、15:29、06:11、06:06、06:05 等真实时间线帖子；`--date 2026-09-20` 候选为 0，与主页 DOM 实测最新帖为 2026-09-18 17:05 一致。已同步同一脚本到 WorkBuddy 技能目录并核对 SHA-256 一致。

## 2026-09-22 — 修复主页候选冷启动 0 候选静默空结果

- 版本：未设版本号；本次版本号不变。
- 修改原因：BBXM 每日汇总 2026-09-22 运行发现，冷启动的 Chrome 可在 `document.readyState` 到达 `interactive` 后、主页时间线 AJAX 渲染完成前进入提取；此时主页提取脚本找不到任何帖子锚点，静默返回空候选列表（进程 exit 0、输出 `[]`），调用方无法与真实的当日无帖区分。当日 17:34 手动重跑在作者已有两篇当日帖（16:27、16:44）的情况下仍返回 0 候选，17:51 用同源逻辑独立诊断确认日期过滤本身正常，判定为冷启动渲染竞态。
- 涉及文件：scripts/extract_xueqiu_posts.mjs、scripts/tests/test_extract_xueqiu_posts.py、log.md。
- 具体变更：
  1. `extractHomepageCandidates` 改为导出，并新增可选参数 `emptyRetryDelayMs`（默认 3000ms）。
  2. 首轮主页提取候选数为 0 时，等待 `emptyRetryDelayMs` 后重跑一次主页提取（复用 `seenUrls` 去重与 `maxPosts` 限额），避免冷启动竞态被误报为空结果；首轮已找到候选时不触发重试。
  3. 测试新增两项：首次提取为空触发恰好一次重试并采纳重试候选；首轮已有候选时只调用一次提取。
- 验证结果：`node --check` 语法通过；技能测试套件 `python -m unittest discover` 57 项测试全部 OK（含新增 2 项，既有 2 项跳过）；修复后实测 `--date 2026-09-22 --comment-scope author-only` 抓取到当日 3 篇帖子（16:27、16:44、17:53）。已同步 WorkBuddy 技能副本并核对 SHA-256 一致。


## 2026-09-23 — 修复风控提示文案正则乱码

- 版本：未设版本号；本次版本号不变。
- 修改原因：BBXM 每日汇总 2026-09-23 运行做编码核验时发现，`buildVerificationInspectionPayloadScript`（约第 866 行）中的 `textPattern` 已整体乱码（GBK 双重编码，并夹带私用区字符），而同文件 `buildVerificationWidgetInspectionScript`（约第 671 行）中的同名正则为正确中文。乱码后该正则无法匹配真实页面的“访问验证／请按住滑块／滑块”等文案，会让验证页探测与人工回退判断失效。
- 涉及文件：scripts/extract_xueqiu_posts.mjs、log.md（并同步 WorkBuddy 技能副本同名脚本）。
- 具体变更：把 `buildVerificationInspectionPayloadScript` 的 `textPattern` 恢复为与第 671 行一致的 `/访问验证|请按住滑块|拖动到最右边|为了更好的访问体验|即可继续访问网页|别离开|滑块|验证/`；未改动其他逻辑与测试。
- 验证结果：`node --check` 通过；全文件私用区字符计数由 4 降为 0；两处 `textPattern` 文本一致；技能测试 55 passed / 2 skipped（57 项，与既有基线一致）。WorkBuddy 副本同步后内容与项目版本逐字节一致。
- 备注：本次为编码修复，不改变抓取与提取行为；当日抓取本身未受该缺陷影响（未触发验证页）。


## 2026-09-24 — 记录 CDP 会话异常失败模式（未改代码，版本号不变）

- 版本：未记版本号；本次版本号不变，仅追加运行观察。
- 背景：BBXM 每日汇总 2026-09-24 定时轮首次调用 `extract_xueqiu_posts.mjs` 时，进程直接以 `Session with given id not found.` 退出（exit 1），未产出任何 JSON 输出文件；CDP 9333 未起来（`/json/version` 连接被拒）。
- 现象归类：这是与既有两种冷启动竞态都不同的第三种失败模式——09-21 复现的是 `Cannot read properties of null (reading scrollHeight)`（页面正文未就绪），09-22 复现的是「主页时间线未渲染完导致静默返回空 JSON（exit 0）」；本次发生在建立 target / attach 会话阶段，属于 CDP 连接层竞态，表现为显式报错且无输出。
- 已验证处置：**原样重跑一次即成功**（candidates=0，`--date 2026-09-24`，`--comment-scope author-only`，`--request-pacing auto`，项目专用 `--profile-dir`）。与既有脚本内置的「0 候选等 3 秒重试」防护互补，不冲突。
- 涉及文件：无代码变更；本次只更新本 log.md。
- 验证结果：重跑后脚本正常退出并写出 `extract-2026-09-24.json`（空数组）；另起独立核验脚本直读主页 DOM 确认当日确无发帖（时间线最新为 2026-09-23 12:00），失败非漏采。
- 备注：如需根治，可考虑在脚本入口对 `Session with given id not found` 增加一次自动重连重试；本次未改动抓取与提取逻辑，留待后续在有完整回归测试窗口时再评估。


## 2026-10-17 — 新增站内 API 批量抓取通道（版本号不变）

- 版本：未设版本号；本次版本号不变。
- 修改原因：需要把一个账号（雪球 @涨知识的小老鼠，UID 2573414707）历史上全部「老木匠直播」整理稿一次性抓全，共 55 篇。现有 `extract_xueqiu_posts.mjs` 只能滚动 5 轮取首页可见约 20 条，且必须逐篇打开详情页；按该路径抓 55 篇要连续浏览几十个页面，风控风险高、耗时过长。
- 涉及文件：scripts/extract_xueqiu_timeline_api.mjs（新增）、scripts/extract_xueqiu_status_detail.mjs（新增）、SKILL.md（新增「站内 API 抓取通道」章节与参考资料两行）、log.md。
- 具体变更：
  1. `extract_xueqiu_timeline_api.mjs`：在已登录页面上下文同源 fetch `/v4/statuses/user_timeline.json?user_id=&page=&count=20`，自动翻页到返回空为止，产出 id / title / created_at / text。
  2. `extract_xueqiu_status_detail.mjs`：对给定 id 列表调用 `/statuses/show.json?id=`，带随机延迟（默认 1.5–3.5s，批量场景建议 3.5–7s），产出未截断 `text`。
  3. SKILL.md 明确时间线 `text` 被截断到约 220 字，不能直接当全文，必须回查详情页接口。
- 验证结果：实测该账号时间线 4 页共 70 条，筛出 55 篇「老木匠·YYYY年M月D日」直播稿；详情接口 55/55 全部成功，正文长度 2.3k–14.4k 字符，无一篇失败或触发访问验证。转换后写入 `sources/automations/老木匠每日汇总/` 共 54 个 Markdown（另有 1 篇 8 月 8 日因目录内已有完整版本而跳过）。
- 备注：本次未改动 `extract_xueqiu_posts.mjs`，当日例行抓取流程不受影响。

## 2026-10-20 — 开启抓取后预处理与 Timeline 自动建页

- 版本：未设版本号；本次版本号不变。新增处理中间状态协议 version 为 1。
- 修改原因：用户批准技能说明草案，要求抓取后自动预处理，并直接开放 Timeline 自动建页。
- 涉及文件：SKILL.md、EXTEND.md、references/workflow.md、references/output-layout.md、references/error-policy.md；新增 references/timeline-processing.md、scripts/timeline_postprocess.py、scripts/tests/test_timeline_postprocess.py；修改 scripts/content_task.py、scripts/task_store.py、scripts/tests/test_content_task.py、log.md。
- 具体变更：
  1. 默认启用后处理、已有页更新和新主题建页；配置冰冰小美与老木匠的独立库路由，未知归属停止整理。移除失效 Windows 默认输出路径，使用当前工作区 outputs/cjw-xueqiu-daily-monitor。
  2. 保存入口自动归档原文并生成证据清单；调用技能的 Agent 继续阅读原文、核对完整性、检索既有主题、比较历史、生成计划并调用发布。脚本不内置模型、不联网；不能把清单准备成功当作整理完成。
  3. 候选按知识库与主题跨日期累积；满足至少三个不同日期的完整可追溯节点等条件后自动创建，已有主题增量更新；保留原章节、人工正文及首次创建日期。
  4. 加入原文版本保存、摘录与日期核验、跨库及路径拦截、真正来源双链检查、表格列数和转义检查、正文保护、文件冲突检查、写锁、旧页快照、独立失败状态、幂等重试及索引日志收尾恢复。支持 --capture-only。
  5. 新页面无 source/sources 属性；老木匠保留导读加九节结构；不恢复 reading 或 view 页面类型，不扩展抓取范围和定时任务。更具体任务的输出约定仍优先。
- 验证结果：完整 unittest 套件 79 项通过，其中新增后处理测试 22 项；skill-creator quick_validate 通过；修改 Markdown 表格、UTF-8 和差异空白检查通过。隔离测试覆盖创建、更新、跨日期积累、重复执行、修订稿、人工编辑冲突、坏链、错列表格、错库、失败恢复及只抓取模式。现有 Wiki 与来源文件和修改前快照哈希一致。
- 验证边界：未执行联网抓取或对真实主题进行模型分析，未生成正式 Timeline；自动化任务配置未变更。


## 2026-10-21 — 隔离 macOS 自动化浏览器启动

- 版本：未设版本号；本次版本号不变。
- 修改原因：固定雪球 CDP 实例使用日常 Google Chrome 的另一个数据目录，出现后台实例与程序坞唤起相互影响；仅分开 profile 不能代替应用隔离。
- 涉及文件：scripts/start_automation_chrome.sh、scripts/automation_browser.mjs（新增）、scripts/vendor/baoyu-chrome-cdp/src/index.mjs、scripts/extract_xueqiu_posts.mjs、scripts/extract_weibo_posts.mjs、scripts/task_store.py、scripts/tests/test_start_automation_chrome.py、scripts/tests/test_extract_xueqiu_posts.py、scripts/tests/test_automation_browser.mjs（新增）、SKILL.md、EXTEND.md、references/workflow.md、log.md。已安装副本仅同步启动相关文件及文案，保留其他代码和配置。
- 具体变更：启动器和提取器共用专用浏览器选择器，自动发现 Chrome for Testing / Chromium；macOS 显式指定日常 Chrome 或通过软链指向它时也拒绝，缺少专用浏览器不回退。可视实例使用 open -g -n -a 后台启动；支持可选无界面运行，端口仍为 9333。
- 数据保护：新默认目录为 scripts/.xueqiu-automation-profile，旧 .xueqiu-chrome-profile 保留。旧目录版本为 156，本机 Chrome for Testing 为 147，拒绝降级打开；日常 Chrome 数据目录不可用于自动化。新目录首次使用可能需要重新登录。
- 验证：项目完整 Python 回归 81 项、Node 测试 7 项通过；覆盖版本排序、拒绝日常 Chrome / 软链、拒绝个人 profile 与版本降级。Codex、Claude 副本各 5 项启动测试、7 项选择器测试及 dry-run 通过。
- 真实启动验证：临时目录、空白页、随机本地端口启动 Chrome for Testing 147 成功，重复启动复用实例，测试结束后已退出；日常 Chrome PID 未变，旧专用目录关键文件哈希未变。本轮 4 个日常窗口、11 个标签页标识完整不变。未执行抓取或迁移登录数据。
- 追溯边界：PID 69909 对应本技能固定 profile / 9333 启动链；PID 6094 属于 Playwright 临时 profile，原父进程已退出，现存记录未能定位具体创建脚本。后续临时会话通过项目与 Codex 全局隔离规则约束，不声称修改了未知原脚本。


## 2026-10-23 — 替换老木匠抓取账号

- 版本：未设版本号；本次版本号不变。
- 修改原因：用户指定将“买股票的老木匠”的抓取主页替换为 UID 2573414707。
- 涉及文件：EXTEND.md、log.md；同步记录项目根 log.md。
- 具体变更：账号地址由 https://xueqiu.com/u/3058599833 改为 https://xueqiu.com/u/2573414707，按现有配置格式省略 www 前缀；保留显示名称与启用状态。既有新账号按标题包含“老木匠”归入老木匠库的规则保持有效，旧来源历史路由保留。
- 验证结果：配置加载与账号替换断言通过；老木匠标题匹配及其他标题不匹配检查通过；修改 Markdown 的表格、UTF-8 与差异空白检查通过。
