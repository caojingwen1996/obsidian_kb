# Tushare共享接口维护日志

修改接口、说明、配置、测试或随附脚本后追加日期、版本、原因、文件与验证结果；保留历史，不补写未经核实的旧版本记录。使用入口见[[tools/tushare-data/README|共享接口说明]]。

## 2026-11-06 · 0.5.0 → 0.6.0

- 原因：按用户要求，将看板来源清单中已验证的Tushare能力集中实现在本工具，供其他项目复用读取接口。
- 新增：pyproject.toml、scripts/tushare_market_data.py、scripts/smoke_market_data.py、tests/test_market_data.py、README.md与本日志；verification目录保存本轮只读验证结果，不含Token或原始行情明细。
- 修改：scripts/tushare_client.py、mcp_server.py、fund_data.py、index_data.py、config/datasets.yaml、tests/test_tushare_mcp.py、SKILL.md。
- 数据：新增fund_daily、fund_adj、index_daily、index_dailybasic、index_global、shibor，注册数据集总数23；新增10个共享行情工具，MCP工具总数24。原14个MCP工具与既有Python调用保留。
- 行为：每次最多366自然日分段读取；明确基金/指数代码身份，校验日期、去重、排序；ETF支持前后复权，缺因子报错，保留原始行与复权基准。统一沪深成交额与融资汇总，排除北交所、缺一市场不形成完整合计；美债保留全期限及10Y−2Y，外汇保留bid/ask。
- 工程：支持pip本地编辑安装与stdio命令入口；非编辑安装避免写入Python安装目录；权限错误不重试；错误输出不包含上游原始报错及堆栈，降低凭证泄露风险。
- 验证：44项共享库单元测试、9项看板成交额兼容测试通过；14组真实账号检查均返回数据；2024-01-01至2026-11-05的159941前复权687条、SPX715条，日期有序无重复。临时新版Python环境完成离线无依赖编辑安装，在/tmp工作目录导入并通过真实stdio发现24个工具。
- 环境记录：系统旧pip不支持PEP660编辑安装；说明中注明pip21.3+及升级命令，改用临时新版环境验证成功。未升级用户全局环境，未复制或迁移凭证。
- 边界：尚未切换看板实际来源；迁移前Excel/审计JSON保留快照。DXY、NDX、股息率2、ETF现金分红、盘中最高价、市场大小单流量与中债权限缺口继续待讨论；短样本成功不代表全历史完整或跨供应商口径相同。

## 2026-11-06 · 接口文档完善（版本0.6.0不变）

- 原因：用户指出“首批共享入口”表达不明确，要求写清接口文档。
- 修改文件：README.md、SKILL.md及本日志；新增docs/api-reference.md、docs/api-schema.json；更新根index/log。
- 变更：README改为安装与接入说明，移除“首批”表述；明确Python行情接口、底层数据集接口、MCP协议及HTTP未实现状态。API文档逐项列出10个行情接口的代码要求、参数、字段、单位和示例，补充统一结果、空值/partial、复权基准、错误类别、缓存行为、底层客户端及其余14个MCP工具的差异。
- 声明：JSON快照直接从当前代码注册表生成，包含24个MCP工具、23个数据集及history允许列表，不包含账号信息；模拟返回明确标注，不冒充实时数据。
- 验证：核对10个行情章节及24个工具名称；Python示例语法和JSON示例解析通过；执行本次Markdown表格与UTF-8检查。仅更新文档，未改变运行逻辑或版本号。


## 2026-11-06 · 0.6.0 → 0.7.0

- 原因：用户要求融资占流通市值改用Tushare，并复用共享Python读取层。
- 修改文件：scripts/tushare_market_data.py、scripts/tushare_client.py、scripts/mcp_server.py、tests/test_market_data.py、tests/test_tushare_mcp.py、config/datasets.yaml、pyproject.toml、README.md、SKILL.md、docs/api-reference.md、docs/api-schema.json、log.md。
- 变更：新增get_market_margin_ratio，11个共享行情接口、25个MCP工具；daily_info允许float_mv字段。融资余额元转亿元后除同日沪深股票市场流通市值，分母含B股、排除北交所；四项同日输入不齐、负融资余额、非正市值不生成比例；不跨日填值。
- 核验：逐股daily_basic样本5217只，比当日有效上市名单少7只，因此改用交易所市场汇总；2024-08-28至2026-11-06共有528个完整观测日，11月6日缺融资，最新有效11月5日2.5001439264%。原东方财富口径不宣称等价。
- 验证：47项共享库测试、42项看板Python专项测试、15项前端测试及构建通过；本机看板接口实际返回新来源和正确数值。Excel第49行已切换，公式、格式、手工决策、历史核查记录保留。详情见[[tools/a-share-market-dashboard/docs/data-source-policy|看板来源规则]]。


## 2026-11-07 · 0.7.0 → 0.8.0

- 原因：用户要求ETF申赎按份额变化×净值估算，并明确股票型含港股通、排除QDII。工作自11月6日开始，跨日完成。
- 修改文件：scripts/tushare_client.py、tushare_market_data.py、mcp_server.py；pyproject.toml、config/datasets.yaml、README.md、SKILL.md、docs/api-reference.md、docs/api-schema.json；tests/test_tushare_mcp.py、log.md。新增scripts/tushare_etf_flow.py、tests/test_etf_flow.py。
- 变更：新增get_etf_flow_estimate，注册fund_basic/fund_share/fund_nav/trade_cal，共27数据集、12共享接口、26MCP工具。按沪深交易日历连续两日配对，万份×净值÷10000得亿元；名单要求明确上市日，首日和QDII等排除；缺失、重复、错日、份额接口截断严格处理。
- 异常策略：复权净值／单位净值比例变化超过0.1%者保守单列，不直接推断拆分比例，不宣称公司行为完备；含未知上市日期或输入缺失时完整合计为None，仅提供明确标注的sample_net_flow_yi。
- 实测：账号新版etf_share_size及etf_basic无权限，旧fund_share/fund_nav/fund_basic/trade_cal可用。11月5日样本1530/1531、113.63353475亿元；512220.SH复权比例变化单列，158081.SZ新上市首日排除，59条缺上市日期名单单列。数据由Tushare转供，未直接采集交易所PCF，不称官方直接披露现金流。
- 验证：53项共享库、50项看板Python、20项前端测试通过；本机服务接口、只读ETF状态、桌面与手机卡片及异常展开验证通过。Excel第52行改估算、第81行记录共享接口可用但风险大屏仍待接入，原公式、格式、手工决策保留。


## 2026-11-09 · 0.9.0

- 原因：用户要求南向净买入使用已验证有权限的Tushare ggt_daily，并供其他项目复用。
- 变更：新增底层ggt_daily及历史读取；共享get_southbound_flow按同日买入减卖出计算，保留原字段和完整性标记；金额沿用亿元、币种待核验，零值有效、缺项不补。同步MCP、配置、README、SKILL、API文档、声明与版本，现28数据集、13共享接口、27MCP工具。
- 验证：共享55项测试通过；真实查询510条，实际覆盖2024-09-02至2026-11-06，最新净买入39.08；不声明所有交易日完整。看板实际接口来源及值已核对，见[[tools/a-share-market-dashboard/docs/tushare-southbound-2026-11-09.json|验证记录]]。
