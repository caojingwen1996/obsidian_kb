# 页面模板索引

本目录保存正式知识页的可复制模板；复制前先确认知识库归属，`wiki/` 与 `wiki_laomujiang/` 分别维护自己的页面。

本目录不保存个股研报、公告跟踪或操作记录模板。这些动态研究工件使用 `workbench/templates/`。

使用规则：

1. 先根据 `page-types.md` 判断页面类型；
2. 正式知识页复制到所属知识库的对应类型目录；
3. 替换标题、日期和 frontmatter，填写正文来源双链与 `related` 关联字段；新建页面不添加 `source` 或 `sources` 属性，包括空值、空数组；所有页面类型均不生成“相关页面”正文章节；
4. 不确定、待验证或来源不足的信息必须保留标注；
5. 新增正式知识页后，根据需要更新 `index.md`，并追加 `log.md`。
6. 填写表格时遵守 [[schema#表格内双链与列数检查|表格内双链与列数检查]]；生成或修改后，对本次 Markdown 文件运行 `python3 rules/check_markdown_tables.py`，修复未转义的双链和列数异常，通过后才能交付。

## 模板列表

- `concept-page-template.md`：Concept Page / 概念页
- `indicator-page-template.md`：Indicator Page / 观测指标规范；字段与输出按Schema，发布前运行指标检查
- `people-page-template.md`：People Page / 人物页
- `event-page-template.md`：Event Page / 事件页
- `timeline-page-template.md`：Timeline Page / 时间线页
- `reasoning-page-template.md`：Reasoning Page / 推导链页
- `query-page-templates.md`：Query Page / 问题页
- `topic-page-template.md`：Topic Page / 主题聚合页
