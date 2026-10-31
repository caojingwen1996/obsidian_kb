
- source_spec: `docs/superpowers/specs/2026-10-29-f01-material-migration.md`
  summary: 事件展示时间应建立可索引投影，避免全量证据内存排序后分页。
  evidence: 原EventQueries.list和当前事件入口均全量投影文本日期后分页，本轮未引入该复杂度；数据库级投影须保持chooseDisplayTime及权限语义。

- source_spec: `docs/superpowers/specs/2026-10-29-f01-material-migration.md`
  summary: 提示词重组后AI-05文档一致性、AI-03展示解析及旧schema4抽取测试仍失败。
  evidence: final-full.log中279项有3项失败；两个已删除V0.1文档引用和AI-03无正文围栏，均在本轮开始前已存在，不恢复用户删除文件或改断言掩盖。
