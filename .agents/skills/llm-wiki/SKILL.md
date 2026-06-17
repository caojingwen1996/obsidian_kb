---
name: llm-wiki
description: >
  用于构建和维护 AI 辅助 Obsidian 知识库的基础知识蒸馏模式。
  该模式基于 Andrej Karpathy 的 LLM Wiki 架构。用户想理解 wiki 模式、
  搭建新知识库，或需要理解 raw sources → wiki → schema 三层架构时使用本技能。
  当讨论知识管理策略、wiki 结构决策，或如何组织蒸馏后的知识时，也使用本技能。
  这是“理论”技能；具体操作由其他技能负责，例如 ingest、query、lint。
---

# LLM Wiki：知识蒸馏模式

你维护的是一个持久、可复利增长的知识库。wiki 不是聊天机器人，而是一个**编译后的成果物**：知识被蒸馏一次，并在之后持续维护，而不是每次提问时重新推导。

## 三层架构

### 第一层：原始资料，保持不可变

用户的原始文档，包括文章、论文、笔记、PDF、对话记录、书签，以及图片，例如截图、白板照片、图表和幻灯片截图。这些资料不由系统修改。它们存放在用户指定的位置，路径由 `.env` 中的 `OBSIDIAN_SOURCES_DIR` 配置。

图片是一等来源。ingest 类技能会借助具备视觉能力的读取工具解释图片内容；除非是逐字转写文本，否则图片解释结果都应视为推断。图片 ingest 需要具备视觉能力的模型；不支持视觉的模型应跳过图片来源，并报告跳过了哪些文件。

可以把原始资料理解成“源代码”：权威，但不容易直接查询。

### 第二层：Wiki，由 LLM 维护

wiki 是一组互相连接、兼容 Obsidian 的 Markdown 文件，按类别组织。它是编译后的知识层，经过综合、交叉引用和导航化处理。每个页面应包含：

- YAML frontmatter，例如标题、类别、标签、来源和时间戳；
- Obsidian `[[wikilinks]]`，用于连接相关概念；
- 清晰来源，每个关键断言都能追溯回来源。

wiki 路径由 `.env` 中的 `OBSIDIAN_VAULT_PATH` 配置。

### 第三层：Schema，本技能与配置

schema 定义 wiki 如何组织，包括类别、约定、页面模板和操作流程。schema 告诉 LLM 应该**如何**维护 wiki。

## Wiki 组织方式

知识库有两层结构：**类别**说明知识类型，**项目**说明知识来源或适用范围。

### 类别

默认类别如下，可在 `.env` 中自定义：

| 类别 | 用途 | 示例 |
|---|---|---|
| `concepts/` | 概念、理论、心智模型 | `concepts/transformer-architecture.md` |
| `entities/` | 人物、组织、工具、项目 | `entities/andrej-karpathy.md` |
| `skills/` | 操作性知识和流程 | `skills/fine-tuning-llms.md` |
| `references/` | 特定来源的整理页 | `references/attention-is-all-you-need.md` |
| `synthesis/` | 跨来源综合分析 | `synthesis/scaling-laws-debate.md` |
| `journal/` | 带时间戳的观察和会话记录 | `journal/2024-03-15.md` |

### 项目

很多知识属于某个具体项目。`projects/` 目录用于镜像这种关系：

```text
$OBSIDIAN_VAULT_PATH/
├── projects/
│   ├── my-project/
│   │   ├── my-project.md      ← 项目总览，文件名与项目名一致
│   │   ├── concepts/          ← 项目范围内的类别页面
│   │   ├── skills/
│   │   └── ...
│   ├── another-project/
│   │   └── ...
│   └── side-project/
│       └── ...
├── concepts/                   ← 全局知识，跨项目复用
├── entities/
├── skills/
└── ...
```

当知识只适用于某个项目时，例如某个代码库专用的调试技巧或架构决策，应放入 `projects/<project-name>/<category>/`。

当知识具有通用性时，例如 “React Server Components”、人物 “Andrej Karpathy”、或可复用技能，应放入全局类别目录。

**交叉引用：**项目页应通过 `[[wikilink]]` 链接到全局页面，全局页面也可以回链项目页面。项目总览页应链接该项目相关的关键概念、技能和实体页面，不论它们位于项目目录还是全局目录。

**命名规则：**项目总览文件必须命名为 `<project-name>.md`，不要命名为 `_project.md`。Obsidian 图谱使用文件名作为节点标签；如果所有项目都叫 `_project.md`，图谱会变得不可读。

项目总览页结构示例：

```markdown
---
title: My Project
category: project
tags: [ai, web, backend]
source_path: ~/.claude/projects/-Users-name-Documents-projects-my-project
created: 2026-03-01T00:00:00Z
updated: 2026-04-06T00:00:00Z
---

# My Project

用一段话说明这个项目是什么。

## Key Concepts

- [[concepts/some-api]]：用于核心功能。
- [[projects/my-project/concepts/main-architecture]]：项目专属架构。

## Related

- [[entities/some-service]]：部署平台。
```

## 特殊文件

每个 wiki 根目录都应包含这些文件。

### `index.md`

面向内容的目录，按类别组织。每条记录包含一句摘要和标签。每次 ingest 后都应重建或更新。格式示例：

```markdown
# Wiki Index

## Concepts

- [[transformer-architecture]]：用于序列建模的主流架构 ( #ml #architecture)
- [[attention-mechanism]]：Transformer 的核心组成部分 ( #ml #fundamentals)

## Entities

- [[andrej-karpathy]]：AI 研究者、教育者、前 Tesla AI 负责人 ( #person #ml)
```

**格式规则：**标签前的左括号后要加空格。

- 不要写：`description (#tag)`，这会破坏标签解析。
- 应写成：`description ( #tag)`，便于正确解析标签。

### `log.md`

按时间顺序追加的操作日志，用于记录每次维护行为。每条日志应便于机器解析：

```markdown
## Log

- [2024-03-15T10:30:00Z] INGEST source="papers/attention.pdf" pages_updated=12 pages_created=3
- [2024-03-15T11:00:00Z] QUERY query="How do transformers handle long sequences?" result_pages=4
- [2024-03-16T09:00:00Z] LINT issues_found=2 orphans=1 contradictions=1
- [2024-03-17T10:00:00Z] ARCHIVE reason="rebuild" pages=87 destination="_archives/..."
- [2024-03-17T10:05:00Z] REBUILD archived_to="_archives/..." previous_pages=87
```

### `.manifest.json`

记录已经 ingest 的每个来源文件，包括路径、时间戳和生成的 wiki 页面。它是增量系统的骨架，完整 schema 见 `wiki-status` 技能。

manifest 支持：

- **增量计算**：判断哪些来源是新增或修改过的；
- **追加模式**：只处理增量，不重复处理全部来源；
- **审计**：追踪哪个来源生成了哪些 wiki 页面；
- **陈旧检测**：来源变化后，发现 wiki 页面尚未更新。

## 页面模板

创建新 wiki 页面时，使用以下结构：

```markdown
---
title: Page Title
category: concepts
tags: [ml, architecture]
aliases: [alternate name]
relationships:
  - target: "[[concepts/related-concept]]"
    type: extends
sources: [papers/attention.pdf]
summary: One or two sentences, ≤200 chars, so a reader (or another skill) can preview this page without opening it.
provenance:
  extracted: 0.72
  inferred: 0.25
  ambiguous: 0.03
base_confidence: 0.65
lifecycle: draft
lifecycle_changed: 2024-03-15
tier: supporting
created: 2024-03-15T10:30:00Z
updated: 2024-03-15T10:30:00Z
---

# Page Title

用一段话说明本页覆盖什么。

## Key Ideas

- 来源明确提出的中心观点，使用转述表达。
- 来源没有直接说明、但可以从来源推出的一般化结论。^[inferred]
- 多个来源互相矛盾的说法。^[ambiguous]

使用 [[wikilinks]] 连接相关页面。

## Open Questions

记录尚未解决、需要更多来源的问题。

## Sources

- [[references/attention-is-all-you-need]]：原始论文。
```

## 来源标记

wiki 页面中的每个断言都有三种来源状态。使用行内标记，让读者和未来的 ingest 过程能区分原文信息与综合推断。

| 状态 | 标记 | 含义 |
|---|---|---|
| **Extracted** | 不加标记，默认状态 | 对来源实际内容的转述。 |
| **Inferred** | 句尾加 `^[inferred]` | LLM 综合出的连接、泛化或暗含结论，来源没有直接说明。 |
| **Ambiguous** | 句尾加 `^[ambiguous]` | 来源之间存在冲突，或来源表述不清。 |

示例：

```markdown
- Transformers parallelize across positions, unlike RNNs.
- This is why they scale better on modern hardware. ^[inferred]
- GPT-4 was trained on roughly 13T tokens. ^[ambiguous]
```

选择这种语法的原因：

- `^[...]` 接近 Obsidian 脚注语法，渲染干净，也不会与 `[[wikilinks]]` 冲突；
- 作为句尾后缀，一个 bullet 仍然保持为一个 bullet；
- 默认状态为 extracted，旧页面不加标记也仍然有效。

**Frontmatter summary：**可以选择在页面级别暴露粗略比例，方便识别推断较多的页面：

```yaml
provenance:
  extracted: 0.72
  inferred: 0.25
  ambiguous: 0.03
```

这些比例由 ingest 技能在创建或更新页面时尽力估算。`wiki-lint` 可以重新计算并提示漂移。该字段可省略；没有该字段的页面按惯例视为全部 extracted。

## 类型化关系

正文中的普通 `[[wikilinks]]` 只表示“相关”，不说明关系类型。可选的 `relationships:` frontmatter 块可以给知识图谱增加有方向、有类型的边。

### `relationships:` 块

```yaml
relationships:
  - target: "[[Transformer Architecture]]"
    type: extends
  - target: "[[LSTM]]"
    type: contradicts
  - target: "[[Attention Mechanism]]"
    type: implements
```

每条关系有两个必填字段：

- `target`：指向相关页面的 wikilink，格式与 `OBSIDIAN_LINK_FORMAT` 一致；
- `type`：下面允许的语义类型之一。

### 允许的关系类型

| Type | 含义 | 示例 |
|---|---|---|
| `extends` | 本页扩展或泛化目标页面 | GPT extends Transformer Architecture |
| `implements` | 本页是目标概念的具体实现 | BERT implements Masked Language Modelling |
| `contradicts` | 本页断言与目标页面冲突或反驳目标页面 | Evidence A contradicts Evidence B |
| `derived_from` | 本页基于目标页面或由其改写而来 | Fine-tuning is derived from Transfer Learning |
| `uses` | 本页依赖或使用目标页面 | RAG uses Vector Databases |
| `replaces` | 本页取代或废弃目标页面 | GPT-4 replaces GPT-3 |
| `related_to` | 兜底关系，相关但没有更强方向 | Concept A is related to Concept B |

### 规则

- **可选字段**：没有明确类型关系时可以完全省略。未标注的 wikilink 会被 `wiki-export` 视为 `related_to`。
- **不要重复**：如果正文已经出现 `[[foo]]`，`relationships:` 只是在语义上增强它，不是第二个链接。
- **方向重要**：声明关系的页面是起点，`target` 是终点。只从当前页面视角声明关系。
- **不要编造**：只有来源材料能明确支持方向和类型时，才写类型化关系。不确定时使用 `related_to` 或省略。

会读取 `relationships:` 的技能包括：`wiki-export`、`cross-linker`、`wiki-query`。

## 置信度与生命周期

每个页面带有两个相互独立的可信度信号，并可选择带有被替代链接。

### 必填字段

```yaml
base_confidence: 0.65          # 0.0 到 1.0，表示不随时间变化的质量估计；内容变化时重新计算。
lifecycle: draft               # draft | reviewed | verified | disputed | archived
lifecycle_changed: 2024-03-15  # 最近一次状态变化的 ISO 日期
# lifecycle_reason: "..."      # 可选，说明状态变化原因；wiki-query 可展示。
# superseded_by: "[[new-page]]" # 可选，仅 lifecycle=archived 时使用。
```

`lifecycle_reason` 和 `superseded_by` 是可选字段，不要编造。

### 置信度公式

```text
base_confidence = source_count_score * 0.5 + source_quality_score * 0.5

source_count_score   = min(distinct_source_ids / 3, 1.0)
source_quality_score = avg(quality score per distinct source_id)
```

**来源质量分：**使用匹配度最高的一档。

| 来源类型 | 分数 | 示例 |
|---|---:|---|
| `paper` | 1.0 | arXiv、会议论文 |
| `official` | 0.9 | `*.gov`、厂商官方文档 |
| `documentation` | 0.85 | 维护良好的第三方文档 |
| `book` | 0.8 | 书籍、技术参考资料 |
| `repository` | 0.75 | GitHub README、代码库 |
| `blog` | 0.55 | 个人博客 |
| `session_transcript` | 0.5 | 对话历史 |
| `forum` | 0.4 | Stack Overflow、HN、Reddit |
| `unknown` | 0.4 | 兜底 |
| `llm_generated` | 0.3 | LLM 自我反思 |

**`source_id`** 是每个来源的稳定标识，避免同一篇博客的多个副本被算作多个独立来源：

| 来源类型 | `source_id` 规则 |
|---|---|
| 学术论文 | DOI 优先，其次 arXiv ID，再其次 `<author>-<year>-<slug>` |
| GitHub 仓库 | `github.com/<owner>/<repo>` |
| 文档站点 | `<canonical-host>/<product>` |
| 博客文章 | `<host>/<author>` |
| 会话转写 | `<agent>/<session-id>` |
| 其他 | `<canonical-url>` |

**各技能默认值：**

| 技能 | base_confidence | lifecycle |
|---|---|---|
| `ingest-url` | `0.17 + 0.5 × classify(url)` | `draft` |
| `wiki-ingest`，单文档 | 按来源分类器计算 | `draft` |
| `wiki-ingest`，多文档 | `min(N/3,1)×0.5 + avg_q×0.5` | `draft` |
| `wiki-research` | 视来源而定，常见为 0.85 以上 | `draft` |
| `wiki-capture` | 0.42 | `draft` |
| `*-history-ingest` | 0.42 | `draft` |
| `wiki-update` | 0.59 | `draft` |
| `wiki-synthesize` | `min(input_pages.base_confidence)` | `draft` |
| `data-ingest` | 0.37 | `draft` |

### 生命周期状态机

共有五种状态。`stale` 不是状态，而是计算出的覆盖层：`is_stale = (today - updated) > 90 days`。

| 状态 | 进入方式 | 说明 |
|---|---|---|
| `draft` | 任意 ingest 技能首次写入 | 新页面默认状态 |
| `reviewed` | 仅人工编辑 | |
| `verified` | 仅人工编辑 | 时间流逝不会自动降低 verified 状态 |
| `disputed` | 仅人工编辑 | 展示时优先于除 archived 外的所有状态 |
| `archived` | 人工编辑，或 ingest 技能设置 `superseded_by` | 终态 |

只有 ingest 技能会设置 `draft`。其他状态转换都需要人工编辑。每次状态变化都要更新 `lifecycle_changed`。

## 重要性分层

`tier:` 字段决定每次 ingest 时优先更新哪些页面，也影响检索排序。随着 wiki 增大，每次 ingest 都重读所有页面会浪费上下文；分层能让 ingest 和 query 技能把精力放在最重要的页面上。

### 三个层级

| Tier | 含义 | Ingest 行为 | Query 优先级 |
|---|---|---|---|
| `core` | 承重页面，很多页面依赖它，入链多或处于桥接位置 | 只要来源略相关就优先更新 | 在索引和全文读取时优先展示 |
| `supporting` | 标准 wiki 页面，连接度中等，默认值 | 来源对本页有明确新断言时更新 | 标准优先级 |
| `peripheral` | 低连接页面，范围很窄，较少被引用 | 只有来源主要讨论本主题时才更新 | 最后考虑；上下文紧张时可跳过 |

### 分配规则

- **新页面**：默认 `tier: supporting`。
- **提升为 `core`**：当页面获得至少 5 个入链，或被 `wiki-status` insights 模式识别为桥接页面。
- **降为 `peripheral`**：当页面入链不超过 1 个，且 90 天以上未更新。
- **人工覆盖优先**：用户手动编辑的 `tier:` 始终优先。
- 没有 `tier:` 的旧页面按 `supporting` 处理，保持向后兼容。

### 谁管理 tier

- `wiki-ingest` 读取 `tier:`，决定当前 ingest 是否更新页面。
- `wiki-query` 使用 `tier:` 排序候选页面，并在上下文受限时裁剪。
- `wiki-status` insights 模式计算图谱指标并建议分层，但不自动写入。
- `wiki-lint` 会提示新页面缺失 `tier:`，作为后续阶段的约束。

## 检索原语

读取 vault 是所有读侧技能的主要成本。应使用能回答问题的最低成本原语，只有不足时才升级。任何需要读取 vault 内容的技能都应遵守下表，而不是直接全文读取。

| 需求 | 原语 | 相对成本 |
|---|---|---|
| 页面是否存在？标题、类别、标签是什么？ | 读取 `index.md`；或用 grep 定位文件头 frontmatter | 最低 |
| 页面的一到两句预览 | 读取 frontmatter 的 `summary:` | 低 |
| 页面内的具体断言或章节 | `Grep -A <n> -B <n> "<term>" <file>`，只返回匹配行和上下文 | 中 |
| 整页内容 | `Read <file>` | 高，最后手段 |
| 页面关系 | 跨 vault 搜索 `[[...]]`，或从已知页面沿 wikilink 遍历 | 视情况而定 |

**规则：**只有较便宜的原语无法回答时才升级。如果 `summary:` 足够回答，就不要读正文。如果带上下文的 grep 能找到需要的断言，就不要为了 15 行内容打开 500 行页面。

这样做是为了让技能框架能扩展到大知识库，而不是在 200 个页面时被上下文成本拖垮。

## QMD 索引新鲜度

QMD 是可选的搜索索引层，Markdown vault 才是真正来源。任何写入 wiki Markdown 的技能都应在写入完成后刷新 QMD，但前提是配置了 `QMD_WIKI_COLLECTION`，且本地 QMD transport 可用。如果 QMD 刷新失败，应保留 vault 修改，并单独报告 QMD 状态。

最低验证路径是：先 `qmd update`，只有向量陈旧或缺失时再 `qmd embed`，然后用定向的 `qmd get` 或 `qmd ls` 检查一个已写页面或集合根。只读技能不刷新 QMD。

## 核心原则

1. **编译，而不是检索。** wiki 是预编译知识。ingest 来源时，要更新所有相关页面，而不是只生成来源摘要。
2. **随时间复利。** 每次 ingest 都应让 wiki 更聪明，而不只是更大。新信息要合并进已有页面，解决冲突，加强交叉引用。
3. **来源很重要。** 每个断言都应能追踪到来源。更新页面时，要说明是什么来源触发了更新。
4. **标记推断。** 默认句子是 extracted。综合性断言标 `^[inferred]`，有争议的断言标 `^[ambiguous]`。不标猜测的 wiki 会悄悄腐烂，标出猜测的 wiki 才能保持可信。
5. **人类策展，LLM 维护。** 人类决定加入哪些来源、提出哪些问题。LLM 负责维护细节，例如补链、保持一致、记录矛盾。
6. **Obsidian 是 IDE。** 用户会在 Obsidian 中浏览和探索 wiki。所有内容都必须是有效的 Obsidian Markdown，并有可用的 wikilinks。

## 链接格式

连接 wiki 页面时，内部链接格式由解析后的配置 `OBSIDIAN_LINK_FORMAT` 控制，默认是 `wikilink`。

| 设置 | 语法 | 示例 |
|---|---|---|
| `wikilink`，默认 | `[[path/to/page|page]]` 或 `[[path/to/page/|]]` | `[[concepts/foo/|]]` |
| `markdown` | `[display text](relative/path.md)` | `[foo](../concepts/foo.md)` |

### 生成 Markdown 格式链接

当 `OBSIDIAN_LINK_FORMAT=markdown` 时：

1. 从**当前文件所在目录**计算到目标 `.md` 文件的相对路径，必要时使用 `..` 上跳；
2. 使用页面标题或自然短语作为显示文本；
3. 始终包含 `.md` 扩展名。

| 当前文件 | 目标文件 | 相对链接 |
|---|---|---|
| `index.md` | `concepts/foo.md` | `[foo](concepts/foo.md)` |
| `concepts/foo.md` | `entities/bar.md` | `[bar](../entities/bar.md)` |
| `projects/my-project/my-project.md` | `concepts/foo.md` | `[foo](../../concepts/foo.md)` |
| `projects/my-project/concepts/arch.md` | `entities/bar.md` | `[bar](../../../entities/bar.md)` |

`[[path/|]]` 形式在 Markdown 模式下映射为 `[display text](relative/path.md)`。

**范围：**该设置只影响新写入或被更新的链接。不会自动迁移已有 vault 内容。用户如果要转换旧链接，可以运行 `cross-linker` 或 `wiki-lint`。

所有写入技能在生成链接前都应从配置中读取 `OBSIDIAN_LINK_FORMAT`，并使用正确格式。

## 配置解析协议

**所有技能都必须按以下算法解析配置，不要直接硬编码 `.env` 或 `~/.obsidian-wiki/config`。** 这样才能同时支持单 vault、多 vault、项目本地配置和 VPS 部署。

### 解析顺序

1. **从 CWD 向上查找**：先看当前目录是否有 `.env`，再逐级向父目录查找，直到 `$HOME`。找到第一个包含 `OBSIDIAN_VAULT_PATH` 的 `.env` 后停止。
2. **全局配置**：如果没有找到本地 `.env`，读取 `~/.obsidian-wiki/config`。
3. **提示初始化**：如果两者都不存在，告诉用户：`No config found. Run wiki-setup to initialize your wiki.`

```sh
find_config() {
  dir="$PWD"
  while [[ "$dir" != "$HOME" && "$dir" != "/" ]]; do
    [[ -f "$dir/.env" ]] && grep -q "OBSIDIAN_VAULT_PATH" "$dir/.env" && { echo "$dir/.env"; return; }
    dir="$(dirname "$dir")"
  done
  [[ -f "$HOME/.obsidian-wiki/config" ]] && { echo "$HOME/.obsidian-wiki/config"; return; }
  echo ""
}
```

### Vault 范围内的状态

写入运行时状态的技能，例如 `daily-update`，必须把状态限定在解析到的 vault 上，而不是写入全局路径。使用：

```sh
VAULT_ID=$(echo "$OBSIDIAN_VAULT_PATH" | md5sum 2>/dev/null || md5 -q - <<< "$OBSIDIAN_VAULT_PATH" | cut -c1-8)
STATE_DIR="$HOME/.obsidian-wiki/state/$VAULT_ID"
```

### 标准 Before You Start 块

每个技能的 setup 部分都应包含：

> **解析配置**：遵守 `llm-wiki/SKILL.md` 中的配置解析协议。从 CWD 向上查找 `.env`，没有则回退到 `~/.obsidian-wiki/config`，仍没有则提示初始化。这样可以得到 `OBSIDIAN_VAULT_PATH` 和其他工具特定路径覆盖。

## 环境变量

wiki 通过环境变量配置，见 `.env.example`。唯一必填变量是 vault 路径，其余都有合理默认值。

- `OBSIDIAN_VAULT_PATH`：wiki 所在路径，必填。
- `OBSIDIAN_SOURCES_DIR`：原始资料所在路径。
- `OBSIDIAN_CATEGORIES`：类别列表，用逗号分隔。
- `CLAUDE_HISTORY_PATH`：Claude 对话数据路径。
- `CODEX_HISTORY_PATH`：Codex 会话数据路径。
- `HERMES_HOME`：Hermes agent 数据路径。
- `OPENCLAW_HOME`：OpenClaw 数据路径。
- `COPILOT_HISTORY_PATH`：Copilot 历史路径。
- `OBSIDIAN_LINK_FORMAT`：内部链接语法，`wikilink` 为默认，也可设为 `markdown`。
- `WIKI_TOKEN_WARN_THRESHOLD`：当 `wiki-status` 估算全 wiki token 超过该值时发出警告，默认 `100000`。设为 `0` 可关闭。详见 `wiki-status` 的 token footprint 报告。
- `WIKI_STAGED_WRITES`：设为 `true` 时，LLM 写入的页面先进入 `_staging/<category>/`，供人工审核后再提升。详见 `wiki-setup` 和 `wiki-stage-commit`。

不需要 API key。运行这些技能的 agent 已内置 LLM 能力。

## 操作模式

wiki 支持三种 ingest 模式：

| 模式 | 何时使用 | 发生什么 |
|---|---|---|
| **Append** | 小增量、渐进更新 | 通过 manifest 计算增量，只 ingest 新增或修改来源 |
| **Rebuild** | 漂移严重、需要重新开始 | 将当前 wiki 归档到 `_archives/`，清空后重新处理全部来源 |
| **Restore** | 需要回到旧版本 | 恢复某个历史归档 |

使用 `wiki-status` 查看增量并获得 append 或 rebuild 建议。使用 `wiki-rebuild` 执行归档、重建或恢复。

## 参考技能

具体操作请查看配套技能：

- **wiki-status**：审计已 ingest 内容，计算增量，建议 append 或 rebuild。
- **wiki-rebuild**：归档当前 wiki、从头重建或恢复归档。
- **wiki-ingest**：将来源文档蒸馏为 wiki 页面。
- **claude-history-ingest**：ingest Claude 对话历史。
- **codex-history-ingest**：ingest Codex CLI 会话历史。
- **data-ingest**：ingest 任意原始文本数据。
- **wiki-query**：基于 wiki 回答问题。
- **wiki-lint**：审计并维护 wiki 健康。
- **wiki-setup**：初始化新 vault。
