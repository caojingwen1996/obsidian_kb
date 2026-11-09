# 看板数据来源规则与账户接口

初次审计日期：2026-11-06；同日按用户最终要求停用Wind。Tushare和Yahoo接口保留；风险大屏3项启用、29项待接入。原审计及各次迁移JSON作为历史证据保留，当前以 [[tools/a-share-market-dashboard/docs/wind-disabled|Wind停用与当前来源规则]]、Excel D/E/M列和页面来源为准。

## 统一账户入口

`/Users/cjw/dev/Obsidian/wiki/tools/tushare-data` 是用户指定的 Tushare 账户共享接口目录，不是一个独立行情数据商，也不是本轮需要重新安装的外部插件。

- Python 共用客户端：`/Users/cjw/dev/Obsidian/wiki/tools/tushare-data/scripts/tushare_client.py`。
- MCP 服务入口：`/Users/cjw/dev/Obsidian/wiki/tools/tushare-data/scripts/mcp_server.py`。
- 使用说明：[[tools/tushare-data/SKILL|本地 Tushare 接口说明]]。其中的 Windows 启动示例不适用于当前 Mac；当前 Mac 服务命令为 `python3 /Users/cjw/dev/Obsidian/wiki/tools/tushare-data/scripts/mcp_server.py`，须先满足该目录依赖及环境变量配置。
- 后续开发复用 `TushareClient` 和既有凭证解析，不另建 Token 存储或在前端嵌入凭证。

凭证依次读取环境变量 `TUSHARE_TOKEN` / `TUSHARE_PRO_TOKEN`、共享目录 `.env`、调用方传入的额外 `.env`、知识库根 `.env`。当前核查结果：默认解析未找到凭证；由看板传入 `tools/a-share-market-dashboard/.env` 时能找到凭证并调用。这里只记录“是否找到”，不记录内容，不复制或迁移密钥。单独启动共享 MCP 服务时，不能假设它自动知道看板的额外路径，应通过环境变量提供配置。

共享目录0.9.0现有28个数据集、27个MCP工具；看板新增日线调用使用 `tushare_market_data.MarketData.query()`，不需要启动MCP。ETF复权、分段历史和沪深汇总在共享目录实现，看板只转换页面数据格式。接口契约见 [[tools/tushare-data/docs/api-reference|Python接口文档]]。

## 来源选择规则

1. 优先复用 **Tushare-data**；已核验的其他行情与现金分红使用 **Yahoo Finance chart**。**Wind MCP已停用，不再作为主源、备用源或优先候选。** 其余保留已有非Wind来源，替代缺口另行核验。
2. 未确认满足要求时，写明缺少的字段、范围或口径。Yahoo只替换已核验部分；不以行情价格或成交量替代宏观、估值和资金流。清单“待讨论”页保留原记录，当前进展看M、N列。
3. 平台有接口、本地已封装、账号有权限、标的有返回、历史完整、口径一致和生产稳定，是七个不同条件。一次成功只证明本次样本返回。
4. 名称相似不构成可替代：证券身份、市场范围、频率、收盘时区、单位、复权基准、价格/全收益指数、估值算法、现金分红日期、修订版本均须匹配。不得把纳斯达克综合指数 IXIC 当作纳斯达克100 NDX。
5. Excel不统计独立的本地计算和本地资料条目：按原分类移除建议优先源为“本地计算”（含Tushare输入）的3项，以及阶段为“本地资料”的6项。混合外部取数与计算的行情条目仍记录其外部输入来源。看板原有计算、持仓、文章、事件日历及任务功能继续保留。
6. 迁移时记录实际提供商及其原始上游；Tushare 的 `moneyflow_mkt_dc` 仍以东财为数据上游，不能称为独立的 Tushare 统计口径。
7. 后续切换须保留观测日期、获取日期、原始字段、单位、覆盖范围和缓存状态。失败沿用缓存时标注旧数据，不把空返回当零值，不混用不同日期或不同口径历史。
8. Wind网络传输与ETF自动任务已停用；不能因旧文档或历史样本可用而重新调用。旧缓存不参与当前展示或评分。
9. 用户指定纳斯达克100 PE-TTM与近十年分位改用**理杏仁**，不受其他行情来源优先级影响。2026-11-09接口已接线，缺Token，账号权限及目标字段返回待验证；使用同日市值加权字段，不读Wind缓存。详见[[tools/a-share-market-dashboard/docs/lixinger-valuation|理杏仁接口文档]]。

## 清单与核查结果

- [Excel 来源清单](../看板数据来源清单-2026-11-06.xlsx)：2026-11-09移除3项本地计算、6项本地资料，85项缩减至76项；需讨论／核验46项，风险大屏3项接线、29项待接入。E列无Wind推荐，H列为已停用的历史核验。
- [机器可读审计记录](data-source-audit-2026-11-06.json)：逐项映射、17 次 Tushare 探测的参数/字段/行数，以及 Wind 检索元数据和样本结果；不含凭证。
- [[tools/a-share-market-dashboard/docs/source-catalog|原页面指标清单]]继续反映实际运行来源；Excel的M列明确区分已替换、部分替换、原已接入和未启用设计。

Tushare 的 17 次请求中，12 次返回数据、3 次空返回、2 次权限不足。主要日线探测窗口为 2026-11-01 至 2026-11-05，`daily_info`、`margin`、`yc_cb` 为 11 月 5 日；基金分红查询仅指定基金代码。空返回包括 `USDOLLAR.FXCM`、`NDX`、`fund_div(515450.OF)`。权限不足包括 `moneyflow_mkt_dc` 与 `yc_cb`。空返回可能来自代码、覆盖或发布问题，不证明平台永久无数据。

Wind 已返回两只 ETF 的单日价格与申赎净流入额、纳斯达克100四日日线、NDX 单日 PE-TTM、中证红利单日股息率，以及 VIX、美债2年/10年、联储总资产、逆回购候选、Shibor、沪深融资余额等 EDB 样本。混合询问两个指数的估值曾误返回成分股数据，该结果已明确排除。搜索到的 EDB 指标只记为“已定位”；未读取序列的项目不标记取数成功。

## 优先讨论的缺口

| 项目 | 已知情况 | 后续讨论点 |
| --- | --- | --- |
| DXY日线与参考报价 | Yahoo DX-Y.NYB已验证并用于资金面/风险大屏 | 总览已有Tushare接口按本轮排除规则保留 |
| 159941盘中前高、其他盘中报价 | ETF日线与因子可取，实时最高价未验证 | 是否保留盘中功能及对应实时源 |
| 中证红利股息率2 | Wind普通股息率可取，但与“股息率2”未证明相同 | 对照定义与历史，不能直接替换 |
| 515450现金分红率 | Yahoo9次分红核对通过，分母保留Tushare未复权价格 | 已替换现金分红输入；Yahoo无发放日，明确显示缺失 |
| 主力、超大单、小单资金 | Tushare账号无对应权限；Wind同口径市场汇总未验证 | 权限方案或保留东财口径 |
| 市场涨跌分布 | 双源尚未验证完整同市场、同日分母与计数规则 | 明确市场边界及涨跌停规则后核验 |
| 有知有行温度、预期PE | 未确认双源能提供同一指标 | 保留专属来源，或明确新建不同指标 |
| 风险待接入项目 | IPO含北交所、月度国债净发行、月末债务、同源信用利差等仍有范围或定义缺口 | 逐项定义；经济体A/B及政策事件占位项先指定真实对象 |

Excel“待讨论”页从最初40条记录移除本地计算2项，保留其余38条及用户决策，其中部分已解决；当前待核验数量由来源清单L列统计。它不是“所有平台都没有”的指标数量。Yahoo N列区分已接入、保留Tushare、不覆盖字段和口径不符。

## 后续实施验收

后续新增替换仍需满足：扩展共享封装；验证证券身份与权限；对齐同日样本和单位；验证最长回看窗口；复权/分红连续性检查；缺值与节假日处理；验证缓存和失败降级；更新页面实际来源与日期；通过项目已有相关测试后再切换。全历史重算需另存版本并保留旧记录。

接口依据：[Tushare基金日线](https://tushare.pro/document/2?doc_id=127)、[基金复权因子](https://tushare.pro/document/2?doc_id=199)、[基金分红](https://tushare.pro/document/2?doc_id=120)、[国际指数支持表](https://tushare.pro/wctapi/documents/211.md)、[市场资金流](https://tushare.pro/document/2?doc_id=345)、[中债收益率曲线](https://tushare.pro/document/2?doc_id=201)。Wind 依据为当前连接的 MCP 工具返回，具体证据保存在审计记录中。

历次Wind和Yahoo迁移JSON记录当时事实。用户随后停用Wind，最新状态见 [[tools/a-share-market-dashboard/docs/wind-disabled|Wind停用与当前来源规则]]；不改写旧样本证据。

## 融资占流通市值：Tushare接入（2026-11-06）

调用共享Python get_market_margin_ratio。分子为margin的SSE+SZSE融资余额，分母为daily_info的SH_MARKET+SZ_MARKET流通市值，含B股、排除北交所。按同日计算，先把融资余额由元转换为亿元；缺少任一市场或市值无效时不计算。原东财缓存不拼接、不回退展示。

真实账号核验覆盖2024-08-28至2026-11-06，528个完整观测日；11月6日融资余额尚未返回，最新有效值取11月5日。前次daily_basic逐股样本遗漏7只上市股票，不用于生产分母。结果和口径见[[tools/tushare-data/docs/api-reference|共享接口文档]]及[tushare-margin-ratio-2026-11-06.json](tushare-margin-ratio-2026-11-06.json)。

## ETF申赎净流入估算（2026-11-06）

用户已选择股票型ETF，含港股通、排除QDII。通过共享Python get_etf_flow_estimate读取Tushare fund_basic、fund_share、fund_nav、trade_cal；连续交易日份额变化×当日单位净值，万份换算为亿元。此为Tushare转供输入的本地估算，非交易所直接披露的现金净流入；未直接采集PCF清单，也不拿最小申赎单位或额度当实际份额流量。

看板每日样本有明确上市日期，缺份额、净值或净值复权比例异常者单列；新上市首日、上市日期不明者排除。覆盖不完整时标“样本估算”，不计算跨日分位或净额变化比较。公司行为检测为保守筛查，未建立完整拆分事件库。旧Wind数据不拼接；原Wind自动任务继续暂停，新接口随看板刷新，缓存1小时，历史从本机积累，首次补最近8自然日。

11月5日有效样本1530/1531只，512220.SH因复权比例变化单列待核实，新上市158081.SZ首日不计申赎；另有59条名单缺上市日期，单独披露，不能宣称完整市场。真实验证见[ETF估算验证](etf-estimate-2026-11-06.json)，接口契约见[[tools/tushare-data/docs/api-reference|共享Python文档]]。


## 南向资金切换（2026-11-09）

南向净买入已改为共享`get_southbound_flow`读取Tushare `ggt_daily`，同日买入减卖出。金额沿用接口亿元口径，币种待核验；缺项不补零，旧东财历史及缓存不拼接。实测510条，最新2026-11-06净买入39.08；见[[tools/a-share-market-dashboard/docs/tushare-southbound-2026-11-09.json|验证记录]]与[[tools/tushare-data/docs/api-reference|接口文档]]。该项仍为参考项，不计分。

同日重新核验超大单／小单：市场接口`moneyflow_mkt_dc`返回无权限；个股`moneyflow`单标的样本可取，但不视为市场聚合等价替代。随后按用户指定改用以下AKShare入口。

## 超大单／小单：AKShare接入（2026-11-09）

这两项指定使用 `ak.stock_market_fund_flow()`，上游东方财富。分别读取超大单与小单净流入净额，元转亿元，不改订单估算口径；不因Tushare市场接口无权限继续列为未接入。两项共用一次请求，25秒超时，失败只沿用AKShare缓存并标过期；不再调用原直接东财读取代码，也不启用Wind。

实测120日（2026-05-14至11-06），最新超大单−233.20358912亿元、小单479.14582016亿元，看板实际接口已确认。接口返回的净占比保留在原始读取结果，本轮不新增卡片。见[[tools/a-share-market-dashboard/docs/akshare-market-flow|安装与接口说明]]。Excel仍为76项，需核验44项；历史权限证据与讨论页手工备注保留。


2026-11-09追加：主力资金也已切换AKShare `stock_market_fund_flow()`，直接使用主力净流入-净额，元转亿元；主力净占比保留原始返回，不替代净额评分。三项共用请求。主力最新单日−524.9726464亿元，近5交易日合计−393.289728亿元（截至11月6日）；实际看板验证通过。Excel需核验项44→43，总数仍76。详见[[tools/a-share-market-dashboard/docs/akshare-market-flow|接口文档]]。
