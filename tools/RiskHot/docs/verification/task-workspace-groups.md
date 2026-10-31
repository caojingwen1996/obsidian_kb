# 信息采集任务三个分组验证

2026-10-29按用户指定结构整理M1工作区。顶部仅保留信源目录、信息采集任务，去掉手动任务页签。

| 子分组 | 页面内容 | 地址 |
| --- | --- | --- |
| 任务计划设置 | 原任务计划的启停、执行周期及单源执行记录入口 | #intake-tasks?view=plans |
| 手动发起采集 | 原手动任务的信源选择、发起及手动采集记录 | #intake-tasks?view=manual |
| 任务执行记录 | 原信息采集任务的自动／手动任务列表、详情和资料 | #intake-tasks |

默认进入执行记录，保留原信息采集任务入口行为。子分组切换、刷新、任务详情及资料阅读均保持顶部信息采集任务高亮；旧#manual-tasks和#sources?mode=automatic自动跳转。子页签使用可访问的导航链接及aria-current，不额外模拟客户端页签键盘规则。计划页不读取执行记录，手动页查询只带手动过滤，view参数不发送给任务接口。

## 修改及验证

修改[[tools/RiskHot/src/web/current-app.js|路由与导航]]、[[tools/RiskHot/src/web/index.html|顶部页签]]、[[tools/RiskHot/src/web/styles.css|子页签样式]]，同步两个浏览器用例、README、M1功能设计和页面设计、项目索引与日志。

- 15组隔离浏览器回归通过，包含三个分组顺序和选中态、旧手动入口跳转、顶部仅两项、计划保存启停、手动多源发起及结果阅读。
- 实际服务只读浏览器7组检查通过，覆盖三个分组切换、刷新保留、1440／1280桌面和390移动布局；无页面错误和写请求。
- 12项页面单元及类型检查通过；Impeccable检测无发现，桌面与手机截图已检查。
- 实际计划值和信源数据未调整；需要写入的回归只使用隔离测试数据库。

证据：[[tools/RiskHot/docs/verification/task-workspace-groups/results.json|隔离回归]]、[[tools/RiskHot/docs/verification/task-workspace-groups/live/live-results.json|实际只读结果]]及同目录桌面、移动截图。刷新实际页面即可生效。

## 左上角返回名称统一

2026-10-29按用户要求，M1的任务详情、资料正文和候选详情左上角入口统一显示“返回”。仅修改按钮文字，原data-back行为保持不变。同步既有浏览器选择器及任务／资料按钮名称断言，回归证据保存在[[tools/RiskHot/docs/verification/unified-back-label/results.json|返回名称验证结果]]。

## 新增事件处理任务空白页

2026-10-29按用户要求，在信息采集任务之后新增“事件处理任务”顶部页签，地址#event-tasks。该页保持内容区为空，仅保留公共框架及导航；不显示采集子分组，不读取信源、任务、计划或事件数据。用户显式要求的预留入口不代表事件任务管理功能已经实现。

修改current-app.js、index.html及两个既有浏览器用例；同步README、M1功能设计、索引和日志。实际服务只读浏览器8组检查通过，覆盖顶部顺序、点击与刷新空白、正确选中态、业务请求为零、返回原任务列表以及桌面／手机布局。脚本语法及类型检查通过；Impeccable检测无发现，截图已检查。

证据：[[tools/RiskHot/docs/verification/event-task-placeholder/live-results.json|空白页实际验证]]及同目录桌面／移动截图。
