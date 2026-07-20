# Workbench Targets 扁平化设计

## 目标

减少个股研究的目录层级。所有权威 Markdown 研报和后续跟踪节点直接放入 `workbench/targets/`，不再使用“证券目录 / reports”结构；HTML 和资金分析回到其原始自动化分类目录。

## 最终结构

```text
workbench/
  AGENTS.md
  index.md
  templates/
  targets/
    YYYY-MM-DD-HHmm-标的-机构级决策研报.md
    YYYY-MM-DD-标的-事件跟踪.md

sources/automations/
  支柱产业/
    README.md
    *.html
  商业航天每日跟踪/
    *.html
  temp/
    README.md
    未分类标的产物
```

`workbench/targets/` 下不得创建标的子目录，也不再保留单标的 `index.md`、`reports/`、`tracking/`、`outputs/`、`models/` 或 `sources/` 子目录。

## 工件路由

### Markdown 研究工件

- 权威个股研报直接写入 `workbench/targets/`。
- 后续公告、价格变化、资金变化和操作逻辑节点同样直接写入 `workbench/targets/`。
- 使用 frontmatter `artifact_type` 区分 `equity_research` 与 `tracking`。
- 文件名必须包含日期和标的；跟踪节点还应包含事件名称。现有研报保留原文件名，不为本次迁移额外重命名。

### HTML 与资金分析

- HTML、资金面分析和其他自动化展示产物不进入 Workbench。
- 原属支柱产业的产物恢复到 `sources/automations/支柱产业/`。
- 原属商业航天每日跟踪的产物恢复到 `sources/automations/商业航天每日跟踪/`。
- 无法归入现有产业自动化目录的产物放入 `sources/automations/temp/`。
- `sources/automations/temp/README.md` 明确该目录用于尚未分类的标的产物，不作为权威研报目录。

### 重复文件

三安光电“原始副本 Markdown”恢复到 `sources/automations/temp/`。`workbench/targets/` 只保留一份三安光电权威研报。

## 导航

- 删除现有 30 个单标的 `index.md`。
- `workbench/index.md` 直接链接扁平化后的权威 Markdown 研报。
- 航天电子目前没有 Markdown；其索引项直接链接 `sources/automations/商业航天每日跟踪/` 中的 HTML，并标注“Markdown 待补”。
- 正式 Wiki 根 `index.md` 继续不收录个股研报。

## 生成契约

`bbxm-equity-research`、Workbench 模板和项目验证测试统一使用：

```text
workbench/targets/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md
```

不得再次生成 `workbench/targets/<证券代码>-<公司简称>/reports/`。

## 迁移与兼容

- 迁移 29 份权威 Markdown 研报到 `workbench/targets/` 根层。
- 恢复 25 份 HTML 到原自动化目录。
- 恢复 1 份三安光电重复 Markdown 到 `sources/automations/temp/`。
- 删除 30 个单标的索引并修复全部旧双链。
- 保留文件正文和 frontmatter；迁移只改变路径，规则文件除外。

## 验收标准

1. `workbench/targets/` 下有 29 份权威 Markdown 研报，且没有子目录。
2. Workbench 中不存在 HTML，也不存在 `type: query/event/timeline`。
3. `sources/automations/支柱产业/`、`商业航天每日跟踪/` 和 `temp/` 中的产物恢复到规定位置。
4. `workbench/index.md` 的链接全部可解析。
5. 仓库中不存在指向旧 `targets/<证券代码>-<公司简称>/reports/` 的链接或生成合同。
6. Workbench 边界测试、HTML 渲染测试、冲突标记检查、编码检查和 `git diff --check` 通过。

## 非目标

- 本次不改写研报正文或估值结论。
- 本次不为航天电子重新生成 Markdown。
- 本次不修复与目录扁平化无关的 `bbxm-industry-analysis` 既有合同测试。
