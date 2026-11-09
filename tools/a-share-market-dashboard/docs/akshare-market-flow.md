# 主力、超大单与小单资金：AKShare接口

2026-11-09起，三项均调用 `ak.stock_market_fund_flow()`，上游为东方财富沪深大盘资金流。替换的是读取方式；仍是按订单规模估算的净流入，不代表已确认的机构或散户账户。主力资金保留原有近5个交易日合计评分，超大单／小单只作参考。

## Python读取与字段

看板服务通过 `scripts.akshare_data.market_fund_flow()` 获取记录列表，返回AKShare的中文列名。函数在独立进程执行原始AKShare接口，总超时25秒；失败抛出 `AKShareUnavailable`，不输出上游异常正文。三项在同一次刷新中共用结果或失败，不重复请求。

| 指标 | 原始字段 | 看板处理 |
|---|---|---|
| 主力资金 | 主力净流入-净额 | 元除以100000000；展示单日亿元，近5交易日净额合计用于评分 |
| 超大单资金 | 超大单净流入-净额 | 元除以100000000，显示亿元 |
| 小单资金 | 小单净流入-净额 | 元除以100000000，显示亿元 |
| 数据日期 | 日期 | 上海时间15:15之前排除当日，排除未来日期 |
| 净占比 | 主力净流入-净占比、超大单净流入-净占比、小单净流入-净占比 | 原始返回保留百分数；金额卡片不新增占比指标 |

接口同时返回大单、中单净额和净占比，当前接入主力、超大单、小单。空值、非有限数值与无效日期不补零；真实零值保留。字段缺失报错。正常缓存1小时，失败后只允许展示同一AKShare来源的历史缓存并标过期；原直接东财接口缓存不冒充AKShare结果。主力资金不可用时，沿用原有隐藏且不计有效指标的规则。

## 安装与运行

在看板目录使用Python 3.12建立独立环境（不改变服务所用系统Python）：

```bash
python3.12 -m venv .venv-akshare
.venv-akshare/bin/python -m pip install -r requirements-akshare.txt
```

本机已安装并核验 AKShare 1.19.1。读取进程优先使用环境变量 `AKSHARE_PYTHON` 指定的解释器，其次为项目 `.venv-akshare/bin/python`（Windows使用 `Scripts/python.exe`），最后为服务当前解释器。更换版本后应重新核验字段、单位与实际返回。

```python
from scripts.akshare_data import market_fund_flow

rows = market_fund_flow()
latest = rows[-1]
super_yi = latest['超大单净流入-净额'] / 1e8
small_yi = latest['小单净流入-净额'] / 1e8
```

上述原始读取未过滤盘中日期；看板在展示前执行收盘过滤。AKShare和原直连接口上游相同，不能把改用封装视为东财故障的独立备用源。

## 本次验证

实测返回120个交易日，范围2026-05-14至2026-11-06。最新超大单−233.20358912亿元，小单479.14582016亿元；原始净占比分别−1.41%和2.89%。重启后的 `/api/liquidity` 两项均为 `ok`，来源显示AKShare与东方财富，数值一致。历史长度由上游返回决定，不宣称全历史。

随后接入主力资金，同样取得120日。2026-11-06单日−524.9726464亿元，近5交易日合计−393.289728亿元，评分−1；看板实际来源AKShare，状态ok。37项Python、16项前端测试及构建通过。测试覆盖三项共用一次请求、字段、单位、零值、缺值、日期、超时与缓存隔离。记录见 [[tools/a-share-market-dashboard/docs/akshare-market-flow-2026-11-09.json|超大单与小单实测记录]]、[[tools/a-share-market-dashboard/docs/akshare-main-flow-2026-11-09.json|主力实测记录]]。

接口依据：[AKShare官方大盘资金流文档](https://akshare.akfamily.xyz/data/stock/stock_flow.html)、[东方财富大盘资金流](https://data.eastmoney.com/zjlx/dpzjlx.html)。Tushare `moneyflow_mkt_dc`此前无权限的核查仍保留为历史事实，不再阻塞这两项接入。
