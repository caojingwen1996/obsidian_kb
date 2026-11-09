# 年度收益与回撤样式验证

- 时间：2026-11-02T13:51:11+08:00（Asia/Shanghai）。
- 需求：年度收益与回撤采用与现有月度视图一致的样式。
- 实现：年度表改为年份网格，提供“年度收益／年度回撤”切换；复用月度网格、20px数值、涨跌语义色及分隔线。桌面四列，700px以下两列。
- 保留：每年实际收益／最大回撤、统计起止日期、年内／完整年度／成立首年状态、点击年份查看月度详情，以及年／月切换时的指标和年份选择。共享渲染器中的纳指年度视图同步，控件状态继续独立。
- 数据边界：只改变展示，未修改收益／回撤计算、信号策略、源数据或调度；未重跑每日信号。构建正常读取本地已有快照，因此当前展示的数据日期可较旧HTML更新。

## 修改文件

- `src/app.mjs`：年度指标切换、年份网格和无障碍名称。
- `src/styles.css`：年／月网格共用样式、年份按钮悬停及键盘焦点；移除旧年度表专用样式。
- `tests/dividend-monthly.test.mjs`：更新年度布局断言，验证收益／回撤、空值、零值、排序及输入不变。
- `tests/nasdaq-return-calendar.test.mjs`：共享年度视图及命名空间回归。
- `tests/dividend-annual-calendar.browser.mjs`：独立Chromium交互与响应式专项。
- `README.md`、`src/changelog.json`：使用说明及页面更新日志。
- `a-share-market-dashboard.html`：重新构建的可用页面。
- 项目根 `index.md`、`log.md`：导航说明和维护日志；无新增正式Wiki页面，不改页面计数。
- 本目录保存浏览器结果、Impeccable检测及三张截图；自动化memory.md追加本轮UI任务记录。

## 验证结果

- `node --check src/app.mjs`、`npm run build`通过。
- `node --test tests/dividend-monthly.test.mjs tests/nasdaq-return-calendar.test.mjs`：19项通过。
- 真实本地服务49888浏览器专项通过，19个年度的收益与最大回撤均与现有年度JSON一致；各格保留真实统计区间及年度状态。
- 1440／768px四列、390／320px两列；页面及面板均无横向溢出。
- 指标键盘切换、年份按钮Enter打开详情、Escape关闭及焦点返回通过；年／月切换保留指标和年份，两页状态独立，无页面脚本错误。
- 使用独立Chromium.app及Playwright临时专用数据目录，finally关闭浏览器；测试拦截所有外部及API请求，不触发数据抓取和业务写入。
- Impeccable机械检测运行一次：全文件包含676条advisory及20条warning；本次修改行只有1条advisory（沿用原月度收益色#a62c24），无warning。未扩展修改既有全站问题。
- 已复核桌面与手机截图，标题、数值、日期、状态、指标选中与键盘焦点均清晰；无需追加视觉修改。
- 交付前运行本次5份Markdown表格、UTF-8及差异检查；详见本目录final-checks.json。

## 证据文件

- `verification.json`：浏览器结果。
- `desktop-returns.png`、`desktop-drawdowns.png`、`mobile-drawdowns.png`：实际页面截图。
- `detector.json`、`detector-scoped.json`：全文件与修改行检测结果。
