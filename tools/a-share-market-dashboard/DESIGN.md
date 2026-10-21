---
name: A股市场仪表盘 · 红利查看与管理局部设计约定
description: 从现有红利查看与管理页面提取的蓝灰视觉约定，仅约束两页局部维护。
colors:
  action: "#2464bf"
  action-hover: "#1d55a6"
  action-active: "#184b96"
  navigation: "#3276d8"
  chart-yield: "#82633b"
  chart-grade-a: "#945409"
  chart-grade-b: "#126a53"
  ink: "#18232c"
  muted: "#53616c"
  line: "#dfe5e9"
  paper: "#f3f5f6"
  card: "#ffffff"
typography:
  title:
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "20px"
    fontWeight: 700
  signal-heading:
    fontSize: "17px"
    fontWeight: 700
  signal-verdict:
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "13px"
    lineHeight: 1.8
  result:
    fontSize: "14px"
  label:
    fontSize: "12px"
    fontWeight: 600
rounded:
  field: "5px"
  status: "6px"
  primary-button: "8px"
  secondary-button: "9px"
  settings: "12px"
  panel: "14px"
spacing:
  compact: "8px"
  field-gap: "14px"
  control-gap: "12px"
  regular: "16px"
  settings-inline: "24px"
  panel: "28px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.card}"
    rounded: "{rounded.primary-button}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-primary-active:
    backgroundColor: "{colors.action-active}"
  button-save:
    backgroundColor: "{colors.action}"
    textColor: "{colors.card}"
    rounded: "{rounded.primary-button}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.secondary-button}"
    padding: "8px 12px"
  signal-panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.panel}"
    padding: "24px 28px"
  result-panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
---

# Design System: A股市场仪表盘 · 红利查看与管理局部约定

## Overview

本文件从 `src/styles.css`、`src/index.html`、`src/app.mjs` 的既有实现与本次用户请求提取，只适用于 `#dividend-management-view` 与 `#dividend-signal-view` 的维护。蓝色、白色表面、中性灰文本及系统中文无衬线字体沿用现有仪表盘；不构成全站视觉升级，也不授权修改其他页面。

当前没有 `PRODUCT.md`。这里没有完成产品访谈、品牌工作坊或用户研究，不把描述性判断写成已确认的品牌承诺。页面任务、阅读次序与交互边界分别见 [管理页 surface brief](.impeccable/dividend-management-surface.md) 与 [查看页 surface brief](.impeccable/dividend-signal-surface.md)。

**Key Characteristics:**

- 沿用已有蓝灰视觉。
- 用文字层级、间距与分隔线组织密集数据。
- 局部采用无阴影表面，减少嵌套容器。

## Colors

前置信息中的 action、action-hover、action-active 对应管理页主按钮的局部背景与悬停、按下状态；navigation 对应全局 `--blue`，继续用于页签、披露提示和焦点等既有交互。两种蓝色职责分别记录，管理页主按钮不再引用导航蓝。查看页的指数曲线、对应左轴与布林位置标记沿用 action 的同值蓝；股息率曲线用 chart-yield，仅综合A级买点使用 chart-grade-a；原chart-grade-b不再用于买点。图例文字与图形对应，同色不是额外交易结论。深色正文、较深辅助灰、白色表面及浅灰分隔线共同保障可读性；其余规范值对应现有 `--ink`、`--line`、`--paper`、`--card` 及页面局部辅助灰。

不要把收益正负机械映射为新的整行彩色底色；当前汇总通过列标题、数值与来源文字表达含义。保留既有错误、只读和保存状态的语义处理，不为局部简化改写全站状态色。

## Typography

沿用 Inter、苹方、微软雅黑与系统无衬线回退；不新增远程字体。回测区标题使用 title；正文说明使用 body；结果数值使用 result；表头与辅助信息使用 label 或现有较小字号。数值保留等宽数字特性 `font-variant-numeric: tabular-nums`，方便纵向比较。

查看页“当前信号”和图表标题使用 signal-heading；主要结论使用 signal-verdict，700px 以下结论降为 18px；概览综合分保持 23px。字体角色来自两页现有实现，不要求其他页面统一改用此层级。优先用清楚的短标题和就近解释，长说明保持现有约 72–75ch 的阅读宽度。

## Layout

页面沿用单列内容布局与既有仪表盘外壳。局部面板之间使用现有 13px 间距。回测面板桌面内边距为 panel；窄屏改为 20px 16px。编辑区桌面左右留白为 settings-inline，窄屏为 regular。

900px 以下压缩汇总表列内留白；700px 以下同一汇总表按两列字段排列，每个值显示字段标签。760px 以下沿用已有外壳移动布局。具体列语义、窄屏表现和披露顺序属于管理页，详见其 surface brief，不推为全站模板。

查看页当前信号与走势图各用单个白色面板，桌面内边距 24px 28px、700px 以下 20px 16px。当前信号内部两列以 28px 间距和一条竖分隔线区分评分与布林，不再内嵌卡片；900px 以下改单列、22px 间距与横分隔线。走势图统计置于图下；大屏五列，761–1100px 三列，760px 以下两列。图表继续使用既有 1100px / 760px 桌面与窄屏 SVG 切换；700px 以下页标题和刷新按钮并排。

## Elevation & Depth

两页局部面板通过白色表面、间距与浅灰边界组织层次，局部覆盖既有面板阴影为 `none`。参数编辑区用边框识别可展开边界。此覆盖限于红利查看与管理两页，不要求移除仪表盘其他页面的现有阴影。

## Shapes

沿用现有柔和圆角：输入框、状态提示、主次按钮、参数区和主面板分别使用前置 rounded 对应角色。不要新增装饰性胶囊、徽章或嵌套卡片来替代文字层级。

## Components

### Buttons

管理页主按钮使用 action，未禁用时悬停使用 action-hover、按下使用 action-active。回测与保存动作最小高度 44px；回测按钮内边距见组件 token，保存按钮沿用本页 10px 16px。次按钮保留白底、描边与深色文本。按钮禁用、等待与输入校验状态继续沿用原逻辑。

### Inputs / Fields

输入框保留数值类型、标签、单位、只读端点和无效状态。编辑区最小高度 42px、内边距 8px、圆角 field；标签与输入间距 8px。只读框保留现有浅灰背景，文字使用本页 muted。保留现有绿色输入焦点描边与全局可见焦点规则。不要为了视觉一致删掉键盘焦点。

### Navigation

使用“查看 / 股息率回测 / 任务监控”页签及当前项下划线，`aria-current="page"` 指明当前位置。导航与披露提示沿用 navigation 蓝，管理页主按钮独立使用 action 蓝；任务监控归属红利信号，不新增一级导航。

### Cards / Containers

回测面板采用单个连续白色表面；说明、样本检查与明细通过分隔线和原生 disclosure 递进展开。参数区使用边框和折叠摘要。数据来源保留展开入口。查看页概览内两种策略通过分隔线并置；默认保留结论、数值、各自日期及关键异常/历史状态。买入规则简写，逐项用途注脚、公式、来源和重算说明移入各信号的“详情”，不靠缩小字号压缩信息。走势图保留线图与图例，五项区间统计在图下；不增加图内装饰卡片。

### Signal Chart & Band Position

指数与股息率图保留既有数据、双轴曲线几何与悬停/键盘提示，按仅综合A级可买入规则展示场外假设买入点。圆点按记录日后首个交易日的收盘价定位，提示分别列出买入日、信号估值日和记录日，股息率曲线仍按估值日绘制；B级保留普通数据，不作买点。采用浅色图表表面及前置 chart 色彩角色。指数蓝线宽 2px、股息率棕线宽 1.7px；买点有白色描边。布林位置条使用真实 %B，图形标记仅限位到轨道边缘，文字继续显示越轨实际值；轨道位置不能代替完整数值。

### Disclosure

使用原生 `details` / `summary`，保留键盘操作、展开状态和可见焦点。摘要悬停变蓝；管理页 summary 焦点是 3px 蓝色描边、4px 外偏移；查看页与全市场刷新摘要是 3px 蓝色描边、3px 外偏移。展开内容中的来源与参数仍可追溯。查看页评分拆解、年度收益与历史统计默认折叠但保留全文与对照指数区别；全市场刷新明细仅查看页折叠，其他页面仍打开。数据源切换按钮仅在查看页不显示。

## Do's and Don'ts

### Do:

- **Do** 沿用既有蓝灰颜色、字体与导航语义。
- **Do** 在两页用留白、细分隔线和渐进展开降低阅读负担。
- **Do** 保持字段标签、来源口径、空值和错误状态可理解。

### Don't:

- **Don't** 将本文件扩展为全站换肤授权或已确认的品牌研究。
- **Don't** 用视觉精简改变原有数据、计算、来源、保存与应用行为。
- **Don't** 为统一外观移除焦点、输入标签、只读或无效状态。

## 红利任务监控局部扩展

经用户确认，任务监控归入红利信号第三个页签，沿用既有导航、蓝灰配色、系统字体和无阴影白色表面；作用域仅`#dividend-task-monitor-view`及查看页任务摘要。模式为Operate。详情见[监控surface brief](.impeccable/dividend-task-monitor-surface.md)。

主面板使用任务名称、状态徽标、四步步骤条、分段校验进度和来源日期标签；历史尝试置于第二个连续面板。正文13px、辅助及徽标12px、标题17px、校验计数14px；桌面28px内边距，窄屏16px。步骤条和进度在700px以下纵向排列，来源日期标签和历史行在700px以下改为两列。沿用绿色#28624e表示通过、赭色#775326表示提醒、红色#a12d24表示明确错误，状态必须带中文文本。采用原生details，保留键盘焦点和展开状态；正常轮询无数据变化时不重建详情DOM。

任务概览的完成／运行／失败／待确认徽标采用既有语义色，使用浅绿#e9f3ef、浅蓝#eaf1fb、浅红#fbeeea、浅赭#f7efdf为背景。步骤圆点34px、内置SVG18px、连接线2px；历史无凭证的步骤使用虚线和减号，不能显示完成。正常说明收进运行详情，当前状态用徽标及进度表达；原始错误和日期仍可展开追溯。
