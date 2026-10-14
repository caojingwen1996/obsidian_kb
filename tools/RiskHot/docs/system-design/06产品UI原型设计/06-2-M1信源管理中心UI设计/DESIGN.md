---
name: RiskHot M1 信源管理中心
description: 继承现有浅色绿色工作台的信源目录、档案、启停与追溯视觉契约。
status: final
updated: 2026-10-13
sources:
  - docs/system-design/03-系统功能架构/M1 信源管理中心功能设计.md
  - docs/system-design/06产品UI原型设计/06-1-配置模块产品UI设计/原型资源/styles.css
  - docs/system-design/06产品UI原型设计/06-1-配置模块产品UI设计/配置模块交互原型.html
colors:
  canvas: '#f5f5ef'
  surface: '#fffef8'
  ink: '#233b34'
  muted: '#647067'
  line: '#dfe4d8'
  primary: '#295c47'
  on-primary: '#ffffff'
  accent: '#d9e89a'
  danger: '#a1392c'
  warning: '#856019'
  focus: '#607c2b'
  sidebar: '#edf0e6'
  selected: '#f0f4e7'
typography:
  title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '-0.02em'
  section:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.5'
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.65'
  label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.5'
  meta:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.6'
  code:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 5px
  md: 9px
  lg: 12px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  sidebar-width: 192px
  desktop-gutter: 34px
  mobile-gutter: 16px
components:
  workspace-nav:
    background: '{colors.sidebar}'
    foreground: '{colors.ink}'
    width: '{spacing.sidebar-width}'
  section-tabs:
    foreground: '{colors.muted}'
    active: '{colors.primary}'
    gap: '{spacing.5}'
  search-filter-bar:
    background: '{colors.surface}'
    radius: '{rounded.sm}'
    gap: '{spacing.2}'
  view-switcher:
    active: '{colors.primary}'
    foreground: '{colors.muted}'
  group-list:
    background: '{colors.surface}'
    border: '{colors.line}'
    radius: '{rounded.md}'
  source-row:
    foreground: '{colors.ink}'
    selected-background: '{colors.selected}'
    gap: '{spacing.2}'
  source-detail:
    background: '{colors.surface}'
    padding: '{spacing.5}'
    radius: '{rounded.md}'
  classification-tags:
    foreground: '{colors.muted}'
    background: '{colors.surface}'
    gap: '{spacing.1}'
  status-pair:
    active: '{colors.primary}'
    disabled: '{colors.muted}'
  source-form:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    gap: '{spacing.4}'
  duplicate-comparison:
    background: '{colors.surface}'
    warning: '{colors.warning}'
    gap: '{spacing.4}'
  action-button:
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.sm}'
  operation-dialog:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    warning: '{colors.warning}'
  feedback-panel:
    foreground: '{colors.ink}'
    error: '{colors.danger}'
    warning: '{colors.warning}'
    border: '{colors.line}'
  relation-list:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.line}'
  version-timeline:
    foreground: '{colors.ink}'
    secondary: '{colors.muted}'
    gap: '{spacing.4}'
---

# M1 信源管理中心 · 视觉设计

## Brand & Style

采用现有 RiskHot 浅色／绿色研究工作台：暖白底、深绿色操作、清晰的主从列表和轻量分组。用户已确认沿用现有风格与交互。本设计面向快速找到来源、确认资料身份、明确操作后果，不增加欢迎页、装饰性图表或评分卡。

业务唯一输入为 [[tools/RiskHot/docs/system-design/03-系统功能架构/M1 信源管理中心功能设计|M1 信源管理中心功能设计]]。布局和交互参照 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-配置模块产品UI设计/配置模块交互原型.html|既有配置模块原型]]；颜色、侧栏、控件及圆角参照 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-1-配置模块产品UI设计/原型资源/styles.css|既有原型样式]]。旧原型里的信用分、其他对象审批交互不继承至 M1。行为详见 [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/EXPERIENCE|M1 页面与交互契约]]。

2026-10-13 用户确认所有在册均已登记，单一目录，仅启用／停用。本文与行为契约优先于所引用的视觉参考；业务冲突回到 M1 功能设计确认。本次交付以双契约为主，并追加关键页面示意图；示意图用于阅读布局，不等同已实现的可运行原型或正式组件库。frontmatter 文件路径相对于 RiskHot 项目根。`[ASSUMPTION]` 标出为可实施性补齐的设计默认值，不能当作已经确认的业务规则。

## Colors

| Token | 用途与限制 |
|---|---|
| `{colors.canvas}` / `{colors.surface}` | 页面背景与内容面板；保留现有暖色，不以大色块划分业务等级。 |
| `{colors.ink}` / `{colors.muted}` | 主文字／辅助说明；必填、错误与关键后果不能仅用淡色呈现。 |
| `{colors.primary}` / `{colors.on-primary}` | 主要动作、选中导航、链接；每个操作区只有一个视觉主动作。 |
| `{colors.line}` | 面板与行分隔；不可单独作为输入框、聚焦或选中的唯一边界。 |
| `{colors.accent}` | 继承的少量柔和强调，搭配深色正文；不得承担启用成功或高价值含义。 |
| `{colors.warning}` | 待确认、未知结果；必须带说明文字。 |
| `{colors.danger}` | 保存失败、冲突、拒绝等异常；“停用”平时用中性状态，操作后果可用警示。 |
| `{colors.focus}` | 键盘焦点；继承 3px 外描边与 3px 间隔。 |
| `{colors.sidebar}` / `{colors.selected}` | 导航背景／当前选中行；同时用文字或边线标识选择状态。 |

承重组合的交付目标：正文、辅助字、链接、状态文字与底色对比至少 4.5:1；焦点、必要控件轮廓至少 3:1。本地按不透明色值计算：`ink/surface` 11.90:1、`muted/surface` 5.13:1、`on-primary/primary` 7.73:1、`warning/surface` 5.64:1、`danger/surface` 6.63:1、`focus/surface` 4.71:1；基础承重组合达到上述目标。实际渲染后的透明度、悬浮、禁用样式仍须验证。浅分隔线仅为装饰分组，不宣称满足交互轮廓要求。输入框采用 `{colors.muted}` 实线边界 [ASSUMPTION]，标签与焦点配合识别；不以降低整组件透明度作为唯一禁用表达。

## Typography

保持系统中文字体，不引入网络字体。名称使用 `{typography.body.fontSize}`，稳定编码使用 `{typography.code.fontSize}`；编码允许断行复制，不让长 URL 撑开页面。标题使用 `{typography.title.fontSize}`，分区使用 `{typography.section.fontSize}`。

[ASSUMPTION] 在既有原型 10～13px 小字较多的基础上，将业务正文统一到 14px、辅助信息至少 12px，维持原有字体与层级，提高长字段及移动阅读的可辨识性。上述行高和字重为本版排版默认，不是新增品牌字体规范。重要状态、缺项和操作理由不得降到小字脚注。文本放大 200% 后完整保留信息与操作；不强行固定行高或单行截断必读后果。

## Layout & Spacing

继承 192px 左侧导航、桌面外边距 34px 和现有主从结构；间距统一使用 `{spacing.1}`～`{spacing.6}`。不新增仪表盘，进入 M1 直接显示统一信源目录，默认专题研究，按金融属性分组，无须先手动选择。

| 区域 | 排列与尺寸 |
|---|---|
| 工作台外壳 | 左侧工作台导航，上方位置导航，标题下为统一目录。M1 标为当前一级模块，其他模块导航只保留项目已有入口。 |
| 信源目录 | 直接进入检索工具区：搜索、清空条件与新增同排，之后为分类／启停筛选、四视图和分组列表；不重复显示页面大标题及说明。详情随权限提供启用／停用。 |
| 主从区域 | 继承列表 `minmax(350px,1fr)`、详情 `minmax(320px,400px)` 的伸缩思路；空间不足切换详情抽屉，不压缩成两列窄文本。 |
| 新增／编辑 | [ASSUMPTION] 桌面最大宽 880px，双列字段；长文本与比较信息占整行，底部固定操作区；字段体滚动，页头／操作区始终可见。 |
| 查重对照 | [ASSUMPTION] 两列为“本次登记／已有信源”，字段逐项对齐；窄屏按字段纵向对照。 |
| 启停确认 | [ASSUMPTION] 最大宽 640px；名称与目标状态 → 核验／影响 → 选填理由 → 确认。禁止在未读影响前默认聚焦危险提交。 |
| 历史版本 | 时间线在详情页；历史定义打开独立只读详情层，固定显示“历史版本”与版本号。 |

以下静态图稿为历史版本，仅参考视觉布局，当前单一目录／两态规则以可点击原型为准：[目录与六段详情](mockups/key-catalog.html) 展示旧列表／详情布局；[正式档案与手机详情](mockups/key-record.html) 展示双状态与窄屏排布；[登记查重](mockups/key-registration.html) 展示错误前置及字段对照；[暂停与结果未知](mockups/key-status-confirm.html) 展示操作前后两种状态。这些旧图的生命周期和状态表述已失效，当前布局和行为见可点击原型。

正式档案图是放大的阅读示意，省略列表以容纳字段与手机对照，不改变桌面主从及窄屏抽屉的导航契约。[ASSUMPTION] 查重错误可将摘要及对照前置到名称／代码之后，其余表单分段顺序保持；暂停图的左右两幅为前后状态对照，真实界面只显示当前一步。

响应规则继承现有 1180px、960px、640px 断点含义：1180px 以下压缩非关键辅助排布；960px 以下详情切为抽屉；640px 以下隐藏常驻侧栏，改为顶部导航入口。新增 M1 页面落实到这些断点的细节为 [ASSUMPTION]：手机单列、16px 外边距、表单全屏层；四视图通过可滚动按钮保留，不将功能删掉。手机触控目标提升至 44px [ASSUMPTION]，桌面继承按钮最小高 40px。

交互实现参照[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/M1信源管理中心交互原型.html|M1 原型]]。[ASSUMPTION] 桌面主从面板采用最大 740px、约 80dvh 高度并分别滚动，详情操作区常驻；这一布局用于长档案和清单操作可达，手机仍为全屏详情。

## Elevation & Depth

普通内容面板通过 `{colors.line}` 与底色区分。继承极轻的面板投影，不使用浮起卡片表现信源价值。遮罩仅用于新增／编辑、启停确认和窄屏详情；页面内的查重结果嵌在表单内容中，避免在表单上再叠确认弹窗。[ASSUMPTION] 对话层保留单层可交互表面，历史版本可替换当前详情并支持返回。

## Shapes

输入与按钮 `{rounded.sm}`，分组面板 `{rounded.md}`，对话框 `{rounded.lg}`。分类标签采用小圆角方形，禁止把每个标签做成醒目彩色胶囊。启用／停用均采用文字和小标识组合；T1、T1.5、T2 外观同级，不用红黄绿暗示信用好坏。

## Components

组件名同时在行为契约中定义；以下为唯一视觉命名表。辅助的字段、链接、提示、骨架属于相应组件内部，不另建未定义组件。

| 组件名 | 视觉结构与状态 |
|---|---|
| `workspace-nav` | 继承左侧导航和顶部位置导航；当前 M1 深绿文字＋选中底色。手机入口显示当前模块名称与菜单，不用只有图标的无名入口。 |
| `section-tabs` | 仅详情四页签使用文字与底线，不再设置参考／正式分区。选中态有文字加粗和底线，焦点独立可见。 |
| `search-filter-bar` | 搜索框左、筛选右；已选条件呈可移除文字标签并提供“清空条件”。折叠不隐藏已选条件数。读取失败保留输入。 |
| `view-switcher` | 全部／事实核验／日常监测／专题研究同权重按钮；选中深绿，默认专题研究。按钮与组织规则说明并入搜索筛选面板底部，共用底色和外边框；宽屏并排，窄屏换行。“全部”使用平铺列表，不显示树节点、展开／收起操作或分组重叠说明。 |
| `group-list` | 树节点逐层缩进并有父子连接线；金融属性根节点深绿强调，观察层级浅底，关注优先级暖白；每层标明维度名称、展开标识和数量；总数与“分组计数可重叠”在面板上方。辅助入口单列，不伪造 T1 等级。 |
| `source-row` | 主行名称、次行发布主体／编码；正式行附等级、接入方式、业务状态、技术信息。选中行用浅底＋左线，技术错误不整行涂红。 |
| `source-detail` | 标题、身份、分段内容、入口、操作；正式详情固定版本和状态区，再进入档案／技术／关系／历史页签。长文本换行，分类演示值带文字标签。 |
| `classification-tags` | 同色系、具维度标签；T1_5 显示 T1.5，内部值不暴露给一般用户。空值写“待补充”，不渲染成空白标签。 |
| `status-pair` | 分别标“业务状态”“技术接入”；启用深绿、停用中性；未就绪／未知独立说明，不画合成通过率。 |
| `source-form` | 段标题、字段标签、必填时机、控件、帮助／错误顺序固定；建议预填有“待确认”标识。错误边框配说明；保存区持续显示“保存不自动启用”。 |
| `duplicate-comparison` | 名称／发布主体／渠道／定位／代码逐行比较；差异加粗和文字标记，不只染色。同代码冲突置顶，并突出“打开已有信源”。 |
| `action-button` | 主动作深绿实底；次动作暖白边框；停用在普通详情为次动作，确认层显示明确动词。加载态保留宽度、动词改为进行中，禁止重复按。 |
| `operation-dialog` | 顶部显示来源、当前→目标状态与版本；主体为核验或影响、选填理由输入；底部为取消与明确动作。操作结果未知时反馈取代提交，不能显示成功图标。 |
| `feedback-panel` | 就地显示加载、空、失败、无权限、离线或提交未知；图标可作为辅助手段，必须有文字和可执行恢复入口。表单错误摘要可定位具体字段。 |
| `relation-list` | “允许来源的指标／实际引用资料”分区，显示名称、关系性质、来源版本与可用定位信息。跨模块入口带目的地说明；引用数量未知不用 0。 |
| `version-timeline` | 最新在前的时间记录 [ASSUMPTION]；操作、前后版本与状态为主，操作者／时间为辅，理由完整展示。选中历史版本加只读标识，不提供回滚按钮。 |

## Do's and Don'ts

| 应做 | 不应做 |
|---|---|
| 同时展示业务状态、技术就绪及自动接入条件 | 用一个“正常／异常”灯吞掉两个独立状态 |
| 单一在册目录、名称清楚、启停反馈明确 | 用“登记成功”暗示“已启用”或“已连接” |
| 所有六维独立展示与维护，排序规则可读 | 信源优先级转成信用分、信息价值分或星级 |
| FRED 等聚合入口显示逐序列回源提醒 | 对整个平台套 T1，或为过校验伪造等级 |
| 缺项、无权限、未知结果均写具体原因 | 只弹“操作失败”，或把查询失败显示为“暂无” |
| 沿用已有视觉并提高关键小字可读性 | 引入新字体库、新网络素材或与来源身份无关的装饰 |
