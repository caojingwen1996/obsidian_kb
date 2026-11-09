---
name: RiskHot M4 局部视觉记录
description: 继承既有绿色治理工作台的金融对象配置与共享观察原型
colors:
  primary: '#295c47'
  primary-hover: '#204b39'
  navigation: '#193d33'
  navigation-text: '#d2ded7'
  navigation-hover: '#284e41'
  brand-border: '#87a394'
  canvas: '#f5f5ef'
  surface: '#fff'
  directory-surface: '#fafbf8'
  ink: '#22352e'
  muted: '#58675e'
  line: '#dfe5df'
  control-border: '#bdc9bf'
  soft: '#edf3ee'
  selected: '#e8f0e9'
  danger: '#a1392c'
  danger-surface: '#fff2ec'
  danger-border: '#e5bcb4'
  warning: '#78591a'
  warning-surface: '#faf4e5'
  backdrop: '#18372b66'
typography:
  module: {fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif', fontSize: '14px', fontWeight: 600, lineHeight: 1.65}
  title: {fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif', fontSize: '20px', fontWeight: 600, lineHeight: 1.5}
  section: {fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: 1.65}
  body: {fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif', fontSize: '14px', fontWeight: 400, lineHeight: 1.65}
  control: {fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif', fontSize: '14px', fontWeight: 500, lineHeight: 1.65}
  label: {fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif', fontSize: '12px', lineHeight: 1.65}
rounded: {tag: '4px', tree: '6px', control: '8px', surface: '12px', dialog: '16px'}
spacing: {xs: '4px', sm: '8px', compact: '12px', md: '16px', section: '20px', lg: '24px', workspace: '28px'}
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    typography: '{typography.control}'
    rounded: '{rounded.control}'
    padding: '8px 14px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    rounded: '{rounded.control}'
    padding: '8px 14px'
  text-field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '9px 12px'
---

# M4 金融对象配置中心局部视觉记录

## Overview

**沿用方向：清晰分层的治理工作台。** 本文件从已完成的 M4 原型提取实际样式，记录局部实现，不建立新的视觉世界，也不覆盖 [[tools/RiskHot/docs/system-design/06产品UI原型设计/DESIGN|现有三中心视觉规范]]。产品边界见 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-6-M4金融对象配置中心UI设计/PRODUCT|M4 产品上下文]]。

目录、对象列表和范围详情构成主要工作面；观察页面使用事件阅读式列表。大面积留给范围与来源信息，主次通过文字、间距和细分隔表达，无照片或插画。图标为同组内联线条 SVG。

**关键特征：** 深绿导航、浅画布与白工作面；中文紧凑操作；范围文本优先；模态层只在明确选择或确认时出现。

## Colors

前置 token 记录 `原型资源/styles.css` 的实际值。主色与中性色继承既有系统；辅助色只登记为 M4 局部交互细节。

### Primary

绿色用于主操作、文字操作、可见焦点及正常/已核定状态；深绿承担导航底色。导航选中项以浅选中面配深字，悬停使用局部导航悬停色。文字选择使用局部浅绿（`#cee3d5`），不扩展成业务状态。

### Secondary

危险操作及错误使用危险文字、浅底和边框；草稿、暂停、待核定与警告使用局部琥珀色和浅底。每种业务状态同时有完整文字，不用颜色独自传意。本模块未实现 AI 内容区，不创建紫色 AI 组件。

### Neutral

画布、白面、目录微浅底依次区分工作区。工作面分隔线弱于控件边框；正文与次级文字分工明确。控件边框、导航悬停、标志边框、危险边框和遮罩是本轮实际辅助色，不宣称它们已由全局规范定义。

## Typography

全部使用前置 token 中的本地中文字体。模块名、任务标题、分区标题与正文按角色分级；列表对象名（15px/600）、范围说明（13px）、元信息（12px）组成主要扫描节奏。观察列表标题桌面（17px）、手机（16px）；观察详情标题桌面（24px）、手机（22px）；弹窗标题手机（18px）。范围段落保留换行并允许长内容断行，部分阅读段落限宽（75ch）。

编辑表单手机输入使用（16px）。数字采用等宽数字特性，未引入独立等宽字体。目录非正常状态提示（10px）、小屏导航组标签与原型提示（11px）是当前实物中的局部小字，不作为未来正文或关键状态的字号下限推广。

## Layout

桌面外壳侧栏宽（216px），位置栏最小高（57px）；正文最大宽（1800px）、左右内边距（28px）、顶部（20px）。主工作板目录宽（228px），对象区为弹性列表与（340px）详情；目录板最小高（650px）。表单最大宽（980px），阅读页最大宽（1120px）。选择器宽（1040px），普通弹窗宽（620px），受视口最大宽高限制。

| 实际断点 | 局部变化 |
| --- | --- |
| ≥1600px | 目录（248px），列表最小（360px），详情（390px）。 |
| ≤1250px | 侧栏（192px）、目录（218px），详情移到列表下；列表区最大高（360px）并内部滚动。 |
| ≤900px | 深绿导航移至顶部，两组并排；正文左右（20px），目录（205px），选择器预览（280px）。 |
| ≤720px | 正文左右（16px），目录可折叠，列表和详情纵向排列；表单与映射比较单列；选择器预览置于选择列表后。 |
| ≤360px | 导航间距进一步收紧；属性名称列（64px），操作自然换行。 |

手机金融分类明确采用网格：一级分类独占整行，二级分类与移除操作在下一行，避免名称挤压截断。手机普通操作目标增至（44px）；复选框保持原生小控件，并由关联标签扩大可点区域。选择器结果和操作区可换行。

## Elevation & Depth

静态工作面依靠白底、细边界和间距分层。场景菜单软阴影为 `0 10px 32px #193d3320`，弹窗为 `0 18px 60px #193d3333`，遮罩使用前置 backdrop token。弹窗标题和操作区在自身滚动容器中吸顶/吸底，正文滚动，不将普通列表变成浮起卡片。

## Shapes

控件、工作面、弹窗和标签按前置圆角 token 使用；手机弹窗改为（12px）。目录层级保留真实细关系线，列表以细分隔而非重复卡片组织。选中对象同时使用浅底与（1px）左边界，这是当前选择状态，不扩展为装饰色条。

## Components

| 组件 | 实际形态与状态 | 交互及可访问性 |
| --- | --- | --- |
| 主/次/文字/危险按钮 | 主绿白字，次按钮白底细边，文字操作绿色，危险浅底红字；禁用透明度（.55） | 普通最小高（40px）、手机（44px）；背景过渡（150ms ease-out）；焦点轮廓（2px）外偏移（3px）。 |
| 输入与表单 | 显式标签，细边框，范围多行输入；错误摘要使用危险浅底 | 必填与保存说明可见；错误保留填写；金融分类一级变化更新二级选项。 |
| 目录与对象列表 | 树按钮含展开标记，选中浅绿；对象名、范围、状态和版本分层 | 目录用 aria-expanded；对象选择用 aria-pressed；手机选择后转到详情。 |
| 详情页签 | 下边线选中，定义/核定与动态/历史三个入口 | tablist、tab、tabpanel 关系及左右方向键、Home、End；业务状态仍用文字。 |
| 观察列表 | 状态页签、检索、范围、关联动态状态、就地动作 | 共享标识始终可见；暂停/结束/恢复进入明确确认，不以颜色暗示成功。 |
| 添加观察选择器 | 原生 dialog；桌面对象与范围预览并排，手机堆叠 | 具体对象可选、目录不可选；显示禁选理由、计数与逐项结果；关闭及 Esc 返回上下文。 |
| 提示与空态 | 正常浅绿提示，危险错误，琥珀警告；空态带下一步 | 页面反馈 role=status，表单错误 role=alert；失败与空库分开。 |

全局有跳到主要内容的入口；装饰 SVG 隐藏于辅助技术；原生模态层、关闭按钮、关闭后焦点恢复及未保存保护已在脚本中实现。减少动态效果偏好关闭按钮和树箭头的过渡。这些是已实现机制的记录，不等于完整辅助技术或 WCAG 合规验收。

## Do's and Don'ts

- Do：继承主色与中文层级，保留范围、身份、来源和状态的文字可读性。
- Do：按当前视口改变布局，避免将复杂目录和表单压缩成横向大表格。
- Don't：把局部演示角色、版本或回执描述为真实服务能力。
- Don't：把机械检测提示消除作为重新定义全局色彩的理由。

**比较证据与未规范化差异：** 已对照上级 PRODUCT、DESIGN、方向契约与本模块 HTML、CSS、脚本。上级 PRODUCT 仍限于旧三中心；上级 DESIGN 同时保留历史“统一顶栏”与后来“工作区操作栏”条款，且“900px以下隐藏侧栏”与本次确认的顶部导航适配不同。M4 按本次方向保留顶部导航和正文操作，桌面左右留白（28px）也不同于上级早期（32px）描述；警告色与小字、按钮内边距按实际局部值记录。这些不回写成全局调整，也不修复既有文档漂移。

**检查限制：** [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-6-M4金融对象配置中心UI设计/验证/机械检查记录|一次机械检查]]保留既有画布 cream warning 与六项颜色 advisory。[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-6-M4金融对象配置中心UI设计/验证/独立设计审查|独立设计审查]]首次发现手机分类截断，修正后同组七张截图复核 resolved、ship；该结论仅覆盖已评分修正项，不升级为全业务审计。模块记录不生成或改写全局设计 sidecar。
