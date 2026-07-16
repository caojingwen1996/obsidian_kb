---
name: cjw-xueqiu-daily-monitor
description: 当用户需要读取、抓取、提取、归档或汇总来自各类内容平台的文章、帖子或链接时使用，包括但不限于雪球、微信公众号、微博及其他网页内容平台；也用于按默认配置抓取各平台启用项、手动抓取指定账号的当日帖子、对同一天任务进行无重复补抓，或基于已保存的原始文本生成每位作者的 Markdown 汇总。当用户说“阅读这篇文章”“读取平台文章”“抓取默认配置”“开启雪球任务”“抓取雪球帖子”“抓取微信公众号文章”时触发。用户提供链接时只处理本次输入，不自动合并默认配置。
---

# 雪球日常监控

面向已配置账号主页的手动当日雪球监控流程。

使用这个 skill 时，先判断输入模式。只有默认配置模式才从 `EXTEND.md` 读取各平台启用项；用户提供链接时，以本次链接为唯一抓取输入。每次手动启动执行一轮抓取，在同日重跑时复用既有状态，并基于已保存的原始文本生成每位作者的 Markdown 汇总。

`EXTEND.md` 是默认抓取项和运行偏好的唯一配置来源，包括输出根目录等运行偏好。主流程文档不得另行定义与 `EXTEND.md` 冲突的固定路径。

## 输入模式路由（第 0 步）

在读取或展示默认账号之前，先按用户本次输入选择一个模式：

1. **本次输入模式**：用户提供一个或多个文章、帖子、主页或历史页链接时，只处理这些链接。不要加载、询问、追加或抓取 `EXTEND.md` 中其他平台的默认启用项。
2. **默认配置模式**：只有当用户明确说“抓取默认配置”或同义表达时，才读取 `EXTEND.md` 中雪球、微博、微信公众号及其他已配置平台的全部 `enabled` 项，并对每个平台执行一轮抓取。“抓取默认配置”本身即为对这些启用项的确认，不再重复询问是否按默认账号抓取。
3. **未明确模式**：用户既未提供链接，也未明确要求默认配置时，才进入原有的配置确认流程。

如果同一请求同时出现链接和“默认配置”，默认采用本次输入模式；只有用户明确要求“链接和默认配置都抓取”时才合并两类输入。

## 范围边界

这个 skill 只定义雪球业务流程本身：

- 账号配置与操作者确认
- 目标日期解析
- 同日重跑识别与去重
- 原始文件和汇总输出要求

也支持微信公众号抓取：用户提供一个或多个 `mp.weixin.qq.com/s...` 文章链接时，使用 `scripts/extract_wechat_articles.mjs` 提取结构化 JSON；用户提供可访问的公众号主页/历史消息页面时，使用 `--history-url` 先发现文章链接，再复用现有保存流程写入原始 `.txt` 文件。

当任务需要访问主页、复用登录态、进行页面交互或从雪球页面提取内容时，必须使用本 skill 自带的浏览器访问层：

- `scripts/start_automation_chrome.sh`：启动或复用固定自动化 Chrome/CDP 实例
- `scripts/extract_xueqiu_posts.mjs`：通过本地 CDP 连接访问雪球页面并提取结构化 JSON

这个 skill 现在自带浏览器访问能力，不再依赖外部浏览器访问 skill。

## 工作流

```text
- [ ] 第 0 步：判定本次输入模式
- [ ] 第 1 步：预检 `EXTEND.md` 并确认任务输入
- [ ] 第 2 步：确认目标日期和运行模式
- [ ] 第 3 步：按输入范围和平台逐项执行一轮抓取
- [ ] 第 4 步：同日重跑时复用既有状态
- [ ] 第 5 步：基于已保存的原始文本生成 Markdown 汇总
- [ ] 第 6 步：收尾并汇报输出位置
```

## 第 1 步：预检

### 1.1 读取 `EXTEND.md` ⛔ 阻塞项

第 0 步选择默认配置模式时：

- 读取 `EXTEND.md` 中各平台的全部 `enabled` 项
- 列出本轮将处理的平台、账号或链接、日期规则和输出偏好
- 直接继续预检，不再要求用户重复确认默认账号

第 0 步选择本次输入模式时：

- 只校验本次提供的链接
- 不列出、不询问、不追加 `EXTEND.md` 中的默认账号或链接
- 只从 `EXTEND.md` 读取输出根目录、日期规则和运行环境等非输入配置

只有第 0 步无法判定输入模式时，才执行原有确认流程：

- 读取 `EXTEND.md`
- 列出当前启用账号、禁用账号、URL、备注、手动规则、日期规则和输出偏好
- 询问用户是否需要补充或更正配置
- 提供标准确认选项：
  - `1. 需要补充或更正配置`
  - `2. 不需要修改，按指定日期抓取 YYYY-MM-DD`
  - `3. 不需要修改，按今天抓取`

在用户明确确认其中一个允许结果，或 `EXTEND.md` 更新完成之前，不要继续。

完整流程见：[references/workflow.md](references/workflow.md#step-1-pre-check)

### 1.2 校验任务输入与环境

确认：

- 默认配置模式至少存在一个有效的 `enabled` 项，各平台启用项的 URL 与其平台类型匹配
- 本次输入模式至少存在一个有效链接；不要求 `EXTEND.md` 中存在启用账号
- 目标日期是明确的，或选项 `3` 已经被解析成绝对日期

在进入任何雪球页面抓取前，必须先确认浏览器环境可用。

如果配置或环境不完整，停止执行并要求用户先修正。

### 1.3 浏览器自动检测与启动

在调用 `scripts/extract_xueqiu_posts.mjs` 前，必须先检测固定自动化 Chrome/CDP 实例是否可用，并将其作为后续抓取复用的 `自动化专用 Chrome 实例`。

如重试后仍失败，必须停止当前任务，并将该项记录为待人工跟进。
完整流程见：[references/workflow.md](references/workflow.md#step-1-pre-check)




## 第 2 步：确认运行模式

判断本次启动属于：

- 当天首次抓取，或
- 必须复用既有当日输出的同日重跑

如果用户选择了 `3. 不需要修改，按今天抓取`，必须在判断运行模式前先把 `today` 解析成当前绝对日期。

使用现有的作者-日期目录，尤其是 `state.json`、`task.log` 和已保存的原始 `.txt` 文件，作为判断是否重跑的事实来源。

完整流程见：[references/workflow.md](references/workflow.md#step-2-choose-date-and-run-mode)

## 第 3 步：抓取

每次手动启动只执行一轮抓取。

- 默认配置模式：按平台处理 `EXTEND.md` 中全部 `enabled` 项
- 本次输入模式：只处理第 0 步保留的本次链接列表
- 除非用户明确要求合并，否则不得把两种模式的输入放进同一轮任务

- 第 3 步必须 `复用第 1.3 步` 已准备好的 `自动化专用 Chrome 实例`
- 使用 `scripts/extract_xueqiu_posts.mjs` 处理主页访问、页面交互、登录态复用、验证页自动尝试与人工回退，以及帖子内容提取
- 使用 `scripts/task_store.py` 处理状态、去重和日志
- 只处理目标日期的帖子
- 保存原始 `.txt` 文件和日志
- 不要启动自动循环或按小时扫描

## 第 4 步：同日重跑

同日重跑只能做增量补抓。

- 读取现有作者-日期输出目录
- 优先复用 `state.json`，只有在需要手动重建状态时才回退到已保存的原始 `.txt` 文件
- 只保存新发现的帖子
- 不要覆盖已有原始文件

完整流程见：[references/workflow.md](references/workflow.md#step-4-same-day-rerun)

## 第 5 步：生成汇总

当某个作者当天的抓取已经足够完整后：

- 从已保存的原始 `.txt` 文件准备作者输入
- 构建 `references/workflow.md` 中定义的作者汇总提示词
- 将最终 Markdown 与中间文件分开保存

汇总格式见：[references/summary-format.md](references/summary-format.md)

每份最终作者汇总都必须保留 `总观点` 和 `分观点` 这两个必需章节。

## 第 6 步：收尾

需要汇报：

- 目标日期
- 已处理作者数量
- 输出根目录
- 每位作者的汇总文件位置
- 每位作者的 processing 目录
- 仍需人工跟进的失败项

## 输出目录

所有输出都组织在 `EXTEND.md` 配置的 `preferred output root` 下。

```text
{output-root}/
└── {yyyymmdd}/
    ├── {author}/
    │   ├── *.txt
    │   ├── state.json
    │   ├── task.log
    │   ├── processing/
    │   └── summary.md
```

详细规则见：[references/output-layout.md](references/output-layout.md)

如存在中间分析产物，必须放在 `{yyyymmdd}/{author}/processing/` 下。

## 不要这样做

- 不要在普通手动 skill 调用中循环启动；但允许 Codex cron 自动化按配置单轮执行
- 不要假设存在调度系统
- 不要把同日重跑当作全新任务
- 不要把中间文件混放在 `{yyyymmdd}/{author}/summary.md` 旁边
- 不要声称存在超出当前汇总启发式范围的 `spec` 匹配能力
- 不要在登录、页面、保存或风控失败后静默继续

## 参考资料

| File | Purpose |
|------|---------|
| [EXTEND.md](EXTEND.md) | 手动账号配置与任务启动确认来源 |
| [references/workflow.md](references/workflow.md) | 详细操作流程 |
| [references/output-layout.md](references/output-layout.md) | 输出根目录和目录层级规则 |
| [references/summary-format.md](references/summary-format.md) | 必需的 Markdown 汇总结构 |
| [references/error-policy.md](references/error-policy.md) | 失败处理与停止条件 |
| [references/file-layout.md](references/file-layout.md) | 原始文件命名和单文件内容格式 |
| [scripts/start_automation_chrome.sh](scripts/start_automation_chrome.sh) | 启动固定自动化 Chrome/CDP 实例 |
| [scripts/extract_xueqiu_posts.mjs](scripts/extract_xueqiu_posts.mjs) | 通过本地 CDP 访问雪球主页并提取结构化帖子 JSON |
| [scripts/extract_wechat_articles.mjs](scripts/extract_wechat_articles.mjs) | 从微信公众号文章链接提取结构化文章 JSON |
| [scripts/task_store.py](scripts/task_store.py) | 状态与去重工具 |
## Weibo Extension

This skill also supports 微博 homepage capture through `scripts/extract_weibo_posts.mjs`.
Saved raw files are Markdown documents that later feed `summary.md`.

## Daily Brief Extension

After the per-author summaries are complete for one target date, also write one date-level brief to `{yyyymmdd}/daily_brief.md`.
This brief must be based on the current saved articles for that date and should follow the structure reference in `demo.md`.
Keep the existing per-author `summary.md` outputs unchanged; `daily_brief.md` is an additional whole-day synthesis.
