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
