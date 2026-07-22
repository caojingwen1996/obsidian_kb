# 冰冰小美仓位操作作图工具

这个工具同时读取 `wiki/topics/冰冰小美-加仓案例合集.md` 与 `wiki/topics/冰冰小美-减仓案例合集.md`，为每个能够映射到证券代码的标的生成一张深色价格折线图。

## 图表口径

- 加仓、建仓、买回和低吸节点使用绿色；减仓、卖出和清仓节点使用红色。
- 精确到日的动作使用同色竖线、圆点和说明框。
- 只精确到周、季度、半年或年份的动作使用同色时间区间带，不虚构具体成交日。
- 每个标的一张图，同一标的的全部加仓与减仓动作画在同一张图中。
- 组合、未披露持仓和无法确认证券代码的条目不作图，统一写入生成报告。
- 行情优先使用 AKShare；接口不可用时自动切换到 Yahoo Finance 复权日线，缓存后可离线重复生成。

## 直接运行

在知识库根目录执行：

```powershell
python .\tools\bbxm-position-action-chart\generate_charts.py
```

默认输出到：

```text
sources/assets/冰冰小美-仓位操作案例图/
```

只生成一个标的：

```powershell
python .\tools\bbxm-position-action-chart\generate_charts.py --only 西部矿业
```

只读取指定案例页时，可以重复使用 `--source`：

```powershell
python .\tools\bbxm-position-action-chart\generate_charts.py --source .\wiki\topics\冰冰小美-加仓案例合集.md
```

只使用本地行情、不联网：

```powershell
python .\tools\bbxm-position-action-chart\generate_charts.py --no-fetch
```

本地行情文件放在 `tools/bbxm-position-action-chart/data/证券代码.csv`。CSV 至少需要两列：`日期,收盘`，也兼容 `date,close`。

## 证券代码

默认代码映射保存在 `config.json`。其中“科创芯片 ETF”暂按 `588200` 映射；如果回溯原帖后确认是其他产品，只需修改配置，不必改程序。

## 依赖

```powershell
pip install akshare yfinance pandas matplotlib
```
