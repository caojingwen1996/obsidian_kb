---
name: RiskHot 量化信号决策辅助产品 V4
description: 继承深蓝观察台的变量、判断依据与后续验证阅读路径
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
  variable-value:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.6
  reason-lead:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "18px"
    fontWeight: 650
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
  reading-control:
    textColor: "{colors.blue}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  compact-variable:
    textColor: "{colors.ink}"
    padding: "14px 0"
  variable-row:
    textColor: "{colors.ink}"
    padding: "24px 0"
  variable-evidence:
    textColor: "{colors.blue}"
    padding: "12px 0"
  watch-item:
    textColor: "{colors.ink}"
    padding: "24px 0"
  evolution-disclosure:
    textColor: "{colors.ink}"
    padding: "14px 0"
---
# Design System: RiskHot 量化信号决策辅助产品 V4

## Overview

**Creative North Star: "深蓝信号观察台"**

以深蓝底色、克制边框与横向对齐的数字形成专业监测界面。对象列表交付可比较的压力与判断理由，变量的观测、作用和依据连续呈现，来源关联支持进一步追溯。

V4 是 V3 视觉体系的局部扩展，保留色彩、系统中文无衬线字体、密度与无投影层级。新增内容以宽行、留白和细线接入既有阅读环境；没有另建调色板、字体组合或装饰主题。这里的文字、事件、评估与数值均为离线合成演示。

**Key Characteristics:**

- 深蓝色阶区分背景、容器和选中状态。
- 等宽数字、邻近单位与比较基准支持核对。
- 变量角色、当期作用与数值变化分别表达，颜色辅助文字。
- 宽屏分栏、窄屏堆叠；证据与演化记录按需展开。

依据：本目录 signal.css、signal.js、card-data.js 与 ../量化信号决策辅助产品设计V4.html；边界见 PRODUCT.md 和 .impeccable/signal-surface.md。对照 V3 DESIGN.md 和 .impeccable/design.json，未修改 V3。已检查 .impeccable/review 的桌面首页、手机对象详情、历史详情和变量证据截图及 provenance.json；验证结果.json 记录 47 项通过、0 项失败，包含跳转聚焦、证据展开、历史独立与窄屏溢出检查。

## Colors

沿用深蓝中性色、柔亮信号蓝、压力粉红、缓解薄荷绿与提醒琥珀。具体值以前置 token 为准。

### Primary

- **信号蓝（blue）**：链接、导航底线、焦点、趋势线、评估更新描边，以及卡内定位和证据展开入口。

### Secondary

- **压力粉红（red）**：压力增强、变量压力作用与强化条件；继承实现也为达到高压力阈值的分值着色。
- **缓解薄荷绿（green）**：缓解方向、变量缓解作用与缓解条件。
- **提醒琥珀（amber）**：演示、历史阅读、过期观测和作用待判断。

### Neutral

- **夜蓝底（bg）**、**容器蓝（surface）**、**浮层蓝（raised）**：页面、面板和悬停层。
- **选择蓝（selected）**：选中对象、来源筛选与报告期次。
- **边界蓝（line）**：容器边缘、变量行、观察条件与记录分隔。
- **主文字（ink）**、**辅助文字（muted）**：正文与角色、日期、范围和限制。

**The Semantic Direction Rule.** 方向必须由文字说明；绿色不等于安全，缺失和首次不伪装成持平。

**The Contextual Effect Rule.** 来源因素与应对因素是角色；压力、缓解、待判断是本对象当期作用，不能只凭数值增减或角色着色。

## Typography

沿用系统中文无衬线功能字体，无独立 display 字体。数字继承字体并使用 tabular-nums；保留 V3 字号角色，新增变量值与原因主句角色。

### Hierarchy

- **Headline / Title**：页面标题与面板标题。手机页面标题为 25px，面板头部标题为 17px。
- **Body / Label**：正文 15px，说明常用 13px，辅助字段 12px；历史刻度标签 10px。
- **Score / Object-score**：报告分值 24px，对象列表分值 25px、手机 24px；对象与来源解读的主要分值 36px，单位 13px。
- **Object-title**：宽行对象与变量名称 17px；变量名称行高为标题的 1.35，手机 16px。
- **Variable-value**：观测值 23px，单位 12px、常规字重；手机观测值为 22px。前值另用 12px 辅助文字。
- **Reason-lead**：综合原因主句 18px、650 字重，保留正文行高；观察标题为 17px。

**The Comparable Numbers Rule.** 数字使用 tabular-nums，并保留单位、截止时间与比较基准。

## Layout

继承最大宽度 1480px、桌面侧边距 36px、顶部 32px；1550px 以上顶部为 38px。首页对象列表与解读为 1.65fr / 1fr，右栏最小 340px，栏距 22px；详情主栏与历史/来源侧栏为 1.5fr / 1fr，栏距 24px。报告最大宽度 1040px，居中显示。

1100px 以下侧边距 24px，首页为 1.3fr / 1fr、栏距 16px；对象行纵向排布，详情改单栏。760px 以下侧边距 18px，首页与详情连续堆叠，对象行内边距 20px，报告内边距最终为 22px。来源筛选和卡内定位按钮可以换行；不截断对象名称与说明。

V4 详情段落最大 72ch。核心驱动变量、变化原因、下一步观察由开放区块顺序排列；区块顶部留白 36px、内边距 28px、细分隔线，手机分别为 28px 和 22px。变量与观察条目上下内边距 24px。当前事实和观察条件为 76px 标签列 / 弹性内容列、间距 16px，手机为 68px / 弹性列、间距 12px。变量依据为 125px 标签列，手机改成单列。沿用 4/8/12/16/20/24/32px 节奏及既有局部间距。

## Elevation & Depth

没有 box-shadow。背景、面板、悬停与选中依靠深蓝色阶和 1px 细边框建立层次。按钮、链接与 summary 的键盘焦点为蓝色 3px 外轮廓、偏移 4px；卡内跳转后的区块与变量聚焦为蓝色 2px 外轮廓、偏移 6px。滚动采用 smooth，减少动态偏好下改为 auto；没有入场动画。

**The Tonal Depth Rule.** 使用底色层级和细边框建立层次，不增加投影装饰。

## Shapes

面板圆角 10px；按钮、链接与对象整行圆角 6px，徽标 4px，报告期次 5px。来源成对控件左右边缘接合。变量与观察条目使用开放宽行和分隔线，末行不补底线。图表观测点为圆点；演化记录以日期和细线组织，没有装饰节点轴。

## Components

### Buttons

次级描边按钮是主要操作形态，最小高度 44px，内边距 8px 13px，悬停使用 raised。排序选中态为 raised、蓝字和边框。卡内定位与原因变量按钮为蓝字、6px 圆角、13px 字号、8px 12px 内边距；手机卡内定位左右内边距 10px。统一沿用焦点，不新增实心主按钮。

### Chips

非交互徽标为 muted 文字、细边框与 4px 圆角。评估更新为 blue 文字与边框。变量角色和作用直接排在名称下方，不额外套成多层标签。纳管状态与压力程度分开表达。

### Cards / Containers

主面板使用 surface、细边框及 10px 圆角。面板头部 18px 20px，解读主体 20px，详情 26px、窄屏 20px。重要变化是开放三列，手机转为内容行；变量、原因与观察重点不再各套同尺寸卡片。

### Navigation

风险速览、观察报告两个顶层入口，活动项用 ink 文字与 3px 蓝色底线。详情沿用进入时所属入口，报告期次用 selected 底色。当前判断之后提供三个卡内定位按钮；点击滚动到对应区块并移交焦点。没有输入框或设置表单。

### Stable Objects and Compact Preview

整行对象按钮以 aria-pressed 表示选择并关联预览区。桌面为弹性文本 / 150px 状态，间距与内边距均为 24px；悬停 raised、选中 selected。手机选择后滚到解读，并提供返回列表。预览先给综合原因，再展示前两项变量与首要观察条件；变量说明在左、值与当期作用在右。历史位置与关联来源默认折叠。

### Current Snapshot Facts

主要分值、状态与摘要之后，以发展阶段、持续条件、当前影响三个键值行交代当期事实。标签用 muted，内容保留完整句子；它们与顶部截止时间共同限定阅读语境，不代替核心驱动变量或证据说明。

### Core Variables and Evidence

每个变量是横向宽行：左侧名称、角色和当期作用，右侧当前值、单位与前值，下接作用说明。依据用原生 details 展开，入口最小 44px，展示证据记录与版本、观测/可获得时间、比较观测和适用限制。缺失用破折号，过期保留日期与琥珀说明，作用待判断。变量作用取自独立当期记录，不由前端分差生成。

### Reason-to-Evidence Jump

综合原因之后给出对应变量按钮和保留的限制。点击变量按钮定位到同页对应变量、展开其依据、滚动并移交焦点，同时播报展开结果。原因段落保留比较快照、评估来源和节点的不确定性；数值变化与正式方向分别表达。

### Watch Conditions

每项观察重点包含标题、下一次要看的信号，以及强化条件、缓解条件、证据缺口三行，再列关联变量。条件标签为压力粉红、缓解薄荷绿和 muted；没有设置或订阅操作。未评分对象仍提供可验证条件，不把缺口解释为低风险。

### Evolution, History and Sources

演化脉络在变量、原因和观察重点之后默认折叠；主 summary 最小高度 56px。展开后继承日期 110px / 正文弹性、间距 24px 的记录行，手机改单列；同日按形成顺序由新到旧。事件依据与记录说明继续按需展开。

历史位置保留短样本窗口、5px 刻度和 3px × 15px 当前标记。趋势线为 2.5px，演示阈值为虚线。来源筛选与打开来源解读为相邻独立操作；来源不作为贡献权重。对象—来源—关联对象保留进入时的当前/历史截止。10.09 的变量、原因和 Watch 来自独立快照，不用 10.16 内容补齐；历史顶部用琥珀提示条说明截止。

### Recorded Drift — Not Canonized

继承代码以红色同时表达压力方向与高压力分值；不传播“红绿只表达方向”的旧排他表述。继承的历史位置 summary 最小高度 38px，旧重要变化规则 summary 为 40px（V4 首页不渲染后者）；它们属于既存可访问性漂移，不作为新增控件规范。系统字体是既存功能字体，不确立为 display 字体。局部通知底色、图表阈值色和文字选择色仍是局部值，不扩充全局调色板。此轮只记录现状，不修复无关代码。

## Do's and Don'ts

### Do:

- Do 使用继承的深蓝色阶，以浅蓝区分链接、焦点与评估记录。
- Do 同时呈现数值、单位、比较基准与当期作用文字。
- Do 将变量角色、观测变化和综合判断分开表达。
- Do 为新增交互保留 44px 最小高度和清晰的键盘焦点。
- Do 让原因中的变量入口定位、展开并聚焦对应依据。
- Do 在宽行中保留证据限制、观测日期与明确缺口。

### Don't:

- Don't 为 V4 局部扩展建立新调色板、display 字体或投影装饰。
- Don't 把缓解显示成安全、把未评分或缺失变量补零。
- Don't 根据数值增减自动推导风险方向或变量作用。
- Don't 将当前快照的变量、原因或观察条件混入历史阅读。
- Don't 将来源关联当成贡献权重，或将单项条件当成已确认结论。
