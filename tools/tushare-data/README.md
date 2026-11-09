# Tushare 数据接口：安装与调用

版本：0.9.0。用户账户的统一访问层位于 `/Users/cjw/dev/Obsidian/wiki/tools/tushare-data`。Python 项目与 MCP 调用相同的共享实现，不需要在每个业务项目重新编写请求、缓存、历史分段或 ETF 复权代码。

完整参数、返回字段、单位、错误类型和示例见[[tools/tushare-data/docs/api-reference|API接口文档（0.9.0）]]。本文负责安装、凭证与快速调用。

| 接入方式 | 调用入口 | 当前支持 |
| --- | --- | --- |
| Python行情接口 | `MarketData.query(name, **params)` | 13个接口，统一结果结构 |
| Python底层接口 | `TushareClient.call(dataset, **params)` | 28个数据集，返回记录列表 |
| MCP工具 | stdio JSON-RPC `tools/call` | 27个工具，其中13个与Python行情接口同名、同实现 |
| HTTP / REST API | 无 | 未提供URL、端口或HTTP路由，不能用curl直接请求本项目 |

“共享”只表示多个项目使用同一份读取代码，不是一种接口协议。看板来源状态见[[tools/a-share-market-dashboard/docs/data-source-policy|来源规则]]；原Excel和审计JSON保留为迁移前快照。

## 其他 Python 项目直接使用

在使用数据的项目 Python 环境中安装一次本地包（Python 3.9+，编辑安装要求pip 21.3+；旧版pip先升级）：

```bash
python3 -m pip install --upgrade pip
python3 -m pip install -e /Users/cjw/dev/Obsidian/wiki/tools/tushare-data
```

这会安装 `local-tushare-data` 及其 Tushare 依赖；编辑安装使后续共享目录修复直接生效。代码可以从任意工作目录运行：

```python
from tushare_client import TushareClient
from tushare_market_data import MarketData

data = MarketData(TushareClient())
result = data.query(
    "get_fund_daily",
    ts_code="159941.SZ",
    start_date="2024-01-01",
    end_date="2026-11-05",
    adjustment="qfq",
)
prices = result["rows"]
print(result["status"], result["observed_end"], result["row_count"])
```

若暂不安装，可在调用进程的 `PYTHONPATH` 中加入本目录的 `scripts` 绝对路径，调用代码不变。旧 `TushareClient.call()`、`call_frame()`、`daily()`、`daily_basic()` 等接口继续保留。按原字段取数也可使用：

```python
client = TushareClient()
rows = client.history(
    "index_daily", "2024-01-01", "2026-11-05",
    ts_code="000922.CSI", fields=["close", "high"],
)
# history 自动保留 ts_code 与日期字段，用于身份检查、去重和排序。
```

## 凭证与存储

凭证顺序：环境变量 `TUSHARE_TOKEN` / `TUSHARE_PRO_TOKEN` → 共享目录 `.env` → 调用方显式传入的额外 `.env` → 知识库根 `.env`。不把 Token 放入代码、MCP 参数、文档、输出或日志。

本机已有凭证目前由看板 `.env` 提供；本轮未移动或复制。若需要复用已有文件，可显式配置路径：

```python
client = TushareClient(extra_env_paths=[
    "/Users/cjw/dev/Obsidian/wiki/tools/a-share-market-dashboard/.env"
])
data = MarketData(client)
```

长期跨项目调用建议在各项目进程中设置同一个环境变量，或由用户自行配置共享目录 `.env`；单独启动 MCP 不会隐式读取看板 `.env`。编辑安装默认使用共享目录缓存；普通非编辑安装默认使用 `~/.tushare-data`，可通过 `TUSHARE_DATA_HOME` 指定配置和缓存目录。历史兼容代码仍允许读取看板现有 `vendor/python` 依赖，但新项目通过上述安装命令独立安装依赖即可。

## Python行情接口目录（13个）

通过 `MarketData.query()` 调用下列名称。每个接口均要求 `start_date`、`end_date`；可选 `use_cache`、`limit`。外汇代码可省略，默认USDJPY.FXCM。详细参数见[[tools/tushare-data/docs/api-reference|API接口文档]]。`get_fund_daily`等名称是query参数，不是MarketData对象上的同名方法。

| Python query 名称 / MCP 工具名 | 数据集与输出 | 对应清单 |
| --- | --- | --- |
| `get_southbound_flow` | `ggt_daily`，买入成交额减卖出成交额，返回原始字段与完整标记 | 南向资金净买入 |
| `get_fund_daily` | `fund_daily`，可选none/qfq/hfq；前后复权同时读取fund_adj | 159941加仓计划日线、515450价格与收益基础输入 |
| `get_fund_adjustments` | `fund_adj`，每日因子 | ETF复权校验 |
| `get_index_daily` | `index_daily`，国内指数OHLC | 中证红利、上证综指、沪深300、中证全指日线及本地均线/布林输入 |
| `get_index_valuation` | `index_dailybasic`，PE/PE-TTM/PB等 | 沪深300估值基础数据；与原中证算法尚未做等价认定 |
| `get_global_index_daily` | `index_global`，SPX等国际指数 | 标普500/MA200基础输入；不把IXIC当NDX |
| `get_shibor` | `shibor`，含on隔夜；无需代码 | 隔夜Shibor |
| `get_market_turnover` | `daily_info`，沪深同日成交额合计；无需代码 | 沪深成交额 |
| `get_etf_flow_estimate` | fund_basic、fund_share、fund_nav、trade_cal；最多32自然日 | 股票型ETF份额变化×净值估算，含港股通、排除QDII |
| `get_market_margin_ratio` | `margin` + `daily_info.float_mv`，同日融资余额占沪深股票市场流通市值 | 融资占比，含B股、排除北交所 |
| `get_market_margin_history` | `margin`，沪深融资余额、买入、偿还与净买入；无需代码 | 融资余额/融资净买入 |
| `get_us_treasury_curve` | `us_tycr`，全期限及同日10Y−2Y；无需代码 | 美国10年收益率、期限利差 |
| `get_fx_daily` | `fx_daily`，保留bid/ask；默认USDJPY.FXCM | 美元兑日元日线 |

底层数据集总数28，MCP工具总数27。其余14个MCP工具不能传给 `MarketData.query()`，参数和返回结构见[[tools/tushare-data/docs/api-reference|API接口文档]]；精确声明见[接口定义JSON](docs/api-schema.json)。旧 `get_market_margin` 保留原返回结构，新项目使用 `get_market_margin_history` 获取带完整性标记的沪深汇总。

## 返回口径与边界

- `rows` 按日期升序；`limit=N` 返回最后N行。`total_row_count`、`observed_start/end`、`latest` 始终针对完整请求区间，`truncated` 表明展示是否截断。
- `status` 为 `ok` / `empty` / `partial`。空返回不填零；沪深缺一市场或核心数值缺失时不形成完整合计。无权限或网络失败抛出 `TushareClientError`，MCP 返回 `isError=true`；不返回已读取的部分区间伪装成功。
- `served_at` 是本次服务响应时间，不是行情观测时间，也不证明缓存刚从上游刷新。缓存默认300秒，`use_cache=False` 跳过缓存读取并刷新缓存；不会在上游失败时静默退回过期缓存。
- 单标的按最多366个自然日分段读取，合并去重，拒绝身份不匹配及冲突记录。该分段长度低于本轮日频接口已知行数上限；没有交易日历核验，仍不能承诺上游逐交易日完整。
- ETF前复权以**请求区间内最后一条价格日期**的因子为基准：原价×当日因子÷基准因子。后复权为原价×当日因子。日期逐一对应，不前向填充缺失因子。改变请求截止日可能改变前复权基准，结果给出 `anchor_date/factor`。
- 复权输出保留原始行 `raw`，成交量、成交额不调整；昨收/涨跌按相邻返回的复权收盘计算，首行留空。不是盘中行情，不保证与腾讯/东财前复权算法逐位一致。
- ETF价格为元，成交额为千元、成交量为手；`daily_info.amount` 已是亿元，不再除1亿。融资原字段为元，另提供亿元字段；收益率与Shibor为百分数，10Y−2Y为百分点。指数估值市值按Tushare文档为元。字段单位随结果返回。
- 基金与国内指数必须明确市场后缀；不猜测 `000001` 是股票还是指数。国际指数使用Tushare代码 `SPX`，而不是Wind代码。美元兑日元保留bid/ask，不用ask补充缺失bid，也不强行过滤外汇周末记录。
- 本轮不封装权限不足的市场大小单资金、中债曲线，也不宣称解决DXY、NDX、股息率2、ETF现金分红及盘中前高缺口。均线、回撤次数和策略评分继续属于业务计算。

## MCP 启动与调用

安装后执行 `tushare-data-mcp`，或直接启动：

```bash
python3 /Users/cjw/dev/Obsidian/wiki/tools/tushare-data/scripts/mcp_server.py
```

这是 stdio JSON-RPC 服务，不是 HTTP 服务；运行中的旧进程需要重新启动才能发现新增工具。调用参数示例：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_fund_daily","arguments":{"ts_code":"159941.SZ","start_date":"2024-01-01","end_date":"2026-11-05","adjustment":"qfq"}}}
```

## 验证与维护

在知识库根目录运行单元测试：

```bash
python3 -m unittest discover -s tools/tushare-data/tests -v
```

可选真实账号检查（会访问Tushare，输出只含状态和覆盖信息）：

```bash
python3 tools/tushare-data/scripts/smoke_market_data.py \
  --start-date 2026-11-01 --end-date 2026-11-05 \
  --env-file tools/a-share-market-dashboard/.env \
  --output tools/tushare-data/verification/2026-11-06-smoke.json
```

本轮真实记录：[14组短窗口检查](verification/2026-11-06-smoke.json)、[ETF与SPX跨年历史检查](verification/2026-11-06-history.json)。样本成功不代表所有证券都有权限或全历史完整。维护变更记录在[[tools/tushare-data/log|本工具日志]]；修改代码、接口或文档时追加日志并执行相关测试。

官方依据：[ETF日线](https://tushare.pro/document/2?doc_id=127)、[复权因子](https://tushare.pro/document/2?doc_id=199)、[国内指数日线](https://tushare.pro/document/2?doc_id=95)、[指数估值](https://tushare.pro/document/2?doc_id=128)、[国际指数](https://tushare.pro/wctapi/documents/211.md)、[Shibor](https://tushare.pro/document/2?doc_id=149)。
