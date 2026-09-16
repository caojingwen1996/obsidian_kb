# 持仓每日监控证据与执行记录（2026-09-16）

- 截止：2026-09-16 10:26:57 CST；行情仅截至2026-09-15收盘；今日盘中价未使用。
- 配置：动态16只（6持有、10观察），与日终清单一致。
- 权威基线：按证券代码筛选artifact_type=equity_research且非归档，16只均唯一；旧日期转发页不是权威研报。路径、版本、哈希与行情原始行见[数据快照](../../../sources/automations/持仓每日监控/2026-09-16/current-run-evidence.json)。
- 失败与恢复：Tushare通过仅对api.tushare.pro直连的进程成功取得16只行情；中远海控与紫光股份PDF、应急管理部正式页面均已保存并做哈希核验。
- 公告：16家公司公开公告索引逐一检查；本轮相关正式材料已下载核验。索引可能延迟，未检出不等于无公告保证。
- 本轮保存并核验4份正式材料：中远海控回购公告、紫光股份股东会决议及法律意见、应急管理部提级调查页面。公告时间与事件时间在逐股第3节分列。

## 产业与政策检索

- [9月11日国常会及算力网、安全生产和水库改造报道](https://stcn.com/article/detail/4182344.html)；政府原始链接：https://www.gov.cn/yaowen/liebiao/202609/content_7080787.htm（直接抓取403）。涉及算力网络、电力设备、机械及船舶安全，但没有公司合同金额，逐股只作传导线索。
- [新华财经9月15日商品市场](https://www.cnfin.com/yw-lb/detail/20260915/4470197_1.html)：银锡铜铝与原油的单日变化，不能替代正常化长期价格假设。
- [9月15日有色收盘](https://www.cnmn.com.cn/ShowNews1.aspx?id=474041)：公司实现售价、权益产量与成本另需验证。
- [SCFI](https://www.sse.net.cn/index/singleIndex?indexType=scfi)与[CCFI](https://www.sse.net.cn/index/singleIndex?indexType=ccfi)：9月11日与9月4日同口径比较，不能把运价同比例映射为中远海控利润。
- 未取得统一行业股票指数映射、连续可比组估值、公司最新WACC全量输入、ETF申赎、基金穿透仓位及交易者身份；不编造行业超额收益或归因。

## 中国船舶队列实际执行

- 使用bbxm-equity-research v4.5.0，已读取最新估值框架、六项基本面要求、32项、通胀及凯利references；上游2026-08-20三要素报告仅作历史产业背景，以2026H1法定披露和事故新信息优先。
- 唯一基线：2026-07-17-1133-中国船舶机构级决策研报.md，2026-09-08，v4.4.2；正常化归母185/210/230亿元、周期PE12.5/13.5/14.5、股本75.25621288亿股。六项顺序复核：负债212.66对367.06亿元；严格净现金405.90对223.52亿元；CFO109.18对-28.01亿元、FCF代理92.62对-39.73亿元；销管研费率0.18%/3.34%/2.96%对0.19%/3.88%/3.09%；扣非97.42对28.91亿元；合并扣商誉净资产1591.17对1494.46亿元。余额对2025年末、流量对2025H1，均为事故前历史，不代表事故后改善。
- 新采集moneyflow、margin_detail、stk_holdernumber查询及行情，原始结果在数据快照；市场或股东数据不能填补事故损失。未检出新量化事故披露。分部通胀仍为高暴露：钢材、人工、设备和交期影响正常化盈利，不因短期商品回落抵消事故风险。
- 失败步骤：Step 1输入核验；缺口：船舶设备损失、停工范围与期限、事故责任结论、处罚赔偿、保险赔付及时间、订单延期和财务影响。因此未推进事故后模型、反向估值、完整32项扫描和凯利。旧区间不是新结果。
- 队列处置：MANUAL_REVIEW，潜在FULL_REVALUE。1项执行失败、0项新估值完成；未改写或迁移权威报告，未生成第二份权威研报。关键披露到齐后重跑，而不是无限继承“已完成”。

## 完整性与边界

- 16份逐股Markdown与同源HTML，1份汇总Markdown与HTML；11项输入核查（含要求的10项及定期报告），4项经营/财务KPI，H1—H3映射。
- 华润江中既有除息已通过Tushare日涨跌幅连乘处理；本轮不把不复权跳变当经营变化。
- 所有来源、关键事实与模型假设分离；未提供成本仓位，不生成账户盈亏或买卖指令。
- 复盘7项：4项量价/区间异常、云铝与船舶2项人工估值复核，另保留紫光股份原报告现金估值分歧为复盘，不计为新异常或新增重估队列。
- 专项验证通过：34份母稿/HTML同源、链接、8节、10项必查输入、4项KPI、H1-H3、动态清单、权威文件哈希、失败队列和看板映射。Node全量105/112，7项范围外失败：侧栏顺序、三要素摘要、市场概览、产业表布局、主题地图、盘中刷新、旧徐工转发页六章格式；本轮没有改动相关源码/测试或权威研报。看板build成功，不代表全量回归成功。

- 002270 华明装备：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/002270.phtml)，最新列示2026-09-14；基线2026-07-30-华明装备-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 000807 云铝股份：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/000807.phtml)，最新列示2026-08-28；基线2026-07-23-1421-云铝股份-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 601766 中国中车：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/601766.phtml)，最新列示2026-09-10；基线中国中车-机构级决策研报.md，模型4.5.0，估值基准2026-09-09。
- 000426 兴业银锡：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/000426.phtml)，最新列示2026-09-15；基线兴业银锡-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 601168 西部矿业：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/601168.phtml)，最新列示2026-09-02；基线西部矿业-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 603530 神马电力：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/603530.phtml)，最新列示2026-09-12；基线神马电力-机构级决策研报.md，模型4.5.0，估值基准2026-09-10。
- 000425 徐工机械：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/000425.phtml)，最新列示2026-09-05；基线徐工机械-机构级决策研报.md，模型4.5.0，估值基准2026-09-15。
- 002396 星网锐捷：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/002396.phtml)，最新列示2026-09-01；基线2026-08-05-1010-星网锐捷-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 600150 中国船舶：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/600150.phtml)，最新列示2026-09-11；基线2026-07-17-1133-中国船舶机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 601208 东材科技：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/601208.phtml)，最新列示2026-09-08；基线2026-07-17-1450-东材科技-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 600750 华润江中：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/600750.phtml)，最新列示2026-09-11；基线华润江中-机构级决策研报.md，模型4.5.0，估值基准2026-09-09。
- 000938 紫光股份：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/000938.phtml)，最新列示2026-09-16；基线2026-08-03-1638-紫光股份-机构级决策研报.md，模型4.4.3，估值基准2026-09-09。
- 600938 中国海油：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/600938.phtml)，最新列示2026-09-12；基线中国海油-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 002262 恩华药业：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/002262.phtml)，最新列示2026-08-28；基线2026-09-08-0941-恩华药业-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 601919 中远海控：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/601919.phtml)，最新列示2026-09-16；基线2026-09-08-1715-中远海控-机构级决策研报.md，模型4.4.2，估值基准2026-09-08。
- 600511 国药股份：[公告索引](https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllBulletin/stockid/600511.phtml)，最新列示2026-09-05；基线国药股份-机构级决策研报.md，模型4.5.0，估值基准2026-09-09。
