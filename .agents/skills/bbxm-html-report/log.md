# 通用 HTML 报告输出技能变更日志

## 2026-09-22 — 新建并接入冰冰小美 Agent

- 版本：新建1.0.0。
- 修改原因：用户要求参考wb-finance-skill 1.5.0的HTML规范，配置Agent通用输出技能。
- 来源：原文件位于 `C:/Users/lenovo/.workbuddy/plugins/cache/cb_teams_marketplace/finance-data/1.5.0/skills/wb-finance-skill/references/html-report-style.md`；逐字节归档为 `sources/manual/2026-09-22-wb-finance-1.5.0-html-report-style.md`，SHA256为 `fed09b2cf0142adc56367096d57f6323f15c989c18309f7dba4689aeae3814f8`。
- 涉及文件：SKILL.md、workflow.md、references/html-report-style.md、assets/report.css、scripts/validate_html.py、agents/openai.yaml、log.md。
- 具体变更：标准技能入口与独立工作流；浅色研报风、结论先行、ECharts数值图及图表切换、SVG/CSS关系图、完整模板和证据保留、响应式及打印样式；内联经典JS/module语法和JSON块校验，重复ID及页内锚点检查。原有业务路径与机器工件保留，纯JSON和简短问答有明确边界。
- 集成：专家总入口和Agent页面增加统一交付步骤；已有HTML复用核验，不重复生成，不批量改写其他分析技能。
- 验证结果：本技能与bbxm-expert的quick_validate通过；验证脚本10个正反例通过（静态页、有效/无效经典JS、有效/无效module、有效/无效JSON、重复ID、失效锚点、缺Node）。本轮配置技能，不生成新的市场研究报告；未做浏览器图表渲染验收，结构/语法通过不代表运行渲染通过。


## 2026-09-28 — 固化报告阅读层次与重点展示

- 版本：1.0.0 → 1.0.1。
- 修改原因：用户要求将报告结论先行、正文聚焦与明细附录的改进纳入通用输出规范。
- 涉及文件：`SKILL.md`、`workflow.md`、`references/html-report-style.md`、本日志；同步根 `index.md`、`log.md`。
- 具体变更：首屏结论在导航之前；正文每节先回答问题再提供证据；保持领域必需主章节，在章内区分重点与明细。长明细采用可展开附录，关键反证、候选状态、来源失败与判断限制摘要仍直接可见。图题和读图说明服务单一问题，精确值可切换或展开；不匹配均值不画为标准线；区分浏览器ECharts与离线SVG的窄屏要求。验收加入阅读重点、附录展开、精确值查询和打印检查。
- 边界：未修改共用CSS、校验脚本或业务报告；不把theme章节套用到其他业务模板，不改变研究结论及机器契约。
- 验证：两技能quick_validate通过；五份说明文档UTF-8、代码围栏及37处本地链接/锚点通过，差异空白检查通过。人工核对主章节保留、重要证据可见与完整内容保留规则无冲突。本次仅修改规范，未新增浏览器视觉验收。
