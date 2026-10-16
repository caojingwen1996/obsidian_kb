---
title: M3 AI任务内嵌详情实施与验证记录
date: 2026-10-16
status: 已验证
---

# M3 AI 任务内嵌详情

## 实施结果

在侧栏“流水线”的分场景视图和策略设计“流水线编排”中，点击 AI 节点即可在右侧查看固定版本的任务定义、Prompt / Skill、输入输出、工具与约束、引用与版本。默认打开任务定义，所有任务内容只读。任务编号与版本严格匹配 C02；缺失时显示不可用，不回退到最新版本或草稿。

C01 与 C02 共用任务正文和标签目录，不复制 Prompt / Skill / Schema。引用列表按各策略版本的实际节点反查，内嵌模式不提供跳转按钮。节点本身的输入输出映射、后继、异常路径、规则、来源与草稿配置继续保留。节点选择局部更新右侧；任务标签只更新正文，因此左侧画布、展开与滚动状态以及未应用的节点表单不会被重建。右侧 AI 面板可独立滚动，桌面 6:4 保持，窄屏标签折行。

依据已通过 RiskHot Knowledge 读取的 [[tools/RiskHot/docs/system-design/03-系统功能架构/M3策略管理中心功能设计|M3 功能设计]] §3.1.5、§3.1.8、§3.2 以及当前原型。所有共享任务内容继续沿用 C02 原型示例，不声称已经形成逐任务正式业务契约。

## 修改文件

- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/原型资源/app.js`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/原型资源/styles.css`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/00. 阅读导航.md`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/02. 交互原型说明.md`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/DESIGN.md`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/EXPERIENCE.md`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌验证.mjs`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌视觉回归.mjs`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌验证记录.md`

项目导航和维护记录同步更新：

- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/index.md`
- `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot/log.md`

入口 `M3策略管理中心交互原型.html` 无需修改，仍加载现有资源；`原型资源/flow-data.js` 逐字节保持不变。

## 验证结果

本次于 2026-10-16 在 Mac 本地 Chrome 无头浏览器运行；只读取 file URL，阻断并记录外部网络请求。

| 验证 | 结果 |
|---|---|
| JS 语法 | app.js、flow-data.js、两个新增验证脚本通过 |
| 新增专项交互 | 83/83；含所有 6 场景、17 个 AI 节点引用位置、五标签、固定版本、草稿隔离、只读、键盘、页面与左侧位置保持 |
| 原有交互回归 | 93/93；审核、生效、停用、在途版本及权限保持 |
| C01 排布 | 45/45 断言；37 次视口检查；19 张截图 |
| 原有视觉检查 | 30 次视口检查；22 张截图；无横向溢出 |
| 新增视觉截图 | 五标签桌面截图及 1920/1440/1024/768/390/320px 截图，共 11 张 |
| 非 AI 逐像素对照 | 11/11 一致；覆盖目录、全景、程序/条件/边界/人工节点、三个策略分区、C02 Prompt、评估 |
| 业务依据 | 7 套蓝图、122 个节点、5 份来源文档，无错误 |
| 业务区段保护 | HTML、flow-data.js、原始 AI/策略数据、完整性校验、编辑权限和全部表单写入处理的 SHA-256 前后一致 |
| 浏览器错误 / 外网请求 | 均为 0 |

首次新增专项在“五标签内嵌”断言失败，确认能检出旧版缺失，完成实现后通过。首次像素比较中边界节点出现细微文字栅格差异；核对元素坐标、尺寸完全一致，等待字体就绪后复跑及扩展人工节点对照，最终 11 项均逐像素一致。人工节点通过现有“添加节点”交互建立会话测试样例，不写入业务蓝图。

已人工查看五个标签的桌面截图以及 1024、390、320px 截图；内容、版本与只读标记清晰，无标签丢失、遮挡或横向溢出。窄屏保持既有纵向布局，需滚动到节点详情阅读。

## 复验命令

在本目录的上一级（M3 UI 设计目录）执行：

```bash
node --check 原型资源/app.js
node --check 原型资源/flow-data.js
node 验证/AI任务内嵌验证.mjs
node 验证/原型交互验证.mjs
node 验证/C01排布验证.mjs
node 验证/UI视觉验证.mjs
node 验证/检查流水线依据.mjs
python3 验证/检查文档.py
```

非 AI 逐像素对照需要传入修改前目录（必须包含 HTML 与原型资源），本次使用：

```bash
node 验证/AI任务内嵌视觉回归.mjs /var/folders/hh/5jrmgmsx377fsl_56cz7q13w0000gn/T/riskhot-m3-before-kdejcc46
```

该临时副本仅用于本次比较。长期证据保存在 `AI任务内嵌视觉回归结果.json` 的文件/区段指纹与 `AI任务内嵌截图/非AI回归/` 的 before/after 截图中。

## 输出证据

新增 `验证/AI任务内嵌验证结果.json`、`验证/AI任务内嵌视觉回归结果.json` 与 `验证/AI任务内嵌截图/`。运行现有脚本刷新了原型、C01、UI视觉、流水线依据及文档检查结果与对应截图；历史说明文档保留。旧脚本结果文件中的固定日期字段仍为原脚本标签，本节记录实际复验日期。

![[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌截图/1440-prompt.png]]

![[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌截图/390-responsive.png]]


## 后续精简 · 2026-10-16

按用户截图反馈去除重复说明与小字：修改 app.js 的内嵌展示分支和 styles.css；同步交互原型说明、DESIGN，以及两份交互验证脚本。任务定义正文提高到14px，移除重复标题、阶段、来源解释、重复职责和模型调用提示，五标签与节点业务信息保持。C02 原页面及共享任务数据不变。

专项增加4项精简断言，现为87项通过；原有交互93项通过；非AI视觉对比11项一致，保护区段指纹一致。已查看桌面和手机截图，截图对应的事件抽取页面见下。更新的前后比较使用临时基线 `/var/folders/hh/5jrmgmsx377fsl_56cz7q13w0000gn/T/riskhot-m3-simplify-before-65elt1q9`。

![[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌截图/事件抽取-精简详情.png]]
