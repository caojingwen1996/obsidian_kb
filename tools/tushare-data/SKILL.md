# Tushare 数据 MCP Server

这是当前知识库工具目录中的 Tushare 统一访问层，同时也是一个基于 stdio 的 MCP Server。

当前版本 **0.9.0**；Python安装、统一行情API、复权和覆盖规则见[[tools/tushare-data/README|共享接口使用说明]]。变更后须追加[[tools/tushare-data/log|本工具日志]]并运行相关测试。

开发调用以[[tools/tushare-data/docs/api-reference|API接口文档]]为准：包含13个Python行情接口的参数与返回字段、28个底层数据集入口，以及27个MCP工具的调用区别。当前没有HTTP API。

## 启动方式

启动 MCP Server：

```bash
python3 /Users/cjw/dev/Obsidian/wiki/tools/tushare-data/scripts/mcp_server.py
```

## 已暴露工具

- `get_stock_basic`：获取 A 股上市公司基础资料。
- `get_stock_daily`：获取 A 股个股历史日线行情，价格口径为不复权 `adjustment=none`。
- `get_stock_valuation`：获取估值、股息率、市值和交易活跃度数据，当前股息率使用 `dv_ttm`。
- `get_stock_moneyflow`：获取 A 股个股资金流向和大小单分档数据，用于订单规模方向代理，不确认账户身份。
- `get_margin_detail`：获取 A 股个股融资融券交易明细，用于观察融资余额、融资买入、融资偿还和融券变化。
- `get_market_margin`：获取沪深市场融资融券交易汇总，用于观察全市场融资余额、融资买入、融资偿还和融资融券余额变化。
- `get_us_treasury_yield`：获取美国国债收益率曲线，默认返回 10 年期 `y10`。
- `get_us_dollar_index`：获取美元指数日线，默认 `USDOLLAR.FXCM`。
- `get_usd_jpy_exchange_rate`：获取美元兑日元日线，默认 `USDJPY.FXCM`；当 USDJPY >= 160 时提示日元贬值风险。
- `get_financial_statements`：获取利润表、资产负债表和现金流量表核心科目。
- `get_dividend_history`：获取历史分红方案及实施记录。
- `get_shareholder_count`：获取股东户数历史披露，并按不同截止日期计算较上期增减额、增减率和方向；该数据为不定期公告口径，不代表实时账户变化。
- `check_central_huijin_holding`：判断前十大股东 / 前十大流通股东披露中是否出现中央汇金相关主体；只代表定期报告披露口径，不代表实时持仓。
- `get_index_constituents`：获取指数历史成分股和权重。

统一行情工具与 Python `MarketData.query()` 共用实现，均要求起止日期：

- `get_southbound_flow`：港股通每日净买入，ggt_daily买入减卖出，金额沿用接口亿元单位。
- `get_fund_daily`：ETF日线，支持none/qfq/hfq，明确复权基准并保留原始价格。
- `get_fund_adjustments`：基金复权因子。
- `get_index_daily`：国内指数日线，必须明确市场后缀。
- `get_index_valuation`：Tushare指数估值，不自动等同其他供应商算法。
- `get_global_index_daily`：国际指数日线，SPX已实测，IXIC不能替代NDX。
- `get_shibor`：全期限Shibor，包括隔夜on。
- `get_market_turnover`：沪深股票成交额，同日两市场完整才汇总。
- `get_etf_flow_estimate`：ETF份额变化×净值估算，返回完整与样本金额、有效覆盖、异常及日期不明名单；不等同交易所现金净流入。
- `get_market_margin_ratio`：同日沪深融资余额占股票市场流通市值，分母含B股，缺一市场不计算。
- `get_market_margin_history`：沪深融资余额和净买入，排除BSE、检查缺失；新项目优先用此历史入口。
- `get_us_treasury_curve`：美债全期限及同日10Y−2Y利差。
- `get_fx_daily`：保留bid/ask的外汇日线，默认USDJPY.FXCM。

工具总数27，底层注册数据集28。DXY、基金现金分红、市场资金流与中债曲线的原缺口不因本轮封装而解决。

## Python 调用

其它本地脚本仍然可以直接导入共享 Client：

```python
from tushare_client import TushareClient
```

## Token 读取顺序

1. 系统环境变量 `TUSHARE_TOKEN` 或 `TUSHARE_PRO_TOKEN`
2. `tools/tushare-data/.env`
3. 调用方额外传入的 `.env` 文件
4. 知识库根目录 `.env`

不要在日志中输出 token 值。

## 能力边界

Client 层统一处理：

- 参数校验
- 接口权限检查
- 失败重试
- 进程内请求限流
- 本地缓存
- 字段标准化
- Tushare 日期格式转换
- 结构化 JSON 返回
