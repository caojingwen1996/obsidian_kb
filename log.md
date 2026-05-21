# 知识库日志

> 按时间顺序记录知识库操作。仅追加，不覆盖。
> 格式：`## [YYYY-MM-DD] action | subject`

## [2026-05-21] refactor | rename wiki and source filenames to Chinese

- 将 `wiki/` 与 `sources/` 下文件名中的拼音和英文语义段改为中文文件名，保留目录结构、日期和必要来源编号。
- 正式知识页优先使用 frontmatter `title` 或一级标题生成中文文件名；原始资料页优先使用原文标题，并保留微信编号、序号等追踪信息。
- 同步更新全库 Markdown、JSON、SVG/TXT 配置中的旧路径引用，包括 Obsidian 双链、来源路径、图片资产路径和工作区状态引用。
- 本次仅重命名文件与路径引用，不新增正式知识页；`index.md` 页面总数无需调整。

## [2026-05-21] docs | add SVG embed format to reasoning page rules

- 在 `page-types.md` 的 Reasoning Page `svg 推导图` 小节补充 SVG 嵌入规则。
- 规定推导页中的 SVG 使用 HTML `<img>` 标签，并固定 `width: 90vw; max-width: none; height: auto;` 样式。
- 未新增正式知识页，`index.md` 无需调整。

## [2026-05-21] refactor | normalize SVG embeds as HTML img

- 将 `wiki/reasoning/冰冰小美人工智能与国家中美两强推导链.md` 中的 SVG Markdown 图片嵌入改为 HTML `<img>` 格式。
- 保持 `width: 90vw; max-width: none; height: auto;`，与 `wiki/reasoning/风险转弱节点如何形成买入窗口.md` 中的 SVG 嵌入格式一致。
- 未新增正式知识页，`index.md` 无需调整。

## [2026-05-21] refactor | normalize wikilink display text across vault

- 遍历全库 Markdown 文件，将裸路径双链 `[[页面路径]]` 批量修正为 `[[页面路径|显示名称]]`。
- 显示名称优先取目标页 frontmatter `title`，其次取一级标题，最后回退到文件名。
- 跳过代码块和图片嵌入链接，避免破坏示例代码与媒体引用。
- 追加修正 Windows 路径归一化导致的显示名未命中问题，并将旧式 view 路径重定向到实际存在的页面路径。
- 修复批量写入中一个临时清空的观点页 `wiki/views/碧树西风：周期用来理解市场，不直接创造利润.md`，并按同一链接格式恢复内容。
- 未新增正式知识页，`index.md` 无需调整。

## [2026-05-21] refactor | standardize wikilink display names

- 在 `AGENTS.md` 的双链规则中补充 `[[页面路径|显示名称]]` 链接格式要求。
- 将 `wiki/reasoning/风险转弱节点如何形成买入窗口.md` 中的裸路径链接改为带显示名称的 Obsidian 链接，并在相关列表中补充“为什么相关”的说明。
- 未新增正式知识页，`index.md` 无需调整。

## [2026-05-21] refactor | regenerate risk weakening buy window reasoning page

- 按 `page-types.md` 与 `rules/reasoning-page-rules.md` 重新生成 `wiki/reasoning/风险转弱节点如何形成买入窗口.md`。
- 新版补齐核心命题、背景事实、推导链表、Mermaid 推导图、SVG 推导图、时间节点、验证信号、风险触发条件、相关事件、相关时间线、相关人物与相关页面。
- 保留原有来源、Concept Page 双链和 `sources/assets/风险转弱逻辑.svg` 引用。
- 未新增正式页面，`index.md` 无需调整。

## [2026-05-21] ingest | bingbing xiaomei risk weakening node concept and reasoning

- 归档雪球文章 `289333959` 到 `sources/articles/2026-05-21-风险转弱的节点.md`，保留作者、链接、来源声明、风险提示和完整正文。
- 新增概念页 `wiki/concepts/风险转弱节点框架.md`，将“风险转弱节点”整理为基本面风险、情绪面风险、流动性风险、估值风险四类风险与宏观/中观/微观/交易四层转弱条件组成的 Concept Page。
- 新增推导链页 `wiki/reasoning/风险转弱节点如何形成买入窗口.md`，拆解四类风险缓和、三要素同步有利和买入窗口形成之间的因果链。
- 在推导链页嵌入 `sources/assets/风险转弱逻辑.svg`，作为风险转弱到买入窗口的图示化表达。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/概率化决策与风险控制.md` 与 `wiki/topics/宏观经济.md`，把该框架接回作者体系、交易前风险检查和宏观风险转弱逻辑。
- 同步更新 `index.md`，页面总数从 `120` 调整为 `122`。
- 说明：发布时间未由用户材料提供，已标注为“待验证”；“买入不败”按作者观点处理，不写成无风险事实。

## [2026-05-21] ingest | bingbing xiaomei on true long-term and bottom-line thinking

- 归档用户提供的冰冰小美短观点到 `sources/manual/2026-05-21-冰冰小美-真正中长期底线思维.md`。
- 新增观点页 `wiki/views/冰冰小美：真正的中长期需要底线思维.md`，将其整理为“真正的中长期从三年起步，并且要经受均值回归和底线思维检验”的 View Page。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/概率化决策与风险控制.md`，把该观点接回人物学习线、宏观执行边界和仓位风险控制主题。
- 同步更新 `index.md`，页面总数从 `119` 调整为 `120`。
- 说明：原文缺少发布时间和链接，已在原始资料与观点页中标注来源不完整。

## [2026-05-21] ingest | bingbing xiaomei on macro as risk and positioning tool

- 归档用户提供的冰冰小美短观点到 `sources/manual/2026-05-21-冰冰小美-宏观风险仓位.md`。
- 新增观点页 `wiki/views/冰冰小美：宏观用于理解风险和调整仓位.md`，将其整理为“宏观用于理解风险并调整仓位，而不是生成下单代码”的 View Page。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/概率化决策与风险控制.md`，把该观点接回人物学习线、宏观边界和仓位风险控制主题。
- 同步更新 `index.md`，页面总数从 `118` 调整为 `119`。
- 说明：原文缺少发布时间和链接，已在原始资料与观点页中标注来源不完整。

## [2026-05-21] link | embed AI and state SVG reasoning diagram

- 将 `sources/assets/冰冰小美人工智能与国家逻辑.svg` 嵌入 `wiki/reasoning/冰冰小美人工智能与国家中美两强推导链.md` 的 `SVG 推导图` 小节。
- 未新增正式知识页，`index.md` 无需更新。

## [2026-05-21] ingest | bingbing xiaomei on AI and state-level G2 competition

- 归档用户提供的 `冰冰小美` 雪球文章《Ai与国家》到 `sources/articles/2026-05-17-冰冰小美：人工智能与国家.md`，保留正文与关键评论区摘录，并去除页面导航、热门话题、热股榜等网页噪音。
- 新增观点页 `wiki/views/冰冰小美：人工智能已成为国家级竞争门槛.md`，将其整理为“AI 已成为国家级竞争门槛”的 View Page。
- 新增推导链页 `wiki/reasoning/冰冰小美人工智能与国家中美两强推导链.md`，拆解中美重新定位、亚太安全溢价、AI 投资泡沫延长、G2 门槛和通胀跟踪变量。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/地缘重估与资源-货币秩序.md`，把新观点接回人物学习线、宏观主题和地缘资源主题。
- 同步更新 `index.md`，页面总数从 `116` 调整为 `118`。
- 说明：文中关于中美关系、三战风险、G2 格局、特朗普和亚太安全的内容均按作者观点或推测处理，未写成已验证事实。

## [2026-05-20] refactor | concept pages aligned to page-types

- 按 `page-types.md` 中 Concept Page 的定义，重构了 `wiki/concepts/` 下 5 个概念页的正文结构。
- 统一补齐 `定义`、`背景`、`核心观点`、`关键组成`、`使用场景`、`与其他概念的关系`、`常见误区`、`相关页面` 与 `来源` 小节。
- 保留既有 frontmatter、来源与核心判断，仅重排结构并补充必要的双链说明。
- 修改文件：`wiki/concepts/盈亏比、止损与兜底.md`、`wiki/concepts/信息不对称与信息高地.md`、`wiki/concepts/汇率、长期利率与流动性.md`、`wiki/concepts/债务、分配与增长约束.md`、`wiki/concepts/政策对冲与内部定价权.md`。
- 未新增页面；`index.md` 已覆盖这些概念页，本轮未改索引。

## [2026-05-20] refactor | add mermaid reasoning diagrams

- 为 `wiki/reasoning/冰冰小美5月14日风险节点推导.md` 补充 `## Mermaid 推导图` 小节，把 AI/半导体拥挤、资本开支兑现、美联储验证、中美科技外交和情绪流动性负反馈串成图示。
- 为 `wiki/reasoning/有色金属拐点推导.md` 补充 `## Mermaid 推导图` 小节，把石油危机、通胀预期、降息预期、缩表、美元信用、黄金与有色见底逻辑串成图示。
- 未新增正式知识页，因此未更新 `index.md`。

## [2026-05-20] ingest | bingbing xiaomei nonferrous turning point flowchart

- 归档用户提供的“有色拐点逻辑推导流程图”到 `sources/screenshots/2026-05-20-有色拐点逻辑推导流程图.png`，并新增转写页 `sources/screenshots/2026-05-20-有色拐点逻辑推导流程图.md`。
- 新增观点页 `wiki/views/冰冰小美：有色拐点取决于通胀预期何时下降.md`，将有色拐点整理为“通胀预期下降后，降息预期升温才更可能形成见底逻辑”。
- 新增推导链页 `wiki/reasoning/有色金属拐点推导.md`，拆解石油危机与通胀约束、美联储缩表动机、黄金与有色传导、真正拐点触发条件。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/地缘重估与资源-货币秩序.md`，把这条推导接回人物学习线、宏观经济和资源-货币秩序主题。
- 同步更新 `index.md`。
- 说明：原图缺少原帖链接与发布时间，`6/16`、沃什理念、美联储政策路径和资产表现均保留“待验证 / 不确定性”标注。

## [2026-05-20] ingest | bingbing xiaomei 5/14 risk node reasoning flowchart

- 归档用户提供的 `冰冰小美推导英特尔5.14风险节点.png` 到 `sources/screenshots/2026-05-20-冰冰小美-5-14-风险节点推导.png`，并新增转写页 `sources/screenshots/2026-05-20-冰冰小美-5-14-风险节点推导.md`。
- 新增推导链页 `wiki/reasoning/冰冰小美5月14日风险节点推导.md`，把 `5/14` 拆成 AI/半导体拥挤交易、资本开支融资现实、美联储通胀利率验证、中美科技外交结果和流动性情绪共振。
- 更新既有观点页 `wiki/views/冰冰小美：短期技术扰动之后，风险节奏仍锚定美国通胀拐点.md`，补入“5/14 是密集验证窗口而非精准崩盘日”的图示推导。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/概率化决策与风险控制.md`，将新推导接入人物学习线、宏观主题和风险控制主题。
- 同步更新 `index.md`。
- 说明：原图缺少原帖链接与发布时间，`CPI/PPI`、联储表态、H200 对华销售 / 交付预期和中美会晤预期等事件细节均需后续验证。

## [2026-05-18] ingest | bingbing xiaomei on competitive advantage in market structure

- 归档了用户提供的 `冰冰小美` 雪球原帖 `291511412` 到 `raw/articles/2026-05-18-冰冰小美：竞争格局的比较优势.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/竞争格局的比较优势来自安全与发展的再平衡.md`，把“竞争格局的比较优势”整理为“安全与发展、效率与公平、全球产业竞争和金融制度重估共同决定相对位置”的判断。
- 更新 `people/冰冰小美.md`，补全“体系 / 交易体系三要素”中的“竞争格局的比较优势”，至此三要素均已挂接正式观点页。
- 更新 `topics/宏观经济.md`、`topics/地缘重估与资源-货币秩序.md` 与 `topics/概率化决策与风险控制.md`，分别接入经济结构转型、供应链与地缘竞争、选股交易系统三条证据链。
- 同步更新 `index.md`。

## [2026-05-18] ingest | bingbing xiaomei on emotion position shifts

- 归档了用户提供的 `冰冰小美` 雪球原帖 `291538494` 到 `raw/articles/2026-05-18-冰冰小美：情绪位置的变化.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/情绪合力取决于所处位置.md`，把“情绪位置的变化”整理为“情绪合力取决于市场所处位置、亏钱效应、制度变化和参与者结构”的判断。
- 更新 `people/冰冰小美.md`，补全“体系 / 交易体系三要素”中的“情绪位置的变化”，并回写她对传统短线情绪模型失效的观察。
- 更新 `topics/概率化决策与风险控制.md`，把该材料并入交易系统需要随市场状态、制度和参与者结构变化而校准的证据链。
- 同步更新 `index.md`。

## [2026-05-18] ingest | bingbing xiaomei on dialectical liquidity analysis

- 归档了用户提供的 `冰冰小美` 雪球原帖 `291532021` 到 `raw/articles/2026-05-18-冰冰小美：流动性辩证分析.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/流动性有利不等于成交量放大.md`，把“流动性辩证分析”整理为“成交量不是唯一指标，要同时看股票供给侧改革、ETF 权重支撑、政策约束和资金迁移方向”的判断。
- 更新 `people/冰冰小美.md`，补入她把成交量、ETF/国家队支撑、指数权重、政策约束和核心资产迁移放在同一张图里的思维特征。
- 更新 `topics/宏观经济.md` 与 `topics/概率化决策与风险控制.md`，分别接入 A 股内部流动性结构解释，以及交易系统需要随市场生态更新前提的约束。
- 同步更新 `index.md`。

## [2026-05-18] ingest | bingbing xiaomei on expectation gap as greed bait

- 归档了用户提供的 `冰冰小美` 雪球原帖 `244824585` 到 `raw/articles/2026-05-18-冰冰小美：常见的亏钱认知：预期差.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/预期差叙事容易诱发贪婪.md`，把“预期差”压成“容易诱发贪婪的画饼式市场叙事”这一可复用判断。
- 更新 `people/冰冰小美.md`，补入她对交易话术、贪婪诱发和纪律约束的思维特征。
- 更新 `topics/概率化决策与风险控制.md`，把该材料并入“执行偏差与常见误区”，并明确暂不新建“亏钱认知” topic，先作为该主题下的子线索沉淀。
- 同步更新 `index.md` 与 `log.md`。

## [2026-05-14] ingest | create topic for life and wealth worldview

- 新建 topic `topics/人生观与财富观.md`，用于承接“人生观与财富观”这条长期主线。
- 本页被判定为服务当前知识库的投资策略线与人物学习线：它把财富目标、收益质量、财富留存、真实承受力与投资系统目标函数连接起来，而不是作为泛泛的人生随笔入库。
- 初始回链到 `topics/概率化决策与风险控制.md`、`topics/宏观经济.md`、`topics/信息高地、上位者博弈与非标路径.md`、`concepts/盈亏比、止损与兜底.md`、`concepts/信息不对称与信息高地.md`，并引用已有相关 view 作为证据节点。
- 同步更新 `index.md`：将页面总数更新为 `108`，并在“主题”分区登记 `[[topics/人生观与财富观|人生观与财富观]]`。
- 继续补入用户提出的核心隐喻：财富观像一口缸，至少要满足“有进有出、量入为出、够用不焦虑”，才能逐步找到适合自己的容量，避免财富被收走、反噬或变成生活压力源。

## [2026-05-14] ingest | bingbing xiaomei on 5/14 technical disturbance and inflation risk node

- 归档用户提供的 `冰冰小美` 5/14 观点原文到 `raw/manual/2026-05-14-冰冰小美-宏观风险节点.md`。
- 新增观点页 `views/冰冰小美：短期技术扰动之后，风险节奏仍锚定美国通胀拐点.md`，将“5/14 魔咒”拆成联储换届、股指期货交割等短期技术扰动，以及美国通胀拐头这一更关键的风险节奏锚。
- 更新 `people/冰冰小美.md`，补入她面对市场时间节点时先拆技术扰动、再回到通胀、油价、货币政策与风险偏好传导链的思维特征。
- 更新 `topics/宏观经济.md`，把该材料接入通胀、利率预期、流动性与资产风险偏好的传导框架。
- 同步更新 `index.md`，让新增 view 进入正式知识索引。

## [2026-04-27] ingest | xueqiu daily summaries for bingbing xiaomei and mai gupiao de laomujiang

- 读取了 `/Users/cjw/dev/Obsidian/cjw-xueqiu-daily-monitor/20260427/` 下当天两位作者的雪球抓取结果与 `summary.md`。
- 归档了两份日汇总到 `raw/transcripts/`：`2026-04-27-冰冰小美-雪球-汇总.md` 与 `2026-04-27-买股票的老木匠-雪球-汇总.md`。
- 为 `冰冰小美` 新增观点页 `views/冰冰小美：人工智能产业链重估要同时看技术路线、产业位置与交易节点.md`，把她当天关于 AI 产业链、国产替代、智能汽车和交易节点的判断并回 `people/冰冰小美.md` 与 `topics/宏观经济.md`。
- 为 `买股票的老木匠` 新增观点页 `views/买股票的老木匠：救市资金退出是在恢复市场机制.md`，把他关于救市资金退出、市场机制恢复和卖压来源区分的判断并回 `people/买股票的老木匠.md` 与 `topics/概率化决策与风险控制.md`。
- 清理了 `index.md` 中既有的观点区 Git 冲突标记，保留更完整的索引分支，并同步登记本次新增的两条观点页。

## [2026-04-24] ingest | bi-shu-xi-feng way out system

- 将用户提供的《这辈子还能有出路么？》整理进正式知识层，并清洗出 1 篇 `raw/articles/` 归档，剔除文末付费文章目录与留言区。
- 新建 1 条 `view`，聚焦“出路来自按需求组织能力、把路走宽并守住现金流”这一条稳定主线。
- 更新 `people/碧树西风.md`、`topics/概率化决策与风险控制.md`、`topics/信息高地、上位者博弈与非标路径.md`、`index.md` 与 `log.md`，把这条新证据接回人物学习线与两个既有主题页。

## [2026-04-24] topic-split | quantitative trading

- 从 `topics/概率化决策与风险控制.md` 中抽离“量化思维、分布视角、可计算化表达、价格与反馈优先”这条方法论主线。
- 新建 `topics/量化交易.md`，作为知识库里的“量化交易”正式 topic 页，并明确它在本库中主要指量化方法论，而不是高频或自动化系统。
- 将 `views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md` 与 `views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md` 回挂到新 topic。
- 收窄 `topics/概率化决策与风险控制.md` 的页面职责，保留仓位、止损、退出、风控、复盘与执行主线。
- 同步更新 `index.md` 与 `log.md`。

## [2026-05-14] query | account segmentation for non-professional investors

- 基于 `topics/概率化决策与风险控制.md`、`views/碧树西风：普通投资者更需要区间判断，而不是职业级精度.md`、`views/碧树西风：融资市场里，小本金更需要低门槛系统.md`、`views/买股票的老木匠：投资回报更取决于赔率与位置，不取决于公司光环.md` 等页面，回答“股票账户、趋势 ETF 账户、长持账户”这种分仓方式是否适合工作党非专业投资者。
- 结论：账户隔离本身可行，且符合“系统要匹配执行者、低成本可执行、纪律优先于预测、环境设计也是系统一部分”的知识库原则；但必须补齐资金来源、仓位上限、再平衡周期、止损/证伪和破例规则。

## [2026-04-21] ingest | bi-shu-xi-feng quantification

- 将 `2026-04-05-jiyi-chengzai-mid-2247532824-idx-1` 纳入正式知识层。
- 新增 1 篇 `raw/articles/` 原始归档，并新建 1 条观点页：量化不等于高频，关键是把变化中的结构与情绪翻译成数字。
- 将这条新证据并入 `people/碧树西风.md` 与 `topics/概率化决策与风险控制.md`，同步更新 `index.md` 与 `log.md`。

## [2026-04-21] ingest | bingbing xiaomei macroeconomy 2026-04-21

- 将 `2026-04-21` 的 `冰冰小美` 雪球汇总纳入正式知识层，判定仍明确服务于 `topics/宏观经济` 与人物学习线。
- 新增 1 份 `raw/transcripts/` 汇总归档与 1 份对应 `state.json`，并新建 1 条观点页，聚焦“新旧产业分化由全球定价与产业共识驱动”。
- 更新 `people/冰冰小美.md` 与 `topics/宏观经济.md`，把这条新证据并回人物方法与宏观主题框架。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] topic-refactor | macroeconomy concepts split

- 从 `topics/宏观经济.md` 中先拆出 3 个最稳定的概念页：`汇率、长期利率与流动性`、`债务、分配与增长约束`、`政策对冲与内部定价权`。
- 复用现有 `bi-shu-xi-feng` 与 `bingbing-xiaomei` 的观点证据，不新增新的 `view`，只把重复出现的宏观框架沉淀为 `concept`。
- 更新 `topics/宏观经济.md` 的 `related_concepts` 与正文入口，让主题页更多承担导航与组合关系，而不是把所有概念解释堆在同一页。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] ingest | bingbing xiaomei macroeconomy 2026-04-13

- 继续审计 `冰冰小美` 剩余日期后，将 `2026-04-13` 这组与 `topics/宏观经济` 明确相关的内容纳入正式知识层。
- 新增 1 份 `raw/transcripts/` 汇总归档，并新建 1 条观点页，聚焦“政策对冲外部冲击、A 股以我为主的结构性重定价”。
- 更新 `people/冰冰小美.md` 与 `topics/宏观经济.md`，把这条新证据并回人物学习线和宏观主题页。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] ingest | bingbing xiaomei macroeconomy continuation

- 继续整理 `冰冰小美` 与 `topics/宏观经济` 相关的已归档材料，补入 `2026-04-09` 与 `2026-04-12` 两组证据。
- 新增 1 份 `raw/transcripts/` 汇总归档，并新建 2 条宏观相关观点页，分别覆盖“宏观视角 + 市场结构”与“机构化加深后的风险定价”。
- 更新 `people/冰冰小美.md` 与 `topics/宏观经济.md`，把这两条新证据并回人物学习线和宏观主题页。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] ingest | bingbing xiaomei macroeconomy

- 将 `cjw-xueqiu-daily-monitor` 中与 `topics/宏观经济` 明确相关的 `2026-04-10`、`2026-04-14`、`2026-04-19` 内容整理进正式知识层。
- 新增 2 份 `raw/transcripts/` 汇总归档，并基于已存在的 `2026-04-10` 汇总新建 `people/冰冰小美.md` 与 3 条宏观观点页。
- 更新 `topics/宏观经济.md`，补入“国家竞争与政策回应”这一组新证据，并将第二条人物学习线接入宏观主题。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-19] topic-create | macroeconomy

- 新建 `topics/宏观经济.md`，作为知识库中的“宏观经济”正式 topic 页。
- 先挂接已有的宏观相关原始资料与观点页，形成“增长/债务/分配、通胀/利率、流动性、区间判断”四条观察轴。
- 同步更新 `index.md` 与 `log.md`，将该页纳入正式知识层索引。

## [2026-04-18] schema-update | summary conventions

- 在目录约定和索引中加入 `summaries/` 分区。
- 补充 `summary` 页的专属 schema 字段与最低链接要求。
- 增加 `summary` 页面建页阈值示例。

## [2026-04-18] schema-update | formal knowledge admission

- 在 page type 与建页阈值判断之前加入正式知识层准入门槛。
- 明确不符合领域的资料不得进入正式知识层。

## [2026-04-18] schema-update | out-of-domain discard

- 收紧准入规则：不符合领域的资料直接丢弃，不再保留在 `raw/`。
- 同步更新 schema 与 skill 的表述，将 `raw/` 视为仅保存已通过准入的原始资料。

## [2026-04-18] ingest | bi-shu-xi-feng probabilistic decision framework

- 将 `2026-01-13-jiyi-chengzai-mid-2247519583-idx-2` 纳入正式知识层。
- 围绕概率化决策与风险控制，新建人物、主题、概念、观点四类页面。
- 更新 `index.md`，加入 4 条正式知识页索引。

## [2026-04-18] ingest | bi-shu-xi-feng bayesian adaptation

- 将 `2026-01-14-jiyi-chengzai-mid-2247519588-idx-1` 纳入正式知识层。
- 新建一条观点页，补充“目标分层 + 贝叶斯式策略适配”的细化判断。
- 同步更新人物页、主题页与 `index.md`。

## [2026-04-18] ingest | bi-shu-xi-feng unmeasurable world

- 将 `2026-02-11-jiyi-chengzai-mid-2247519800-idx-1` 纳入正式知识层。
- 新建一条观点页，补充“世界不可测 + 完整策略 + 止损可执行性”的细化判断。
- 同步更新人物页、主题页、概念页与 `index.md`。

## [2026-04-18] topic-update | investment system merged into decision logic topic

- 将“投资系统 / 投资纪律 / 底层决策逻辑”合并收束到同一个 topic 中。
- 重写 `topics/概率化决策与风险控制.md`，加入适用市场、目标收益与回撤约束、选资产原则、仓位、进出场、风控、复盘等栏目。
- 新建 `2026-01-31` 对应观点页，作为交易系统与不干预原则的证据节点。

## [2026-04-18] ingest | bi-shu-xi-feng bidirectional mispricing

- 将 `2026-01-26-jiyi-chengzai-mid-2247519692-idx-2` 纳入正式知识层。
- 新建一条观点页，补充“半仓结构 + 正反向乌龙指 + 环境约束”的细化判断。
- 同步更新人物页、主题页、概念页与 `index.md`。

## [2026-04-18] ingest | bi-shu-xi-feng blue ocean execution

- 将 `2026-02-03-jiyi-chengzai-mid-2247519734-idx-1` 纳入正式知识层。
- 新建一条观点页，补充“蓝海竞争 + 反人性执行”的细化判断。
- 同步更新人物页、主题页与 `index.md`。

## [2026-04-18] discarded | 2026-02-18-jiyi-chengzai-mid-2247519853-idx-1

- 判定不进入正式知识层。
- 文章虽然涉及 AI、东西方结构与就业冲击，但核心落点是个人专业选择与能力升级，不属于当前已建立的投资策略主线。
- 现有知识库也尚未建立能稳定承接这篇文章的宏观主题，因此不新建 `people/`、`concepts/`、`topics/`、`views/` 页面，也不更新 `index.md`。

## [2026-04-18] ingest | bi-shu-xi-feng information high ground

- 将 `2026-02-21-jiyi-chengzai-mid-2247519882-idx-1` 纳入正式知识层。
- 新建“信息不对称与信息高地”概念页，以及“信息高地、上位者博弈与非标路径”主题页。
- 新建一条观点页，补充“开放式游戏被改造成封闭竞争”的关键判断。
- 同步更新人物页与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 50-100

- 从 `wechat_history_links.txt` 的 `50-100` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2025-11-29`、`2025-12-09`、`2025-12-17`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 同步更新 `topics/概率化决策与风险控制.md`、`concepts/盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 101-150

- 从 `wechat_history_links.txt` 的 `101-150` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2025-10-19`、`2025-10-25`、`2025-11-22`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中显式补入 3 条新规则：单位风险与单位成本核算、真实耐心约束、同口径比较与高质量收益优先。
- 同步更新 `concepts/盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 151-200

- 从 `wechat_history_links.txt` 的 `151-200` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 5 篇文章：`2025-09-09`、`2025-09-10`、`2025-09-11`、`2025-09-12`、`2025-09-13`。
- 新增 5 篇原始资料归档，并分别新建 5 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续显式补入新规则：固定模式优先于情绪持仓、策略与个人禀赋匹配、投资是生意、周期只负责理解而不直接负责盈利、拥挤共振会阶段性摧毁边际优势。
- 同步更新 `concepts/盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 201-250

- 从 `wechat_history_links.txt` 的 `201-250` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-07-04`、`2025-08-16`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续显式补入新规则：高确信不能替代退出与仓位约束，历史周期模板本身也有适用期。
- 同步更新 `concepts/盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 251-300

- 从 `wechat_history_links.txt` 的 `251-300` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-05-27`、`2025-06-17`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续显式补入新规则：仓位上限先匹配承受力，保本承诺先审计底层资产、偿付来源与对手盘机制。
- 同步更新 `concepts/盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] topic-update | probabilistic decision execution rules regrouped

- 将 `topics/概率化决策与风险控制.md` 中原本分散在补充段落里的“环境约束”和“反人性程度”并入统一的“执行规则”。
- 保留原有判断不变，只调整结构分组，使所有与持续执行有关的内容集中在同一层。

## [2026-04-18] topic-update | probabilistic decision rule list removed

- 删除 `topics/概率化决策与风险控制.md` 中“近期新增规则”这一类总表章节。
- 将其中仍有必要保留的判断分别并回 `适用市场`、`选股或选资产原则`、`执行规则` 等对应章节，避免重复维护一份规则清单。

## [2026-04-18] topic-update | probabilistic decision supplement sections merged

- 删除 `topics/概率化决策与风险控制.md` 中残留的 `补充：...` 小节。
- 将仍有必要保留的判断并回 `复盘机制` 等正式章节，避免页面继续以增量补丁方式生长。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 301-350

- 从 `wechat_history_links.txt` 的 `301-350` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 4 篇文章：`2025-03-18`、`2025-03-25`、`2025-04-01`、`2025-04-11`。
- 新增 4 篇原始资料归档，并分别新建 4 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续补入正式章节内容：普通投资者的大区间判断、抄作业前先看懂约束、踏空纪律、保值基准不应简单等同于 `CPI`。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。

## [2026-04-18] topic-update | probabilistic decision evidence moved inline

- 将 `topics/概率化决策与风险控制.md` 中原先页尾平铺的 `相关观点` 列表拆散，直接并回各正式章节下方。
- 每组规则后补充对应 `view` 及其支撑点，便于直接看出某条观点在 topic 中支撑哪一句判断。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 351-410

- 从 `wechat_history_links.txt` 的 `351-410` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-02-26`、`2025-03-16`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：左侧交易只投“好学生”、不具备速度优势时不要硬做纯速度竞争、算法正期望和制度变化也属于风控。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 411-470

- 从 `wechat_history_links.txt` 的 `411-470` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2024-11-15`、`2024-12-26`、`2025-01-05`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：同一资产在不同财富阶段对应不同任务、环境桥梁决定你更容易进入哪类系统、小本金别照搬高门槛研究型价值投资。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 471-530

- 从 `wechat_history_links.txt` 的 `471-530` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2024-10-19`、`2024-10-20`、`2024-10-24`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：顶底与放量只能放回时间窗口和参与者结构中理解、止损位只能在入场前改写、资金使用率与最大回撤必须纳入同一收益口径。
- 同步补齐 `topics/概率化决策与风险控制.md` 与 `people/碧树西风.md` frontmatter 中此前遗漏的 `sources / related` 条目，并更新 `index.md` 与 `log.md`。
- `2024-10-18` 与 `2024-10-07` 这两篇未并入本 topic，因为前者更偏广义“投资自己”，后者更偏宏观气候与价值投资语境，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 531-590

- 从 `wechat_history_links.txt` 的 `531-590` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2024-07-04`、`2024-07-13`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回 `选股或选资产原则`：先看自己在商业模式里扮演谁、资产价值先看资源依托而不是表面标签。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2024-08-12` 与 `2024-07-24` 这两篇未并入本 topic，因为前者更偏一般性的训练与探索方法，后者更偏宏观财富分配与共识经济，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 591-650

- 从 `wechat_history_links.txt` 的 `591-650` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2024-04-23`、`2024-05-14`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：同名资产在不同交易结构下风险完全不同、商品型结构也要拆解真实风险来源、长线系统不能临时改用波段守则、高估时更自然的动作是停杠杆与增现金。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2024-06-03` 与 `2024-05-16` 这两篇未并入本 topic，因为前者更偏宏观利率与债务判断，后者更偏价格补贴消失与个体阶层问题，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 651-710

- 从 `wechat_history_links.txt` 的 `651-710` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2024-02-19`、`2024-03-12`、`2024-03-23`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：投资要求自驱找方向、市场不会为你的牌面量身打造机会、投资先算败先找安全垫、散户与职业投资人的时机并不相同。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2024-04-08` 与 `2024-02-24` 这两篇未并入本 topic，因为前者更偏长期传承与稳定性，后者更偏社会角色与对外信号管理，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 711-770

- 从 `wechat_history_links.txt` 的 `711-770` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 1 篇文章：`2024-02-01`。
- 新增 1 篇原始资料归档，并新建 1 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回 `风控规则`：金融工具要先看原始用途；若本来只是给某套交易结构配平时间与利息风险的对冲工具，就不能脱离原组合被拿来当主盈利模式。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2024-01-12`、`2024-01-13`、`2024-01-19` 这几篇本轮未并入本 topic：前者更像长文入口页，后两者与当前投资系统主线的贴合度不够紧。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 771-830

- 从 `wechat_history_links.txt` 的 `771-830` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 4 篇文章：`2023-10-04`、`2023-10-17`、`2023-11-29`、`2023-12-01`。
- 新增 4 篇原始资料归档，并分别新建 4 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：商品先看真正的定价层与价差来源、收益目标要服从策略容量、成熟系统重在别把赚到的钱输回去、还要把平账赖账和规则外干预纳入退出预案。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2023-10-22` 与 `2023-11-16` 这两篇本轮未并入本 topic：前者更偏一般性的实践训练与信息差打破，后者更偏宏观转折判断，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 831-890

- 从 `wechat_history_links.txt` 的 `831-890` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2023-08-07`、`2023-10-01`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：学习大玩家前先识别其隐藏生态位与退出要求、账面盈利之前先确认资金能否按规则真实提取。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2023-09-29`、`2023-08-30`、`2023-08-29` 这几篇本轮未并入本 topic：前者更偏消费品品牌溢价，后两者分别更偏地产产品设计与事件表达策略，不够紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 891-950

- 从 `wechat_history_links.txt` 的 `891-950` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2023-05-31`、`2023-06-10`、`2023-07-13`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：不要跳到自己还不会操盘的规模、长期重复选择应优先看数学期望、系统应追求“每一次”而不是“某一次”的漂亮结果。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2023-07-23` 这篇本轮未并入本 topic：更偏房地产资产配置边界，和当前投资系统主线的贴合度不如本轮纳入的三篇。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 951-1010

- 从 `wechat_history_links.txt` 的 `951-1010` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2023-05-02`、`2023-05-17`、`2023-05-28`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：依赖接盘预期的资产必须在买入前先想清楚退出、预期型资产先看共识与供需、降低持仓成本本身就是扩大安全气囊。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2023-05-08` 这篇本轮未并入本 topic：更偏财富路径与地域分布讨论，和当前投资系统主线的贴合度不如本轮纳入的三篇。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1011-1070

- 从 `wechat_history_links.txt` 的 `1011-1070` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2023-02-14`、`2023-02-23`、`2023-03-17`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：房产价值判断要同时看中心、择邻与可卖性、投资分析先看市场规模与买方承接力、全职投资还要预设家庭财务边界与最坏情形。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2023-02-20` 这篇本轮未并入本 topic：更偏婚姻财务治理与共同决策责任，和当前投资系统主线的贴合度不如本轮纳入的三篇。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1071-1130

- 从 `wechat_history_links.txt` 的 `1071-1130` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2022-12-11`、`2023-01-15`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：能对冲锁利润时就不该默认押方向、没有真实买方与真实路径的建议没有执行价值。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2023-01-08` 与 `2023-01-05` 这两篇本轮未并入本 topic：前者更偏一般人生决策与自我选择，后者更偏商业观察，不如本轮纳入的两篇贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1131-1190

- 从 `wechat_history_links.txt` 的 `1131-1190` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2022-09-14`、`2022-10-16`、`2022-10-31`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：优势来自不确定性中的确定性、同一理论机会对不同体量的人未必是同一套系统、市场结构本身也属于风控边界。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2022-10-23` 这篇本轮未并入本 topic：更偏买房观念与消费态度变化，不如本轮纳入的三篇紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1191-1250

- 从 `wechat_history_links.txt` 的 `1191-1250` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2022-07-01`、`2022-07-13`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：系统要按样本总集与时间曲线看问题、金融机构风险也要穿透看盘子大小与资产集中度。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2022-07-15`、`2022-08-13`、`2022-08-23` 这几篇本轮未并入本 topic：前者更偏现实处置与利益分配，后两篇更偏财富观与阅历判断，不如本轮纳入的两篇紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1251-1310

- 从 `wechat_history_links.txt` 的 `1251-1310` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2022-05-07`、`2022-05-15`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：同一建议只对具备对应条件的人成立、能锁利润时不该额外承担时间风险。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2022-06-01`、`2022-05-05`、`2022-06-21` 这几篇本轮未并入本 topic：前者本次抓到的正文不足以支撑稳定提炼，后两者分别更偏股民生态/流量观察与消费观念变化，不如本轮纳入的两篇紧贴当前投资系统主线。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 1311-1370

- 从 `wechat_history_links.txt` 的 `1311-1370` 条中，纳入与 `probabilistic-decision-and-risk-control` 明确相关的 1 篇文章：`2022-03-20`。
- 新增 1 篇原始资料归档，并新建 1 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续把新判断并回正式章节：低利率长久期负债只有在确实存在更高收益资金去处时才成立。
- 同步更新 `people/碧树西风.md`、`index.md` 与 `log.md`。
- `2022-03-22`、`2022-02-16`、`2022-02-11` 这几篇本轮未并入本 topic：前者更偏住房身份与意义投射，后两者本次抓到的正文还不足以支撑稳定提炼，不如本轮纳入的这一篇紧贴当前投资系统主线。

## [2026-04-22] ingest | xueqiu daily summaries for bingbing xiaomei and mai gupiao de laomujiang

- 归档了 `2026-04-22` 的两份雪球日汇总到 `raw/transcripts/`：`冰冰小美` 与 `买股票的老木匠`，并同步保存对应 `state.json`。
- 为 `冰冰小美` 新增 1 条观点页：`views/冰冰小美：人工智能行情由全球产业线索与抱团流动性共同推动.md`，将其当天关于 AI 行情、关键材料路径与抱团流动性的判断并回 `people/冰冰小美.md` 与 `topics/宏观经济.md`。
- 为 `买股票的老木匠` 正式建立人物页 `people/买股票的老木匠.md`，并新增 1 条观点页：`views/买股票的老木匠：内地股市短期上涨主要由消息、题材和资金驱动.md`，挂接到 `topics/概率化决策与风险控制.md`。
- 同步更新 `index.md` 与 `log.md`，让这次 ingest 进入正式知识层并可从索引直接访问。

## [2026-04-22] ingest | backfill mai gupiao de laomujiang person line from existing transcripts

- 从已归档的 `2026-04-06`、`2026-04-09`、`2026-04-10`、`2026-04-17` 四份 `raw/transcripts/` 中，补齐 `买股票的老木匠` 的正式人物学习线。
- 新增 4 条观点页，分别沉淀“高不确定环境下先降风险不先赌预测”“低买高卖的前提是安全标的”“投资结果更取决于赔率与位置”“炒概念可以但别拿基本面为错价硬找借口”。
- 在 `people/买股票的老木匠.md` 中把人物画像从单点判断补成连续主线：风险暴露管理、安全边际、赔率位置、低买高卖和认知诚实。
- 在 `topics/概率化决策与风险控制.md` 中将这组新判断并回“底层决策逻辑”“适用市场”“收益来源与系统本质”等区块。
- 同步更新 `index.md` 与 `log.md`，让老木匠这条线从单篇观点扩展成可持续追踪的人物学习线。

## [2026-04-22] query | why bingbing xiaomei is hard to read and what to learn first

- 基于 `people/冰冰小美.md`、`topics/宏观经济.md` 与两个相关概念页，回答了“为什么看不懂冰冰小美的文章，以及需要先补什么知识”。
- 新增 `queries/why-bingbing-xiaomei-is-hard-to-read-and-what-to-learn-first.md`，将答案整理为可复用问答。
- 在答案中把阅读障碍拆成四层：宏观价格信号、市场结构、政策框架、全球产业映射，并给出最短阅读顺序。
- 同步更新 `index.md` 与 `log.md`，让这条问答可以从知识库索引直接访问。

## [2026-04-22] query | bingbing xiaomei reading map from entry to advanced

- 基于上一条“为什么难懂”的问答，继续整理出一条可执行的 `冰冰小美` 阅读地图。
- 新增 `queries/bingbing-xiaomei-reading-map-from-entry-to-advanced.md`，把阅读顺序拆成“入门 / 进阶 / 跳读顺序”三层。
- 在这条问答里明确了每一层先读哪些页面、每一步的目标是什么，以及以后读她的新文章时应该先抓哪几个问题。
- 同步更新 `index.md` 与 `log.md`，让这条阅读地图可以直接从知识库索引进入。

## [2026-04-22] lint | merge bingbing xiaomei queries into one canonical entry

- 将两条围绕 `冰冰小美` 的问答合并为一条规范入口，避免 `queries/` 中出现平行重复页面。
- 把“为什么难懂”“需要先补什么知识”“从入门到进阶怎么读”统一并回 `queries/why-bingbing-xiaomei-is-hard-to-read-and-what-to-learn-first.md`。
- 删除 `queries/bingbing-xiaomei-reading-map-from-entry-to-advanced.md`，并在 `index.md` 中只保留一个问答入口。
- 同步将页面总数从 `94` 调整回 `93`。

## [2026-04-22] ingest | xueqiu compilation 380960384 and linked bingbing xiaomei posts

- 归档了 `岜菲特` 于 `2026-03-25` 发布的雪球合集页到 `raw/articles/2026-03-25-2026年1月宏观复盘：风险判断与仓位控制.md`，保留了 41 条子帖链接清单。
- 顺着母页链接成功抓取并整理了 `冰冰小美` 在 `2026-01-04` 到 `2026-01-15` 的 18 篇原文到 `raw/articles/2026-03-25-冰冰小美-2026一季度宏观子帖抓取（已完成41篇）.md`。
- 另外记录了 23 篇未补齐链接到 `raw/articles/2026-03-25-冰冰小美-2026一季度宏观子帖补抓记录.md`；这些链接不是失效，而是在本轮批量访问中触发了雪球滑块验证。
- 新增 `summaries/冰冰小美2026一季度宏观阶段时间线.md`，把这批材料压成五阶段复盘，补出了她把“地缘重估、汇率与流动性切换、资源与货币秩序重排”翻译成仓位动作的连续主线。
- 同步更新 `people/冰冰小美.md`、`topics/宏观经济.md` 与 `index.md`，把这次 ingest 接入现有的人物学习线和宏观主题页。

## [2026-04-23] ingest | backfill remaining 23 linked xueqiu posts after slider verification

- 在用户完成雪球滑块验证后，补抓了合集页 `380960384` 中剩余的 23 篇 `冰冰小美` 子帖，现已把整批原文扩展到 `41/41` 完整状态。
- 将 `raw/articles/2026-03-25-冰冰小美-2026一季度宏观子帖抓取（已完成41篇）.md` 从首轮的 18 篇更新为完整 41 篇版本，并同步把母页清单改为全部已抓取。
- 将 `raw/articles/2026-03-25-冰冰小美-2026一季度宏观子帖补抓记录.md` 改写为一次风控与补抓过程记录，不再保留未完成项。
- 更新 `summaries/冰冰小美2026一季度宏观阶段时间线.md`，把阶段三到阶段五从“主要依赖母页摘要”补成“已结合补抓原文核对”的版本。
- 同步把 `index.md` 的最近更新时间推进到 `2026-04-23`。

## [2026-04-23] ingest | bingbing xiaomei q1 views and geopolitical topic

- 基于已补齐的 `冰冰小美 2026Q1` 雪球 `41` 篇子帖，继续把阶段归纳下沉到正式知识层。
- 新建 3 条观点页，分别沉淀“治理红线改写危机脚本”“黄金与美债平价对应货币秩序竞争”“指数恐慌与真实产业强弱需拆开判断”。
- 新建 `topics/地缘重估与资源-货币秩序.md`，把地缘重估、资源争夺、避险资产和货币形态竞争收束为独立长期主题。
- 更新 `people/冰冰小美.md` 与 `topics/宏观经济.md`，补入这批新观点与新 topic 的回链。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-23] ingest | xueqiu daily summaries for bingbing xiaomei and mai gupiao de laomujiang

- 归档了 `2026-04-23` 的两份雪球日汇总到 `raw/transcripts/`：`冰冰小美` 与 `买股票的老木匠`，并同步保存对应 `state.json`。
- 为 `冰冰小美` 新增 1 条观点页：`views/冰冰小美：人工智能全球协同会优先重估产业链位置而非短期业绩.md`，将她当天关于 AI 全球协同、政策支撑、外资参与和产业链卡位的判断并回 `people/冰冰小美.md` 与 `topics/宏观经济.md`。
- 为 `买股票的老木匠` 新增 1 条观点页：`views/买股票的老木匠：技术浪潮里的结构牛市不等于你必须风格漂移.md`，把“技术浪潮里的结构牛市不等于你必须风格漂移”并回 `people/买股票的老木匠.md` 与 `topics/概率化决策与风险控制.md`。
- 同步更新 `index.md` 与 `log.md`，让这次 ingest 进入正式知识层并可从索引直接访问。

## [2026-04-25] ingest | discarded user note about private enterprises and fiscal purchase of services

- 收到一段关于“民企、财政购买服务与对体制保持恭敬”的用户笔记，并按 `obsidian-kb` 启动流程读取了 `SCHEMA.md`、`index.md` 与最近日志后进行准入判断。
- 该材料主要讨论组织关系、体制激励与言论边界，不属于当前知识库定义的“宏观经济 / 投资策略”领域，也不明确服务于现有知识理解线或人物学习线。
- 结论：`discarded / out of domain`。
- 未写入 `raw/`，未创建或更新 `people/`、`concepts/`、`topics/`、`views/`、`summaries/`、`comparisons/`、`queries/`、`outputs/`。

## [2026-04-25] ingest | bingbing xiaomei on long china via etf before alpha

- 归档了 `冰冰小美` 于 `2026-04-24 20:05` 发布的雪球原帖到 `raw/articles/2026-04-24-投资会改变一个人的生活轨迹.md`，保留了标题、来源、时间、内容 ID 与去噪后的正文。
- 新增观点页 `views/冰冰小美：做多中国先用指数基金承接主线，再在陌生走势里学习超额收益.md`，把这条材料压成“做多中国先用 ETF 承接主线，再在陌生走势里学习超额收益”的可复用判断。
- 更新 `people/冰冰小美.md`，补入这篇原始资料、对应 view，以及她在陌生市场里先承认理解边界、优先选择低摩擦表达的执行特征。
- 更新 `topics/宏观经济.md`，把这条材料并入“宏观判断最终如何落实到仓位表达与超额收益边界”的框架。
- 同步更新 `index.md` 与 `log.md`，让这次 ingest 可从索引直接访问。

## [2026-04-25] ingest | default daily directory update for mai gupiao de laomujiang

- 按 `AGENTS.md` 的默认更新规则，读取了 `/Users/cjw/dev/Obsidian/cjw-xueqiu-daily-monitor/20260425/` 作为当天目录来源。
- 归档了 `买股票的老木匠` 于 `2026-04-25 09:16` 发布的雪球原帖到 `raw/articles/2026-04-25-2015年为了救市，成立了证金公司。该公司是由各个券商筹集资本金发起，并且向央行和商业银行贷款，所获资金用于购买当年下跌的股票.md`。
- 新增观点页 `views/买股票的老木匠：2015救市资管计划退场会形成任务型卖压.md`，把“2015 救市资管计划进入退出尾声，会形成任务型卖压”沉淀到正式知识层。
- 更新 `people/买股票的老木匠.md` 与 `topics/概率化决策与风险控制.md`，补入这条关于非基本面供给与风险识别的回链。
- 同步更新 `index.md` 与 `log.md`。
- `冰冰小美` 当天目录里只有 `processing/extracted_posts.json`，且内容发布时间为 `2026-04-19`，不符合本次“当天默认更新”的稳定入库条件，因此本轮未写入。

## [2026-04-25] ingest | default daily directory update for bingbing xiaomei on 20260424

- 按 `AGENTS.md` 的相对日期规则，将“昨天”解析为 `/Users/cjw/dev/Obsidian/cjw-xueqiu-daily-monitor/20260424/`。
- 归档了 `冰冰小美` 的日汇总到 `raw/transcripts/2026-04-24-冰冰小美-雪球-汇总.md`。
- 新增观点页 `views/冰冰小美：人工智能重估正从图形处理器扩展到系统级与国家级竞争.md`，把 2026-04-24 的 AI 判断压成“从 GPU 扩展到系统级与国家级竞争”的可复用结论。
- 更新 `people/冰冰小美.md` 与 `topics/宏观经济.md`，补入这条关于系统级 AI 重估、旧半导体重估和美元定价跟随的回链。
- `2026-04-24 20:05` 的单帖 `385698828` 已在之前入库，因此本轮未重复创建。
- 同步更新 `index.md` 与 `log.md`。

## [2026-05-20] migrate | align legacy query and summary pages to new page types

- 按新的 `page-types.md` 将旧 `query` 页面迁移为 `topic` 页面：`queries/why-bingbing-xiaomei-is-hard-to-read-and-what-to-learn-first.md` -> `topics/冰冰小美阅读地图.md`。
- 按新的 `page-types.md` 将旧 `summary` 页面迁移为 `timeline` 页面：`summaries/冰冰小美2026一季度宏观阶段时间线.md` -> `timelines/冰冰小美2026一季度宏观阶段时间线.md`。
- 更新迁移后页面的 frontmatter、所有正式知识页反向引用，以及 `index.md` 中对应的主题与时间线入口。
- 从 `index.md` 移除空的旧类型分区：`归纳`、`对比`、`问答`、`输出成品`。
