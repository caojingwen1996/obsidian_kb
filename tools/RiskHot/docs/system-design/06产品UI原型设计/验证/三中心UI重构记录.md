# 三中心UI重构与验证记录

日期：2026-10-16。用户确认覆盖M1、M2、M3；仅重构UI，保留全部现行业务逻辑。

本记录对应三中心统一视觉交付时的快照。后续C01排布调整了M3展示函数，最新结构与按区段业务保护见[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/C01排布重构记录|C01排布重构记录]]；本页六份脚本逐字节一致及37张图的结论只对应原交付时点。

## 规范与范围

先编写[[tools/RiskHot/docs/system-design/06产品UI原型设计/DESIGN|M1／M2／M3统一UI规范V2.1]]及M1/M2扩展规范，再修改界面。使用已安装的Impeccable与UI UX Pro Max，将上一轮完成的M3视觉体系扩展到M1/M2：深绿导航、暖灰背景、白色工作面、统一字号/控件/留白，AI区使用独立紫色。

M1保留无重复大标题、合并工具区、四视图、信源业务/技术双状态和960px详情抽屉断点。M2保留三个目录、变量内指标、右侧候选审核和逐项观测审核，并保留既有暗色能力。M3保留左流程/右详情6:4、L0～L3分层及横向支撑结构。未新增业务状态、字段、权限或审批规则。

## 修改文件

下列路径相对于本UI目录。M3界面已在上一轮完成，本次仅扩展规范并重新验证。

| 范围 | 文件与用途 |
|---|---|
| 统一规范 | DESIGN.md、PRODUCT.md、.impeccable/design.json：规范、确认的产品边界及工具读取元数据 |
| M1现行界面 | 06-2-M1信源管理中心UI设计/M1信源管理中心交互原型.html、原型资源/ui-v2.css：静态导航、统一外壳及页面样式 |
| M2现行界面 | 06-3-M2风险源管理中心UI设计/M2风险源管理中心交互原型.html、原型资源/ui-v2.css、mockups/key-catalog.html、key-governance.html、key-indicator.html、key-revision.html：同一视觉样式和跨中心导航 |
| 模块规范 | M1/M2的DESIGN.md及.impeccable/design.json；M3的DESIGN.md/PRODUCT.md仅同步确认范围 |
| 导航与验证材料 | 三中心00. 阅读导航.md、验证/原型验证记录.md、UI目录readme、项目/wiki索引与日志；本目录验证脚本、结果和截图 |

M1已标为历史的mockups不重画；原有业务JavaScript、数据、交互契约及历史说明保持。原样式保留，新样式在其后加载。

## 业务保护

[[tools/RiskHot/docs/system-design/06产品UI原型设计/三中心业务保护校验.json|业务保护报告]]记录六份JavaScript的重构前后SHA-256：M1的source-catalog.js/app.js、M2的lucide.min.js/app.js、M3的flow-data.js/app.js均逐字节一致。未添加自动外网请求。

## 回归结果

| 验证 | 结果 |
|---|---|
| M1原交互检查 | 25/25通过 |
| M2原交互检查 | 201/201通过 |
| M3原交互检查 | 91/91通过 |
| 合计 | 317项通过 |
| 视口 | 1920、1440、1024、768、390、320px六档，八类场景共48次检查通过 |
| 导航与外壳 | 3次跨中心跳转、3次侧栏颜色/宽度检查通过 |
| 截图 | 37张，桌面1440px、手机390px；含M2暗色目录及审核 |
| 异常 | 本轮跨中心检查零页面异常、零自动外网请求 |

48次检查验证八类场景在六档宽度下的页面宽度及打开弹窗的边界，不等于48张视觉截图。37张截图覆盖M1目录/详情/表单/状态、M2目录/候选/AI建议/指标/历史/暗色、M3目录/流程/AI管理/评估及手机场景。

[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心UI验证结果.json|视口与截图结果]]、[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/验证/原型验证结果.json|M1交互结果]]、[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-3-M2风险源管理中心UI设计/验证/原型验证结果.json|M2交互结果]]、[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/验证/原型验证结果.json|M3交互结果]]。

## 本地文件检查

[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心交付检查结果.json|交付文件检查结果]]核对当前文档、资源、元数据、六份业务脚本及上述结果。M2/M3现有文档检查均通过。

两处重构前既有的配置模块入口目标已缺失：UI目录readme中的配置模块导航、M1侧栏中的配置原型链接。分别已由Git中原readme及重构前HTML确认；保留原入口并单独报告，不计为本轮M1/M2/M3新增缺失，也未豁免其他缺失链接。三中心原型及互通导航目标均存在。

## 设计检查与独立审查

Impeccable静态检查只执行一次，[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/Impeccable三中心扩展检查.json|保存80项结果]]，其中8项warning、72项advisory，并非零提示。提示集中于辅助小字、弹窗外框无内边距、暖灰配色及已被样式隐藏的旧英文眉题。人工结合实际覆盖样式与截图审查：正文14px，弹窗内容区有独立内边距，暖灰为明确视觉合同，隐藏眉题不呈现；无新增阻断问题。

独立审查逐张查看37张截图并重算六份业务文件哈希，结论为 **ship**。排版、材质、底色、三中心外壳、M1工具区、M2审核区、M3流程均与规范一致；M2暗色为保留既有能力的适配。未要求增加装饰或动效，无需阻断交付的修改项。

本轮为本地原型验证，不代表真实后端、数据库、模型调用、并发治理、完整WCAG或全设备验收。上一轮M3的30次视口与22张子页截图为历史记录，未计入本轮48次/37张。

## 复验

从UI目录执行（验证工具使用本机已有Playwright与Chrome，原型本身离线可直接打开）：

```sh
node '验证/三中心UI验证.mjs'
python3 '验证/检查三中心交付.py'
```

## 当前预览

- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-2-M1信源管理中心UI设计/M1信源管理中心交互原型.html|M1信源管理中心]]；[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心截图/M1-专题目录.png|桌面目录]]、[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心截图/M1-手机详情.png|手机详情]]。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-3-M2风险源管理中心UI设计/M2风险源管理中心交互原型.html|M2风险源管理中心]]；[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心截图/M2-AI观测审核.png|AI观测审核]]、[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心截图/M2-手机AI观测审核.png|手机审核]]。
- [[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/M3策略管理中心交互原型.html|M3策略管理中心]]；[[tools/RiskHot/docs/system-design/06产品UI原型设计/验证/三中心截图/M3-流水线.png|分层流程全景]]。
