# BBXM 每日汇总（冰冰小美）— 自动化执行记录

任务：每天北京时间 16:00 抓取并整理「冰冰小美」（https://xueqiu.com/u/7143769715）当日雪球帖子，做风险分析并写入风险提示 Excel。
工作目录：`E:\caojingwen\obsidian\llmwiki`
主提示词（唯一分析规则与输出格式来源）：`.agents/automations/bbxm_daliy_brief.md`（文件名是 daliy，勿写成 daily）
账号与输出偏好：`.agents/skills/cjw-xueqiu-daily-monitor/EXTEND.md`（只取「冰冰小美」，不追加其他作者/平台）
抓取脚本：`.agents/skills/cjw-xueqiu-daily-monitor/scripts/extract_xueqiu_posts.mjs`（另有 WorkBuddy 技能副本，两者需保持同步）
Python：`D:\Python\Python311\python.exe`；Node：`D:\Users\lenovo\.workbuddy\binaries\node\versions\22.22.2-3\node.exe`
Chrome：`C:\Users\lenovo\AppData\Local\Google\Chrome SxS\Application\chrome.exe`（以仅本任务的 `CHROME_PATH` 传入）
专用 profile：`.agents\skills\cjw-xueqiu-daily-monitor\scripts\.xueqiu-chrome-profile`（CDP 9333）
输出：`sources/automations/BBXM每日汇总/{YYYY}/{MM}/{DATE}/`，日期目录内不再建作者子目录

---

## 2026-09-20（周日，16:00）

- 目标日期 2026-09-20；结果：**空结果（0 原帖）**。
- 处理：按主提示词第二节第 4 条，先做空风险清理（空洞风险分析 contract 0/0/0，`analysis_complete=true`），Excel 更新器返回 `no_risk`（未修改工作簿），随后删除日期目录及 `processing/`；未保留 `summary.md`、`task.log`、`state.json`。收尾报告 `summary.md` 路径写作「无（0 原帖，目录已清理）」。
- 核验：直接读取主页 DOM 复核，最新帖为 2026-09-18 17:05「专栏预演」，09-19／09-20 均无发帖，确认空结果真实而非漏采。
- 本次修复技能缺陷：主页时间线条目为相对 `href`，解析后带 `www.`，而 `postUrlPattern`／`isXueqiuPostUrl` 只匹配不带 `www.` 的地址 → 真实时间线帖子被整体漏采；且主页日期推断会把裸时间（如 `17:05`）回退成目标日期，产生假候选。已允许可选 `www.` 前缀，并在主页日期模式中新增 `MM-DD HH:MM` 形态；`node --check` + 22 项技能测试通过，`--date 2026-09-18` 候选由 3 提升为 10 且日期全部正确。已同步 WorkBuddy 副本并记入技能 `log.md`。
- 已向根 `log.md` 追加 audit 记录。

### 复用经验（下次执行先看）

- 运行前先 `curl http://127.0.0.1:9333/json/version`；不可用时由脚本内置路径启动，必须显式传 `--profile-dir` 指向项目专用 profile，并传 `CHROME_PATH` 指定 Canary。
- `content_task.py` 的 `--layout`/`--output-dir` 无法直接生成 `{YYYY}/{MM}/{DATE}` 最终路径；如需保存原帖，用一个小包装脚本导入 `content_task`（`load_input_items`、`normalize_extracted_post`、`save_posts_to_files`、`ensure_day_state`、`update_day_state`、`append_processing_payload`）直接写入日期目录，可保持命名与去重行为一致。
- 保存后需在原帖 `抓取时间：` 行与 `正文：` 之间补写 `标签：` 行（宏观/市场/行业/交易），`content_task.py` 本身不写标签。
- 覆盖率自我核验：主页候选会夹带正文内嵌的他人帖与旧帖链接（会被 `content_task` 的 target-date 过滤掉，属冗余但无害）；判断「是否真空结果」时应另行读取主页 DOM 看最新帖时间，不要只看候选数。
- 空结果日仍需走一遍更新器（空 `qualified`），以便清理该日可能遗留的自动行；返回 `no_risk`/`removed` 才可删目录，返回 `pending` 必须保留目录并报告待补写。
- 遗留：`2026/09/2026-09-18/` 为空目录，但作者当日 16:56／16:59／17:05 又有 3 帖从未抓取，待人工决定是否补抓。

---

## 2026-09-21（周一，16:00）

- 目标日期 2026-09-21；结果：**空结果（0 原帖）**。
- 处理：同空结果流程——空洞风险分析（0/0/0，`analysis_complete=true`）→ 更新器返回 `no_risk`（未改工作簿）→ 删除日期目录 `2026/09/2026-09-21/`；未保留 `summary.md`／`task.log`／`state.json`。收尾报告 summary.md 路径写「无（0 原帖，目录已清理）」。
- 核验：另起浏览器直读主页 DOM，最新帖 2026-09-18 17:05「专栏预演」，09-19／09-20／09-21 无发帖；页面标题、登录态、结构正常，无验证码。确认真空结果。
- 新增经验（重要）：
  1. **首轮提取存在冷启动竞态**：Chrome 冷启动后页面 `document.body` 未就绪时，提取脚本会在 `window.scrollTo(0, document.body.scrollHeight)`（主页/详情滚动处）抛 `Cannot read properties of null (reading 'scrollHeight')`，进程约 7 秒退出且不产出 JSON。处理方式：**立即原样重跑一次即可成功**；若重跑仍失败再上报。这是本次新出现的失败模式，已写入经验。
  2. **Chrome 不作为常驻实例存活**：node 脚本退出后其启动的 Chrome 随之关闭，CDP 9333 随即不可用。因此「核验脚本」必须自带启动逻辑（不可假定 CDP 复用），或以 `waitForChromeDebugPort` 短超时探测后再启动。
  3. 核验脚本可复用 `vendor/baoyu-chrome-cdp/src/index.mjs` 的 `launchChrome`／`waitForChromeDebugPort`／`openPageSession` 与主脚本导出的 `evaluateJson`／`waitForDocumentReady`；用 `CHROME_PATH` 传 Canary，`--profile-dir` 传项目专用 profile。核验脚本用完即删，未留在技能目录。
  4. 主页 `全部` 筛选下的时间线文本可用正则 `冰冰小美(\d{2}-\d{2} \d{2}:\d{2}|\d{4}-\d{2}-\d{2} \d{2}:\d{2})` 顺序提取，判断最新帖日期最直观。
- 观察（非阻断）：`tools/bbxm-risk-dashboard/data/~$冰冰小美风险提示.xlsx` 存在（时间戳 Jul 14 16:59，疑似陈旧锁文件）；本次因 `no_risk` 无需写入故未受影响，未来若需写入遇 `pending` 应先确认该锁是否有效。
- 遗留不变：`2026/09/2026-09-18/` 仍为空目录，作者当日 16:56／16:59／17:05 等帖待人工决定补抓。

---

## 2026-09-22（周二，16:00）

- 目标日期 2026-09-22；结果：**空结果（0 原帖）**。
- 流程：首轮提取即正常退出并产出空 JSON（candidates=0，未复现 09-21 冷启动竞态）→ 独立 DOM 核验脚本确认最新帖 2026-09-18 17:05、09-19 至 09-22 无发帖（页面正常、无验证码）→ 空洞风险分析（0/0/0，`analysis_complete=true`）→ 更新器返回 `no_risk`（未改工作簿）→ 删除前核验目录内仅 4 个中间文件、无原帖 Markdown → 删除日期目录 `2026/09/2026-09-22/`。summary.md 路径报告为「无（0 原帖，目录已清理）」。
- 经验：核验脚本 import vendor 路径需用绝对 `file:///E:/...` URL（processing 目录嵌套 7 层，相对层级易错）；核验脚本已随目录一并删除。
- 已向根 `log.md` 追加 audit 记录（插于 09-21 BBXM 审计条目之后）。
- 遗留不变：`2026/09/2026-09-18/` 空目录及当日 3 帖补抓事宜待人工决定。

---

## 2026-09-22（手动补抓 2026-09-18，17:30）

- 目标日期 2026-09-18（用户明确指示「开启任务，整理2026-09-18的帖子」）；结果：**保存 7 篇原帖**（4 中文 + 3 英文），候选 10、跳过非目标日期 2、删除误存他人帖 1。
- 关键结论：**此前的「09-18 无有效文章」判断是错的**——09-20 的核查只抽样了首页 DOM 首屏。逐帖核对后 09-18 确有 7 篇。已在根 `log.md` 两条记录中补勘误与正条。
- 目录内容：7 篇原帖 + `summary.md` + `state.json` + `task.log` + `processing/`（抓取、详情重取、清洗、合并、风险分析、自检脚本与报告）。
- 风险分析：按新规则**实际调用** `bbxm-risk-identification` 五步路径，覆盖 7/7、未解决 0；合格 R/W = 0，全部 `待验证`（候选 4 / 证据不足 3 / 重复载体 1）。更新器 `no_risk`，未改工作簿。未写 `Risk/`、未生成 HTML、未另跑 `information-processing`。
- 已生成 `summary.md`；当日无买卖信号，未生成 `操作.md`。
- 本次新沉淀的抓取/清洗经验（下次同类补抓直接复用）：
  1. **雪球图标字体**：`\ue64b`=赞、`\ue633`=评论，与数字粘连成 `\ue64b9`/`\ue6332`，或孤行只剩数字。清洗必须**先剥离私用区 `[\ue600-\ue7ff]` 再判噪声**，否则孤立数字会被当作正文收入「作者评论」。
  2. **文件名 ID 高位截断**：文件名只保留 8 位后缀，与 9 位真实 ID 比对须用前缀匹配，否则误存帖删不掉（本次 `131700_…_40978055.md` 即此坑）。
  3. **专栏页 vs 社区页同源**：社区页「正文」位置可能显示他人评论，作者原文只在专栏页。处置为「专栏页为保留载体 + 回填正文 + 社区页标重复载体 + state 记 `duplicate_of`」。
  4. **专栏页正文按标点逐行输出**，重排规则：先去全部硬换行拼成连续文本 → 按 `。！？` 分段 → 每段聚合 ≥40 字。结果与社区页原始保存版本逐句一致，可作独立验证。
  5. 详情页正文只取 `.article__bd` / `.status-content`，否则带入导航/热门话题/热股榜/基金榜外壳。
- 环境提示：本会话 bash 的 PATH 损坏（`dirname`/`cd`/`ls`/`cat` 全部 not found），PowerShell 直出 stdout 也常为空。可靠方式：PowerShell 写 `.NET` API，输出重定向到文件，再用 Read 工具读取。
- 遗留：**09-18 空目录待办已闭环**；无新增遗留。

---

## 2026-09-22（当日帖整理，18:00 续跑）

- 目标日期 2026-09-22；结果：**保存 3 篇原帖**（16:27 图片帖 410215494、16:44 观点帖 410217703、17:53 热榜帖 410225664）+ `summary.md`；当日无买卖信号，未生成 `操作.md`。
- 16:00 定时轮的空结果属实（3 帖均发布于 16:00 之后）；**17:34 重跑 0 候选是冷启动渲染竞态缺陷**：冷启动 Chrome readyState 到 `interactive` 即进入提取，主页时间线未渲染完，脚本静默返回空 JSON（exit 0）——与 09-21 的 `scrollHeight of null` 是两种不同的冷启动竞态。已在 `extractHomepageCandidates` 增加 0 候选时等 3 秒重试一次的防护（新增 2 项回归测试、57 项全过），同步 WorkBuddy 副本并记入技能 `log.md`；修复后 17:57 重跑成功。
- 风险分析：按项目版 `.agents/skills/bbxm-risk-identification/`（v1.0.2 五步识别）逐帖分析，覆盖 3/3、未解决 0；合格 R/W = 0，全部 `待验证`（候选 2：16:44 帖投机生态传导（「灰飞烟灭」终点未发生、减持/IPO 为假设表述）、16:27 帖评论融券做空机制（无标的无数据）；证据不足 1：17:53 帖热榜现象）。更新器 `no_risk`。未写 `Risk/`、未生成 HTML、未另跑 `information-processing`。
- 知识库印证（§6.2）：View「A股投机产业链根源在交易制度与融资市场定位」+ Reasoning「做多制度与低违规成本」+ Timeline「摔杯为号=冰点摔杯择时信号」。
- 本次沉淀（下次直接复用）：
  1. **图片帖处置**：正文位置写事实性说明，观点由作者评论承载；图片不可提取列入待验证边界，不算「缺正文」（元数据齐全即可 analysis_complete=true）。
  2. **评论相对时间戳正则**：09-18 版只认绝对时间，当日新发帖评论是「N分钟前/小时前/今天 HH:MM」形态，必须扩展 TIME 正则否则整条作者评论被漏掉。
  3. **同日同文指纹去重**：作者同日把同一段文字发成正式帖又贴进旧帖评论区时，以正式帖为识别载体，评论处标「同文」不重复计次。
  4. **标签污染**：详情页热门话题会混入 tags，需人工核对标签是否与正文主题相符。
  5. **PowerShell `Start-Process` 不可用**：环境块同时含 `PATH`/`Path` 键抛 ArgumentException；bash 绝对路径 + 输出重定向到文件后 Read 是可靠方式（bash 内建 echo/export 可用，外部命令均不可用）。
- 已向根 `log.md` 追加：16:00 轮 audit 条目勘误（09-22 无发帖仅为时点快照）+ 本次 ingest 正条目。
- 遗留：无。

---

## 2026-09-23（周三，16:00）

- 目标日期 2026-09-23；结果：**保存 4 篇原帖**（10:38 盘面记录 410307862、10:49 报团生态 410310788、11:08 零和博弈 41031564x、12:00 退潮与做空节点 410325412）+ `summary.md` + `state.json` + `task.log` + `processing/`；当日无买卖信号，未生成 `操作.md`。
- 首轮提取即成功（candidates=4，未复现冷启动竞态）；另起 Chrome 直读主页 DOM 核验：2026-09-23 仅 4 篇、最新 12:00，16:04 时点无后续发帖，覆盖完整。
- 作者补充评论为 0：逐帖核对详情页讨论区，作者本人当日未在帖下回复，`--comment-scope author-only` 返回空属真实结果。
- 风险分析：`bbxm-risk-identification` v1.0.2 五步路径逐帖分析，覆盖 4/4、未解决 0；合格 R/W = 0，4 项全部 `待验证`（候选 3：12:00 帖 ETF 高抛低吸为作者自称「恶意揣测」且风险表现为条件句、11:08 帖资金量级无可核对口径、10:49 帖缺当日成交/融资数据；证据不足 1：10:38 帖仅现象记录）。更新器 `no_risk`，未改工作簿；未写 `Risk/`、未生成 HTML。
- 本次新增沉淀（下次复用）：
  1. **编码核验应覆盖技能脚本本身**：`extract_xueqiu_posts.mjs` 第 866 行 `textPattern` 为 GBK 双重编码乱码（同文件第 671 行同名正则正确）。已修复并同步 WorkBuddy 副本；`node --check` 通过，测试 55 passed / 2 skipped。经验：可用「同文件是否已有正确同名常量」作为对照来重建乱码文本，比字节反解更可靠。
  2. **同一文件内两份重复正则容易出现单点损坏**，日常核验应以「全文私用区字符计数」为快速体检指标（本次由 4 → 0）。
  3. bash 环境本次完全正常（前几日的 PATH 损坏未复现），`tail -c` 截断多字节字符会显示假乱码，核验中文必须用 UTF-8 读取（Python）而非 `tail` 直出。
- 已向根 `log.md` 追加 audit 条目；技能变更记入 `cjw-xueqiu-daily-monitor/log.md`。
- 遗留：`tools/bbxm-risk-dashboard/data/~$冰冰小美风险提示.xlsx` 陈旧锁文件仍在（Jul 14），本次 `no_risk` 无需写入故未受影响，待人工确认是否清理。

---

## 2026-09-24（周四，16:00）

- 目标日期 2026-09-24；结果：**空结果（0 原帖）**。
- 流程：首轮提取即报 `Session with given id not found.`（进程 exit 1、未产出 JSON）→ **原样重跑一次即成功**（candidates=0）→ 独立 DOM 核验（`processing/verify-homepage.json`）确认时间线最新为「昨天 12:00/11:08/10:49/10:38」= 2026-09-23，09-24 无发帖、页面正常、无验证迹象 → 空洞风险分析（0/0/0，`analysis_complete=true`，`skill_call.invoked=false`）→ 更新器 `no_risk`（未改工作簿）→ 核验目录内仅 5 个中间文件、无原帖 Markdown → 删除 `2026/09/2026-09-24/`。summary.md 路径报告为「无（0 原帖，目录已清理）」。
- 本次新增沉淀（下次复用）：
  1. **新失败模式：`Session with given id not found.`**。不同于 09-21 的 `scrollHeight of null` 与 09-22 的「静默空 JSON」，该错误在 attach/建 target 阶段就抛出，进程 exit 1 且无任何输出文件。**处置同为「原样重跑一次」**，本次重跑即成功；若重跑仍失败再上报。
  2. **核验脚本的 `awaitPromise` 坑**：`evaluateJson(cdp, sessionId, script, awaitPromise=false)` 传 async IIFE 时，返回的是 Promise 对象、`returnByValue` 无法序列化 → 整段 payload 变 `undefined`，核验结果只剩空壳（表现为 `items=undefined markers=`）。**异步 IIFE 必须传 `true`**。
  3. **核验脚本改为「锚点 + 容器文本」自证**：`a[href]` 匹配 `^https?://(?:www\.)?xueqiu\.com/\d+/\d+`，取 `closest("article, .timeline__item, .card, .feed__item, .status__item, li")` 的 `innerText`，可同时拿到「冰冰小美昨天 12:00」这类相对时间前缀与帖子 ID；比只匹配 `冰冰小美(\d{2}-\d{2} \d{2}:\d{2})` 更可靠（后者无法识别「今天/昨天」形态，且旧版会把置顶帖的 2024-05-19 排在首位）。
  4. **`python -c "..."` 内嵌反引号会被 bash 命令替换吞掉**：本日写 `log.md` 时用双引号包裹 `-c` 脚本，反引号片段（如 `` `log.md` ``、路径）被 shell 当作子命令执行并从文本中静默删除。**要在 Python 里写含反引号的 Markdown，必须用单引号包裹 `-c`、或写成独立 .py 文件、或直接用 Edit 工具**。
- 已向根 `log.md` 追加 audit 记录。
- 遗留不变：`tools/bbxm-risk-dashboard/data/~$冰冰小美风险提示.xlsx` 陈旧锁文件仍在（Jul 14），待人工确认是否清理。

---

## 2026-09-28（周一，16:00）

- 目标日期 2026-09-28；结果：**保存 3 篇原帖**（10:37 账户浮亏情绪帖 410722729、10:44「投机本质是做空/缩量报团溢价/行情割裂」410725563、11:10「交易公平性双向多空，A股只能单边上涨盈利」410733603）+ `summary.md` + `state.json` + `task.log` + `processing/`；当日无买卖信号，未生成 `操作.md`。
- 抓取：CDP 9333 起始不可用 → 脚本内置路径以 `CHROME_PATH`(Canary) 启动 + 项目专用 `--profile-dir`，**首轮提取即成功**（candidates=3），未复现任何冷启动竞态。独立核验脚本直读主页 DOM：时间线最新三条即上述三帖（显示「5 小时前」），当日无更新帖、无验证迹象，覆盖完整。
- 作者补充评论：仅 11:10 帖有 1 条作者本人评论（11:14「（图片评论）一切根源。Ipo 加速且扩容。」）；extract 的 `author_comments` 是嵌套折叠块混入他人回复，**必须在保存前人工精简**（本次通过在 save 脚本里按 content_id 覆盖 `author_comments` 实现）。图片未能提取，列入待验证边界。
- 风险分析：`bbxm-risk-identification` **v1.0.3**（今日模板已更新，正文结论前置、身份/口径移入附录）五步路径逐帖分析，覆盖 3/3、未解决 0；合格 R/W = 0，3 项全部 `待验证`（候选 2：制度性不公+IPO 扩容为长期论断无发行数据、信心受损/缩量抱团缺当日成交与流动性数据；证据不足 1：纯盘面情绪记录）。更新器 `no_risk`，未改工作簿；未写 `Risk/`、未生成 HTML。
- 知识库印证（§6.2）：A股投机产业链根源在交易制度与融资市场定位 / A股投机产业链如何由做多制度与低违规成本形成 / A股制度定位与投资难度 / 投机三层核心逻辑 / 风险来源与传导路径。
- 本次新增沉淀（下次直用）：
  1. **`openPageSession` 签名坑**：vendor 版只接受 `{cdp, reusing, url, matchTarget, enablePage, enableRuntime, activateTarget}`，需先 `const wsUrl = await waitForChromeDebugPort(port)` 再 `await CdpConnection.connect(wsUrl)`；**不接受 `port` 参数**，误传抛 `TypeError: Cannot read properties of undefined (reading 'send')`。核验脚本模板：`openPageSession({cdp, reusing, url})` → `cdp.send("Page.navigate",{url},{sessionId})` → `waitForDocumentReady(cdp, sessionId, 30000)` → `sleep(3000)` → `evaluateJson(cdp, sessionId, asyncIIFE, true)`。
  2. **核验脚本的 `reusing` 语义**：`reusing:true` 会 `Target.createTarget` 新开标签（用于新启动的 Chrome）；`reusing:false` 才走 `Target.getTargets` + `matchTarget` 复用已有标签。脚本自启动 Chrome 时用 `reusing:false` + `matchTarget` 匹配账号 URL。
  3. **state.json 键名**：`content_task.ensure_day_state` 写出的是 `account` / `account_url` / `task_date`(YYYYMMDD) / `processed_items`，**不是** `author_name`/`target_date`；自检脚本别按后者取键。
  4. **技能已知问题（非本轮引入）**：`bbxm-risk-identification` 的 `references/handoff-contract.md` 缺失，技能自身 `log.md`（1.0.3）已自记该问题；本轮按现存 SKILL/workflow/template 执行，未修改技能。
  5. **非空结果日的产物核对**：`processing/` 内的 `extract.json`、`extract_full.txt`、`verify-homepage.json` 会残留雪球图标字体的私用区字符（`\ue6xx`），属原始数据而非乱码；编码自检应只对交付物（原帖 `*.md`、`summary.md`、`risk-analysis.json`）判定，不要据此误报。
- 已向根 `log.md` 追加 ingest+audit 条目；未新增 Wiki 页面，`index.md` 不变。
- 遗留不变：`~$冰冰小美风险提示.xlsx` 陈旧锁文件（Jul 14）待人工确认是否清理。

---

## 2026-09-29（周二，16:00）

- 目标日期 2026-09-29；结果：**空结果（0 原帖）**。
- 流程：首轮提取即正常退出（exit 0、12 秒、未复现任何冷启动竞态），candidates=0 → 独立 DOM 核验（`processing/verify-homepage.json`）确认时间线最新三条为「昨天 11:10 / 10:44 / 10:37」= 2026-09-28，09-29 无发帖；页面标题、登录态正常（`hasUserNav=true`、无登录链接）、无验证/滑块 → 空洞风险分析（0/0/0，`analysis_complete=true`，`skill_call.invoked=false`）→ 更新器 `no_risk`（未改工作簿）→ 核验目录内仅 6 个中间文件、无原帖 Markdown／`summary.md`／`state.json`／`task.log` → 删除 `2026/09/2026-09-29/`。summary.md 路径报告为「无（0 原帖，目录已清理）」。
- 本次无新增技能缺陷；核验脚本沿用 09-28 模板（`waitForChromeDebugPort` → `CdpConnection.connect` → `openPageSession({cdp, reusing:true, url})` → `Page.navigate` → `waitForDocumentReady` → `sleep(4000)` → `evaluateJson(..., true)`），一次通过；已随目录一并删除。
- 环境提示：`ls`/`find`/`cat`/`curl` 等 bash 本次完全正常；CDP 9333 起始不可用属常态，脚本内置启动路径工作正常。
- 已向根 `log.md` 追加 audit 记录；未新增 Wiki 页面，`index.md` 不变。
- 遗留不变：`tools/bbxm-risk-dashboard/data/~$冰冰小美风险提示.xlsx` 陈旧锁文件（Jul 14）待人工确认是否清理。

---

## 2026-09-30（周三，16:00）

- 目标日期 2026-09-30；结果：**0 原帖，但不判定为空结果**——登录态失效构成阻断项，目录与证据全部保留。
- 流程：CDP 9333 起始不可用 → 脚本内置路径 + `CHROME_PATH`(Canary) + 项目专用 `--profile-dir` 启动 → 首轮报 `Timed out waiting for document.readyState`（已知冷启动竞态）→ 原样重跑成功，`candidates=0`（`extract.json=[]`）→ 独立核验。
- **核心发现：专用浏览器 profile 登录态失效**。主页 DOM 时间线可读（最新非置顶帖 2026-09-28 11:10，未出现 09-29／09-30），但导航显示「首页 下载App 登录」、无用户菜单、`window.SNOWMAN.user` 为空，服务端按匿名渲染。Cookie 中 `xq_a_token`/`xqat`/`xq_r_token`/`xq_id_token` 均存在且为 session 级未过期，但服务端不认——属「Cookie 在、会话失效」。时间线 JSON 接口（`/v4/statuses/user_timeline.json`、`/statuses/original/timeline.json`）均返回阿里云 WAF 挑战页，接口级交叉核验受阻。
- 判定与产物：`risk-analysis.json` 写 `analysis_complete=false` + `skill_call.invoked=false` + `blocking.login_blocked=true`；更新器返回 **`blocked`**（工作簿未改动）；未写 `Risk/`、未生成 HTML；未生成 `summary.md`／`state.json`／`操作.md`。保留 `task.log` + `processing/` 9 个证据文件。
- 本次新增沉淀（下次直用）：
  1. **`CdpConnection.connect(wsUrl)` 必须显式传超时**：签名是 `connect(url, timeoutMs, options)`；不传 `timeoutMs` 时内部 `setTimeout(reject, undefined)` 会在 0ms 立即 reject，报 `CDP connection timeout.` 而非真实网络问题。核验脚本一律写 `CdpConnection.connect(wsUrl, 30_000)`。
  2. **CDP 常驻化更稳**：脚本自启动的 Chrome 会随 node 退出而关闭，导致「同一条 bash 命令里第一次 `connect` 失败、第二次成功」的伪随机现象。更稳做法：先用 `nohup <Canary> --remote-debugging-port=9333 --user-data-dir=<专用 profile> about:blank &` 起常驻实例，`curl /json/version` 确认后再跑核验脚本。本轮常驻实例未关闭，便于人工在该 profile 内重新登录。
  3. **登录态判定要三看**：`document.cookie` 看不到 HttpOnly Cookie（会误判未登录）；应改用 CDP `Storage.getCookies` 取全量 Cookie，再结合导航文本（`首页 下载App 登录` = 未登录）与 `window.SNOWMAN.user`。三者结合才能区分「Cookie 在但会话失效」。
  4. **登录态失效属阻断项，不是空结果**：按主提示词第二节第 4 条，只要存在登录阻断，即使 0 原帖也必须保留日期目录与证据、写 `analysis_complete=false`、接受更新器 `blocked`，不得删目录、不得报「已确认无新帖」。
  5. 核验脚本模板（本轮定型，7 个临时脚本用完即删）：`waitForChromeDebugPort(port,20000)` → `CdpConnection.connect(wsUrl,30000)` → `openPageSession({cdp,reusing:false,url:"about:blank",matchTarget:t=>(t.url||"").includes("xueqiu.com")})` → `Page.navigate` → `waitForDocumentReady(cdp,sessionId,30000)` → `sleep(4000)` → `evaluateJson(cdp,sessionId,asyncIIFE,true)`。临时脚本放 `scripts/` 目录下以便相对 import vendor 与主脚本。
- 已向根 `log.md` 追加 audit 记录；未新增 Wiki 页面，`index.md` 不变。
- **人工跟进（高优先级）**：需在专用 profile 中重新登录雪球，然后对 2026-09-30 执行同日重跑；本轮无法确认当日是否真的无发帖。
- 遗留不变：`~$冰冰小美风险提示.xlsx` 陈旧锁文件（Jul 14）待人工确认是否清理。
