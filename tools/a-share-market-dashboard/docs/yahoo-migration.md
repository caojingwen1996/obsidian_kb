# Yahoo Finance 行情接口与看板接入

当前状态：用户已停用Wind MCP及ETF每日任务。本文是迁移阶段记录，其中Wind接入描述不再代表当前配置；最新规则见 [[tools/a-share-market-dashboard/docs/wind-disabled|Wind停用与当前来源规则]]。

2026-11-06按用户要求增加Yahoo：已有Tushare输入保留，其余按证券身份、字段和口径核验后替换。12条清单记录全部或部分使用Yahoo。原始审计、Tushare迁移记录和Wind迁移记录保留为历史证据，当前实施状态以更新后的Excel和本记录为准。

## 接口能提供什么

`GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}` 返回JSON。无需本项目账户凭证。请求参数：

| 参数 | 本项目取值 | 用途 |
|---|---|---|
| interval | 1d | 日线；检查返回的dataGranularity，拒绝自动降为月线的结果 |
| range | 1d或2y | 单日报价及昨收、两年趋势窗口；与period1/period2二选一 |
| period1、period2 | UTC Unix秒，结束边界不含 | 纳指明确从1996-01-01读取，避免range=max返回抽样线 |
| events | div,splits | 证券支持时返回现金分红和拆股事件 |

主要字段是 `meta.regularMarketPrice/regularMarketTime`、`timestamp`、`indicators.quote[0].open/high/low/close/volume`。部分证券另有 `adjclose`、`events.dividends`、`events.splits`。本项目使用收盘价、报价和已验证现金分红；未把缺失字段补零，也未用Yahoo复权替换Tushare复权。

均线、涨跌幅、年度/月度收益、最大回撤、年度及累计回撤次数可以用日线本地计算。该接口不提供指数PE-TTM、预期PE、股息率2、GDP/CPI/PMI、融资余额、订单资金流、ETF申赎净流入或政策公告。成交量和ETF价格不能替代资金流。

## 本次实际替换

| 清单ID | Yahoo代码 | 接入内容 |
|---|---|---|
| nasdaq | ^NDX | 点位、报价变化、MA200和偏离、回撤；PE仍独立读取Wind |
| nasdaq-history | ^NDX | 1996年起已收盘日线，年度/月度收益与回撤统计；不拼接旧Wind/FRED历史 |
| liquidity-vix | ^VIX | VIX日收盘 |
| liquidity-usd | DX-Y.NYB | 美元指数日收盘趋势 |
| liquidity-dxy | DX-Y.NYB | 最新参考报价，可能延迟，不混入日线评分 |
| pending-capital-0 | DX-Y.NYB | 风险大屏美元指数日收盘与上一观测 |
| pending-capital-1 | CNY=X | 美元兑人民币市场汇率；不是人民币中间价 |
| pending-capital-2 | JPY=X | 风险大屏美元兑日元市场汇率；总览原Tushare USDJPY保留 |
| stock-quote | 六位代码.SS或.SZ | 沪深个股参考报价、昨收、涨跌幅和报价时间 |
| dividend-price | 000922.SS | 只替换参考报价；日线和收益统计继续Tushare |
| etf-dividend-yield | 515450.SS | 现金分红事件；计算分母仍用Tushare未复权收盘价 |
| fugui-candidate | 六位代码.SS或.SZ | 默认AKShare查询路径的报价部分；公司资料及原分红口径保留，可选Tushare路径不变 |

行情页可核对：[纳斯达克100](https://finance.yahoo.com/quote/%5ENDX/history/)、[VIX](https://finance.yahoo.com/quote/%5EVIX/history/)、[DXY](https://finance.yahoo.com/quote/DX-Y.NYB/history/)、[515450](https://finance.yahoo.com/quote/515450.SS/history/)。逐项样本、日期和分红对照见 `yahoo-verification-2026-11-06.json`，85项适用性与实施状态见 `yahoo-migration-2026-11-06.json`。

## Python入口与本地HTTP入口

共享读取实现位于 `scripts/yahoo_data.py`，从看板项目目录调用：

```python
from scripts.yahoo_data import YahooChartClient, completed_points, stock_quote, dividend_events

chart = YahooChartClient().chart("^NDX", start_date="1996-01-01")
daily = completed_points(chart)  # date、close、timestamp，按交易所时区排除未收盘日
quote = stock_quote("1.600000")  # data价格、昨收、涨跌幅、quoteTimestamp；proxySource
cash = dividend_events()        # 515450的exDate、cashPerShare、payDate=None
```

客户端对固定指数/汇率及沪深证券代码进行身份、币种、时区和日线频率校验；未知symbol、空价格、错位数组和未来报价抛出 `YahooDataError`。不接受任意网址。底层进程缓存60秒，重复读取保留原成功获取时间；资金面外层仍缓存1小时，手动刷新可重取。外部项目可将看板目录加入Python模块路径复用此模块；不必重复编写HTTP解析。

现有HTTP路径保持兼容：`/api/nasdaq100`、`/api/stock-quote?secid=1.600000`、`/api/liquidity`、`/api/wind-risk`（现在同时包含Wind和Yahoo读数）。ETF分红通过原红利查询流程消费，不新增另一个Web服务。所有地址均由现有本地服务提供。

## 日期、缓存与口径

- Yahoo时间戳按元数据交易所时区解释。当天日线须经过正常交易时段结束15分钟后才用于历史统计；报价单独标明可能延迟。昨收使用range=1d的chartPreviousClose，不能使用长历史窗口的起点前收盘价。
- 本次纳指返回7,763条已收盘日线，1996-01-02至2026-11-05。新的统计完全由Yahoo样本计算；不与旧提供商序列拼接，不承诺与旧样本数或历史统计完全相同。旧历史文件仍保留。
- 515450返回9次分红，全部除息日与每份现金和原基金分红记录一致。Yahoo不提供发放日，显示“来源未提供”。近365天已除息现金除以Tushare未复权收盘价，仍不是指数股息率2。
- 000922.SS实测只有短窗口，故仅用于参考报价。Yahoo ETF日线还可能滞后于Tushare，既有Tushare日线一律保留。
- Yahoo `BZ=F`是布伦特期货，不能替换清单中的布伦特现货FOB，后者继续Wind。
- 总览 `dollar` 已接Tushare，即使历史样本为空也按本次排除规则保留；资金面和风险大屏的DXY单独使用Yahoo。
- 风险和资金面更新失败保留原观测日期并标旧数据，不计作本次成功；纳指/报价失败返回错误，浏览器沿用既有失败缓存机制。Wind估值失败不阻断Yahoo行情。
- Wind仍负责其余已接入宏观、估值、ETF申赎等项目；其账户积分不足导致的缺项仍如实保留，不用行情价格推造这些指标。

## 文件和验证

后台修改包括 `scripts/yahoo_data.py`、`local_proxy.py`、`liquidity_data.py`、`dividend_etf_query.py`、`wind_data.py`。来源说明修改包括 `src/source-catalog.mjs`、`liquidity-dashboard.mjs`、`risk-indicators.mjs`、`risk-screen.mjs`、`app.mjs`。同时更新针对性测试、构建产物、来源规则和原Excel。

测试覆盖身份/频率不符、空值与未来时间、未收盘日线、分红单位、报价昨收、失败缓存、Tushare键不被覆盖、Wind估值独立及HTTP路由。联网验收记录保存实际返回；单次成功不代表长期稳定性保证。项目原有报告文件缺失导致的404测试与本次行情替换无关。

本轮90项Python、21项前端针对性检查通过，构建通过。运行服务的7个HTTP检查（含health）及各来源结果记录在 `yahoo-http-verification-2026-11-06.json`。Excel保持85项、3个工作表，新增N列；原公式、冻结窗格、校验、条件格式、手工决策及历史证据保留，原生筛选表头与单元格同步。当前14项风险设计未接入、34项仍需口径/覆盖核验；“待讨论”页保留最初40条记录，不等于40项尚未解决。

来源规则见 [[tools/a-share-market-dashboard/docs/data-source-policy|来源优先规则]]；既有Tushare接口见 [[tools/tushare-data/docs/api-reference|Tushare Python接口文档]]。
