# Wind 数据接入与迁移记录

当前状态：用户已停用Wind MCP及ETF每日任务。本文是迁移阶段记录，其中Wind接入描述不再代表当前配置；最新规则见 [[tools/a-share-market-dashboard/docs/wind-disabled|Wind停用与当前来源规则]]。

后续变更：本文保留Wind阶段验收记录；同日按用户授权，纳指行情/历史、VIX、美元兑人民币已改用Yahoo，纳指估值继续Wind。原Excel现在已更新，最新实际来源以 [[tools/a-share-market-dashboard/docs/yahoo-migration|Yahoo迁移记录]] 及Excel M、N列为准。

本次按原 Excel 中建议来源包含 Wind 的26项实施。24项已完成程序接线，存款准备金率按用户要求待接入，中国10年国债因 Wind 权限不足保留原来源。**接线不等于全部联网验收通过**：验收中 Wind 返回402“账户积分余额不足”，后续联网验收待恢复积分。原工作簿及原审计证据保持不变。

## 如何使用

通过项目原启动器打开看板，后台 Python 直接调用固定 Wind MCP 工具。MCP 是调用协议，不要求由 AI 客户端发起；这里不需要 Codex 会话生成查询。Wind 服务内部如何处理自然语言估值查询，不作无依据推断。

凭证优先读取 `WIND_API_KEY` 环境变量，否则复用本机现有 Codex Wind 配置；前端和缓存均不保存密钥。生产环境建议给运行面板的进程设置环境变量。

恢复积分后，可直接执行：

```bash
cd /Users/cjw/dev/Obsidian/wiki/tools/a-share-market-dashboard
python3 scripts/wind_data.py --dataset all --refresh
```

`--dataset` 可选 `risk`、`liquidity`、`nasdaq`、`all`。`--refresh` 表示明确重试，清除1小时的积分不足暂停状态；不会充值。ETF沿用原 `scripts/wind_etf.py` 每日09:00任务及缓存，本命令不重复采集ETF。

## 日期、缓存与失败处理

- 风险指标访问时异步更新，缓存1小时；页面更新期间保留旧值，完成后自动显示。ETF普通访问仅读原缓存。缓存不是全天自动调度，页面不开时需外部任务调用上述命令。
- 数据期是交易日或统计期；成功更新时间是本机成功取数时间。保留的本轮只读样本另记“样本入库”，不伪造原始取数时刻。政策利率的数据期是最近变更日，上期为上次变更值。
- 接口失败、缺项、单位不匹配、日期错误不补零；旧数据标注原因。Wind积分不足暂停联网工具调用1小时；人工恢复积分后可用上面命令重试。
- EDB仅请求已核验的固定代码；WALCL百万美元除1000，财政赤字百万美元除100，海外美债十亿美元除1000。PMI原始数值以指数点展示。
- RRP明确为国债ONRRP第一批次，评分仍留空。南向改为Wind港股通人民币净买入，不能拼接旧东财历史。
- 纳指历史按5年分段取数，检查边界、内部缺口及完整年度数量；不与旧FRED历史拼接。PE必须是NDX.GI本身的PE-TTM，十年分位只展示Wind提供且具有有效样本数和覆盖日期的结果。
- 新缓存保存在 `data/Wind/cache/`，已加入忽略规则；提供 `/api/wind-risk` 固定只读接口，不开放任意工具转发。

## 逐项结果

| 清单ID | 指标 | Wind代码 | 本轮状态 | 说明 |
|---|---|---|---|---|
| nasdaq | 纳斯达克100点位、涨跌幅与均线 | NDX.GI | 保留已核验样本；更新受阻 | 本轮两次Wind样本201个重叠日一致；合并7971日，1996-01-02至2026-11-05。新分段采集器的完整联网验收被402阻断；保留样本并标旧缓存。 |
| nasdaq-history | 纳指年度／月度收益、最大回撤与回撤次数 | NDX.GI | 保留已核验样本；更新受阻 | 本轮两次Wind样本201个重叠日一致；合并7971日，1996-01-02至2026-11-05。新分段采集器的完整联网验收被402阻断；保留样本并标旧缓存。 |
| nasdaq-pe | 纳指PE-TTM与近十年估值分位 | NDX.GI PE_TTM | 接线完成，联网验收受阻 | 只读查询曾返回明确PE-TTM及十年分位；生产采集器尚未取得成功缓存，402后页面保持缺失。 |
| dividend-bond | 中国10年国债收益率 | S0059749 | 权限不足，未替换 | Wind返回无权限；保留AKShare及既有每日产物。 |
| liquidity-vix | VIX | G0003892 | 保留已核验样本；更新受阻 | VIX收盘 |
| liquidity-rrp | 隔夜逆回购 RRP | G1168931 | 接线完成，联网验收受阻 | 隔夜逆回购国债第一批次；与纽约联储旧缓存最近5日一致；新采集器缓存尚未成功取得，当前保留旧来源并标失败，评分留空。 |
| liquidity-walcl | 联储总资产 WALCL | G1100075 | 保留已核验样本；更新受阻 | 联储总资产 |
| liquidity-south | 南向资金净买入 | M0329522 | 保留已核验样本；更新受阻 | 港股通当日净买入（人民币）；人民币亿元；旧东财数值与此不同，不拼接历史。 |
| liquidity-cn_etf_flow | ETF申赎净流入 | f_mf_netsubamt | 复用既有缓存 | 复用原Wind沪深股票型ETF日度直接申赎缓存；风险大屏不再用固定样本周度估算。 |
| pending-macro-0 | 实际GDP同比 | M0039354 | Python直连取数通过 | 实际GDP当季同比 |
| pending-macro-1 | 制造业PMI | M0017126 | Python直连取数通过 | 制造业PMI |
| pending-macro-2 | 调查失业率 | M5650805 | Python直连取数通过 | 城镇调查失业率 |
| pending-macro-3 | 社会消费品零售同比 | M0001428 | Python直连取数通过 | 社会消费品零售同比（1—2月合并） |
| pending-commodity-0 | CPI同比 | G0000027 | Python直连取数通过 | 美国CPI未季调同比 |
| pending-commodity-1 | 核心CPI同比 | G0000029 | Python直连取数通过 | 美国核心CPI未季调同比 |
| pending-commodity-2 | PPI同比 | M0001227 | Python直连取数通过 | 中国PPI同比 |
| pending-commodity-3 | 布伦特原油现货 | S5111926 | Python直连取数通过 | 布伦特欧洲现货FOB |
| pending-money-0 | 政策利率目标上限 | M0000162 | Python直连取数通过 | 联邦基金目标利率上限（最近变更日） |
| pending-money-3 | 存款准备金率 | — | 用户暂缓 | 用户确认先保留待接入，不启用大型机构月度口径。 |
| pending-fiscal-0 | 财政赤字 | G0003351 | Python直连取数通过 | 美国月度财政赤字（盈余为负） |
| pending-credit-0 | 社融存量同比 | M5525763 | Python直连取数通过 | 社融存量同比 |
| pending-credit-1 | 人民币贷款余额同比 | M0009970 | Python直连取数通过 | 人民币贷款余额同比 |
| pending-credit-3 | 商业银行不良贷款率 | M0002004 | Python直连取数通过 | 商业银行不良贷款率 |
| pending-capital-1 | 美元兑人民币 | M0067855 | Python直连取数通过 | 在岸美元兑人民币 |
| pending-capital-3 | 海外持有美债余额 | B3159602 | 保留已核验样本；更新受阻 | 全部海外持有人美债余额 |
| pending-structure-3 | 股票ETF净申购额 | f_mf_netsubamt | 复用既有缓存 | 复用原Wind沪深股票型ETF日度直接申赎缓存；风险大屏不再用固定样本周度估算。 |

## 验证与边界

- 14项宏观指标已通过新Python采集器实际取数；其余可复用样本与未完成项如上。
- 本地解析、失败保留、日期与单位、只读接口、页面状态及构建检查记录在本次维护日志中。
- 现行资金面评分规则和风险大屏评分待定义状态不因数据接入而改变。

相关说明：[[tools/a-share-market-dashboard/docs/data-source-policy|数据来源规则]]、[[tools/a-share-market-dashboard/docs/source-catalog|指标与数据源清单]]。

## 实现文件

- 后台：`scripts/wind_data.py`（新增固定指标采集与缓存）、`scripts/wind_etf.py`（共享限速及积分错误）、`scripts/liquidity_data.py`（Wind输入与旧值状态）、`scripts/local_proxy.py`（纳指与风险接口）。
- 前端：`src/risk-indicators.mjs`、`src/risk-screen.mjs`、`src/source-catalog.mjs`、`src/liquidity-dashboard.mjs`、`src/app.mjs`，以及生成的 `a-share-market-dashboard.html`。
- 验证：`tests/test_wind_data.py`、`tests/test_shared_market_data.py`、`tests/risk-indicators.test.mjs`、`tests/source-catalog.test.mjs`；独立Chrome for Testing在1440px和390px检查通过，无脚本错误与整页横向溢出，截图与记录位于 `.impeccable/review/wind-migration/`。
- 文档：本记录、`wind-migration-2026-11-06.json`、README、来源规则及来源清单说明；根索引、维护日志及Wind缓存忽略规则同步更新。

构建成功；较大的43项build检查中仍有7项旧断言失败：个人工作区原归档路径、三要素报告摘要、总览卡片数量、产业报告布局、主题图谱路径、跟踪报价脚本及旧五项导航。未修改这些与本次Wind接线无关的断言。
