# 中证红利股息率每日信号任务

使用 `zzhl-dividend-signal` skill，每天检查中证红利指数（`000922`）股息率信号，更新既有记录。

## 一、调度约定

- 任务标识：`zzhl-dividend-signal`；维护本任务时先按标识、名称和本文件路径查重，已有调度则原地更新。
- 工作目录：`/Users/cjw/dev/Obsidian/wiki`，使用本地项目目录执行。
- 频率：每天一次，包含周六、周日和法定节假日。
- 执行时间：北京时间 `09:00`，时区 `Asia/Shanghai`。
- 时间依据：现有 `.agents/automations/` 文件未定义统一执行时刻，沿用 `.agents/skills/daily-update/SKILL.md` 中每日 9 AM 的项目维护约定。
- 调度方式：Codex 本地项目自动化读取本文件并执行；Markdown 本身不触发定时运行。项目没有已安装的通用 Markdown 任务调度器，也未安装 `daily-update` 说明中的 launchd 脚本。
- 已注册调度：名称“中证红利每日信号”，Codex automation ID 为 `automation`，创建时状态为 `ACTIVE`。实际调度配置由 Codex 管理，位于 `/Users/cjw/.codex/automations/automation/automation.toml`；以后修改或停用应更新此 ID，不另建同名任务。
- 本地运行条件：电脑开机、Codex 保持运行，项目目录和联网数据源可访问。
- `{RUN_DATE}`：实际执行当天的北京时间日期，格式为 `YYYY-MM-DD`。每次动态计算，不固定为任务创建日期，不将休市日改写成上一交易日。
- 上午运行时，估值、国债和雪球行情可能仍来自上一交易日；保留数据日期与缺口，不称其为当天收盘信号。

## 二、执行前检查

1. 按 UTF-8 读取项目 `AGENTS.md`、`schema.md`、`page-types.md`、`index.md` 和本文件。
2. 读取 `.agents/skills/zzhl-dividend-signal/SKILL.md`，使用其现有数据源、评级规则与输出口径，不在本任务中另建一套信号算法。
3. 确认 `.agents/skills/zzhl-dividend-signal/scripts/check_signal.py` 和 `.agents/skills/zzhl-dividend-signal/strategy-v2.json` 存在。
4. 确认专用 Python 环境可执行且依赖可导入；失败时报告具体缺项，不能记为业务执行成功。恢复环境的命令见下文。
5. 若已有同任务运行未结束，等待其结束后再检查当天结果，不并发写入同一工作簿。

```bash
cd /Users/cjw/dev/Obsidian/wiki
.work/zzhl-dividend-signal/.venv/bin/python -c 'import akshare, pandas, openpyxl'
```

## 三、调用方式

在项目根目录执行以下命令，使用 macOS 路径语法，显式指定时区、记录日期和输出目录：

```bash
cd /Users/cjw/dev/Obsidian/wiki
TZ=Asia/Shanghai .work/zzhl-dividend-signal/.venv/bin/python \
  .agents/skills/zzhl-dividend-signal/scripts/check_signal.py \
  --run-date "$(TZ=Asia/Shanghai /bin/date +%F)" \
  --output-dir /Users/cjw/dev/Obsidian/wiki/sources/automations/中证红利信号
```

该命令沿用原脚本的 AKShare、中证指数和腾讯行情数据获取方式；当前仅用股息率92%与股债倍数8%评分。不要将 SKILL.md 的 PowerShell 反斜杠路径或续行符直接用于 macOS。

首次准备或恢复专用环境时执行；日常运行不重复安装或升级依赖：

```bash
cd /Users/cjw/dev/Obsidian/wiki
/Users/cjw/.local/bin/uv venv --python /Users/cjw/.local/bin/python3.12 .work/zzhl-dividend-signal/.venv
/Users/cjw/.local/bin/uv pip install \
  --python .work/zzhl-dividend-signal/.venv/bin/python \
  -r .agents/automations/zzhl_dividend_signal.requirements.txt
```

依赖版本记录在同目录 requirements 文件中；`.work/` 是项目既有忽略目录，专用环境不进入版本控制。

## 四、数据缺失与重跑

1. 股息率使用既有 `股息率2` 口径；股债倍数=股息率2除以中国10年国债收益率。不再采集或计算历史分位，不用当天涨跌幅修正股息率。
2. 周末、节假日照常运行，保留最新可得的真实估值日期、国债日期；记录日期仍为 `{RUN_DATE}`。
3. 当天行情失败时，按脚本保留“待验证”及来源状态，报告具体缺口。当天涨跌幅列沿用原脚本，但早盘或休市日不得将旧行情描述为当日已发生的涨跌幅。
4. 不执行分位补录，不调用旧 `--llm-lixinger-*` 参数；原始档案的旧分位字段不参与当前评分。
   仅综合评级A可买入；B观察、C等待、D不买入。单项指标评级不代表买入信号，Excel仅高亮综合A级；不得再将B级描述为“加大买入”。
5. 指数估值、历史价格、国债数据或文件写入失败时，报告失败阶段；不得清空原有文件、伪造成功或把缺失数据记成零。
6. 同日重跑复用原输出目录；脚本按 `run_date` 替换当天记录并保留其他日期，不另建工作簿或重复追加当天行。重跑前后核对日期行数，避免并发写入或将部分写入误认作全部完成。

## 五、输出与核验

固定输出到 `sources/automations/中证红利信号/`：

- `中证红利每日信号.xlsx`：每日记录；当天记录恰好一行，既有其他日期记录保留。
- `最新信号.md`：本次运行时间、真实数据日期、两项指标评级、综合结论与来源说明。
- `中证红利年度表现.json`：成立以来逐年收益率、最大回撤及脚本已有的月度收益数据。

脚本退出码为 0 后，还需确认三个文件存在且可读、Markdown 运行日期及工作簿记录日期等于 `{RUN_DATE}`、年度 JSON 的 `indexCode` 为 `000922` 且 `rows` 非空。源数据缺失与旧数据必须单独说明，不能只凭退出码称“全部数据已验证”。

向根目录 `log.md` 追加当日执行结果、实际更新文件和验证边界；没有新增正式 Wiki 页面时，无需重复增加索引条目或调整页面计数。最后用中文简要报告记录日期、实际数据日期、两项指标评级、综合结论、输出位置与未验证项；失败则报告失败原因及仍需处理的步骤。
