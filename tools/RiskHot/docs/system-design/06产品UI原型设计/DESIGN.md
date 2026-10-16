---
name: RiskHot M1/M2/M3统一UI规范
version: V2.2
updated: 2026-10-16
colors:
  primary: '#295c47'
  navigation: '#193d33'
  navigation-text: '#d2ded7'
  canvas: '#f5f5ef'
  surface: '#ffffff'
  subtle: '#f7f8f5'
  ink: '#22352e'
  muted: '#58675e'
  line: '#dfe5df'
  selected: '#e8f0e9'
  ai-surface: '#eee8ff'
  ai-text: '#624392'
  danger: '#a1392c'
  warning: '#856019'
typography:
  headline: {fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '14px', fontWeight: 600, lineHeight: 1.5}
  title: {fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '20px', fontWeight: 600, lineHeight: 1.5}
  section: {fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: 1.6}
  control: {fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '14px', fontWeight: 500, lineHeight: 1.5}
  body: {fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '14px', fontWeight: 400, lineHeight: 1.65}
  label: {fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '12px', fontWeight: 500, lineHeight: 1.6}
rounded: {control: '8px', surface: '12px', dialog: '16px'}
spacing: {xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px'}
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    typography: '{typography.control}'
    rounded: '{rounded.control}'
    padding: '9px 16px'
  text-field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '9px 12px'
---

# M1／M2／M3统一UI规范

## Overview

本版将已完成的M3视觉体系扩展到M1、M2。先补全规范，再修改界面。依据Impeccable的Operate原则和UI UX Pro Max的企业应用、表格与响应式建议，统一三中心的视觉语言，保留各中心已确认的工作流程。

**方向：清晰分层的治理工作台。** 深绿导航、暖灰背景、白色工作面、14px正文、统一控件与留白。信息层级通过字重、间距和边界表达，避免重复卡片与装饰性彩色侧条。绿色表达系统主操作，AI分析使用独立紫色。

### 范围与依据

| 中心 | 本轮覆盖的现行界面 | 模块规范及业务契约 |
|---|---|---|
| M1 | 四种目录视图、六维筛选、六段信源详情、新增/编辑/查重、启停确认、关系/历史、异常及权限场景、手机详情层 | [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/DESIGN|M1界面规范]]；[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/EXPERIENCE|M1交互契约]] |
| M2 | 风险源/变量/风险类型目录、候选列表/审核抽屉、AI观测建议审核、指标查看/维护/关联、修订及历史、现行交互场景页 | [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-3-M2风险源管理中心UI设计/DESIGN|M2界面规范]]；[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-3-M2风险源管理中心UI设计/EXPERIENCE|M2交互契约]] |
| M3 | 策略目录、系统/场景流程、AI五个子页、评估四个子页、版本信息与弹窗 | [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/DESIGN|M3界面规范]]；[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/EXPERIENCE|M3交互契约]] |

功能依据分别为[[tools/RiskHot/docs/system-design/03-系统功能架构/M1 信源管理中心功能设计|M1功能设计]]、[[tools/RiskHot/docs/system-design/03-系统功能架构/M2风险源管理中心功能设计|M2功能设计]]和[[tools/RiskHot/docs/system-design/03-系统功能架构/M3策略管理中心功能设计|M3功能设计]]。历史静态稿及旧截图仍作为历史材料，当前行为以可点击原型为准。

**只改UI：业务数据与处理逻辑保持不变。** 三中心统一视觉阶段已核对全部业务JavaScript及源数据逐字节一致；后续M3 C01排布可调整页面展示函数，按函数和事件处理区段核对业务保护，领域数据仍逐字节不变。 不改字段、数据、权限、筛选规则、校验、版本、生效、在途锁定、候选治理或评估结果。跨中心跳转仅使用静态导航链接。

## Colors

统一采用frontmatter中的语义色。M1业务状态和技术接入状态分别显示，不能合并为一个灯；M2风险源/风险类型默认可用，不新加启停按钮或状态列；M3程序浅蓝、AI浅紫、人工浅橙、条件蓝灰。颜色必须配文字，不用颜色替换生命周期或审批结论。

M2已有暗色适配继续保留：暗色画布#18241e、内容#213028、正文#e7eee5、次级#b0bdb1、主操作#c5dda7。此为M2既有界面能力，不扩展成三中心自动切换功能；M1/M3仍使用当前浅色方案。

## Typography

正文和表单输入14px；普通按钮14px；顶栏模块名14px/600；当前任务和对象标题20px/600；正文分区标题15px/600；次级说明/编号12px；紧凑数据标签最低11px。手机输入16px。正常文字对比度至少4.5:1，保留可见焦点。字号按角色设定，不随窗口任意缩小。

使用本地中文无衬线字体；代码/稳定编码使用本地等宽字体。无远程字体、图片或图标请求。装饰性英文眉题删除；用于身份、来源或审核语境的真实上下文标签保留并提高可读性。

## Layout

### 共同外壳

桌面侧栏216px，顶栏57px，正文左右32px；1280px以下侧栏192px、正文24px；900px以下隐藏侧栏；手机16px正文边距。侧栏统一四个主业务层和三个横向支撑中心，M1/M2/M3各自标记当前模块，提供互通链接。M1已有配置原型入口保留。

### 保留各模块的任务组织

- **M1**：直接进入搜索、六维筛选及四视图共用工具区，不恢复已移除的大标题/重复说明。列表与详情共用工作面，名称15px，分类标签12px。列表/详情内部滚动及底部操作可达性保留；960px详情转抽屉，与现有脚本断点一致。手机表单/详情继续全屏。
- **M2**：保留三个顶层入口，变量下分正式变量/候选列表。目录/详情分区，列表项15px名称、14px正文；候选审核保持右侧抽屉，资料/身份/观测建议逐段展现，AI建议区使用浅紫色语义。新增、指标维护为居中弹窗。保持候选列表筛选、页码、滚动及焦点恢复。
- **M3**：保持已完成的页面体系和流程左60%右40%；L0～L3与M横向支撑分开，不改节点/分支/汇合及编辑行为。

### 响应式

M1的960px详情模式断点保留；M2的900px列表/详情堆叠保留；M3的760px流程堆叠保留。三中心均在900px以下隐藏侧栏。手机按钮目标44px，目录和表单可换行；复杂表格在自身容器内滚动或转字段行，不让页面整体溢出。长编号和依据必须可阅读，不能只靠悬浮提示。

## Elevation & Depth

工作面使用1px边界和留白，避免多层边框叠加。选择态用浅背景、文字和细轮廓表达。弹窗/抽屉可使用软阴影与遮罩；保留标题/提交区可达、正文自身滚动。

## Shapes

控件8px、工作面12px、居中弹窗16px。抽屉保持符合边缘附着的形状，不强行变为卡片。角色与状态标签小圆角；删除装饰性厚侧条，保留真实树形关系线和版本时间线。

## Components

| 组件 | 统一规则 | 行为保护 |
|---|---|---|
| 主/次/文字按钮 | 40px高、14px字号；手机44px；绿色主操作、白底次操作、可见焦点 | 保留disabled、提交、未知响应、撤销/返回等现有动作 |
| 筛选/视图 | 统一边界、标签与选中样式；分组由间距表达 | M1任一/交集与四视图不变；M2候选分页/筛选不变 |
| 主从列表 | 白色面、细分隔、15px名称、12px编码 | 保留选择、内部滚动和窄屏模式 |
| 表单 | 显式标签、14px正文、40px输入；长文本可增长 | 必填、错误摘要、字段错误、冲突及查重保持 |
| 提示 | 中性色/警告色配完整文案、1px边界 | 不把未知显示成成功，不把读取失败显示成空库 |
| AI区域 | 浅紫背景#eee8ff、深紫字#624392 | 区分分析建议、人工审核和正式身份/生效结果 |
| 弹窗/抽屉 | 一致间距、标题20px、可见关闭及提交区 | 原关闭、Esc、焦点恢复及未保存保护不变 |

## Do's and Don'ts

- Do：规范先行；以原有25项M1、201项M2、91项M3交互检查为回归基线。
- Do：保存全部业务脚本/数据哈希；对桌面、平板和手机分别检查布局。
- Do：保留每中心独立的信息架构与已确认的精简要求。
- Don't：新增按钮业务、模拟指标、状态或审批规则来装饰界面。
- Don't：用强制同构布局覆盖M1六段档案、M2审核抽屉或M3流程画布。

## 三中心紧凑标题区域（2026-10-16）

M1/M2/M3统一57px位置栏、14px模块h1、正文20px当前任务标题、20px顶留白、16px标题底间距；桌面标题与说明同排，手机自然换行且位置栏隐藏路径前缀。M1保留已有无正文大标题、工具区直接进入的设计；M2移除重复模块标题，将原修订审核动作移入位置栏，不删除动作；M3流水线先显示紧凑任务标题，再选择场景/版本，不改变只读与6:4。颜色及模块信息架构保持。

详细标题层级、顶栏/正文间距、弹窗规则及逐页验收以[[tools/RiskHot/docs/system-design/06产品UI原型设计/标题区域设计规范|标题区域设计规范V1.1]]为准；最新逐页结果见[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/标题区域全页面检查记录|全页面标题检查]]。


## 页面与页签操作统一顶栏（2026-10-16）

M1、M2、M3全部现行页面使用同一条规则：页面级及当前页签操作统一并入最顶部位置栏，与模块路径同排；返回、对象维护、版本和治理操作按上下文更新，全局工具置于末端。正文保留任务内容、搜索筛选、页签、列表行操作和节点／逐项审核表单。

应用顶栏保持57px及单行，空间不足仅顶栏横向滚动；弹窗和抽屉的页面级操作位于各自顶部标题行，沿用原表单及提交意图。禁止复制按钮、丢失权限或将弹层操作放在不可交互的背景中。共用实现为原型资源/top-actions.js与top-actions.css。

具体约束以[[tools/RiskHot/docs/system-design/06产品UI原型设计/标题区域设计规范|标题区域设计规范V1.1]]为准；覆盖与验证见[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心操作统一顶栏记录|三中心操作统一顶栏记录]]。
