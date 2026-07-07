---
name: zzhl-dividend-signal
description: 检查中证红利指数（000922）股息率买入信号：使用 AKShare 数据，按 llmwiki 问题页规则判断近10年股息率分位、绝对股息率区间，以及股息率相对中国10年国债收益率的利差。
---

# 中证红利股息率信号

当用户要求检查、运行、定时触发或记录“中证红利买入信号 / 中证红利股息率信号”时，使用此 skill。

## 执行方式

在 llmwiki 项目根目录运行内置脚本：

```powershell
python .agents\skills\zzhl-dividend-signal\scripts\check_signal.py
```

脚本会执行以下动作：

1. 通过 AKShare `stock_zh_index_value_csindex` 获取中证红利 `000922` 指数估值数据，并优先选取 `股息率2` 作为股息率口径。
2. 通过雪球实时行情接口获取中证红利 `SH000922` 的当天涨跌幅；该涨跌幅日期默认等于记录日期。
3. 通过 AKShare `bond_zh_us_rate` 获取中国10年国债收益率。
4. 优先解析理杏仁公开页面获取中证红利近10年股息率分位和80%分位点；若公开页面失败，由 Codex/大模型通过网页查询核对数值后，用脚本参数传入。
5. 按 `wiki/queries/中证红利什么时候买入收益率最高.md` 中的三种触发规则判断当前信号。
6. 将每日结果写入 `sources/manual/中证红利信号/中证红利每日信号.xlsx`。
7. 将最近一次结果写入 `sources/manual/中证红利信号/最新信号.md`。

## 数据源

本 skill 当前使用 AKShare 免费数据源。脚本依赖的是 AKShare 对外封装后的接口，底层公开数据页面可能随 AKShare 或原始网站调整而变化。

| 数据 | AKShare 接口 | 文档地址 | 脚本用途 |
|---|---|---|---|
| 中证红利指数估值数据 | `stock_zh_index_value_csindex(symbol="000922")` | https://akshare.akfamily.xyz/data/index/index.html | 获取中证红利 `股息率2`，作为绝对股息率和股债利差的计算口径 |
| 中证红利当天行情 | 雪球实时行情 `https://stock.xueqiu.com/v5/stock/realtime/quotec.json?symbol=SH000922` | https://xueqiu.com/S/SH000922 | 获取当天涨跌幅；日期默认等于记录日期，只记录，不修正股息率 |
| 中国10年国债收益率 | `bond_zh_us_rate(...)` | https://akshare.akfamily.xyz/data/bond/bond.html | 获取中国10年国债收益率，用于计算股债利差 |
| 理杏仁指数估值分位 | 理杏仁公开页面 `https://www.lixinger.com/equity/index/detail/sh/000922/922/fundamental/valuation/dyr?metrics-type=mcw` | https://www.lixinger.com/ | 获取中证红利近10年股息率分位和80%分位点 |

股息率口径约定：

- 使用 `股息率2` 作为本 skill 的默认数据源口径。
- 不使用 `股息率1` 作为默认口径。`股息率1` 与 `股息率2` 可能在同一天出现明显差异，例如 2026-06-02 中证红利 `股息率1 = 5.04%`，`股息率2 = 4.83%`。
- 若未来更换数据源，也应优先寻找与 `股息率2` 对应或更接近指数实际权重的估值口径。
- 每天下午运行时，指数估值日期通常仍是上一个交易日；脚本会保留该估值日期和 `股息率2`，并额外记录雪球当天涨跌幅。雪球当天涨跌幅的日期默认等于同一行的记录日期，不单独写入行情日期列；不用当天涨跌幅修正股息率。
- 当前 AKShare 指数估值接口可能只返回最近一段数据，不一定足以直接计算真正的“近10年股息率分位”。若要严格执行历史分位点规则，应接入完整历史股息率2数据源后再计算分位。
- 近10年历史分位点不使用 AKShare 短窗口计算，而使用理杏仁分位数据。
- 不再调用理杏仁 Open API。公开页面失败时，不要编造数值；应由 Codex/大模型通过网页搜索或浏览器查询到可核验数值后，使用以下参数传入脚本：

```powershell
python .agents\skills\zzhl-dividend-signal\scripts\check_signal.py `
  --llm-lixinger-date "2026-07-03" `
  --llm-lixinger-dividend-yield "4.66" `
  --llm-lixinger-percentile-10y "30.44" `
  --llm-lixinger-percentile-80-value "6.12" `
  --llm-source-note "Codex/大模型网页查询：说明查询页面或检索来源"
```

如果需要人工核对原始指数页面，可从中证指数官网查询中证红利 `000922`：

```text
https://www.csindex.com.cn/
```

## 判断规则

### 历史分位点

- 股息率分位 >= 80%：A（重点买入）。
- 股息率分位 >= 70%：B（加大买入）。
- 股息率分位 < 50%：D（不买或少买）。
- 其他情况：C（小额定投）。

### 绝对股息率

- < 4.0%：D（不买或少买）。
- 4.0%-5.0%：C（小额定投）。
- 5.0%-6.0%：B（加大买入）。
- > 6.0%：A（重点买入）。

### 股息率相对10年国债收益率

- 利差 < 1.5%：D（不买或少买）。
- 利差 1.5%-2.5%：C（小额定投）。
- 利差 > 2.5%：B（加大买入）。
- 利差 > 3.0%：A（重点买入）。

## 综合结论

三类信号统一使用以下四档等级，Excel 文件中的三类信号列只写字母：

```text
D = 不买或少买
C = 小额定投
B = 加大买入
A = 重点买入
```

当历史分位点、绝对股息率、股债利差三类信号中，至少两个达到 B 或 A 时，综合结论标记为“加大买入区间”，并将该天 Excel 数据行标黄。

## 注意事项

- 本 skill 只做规则检查和记录，不构成投资建议。
- 如果自动化环境缺少 AKShare，需要先在该 Python 环境中安装 `akshare`。
- 如果自动化环境缺少 openpyxl，需要先在该 Python 环境中安装：`pip install openpyxl`。
- 如果免费数据源字段、接口或口径变化，应明确报告失败原因，不要编造数值。
