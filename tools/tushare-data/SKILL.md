# Tushare 数据 MCP Server

这是当前知识库工具目录中的 Tushare 统一访问层，同时也是一个基于 stdio 的 MCP Server。

## 启动方式

启动 MCP Server：

```powershell
python E:\caojingwen\obsidian\llmwiki\tools\tushare-data\scripts\mcp_server.py
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
- `get_financial_statements`：获取利润表、资产负债表和现金流量表核心科目。
- `get_dividend_history`：获取历史分红方案及实施记录。
- `get_index_constituents`：获取指数历史成分股和权重。

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
