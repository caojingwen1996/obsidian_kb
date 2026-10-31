# 信源目录与任务边界验证

2026-10-29，依据用户“信源目录不要有任务相关的内容”调整实际页面，沿用现有视觉规范，使用Impeccable检查。

## 实现范围

- 信源目录保留信源档案、等级、分组、接入条件、编辑及信源业务启停；保留全部／信源等级／日常监测／专题研究四种浏览方式。
- 从目录移除计划状态、启用／暂停计划、执行周期、任务执行记录及管理任务计划入口。
- “任务计划”由“信息采集任务”进入；行内周期保存、计划启停和任务执行记录仍可操作，返回任务列表。旧计划地址继续可用。
- 目录仅读取会话与信源，不请求任务或计划接口。计划配置与实际数据未调整。

涉及实现：[[tools/RiskHot/src/web/current-app.js|页面渲染与读取]]、[[tools/RiskHot/src/web/index.html|加载及页脚文案]]；测试：[[tools/RiskHot/src/tests/ingestion-migration.e2e.ts|隔离浏览器回归]]、[[tools/RiskHot/src/tests/research-view.e2e.ts|实际服务只读检查]]。同步README、M1功能设计、页面设计、项目索引及维护日志。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 语法、类型及页面单元测试 | node --check、npm run typecheck通过；web.test.js 12项通过 |
| 隔离浏览器回归 | 15组通过；任务接口模拟不可用时目录仍正常，目录任务接口请求为零 |
| 计划页 | 周期保存、启停、输入校验、并发冲突、原键恢复、权限和执行记录分页通过 |
| 实际服务 | 40条信源可浏览，研究分类计数保持一致；目录任务控件及任务接口请求均为零 |
| 数据保护 | 实际服务检查禁用所有写请求，未发生写入；有写操作的回归仅使用隔离测试数据库 |
| 视觉与可访问性 | 检查1440桌面及390移动截图，无横向溢出；沿用现有表格、字段标签与导航 |
| Impeccable | 页面脚本及实际样式检测无问题 |

浏览器均使用独立Chrome for Testing与任务专用临时目录，完成后关闭并清理。页面脚本由服务端即时读取，刷新即可生效。

证据：[[tools/RiskHot/docs/verification/source-catalog-boundary/results.json|15组回归结果]]、[[tools/RiskHot/docs/verification/source-catalog-boundary/live/live-results.json|实际服务只读结果]]；截图保存在相同目录。

## 目录工具栏合并为一排

2026-10-29按用户截图要求，将搜索信源、信源等级、查询及全部／信源等级／日常监测／专题研究放入同一工具栏，移除两组之间的分隔线；计数与分组说明位于下一行。沿用现有配色及控件，窄屏自然换行。

修改[[tools/RiskHot/src/web/current-app.js|目录结构]]、[[tools/RiskHot/src/web/styles.css|工具栏布局]]及[[tools/RiskHot/src/tests/research-view.e2e.ts|实际服务只读检查]]。验证1280与1440桌面七个控件底边对齐，390移动无横向溢出，专题分类计数与实际接口一致；六组浏览器检查、12项页面单元及类型检查通过。Impeccable布局检测无发现，桌面及手机截图已检查。

证据：[[tools/RiskHot/docs/verification/source-toolbar/live-results.json|工具栏验证结果]]；同目录保存桌面与移动截图。

## 任务计划的工作区归属

2026-10-29进一步按用户要求，将任务计划从旧#sources?mode=automatic迁移到#intake-tasks?view=plans。计划入口、页面渲染、数据读取与顶部导航均归属“信息采集任务”；打开计划页高亮信息采集任务，返回任务列表。旧地址通过替换历史项自动跳转，刷新可直接打开新地址。

修改current-app.js及ingestion-migration.e2e.ts。新增新地址与导航高亮断言、旧地址跳转断言；15组隔离浏览器回归、12项页面单元、类型检查通过。桌面和移动截图均确认导航归属正确，Impeccable检测无发现。计划页仍只读取计划及信源，不额外读取任务列表。

证据：[[tools/RiskHot/docs/verification/task-plan-navigation/results.json|任务计划导航回归]]及同目录截图。测试写入仅使用隔离数据库，实际任务计划值未调整。
