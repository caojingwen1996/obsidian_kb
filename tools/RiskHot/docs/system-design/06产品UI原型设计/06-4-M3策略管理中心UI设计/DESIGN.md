---
name: RiskHot M3 UI设计规范
description: 清晰分层、职责可辨、版本有据的风险治理工作台
version: V2.1
date: 2026-10-16
colors:
  primary: '#295c47'
  primary-hover: '#214c3b'
  nav: '#193d33'
  nav-text: '#d2ded7'
  canvas: '#f5f5ef'
  surface: '#ffffff'
  surface-subtle: '#f7f8f5'
  ink: '#22352e'
  muted: '#58675e'
  line: '#dfe5df'
  selected: '#e8f0e9'
  program-bg: '#e8f0f7'
  program-ink: '#365f7c'
  ai-bg: '#eee8ff'
  ai-accent: '#8062b6'
  ai-ink: '#624392'
  human-bg: '#fff0d9'
  human-ink: '#805b22'
  condition-bg: '#edf0f4'
  condition-ink: '#526078'
  danger: '#a1392c'
  warning: '#856019'
  control-hover-bg: '#f0f4ee'
  control-hover-line: '#a6b6a9'
  control-active-bg: '#e6ede4'
  button-disabled-ink: '#6c756f'
  button-disabled-bg: '#f0f2ed'
  button-disabled-line: '#e1e5df'
  field-line: '#bdc9bf'
  field-hover-line: '#879e8d'
  field-placeholder: '#68736b'
  field-disabled-bg: '#f3f5f1'
  field-disabled-ink: '#606c63'
  nav-hover: '#284e41'
  nav-selected-bg: '#e6eee5'
  nav-selected-ink: '#254e3b'
  success-bg: '#edf4ec'
  success-ink: '#285b42'
  success-line: '#d5e5d4'
  warning-bg: '#fcf4e4'
  warning-line: '#ebdfc1'
  danger-bg: '#fbefea'
  danger-line: '#efd6ca'
  callout-bg: '#f0f5ec'
  callout-ink: '#3f5747'
  callout-line: '#dce5d8'
  callout-warning-bg: '#fcf6e9'
  callout-warning-line: '#e8d9b8'
  callout-danger-bg: '#fcf0ec'
  callout-danger-line: '#e4c7bd'
  node-bg: '#f5f8f0'
  node-line: '#4c6c54'
  node-border: '#cad7c8'
  module-bg: '#f1f6ed'
  module-ink: '#47674d'
  boundary-bg: '#f8f9f6'
  boundary-ink: '#52674f'
  role-bg: '#ffffffb3'
  role-line: '#d8e0d5'
  ai-role-bg: '#f8f5ff'
  ai-role-line: '#cbbbdf'
  ai-summary-ink: '#523676'
  program-summary-ink: '#294f6a'
  human-summary-ink: '#73501a'
  condition-summary-ink: '#43516a'
  code-bg: '#f5f7f4'
  code-line: '#e5ebe2'
  table-hover: '#f9fbf7'
  text-selection-bg: '#cee3d5'
  text-selection-ink: '#173d2e'
  dialog-backdrop: '#112c275f'
typography:
  headline:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -.02em
  headline-mobile:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -.02em
  page-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: -.02em
  title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.5
  detail-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.6
  stage-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.6
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.65
  field:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
  field-label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.65
  secondary:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.65
  module-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.65
  route:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.6
  caption:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.65
  compact-role:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.6
  compact-note:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.8
  node-step:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.5
  layer-number:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -.02em
  code:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.7
  code-compact:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.7
  code-block:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.9
  mobile-field:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  mobile-catalog-name:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.6
  mobile-dialog-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 19px
    fontWeight: 600
    lineHeight: 1.5
  mobile-version-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.5
  metric:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 38px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -.03em
  mobile-metric:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 34px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -.03em
  brand:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: -.025em
  brand-compact:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 23px
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: -.025em
rounded:
  link: 3px
  inline-code: 4px
  role: 5px
  status: 6px
  stage-nav: 7px
  control: 8px
  toast: 10px
  panel: 12px
  dialog: 16px
  dot: 50%
spacing:
  xs: 4px
  compact: 6px
  sm: 8px
  gap-sm: 10px
  gap: 12px
  field-gap: 14px
  md: 16px
  inset-sm: 18px
  section: 20px
  lg: 24px
  panel-inset: 26px
  content-inset: 28px
  xl: 32px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
    padding: 9px 16px
    height: 40px
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
  button-primary-active:
    backgroundColor: '{colors.primary-hover}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
  button-primary-focus:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
  button-primary-disabled:
    backgroundColor: '{colors.button-disabled-bg}'
    textColor: '{colors.button-disabled-ink}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
    padding: 9px 16px
    height: 40px
  button-secondary-hover:
    backgroundColor: '{colors.control-hover-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
  button-secondary-active:
    backgroundColor: '{colors.control-active-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
  button-secondary-disabled:
    backgroundColor: '{colors.button-disabled-bg}'
    textColor: '{colors.button-disabled-ink}'
    rounded: '{rounded.control}'
    typography: '{typography.button}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    typography: '{typography.field}'
    padding: 9px 12px
    height: 40px
  input-hover:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    typography: '{typography.field}'
  input-focus:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    typography: '{typography.field}'
  input-disabled:
    backgroundColor: '{colors.field-disabled-bg}'
    textColor: '{colors.field-disabled-ink}'
    rounded: '{rounded.control}'
    typography: '{typography.field}'
  ai-role:
    backgroundColor: '{colors.ai-role-bg}'
    textColor: '{colors.ai-ink}'
    rounded: '{rounded.role}'
    typography: '{typography.compact-role}'
    padding: 2px 6px
  status-success:
    backgroundColor: '{colors.success-bg}'
    textColor: '{colors.success-ink}'
    rounded: '{rounded.status}'
    typography: '{typography.caption}'
    padding: 3px 9px
  status-warning:
    backgroundColor: '{colors.warning-bg}'
    textColor: '{colors.warning}'
    rounded: '{rounded.status}'
    typography: '{typography.caption}'
    padding: 3px 9px
  status-danger:
    backgroundColor: '{colors.danger-bg}'
    textColor: '{colors.danger}'
    rounded: '{rounded.status}'
    typography: '{typography.caption}'
    padding: 3px 9px
  workspace-selected:
    backgroundColor: '{colors.selected}'
    textColor: '{colors.primary}'
    rounded: '{rounded.control}'
  ai-task-selected:
    backgroundColor: '{colors.ai-bg}'
    textColor: '{colors.ai-ink}'
  node:
    backgroundColor: '{colors.node-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 11px 12px
  node-ai:
    backgroundColor: '{colors.ai-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 11px 12px
  node-program:
    backgroundColor: '{colors.program-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 11px 12px
  node-human:
    backgroundColor: '{colors.human-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 11px 12px
  node-condition:
    backgroundColor: '{colors.condition-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 11px 12px
  panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
    padding: 26px
  dialog:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.dialog}'
  code-block:
    backgroundColor: '{colors.code-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    typography: '{typography.code-block}'
    padding: 18px
---

# RiskHot M3 UI设计规范

## Overview

**设计方向：清晰分层的治理工作台。** 本规范先于本轮UI重构生成，取代旧版视觉规范。覆盖M3策略目录、系统及场景流水线、策略基本信息、依赖、版本历史、AI任务五个子页、评估四个子页，以及新建、修订、校验和确认弹窗。本文件描述M3界面；三中心统一约束见[[tools/RiskHot/docs/system-design/06产品UI原型设计/DESIGN|统一UI规范V2.1]]。

使用Impeccable的Operate设计要求和UI UX Pro Max的企业应用排版、间距与可读性建议。技能检索得到的营销页与IoT模板不适用，不引入其Hero、转化按钮、玻璃特效或蓝橙品牌方案。保留用户确认的绿色品牌、独立紫色AI、桌面流水线6:4和L0～L3业务分层。

设计主张：导航与工作内容分开；业务主线与条件出口分开；当前生效与待修改状态同时可辨。流程的层号承担定位，节点承担选择，右侧承担解释；每种信息只有一个明确的视觉层级。

业务依据见[[tools/RiskHot/docs/system-design/03-系统功能架构/M3策略管理中心功能设计|M3功能设计]]、[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/03. 流水线文档依据与节点对照|总览与领域节点对照]]；交互与权限契约仍以[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/EXPERIENCE|交互契约]]为准。

**本轮修改边界：页面渲染模板、CSS、设计说明及验证材料。** 2026-10-16按用户给定层级重新排布C01；允许调整app.js的展示函数，业务处理、校验、权限及flow-data.js保持不变。上一轮全部脚本逐字节保留的要求记录为历史验证基线。 不改数据、文案中的业务含义、策略路径、角色、校验、条件、版本、生效行为、评测集和评估结果；不增加功能、模型调用或网络依赖。

## Colors

深绿品牌配暖灰背景、白色工作面。绿色用于产品导航和主操作；紫色专用于AI职责，不用于系统主导航。

| 语义 | 背景 / 文字 | 使用位置 |
|---|---|---|
| 品牌主色 | #295c47 / 白色 | 主按钮、当前工作区、关键链接 |
| 产品导航 | #193d33 / #d2ded7 | 桌面侧栏；当前模块为浅绿底深绿字 |
| 工作背景 | #f5f5ef | 页面画布，继承用户配色约束 |
| 工作面 / 次级面 | #ffffff / #f7f8f5 | 表格、详情、表单、轻量分区 |
| 正文 / 次级文字 | #22352e / #58675e | 正文、说明、字段标签 |
| 程序 | #e8f0f7 / #365f7c | 程序节点、节点详情摘要 |
| AI | #eee8ff / #624392 | AI节点、任务选中、AI内容摘要，强调色#8062b6 |
| 人工 | #fff0d9 / #805b22 | 人工节点、人工职责摘要 |
| 条件 | #edf0f4 / #526078 | 条件判断，与AI紫色区分 |
| 警示 / 错误 | #856019 / #a1392c | 待复核、退化、失败；保留状态文字 |

选择态由轮廓、字重与aria状态表达，节点原有角色底色保留；AI选择态轮廓使用紫色。程序、AI、人工和条件必须同时显示类型文字或可识别的职责缩写，颜色不单独承担含义。状态绿色与品牌色可共用色系，状态必须带文字。

## Typography

产品正文统一使用本机中文无衬线字体；不加载远程字体。代码、规则编号与版本引用使用本地等宽字体；品牌字样使用同一无衬线家族，不用装饰性斜体。

| 层级 | 字号 / 字重 | 场景 |
|---|---|---|
| 模块名称 | 14px / 600 | 顶栏策略管理中心 |
| 页面标题 | 20px / 600 | 流水线 |
| 任务 / 对象标题 | 20px / 600 | 策略目录、AI任务目录、策略评估、详情名称 |
| 阶段标题 | 15px / 600 | L0～L3标题、业务阶段 |
| 正文 / 表格 / 控件 | 14px / 400～500 | 主体阅读和操作 |
| 次级说明 | 12px / 400 | 表头、标签、编号、时间与辅助信息 |
| 紧凑图例 | 11px / 500 | 角色标签、并行组附注；不承载主要业务描述 |

正文行高1.65；详情说明1.8。标题保留自然换行，不拆分正常中文；长编号允许任意换行；长表格在容器内滚动。数字采用tabular-nums。手机输入字号16px，避免自动放大。

## Layout

### 全局结构

桌面侧栏216px，顶栏约56px，内容左右留白32px；1280px以下侧栏192px、内容留白24px。三个工作区作为左侧“策略管理中心”的缩进子菜单，内容区不重复显示tab；正文保留当前位置/角色、模块标题与当前任务区域。删除装饰性英文眉题；主标题与页内任务标题保留不同层级。

侧栏采用一致的18px线性SVG图标。侧栏其他业务模块仍为原有参照与入口，不制造不可用的搜索、消息、设置或用户功能。

### 页面结构

| 页面 | 主区域组织 |
|---|---|
| 策略目录 | 只读流水线入口位于侧栏 → 策略设计与管理标题及新建 → 搜索/筛选 → 策略表 → 条数与边界；架构阅读与单条策略编辑分开 |
| 策略详情 | 返回 → 策略身份与版本、编辑工具 → 四项导航：策略基本信息与适用范围 / 流水线编排（核心编辑区域）/ 规则与AI Task引用 / 版本治理与生效；默认打开编排 |
| 系统全景 | 流水线选择 → 标题与图例 → 左60%分层流程、右40%节点解释；层号明显、横向支撑独立 |
| 场景流程 | 阶段导航 → 准备/分析/校验等环节 → 节点；并行分析横向排列、独立出口单列；连线语义保持原样 |
| AI管理 | 左侧可搜索任务目录、右侧任务内容；任务选中使用紫色；五个子页共享相同正文和字段规范 |
| 策略评估 | 版本及可比条件 → 已有四项结果 → 指标表 → 案例差异；评测集、指标口径、历史沿用相同表面规范 |
| 弹窗 | 清晰标题 → 信息/字段 → 原有动作；保留原生dialog、关闭、取消、Esc与焦点返回 |

流水线左/右宽度在扣除24px间距后严格为3:2；节点详解顶部粘附20px。左侧工作面只承担流程外框；阶段通过层号、留白和细分隔线区分，不层层套卡片。次要分支沿用现有折叠，节点和后继行为保持不变。

### 响应式

- 1440/1920px：完整侧栏及工作区，表格七列；流程6:4。
- 1024px：紧凑侧栏/间距，阶段说明自然换行；900px及以下隐藏侧栏。
- 760px及以下：流水线、AI目录/内容、双栏表单纵向排列；图中并行列改纵向但保留组名。
- 650px及以下：目录表格转字段行，筛选折行，弹窗保留16px边距，按钮最小44px高。
- 320/390px：长标题、编号、标签自然换行；指标和对比表仅在各自容器中滚动，禁止页面整体溢出。

## Elevation & Depth

常规工作面采用单层1px边界；流程阶段用留白和分隔线形成层级，避免重复面板。弹窗与短暂反馈允许软阴影，普通卡片不叠加阴影和边框。侧栏、页面背景、白色工作面的明度差提供主层级。

## Shapes

控件8px，工作面12px，dialog16px。状态标签6px，不将所有元素做胶囊。节点1px完整边框，选中外轮廓2px；移除大于1px的装饰性左侧色条，角色由底色和标签表达。禁止渐变字、装饰网格、玻璃效果及无意义动效。

## Components

### 按钮与导航

桌面主按钮40px高，14px/500字重，9px 16px内边距；同一任务只突出一个原有主操作。次按钮白底细边，文字操作使用清晰链接色。一级工作区保留原有三项及aria-pressed；二级导航使用轻底色。状态切换仅150ms颜色过渡，尊重减少动态偏好。

### 表格与筛选

筛选字段显式标签在控件上方，搜索占剩余空间；表头12px，单元格14px，14px 16px内边距。名称15px/600、说明12px；编码单独成行。表格保留全部列和无结果恢复入口，不删减业务信息。

### 流水线节点与详情

阶段导航字号12px，当前层/阶段清晰可辨；层号20px用于业务分层定位。主节点名称14px、系统模块卡片13px；并行紧凑列12px。角色文字保留，节点高度随实际文本增长。详情标题20px，摘要14px，字段正文14px、标签12px；职责、输入输出、后继、规则、来源、折叠配置分区显示。

### AI目录与代码区

任务目录宽280px，搜索与列表同宽；当前任务浅紫底紫字，取消绿色侧条。任务内容面28px留白。Prompt/Schema为13px等宽文本、1.9行高，使用柔和中性底色；完整显示与复制原文能力保持浏览器原生行为。

2026-10-16补齐全任务提示词：沿用五标签，在Prompt正文前展示用途与业务文档依据，剩余15项增加AIHOT方法参考；长文本继续使用既有换行和滚动布局。新增本地 `task-prompts.js` 保存这15项定义，由C02与流水线共用；Schema与Skill仍标记示例。具体来源及验证见 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/全任务提示词补充记录|全任务提示词补充记录]]。

2026-10-16继续补齐输入输出：16项任务逐项列示字段、内容要求和来源，结构未定状态使用文字和提示标识，另列待定事项。宽屏目录采用三列表格，窄屏和内嵌面板改为逐字段卡片式排列，保留原生表格语义及无障碍说明。输出Schema字段片段默认折叠，避免与字段表重复占用阅读空间；既有节点输入输出摘要和独立折叠配置保留。定义来源与验证见 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/全任务输入输出补充记录|全任务输入输出补充记录]]。

### 表单、状态与弹窗

输入高度40px，textarea至少104px，标签14px；必填、disabled、readonly沿用既有语义。正常、hover、focus-visible、active、disabled采用统一样式；错误区保留role=alert。dialog标题20px，主体24px留白；标题/底部动作在弹窗自身滚动中可见。案例差异弹窗沿用左右版本对照和手机堆叠。

### 空状态和反馈

沿用真实无结果、未接入、等待运行、只读与业务未决文案；不添加假数据、假加载或未经业务定义的状态。toast保留原有时长和消息。无新网络请求、外部字体、图标库或埋点。

## Do's and Don'ts

- Do：以字号、字重、间距和对齐建立层级，保留完整字段和条件说明。
- Do：程序蓝、AI紫、人工橙、条件蓝灰；选择态和角色底色可同时辨认。
- Do：用既有91项交互检查核对功能不回退；新版C01按函数核对业务处理与校验不变，flow-data.js逐字节一致。
- Do：在1440、1024、768、390、320px检查页面、弹窗和长文本；保留键盘焦点与减少动态支持。
- Don't：新增统计、工作流、审核规则或替换业务文案来装饰页面。
- Don't：每段文字套一张卡片，重复堆叠边框、彩色侧条或英文装饰标签。
- Don't：把截图审查或UI检查通过表述为业务系统已验收。

## C01排布补充（2026-10-16）

业务流程全景独立于策略目录操作，显示“全系统业务架构视角 · 只读”；在具体策略编辑页使用紧凑入口，避免重复占据核心编辑空间。详情顶部集中策略身份、当前生效版本、所查看版本与复制/保存/创建修订；审核、生效、停用和退回归入最后一项治理区域。四项导航在桌面横排，1050px以下2×2等序排列，不使用步骤编号暗示强制顺序。流水线默认打开，保留左60%/右40%。引用页区分领域规则与固定AI Task，再展示消费模块与历史运行。治理页先当前状态及可执行动作，再展示比较和时间线。控件保持原data-action、状态条件、禁用语义及表单校验。

## M3工作区子菜单（2026-10-16）

策略设计与管理C01、AI智能分析管理C02、策略评估C03移入左侧“策略管理中心”父项下，沿用同一组data-view按钮及aria-pressed状态。桌面通过缩进与1px关系线体现父子层级，子项44px高，当前子项浅绿底。900px及以下侧栏其他项目继续隐藏，这同一组按钮转为底部三项导航；预留100px及底部安全区，焦点可见。不复制另一组按钮，不改页面切换及权限处理。

## 流水线独立子菜单（2026-10-16最新）

“流水线全景”置于策略管理中心子菜单首项，固定展示RiskHot整个系统流程，其后为C01/C02/C03三个管理工作区。全景顶部不显示流水线选择、版本切换、完整性检查和返回目录工具；通过侧栏切换工作区。全景只读，策略及版本的维护仍从C01进入。窄屏底部导航为四列，保留安全区。此前可切换场景的全景设计为历史，以本节为准。

## 子菜单文案精简（2026-10-16）

子菜单只显示流水线全景、策略设计与管理、AI 智能分析管理、策略评估四个名称，不显示能力编号或“只读”等附注。页面内的只读标识和权限保持。

## 标题区域精简（2026-10-16）

删除正文中的重复模块大标题及通用说明，将“策略管理中心”作为14px/600的h1并入顶部位置栏；正文保留当前页20px任务标题。桌面说明与标题同排，手机自然换行；演示标识移至页脚。内容顶留白20px、任务头底间距16px，顶栏实际约57px。1920px视口下目录筛选起点从256.4px提前到134px，业务操作、字段和脚本不变。

## 三中心紧凑标题统一（2026-10-16最新）

遵循上级统一规范：57px位置栏、14px模块h1、20px当前任务标题、20px内容顶间距和16px标题底间距。桌面标题说明同排，手机保持自然换行。M1原有无正文大标题的工具区直接进入设计保留；M2模块名称与原修订审核动作在顶栏，正文不重复；M3流水线标题先于选择工具区并保持只读和6:4。当前布局以此补充及现行原型为准。

## 策略目录默认排序（2026-10-16）

用户确认按业务归属排列：业务层L0/L1/L2/L3升序，其次主责模块F编号，最后稳定编码；数字部分按数值比较。仅排序筛选后的显示副本，不调整底层策略记录顺序，搜索/筛选和版本治理不变。

标题区域共同约束见[[tools/RiskHot/docs/system-design/06产品UI原型设计/标题区域设计规范|标题区域设计规范V1.0]]；逐页结果见[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/标题区域全页面检查记录|全页面标题检查]]。标题规则以此共用规范为准，其他组件及业务契约保持。


## 2026-10-16 · AI 任务内嵌详情

流水线与策略编排共用节点详情。AI 节点标题与摘要下方展示任务名称、固定任务版本、只读标识和 C02 的五标签。内容依次为任务定义、Prompt / Skill、输入输出、工具与约束、引用与版本，保留原型示例与未定稿提示。下方仍有当前节点职责、输入输出、流向与异常处理、规则、文档依据和节点配置。

- 桌面继续使用左 60% / 右 40%；AI 面板顶部粘附 20px，最大高度为视口减 40px，面板内部滚动。900px 以下为底部导航预留空间，760px 以下沿用纵向排布。
- 标签采用现有紫色选择态，空间不足自然折行，不隐藏任何标签；支持方向键、Home、End，面板有键盘焦点。
- 点击节点局部替换右侧，保留左侧画布、选中和折叠状态；切换任务标签仅更新正文，保留未应用的节点表单。不同节点、策略版本默认回到任务定义。
- C01 与 C02 共用 `taskContent` 及标签目录。任务编号和固定版本必须精确匹配；缺失版本不显示其他版本内容。任务始终只读，节点配置沿用管理员/草稿限制。
- 引用与版本来自各策略版本实际节点，内嵌模式不提供导航按钮；任务修订仍由 C02 管理，不修改已引用定义。

验收证据：[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI任务内嵌验证记录|AI 任务内嵌验证记录]]。


## 2026-10-16 · AI 详情精简

AI 详情只保留一个节点主标题，移除阶段小字、重复任务标题、来源解释和重复执行职责；任务编号与固定版本合并一行，保留只读标记。内嵌任务定义去掉重复的分析问题与模型调用说明，保留完成标准、分析步骤和后续处理。正文为14px，收紧摘要、标签及区块间距。五标签、节点映射与流向、独立滚动、固定引用和权限规则保持；C02 独立页面仍显示完整任务说明。任务名称可在编号悬停提示中核对。


## 2026-10-16 · 全类型节点详情精简

程序、条件、人工、开始/结束及业务模块节点沿用 AI 详情的单标题与简洁分区：去掉阶段小字、重复执行职责、节点/后继编码小字和通用配置说明；保留独立摘要、输入输出、所有流向、规则与节点配置。阶段信息可悬停标题查看。人工节点显示处理人及获授权的处理出口；缺失后继和待确认事项继续显式提示。

正文、分区标题、流向、规则和配置标签按14px呈现。文档依据默认折叠，可展开阅读来源文件与章节；待确认事项位于折叠区域之外。节点配置保留原有角色和草稿限制，只读状态以简短文字呈现。业务蓝图、规则、连接、配置写入和权限校验保持原实现。

专项验证见 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/节点详情精简验证记录|节点详情精简验证记录]]。


## 2026-10-16 · AI任务定义与节点配置分区

AI节点的输入输出说明集中在“输入输出”Tab，与C02上下文及输出Schema一起查看。说明沿用现有业务蓝图，Prompt、Skill、Schema和固定任务资产仍复用C02；不新增或修改共享任务数据。

五标签区域之外只保留一个独立的“节点配置与流向”折叠入口，默认收起。展开后展示上游输出到本节点输入的映射、当前输出到下游输入的映射及分支条件、必须汇合的依赖、规则引用和文档依据；草稿编辑表单也收在该区域中。原先的“需要什么输入／产出什么”说明不再在公共区域重复出现。

映射按已保存的节点参数和真实连线展示，当前原型仍为简化的context级映射，不推断字段级契约。切换Tab保留折叠状态和未提交表单；切换AI节点或策略版本重新默认收起。非AI节点维持现行简洁详情。

验证及截图见 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/AI节点配置分区验证记录|AI节点配置分区验证记录]]。


## 2026-10-16 · 页面与当前页签操作统一顶栏

按用户确认，M3的页面与当前页签操作统一并入最顶部“RiskHot / 横向支撑 / 策略管理中心”所在行。本节覆盖此前仅放全局工具及正文操作区的M3布局约束。

- 目录：新建策略；策略详情：查看版本、复制、保存草稿或创建新修订；编排页签附加完整性检查和添加节点，治理页签附加当前状态对应的审核、生效、退回或停用操作。
- 流水线：查看流水线、场景版本、打开策略详情与完整性检查；AI管理：创建任务修订或编辑草稿；评估：新建评估，评测集页签附加创建评测集修订。
- 返回目录与角色选择同处顶栏。操作随页面、页签、版本状态和角色更新，原按钮的权限与事件处理沿用；列表行及节点表单内部的对象操作仍位于对应对象中。
- 顶栏保持57px与单行排布，内容超出时仅顶栏横向滚动；按钮、标签和选择器不折行。窄屏隐藏路径前缀，返回使用短文案及完整无障碍名称。

验证：`node 验证/顶栏返回验证.mjs`，160项交互与状态检查通过。浏览器禁止读取file页面，本轮未执行视觉与实际视口布局复验。


## 2026-10-16 · 三中心页面与页签操作统一顶栏

本模块全部现行页面执行[[tools/RiskHot/docs/system-design/06产品UI原型设计/标题区域设计规范|标题区域设计规范V1.1]]：页面／页签操作进入应用顶部位置栏，弹窗及抽屉操作进入各自标题行；保持单行并允许操作区横向滚动，保留原控件、权限、表单归属和焦点。此规则覆盖此前正文操作区及底部表单操作的历史布局。具体覆盖及验证限制见[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心操作统一顶栏记录|三中心操作统一顶栏记录]]。


## 2026-10-22 · 导航与操作分离

面包屑只表达模块位置。页面及当前对象/页签操作放在正文独立工作区操作栏，按上下文与权限更新，禁止在导航中混入维护动作。宽屏保留清晰分组，窄屏自然换行并保持至少44px触达高度。弹窗和抽屉的操作仍归属于各自标题行；控件身份、提交意图、版本、状态与权限沿用现有逻辑。本条覆盖本文件此前页面操作进入导航顶栏的定位要求。



## 流水线全景设计归属 · 2026-10-22

流水线全景独立维护于 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/DESIGN|全景视觉与布局规范]]；相关折叠、分层和全景导航章节已迁出。M3共用流程查看器继续承载策略内编排和AI详情，三项管理工作区仍由本文件约束。


## 2026-10-22 · 共用查看器的全景层级契约

共用app.js与styles.css中的全景展示已按[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-流水线全景ui设计/DESIGN|全景现行视觉规范]]采用L0～L3一级折叠容器：业务层标题16px / 600、职责说明12px，内部F模块标题14px / 600、默认收起卡头48px。此处覆盖本文件历史全景字号和弱化层标签说明；C01版本化策略编排独立沿用现行规范，原策略蓝图、业务字段及固定AI引用保留。
