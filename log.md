# 知识库日志

> 按时间顺序记录知识库操作。仅追加，不覆盖。
> 格式：`## [YYYY-MM-DD] action | subject`

## [2026-05-27] docs | split page templates into templates directory

- 新增 `templates/` 目录，并拆出 7 类正式知识页模板：Concept、People、Event、View、Timeline、Reasoning、Topic。
- 新增 `templates/README.md`，作为模板索引和使用规则入口。
- 更新 `page-types.md`，将内嵌页面结构替换为对应模板文件引用，让页面类型规范只保留类型语义、适用场景和选择规则。
- 更新 `schema.md` 与 `AGENTS.md`，把 `templates/` 纳入目录契约和新建页面 workflow。
- 未新增正式 `wiki/` 页面，`index.md` 无需更新。

## [2026-05-23] ingest | add bingbing xiaomei engineering machinery oil crisis reasoning

- 新增 `sources/manual/2026-05-23-冰冰小美-工程机械受石油危机与地产拖累的补充判断.md`，保存用户补充的短摘录，并用 `2026-05-23` 作为时间标记。
- 新增推导链页 `wiki/reasoning/冰冰小美-工程机械拐点取决于石油危机何时解除.md`，把“石油危机 -> 海外通胀 -> 海外基建下降 -> 燃油设备出海阻力 + 国内地产低迷拖累 -> 核心看石油危机解除”拆成正式 `reasoning` 页面。
- 更新 `wiki/views/冰冰小美对工程机械更适合低吸慢配，并等待财报与出口转型兑现的看法.md`，补入 `2026-05-23` 时间标记、新来源、新推导链接，以及石油危机与内外需拖累的补充说明。
- 更新 `wiki/people/冰冰小美.md`，把新推导页回链进人物页。
- 更新 `index.md`，登记新的推导链入口，并将页面总数从 `131` 调整为 `132`。
- 说明：这条石油危机判断目前来自用户摘录，原帖发布时间与原始链接待补充。

## [2026-05-23] ingest | add bingbing xiaomei engineering machinery view

- 基于 `sources/articles/2026-03-25-冰冰小美-2026一季度宏观子帖抓取（已完成41篇）.md` 中 `2026-01-08`、`2026-01-19`、`2026-01-30` 三处工程机械相关原文，新增观点页 `wiki/views/冰冰小美对工程机械更适合低吸慢配，并等待财报与出口转型兑现的看法.md`。
- 新页面将工程机械整理为 `View Page`，重点沉淀“更适合低吸慢配”“短期受大宗成本压制”“真正要等财报、战略布局、转型与出口兑现”的可复用判断。
- 更新 `wiki/people/冰冰小美.md`，把这条行业观点补回人物页的 `related`、`代表性观点` 和 `相关页面`。
- 更新 `index.md`，登记新观点入口，并将页面总数从 `130` 调整为 `131`。
- 本次未新增 `sources/` 文件，因为相关原文已在 `2026Q1` 归档中。

## [2026-05-22] ingest | bingbing xiaomei on securities no longer being automatic bull-market flagbearers

- 归档用户提供的冰冰小美雪球原帖到 `sources/articles/2026-05-22-冰冰小美：牛市证券为何和以往不一样.md`，保留原文、链接和来源说明。
- 新增观点页 `wiki/views/冰冰小美对证券不再机械等同于牛市旗手的看法.md`，将“不要一句牛市涨券商”整理为证券板块角色、题材、资产质量、竞争格局和流动性周期变化的 View Page。
- 新增推导链页 `wiki/reasoning/冰冰小美-证券牛市逻辑变化推导.md`，拆解“牛市买券商”旧经验失效的前提、变量、推导链、风险触发条件和不确定性。
- 复用既有资产 `sources/assets/冰冰小美-证券牛市逻辑变化推导.svg`，在推导链页中按 SVG 嵌入规则接入。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/概率化决策与风险控制.md`，把该观点接回人物学习线、宏观市场结构和买入前风险检查。
- 同步更新 `index.md`，页面总数从 `125` 调整为 `127`。
- 说明：原帖发布时间、924行情细节、美元稳定币监管表述、万科亏损金额、外资金融准入比例和券商地产债敞口均标注为待验证，不写成已确认事实。

## [2026-05-21] refactor | normalize view filenames to subject-topic pattern

- 将 `wiki/views/` 下 101 个观点页从 `作者-主题.md` 统一重命名为 `人物名对主题的看法.md`。
- 同步更新正式 wiki 页面与 `index.md` 中指向这些观点页的 Obsidian 双链目标与显示名。
- 同步更新每个观点页的 frontmatter `title`、一级标题与 `updated` 日期，保持文件名、页面标题和索引显示一致。
- 检查结果：未发现无法按本规则命名的 view 文件；未发现重命名冲突；未发现旧 `views/作者-主题` 路径残留或缺失的 view 链接目标。

## [2026-05-21] docs | align schema with current wiki structure

- 重写 `schema.md`，修复原文件乱码，并将目录契约、页面类型、frontmatter、命名、双链、索引与日志约束同步到当前知识库结构。
- 明确当前正式知识层只使用 `concept`、`person`、`event`、`view`、`timeline`、`reasoning`、`topic` 七类页面。
- 标注 `wiki/queries/` 与 `wiki/summaries/` 为历史迁移遗留目录，不再作为新内容写入目标。
- 对齐当前 `sources/` 已使用目录：`articles/`、`assets/`、`manual/`、`screenshots/`、`transcripts/`。
- 未新增正式知识页，`index.md` 无需调整。

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

- 将 `wiki/reasoning/冰冰小美-人工智能与国家中美两强推导链.md` 中的 SVG Markdown 图片嵌入改为 HTML `<img>` 格式。
- 保持 `width: 90vw; max-width: none; height: auto;`，与 `wiki/reasoning/冰冰小美-风险转弱节点如何形成买入窗口.md` 中的 SVG 嵌入格式一致。
- 未新增正式知识页，`index.md` 无需调整。

## [2026-05-21] refactor | normalize wikilink display text across vault

- 遍历全库 Markdown 文件，将裸路径双链 `[[页面路径]]` 批量修正为 `[[页面路径|显示名称]]`。
- 显示名称优先取目标页 frontmatter `title`，其次取一级标题，最后回退到文件名。
- 跳过代码块和图片嵌入链接，避免破坏示例代码与媒体引用。
- 追加修正 Windows 路径归一化导致的显示名未命中问题，并将旧式 view 路径重定向到实际存在的页面路径。
- 修复批量写入中一个临时清空的观点页 `wiki/views/碧树西风-周期用来理解市场，不直接创造利润.md`，并按同一链接格式恢复内容。
- 未新增正式知识页，`index.md` 无需调整。

## [2026-05-21] refactor | standardize wikilink display names

- 在 `AGENTS.md` 的双链规则中补充 `[[页面路径|显示名称]]` 链接格式要求。
- 将 `wiki/reasoning/冰冰小美-风险转弱节点如何形成买入窗口.md` 中的裸路径链接改为带显示名称的 Obsidian 链接，并在相关列表中补充“为什么相关”的说明。
- 未新增正式知识页，`index.md` 无需调整。

## [2026-05-21] refactor | regenerate risk weakening buy window reasoning page

- 按 `page-types.md` 与 `rules/reasoning-page-rules.md` 重新生成 `wiki/reasoning/冰冰小美-风险转弱节点如何形成买入窗口.md`。
- 新版补齐核心命题、背景事实、推导链表、Mermaid 推导图、SVG 推导图、时间节点、验证信号、风险触发条件、相关事件、相关时间线、相关人物与相关页面。
- 保留原有来源、Concept Page 双链和 `sources/assets/风险转弱逻辑.svg` 引用。
- 未新增正式页面，`index.md` 无需调整。

## [2026-05-21] ingest | bingbing xiaomei risk weakening node concept and reasoning

- 归档雪球文章 `289333959` 到 `sources/articles/2026-05-21-风险转弱的节点.md`，保留作者、链接、来源声明、风险提示和完整正文。
- 新增概念页 `wiki/concepts/冰冰小美-风险转弱节点框架.md`，将“风险转弱节点”整理为基本面风险、情绪面风险、流动性风险、估值风险四类风险与宏观/中观/微观/交易四层转弱条件组成的 Concept Page。
- 新增推导链页 `wiki/reasoning/冰冰小美-风险转弱节点如何形成买入窗口.md`，拆解四类风险缓和、三要素同步有利和买入窗口形成之间的因果链。
- 在推导链页嵌入 `sources/assets/风险转弱逻辑.svg`，作为风险转弱到买入窗口的图示化表达。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/概率化决策与风险控制.md` 与 `wiki/topics/宏观经济.md`，把该框架接回作者体系、交易前风险检查和宏观风险转弱逻辑。
- 同步更新 `index.md`，页面总数从 `120` 调整为 `122`。
- 说明：发布时间未由用户材料提供，已标注为“待验证”；“买入不败”按作者观点处理，不写成无风险事实。

## [2026-05-21] ingest | bingbing xiaomei on true long-term and bottom-line thinking

- 归档用户提供的冰冰小美短观点到 `sources/manual/2026-05-21-冰冰小美-真正中长期底线思维.md`。
- 新增观点页 `wiki/views/冰冰小美-真正的中长期需要底线思维.md`，将其整理为“真正的中长期从三年起步，并且要经受均值回归和底线思维检验”的 View Page。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/概率化决策与风险控制.md`，把该观点接回人物学习线、宏观执行边界和仓位风险控制主题。
- 同步更新 `index.md`，页面总数从 `119` 调整为 `120`。
- 说明：原文缺少发布时间和链接，已在原始资料与观点页中标注来源不完整。

## [2026-05-21] ingest | bingbing xiaomei on macro as risk and positioning tool

- 归档用户提供的冰冰小美短观点到 `sources/manual/2026-05-21-冰冰小美-宏观风险仓位.md`。
- 新增观点页 `wiki/views/冰冰小美-宏观用于理解风险和调整仓位.md`，将其整理为“宏观用于理解风险并调整仓位，而不是生成下单代码”的 View Page。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/概率化决策与风险控制.md`，把该观点接回人物学习线、宏观边界和仓位风险控制主题。
- 同步更新 `index.md`，页面总数从 `118` 调整为 `119`。
- 说明：原文缺少发布时间和链接，已在原始资料与观点页中标注来源不完整。

## [2026-05-21] link | embed AI and state SVG reasoning diagram

- 将 `sources/assets/冰冰小美人工智能与国家逻辑.svg` 嵌入 `wiki/reasoning/冰冰小美-人工智能与国家中美两强推导链.md` 的 `SVG 推导图` 小节。
- 未新增正式知识页，`index.md` 无需更新。

## [2026-05-21] ingest | bingbing xiaomei on AI and state-level G2 competition

- 归档用户提供的 `冰冰小美` 雪球文章《Ai与国家》到 `sources/articles/2026-05-17-冰冰小美：人工智能与国家.md`，保留正文与关键评论区摘录，并去除页面导航、热门话题、热股榜等网页噪音。
- 新增观点页 `wiki/views/冰冰小美-人工智能已成为国家级竞争门槛.md`，将其整理为“AI 已成为国家级竞争门槛”的 View Page。
- 新增推导链页 `wiki/reasoning/冰冰小美-人工智能与国家中美两强推导链.md`，拆解中美重新定位、亚太安全溢价、AI 投资泡沫延长、G2 门槛和通胀跟踪变量。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/冰冰小美-地缘重估与资源-货币秩序.md`，把新观点接回人物学习线、宏观主题和地缘资源主题。
- 同步更新 `index.md`，页面总数从 `116` 调整为 `118`。
- 说明：文中关于中美关系、三战风险、G2 格局、特朗普和亚太安全的内容均按作者观点或推测处理，未写成已验证事实。

## [2026-05-20] refactor | concept pages aligned to page-types

- 按 `page-types.md` 中 Concept Page 的定义，重构了 `wiki/concepts/` 下 5 个概念页的正文结构。
- 统一补齐 `定义`、`背景`、`核心观点`、`关键组成`、`使用场景`、`与其他概念的关系`、`常见误区`、`相关页面` 与 `来源` 小节。
- 保留既有 frontmatter、来源与核心判断，仅重排结构并补充必要的双链说明。
- 修改文件：`wiki/concepts/碧树西风-盈亏比、止损与兜底.md`、`wiki/concepts/碧树西风-信息不对称与信息高地.md`、`wiki/concepts/冰冰小美-汇率、长期利率与流动性.md`、`wiki/concepts/冰冰小美-债务、分配与增长约束.md`、`wiki/concepts/冰冰小美-政策对冲与内部定价权.md`。
- 未新增页面；`index.md` 已覆盖这些概念页，本轮未改索引。

## [2026-05-20] refactor | add mermaid reasoning diagrams

- 为 `wiki/reasoning/冰冰小美-5月14日风险节点推导.md` 补充 `## Mermaid 推导图` 小节，把 AI/半导体拥挤、资本开支兑现、美联储验证、中美科技外交和情绪流动性负反馈串成图示。
- 为 `wiki/reasoning/冰冰小美-有色金属拐点推导.md` 补充 `## Mermaid 推导图` 小节，把石油危机、通胀预期、降息预期、缩表、美元信用、黄金与有色见底逻辑串成图示。
- 未新增正式知识页，因此未更新 `index.md`。

## [2026-05-20] ingest | bingbing xiaomei nonferrous turning point flowchart

- 归档用户提供的“有色拐点逻辑推导流程图”到 `sources/screenshots/2026-05-20-有色拐点逻辑推导流程图.png`，并新增转写页 `sources/screenshots/2026-05-20-有色拐点逻辑推导流程图.md`。
- 新增观点页 `wiki/views/冰冰小美-有色拐点取决于通胀预期何时下降.md`，将有色拐点整理为“通胀预期下降后，降息预期升温才更可能形成见底逻辑”。
- 新增推导链页 `wiki/reasoning/冰冰小美-有色金属拐点推导.md`，拆解石油危机与通胀约束、美联储缩表动机、黄金与有色传导、真正拐点触发条件。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/冰冰小美-地缘重估与资源-货币秩序.md`，把这条推导接回人物学习线、宏观经济和资源-货币秩序主题。
- 同步更新 `index.md`。
- 说明：原图缺少原帖链接与发布时间，`6/16`、沃什理念、美联储政策路径和资产表现均保留“待验证 / 不确定性”标注。

## [2026-05-20] ingest | bingbing xiaomei 5/14 risk node reasoning flowchart

- 归档用户提供的 `冰冰小美推导英特尔5.14风险节点.png` 到 `sources/screenshots/2026-05-20-冰冰小美-5-14-风险节点推导.png`，并新增转写页 `sources/screenshots/2026-05-20-冰冰小美-5-14-风险节点推导.md`。
- 新增推导链页 `wiki/reasoning/冰冰小美-5月14日风险节点推导.md`，把 `5/14` 拆成 AI/半导体拥挤交易、资本开支融资现实、美联储通胀利率验证、中美科技外交结果和流动性情绪共振。
- 更新既有观点页 `wiki/views/冰冰小美-短期技术扰动之后，风险节奏仍锚定美国通胀拐点.md`，补入“5/14 是密集验证窗口而非精准崩盘日”的图示推导。
- 更新 `wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 与 `wiki/topics/概率化决策与风险控制.md`，将新推导接入人物学习线、宏观主题和风险控制主题。
- 同步更新 `index.md`。
- 说明：原图缺少原帖链接与发布时间，`CPI/PPI`、联储表态、H200 对华销售 / 交付预期和中美会晤预期等事件细节均需后续验证。

## [2026-05-18] ingest | bingbing xiaomei on competitive advantage in market structure

- 归档了用户提供的 `冰冰小美` 雪球原帖 `291511412` 到 `raw/articles/2026-05-18-冰冰小美：竞争格局的比较优势.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/冰冰小美-竞争格局的比较优势来自安全与发展的再平衡.md`，把“竞争格局的比较优势”整理为“安全与发展、效率与公平、全球产业竞争和金融制度重估共同决定相对位置”的判断。
- 更新 `people/冰冰小美.md`，补全“体系 / 交易体系三要素”中的“竞争格局的比较优势”，至此三要素均已挂接正式观点页。
- 更新 `topics/宏观经济.md`、`topics/冰冰小美-地缘重估与资源-货币秩序.md` 与 `topics/概率化决策与风险控制.md`，分别接入经济结构转型、供应链与地缘竞争、选股交易系统三条证据链。
- 同步更新 `index.md`。

## [2026-05-18] ingest | bingbing xiaomei on emotion position shifts

- 归档了用户提供的 `冰冰小美` 雪球原帖 `291538494` 到 `raw/articles/2026-05-18-冰冰小美：情绪位置的变化.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/冰冰小美-情绪合力取决于所处位置.md`，把“情绪位置的变化”整理为“情绪合力取决于市场所处位置、亏钱效应、制度变化和参与者结构”的判断。
- 更新 `people/冰冰小美.md`，补全“体系 / 交易体系三要素”中的“情绪位置的变化”，并回写她对传统短线情绪模型失效的观察。
- 更新 `topics/概率化决策与风险控制.md`，把该材料并入交易系统需要随市场状态、制度和参与者结构变化而校准的证据链。
- 同步更新 `index.md`。

## [2026-05-18] ingest | bingbing xiaomei on dialectical liquidity analysis

- 归档了用户提供的 `冰冰小美` 雪球原帖 `291532021` 到 `raw/articles/2026-05-18-冰冰小美：流动性辩证分析.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/冰冰小美-流动性有利不等于成交量放大.md`，把“流动性辩证分析”整理为“成交量不是唯一指标，要同时看股票供给侧改革、ETF 权重支撑、政策约束和资金迁移方向”的判断。
- 更新 `people/冰冰小美.md`，补入她把成交量、ETF/国家队支撑、指数权重、政策约束和核心资产迁移放在同一张图里的思维特征。
- 更新 `topics/宏观经济.md` 与 `topics/概率化决策与风险控制.md`，分别接入 A 股内部流动性结构解释，以及交易系统需要随市场生态更新前提的约束。
- 同步更新 `index.md`。

## [2026-05-18] ingest | bingbing xiaomei on expectation gap as greed bait

- 归档了用户提供的 `冰冰小美` 雪球原帖 `244824585` 到 `raw/articles/2026-05-18-冰冰小美：常见的亏钱认知：预期差.md`；原帖发布时间暂未从页面中确认，因此以归档日标识并在正文保留“待补”。
- 新增观点页 `views/冰冰小美-预期差叙事容易诱发贪婪.md`，把“预期差”压成“容易诱发贪婪的画饼式市场叙事”这一可复用判断。
- 更新 `people/冰冰小美.md`，补入她对交易话术、贪婪诱发和纪律约束的思维特征。
- 更新 `topics/概率化决策与风险控制.md`，把该材料并入“执行偏差与常见误区”，并明确暂不新建“亏钱认知” topic，先作为该主题下的子线索沉淀。
- 同步更新 `index.md` 与 `log.md`。

## [2026-05-14] ingest | create topic for life and wealth worldview

- 新建 topic `topics/碧树西风-人生观与财富观.md`，用于承接“人生观与财富观”这条长期主线。
- 本页被判定为服务当前知识库的投资策略线与人物学习线：它把财富目标、收益质量、财富留存、真实承受力与投资系统目标函数连接起来，而不是作为泛泛的人生随笔入库。
- 初始回链到 `topics/概率化决策与风险控制.md`、`topics/宏观经济.md`、`topics/碧树西风-信息高地、上位者博弈与非标路径.md`、`concepts/碧树西风-盈亏比、止损与兜底.md`、`concepts/碧树西风-信息不对称与信息高地.md`，并引用已有相关 view 作为证据节点。
- 同步更新 `index.md`：将页面总数更新为 `108`，并在“主题”分区登记 `[[topics/碧树西风-人生观与财富观|人生观与财富观]]`。
- 继续补入用户提出的核心隐喻：财富观像一口缸，至少要满足“有进有出、量入为出、够用不焦虑”，才能逐步找到适合自己的容量，避免财富被收走、反噬或变成生活压力源。

## [2026-05-14] ingest | bingbing xiaomei on 5/14 technical disturbance and inflation risk node

- 归档用户提供的 `冰冰小美` 5/14 观点原文到 `raw/manual/2026-05-14-冰冰小美-宏观风险节点.md`。
- 新增观点页 `views/冰冰小美-短期技术扰动之后，风险节奏仍锚定美国通胀拐点.md`，将“5/14 魔咒”拆成联储换届、股指期货交割等短期技术扰动，以及美国通胀拐头这一更关键的风险节奏锚。
- 更新 `people/冰冰小美.md`，补入她面对市场时间节点时先拆技术扰动、再回到通胀、油价、货币政策与风险偏好传导链的思维特征。
- 更新 `topics/宏观经济.md`，把该材料接入通胀、利率预期、流动性与资产风险偏好的传导框架。
- 同步更新 `index.md`，让新增 view 进入正式知识索引。

## [2026-04-27] ingest | xueqiu daily summaries for bingbing xiaomei and mai gupiao de laomujiang

- 读取了 `/Users/cjw/dev/Obsidian/cjw-xueqiu-daily-monitor/20260427/` 下当天两位作者的雪球抓取结果与 `summary.md`。
- 归档了两份日汇总到 `raw/transcripts/`：`2026-04-27-冰冰小美-雪球-汇总.md` 与 `2026-04-27-买股票的老木匠-雪球-汇总.md`。
- 为 `冰冰小美` 新增观点页 `views/冰冰小美-人工智能产业链重估要同时看技术路线、产业位置与交易节点.md`，把她当天关于 AI 产业链、国产替代、智能汽车和交易节点的判断并回 `people/冰冰小美.md` 与 `topics/宏观经济.md`。
- 为 `买股票的老木匠` 新增观点页 `views/买股票的老木匠-救市资金退出是在恢复市场机制.md`，把他关于救市资金退出、市场机制恢复和卖压来源区分的判断并回 `people/买股票的老木匠.md` 与 `topics/概率化决策与风险控制.md`。
- 清理了 `index.md` 中既有的观点区 Git 冲突标记，保留更完整的索引分支，并同步登记本次新增的两条观点页。

## [2026-04-24] ingest | bi-shu-xi-feng way out system

- 将用户提供的《这辈子还能有出路么？》整理进正式知识层，并清洗出 1 篇 `raw/articles/` 归档，剔除文末付费文章目录与留言区。
- 新建 1 条 `view`，聚焦“出路来自按需求组织能力、把路走宽并守住现金流”这一条稳定主线。
- 更新 `people/碧树西风.md`、`topics/概率化决策与风险控制.md`、`topics/碧树西风-信息高地、上位者博弈与非标路径.md`、`index.md` 与 `log.md`，把这条新证据接回人物学习线与两个既有主题页。

## [2026-04-24] topic-split | quantitative trading

- 从 `topics/概率化决策与风险控制.md` 中抽离“量化思维、分布视角、可计算化表达、价格与反馈优先”这条方法论主线。
- 新建 `topics/碧树西风-量化交易.md`，作为知识库里的“量化交易”正式 topic 页，并明确它在本库中主要指量化方法论，而不是高频或自动化系统。
- 将 `views/bi-shu-xi-feng-quant-thinking-looks-at-distributions-not-single-points-2022-07-01.md` 与 `views/bi-shu-xi-feng-quantification-is-not-high-frequency-2026-04-05.md` 回挂到新 topic。
- 收窄 `topics/概率化决策与风险控制.md` 的页面职责，保留仓位、止损、退出、风控、复盘与执行主线。
- 同步更新 `index.md` 与 `log.md`。

## [2026-05-14] query | account segmentation for non-professional investors

- 基于 `topics/概率化决策与风险控制.md`、`views/碧树西风-普通投资者更需要区间判断，而不是职业级精度.md`、`views/碧树西风-融资市场里，小本金更需要低门槛系统.md`、`views/买股票的老木匠-投资回报更取决于赔率与位置，不取决于公司光环.md` 等页面，回答“股票账户、趋势 ETF 账户、长持账户”这种分仓方式是否适合工作党非专业投资者。
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
- 同步更新 `topics/概率化决策与风险控制.md`、`concepts/碧树西风-盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 101-150

- 从 `wechat_history_links.txt` 的 `101-150` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 3 篇文章：`2025-10-19`、`2025-10-25`、`2025-11-22`。
- 新增 3 篇原始资料归档，并分别新建 3 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中显式补入 3 条新规则：单位风险与单位成本核算、真实耐心约束、同口径比较与高质量收益优先。
- 同步更新 `concepts/碧树西风-盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 151-200

- 从 `wechat_history_links.txt` 的 `151-200` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 5 篇文章：`2025-09-09`、`2025-09-10`、`2025-09-11`、`2025-09-12`、`2025-09-13`。
- 新增 5 篇原始资料归档，并分别新建 5 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续显式补入新规则：固定模式优先于情绪持仓、策略与个人禀赋匹配、投资是生意、周期只负责理解而不直接负责盈利、拥挤共振会阶段性摧毁边际优势。
- 同步更新 `concepts/碧树西风-盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 201-250

- 从 `wechat_history_links.txt` 的 `201-250` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-07-04`、`2025-08-16`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续显式补入新规则：高确信不能替代退出与仓位约束，历史周期模板本身也有适用期。
- 同步更新 `concepts/碧树西风-盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

## [2026-04-18] ingest | probabilistic decision topic backfill from links 251-300

- 从 `wechat_history_links.txt` 的 `251-300` 条中，仅纳入与 `probabilistic-decision-and-risk-control` 明确相关的 2 篇文章：`2025-05-27`、`2025-06-17`。
- 新增 2 篇原始资料归档，并分别新建 2 条观点页。
- 在 `topics/概率化决策与风险控制.md` 中继续显式补入新规则：仓位上限先匹配承受力，保本承诺先审计底层资产、偿付来源与对手盘机制。
- 同步更新 `concepts/碧树西风-盈亏比、止损与兜底.md`、`people/碧树西风.md` 与 `index.md`。

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
- 为 `冰冰小美` 新增 1 条观点页：`views/冰冰小美-人工智能行情由全球产业线索与抱团流动性共同推动.md`，将其当天关于 AI 行情、关键材料路径与抱团流动性的判断并回 `people/冰冰小美.md` 与 `topics/宏观经济.md`。
- 为 `买股票的老木匠` 正式建立人物页 `people/买股票的老木匠.md`，并新增 1 条观点页：`views/买股票的老木匠-内地股市短期上涨主要由消息、题材和资金驱动.md`，挂接到 `topics/概率化决策与风险控制.md`。
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
- 新建 `topics/冰冰小美-地缘重估与资源-货币秩序.md`，把地缘重估、资源争夺、避险资产和货币形态竞争收束为独立长期主题。
- 更新 `people/冰冰小美.md` 与 `topics/宏观经济.md`，补入这批新观点与新 topic 的回链。
- 同步更新 `index.md` 与 `log.md`。

## [2026-04-23] ingest | xueqiu daily summaries for bingbing xiaomei and mai gupiao de laomujiang

- 归档了 `2026-04-23` 的两份雪球日汇总到 `raw/transcripts/`：`冰冰小美` 与 `买股票的老木匠`，并同步保存对应 `state.json`。
- 为 `冰冰小美` 新增 1 条观点页：`views/冰冰小美-人工智能全球协同会优先重估产业链位置而非短期业绩.md`，将她当天关于 AI 全球协同、政策支撑、外资参与和产业链卡位的判断并回 `people/冰冰小美.md` 与 `topics/宏观经济.md`。
- 为 `买股票的老木匠` 新增 1 条观点页：`views/买股票的老木匠-技术浪潮里的结构牛市不等于你必须风格漂移.md`，把“技术浪潮里的结构牛市不等于你必须风格漂移”并回 `people/买股票的老木匠.md` 与 `topics/概率化决策与风险控制.md`。
- 同步更新 `index.md` 与 `log.md`，让这次 ingest 进入正式知识层并可从索引直接访问。

## [2026-04-25] ingest | discarded user note about private enterprises and fiscal purchase of services

- 收到一段关于“民企、财政购买服务与对体制保持恭敬”的用户笔记，并按 `obsidian-kb` 启动流程读取了 `SCHEMA.md`、`index.md` 与最近日志后进行准入判断。
- 该材料主要讨论组织关系、体制激励与言论边界，不属于当前知识库定义的“宏观经济 / 投资策略”领域，也不明确服务于现有知识理解线或人物学习线。
- 结论：`discarded / out of domain`。
- 未写入 `raw/`，未创建或更新 `people/`、`concepts/`、`topics/`、`views/`、`summaries/`、`comparisons/`、`queries/`、`outputs/`。

## [2026-04-25] ingest | bingbing xiaomei on long china via etf before alpha

- 归档了 `冰冰小美` 于 `2026-04-24 20:05` 发布的雪球原帖到 `raw/articles/2026-04-24-投资会改变一个人的生活轨迹.md`，保留了标题、来源、时间、内容 ID 与去噪后的正文。
- 新增观点页 `views/冰冰小美-做多中国先用指数基金承接主线，再在陌生走势里学习超额收益.md`，把这条材料压成“做多中国先用 ETF 承接主线，再在陌生走势里学习超额收益”的可复用判断。
- 更新 `people/冰冰小美.md`，补入这篇原始资料、对应 view，以及她在陌生市场里先承认理解边界、优先选择低摩擦表达的执行特征。
- 更新 `topics/宏观经济.md`，把这条材料并入“宏观判断最终如何落实到仓位表达与超额收益边界”的框架。
- 同步更新 `index.md` 与 `log.md`，让这次 ingest 可从索引直接访问。

## [2026-04-25] ingest | default daily directory update for mai gupiao de laomujiang

- 按 `AGENTS.md` 的默认更新规则，读取了 `/Users/cjw/dev/Obsidian/cjw-xueqiu-daily-monitor/20260425/` 作为当天目录来源。
- 归档了 `买股票的老木匠` 于 `2026-04-25 09:16` 发布的雪球原帖到 `raw/articles/2026-04-25-2015年为了救市，成立了证金公司。该公司是由各个券商筹集资本金发起，并且向央行和商业银行贷款，所获资金用于购买当年下跌的股票.md`。
- 新增观点页 `views/买股票的老木匠-2015救市资管计划退场会形成任务型卖压.md`，把“2015 救市资管计划进入退出尾声，会形成任务型卖压”沉淀到正式知识层。
- 更新 `people/买股票的老木匠.md` 与 `topics/概率化决策与风险控制.md`，补入这条关于非基本面供给与风险识别的回链。
- 同步更新 `index.md` 与 `log.md`。
- `冰冰小美` 当天目录里只有 `processing/extracted_posts.json`，且内容发布时间为 `2026-04-19`，不符合本次“当天默认更新”的稳定入库条件，因此本轮未写入。

## [2026-04-25] ingest | default daily directory update for bingbing xiaomei on 20260424

- 按 `AGENTS.md` 的相对日期规则，将“昨天”解析为 `/Users/cjw/dev/Obsidian/cjw-xueqiu-daily-monitor/20260424/`。
- 归档了 `冰冰小美` 的日汇总到 `raw/transcripts/2026-04-24-冰冰小美-雪球-汇总.md`。
- 新增观点页 `views/冰冰小美-人工智能重估正从图形处理器扩展到系统级与国家级竞争.md`，把 2026-04-24 的 AI 判断压成“从 GPU 扩展到系统级与国家级竞争”的可复用结论。
- 更新 `people/冰冰小美.md` 与 `topics/宏观经济.md`，补入这条关于系统级 AI 重估、旧半导体重估和美元定价跟随的回链。
- `2026-04-24 20:05` 的单帖 `385698828` 已在之前入库，因此本轮未重复创建。
- 同步更新 `index.md` 与 `log.md`。

## [2026-05-20] migrate | align legacy query and summary pages to new page types

- 按新的 `page-types.md` 将旧 `query` 页面迁移为 `topic` 页面：`queries/why-bingbing-xiaomei-is-hard-to-read-and-what-to-learn-first.md` -> `topics/冰冰小美-阅读地图.md`。
- 按新的 `page-types.md` 将旧 `summary` 页面迁移为 `timeline` 页面：`summaries/冰冰小美2026一季度宏观阶段时间线.md` -> `timelines/冰冰小美-2026一季度宏观阶段时间线.md`。
- 更新迁移后页面的 frontmatter、所有正式知识页反向引用，以及 `index.md` 中对应的主题与时间线入口。
- 从 `index.md` 移除空的旧类型分区：`归纳`、`对比`、`问答`、`输出成品`。

## [2026-05-21] skill | add bingbing xiaomei buy check skill

- 新增 `.agents/skills/bingbing-xiaomei-buy-check/SKILL.md`，将“冰冰小美三要素买入判断”整理为可触发 skill。
- 新增 `.agents/skills/bingbing-xiaomei-buy-check/agents/openai.yaml`，补充 UI 展示名称、短描述和默认调用提示。
- Skill 明确了基本面 / 产业链、流动性 / 情绪、交易窗口 / 风险节点三要素检查，以及否决项、仓位建议和最终结论输出格式。
- 已通过 `quick_validate.py` 校验。

## [2026-05-21] skill | rename bingbing xiaomei buy check skill

- 将 skill 目录从 `.agents/skills/bingbing-xiaomei-buy-check/` 重命名为 `.agents/skills/bbxm-buy-check/`。
- 将 `SKILL.md` frontmatter 的 `name` 更新为 `bbxm-buy-check`，并同步更新 `agents/openai.yaml` 的默认调用提示。

## [2026-05-21] refactor | prefix author names in wiki filenames

- 将作者来源明确的正式知识页统一为 `作者-主题.md` 命名。
- 将原有 `作者：主题.md` 调整为 `作者-主题.md`，并为缺少作者前缀的冰冰小美、碧树西风、买股票的老木匠观点页、推导页、概念页和作者专属主题页补充作者名前缀。
- 同步更新全库 Obsidian 双链、索引、日志路径记录和工作区路径引用。
- 保留 `people/` 人物主体页原名；保留 `宏观经济`、`概率化决策与风险控制` 这类多作者公共主题页原名。
- 本次为重命名整理，未新增正式知识页，`index.md` 页面总数无需调整。

## [2026-05-21] refactor | normalize view page titles after author prefix rename

- 补齐 `wiki/views/` 页面内部标题规范，将 frontmatter `title` 与一级标题同步为 `作者-主题` 格式。
- 同步修正指向 views 页面的 Obsidian 链接显示名，避免文件名已改为 `作者-主题.md` 但页面显示仍停留在 `作者：主题`。
- 本次只做 views 页面命名一致性整理，未新增正式知识页。

## [2026-05-21] refactor | split probability decision and risk control topic

- 将 `wiki/topics/概率化决策与风险控制.md` 从长篇内容页改为轻量 hub，保留旧路径作为总入口，避免既有链接失效。
- 新增 `wiki/topics/碧树西风-投资系统适用条件.md`，承接市场体量、执行者匹配、市场状态和系统准入条件。
- 新增 `wiki/topics/碧树西风-收益回撤与选资产规则.md`，承接收益目标、回撤约束、资产选择、安全边际和退出路径。
- 新增 `wiki/topics/碧树西风-仓位执行与复盘规则.md`，承接仓位、入场、退出、止损、风控和复盘机制。
- 更新 `index.md`，页面总数从 `122` 调整为 `125`。

## [2026-05-22] cleanup | reset bingbing xiaomei people page to empty template

- 按用户指令清空 `wiki/people/冰冰小美.md` 原有人物画像、来源和相关链接内容。
- 按当前 people 页面结构重新生成空模板，保留 `person` 类型 frontmatter、页面标题、人物页主要章节，以及空的“相关页面”“来源”部分。
- 未新增正式知识页，未重命名页面，`index.md` 保持原有人物入口不变。

## [2026-05-23] ingest | add bingbing xiaomei investment vs speculation worldview

- 基于已归档的 `2026-01-20` 原帖“全球割裂下的避险资产定位”，新增观点页 `wiki/views/冰冰小美对投资是国运红利分配史，投机是人性扭曲封建史的看法.md`。
- 更新 `wiki/people/冰冰小美.md`，把这条观点回链进人物页，并补入与“国家战略主导”“做多中国执行表达”“底线思维”相互印证的轻量画像。
- 更新 `index.md`，登记新观点入口，并将页面总数从 `127` 调整为 `128`。
- 本次未改动 `sources/`，因为原话已存在于 `sources/articles/2026-03-25-冰冰小美-2026一季度宏观子帖抓取（已完成41篇）.md` 的归档中。

## [2026-05-23] refactor | align bingbing xiaomei people page with page-types structure

- 按 `page-types.md` 的 `People Page` 结构，为 `wiki/people/冰冰小美.md` 补齐 `基本信息`、`人物背景`、`核心价值观`、`投资理念`、`人物性格`、`认知模式`、`风险偏好与仓位倾向` 七个缺失章节。
- 新增章节内容留空，保留现有 `定位`、`思维方式`、`体系`、`相关主题`、`代表性观点`、`相关页面` 与 `来源` 内容不动。
- 本次为结构对齐整理，未新增正式知识页，未更新 `index.md` 页面总数。

## [2026-05-25] refactor | convert bingbing xiaomei Q1 macro timeline to markdown table

- 回退误建的 `AI产业发展时间线` 正式页、对应手动来源归档和 `index.md` 索引入口，页面总数恢复为 `128`。
- 按用户要求将 `chronos` 代码块改为 Markdown 表格时间线，字段为时间范围、阶段、核心变化和对应正文。
- 新增 Mermaid `timeline` 竖向时间线，用同一组日期和阶段表达五个宏观阶段。
- 去掉正文小标题中的重复日期描述，让时间信息集中放在 Markdown 表格中表达。
- 保留原时间线页的五段详细解释不动，本次只替换“时间线”部分的展示格式。

- [2026-05-25 15:52:37] QUERY query="现在有产业思维的concept页面吗" result_pages=0 mode=normal escalated=false

## [2026-05-25] ingest | create empty industry thinking concept page

- 新增空白 Concept Page `wiki/concepts/产业思维.md`，仅包含 frontmatter、标题和待补充章节。
- 更新 `index.md` 的概念入口，并将页面总数从 `128` 调整为 `129`。

## [2026-05-25] ingest | fill industry thinking concept page

- 根据用户提供的“产业趋势投资方法论”七步框架，更新 `wiki/concepts/产业思维.md`。
- 补充定义、背景、核心观点、关键组成、使用场景、常见误区、相关页面和来源。
- 更新 `index.md` 中 `产业思维` 的一句话摘要。
## [2026-05-23] ingest | add bingbing xiaomei ai industry trend topic and reasoning

- 基于 `sources/assets/ai_industry_trend_logic.svg`，新增推导页 `wiki/reasoning/冰冰小美-AI产业趋势推导链.md`，把 SVG 中的七段逻辑整理为正式 `reasoning` 页面。
- 新增主题页 `wiki/topics/冰冰小美-AI产业趋势.md`，将冰冰小美关于 AI 的国家门票、技术路线、新钱承接、全球链条和估值分层判断组织为作者专属 AI 入口页。
- 更新 `wiki/people/冰冰小美.md`，补入新 AI 主题页和新推导页的回链。
- 更新 `index.md`，登记新的 topic 与 reasoning 入口，并将页面总数从 `128` 调整为 `130`。
- 当前仓库已找到《AI与国家》原文与相关日汇总，但 `ai_industry_trend_logic.svg` 标注的《2026年五月月报（一）（二）》原文暂未找到，已在新页面中标注为待补充来源。

- [2026-05-23 17:17 CST] QUERY query="查找冰冰小美有关有色的推导" result_pages=3 mode=normal escalated=false

## [2026-05-23] ingest | update bingbing xiaomei nonferrous reasoning with robot and copper trigger

- 新增 `sources/manual/2026-05-23-冰冰小美-有色重启上涨触发条件.md`，保存用户补充的短观点原文。
- 更新 `wiki/views/冰冰小美对有色拐点取决于通胀预期何时下降的看法.md`，补入“8 月特斯拉量产 + 美国通胀回落 + 降息预期升温”的新触发路径。
- 更新 `wiki/reasoning/冰冰小美-有色金属拐点推导.md`，将机器人带动铜需求、货币逻辑从收缩切向降息预期的共振关系并入推导链。
- 本次未新增正式知识页，`index.md` 页面总数保持不变。
- 已在相关页面标注：特斯拉量产、美国通胀回落和“收缩货币危机解除”均属于前瞻判断，待后续验证。

## [2026-05-23] link | embed nonferrous svg into reasoning page

- 更新 `wiki/reasoning/冰冰小美-有色金属拐点推导.md`，补入 `sources/assets/有色拐点逻辑推导流程图.svg` 的来源链接和页面内预览。
- 本次为已有推导页补原始图示，不新增正式知识页，`index.md` 页面总数保持不变。

## [2026-05-23] ingest | clarify ai endogenous variables in bingbing xiaomei reasoning

- 新增 `sources/manual/2026-05-23-冰冰小美-AI产业自身变量补充.md`，保存用户提供的雪球原文摘录、原始链接与风险提示。
- 更新 `wiki/reasoning/冰冰小美-AI产业趋势推导链.md`，把“AI 自身变量”明确拆成路线切换、物理约束、效率目标与受益环节迁移四层。
- 同步补入该摘录作为一手来源之一，并把高端 PCB、光通信、高端封装、电源散热等环节从举例提升为变量传导的一部分。
- 本次未新增正式知识页，`index.md` 页面总数保持不变。

## [2026-05-23] refactor | fold ai endogenous variables back into key variables

- 更新 `wiki/reasoning/冰冰小美-AI产业趋势推导链.md`，将单独的“AI 自身变量拆解”章节并回 `关键变量` 表。
- 将变量表达收敛为路线切换、物理约束、效率目标、创造性破坏四项，直接贴合原文，不再保留重复章节。
- 本次为页面结构微调，未新增正式知识页，`index.md` 页面总数保持不变。
## [2026-05-27] refactor | align bingbing xiaomei view pages with view template

- 按 `templates/view-page-template.md` 重构 `wiki/views/` 下 27 个冰冰小美观点页。
- 将旧结构中的“核心观点 / 核心判断”“观点内容 / 观点展开”“适用条件”“不确定性”“相关页面”“来源”等内容迁移到统一的 View Page 章节：当前核心观点、观点形成背景、观点时间线、判断依据摘要、关键前提、反向证据与风险、当前状态、不确定性、相关页面和来源。
- 本次不新增正式知识页，不调整 `index.md` 页面总数；`index.md` 与 `log.md` 中已有合并冲突标记未在本次任务中处理。

## [2026-05-27] refactor | retitle bingbing xiaomei view pages

- 按用户给定的“观点主体：判断对象的核心判断 / 判断框架 / 阶段判断”格式，更新 `wiki/views/` 下 27 个冰冰小美观点页的 frontmatter `title` 与一级标题。
- 标题统一改为 `冰冰小美：...核心判断 / 判断框架 / 阶段判断`，去掉“对……的看法”等口语化表达，并避免只写主题或堆砌变量。
- 本次未重命名文件，避免破坏现有 Obsidian 双链；未新增正式知识页，`index.md` 页面总数保持不变。

## [2026-05-27] refactor | rename bingbing xiaomei view files

- 将 `wiki/views/` 下 27 个冰冰小美观点页文件名同步为页面正式标题，例如 `冰冰小美：有色拐点取决于通胀预期回落的阶段判断.md`。
- 批量更新全库 Markdown 中指向旧 `views/冰冰小美对...的看法` 路径的 Obsidian 双链，共替换 291 处链接。
- 本次未新增正式知识页，`index.md` 页面总数保持不变；历史日志中的旧路径记录保留不回写。

## [2026-05-27] cleanup | delete view pages without valid sources

- 删除 `wiki/views/` 下 18 个 source 无有效原文支撑的观点页，其中 11 个为冰冰小美观点页，7 个为买股票的老木匠观点页。
- 判断依据：相关 `sources/transcripts/2026-04-02-*-雪球-汇总.md` 仅记录“未抓到目标日期帖子 / 未发现有效帖子正文”等抓取失败说明，不能支撑正式 View Page。
- 清理正式 wiki 页面和 `index.md` 中指向这些已删除 View Page 的 Obsidian 双链，避免保留空链接。
- 未删除 `sources/` 原始资料；抓取失败记录继续保留在 `sources/transcripts/` 中。

## [2026-05-27] cleanup | delete invalid empty source records

- 按用户要求删除 `sources/transcripts/` 下 3 个 2026-04-02 抓取失败记录：冰冰小美、买股票的老木匠、闵行一霸。
- 清理正式 wiki 页面中指向这些 source 记录的双链。
- 删除唯一来源也来自无效抓取记录的概念页 `wiki/concepts/冰冰小美-政策对冲与内部定价权.md`，避免保留 source 为空的正式页面。

## [2026-05-27] ingest | add bingbing xiaomei three allocation trading style

- 新增原始资料 `sources/articles/2026-05-27-冰冰小美：本轮行情的一些遗憾.md`，保存雪球帖 `391269787` 的正文、来源、作者和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-三大配置交易风格.md`，将“三大配置 / 四大方向”整理为冰冰小美的交易风格，而不是单次个股清单。
- 更新 `wiki/people/冰冰小美.md`、`wiki/views/冰冰小美：宏观服务风险识别与仓位调整的判断框架.md`、`wiki/views/冰冰小美：真正中长期需要底线思维的核心判断.md`、`wiki/timelines/冰冰小美-2026一季度宏观阶段时间线.md` 和 `wiki/topics/宏观经济.md`，补入三大配置交易风格的回链与方法论说明。
- 更新 `index.md`，登记新概念入口，并将页面总数从 `129` 调整为 `130`。

## [2026-05-27] rename | rename bingbing xiaomei three allocation concept

- 将概念页 `wiki/concepts/冰冰小美-三大配置交易风格.md` 重命名为 `wiki/concepts/冰冰小美-三大配置.md`。
- 更新 `index.md` 与相关 wiki 页面中的双链显示名，将正式入口收敛为“三大配置”；“三大配置交易风格”保留为页面 alias。

## [2026-05-27] seed | add bingbing xiaomei three systems concept placeholder

- 新增空概念页 `wiki/concepts/冰冰小美-三大体系.md`，按 `templates/concept-page-template.md` 的输出结构创建 seed 骨架。
- 更新 `index.md`，登记 seed 概念入口，并将页面总数从 `130` 调整为 `131`。

## [2026-05-27] rename | rename bingbing xiaomei three systems placeholder

- 将 seed 概念页 `wiki/concepts/冰冰小美-三大体系.md` 重命名为 `wiki/concepts/冰冰小美-体系三要素.md`。
- 更新 `index.md` 中对应概念入口，页面总数保持 `131` 不变。

## [2026-05-27] seed | add bingbing xiaomei changdian technology tracking timeline

- 新增空时间线 `wiki/timelines/冰冰小美-长电科技持续跟踪时间线.md`，按 `templates/timeline-page-template.md` 的输出结构创建 seed 骨架。
- 更新 `index.md`，登记 seed 时间线入口，并将页面总数从 `131` 调整为 `132`。

## [2026-05-27] seed | add bingbing xiaomei emotion system concept placeholder

- 新增空概念页 `wiki/concepts/冰冰小美-情绪体系.md`，按 `templates/concept-page-template.md` 的输出结构创建 seed 骨架。
- 更新 `index.md`，登记 seed 概念入口，并将页面总数从 `132` 调整为 `133`。

## [2026-05-27] seed | add bingbing xiaomei loss cognition concept placeholder

- 新增空概念页 `wiki/concepts/冰冰小美-亏钱认知.md`，按 `templates/concept-page-template.md` 的输出结构创建 seed 骨架。
- 更新 `index.md`，登记 seed 概念入口，并将页面总数从 `133` 调整为 `134`。

## [2026-05-27] ingest | archive and expand bingbing xiaomei three elements concept

- 新增原始资料 `sources/articles/2023-07-21-冰冰小美：体系三要素.md`，保存雪球帖 `256249725` 的正文、来源、作者和发布时间。
- 更新 `wiki/concepts/冰冰小美-体系三要素.md`，将 seed 概念页补全为 active 概念页，整理竞争格局的比较优势、流动性辩证分析和情绪位置的变化三项。
- 轻量更新 `wiki/people/冰冰小美.md` 与 `index.md`，补入体系三要素回链和概念摘要；页面总数保持 `134`。

## [2026-05-27] ingest | enrich bingbing xiaomei competitive advantage source

- 根据用户提供的 `E:/caojingwen/obsidian/source/体系贴/311912942/40_竞争格局的比较优势_291511412.md`，补正 `sources/articles/2026-05-18-冰冰小美：竞争格局的比较优势.md` 的原帖发布时间为 `2024-05-27 10:47`。
- 更新 `wiki/views/冰冰小美：比较优势来自安全与发展再平衡的判断框架.md` 的时间范围、观点时间线和不确定性说明。
- 更新 `wiki/concepts/冰冰小美-体系三要素.md` 中“竞争格局的比较优势”来源时间描述；本次不新增正式知识页，`index.md` 页面总数保持 `134`。

## [2026-05-27] link | require page references to use wikilinks

- 更新 `wiki/concepts/冰冰小美-体系三要素.md`，将正文中指向已有来源页和观点页的日期、标题与术语引用改为 Obsidian 双链。
- 更新 `AGENTS.md` 的双链规则，明确正文引用已有页面时必须使用 `[[页面路径|显示名称]]`，日期若指向来源页也必须链接到对应页面。

## [2026-05-27] fix | improve three elements concept comparison formatting

- 将 `wiki/concepts/冰冰小美-体系三要素.md` 的“与相近概念的区别”从 Markdown 表格改为列表，避免长 Obsidian 双链在表格中被拆行后渲染异常。

## [2026-05-27] ingest | enrich bingbing xiaomei liquidity dialectic source

- 根据用户提供的 `E:/caojingwen/obsidian/source/体系贴/311912942/41_流动性辩证分析_291532021.md`，补正 `sources/articles/2026-05-18-冰冰小美：流动性辩证分析.md` 的原帖发布时间为 `2024-05-27 12:55`。
- 更新 `wiki/views/冰冰小美：流动性有利不等于成交放大的判断框架.md` 的时间范围、观点时间线和不确定性说明。
- 更新 `wiki/concepts/冰冰小美-体系三要素.md` 中“流动性辩证分析”来源时间描述；本次不新增正式知识页，`index.md` 页面总数保持 `134`。

## [2026-05-27] ingest | expand bingbing xiaomei emotion system concept

- 根据用户提供的 `E:/caojingwen/obsidian/source/体系贴/311912942/21_情绪体系认知篇_289333959.md`，补正 `sources/articles/2026-05-21-冰冰小美：风险转弱的节点.md` 的原帖标题与发布时间为 `2024-05-09 13:24`。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`，将 seed 概念页补全为 active 概念页，整理情绪面风险、情绪转弱、情绪与流动性互相强化、交易窗口信号和概念边界。
- 轻量更新 `wiki/people/冰冰小美.md` 与 `index.md`，补入情绪体系回链和概念摘要；本次不新增正式知识页，`index.md` 页面总数保持 `134`。

## [2026-05-27] ingest | add bingbing xiaomei liquidity dialectic concept

- 新增原始资料 `sources/articles/2023-04-13-冰冰小美：流动性的简单概述.md`，保存雪球帖 `247332137` 的正文、作者、链接和发布时间。
- 新增原始资料 `sources/articles/2023-06-15-冰冰小美：流动性辩证分析.md`，保存雪球帖 `253297011` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-流动性辩证分析.md`，把该概念整理为宏观、中观、微观和情绪标承载四层，而不是单纯成交量判断。
- 更新 `wiki/concepts/冰冰小美-体系三要素.md`、`wiki/views/冰冰小美：流动性有利不等于成交放大的判断框架.md`、`wiki/people/冰冰小美.md`、`wiki/topics/宏观经济.md` 和 `index.md` 的回链；页面总数从 `134` 调整为 `135`。

## [2026-05-27] ingest | add bingbing xiaomei emotion trading concepts

- 新增原始资料 `sources/articles/2023-08-14-冰冰小美：情绪体系交易篇第一期分仓.md`，保存雪球帖 `258258564` 的正文、作者、链接和发布时间。
- 新增原始资料 `sources/articles/2023-08-15-冰冰小美：情绪体系交易篇第二期借势.md`，保存雪球帖 `258296606` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-分仓.md`，将“行情好多做，行情不好少做”整理为情绪体系中的仓位管理方法。
- 新增概念页 `wiki/concepts/冰冰小美-借势.md`，将“势成、等待时机、马太效应、流动性报团溢价”整理为情绪体系中的时机选择方法。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `135` 调整为 `137`。

## [2026-05-27] ingest | add bingbing xiaomei waiting concept

- 新增原始资料 `sources/articles/2023-08-18-冰冰小美：情绪体系交易篇第三期等.md`，保存雪球帖 `258680817` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-等.md`，将“善猎者，必善等待”“先印证，后交易”“等待时机成熟”整理为情绪体系中的时机过滤纪律。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `137` 调整为 `138`。

## [2026-05-27] ingest | add bingbing xiaomei emotion system practice note

- 新增原始资料 `sources/articles/2023-05-22-冰冰小美：这次看不懂，就可以告别情绪体系.md`，保存雪球帖 `251002176` 的正文、作者、链接和发布时间。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`，补入“实战观察重于复述结论”的使用边界：理解情绪体系要观察为什么买卖、当时市场环境和博弈结果后的情绪氛围。
- 本次不新增正式知识页，`index.md` 页面总数保持 `138`。

## [2026-05-28] ingest | add bingbing xiaomei yuzhi concept

- 使用已有原始资料 `sources/articles/2023-09-03-冰冰小美：情绪体系交易篇（第四期）.md`，对应雪球帖 `260153153` 和用户提供的第 26 篇《情绪体系交易篇 今日更新第四期 迂直》。
- 新增概念页 `wiki/concepts/冰冰小美-迂直.md`，将“以迂为直、以患为利、诱之以利、以分合为变”整理为情绪体系中的变化应对方法。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `138` 调整为 `139`。

## [2026-05-28] ingest | add bingbing xiaomei willingness concept

- 新增原始资料 `sources/articles/2023-09-04-冰冰小美：情绪体系交易篇第五期意愿.md`，保存雪球帖 `260260172` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-意愿.md`，将“交易意愿”“买入意愿”和“不同理由形成同一方向”整理为情绪体系中的交易形成变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `139` 调整为 `140`。

## [2026-05-28] ingest | add bingbing xiaomei character fit concept

- 新增原始资料 `sources/articles/2023-09-09-冰冰小美：情绪体系交易篇第六期性格匹配.md`，保存雪球帖 `260729520` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-性格匹配.md`，将“自我认知与实践的斗争”“体系约束胡思乱想”和“分仓调整性格状态”整理为情绪体系中的执行者适配变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `140` 调整为 `141`。

## [2026-05-28] ingest | add bingbing xiaomei belief concept

- 新增原始资料 `sources/articles/2023-09-22-冰冰小美：情绪体系交易篇第七期相信.md`，保存雪球帖 `261823122` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-相信.md`，将“真正的做多”“相信常识”“做多中国”和“不随恐慌贪婪摇摆”整理为情绪体系中的做多信念变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `141` 调整为 `142`。

## [2026-05-28] ingest | add bingbing xiaomei math model concept

- 新增原始资料 `sources/articles/2023-10-06-冰冰小美：情绪体系交易篇第八篇数学模型不败.md`，保存雪球帖 `262531108` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-数学模型不败.md`，将“减少出手”“减少失败”“以小博大”和“小资金长期训练”整理为情绪体系中的胜率与训练资金变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md`、`wiki/topics/概率化决策与风险控制.md` 和 `index.md` 的回链；页面总数从 `142` 调整为 `143`。

## [2026-05-28] ingest | add bingbing xiaomei buy sell concept

- 新增原始资料 `sources/articles/2023-10-09-冰冰小美：情绪体系交易篇第九期买卖.md`，保存雪球帖 `262678860` 的正文、作者、链接和发布时间。
- 新增概念页 `wiki/concepts/冰冰小美-买卖.md`，将“分时图诱惑”“买激发信心的意愿”“买相信的力量”“买国运”和“什么时候不卖”整理为情绪体系中的交易动作变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `143` 调整为 `144`。

## [2026-05-28] ingest | add bingbing xiaomei trade record cognition concept

- 新增原始资料 `sources/articles/2023-10-17-冰冰小美：情绪体系交易篇交割单的认知.md`，保存雪球帖 `263421435`《情绪体系交易篇第八期 交割单的认知》。
- 新增概念页 `wiki/concepts/冰冰小美-交割单认知.md`，将“研究亏损交割单”“体系性格不匹配”“情绪向下高频交易”“买是当日氛围，卖是明日行为”等整理为情绪体系中的复盘与失败模式识别变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `144` 调整为 `145`。

## [2026-05-28] ingest | add bingbing xiaomei empty position concept

- 新增原始资料 `sources/articles/2023-11-11-冰冰小美：情绪体系交易篇第十期空仓.md`，保存雪球帖 `266484468`《情绪体系交易篇 今日更新第十期 空仓》。
- 新增概念页 `wiki/concepts/冰冰小美-空仓.md`，将“空仓不是仓位的空仓”“市场行为不切合自身模式”“机构风格切换、游资情绪、套利收割、减量博弈和增量亢奋下的空仓”等整理为情绪体系中的风险规避变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `145` 调整为 `146`。

## [2026-05-28] ingest | add bingbing xiaomei tolerance concept

- 新增原始资料 `sources/articles/2024-04-02-冰冰小美：情绪体系交易篇容忍度.md`，保存雪球帖 `284473286`《情绪体系交易篇，容忍度》。
- 新增概念页 `wiki/concepts/冰冰小美-容忍度.md`，将“得失成败的动静”“买包括买入和不卖”“自信来自买入内核”“时间评价、比较心态、控仓和做 T 风险”等整理为情绪体系中的交易心理与仓位纪律变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `146` 调整为 `147`。

## [2026-05-28] ingest | add bingbing xiaomei emotion cycle concept

- 新增原始资料 `sources/articles/2023-05-31-冰冰小美：情绪周期是什么.md`，保存雪球帖 `251907063`《情绪周期是什么》。
- 新增概念页 `wiki/concepts/冰冰小美-情绪周期.md`，将“情绪周期不能脱离流动性辩证分析与竞争格局”“情绪标是火种”“整体情绪下降但局部正确方向仍可上升”“情绪螺旋上涨不是一直上涨”等整理为情绪体系中的动态位置识别变量。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `147` 调整为 `148`。
- 清理 `log.md` 中遗留的合并冲突标记，保留两侧历史维护记录。

## [2026-05-28] ingest | add bingbing xiaomei emotion ice point judgment concept

- 新增原始资料 `sources/articles/2023-06-28-冰冰小美：怎么判断情绪冰点，我们需要观察亏钱效应.md`，保存雪球帖 `254221078`《怎么判断情绪冰点，我们需要观察亏钱效应》。
- 新增概念页 `wiki/concepts/冰冰小美-情绪冰点判断.md`，将“观察亏钱效应”“情绪标未止跌则恐慌持续”“叠加指数和涨跌数量判断日内情绪底”整理为情绪周期下的冰点识别工具。
- 更新 `wiki/concepts/冰冰小美-情绪周期.md`、`wiki/concepts/冰冰小美-情绪体系.md`、`wiki/concepts/冰冰小美-等.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `148` 调整为 `149`。

## [2026-05-28] ingest | add bingbing xiaomei market unique solution concept

- 新增原始资料 `sources/articles/2023-07-03-冰冰小美：情绪体系是交易的体系，不是认知的体系.md`，保存雪球帖 `254706445`《情绪体系是交易的体系，不是认知的体系》。
- 新增概念页 `wiki/concepts/冰冰小美-市场唯一解.md`，将“情绪体系是交易的体系”“三要素确定就是寻求市场唯一解”“苛刻交易条件用于防范大回撤”和“买入不败不是无风险承诺”整理为三要素的交易筛选目标。
- 更新 `wiki/concepts/冰冰小美-体系三要素.md`、`wiki/concepts/冰冰小美-情绪体系.md`、`wiki/concepts/冰冰小美-分仓.md`、`wiki/concepts/冰冰小美-等.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `149` 调整为 `150`。

## [2026-05-28] ingest | add bingbing xiaomei illusion duration concept

- 新增原始资料 `sources/articles/2023-05-20-冰冰小美：情绪体系的最后总结篇.md`，保存雪球帖 `250899655`《情绪体系的最后总结篇》。
- 新增概念页 `wiki/concepts/冰冰小美-假象时间.md`，将“贪婪延长假象、恐惧压缩假象、把握假象时间形成情绪周期和盈亏比”整理为情绪体系中的时间变量。
- 更新 `wiki/concepts/冰冰小美-体系三要素.md`、`wiki/concepts/冰冰小美-情绪体系.md`、`wiki/concepts/冰冰小美-情绪周期.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `150` 调整为 `151`。

## [2026-05-28] ingest | add bingbing xiaomei emotion system core purpose concept

- 新增原始资料 `sources/articles/2023-06-20-冰冰小美：情绪体系的核心目的.md`，保存雪球帖 `253689232`《情绪体系的核心目的》。
- 新增概念页 `wiki/concepts/冰冰小美-情绪体系核心目的.md`，将“买入不败”“不亏钱才能持续复利”“挣钱效应和亏钱效应是信心体现”“二级市场交易形态”和“三要素相辅相成则阻力最小”整理为情绪体系的目标层概念。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/concepts/冰冰小美-体系三要素.md`、`wiki/concepts/冰冰小美-市场唯一解.md`、`wiki/concepts/冰冰小美-流动性辩证分析.md`、`wiki/concepts/冰冰小美-买卖.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `151` 调整为 `152`。

## [2026-05-28] ingest | add bingbing xiaomei short-term emotion major cycle concept

- 新增原始资料 `sources/articles/2023-04-28-冰冰小美：窝总结的短线情绪大周期.md`，保存雪球帖 `248993367`《窝总结的短线情绪大周期》。
- 新增概念页 `wiki/concepts/冰冰小美-短线情绪大周期.md`，将“失落恐慌→半信半疑→理性分析与大胆实践→接着奏乐接着舞”和指数、估值、流动性三类风险的开启/结束机制整理为情绪周期下的群体信心恢复框架。
- 更新 `wiki/concepts/冰冰小美-情绪周期.md`、`wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `152` 调整为 `153`。

## [2026-05-28] ingest | add bingbing xiaomei trading equanimity concept

- 新增原始资料 `sources/articles/2023-05-06-冰冰小美：情绪对自身的影响与人生豁达.md`，保存雪球帖 `249592214`《情绪对自身的影响与人生豁达》。
- 新增概念页 `wiki/concepts/冰冰小美-交易豁达.md`，将卖飞、买跌、看好后放弃又大涨、复盘亏钱效应、体系三要素约束和对贪婪的拒绝整理为情绪体系中的心理纪律概念。
- 更新 `wiki/concepts/冰冰小美-容忍度.md`、`wiki/concepts/冰冰小美-性格匹配.md`、`wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `153` 调整为 `154`。

## [2026-05-28] ingest | add bingbing xiaomei emotion consensus risk concept

- 新增原始资料 `sources/articles/2023-05-09-冰冰小美：什么情况容易情绪一致.md`，保存雪球帖 `249891836`《什么情况容易情绪一致》。
- 新增概念页 `wiki/concepts/冰冰小美-情绪一致性风险.md`，将边缘标的先涨停、情绪标未涨停、卡位成功想象、明日溢价贪婪和亏钱效应起点整理为情绪一致性风险。
- 更新 `wiki/concepts/冰冰小美-分仓.md`、`wiki/concepts/冰冰小美-买卖.md`、`wiki/concepts/冰冰小美-意愿.md`、`wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `154` 调整为 `155`。

## [2026-05-28] ingest | add bingbing xiaomei ice point trend reversal concept

- 新增原始资料 `sources/articles/2024-04-11-冰冰小美：情绪体系交易篇第十二期冰点转势.md`，保存雪球帖 `285552628`《情绪体系交易篇 第十二期 冰点的冰点发展美，转势》。
- 新增概念页 `wiki/concepts/冰冰小美-冰点转势.md`，将“冰点转折不一定是转势板”“亏钱效应来源”“指数共振”“虚空炒作向实体支撑切换”和“三要素有利”整理为情绪体系中的冰点后转势判断概念。
- 更新 `wiki/concepts/冰冰小美-情绪冰点判断.md`、`wiki/concepts/冰冰小美-情绪周期.md`、`wiki/concepts/冰冰小美-情绪体系.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `155` 调整为 `156`。

## [2026-05-28] ingest | add bingbing xiaomei weiwei jiuzhao loss effect concept

- 新增原始资料 `sources/articles/2024-04-23-冰冰小美：情绪体系交易篇围魏救赵亏钱效应.md`，保存雪球帖 `287248057`《情绪体系交易篇，都忘记多少期》。
- 新增概念页 `wiki/concepts/冰冰小美-围魏救赵亏钱效应.md`，将“反人性与反情绪套利”“低位小盘热点制造假象”“小成交上涨掩护大成交卖出”和“情绪流动性皆不利时的一致性恐慌卖点”整理为亏钱效应识别概念。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/concepts/冰冰小美-流动性辩证分析.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `156` 调整为 `157`。

## [2026-05-28] ingest | add bingbing xiaomei blocking-knife loss effect concept

- 新增原始资料 `sources/articles/2024-10-28-冰冰小美：情绪体系交易篇挡刀亏钱效应.md`，保存雪球帖 `309811574`《情绪体系交易篇》。
- 新增概念页 `wiki/concepts/冰冰小美-挡刀亏钱效应.md`，将“高切低预期差亏钱效应”“低位同概念补涨”“流动性余温大于情绪风险的瞬间换手封板”和“助力龙头加速见顶”整理为题材套利风险概念。
- 更新 `wiki/concepts/冰冰小美-情绪体系.md`、`wiki/concepts/冰冰小美-情绪周期.md`、`wiki/concepts/冰冰小美-流动性辩证分析.md`、`wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `157` 调整为 `158`。

## [2026-05-28] fix | normalize ice point trend reversal frontmatter for Obsidian

- 更新 `wiki/concepts/冰冰小美-冰点转势.md` 的 frontmatter，将 `related` 从嵌套分类对象改为 Obsidian Properties 更易显示的扁平双链列表。
- 将来源字段从 `source` 对齐为 schema 契约中的 `sources`；本次未新增正式知识页，`index.md` 页面总数保持 `158`。

## [2026-05-28] ingest | add bingbing xiaomei common loss cognition series

- 归档 19 篇原始资料到 `sources/articles/2023-03-18-冰冰小美：常见亏钱认知第一期预期差.md` 至 `sources/articles/2023-10-13-冰冰小美：常见亏钱认知第十九期新加坡富时A50指数.md`，并用 SHA256 校验源文件与归档文件一致。
- 补全概念页 `wiki/concepts/冰冰小美-亏钱认知.md`，将预期差、止损、懂的都懂、概念逻辑、大盘、利润垫、消息、涨停板、追涨、卖点、分时图、卡位、一字板、假象、套利、机构、轮动、高度板和 A50 等整理为反向排雷框架。
- 新增主题页 `wiki/topics/冰冰小美-常见亏钱认知系列.md`，逐期登记 19 篇来源、核心命题和风险类型。
- 新增推导链页 `wiki/reasoning/冰冰小美-亏钱认知如何转化为亏钱效应.md`，拆解亏钱认知从话术、消息、图形、心理暗示、买卖失真到流动性分散和亏钱效应的传导。
- 更新 `wiki/people/冰冰小美.md` 和 `index.md` 的回链；页面总数从 `158` 调整为 `160`。

## [2026-05-28] ingest | add view for common loss cognition 01 expected difference

- 新增观点页 `wiki/views/冰冰小美对预期差诱发贪婪的看法.md`，对应 `sources/articles/2023-03-18-冰冰小美：常见亏钱认知第一期预期差.md`。
- 将“预期差”整理为作者所说的画饼式交易话术：它通过空间大、想象力大等表述刺激贪婪，容易让交易者见小利、急于验证想象空间并偏离体系。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `160` 调整为 `161`。

## [2026-05-28] ingest | add view for common loss cognition 02 stop loss

- 新增观点页 `wiki/views/冰冰小美对止损恐惧与买入质量的看法.md`，对应 `sources/articles/2023-03-19-冰冰小美：常见亏钱认知第二期止损.md`。
- 将“止损”整理为作者对恐惧式风控的批评：真正应复盘的是买入是否平庸、是否顺应情绪上升，以及卖出时是否理解自己持有的先手和流动性条件。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `161` 调整为 `162`。

## [2026-05-28] ingest | add view for common loss cognition 03 understood-by-those-who-understand

- 新增观点页 `wiki/views/冰冰小美对懂的都懂掩盖认知不确定的看法.md`，对应 `sources/articles/2023-03-19-冰冰小美：常见亏钱认知第三期懂的都懂.md`。
- 将“懂的都懂”整理为作者对模糊话术的批评：它容易掩盖内心焦躁和认知不确定，真正的认知必须转化为单向、具体、适合自身体系和性格的交易判断。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `162` 调整为 `163`。

## [2026-05-28] ingest | add view for common loss cognition 04 concept logic

- 新增观点页 `wiki/views/冰冰小美对概念逻辑制造假象的看法.md`，对应 `sources/articles/2023-03-20-冰冰小美：常见亏钱认知第四期概念逻辑.md`。
- 将“概念逻辑”整理为作者对个股花边、概念科普和故事化叙事的批评：它们可能制造上涨假象，但若不讨论时机、情绪位置和退出，就容易诱发贪婪。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `163` 调整为 `164`。

## [2026-05-28] ingest | add view for common loss cognition 05 market index

- 新增观点页 `wiki/views/冰冰小美对大盘涨跌放大情绪的看法.md`，对应 `sources/articles/2023-03-20-冰冰小美：常见亏钱认知第五期大盘.md`。
- 将“大盘”整理为作者对指数情绪的观点：大盘涨跌会放大贪婪和恐惧，但不应被机械当作价值分析或买卖依据，真正要观察的是情绪、指数和流动性是否共振。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `164` 调整为 `165`。

## [2026-05-28] ingest | add view for common loss cognition 06 profit cushion

- 新增观点页 `wiki/views/冰冰小美对利润垫心理的看法.md`，对应 `sources/articles/2023-06-12-冰冰小美：常见亏钱认知第六期利润垫.md`。
- 将“利润垫”整理为作者对主观安全感的批评：买后期待立刻上涨是贪婪，有浮盈才敢拿是恐惧，二者都会妨碍客观观察市场行为。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `165` 调整为 `166`。

## [2026-05-28] ingest | add view for common loss cognition 07 message mining

- 新增观点页 `wiki/views/冰冰小美对消息挖掘诱发羊群效应的看法.md`，对应 `sources/articles/2023-06-13-冰冰小美：常见亏钱认知第七期挖掘机消息.md`。
- 将“挖掘机消息”整理为作者对消息依赖的批评：消息正确不必然带来决策正确，消息新鲜感和自媒体证据链常会放大贪婪、屁股决定脑袋和羊群效应。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `166` 调整为 `167`。

## [2026-05-28] ingest | add view for common loss cognition 08 limit-up board

- 新增观点页 `wiki/views/冰冰小美对涨停板作为观察锚的看法.md`，对应 `sources/articles/2023-06-19-冰冰小美：常见亏钱认知第八期涨停板.md`。
- 将“涨停板”整理为作者对形态崇拜的批评：涨停只是交易中断和观察锚，不能直接等同于强弱标准或隔日溢价承诺，关键仍是时机、情绪标和持续流动性溢价。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `167` 调整为 `168`。

## [2026-05-28] ingest | add view for common loss cognition 09 do-not-chase-rising

- 新增观点页 `wiki/views/冰冰小美对切勿追涨恐惧上涨的看法.md`，对应 `sources/articles/2023-06-20-冰冰小美：常见亏钱认知第九期切勿追涨.md`。
- 将“切勿追涨”整理为作者对恐惧上涨的批评：上涨本身不是风险，关键在于区分情绪主流中的新高与非情绪标蹭套利、受高度压制的跟风买入。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `168` 调整为 `169`。

## [2026-05-28] ingest | add view for common loss cognition 10 selling skill

- 新增观点页 `wiki/views/冰冰小美对卖点焦虑源于买入质量的看法.md`，对应 `sources/articles/2023-06-20-冰冰小美：常见亏钱认知第十期会卖的是师傅，会买的是徒弟.md`。
- 将“会卖的是师傅，会买的是徒弟”整理为作者对卖点焦虑的反转：好卖点通常依赖买入时情绪有利和隔日流动性有利，买入不败比事后纠结卖点更前置。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `169` 调整为 `170`。

## [2026-05-28] ingest | add view for common loss cognition 11 intraday chart

- 新增观点页 `wiki/views/冰冰小美对分时图技术分析制造恐惧的看法.md`，对应 `sources/articles/2023-06-27-冰冰小美：常见亏钱认知第十一期分时图技术分析.md`。
- 将“分时图技术分析”整理为作者对图形恐惧暗示的批评：冲高回落、跳水等术语容易让人脱离情绪、流动性和买入体系，误把分时波动当成独立交易条件。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `170` 调整为 `171`。

## [2026-05-28] ingest | add view for common loss cognition 12 position-snatching crossing

- 新增观点页 `wiki/views/冰冰小美对卡位穿越制造龙头假象的看法.md`，对应 `sources/articles/2023-07-05-冰冰小美：常见亏钱认知第十二期卡位穿越.md`。
- 将“卡位穿越”整理为作者对形式高度竞争的批评：没有真正引发情绪和信心共振的卡位，只是流动性变化和资金博弈，可能制造龙头假象和高位亏钱效应。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `171` 调整为 `172`。

## [2026-05-28] ingest | add view for common loss cognition 13 ebb one-word board

- 新增观点页 `wiki/views/冰冰小美对情绪退潮中杂毛顶一字的看法.md`，对应 `sources/articles/2023-08-14-冰冰小美：常见亏钱认知第十三期情绪退潮杂毛顶一字.md`。
- 将“情绪退潮，杂毛顶一字”整理为作者对退潮期边缘一字板的批评：一字板若不引发情绪波动，就不是情绪标，反而可能分化主线流动性并造成隔日负反馈。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `172` 调整为 `173`。

## [2026-05-28] ingest | add view for common loss cognition 14 illusion and anti-humanity

- 新增观点页 `wiki/views/冰冰小美对假象与反人性套利的看法.md`，对应 `sources/articles/2023-08-15-冰冰小美：常见亏钱认知第十四期假象与反人性的折磨.md`。
- 将“假象与反人性的折磨”整理为作者对局部炒作和接盘假象的批评：利空或行业压力中的小盘炒作，可能只是内部流动性衰竭和掩护出货的一部分。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `173` 调整为 `174`。

## [2026-05-28] ingest | add view for common loss cognition 15 arbitrage harm

- 新增观点页 `wiki/views/冰冰小美对套利分散流动性合力的看法.md`，对应 `sources/articles/2023-08-21-冰冰小美：常见亏钱认知第十五期套利的危害.md`。
- 将“套利的危害”整理为作者对后排套利和轮动套利的批评：套利会分散流动性、消耗做多合力，并通过冲高回落、热点溃散和情绪负反馈放大亏钱效应。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `174` 调整为 `175`。

## [2026-05-28] ingest | add view for common loss cognition 16 institution role

- 新增观点页 `wiki/views/冰冰小美对机构买卖不是万能信号的看法.md`，对应 `sources/articles/2023-09-05-冰冰小美：常见亏钱认知第十六期机构的作用.md`。
- 将“机构的作用”整理为作者对机构迷信的批评：机构买卖只是市场众多交易行为之一，不能替代对资金来源、被动调仓和场外承接意愿的流动性分析。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `175` 调整为 `176`。

## [2026-05-28] ingest | add view for common loss cognition 17 rotation

- 新增观点页 `wiki/views/冰冰小美对频繁轮动制造亏钱效应的看法.md`，对应 `sources/articles/2023-09-17-冰冰小美：常见亏钱认知第十七期轮动.md`。
- 将“轮动”整理为作者对频繁方向切换的批评：频繁轮动意味着流动性无法聚焦强势股或主线方向，容易造成交易意愿衰竭、热点回落和亏钱效应升温。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `176` 调整为 `177`。

## [2026-05-28] ingest | add view for common loss cognition 18 height-board pressure

- 新增观点页 `wiki/views/冰冰小美对高度板压制旧模式的看法.md`，对应 `sources/articles/2023-10-12-冰冰小美：常见亏钱认知第十八期高度板压制作用.md`。
- 将“高度板压制作用”整理为作者对旧连板模式失效的批评：当高度板形成无形天花板、流动性转向阻力更小方向时，继续套用旧模式容易进入交易阻力区。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `177` 调整为 `178`。

## [2026-05-28] ingest | add view for common loss cognition 19 ftse-a50

- 新增观点页 `wiki/views/冰冰小美对富时A50作为恐慌指数的看法.md`，对应 `sources/articles/2023-10-13-冰冰小美：常见亏钱认知第十九期新加坡富时A50指数.md`。
- 将“新加坡富时 A50 指数”整理为作者对外部指数情绪扰动的批评：A50 在其体系中只是情绪或恐慌观察项，不能替代真实亏钱效应、情绪标和体系三要素。
- 更新 `wiki/topics/冰冰小美-常见亏钱认知系列.md` 的逐篇观点页列表和 `index.md`；页面总数从 `178` 调整为 `179`。

- [2026-05-28T14:47:59+08:00] QUERY query="跟性格相关的有哪些" result_pages=16 mode=normal escalated=false
- [2026-05-28T14:51:56+08:00] QUERY query="根据知识库回答什么是平庸的交易" result_pages=7 mode=normal escalated=false
- [2026-05-28T14:59:07+08:00] QUERY query="如何形成我的体系" result_pages=12 mode=normal escalated=false
- [2026-05-28T15:08:04+08:00] QUERY query="如何理解冰冰小美的“相信”" result_pages=6 mode=normal escalated=false
- [2026-05-28T15:09:42+08:00] QUERY query="什么是真正做多？与单纯上涨的区别" result_pages=4 mode=normal escalated=false
- [2026-05-28T15:11:03+08:00] QUERY query="根据冰冰小美的体系解释，现在已经是泡沫初期了，为什么今天还要买创业板" result_pages=9 mode=normal escalated=true
- [2026-05-28T15:15:57+08:00] QUERY query="也就是说体系三要素没有被证伪，就可以买入吗？" result_pages=5 mode=normal escalated=false
- [2026-05-28T15:18:48+08:00] QUERY query="做多的信号是什么？" result_pages=6 mode=normal escalated=false

## [2026-05-28] refactor | move emotion system core purpose to view page

- 将 `wiki/concepts/冰冰小美-情绪体系核心目的.md` 迁移为观点页 `wiki/views/冰冰小美对情绪体系核心目的的看法.md`。
- 按 View Page 结构重写页面，明确它回答的是“冰冰小美怎么看情绪体系的核心目的”，而不是定义独立 what 类概念。
- 更新相关页面、来源备注和 `index.md` 的双链；页面总数不变。
