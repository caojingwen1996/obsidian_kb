---
name: RiskHot 量化信号决策辅助产品 V3
description: 继承深蓝观察台的稳定风险对象、演化记录与来源关联
colors:
  bg: "#0c1522"
  surface: "#121f30"
  raised: "#192b40"
  line: "#2b4058"
  ink: "#edf3fc"
  muted: "#a8bad0"
  blue: "#8cbbff"
  selected: "#203b5b"
  red: "#ff9aa9"
  green: "#80d8bc"
  amber: "#f3c577"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  score:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.2
  object-score:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.1
  object-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.6
rounded:
  badge: "4px"
  control: "6px"
  panel: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "24px"
  wide: "32px"
components:
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  sort-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.blue}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  badge:
    textColor: "{colors.muted}"
    rounded: "{rounded.badge}"
    padding: "2px 7px"
  navigation-active:
    textColor: "{colors.ink}"
  object-row-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "24px"
  source-link:
    textColor: "{colors.blue}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  timeline-record:
    textColor: "{colors.ink}"
    padding: "24px 0"
---
# Design System: RiskHot 量化信号决策辅助产品 V3

## Overview

**Creative North Star: "深蓝信号观察台"**

以深蓝底色、克制边框与横向对齐的数字形成专业监测界面。对象列表先交付可比较的压力与判断理由，演化记录说明评估如何改变，来源链接支持继续追溯。

V3 是已批准 V2 视觉体系的普通扩展，保留“深蓝信号观察台”的色彩、中文功能字体、密度和无投影层级。父目录一般阅读者版的浅色体系不是这里的视觉基准。所有分值、事件、日期与证据文字均为合成演示。

**Key Characteristics:**
- 深蓝色阶区分背景、容器和选中状态。
- 等宽数字与邻近单位支持横向比较。
- 文字说明程度、方向、纳管状态与记录类型，颜色辅助阅读。
- 宽屏列表与解读联动，窄屏堆叠；演化记录以日期组织。

依据：本目录 signal.css、signal.js 与 ../量化信号决策辅助产品设计V3.html；产品与表面边界见 PRODUCT.md、.impeccable/signal-surface.md。已对照桌面首页、对象详情、历史详情与手机详情审核截图；V2 的 DESIGN.md 和 sidecar 保持原样。

## Colors

深蓝中性色承载密集信息，柔亮蓝色提供交互线索，红绿表达压力语义。

### Primary
- **信号蓝（blue）**：来源链接、导航底线、焦点、趋势线与评估更新描边。

### Secondary
- **压力红（red）**：压力增强；现有实现也为达到高压力阈值的分值着色。
- **缓解绿（green）**：方向缓解。
- **提醒琥珀（amber）**：演示和历史阅读提示。

### Neutral
- **夜蓝底（bg）**、**容器蓝（surface）**、**浮层蓝（raised）**：页面、面板与悬停。
- **选择蓝（selected）**：选中对象、来源筛选与报告期次。
- **边界蓝（line）**：面板、对象行与演化记录分隔。
- **主文字（ink）**、**辅助文字（muted）**：正文与日期、范围、原因等补充信息。

**The Semantic Direction Rule.** 方向必须由文字说明；绿色不等于安全，缺失和首次不伪装成持平。

## Typography

沿用系统中文无衬线功能字体，无独立 display 字体。数字继承字体并使用 tabular-nums。frontmatter 保留 V2 已使用字号角色，并增加对象摘要分值和对象标题。

### Hierarchy
- **Headline / Title**：页面标题与面板标题；手机分别缩为 25px 与 17px（面板头部）。
- **Body / Label**：正文 15px，说明常用 13px，日期与辅助字段 12px；历史刻度标签 10px。
- **Score**：报告数值；对象列表分值另用 25px，手机 24px。
- **Object-score**：对象与来源解读的主要分值，36px；单位 13px。
- **Object-title**：列表名称；时间轴标题同为 17px，但行高沿用标题的 1.35，手机 16px。

**The Comparable Numbers Rule.** 数字使用 tabular-nums，并保留单位、截止时间与比较基准。

## Layout

页面最大宽度 1480px，桌面侧边距 36px，顶部 32px；1550px 以上顶部 38px。首页主区 1.65fr / 1fr，右栏最小 340px，栏距 22px。详情 1.5fr / 1fr，栏距 24px；报告居中最大 1040px，不再展示 V2 的左侧版本栏。

1100px 以下侧边距 24px，首页主区改为 1.3fr / 1fr、栏距 16px；对象行变为纵向，状态改为横向。详情改单栏。760px 以下页面侧边距 18px，首页使用纵向堆叠，解读距列表 22px；对象行内边距 20px，演化记录由日期/正文两列改成单列，元信息横向排列。报告内边距最终为 22px。

常用 4/8/12/16/20/24/32px 节奏，继承 18/22/26/28/36px 的局部布局。来源筛选支持换行；对象名称、范围和说明允许自然折行，不以固定高度截断内容。

## Elevation & Depth

没有 box-shadow。面板、悬停与选中依靠深蓝色阶和 1px 细边框建立层次。焦点使用蓝色 3px 外轮廓、偏移 4px。滚动采用 smooth，系统减少动态偏好下切换 auto；没有新入场动画。

**The Tonal Depth Rule.** 使用底色层级和细边框建立层次，不增加投影装饰。

## Shapes

面板圆角 10px；操作与来源链接圆角 6px，徽标 4px，报告期次 5px。对象整行继承按钮 6px 圆角。来源成对按钮保留左侧圆角，解读链接保留右侧圆角，中间边缘接合。图表观测点为圆点，演化脉络以细分隔线组织，没有装饰节点轴。

## Components

### Buttons
次级描边按钮为主要操作形态，最小高度 44px，内边距 8px 13px；悬停使用 raised。排序按钮 12px，选中使用 raised 与蓝字。沿用统一焦点，不新增实心主按钮。

### Chips
非交互状态徽标以 muted 文字、细边框与 4px 圆角呈现；评估更新文字与边框为 blue，事件更新和纳入观察保留中性徽标。纳管状态放在解读头部，避免与压力程度混写。

### Cards / Containers
主面板使用 surface、细边框及 10px 圆角。面板头部 18px 20px，解读主体 20px，详情 26px；窄屏详情 20px。重要变化保持开放式三列，手机改为横向内容行；不为每项再套面板。

### Navigation
风险速览、观察报告两个顶层入口，活动项为 ink 文字与 3px 蓝色底线。来源和对象详情沿用进入时所属入口。报告期次用 selected 底色；没有输入框或配置表单。

### Stable Object List
整行是按钮，以 aria-pressed 表示选择，并关联预览区。桌面列为弹性文本 / 150px 状态、栏距 24px、内边距 24px；依次展示稳定名称、目标范围、评估原因与分值状态。悬停 raised，选中 selected；点击更新解读，手机滚到解读并提供返回列表。风险优先按分值，新纳入优先按纳入日期；未评分不补零。

### Evolution Records
日期栏 110px，正文弹性，栏距 24px，每条上下内边距 24px。日期与记录类型并列于正文之外；事件依据和记录说明用原生 details 展开，最小交互高度 44px。倒序展示日期与同日记录顺序；历史快照只显示截止日内记录。

### Source Links and Related Objects
首页来源按钮和独立箭头链接成对：前者筛选对象，后者打开来源解读。筛选选中为 selected 底色与蓝色边框，支持空结果。对象内的来源链接以蓝字、描边、6px 圆角呈现，10px 12px 内边距、44px 最小高度；SVG 箭头 18px。来源详情的关联对象为 22px 0 内边距的开放行，名称、范围与状态在左，箭头在右。对象—来源—关联对象返回链保留当前/历史快照语境。

### Historical Position and Trend
沿用 V2：5px 历史范围刻度、3px × 15px 当前蓝色标记，窗口日期与样本数紧邻结论；缺失、过期或样本不足用原因替代。趋势线 2.5px，点半径 3.5px；阈值虚线仅作演示。历史阅读用琥珀提示条标明截止时间，不使用当前证据补齐历史缺口。

### Recorded Drift — Not Canonized
V2 文档称红绿“只”表达方向，但 V2 源码已给高压力分值使用红色；这里记录实际双重用法而不把排他表述继续传播。V2 文档笼统宣称所有交互最小 44px，但继承的历史位置 summary 是 38px、重要变化规则 summary 是 40px（后者在 V3 首页不渲染）；将它们记录为既存可访问性漂移，不作为新组件规则。前置系统字体是既存功能字体选择，不上升为 display 字体规范。原 CSS 中低频硬编码通知底色、图表阈值色及文字选择底色保留为局部值，不新增全局调色板。此次只写文档，不修复继承代码。

## Do's and Don'ts

### Do:
- Do 使用继承的深蓝色阶，以浅蓝区分链接、焦点与评估记录。
- Do 同时呈现方向文字、数值和颜色，保留单位、缺口与截止时间。
- Do 保留清晰的键盘焦点，为新增操作沿用 44px 最小交互高度。
- Do 将来源筛选与打开来源解读分成可辨认的相邻操作。

### Don't:
- Don't 将父阅读版的浅色系统和圆角作为本产品校验标准。
- Don't 把缓解显示成安全、把未评分补零或把纳管状态当成压力程度。
- Don't 为已确认的两入口产品加入配置、订阅或资产录入入口。
- Don't 将当前快照与历史快照的内容混合在同一阅读上下文。
