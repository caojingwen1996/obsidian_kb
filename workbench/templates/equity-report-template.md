# Workbench 个股研报模板

正式正文使用 `.agents/skills/bbxm-equity-research/template.md`。保存时增加：

```yaml
---
artifact_type: equity_research
security_code: ""
market: ""
created: YYYY-MM-DDTHH:mm:ss+08:00
updated: YYYY-MM-DDTHH:mm:ss+08:00
as_of: YYYY-MM-DDTHH:mm:ss+08:00
framework_refs: []
---
```

目标路径：`workbench/targets/<公司名称>-机构级决策研报.md`，不加日期或时间前缀。HTML使用相同文件名主体；创建、更新及研究截止日期分别维护在 `created`、`updated`、`as_of`，并在报告顶部显示更新日期与数据截止期。已有带日期的权威报告按 `workbench/AGENTS.md` 迁移并同步引用。
