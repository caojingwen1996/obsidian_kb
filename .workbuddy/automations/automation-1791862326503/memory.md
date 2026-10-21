# 冰冰小美每日汇总 - 自动化执行记忆

## 2026-10-20（22:00 轮）— 空结果日 + 发现 10-18/10-19 漏跑
- 目标日期 2026-10-20：timeline API 4页77条 + DOM all-visible 30条双通道核验，当日 0 帖（最新帖 10-19 19:29）。空风险清理 → upsert `no_risk` → 已删除 10-20 日期文件。未加载风险识别技能。
- **发现 10-18/10-19 漏跑**：两天无运行记录。10-18 无帖（时间线无 10-17/10-18 帖；月目录残留 `2026-10-18_processing_extract.json` 为空 extract，待人工清理）。**10-19 有 3 条帖子未抓：412869898(14:10 等10-23业绩报/储存/费半)、412879807(15:04 发帖方式建议)、412911470(19:29 留言板更新)**，需按同日重跑补抓并做风险分析。
- 抓取改用 timeline API 通道（extract_xueqiu_timeline_api.mjs），比 DOM 逐页快且稳；DOM 核验用 --capture-scope all-visible --max-posts 30（脚本不允许 max-posts 0）。

## 2026-10-17（13:47 轮）— 空结果日 + 发现漏跑 + 补抓 + 建立状态机制
- 目标日期 2026-10-17：0 候选（daily），all-visible 核验 24 条 newest=2026-10-16 16:36，确认当日无帖。空风险清理 → upsert `no_risk` → 删除日期目录。未生成 summary.md/操作.md/task.log。
- **发现历史漏跑**：查 `automation_runs`/`runtime_state` 发现 2026-10-16 22:20 调度执行被中断（result_success=0，last_error=Request cancelled 499），当日 8 条帖全部漏抓；10-13 执行亦失败。因空结果日删目录，「跑了没帖」与「没跑」在文件上同形，漏跑无痕迹无告警。
- **补抓 2026-10-16**：8 条原帖已保存（HHMMSS 命名+标签），五步法风险分析 qualified 5（R3×1 医药崩盘带崩指数、R2×2 ETF尾盘放量脆弱/交割日托而不举、W2×2 创业板金叉/阶段底持有机会），not_written 3（图片持仓帖待验证、两条闲谈 N）。Excel `written count=5`。summary.md 已生成。无明确买卖信号，未生成 操作.md。
- **建立每日运行状态追踪**：新增 `sources/automations/BBXM每日汇总/_运行状态.md`（✅/⭕/❌/⚠️，空结果日也留痕），已写入任务文件第九节与自动化 prompt 第 10 步，回填 10-13～10-17 历史。**以后每次运行必须更新此文件**。
- 坑：`qualified.published_at` 必须带 `T` 和 UTC 偏移（如 `2026-10-16T12:07:00+08:00`），`evidence` 必须是非空文本数组，否则 upsert 判 `blocked`。

## 2026-10-15（22:00 轮）— 正常完成
- 目标日期 2026-10-15，抓取候选 20 条（含 2 条旧日期 feed 混入帖未保存），目标日期 18 条全部保存原帖。
- 已调用 bbxm-risk-identification 五步法；qualified 5（R2×3 R3×1 W3×1），not_written 13（待验证×1：142100 融资市帖）。Excel upsert status=written count=5。
- summary.md、操作.md（买入信号 5 条：创业板建仓+做多费城半导体）已生成；项目 log.md 已追加。
- 边界：214200 图片帖正文未提取，观点依作者评论；技能 SKILL.md 引用的 风险观察与演绎/topics风险来源页/handoff-contract.md 三处路径不存在。
- 遗留待人工：2026-10-13 残留目录（15 条候选未保存）、Excel 陈旧锁文件、技能引用路径修正。

## 2026-10-14（22:00 轮）— 空结果日
- 目标日期 2026-10-14，两轮抓取 0 候选 + 独立 DOM 核验（最新帖 2026-10-13 19:45），确认当日无帖。
- 空风险清理：hollow risk-analysis.json → upsert_automated_risk.py → no_risk → 已删除日期目录 sources/automations/BBXM每日汇总/2026/10/2026-10-14。
- 项目 log.md 已追加记录。
- 遗留待人工：2026-10-13 残留目录仅存 processing/extract.json（15 条候选帖未保存原帖、无汇总无风险分析），昨日轮次疑似中断；Excel 陈旧锁文件 ~$冰冰小美风险提示.xlsx 待确认清理。

## 环境备忘（macOS）
- CDP 自动化 Chrome 常驻 127.0.0.1:9333；node 用 /Users/cjw/.workbuddy/binaries/node/versions/22.22.2-3/bin/node，脚本在 .agents/skills/cjw-xueqiu-daily-monitor/scripts/ 下执行。
- upsert_automated_risk.py 需 openpyxl，已装入隔离 venv：/Users/cjw/.workbuddy/binaries/python/envs/default/bin/python。
- 日期目录格式为 {YEAR}/{MONTH}/{DATE}（带横线），历史轮次用 processing/ 下临时保存脚本落盘，不用 content_task.py 默认 %Y%m%d 布局。
- 空结果处置流程参照 log.md 2026-09-24 与 2026-10-14 条目。
