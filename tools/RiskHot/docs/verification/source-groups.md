# 信源目录四种分组方式恢复

> 2026-10-29 · schema5目录恢复既有四种视图，不修改实际信源数据或分类。

## 原因与实现

schema5目录替换旧页面后，遗漏“全部／信源等级／日常监测／专题研究”切换。本轮复用原model.js的groupFields和groupSources，不另建分类规则。

| 方式 | 组织规则 |
| --- | --- |
| 全部 | 平铺显示 |
| 信源等级 | 信源等级 → 来源类别 |
| 日常监测 | 关注优先级 → 监测频率 → 信源等级 |
| 专题研究 | 金融属性 → 观察层级 → 关注优先级 |

搜索和等级筛选先过滤，再按所选方式分组。多标签信源可出现在不同组，同一组内按身份去重，总数只计信源身份。连续没有分类值的层级沿用旧逻辑压平，不编造分类。分组可展开／收起，选择保存在当前标签页并兼容旧页面保存的选择；任务计划页独立平铺，返回目录保留分组。

修改文件：[[tools/RiskHot/src/web/current-app.js|目录页面]]、[[tools/RiskHot/src/web/styles.css|局部间距样式]]、[[tools/RiskHot/src/tests/ingestion-migration.e2e.ts|浏览器验证]]；沿用原颜色、表格、按钮和details分组样式。

## 验证

- JavaScript语法与TypeScript检查通过；现有web.test.js十项通过。
- 独立Chrome for Testing浏览器12组全部通过，无页面错误：新增四种切换、分层规则、多标签计数、展开收起、等级组合过滤、整页刷新保留选择、计划切换；既有任务／候选／事件回归通过。
- 1440桌面与390移动截图已检查，无横向溢出。切换按钮有aria-pressed与分组名称，details保留原生键盘操作。
- Impeccable目标检测无问题；仅新增目录局部间距，未添加新配色或视觉体系。
- 测试为隔离数据库及独立浏览器临时目录，结束后关闭并清理，实际业务数据未修改。实际服务按请求读取页面资源，刷新目录即可使用。

证据：[[tools/RiskHot/docs/verification/source-groups/results.json|12组结果]]、[[tools/RiskHot/docs/verification/source-groups/browser.log|运行输出]]，桌面与移动截图位于同名目录。

## 后续实际目录纠正

本报告此前仅以维护了分类的隔离数据验证分组。用户实际40条信源的分类字段全空，原树逻辑仍会压平，因此不能据本报告宣称实际专题分类已恢复。后续修复固定三类与待分类分组，并增加实际服务只读验证，见[[tools/RiskHot/docs/verification/research-view|实际目录修复记录]]。
