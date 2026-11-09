# Wind停用与当前来源规则

2026-11-06按用户要求停用Wind MCP，并从Excel建议优先源、页面来源清单和项目规则中移除。当前优先复用Tushare-data，已核验的行情和现金分红使用Yahoo Finance；其他项目保留已有非Wind来源，无法替代的项目显示待接入。

## 生效范围

| 项目 | 当前处理 |
|---|---|
| Tushare与Yahoo已有接口 | 保留，包括ETF/指数日线、纳指、VIX、DXY、汇率、沪深报价和515450现金分红 |
| RRP | 恢复已有纽约联储API，备用FRED；继续不计分 |
| 联储总资产 | 恢复已有FRED WALCL，百万美元换算为十亿美元 |
| 南向净买入 | 恢复已有东方财富同日双通道合计，不拼接Wind历史 |
| 纳指PE-TTM与十年分位 | 2026-11-09接线理杏仁，缺Token时保持缺失；账号取数待验证，见[[tools/a-share-market-dashboard/docs/lixinger-valuation\|接口文档]] |
| 风险大屏 | 仅3项Yahoo（DXY、USD/CNY、USD/JPY）启用，其他29项待接入；原Wind观测不再展示 |
| ETF申赎指标 | 已按用户要求改为Tushare份额变动×净值的样本估算；不等同原Wind直接申赎字段；异常与覆盖单列 |
| 每日ETF自动任务 | Codex自动任务`etf`已暂停，保持原任务定义，不再每日调用Wind |

## 停用保证与历史处理

`scripts/liquidity_config.py`中的 `WIND_ENABLED=False`、`WIND_ETF_ENABLED=False` 同时生效。默认资金面不安装Wind读取器；手动ETF刷新、状态读取不启动Wind后台作业。`WindClient`在读取凭证和联网之前拒绝调用，即使旧代码误触发也无法访问Wind。两个Wind命令行入口直接返回 `disabled`。

风险大屏改用 `/api/risk-indicators`，只返回Yahoo数据；旧 `/api/wind-risk` 路径作为兼容别名保留，也不读取Wind。纳指行情不再加载Wind估值。旧Wind缓存不参与当前展示或评分；源文件、历史核验记录和迁移证据保留，不删除凭证或全局MCP配置。

Excel保留85项及原3页。E列不再推荐Wind，H列改为“历史Wind核验（已停用）”；原Wind依赖项的当前来源、阶段、缺口与实施状态同步更新，手工决策和历史核查证据保持原样。此前 [[tools/a-share-market-dashboard/docs/wind-migration|Wind迁移记录]]、[[tools/a-share-market-dashboard/docs/yahoo-migration|Yahoo迁移记录]] 记载的是各阶段事实，当前以本停用说明为准。

## 修改文件与验证

- 后台：`scripts/liquidity_config.py`、`liquidity_data.py`、`wind_etf.py`、`wind_data.py`、`local_proxy.py`。
- 前端：`src/risk-indicators.mjs`、`risk-screen.mjs`、`source-catalog.mjs`、`liquidity-dashboard.mjs`及构建HTML。
- 测试：新增 `tests/test_wind_disabled.py`，覆盖网络/凭证阻断、旧缓存排除、手动刷新不启任务、默认适配器和估值不调用Wind；既有Wind解析测试仅在隔离的假数据环境启用。
- 清单与文档：原Excel、README、来源规则、来源清单、资金面说明、历史迁移文件顶部状态说明、changelog、根索引和日志。

验证结果：72项Python及18项前端检查通过，构建通过；两个Wind命令入口均返回disabled。重启后的纳指、风险接口及兼容旧路径、ETF状态和资金面强制刷新验证通过，未展示Wind读数。RRP与南向原源读取成功，WALCL的FRED本次读取失败，保持缺失。实际接口结果见 `wind-disabled-verification-2026-11-06.json`。

Excel共更新23条记录；85条、3页及原公式、冻结、条件格式、校验、手工决策和历史证据保留。E列无Wind推荐、H列原生表头同步；当前29项风险设计未接入，49项需核验。逐项更新见 `wind-disabled-2026-11-06.json`。

2026-11-09更新：南向资金已从东财切换到Tushare ggt_daily共享Python接口，同日买入减卖出；上文旧切换记录仅为历史过程。Wind仍停用。
