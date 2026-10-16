# RiskHot 阅读产品页面

本轮为已有实现中途采用 impeccable 的复核与交付收尾。前期实施使用 frontend-design，不能追认为已完成 impeccable 的完整概念流程。本记录不伪造视觉选案或概念抽签。

## Scope

原型入口：RiskHot_产品层交互原型.html。相关实现：原型资源/reader.css、reader.js、演示数据.js。访客模式：Read。只覆盖本目录产品端，不调整管理端。

## Confirmed brief

一般阅读者；两入口“风险速览／观察报告”；打开即读；不增加我的关注、收藏、配置、订阅和观察任务。风险下钻采用结论、变化、原因、实际影响、验证条件、证据的连续阅读顺序。原型使用已明确标记的虚构数据。

## Direction contract

**THESIS**：让风险判断成为可理解的解读。首页直接解释重要变化，保留高位稳定与未知；不用资料表格承接第一屏。

**OWN-WORLD**：绿色品牌、平面阅读底色、衬线中文标题与无衬线正文。使用单一顶部导航、细分隔线和少量语义色；正文不铺装饰图形。

**STORY**：看到重要变化，读懂原因与当前影响，知道何种证据会改变判断；需要时展开事实、反向信号及缺口。读报告时保留周期和当期引用。

**FIRST VIEWPORT**：桌面顶部两个一级入口；左侧主判断含解释与“读懂这项风险”，右侧两条次要变化。手机顺序折为主判断、次要变化；首屏能看到结论、解释、程度和下钻入口。详情首屏是标题、导语、时点和当前判断；报告首屏是周期、标题、摘要。

**FORM**：当前已实现的阅读解读结构。本次复核范围保持已确认的内容顺序与两入口，未进行概念抽签；不声明种子或视觉选案已获用户确认。标志性交互是同一阅读路径内按需展开依据，并从报告回到固定当期解读；没有个性化配置。

**FINISH**：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Exit conditions

- 与用户需求逐项核对，桌面和手机截图均可读。
- 阅读路径及边界用浏览器实际操作验证。
- 独立 finish reviewer 给出明确 disposition；依评审处理实质问题。
- 本目录 PRODUCT.md、DESIGN.md、.impeccable/design.json、页面方案和验证记录与交付一致。
- 不将截图、静态演示或浏览器测试说成真实研究或生产验收。
