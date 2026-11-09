# Tushare API接口文档

版本：0.9.0。代码目录：/Users/cjw/dev/Obsidian/wiki/tools/tushare-data。文档核对日期：2026-11-09。本文描述当前实现，不以开发批次命名接口。

安装与凭证见[[tools/tushare-data/README|安装与调用说明]]。精确声明见[api-schema.json](api-schema.json)，包含27个MCP工具的JSON Schema、28个底层数据集的允许参数、必填参数和默认字段。注册接口数量不代表账户对全部标的均有权限。

## 1. 接口类型

| 类型 | 入口 | 返回类型 | 用途 |
| --- | --- | --- | --- |
| Python行情接口 | MarketData(client=None).query(name, **params) | dict | 13个行情服务，统一元数据和结果结构 |
| Python数据集接口 | TushareClient(...).call(dataset, **params) | list[dict] | 按原始字段读取28个注册数据集 |
| Python历史接口 | TushareClient(...).history(dataset, start_date, end_date, **params) | list[dict] | 指定11个日频数据集的分段历史读取 |
| MCP | 标准输入/输出JSON-RPC，tools/list、tools/call | JSON-RPC响应 | Agent调用27个工具 |
| HTTP接口 | 无 | 无 | 当前没有URL、端口、REST路由或HTTP鉴权方式 |

Python调用不需要启动MCP进程。MCP复用同一Python读取层，并非独立数据源。没有data.get_fund_daily()方法，正确调用为data.query("get_fund_daily", ...)。

## 2. Python行情接口：公共参数

~~~python
from tushare_client import TushareClient
from tushare_market_data import MarketData

client = TushareClient()  # 从环境变量或配置文件解析凭证
data = MarketData(client)

# 函数签名：tool之后全部使用关键字参数
# data.query(tool, *, start_date, end_date, ts_code=None,
#            adjustment="none", use_cache=True, limit=None)
~~~

| 参数 | Python类型 | 必填 | 默认值 | 规则 |
| --- | --- | --- | --- | --- |
| tool | str | 是 | 无 | 第4节的13个名称之一；MCP中放在params.name |
| start_date | str | 是 | 无 | 起始日期，含当天；YYYY-MM-DD或YYYYMMDD |
| end_date | str | 是 | 无 | 结束日期，含当天；不得早于起始日期 |
| ts_code | str或None | 依接口 | None | 单一标的；不接受代码列表；是否必填及代码格式见第4节 |
| adjustment | str | 否 | "none" | 只有ETF日线可取none/qfq/hfq；其他Python接口保持默认，其他MCP工具不接收此参数 |
| use_cache | bool | 否 | True | False跳过缓存读取，成功后仍刷新缓存 |
| limit | int或None | 否 | None | 1～10000；返回最后N条，仍按日期升序；None返回全部 |

行情接口不接受fields、trade_date、offset或任意Tushare参数。需要选择原始字段时使用第6节。单日查询设置start_date=end_date；非交易日可能为空。接口不会自动替用户排除“今日”，调用方需要选择已发布的日线日期。

## 3. Python行情接口：公共返回结构

下面字段适用于全部13个行情接口；rows中的字段见第4节。Python空值为None，JSON空值为null。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| provider | str | 固定Tushare |
| dataset | str | 底层数据集名称；复权ETF仍为fund_daily |
| frequency | str | daily，日频，不表示每天都有记录 |
| status | str | ok有记录；empty无记录；partial用于沪深汇总存在缺市场或核心数值 |
| units | dict | 字段或字段组单位；例如prices表示OHLC组，并非逐个字段都列出 |
| requested_start、requested_end | str | YYYY-MM-DD格式的请求区间 |
| observed_start、observed_end | str或None | 完整请求结果第一/最后观测日；空结果为None |
| served_at | str | 本次响应UTC时间（ISO 8601）；不是观测日或上游刷新时间 |
| rows | list[dict] | 日期升序，受limit限制 |
| row_count | int | 返回rows的长度 |
| total_row_count | int | 应用limit前的记录数 |
| truncated | bool | limit是否截短rows；不表示上游历史是否完整 |
| latest | dict或None | 整个请求结果最后一条，与limit无关；汇总时可能是不完整记录 |
| coverage_note | str | 覆盖说明；未进行交易日历逐日核验，ok不代表全历史完整 |

ETF、因子、指数、Shibor、美债、外汇另有requested_code和adjustment；无需代码的接口中requested_code为None。沪深汇总改为返回market_scope，不含这两个字段。ETF的复权元数据见4.1。

partial检查整个请求区间，早期缺失被limit截去后仍为partial。missing_markets只标记缺少记录的市场：记录存在但数值缺失时，missing_markets可以是空列表而complete=False。两市场某日同时无记录时，不生成该日占位行；不能仅凭status识别休市或上游漏数。

返回示例（模拟值，不是实际行情）：

~~~json
{
  "provider": "Tushare",
  "dataset": "daily_info",
  "frequency": "daily",
  "status": "partial",
  "units": {"amount": "CNY_hundred_million", "turnover_yi": "CNY_hundred_million"},
  "requested_start": "2026-11-02",
  "requested_end": "2026-11-02",
  "observed_start": "2026-11-02",
  "observed_end": "2026-11-02",
  "served_at": "2026-11-06T00:00:00+00:00",
  "rows": [{"trade_date": "2026-11-02", "complete": false, "missing_markets": ["SZ_MARKET"], "amount": null, "turnover_yi": null}],
  "row_count": 1,
  "total_row_count": 1,
  "truncated": false,
  "latest": {"trade_date": "2026-11-02", "complete": false, "missing_markets": ["SZ_MARKET"], "amount": null, "turnover_yi": null},
  "coverage_note": "Observed rows only; no trading-calendar completeness claim. served_at is not the observation or upstream refresh time.",
  "market_scope": ["SH_MARKET", "SZ_MARKET"]
}
~~~

## 4. 行情接口逐项说明

以下示例复用第2节的data对象。代码和日期输出为str，日期格式YYYY-MM-DD。行情数值通常由供应商SDK给出；本库不对全部原始字段强制转换类型，缺失值保留None。

### 4.1 get_fund_daily：ETF日线

ts_code必填，六位代码加.SH或.SZ，例如159941.SZ、515450.SH。底层fund_daily；adjustment默认none，可选qfq/hfq。

~~~python
result = data.query("get_fund_daily", ts_code="159941.SZ",
                    start_date="2026-01-01", end_date="2026-11-05",
                    adjustment="qfq")
~~~

| rows字段 | 类型 | 含义／单位 |
| --- | --- | --- |
| ts_code、trade_date | str | 基金代码、交易日 |
| open、high、low、close | number或None | 开高低收，元；复权时为调整后价格 |
| pre_close、change、pct_chg | number或None | 昨收元、涨跌额元、涨跌幅百分数 |
| vol、amount | number或None | 成交量手、成交额千元；复权时不调整 |
| raw | dict | 仅qfq/hfq且有数据时存在；完整原始行情行 |
| adj_factor | number | 仅qfq/hfq且有数据时存在；当日因子 |

额外顶层字段：adjustment、requested_code、anchor_date、anchor_factor、adjustment_rule。none或空结果时anchor_date/factor为None。

- none：原价，不取因子。
- qfq：原价×当日因子÷**请求区间最后价格日期的因子**。基准在limit之前确定；改变截止日可能改变前复权价格。
- hfq：原价×当日因子。仍记录区间末因子/日期，但不用于除法归一。
- 因子按价格日期逐一对应，缺失、非正或非有限时报错；OHLC不合法时报错，不返回部分复权结果。
- 复权pre_close使用相邻上一条返回记录的复权close，change/pct_chg重算，第一条均为None；原始值在raw内。

不提供盘中前高、网格买入价；不保证与其他供应商前复权算法逐位相同。

### 4.2 get_fund_adjustments：基金复权因子

ts_code必填，格式同4.1。底层fund_adj，不返回价格。

~~~python
result = data.query("get_fund_adjustments", ts_code="515450.SH",
                    start_date="2026-01-01", end_date="2026-11-05")
~~~

rows字段：ts_code:str、trade_date:str、adj_factor:number或None，因子无货币单位。原始因子接口保留供应商数值；4.1复权计算才要求价格对应的因子全部有效。顶层adjustment固定none。

### 4.3 get_index_daily：国内指数日线

ts_code必填，六位代码加.SH/.SZ/.CSI/.CNI。格式合法不保证实际覆盖。示例：000001.SH上证综指、000300.SH沪深300、000922.CSI中证红利、000985.CSI中证全指。无后缀代码会被拒绝。

~~~python
result = data.query("get_index_daily", ts_code="000922.CSI",
                    start_date="2024-01-01", end_date="2026-11-05")
~~~

底层index_daily。rows字段：ts_code、trade_date；open/high/low/close/pre_close/change为指数点；pct_chg为百分数；vol为手、amount为千元。数值为number或None。顶层adjustment=none。不计算均线、布林带或回撤；不把价格指数替换为全收益指数。

### 4.4 get_index_valuation：国内指数估值

ts_code必填，格式同4.3。底层index_dailybasic，示例000300.SH。

~~~python
result = data.query("get_index_valuation", ts_code="000300.SH",
                    start_date="2026-01-01", end_date="2026-11-05")
~~~

| rows字段 | 含义／单位 |
| --- | --- |
| ts_code、trade_date | 代码与日期，str |
| pe、pe_ttm、pb | 市盈率、滚动市盈率、市净率，倍数 |
| total_mv、float_mv | 总市值、流通市值，按Tushare该接口定义为元 |
| total_share、float_share、free_share | 总股本、流通股本、自由流通股本，股 |
| turnover_rate、turnover_rate_f | 换手率、自由流通股本换手率，百分数 |

数值为number或None。units只列pe_ttm、total_mv、float_mv。此接口不返回股息率2、预期PE、历史分位；采用Tushare估值口径，不自动等价于中证官网算法。

### 4.5 get_global_index_daily：国际指数日线

ts_code必填，使用Tushare代码，如SPX标普500；不要用Wind代码NDX.GI。实际支持以供应商覆盖及账户权限为准，不因NDX无数据而自动改查IXIC。

~~~python
result = data.query("get_global_index_daily", ts_code="SPX",
                    start_date="2024-01-01", end_date="2026-11-05")
~~~

底层index_global。rows字段：ts_code、trade_date；open/high/low/close/pre_close/change为指数点；pct_chg和swing为百分数；vol使用供应商原始成交量单位。数值为number或None。不返回amount或估值，不自动将外国交易日转换为中国日期。

### 4.6 get_shibor：Shibor利率

不传ts_code，底层shibor。

~~~python
result = data.query("get_shibor", start_date="2026-01-01", end_date="2026-11-05")
overnight = result["latest"]["on"] if result["latest"] else None
~~~

rows字段：date:str；on隔夜、1w/2w一/两周、1m/3m/6m/9m对应月份、1y一年，均为number或None，单位百分数。1.5表示1.5%，不是0.015。日期字段是date，不是trade_date。

### 4.7 get_market_turnover：沪深股票成交额

不传ts_code。分别读取daily_info的SH_MARKET与SZ_MARKET，同日相加；不含北交所，保留沪深股票统计边界。

~~~python
result = data.query("get_market_turnover", start_date="2026-11-01", end_date="2026-11-05")
complete_rows = [r for r in result["rows"] if r["complete"]]
~~~

rows字段：trade_date:str、complete:bool、missing_markets:list[str]、amount:number或None、turnover_yi:number或None。amount和turnover_yi均为**亿元**且数值相同，不能再次除1亿。market_scope为["SH_MARKET", "SZ_MARKET"]。任一市场记录或amount缺失，该日合计为None，complete=False。

### 4.8 get_market_margin_history：沪深融资余额与净买入

不传ts_code或exchange_id。读取margin，只使用SSE、SZSE，排除BSE；汇总融资部分，不汇总融券部分。

~~~python
result = data.query("get_market_margin_history", start_date="2026-11-01", end_date="2026-11-05")
~~~

| rows字段 | 类型 | 含义／单位 |
| --- | --- | --- |
| trade_date | str | 交易日 |
| complete、missing_markets | bool、list[str] | 核心数据是否完整、缺少记录的市场 |
| rzye | number或None | 沪深融资余额合计，元 |
| rzmre、rzche | number或None | 融资买入额、融资偿还额，元 |
| financing_balance_yi | number或None | rzye÷1亿，亿元 |
| financing_net_buy_yi | number或None | (rzmre−rzche)÷1亿，亿元，可为负 |

market_scope为["SSE", "SZSE"]。各字段分别检查两市场完整性：余额有效但买入缺失时，余额可能有值、净买入None、complete=False；不以0补缺。

### 4.9 get_us_treasury_curve：美债曲线与10Y−2Y

不传ts_code，读取us_tycr所有已注册期限字段。

~~~python
result = data.query("get_us_treasury_curve", start_date="2026-01-01", end_date="2026-11-05")
~~~

rows字段：date:str；m1/m2/m3/m6为对应月期，y1/y2/y3/y5/y7/y10/y20/y30为对应年期，数值为number或None，单位百分数；spread_10y_2y为同一行y10−y2，单位百分点。任一腿缺失则利差None，不跨日拼接。例如4.5−4.0=0.5个百分点。

### 4.10 get_fx_daily：外汇日线

ts_code可省略，默认USDJPY.FXCM。其他代码需确认覆盖，格式为带来源后缀的外汇代码；格式合法不等于有数据。

~~~python
result = data.query("get_fx_daily", ts_code="USDJPY.FXCM",
                    start_date="2026-11-01", end_date="2026-11-05")
~~~

底层fx_daily。rows字段：ts_code、trade_date；bid_open/bid_high/bid_low/bid_close与ask_open/ask_high/ask_low/ask_close为买方/卖方OHLC报价，单位为每单位基础货币对应的报价货币（USDJPY为日元/美元）；tick_qty为报价计数。数值为number或None。

不合并bid/ask，不提供统一close字段，不自动过滤周末或评定风险等级。USDOLLAR.FXCM此前样本为空，接口存在不表示DXY缺口已解决。

### 4.11 get_market_margin_ratio：融资余额占流通市值

不传ts_code。分子使用margin的SSE、SZSE融资余额rzye（元）；分母使用daily_info的SH_MARKET、SZ_MARKET流通市值float_mv（亿元），只按同日配对。

~~~python
result = data.query("get_market_margin_ratio", start_date="2024-08-28", end_date="2026-11-06")
valid_rows = [row for row in result["rows"] if row["complete"]]
~~~

| rows字段 | 类型／单位 | 含义 |
| --- | --- | --- |
| trade_date | str | 观测日，YYYY-MM-DD |
| financing_balance_yi | float或None／亿元 | 沪深融资余额，原rzye合计除1亿 |
| float_market_cap_yi | float或None／亿元 | 沪深股票市场流通市值；含B股、排除北交所 |
| financing_ratio_pct | float或None／% | financing_balance_yi ÷ float_market_cap_yi × 100 |
| complete | bool | 四个同日输入均有效；融资余额允许0，市值必须大于0 |
| missing_inputs | list[str] | 缺失或无效的SSE、SZSE、SH_MARKET、SZ_MARKET |

返回dataset为margin+daily_info，另外含market_scope、denominator_scope、calculation、scope_note。任一天输入不齐时status为partial，该天比例为None；不跨日补值、不用total_mv替代、不将日线股票样本相加冒充完整市场。limit仍只裁剪返回行，latest可能为尚未完整的最新日期，调用方须检查complete。

这是交易所融资余额相对沪深股票市场流通市值的观察比例：分子按交易所全部两融标的统计，分母为股票市场（含B股），不等同“仅融资标的股票融资占比”，也不宣称与原东方财富LTSZ逐位一致。平台数据若修订，重新读取会更新；无交易日历保证。官方字段：[融资余额](https://tushare.pro/document/2?doc_id=58)、[市场汇总流通市值](https://tushare.pro/document/2?doc_id=215)。

### 4.12 get_etf_flow_estimate：ETF申赎净流入估算

~~~python
result = data.query("get_etf_flow_estimate", start_date="2026-10-29", end_date="2026-11-05")
latest = result["latest"]
# complete为False时，net_flow_yi为None；sample_net_flow_yi只能标为样本估算。
~~~

起止日期跨度最多31天（含首尾32自然日），不接收ts_code。范围为Tushare名单中股票型、名称含ETF且非联接、非QDII、沪深上市的基金，包含港股通；不含债券、货币、商品。使用有明确上市日期且前一交易日已上市的样本；退市日及之后排除，新上市首日不计作申购流入。上市日期不明基金单列，不宣称全市场覆盖。

公式为（当日fund_share.fd_share − 前一交易日fd_share）× 当日fund_nav.unit_nav ÷ 10000，单位亿元（份额原单位万份，净值元）。沪深trade_cal必须一致，按真实前一交易日取数，不把跨多日差额当单日。不使用收盘价、IOPV盘中值、规模差额或申赎清单额度代替。

| rows字段 | 含义 |
| --- | --- |
| trade_date、previous_trade_date | 当日与上一交易日；连续交易日配对 |
| complete | 所有符合条件输入完整，且无上市日期不明名单时为True |
| net_flow_yi | 完整估算，输入不全时None |
| sample_net_flow_yi | 有效基金样本合计；无有效基金时None，有效零值保留0 |
| coverage.expected、received | 明确上市日期的应纳入数、实际有效数 |
| coverage.newly_listed | 新上市首日，未算作净申购 |
| coverage.unknown_listing_date | 上市日期不明，未纳入名单 |
| excluded | 应纳入但缺份额／净值／复权校验，或公司行为待核实的基金 |
| funds | 有效基金逐只份额变化（万份）、当日单位净值和估算额（亿元） |

拆分／分红检查：比较两日adj_nav/unit_nav，变化超过0.1%时标corporate_action_review并剔除；不把含分红的复权因子直接当拆分比例。此为保守异常筛查，不是完备的公司行为数据库，可能排除正常分红日，无法保证识别全部微小折算或上游错误。现金分红本身不是申赎。样本不完整时status为partial、净流入合计留空，只允许显式显示样本金额。

按市场分开读取fund_share，触及2000条上限报错，不接受截断。fund_nav按日期和证券检查，日期不匹配、重复证券或日历不一致报错，不跨日补净值。基金名单身份与分类依赖Tushare当前资料，长历史分类变化不作回溯保证。

本接口通过Tushare转供份额和净值，未直接采集交易所PCF；因此来源不得写“交易所直接披露的净流入”。份额差法估算申赎对价，不等同现金实际到账额（ETF可能实物申赎）。本账号对新版etf_share_size及etf_basic权限不足，不使用这两个接口。官方字段说明：[份额](https://tushare.pro/document/2?doc_id=207)、[单位净值](https://tushare.pro/document/2?doc_id=119)、[基金名单](https://tushare.pro/document/2?doc_id=19)。

### 4.13 get_southbound_flow：南向资金净买入

数据集：`ggt_daily`。`start_date`、`end_date`必填，支持YYYY-MM-DD或YYYYMMDD；可选`use_cache`、`limit`。不接受`ts_code`或复权参数。统一history按不超过366自然日分段，并按日期去重排序。

```python
result = data.query("get_southbound_flow", start_date="2026-11-02", end_date="2026-11-06")
```

| 行字段 | 含义与单位 |
|---|---|
| `trade_date` | 交易日期，YYYY-MM-DD |
| `buy_amount` / `sell_amount` | 原始买入／卖出成交金额，沿用接口亿元单位 |
| `buy_volume` / `sell_volume` | 原始买入／卖出成交笔数，万笔；不是股数 |
| `net_buy_yi` | 同日buy_amount减sell_amount，亿元；缺项为null |
| `complete` | 买卖金额均为非负有限数时为true，零值有效 |

币种元数据为`provider_unspecified`：接口原文标“亿元”，本轮未核实具体币种，不擅自换汇或标为人民币/港币。`formula`保存计算公式，`scope`说明为港股通成交统计、非北向；`source_note`说明单位与不拼接旧东财历史。有缺项则整体status为partial；历史空返回为empty。结果最新行仍可为不完整行，调用方须检查complete。

2026-11-09账号实测：查询2024-08-31至2026-11-09，返回510条，实际覆盖2024-09-02至2026-11-06；最新买入295.52、卖出256.44、净买入39.08（接口亿元口径）。这证明本次返回，不保证所有历史完整。看板通过共享Python使用同一实现，失败只沿用本来源缓存。

官方目录仍列该接口：[Tushare官方接口目录](https://github.com/waditu/tushare-data/blob/master/tushare/references/数据接口.md)。其196号文档链接本轮返回404；真实账号请求成功，保留该文档访问限制，不宣称币种已核实。

## 5. 错误处理、缓存和缺失

~~~python
from tushare_client import TushareClientError

try:
    result = data.query("get_fund_daily", ts_code="159941.SZ",
                        start_date="2026-11-01", end_date="2026-11-05")
except TushareClientError as error:
    print(error.source, str(error))
else:
    if result["status"] == "empty":
        print("请求成功，但该标的和日期范围没有返回记录")
    elif result["status"] == "partial":
        print("存在缺失，请逐行检查complete")
~~~

| error.source | 触发情形 | 处理建议 |
| --- | --- | --- |
| tushare-token | 无可用Token | 检查进程环境变量或配置路径 |
| tushare-permission | 上游错误被识别为权限、积分或Token问题 | 核对权限与凭证；不自动重试 |
| tushare | 缺SDK、初始化失败或其他上游失败 | 检查依赖/网络；上游失败默认额外重试2次 |
| tushare-date | 非法日期、起止倒置、历史接口缺日期 | 修正日期 |
| tushare-code | 非法代码或缺必需后缀 | 使用准确Tushare代码 |
| tushare-params | 缺参数、未知参数或非法limit/use_cache | 按接口参数表调用 |
| tushare-fields | 字段类型错误、history字段未注册 | 核对字段声明 |
| tushare-method | 未注册数据集、history不支持该数据集 | 使用第6节支持的名称 |
| tushare-data | 标的身份错误、冲突重复、历史行缺日期 | 保留失败状态，核查上游 |
| tushare-adjustment | 非法复权方式、缺因子或价格非法 | 核对因子，不自动改成原价 |
| mcp-tool | 未知工具名 | 核对行情目录或tools/list |

TushareClientError另有details字典，随错误类别变化，不作为稳定业务字段。Python签名层缺少必填关键字或调用方式错误可能抛TypeError；并非所有编程错误都包装为TushareClientError。MCP将执行失败包装为isError=true。

缓存默认300秒，位于配置目录的.cache。use_cache=False跳过读取，成功仍写入。默认重试等待1秒、2秒；默认进程内120次/分钟，不是跨进程总限额。一个历史分段失败则整个调用失败，不返回已获取的短区间冒充成功，不静默使用过期缓存。空结果可被缓存，empty不等于平台永久不提供数据。

## 6. Python底层客户端

### 6.1 构造参数

~~~python
client = TushareClient(extra_env_paths=(), cache_ttl_seconds=300,
                       retries=2, retry_delay_seconds=1.0)
~~~

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| token | None | 显式注入优先于自动解析；不要写明文凭证 |
| pro | None | 注入Tushare兼容对象，主要用于测试 |
| extra_env_paths | 空元组 | 额外.env文件路径序列 |
| logger | None | 可选logger(event, **fields)回调 |
| cache_ttl_seconds | 300 | 缓存读取有效秒数；≤0不读取，成功仍可写入 |
| retries | 2 | 额外尝试次数；权限错误不重试 |
| retry_delay_seconds | 1.0 | 重试基础等待秒数 |
| rate_limiter | None | 可选提供wait()的对象；默认进程内共享限流器 |

### 6.2 读取方法

| 方法 | 返回类型 | 行为 |
| --- | --- | --- |
| call(method, use_cache=True, **params) | list[dict] | 单次底层调用，无自动历史分段/汇总/统一元数据 |
| call_frame(method, use_cache=True, **params) | list[dict] | 与call相同；不是pandas DataFrame |
| history(method, start_date, end_date, use_cache=True, **params) | list[dict] | 分段、排序、去重、身份校验，无limit参数 |
| stock_basic(fields=None, exchange="", list_status="L", use_cache=True) | RowsFrame | 使用.to_dict("records")取得列表 |
| daily(ts_code, fields=None, use_cache=True, **date_params) | RowsFrame | 不复权个股日线 |
| daily_basic(ts_code, fields=None, use_cache=True, **date_params) | RowsFrame | 个股估值与股息率 |
| stock_basic_rows(**kwargs)、daily_basic_rows(**kwargs) | list[dict] | 对应方法的列表版本 |
| check_permission(method, **params) | dict | 真实无缓存查询；成功不代表有记录或全标的覆盖 |

history仅支持：fund_daily、fund_adj、index_daily、index_dailybasic、index_global、shibor、daily_info、margin、us_tycr、fx_daily。不能同时传trade_date/date单日过滤；fields接受逗号字符串或字符串列表，自动补日期和身份字段。最大366自然日一个分段；未进行交易日历完整性核验。

call支持全部28个注册数据集：上述10项，以及stock_basic、daily、daily_basic、moneyflow、margin_detail、income、balancesheet、cashflow、dividend、stk_holdernumber、top10_holders、top10_floatholders、index_weight、fund_basic、fund_share、fund_nav、trade_cal。每个数据集允许参数、必填项、默认字段见[api-schema.json的datasets](api-schema.json)。不是任意Tushare平台接口均可透传。

~~~python
rows = client.call("daily_basic", ts_code="600150.SH", trade_date="2026-11-05",
                   fields=["ts_code", "trade_date", "pe_ttm", "dv_ttm"])
history = client.history("index_daily", "2024-01-01", "2026-11-05",
                         ts_code="000922.CSI", fields=["close"])
~~~

fund_data.fund_daily(...)与index_data.index_daily(...)是行情接口的便捷函数；financial_data.client()仅创建客户端，不是财报查询函数。新项目优先使用MarketData或TushareClient。

## 7. MCP协议

启动方式见[[tools/tushare-data/README|安装与调用说明]]。一行一个JSON-RPC消息，响应写标准输出，日志写标准错误；无HTTP端口，不在工具参数里传Token。协议版本2024-11-05，服务版本0.9.0。

~~~json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
~~~

~~~json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_fund_daily","arguments":{"ts_code":"159941.SZ","start_date":"2026-11-01","end_date":"2026-11-05","adjustment":"qfq"}}}
~~~

成功时result.structuredContent是结果字典，result.content[0].text为同一结果的JSON字符串，result.isError=false。empty/partial也属于正常响应，继续读取structuredContent.status。

失败示例：

~~~json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{"type": "text", "text": "{\"error\":\"TushareClientError\",\"message\":\"missing Tushare token\",\"source\":\"tushare-token\"}"}],
    "structuredContent": {"error": "TushareClientError", "message": "missing Tushare token", "source": "tushare-token"},
    "isError": true
  }
}
~~~

## 8. 其他MCP工具（14个）

这14项保留各自格式，**不适用第2/3节的统一参数和结果，也不能传给MarketData.query**。精确输入声明见tools/list和[api-schema.json](api-schema.json)。表中“日期”指列明的对应日期字段；fields为字符串或字符串列表，use_cache默认True，limit默认不限制。

| 工具 | 必填参数 | 可选参数／默认值 | structuredContent主要字段 |
| --- | --- | --- | --- |
| get_stock_basic | 无 | ts_code/name/exchange/list_status=L；fields、use_cache、limit | dataset、rows、row_count，股票资料 |
| get_stock_daily | ts_code | trade_date/start_date/end_date；adjustment仅none；fields、use_cache、limit | dataset、adjustment、rows、row_count |
| get_stock_valuation | ts_code | trade_date/start_date/end_date；fields、use_cache、limit | dataset、dividend_yield_field=dv_ttm、rows、row_count |
| get_stock_moneyflow | ts_code | trade_date/start_date/end_date；fields、use_cache、limit | dataset、rows、row_count，个股资金流而非市场汇总 |
| get_margin_detail | ts_code | trade_date/start_date/end_date；fields、use_cache、limit | dataset、rows、row_count |
| get_market_margin | 无 | trade_date/start_date/end_date/exchange_id；fields、use_cache、limit | dataset、rows、row_count、summary；旧汇总没有complete检查，默认未主动排除其他交易所 |
| get_us_treasury_yield | 无 | date/start_date/end_date；fields、use_cache、limit | dataset、tenor=y10、rows、row_count、latest，仅提取y10 |
| get_us_dollar_index | 无 | ts_code默认USDOLLAR.FXCM；trade_date/start_date/end_date；fields、use_cache、limit | dataset、symbol、rows、row_count、latest；旧接口提供统一close，DXY覆盖仍未确认 |
| get_usd_jpy_exchange_rate | 无 | ts_code默认USDJPY.FXCM；risk_threshold=160；trade_date/start_date/end_date；fields、use_cache、limit | dataset、symbol、rows、row_count、latest、risk_threshold、risk_level、is_yen_depreciation_risk、risk_message |
| get_financial_statements | ts_code | statement=all或income/balancesheet/cashflow；period/start_date/end_date/report_type/comp_type；use_cache、limit | dataset、statements，按报表分组的rows/row_count |
| get_dividend_history | ts_code | ann_date/record_date/ex_date；implemented_only=False；fields、use_cache、limit | dataset、rows、row_count；True才过滤已实施分红 |
| get_shareholder_count | ts_code | ann_date/enddate/start_date/end_date；use_cache、limit≤3000 | dataset、ts_code、rows、row_count、total_period_count、latest、disclosure_scope；按不同截止期计算户数变化 |
| check_central_huijin_holding | ts_code | period/ann_date/start_date/end_date；holder_keywords默认中央汇金；include_top_holders/include_float_holders/latest_only均True；use_cache、limit | dataset、is_central_huijin_holding、selected_report_period、matches、match_count、queried及披露范围等 |
| get_index_constituents | index_code | trade_date/start_date/end_date；fields、use_cache、limit | dataset、requested_weight_date、actual_weight_date、rows、row_count |

这些工具的limit通常取已有结果前N条，不等于行情接口“最后N条”；不要跨接口假设排序/分页语义相同。读取沪深融资、完整美债曲线、原始bid/ask外汇时，优先使用第4节对应接口。风险等级来自本项目既定阈值，不是供应商结论。

个股股息率dv_ttm与指数股息率2、ETF现金分红率不是同一指标。个股moneyflow存在也不意味着市场级moneyflow_mkt_dc权限已具备。

## 9. 维护与核验

实现依据：scripts/tushare_market_data.py、scripts/tushare_client.py、scripts/mcp_server.py。更改接口时同时更新本文、JSON声明快照和[[tools/tushare-data/log|变更日志]]；0.9.0新增ETF份额变化×净值估算接口。

真实账号证据见[短区间检查](../verification/2026-11-06-smoke.json)和[跨年历史检查](../verification/2026-11-06-history.json)。本文模拟返回与真实行情证据分开；一次成功不代表所有标的、所有时期均有数据。
