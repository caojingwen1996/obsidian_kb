# 信源目录等级展示修复

> 2026-10-29 · 恢复独立信源等级列与等级筛选，未修改信源数据。

## 原因与修改

schema5页面此前把等级与分组合并显示，且未保留原等级筛选。当前改为独立“信源等级”“信源分组”列；筛选使用接口实际返回的等级，与名称搜索组合生效，刷新保留选择，选择“全部等级”恢复全部信源。

修改文件为[[tools/RiskHot/src/web/current-app.js|目录页面]]与[[tools/RiskHot/src/tests/ingestion-migration.e2e.ts|浏览器测试]]。数据库等级仍在m1.sources.metadata.tier，当前T1为27条、T1.5为5条、T2为7条、辅助入口为1条，共40条，未改值或删除数据。

## 验证

- JavaScript语法与TypeScript检查通过。
- 独立Chrome for Testing浏览器11组全部通过，其中新增等级筛选、刷新保留、清除筛选及桌面／移动检查；其余10组任务、资料与候选流程回归仍通过。
- 1440桌面与390移动截图已检查，等级列／字段清晰，无横向溢出；筛选有独立可访问名称，沿用既有布局、颜色、焦点及移动控件样式。
- Impeccable目标检测通过，无输出问题；未扩大到其他目录筛选与界面改版。
- 测试使用隔离应用数据库和任务专用浏览器目录，结束后关闭并清理；未操作实际业务数据。

证据见[[tools/RiskHot/docs/verification/source-grades/results.json|11组检查结果]]与[[tools/RiskHot/docs/verification/source-grades/browser.log|执行输出]]。桌面、移动截图保存在同名目录。
