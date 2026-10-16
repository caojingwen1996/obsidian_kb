---
name: RiskHot 量化信号决策辅助产品
description: 深蓝监测界面中的风险排序、趋势与判断证据
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
  signal-row-selected:
    backgroundColor: "{colors.selected}"
---
# Design System: RiskHot 量化信号决策辅助产品

## Overview

**Creative North Star: "深蓝信号观察台"**

以深蓝底色、克制边框与横向对齐的数字形成专业监测界面。排序先交付优先级，趋势和证据紧接判断；色彩服务选择、变化方向与数据状态。

这是量化信号产品的独立视觉系统。父目录一般阅读者版的浅色纸张、配色与圆角不构成本产品的约束。保留中文系统字体的清晰阅读性，密度来自实际字段，不以装饰扩大界面。

**Key Characteristics:**
- 深蓝色阶区分背景、容器和选中状态。
- 等宽数字与邻近单位支持横向比较。
- 红色表示压力增强，绿色表示缓解，琥珀色提示需注意的状态。
- 宽屏双栏联动，窄屏改为纵向行与解读。

## Colors

深蓝中性色承载密集信息；柔亮蓝色用于选择和连续趋势，红绿承担方向语义。

### Primary
- **信号蓝（blue）**：链接、活动导航下划线、焦点和趋势线。

### Secondary
- **压力红（red）**：增强方向。
- **缓解绿（green）**：缓解方向。
- **提醒琥珀（amber）**：演示标识与提醒文字。

### Neutral
- **夜蓝底（bg）**：页面背景。
- **容器蓝（surface）**：顶部栏与主面板。
- **浮层蓝（raised）**：悬停、排序选项和流程节点。
- **选择蓝（selected）**：当前排行行、报告周期与版本。
- **边界蓝（line）**：细边框、表格分隔线与图表网格。
- **主文字（ink）** 与 **辅助文字（muted）**：正文和补充信息。

**The Semantic Direction Rule.** 红绿只表达压力变化方向；绿色不等于安全，缺失和首次不伪装成持平。

## Typography

正文、功能标题与标签使用前置系统中文无衬线字体；没有独立 display 字体。数值继承同一字体并启用 tabular-nums。页面标题、面板标题、正文、标签与排行分值使用 frontmatter 中对应角色。

### Hierarchy
- **Headline**：页面标题；窄屏缩至 25px。
- **Title**：面板标题；窄屏缩至 17px。
- **Body**：主阅读文本；表格、解释和方法常用 13px。
- **Label**：时点、单位与辅助字段。
- **Score**：排行数值；当前选择摘要放大至 32px，窄屏排行用 22px。

**The Comparable Numbers Rule.** 数字使用 tabular-nums，并保留单位、截止时间与比较基准。

## Layout

页面最大宽度 1480px，宽屏左右留白 36px。主工作区以 1.65fr / 1fr 分栏，右栏最小 340px，间距 22px。详情采用 1.5fr / 1fr；报告采用 230px 版本栏与弹性正文，正文限制约 70ch。间距以 4/8px 为基础，并保留实际使用的 18、22、26、28、30、36px 以匹配密度。

1100px 以下主区右栏为 330px，隐藏驱动列，详情合并单栏。760px 以下主区改为纵向，左右留白 18px；排行行使用弹性名称、62px 分值、65px 变化的网格，并提供移动字段标题；解读置于排行下方，报告版本横向排列。1550px 以上增加表格纵向留白。

## Elevation & Depth

没有 box-shadow。容器、悬停和选择通过深蓝色阶与 1px 边框建立层次。焦点采用蓝色 3px 外轮廓，偏移 4px。不存在模糊玻璃或悬浮投影体系。

**The Tonal Depth Rule.** 使用底色层级和细边框建立层次，不增加投影装饰。

## Shapes

面板采用 10px 圆角，按钮和链接按钮采用 6px，徽标与传导节点采用 4px。选择行按钮为 2px，报告周期为 5px；这些是已有局部形态，不统一替换为父页面圆角。圆形只用于图例和趋势观测点。

## Components

### Buttons
次级描边按钮为默认操作形态，最小高度 44px。悬停使用 raised，排序选中同时改变底色、文字与边框；没有独立实心主按钮。焦点沿用统一外轮廓。

### Chips
状态徽标使用 muted 文字、细边框和小圆角。它是说明而非操作按钮；演示标识另用琥珀色文字。

### Cards / Containers
主面板使用 surface、细边框、10px 圆角及裁切溢出。头部通常 18px 20px，主体 20px；详细阅读容器 26px，报告 32px，窄屏压缩至 20px。

### Navigation
品牌旁仅风险速览、观察报告两入口。活动入口以 ink 文字与 3px 蓝色底线标记；默认入口为 muted。报告周期与版本以 selected 底色表示当前状态。

### Signal Ranking and Trend
排行行同时承载名称、分值、带符号变化和方向文字；选中行保留独立底色，悬停不覆盖选中。选择更新同一信号的趋势与判断摘要。趋势线宽 2.5px，观测点半径 3.5px，演示阈值用虚线。缺失不绘零值，首次只画一个点，过期曲线停止在实际观测日。

### Evidence Disclosure
方法和证据采用原生 details / summary，最小交互高度 44px。证据表在指标名称旁标注单位，并保留当前值与比较值；历史快照没有指标时说明缺口。无输入字段或配置表单。

## Do's and Don'ts

### Do:
- Do 使用本文件的深蓝色阶，并让蓝色承担选中和趋势线角色。
- Do 同时提供文字、方向箭头和颜色，避免单靠色彩传意。
- Do 保留缺失、首次、过期状态及数值单位；证据指标在名称旁标注单位。
- Do 保留键盘焦点、44px 最小交互高度与窄屏字段标签。

### Don't:
- Don't 将父阅读版浅色系统的调色板和圆角作为本产品校验标准。
- Don't 把缓解显示成安全，也不要把未知补为零分。
- Don't 为这个已确认的两入口产品加入配置、订阅或资产录入入口。
